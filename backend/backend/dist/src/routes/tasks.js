import { Router } from "express";
import { connectMongo } from "../db/mongo.js";
import { TaskModel, } from "../models/Task.js";
export const tasksRouter = Router();
const asyncRoute = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
function parseOptionalDate(input) {
    if (input === undefined)
        return undefined;
    if (input === null)
        return undefined;
    const s = String(input).trim();
    if (!s)
        return undefined;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime()))
        throw new Error("Invalid date");
    return d;
}
function parseOptionalString(input) {
    if (input === undefined)
        return undefined;
    if (input === null)
        return undefined;
    const s = String(input).trim();
    if (!s)
        return undefined;
    return s;
}
function parseOptionalPriority(input) {
    if (input === undefined)
        return undefined;
    if (input === null)
        return undefined;
    const s = String(input).trim();
    if (!s)
        return undefined;
    if (s === "low" || s === "medium" || s === "high")
        return s;
    throw new Error("Invalid priority");
}
function parseOptionalNumber(input) {
    if (input === undefined)
        return undefined;
    if (input === null)
        return undefined;
    if (input === "")
        return undefined;
    const n = Number(input);
    if (!Number.isFinite(n))
        throw new Error("Invalid number");
    return n;
}
function recomputeFromSubTasks(task) {
    const subTasks = Array.isArray(task.subTasks) ? task.subTasks : [];
    if (subTasks.length === 0)
        return;
    const doneCount = subTasks.filter((st) => Boolean(st.done)).length;
    const total = subTasks.length;
    const progress = Math.round((doneCount / total) * 100);
    task.progress = progress;
    task.status =
        doneCount === 0
            ? "pending"
            : doneCount === total
                ? "completed"
                : "inProgress";
    if (task.status === "completed") {
        task.completedAt = task.completedAt ?? new Date();
    }
    else {
        task.completedAt = undefined;
    }
}
function toTaskDto(doc) {
    return {
        id: String(doc._id),
        title: doc.title,
        description: doc.description ?? null,
        priority: doc.priority ?? null,
        reminderMinutesBefore: doc.reminderMinutesBefore ?? null,
        label: doc.label ?? null,
        deadlineAt: doc.deadlineAt ?? null,
        location: doc.location ?? null,
        status: doc.status,
        progress: doc.progress,
        dueAt: doc.dueAt ?? null,
        completedAt: doc.completedAt ?? null,
        subTasks: Array.isArray(doc.subTasks)
            ? doc.subTasks.map((st) => ({
                id: String(st._id),
                title: st.title,
                done: Boolean(st.done),
                createdAt: st.createdAt,
                doneAt: st.doneAt ?? null,
            }))
            : [],
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}
tasksRouter.get("/tasks", asyncRoute(async (_req, res) => {
    await connectMongo();
    const tasks = await TaskModel.find().sort({ createdAt: -1 }).exec();
    res.json({ ok: true, tasks: tasks.map(toTaskDto) });
}));
tasksRouter.get("/tasks/stats", asyncRoute(async (_req, res) => {
    await connectMongo();
    const tasks = await TaskModel.find().exec();
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "inProgress").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    res.json({ ok: true, stats: { total, completed, inProgress, pending } });
}));
tasksRouter.post("/tasks", asyncRoute(async (req, res) => {
    await connectMongo();
    const title = String(req.body?.title ?? "").trim();
    if (!title)
        return res.status(400).json({ ok: false, error: "Missing title" });
    let dueAt;
    try {
        dueAt = parseOptionalDate(req.body?.dueAt);
    }
    catch {
        return res.status(400).json({ ok: false, error: "Invalid dueAt" });
    }
    const descriptionRaw = req.body?.description;
    const priorityRaw = req.body?.priority;
    const reminderRaw = req.body?.reminderMinutesBefore;
    const labelRaw = req.body?.label;
    const deadlineAtRaw = req.body?.deadlineAt;
    const locationRaw = req.body?.location;
    let description;
    let priority;
    let reminderMinutesBefore;
    let label;
    let deadlineAt;
    let location;
    try {
        description =
            descriptionRaw === null
                ? undefined
                : parseOptionalString(descriptionRaw);
        priority = parseOptionalPriority(priorityRaw);
        reminderMinutesBefore = parseOptionalNumber(reminderRaw);
        if (reminderMinutesBefore !== undefined &&
            (reminderMinutesBefore < 0 || reminderMinutesBefore > 365 * 24 * 60)) {
            throw new Error("Invalid reminderMinutesBefore");
        }
        label = parseOptionalString(labelRaw);
        deadlineAt = parseOptionalDate(deadlineAtRaw);
        location = parseOptionalString(locationRaw);
    }
    catch {
        return res.status(400).json({ ok: false, error: "Invalid task fields" });
    }
    const subTasksRaw = req.body?.subTasks;
    const subTasks = Array.isArray(subTasksRaw)
        ? subTasksRaw
            .map((t) => String(t?.title ?? t ?? "").trim())
            .filter(Boolean)
            .slice(0, 100)
            .map((t) => ({
            title: t,
            done: false,
            createdAt: new Date(),
        }))
        : [];
    const created = await TaskModel.create({
        title,
        description: description ?? null,
        priority: priority ?? null,
        reminderMinutesBefore: reminderMinutesBefore ?? null,
        label: label ?? null,
        deadlineAt: deadlineAt ?? null,
        location: location ?? null,
        dueAt,
        subTasks,
    });
    recomputeFromSubTasks(created);
    await created.save();
    res.status(201).json({ ok: true, task: toTaskDto(created) });
}));
tasksRouter.patch("/tasks/:id", asyncRoute(async (req, res) => {
    await connectMongo();
    const id = String(req.params.id);
    const titleRaw = req.body?.title;
    const descriptionRaw = req.body?.description;
    const statusRaw = req.body?.status;
    const progressRaw = req.body?.progress;
    const dueAtRaw = req.body?.dueAt;
    const priorityRaw = req.body?.priority;
    const reminderRaw = req.body?.reminderMinutesBefore;
    const labelRaw = req.body?.label;
    const deadlineAtRaw = req.body?.deadlineAt;
    const locationRaw = req.body?.location;
    const subTaskAddRaw = req.body?.subTaskAdd;
    const subTaskToggleRaw = req.body?.subTaskToggle;
    const subTaskDeleteRaw = req.body?.subTaskDelete;
    const task = await TaskModel.findById(id).exec();
    if (!task)
        return res.status(404).json({ ok: false, error: "Not found" });
    if (titleRaw !== undefined) {
        const title = String(titleRaw).trim();
        if (!title)
            return res.status(400).json({ ok: false, error: "Invalid title" });
        task.title = title;
    }
    if (descriptionRaw !== undefined) {
        if (descriptionRaw === null) {
            task.description = null;
        }
        else {
            const description = String(descriptionRaw).trim();
            task.description = description ? description : null;
        }
    }
    if (dueAtRaw !== undefined) {
        try {
            task.dueAt = parseOptionalDate(dueAtRaw);
        }
        catch {
            return res.status(400).json({ ok: false, error: "Invalid dueAt" });
        }
    }
    if (priorityRaw !== undefined) {
        try {
            task.priority = parseOptionalPriority(priorityRaw) ?? null;
        }
        catch {
            return res.status(400).json({ ok: false, error: "Invalid priority" });
        }
    }
    if (reminderRaw !== undefined) {
        try {
            const v = parseOptionalNumber(reminderRaw);
            if (v !== undefined && (v < 0 || v > 365 * 24 * 60)) {
                return res
                    .status(400)
                    .json({ ok: false, error: "Invalid reminderMinutesBefore" });
            }
            task.reminderMinutesBefore = v ?? null;
        }
        catch {
            return res
                .status(400)
                .json({ ok: false, error: "Invalid reminderMinutesBefore" });
        }
    }
    if (labelRaw !== undefined) {
        task.label = parseOptionalString(labelRaw) ?? null;
    }
    if (deadlineAtRaw !== undefined) {
        try {
            task.deadlineAt = parseOptionalDate(deadlineAtRaw) ?? null;
        }
        catch {
            return res.status(400).json({ ok: false, error: "Invalid deadlineAt" });
        }
    }
    if (locationRaw !== undefined) {
        task.location = parseOptionalString(locationRaw) ?? null;
    }
    if (subTaskAddRaw !== undefined) {
        const title = String(subTaskAddRaw?.title ?? "").trim();
        if (!title)
            return res
                .status(400)
                .json({ ok: false, error: "Invalid subtask title" });
        task.subTasks.push({ title, done: false, createdAt: new Date() });
    }
    if (subTaskToggleRaw !== undefined) {
        const subId = String(subTaskToggleRaw?.id ?? "").trim();
        const done = Boolean(subTaskToggleRaw?.done);
        if (!subId)
            return res.status(400).json({ ok: false, error: "Invalid subtask id" });
        const sub = task.subTasks.find((st) => String(st._id) === subId);
        if (!sub)
            return res.status(404).json({ ok: false, error: "Subtask not found" });
        sub.done = done;
        sub.doneAt = done ? new Date() : undefined;
    }
    if (subTaskDeleteRaw !== undefined) {
        const subId = String(subTaskDeleteRaw?.id ?? "").trim();
        if (!subId)
            return res.status(400).json({ ok: false, error: "Invalid subtask id" });
        task.subTasks = task.subTasks.filter((st) => String(st._id) !== subId);
    }
    // Manual status/progress updates apply only when there are no subtasks.
    if ((task.subTasks?.length ?? 0) === 0) {
        if (statusRaw !== undefined) {
            const status = String(statusRaw);
            if (!(status === "pending" ||
                status === "inProgress" ||
                status === "completed")) {
                return res.status(400).json({ ok: false, error: "Invalid status" });
            }
            task.status = status;
            if (status === "completed") {
                task.progress = 100;
                task.completedAt = task.completedAt ?? new Date();
            }
            else {
                task.completedAt = undefined;
            }
        }
        if (progressRaw !== undefined) {
            const progress = Number(progressRaw);
            if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
                return res.status(400).json({ ok: false, error: "Invalid progress" });
            }
            task.progress = Math.round(progress);
            if (task.progress === 100) {
                task.status = "completed";
                task.completedAt = task.completedAt ?? new Date();
            }
        }
    }
    recomputeFromSubTasks(task);
    await task.save();
    res.json({ ok: true, task: toTaskDto(task) });
}));
tasksRouter.delete("/tasks/:id", asyncRoute(async (req, res) => {
    await connectMongo();
    const id = String(req.params.id);
    const deleted = await TaskModel.findByIdAndDelete(id).exec();
    if (!deleted)
        return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
}));
