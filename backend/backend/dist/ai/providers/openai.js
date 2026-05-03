export class OpenAiProvider {
    apiKey;
    baseUrl;
    constructor(apiKey, baseUrl = "https://api.openai.com/v1") {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    async chat(input) {
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
        const data = (await res.json());
        const outputText = data?.output_text ?? data?.output?.[0]?.content?.[0]?.text ?? "";
        return {
            outputText: outputText || "(empty response)",
            provider: "openai",
            model,
        };
    }
}
