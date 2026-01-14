// OverviewTab.js
import React, { useState, useEffect } from "react";
import axios from "axios";
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
import { getBatteryIcon } from "../utils/batteryUtils";
import { fetchBatteryForecast } from "../utils/batteryUtils";

// ---------- CHART RENDERER FOR INDIVIDUAL BATTERY ----------
const renderChart = (data, color) => (
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
function OverviewTab({
  compareMode,
  handleCompareChange,
  socAlgorithm,
  initialSoh,
}) {
  const [allReadings, setAllReadings] = useState([]); // stores all battery readings
  const [selectedBattery, setSelectedBattery] = useState(""); // currently selected battery
  const [combinedData, setCombinedData] = useState([]); // formatted for combined chart
  const [forecast, setForecast] = useState({ socHours: 0, sohDays: 0 });

  // ---------- FETCH ALL READINGS ----------
  useEffect(() => {
    const fetchStoredData = async () => {
      try {
        const response = await axios.get("http://projectdesign.onrender.com/api/sensors/processed");
        if (Array.isArray(response.data)) {
          setAllReadings(response.data);
        }
      } catch (err) {
        console.error("Error fetching processed readings:", err);
      }
    };
    fetchStoredData();
    const interval = setInterval(fetchStoredData, 5000);
    return () => clearInterval(interval);
  }, []);

  // ---------- BATTERY LIST EXTRACTION ----------
  const batteryList = Array.from(
    new Set(allReadings.map((r) => r.batteryId || r.batteryName).filter(Boolean))
  );

  // If no battery selected yet, default to first available
  useEffect(() => {
    if (!selectedBattery && batteryList.length) {
      setSelectedBattery(batteryList[0]);
    }
  }, [batteryList, selectedBattery]);

  // ---------- FILTER SELECTED BATTERY ----------
  const filteredBatteryData = allReadings.filter(
    (r) => (r.batteryId || r.batteryName) === selectedBattery
  );

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

  // ---------- FORECAST POLLING ----------
  useEffect(() => {
    let mounted = true;
    let id;

    const updateForecast = async () => {
      if (!selectedBattery) {
        if (mounted) setForecast({ socHours: 0, sohDays: 0 });
        return;
      }
      try {
        const result = await fetchBatteryForecast(selectedBattery);
        if (mounted) setForecast(result);
      } catch (err) {
        if (mounted) setForecast({ socHours: 0, sohDays: 0 });
      }
    };

    updateForecast();
    id = setInterval(updateForecast, 5000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [selectedBattery]);

  // ---------- SOC SELECTION FUNCTION ----------
  const getSelectedSoc = (entry) => {
    if (!entry) return 0;
    switch (socAlgorithm) {
      case "ocv":
        return entry.soc_ocv || entry.soc_pct || 0;
      case "coulomb":
        return entry.soc_coulomb || entry.soc_pct || 0;
      case "kalman":
      default:
        return entry.soc_kalman || entry.soc_pct || 0;
    }
  };

  const latest = filteredBatteryData[filteredBatteryData.length - 1] || {};

  // ---------- UI ----------
  return (
    <Box>
      {/* ---------- TITLE SECTION ---------- */}
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h3" sx={{ color: "#282C35", fontWeight: "800", mb: 2 }}>
          Battery Data Overview
        </Typography>
        <Typography variant="h6" sx={{ color: "#666666", fontWeight: "400" }}>
          Displays stored and real-time battery performance from database
        </Typography>
      </Box>

      {/* ---------- BATTERY SELECTOR ---------- */}
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

      {/* ---------- BATTERY STATUS CARD ---------- */}
      {selectedBattery && latest && (
        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} md={5}>
            <Card sx={{ background: "#fff", border: "2px solid #282C35", borderRadius: 3 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
                  {getBatteryIcon(getSelectedSoc(latest))}
                </Box>
                <Typography variant="h5" sx={{ color: "#282C35", textAlign: "center" }}>
                  {selectedBattery}
                </Typography>
                <Typography
                  variant="h2"
                  sx={{ color: "#282C35", textAlign: "center", fontWeight: "800" }}
                >
                  {getSelectedSoc(latest)?.toFixed(1)}%
                </Typography>
                <Typography variant="body1" sx={{ textAlign: "center", color: "#666" }}>
                  State of Charge
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={getSelectedSoc(latest)}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    bgcolor: "#e0e0e0",
                    "& .MuiLinearProgress-bar": {
                      background:
                        getSelectedSoc(latest) > 60
                          ? "#282C35"
                          : getSelectedSoc(latest) > 30
                          ? "#666666"
                          : "#999999",
                    },
                  }}
                />

                {/* ---------- SoH & SoC forecast display (center aligned) ---------- */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    mt: 3,
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="body2">SoH</Typography>
                    <Typography variant="h6">
                      {latest.soh_pct?.toFixed(1) || initialSoh || 100}%
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#666" }}>
                      {Number.isFinite(forecast.sohDays) ? `${Math.round(forecast.sohDays)}d left` : "N/A"}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="body2">SoC</Typography>
                    <Typography variant="h6">
                      {getSelectedSoc(latest)?.toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#666" }}>
                      {forecast.socHours === Infinity
                        ? "Charging/Idle"
                        : Number.isFinite(forecast.socHours)
                        ? `${Math.round(forecast.socHours)}h left`
                        : "N/A"}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ---------- BATTERY COMPARISON CHART ---------- */}
      {selectedBattery && (
        <Grid item xs={12} md={10} sx={{ width: "99%", mt: 6 }}>
          <Card>
            <CardContent sx={{ height: 470, width: "100%", p: 4 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <CompareArrows sx={{ color: "#1e40af", mr: 2 }} />
                  <Typography variant="h5" sx={{ color: "#1e40af", fontWeight: "700" }}>
                    Battery Comparison
                  </Typography>
                </Box>
                <ToggleButtonGroup
                  value={compareMode}
                  exclusive
                  onChange={handleCompareChange}
                >
                  <ToggleButton value="voltage">Voltage</ToggleButton>
                  <ToggleButton value="current">Current</ToggleButton>
                  <ToggleButton value="both">Both</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {renderCombinedChart(combinedData, compareMode, selectedBattery)}
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* ---------- DETAILED BATTERY CHART ---------- */}
      {selectedBattery && (
        <Grid container xs={12} md={10} sx={{ width: "99%", mt: 4 }}>
          <Grid item xs={12} md={10} sx={{ width: "99%", mt: 4 }}>
            <Card>
              <CardContent sx={{ height: 500, width: "96.7%", p: 4 }}>
                <Typography variant="h5" sx={{ color: "#1e40af", fontWeight: "700", mb: 2 }}>
                  {selectedBattery} - Detailed Chart
                </Typography>
                <Box sx={{ height: 320, width: "100%" }}>
                  {renderChart(filteredBatteryData, "#1e40af")}
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
