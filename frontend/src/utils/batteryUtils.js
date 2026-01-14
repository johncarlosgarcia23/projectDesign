import React from "react";
import axios from "axios";
import {
  Battery6Bar,
  Battery4Bar,
  Battery2Bar,
  Battery0Bar,
  BatteryAlert,
  BatteryChargingFull,
  Power,
  CheckCircle,
} from "@mui/icons-material";

// Determine battery status based on current and optional SOC thresholds
export const getBatteryStatus = (battery) => {
  if (!battery) return "Standby";
  const current = battery.current_A ?? battery.current_mA / 1000 ?? 0;
  if (current > 0.5) return "Charging";
  if (current < -0.5) return "Supplying Load";
  return "Standby";
};

// Determine icon based on SOC value or custom color
export const getBatteryIcon = (soc, color) => {
  if (soc === undefined || soc === null) soc = 0;
  const iconColor =
    color ??
    (soc >= 80
      ? "#282C35"
      : soc >= 60
      ? "#333333"
      : soc >= 40
      ? "#666666"
      : soc >= 20
      ? "#999999"
      : "#cccccc");
  const sx = { fontSize: 40, color: iconColor };

  if (soc >= 80) return <Battery6Bar sx={sx} />;
  if (soc >= 60) return <Battery4Bar sx={sx} />;
  if (soc >= 40) return <Battery2Bar sx={sx} />;
  if (soc >= 20) return <Battery0Bar sx={sx} />;
  return <BatteryAlert sx={sx} />;
};

// Return small icon representing current battery status
export const getStatusIcon = (status) => {
  switch (status) {
    case "Charging":
      return <BatteryChargingFull sx={{ fontSize: 20, color: "#282C35" }} />;
    case "Supplying Load":
      return <Power sx={{ fontSize: 20, color: "#333333" }} />;
    default:
      return <CheckCircle sx={{ fontSize: 20, color: "#666666" }} />;
  }
};

// Retrieve SOC from all algorithms consistently
export const getBatterySoc = (battery, algorithm = "kalman") => {
  if (!battery) return 0;
  switch (algorithm) {
    case "ocv":
      return battery.soc_ocv ?? battery.soc_pct ?? 0;
    case "coulomb":
      return battery.soc_coulomb ?? battery.soc_pct ?? 0;
    case "kalman":
    default:
      return battery.soc_kalman ?? battery.soc_pct ?? 0;
  }
};

// Estimate Ah from voltage/current data
export const estimateAh = (battery) => {
  if (!battery) return 0;
  const current = battery.current_A ?? battery.current_mA / 1000 ?? 0;
  //const voltage = battery.voltage_V ?? 0; // Voltage not used in Ah calc
  const timeHours = (battery.duration_s ?? 0) / 3600;
  return +(current * timeHours).toFixed(3);
};

// Fetch live forecast data (SoC hours + SoH days) ----
export const fetchBatteryForecast = async (batteryName) => {
  try {
    const res = await axios.get(
      `http://localhost:5000/api/forecast/battery?battery=${batteryName}`
    );
    if (res.data && res.data.success) {
      return {
        socHours: Math.round(res.data.socHours || 0),
        sohDays: Math.round(res.data.sohDays || 0),
      };
    }
    return { socHours: 0, sohDays: 0 };
  } catch (err) {
    console.error("Error fetching forecast:", err);
    return { socHours: 0, sohDays: 0 };
  }
};