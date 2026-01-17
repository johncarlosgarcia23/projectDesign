// forecasting.js
import Reading from "../models/Reading.js";

//Estimate remaining discharge time using recent energy flow
//This uses Ah integration over time, not raw current
export const forecastSocDuration = (
  currentSoc,
  readings,
  ratedCapacityAh = 100,
  windowHours = 2
) => {
  if (!readings || readings.length < 2 || currentSoc <= 0) return null;

  // Sort chronologically
  const sorted = readings
    .filter(r => r.batteryCurrent_A !== undefined)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const now = new Date(sorted.at(-1).timestamp);
  const windowStart = new Date(now.getTime() - windowHours * 3600 * 1000);

  // Use only recent discharge window
  const windowed = sorted.filter(
    r => new Date(r.timestamp) >= windowStart && r.batteryCurrent_A < 0
  );

  if (windowed.length < 2) return null;

  let dischargedAh = 0;

  for (let i = 1; i < windowed.length; i++) {
    const prev = windowed[i - 1];
    const curr = windowed[i];

    const dtHours =
      (new Date(curr.timestamp) - new Date(prev.timestamp)) / 3.6e6;

    const avgCurrent =
      (Math.abs(prev.batteryCurrent_A) + Math.abs(curr.batteryCurrent_A)) / 2;

    dischargedAh += avgCurrent * dtHours;
  }

  if (dischargedAh <= 0) return Infinity;

  const effectiveRateA = dischargedAh / windowHours;
  const remainingAh = (currentSoc / 100) * ratedCapacityAh;

  return +(remainingAh / effectiveRateA).toFixed(2);
};

//Estimate effective capacity ratio (capacity retention)
export const estimateCapacityRetention = (
  readings,
  ratedCapacityAh = 100,
  socDropThreshold = 10
) => {
  if (!readings || readings.length < 2) return null;

  const sorted = readings
    .filter(r => r.batterySOC_pct !== undefined)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let startIndex = null;
  let endIndex = null;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].batterySOC_pct <= 100 - socDropThreshold) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === null) return null;

  endIndex = sorted.length - 1;

  let dischargedAh = 0;

  for (let i = startIndex + 1; i <= endIndex; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (prev.batteryCurrent_A >= 0) continue;

    const dtHours =
      (new Date(curr.timestamp) - new Date(prev.timestamp)) / 3.6e6;

    const avgCurrent =
      (Math.abs(prev.batteryCurrent_A) + Math.abs(curr.batteryCurrent_A)) / 2;

    dischargedAh += avgCurrent * dtHours;
  }

  const expectedAh = (socDropThreshold / 100) * ratedCapacityAh;

  if (expectedAh <= 0) return null;

  return +(dischargedAh / expectedAh).toFixed(3);
};

//Long-term degradation trend based on capacity retention history
export const forecastCapacityFade = (capacityHistory) => {
  if (!capacityHistory || capacityHistory.length < 2) return null;

  const sorted = capacityHistory.sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  const first = sorted[0];
  const last = sorted.at(-1);

  const daysElapsed =
    (new Date(last.timestamp) - new Date(first.timestamp)) / 8.64e7;

  if (daysElapsed <= 0) return null;

  const drop = first.capacityRatio - last.capacityRatio;

  if (drop <= 0) return Infinity;

  const dailyFade = drop / daysElapsed;
  const remaining = last.capacityRatio / dailyFade;

  return +remaining.toFixed(1); // days until effective capacity → zero
};
