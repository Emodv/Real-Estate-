/**
 * Money & numeric primitives.
 *
 * Every financial calculation in this system flows through these helpers so
 * that we NEVER silently emit NaN / Infinity / undefined. A financial engine
 * that produces `NaN` is worse than one that throws — it hides the failure.
 */

/** Round to whole cents to avoid floating point drift in reported figures. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Round to whole dollars (used for headline bid figures). */
export function roundDollars(n: number): number {
  return Math.round(n);
}

/**
 * Coerce any value to a finite number, falling back to `fallback` for
 * NaN / Infinity / null / undefined. This is the single choke point that
 * enforces "never silently produce NaN".
 */
export function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/** A guard for divisors: returns fallback when denominator is ~0. */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return fallback;
  if (Math.abs(denominator) < 1e-9) return fallback;
  return numerator / denominator;
}

/**
 * Standard fully-amortizing mortgage payment (per period).
 * @param principal loan amount
 * @param periodRate interest rate per period (e.g. monthly = annual/12)
 * @param periods total number of payments
 * Interest-only when periods <= 0. Zero-rate handled linearly.
 */
export function amortizingPayment(principal: number, periodRate: number, periods: number): number {
  const p = num(principal);
  const r = num(periodRate);
  const n = num(periods);
  if (p <= 0) return 0;
  if (n <= 0) return p * Math.max(r, 0); // degenerate: treat as interest-only
  if (Math.abs(r) < 1e-12) return p / n; // zero interest -> straight line
  const factor = Math.pow(1 + r, n);
  return (p * r * factor) / (factor - 1);
}
