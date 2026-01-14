// controllers/batteryController.js
import Battery from "../models/Battery.js";

export const setBatteryConfig = async (req, res) => {
  const {
    batteryId,
    name,
    rated_Ah, // new field from frontend
    user_set_soh_pct,
    user_override_soh,
    user_soh_weight,
  } = req.body;

  try {
    const cfg = await Battery.findOneAndUpdate(
      { batteryId },
      {
        $set: {
          name,
          rated_Ah, // store base Ah
          user_set_soh_pct,
          user_override_soh: user_override_soh ?? false,
          user_soh_weight: user_soh_weight ?? 0.7,
          lastUpdated: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json(cfg);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getBatteryConfig = async (req, res) => {
  try {
    const batteryId = req.params.batteryId;
    const cfg = await Battery.findOne({ batteryId });
    res.json(cfg);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};