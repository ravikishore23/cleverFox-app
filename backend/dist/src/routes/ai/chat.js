import { Router } from "express";
import { makeProvider } from "../../ai/providers/index.js";
import { buildStudyRoomSystemPrompt } from "../../ai/agents/studyroomAgent.js";
export const aiRouter = Router();
aiRouter.post("/ai/chat", async (req, res, next) => {
    try {
        const body = req.body;
        const provider = makeProvider(process.env);
        const messages = [buildStudyRoomSystemPrompt(), ...(body.messages ?? [])];
        const out = await provider.chat({ messages, model: body.model });
        const response = {
            ok: true,
            output: out.outputText,
            provider: out.provider,
            model: out.model,
        };
        res.json(response);
    }
    catch (err) {
        next(err);
    }
});
