import type { UnderwritingInput } from "../types";
import type { CompProperty } from "../comps";
import { withDefaults } from "../defaults";

/**
 * Deterministic scenario fixtures for Phase 3 regression tests. All figures are
 * synthetic and illustrative — they exist to exercise engine behavior, not to
 * represent real market data.
 */
function comp(over: Partial<CompProperty>): CompProperty {
  return {
    salePrice: 420000,
    saleDate: new Date().toISOString(),
    propertyType: "Detached house",
    buildingSqft: 1500,
    lotAcres: 2,
    bedrooms: 3,
    bathrooms: 1,
    distanceKm: 4,
    source: "MLS (synthetic)",
    dataStatus: "USER_PROVIDED",
    ...over,
  };
}

const goodComps: CompProperty[] = [
  comp({ address: "A", salePrice: 430000, distanceKm: 3 }),
  comp({ address: "B", salePrice: 410000, distanceKm: 6 }),
  comp({ address: "C", salePrice: 420000, distanceKm: 8 }),
];

const baseRental = {
  monthlyMarketRent: 3400,
  vacancyPct: 0.05,
  annualPropertyTax: 3300,
  annualInsurance: 1500,
  annualUtilities: 0,
  maintenancePct: 0.08,
  managementPct: 0.08,
  capexPct: 0.05,
  otherAnnualOpEx: 600,
  confidence: 60,
};

export const SCENARIOS: Record<string, UnderwritingInput> = {
  strongUrban: withDefaults({
    meta: { propertyType: "Detached house", rural: false, bedrooms: 3, bathrooms: 1 },
    taxSale: { minimumTender: 90000 },
    renovation: { cosmetic: 20000, major: 25000, structural: 0, contingencyPct: 0.15, confidence: 65 },
    rental: { ...baseRental, monthlyMarketRent: 3600 },
    comps: goodComps,
  }),

  strongRural: withDefaults({
    meta: { propertyType: "Detached house", rural: true, lotSizeAcres: 2, bedrooms: 3, bathrooms: 1 },
    taxSale: { minimumTender: 85000 },
    renovation: { cosmetic: 25000, major: 30000, structural: 5000, contingencyPct: 0.15, confidence: 60 },
    rental: baseRental,
    comps: goodComps,
  }),

  weakRental: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 90000 },
    renovation: { cosmetic: 20000, major: 30000, structural: 0, contingencyPct: 0.15, confidence: 55 },
    rental: { ...baseRental, monthlyMarketRent: 1200 }, // far too low
    comps: goodComps,
  }),

  highReno: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 60000 },
    renovation: { cosmetic: 60000, major: 90000, structural: 60000, contingencyPct: 0.2, confidence: 45 },
    rental: baseRental,
    comps: goodComps,
  }),

  unknownCondition: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 70000 },
    renovation: { cosmetic: 0, major: 0, structural: 0, contingencyPct: 0.15, confidence: 30 }, // reno unknown ($0)
    rental: baseRental,
    comps: goodComps,
    risks: [{ category: "CONDITION", severity: "UNKNOWN", label: "Interior condition unknown", dataStatus: "UNKNOWN" }],
  }),

  noComps: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 80000 },
    value: { conservativeAsIs: 300000, conservativeArv: 380000, marginOfSafetyPct: 0.2, requiredEquityBuffer: 25000 },
    renovation: { cosmetic: 20000, major: 30000, structural: 0, contingencyPct: 0.15, confidence: 55 },
    rental: baseRental,
    refinance: { arv: 380000, refinanceLtv: 0.75, refinanceAnnualRate: 0.055, refinanceAmortizationYears: 25, refinanceCostsPct: 0.01, fixedRefinanceCosts: 2000 },
    comps: [],
  }),

  lowConfidenceValuation: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 80000 },
    renovation: { cosmetic: 20000, major: 30000, structural: 0, contingencyPct: 0.15, confidence: 55 },
    rental: baseRental,
    comps: [
      comp({ address: "far-old-1", salePrice: 300000, distanceKm: 24, saleDate: "2019-01-01" }),
      comp({ address: "far-old-2", salePrice: 520000, distanceKm: 22, saleDate: "2019-06-01" }), // wide dispersion
    ],
  }),

  fatalDealKiller: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 60000 },
    renovation: { cosmetic: 15000, major: 15000, structural: 0, contingencyPct: 0.15, confidence: 70 },
    rental: baseRental,
    comps: goodComps,
    risks: [{ category: "ACCESS", severity: "FATAL", label: "No legal access (landlocked)", dataStatus: "VERIFIED" }],
  }),

  excellentBrrrr: withDefaults({
    meta: { propertyType: "Detached house", rural: false },
    taxSale: { minimumTender: 60000 },
    renovation: { cosmetic: 15000, major: 20000, structural: 0, contingencyPct: 0.15, confidence: 70 },
    rental: { ...baseRental, monthlyMarketRent: 3800 },
    comps: goodComps,
    returns: { minCashOnCash: 0.08, minDscr: 1.2, minMonthlyCashFlow: 0, maxCapitalTrapped: 40000 },
  }),

  winningBidExceedsMaxSafe: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 380000 }, // reserve above any safe bid
    renovation: { cosmetic: 20000, major: 30000, structural: 0, contingencyPct: 0.15, confidence: 60 },
    rental: baseRental,
    comps: goodComps,
  }),

  winningBidBelowTarget: withDefaults({
    meta: { propertyType: "Detached house", rural: false },
    taxSale: { minimumTender: 40000 },
    renovation: { cosmetic: 15000, major: 20000, structural: 0, contingencyPct: 0.15, confidence: 65 },
    rental: { ...baseRental, monthlyMarketRent: 3700 },
    comps: goodComps,
  }),

  strongDiscountPoorCashFlow: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 70000 },
    renovation: { cosmetic: 20000, major: 30000, structural: 0, contingencyPct: 0.15, confidence: 60 },
    rental: { ...baseRental, monthlyMarketRent: 1600 }, // cheap vs value, but weak rent
    comps: goodComps,
  }),

  strongCashFlowExcessiveRisk: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 70000 },
    renovation: { cosmetic: 20000, major: 30000, structural: 0, contingencyPct: 0.15, confidence: 60 },
    rental: { ...baseRental, monthlyMarketRent: 4200 },
    comps: goodComps,
    risks: [
      { category: "ENVIRONMENTAL", severity: "HIGH", label: "Possible fuel-tank contamination", dataStatus: "UNKNOWN" },
      { category: "STRUCTURAL", severity: "HIGH", label: "Foundation concern", dataStatus: "UNKNOWN" },
      { category: "TITLE", severity: "UNKNOWN", label: "Title not searched", dataStatus: "UNKNOWN", fatalIfConfirmed: true },
    ],
  }),

  misleadingAssessment: withDefaults({
    meta: { propertyType: "Detached house", rural: true },
    taxSale: { minimumTender: 90000 },
    value: { conservativeAsIs: 0, conservativeArv: 0, assessment: 600000, marginOfSafetyPct: 0.2, requiredEquityBuffer: 25000 },
    renovation: { cosmetic: 20000, major: 30000, structural: 0, contingencyPct: 0.15, confidence: 60 },
    rental: baseRental,
    comps: goodComps, // comps say ~420k, assessment says 600k
  }),
};
