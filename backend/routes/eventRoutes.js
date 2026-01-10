import express from "express";
import Event from "../models/Event.js";

const router = express.Router();

// Log new event
router.post("/", async (req, res) => {
  try {
    const { batteryName } = req.body;
    if (!batteryName) return res.status(400).json({ error: "batteryName required" });

    const event = await Event.create({ batteryName });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch all events
router.get("/", async (req, res) => {
  try {
    const events = await Event.find().sort({ connectedAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;