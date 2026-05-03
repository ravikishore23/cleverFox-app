import type {
  LlmProvider,
  ProviderChatInput,
  ProviderChatOutput,
} from "./provider.js";

/**
 * Ollama provider – works with local Ollama or any OpenAI-compatible endpoint.
 *
 * Uses the `/v1/chat/completions` endpoint (OpenAI-compatible API that Ollama
 * exposes), so it also works with hosted Ollama services, LM Studio,
 * OpenRouter, and similar providers.
 */
export class OllamaProvider implements LlmProvider {
  private static readonly MAX_RETRIES = 2;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly defaultModel?: string,
  ) {}

  async chat(input: ProviderChatInput): Promise<ProviderChatOutput> {
    const model = input.model ?? this.defaultModel ?? "llama3.2:1b";

    const messages = input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Handle base URLs that already include /v1 (e.g. https://ollama.com/v1)
    const cleanBase = this.baseUrl.replace(/\/+$/, "");
    const url = cleanBase.endsWith("/v1")
      ? `${cleanBase}/chat/completions`
      : `${cleanBase}/v1/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const payload = JSON.stringify({ model, messages, stream: false });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < OllamaProvider.MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: payload,
        });

        if (res.status === 429 || res.status === 503) {
          const waitMs = Math.min(2000 * 2 ** attempt, 10000);
          console.warn(
            `Ollama ${res.status} – retrying in ${waitMs}ms (attempt ${attempt + 1}/${OllamaProvider.MAX_RETRIES})`,
          );
          await new Promise((r) => setTimeout(r, waitMs));
          lastError = new Error(`Ollama rate limited (${res.status})`);
          continue;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Ollama error ${res.status}: ${text || res.statusText}`,
          );
        }

        const data = (await res.json()) as any;
        const outputText: string =
          data?.choices?.[0]?.message?.content ?? "(empty response)";

        return {
          outputText,
          provider: "ollama",
          model: data?.model ?? model,
        };
      } catch (err: unknown) {
        const e = err as Error;
        // Network-level errors (Ollama server not running, etc.)
        if (
          e.message?.includes("ECONNREFUSED") ||
          e.message?.includes("fetch failed")
        ) {
          throw new Error(
            `Cannot connect to Ollama at ${this.baseUrl}. Is the server running?`,
          );
        }
        lastError = e;
      }
    }

    throw lastError ?? new Error("Ollama: max retries exceeded");
  }

  async streamChat(
    input: ProviderChatInput,
    onChunk: (text: string) => void
  ): Promise<ProviderChatOutput> {
    const model = input.model ?? this.defaultModel ?? "llama3.2:1b";

    const messages = input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const cleanBase = this.baseUrl.replace(/\/+$/, "");
    const url = cleanBase.endsWith("/v1")
      ? `${cleanBase}/chat/completions`
      : `${cleanBase}/v1/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const payload = JSON.stringify({ model, messages, stream: true });

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: payload,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama streaming error ${res.status}: ${text || res.statusText}`);
    }
    if (!res.body) {
      throw new Error("No response body in stream");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("data: ") && trimmedLine !== "data: [DONE]") {
            const dataStr = trimmedLine.slice(6).trim();
            if (dataStr === "null" || !dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              const textChunk = data?.choices?.[0]?.delta?.content;
              if (textChunk) {
                fullText += textChunk;
                onChunk(textChunk);
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return { outputText: fullText, provider: "ollama", model };
  }
}
