import Reading from "../models/Reading.js";
import { forecastSocDuration, forecastSohLifetime } from "../utils/forecasting.js";

export const getForecastData = async (req, res) => {
  try {
    const batteryName = req.query.battery || "Battery_A";
    const recentReadings = await Reading.find({ batteryName })
      .sort({ timestamp: -1 })
      .limit(1000);

    if (!recentReadings.length) {
      return res.status(404).json({ message: "No readings found for forecast" });
    }

    const latest = recentReadings[0];
    const soc = latest.soc_kf ?? latest.soc_cc ?? latest.soc_ocv ?? latest.soc_pct ?? 100;
    const sohHistory = recentReadings.map(r => ({
      timestamp: r.timestamp,
      soh_pct: r.soh_pct ?? 100,
    }));

    const socHours = forecastSocDuration(soc, recentReadings);
    const sohDays = forecastSohLifetime(sohHistory);

    res.json({
      success: true,
      battery: batteryName,
      socHours,
      sohDays,
    });
  } catch (error) {
    console.error("Error in getForecastData:", error);
    res.status(500).json({ message: error.message });
  }
};