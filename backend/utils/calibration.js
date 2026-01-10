// utils/calibration.js
import { socOCV } from "./socAlgorithms.js";

export const calibrateReading = (data) => {
  const batteryId = data.batteryId || data.battery_id || "unknown";
  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
  const temperature_C = data.temperature_C ?? 0;

  const voltage_V = data.voltage_V ?? 0;
  const current_mA = data.current_mA ?? 0;
  const current_A = current_mA / 1000;

  const power_W = (typeof data.power_mW === "number" && data.power_mW !== 0)
    ? data.power_mW / 1000
    : voltage_V * current_A;

  // Noise threshold to avoid flipping on sensor noise (10 mA)
  const NOISE_THRESHOLD_A = 0.01;

  const isCharging = current_A > NOISE_THRESHOLD_A;
  const isDischarging = current_A < -NOISE_THRESHOLD_A;

  const charge_voltage_V = isCharging ? voltage_V : 0;
  const charge_current_A = isCharging ? current_A : 0;

  const discharge_voltage_V = isDischarging ? voltage_V : 0;
  const discharge_current_A = isDischarging ? Math.abs(current_A) : 0;

  const charge_state = isCharging ? "charging" : isDischarging ? "discharging" : "idle";

  const soc_ocv = socOCV(voltage_V);

  return {
    batteryId,
    timestamp,
    voltage_V,
    current_mA,
    current_A,
    power_W,
    temperature_C,

    // inferred per-direction fields (0 when not applicable)
    charge_voltage_V,
    charge_current_A,
    discharge_voltage_V,
    discharge_current_A,
    charge_state,

    soc_ocv,
  };
};