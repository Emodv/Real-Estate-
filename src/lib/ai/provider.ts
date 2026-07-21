import { z } from "zod";

/**
 * AI provider abstraction.
 *
 * HARD RULE: AI never performs arithmetic and never determines the verdict.
 * The deterministic engine owns every number. AI is limited to interpreting
 * evidence, summarizing, surfacing risks, and flagging missing information —
 * and its output is ALWAYS validated by Zod before use.
 */
export type AITask =
  | "risk_analysis"
  | "evidence_summary"
  | "swot_narrative"
  | "missing_information"
  | "investment_thesis";

export type AIProviderName = "anthropic" | "gemini" | "openai" | "null";

/** The only shape AI is allowed to return. Note: no numeric outputs. */
export const aiAnalysisSchema = z.object({
  summary: z.string(),
  risks: z
    .array(
      z.object({
        label: z.string(),
        severity: z.enum(["FATAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
        rationale: z.string(),
      }),
    )
    .default([]),
  missingInformation: z.array(z.string()).default([]),
  disclaimer: z.string().default("AI-generated interpretation. Not financial advice. Verify independently."),
});

export type AIAnalysis = z.infer<typeof aiAnalysisSchema>;

export interface AIAnalyzeParams {
  task: AITask;
  /** Structured, non-secret context (property facts + engine results). */
  context: unknown;
  /** Free-text instruction appended to the task-specific system prompt. */
  instruction?: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  readonly available: boolean;
  analyze(params: AIAnalyzeParams): Promise<AIAnalysis>;
}

/** The provider used when no API keys are configured — fully functional app. */
export class NullAIProvider implements AIProvider {
  readonly name = "null" as const;
  readonly available = false;
  async analyze(): Promise<AIAnalysis> {
    return aiAnalysisSchema.parse({
      summary: "AI analysis is disabled (no provider configured). The deterministic underwriting is unaffected.",
      risks: [],
      missingInformation: [],
    });
  }
}
