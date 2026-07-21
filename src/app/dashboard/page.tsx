import Link from "next/link";
import { getPropertyStore } from "@/lib/data/store";
import { underwrite, type Verdict } from "@/lib/underwriting";
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

  const opportunities = analyzed.filter(
    (a) => a.r.verdict !== "PASS" && a.r.verdict !== "STRONG_PASS",
  );
  const highest = opportunities[0];
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

      {highest && (
        <Card className="border-accent/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Highest opportunity</div>
              <Link href={`/properties/${highest.p.id}`} className="text-lg font-semibold hover:underline">
                {highest.p.name}
              </Link>
              <div className="text-xs text-muted">
                Max safe bid {money(highest.r.bid.maximumSafeBid)} · score {highest.r.score.total}/100 ·
                confidence {highest.r.confidence.overall}/100
              </div>
            </div>
            <Badge tone={verdictTone(highest.r.verdict)}>{VERDICT_LABEL[highest.r.verdict]}</Badge>
          </div>
        </Card>
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
