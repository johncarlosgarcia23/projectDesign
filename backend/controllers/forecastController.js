//forecastController.js
import Reading from "../models/Reading.js";
import {
  forecastRemainingHours,
  inferEffectiveCapacityAh,
  estimateRelativeSOH
} from "../utils/forecasting.js";

export const getBatteryForecast = async (req, res) => {
  try {
    const { battery } = req.query;

    const readings = await Reading.find({ batteryId: battery })
      .sort({ timestamp: -1 })
      .limit(300);

    const hoursLeft = forecastRemainingHours(readings);
    const effectiveAh = inferEffectiveCapacityAh(readings);
    const nominalAh = 40; // packaging value
    const soh = estimateRelativeSOH(effectiveAh, nominalAh);

    res.json({
      success: true,
      socHours: hoursLeft,
      effectiveCapacityAh: effectiveAh,
      sohRelativePct: soh
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
