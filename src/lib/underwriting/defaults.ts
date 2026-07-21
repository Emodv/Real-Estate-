import type { UnderwritingInput } from "./types";

/**
 * Conservative default assumptions for Ontario BRRRR underwriting.
 * These are deliberately cautious. They are ESTIMATES, not facts — the UI
 * labels any field left at its default accordingly.
 */
export const DEFAULT_INPUT: UnderwritingInput = {
  meta: {
    propertyType: "Detached house",
    waterfront: false,
    rural: true,
    lotSizeAcres: undefined,
    bedrooms: undefined,
    bathrooms: undefined,
  },
  taxSale: {
    minimumTender: 0,
    taxArrears: undefined,
    saleDate: undefined,
  },
  value: {
    conservativeAsIs: 0,
    conservativeArv: 0,
    baseValue: undefined,
    optimisticValue: undefined,
    assessment: undefined,
    marginOfSafetyPct: 0.2,
    requiredEquityBuffer: 25000,
  },
  acquisition: {
    landTransferTaxMode: "ontario",
    includeTorontoMLTT: false,
    legalFees: 2500,
    titleInsurance: 800,
    otherClosingCosts: 1500,
  },
  renovation: {
    cosmetic: 0,
    major: 0,
    structural: 0,
    contingencyPct: 0.15,
    confidence: 40,
  },
  financing: {
    financedOnPurchasePct: 0.75,
    financeRenovation: false,
    renovationFinancedPct: 0,
    annualInterestRate: 0.1,
    financingFeesPct: 0.02,
    fixedLenderFees: 1000,
  },
  holding: {
    holdingPeriodMonths: 6,
    monthlyPropertyTax: 250,
    monthlyInsurance: 120,
    monthlyUtilities: 150,
    monthlyMaintenance: 100,
    otherMonthly: 0,
  },
  rental: {
    monthlyMarketRent: 0,
    vacancyPct: 0.05,
    annualPropertyTax: 3000,
    annualInsurance: 1400,
    annualUtilities: 0,
    maintenancePct: 0.08,
    managementPct: 0.08,
    otherAnnualOpEx: 600,
    confidence: 40,
  },
  refinance: {
    arv: 0,
    refinanceLtv: 0.75,
    refinanceAnnualRate: 0.055,
    refinanceAmortizationYears: 25,
    refinanceCostsPct: 0.01,
    fixedRefinanceCosts: 2000,
  },
  returns: {
    minCashOnCash: 0.08,
    minDscr: 1.2,
    minMonthlyCashFlow: 0,
    maxCapitalTrapped: 25000,
  },
  capital: {
    maxCapitalAvailable: undefined,
  },
  bidShape: {
    conservativeBidFactor: 0.85,
    targetBidFactor: 0.93,
  },
  risks: [],
  evidence: [],
};

/** Deep-merge a partial input over the conservative defaults. */
export function withDefaults(partial: DeepPartial<UnderwritingInput>): UnderwritingInput {
  return {
    meta: { ...DEFAULT_INPUT.meta, ...partial.meta },
    taxSale: { ...DEFAULT_INPUT.taxSale, ...partial.taxSale },
    value: { ...DEFAULT_INPUT.value, ...partial.value },
    acquisition: { ...DEFAULT_INPUT.acquisition, ...partial.acquisition },
    renovation: { ...DEFAULT_INPUT.renovation, ...partial.renovation },
    financing: { ...DEFAULT_INPUT.financing, ...partial.financing },
    holding: { ...DEFAULT_INPUT.holding, ...partial.holding },
    rental: { ...DEFAULT_INPUT.rental, ...partial.rental },
    refinance: { ...DEFAULT_INPUT.refinance, ...partial.refinance },
    returns: { ...DEFAULT_INPUT.returns, ...partial.returns },
    capital: { ...DEFAULT_INPUT.capital, ...partial.capital },
    bidShape: { ...DEFAULT_INPUT.bidShape, ...partial.bidShape },
    risks: partial.risks ? (partial.risks as UnderwritingInput["risks"]) : [],
    evidence: partial.evidence ? (partial.evidence as UnderwritingInput["evidence"]) : [],
  };
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer _U>
    ? T[P]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};
