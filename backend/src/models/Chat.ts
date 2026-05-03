import mongoose, { Schema, Document } from "mongoose";

export interface IMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface IChat extends Document {
  title: string;
  messages: IMessage[];
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>(
  {
    title: { type: String, required: true, default: "New Chat" },
    messages: [
      {
        role: { type: String, required: true, enum: ["user", "assistant"] },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    userId: { type: String }, // Optional for now
  },
  { timestamps: true }
);

export const Chat = mongoose.model<IChat>("Chat", chatSchema);
