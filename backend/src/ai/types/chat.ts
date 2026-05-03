export type AiRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
  attachments?: {
    type: string;
    data: string;
    name: string;
  }[];
};

export type ChatRequest = {
  messages: AiMessage[];
  model?: string;
};

export type ChatResponse = {
  ok: true;
  output: string;
  provider: string;
  model?: string;
};
