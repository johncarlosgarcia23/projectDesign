// frontend/src/components/LogsTab.js
import React, { useMemo, useEffect, useState } from "react";
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
  Button,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { api } from "../utils/api";

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toCSV = (rows, columns) => {
  const esc = (val) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const raw = typeof c.value === "function" ? c.value(r) : r[c.key];
          return esc(raw);
        })
        .join(",")
    )
    .join("\n");

  return `${header}\n${body}\n`;
};

const downloadTextFile = (filename, text) => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

function LogsTab() {
  const [sensorData, setSensorData] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [batteryName, setBatteryName] = useState("All");
  const [range, setRange] = useState("all");
  const [orderBy, setOrderBy] = useState("timestamp");
  const [order, setOrder] = useState("desc");

  const temperatureC = 25; // placeholder

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = range === "today" ? "/api/sensors/processed?range=today" : "/api/sensors/processed";
        const res = await api.get(url);
        setSensorData(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error fetching telemetry data:", err);
        setSensorData([]);
      }
    };
    fetchData();
  }, [range]);

  const batteryList = useMemo(() => {
    return Array.from(new Set(sensorData.map((r) => r.batteryId || r.batteryName).filter(Boolean)));
  }, [sensorData]);

  const filteredData = useMemo(() => {
    if (batteryName === "All") return sensorData;
    return sensorData.filter((r) => (r.batteryId || r.batteryName) === batteryName);
  }, [sensorData, batteryName]);

  const handleSort = (field) => {
    const isAsc = orderBy === field && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(field);
  };

  const sortedData = useMemo(() => {
    const arr = [...filteredData];
    arr.sort((a, b) => {
      const dir = order === "asc" ? 1 : -1;

      if (orderBy === "timestamp") {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
        return (ta - tb) * dir;
      }

      const va = safeNum(a[orderBy]);
      const vb = safeNum(b[orderBy]);
      if (va === null || vb === null) return 0;
      return (va - vb) * dir;
    });
    return arr;
  }, [filteredData, orderBy, order]);

  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(+e.target.value);
    setPage(0);
  };

  const columns = useMemo(
    () => [
      { label: "timestamp", value: (r) => (r.timestamp ? new Date(r.timestamp).toISOString() : "") },
      { label: "batteryId", value: (r) => r.batteryId || r.batteryName || "" },
      { label: "voltage_V", value: (r) => safeNum(r.voltage_V) ?? "" },
      {
        label: "current_A",
        value: (r) => safeNum(r.current_A ?? (r.current_mA ? r.current_mA / 1000 : null)) ?? "",
      },
      { label: "estimated_Ah", value: (r) => safeNum(r.estimated_Ah) ?? "" },
      { label: "soc_coulomb", value: (r) => safeNum(r.soc_coulomb) ?? "" },
      { label: "soc_ocv", value: (r) => safeNum(r.soc_ocv) ?? "" },
      { label: "soc_kalman", value: (r) => safeNum(r.soc_kalman) ?? "" },
      { label: "soh_pct", value: (r) => safeNum(r.soh_pct) ?? "" },
      { label: "power_W", value: (r) => safeNum(r.power_W) ?? "" },
      { label: "temperature_C", value: () => temperatureC },
    ],
    []
  );

  const handleDownloadCSV = () => {
    const csv = toCSV(sortedData, columns);
    const batt = batteryName === "All" ? "ALL" : batteryName.replace(/\s+/g, "_");
    const rng = range === "today" ? "TODAY" : "ALL";
    downloadTextFile(`battery_logs_${batt}_${rng}.csv`, csv);
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" sx={{ mb: 2, color: "#282C35", fontWeight: 800, textAlign: "center" }}>
        Battery Telemetry Logs
      </Typography>

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: 2,
          flexWrap: "wrap",
          mb: 3,
          alignItems: "center",
        }}
      >
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel>Battery</InputLabel>
          <Select value={batteryName} label="Battery" onChange={(e) => setBatteryName(e.target.value)}>
            <MenuItem value="All">All</MenuItem>
            {batteryList.map((batt) => (
              <MenuItem key={batt} value={batt}>
                {batt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <ToggleButtonGroup value={range} exclusive onChange={(_, v) => v && setRange(v)}>
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value="all">All Data</ToggleButton>
        </ToggleButtonGroup>

        <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownloadCSV} sx={{ height: 40 }}>
          Download CSV
        </Button>
      </Box>

      <Paper sx={{ width: "100%", overflow: "hidden", border: "2px solid #282C35", borderRadius: 3 }}>
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
                  { key: "temperature_C", label: "Temp (°C)" },
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
              {sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((e, i) => (
                <TableRow key={e._id || i}>
                  <TableCell>{e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}</TableCell>
                  <TableCell>{e.batteryId || e.batteryName || "—"}</TableCell>
                  <TableCell>{Number.isFinite(Number(e.voltage_V)) ? Number(e.voltage_V).toFixed(2) : "—"}</TableCell>
                  <TableCell>
                    {Number.isFinite(Number(e.current_A ?? (e.current_mA ? e.current_mA / 1000 : NaN)))
                      ? Number(e.current_A ?? (e.current_mA / 1000)).toFixed(3)
                      : "—"}
                  </TableCell>
                  <TableCell>{Number.isFinite(Number(e.estimated_Ah)) ? Number(e.estimated_Ah).toFixed(3) : "—"}</TableCell>
                  <TableCell>{Number.isFinite(Number(e.soc_coulomb)) ? Number(e.soc_coulomb).toFixed(2) : "—"}</TableCell>
                  <TableCell>{Number.isFinite(Number(e.soc_ocv)) ? Number(e.soc_ocv).toFixed(2) : "—"}</TableCell>
                  <TableCell>{Number.isFinite(Number(e.soc_kalman)) ? Number(e.soc_kalman).toFixed(2) : "—"}</TableCell>
                  <TableCell>{Number.isFinite(Number(e.soh_pct)) ? Number(e.soh_pct).toFixed(2) : "—"}</TableCell>
                  <TableCell>{temperatureC}</TableCell>
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
