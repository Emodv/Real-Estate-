import type {
  UnderwritingInput,
  UnderwritingResult,
  Verdict,
  MathLine,
  Swot,
  RiskItem,
  RiskCategory,
} from "./types";
import type { ScoredComp } from "./comps";
import type { RefinanceScenario } from "./refinanceScenarios";
import type { RenovationModel } from "./renovationModel";
import { num, round2 } from "./money";

/**
 * Investment Committee Memo builder.
 *
 * PURE and PRESENTATION-ONLY. It performs NO financial calculation — every
 * number is read straight from the deterministic `UnderwritingResult`. The only
 * operations here are selection (argmax over existing scenarios), reshaping,
 * and prose assembly. Any derived/illustrative figure is explicitly labelled.
 */

export interface MemoHeader {
  address?: string;
  municipality?: string;
  county?: string;
  taxSaleDate?: string;
  propertyType?: string;
  minimumTender: number;
  preparedAt: string;
}

export interface MemoExecutiveDecision {
  verdict: Verdict;
  dealScore: number;
  confidence: number;
  minimumTender: number;
  conservativeBid: number;
  targetBid: number;
  maximumSafeBid: number;
  walkAwayBid: number;
  estimatedMarketValue: number;
  estimatedArv: number;
  estimatedTotalProjectCost: number;
  estimatedMonthlyRent: number;
  capitalLeftAfterRefinance: number;
}

export interface MemoThesis {
  reasonsToBuy: string[];
  reasonsNotToBuy: string[];
  thesis: string;
  biggestRisk: string;
  bidRecommendation: string;
}

export interface MemoBidStrategy {
  minimumTender: number;
  conservativeBid: number;
  targetBid: number;
  maximumSafeBid: number;
  walkAwayBid: number;
  recommendedMaxBid: number;
  explanation: string;
}

export interface MemoValuation {
  low: number | null;
  base: number | null;
  high: number | null;
  assessment?: number;
  assessmentToMarket?: number;
  method: string;
  confidence: number;
  usesAssessmentAsAnchor: false;
  comps: ScoredComp[];
  strongestCompAddresses: string[];
  notes: string[];
}

export interface MemoRental {
  rentLowIllustrative: number;
  rentBase: number;
  rentHighIllustrative: number;
  grossAnnualRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  capRate: number;
  dscr: number;
  cashOnCash: number | null;
  opexBreakdown: Array<{ label: string; annual: number; status: string }>;
}

export interface MemoBrrrr {
  purchasePrice: number;
  renovation: number;
  acquisition: number;
  financing: number;
  holding: number;
  totalProjectCost: number;
  scenarios: RefinanceScenario[];
  bestCapitalRecoveryLtv: number;
  bestCashFlowLtv: number;
}

export interface MemoSensitivity {
  arvAxis: number[];
  renovationAxis: number[];
  matrix: number[][];
  breakEvenBid: number;
  walkAwayBid: number;
  bestCase: number;
  baseCase: number;
  worstCase: number;
  dealBreakPoint: string;
}

export interface MemoUnknown {
  label: string;
  category: RiskCategory;
  whyItMatters: string;
  howToVerify: string;
  potentialImpact: string;
  bidAdjustment: string;
}

export interface MemoFinalDecision {
  decision: Verdict;
  recommendedBid: number;
  maximumBid: number;
  why: string;
  biggestRisk: string;
  biggestUnknown: string;
  whatWouldChangeMyMind: string;
  nextAction: string;
}

export interface InvestmentCommitteeMemo {
  header: MemoHeader;
  executive: MemoExecutiveDecision;
  thesis: MemoThesis;
  bidStrategy: MemoBidStrategy;
  showMath: MathLine[];
  valuation: MemoValuation;
  renovation: RenovationModel & { biggestUncertainty: string };
  rental: MemoRental;
  brrrr: MemoBrrrr;
  sensitivity: MemoSensitivity;
  dealKillers: RiskItem[];
  unknowns: MemoUnknown[];
  swot: Swot;
  finalDecision: MemoFinalDecision;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  STRONG_BUY: "STRONG BUY",
  BUY: "BUY",
  CONDITIONAL_BUY: "CONDITIONAL BUY",
  WATCH: "WATCH",
  PASS: "PASS",
  STRONG_PASS: "STRONG PASS",
};

