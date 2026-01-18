// LogsTab.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  TableSortLabel,
} from "@mui/material";

// ---------- MAIN LOGS COMPONENT ----------
function LogsTab() {
  const [sensorData, setSensorData] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [batteryName, setBatteryName] = useState("All");
  const [range, setRange] = useState("all");
  const [orderBy, setOrderBy] = useState("timestamp");
  const [order, setOrder] = useState("desc");

  // ---------- FETCH READINGS ----------
  useEffect(() => {
    const fetchData = async () => {
      try {
        const url =
          range === "today"
            ? "https://projectdesign.onrender.com/api/sensors/processed?range=today"
            : "https://projectdesign.onrender.com/api/sensors/processed";
        const res = await axios.get(url);
        if (Array.isArray(res.data)) {
          setSensorData(res.data);
        }
      } catch (err) {
        console.error("Error fetching telemetry data:", err);
      }
    };
    fetchData();
  }, [range]);

  // ---------- BATTERY LIST EXTRACTION ----------
  const batteryList = Array.from(
    new Set(sensorData.map((r) => r.batteryId || r.batteryName))
  );

  // ---------- FILTER ----------
  const filteredData =
    batteryName === "All"
      ? sensorData
      : sensorData.filter(
          (r) => (r.batteryId || r.batteryName) === batteryName
        );

  // ---------- SORT ----------
  const handleSort = (field) => {
    const isAsc = orderBy === field && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(field);
  };

  const sortedData = [...filteredData].sort((a, b) => {
    const valA = a[orderBy];
    const valB = b[orderBy];
    if (valA === undefined || valB === undefined) return 0;
    if (typeof valA === "string" && orderBy === "timestamp") {
      return order === "asc"
        ? new Date(valA) - new Date(valB)
        : new Date(valB) - new Date(valA);
    }
    return order === "asc" ? valA - valB : valB - valA;
  });

  // ---------- PAGINATION ----------
  const handleChangePage = (e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(+e.target.value);
    setPage(0);
  };

  // ---------- UI ----------
  return (
    <Box sx={{ p: 4 }}>
      <Typography
        variant="h4"
        sx={{ mb: 4, color: "#282C35", fontWeight: 800, textAlign: "center" }}
      >
        Battery Telemetry Logs
      </Typography>

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: 4,
          flexWrap: "wrap",
          mb: 3,
        }}
      >
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel>Battery</InputLabel>
          <Select
            value={batteryName}
            label="Battery"
            onChange={(e) => setBatteryName(e.target.value)}
          >
            <MenuItem value="All">All</MenuItem>
            {batteryList.map((batt, idx) => (
              <MenuItem key={idx} value={batt}>
                {batt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <ToggleButtonGroup
          value={range}
          exclusive
          onChange={(e, newRange) => newRange && setRange(newRange)}
        >
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value="all">All Data</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Paper
        sx={{
          width: "100%",
          overflow: "hidden",
          border: "2px solid #282C35",
          borderRadius: 3,
        }}
      >
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {[
                  { key: "timestamp", label: "Timestamp" },
                  { key: "batteryName", label: "Battery Name" },
                  { key: "voltage_V", label: "Voltage (V)" },
                  { key: "current_A", label: "Current (A)" },
                  { key: "estimated_Ah", label: "Estimated Ah" },
                  { key: "soc_coulomb", label: "SoC (Coulomb)" },
                  { key: "soc_ocv", label: "SoC (OCV)" },
                  { key: "soc_kalman", label: "SoC (Kalman)" },
                  { key: "soh_pct", label: "SoH (%)" },
                ].map((col) => (
                  <TableCell key={col.key}>
                    <TableSortLabel
                      active={orderBy === col.key}
                      direction={orderBy === col.key ? order : "asc"}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {sortedData
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {new Date(e.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{e.batteryId || e.batteryName || "—"}</TableCell>
                    <TableCell>{e.voltage_V?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell>
                      {(e.current_A ?? e.current_mA / 1000)?.toFixed(3) ?? "—"}
                    </TableCell>
                    <TableCell>{e.estimated_Ah?.toFixed(3) ?? "—"}</TableCell>
                    <TableCell>{e.soc_coulomb?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell>{e.soc_ocv?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell>{e.soc_kalman?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell>{e.soh_pct?.toFixed(2) ?? "—"}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    </Box>
  );
}

export default LogsTab;
