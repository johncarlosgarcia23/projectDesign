// src/components/OverviewTab.js
import React, { useMemo, useEffect, useState } from "react";
import {
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
} from "@mui/material";
import { CompareArrows } from "@mui/icons-material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getBatteryIcon, fetchBatteryForecast } from "../utils/batteryUtils";
import { api } from "../utils/api";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function inferModeFromCurrent(currentA) {
  const eps = 0.05;
  if (currentA > eps) return "CHARGING";
  if (currentA < -eps) return "DISCHARGING";
  return "IDLE";
}

function modeLabel(mode) {
  switch (mode) {
    case "CHARGING":
      return "Charging";
    case "DISCHARGING":
      return "Discharging";
    case "IDLE":
    default:
      return "Idle";
  }
}

function consumptionLabel(mode, powerW) {
  if (mode === "DISCHARGING") return `Consuming (${Math.abs(powerW).toFixed(1)} W)`;
  if (mode === "CHARGING") return `Charging (+${Math.abs(powerW).toFixed(1)} W)`;
  return "No energy flow";
}

function modeChipProps(mode) {
  if (mode === "CHARGING") return { label: "Charging", color: "success", variant: "filled" };
  if (mode === "DISCHARGING") return { label: "Discharging", color: "warning", variant: "filled" };
  return { label: "Idle", color: "default", variant: "filled" };
}

