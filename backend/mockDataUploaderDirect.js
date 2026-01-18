// mockDataUploaderDirect.js
// Upload filtered_battery_data.csv directly to raw_readings via backend API

import fs from "fs";
import csv from "csv-parser";
import axios from "axios";
import { performance } from "perf_hooks";

const API_URL = "http://localhost:5000/api/sensors/process"; // backend endpoint
const FILE_PATH = "./filtered_battery_data.csv"; // CSV in backend folder

// ---------- Main uploader ----------
async function uploadData() {
  const rows = [];
  fs.createReadStream(FILE_PATH)
    .pipe(csv())
    .on("data", (row) => {
      // push only relevant columns for RawReading
      if (row.timestamp && row.batteryId && row.voltage_V && row.current_A) {
        rows.push({
          timestamp: new Date(row.timestamp),
          batteryId: row.batteryId,
          voltage_V: parseFloat(row.voltage_V),
          current_A: parseFloat(row.current_A)
        });
      }
    })
    .on("end", async () => {
      console.log(`Loaded ${rows.length} rows. Starting upload...`);

      const startTimeGlobal = performance.now();

      for (const [i, payload] of rows.entries()) {
        try {
          await axios.post(API_URL, payload);
          console.log(
            `Uploaded ${i + 1}/${rows.length} → Battery ${payload.batteryId}, V=${payload.voltage_V}, I=${payload.current_A}`
          );
        } catch (err) {
          console.error(`Upload failed for row ${i + 1}:`, err.message);
        }
      }

      const endTimeGlobal = performance.now();
      console.log(`✅ Finished uploading ${rows.length} rows in ${(endTimeGlobal - startTimeGlobal).toFixed(2)} ms`);
    });
}

uploadData();
