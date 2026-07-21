/**
 * Underwriting domain types.
 *
 * These types describe the *inputs* to and *outputs* of the deterministic
 * underwriting engine. The engine is a pure function: same input -> same
 * output, no I/O, no AI, no randomness.
 */

/** Provenance / trust level for every data point in the system. */
export type DataStatus =
  | "VERIFIED"
  | "ESTIMATED"
  | "INFERRED"
  | "USER_PROVIDED"
  | "AI_SUGGESTED"
  | "UNKNOWN";

export type RiskSeverity = "FATAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type RiskCategory =
  | "TITLE"
  | "ACCESS"
  | "ENVIRONMENTAL"
  | "FLOOD"
  | "ZONING"
  | "STRUCTURAL"
  | "LEGAL"
  | "RENTAL"
  | "LIQUIDITY"
  | "UTILITIES"
  | "CONDITION"
  | "OTHER";

export interface RiskItem {
  category: RiskCategory;
  severity: RiskSeverity;
  label: string;
  detail?: string;
  dataStatus: DataStatus;
  /** True when this is a potential deal-killer that must be verified before bidding. */
  fatalIfConfirmed?: boolean;
}

export interface EvidenceItem {
  claim: string;
  value?: string;
  source: string;
  sourceType?: string;
  date?: string; // ISO date
  distanceKm?: number;
  /** Optional geocoded coordinates. When present with the subject's coords, the
   *  engine derives `distanceKm` automatically (Google Geocoding, see lib/geo). */
  lat?: number;
  lng?: number;
  dataStatus: DataStatus;
}

export type Verdict =
  | "STRONG_BUY"
  | "BUY"
  | "CONDITIONAL_BUY"
  | "WATCH"
  | "PASS"
  | "STRONG_PASS";

export type BidCeilingKey =
  | "VALUE"
  | "BRRRR"
  | "CASH_FLOW"
  | "ROI"
  | "RISK_ADJUSTED"
  | "CAPITAL";

// ---------------------------------------------------------------------------
// INPUT
// ---------------------------------------------------------------------------

export interface TaxSaleInput {
  minimumTender: number;
  taxArrears?: number;
  /** ISO date of the tax sale, used only for record-keeping (never for valuation). */
  saleDate?: string;
}

export interface ValueInput {
  /** Conservative AS-IS market value (before renovation). */
  conservativeAsIs: number;
  /** Conservative AFTER-REPAIR value used for MAO-style value ceiling. */
  conservativeArv: number;
  baseValue?: number;
  optimisticValue?: number;
  assessment?: number;
  /** Required margin of safety on ARV for the value ceiling (e.g. 0.20 = 20%). */
  marginOfSafetyPct: number;
  /** Absolute equity buffer required to remain after all costs. */
  requiredEquityBuffer: number;
}

export interface AcquisitionInput {
  /** How land transfer tax is computed. */
  landTransferTaxMode: "ontario" | "percent" | "flat";
  /** Used when mode = "percent". */
  landTransferTaxPct?: number;
  /** Used when mode = "flat". */
  landTransferTaxFlat?: number;
  /** Applies Toronto municipal LTT (roughly doubles LTT). Off for rural Ontario. */
  includeTorontoMLTT?: boolean;
  legalFees: number;
  titleInsurance: number;
  otherClosingCosts: number;
}

export interface RenovationInput {
  cosmetic: number;
  major: number;
  structural: number;
  /** Contingency as a fraction of raw renovation (e.g. 0.15 = 15%). */
  contingencyPct: number;
  /** 0-100, how confident we are in the renovation scope. */
  confidence: number;
}

export interface FinancingInput {
  /** Fraction of the PURCHASE price funded by the acquisition loan (e.g. 0.75). */
  financedOnPurchasePct: number;
  /** Whether renovation is financed by the same lender. */
  financeRenovation: boolean;
  /** Fraction of renovation-with-contingency financed (when financeRenovation). */
  renovationFinancedPct: number;
  /** Annual interest rate during the hold (e.g. 0.10 = 10%). */
  annualInterestRate: number;
  /** Lender/broker fees as a fraction of the total acquisition financing. */
  financingFeesPct: number;
  /** Fixed lender fees in dollars. */
  fixedLenderFees: number;
}

