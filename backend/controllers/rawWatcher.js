// backend/controllers/rawWatcher.js
import RawReading from "../models/RawReading.js";
import Reading from "../models/Reading.js";
import Battery from "../models/Battery.js";
import Event from "../models/Event.js";

import { socOCV, socCoulomb } from "../utils/socAlgorithms.js";
import { KalmanSOC } from "../utils/kalmanSOC.js";

import {
  initBatteryHealthDefaults,
  applyBatteryHealthUpdate,
} from "../utils/batteryHealth.js";

const stateByBattery = new Map(); // batteryId -> { lastTs, lastSoc, kalman, ratedAh }
const seenBattery = new Set();
const lastLowSocState = new Map(); // batteryId -> boolean
const lastChargeState = new Map(); // batteryId -> "charging" | "discharging" | "idle"

async function logEvent(batteryId, type, message, timestamp = null) {
  try {
    await Event.create({
      batteryId,
      type,
      message,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });
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

async function getOrCreateBatteryDoc(batteryId) {
  const doc = await Battery.findOneAndUpdate(
    { batteryName: batteryId },
    { $setOnInsert: { batteryName: batteryId, rated_Ah: 40 } },
    { new: true, upsert: true }
  );
  return doc;
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

      // init per-battery runtime state
      let st = stateByBattery.get(batteryId);
      if (!st) {
        st = { lastTs: timestamp, lastSoc: 100, kalman: null, ratedAh: 40 };
      }

      // one-time CONNECTED event per battery
      if (!seenBattery.has(batteryId)) {
        seenBattery.add(batteryId);
        await logEvent(batteryId, "CONNECTED", `Battery ${batteryId} started sending data`, timestamp);
      }

      // Load battery config/state doc
      const batteryDoc = await getOrCreateBatteryDoc(batteryId);

      // rated capacity (used by SOC and health model)
      st.ratedAh = safeNum(batteryDoc?.rated_Ah, 40);

      // build Kalman once per battery
      if (!st.kalman) {
        st.kalman = new KalmanSOC({
          capacityAh: st.ratedAh,
          initialSOC: st.lastSoc,
        });
      }

      // dt per battery (timestamp-based)
      const dt_s = Math.max(1, (timestamp - st.lastTs) / 1000);
      st.lastTs = timestamp;

      // SOC estimates
      const soc_ocv = safeNum(socOCV(voltage_V), 0);

      // socCoulomb expects current_mA in your utils; convert A -> mA
      const current_mA = current_A * 1000;
      const soc_coulomb = safeNum(
        socCoulomb(st.lastSoc, current_mA, dt_s, st.ratedAh),
        st.lastSoc
      );

      const k = st.kalman.update({ voltage_V, current_A, timestamp });
      const soc_kalman = safeNum(k?.soc, soc_coulomb);

      st.lastSoc = soc_kalman;
      stateByBattery.set(batteryId, st);

      // power (negative while discharging)
      const power_W = voltage_V * current_A;

      // ---------- Events: mode transitions ----------
      const eps = 0.05;
      const mode =
        current_A > eps ? "charging" : current_A < -eps ? "discharging" : "idle";
      const prevMode = lastChargeState.get(batteryId);

      if (prevMode && prevMode !== mode) {
        if (mode === "charging") {
          await logEvent(batteryId, "CHARGING", `Battery ${batteryId} started charging (${current_A.toFixed(2)}A)`, timestamp);
        } else if (mode === "discharging") {
          await logEvent(batteryId, "DISCHARGING", `Battery ${batteryId} started discharging (${current_A.toFixed(2)}A)`, timestamp);
        } else {
          await logEvent(batteryId, "IDLE", `Battery ${batteryId} is idle (${current_A.toFixed(2)}A)`, timestamp);
        }
      }
      if (!prevMode) {
        if (mode === "charging") await logEvent(batteryId, "CHARGING", `Battery ${batteryId} charging (${current_A.toFixed(2)}A)`, timestamp);
        if (mode === "discharging") await logEvent(batteryId, "DISCHARGING", `Battery ${batteryId} discharging (${current_A.toFixed(2)}A)`, timestamp);
        if (mode === "idle") await logEvent(batteryId, "IDLE", `Battery ${batteryId} idle (${current_A.toFixed(2)}A)`, timestamp);
      }
      lastChargeState.set(batteryId, mode);

      // ---------- Events: LOW_SOC edge-trigger ----------
      const low = soc_kalman <= 20;
      const wasLow = lastLowSocState.get(batteryId) || false;

      if (low && !wasLow) {
        await logEvent(batteryId, "LOW_SOC", `Battery ${batteryId} low SOC: ${soc_kalman.toFixed(1)}%`, timestamp);
      }
      if (!low && wasLow) {
        await logEvent(batteryId, "SOC_RECOVERED", `Battery ${batteryId} SOC recovered: ${soc_kalman.toFixed(1)}%`, timestamp);
      }
      lastLowSocState.set(batteryId, low);

      // ---------- SoH + cycle model update (timestamp-based) ----------
      const baseHealth = initBatteryHealthDefaults(batteryDoc, { ratedAhFallback: st.ratedAh });

      // Ensure last_timestamp continuity: prefer DB last_timestamp if present; else use runtime prev
      if (!baseHealth.last_timestamp) baseHealth.last_timestamp = new Date(timestamp.getTime() - dt_s * 1000);

      const { next: nextHealth, derived: healthDerived, events: healthEvents } =
        applyBatteryHealthUpdate(
          baseHealth,
          { timestamp, current_A },
          {
            // Tuning knobs (keep defaults unless you want faster degradation)
            lossAhPerDischargedAh: 0.0004,
            lossAhPerDischargeHour: 0.00001,
            minSoHPct: 70,
            maxSoHPct: 100,
            sohWarnPct: 80,
            sohCriticalPct: 70,
          }
        );

      // Persist battery health state
      batteryDoc.rated_Ah = nextHealth.rated_Ah;
      batteryDoc.effective_capacity_Ah = nextHealth.effective_capacity_Ah;
      batteryDoc.soh_pct = nextHealth.soh_pct;
      batteryDoc.total_discharged_Ah = nextHealth.total_discharged_Ah;
      batteryDoc.discharge_cycle_ah = nextHealth.discharge_cycle_ah;
      batteryDoc.cycle_count = nextHealth.cycle_count;
      batteryDoc.last_timestamp = nextHealth.last_timestamp;
      await batteryDoc.save();

      // Emit health events (cycle completed, SOH thresholds)
      if (Array.isArray(healthEvents) && healthEvents.length) {
        for (const ev of healthEvents) {
          await logEvent(batteryId, ev.type, `${ev.message}`, timestamp);
        }
      }

      // Per-step discharged Ah (for logs; this is not SoH)
      const dischargedAhThisStep = safeNum(healthDerived?.dischargedAhThisStep, 0);

      // ---------- Write processed reading ----------
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

        // IMPORTANT: this is now real and non-zero
        soh_pct: nextHealth.soh_pct,

        // Optional extra fields (safe to add; frontend can ignore)
        effective_capacity_Ah: nextHealth.effective_capacity_Ah,
        cycle_count: nextHealth.cycle_count,
      };

      await Reading.create(processed);
      await RawReading.deleteOne({ _id: raw._id });
    } catch (err) {
      console.error("Raw watcher loop error:", err);
    }
  }, 1500);
};
