import Link from "next/link";
import { getPropertyStore } from "@/lib/data/store";
import { underwrite } from "@/lib/underwriting";
import { Badge, Card, Stat } from "@/components/ui";
import { money, pct, VERDICT_LABEL, verdictTone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const store = getPropertyStore();
  const properties = await store.list();

  const analyzed = properties.map((p) => ({ p, r: underwrite(p.input) }));

  const strongBuys = analyzed.filter((a) => a.r.verdict === "STRONG_BUY" || a.r.verdict === "BUY").length;
  const watch = analyzed.filter((a) => a.r.verdict === "WATCH" || a.r.verdict === "CONDITIONAL_BUY").length;
  const avgConfidence =
    analyzed.length === 0
      ? 0
      : Math.round(analyzed.reduce((s, a) => s + a.r.confidence.overall, 0) / analyzed.length);
  const capitalRequired = analyzed
    .filter((a) => a.r.verdict !== "STRONG_PASS" && a.r.verdict !== "PASS")
    .reduce((s, a) => s + Math.max(0, a.r.bid.atMaxSafeBid.totalCashInvested), 0);
  const potentialEquity = analyzed
    .filter((a) => a.r.verdict !== "STRONG_PASS" && a.r.verdict !== "PASS")
    .reduce((s, a) => s + Math.max(0, a.r.bid.atMaxSafeBid.equityCreatedVsCost), 0);

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
        <Stat label="Buy / Strong buy" value={strongBuys} tone="good" />
        <Stat label="Watch / Conditional" value={watch} tone="warn" />
        <Stat label="Avg confidence" value={`${avgConfidence}`} />
        <Stat label="Capital required" value={money(capitalRequired)} />
        <Stat label="Potential equity" value={money(potentialEquity)} tone="good" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Properties</h2>
          <Link href="/properties/new" className="text-sm text-accent hover:underline">
            + Add a property
          </Link>
        </div>

        {analyzed.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              No properties yet. <Link href="/properties/new" className="text-accent hover:underline">Create one</Link> to
              run the underwriting engine.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {analyzed.map(({ p, r }) => {
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
