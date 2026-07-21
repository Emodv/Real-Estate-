import * as React from "react";
import type { UnderwritingInput, UnderwritingResult } from "@/lib/underwriting";
import { Badge, Card, Row, Section } from "./ui";
import { money, pct, ratio } from "@/lib/format";

/** Top-3 reasons to buy / not buy — the "deal-killer mode" headline. */
export function ReasonsPanel({ result }: { result: UnderwritingResult }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-good/30">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-good">
          Top reasons to BUY
        </h2>
        {result.reasons.toBuy.length === 0 ? (
          <p className="text-sm text-muted">No compelling reasons to buy at current assumptions.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {result.reasons.toBuy.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-good">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card className="border-bad/30">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-bad">
          Top reasons NOT to buy
        </h2>
        {result.reasons.notToBuy.length === 0 ? (
          <p className="text-sm text-muted">No material objections found — still verify all unknowns.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {result.reasons.notToBuy.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-bad">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export function AnalyticsSections({
  input,
  result,
}: {
  input: UnderwritingInput;
  result: UnderwritingResult;
}) {
  const v = result.valuation;
  return (
    <>
      {/* Market valuation from comps */}
      <Section
        title="Market Valuation (from comparables)"
        subtitle="Derived from comparable sales — NOT from MPAC assessment. Assessment is shown only as a reference ratio."
      >
        {!v ? (
          <p className="text-sm text-muted">
            No comparable sales entered. Add comps on the property to derive a data-backed value
            range; otherwise the manually entered value figures are used.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <ValueBox label="Low" value={v.low} />
              <ValueBox label="Base" value={v.base} highlight />
              <ValueBox label="High" value={v.high} />
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted">
              <div>
                Method: <span className="text-text">{v.method}</span> · {v.usedComps} usable comp(s) ·
                dispersion ±{pct(v.dispersionPct, 0)} · confidence {v.confidence}/100
              </div>
              {v.assessment != null && (
                <div>
                  Assessment {money(v.assessment)} · assessment-to-market {v.assessmentToMarket}× (reference only)
                </div>
              )}
              {v.notes.map((n, i) => (
                <div key={i} className="text-warn">⚠ {n}</div>
              ))}
            </div>
          </>
        )}
      </Section>

      {/* Comparable sales table */}
      {result.scoredComps.length > 0 && (
        <Section title="Comparable Sales" subtitle="Similarity is a weighted model estimate — weights are configurable assumptions.">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Address</th>
                  <th className="py-2 pr-3">Sale</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Dist.</th>
                  <th className="py-2 pr-3">$/sqft</th>
                  <th className="py-2 pr-3">Beds/Baths</th>
                  <th className="py-2 pr-3">Similarity</th>
                  <th className="py-2">Weight</th>
                </tr>
              </thead>
              <tbody>
                {result.scoredComps.map((c, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-3">{c.address ?? "—"}</td>
                    <td className="py-2 pr-3 tnum">{money(c.salePrice)}</td>
                    <td className="py-2 pr-3">{c.saleDate?.slice(0, 10) ?? "—"}</td>
                    <td className="py-2 pr-3 tnum">{c.effectiveDistanceKm != null ? `${c.effectiveDistanceKm} km` : "—"}</td>
                    <td className="py-2 pr-3 tnum">{c.pricePerSqft != null ? money(c.pricePerSqft) : "—"}</td>
                    <td className="py-2 pr-3 tnum">{c.bedrooms ?? "—"}/{c.bathrooms ?? "—"}</td>
                    <td className="py-2 pr-3 tnum">{Math.round(c.similarity * 100)}%</td>
                    <td className="py-2 tnum">{Math.round(c.weight * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Renovation model */}
      <Section title="Renovation Model" subtitle="Low / base / high by line item, with an explicit data status. Unknowns are never treated as known.">
        <div className="grid grid-cols-3 gap-3">
          <ValueBox label="Low (incl. contingency)" value={result.renovationModel.lowWithContingency} />
          <ValueBox label="Base (incl. contingency)" value={result.renovationModel.baseWithContingency} highlight />
          <ValueBox label="High (incl. contingency)" value={result.renovationModel.highWithContingency} />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="uppercase text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Low</th>
                <th className="py-2 pr-3">Base</th>
                <th className="py-2">High</th>
              </tr>
            </thead>
            <tbody>
              {result.renovationModel.lineItems.map((li, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-3">{li.category}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={li.status === "KNOWN" ? "good" : li.status === "UNKNOWN" ? "bad" : "warn"}>
                      {li.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 tnum">{money(li.low)}</td>
                  <td className="py-2 pr-3 tnum">{money(li.base)}</td>
                  <td className="py-2 tnum">{money(li.high)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Known share of budget: {Math.round(result.renovationModel.knownShare * 100)}% · confidence{" "}
          {result.renovationModel.confidence}/100
          {result.renovationModel.unknownCategories.length > 0 && (
            <span className="text-warn"> · UNKNOWN: {result.renovationModel.unknownCategories.join(", ")} — verify before bidding.</span>
          )}
        </p>
      </Section>

      {/* Refinance scenarios */}
      <Section title="Refinance Scenarios" subtitle={`At the maximum safe bid of ${money(result.bid.maximumSafeBid)}. The key BRRRR metric is capital left in the deal.`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">LTV</th>
                <th className="py-2 pr-3">Loan</th>
                <th className="py-2 pr-3">Capital recovered</th>
                <th className="py-2 pr-3">Capital left</th>
                <th className="py-2 pr-3">Cash flow/mo</th>
                <th className="py-2 pr-3">DSCR</th>
                <th className="py-2">Cash-on-cash</th>
              </tr>
            </thead>
            <tbody>
              {result.refinanceScenarios.map((s, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-3 tnum">{Math.round(s.ltv * 100)}%</td>
                  <td className="py-2 pr-3 tnum">{money(s.refinanceAmount)}</td>
                  <td className="py-2 pr-3 tnum text-good">{money(s.capitalRecovered)}</td>
                  <td className="py-2 pr-3 tnum">{money(s.capitalTrapped)}</td>
                  <td className="py-2 pr-3 tnum">{money(s.monthlyCashFlow)}</td>
                  <td className="py-2 pr-3 tnum">{ratio(s.dscr)}</td>
                  <td className="py-2 tnum">{s.cashOnCash === null ? "∞" : pct(s.cashOnCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Sensitivity matrix */}
      <Section title="Sensitivity — Maximum Safe Bid" subtitle="How the max safe bid moves with ARV (rows) × renovation (columns). Where does the deal stop working?">
        <div className="mb-3 flex flex-wrap gap-3 text-sm">
          <Row label="Break-even bid (zero equity)" value={money(result.sensitivity.breakEvenBid)} />
          <Row label="Walk-away bid (max safe)" value={money(result.sensitivity.walkAwayBid)} strong />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="uppercase text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">ARV ＼ Reno →</th>
                {result.sensitivity.renovationAxis.map((r, i) => (
                  <th key={i} className="py-2 pr-3 tnum">{money(r)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.sensitivity.matrix.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-3 tnum font-medium">{money(result.sensitivity.arvAxis[i])}</td>
                  {row.map((cell, j) => (
                    <td key={j} className="py-2 pr-3 tnum">{money(cell.maxSafeBid)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {input.strategy && input.strategy !== "BRRRR" && (
        <p className="text-xs text-muted">Strategy: {input.strategy} (bid ceilings adapt via the cash-flow / value constraints).</p>
      )}
    </>
  );
}

function ValueBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${highlight ? "border-accent/40 bg-accent/10" : "border-border bg-surface2"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold tnum">{money(value)}</div>
    </div>
  );
}
