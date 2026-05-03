import type {
  LlmProvider,
  ProviderChatInput,
  ProviderChatOutput,
} from "./provider.js";

export class OpenAiProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly defaultModel?: string,
  ) {}

  private mapMessages(messages: any[]) {
    return messages.map((m) => {
       const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
       const parts: any[] = [];
       if (m.content) {
         parts.push({ type: "text", text: m.content });
       }
       if (m.attachments && m.attachments.length > 0) {
         for (const att of m.attachments) {
           if (att.type && att.type.startsWith("image/")) {
             // Only send actual images as image_url
             parts.push({
               type: "image_url",
               image_url: { url: att.data }
             });
           } else {
             // For PDFs, docs, text files etc — decode base64 and inject as text
             try {
               const b64 = att.data.includes(",") ? att.data.split(",")[1] : att.data;
               const decoded = Buffer.from(b64, "base64").toString("utf-8");
               // Filter out binary garbage — if mostly readable, include it
               const readable = decoded.replace(/[^\x20-\x7E\n\r\t]/g, "");
               if (readable.length > 50) {
                 parts.push({
                   type: "text",
                   text: `--- Attached file: ${att.name || "document"} ---\n${readable.slice(0, 20000)}\n--- End of file ---`
                 });
               } else {
                 parts.push({
                   type: "text",
                   text: `[Attached file: ${att.name || "document"} (${att.type}) — binary content, cannot extract text]`
                 });
               }
             } catch {
               parts.push({
                 type: "text",
                 text: `[Attached file: ${att.name || "document"} — could not process]`
               });
             }
           }
         }
       }
       return { role, content: parts.length > 0 ? parts : m.content };
    });
  }

  async chat(input: ProviderChatInput): Promise<ProviderChatOutput> {
    const model = input.model ?? this.defaultModel ?? "gpt-4o-mini";

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: this.mapMessages(input.messages),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI error ${res.status}: ${text || res.statusText}`);
    }

    const data = (await res.json()) as any;
    const outputText: string = data?.choices?.[0]?.message?.content ?? "";

    return {
      outputText: outputText || "(empty response)",
      provider: "openai",
      model,
    };
  }

  async streamChat(
    input: ProviderChatInput,
    onChunk: (text: string) => void
  ): Promise<ProviderChatOutput> {
    const model = input.model ?? this.defaultModel ?? "gpt-4o-mini";

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: this.mapMessages(input.messages),
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI streaming error ${res.status}: ${text || res.statusText}`);
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
              // ignore parse errors for partial chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return { outputText: fullText, provider: "openai", model };
  }
}