const UNKNOWN_GUIDANCE: Partial<Record<RiskCategory, { why: string; how: string; impact: string }>> = {
  TITLE: {
    why: "A clouded title (liens, executions, undischarged mortgages) can survive a tax sale and become the buyer's problem.",
    how: "Order a title search / sub-search and review the parcel register before bidding.",
    impact: "Could render the purchase uneconomic or require costly litigation to clear.",
  },
  ACCESS: {
    why: "Without registered legal access the property may be landlocked and effectively unusable/unfinanceable.",
    how: "Confirm a registered right-of-way or road frontage via the parcel register and a survey.",
    impact: "A landlocked lot can lose most of its market value.",
  },
  ENVIRONMENTAL: {
    why: "Contamination (fuel tanks, prior industrial use) can trigger remediation liability.",
    how: "Review municipal/environmental records; consider a Phase I ESA.",
    impact: "Remediation can run tens of thousands of dollars or more.",
  },
  STRUCTURAL: {
    why: "Hidden structural/foundation failure can exceed the entire renovation budget.",
    how: "Arrange a home/structural inspection where access permits.",
    impact: "Major structural repair can eclipse the forced-appreciation thesis.",
  },
  UTILITIES: {
    why: "A failed septic or well is a large, often-overlooked capital cost on rural properties.",
    how: "Check municipal septic records; budget for a well/septic inspection.",
    impact: "Septic replacement commonly runs $20,000–$40,000+.",
  },
  ZONING: {
    why: "Non-conforming use or zoning restrictions can block the intended rental/renovation.",
    how: "Confirm zoning and permitted uses with the municipality.",
    impact: "May prevent the rental strategy entirely.",
  },
  FLOOD: {
    why: "Flood-plain designation affects insurability, financing, and resale.",
    how: "Check the conservation authority's flood mapping.",
    impact: "Can impair insurability and reduce value.",
  },
  CONDITION: {
    why: "Unverified interior condition means the renovation budget is a guess.",
    how: "Inspect the property (or obtain photos) and get a contractor estimate.",
    impact: "Actual renovation could materially exceed the estimate.",
  },
};

export function buildMemo(
  input: UnderwritingInput,
  result: UnderwritingResult,
): InvestmentCommitteeMemo {
  const m = result.bid.atMaxSafeBid;

  const header: MemoHeader = {
    minimumTender: num(input.taxSale.minimumTender),
    propertyType: input.meta.propertyType,
    taxSaleDate: input.taxSale.saleDate,
    preparedAt: new Date().toISOString(),
  };

  const executive: MemoExecutiveDecision = {
    verdict: result.verdict,
    dealScore: result.score.total,
    confidence: result.confidence.overall,
    minimumTender: num(input.taxSale.minimumTender),
    conservativeBid: result.bid.conservativeBid,
    targetBid: result.bid.targetBid,
    maximumSafeBid: result.bid.maximumSafeBid,
    walkAwayBid: result.sensitivity.walkAwayBid,
    estimatedMarketValue: result.valuation ? result.valuation.base : num(input.value.conservativeAsIs),
    estimatedArv: num(input.refinance.arv),
    estimatedTotalProjectCost: m.totalProjectCost,
    estimatedMonthlyRent: num(input.rental.monthlyMarketRent),
    capitalLeftAfterRefinance: m.capitalTrapped,
  };

  const thesis: MemoThesis = {
    reasonsToBuy: result.reasons.toBuy,
    reasonsNotToBuy: result.reasons.notToBuy,
    thesis: result.committee.thesis,
    biggestRisk: biggestRisk(result),
    bidRecommendation: `Bid up to the maximum safe bid of $${result.bid.maximumSafeBid.toLocaleString()}; aim to win at or below the target bid of $${result.bid.targetBid.toLocaleString()}.`,
  };

  const bidStrategy: MemoBidStrategy = {
    minimumTender: num(input.taxSale.minimumTender),
    conservativeBid: result.bid.conservativeBid,
    targetBid: result.bid.targetBid,
    maximumSafeBid: result.bid.maximumSafeBid,
    walkAwayBid: result.sensitivity.walkAwayBid,
    recommendedMaxBid: result.bid.maximumSafeBid,
    explanation:
      "Target bid = the price at which the thesis works well. Maximum safe bid = the highest price still justified by the most restrictive constraint (binding: " +
      result.bid.bindingConstraint +
      "). Walk-away bid = do not cross it. The minimum tender is only the reserve to participate, never a target.",
  };

  const valuation = buildValuation(input, result);
  const rental = buildRental(input, result);
  const brrrr = buildBrrrr(input, result);
  const sensitivity = buildSensitivity(input, result);
  const renovation = {
    ...result.renovationModel,
    biggestUncertainty: biggestRenoUncertainty(result.renovationModel),
  };
  const unknowns = buildUnknowns(input.risks);

  const finalDecision: MemoFinalDecision = {
    decision: result.verdict,
    recommendedBid: result.bid.targetBid,
    maximumBid: result.bid.maximumSafeBid,
    why: result.committee.thesis,
    biggestRisk: biggestRisk(result),
    biggestUnknown: unknowns[0]?.label ?? "No material unknowns recorded — still verify title and access.",
    whatWouldChangeMyMind: whatWouldChange(result),
    nextAction: nextAction(result, unknowns),
  };

  return {
    header,
    executive,
    thesis,
    bidStrategy,
    showMath: result.bid.valueMathLines,
    valuation,
    renovation,
    rental,
    brrrr,
    sensitivity,
    dealKillers: [...result.dealKillers.fatal, ...result.dealKillers.high, ...result.dealKillers.unknowns],
    unknowns,
    swot: result.swot,
    finalDecision,
  };
  // (VERDICT_LABEL exported for UI convenience)
}

