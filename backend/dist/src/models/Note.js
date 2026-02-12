import mongoose, { Schema } from "mongoose";
function computeWordCount(text) {
    const normalized = String(text ?? "")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized)
        return 0;
    return normalized.split(" ").length;
}
const noteSchema = new Schema({
    title: { type: String, required: true, trim: true },
    category: { type: String, required: false, trim: true },
    tags: { type: [String], required: true, default: [] },
    content: { type: String, required: true, trim: true },
    pinned: { type: Boolean, required: true, default: false },
    favorite: { type: Boolean, required: true, default: false },
    wordCount: { type: Number, required: true, default: 0 },
}, { timestamps: true });
noteSchema.pre("save", function () {
    // Keep derived fields consistent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this;
    self.wordCount = computeWordCount(self.content);
});
export const NoteModel = mongoose.models.Note ??
    mongoose.model("Note", noteSchema);
