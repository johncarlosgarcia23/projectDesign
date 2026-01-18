// utils/socAlgorithms.js

const DEFAULT_CAPACITY_AH = 40;

// OCV -> approximate % (input in volts)
export function socOCV(voltage) {
  const soc = (voltage - 11.8) / (12.6 - 11.8);
  return Math.max(0, Math.min(100, soc * 100));
}

/**
 * Coulomb counting
 * Convention:
 *   current > 0  => charging  => SOC increases
 *   current < 0  => discharging => SOC decreases
 *
 * Inputs:
 *   prevSOC: percent (0..100)
 *   current_mA: milliamps (+charge / -discharge)
 *   deltaTime_s: seconds
 *   capacityAh: rated/effective capacity
 */
export function socCoulomb(prevSOC, current_mA, deltaTime_s, capacityAh = DEFAULT_CAPACITY_AH) {
  const currentA = current_mA / 1000;
  const deltaAh = (currentA * deltaTime_s) / 3600;

  // charging (+) increases SOC, discharging (-) decreases SOC
  const newSOC = prevSOC + (deltaAh / capacityAh) * 100;

  return Math.max(0, Math.min(100, newSOC));
}
