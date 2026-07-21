import * as React from "react";
import type { UnderwritingInput, UnderwritingResult } from "@/lib/underwriting";
import { Badge, Card, Meter, Row, Section, Stat } from "./ui";
import { ShowMath } from "./ShowMath";
import { money, pct, ratio, VERDICT_LABEL, verdictTone, severityTone } from "@/lib/format";

const CEILING_LABEL: Record<string, string> = {
  VALUE: "Value-Based",
  BRRRR: "BRRRR",
  CASH_FLOW: "Cash-Flow",
  ROI: "ROI",
  RISK_ADJUSTED: "Risk-Adjusted",
  CAPITAL: "Capital",
};

export function UnderwritingReport({
  input,
  result,
}: {
  input: UnderwritingInput;
  result: UnderwritingResult;
}) {
  const { bid, dealKillers, swot, score, confidence, committee } = result;
  const m = bid.atMaxSafeBid;

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      <Card className="border-2" >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Badge tone={verdictTone(result.verdict)} className="px-3 py-1 text-base">
              {VERDICT_LABEL[result.verdict]}
            </Badge>
            <div>
              <div className="text-xs text-muted">Maximum safe bid · binding constraint</div>
              <div className="text-2xl font-bold tnum">
                {money(bid.maximumSafeBid)}{" "}
                <span className="text-sm font-normal text-muted">
                  ({CEILING_LABEL[bid.bindingConstraint]})
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <div className="text-xs text-muted">Score</div>
              <div className="text-2xl font-bold tnum">{score.total}<span className="text-sm text-muted">/100</span></div>
            </div>
            <div>
              <div className="text-xs text-muted">Confidence</div>
              <div className="text-2xl font-bold tnum">{confidence.overall}<span className="text-sm text-muted">/100</span></div>
            </div>
          </div>
        </div>
        {result.warnings.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-warn">
            {result.warnings.map((w, i) => (
              <li key={i}>⚠ {w}</li>
            ))}
          </ul>
        )}
      </Card>

      {/* Bid strategy */}
      <Section
        title="Bid Strategy"
        subtitle="Graduated bid levels. Maximum safe bid = the most restrictive ceiling. Hard stop = do not cross."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Conservative bid" value={money(bid.conservativeBid)} tone="good" sub="large margin of safety" />
          <Stat label="Target bid" value={money(bid.targetBid)} tone="accent" sub="thesis works well" />
          <Stat label="Maximum safe bid" value={money(bid.maximumSafeBid)} tone="warn" sub="recommended ceiling" />
          <Stat label="Hard stop" value={money(bid.hardStop)} tone="bad" sub="do NOT bid above" />
        </div>
        <div className="mt-3 rounded-lg border border-border bg-surface2 p-3 text-xs text-muted">
          Minimum tender is <span className="font-semibold text-text">{money(input.taxSale.minimumTender)}</span> —
          this is the reserve to enter, NOT a target. Winning above the maximum safe bid means overpaying.
        </div>
      </Section>

      {/* Bid ceilings */}
      <Section title="Bid Ceilings" subtitle="Six independent constraints. The lowest applicable one binds.">
        <div className="space-y-2">
          {bid.ceilings.map((c) => {
            const binding = c.key === bid.bindingConstraint;
            return (
              <div
                key={c.key}
                className={`rounded-lg border p-3 ${binding ? "border-warn/50 bg-warn/10" : "border-border bg-surface2"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{CEILING_LABEL[c.key]}</span>
                    {binding && <Badge tone="warn">BINDING</Badge>}
                    {!c.applicable && <Badge tone="muted">n/a</Badge>}
                  </div>
                  <span className="tnum font-semibold">
                    {c.applicable && Number.isFinite(c.amount) ? money(c.amount) : "—"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{c.rationale}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Show your math */}
      <Section
        title="Show Your Math — Value-Based Ceiling"
        subtitle="Every subtraction is inspectable. Evaluated at the value-based ceiling."
      >
        <ShowMath lines={bid.valueMathLines} />
      </Section>

      {/* BRRRR */}
      <Section title="BRRRR Analysis" subtitle={`Evaluated at the maximum safe bid of ${money(bid.maximumSafeBid)}.`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Project & Capital</h3>
            <Row label="Purchase price" value={money(m.purchasePrice)} />
            <Row label="Land transfer tax" value={money(m.landTransferTax)} />
            <Row label="Acquisition costs" value={money(m.acquisitionCosts)} />
            <Row label="Renovation (incl. contingency)" value={money(m.renovationWithContingency)} />
            <Row label="Financing fees" value={money(m.financingFees)} />
            <Row label="Holding cost" value={money(m.totalHoldingCost)} />
            <Row label="Total project cost" value={money(m.totalProjectCost)} strong />
            <Row label="Total cash invested" value={money(m.totalCashInvested)} strong />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted">Rental, Refinance & Returns</h3>
            <Row label="Net operating income (NOI)" value={money(m.noi)} />
            <Row label="Refinance amount (ARV × LTV)" value={money(m.refinanceAmount)} />
            <Row label="Loan payoff" value={money(m.existingLoanPayoff)} />
            <Row label="Capital recovered" value={money(m.capitalRecovered)} tone="good" />
            <Row
              label="Capital trapped"
              value={money(m.capitalTrapped)}
              strong
              note={m.capitalTrapped <= 0 ? "fully recovered" : undefined}
            />
            <Row label="Monthly cash flow" value={money(m.monthlyCashFlow)} strong />
            <Row label="Cap rate" value={pct(m.capRate)} />
            <Row label="DSCR" value={ratio(m.dscr)} />
            <Row
              label="Cash-on-cash"
              value={m.cashOnCash === null ? "∞ (all capital out)" : pct(m.cashOnCash)}
            />
          </div>
        </div>
      </Section>

      {/* Deal killers */}
      <Section
        title="Deal Killers & Risk"
        subtitle="Fatal issues veto a buy. Unknowns are treated as risky, never as safe."
        right={<Badge tone={dealKillers.riskScore >= 50 ? "bad" : dealKillers.riskScore >= 25 ? "warn" : "good"}>Risk {dealKillers.riskScore}/100</Badge>}
      >
        {input.risks.length === 0 ? (
          <p className="text-sm text-muted">No risks recorded. Absence of evidence is not evidence of absence — verify before bidding.</p>
        ) : (
          <div className="space-y-2">
            {input.risks.map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface2 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge tone={severityTone(r.severity)}>{r.severity}</Badge>
                    <span className="text-sm font-medium">{r.label}</span>
                    {r.fatalIfConfirmed && <Badge tone="bad">FATAL IF CONFIRMED</Badge>}
                  </div>
                  {r.detail && <p className="mt-1 text-xs text-muted">{r.detail}</p>}
                </div>
                <div className="text-right text-xs text-muted">
                  <div>{r.category}</div>
                  <div>{r.dataStatus.replace("_", " ")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* SWOT */}
      <Section title="SWOT" subtitle="Every statement references its evidence — no generic AI fluff.">
        <div className="grid gap-4 md:grid-cols-2">
          <SwotColumn title="Strengths" tone="good" items={swot.strengths} />
          <SwotColumn title="Weaknesses" tone="bad" items={swot.weaknesses} />
          <SwotColumn title="Opportunities" tone="accent" items={swot.opportunities} />
          <SwotColumn title="Threats" tone="warn" items={swot.threats} />
        </div>
      </Section>

      {/* Investment score breakdown */}
      <Section title="Investment Score" subtitle="Transparent sub-scores — not a black box. The score is a signal, not the verdict.">
        <div className="space-y-3">
          <ScoreBar label="Value" value={score.value} max={20} />
          <ScoreBar label="BRRRR potential" value={score.brrrr} max={20} />
          <ScoreBar label="Cash flow" value={score.cashFlow} max={15} />
          <ScoreBar label="Market (headroom)" value={score.market} max={15} />
          <ScoreBar label="Risk (inverse)" value={score.risk} max={15} />
          <ScoreBar label="Rental (DSCR)" value={score.rental} max={10} />
          <ScoreBar label="Liquidity" value={score.liquidity} max={5} />
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Total</span>
            <span className="tnum">{score.total} / 100</span>
          </div>
        </div>
      </Section>

      {/* Confidence */}
      <Section title="Confidence" subtitle="Derived from data quality & evidence coverage — never invented.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Overall" value={`${confidence.overall}`} />
          <Stat label="Valuation" value={`${confidence.valuation}`} />
          <Stat label="Renovation" value={`${confidence.renovation}`} />
          <Stat label="Rental" value={`${confidence.rental}`} />
          <Stat label="Risk" value={`${confidence.risk}`} />
        </div>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {confidence.reasons.map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>
      </Section>

      {/* Evidence */}
      <Section title="Evidence & Provenance" subtitle="Every important conclusion is traceable to a source.">
        {input.evidence.length === 0 ? (
          <p className="text-sm text-muted">No evidence recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-4">Claim</th>
                  <th className="py-2 pr-4">Value</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Dist.</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {input.evidence.map((e, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-4">{e.claim}</td>
                    <td className="py-2 pr-4 tnum">{e.value ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted">{e.source}</td>
                    <td className="py-2 pr-4 text-muted">{e.date ?? "—"}</td>
                    <td className="py-2 pr-4 tnum text-muted">{e.distanceKm != null ? `${e.distanceKm} km` : "—"}</td>
                    <td className="py-2"><Badge tone="muted">{e.dataStatus.replace("_", " ")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Investment committee */}
      <Section title="Investment Committee" subtitle="The final decision layer.">
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted">Investment Thesis</h3>
            <p className="mt-1">{committee.thesis}</p>
          </div>
          <CommitteeList title="Key Risks" items={committee.keyRisks} empty="None material recorded." />
          <CommitteeList title="Deal Killers" items={committee.dealKillers} empty="None identified (still verify)." tone="bad" />
          <CommitteeList title="Missing Information" items={committee.missingInformation} empty="Nothing outstanding." tone="warn" />
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-4">
            <h3 className="text-xs font-semibold uppercase text-accent">Final Decision</h3>
            <p className="mt-1 font-medium">{committee.buyOnlyIf}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tnum">{value}/{max}</span>
      </div>
      <Meter value={value} max={max} />
    </div>
  );
}

function SwotColumn({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "good" | "bad" | "warn" | "accent";
  items: { statement: string; evidence: string; confidence: string }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface2 p-3">
      <div className="mb-2">
        <Badge tone={tone}>{title}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted">None recorded.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-sm">
              <div>{it.statement}</div>
              <div className="mt-0.5 text-xs text-muted">
                ↳ {it.evidence} · confidence: {it.confidence}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommitteeList({
  title,
  items,
  empty,
  tone = "muted",
}: {
  title: string;
  items: string[];
  empty: string;
  tone?: "muted" | "bad" | "warn";
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-muted">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-muted">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className={tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-muted"}>•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
