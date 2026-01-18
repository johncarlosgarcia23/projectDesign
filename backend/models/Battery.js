// backend/models/Battery.js
import mongoose from "mongoose";

const batterySchema = new mongoose.Schema(
  {
    // Use batteryName as the primary identifier (matches your getBatteryConfig query)
    batteryName: { type: String, required: true, unique: true, index: true },

    // User/system config
    rated_Ah: { type: Number, default: 40 },

    // Stateful health model fields
    effective_capacity_Ah: { type: Number, default: null }, // initialized to rated_Ah on first update
    soh_pct: { type: Number, default: 100 },

    total_discharged_Ah: { type: Number, default: 0 },
    discharge_cycle_ah: { type: Number, default: 0 },
    cycle_count: { type: Number, default: 0 },

    last_timestamp: { type: Date, default: null },
  },
  { collection: "batteries", versionKey: false }
);

export default mongoose.model("Battery", batterySchema);
