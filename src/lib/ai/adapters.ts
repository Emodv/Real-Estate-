import "server-only";
import {
  aiAnalysisSchema,
  type AIAnalysis,
  type AIAnalyzeParams,
  type AIProvider,
  type AIProviderName,
} from "./provider";

/**
 * Fetch-based adapters (no SDK dependencies). Each is server-only and reads its
 * key from the environment. All of them force the model to return ONLY the
 * `aiAnalysisSchema` JSON — which contains no numeric fields — and the result
 * is Zod-validated. If the model returns anything else, we fail closed to a
 * safe empty analysis rather than trusting free-form output.
 */
const SYSTEM = [
  "You are a conservative real-estate risk analyst for a private BRRRR investor.",
  "You do NOT compute prices, returns, or bids — those are calculated deterministically elsewhere.",
  "Interpret the provided evidence, surface risks, and flag missing information.",
  "Respond with ONLY a JSON object matching:",
  '{"summary":string,"risks":[{"label":string,"severity":"FATAL|HIGH|MEDIUM|LOW|UNKNOWN","rationale":string}],"missingInformation":string[],"disclaimer":string}',
  "Never invent facts. If something is unknown, say so.",
].join(" ");

function userPrompt(params: AIAnalyzeParams): string {
  return [
    `TASK: ${params.task}`,
    params.instruction ? `INSTRUCTION: ${params.instruction}` : "",
    "CONTEXT (JSON):",
    JSON.stringify(params.context ?? {}, null, 2).slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n");
}

function safeParse(raw: string): AIAnalysis {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const json = JSON.parse(match ? match[0] : raw);
    return aiAnalysisSchema.parse(json);
  } catch {
    return aiAnalysisSchema.parse({
      summary: "AI returned an unparseable response; ignored. Deterministic underwriting is unaffected.",
    });
  }
}

class AnthropicAdapter implements AIProvider {
  readonly name: AIProviderName = "anthropic";
  constructor(private readonly key: string, private readonly model = "claude-sonnet-5") {}
  get available() {
    return !!this.key;
  }
  async analyze(params: AIAnalyzeParams): Promise<AIAnalysis> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt(params) }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return safeParse("");
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return safeParse(data.content?.map((c) => c.text ?? "").join("") ?? "");
  }
}

class OpenAIAdapter implements AIProvider {
  readonly name: AIProviderName = "openai";
  constructor(private readonly key: string, private readonly model = "gpt-4o-mini") {}
  get available() {
    return !!this.key;
  }
  async analyze(params: AIAnalyzeParams): Promise<AIAnalysis> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.key}` },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt(params) },
        ],
      }),
      cache: "no-store",
    });
    if (!res.ok) return safeParse("");
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return safeParse(data.choices?.[0]?.message?.content ?? "");
  }
}

class GeminiAdapter implements AIProvider {
  readonly name: AIProviderName = "gemini";
  constructor(private readonly key: string, private readonly model = "gemini-1.5-flash") {}
  get available() {
    return !!this.key;
  }
  async analyze(params: AIAnalyzeParams): Promise<AIAnalysis> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: userPrompt(params) }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      cache: "no-store",
    });
    if (!res.ok) return safeParse("");
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return safeParse(data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "");
  }
}

export function buildAdapter(name: AIProviderName): AIProvider | null {
  switch (name) {
    case "anthropic": {
      const k = process.env.ANTHROPIC_API_KEY;
      return k ? new AnthropicAdapter(k) : null;
    }
    case "openai": {
      const k = process.env.OPENAI_API_KEY;
      return k ? new OpenAIAdapter(k) : null;
    }
    case "gemini": {
      const k = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      return k ? new GeminiAdapter(k) : null;
    }
    default:
      return null;
  }
}
