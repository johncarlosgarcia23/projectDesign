// routes/sensorRoutes.js
import express from "express";
import {
  processReadings,
  getProcessedReadings,
  migrateRawReadings
} from "../controllers/sensorController.js";
import RawReading from "../models/RawReading.js";

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

export default router;