export { VERDICT_LABEL as MEMO_VERDICT_LABEL };

// --- section builders ------------------------------------------------------

function buildValuation(input: UnderwritingInput, result: UnderwritingResult): MemoValuation {
  const v = result.valuation;
  const strongest = [...result.scoredComps].sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  return {
    low: v ? v.low : num(input.value.conservativeAsIs) || null,
    base: v ? v.base : num(input.value.baseValue) || null,
    high: v ? v.high : num(input.value.optimisticValue) || null,
    assessment: input.value.assessment,
    assessmentToMarket: v?.assessmentToMarket,
    method: v ? v.method : "manually entered values (no comparables provided)",
    confidence: v ? v.confidence : result.confidence.valuation,
    usesAssessmentAsAnchor: false,
    comps: result.scoredComps,
    strongestCompAddresses: strongest.map((c) => c.address ?? "(unnamed comp)"),
    notes: v ? v.notes : [],
  };
}

function buildRental(input: UnderwritingInput, result: UnderwritingResult): MemoRental {
  const m = result.bid.atMaxSafeBid;
  const rentBase = num(input.rental.monthlyMarketRent);
  const egi = m.effectiveGrossIncome;
  const opexBreakdown = [
    { label: "Property taxes", annual: num(input.rental.annualPropertyTax), status: "ESTIMATED" },
    { label: "Insurance", annual: num(input.rental.annualInsurance), status: "ESTIMATED" },
    { label: "Utilities (landlord)", annual: num(input.rental.annualUtilities), status: "ESTIMATED" },
    { label: "Maintenance/repairs reserve", annual: round2(egi * num(input.rental.maintenancePct)), status: "ASSUMED" },
    { label: "Property management", annual: round2(egi * num(input.rental.managementPct)), status: "ASSUMED" },
    { label: "Other operating expenses", annual: num(input.rental.otherAnnualOpEx), status: "ASSUMED" },
  ];
  return {
    rentLowIllustrative: round2(rentBase * 0.9), // illustrative band, presentation-only
    rentBase,
    rentHighIllustrative: round2(rentBase * 1.1),
    grossAnnualRent: m.grossAnnualRent,
    effectiveGrossIncome: egi,
    operatingExpenses: m.operatingExpenses,
    noi: m.noi,
    monthlyCashFlow: m.monthlyCashFlow,
    annualCashFlow: m.annualCashFlow,
    capRate: m.capRate,
    dscr: m.dscr,
    cashOnCash: m.cashOnCash,
    opexBreakdown,
  };
}

function buildBrrrr(input: UnderwritingInput, result: UnderwritingResult): MemoBrrrr {
  const m = result.bid.atMaxSafeBid;
  const scenarios = result.refinanceScenarios;
  // Selection only (argmax) — no calculation.
  const bestRecovery = scenarios.reduce((a, b) => (b.capitalRecovered > a.capitalRecovered ? b : a), scenarios[0]);
  const bestCashFlow = scenarios.reduce((a, b) => (b.monthlyCashFlow > a.monthlyCashFlow ? b : a), scenarios[0]);
  return {
    purchasePrice: m.purchasePrice,
    renovation: m.renovationWithContingency,
    acquisition: m.acquisitionCosts,
    financing: m.financingFees,
    holding: m.totalHoldingCost,
    totalProjectCost: m.totalProjectCost,
    scenarios,
    bestCapitalRecoveryLtv: bestRecovery?.ltv ?? 0,
    bestCashFlowLtv: bestCashFlow?.ltv ?? 0,
  };
}

