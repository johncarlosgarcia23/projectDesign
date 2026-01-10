import express from "express";
import { getForecastData } from "../controllers/forecastController.js";

const router = express.Router();

router.get("/battery", getForecastData);

export default router;