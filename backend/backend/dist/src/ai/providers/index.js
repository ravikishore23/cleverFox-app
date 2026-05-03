import { MockProvider } from "./mock.js";
import { OpenAiProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { OllamaProvider } from "./ollama.js";
export function makeProvider(env) {
    const provider = (env.AI_PROVIDER ?? "gemini").toLowerCase();
    if (provider === "ollama") {
        const baseUrl = env.OLLAMA_BASE_URL ?? "http://localhost:11434";
        const apiKey = env.OLLAMA_API_KEY; // optional for local, required for hosted
        const model = env.OLLAMA_MODEL; // e.g. llama3.2:1b
        return new OllamaProvider(baseUrl, apiKey, model);
    }
    if (provider === "gemini") {
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey)
            throw new Error("Missing GEMINI_API_KEY");
        return new GeminiProvider(apiKey);
    }
    if (provider === "openai") {
        const apiKey = env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error("Missing OPENAI_API_KEY");
        const baseUrl = env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        const defaultModel = env.OPENAI_MODEL;
        return new OpenAiProvider(apiKey, baseUrl, defaultModel);
    }
    return new MockProvider();
}
