import Reading from "../models/Reading.js";

// Estimate remaining hours based on SoC and average discharge rate
export const forecastSocDuration = (currentSoc, readings, batteryCapacityAh = 100) => {
  if (!readings || readings.length < 2) return null;

  const dischargeRates = readings
    .map(r => r.current_A)
    .filter(c => c < 0)
    .map(c => Math.abs(c));

  const avgDischargeA = dischargeRates.length
    ? dischargeRates.reduce((a, b) => a + b, 0) / dischargeRates.length
    : 0;

  if (avgDischargeA === 0) return Infinity;

  const remainingAh = (currentSoc / 100) * batteryCapacityAh;
  const hoursLeft = remainingAh / avgDischargeA;

  return +hoursLeft.toFixed(2);
};

// Estimate SoH degradation rate (days until 0%)
export const forecastSohLifetime = (sohHistory) => {
  if (!sohHistory || sohHistory.length < 2) return null;

  const sorted = sohHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const daysElapsed = (new Date(last.timestamp) - new Date(first.timestamp)) / (1000 * 60 * 60 * 24);

  if (daysElapsed <= 0) return null;

  const sohDrop = first.soh_pct - last.soh_pct;
  const ratePerDay = sohDrop / daysElapsed;

  if (ratePerDay <= 0) return Infinity;

  const daysRemaining = last.soh_pct / ratePerDay;
  return +daysRemaining.toFixed(2);
};