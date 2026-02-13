import type {
  LlmProvider,
  ProviderChatInput,
  ProviderChatOutput,
} from "./provider.js";

export class GeminiProvider implements LlmProvider {
  private static readonly MAX_RETRIES = 3;

  constructor(private readonly apiKey: string) {}

  async chat(input: ProviderChatInput): Promise<ProviderChatOutput> {
    const model = input.model ?? "gemini-2.0-flash";

    // Gemini expects a "contents" array. System messages go via systemInstruction.
    const systemParts = input.messages
      .filter((m) => m.role === "system")
      .map((m) => ({ text: m.content }));

    const contents = input.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = { contents };
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: systemParts };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const payload = JSON.stringify(body);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < GeminiProvider.MAX_RETRIES; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });

      // Retry on 429 (rate limit) or 503 (overloaded)
      if (res.status === 429 || res.status === 503) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(2000 * 2 ** attempt, 15000); // exponential backoff, max 15s
        console.warn(
          `Gemini ${res.status} – retrying in ${waitMs}ms (attempt ${attempt + 1}/${GeminiProvider.MAX_RETRIES})`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        lastError = new Error(`Gemini rate limited (${res.status})`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Gemini error ${res.status}: ${text || res.statusText}`,
        );
      }

      const data = (await res.json()) as any;
      const outputText: string =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty response)";

      return {
        outputText,
        provider: "gemini",
        model,
      };
    }

    throw lastError ?? new Error("Gemini: max retries exceeded");
  }
}