export interface HoldingInput {
  holdingPeriodMonths: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  monthlyUtilities: number;
  monthlyMaintenance: number;
  otherMonthly: number;
}

export interface RentalInput {
  monthlyMarketRent: number;
  vacancyPct: number; // e.g. 0.05
  annualPropertyTax: number;
  annualInsurance: number;
  /** Utilities paid by landlord (annual). */
  annualUtilities: number;
  /** Maintenance/repairs reserve as a fraction of effective gross income. */
  maintenancePct: number;
  /** Property management as a fraction of effective gross income. */
  managementPct: number;
  /** Long-term capital expenditure reserve as a fraction of EGI (distinct from
   *  maintenance). Reserving for roof/furnace/windows cycles keeps NOI honest. */
  capexPct: number;
  /** Additional fixed annual operating expenses. */
  otherAnnualOpEx: number;
  /** 0-100 confidence in the rent estimate. */
  confidence: number;
}

export interface RefinanceInput {
  /** After-repair value used by the refinancing lender. */
  arv: number;
  refinanceLtv: number; // e.g. 0.75
  refinanceAnnualRate: number; // e.g. 0.055
  refinanceAmortizationYears: number; // e.g. 25
  /** Refinance costs (appraisal, legal) as a fraction of refi amount. */
  refinanceCostsPct: number;
  fixedRefinanceCosts: number;
}

export interface ReturnsInput {
  /** Minimum acceptable cash-on-cash return on trapped capital (e.g. 0.08). */
  minCashOnCash: number;
  /** Minimum debt-service coverage ratio for the cash-flow ceiling (e.g. 1.2). */
  minDscr: number;
  /** Minimum monthly cash flow required (post-refinance), in dollars. */
  minMonthlyCashFlow: number;
  /** Maximum capital you are willing to leave trapped in the deal after refi. */
  maxCapitalTrapped: number;
}

export interface CapitalInput {
  /** Optional hard cap on cash you can deploy. Undefined = no constraint. */
  maxCapitalAvailable?: number;
}

export interface BidShapeInput {
  /** Conservative bid as a fraction of the maximum safe bid (e.g. 0.85). */
  conservativeBidFactor: number;
  /** Target bid as a fraction of the maximum safe bid (e.g. 0.93). */
  targetBidFactor: number;
}

export interface PropertyMeta {
  propertyType?: string;
  waterfront?: boolean;
  rural?: boolean;
  lotSizeAcres?: number;
  bedrooms?: number;
  bathrooms?: number;
  /** Optional geocoded coordinates of the subject property (Google Geocoding). */
  lat?: number;
  lng?: number;
}

/** Which underwriting model dominates the decision for this property. */
export type UnderwritingStrategy = "BRRRR" | "CASH_FLOW" | "FLIP" | "LAND";

export interface UnderwritingInput {
  meta: PropertyMeta;
  taxSale: TaxSaleInput;
  value: ValueInput;
  acquisition: AcquisitionInput;
  renovation: RenovationInput;
  financing: FinancingInput;
  holding: HoldingInput;
  rental: RentalInput;
  refinance: RefinanceInput;
  returns: ReturnsInput;
  capital: CapitalInput;
  bidShape: BidShapeInput;
  risks: RiskItem[];
  evidence: EvidenceItem[];
  /** Optional Phase 2 additions (all backward-compatible / default empty). */
  strategy?: UnderwritingStrategy;
  comps?: import("./comps").CompProperty[];
  compWeights?: import("./comps").CompWeights;
  renovationLineItems?: import("./renovationModel").RenoLineItem[];
}

// ---------------------------------------------------------------------------
// OUTPUT
// ---------------------------------------------------------------------------

/** A single line in a "Show Your Math" breakdown. */
export interface MathLine {
  label: string;
  amount: number;
  /** "add" increases the running figure, "subtract" decreases it, "result" is a subtotal. */
  op: "add" | "subtract" | "result" | "info";
  note?: string;
}

