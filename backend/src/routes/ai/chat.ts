import { Router } from "express";
import { makeProvider } from "../../ai/providers/index.js";
import type { ChatRequest, ChatResponse } from "../../ai/types/chat.js";
import { buildStudyRoomSystemPrompt } from "../../ai/agents/studyroomAgent.js";

export const aiRouter = Router();

aiRouter.post("/ai/chat", async (req, res, next) => {
  try {
    const body = req.body as ChatRequest;

    if (
      !body.messages ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      res.status(400).json({ ok: false, error: "messages array is required" });
      return;
    }

    const provider = makeProvider(process.env);

    const messages = [buildStudyRoomSystemPrompt(), ...(body.messages ?? [])];
    const out = await provider.chat({ messages, model: body.model });

    const response: ChatResponse = {
      ok: true,
      output: out.outputText,
      provider: out.provider,
      model: out.model,
    };

    res.json(response);
  } catch (err) {
    // Return a structured error instead of passing to generic handler
    // so the frontend always gets JSON
    const message = err instanceof Error ? err.message : "Unknown error";
    const isRateLimit =
      message.includes("429") || message.includes("rate limit");
    res.status(isRateLimit ? 429 : 500).json({
      ok: false,
      error: isRateLimit
        ? "AI rate limit reached. Please wait a moment and try again."
        : message,
    });
  }
});
