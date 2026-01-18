// utils/socAlgorithms.js
const DEFAULT_CAPACITY_AH = 40;

// OCV -> approximate % (input in volts)
export function socOCV(voltage) {
  const soc = (voltage - 11.8) / (12.6 - 11.8);
  return Math.max(0, Math.min(100, soc * 100));
}

// Coulomb counting (AMPS):
// current_A: + charging, - discharging
export function socCoulomb(prevSOC, current_A, deltaTime_s, capacityAh = DEFAULT_CAPACITY_AH) {
  const I = Number(current_A) || 0;
  const dt = Number(deltaTime_s) || 0;

  const deltaAh = (I * dt) / 3600;                 // negative on discharge
  const newSOC = prevSOC + (deltaAh / capacityAh) * 100; // discharge decreases SOC

  return Math.max(0, Math.min(100, newSOC));
}
