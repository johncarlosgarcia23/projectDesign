// utils/socAlgorithms.js

const DEFAULT_CAPACITY_AH = 40;

// OCV -> approximate % (input in volts)
export function socOCV(voltage) {
  // linear approx between 11.8 (0%) and 12.6 (100%)
  const soc = (voltage - 11.8) / (12.6 - 11.8);
  return Math.max(0, Math.min(100, soc * 100));
}

// Coulomb counting: prevSOC (percent), current_mA, deltaTime_s, capacityAh (optional)
export function socCoulomb(prevSOC, current_mA, deltaTime_s, capacityAh = DEFAULT_CAPACITY_AH) {
  const currentA = current_mA / 1000;
  const deltaAh = (currentA * deltaTime_s) / 3600;
  const newSOC = prevSOC - (deltaAh / capacityAh) * 100;
  return Math.max(0, Math.min(100, newSOC));
}