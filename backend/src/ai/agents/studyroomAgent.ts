import type { AiMessage } from "../types/chat.js";

export function buildStudyRoomSystemPrompt(): AiMessage {
  return {
    role: "system",
    content:
      "You are CleverFox, a calm study-room assistant. Keep answers short, practical, and focused on productivity.",
  };
}
