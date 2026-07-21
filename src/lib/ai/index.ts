import "server-only";
import { NullAIProvider, type AIProvider, type AIProviderName } from "./provider";
import { buildAdapter } from "./adapters";

export * from "./provider";

/**
 * Select the AI provider: `PRIMARY_AI_PROVIDER` first, then an ordered
 * fallback, then the null provider. The app is fully functional with no AI
 * configured — AI is strictly additive narrative on top of deterministic math.
 */
export function getAIProvider(): AIProvider {
  const primary = (process.env.PRIMARY_AI_PROVIDER as AIProviderName) ?? "anthropic";
  const order: AIProviderName[] = [primary, "anthropic", "gemini", "openai"].filter(
    (v, i, a) => a.indexOf(v) === i,
  ) as AIProviderName[];

  for (const name of order) {
    const adapter = buildAdapter(name);
    if (adapter && adapter.available) return adapter;
  }
  return new NullAIProvider();
}
