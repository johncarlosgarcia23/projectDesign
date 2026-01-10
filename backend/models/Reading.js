// models/Reading.js
import mongoose from "mongoose";

const readingSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    batteryId: { type: String, required: true },

    voltage_V: { type: Number, required: true },
    current_A: { type: Number, required: true },
    power_W: { type: Number, required: true },

    estimated_Ah: { type: Number, default: 0 },

    soc_ocv: { type: Number, default: 0 },
    soc_coulomb: { type: Number, default: 0 },
    soc_kalman: { type: Number, default: 0 },

    soh_pct: { type: Number, default: 100 }
  },
  { collection: "processed_readings" }
);

export default mongoose.model("Reading", readingSchema);