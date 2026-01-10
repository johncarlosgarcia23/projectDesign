import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  batteryName: { type: String, required: true },
  connectedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Event", eventSchema);