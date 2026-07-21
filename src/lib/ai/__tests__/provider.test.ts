import { describe, it, expect } from "vitest";
import { NullAIProvider, aiAnalysisSchema } from "../provider";

describe("AI provider abstraction", () => {
  it("null provider is unavailable and returns a valid, empty analysis", async () => {
    const p = new NullAIProvider();
    expect(p.available).toBe(false);
    const out = await p.analyze();
    expect(aiAnalysisSchema.safeParse(out).success).toBe(true);
    expect(out.risks).toEqual([]);
  });

  it("analysis schema rejects numeric authority fields (AI never does math)", () => {
    // A well-formed analysis has only prose/risk fields — never a bid or price.
    const parsed = aiAnalysisSchema.parse({ summary: "ok" });
    expect(parsed).not.toHaveProperty("maximumSafeBid");
    expect(parsed).not.toHaveProperty("value");
  });

  it("schema coerces a minimal object and applies the disclaimer default", () => {
    const parsed = aiAnalysisSchema.parse({ summary: "hello" });
    expect(parsed.disclaimer.length).toBeGreaterThan(0);
    expect(parsed.missingInformation).toEqual([]);
  });
});
