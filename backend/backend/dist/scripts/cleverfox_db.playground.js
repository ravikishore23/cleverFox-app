import "dotenv/config";
import mongoose from "mongoose";
function getMongoUri() {
    // Prefer your existing env var(s). If none set, default to local cleverfox_db.
    return (process.env.MONGODB_URI ??
        process.env.MONGODB_URL ??
        "mongodb://localhost:27017/cleverfox_db");
}
async function main() {
    const mongoUri = getMongoUri();
    console.log(`[playground] Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log("[playground] Mongo connected");
    const dbName = mongoose.connection.db?.databaseName ?? "(unknown)";
    console.log(`[playground] DB: ${dbName}`);
    const PlaygroundItem = mongoose.model("PlaygroundItem", new mongoose.Schema({
        name: { type: String, required: true },
        note: { type: String, required: true },
    }, { timestamps: true, collection: "playground_items" }));
    const created = await PlaygroundItem.create({
        name: "hello",
        note: `created at ${new Date().toISOString()}`,
    });
    console.log("[playground] Inserted:", { id: String(created._id) });
    const items = await PlaygroundItem.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
    console.log(`[playground] Latest items (${items.length}):`, items.map((i) => ({ id: String(i._id), name: i.name })));
    await PlaygroundItem.updateOne({ _id: created._id }, { $set: { note: "updated from playground" } });
    console.log("[playground] Updated inserted item");
    const fetched = await PlaygroundItem.findById(created._id).lean();
    console.log("[playground] Fetched:", fetched
        ? { id: String(fetched._id), name: fetched.name, note: fetched.note }
        : null);
    await PlaygroundItem.deleteOne({ _id: created._id });
    console.log("[playground] Deleted inserted item");
    await mongoose.disconnect();
    console.log("[playground] Done");
}
main().catch(async (err) => {
    console.error("[playground] Error:", err);
    try {
        await mongoose.disconnect();
    }
    catch {
        // ignore
    }
    process.exit(1);
});
