import { Router, type RequestHandler } from "express";
import { connectMongo } from "../db/mongo.js";
import { ScheduleEventModel } from "../models/ScheduleEvent.js";

export const scheduleRouter = Router();

const asyncRoute =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

function parseDateRequired(input: unknown, label: string): Date {
  const s = String(input ?? "").trim();
  if (!s) throw new Error(`Missing ${label}`);
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid ${label}`);
  return d;
}

function parseDateOptional(input: unknown): Date | undefined {
  if (input === undefined) return undefined;
  if (input === null) return undefined;
  const s = String(input ?? "").trim();
  if (!s) return undefined;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) throw new Error("Invalid date");
  return d;
}

function toDto(doc: any) {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description ?? "",
    location: doc.location ?? "",
    allDay: Boolean(doc.allDay),
    startAt: doc.startAt,
    endAt: doc.endAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

scheduleRouter.get(
  "/schedule",
  asyncRoute(async (req, res) => {
    await connectMongo();

    const fromRaw = req.query.from;
    const toRaw = req.query.to;

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    let from: Date;
    let to: Date;
    try {
      from = fromRaw ? parseDateRequired(fromRaw, "from") : defaultFrom;
      to = toRaw ? parseDateRequired(toRaw, "to") : defaultTo;
    } catch (e) {
      return res
        .status(400)
        .json({
          ok: false,
          error: e instanceof Error ? e.message : "Invalid range",
        });
    }

    const events = await ScheduleEventModel.find({
      startAt: { $lte: to },
      endAt: { $gte: from },
    })
      .sort({ startAt: 1 })
      .exec();

    res.json({ ok: true, events: events.map(toDto) });
  }),
);

scheduleRouter.post(
  "/schedule",
  asyncRoute(async (req, res) => {
    await connectMongo();

    const title = String(req.body?.title ?? "").trim();
    if (!title)
      return res.status(400).json({ ok: false, error: "Missing title" });

    const allDay = Boolean(req.body?.allDay);

    let startAt: Date;
    let endAt: Date;
    try {
      startAt = parseDateRequired(req.body?.startAt, "startAt");
      endAt = parseDateRequired(req.body?.endAt, "endAt");
    } catch (e) {
      return res
        .status(400)
        .json({
          ok: false,
          error: e instanceof Error ? e.message : "Invalid dates",
        });
    }

    if (endAt.getTime() < startAt.getTime()) {
      return res
        .status(400)
        .json({ ok: false, error: "endAt must be >= startAt" });
    }

    const description = String(req.body?.description ?? "").trim();
    const location = String(req.body?.location ?? "").trim();

    const created = await ScheduleEventModel.create({
      title,
      description: description || undefined,
      location: location || undefined,
      allDay,
      startAt,
      endAt,
    });

    res.status(201).json({ ok: true, event: toDto(created) });
  }),
);

scheduleRouter.patch(
  "/schedule/:id",
  asyncRoute(async (req, res) => {
    await connectMongo();

    const id = String(req.params.id);
    const ev = await ScheduleEventModel.findById(id).exec();
    if (!ev) return res.status(404).json({ ok: false, error: "Not found" });

    if (req.body?.title !== undefined) {
      const title = String(req.body?.title ?? "").trim();
      if (!title)
        return res.status(400).json({ ok: false, error: "Invalid title" });
      ev.title = title;
    }

    if (req.body?.description !== undefined) {
      const description = String(req.body?.description ?? "").trim();
      ev.description = description || undefined;
    }

    if (req.body?.location !== undefined) {
      const location = String(req.body?.location ?? "").trim();
      ev.location = location || undefined;
    }

    if (req.body?.allDay !== undefined) {
      ev.allDay = Boolean(req.body?.allDay);
    }

    if (req.body?.startAt !== undefined) {
      try {
        ev.startAt = parseDateRequired(req.body?.startAt, "startAt");
      } catch {
        return res.status(400).json({ ok: false, error: "Invalid startAt" });
      }
    }

    if (req.body?.endAt !== undefined) {
      try {
        ev.endAt = parseDateRequired(req.body?.endAt, "endAt");
      } catch {
        return res.status(400).json({ ok: false, error: "Invalid endAt" });
      }
    }

    if (ev.endAt.getTime() < ev.startAt.getTime()) {
      return res
        .status(400)
        .json({ ok: false, error: "endAt must be >= startAt" });
    }

    await ev.save();
    res.json({ ok: true, event: toDto(ev) });
  }),
);

scheduleRouter.delete(
  "/schedule/:id",
  asyncRoute(async (req, res) => {
    await connectMongo();

    const id = String(req.params.id);
    const deleted = await ScheduleEventModel.findByIdAndDelete(id).exec();
    if (!deleted)
      return res.status(404).json({ ok: false, error: "Not found" });

    res.json({ ok: true });
  }),
);
