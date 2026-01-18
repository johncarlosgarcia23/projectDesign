// controllers/rawWatcher.js
import RawReading from "../models/RawReading.js";
import Reading from "../models/Reading.js";
import Battery from "../models/Battery.js";
import { socOCV, socCoulomb } from "../utils/socAlgorithms.js";
import { KalmanSOC } from "../utils/kalmanSOC.js";
import Event from "../models/Event.js";

const stateByBattery = new Map(); // batteryId -> { lastTs, lastSoc, kalman, ratedAh }
const seenBattery = new Set();
const lastLowSocState = new Map(); // batteryId -> boolean
const lastChargeState = new Map(); // batteryId -> "charging" | "discharging" | "idle"

async function logEvent(batteryId, type, message) {
  try {
    await Event.create({ batteryId, type, message });
  } catch (e) {
    console.error("Event log failed:", e.message);
  }
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeDate(v) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function getBatteryConfig(batteryId) {
  const cfg = await Battery.findOne({ batteryName: batteryId }).lean().catch(() => null);
  return {
    rated_Ah: safeNum(cfg?.rated_Ah, 40),
  };
}

export const startRawWatcher = () => {
  console.log("Raw watcher active: polling raw_readings…");

  setInterval(async () => {
    try {
      // oldest first
      const raw = await RawReading.findOne().sort({ timestamp: 1 }).lean();
      if (!raw) return;

      const batteryId = raw.batteryId || "BATT_DEFAULT";
      const timestamp = safeDate(raw.timestamp);

      const voltage_V = safeNum(raw.voltage_V);
      const current_A = safeNum(raw.current_A); // schema uses current_A

      // init per-battery state
      let st = stateByBattery.get(batteryId);
      if (!st) {
        st = {
          lastTs: timestamp,
          lastSoc: 100,
          kalman: null,
          ratedAh: 40,
        };
      }

      // one-time CONNECTED event per battery
      if (!seenBattery.has(batteryId)) {
        seenBattery.add(batteryId);
        await logEvent(batteryId, "CONNECTED", `Battery ${batteryId} started sending data`);
      }

      // load capacity config once and build Kalman instance once
      if (!st.kalman) {
        const cfg = await getBatteryConfig(batteryId);
        st.ratedAh = cfg.rated_Ah;

        st.kalman = new KalmanSOC({
          capacityAh: st.ratedAh,
          initialSOC: st.lastSoc,
        });
      }

      // dt
      const dt_s = Math.max(1, (timestamp - st.lastTs) / 1000);
      st.lastTs = timestamp;

      // SOC estimates
      const soc_ocv = safeNum(socOCV(voltage_V), 0);

      // socCoulomb expects current_mA in your utils; convert A -> mA here
      const current_mA = current_A * 1000;
      const soc_coulomb = safeNum(
        socCoulomb(st.lastSoc, current_mA, dt_s, st.ratedAh),
        st.lastSoc
      );

      const k = st.kalman.update({ voltage_V, current_A, timestamp });
      const soc_kalman = safeNum(k?.soc, soc_coulomb);

      st.lastSoc = soc_kalman;
      stateByBattery.set(batteryId, st);

      // power + discharged Ah integration (per-step)
      const power_W = voltage_V * current_A; // negative while discharging
      const dischargedAhThisStep = current_A < 0 ? Math.abs(current_A) * (dt_s / 3600) : 0;

      // events: charging/discharging/idle transitions
      const eps = 0.05;
      const mode =
        current_A > eps ? "charging" : current_A < -eps ? "discharging" : "idle";
      const prevMode = lastChargeState.get(batteryId);

      if (prevMode && prevMode !== mode) {
        if (mode === "charging") {
          await logEvent(batteryId, "CHARGING", `Battery ${batteryId} started charging (${current_A.toFixed(2)}A)`);
        } else if (mode === "discharging") {
          await logEvent(batteryId, "DISCHARGING", `Battery ${batteryId} started discharging (${current_A.toFixed(2)}A)`);
        } else {
          await logEvent(batteryId, "IDLE", `Battery ${batteryId} is idle (${current_A.toFixed(2)}A)`);
        }
      }
      if (!prevMode) {
        // first observation, record initial state once
        if (mode === "charging") await logEvent(batteryId, "CHARGING", `Battery ${batteryId} charging (${current_A.toFixed(2)}A)`);
        if (mode === "discharging") await logEvent(batteryId, "DISCHARGING", `Battery ${batteryId} discharging (${current_A.toFixed(2)}A)`);
        if (mode === "idle") await logEvent(batteryId, "IDLE", `Battery ${batteryId} idle (${current_A.toFixed(2)}A)`);
      }
      lastChargeState.set(batteryId, mode);

      // events: LOW_SOC edge-trigger at <= 20%
      const low = soc_kalman <= 20;
      const wasLow = lastLowSocState.get(batteryId) || false;

      if (low && !wasLow) {
        await logEvent(batteryId, "LOW_SOC", `Battery ${batteryId} low SOC: ${soc_kalman.toFixed(1)}%`);
      }
      if (!low && wasLow) {
        await logEvent(batteryId, "SOC_RECOVERED", `Battery ${batteryId} SOC recovered: ${soc_kalman.toFixed(1)}%`);
      }
      lastLowSocState.set(batteryId, low);

      // write processed reading
      const processed = {
        timestamp,
        batteryId,
        voltage_V,
        current_A,
        power_W,
        estimated_Ah: dischargedAhThisStep, // per-step discharged Ah (positive)
        soc_ocv,
        soc_coulomb,
        soc_kalman,
        soh_pct: 100, // keep as placeholder
      };

      await Reading.create(processed);
      await RawReading.deleteOne({ _id: raw._id });
    } catch (err) {
      console.error("Raw watcher loop error:", err);
    }
  }, 1500);
};
