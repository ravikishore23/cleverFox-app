import mongoose from "mongoose";
import { env } from "../config/env.js";
let connected = false;
export async function connectMongo() {
    if (connected)
        return;
    const uri = env.mongodbUri;
    if (!uri) {
        throw new Error("Mongo connection string missing. Set MONGODB_URI (or MONGODB_URL) for /tasks");
    }
    await mongoose.connect(uri);
    connected = true;
    console.log("MongoDB connected");
}
