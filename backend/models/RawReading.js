// models/RawReading.js
import mongoose from "mongoose";

const rawReadingSchema = new mongoose.Schema(
  {
    timestamp: Date,
    voltage_V: Number,
    current_mA: Number,
    power_mW: Number,
    batteryId: { type: String, required: true }
  },
  { collection: "raw_readings" }
);

export default mongoose.model("RawReading", rawReadingSchema);