import mongoose, { Schema } from "mongoose";

export type TaskStatus = "pending" | "inProgress" | "completed";

export type TaskPriority = "low" | "medium" | "high";

export type SubTaskDoc = {
  title: string;
  done: boolean;
  createdAt: Date;
  doneAt?: Date;
};

export type TaskDoc = {
  title: string;
  description?: string | null;
  priority?: TaskPriority | null;
  reminderMinutesBefore?: number | null;
  label?: string | null;
  deadlineAt?: Date | null;
  location?: string | null;
  status: TaskStatus;
  progress: number; // 0..100
  dueAt?: Date;
  completedAt?: Date;
  subTasks: SubTaskDoc[];
  createdAt: Date;
  updatedAt: Date;
};

const subTaskSchema = new Schema<SubTaskDoc>(
  {
    title: { type: String, required: true, trim: true },
    done: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, required: true, default: () => new Date() },
    doneAt: { type: Date, required: false },
  },
  { _id: true },
);

const taskSchema = new Schema<TaskDoc>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true, default: null },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      required: false,
      default: null,
    },
    reminderMinutesBefore: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
    label: { type: String, required: false, trim: true, default: null },
    deadlineAt: { type: Date, required: false, default: null },
    location: { type: String, required: false, trim: true, default: null },
    status: {
      type: String,
      enum: ["pending", "inProgress", "completed"],
      default: "pending",
      required: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0, required: true },
    dueAt: { type: Date, required: false },
    completedAt: { type: Date, required: false },
    subTasks: { type: [subTaskSchema], required: true, default: [] },
  },
  { timestamps: true },
);

export const TaskModel =
  (mongoose.models.Task as mongoose.Model<TaskDoc> | undefined) ??
  mongoose.model<TaskDoc>("Task", taskSchema);
