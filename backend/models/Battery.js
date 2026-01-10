// models/Battery.js
import mongoose from "mongoose";

const batterySchema = new mongoose.Schema({
  batteryId: { type: String, required: true, unique: true },
  name: { type: String, default: "battery" },
  rated_Ah: { type: Number, default: 40 },
  rated_voltage: { type: Number, default: 12.0 },
  user_set_soh_pct: { type: Number, default: 100 },
  user_override_soh: { type: Boolean, default: false },
  user_soh_weight: { type: Number, default: 0.7 },
  last_capacity_Ah: { type: Number, default: null },
  last_soh_pct: { type: Number, default: null },
  lastUpdated: { type: Date, default: Date.now },
});

export default mongoose.model("Battery", batterySchema);