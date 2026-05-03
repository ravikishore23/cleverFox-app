import express from "express";

export const routeRouter = express.Router();

function looksLikeJsonActions(text: string) {
  if (!text) return null;
  const start = text.indexOf("{", text.search(/[^{]*$/));
  // naive attempt: find first { and last }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const sub = text.slice(first, last + 1);
  try {
    const parsed = JSON.parse(sub);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.actions)) return parsed;
  } catch {
    return null;
  }
  return null;
}

function classifyIntent(text: string) {
  if (!text) return { route: "chat", reason: "empty" };
  const lower = text.toLowerCase();

  // If assistant already returned explicit actions JSON, prefer agent
  const parsed = looksLikeJsonActions(text);
  if (parsed) return { route: "agent", reason: "contains_actions_json", proposal: parsed };

  // Heuristic keywords that imply PC tasks
  const pcKeywords = [
    "open ",
    "run ",
    "execute ",
    "create file",
    "write file",
    "save file",
    "create folder",
    "open notepad",
    "open vscode",
    "install ",
    "launch ",
    "start ",
    "shell",
    "terminal",
  ];

  for (const k of pcKeywords) {
    if (lower.includes(k)) return { route: "agent", reason: `keyword:${k}` };
  }

  return { route: "chat", reason: "no_match" };
}

// POST /ai/route
// Body: { text: string }
routeRouter.post("/ai/route", express.json(), (req, res) => {
  const { text } = req.body ?? {};
  const out = classifyIntent(typeof text === "string" ? text : String(text ?? ""));
  return res.json({ ok: true, ...out });
});
