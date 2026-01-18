import express from "express";
import Event from "../models/Event.js";

const router = express.Router();

// Log new event
router.post("/", async (req, res) => {
  try {
    const { batteryId, type, message, timestamp } = req.body;

    if (!batteryId || !type || !message) {
      return res.status(400).json({ error: "batteryId, type, message required" });
    }

    const event = await Event.create({
      batteryId,
      type,
      message,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all events
router.get("/", async (req, res) => {
  try {
    const { batteryId, limit = 200 } = req.query;
    const q = batteryId ? { batteryId } : {};
    const events = await Event.find(q).sort({ timestamp: -1 }).limit(Number(limit));
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
