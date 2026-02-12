import mongoose, { Schema } from "mongoose";

export type ScheduleEventDoc = {
  title: string;
  description?: string;
  location?: string;
  allDay: boolean;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const scheduleEventSchema = new Schema<ScheduleEventDoc>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true },
    location: { type: String, required: false, trim: true },
    allDay: { type: Boolean, required: true, default: false },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const ScheduleEventModel =
  (mongoose.models.ScheduleEvent as
    | mongoose.Model<ScheduleEventDoc>
    | undefined) ??
  mongoose.model<ScheduleEventDoc>("ScheduleEvent", scheduleEventSchema);
