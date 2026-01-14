// controllers/rawWatcher.js
import RawReading from "../models/RawReading.js";
import Reading from "../models/Reading.js";
import { socOCV, socCoulomb } from "../utils/socAlgorithms.js";

let lastSOC = 100;
let lastTimestamp = null;

export const startRawWatcher = () => {
  console.log("Raw watcher active: polling raw_readings…");

  setInterval(async () => {
    try {
      const raw = await RawReading.findOne().sort({ timestamp: 1 });

      if (!raw) return;

      const voltage = raw.voltage_V;
      const currentA = raw.current_mA / 1000;
      const powerW = raw.power_mW / 1000;

      const now = new Date(raw.timestamp);
      const deltaSec = lastTimestamp ? (now - lastTimestamp) / 1000 : 1;
      lastTimestamp = now;

      // --- SOC ---
      const soc_ocv = socOCV(voltage);
      const soc_coulomb = socCoulomb(lastSOC, raw.current_mA, deltaSec);
      const soc_kalman = (soc_ocv + soc_coulomb) / 2;

      lastSOC = soc_kalman;

      // --- SoH quick model ---
      const soh_pct = 80 + (voltage - 12) * 5;

      // --- Build processed object ---
      const processed = {
        timestamp: raw.timestamp,
        batteryId: raw.batteryId || "Default Battery",
        voltage_V: voltage,
        current_A: currentA,
        power_W: powerW,

        estimated_Ah: voltage * currentA * 0.1,

        soc_ocv,
        soc_coulomb,
        soc_kalman,
        soh_pct
      };

      await Reading.create(processed);
      await RawReading.deleteOne({ _id: raw._id });

      console.log("Processed →", processed);

    } catch (err) {
      console.error("Raw watcher loop error:", err);
    }
  }, 1500);
};