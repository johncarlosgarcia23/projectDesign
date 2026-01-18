// mockDataUploaderDirect.js
// Purpose: Upload filtered battery CSV data to raw_readings via backend API
import fs from "fs";
import csv from "csv-parser";
import axios from "axios";
import { performance } from "perf_hooks";

const API_URL = "http://localhost:5000/api/sensors/process"; // send processed readings here
const FILE_PATH = "./filtered_battery_data.csv"; // same folder as server.js
const BATTERY_CAPACITY_AH = 40; // default if unknown

// ---------- SOC Algorithms ----------
function socFromOCV(voltage) {
  if (voltage >= 12.6) return 100;
  if (voltage <= 11.8) return 0;
  return ((voltage - 11.8) / (12.6 - 11.8)) * 100;
}

let previousSoC_CC = 100;
function socFromCoulomb(current, deltaTime) {
  const deltaAh = (current * deltaTime) / 3600;
  previousSoC_CC -= (deltaAh / BATTERY_CAPACITY_AH) * 100;
  previousSoC_CC = Math.max(0, Math.min(100, previousSoC_CC));
  return previousSoC_CC;
}

let socKF = 100;
let P = 1,
  Q = 0.01,
  R = 0.1;
function socFromKalman(voltage, current, deltaTime) {
  const socPredict = socKF - (current * deltaTime) / (BATTERY_CAPACITY_AH * 3600);
  P += Q;
  const K = P / (P + R);
  socKF = socPredict + K * (socFromOCV(voltage) - socPredict);
  P *= 1 - K;
  socKF = Math.max(0, Math.min(100, socKF));
  return socKF;
}

// ---------- Transform CSV row ----------
function transformRow(row, deltaTime) {
  const voltage = parseFloat(row.voltage_V) || 0;
  const current = parseFloat(row.current_A) || 0;

  const soc_ocv = socFromOCV(voltage);
  const soc_cc = socFromCoulomb(current, deltaTime);
  const soc_kf = socFromKalman(voltage, current, deltaTime);

  return {
    batteryId: row.batteryId || "Default Battery",
    timestamp: new Date(row.timestamp),
    voltage_V: voltage,
    current_mA: current * 1000, // backend expects mA
    power_mW: voltage * current * 1000, // mW
    soc_ocv,
    soc_coulomb: soc_cc,
    soc_kalman: soc_kf
  };
}

// ---------- Main uploader ----------
async function uploadData() {
  const rows = [];
  fs.createReadStream(FILE_PATH)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      console.log(`Loaded ${rows.length} rows. Starting upload...`);

      const deltaTime = 5; // assume 5 seconds between readings
      let startTimeGlobal = performance.now();

      for (const [i, row] of rows.entries()) {
        const payload = transformRow(row, deltaTime);
        try {
          await axios.post(API_URL, payload);
          console.log(
            `Uploaded ${i + 1}/${rows.length} → Battery ${payload.batteryId}, V=${payload.voltage_V}, I=${payload.current_mA /
              1000}, SoC_KF=${payload.soc_kalman.toFixed(2)}%`
          );
        } catch (err) {
          console.error("Upload failed:", err.message);
        }
      }

      const endTimeGlobal = performance.now();
      console.log(`✅ Finished uploading ${rows.length} rows in ${(endTimeGlobal - startTimeGlobal).toFixed(2)} ms`);
    });
}

uploadData();
