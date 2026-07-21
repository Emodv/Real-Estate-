# Confidence Calibration

Purpose: determine whether the confidence score **means anything** — i.e.
whether higher-confidence predictions are actually more accurate. We only
measure this; we never auto-tune the confidence formula from it (see
`docs/MODEL_GOVERNANCE.md`).

## Method
`src/lib/backtest/confidenceCalibration.ts` groups historical backtests by the
frozen `predictedConfidence`:

- **HIGH** ≥ 70
- **MEDIUM** 45–69
- **LOW** < 45

For each band it reports:
- `n` (sample size),
- **median absolute valuation error** (median preferred over mean — outliers
  distort averages),
- **false-BUY rate**.

It then reports `highOutperformsLow` = (HIGH median abs error < LOW median abs
error), and the plain-language interpretation.

## Sufficiency rule
Calibration requires **≥ 12 backtests** with **≥ 2 in both** the HIGH and LOW
bands. Below that, the result is explicitly:

> INSUFFICIENT SAMPLE SIZE

The dashboard shows this verbatim rather than pretending to a conclusion.

## What we expect (hypothesis, unproven)
If confidence is well-built, HIGH-confidence properties should show **lower
median valuation error** and a **lower false-BUY rate** than LOW-confidence ones.

## Findings
_None yet — no real backtests recorded._ Populate `/backtest` with ≥ 12 real
historical Ontario tax-sale properties, then record the observed band table
here. If HIGH does **not** outperform LOW, log it as a calibration finding and
seek human approval before changing the confidence model — do not overfit.
