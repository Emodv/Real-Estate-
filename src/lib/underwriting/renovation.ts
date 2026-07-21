import type { RenovationInput } from "./types";
import { num, round2 } from "./money";

export function renovationRaw(input: RenovationInput): number {
  return round2(num(input.cosmetic) + num(input.major) + num(input.structural));
}

export function renovationWithContingency(input: RenovationInput): number {
  const raw = renovationRaw(input);
  const contingency = Math.max(num(input.contingencyPct), 0);
  return round2(raw * (1 + contingency));
}
