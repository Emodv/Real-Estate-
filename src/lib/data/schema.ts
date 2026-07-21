import { z } from "zod";
import type { UnderwritingInput } from "@/lib/underwriting";

/**
 * Zod schemas validate every piece of user-provided data before it reaches
 * the deterministic engine. Coercion turns HTML form strings into numbers;
 * the engine's `num()` guard is the final backstop.
 */

const money = z.coerce.number().finite();
const pct = z.coerce.number().finite();

export const riskSchema = z.object({
  category: z.enum([
    "TITLE",
    "ACCESS",
    "ENVIRONMENTAL",
    "FLOOD",
    "ZONING",
    "STRUCTURAL",
    "LEGAL",
    "RENTAL",
    "LIQUIDITY",
    "UTILITIES",
    "CONDITION",
    "OTHER",
  ]),
  severity: z.enum(["FATAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  label: z.string().min(1),
  detail: z.string().optional(),
  dataStatus: z.enum([
    "VERIFIED",
    "ESTIMATED",
    "INFERRED",
    "USER_PROVIDED",
    "AI_SUGGESTED",
    "UNKNOWN",
  ]),
  fatalIfConfirmed: z.boolean().optional(),
});

export const evidenceSchema = z.object({
  claim: z.string().min(1),
  value: z.string().optional(),
  source: z.string().min(1),
  sourceType: z.string().optional(),
  date: z.string().optional(),
  distanceKm: z.coerce.number().optional(),
  dataStatus: z.enum([
    "VERIFIED",
    "ESTIMATED",
    "INFERRED",
    "USER_PROVIDED",
    "AI_SUGGESTED",
    "UNKNOWN",
  ]),
});

export const underwritingInputSchema = z.object({
  meta: z.object({
    propertyType: z.string().optional(),
    waterfront: z.coerce.boolean().optional(),
    rural: z.coerce.boolean().optional(),
    lotSizeAcres: z.coerce.number().optional(),
    bedrooms: z.coerce.number().optional(),
    bathrooms: z.coerce.number().optional(),
  }),
  taxSale: z.object({
    minimumTender: money,
    taxArrears: money.optional(),
    saleDate: z.string().optional(),
  }),
  value: z.object({
    conservativeAsIs: money,
    conservativeArv: money,
    baseValue: money.optional(),
    optimisticValue: money.optional(),
    assessment: money.optional(),
    marginOfSafetyPct: pct,
    requiredEquityBuffer: money,
  }),
  acquisition: z.object({
    landTransferTaxMode: z.enum(["ontario", "percent", "flat"]),
    landTransferTaxPct: pct.optional(),
    landTransferTaxFlat: money.optional(),
    includeTorontoMLTT: z.coerce.boolean().optional(),
    legalFees: money,
    titleInsurance: money,
    otherClosingCosts: money,
  }),
  renovation: z.object({
    cosmetic: money,
    major: money,
    structural: money,
    contingencyPct: pct,
    confidence: z.coerce.number().min(0).max(100),
  }),
  financing: z.object({
    financedOnPurchasePct: pct,
    financeRenovation: z.coerce.boolean(),
    renovationFinancedPct: pct,
    annualInterestRate: pct,
    financingFeesPct: pct,
    fixedLenderFees: money,
  }),
  holding: z.object({
    holdingPeriodMonths: z.coerce.number().min(0),
    monthlyPropertyTax: money,
    monthlyInsurance: money,
    monthlyUtilities: money,
    monthlyMaintenance: money,
    otherMonthly: money,
  }),
  rental: z.object({
    monthlyMarketRent: money,
    vacancyPct: pct,
    annualPropertyTax: money,
    annualInsurance: money,
    annualUtilities: money,
    maintenancePct: pct,
    managementPct: pct,
    otherAnnualOpEx: money,
    confidence: z.coerce.number().min(0).max(100),
  }),
  refinance: z.object({
    arv: money,
    refinanceLtv: pct,
    refinanceAnnualRate: pct,
    refinanceAmortizationYears: z.coerce.number().min(0),
    refinanceCostsPct: pct,
    fixedRefinanceCosts: money,
  }),
  returns: z.object({
    minCashOnCash: pct,
    minDscr: z.coerce.number().min(0),
    minMonthlyCashFlow: money,
    maxCapitalTrapped: money,
  }),
  capital: z.object({
    maxCapitalAvailable: money.optional(),
  }),
  bidShape: z.object({
    conservativeBidFactor: pct,
    targetBidFactor: pct,
  }),
  risks: z.array(riskSchema).default([]),
  evidence: z.array(evidenceSchema).default([]),
});

// Compile-time assurance that the parsed output matches the engine's input type.
type _SchemaMatchesEngine = z.infer<typeof underwritingInputSchema> extends UnderwritingInput
  ? true
  : never;
const _schemaCheck: _SchemaMatchesEngine = true;
void _schemaCheck;

export const propertySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  address: z.string().optional(),
  municipality: z.string().optional(),
  county: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  input: underwritingInputSchema,
});

export type PropertyRecord = z.infer<typeof propertySchema>;
