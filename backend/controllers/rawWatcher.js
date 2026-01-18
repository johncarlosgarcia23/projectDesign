// controllers/rawWatcher.js
import RawReading from "../models/RawReading.js";
import Reading from "../models/Reading.js";
import { socOCV, socCoulomb } from "../utils/socAlgorithms.js";

const DEFAULT_CAPACITY_AH = 40; // packaging / rated capacity used for coulomb counting
const POLL_MS = 1500;

// Track per-battery state instead of global
const stateByBattery = new Map();
// state: { lastSoc: number, lastTs: Date }

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

export const startRawWatcher = () => {
  console.log("Raw watcher active: polling raw_readings…");

  setInterval(async () => {
    try {
      // get oldest raw reading first
      const raw = await RawReading.findOne().sort({ timestamp: 1 }).lean();
      if (!raw) return;

      const batteryId = raw.batteryId || "BATT_DEFAULT";
      const voltage_V = Number(raw.voltage_V);
      const current_A = Number(raw.current_A);
      const timestamp = new Date(raw.timestamp);

      if (!Number.isFinite(voltage_V) || !Number.isFinite(current_A) || Number.isNaN(timestamp.getTime())) {
        // bad row: drop it so you don't block the queue
        await RawReading.deleteOne({ _id: raw._id });
        return;
      }

      const prev = stateByBattery.get(batteryId) || { lastSoc: 100, lastTs: timestamp };
      const dt_s = Math.max(1, (timestamp - new Date(prev.lastTs)) / 1000);

      // SOC estimates
      const soc_ocv = clamp01(socOCV(voltage_V));

      // socCoulomb signature may differ in your project.
      // This call assumes: socCoulomb(previousSocPct, current_A_or_mA, dtSeconds, capacityAh?)
      // If your socCoulomb expects mA, pass current_A*1000 instead.
      let soc_coulomb = socCoulomb(prev.lastSoc, current_A * 1000, dt_s, DEFAULT_CAPACITY_AH);
      soc_coulomb = clamp01(Number(soc_coulomb));

      // simple fused SOC (until you rely on KalmanSOC in sensorController pipeline)
      const soc_kalman = clamp01((soc_ocv + soc_coulomb) / 2);

      // Derived quantities
      const power_W = voltage_V * current_A;

      // Estimate discharged Ah for this interval (only when discharging, current_A < 0)
      const dischargedAhInterval =
        current_A < 0 ? Math.abs(current_A) * (dt_s / 3600) : 0;

      const processed = {
        timestamp,
        batteryId,
        voltage_V,
        current_A,
        power_W,

        // this is per-interval discharge Ah, not total capacity
        estimated_Ah: dischargedAhInterval,

        soc_ocv,
        soc_coulomb,
        soc_kalman,

        // do NOT fake SoH; keep default/constant
        soh_pct: 100
      };

      await Reading.create(processed);
      await RawReading.deleteOne({ _id: raw._id });

      stateByBattery.set(batteryId, { lastSoc: soc_kalman, lastTs: timestamp });

      // optional: reduce spam
      // console.log("Processed →", batteryId, timestamp.toISOString());
    } catch (err) {
      console.error("Raw watcher loop error:", err);
    }
  }, POLL_MS);
};
