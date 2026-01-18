import express from "express";
import { getBatteryForecast } from "../controllers/forecastController.js";

const router = express.Router();

router.get("/battery", getBatteryForecast);

export default router;
