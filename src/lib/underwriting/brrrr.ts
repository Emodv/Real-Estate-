import type { BrrrrResult, UnderwritingInput } from "./types";
import { num, round2, clamp, safeDivide, amortizingPayment } from "./money";
import { acquisitionCosts, landTransferTax } from "./acquisition";
import { renovationRaw, renovationWithContingency } from "./renovation";
import { rentalMath } from "./rental";

/**
 * Evaluate the full BRRRR model at a specific purchase price.
 *
 * This is THE deterministic core. Every bid ceiling is derived by evaluating
 * this function at candidate prices and checking a constraint. It performs no
 * I/O and contains no AI — pure arithmetic.
 *
 * Modeling assumptions (documented in docs/UNDERWRITING_ENGINE.md):
 *  - During the renovation hold the acquisition + renovation loan is serviced
 *    interest-only (conservative: principal is not paid down, so the full loan
 *    is refinanced out).
 *  - The property is fully vacant during the hold (no rent offsets holding).
 *  - Refinance pays off the acquisition/renovation loan; proceeds above payoff
 *    and refi costs are returned to the investor as recovered capital.
 *  - The stabilized mortgage is a fully-amortizing loan on ARV * refinanceLtv.
 */
export function evaluateBrrrr(price: number, input: UnderwritingInput): BrrrrResult {
  const purchasePrice = Math.max(num(price), 0);

  // --- Acquisition -------------------------------------------------------
  const ltt = landTransferTax(purchasePrice, input.acquisition);
  const acqCosts = acquisitionCosts(purchasePrice, input.acquisition);

  // --- Renovation --------------------------------------------------------
  const renoRaw = renovationRaw(input.renovation);
  const renoWithContingency = renovationWithContingency(input.renovation);

  // --- Financing (acquisition + reno phase) -----------------------------
  const financedPct = clamp(num(input.financing.financedOnPurchasePct), 0, 1);
  const purchaseLoan = round2(purchasePrice * financedPct);
  const renoFinancedPct = clamp(num(input.financing.renovationFinancedPct), 0, 1);
  const renovationLoan = input.financing.financeRenovation
    ? round2(renoWithContingency * renoFinancedPct)
    : 0;
  const totalAcquisitionFinancing = round2(purchaseLoan + renovationLoan);
  const financingFees = round2(
    totalAcquisitionFinancing * Math.max(num(input.financing.financingFeesPct), 0) +
      num(input.financing.fixedLenderFees),
  );
  const downPayment = round2(purchasePrice - purchaseLoan);

  // --- Holding -----------------------------------------------------------
  const months = Math.max(num(input.holding.holdingPeriodMonths), 0);
  const monthlyRate = Math.max(num(input.financing.annualInterestRate), 0) / 12;
  const monthlyHoldingInterest = round2(totalAcquisitionFinancing * monthlyRate);
  const monthlyHoldingCosts = round2(
    monthlyHoldingInterest +
      num(input.holding.monthlyPropertyTax) +
      num(input.holding.monthlyInsurance) +
      num(input.holding.monthlyUtilities) +
      num(input.holding.monthlyMaintenance) +
      num(input.holding.otherMonthly),
  );
  const totalHoldingCost = round2(monthlyHoldingCosts * months);

  // --- Project cost & cash invested -------------------------------------
  const totalProjectCost = round2(
    purchasePrice + acqCosts + renoWithContingency + financingFees + totalHoldingCost,
  );
  // Cash the investor actually deploys before refinancing.
  const renoPaidInCash = round2(renoWithContingency - renovationLoan);
  const totalCashInvested = round2(
    downPayment + acqCosts + financingFees + renoPaidInCash + totalHoldingCost,
  );

  // --- Stabilized rental -------------------------------------------------
  const rent = rentalMath(input.rental);

  // --- Refinance ---------------------------------------------------------
  const arv = Math.max(num(input.refinance.arv), 0);
  const refiLtv = clamp(num(input.refinance.refinanceLtv), 0, 1);
  const refinanceAmount = round2(arv * refiLtv);
  const refinanceCosts = round2(
    refinanceAmount * Math.max(num(input.refinance.refinanceCostsPct), 0) +
      num(input.refinance.fixedRefinanceCosts),
  );
  const existingLoanPayoff = totalAcquisitionFinancing;
  const refinanceProceeds = round2(refinanceAmount - existingLoanPayoff - refinanceCosts);
  const capitalRecovered = round2(Math.max(refinanceProceeds, 0));
  const capitalTrapped = round2(totalCashInvested - capitalRecovered);
  const capitalRecoveryPct = clamp(
    safeDivide(capitalRecovered, totalCashInvested, 0),
    0,
    10,
  );

  const refiMonthlyRate = Math.max(num(input.refinance.refinanceAnnualRate), 0) / 12;
  const refiPeriods = Math.max(num(input.refinance.refinanceAmortizationYears), 0) * 12;
  const newMonthlyMortgage = round2(
    amortizingPayment(refinanceAmount, refiMonthlyRate, refiPeriods),
  );
  const annualDebtService = round2(newMonthlyMortgage * 12);

  // --- Returns -----------------------------------------------------------
  const annualCashFlow = round2(rent.noi - annualDebtService);
  const monthlyCashFlow = round2(annualCashFlow / 12);
  const capRate = round2(safeDivide(rent.noi, arv, 0) * 100) / 100;
  const yieldOnCost = round2(safeDivide(rent.noi, totalProjectCost, 0) * 100) / 100;
  // Cash-on-cash on trapped capital. When all capital is recovered, return is
  // effectively infinite — represented as null (not NaN / not a fake huge number).
  const cashOnCash =
    capitalTrapped <= 0 ? null : round2((annualCashFlow / capitalTrapped) * 10000) / 10000;
  const dscr = round2(safeDivide(rent.noi, annualDebtService, 0) * 100) / 100;
  const equityCreatedVsArv = round2(arv - refinanceAmount);
  const equityCreatedVsCost = round2(arv - totalProjectCost);

  return {
    purchasePrice,
    acquisitionCosts: acqCosts,
    landTransferTax: ltt,
    renovationRaw: renoRaw,
    renovationWithContingency: renoWithContingency,
    purchaseLoan,
    renovationLoan,
    totalAcquisitionFinancing,
    financingFees,
    downPayment,
    monthlyHoldingInterest,
    monthlyHoldingCosts,
    totalHoldingCost,
    totalProjectCost,
    totalCashInvested,
    grossAnnualRent: rent.grossAnnualRent,
    effectiveGrossIncome: rent.effectiveGrossIncome,
    operatingExpenses: rent.operatingExpenses,
    noi: rent.noi,
    refinanceAmount,
    refinanceCosts,
    existingLoanPayoff,
    refinanceProceeds,
    capitalRecovered,
    capitalTrapped,
    capitalRecoveryPct,
    newMonthlyMortgage,
    annualDebtService,
    monthlyCashFlow,
    annualCashFlow,
    capRate,
    yieldOnCost,
    cashOnCash,
    dscr,
    equityCreatedVsArv,
    equityCreatedVsCost,
  };
}
