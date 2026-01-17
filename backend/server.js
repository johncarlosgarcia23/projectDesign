// server.js
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { startRawWatcher } from "./controllers/rawWatcher.js"; // <-- new import
import userRoutes from "./routes/userRoutes.js";
import sensorRoutes from "./routes/sensorRoutes.js";
import forecastRoutes from "./routes/forecastRoutes.js";
import Reading from "./models/Reading.js";
import eventRoutes from "./routes/eventRoutes.js";

const app = express();

// ---------- MIDDLEWARE SETUP ----------
app.use(cors({
  origin: [
    "https://project-design-orcin.vercel.app", //This is for the deployed frontend in Vercel
    "https://project-design-git-main-john-carlos-projects-1564928b.vercel.app", //Another domain in vercel
    "https://project-design-cruw4cmaw-john-carlos-projects-1564928b.vercel.app" //Another domain in vercel
  ],
  credentials: true
}));

//app.use(cors({ origin: "*" })); //This is for the mobile app
app.use(express.json());

// ---------- CONNECT TO MAIN MONGODB ----------
connectDB().then(() => {
  console.log("Connected to main database (microgridDB)");
  startRawWatcher(); // <-- Start automatic raw-to-processed pipeline
});

// ---------- ROUTE CONFIGURATION ----------
app.use("/api/users", userRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/events", eventRoutes);

// ---------- PROCESSED READINGS ROUTE ----------
// Fetch data from microgridDB.processed_readings (via Reading.js model)
app.get("/api/processed-readings", async (req, res) => {
  try {
    const { range, batteryName, algorithmType } = req.query;
    const query = {};

    // Apply battery and algorithm filters if present
    if (batteryName && batteryName !== "All") query.batteryName = batteryName;
    if (algorithmType && algorithmType !== "All") query.algorithmType = algorithmType;

    // Apply date filter if range=today
    if (range === "today") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query.timestamp = { $gte: startOfDay };
    }

    const readings = await Reading.find(query)
      .sort({ timestamp: -1 })
      .limit(1000);
    res.json(readings);
  } catch (err) {
    console.error("Error fetching processed readings:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- ROOT ENDPOINT ----------
app.get("/", (req, res) => {
  res.send("Microgrid API running...");
});

// ---------- START SERVER ----------
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
