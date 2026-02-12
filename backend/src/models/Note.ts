import mongoose, { Schema } from "mongoose";

export type NoteDoc = {
  title: string;
  category?: string;
  tags: string[];
  content: string;
  pinned: boolean;
  favorite: boolean;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
};

function computeWordCount(text: string): number {
  const normalized = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return 0;
  return normalized.split(" ").length;
}

const noteSchema = new Schema<NoteDoc>(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: false, trim: true },
    tags: { type: [String], required: true, default: [] },
    content: { type: String, required: true, trim: true },
    pinned: { type: Boolean, required: true, default: false },
    favorite: { type: Boolean, required: true, default: false },
    wordCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

noteSchema.pre("save", function () {
  // Keep derived fields consistent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const self = this as any;
  self.wordCount = computeWordCount(self.content);
});

export const NoteModel =
  (mongoose.models.Note as mongoose.Model<NoteDoc> | undefined) ??
  mongoose.model<NoteDoc>("Note", noteSchema);
