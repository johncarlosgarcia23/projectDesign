// src/utils/api.js
import axios from "axios";

export const API_BASE =
  process.env.REACT_APP_API_BASE || "https://projectdesign.onrender.com";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // true since credentials:true in cors
});
