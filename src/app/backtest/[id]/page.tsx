import Link from "next/link";
import { notFound } from "next/navigation";
import { getBacktestStore } from "@/lib/data/backtestStore";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { Badge, Card, Row, Section, Stat } from "@/components/ui";
import { money, VERDICT_LABEL, verdictTone } from "@/lib/format";
import { deleteBacktestAction } from "@/app/backtest/actions";

export const dynamic = "force-dynamic";

export default async function BacktestDetail({ params }: { params: { id: string } }) {
  await requireAuthorizedUser();
  const record = await getBacktestStore().get(params.id);
  if (!record) notFound();

  const { prediction: p, comparison: c } = record.outcome;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/backtest" className="text-xs text-muted hover:text-text">← Backtests</Link>
          <h1 className="mt-1 text-2xl font-bold">{record.name}</h1>
          <p className="text-sm text-muted">Tax sale {record.taxSaleDate ?? "—"} · backtested {record.createdAt.slice(0, 10)}</p>
        </div>
        <form action={deleteBacktestAction.bind(null, record.id)}>
          <button className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:border-bad hover:text-bad">Delete</button>
        </form>
      </div>

      <Card className="border-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge tone={verdictTone(p.predictedVerdict)} className="px-3 py-1 text-base">{VERDICT_LABEL[p.predictedVerdict]}</Badge>
            <Badge tone={c.wouldWeHaveWonIt ? "good" : c.wouldWeBid ? "warn" : "muted"} className="px-3 py-1 text-base">
              {c.wouldWeBid ? (c.couldWeHaveWon ? "WOULD HAVE WON" : "WOULD HAVE BEEN OUTBID") : "WOULD HAVE PASSED"}
            </Badge>
          </div>
          <div className="text-sm text-muted">
            Would we have bid? <b className="text-text">{c.wouldWeBid ? "Yes" : "No"}</b> · Could we have won at ≤ max safe bid?{" "}
            <b className="text-text">{c.couldWeHaveWon ? "Yes" : "No"}</b>
          </div>
        </div>
      </Card>

      <Section title="Prediction vs. Actual" subtitle="Prediction uses pre-sale info only; actuals are used solely for this comparison.">
        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="Minimum tender" value={money(c.minimumTender)} />
          <Stat label="Actual winning bid" value={money(c.actualWinningBid)} tone="warn" />
          <Stat label="Our max safe bid" value={money(p.predictedMaxSafeBid)} tone="good" />
          <Stat label="Our target bid" value={money(p.predictedTargetBid)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Our prediction (pre-sale)</h3>
            <Row label="Predicted market value" value={money(p.predictedMarketValue)} />
            <Row label="Predicted ARV" value={money(p.predictedArv)} />
            <Row label="Predicted renovation" value={money(p.predictedRenovation)} />
            <Row label="Predicted monthly rent" value={money(p.predictedMonthlyRent)} />
            <Row label="Conservative / target / max safe" value={`${money(p.predictedConservativeBid)} / ${money(p.predictedTargetBid)} / ${money(p.predictedMaxSafeBid)}`} />
            <Row label="Walk-away bid" value={money(p.predictedWalkAwayBid)} />
            <Row label="Score / confidence" value={`${p.predictedScore} / ${p.predictedConfidence}`} />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Outcome</h3>
            <Row label="Bid gap vs. our max safe" value={money(c.bidGapVsMaxSafe)} tone={c.bidGapVsMaxSafe > 0 ? "bad" : "good"} note={c.bidGapVsMaxSafe > 0 ? "cleared above us" : "within our ceiling"} />
            <Row label="Won below our target?" value={c.wonBelowTarget ? "Yes" : "No"} />
            <Row label="Predicted discount to winning bid" value={`${c.predictedDiscountToWinningBid}%`} />
            <Row label="Valuation error (vs later value)" value={c.valuationErrorPct === null ? "— (no later value)" : `${c.valuationErrorPct}%`} />
            <Row label="ARV error" value={c.arvErrorPct === null ? "—" : `${c.arvErrorPct}%`} />
            <Row label="Renovation error" value={c.renovationErrorPct === null ? "—" : `${c.renovationErrorPct}%`} />
            <Row label="Rent error" value={c.rentErrorPct === null ? "—" : `${c.rentErrorPct}%`} />
          </div>
        </div>
        {record.notes && <p className="mt-4 rounded-lg border border-border bg-surface2 p-3 text-xs text-muted">Notes: {record.notes}</p>}
      </Section>

      <p className="text-xs text-muted">
        Reproducibility: this record stores the frozen pre-sale input snapshot and the prediction made
        at backtest time, so the result is stable even if the engine changes later.
        {record.propertyId && (
          <> · <Link href={`/properties/${record.propertyId}`} className="text-accent hover:underline">View the property</Link></>
        )}
      </p>
    </div>
  );
}
