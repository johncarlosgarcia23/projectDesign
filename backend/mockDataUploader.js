// mockDataUploader.js
// Purpose: Upload calibrated battery data while computing SoC using OCV, Coulomb Counting, and Kalman Filter algorithms.
//           Evaluate all three based on constraints: Accuracy (Error Index), Economic (File Size), Performance (Execution Time),
//           Safety (RAM Usage), Efficiency (Power Consumption).
// Dataset:  D:\Project Design\Codes\backend\Batt_IV_Data_100Ah_071116_FINAL_VM_ACM.csv

import fs from "fs";
import csv from "csv-parser";
import axios from "axios";
import os from "os";
import { performance } from "perf_hooks";

const API_URL = "http://localhost:4000/data";
const FILE_PATH = "D:/Project Design/Codes/backend/Batt_IV_Data_100Ah_071116_FINAL_VM_ACM.csv";
const BATTERY_CAPACITY_AH = 100;
const NOMINAL_VOLTAGE = 12.6;

// ---------- SOC ALGORITHMS ----------

// 1. Open Circuit Voltage (OCV) Method
function socFromOCV(voltage) {
  if (voltage >= 12.6) return 100;
  if (voltage <= 11.8) return 0;
  return ((voltage - 11.8) / (12.6 - 11.8)) * 100;
}

// 2. Coulomb Counting Method
let previousSoC_CC = 100;
function socFromCoulomb(current, deltaTime) {
  const deltaAh = (current * deltaTime) / 3600;
  previousSoC_CC -= (deltaAh / BATTERY_CAPACITY_AH) * 100;
  previousSoC_CC = Math.max(0, Math.min(100, previousSoC_CC));
  return previousSoC_CC;
}

// 3. Kalman Filter Method
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

// ---------- TRANSFORMATION ----------
function transformRow(row, batteryId, deltaTime) {
  const V = parseFloat(row["Voltage (Calibrated)"]) || 0;
  const I = parseFloat(row["Current (Calibrated)"]) || 0;
  const T = parseFloat(row["Battery Temp (Calibrated)"]) || 25;

  const soc_ocv = socFromOCV(V);
  const soc_cc = socFromCoulomb(I, deltaTime);
  const soc_kf = socFromKalman(V, I, deltaTime);

  return {
    deviceId: "Device1",
    batteryId,
    timestamp: new Date().toISOString(),
    voltage_V: V,
    current_A: I,
    temperature_C: T,
    soc_ocv,
    soc_cc,
    soc_kf,
  };
}

// ---------- CONSTRAINTS EVALUATION ----------
let socComparisons = [];
let totalExecutionTime = 0;
let startTimeGlobal = performance.now();

function evaluateConstraints(socData) {
  // Accuracy — Mean Absolute Error between algorithms
  const errors = socData.map((d) => {
    const meanSOC = (d.soc_ocv + d.soc_cc + d.soc_kf) / 3;
    return {
      ocvError: Math.abs(d.soc_ocv - meanSOC),
      ccError: Math.abs(d.soc_cc - meanSOC),
      kfError: Math.abs(d.soc_kf - meanSOC),
    };
  });

  const avgError = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const ocvErr = avgError(errors.map((e) => e.ocvError));
  const ccErr = avgError(errors.map((e) => e.ccError));
  const kfErr = avgError(errors.map((e) => e.kfError));

  // Economic — File Size
  const fileSizeKB = fs.statSync(FILE_PATH).size / 1024;

  // Performance — Execution Time
  const endTimeGlobal = performance.now();
  totalExecutionTime = endTimeGlobal - startTimeGlobal;

  // Safety — RAM Usage
  const memoryUsageMB = process.memoryUsage().rss / (1024 * 1024);

  // Efficiency — Power Consumption (proxy via CPU time)
  const cpuLoad = os.loadavg()[0]; // 1-min average

  console.log("\n=== SoC Algorithm Comparison and Constraint Evaluation ===");
  console.log(`Accuracy (Error Index):`);
  console.log(`  OCV Mean Error: ${ocvErr.toFixed(4)}%`);
  console.log(`  Coulomb Mean Error: ${ccErr.toFixed(4)}%`);
  console.log(`  Kalman Mean Error: ${kfErr.toFixed(4)}%`);
  console.log(`Economic (File Size): ${fileSizeKB.toFixed(2)} KB`);
  console.log(`Performance (Execution Time): ${totalExecutionTime.toFixed(2)} ms`);
  console.log(`Safety (RAM Usage): ${memoryUsageMB.toFixed(2)} MB`);
  console.log(`Efficiency (CPU Load Proxy): ${cpuLoad.toFixed(2)}\n`);

  // Determine best performer
  const bestAccuracy = Math.min(ocvErr, ccErr, kfErr);
  let best = "";
  if (bestAccuracy === ocvErr) best = "OCV Method";
  else if (bestAccuracy === ccErr) best = "Coulomb Counting";
  else best = "Kalman Filter";

  console.log(`→ Best Overall Accuracy: ${best}`);
}

// ---------- MAIN UPLOADER ----------
async function uploadData() {
  const rows = [];
  fs.createReadStream(FILE_PATH)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      console.log(`Loaded ${rows.length} rows. Starting upload simulation...`);
      let batteryToggle = true;

      for (const [i, row] of rows.entries()) {
        const batteryId = batteryToggle ? "A" : "B";
        batteryToggle = !batteryToggle;
        const deltaTime = 5; // 5 seconds between measurements

        const tStart = performance.now();
        const payload = transformRow(row, batteryId, deltaTime);
        const tEnd = performance.now();
        totalExecutionTime += tEnd - tStart;

        socComparisons.push({
          soc_ocv: payload.soc_ocv,
          soc_cc: payload.soc_cc,
          soc_kf: payload.soc_kf,
        });

        try {
          await axios.post(API_URL, payload);
          console.log(
            `Uploaded row ${i + 1}/${rows.length} → Battery ${batteryId}: V=${payload.voltage_V.toFixed(
              3
            )}, I=${payload.current_A.toFixed(3)}, T=${payload.temperature_C.toFixed(
              2
            )}, SoC_OCV=${payload.soc_ocv.toFixed(2)}%, SoC_CC=${payload.soc_cc.toFixed(
              2
            )}%, SoC_KF=${payload.soc_kf.toFixed(2)}%`
          );
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err) {
          console.error("Upload failed:", err.message);
        }
      }

      evaluateConstraints(socComparisons);
      console.log("✅ Data upload and analysis complete.");
    });
}

uploadData();
