// models/Reading.js
import mongoose from "mongoose";

const readingSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    batteryId: { type: String, required: true },

    voltage_V: { type: Number, required: true },
    current_A: { type: Number, required: true },
    power_W: { type: Number, required: true },

    soc_ocv: { type: Number, default: null },
    soc_coulomb: { type: Number, default: null },
    soc_kalman: { type: Number, default: null },

    effective_capacity_Ah: { type: Number, default: null }, // inferred
    soh_relative_pct: { type: Number, default: null }       // trend-based
  },
  { collection: "processed_readings" }
);

export default mongoose.model("Reading", readingSchema);
