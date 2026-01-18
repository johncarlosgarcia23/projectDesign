// controllers/forecastController.js
import Reading from "../models/Reading.js";
import {
  forecastRemainingHours,
  inferEffectiveCapacityAh,
  estimateRelativeSOH
} from "../utils/forecasting.js";

export const getBatteryForecast = async (req, res) => {
  try {
    const { battery } = req.query;
    if (!battery) {
      return res.status(400).json({ success: false, message: "battery is required" });
    }

    const readings = await Reading.find({ batteryId: battery })
      .sort({ timestamp: -1 })
      .limit(800)
      .lean();

    if (!readings.length) {
      return res.json({
        success: true,
        socHours: null,
        effectiveCapacityAh: null,
        capacityRetentionPct: null
      });
    }

    const latest = readings[0];
    const currentSocPct = latest.soc_kalman ?? latest.soc_ocv ?? latest.soc_coulomb ?? null;

    const nominalAh = 40; // packaging value (make this configurable later per battery)

    const socHours = forecastRemainingHours(readings, {
      currentSocPct,
      nominalAh,
      windowMinutes: 30
    });

    const effectiveCapacityAh = inferEffectiveCapacityAh(readings, {
      minSocDropPct: 10
    });

    const capacityRetentionPct = estimateRelativeSOH(effectiveCapacityAh, nominalAh);

    res.json({
      success: true,
      socHours,
      effectiveCapacityAh,
      capacityRetentionPct
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
