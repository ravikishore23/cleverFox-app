import type { AiMessage } from "../types/chat.js";

export type ProviderChatInput = {
  messages: AiMessage[];
  model?: string;
};

export type ProviderChatOutput = {
  outputText: string;
  provider: string;
  model?: string;
};

export interface LlmProvider {
  chat(input: ProviderChatInput): Promise<ProviderChatOutput>;
  streamChat?(
    input: ProviderChatInput,
    onChunk: (text: string) => void
  ): Promise<ProviderChatOutput>;
}
