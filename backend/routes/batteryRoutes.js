import express from "express";
import {
  setBatteryConfig,
  getBatteryConfig,
  updateBatteryConfig,
} from "../controllers/batteryController.js";

const router = express.Router();

router.post("/config", setBatteryConfig);
router.get("/:batteryId", getBatteryConfig);
router.put("/:batteryId", updateBatteryConfig); 

export default router;