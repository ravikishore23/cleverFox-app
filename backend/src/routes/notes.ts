import { Router, type RequestHandler } from "express";
import { connectMongo } from "../db/mongo.js";
import { NoteModel } from "../models/Note.js";

export const notesRouter = Router();

const asyncRoute =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((t) => String(t ?? "").trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  const s = String(input ?? "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function toNoteDto(doc: any) {
  return {
    id: String(doc._id),
    title: doc.title,
    category: doc.category ?? "",
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    content: doc.content,
    pinned: Boolean(doc.pinned),
    favorite: Boolean(doc.favorite),
    wordCount: Number(doc.wordCount ?? 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

notesRouter.get(
  "/notes",
  asyncRoute(async (req, res) => {
    await connectMongo();

    const search = String(req.query.search ?? "").trim();
    const category = String(req.query.category ?? "").trim();
    const tag = String(req.query.tag ?? "").trim();
    const pinned = String(req.query.pinned ?? "").trim();
    const favorite = String(req.query.favorite ?? "").trim();
    const sort = String(req.query.sort ?? "updatedAt").trim();

    const limitRaw = Number(req.query.limit ?? 200);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(200, Math.round(limitRaw)))
      : 200;

    const filter: any = {};
    if (category && category.toLowerCase() !== "all")
      filter.category = category;
    if (tag) filter.tags = tag;
    if (pinned === "true") filter.pinned = true;
    if (favorite === "true") filter.favorite = true;

    if (search) {
      const re = new RegExp(escapeRegExp(search), "i");
      filter.$or = [
        { title: re },
        { content: re },
        { category: re },
        { tags: re },
      ];
    }

    const sortSpec: any =
      sort === "createdAt" ? { createdAt: -1 } : { updatedAt: -1 };
    const notes = await NoteModel.find(filter)
      .sort(sortSpec)
      .limit(limit)
      .exec();

    res.json({ ok: true, notes: notes.map(toNoteDto) });
  }),
);

notesRouter.get(
  "/notes/stats",
  asyncRoute(async (_req, res) => {
    await connectMongo();

    const notes = await NoteModel.find().exec();
    const total = notes.length;
    const pinned = notes.filter((n) => n.pinned).length;
    const favorites = notes.filter((n) => n.favorite).length;
    const categories = new Set(
      notes.map((n) => String(n.category ?? "").trim()).filter(Boolean),
    ).size;
    const words = notes.reduce((sum, n) => sum + Number(n.wordCount ?? 0), 0);

    res.json({
      ok: true,
      stats: { total, pinned, favorites, categories, words },
    });
  }),
);

notesRouter.post(
  "/notes",
  asyncRoute(async (req, res) => {
    await connectMongo();

    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim();
    const category = String(req.body?.category ?? "").trim();
    const tags = parseTags(req.body?.tags);
    const pinned = Boolean(req.body?.pinned);
    const favorite = Boolean(req.body?.favorite);

    if (!title)
      return res.status(400).json({ ok: false, error: "Missing title" });
    if (!content)
      return res.status(400).json({ ok: false, error: "Missing content" });

    const created = await NoteModel.create({
      title,
      content,
      category: category || undefined,
      tags,
      pinned,
      favorite,
    });

    res.status(201).json({ ok: true, note: toNoteDto(created) });
  }),
);

notesRouter.patch(
  "/notes/:id",
  asyncRoute(async (req, res) => {
    await connectMongo();

    const id = String(req.params.id);
    const note = await NoteModel.findById(id).exec();
    if (!note) return res.status(404).json({ ok: false, error: "Not found" });

    if (req.body?.title !== undefined) {
      const title = String(req.body?.title ?? "").trim();
      if (!title)
        return res.status(400).json({ ok: false, error: "Invalid title" });
      note.title = title;
    }

    if (req.body?.content !== undefined) {
      const content = String(req.body?.content ?? "").trim();
      if (!content)
        return res.status(400).json({ ok: false, error: "Invalid content" });
      note.content = content;
    }

    if (req.body?.category !== undefined) {
      const category = String(req.body?.category ?? "").trim();
      // Allow clearing.
      note.category = category || undefined;
    }

    if (req.body?.tags !== undefined) {
      note.tags = parseTags(req.body?.tags);
    }

    if (req.body?.pinned !== undefined) {
      note.pinned = Boolean(req.body?.pinned);
    }

    if (req.body?.favorite !== undefined) {
      note.favorite = Boolean(req.body?.favorite);
    }

    await note.save();
    res.json({ ok: true, note: toNoteDto(note) });
  }),
);

notesRouter.delete(
  "/notes/:id",
  asyncRoute(async (req, res) => {
    await connectMongo();

    const id = String(req.params.id);
    const deleted = await NoteModel.findByIdAndDelete(id).exec();
    if (!deleted)
      return res.status(404).json({ ok: false, error: "Not found" });

    res.json({ ok: true });
  }),
);
