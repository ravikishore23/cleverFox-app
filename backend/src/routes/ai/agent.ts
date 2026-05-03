import express from "express";
import { agent } from "../../ai/localAgent.js";
import { env } from "../../config/env.js";

export const agentRouter = express.Router();

// Simple validation for a proposed action plan.
agentRouter.post("/ai/agent/propose", async (req, res) => {
  if (!env.localAgentEnabled) return res.status(403).json({ error: "Local agent disabled" });
  const { actions } = req.body;
  if (!Array.isArray(actions)) return res.status(400).json({ error: "Invalid actions" });
  // Minimal validation: check known action kinds
  const allowedKinds = new Set(["write", "run", "read", "list"]);
  for (const a of actions) {
    if (!a || !a.kind || !allowedKinds.has(a.kind))
      return res.status(400).json({ error: "Unsupported action kind" });
  }
  // Echo back a normalized proposal the frontend can display.
  return res.json({ ok: true, proposal: { actions } });
});

// Kick off execution. Returns an execution id and begins producing events.
agentRouter.post("/ai/agent/execute", async (req, res) => {
  if (!env.localAgentEnabled) return res.status(403).json({ error: "Local agent disabled" });
  const { actions, timeoutMs } = req.body;
  if (!Array.isArray(actions)) return res.status(400).json({ error: "Invalid actions" });

  // Execute actions sequentially. For run commands we create an emitter and return id.
  let streamId: string | null = null;

  (async () => {
    try {
      for (const a of actions) {
        if (a.kind === "write") {
          await agent.writeFile(a.path, a.content ?? "");
        } else if (a.kind === "read") {
          // we don't send back contents here; clients should stream via SSE
          // but emit a small notice to any stream
        } else if (a.kind === "list") {
          // noop server-side for now
        } else if (a.kind === "run") {
          // run the command and attach to stream
          const cmd = a.command;
          const args = Array.isArray(a.args) ? a.args : [];
          const r = agent.runCommand(cmd, args, { timeoutMs: Number(timeoutMs) || undefined });
          streamId = r.id;
          // keep the emitter alive by reading events here and re-emitting to the stored emitter
          r.emitter.on("stdout", (chunk) => {});
          r.emitter.on("stderr", (chunk) => {});
          r.emitter.on("exit", () => {});
          // wait for process to finish before continuing to next action
          await new Promise((resolve) => r.emitter.once("exit", resolve));
        }
      }
    } catch (err) {
      // best-effort: nothing to do here for background tasks
    }
  })();

  return res.json({ ok: true, id: streamId });
});

// SSE endpoint to stream events for a running execution id
agentRouter.get("/ai/agent/stream/:id", (req, res) => {
  if (!env.localAgentEnabled) return res.status(403).json({ error: "Local agent disabled" });
  const id = req.params.id;
  if (!id) return res.status(400).end();
  const emitter = agent.getEmitter(id);
  if (!emitter) return res.status(404).json({ error: "Unknown id" });

  res.set({
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });
  res.flushHeaders?.();

  const send = (ev: string, data: any) => {
    res.write(`event: ${ev}\n`);
    res.write(`data: ${JSON.stringify({ data })}\n\n`);
  };

  const onStdout = (c: string) => send("stdout", c);
  const onStderr = (c: string) => send("stderr", c);
  const onExit = (info: any) => {
    send("exit", info);
    res.end();
  };

  emitter.on("stdout", onStdout);
  emitter.on("stderr", onStderr);
  emitter.on("exit", onExit);

  req.on("close", () => {
    emitter.off("stdout", onStdout);
    emitter.off("stderr", onStderr);
    emitter.off("exit", onExit);
  });
});
