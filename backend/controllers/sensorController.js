// controllers/sensorController.js
import Reading from "../models/Reading.js";
import Battery from "../models/Battery.js";
import rawReadingSchema from "../models/RawReading.js";
import { connectRawDB } from "../config/rawDB.js";

import { calibrateReading } from "../utils/calibration.js";
import { socOCV, socCoulomb } from "../utils/socAlgorithms.js";
import { KalmanSOC } from "../utils/kalmanSOC.js";
import { KalmanSOH } from "../utils/kalmanSOH.js";

/* -------------------------------------------------------
   SANITIZATION UTILS — PREVENT NaN / Infinity / bad dates
---------------------------------------------------------*/
function safeNum(v) {
  const n = Number(v);
  return isFinite(n) && !Number.isNaN(n) ? n : 0;
}

function safeDate(v) {
  const t = new Date(v);
  return isNaN(t.getTime()) ? new Date() : t;
}

/* -------------------------------------------------------
   Kalman STATE MAPS
---------------------------------------------------------*/
const kalmanSocMap = new Map();
const kalmanSohMap = new Map();
const lastStateMap = new Map();

/* -------------------------------------------------------
   Ensure Kalman Estimators Per Battery
---------------------------------------------------------*/
async function ensureKalman(batteryName) {
  let cfg = await Battery.findOne({ batteryName });
  if (!cfg) {
    cfg = await Battery.create({
      batteryName,
      rated_Ah: 40,
      user_set_soh_pct: 100
    });
  }

  if (!kalmanSocMap.has(batteryName)) {
    kalmanSocMap.set(
      batteryName,
      new KalmanSOC({
        capacityAh: cfg.rated_Ah || 40,
        initialSOC: 100,
        Q: 1e-6,
        R_window: 30
      })
    );
  }

  if (!kalmanSohMap.has(batteryName)) {
    kalmanSohMap.set(
      batteryName,
      new KalmanSOH({
        ratedCapacityAh: cfg.rated_Ah || 40,
        initialCapacityAh: ((cfg.user_set_soh_pct || 100) / 100) * (cfg.rated_Ah || 40)
      })
    );
  }

  return {
    cfg,
    socEstimator: kalmanSocMap.get(batteryName),
    sohEstimator: kalmanSohMap.get(batteryName)
  };
}

/* -------------------------------------------------------
   POST /api/sensors/process
---------------------------------------------------------*/
export const processReadings = async (req, res) => {
  try {
    const raw = req.body;
    const normalized = calibrateReading(raw);

    // force sanitized here too
    normalized.timestamp = safeDate(normalized.timestamp);
    normalized.voltage_V = safeNum(normalized.voltage_V);
    normalized.current_mA = safeNum(normalized.current_mA);
    normalized.power_mW = safeNum(normalized.power_mW);

    const saved = await processAndSave(normalized);
    res.status(201).json(saved);
  } catch (err) {
    console.error("processReadings error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* -------------------------------------------------------
   **SANITIZED API RESPONSE**
   GET /api/sensors/processed
---------------------------------------------------------*/
export const getProcessedReadings = async (req, res) => {
  try {
    const { batteryId } = req.query;
    const query = batteryId ? { batteryId } : {};

    const raw = await Reading.find(query)
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    const safe = raw.map((r) => ({
      batteryName: r.batteryName || r.batteryId || "BATT_UNKNOWN",
      timestamp: safeDate(r.timestamp).toISOString(),

      voltage_V: safeNum(r.voltage_V),
      current_A: safeNum(r.current_A),
      power_W: safeNum(r.power_W),
      estimated_Ah: safeNum(r.estimated_Ah),

      soc_ocv: safeNum(r.soc_ocv),
      soc_coulomb: safeNum(r.soc_coulomb),
      soc_kalman: safeNum(r.soc_kalman),

      soh_pct: safeNum(r.soh_pct)
    }));

    res.json(safe);
  } catch (err) {
    console.error("Error fetching processed readings:", err);
    res.status(500).json({ message: err.message });
  }
};

/* -------------------------------------------------------
   POST /api/sensors/migrate
---------------------------------------------------------*/
export const migrateRawReadings = async (req, res) => {
  try {
    const rawConn = await connectRawDB();
    const RawReading = rawConn.model("RawReading", rawReadingSchema);

    const rawDocs = await RawReading.find().sort({ timestamp: 1 }).lean();
    if (!rawDocs.length) return res.json({ message: "No raw readings" });

    let count = 0;

    for (const raw of rawDocs) {
      const normalized = calibrateReading({
        batteryName: raw.batteryId || "BATT_DEFAULT",
        timestamp: safeDate(raw.timestamp),
        voltage_V: safeNum(raw.voltage_V),
        current_mA: safeNum(raw.current_mA),
        power_mW: safeNum(raw.power_mW)
      });

      await processAndSave(normalized);
      await RawReading.deleteOne({ _id: raw._id });
      count++;
    }

    res.status(201).json({ message: `Migrated ${count} raw readings` });
  } catch (err) {
    console.error("migrateRawReadings error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* -------------------------------------------------------
   CORE PROCESSING AND SAVE
---------------------------------------------------------*/
export async function processAndSave(normalized) {
  const batteryName = normalized.batteryName || "BATT_DEFAULT";

  const timestamp = safeDate(normalized.timestamp);

  const { cfg, socEstimator, sohEstimator } = await ensureKalman(batteryName);

  const voltage_V = safeNum(normalized.voltage_V);
  const current_mA = safeNum(normalized.current_mA);
  const current_A = current_mA / 1000;
  const power_W = safeNum(normalized.power_mW) / 1000;

  const lastState = lastStateMap.get(batteryName) || {
    soc: 100,
    timestamp
  };

  const dt_s = Math.max(1, (timestamp - lastState.timestamp) / 1000);

  const soc_ocv = safeNum(socOCV(voltage_V));

  const kalmanSocResult = socEstimator.update({
    voltage_V,
    current_A,
    timestamp
  });

  const soc_kalman = safeNum(
    kalmanSocResult.soc ?? lastState.soc ?? 100
  );

  const soc_coulomb = safeNum(
    socCoulomb(soc_kalman, current_mA, dt_s, cfg.rated_Ah || 40)
  );

  const kalmanSohResult = sohEstimator.update(
    { voltage_V, current_A, timestamp },
    soc_ocv
  );

  let final_soh = safeNum(kalmanSohResult.soh_pct ?? 100);

  if (cfg.user_override_soh && typeof cfg.user_set_soh_pct === "number") {
    const w = Math.max(0, Math.min(1, cfg.user_soh_weight || 0.5));
    final_soh = w * cfg.user_set_soh_pct + (1 - w) * final_soh;
  }

  const estimated_Ah =
    current_A >= 0 ? safeNum(current_A * (dt_s / 3600)) : 0;

  const record = {
    timestamp,
    batteryName,
    voltage_V,
    current_A,
    power_W,
    estimated_Ah,
    soc_ocv,
    soc_coulomb,
    soc_kalman,
    soh_pct: final_soh
  };

  const saved = await Reading.create(record);

  await Battery.updateOne(
    { batteryName },
    {
      $set: {
        last_capacity_Ah: safeNum(kalmanSohResult.capacity_Ah || cfg.rated_Ah),
        last_soh_pct: final_soh,
        lastUpdated: new Date()
      }
    },
    { upsert: true }
  );

  lastStateMap.set(batteryName, {
    soc: soc_kalman,
    timestamp
  });

  return saved;
}