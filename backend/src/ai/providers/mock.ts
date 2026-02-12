import type {
  LlmProvider,
  ProviderChatInput,
  ProviderChatOutput,
} from "./provider.js";

export class MockProvider implements LlmProvider {
  async chat(input: ProviderChatInput): Promise<ProviderChatOutput> {
    const lastUser = [...input.messages]
      .reverse()
      .find((m) => m.role === "user");
    return {
      outputText: `Mock reply: ${lastUser?.content ?? "(no user message)"}`,
      provider: "mock",
      model: input.model,
    };
  }
}
