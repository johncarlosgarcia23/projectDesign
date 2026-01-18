// backend/models/Event.js
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    batteryId: { type: String, required: true, index: true },
    type: { type: String, required: true },      // e.g. CONNECTED, LOW_SOC, CHARGING, DISCHARGING
    message: { type: String, required: true },
  },
  { collection: "events", versionKey: false }
);

export default mongoose.model("Event", eventSchema);
