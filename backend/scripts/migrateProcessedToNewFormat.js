// scripts/exportProcessedToNewDB.js
// Purpose: copy processed_readings to a new collection processed_readings2 in the same database

import mongoose from "mongoose";
import dotenv from "dotenv";
import Reading from "../models/Reading.js";
import Battery from "../models/Battery.js";
import { calibrateReading } from "../utils/calibration.js";
import { socOCV, socCoulomb } from "../utils/socAlgorithms.js";
import { KalmanSOC } from "../utils/kalmanSOC.js";
import { KalmanSOH } from "../utils/kalmanSOH.js";

dotenv.config();

const uri = process.env.MONGO_URI || "mongodb+srv://user:user123@sensor-dev-db.ksssy2x.mongodb.net/microgridDB?retryWrites=true&w=majority";

await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

console.log("Connected to MongoDB cluster");

const kalmanSoHMap = new Map();
const kalmanSocMap = new Map();

async function ensureBatteryKalman(batteryId) {
  let cfg = await Battery.findOne({ batteryId });
  if (!cfg) {
    cfg = await Battery.create({ batteryId, rated_Ah: 40, user_set_soh_pct: 100 });
  }
  if (!kalmanSoHMap.has(batteryId)) {
    kalmanSoHMap.set(
      batteryId,
      new KalmanSOH({
        ratedCapacityAh: cfg.rated_Ah,
        initialCapacityAh: cfg.user_set_soh_pct ? (cfg.user_set_soh_pct * cfg.rated_Ah) / 100 : cfg.rated_Ah,
      })
    );
  }
  if (!kalmanSocMap.has(batteryId)) {
    kalmanSocMap.set(
      batteryId,
      new KalmanSOC({
        capacityAh: cfg.rated_Ah,
        initialSOC: 100,
        Q: 1e-6,
        R_window: 30,
      })
    );
  }
  return { cfg, sohEstimator: kalmanSoHMap.get(batteryId), socEstimator: kalmanSocMap.get(batteryId) };
}

async function exportToNewCollection() {
  const oldData = await Reading.find().sort({ timestamp: 1 });
  console.log(`Found ${oldData.length} processed readings`);

  const newCollection = mongoose.connection.collection("processed_readings2");

  for (const d of oldData) {
    const batteryId = d.batteryId || "BATT_DEFAULT";
    const batteryName = d.batteryName || "Default Battery";

    const { cfg, sohEstimator, socEstimator } = await ensureBatteryKalman(batteryId);

    const calibrated = calibrateReading({
      voltage_V: d.voltage_V,
      current_A: d.current_A,
      power_W: d.power_W,
      timestamp: d.timestamp,
      batteryId,
    });

    const soc_ocv = socOCV(calibrated.voltage_V);

    const kalmanSocResult = socEstimator.update({
      voltage_V: calibrated.voltage_V,
      current_A: calibrated.current_A,
      timestamp: calibrated.timestamp,
    });

    const prevSOC = kalmanSocResult.soc ?? 100;
    const deltaTime = kalmanSocResult.dt || 1;
    const soc_coulomb = socCoulomb(prevSOC, calibrated.current_A, deltaTime, cfg.rated_Ah);

    const kalmanSohResult = sohEstimator.update(
      {
        voltage_V: calibrated.voltage_V,
        current_A: calibrated.current_A,
        timestamp: calibrated.timestamp,
      },
      soc_ocv
    );

    let final_soh = kalmanSohResult.soh_pct;
    if (cfg.user_override_soh && typeof cfg.user_set_soh_pct === "number") {
      const w = Math.max(0, Math.min(1, cfg.user_soh_weight));
      final_soh = w * cfg.user_set_soh_pct + (1 - w) * kalmanSohResult.soh_pct;
    }

    const newDoc = {
      batteryId,
      batteryName,
      timestamp: calibrated.timestamp,
      voltage_V: calibrated.voltage_V,
      current_A: calibrated.current_A,
      current_mA: calibrated.current_A * 1000,
      power_W: calibrated.power_W,
      calibrated: true,
      soc_ocv,
      soc_coulomb,
      soc_kalman: kalmanSocResult.soc,
      soh_pct: final_soh,
      capacity_Ah_est: kalmanSohResult.capacity_Ah,
      kalman_soc_K: kalmanSocResult.K,
      kalman_soc_P: kalmanSocResult.P,
      kalman_soh_K: kalmanSohResult.K,
      kalman_soh_P: kalmanSohResult.P,
    };

    await newCollection.insertOne(newDoc);
  }

  console.log("Export to processed_readings2 completed");
  process.exit(0);
}

await exportToNewCollection();
