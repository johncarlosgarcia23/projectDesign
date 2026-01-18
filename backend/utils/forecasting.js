// utils/forecasting.js
// Provides:
// - forecastRemainingHours(readings): hours until empty (based on recent discharge power/A draw)
// - inferEffectiveCapacityAh(readings): estimates usable capacity (Ah) from discharge segments
// - estimateRelativeSOH(effectiveAh, nominalAh): capacity% proxy (not true SOH)

function toDate(v) {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

// Extract discharge-only readings, oldest->newest
function normalize(readings) {
  const arr = Array.isArray(readings) ? readings : [];
  const cleaned = arr
    .map((r) => ({
      timestamp: toDate(r.timestamp),
      current_A: n(r.current_A, 0),
      voltage_V: n(r.voltage_V, 0),
      soc_kalman: r.soc_kalman ?? r.soc_pct ?? r.soc ?? null,
      soc_ocv: r.soc_ocv ?? null,
      soc_coulomb: r.soc_coulomb ?? null,
    }))
    .filter((r) => r.timestamp);

  cleaned.sort((a, b) => a.timestamp - b.timestamp);
  return cleaned;
}

// Forecast hours left using recent discharge rate.
// Uses SOC% * nominalAh / avgDischargeA (simple, robust)
// If current SOC isn't in readings, caller should pass it separately (controller can use latest.soc_kalman)
export function forecastRemainingHours(
  readings,
  {
    currentSocPct = null,
    nominalAh = 40,
    windowMinutes = 30,
    minPoints = 6,
  } = {}
) {
  const data = normalize(readings);
  if (data.length < 2) return null;

  const latest = data[data.length - 1];

  const soc =
    currentSocPct ??
    (latest.soc_kalman ?? latest.soc_ocv ?? latest.soc_coulomb);

  const socPct = n(soc, NaN);
  if (!Number.isFinite(socPct) || socPct <= 0) return 0;

  const windowStart = new Date(latest.timestamp.getTime() - windowMinutes * 60_000);

  const windowed = data.filter(
    (r) => r.timestamp >= windowStart && r.current_A < -0.05
  );

  if (windowed.length < minPoints) return null;

  // Average discharge current magnitude
  const mags = windowed.map((r) => Math.abs(r.current_A)).filter((x) => x > 0);
  const avgA = mags.reduce((a, b) => a + b, 0) / mags.length;

  if (!Number.isFinite(avgA) || avgA <= 0) return Infinity;

  const remainingAh = (socPct / 100) * nominalAh;
  const hoursLeft = remainingAh / avgA;

  return Number.isFinite(hoursLeft) ? +hoursLeft.toFixed(2) : null;
}

// Estimate effective capacity (Ah) from discharge segments by integrating current over time
// across SOC drops. This gives usable capacity under observed load patterns.
// Requires SOC% in readings (soc_kalman preferred). If SOC is flat/missing, returns null.
export function inferEffectiveCapacityAh(
  readings,
  {
    socFieldPreference = ["soc_kalman", "soc_ocv", "soc_coulomb"],
    minSocDropPct = 10,
    minSegmentMinutes = 10,
    currentThresholdA = -0.05,
    maxLookbackHours = 48,
  } = {}
) {
  const data = normalize(readings);
  if (data.length < 2) return null;

  // choose SOC field dynamically per row
  const withSoc = data
    .map((r) => {
      let soc = null;
      for (const f of socFieldPreference) {
        if (f === "soc_kalman" && r.soc_kalman != null) { soc = r.soc_kalman; break; }
        if (f === "soc_ocv" && r.soc_ocv != null) { soc = r.soc_ocv; break; }
        if (f === "soc_coulomb" && r.soc_coulomb != null) { soc = r.soc_coulomb; break; }
      }
      const socPct = n(soc, NaN);
      return { ...r, socPct };
    })
    .filter((r) => Number.isFinite(r.socPct));

  if (withSoc.length < 2) return null;

  const latest = withSoc[withSoc.length - 1];
  const cutoff = new Date(latest.timestamp.getTime() - maxLookbackHours * 3600_000);
  const lookback = withSoc.filter((r) => r.timestamp >= cutoff);

  // Find a discharge segment with enough SOC drop
  // Strategy: scan forward and look for windows where SOC decreases by >= minSocDropPct
  let best = null;

  for (let i = 0; i < lookback.length - 1; i++) {
    const start = lookback[i];
    if (!Number.isFinite(start.socPct)) continue;

    for (let j = i + 1; j < lookback.length; j++) {
      const end = lookback[j];
      const socDrop = start.socPct - end.socPct; // drop is positive when discharging
      const dtMin = (end.timestamp - start.timestamp) / 60_000;

      if (dtMin < minSegmentMinutes) continue;
      if (socDrop < minSocDropPct) continue;

      // Integrate Ah over [i..j] using trapezoid on discharge-only samples
      let ah = 0;
      for (let k = i + 1; k <= j; k++) {
        const a = lookback[k - 1];
        const b = lookback[k];

        // consider only discharge; ignore charging intervals
        const ia = a.current_A;
        const ib = b.current_A;
        if (!(ia < currentThresholdA || ib < currentThresholdA)) continue;

        const dtH = (b.timestamp - a.timestamp) / 3_600_000;
        const avgA = (Math.abs(Math.min(0, ia)) + Math.abs(Math.min(0, ib))) / 2;
        ah += avgA * dtH;
      }

      if (!Number.isFinite(ah) || ah <= 0) continue;

      // effective capacity estimate from this segment:
      // capacity ≈ dischargedAh / (socDrop/100)
      const cap = ah / (socDrop / 100);

      const candidate = {
        start: start.timestamp,
        end: end.timestamp,
        socDropPct: socDrop,
        dischargedAh: ah,
        effectiveCapacityAh: cap,
      };

      // pick the best by largest SOC drop (more reliable), then longest segment
      if (
        !best ||
        candidate.socDropPct > best.socDropPct ||
        (candidate.socDropPct === best.socDropPct &&
          (candidate.end - candidate.start) > (best.end - best.start))
      ) {
        best = candidate;
      }
    }
  }

  if (!best) return null;

  // clamp to something sane (optional)
  const effectiveAh = best.effectiveCapacityAh;
  if (!Number.isFinite(effectiveAh) || effectiveAh <= 0) return null;

  return +effectiveAh.toFixed(2);
}

// Capacity% proxy relative to nominal rating.
// This is NOT true SOH; it is "capacity retention".
export function estimateRelativeSOH(effectiveAh, nominalAh) {
  const eff = n(effectiveAh, NaN);
  const nom = n(nominalAh, NaN);
  if (!Number.isFinite(eff) || !Number.isFinite(nom) || nom <= 0) return null;

  const pct = (eff / nom) * 100;
  // Keep in a sane range; real measurements can exceed nominal slightly
  const clamped = Math.max(0, Math.min(120, pct));
  return +clamped.toFixed(1);
}
