import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { makeProvider } from "../../ai/providers/index.js";
import { buildStudyRoomSystemPrompt } from "../../ai/agents/studyroomAgent.js";
import { Chat } from "../../models/Chat.js";
import { connectMongo, isMongoConnected } from "../../db/mongo.js";
import { proposeActions, executeActions } from "../../ai/agents/agentLoop.js";
import { env } from "../../config/env.js";
import { performWebSearch } from "../../utils/webSearch.js";
export const aiRouter = Router();
// GET /ai/download-file?path=... - Download generated files from agent actions
aiRouter.get("/ai/download-file", async (req, res) => {
    try {
        const rawPath = String(req.query.path || "").trim();
        if (!rawPath) {
            return res
                .status(400)
                .json({ ok: false, error: "path query parameter is required" });
        }
        const resolved = path.resolve(rawPath);
        const stat = await fs.stat(resolved);
        if (!stat.isFile()) {
            return res
                .status(400)
                .json({ ok: false, error: "Requested path is not a file" });
        }
        return res.download(resolved);
    }
    catch {
        return res.status(404).json({ ok: false, error: "File not found" });
    }
});
// GET /ai/chats - List all chats (summary)
aiRouter.get("/ai/chats", async (req, res) => {
    await connectMongo();
    if (!isMongoConnected()) {
        return res.json({ ok: true, chats: [] });
    }
    try {
        const chats = await Chat.find()
            .sort({ updatedAt: -1 })
            .select("title updatedAt")
            .lean();
        res.json({ ok: true, chats });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: "Failed to fetch chats" });
    }
});
// GET /ai/chats/:id - Get full chat history
aiRouter.get("/ai/chats/:id", async (req, res) => {
    await connectMongo();
    if (!isMongoConnected()) {
        return res
            .status(404)
            .json({ ok: false, error: "Chat not found (DB offline)" });
    }
    try {
        const chat = await Chat.findById(req.params.id);
        if (!chat) {
            return res.status(404).json({ ok: false, error: "Chat not found" });
        }
        res.json({ ok: true, chat });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: "Failed to fetch chat" });
    }
});
// DELETE /ai/chats/:id - Delete a chat
aiRouter.delete("/ai/chats/:id", async (req, res) => {
    await connectMongo();
    if (!isMongoConnected()) {
        return res.json({ ok: true });
    }
    try {
        await Chat.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: "Failed to delete chat" });
    }
});
aiRouter.post("/ai/chat", async (req, res, next) => {
    try {
        const body = req.body;
        if (!body.messages ||
            !Array.isArray(body.messages) ||
            body.messages.length === 0) {
            res.status(400).json({ ok: false, error: "messages array is required" });
            return;
        }
        // 1. Generate AI response (always works, even without MongoDB)
        const provider = makeProvider(process.env);
        // Check if web search is requested or automatically needed
        let searchContext = "";
        const lastUserMsg = [...body.messages]
            .reverse()
            .find((m) => m.role === "user");
        let isWebSearchNeeded = body.webSearchEnabled || false;
        if (!isWebSearchNeeded && lastUserMsg) {
            const content = lastUserMsg.content.toLowerCase();
            const triggers = [
                "today",
                "news",
                "recent",
                "latest",
                "current",
                "search for",
                "look up",
                "who won",
                "what is the weather",
                "2024",
                "2025",
                "2026",
                "now",
                "update",
                "price",
                "happen",
            ];
            isWebSearchNeeded = triggers.some((trigger) => content.includes(trigger));
        }
        if (isWebSearchNeeded) {
            if (lastUserMsg) {
                try {
                    const results = await performWebSearch(lastUserMsg.content);
                    if (results.length > 0) {
                        searchContext =
                            `\n\nREAL-TIME WEB SEARCH RESULTS for "${lastUserMsg.content}":\n` +
                                results
                                    .map((r) => `Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`)
                                    .join("\n\n") +
                                `\n\nSince your internal knowledge ends in 2024, use these search results to provide the best, most up-to-date answer about current events. Address the user's query thoughtfully. Cite URLs inline if useful.`;
                    }
                }
                catch (e) {
                    console.error("Web search failed silently", e);
                }
            }
        }
        // Sanitize messages for provider
        const providerMessages = [
            ...[
                typeof buildStudyRoomSystemPrompt() === "string"
                    ? {
                        role: "system",
                        content: buildStudyRoomSystemPrompt() + searchContext,
                    }
                    : {
                        ...buildStudyRoomSystemPrompt(),
                        content: buildStudyRoomSystemPrompt().content +
                            searchContext,
                    },
            ],
            ...body.messages.map((m) => ({
                role: m.role,
                content: m.content,
                attachments: m.attachments,
            })),
        ];
        const isStream = req.query.stream === "true";
        if (isStream && provider.streamChat) {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders();
            try {
                const out = await provider.streamChat({ messages: providerMessages, model: body.model }, (chunk) => {
                    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
                });
                let chatId;
                if (isMongoConnected()) {
                    try {
                        let chatDoc;
                        if (body.chatId) {
                            chatDoc = await Chat.findById(body.chatId);
                        }
                        if (!chatDoc) {
                            const userMessageContent = body.messages[body.messages.length - 1].content;
                            chatDoc = new Chat({
                                title: userMessageContent.slice(0, 40) +
                                    (userMessageContent.length > 40 ? "..." : ""),
                                messages: [],
                            });
                        }
                        const lastUserMsg = body.messages[body.messages.length - 1];
                        if (lastUserMsg.role === "user") {
                            chatDoc.messages.push({
                                role: "user",
                                content: lastUserMsg.content,
                                timestamp: new Date(),
                            });
                        }
                        chatDoc.messages.push({
                            role: "assistant",
                            content: out.outputText,
                            timestamp: new Date(),
                        });
                        await chatDoc.save();
                        chatId = chatDoc._id.toString();
                    }
                    catch (dbErr) {
                        console.warn("⚠ Failed to persist stream chat to MongoDB:", dbErr);
                    }
                }
                res.write(`data: ${JSON.stringify({ done: true, chatId, provider: out.provider })}\n\n`);
                res.end();
            }
            catch (err) {
                const rawMessage = err instanceof Error ? err.message : "Unknown error";
                console.error("⚠ AI stream error:", rawMessage);
                const isRateLimit = rawMessage.includes("429") ||
                    rawMessage.toLowerCase().includes("rate limit") ||
                    rawMessage.toLowerCase().includes("quota");
                const cleanMessage = isRateLimit
                    ? "AI rate limit reached. Please wait a moment and try again."
                    : rawMessage;
                res.write(`data: ${JSON.stringify({ error: cleanMessage })}\n\n`);
                res.end();
            }
            return;
        }
        const out = await provider.chat({
            messages: providerMessages,
            model: body.model,
        });
        // 2. Persist to MongoDB only if connected
        let chatId;
        if (isMongoConnected()) {
            try {
                let chatDoc;
                if (body.chatId) {
                    chatDoc = await Chat.findById(body.chatId);
                }
                if (!chatDoc) {
                    const userMessageContent = body.messages[body.messages.length - 1].content;
                    chatDoc = new Chat({
                        title: userMessageContent.slice(0, 40) +
                            (userMessageContent.length > 40 ? "..." : ""),
                        messages: [],
                    });
                }
                // Append the latest user message
                const lastUserMsg = body.messages[body.messages.length - 1];
                if (lastUserMsg.role === "user") {
                    chatDoc.messages.push({
                        role: "user",
                        content: lastUserMsg.content,
                        timestamp: new Date(),
                    });
                }
                // Save AI response
                chatDoc.messages.push({
                    role: "assistant",
                    content: out.outputText,
                    timestamp: new Date(),
                });
                await chatDoc.save();
                chatId = chatDoc._id.toString();
            }
            catch (dbErr) {
                console.warn("⚠ Failed to persist chat to MongoDB:", dbErr);
                // Don't fail the request — AI response still goes through
            }
        }
        const response = {
            ok: true,
            output: out.outputText,
            provider: out.provider,
            model: out.model,
            ...(chatId ? { chatId } : {}),
        };
        res.json(response);
    }
    catch (err) {
        // Return a structured error instead of passing to generic handler
        // so the frontend always gets JSON
        const message = err instanceof Error ? err.message : "Unknown error";
        const isRateLimit = message.includes("429") || message.includes("rate limit");
        res.status(isRateLimit ? 429 : 500).json({
            ok: false,
            error: isRateLimit
                ? "AI rate limit reached. Please wait a moment and try again."
                : message,
        });
    }
});
// POST /ai/agent-chat — Phase 1: Propose actions (returns proposals for user approval)
aiRouter.post("/ai/agent-chat", async (req, res) => {
    try {
        const body = req.body;
        if (!body.messages ||
            !Array.isArray(body.messages) ||
            body.messages.length === 0) {
            res.status(400).json({ ok: false, error: "messages array is required" });
            return;
        }
        const vaultPath = env.obsidianVaultPath;
        const proposal = await proposeActions(body.messages, vaultPath, env.codeWorkspacePath);
        const safeAutoTools = new Set([
            "list_notes",
            "read_note",
            "list_tasks",
            "list_schedule_events",
            "browser_search",
            "read_file",
            "list_directory",
        ]);
        const autoActions = proposal.actions.filter((a) => safeAutoTools.has(a.tool));
        const pendingActions = proposal.actions.filter((a) => !safeAutoTools.has(a.tool));
        let outputText = proposal.response;
        if (autoActions.length > 0) {
            const autoResults = await executeActions(autoActions);
            const provider = makeProvider(process.env);
            const toolContext = autoResults
                .map((r) => `Tool: ${r.tool}\nSuccess: ${r.success ? "yes" : "no"}\nResult:\n${r.result}`)
                .join("\n\n---\n\n");
            const synthesis = await provider.chat({
                messages: [
                    {
                        role: "system",
                        content: "You are Fox AI with agent abilities. Use the tool results to answer naturally like a chatbot. " +
                            "For note lists, show clean headings/titles only and NEVER include database IDs or raw object IDs. " +
                            "If a note was opened, summarize key points and include the note title as a heading.",
                    },
                    ...body.messages,
                    {
                        role: "user",
                        content: `Tool results are below. Create the final assistant response for the user based on these results:\n\n${toolContext}` +
                            (pendingActions.length
                                ? "\n\nAlso mention briefly that additional permission is needed for the remaining actions."
                                : ""),
                    },
                ],
            });
            outputText = synthesis.outputText;
        }
        // Save agent-chat to history
        let chatId;
        if (isMongoConnected()) {
            try {
                let chatDoc;
                if (body.chatId) {
                    chatDoc = await Chat.findById(body.chatId);
                }
                if (!chatDoc) {
                    const userMessageContent = body.messages[body.messages.length - 1].content;
                    chatDoc = new Chat({
                        title: userMessageContent.slice(0, 40) +
                            (userMessageContent.length > 40 ? "..." : ""),
                        messages: [],
                    });
                }
                const lastUserMsg = body.messages[body.messages.length - 1];
                if (lastUserMsg.role === "user") {
                    chatDoc.messages.push({
                        role: "user",
                        content: lastUserMsg.content,
                        timestamp: new Date(),
                    });
                }
                chatDoc.messages.push({
                    role: "assistant",
                    content: outputText,
                    timestamp: new Date(),
                });
                await chatDoc.save();
                chatId = chatDoc._id.toString();
            }
            catch (dbErr) {
                console.warn("⚠ Failed to persist agent chat to MongoDB:", dbErr);
            }
        }
        res.json({
            ok: true,
            output: outputText,
            analysis: proposal.analysis,
            actions: pendingActions,
            provider: "agent",
            ...(chatId ? { chatId } : {}),
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ ok: false, error: message });
    }
});
// POST /ai/agent-execute — Phase 2: Execute user-approved actions
aiRouter.post("/ai/agent-execute", async (req, res) => {
    try {
        const { actions } = req.body;
        if (!Array.isArray(actions) || actions.length === 0) {
            res.status(400).json({ ok: false, error: "actions array is required" });
            return;
        }
        const results = await executeActions(actions);
        res.json({ ok: true, results });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.status(500).json({ ok: false, error: message });
    }
});
