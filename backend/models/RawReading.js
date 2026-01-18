// models/RawReading.js
import mongoose from "mongoose";

const rawReadingSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true
    },

    batteryId: {
      type: String,
      required: true,
      index: true
    },

    // Battery terminal voltage
    voltage_V: {
      type: Number,
      required: true
    },

    // Battery current in AMPERES
    // Positive = charging
    // Negative = discharging
    current_A: {
      type: Number,
      required: true
    }
  },
  {
    collection: "raw_readings",
    versionKey: false
  }
);

export default mongoose.model("RawReading", rawReadingSchema);
