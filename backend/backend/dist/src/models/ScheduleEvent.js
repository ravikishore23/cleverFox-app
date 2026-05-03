import mongoose, { Schema } from "mongoose";
const scheduleEventSchema = new Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true },
    location: { type: String, required: false, trim: true },
    allDay: { type: Boolean, required: true, default: false },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
}, { timestamps: true });
export const ScheduleEventModel = mongoose.models.ScheduleEvent ??
    mongoose.model("ScheduleEvent", scheduleEventSchema);
