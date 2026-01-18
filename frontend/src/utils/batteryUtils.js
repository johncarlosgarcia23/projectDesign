// src/utils/batteryUtils.js
import React from "react";
import { api } from "./api";
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

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const getBatteryStatus = (battery) => {
  if (!battery) return "Standby";
  const current =
    Number.isFinite(Number(battery.current_A))
      ? Number(battery.current_A)
      : Number.isFinite(Number(battery.current_mA))
      ? Number(battery.current_mA) / 1000
      : 0;

  if (current > 0.5) return "Charging";
  if (current < -0.5) return "Supplying Load";
  return "Standby";
};

export const getBatteryIcon = (soc, color) => {
  const s = num(soc, 0);
  const iconColor =
    color ??
    (s >= 80
      ? "#282C35"
      : s >= 60
      ? "#333333"
      : s >= 40
      ? "#666666"
      : s >= 20
      ? "#999999"
      : "#cccccc");

  const sx = { fontSize: 40, color: iconColor };

  if (s >= 80) return <Battery6Bar sx={sx} />;
  if (s >= 60) return <Battery4Bar sx={sx} />;
  if (s >= 40) return <Battery2Bar sx={sx} />;
  if (s >= 20) return <Battery0Bar sx={sx} />;
  return <BatteryAlert sx={sx} />;
};

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

export const getBatterySoc = (battery, algorithm = "kalman") => {
  if (!battery) return 0;
  if (algorithm === "ocv") return num(battery.soc_ocv ?? battery.soc_pct, 0);
  if (algorithm === "coulomb") return num(battery.soc_coulomb ?? battery.soc_pct, 0);
  return num(battery.soc_kalman ?? battery.soc_pct, 0);
};

// Remove estimateAh unless you actually compute/serve duration_s or delta_t.
// Keeping it here but making it explicit:
export const estimateAhFromWindow = (avgCurrentA, windowSeconds) => {
  const I = num(avgCurrentA, 0);
  const tH = num(windowSeconds, 0) / 3600;
  return +(I * tH).toFixed(3);
};

export const fetchBatteryForecast = async (batteryName) => {
  try {
    const res = await api.get(`/api/forecast/battery`, {
      params: { battery: batteryName },
    });

    if (res.data?.success) {
      return {
        socHours: Number.isFinite(Number(res.data.socHours)) ? Math.round(res.data.socHours) : 0,
        // stop calling this "sohDays" unless backend truly returns a time-to-failure concept
        // if backend returns capacity/sohRelativePct, reflect that instead
        sohDays: Number.isFinite(Number(res.data.sohDays)) ? Math.round(res.data.sohDays) : 0,
      };
    }
    return { socHours: 0, sohDays: 0 };
  } catch (err) {
    console.error("Error fetching forecast:", err);
    return { socHours: 0, sohDays: 0 };
  }
};
