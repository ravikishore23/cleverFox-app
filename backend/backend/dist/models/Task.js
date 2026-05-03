import mongoose, { Schema } from "mongoose";
const subTaskSchema = new Schema({
    title: { type: String, required: true, trim: true },
    done: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, required: true, default: () => new Date() },
    doneAt: { type: Date, required: false },
}, { _id: true });
const taskSchema = new Schema({
    title: { type: String, required: true, trim: true },
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
}, { timestamps: true });
export const TaskModel = mongoose.models.Task ??
    mongoose.model("Task", taskSchema);
