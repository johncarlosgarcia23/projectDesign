// SettingsTab.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Typography,
  Paper,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import { Settings, Logout } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

function SettingsTab({ socAlgorithm, handleSocAlgorithmChange }) {
  const [batteries, setBatteries] = useState([]);
  const [selectedBattery, setSelectedBattery] = useState("");
  const [batteryName, setBatteryName] = useState("");
  const [initialSOH, setInitialSOH] = useState(100);
  const [ratedAh, setRatedAh] = useState(40);
  const navigate = useNavigate();

  // ---------- FETCH BATTERIES FROM PROCESSED DATA ----------
  useEffect(() => {
    fetchBatteries();
  }, []);

  const fetchBatteries = async () => {
    try {
      const res = await axios.get("http://projectdesign.onrender.com/api/sensors/processed");
      if (Array.isArray(res.data)) {
        // Extract unique batteries from data
        const unique = Array.from(
          new Set(res.data.map((r) => r.batteryId || r.batteryName))
        ).map((id) => ({
          batteryId: id,
          batteryName: id || "BATT_DEFAULT",
        }));

        setBatteries(unique);
        if (unique.length > 0) {
          setSelectedBattery(unique[0].batteryId || unique[0].batteryName);
          setBatteryName(unique[0].batteryName);
        }
      }
    } catch (error) {
      console.error("Error fetching batteries from processed data:", error);
    }
  };

  // ---------- HANDLE BATTERY SELECTION ----------
  const handleBatterySelect = (e) => {
    const id = e.target.value;
    setSelectedBattery(id);
    const battery = batteries.find(
      (b) => b.batteryId === id || b.batteryName === id
    );
    if (battery) setBatteryName(battery.batteryName);
  };

  // ---------- SAVE SETTINGS ----------
  const handleSaveSettings = async () => {
    if (!selectedBattery) return;
    try {
      await axios.put(
        `http://projectdesign.onrender.com/api/sensors/batteries/${selectedBattery}`,
        {
          name: batteryName,
          rated_Ah: ratedAh,
          user_set_soh_pct: initialSOH,
          soc_algorithm: socAlgorithm,
        }
      );
      alert("Battery settings saved successfully.");
      fetchBatteries();
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings. Check server logs.");
    }
  };

  // ---------- LOGOUT HANDLER ----------
  const handleLogout = () => {
    localStorage.removeItem("user");
    sessionStorage.clear();
    navigate("/login");
  };

  return (
    <Paper
      sx={{
        p: 0,
        background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
        boxShadow: "0 10px 25px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)",
        borderRadius: 3,
        border: "1px solid rgba(255,255,255,0.8)",
        overflow: "hidden",
      }}
    >
      {/* ---------- HEADER ---------- */}
      <Box
        sx={{
          p: 4,
          background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Box
            sx={{
              p: 2,
              mr: 3,
              borderRadius: 2,
              background: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
            }}
          >
            <Settings sx={{ color: "#1e40af", fontSize: 28 }} />
          </Box>
          <Box>
            <Typography
              variant="h4"
              sx={{ color: "#1e40af", fontWeight: "700", mb: 0.5 }}
            >
              System Configuration
            </Typography>
            <Typography variant="body1" sx={{ color: "#64748b" }}>
              Manage batteries, estimation algorithms, and system parameters
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ---------- CONTENT ---------- */}
      <Box sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, color: "#282C35" }}>
          Battery Selection
        </Typography>

        <FormControl sx={{ minWidth: 300, background: "white", mb: 3 }}>
          <InputLabel id="battery-select-label">Select Battery</InputLabel>
          <Select
            labelId="battery-select-label"
            id="battery-select"
            value={selectedBattery}
            label="Select Battery"
            onChange={handleBatterySelect}
          >
            {batteries.map((b) => (
              <MenuItem
                key={b.batteryId || b.batteryName}
                value={b.batteryId || b.batteryName}
              >
                {b.batteryName || "BATT_DEFAULT"}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Typography variant="h6" sx={{ mb: 2, color: "#282C35" }}>
          Battery Settings
        </Typography>

        <TextField
          label="Battery Name"
          variant="outlined"
          value={batteryName}
          onChange={(e) => setBatteryName(e.target.value)}
          sx={{ mb: 3, width: "300px", background: "white" }}
        />

        <TextField
          label="Rated Capacity (Ah)"
          variant="outlined"
          type="number"
          value={ratedAh}
          onChange={(e) => setRatedAh(Number(e.target.value))}
          sx={{ mb: 3, width: "300px", background: "white" }}
          inputProps={{ min: 1 }}
        />

        <TextField
          label="Initial SOH (%)"
          variant="outlined"
          type="number"
          value={initialSOH}
          onChange={(e) => setInitialSOH(Number(e.target.value))}
          sx={{ mb: 3, width: "300px", background: "white" }}
          inputProps={{ min: 0, max: 100 }}
        />

        <Typography variant="h6" sx={{ mb: 2, color: "#282C35" }}>
          SoC Estimation Algorithm
        </Typography>
        <FormControl sx={{ minWidth: 300, background: "white", mb: 4 }}>
          <InputLabel id="soc-algorithm-label">Select Algorithm</InputLabel>
          <Select
            labelId="soc-algorithm-label"
            id="soc-algorithm-select"
            value={socAlgorithm}
            label="SoC Estimation Algorithm"
            onChange={handleSocAlgorithmChange}
          >
            <MenuItem value="kalman">Kalman Filter</MenuItem>
            <MenuItem value="ocv">Open Circuit Voltage</MenuItem>
            <MenuItem value="coulomb">Coulomb Counting</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveSettings}
          >
            Save Changes
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<Logout />}
            onClick={handleLogout}
          >
            Log Out
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

export default SettingsTab;
