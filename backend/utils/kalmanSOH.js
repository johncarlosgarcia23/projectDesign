// utils/kalmanSOH.js
import { socOCV } from "./socAlgorithms.js";

export class KalmanSOH {
  constructor({
    ratedCapacityAh = 40,
    initialCapacityAh = null,
    initialP = 1,
    Q = 1e-6,         // process noise for capacity (Ah^2 / s)
    R_min = 1e-4,    // minimum measurement noise (percent^2)
    R_window = 30,
  } = {}) {
    this.Cr = ratedCapacityAh;
    this.C = initialCapacityAh ?? ratedCapacityAh; // current capacity estimate (Ah)
    this.P = initialP;
    this.Q = Q;
    this.R_window = R_window;
    this.innovations = [];
    this.lastTs = null;
    this.lastSOC = null;
  }

  // reading: { voltage_V, current_A, timestamp }
  // measuredOCVpercent: socOCV(voltage) result (0-100)
  update(reading, measuredOCVpercent) {
    const now = reading.timestamp ? new Date(reading.timestamp).getTime() : Date.now();
    const ts = this.lastTs || now;
    const dt = Math.max(1, (now - ts) / 1000); // seconds

    const I = reading.current_A ?? (reading.current_mA ? reading.current_mA / 1000 : 0);

    // predict step: capacity assumed to drift slowly (random walk)
    const C_prior = this.C;
    const P_prior = this.P + this.Q * dt;

    // predict SOC using Coulomb counting with C_prior
    const deltaAh = (I * dt) / 3600.0; // Ah (positive when charging)
    // if lastSOC missing, use measuredOCV as baseline
    const soc_prev = this.lastSOC ?? measuredOCVpercent;
    const soc_pred = soc_prev + (deltaAh / C_prior) * 100;

    // measurement z is measuredOCVpercent
    const z = measuredOCVpercent;
    const innovation = z - soc_pred;

    // linearize measurement w.r.t capacity: d(soc_pred)/dC = - (deltaAh / C^2) * 100
    const H = (Math.abs(deltaAh) < 1e-12) ? 0 : ( - (deltaAh) / (C_prior * C_prior) * 100 );

    // push innovation for adaptive R
    this._pushInnovation(innovation);
    const R = this._estimateR();

    // Avoid degenerate H=0 (no current -> no sensitivity to capacity)
    let K = 0;
    if (Math.abs(H) > 1e-12) {
      const S = H * P_prior * H + R;
      K = (P_prior * H) / S; // scalar EKF gain for C
      // update capacity
      this.C = C_prior + K * innovation;
      // update covariance (Joseph form simplified for scalar)
      this.P = (1 - K * H) * P_prior;
    } else {
      // no info to update C; keep prior
      this.C = C_prior;
      this.P = P_prior;
    }

    // store state
    this.C = Math.max(0.1, this.C); // floor capacity to small positive
    this.P = Math.max(1e-9, this.P);
    this.lastTs = now;
    this.lastSOC = z; // set to measured OCV for next step

    const soh_pct = (this.C / this.Cr) * 100;

    return {
      capacity_Ah: this.C,
      soh_pct,
      K,
      P: this.P,
      R,
      z,
      soc_pred,
      innovation,
      dt,
    };
  }

  _pushInnovation(nu) {
    this.innovations.push(nu);
    if (this.innovations.length > this.R_window) this.innovations.shift();
  }

  _estimateR() {
    if (this.innovations.length < 3) return 1.0; // initial variance (percent^2)
    const mean = this.innovations.reduce((a, b) => a + b, 0) / this.innovations.length;
    const s2 = this.innovations.reduce((a, b) => a + (b - mean) ** 2, 0) / (this.innovations.length - 1);
    return Math.max(1e-4, s2);
  }
}