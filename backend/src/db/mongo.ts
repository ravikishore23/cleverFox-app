import mongoose from "mongoose";
import { env } from "../config/env.js";

let connected = false;

export function isMongoConnected(): boolean {
  return connected;
}

export async function connectMongo(): Promise<void> {
  if (connected) return;

  const uri = env.mongodbUri;
  if (!uri) {
    console.warn(
      "⚠ MONGODB_URI not set – chat history persistence is disabled.",
    );
    return;
  }

  try {
    await mongoose.connect(uri);
    connected = true;
    console.log("MongoDB connected");
  } catch (err) {
    console.warn(
      "⚠ Could not connect to MongoDB – chat history persistence is disabled.",
      err instanceof Error ? err.message : err,
    );
  }
}
