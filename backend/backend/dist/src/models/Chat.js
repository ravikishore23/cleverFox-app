import mongoose, { Schema } from "mongoose";
const chatSchema = new Schema({
    title: { type: String, required: true, default: "New Chat" },
    messages: [
        {
            role: { type: String, required: true, enum: ["user", "assistant"] },
            content: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
        },
    ],
    userId: { type: String }, // Optional for now
}, { timestamps: true });
export const Chat = mongoose.model("Chat", chatSchema);
