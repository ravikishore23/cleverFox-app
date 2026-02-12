import type {
  LlmProvider,
  ProviderChatInput,
  ProviderChatOutput,
} from "./provider.js";

export class OpenAiProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async chat(input: ProviderChatInput): Promise<ProviderChatOutput> {
    // Uses the Responses API if available in your account; fallback behavior is handled by caller.
    const model = input.model ?? "gpt-4o-mini";

    const res = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: input.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI error ${res.status}: ${text || res.statusText}`);
    }

    const data = (await res.json()) as any;
    const outputText: string =
      data?.output_text ?? data?.output?.[0]?.content?.[0]?.text ?? "";

    return {
      outputText: outputText || "(empty response)",
      provider: "openai",
      model,
    };
  }
}