/** Full BRRRR model evaluated at a specific purchase price. */
export interface BrrrrResult {
  purchasePrice: number;
  acquisitionCosts: number;
  landTransferTax: number;
  renovationRaw: number;
  renovationWithContingency: number;
  purchaseLoan: number;
  renovationLoan: number;
  totalAcquisitionFinancing: number;
  financingFees: number;
  downPayment: number;
  monthlyHoldingInterest: number;
  monthlyHoldingCosts: number;
  totalHoldingCost: number;
  totalProjectCost: number;
  totalCashInvested: number;
  // rental
  grossAnnualRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
  // refinance
  refinanceAmount: number;
  refinanceCosts: number;
  existingLoanPayoff: number;
  refinanceProceeds: number;
  capitalRecovered: number;
  capitalTrapped: number;
  capitalRecoveryPct: number;
  newMonthlyMortgage: number;
  annualDebtService: number;
  // returns
  monthlyCashFlow: number;
  annualCashFlow: number;
  capRate: number;
  yieldOnCost: number;
  cashOnCash: number | null; // null = infinite (all capital recovered)
  dscr: number;
  equityCreatedVsArv: number;
  equityCreatedVsCost: number;
}

export interface BidCeiling {
  key: BidCeilingKey;
  label: string;
  amount: number;
  applicable: boolean;
  rationale: string;
}

export interface ConfidenceScore {
  overall: number;
  valuation: number;
  renovation: number;
  rental: number;
  risk: number;
  reasons: string[];
}

export interface InvestmentScore {
  total: number;
  value: number; // /20
  brrrr: number; // /20
  cashFlow: number; // /15
  market: number; // /15
  risk: number; // /15
  rental: number; // /10
  liquidity: number; // /5
}

export interface SwotItem {
  statement: string;
  evidence: string;
  confidence: "High" | "Medium" | "Low";
}

export interface Swot {
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  opportunities: SwotItem[];
  threats: SwotItem[];
}

export interface DealKillerReport {
  hasFatal: boolean;
  hasCriticalUnknown: boolean;
  fatal: RiskItem[];
  high: RiskItem[];
  unknowns: RiskItem[];
  /** 0-100, higher = riskier. */
  riskScore: number;
}

export interface BidStrategy {
  /** Steal price: full capital recovery on refinance (exceptional BRRRR). ≤ conservative. */
  opportunisticBid: number;
  conservativeBid: number;
  targetBid: number;
  maximumSafeBid: number;
  hardStop: number;
  /** Do-not-cross price (equals the maximum safe bid). */
  walkAwayBid: number;
  bindingConstraint: BidCeilingKey;
  ceilings: BidCeiling[];
  /** BRRRR model evaluated at the maximum safe bid. */
  atMaxSafeBid: BrrrrResult;
  /** BRRRR model evaluated at the minimum tender (what winning at reserve looks like). */
  atMinimumTender: BrrrrResult;
  valueMathLines: MathLine[];
}

export interface InvestmentCommittee {
  thesis: string;
  keyRisks: string[];
  dealKillers: string[];
  missingInformation: string[];
  buyOnlyIf: string;
}

export interface UnderwritingResult {
  strategy: UnderwritingStrategy;
  verdict: Verdict;
  bid: BidStrategy;
  brrrrAtMinTender: BrrrrResult;
  dealKillers: DealKillerReport;
  swot: Swot;
  score: InvestmentScore;
  confidence: ConfidenceScore;
  committee: InvestmentCommittee;
  warnings: string[];
  // Phase 2 intelligence
  scoredComps: import("./comps").ScoredComp[];
  valuation: import("./valuation").MarketValuation | null;
  renovationModel: import("./renovationModel").RenovationModel;
  refinanceScenarios: import("./refinanceScenarios").RefinanceScenario[];
  sensitivity: import("./sensitivity").SensitivityResult;
  reasons: import("./reasons").ReasonsResult;
}
