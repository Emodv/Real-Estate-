import Link from "next/link";
import { getPropertyStore } from "@/lib/data/store";
import { underwrite, rankProperties, type Verdict } from "@/lib/underwriting";
import { requireAuthorizedUser } from "@/lib/auth/session";
import { Badge, Card, Stat } from "@/components/ui";
import { money, pct, VERDICT_LABEL, verdictTone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAuthorizedUser();

  const store = getPropertyStore();
  const properties = await store.list();
  const analyzed = properties
    .map((p) => ({ p, r: underwrite(p.input) }))
    .sort((a, b) => b.r.bid.maximumSafeBid - a.r.bid.maximumSafeBid);

  const count = (v: Verdict) => analyzed.filter((a) => a.r.verdict === v).length;
  const strongBuy = count("STRONG_BUY");
  const buy = count("BUY") + count("CONDITIONAL_BUY");
  const watch = count("WATCH");
  const pass = count("PASS");
  const strongPass = count("STRONG_PASS");

  const ranked = rankProperties(
    analyzed.map((a) => ({ id: a.p.id, name: a.p.name, municipality: a.p.municipality, input: a.p.input, result: a.r })),
  );
  const priority = ranked.find((x) => !x.hasFatal && x.recommendedAction === "INVESTIGATE IMMEDIATELY") ?? ranked[0];
  const recent = [...analyzed].sort((a, b) => b.p.updatedAt.localeCompare(a.p.updatedAt)).slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Opportunity Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Conservative BRRRR underwriting for Ontario tax-sale properties. The system prefers
          NO DEAL over a BAD DEAL.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Properties" value={properties.length} />
        <Stat label="Strong Buy" value={strongBuy} tone="good" />
        <Stat label="Buy" value={buy} tone="good" />
        <Stat label="Watch" value={watch} tone="warn" />
        <Stat label="Pass" value={pass} tone="muted" />
        <Stat label="Strong Pass" value={strongPass} tone="bad" />
      </div>

      {priority && (
        <Card className="border-accent/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-xs uppercase tracking-wide text-accent">What should I look at first? — Priority #1</div>
              <Link href={`/properties/${priority.id}`} className="text-lg font-semibold hover:underline">
                {priority.name}
              </Link>
              <div className="mt-1 text-xs text-muted">
                Recommended action: <span className="font-semibold text-text">{priority.recommendedAction}</span> ·
                score {priority.total}/100 · confidence {priority.confidence}/100 · risk {priority.riskScore}/100
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs md:grid-cols-4">
                <span className="text-muted">Opportunistic <b className="text-text">{money(priority.opportunisticBid)}</b></span>
                <span className="text-muted">Target <b className="text-text">{money(priority.targetBid)}</b></span>
                <span className="text-muted">Max safe <b className="text-text">{money(priority.maxSafeBid)}</b></span>
                <span className="text-muted">Walk-away <b className="text-text">{money(priority.walkAwayBid)}</b></span>
              </div>
              {priority.rankReasons.length > 0 && (
                <div className="mt-2 text-xs text-muted">Why: {priority.rankReasons.slice(0, 3).join(" · ")}</div>
              )}
              {priority.mainRisks.length > 0 && (
                <div className="mt-1 text-xs text-warn">Main risks: {priority.mainRisks.join(" · ")}</div>
              )}
              {priority.nextActions.length > 0 && (
                <div className="mt-1 text-xs text-muted">Next: {priority.nextActions.slice(0, 4).join(" → ")}</div>
              )}
            </div>
            <Badge tone={verdictTone(priority.verdict)}>{VERDICT_LABEL[priority.verdict]}</Badge>
          </div>
        </Card>
      )}

      {ranked.length > 1 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Top Opportunities (ranked)</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-muted">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Property</th>
                    <th className="py-2 pr-3">Min tender</th>
                    <th className="py-2 pr-3">Cons. value</th>
                    <th className="py-2 pr-3">Target</th>
                    <th className="py-2 pr-3">Max safe</th>
                    <th className="py-2 pr-3">CF/mo</th>
                    <th className="py-2 pr-3">Cap left</th>
                    <th className="py-2 pr-3">Risk</th>
                    <th className="py-2 pr-3">Conf</th>
                    <th className="py-2 pr-3">Score</th>
                    <th className="py-2">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((x, i) => (
                    <tr key={x.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 tnum">{i + 1}</td>
                      <td className="py-2 pr-3">
                        <Link href={`/properties/${x.id}`} className="hover:underline">{x.name}</Link>
                        {x.hasFatal && <Badge tone="bad" className="ml-1">FATAL</Badge>}
                      </td>
                      <td className="py-2 pr-3 tnum">{money(x.minimumTender)}</td>
                      <td className="py-2 pr-3 tnum">{money(x.conservativeMarketValue)}</td>
                      <td className="py-2 pr-3 tnum">{money(x.targetBid)}</td>
                      <td className="py-2 pr-3 tnum">{money(x.maxSafeBid)}</td>
                      <td className="py-2 pr-3 tnum">{money(x.monthlyCashFlow)}</td>
                      <td className="py-2 pr-3 tnum">{money(x.brrrrCapitalLeft)}</td>
                      <td className="py-2 pr-3 tnum">{x.riskScore}</td>
                      <td className="py-2 pr-3 tnum">{x.confidence}</td>
                      <td className="py-2 pr-3 tnum font-semibold">{x.total}</td>
                      <td className="py-2"><Badge tone={verdictTone(x.verdict)}>{VERDICT_LABEL[x.verdict]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              Transparent score: Value 20 · BRRRR 20 · Cash-flow 15 · Risk 20 · Data confidence 10 ·
              Rental market 10 · Liquidity 5. A fatal deal-killer always sorts last and reads PASS.
            </p>
          </Card>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recently analyzed
          </h2>
          <Link href="/properties/new" className="text-sm text-accent hover:underline">
            + Add a property
          </Link>
        </div>

        {analyzed.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              No properties yet.{" "}
              <Link href="/properties/new" className="text-accent hover:underline">
                Create one
              </Link>{" "}
              to run the underwriting engine.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recent.map(({ p, r }) => {
              const asIs = p.input.value.conservativeAsIs;
              const discount = asIs > 0 ? (asIs - r.bid.maximumSafeBid) / asIs : 0;
              return (
                <Link key={p.id} href={`/properties/${p.id}`}>
                  <Card className="transition hover:border-accent/50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted">
                          {[p.municipality, p.county].filter(Boolean).join(", ") || p.address || "—"}
                        </div>
                      </div>
                      <Badge tone={verdictTone(r.verdict)}>{VERDICT_LABEL[r.verdict]}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <Field label="Min tender" value={money(p.input.taxSale.minimumTender)} />
                      <Field label="Est. value" value={money(asIs)} />
                      <Field label="Max safe bid" value={money(r.bid.maximumSafeBid)} />
                      <Field label="Discount" value={pct(discount)} />
                      <Field label="Score" value={`${r.score.total}/100`} />
                      <Field label="Confidence" value={`${r.confidence.overall}/100`} />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                      <span>Risk {r.dealKillers.riskScore}/100</span>
                      <span>·</span>
                      <span>Binds on {r.bid.bindingConstraint.replace("_", " ").toLowerCase()}</span>
                      {r.dealKillers.hasFatal && <Badge tone="bad">FATAL</Badge>}
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="tnum font-medium">{value}</div>
    </div>
  );
}
