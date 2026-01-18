// controllers/rawWatcher.js
import RawReading from "../models/RawReading.js";
import Reading from "../models/Reading.js";
import Battery from "../models/Battery.js";
import { socOCV, socCoulomb } from "../utils/socAlgorithms.js";
import { KalmanSOC } from "../utils/kalmanSOC.js";

const stateByBattery = new Map(); // batteryId -> { lastTs, lastSoc, kalman }

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeDate(v) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function getBatteryConfig(batteryId) {
  // optional config; if you don't have Battery model docs yet, defaults are used
  const cfg = await Battery.findOne({ batteryName: batteryId }).lean().catch(() => null);
  return {
    rated_Ah: safeNum(cfg?.rated_Ah, 40),
  };
}

export const startRawWatcher = () => {
  console.log("Raw watcher active: polling raw_readings…");

  setInterval(async () => {
    try {
      const raw = await RawReading.findOne().sort({ timestamp: 1 }).lean();
      if (!raw) return;

      const batteryId = raw.batteryId || "BATT_DEFAULT";
      const timestamp = safeDate(raw.timestamp);

      const voltage_V = safeNum(raw.voltage_V);
      const current_A = safeNum(raw.current_A); // schema is current_A

      const st =
        stateByBattery.get(batteryId) ||
        ({
          lastTs: timestamp,
          lastSoc: 100,
          kalman: null,
          ratedAh: 40,
        });

      // load config once
      if (!st.kalman) {
        const cfg = await getBatteryConfig(batteryId);
        st.ratedAh = cfg.rated_Ah;

        st.kalman = new KalmanSOC({
          capacityAh: st.ratedAh,
          initialSOC: st.lastSoc,
        });
      }

      const dt_s = Math.max(1, (timestamp - st.lastTs) / 1000);
      st.lastTs = timestamp;

      // SOC estimates
      const soc_ocv = safeNum(socOCV(voltage_V), 0);
      const soc_coulomb = safeNum(socCoulomb(st.lastSoc, current_A, dt_s, st.ratedAh), st.lastSoc);

      const k = st.kalman.update({ voltage_V, current_A, timestamp });
      const soc_kalman = safeNum(k.soc, soc_coulomb);

      st.lastSoc = soc_kalman;
      stateByBattery.set(batteryId, st);

      // power + Ah integration
      const power_W = voltage_V * current_A; // will be negative while discharging
      const dischargedAhThisStep = current_A < 0 ? Math.abs(current_A) * (dt_s / 3600) : 0;

      const processed = {
        timestamp,
        batteryId,
        voltage_V,
        current_A,
        power_W,
        estimated_Ah: dischargedAhThisStep, // per-step discharged Ah (positive number)
        soc_ocv,
        soc_coulomb,
        soc_kalman,
        soh_pct: 100, // leave as 100 unless you have a real model
      };

      await Reading.create(processed);
      await RawReading.deleteOne({ _id: raw._id });

    } catch (err) {
      console.error("Raw watcher loop error:", err);
    }
  }, 1500);
};
