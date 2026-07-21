import type { Verdict } from "@/lib/underwriting";

export function money(n: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function ratio(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}×`;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  STRONG_BUY: "STRONG BUY",
  BUY: "BUY",
  CONDITIONAL_BUY: "CONDITIONAL BUY",
  WATCH: "WATCH",
  PASS: "PASS",
  STRONG_PASS: "STRONG PASS",
};

export function verdictTone(v: Verdict): "good" | "warn" | "bad" {
  if (v === "STRONG_BUY" || v === "BUY") return "good";
  if (v === "CONDITIONAL_BUY" || v === "WATCH") return "warn";
  return "bad";
}

export function severityTone(s: string): "good" | "warn" | "bad" | "muted" {
  switch (s) {
    case "FATAL":
    case "HIGH":
      return "bad";
    case "MEDIUM":
    case "UNKNOWN":
      return "warn";
    case "LOW":
      return "good";
    default:
      return "muted";
  }
}
