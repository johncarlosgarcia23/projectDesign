// utils/kalmanSOC.js

import { socOCV } from "./socAlgorithms.js"; // must return % (0-100)

// KalmanSOC: 1-D SOC estimator with adaptive R (sliding window)
export class KalmanSOC {
  constructor({
    capacityAh = 40,      // battery capacity in Ah
    initialSOC = 100,     // percent
    initialP = 1,         // initial covariance
    Q = 1e-6,             // process noise power (per second). small default
    R_window = 30,        // sliding window size for innovation variance
  } = {}) {
    this.C = capacityAh;
    this.x = initialSOC;    // current SOC estimate (%)
    this.P = initialP;
    this.Q = Q;
    this.R_window = R_window;
    this.innovations = [];  // store recent innovations (z - x_prior)
    this.lastTs = null;
  }

  // call with reading: { voltage_V, current_A, timestamp: Date or ms }
  // returns updated { soc, P, K, R_estimated }
  update(reading) {
    const now = reading.timestamp ? new Date(reading.timestamp).getTime() : Date.now();
    const ts = this.lastTs || now;
    const dt = Math.max(1, (now - ts) / 1000); // seconds, min 1s to avoid zero

    // convert current to A (if provided in mA, user must pass A here)
    const I = reading.current_A ?? (reading.current_mA ? reading.current_mA / 1000 : 0);

    // 1) Predict step using Coulomb counting
    const deltaAh = (I * dt) / 3600.0; // Ah change (positive when charging)
    // convention: if current is positive for charging, SOC increases
    const x_prior = this.x + (deltaAh / this.C) * 100; // percent
    const P_prior = this.P + this.Q * dt;

    // 2) Measurement from OCV
    const z = socOCV(reading.voltage_V); // expects percent 0-100

    // 3) Innovation and adaptive R estimation
    const innovation = z - x_prior;
    this._pushInnovation(innovation);
    const R_est = this._estimateR();

    // 4) Kalman gain and update
    const K = P_prior / (P_prior + R_est);
    const x_post = x_prior + K * innovation;
    const P_post = (1 - K) * P_prior;

    // Persist
    this.x = Math.max(0, Math.min(100, x_post));
    this.P = Math.max(1e-9, P_post);
    this.lastTs = now;

    return {
      soc: this.x,
      P: this.P,
      K,
      R: R_est,
      z,
      x_prior,
      innovation,
      dt,
    };
  }

  _pushInnovation(nu) {
    this.innovations.push(nu);
    if (this.innovations.length > this.R_window) this.innovations.shift();
  }

  _estimateR() {
    if (this.innovations.length < 3) {
      return 0.5; // safe initial R (variance) in percent^2. Tweak if needed.
    }
    // sample variance
    const mean = this.innovations.reduce((a, b) => a + b, 0) / this.innovations.length;
    const s2 = this.innovations.reduce((a, b) => a + (b - mean) ** 2, 0) / (this.innovations.length - 1);
    // enforce minimum floor to avoid zero
    return Math.max(1e-4, s2);
  }
}