import type { LlmProvider } from "./provider.js";
import { MockProvider } from "./mock.js";
import { OpenAiProvider } from "./openai.js";

export function makeProvider(env: NodeJS.ProcessEnv): LlmProvider {
  const provider = (env.AI_PROVIDER ?? "mock").toLowerCase();

  if (provider === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    return new OpenAiProvider(apiKey);
  }

  return new MockProvider();
}
