// utils/kalmanSOC.js
//SOC is a relative state (%), not absolute truth
//Capacity is an effective scaling factor, not real Ah
import { socOCV } from "./socAlgorithms.js";

export class KalmanSOC {
  constructor({
    capacityAh = 40,          // effective capacity (scaling only)
    initialSOC = 100,
    initialP = 4,             // higher initial uncertainty
    Q_base = 1e-5,            // base process noise
    R_min = 0.5,              // minimum measurement variance (%^2)
    restCurrentA = 0.2,       // threshold to trust OCV
    R_window = 30,
  } = {}) {
    this.C = capacityAh;
    this.x = initialSOC;
    this.P = initialP;

    this.Q_base = Q_base;
    this.R_min = R_min;
    this.restCurrentA = restCurrentA;

    this.R_window = R_window;
    this.innovations = [];
    this.lastTs = null;
  }

  update(reading) {
    const now = new Date(reading.timestamp).getTime();
    const prevTs = this.lastTs ?? now;
    const dt = Math.max(1, (now - prevTs) / 1000); // seconds

    const I = reading.current_A ?? 0;
    const V = reading.voltage_V;

    /* ---------- PREDICT (Coulomb counting) ---------- */

    const deltaAh = (I * dt) / 3600;
    let x_prior = this.x + (deltaAh / this.C) * 100;

    // Clamp early to avoid numeric blow-up
    x_prior = Math.max(0, Math.min(100, x_prior));

    // Process noise scales with current magnitude
    const Q = this.Q_base * (1 + Math.abs(I));
    const P_prior = this.P + Q * dt;

    /* ---------- MEASUREMENT (OCV, gated) ---------- */

    let useMeasurement = false;
    let z = null;

    if (
      Math.abs(I) <= this.restCurrentA &&
      V > 10 && V < 16
    ) {
      z = socOCV(V);
      useMeasurement = Number.isFinite(z);
    }

    /* ---------- UPDATE ---------- */

    let x_post = x_prior;
    let P_post = P_prior;
    let K = 0;
    let R = null;
    let innovation = null;

    if (useMeasurement) {
      innovation = z - x_prior;
      this._pushInnovation(innovation);
      R = this._estimateR();

      K = P_prior / (P_prior + R);
      x_post = x_prior + K * innovation;
      P_post = (1 - K) * P_prior;
    }

    /* ---------- FINALIZE ---------- */

    this.x = Math.max(0, Math.min(100, x_post));
    this.P = Math.max(1e-6, P_post);
    this.lastTs = now;

    return {
      soc: this.x,
      P: this.P,
      K,
      R,
      usedMeasurement: useMeasurement,
      dt,
    };
  }

  _pushInnovation(nu) {
    this.innovations.push(nu);
    if (this.innovations.length > this.R_window) {
      this.innovations.shift();
    }
  }

  _estimateR() {
    if (this.innovations.length < 5) {
      return this.R_min;
    }

    const mean =
      this.innovations.reduce((a, b) => a + b, 0) /
      this.innovations.length;

    const variance =
      this.innovations.reduce(
        (a, b) => a + (b - mean) ** 2,
        0
      ) /
      (this.innovations.length - 1);

    return Math.max(this.R_min, variance);
  }
}
