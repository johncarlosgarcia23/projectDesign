// backend/models/Battery.js
import mongoose from "mongoose";

const batterySchema = new mongoose.Schema(
  {
    batteryName: { type: String, required: true, unique: true, index: true },
    rated_Ah: { type: Number, default: 40 },
    user_set_soh_pct: { type: Number, default: 100 },
    soc_algorithm: { type: String, default: "kalman" }, // kalman | ocv | coulomb
  },
  { collection: "batteries", versionKey: false }
);

export default mongoose.model("Battery", batterySchema);
