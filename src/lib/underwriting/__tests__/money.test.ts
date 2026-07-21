import { describe, it, expect } from "vitest";
import { num, clamp, safeDivide, amortizingPayment, round2 } from "../money";

describe("money primitives", () => {
  it("num() never returns NaN/Infinity", () => {
    expect(num(NaN)).toBe(0);
    expect(num(Infinity)).toBe(0);
    expect(num(-Infinity)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num(null)).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num("123.5")).toBe(123.5);
    expect(num(42)).toBe(42);
    expect(num(undefined, 7)).toBe(7);
  });

  it("clamp() bounds values and handles non-finite", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
    expect(clamp(NaN, 0, 10)).toBe(0);
  });

  it("safeDivide() guards against divide-by-zero", () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, -1)).toBe(-1);
    expect(safeDivide(NaN, 2)).toBe(0);
  });

  it("amortizingPayment() matches a known mortgage", () => {
    // $300,000 at 5.5%/yr over 25yr -> ~$1,842.26/mo
    const pmt = amortizingPayment(300000, 0.055 / 12, 25 * 12);
    expect(pmt).toBeGreaterThan(1840);
    expect(pmt).toBeLessThan(1845);
  });

  it("amortizingPayment() handles zero interest and zero principal", () => {
    expect(amortizingPayment(0, 0.05, 120)).toBe(0);
    expect(amortizingPayment(1200, 0, 12)).toBe(100); // straight line
  });

  it("round2 avoids float drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});
