import type { DeepPartial, UnderwritingInput } from "@/lib/underwriting";

/**
 * Canonical sample property used to seed the local store and to power tests.
 *
 * IMPORTANT: Every figure here is a MANUALLY ENTERED, illustrative estimate.
 * Nothing in this file is scraped, verified, or represented as real market
 * data. It exists only to demonstrate the underwriting pipeline end-to-end.
 */
export const SAMPLE_PROPERTY_INPUT: DeepPartial<UnderwritingInput> = {
  meta: {
    propertyType: "Detached house",
    rural: true,
    waterfront: false,
    lotSizeAcres: 2.17,
    bedrooms: 3,
    bathrooms: 1,
  },
  taxSale: {
    minimumTender: 92000,
    taxArrears: 41000,
    saleDate: "2025-09-15",
  },
  value: {
    conservativeAsIs: 300000,
    conservativeArv: 420000,
    baseValue: 330000,
    optimisticValue: 360000,
    assessment: 265000,
    marginOfSafetyPct: 0.2,
    requiredEquityBuffer: 30000,
  },
  renovation: {
    cosmetic: 25000,
    major: 45000,
    structural: 10000,
    contingencyPct: 0.15,
    confidence: 55,
  },
  holding: {
    holdingPeriodMonths: 6,
    monthlyPropertyTax: 275,
    monthlyInsurance: 130,
    monthlyUtilities: 160,
    monthlyMaintenance: 100,
    otherMonthly: 0,
  },
  rental: {
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
  },
  refinance: {
    arv: 420000,
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
    maxCapitalTrapped: 30000,
  },
  comps: [
    { address: "Comp A — 3BR detached", salePrice: 430000, saleDate: "2025-05-10", propertyType: "Detached house", lotAcres: 2.0, bedrooms: 3, bathrooms: 1, distanceKm: 3.2, source: "Local MLS (user-provided)", dataStatus: "USER_PROVIDED" },
    { address: "Comp B — 3BR detached", salePrice: 405000, saleDate: "2025-03-22", propertyType: "Detached house", lotAcres: 1.8, bedrooms: 3, bathrooms: 1, distanceKm: 6.1, source: "Local MLS (user-provided)", dataStatus: "USER_PROVIDED" },
    { address: "Comp C — 4BR detached", salePrice: 415000, saleDate: "2025-06-01", propertyType: "Detached house", lotAcres: 2.5, bedrooms: 4, bathrooms: 2, distanceKm: 8.4, source: "Local MLS (user-provided)", dataStatus: "USER_PROVIDED" },
  ],
  evidence: [
    {
      claim: "Comparable sale A",
      value: "$430,000",
      source: "Local MLS (user-provided)",
      sourceType: "comparable-sale",
      date: "2025-05-10",
      distanceKm: 3.2,
      dataStatus: "USER_PROVIDED",
    },
    {
      claim: "Comparable sale B",
      value: "$405,000",
      source: "Local MLS (user-provided)",
      sourceType: "comparable-sale",
      date: "2025-03-22",
      distanceKm: 6.1,
      dataStatus: "USER_PROVIDED",
    },
    {
      claim: "Comparable sale C",
      value: "$415,000",
      source: "Local MLS (user-provided)",
      sourceType: "comparable-sale",
      date: "2025-06-01",
      distanceKm: 8.4,
      dataStatus: "USER_PROVIDED",
    },
    {
      claim: "Rental comp: 3BR detached",
      value: "$2,450/mo",
      source: "Rental listing (user-provided)",
      sourceType: "rental-comp",
      date: "2025-06-15",
      distanceKm: 4.0,
      dataStatus: "USER_PROVIDED",
    },
  ],
  risks: [
    {
      category: "CONDITION",
      severity: "MEDIUM",
      label: "Interior condition unverified",
      detail: "No interior inspection available pre-sale.",
      dataStatus: "UNKNOWN",
    },
    {
      category: "TITLE",
      severity: "UNKNOWN",
      label: "Title search not yet completed",
      dataStatus: "UNKNOWN",
      fatalIfConfirmed: true,
    },
  ],
};