function buildSensitivity(input: UnderwritingInput, result: UnderwritingResult): MemoSensitivity {
  const s = result.sensitivity;
  const matrix = s.matrix.map((row) => row.map((c) => c.maxSafeBid));
  const flat = matrix.flat();
  const bestCase = flat.length ? Math.max(...flat) : 0;
  const worstCase = flat.length ? Math.min(...flat) : 0;
  // Base case = the cell nearest the middle of both axes.
  const midR = Math.floor(matrix.length / 2);
  const midC = matrix[0] ? Math.floor(matrix[0].length / 2) : 0;
  const baseCase = matrix[midR]?.[midC] ?? 0;

  // Deal break point: first (highest reno, lowest ARV) cell where the max safe
  // bid drops at/below the minimum tender.
  const tender = num(input.taxSale.minimumTender);
  let breakPoint = "The deal remains workable across the tested ARV × renovation range.";
  outer: for (let i = 0; i < s.matrix.length; i++) {
    for (let j = s.matrix[i].length - 1; j >= 0; j--) {
      const cell = s.matrix[i][j];
      if (cell.maxSafeBid <= tender && tender > 0) {
        breakPoint = `The deal stops working at ARV $${cell.arv.toLocaleString()} with renovation $${cell.renovation.toLocaleString()} — the max safe bid ($${cell.maxSafeBid.toLocaleString()}) falls to/below the minimum tender.`;
        break outer;
      }
    }
  }

  return {
    arvAxis: s.arvAxis,
    renovationAxis: s.renovationAxis,
    matrix,
    breakEvenBid: s.breakEvenBid,
    walkAwayBid: s.walkAwayBid,
    bestCase,
    baseCase,
    worstCase,
    dealBreakPoint: breakPoint,
  };
}

function buildUnknowns(risks: RiskItem[]): MemoUnknown[] {
  return risks
    .filter((r) => r.severity === "UNKNOWN" || r.dataStatus === "UNKNOWN" || r.fatalIfConfirmed)
    .map((r) => {
      const g = UNKNOWN_GUIDANCE[r.category];
      return {
        label: r.label,
        category: r.category,
        whyItMatters: r.detail || g?.why || "Material to the underwriting; currently unverified.",
        howToVerify: g?.how || "Obtain primary documentation / professional verification.",
        potentialImpact: g?.impact || "Could reduce value or increase cost if confirmed negative.",
        bidAdjustment: r.fatalIfConfirmed
          ? "Do not bid until verified — treat as a potential deal-killer."
          : "Hold a risk reserve against the maximum safe bid until verified.",
      };
    });
}

// --- prose helpers ---------------------------------------------------------

function biggestRisk(result: UnderwritingResult): string {
  if (result.dealKillers.fatal[0]) return `${result.dealKillers.fatal[0].label} (fatal).`;
  if (result.dealKillers.high[0]) return `${result.dealKillers.high[0].label} (high).`;
  if (result.dealKillers.unknowns[0]) return `${result.dealKillers.unknowns[0].label} (unverified).`;
  if (result.bid.atMaxSafeBid.monthlyCashFlow <= 0) return "Non-positive cash flow at the maximum safe bid.";
  return "No single dominant risk — the main exposure is estimate accuracy (value, renovation, rent).";
}

function biggestRenoUncertainty(model: RenovationModel): string {
  const unknownLines = model.lineItems.filter((l) => l.status === "UNKNOWN");
  if (unknownLines.length === 0) return "No line item is flagged UNKNOWN, but verify condition on site.";
  const biggest = unknownLines.reduce((a, b) => (b.high > a.high ? b : a));
  return `${biggest.category} is UNKNOWN and could reach $${biggest.high.toLocaleString()} on the high side.`;
}

function whatWouldChange(result: UnderwritingResult): string {
  if (result.dealKillers.hasFatal) return "Clearing the fatal issue entirely with verified documentation.";
  if (result.dealKillers.hasCriticalUnknown) return "Verifying the outstanding title/access/environmental unknown as clean.";
  if (result.confidence.overall < 55) return "Adding stronger comparable sales and a contractor renovation estimate to raise confidence.";
  if (result.bid.atMaxSafeBid.monthlyCashFlow <= 0) return "Higher achievable rent or a lower all-in cost to reach positive cash flow.";
  return "A materially higher winning bid at auction that erodes the margin of safety.";
}

function nextAction(result: UnderwritingResult, unknowns: MemoUnknown[]): string {
  if (result.verdict === "STRONG_PASS") return "PASS.";
  if (result.dealKillers.hasFatal) return "PASS — fatal deal-killer present.";
  if (unknowns.some((u) => u.category === "TITLE")) return "ORDER TITLE SEARCH before committing.";
  if (unknowns.some((u) => u.category === "ACCESS")) return "VERIFY LEGAL ACCESS (registered right-of-way / frontage).";
  if (unknowns.some((u) => u.category === "UTILITIES")) return "VERIFY SEPTIC & WELL.";
  if (result.confidence.overall < 55) return "ADD BETTER COMPARABLES and obtain a contractor estimate.";
  if (result.verdict === "WATCH") return "WATCH — revisit if new information lowers uncertainty.";
  return "PROCEED to bid at auction up to the maximum safe bid.";
}