// ---------- CHART RENDERER FOR INDIVIDUAL BATTERY ----------
const renderChart = (data) => (
  <ResponsiveContainer width="100%" height={320}>
    <LineChart
      data={(Array.isArray(data) ? data : []).map((d) => ({
        time: d.timestamp,
        voltage: d.voltage_V,
        current: d.current_A,
      }))}
      margin={{ top: 20, right: 50, left: 30, bottom: 30 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
      <XAxis
        dataKey="time"
        tick={{ fontSize: 10, fill: "#666666" }}
        height={30}
        interval="auto"
        tickFormatter={(value) => {
          const date = new Date(value);
          return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        }}
      />
      <YAxis tick={{ fontSize: 12, fill: "#666666" }} />
      <Tooltip
        contentStyle={{
          backgroundColor: "#ffffff",
          borderRadius: 8,
          border: "2px solid #282C35",
          boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
        }}
      />
      <Legend
        verticalAlign="bottom"
        align="center"
        layout="horizontal"
        wrapperStyle={{ paddingTop: 20 }}
      />
      <Line
        type="monotone"
        dataKey="voltage"
        stroke="#2563eb"
        strokeWidth={2}
        name="Voltage (V)"
        dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
      />
      <Line
        type="monotone"
        dataKey="current"
        stroke="#dc2626"
        strokeWidth={2}
        name="Current (A)"
        dot={{ fill: "#dc2626", strokeWidth: 2, r: 4 }}
      />
    </LineChart>
  </ResponsiveContainer>
);

// ---------- CHART RENDERER FOR BATTERY COMPARISON ----------
const renderCombinedChart = (combinedData, compareMode, batteryName) => {
  const safeCombined = Array.isArray(combinedData) ? combinedData : [];
  const lines = [];

  if (compareMode === "voltage" || compareMode === "both") {
    lines.push(
      <Line
        key="A_V"
        type="monotone"
        dataKey="A_V"
        stroke="#2563eb"
        strokeWidth={2}
        name={`${batteryName || "Battery"} (V)`}
        dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
      />
    );
  }

  if (compareMode === "current" || compareMode === "both") {
    lines.push(
      <Line
        key="A_A"
        type="monotone"
        dataKey="A_A"
        stroke="#059669"
        strokeWidth={2}
        name={`${batteryName || "Battery"} (A)`}
        dot={{ fill: "#059669", strokeWidth: 2, r: 4 }}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={safeCombined}
        margin={{ top: 20, right: 50, left: 30, bottom: 30 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: "#666666" }}
          height={30}
          interval="auto"
          tickFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
          }}
        />
        <YAxis tick={{ fontSize: 12, fill: "#666666" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            borderRadius: 8,
            border: "2px solid #282C35",
            boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
          }}
        />
        <Legend
          verticalAlign="bottom"
          align="center"
          layout="horizontal"
          wrapperStyle={{ paddingTop: 20 }}
        />
        {lines}
      </LineChart>
    </ResponsiveContainer>
  );
};

// ---------- MAIN OVERVIEW COMPONENT ----------
function OverviewTab({ compareMode, handleCompareChange, socAlgorithm }) {
  const [allReadings, setAllReadings] = useState([]);
  const [selectedBattery, setSelectedBattery] = useState("");
  const [combinedData, setCombinedData] = useState([]);
  const [forecast, setForecast] = useState({
    socHours: null,
    effectiveCapacityAh: null,
    capacityRetentionPct: null,
  });
  const [latestEvent, setLatestEvent] = useState(null);

  // ---------- FETCH ALL READINGS ----------
  useEffect(() => {
    const fetchStoredData = async () => {
      try {
        const response = await api.get("/api/sensors/processed");
        setAllReadings(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Error fetching processed readings:", err);
        setAllReadings([]);
      }
    };

    fetchStoredData();
    const interval = setInterval(fetchStoredData, 5000);
    return () => clearInterval(interval);
  }, []);

  // ---------- BATTERY LIST EXTRACTION ----------
  const batteryList = useMemo(() => {
    return Array.from(
      new Set(allReadings.map((r) => r.batteryId || r.batteryName).filter(Boolean))
    );
  }, [allReadings]);

  // default selected battery
  useEffect(() => {
    if (!selectedBattery && batteryList.length) setSelectedBattery(batteryList[0]);
  }, [batteryList, selectedBattery]);

  // ---------- FILTER SELECTED BATTERY ----------
  const filteredBatteryData = useMemo(() => {
    return allReadings.filter((r) => (r.batteryId || r.batteryName) === selectedBattery);
  }, [allReadings, selectedBattery]);

  // ---------- FORMAT DATA FOR COMBINED CHART ----------
  useEffect(() => {
    if (!selectedBattery) return;
    const formatted = filteredBatteryData.map((r) => ({
      time: r.timestamp,
      A_V: r.voltage_V,
      A_A: r.current_A,
    }));
    setCombinedData(formatted);
  }, [filteredBatteryData, selectedBattery]);

  // ---------- SOC SELECTION ----------
  const getSelectedSoc = (entry) => {
    if (!entry) return 0;
    switch (socAlgorithm) {
      case "ocv":
        return entry.soc_ocv ?? entry.soc_pct ?? 0;
      case "coulomb":
        return entry.soc_coulomb ?? entry.soc_pct ?? 0;
      case "kalman":
      default:
        return entry.soc_kalman ?? entry.soc_pct ?? 0;
    }
  };

  const latest = filteredBatteryData[filteredBatteryData.length - 1] || {};
  const socPct = clamp(num(getSelectedSoc(latest), 0), 0, 100);

  const currentA = num(latest.current_A, 0);
  const voltageV = num(latest.voltage_V, 0);
  const powerW = voltageV * currentA; // negative when discharging
  const modeFromReading = inferModeFromCurrent(currentA);

  // ---------- FETCH LATEST EVENT FOR SELECTED BATTERY ----------
  useEffect(() => {
    let mounted = true;

    const fetchLatestEvent = async () => {
      if (!selectedBattery) {
        if (mounted) setLatestEvent(null);
        return;
      }
      try {
        // returns newest first from your backend route
        const res = await api.get(`/api/events?batteryId=${encodeURIComponent(selectedBattery)}&limit=1`);
        const arr = Array.isArray(res.data) ? res.data : [];
        if (mounted) setLatestEvent(arr[0] || null);
      } catch (e) {
        if (mounted) setLatestEvent(null);
      }
    };

    fetchLatestEvent();
    const id = setInterval(fetchLatestEvent, 5000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [selectedBattery]);

  // mode label preference: event type if present, else infer from current
  const eventType = latestEvent?.type || null;
  const mode =
    eventType === "CHARGING" || eventType === "DISCHARGING" || eventType === "IDLE"
      ? eventType
      : modeFromReading;

  const statusText = modeLabel(mode);
  const energyText = consumptionLabel(mode, powerW);

  // ---------- FORECAST POLLING ----------
  useEffect(() => {
    let mounted = true;

    const updateForecast = async () => {
      if (!selectedBattery) {
        if (mounted) {
          setForecast({ socHours: null, effectiveCapacityAh: null, capacityRetentionPct: null });
        }
        return;
      }

      try {
        const res = await fetchBatteryForecast(selectedBattery);

        const normalized = {
          socHours:
            res.socHours === Infinity
              ? Infinity
              : Number.isFinite(Number(res.socHours))
              ? Number(res.socHours)
              : null,
          effectiveCapacityAh: Number.isFinite(Number(res.effectiveCapacityAh))
            ? Number(res.effectiveCapacityAh)
            : null,
          capacityRetentionPct: Number.isFinite(Number(res.capacityRetentionPct))
            ? Number(res.capacityRetentionPct)
            : null,
        };

        if (mounted) setForecast(normalized);
      } catch (err) {
        if (mounted) {
          setForecast({ socHours: null, effectiveCapacityAh: null, capacityRetentionPct: null });
        }
      }
    };

    updateForecast();
    const id = setInterval(updateForecast, 5000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [selectedBattery]);

  // ---------- DISPLAY COMPUTATIONS ----------
  const usableCapacityAh = Number.isFinite(forecast.effectiveCapacityAh) ? forecast.effectiveCapacityAh : 40;
  const remainingCapacityAh = (socPct / 100) * usableCapacityAh;

  const remainingChargeLabel = `${socPct.toFixed(1)}%`;

  const remainingTimeLabel =
    forecast.socHours === Infinity
      ? "Charging/Idle"
      : Number.isFinite(forecast.socHours)
      ? `${Math.max(0, Math.round(forecast.socHours))}h left`
      : mode === "IDLE"
      ? "Idle"
      : "—";

  const remainingCapacityLabel = `${remainingCapacityAh.toFixed(1)} Ah`;
  const usableCapacityLabel = `${usableCapacityAh.toFixed(1)} Ah`;

  return (
    <Box>
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h3" sx={{ color: "#282C35", fontWeight: "800", mb: 2 }}>
          Battery Data Overview
        </Typography>
        <Typography variant="h6" sx={{ color: "#666666", fontWeight: "400" }}>
          Displays stored and real-time battery performance from database
        </Typography>
      </Box>

      <Box sx={{ textAlign: "center", mb: 4 }}>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel>Select Battery</InputLabel>
          <Select
            value={selectedBattery}
            label="Select Battery"
            onChange={(e) => setSelectedBattery(e.target.value)}
          >
            {batteryList.map((batt, idx) => (
              <MenuItem key={idx} value={batt}>
                {batt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {selectedBattery && (
        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} md={5}>
            <Card sx={{ background: "#fff", border: "2px solid #282C35", borderRadius: 3 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                  {getBatteryIcon(socPct)}
                </Box>

                <Typography variant="h5" sx={{ color: "#282C35", textAlign: "center" }}>
                  {selectedBattery}
                </Typography>

                <Typography
                  variant="h2"
                  sx={{ color: "#282C35", textAlign: "center", fontWeight: "800" }}
                >
                  {socPct.toFixed(1)}%
                </Typography>

                <Typography variant="body1" sx={{ textAlign: "center", color: "#666" }}>
                  State of Charge
                </Typography>

                <LinearProgress
                  variant="determinate"
                  value={socPct}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    bgcolor: "#e0e0e0",
                    "& .MuiLinearProgress-bar": {
                      background: socPct > 60 ? "#282C35" : socPct > 30 ? "#666666" : "#999999",
                    },
                    mb: 2,
                  }}
                />

                {/* Status + Energy flow */}
                <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
                  <Chip {...modeChipProps(mode)} />
                  <Chip
                    label={energyText}
                    variant="outlined"
                    sx={{ borderColor: "#282C35", color: "#282C35" }}
                  />
                </Box>

                {/* Optional: show latest event message (if exists) */}
                <Box sx={{ textAlign: "center", mb: 1 }}>
                  <Typography variant="body2" sx={{ color: "#666" }}>
                    {latestEvent?.message ? latestEvent.message : `Status: ${statusText}`}
                  </Typography>
                </Box>

                {/* Bottom stats */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    mt: 2,
                    gap: 6,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ textAlign: "center", minWidth: 160 }}>
                    <Typography variant="body2" sx={{ color: "#666" }}>
                      Remaining capacity
                    </Typography>
                    <Typography variant="h6">{remainingCapacityLabel}</Typography>
                    <Typography variant="body2" sx={{ color: "#666" }}>
                      {`Usable: ${usableCapacityLabel}`}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#666" }}>
                      {Number.isFinite(forecast.capacityRetentionPct)
                        ? `${forecast.capacityRetentionPct.toFixed(1)}% retention`
                        : "—"}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: "center", minWidth: 160 }}>
                    <Typography variant="body2" sx={{ color: "#666" }}>
                      Remaining charge
                    </Typography>
                    <Typography variant="h6">{remainingChargeLabel}</Typography>
                    <Typography variant="body2" sx={{ color: "#666" }}>
                      {remainingTimeLabel}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {selectedBattery && (
        <Grid item xs={12} md={10} sx={{ width: "99%", mt: 6 }}>
          <Card>
            <CardContent sx={{ height: 470, width: "100%", p: 4 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 3,
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <CompareArrows sx={{ color: "#1e40af", mr: 2 }} />
                  <Typography variant="h5" sx={{ color: "#1e40af", fontWeight: "700" }}>
                    Battery Comparison
                  </Typography>
                </Box>

                {/* Move toggle group left by constraining width and adding right margin */}
                <Box sx={{ display: "flex", justifyContent: "flex-end", flex: 1, pr: 4 }}>
                  <ToggleButtonGroup
                    value={compareMode}
                    exclusive
                    onChange={handleCompareChange}
                    sx={{
                      mr: 2,
                      "& .MuiToggleButton-root": { px: 2, py: 0.8 },
                    }}
                  >
                    <ToggleButton value="voltage">Voltage</ToggleButton>
                    <ToggleButton value="current">Current</ToggleButton>
                    <ToggleButton value="both">Both</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>

              {renderCombinedChart(combinedData, compareMode, selectedBattery)}
            </CardContent>
          </Card>
        </Grid>
      )}

      {selectedBattery && (
        <Grid container xs={12} md={10} sx={{ width: "99%", mt: 4 }}>
          <Grid item xs={12} md={10} sx={{ width: "99%", mt: 4 }}>
            <Card>
              <CardContent sx={{ height: 500, width: "96.7%", p: 4 }}>
                <Typography variant="h5" sx={{ color: "#1e40af", fontWeight: "700", mb: 2 }}>
                  {selectedBattery} - Detailed Chart
                </Typography>
                <Box sx={{ height: 320, width: "100%" }}>
                  {renderChart(filteredBatteryData)}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

export default OverviewTab;
