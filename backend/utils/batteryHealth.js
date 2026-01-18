// backend/utils/batteryHealth.js
// Stateful SoH + cycle model (battery-level), updated per reading using timestamp deltas.
//
// Concepts:
// - SoH is capacity retention: effective_capacity_Ah / rated_Ah * 100
// - effective_capacity_Ah degrades slowly with discharged Ah and discharge time.
// - cycle_count increments when cumulative discharged Ah since last "reset" reaches rated_Ah.
//
// Notes:
// - Uses timestamp deltas per battery (dt computed in rawWatcher; also re-checked here defensively).
// - Keeps degradation stable and monotonic.
// - Adds optional event triggers (cycle completed, SOH thresholds).

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function initBatteryHealthDefaults(batteryDoc, { ratedAhFallback = 40 } = {}) {
  const rated_Ah = num(batteryDoc?.rated_Ah, ratedAhFallback);

  // Start effective capacity at rated if missing
  const effective_capacity_Ah =
    batteryDoc?.effective_capacity_Ah == null
      ? rated_Ah
      : num(batteryDoc.effective_capacity_Ah, rated_Ah);

  // Start counters at 0 if missing
  const total_discharged_Ah = num(batteryDoc?.total_discharged_Ah, 0);
  const discharge_cycle_ah = num(batteryDoc?.discharge_cycle_ah, 0);
  const cycle_count = Math.max(0, Math.floor(num(batteryDoc?.cycle_count, 0)));

  // last_timestamp used to compute dt if caller doesn't provide it
  const last_timestamp = batteryDoc?.last_timestamp ? new Date(batteryDoc.last_timestamp) : null;

  // Derived SoH
  const soh_pct = clamp((effective_capacity_Ah / rated_Ah) * 100, 0, 120);

  return {
    rated_Ah,
    effective_capacity_Ah,
    total_discharged_Ah,
    discharge_cycle_ah,
    cycle_count,
    soh_pct,
    last_timestamp,
  };
}

/**
 * Apply degradation + cycle counting for one reading.
 *
 * Inputs:
 * - batteryState: object from initBatteryHealthDefaults (or from DB)
 * - reading: { timestamp, current_A }
 * - opts: tuning parameters
 *
 * Returns:
 * - next: updated batteryState fields (battery-level)
 * - derived: useful derived values for logs/processed_readings
 * - events: array of { type, message } to write to Event collection (optional)
 */
export function applyBatteryHealthUpdate(
  batteryState,
  reading,
  {
    // Degradation tuning:
    // Goal example: ~20% capacity loss after ~500 full cycles.
    // That implies loss per discharged Ah ≈ 0.20 / (ratedAh * 500) of ratedAh per Ah.
    // Translating to Ah capacity loss:
    // capacity_loss_Ah_per_discharged_Ah = 0.20 / 500 = 0.0004 Ah loss per 1 Ah discharged (independent of ratedAh).
    // This is intentionally conservative and stable.
    lossAhPerDischargedAh = 0.0004,

    // Additional time-based loss while discharging (calendar / stress proxy).
    // Example: 0.00001 Ah per hour discharging (very small).
    lossAhPerDischargeHour = 0.00001,

    // When do we consider discharge happening?
    dischargeThresholdA = -0.05,

    // Floors/limits:
    minSoHPct = 70, // do not degrade below 70% unless you want to
    maxSoHPct = 100,

    // Event thresholds:
    emitCycleEvent = true,
    emitSohThresholdEvents = true,
    sohWarnPct = 80,
    sohCriticalPct = 70,
  } = {}
) {
  const events = [];

  const ratedAh = num(batteryState.rated_Ah, 40);

  const ts = new Date(reading.timestamp);
  const nowMs = ts.getTime();
  const prevMs = batteryState.last_timestamp ? new Date(batteryState.last_timestamp).getTime() : nowMs;
  const dt_s = Math.max(1, (nowMs - prevMs) / 1000);

  const I = num(reading.current_A, 0);

  // Only degrade and count cycles on discharge
  const isDischarging = I < dischargeThresholdA;

  let dischargedAhThisStep = 0;
  if (isDischarging) {
    dischargedAhThisStep = Math.abs(I) * (dt_s / 3600);
  }

  // Update totals
  let totalDischarged = num(batteryState.total_discharged_Ah, 0) + dischargedAhThisStep;

  // Cycle accumulator (discharged Ah towards a full cycle)
  let cycleAh = num(batteryState.discharge_cycle_ah, 0) + dischargedAhThisStep;
  let cycleCount = Math.max(0, Math.floor(num(batteryState.cycle_count, 0)));

  // Count completed cycles (can complete multiple if dt is big)
  if (cycleAh >= ratedAh && ratedAh > 0) {
    const completed = Math.floor(cycleAh / ratedAh);
    cycleCount += completed;
    cycleAh = cycleAh - completed * ratedAh;

    if (emitCycleEvent) {
      events.push({
        type: "CYCLE_COMPLETED",
        message: `Completed ${completed} cycle(s). Total cycles: ${cycleCount}`,
      });
    }
  }

  // Apply degradation to effective capacity
  let effAh = num(batteryState.effective_capacity_Ah, ratedAh);

  if (isDischarging && dischargedAhThisStep > 0) {
    const dischargeHours = dt_s / 3600;

    const lossFromAh = dischargedAhThisStep * lossAhPerDischargedAh;
    const lossFromTime = dischargeHours * lossAhPerDischargeHour;

    effAh = effAh - (lossFromAh + lossFromTime);
  }

  // Clamp effective capacity to floor
  const minEffAh = (ratedAh * minSoHPct) / 100;
  const maxEffAh = (ratedAh * maxSoHPct) / 100;

  effAh = clamp(effAh, minEffAh, maxEffAh);

  const sohPct = clamp((effAh / ratedAh) * 100, 0, 120);

  if (emitSohThresholdEvents) {
    const prevSoh = num(batteryState.soh_pct, 100);

    // Edge-trigger warnings
    if (prevSoh >= sohWarnPct && sohPct < sohWarnPct) {
      events.push({
        type: "SOH_WARN",
        message: `SoH dropped below ${sohWarnPct}% (now ${sohPct.toFixed(1)}%)`,
      });
    }
    if (prevSoh >= sohCriticalPct && sohPct < sohCriticalPct) {
      events.push({
        type: "SOH_CRITICAL",
        message: `SoH dropped below ${sohCriticalPct}% (now ${sohPct.toFixed(1)}%)`,
      });
    }
  }

  const next = {
    rated_Ah: ratedAh,
    effective_capacity_Ah: effAh,
    soh_pct: sohPct,
    total_discharged_Ah: totalDischarged,
    discharge_cycle_ah: cycleAh,
    cycle_count: cycleCount,
    last_timestamp: ts,
  };

  const derived = {
    dt_s,
    dischargedAhThisStep,
    isDischarging,
  };

  return { next, derived, events };
}

/**
 * Helper: convert remaining capacity to time-to-empty based on current discharge.
 * Returns:
 * - null if not discharging
 * - Infinity if discharge current is ~0
 * - hours (number) otherwise
 */
export function estimateTimeToEmptyFromAh(remainingAh, current_A, { dischargeThresholdA = -0.05 } = {}) {
  const I = num(current_A, 0);
  if (I >= dischargeThresholdA) return null;

  const mag = Math.abs(I);
  if (mag <= 1e-9) return Infinity;

  const hours = num(remainingAh, 0) / mag;
  return Number.isFinite(hours) ? hours : null;
}
