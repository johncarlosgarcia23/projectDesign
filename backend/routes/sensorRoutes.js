// routes/sensorRoutes.js
import express from "express";
import {
  processReadings,
  getProcessedReadings,
  migrateRawReadings
} from "../controllers/sensorController.js";
import RawReading from "../models/RawReading.js";
import Battery from "../models/Battery.js";

const router = express.Router();

router.post("/process", processReadings);
router.get("/processed", getProcessedReadings);
router.post("/migrate", migrateRawReadings);

// Accept raw sensor data
router.post("/raw", async (req, res) => {
  try {
    const saved = await RawReading.create(req.body);
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// list battery configs
router.get("/batteries", async (req, res) => {
  try {
    const list = await Battery.find().sort({ batteryName: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// upsert battery config
router.put("/batteries/:batteryId", async (req, res) => {
  try {
    const batteryId = req.params.batteryId;
    const {
      batteryName,
      rated_Ah,
      user_set_soh_pct,
      soc_algorithm,
    } = req.body;

    const doc = await Battery.findOneAndUpdate(
      { batteryName: batteryId },
      {
        $set: {
          batteryName: batteryName ?? batteryId,
          rated_Ah: Number.isFinite(Number(rated_Ah)) ? Number(rated_Ah) : 40,
          user_set_soh_pct: Number.isFinite(Number(user_set_soh_pct)) ? Number(user_set_soh_pct) : 100,
          soc_algorithm: soc_algorithm ?? "kalman",
        },
      },
      { new: true, upsert: true }
    );

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
