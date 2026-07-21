import Link from "next/link";
import { getBacktestStore } from "@/lib/data/backtestStore";
import { scoreBacktests } from "@/lib/backtest/backtest";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { Badge, Card, Stat } from "@/components/ui";
import { money, VERDICT_LABEL, verdictTone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BacktestDashboard() {
  await requireAuthorizedUser();
  const records = await getBacktestStore().list();
  const card = scoreBacktests(records.map((r) => ({ outcome: r.outcome })));

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Historical Backtesting</h1>
          <p className="mt-1 text-sm text-muted">
            Would TaxSale Copilot have helped, using only information available <em>before</em> each sale?
            A false BUY is treated as worse than a missed PASS.
          </p>
        </div>
        <Link href="/backtest/new" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
          + New backtest
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Tested" value={card.total} />
        <Stat label="Strong Buy" value={card.strongBuy} tone="good" />
        <Stat label="Buy" value={card.buy} tone="good" />
        <Stat label="Watch" value={card.watch} tone="warn" />
        <Stat label="Pass" value={card.pass} tone="muted" />
        <Stat label="Strong Pass" value={card.strongPass} tone="bad" />
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Decision quality</h2>
        <p className="mb-3 text-xs text-muted">A FALSE BUY (recommended a deal reality proved bad) is the error we minimize first.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Correct BUY" value={card.correctBuy} tone="good" />
          <Stat label="False BUY" value={card.falseBuy} tone="bad" />
          <Stat label="Correct PASS" value={card.correctPass} tone="good" />
          <Stat label="False PASS" value={card.falsePass} tone="warn" />
          <Stat label="False BUY rate" value={card.falseBuyRate === null ? "—" : `${Math.round(card.falseBuyRate * 100)}%`} tone={card.falseBuyRate && card.falseBuyRate > 0 ? "bad" : "good"} />
        </div>

        <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Accuracy & outcomes</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Would have bid" value={card.wouldHaveBid} />
          <Stat label="Winnable ≤ max safe bid" value={card.boughtBelowMaxSafe} tone="good" />
          <Stat label="Wanted but outbid" value={card.outbidOnWanted} tone="warn" />
          <Stat label="Inconclusive" value={card.inconclusive} tone="muted" />
          <Stat label="Valuation error (avg / med)" value={`${fmt(card.avgValuationErrorPct)} / ${fmt(card.medianValuationErrorPct)}`} />
          <Stat label="Renovation error (avg / med)" value={`${fmt(card.avgRenovationErrorPct)} / ${fmt(card.medianRenovationErrorPct)}`} />
          <Stat label="Rent error (avg / med)" value={`${fmt(card.avgRentErrorPct)} / ${fmt(card.medianRentErrorPct)}`} />
          <Stat label="Capital if all won" value={money(card.totalCapitalIfBidAtMaxSafe)} />
        </div>

        {card.patternFlags.length > 0 && (
          <div className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3">
            <div className="mb-1 text-xs font-semibold uppercase text-warn">Systematic bias (error analysis)</div>
            <ul className="space-y-1 text-xs text-muted">
              {card.patternFlags.map((f, i) => <li key={i}>• {f}</li>)}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Errors are computed only where a post-sale actual was recorded; they use later known values,
          never leaked into the prediction.
        </p>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Backtested properties</h2>
        {records.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              No backtests yet. First create a property using only pre-sale information, then{" "}
              <Link href="/backtest/new" className="text-accent hover:underline">add a backtest</Link> with the actual winning bid.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {records.map((r) => {
              const c = r.outcome.comparison;
              const p = r.outcome.prediction;
              return (
                <Link key={r.id} href={`/backtest/${r.id}`}>
                  <Card className="transition hover:border-accent/50">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-xs text-muted">Tax sale {r.taxSaleDate ?? "—"}</div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <Field label="Min tender" value={money(c.minimumTender)} />
                        <Field label="Winning bid" value={money(c.actualWinningBid)} />
                        <Field label="Our max safe" value={money(p.predictedMaxSafeBid)} />
                        <Badge tone={verdictTone(p.predictedVerdict)}>{VERDICT_LABEL[p.predictedVerdict]}</Badge>
                        <Badge tone={c.wouldWeHaveWonIt ? "good" : c.wouldWeBid ? "warn" : "muted"}>
                          {c.wouldWeBid ? (c.couldWeHaveWon ? "WOULD WIN" : "OUTBID") : "WOULD PASS"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(n: number | null): string {
  return n === null ? "—" : `${n}%`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-xs text-muted">{label}</div>
      <div className="tnum font-medium">{value}</div>
    </div>
  );
}
