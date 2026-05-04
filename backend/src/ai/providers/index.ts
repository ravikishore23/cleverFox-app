import type { LlmProvider } from "./provider.js";
import { OllamaProvider } from "./ollama.js";

/**
 * Maps a friendly model key (sent from the frontend) to the actual
 * Ollama model id defined in the environment.
 */
function resolveOllamaModel(modelKey: string | undefined): string {
  const env = process.env;
  // Map friendly names → env-defined model ids
  const map: Record<string, string> = {
    qwen: env.OLLAMA_MODEL_QWEN ?? "qwen3.5:397b-cloud",
    gpt: env.OLLAMA_MODEL_GPT ?? "gpt-oss:120b-cloud",
    deepseek: env.OLLAMA_MODEL_DEEPSEEK ?? "deepseek-v3.1:671b-cloud",
  };

  if (modelKey && map[modelKey.toLowerCase()]) {
    return map[modelKey.toLowerCase()];
  }

  // Fall back to exact value (already a full model id) or the env default
  return modelKey || env.OLLAMA_MODEL || "deepseek-v3.1:671b-cloud";
}

export function makeProvider(env: NodeJS.ProcessEnv): LlmProvider {
  const baseUrl = env.OLLAMA_BASE_URL ?? "https://ollama.com/v1";
  const apiKey = env.OLLAMA_API_KEY;
  // Default model from env; the route may override per-request via body.model
  const defaultModel = resolveOllamaModel(env.OLLAMA_MODEL);

  return new OllamaProvider(baseUrl, apiKey, defaultModel);
}

/**
 * Convenience helper: resolve a per-request model key to its Ollama model id.
 * Call this in routes where `body.model` may be a friendly name.
 */
export function resolveModel(modelKey: string | undefined): string {
  return resolveOllamaModel(modelKey);
}
