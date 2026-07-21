import * as React from "react";
import type { InvestmentCommitteeMemo } from "@/lib/underwriting";
import { MEMO_VERDICT_LABEL } from "@/lib/underwriting";
import { money, pct, ratio } from "@/lib/format";

/**
 * Print-friendly Investment Committee Memo. Renders the pure memo object from
 * `buildMemo`. Uses light, document-style typography and print CSS
 * (see globals.css) so "Print / Save as PDF" yields a clean A4/Letter doc.
 */
export function MemoDocument({
  memo,
  header,
}: {
  memo: InvestmentCommitteeMemo;
  header: { name: string; address?: string; municipality?: string; county?: string };
}) {
  const e = memo.executive;
  return (
    <div className="memo-print mx-auto max-w-3xl rounded-lg bg-white p-8 text-[13px] leading-relaxed text-gray-900">
      {/* Title */}
      <div className="border-b-2 border-gray-800 pb-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">TaxSale Copilot</div>
        <h1 className="text-2xl font-bold">Investment Committee Memo</h1>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <Field k="Property" v={header.name} />
          <Field k="Address" v={header.address ?? "—"} />
          <Field k="Municipality" v={[header.municipality, header.county].filter(Boolean).join(", ") || "—"} />
          <Field k="Property type" v={memo.header.propertyType ?? "—"} />
          <Field k="Tax sale date" v={memo.header.taxSaleDate ?? "—"} />
          <Field k="Minimum tender" v={money(memo.header.minimumTender)} />
          <Field k="Prepared" v={memo.header.preparedAt.slice(0, 10)} />
        </div>
      </div>

      {/* Executive decision */}
      <Sec title="Executive Decision">
        <div className="mb-3 inline-block rounded border-2 border-gray-800 px-3 py-1 text-lg font-bold">
          {MEMO_VERDICT_LABEL[e.verdict]}
        </div>
        <Grid>
          <KV k="Deal score" v={`${e.dealScore}/100`} />
          <KV k="Confidence" v={`${e.confidence}/100`} />
          <KV k="Minimum tender" v={money(e.minimumTender)} />
          <KV k="Conservative bid" v={money(e.conservativeBid)} />
          <KV k="Target bid" v={money(e.targetBid)} />
          <KV k="Maximum safe bid" v={money(e.maximumSafeBid)} strong />
          <KV k="Walk-away bid" v={money(e.walkAwayBid)} />
          <KV k="Est. current market value" v={money(e.estimatedMarketValue)} />
          <KV k="Estimated ARV" v={money(e.estimatedArv)} />
          <KV k="Est. total project cost" v={money(e.estimatedTotalProjectCost)} />
          <KV k="Estimated monthly rent" v={money(e.estimatedMonthlyRent)} />
          <KV k="Capital left after refi" v={money(e.capitalLeftAfterRefinance)} strong />
        </Grid>
      </Sec>

      {/* 60-second thesis */}
      <Sec title="The 60-Second Investment Thesis">
        <TwoCol
          left={<Ranked title="Top reasons to BUY" items={memo.thesis.reasonsToBuy} />}
          right={<Ranked title="Top reasons NOT to buy" items={memo.thesis.reasonsNotToBuy} />}
        />
        <p className="mt-3"><b>Thesis:</b> {memo.thesis.thesis}</p>
        <p><b>Biggest risk:</b> {memo.thesis.biggestRisk}</p>
        <p><b>Bid recommendation:</b> {memo.thesis.bidRecommendation}</p>
      </Sec>

      {/* Bid strategy */}
      <Sec title="Bid Strategy">
        <Grid>
          <KV k="Minimum tender" v={money(memo.bidStrategy.minimumTender)} />
          <KV k="Opportunistic (steal)" v={money(memo.bidStrategy.opportunisticBid)} />
          <KV k="Conservative bid" v={money(memo.bidStrategy.conservativeBid)} />
          <KV k="Target bid" v={money(memo.bidStrategy.targetBid)} />
          <KV k="Maximum safe bid" v={money(memo.bidStrategy.maximumSafeBid)} strong />
          <KV k="Walk-away bid" v={money(memo.bidStrategy.walkAwayBid)} />
          <KV k="Recommended max bid" v={money(memo.bidStrategy.recommendedMaxBid)} strong />
        </Grid>
        <p className="mt-2 text-xs text-gray-600">{memo.bidStrategy.explanation}</p>
      </Sec>

      {/* Show your math */}
      <Sec title="Show Your Math — Value-Based Ceiling">
        <table className="w-full">
          <tbody>
            {memo.showMath.map((l, i) => (
              <tr key={i} className={l.op === "result" ? "border-t-2 border-gray-700 font-bold" : "border-b border-gray-200"}>
                <td className="py-1">{l.label}</td>
                <td className="py-1 text-right tnum">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sec>

      {/* Valuation */}
      <Sec title="Valuation" breakBefore>
        <p className="mb-2 text-xs font-semibold text-gray-600">Assessment value is NOT used as the primary market valuation.</p>
        <Grid>
          <KV k="Conservative (Low)" v={money(memo.valuation.low)} />
          <KV k="Base" v={money(memo.valuation.base)} strong />
          <KV k="Optimistic (High)" v={money(memo.valuation.high)} />
          <KV k="Assessment" v={money(memo.valuation.assessment ?? null)} />
          <KV k="Assessment-to-market" v={memo.valuation.assessmentToMarket ? `${memo.valuation.assessmentToMarket}×` : "—"} />
          <KV k="Method" v={memo.valuation.method} />
          <KV k="Confidence" v={`${memo.valuation.confidence}/100`} />
        </Grid>
        {memo.valuation.comps.length > 0 && (
          <table className="mt-3 w-full text-[11px]">
            <thead className="border-b border-gray-400 text-left">
              <tr>
                <th className="py-1">Comp</th><th>Sale</th><th>Date</th><th>Dist</th><th>$/sqft</th><th>Bd/Ba</th><th>Sim</th>
              </tr>
            </thead>
            <tbody>
              {memo.valuation.comps.map((c, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1">{c.address ?? "—"}{memo.valuation.strongestCompAddresses.includes(c.address ?? "") ? " ★" : ""}</td>
                  <td className="tnum">{money(c.salePrice)}</td>
                  <td>{c.saleDate?.slice(0, 10) ?? "—"}</td>
                  <td className="tnum">{c.effectiveDistanceKm != null ? `${c.effectiveDistanceKm}km` : "—"}</td>
                  <td className="tnum">{c.pricePerSqft != null ? money(c.pricePerSqft) : "—"}</td>
                  <td className="tnum">{c.bedrooms ?? "—"}/{c.bathrooms ?? "—"}</td>
                  <td className="tnum">{Math.round(c.similarity * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sec>

      {/* Renovation */}
      <Sec title="Renovation">
        <Grid>
          <KV k="Low (w/ contingency)" v={money(memo.renovation.lowWithContingency)} />
          <KV k="Base (w/ contingency)" v={money(memo.renovation.baseWithContingency)} strong />
          <KV k="High (w/ contingency)" v={money(memo.renovation.highWithContingency)} />
        </Grid>
        <table className="mt-2 w-full text-[11px]">
          <thead className="border-b border-gray-400 text-left"><tr><th className="py-1">Category</th><th>Status</th><th>Low</th><th>Base</th><th>High</th></tr></thead>
          <tbody>
            {memo.renovation.lineItems.map((li, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1">{li.category}</td><td>{li.status}</td>
                <td className="tnum">{money(li.low)}</td><td className="tnum">{money(li.base)}</td><td className="tnum">{money(li.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs"><b>Biggest uncertainty:</b> {memo.renovation.biggestUncertainty}</p>
      </Sec>

      {/* Rental */}
      <Sec title="Rental Economics" breakBefore>
        <div className="mb-2 text-xs">
          <b>Rent — Low / Base / High:</b> {money(memo.rental.rentLow)} / {money(memo.rental.rentBase)} / {money(memo.rental.rentHigh)}{" "}
          <span className="text-gray-500">({memo.rental.rentMethod}{memo.rental.rentIllustrative ? " — illustrative" : ""}; confidence {memo.rental.rentConfidence}/100)</span>
        </div>
        <table className="mb-3 w-full text-[11px]">
          <thead className="border-b border-gray-400 text-left"><tr><th className="py-1">Rent scenario</th><th>Monthly rent</th><th>NOI</th><th>Cash flow/mo</th></tr></thead>
          <tbody>
            {(["low", "base", "high"] as const).map((k) => (
              <tr key={k} className="border-b border-gray-200">
                <td className="py-1 capitalize">{k}{k === "base" ? " (used for the bid)" : ""}</td>
                <td className="tnum">{money(memo.rental.rentScenarios[k].monthlyRent)}</td>
                <td className="tnum">{money(memo.rental.rentScenarios[k].noi)}</td>
                <td className="tnum">{money(memo.rental.rentScenarios[k].monthlyCashFlow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="mb-3 w-full text-[11px]">
          <thead className="border-b border-gray-400 text-left"><tr><th className="py-1">Operating expense</th><th>Basis</th><th>Status</th><th>Annual</th></tr></thead>
          <tbody>
            <tr className="border-b border-gray-200"><td className="py-1">Gross potential rent</td><td>—</td><td>—</td><td className="tnum">{money(memo.rental.grossPotentialRent)}</td></tr>
            <tr className="border-b border-gray-200"><td className="py-1">Vacancy</td><td>% of GPR</td><td>ASSUMED</td><td className="tnum">−{money(memo.rental.vacancy)}</td></tr>
            <tr className="border-b border-gray-300 font-semibold"><td className="py-1">Effective gross income</td><td></td><td></td><td className="tnum">{money(memo.rental.effectiveGrossIncome)}</td></tr>
            {memo.rental.opexItems.map((o, i) => (
              <tr key={i} className="border-b border-gray-200"><td className="py-1">{o.label}</td><td>{o.basis}</td><td>{o.status}</td><td className="tnum">−{money(o.amount)}</td></tr>
            ))}
            <tr className="border-t-2 border-gray-700 font-bold"><td className="py-1">NOI</td><td></td><td></td><td className="tnum">{money(memo.rental.noi)}</td></tr>
          </tbody>
        </table>
        <Grid>
          <KV k="Monthly cash flow" v={money(memo.rental.monthlyCashFlow)} strong />
          <KV k="Annual cash flow" v={money(memo.rental.annualCashFlow)} />
          <KV k="Cap rate" v={pct(memo.rental.capRate)} />
          <KV k="DSCR" v={ratio(memo.rental.dscr)} />
          <KV k="Cash-on-cash" v={memo.rental.cashOnCash === null ? "∞" : pct(memo.rental.cashOnCash)} />
        </Grid>
        <p className="mt-1 text-xs text-gray-500">Gross rent ≠ NOI ≠ cash flow. NOI is unlevered; cash flow is after the refinanced mortgage. The Max Safe Bid uses BASE rent, never the high.</p>
      </Sec>

      {/* BRRRR */}
      <Sec title="BRRRR & Refinance Scenarios">
        <Grid>
          <KV k="Purchase price" v={money(memo.brrrr.purchasePrice)} />
          <KV k="Renovation" v={money(memo.brrrr.renovation)} />
          <KV k="Acquisition" v={money(memo.brrrr.acquisition)} />
          <KV k="Financing" v={money(memo.brrrr.financing)} />
          <KV k="Holding" v={money(memo.brrrr.holding)} />
          <KV k="Total project cost" v={money(memo.brrrr.totalProjectCost)} strong />
        </Grid>
        <table className="mt-2 w-full text-[11px]">
          <thead className="border-b border-gray-400 text-left"><tr><th className="py-1">LTV</th><th>Loan</th><th>Costs</th><th>Cash returned</th><th>Capital left</th><th>CF/mo</th></tr></thead>
          <tbody>
            {memo.brrrr.scenarios.map((s, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1 tnum">{Math.round(s.ltv * 100)}%{s.ltv === memo.brrrr.bestCapitalRecoveryLtv ? " ⤴recovery" : ""}{s.ltv === memo.brrrr.bestCashFlowLtv ? " ⤴cashflow" : ""}</td>
                <td className="tnum">{money(s.refinanceAmount)}</td>
                <td className="tnum">{money(s.refinanceCosts)}</td>
                <td className="tnum">{money(s.capitalRecovered)}</td>
                <td className="tnum">{money(s.capitalTrapped)}</td>
                <td className="tnum">{money(s.monthlyCashFlow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-gray-500">Higher LTV is not automatically better — it recovers more capital but raises debt service and lowers cash flow.</p>
      </Sec>

      {/* Sensitivity */}
      <Sec title="Sensitivity Analysis">
        <p className="text-xs"><b>Break-even bid:</b> {money(memo.sensitivity.breakEvenBid)} · <b>Walk-away bid:</b> {money(memo.sensitivity.walkAwayBid)}</p>
        <p className="text-xs"><b>Best / base / worst max safe bid:</b> {money(memo.sensitivity.bestCase)} / {money(memo.sensitivity.baseCase)} / {money(memo.sensitivity.worstCase)}</p>
        <table className="mt-2 w-full text-[11px]">
          <thead className="border-b border-gray-400 text-left"><tr><th className="py-1">ARV ＼ Reno</th>{memo.sensitivity.renovationAxis.map((r, i) => <th key={i} className="tnum">{money(r)}</th>)}</tr></thead>
          <tbody>
            {memo.sensitivity.matrix.map((row, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1 tnum font-medium">{money(memo.sensitivity.arvAxis[i])}</td>
                {row.map((cell, j) => <td key={j} className="tnum">{money(cell)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs"><b>Deal break point:</b> {memo.sensitivity.dealBreakPoint}</p>
      </Sec>

      {/* Deal killers */}
      <Sec title="Deal Killers" breakBefore>
        {memo.dealKillers.length === 0 ? (
          <p className="text-xs">None identified — still verify title and access.</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="border-b border-gray-400 text-left"><tr><th className="py-1">Risk</th><th>Severity</th><th>Status</th><th>Category</th></tr></thead>
            <tbody>
              {memo.dealKillers.map((r, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1">{r.label}{r.fatalIfConfirmed ? " (fatal if confirmed)" : ""}</td>
                  <td className={r.severity === "FATAL" || r.severity === "HIGH" ? "font-bold text-red-700" : ""}>{r.severity}</td>
                  <td>{r.dataStatus.replace("_", " ")}</td>
                  <td>{r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Sec>

      {/* Unknowns */}
      <Sec title="Unknown / Requires Verification">
        {memo.unknowns.length === 0 ? (
          <p className="text-xs">No material unknowns recorded — still verify title, access, septic, and well.</p>
        ) : (
          <div className="space-y-3">
            {memo.unknowns.map((u, i) => (
              <div key={i} className="rounded border border-gray-300 p-2">
                <div className="font-semibold">UNKNOWN — {u.label} <span className="text-xs font-normal text-gray-500">({u.category})</span></div>
                <div className="text-xs"><b>Why it matters:</b> {u.whyItMatters}</div>
                <div className="text-xs"><b>How to verify:</b> {u.howToVerify}</div>
                <div className="text-xs"><b>Potential impact:</b> {u.potentialImpact}</div>
                <div className="text-xs"><b>Bid adjustment:</b> {u.bidAdjustment}</div>
              </div>
            ))}
          </div>
        )}
      </Sec>

      {/* SWOT */}
      <Sec title="SWOT">
        <TwoCol
          left={<><SwotList title="Strengths" items={memo.swot.strengths} /><SwotList title="Opportunities" items={memo.swot.opportunities} /></>}
          right={<><SwotList title="Weaknesses" items={memo.swot.weaknesses} /><SwotList title="Threats" items={memo.swot.threats} /></>}
        />
      </Sec>

      {/* Final decision */}
      <Sec title="Final Investment Committee Decision" breakBefore>
        <div className="rounded border-2 border-gray-800 p-3">
          <p><b>Decision:</b> {MEMO_VERDICT_LABEL[memo.finalDecision.decision]}</p>
          <p><b>Recommended bid:</b> {money(memo.finalDecision.recommendedBid)}</p>
          <p><b>Maximum bid:</b> {money(memo.finalDecision.maximumBid)}</p>
          <p><b>Why:</b> {memo.finalDecision.why}</p>
          <p><b>Biggest risk:</b> {memo.finalDecision.biggestRisk}</p>
          <p><b>Biggest unknown:</b> {memo.finalDecision.biggestUnknown}</p>
          <p><b>What would change my mind:</b> {memo.finalDecision.whatWouldChangeMyMind}</p>
          <p><b>Next action:</b> {memo.finalDecision.nextAction}</p>
        </div>
      </Sec>

      <p className="mt-6 border-t border-gray-300 pt-3 text-[10px] text-gray-400">
        Generated by TaxSale Copilot. All figures are estimates unless marked VERIFIED. Every number is
        produced by the deterministic underwriting engine; this memo performs no independent calculation.
        The system recommends; the human decides. Never bids automatically.
      </p>
    </div>
  );
}

function Sec({ title, children, breakBefore }: { title: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`memo-section mt-6 ${breakBefore ? "memo-pagebreak" : ""}`}>
      <h2 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-3">{children}</div>;
}
function KV({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-b border-gray-100 py-0.5">
      <span className="text-xs text-gray-500">{k}</span>
      <span className={`tnum text-xs ${strong ? "font-bold" : ""}`}>{v}</span>
    </div>
  );
}
function Field({ k, v }: { k: string; v: string }) {
  return <div><span className="text-gray-500">{k}:</span> <span className="font-medium">{v}</span></div>;
}
function TwoCol({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{left}{right}</div>;
}
function Ranked({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase">{title}</div>
      <ol className="list-decimal pl-4 text-xs">{items.map((t, i) => <li key={i}>{t}</li>)}</ol>
    </div>
  );
}
function SwotList({ title, items }: { title: string; items: { statement: string; evidence: string }[] }) {
  return (
    <div className="mb-2">
      <div className="text-xs font-bold uppercase">{title}</div>
      <ul className="list-disc pl-4 text-xs">
        {items.length === 0 ? <li className="text-gray-400">None recorded.</li> : items.map((it, i) => (
          <li key={i}>{it.statement} <span className="text-gray-400">— {it.evidence}</span></li>
        ))}
      </ul>
    </div>
  );
}
