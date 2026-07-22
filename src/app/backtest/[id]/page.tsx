import Link from "next/link";
import { notFound } from "next/navigation";
import { getBacktestStore } from "@/lib/data/backtestStore";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { Badge, Card } from "@/components/ui";
import { money, VERDICT_LABEL, verdictTone } from "@/lib/format";
import { deleteBacktestAction } from "@/app/backtest/actions";

export const dynamic = "force-dynamic";

export default async function BacktestDetail({ params }: { params: { id: string } }) {
  await requireAuthorizedUser();
  const record = await getBacktestStore().get(params.id);
  if (!record) notFound();

  const { prediction: p, comparison: c } = record.outcome;
  const a = record.actuals;
  const correct = c.decision === "CORRECT_BUY" || c.decision === "CORRECT_PASS";

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

      {/* Verdict + decision banner */}
      <Card className="border-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge tone={verdictTone(p.predictedVerdict)} className="px-3 py-1 text-base">{VERDICT_LABEL[p.predictedVerdict]}</Badge>
            <Badge tone={c.decision === "FALSE_BUY" ? "bad" : correct ? "good" : c.decision === "FALSE_PASS" ? "warn" : "muted"} className="px-3 py-1 text-base">
              {c.decision.replace("_", " ")}
            </Badge>
            <Badge tone={c.bidClass === "OVERBID" ? "bad" : c.bidClass === "BOUGHT_WITHIN_SAFE" ? "good" : "warn"}>
              {c.bidClass.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="text-sm text-muted">{c.decisionRationale}</div>
        </div>
      </Card>

      {/* PRE-SALE vs ACTUAL, strongly separated */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">🔒 PRE-SALE PREDICTION</span>
            <span className="text-xs text-muted">what we knew before the sale</span>
          </div>
          <Kv k="Estimated market value" v={money(p.predictedMarketValue)} />
          <Kv k="Estimated ARV" v={money(p.predictedArv)} />
          <Kv k="Estimated renovation" v={money(p.predictedRenovation)} />
          <Kv k="Estimated rent (base)" v={money(p.predictedMonthlyRent)} />
          <Kv k="Estimated NOI" v={money(p.predictedNoi)} />
          <Kv k="Conservative bid" v={money(p.predictedConservativeBid)} />
          <Kv k="Target bid" v={money(p.predictedTargetBid)} />
          <Kv k="Maximum safe bid" v={money(p.predictedMaxSafeBid)} strong />
          <Kv k="Walk-away bid" v={money(p.predictedWalkAwayBid)} />
          <Kv k="Confidence" v={`${p.predictedConfidence}/100`} />
          <Kv k="Verdict" v={VERDICT_LABEL[p.predictedVerdict]} strong />
        </div>

        <div className="rounded-xl border-2 border-warn/50 bg-warn/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-warn/20 px-2 py-0.5 text-xs font-semibold text-warn">📓 ACTUAL OUTCOME</span>
            <span className="text-xs text-muted">what actually happened</span>
          </div>
          <Kv k="Winning bid" v={money(c.actualWinningBid)} strong />
          <Kv k="Actual renovation" v={money(a.actualRenovation ?? null)} />
          <Kv k="Actual rent" v={money(a.actualMonthlyRent ?? null)} />
          <Kv k="Actual market / appraisal / resale" v={money(a.actualSalePriceLater ?? null)} />
          <Kv k="Actual ARV realized" v={money(a.actualArv ?? null)} />
          <Kv k="Actual refinance value" v={money(a.actualRefinanceValue ?? null)} />
        </div>
      </div>

      {/* Derived comparison */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Comparison</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 md:grid-cols-3">
          <Kv k="Bid gap (winning − max safe)" v={money(c.bidGapVsMaxSafe)} />
          <Kv k="Valuation error" v={err(c.valuationErrorPct)} />
          <Kv k="ARV error" v={err(c.arvErrorPct)} />
          <Kv k="Renovation error" v={err(c.renovationErrorPct)} />
          <Kv k="Rent error" v={err(c.rentErrorPct)} />
          <Kv k="Predicted discount to winning bid" v={`${c.predictedDiscountToWinningBid}%`} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Flag label="Could have won?" yes={c.couldWeHaveWon} />
          <Flag label="Would we have bought?" yes={c.wouldWeBid} />
          <Flag label="Correct decision?" yes={correct} />
          <Flag label="False BUY?" yes={c.decision === "FALSE_BUY"} bad />
          <Flag label="Missed opportunity?" yes={c.decision === "FALSE_PASS"} warn />
        </div>
        <p className="mt-4 rounded-lg border border-border bg-surface2 p-3 text-xs text-muted">
          <b className="text-text">&ldquo;Could have won&rdquo; ≠ &ldquo;should have bought&rdquo;.</b> A property can be won cheaply and
          still be a bad investment. The primary question is whether the deal met our return and risk
          criteria — not whether the auction cleared below our ceiling.
        </p>
        {record.notes && <p className="mt-3 text-xs text-muted">Notes: {record.notes}</p>}
      </Card>

      <p className="text-xs text-muted">
        Reproducibility: this record stores the frozen pre-sale input snapshot and the prediction made
        at backtest time.
        {record.propertyId && (
          <> · <Link href={`/properties/${record.propertyId}`} className="text-accent hover:underline">View the property</Link></>
        )}
      </p>
    </div>
  );
}

function Kv({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between border-b border-border/40 py-1">
      <span className="text-xs text-muted">{k}</span>
      <span className={`tnum text-sm ${strong ? "font-semibold" : ""}`}>{v}</span>
    </div>
  );
}

function err(n: number | null): string {
  return n === null ? "—" : `${n}%`;
}

function Flag({ label, yes, bad, warn }: { label: string; yes: boolean; bad?: boolean; warn?: boolean }) {
  const tone = yes ? (bad ? "bad" : warn ? "warn" : "good") : "muted";
  return (
    <div className="rounded-lg border border-border bg-surface2 px-3 py-2 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1">
        <Badge tone={tone as "good" | "bad" | "warn" | "muted"}>{yes ? "YES" : "NO"}</Badge>
      </div>
    </div>
  );
}
