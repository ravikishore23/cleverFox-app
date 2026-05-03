export class GeminiProvider {
    apiKey;
    static MAX_RETRIES = 3;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    buildPayload(input) {
        const systemParts = input.messages
            .filter((m) => m.role === "system")
            .map((m) => ({ text: m.content }));
        const contents = input.messages
            .filter((m) => m.role !== "system")
            .map((m) => {
            const parts = [];
            if (m.content) {
                parts.push({ text: m.content });
            }
            if (m.attachments && m.attachments.length > 0) {
                for (const att of m.attachments) {
                    // Check if it's base64 or a data URI
                    const b64 = att.data.includes(",") ? att.data.split(",")[1] : att.data;
                    parts.push({
                        inlineData: { mimeType: att.type, data: b64 }
                    });
                }
            }
            return {
                role: m.role === "assistant" ? "model" : "user",
                parts,
            };
        });
        const body = { contents };
        if (systemParts.length > 0) {
            body.systemInstruction = { parts: systemParts };
        }
        return JSON.stringify(body);
    }
    async chat(input) {
        const model = input.model ?? "gemini-2.0-flash";
        const payload = this.buildPayload(input);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        let lastError = null;
        for (let attempt = 0; attempt < GeminiProvider.MAX_RETRIES; attempt++) {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
            });
            if (res.status === 429 || res.status === 503) {
                const waitMs = Math.min(2000 * 2 ** attempt, 15000);
                await new Promise((r) => setTimeout(r, waitMs));
                lastError = new Error(`Gemini rate limited (${res.status})`);
                continue;
            }
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`Gemini error ${res.status}: ${text || res.statusText}`);
            }
            const data = (await res.json());
            const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(empty response)";
            return { outputText, provider: "gemini", model };
        }
        throw lastError ?? new Error("Gemini: max retries exceeded");
    }
    async streamChat(input, onChunk) {
        const model = input.model ?? "gemini-2.0-flash";
        const payload = this.buildPayload(input);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Gemini streaming error ${res.status}: ${text || res.statusText}`);
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
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith("data: ") && trimmedLine !== "data: [DONE]") {
                        const dataStr = trimmedLine.slice(6).trim();
                        if (dataStr === "null" || !dataStr)
                            continue;
                        try {
                            const data = JSON.parse(dataStr);
                            const textChunk = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (textChunk) {
                                fullText += textChunk;
                                onChunk(textChunk);
                            }
                        }
                        catch (e) {
                            // ignore parse errors for partial chunks; in actual implementation SSE might span across chunks
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        return { outputText: fullText, provider: "gemini", model };
    }
}
