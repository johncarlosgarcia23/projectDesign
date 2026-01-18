// frontend/src/components/EventsTab.js
import React, { useMemo, useState } from "react";
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from "@mui/material";
import { Event } from "@mui/icons-material";
import DownloadIcon from "@mui/icons-material/Download";

const toCSV = (rows, columns) => {
  const esc = (val) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(c.value(r))).join(","))
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

function EventsTab({ events }) {
  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const [range, setRange] = useState("all");

  const todayEvents = useMemo(() => {
    if (range !== "today") return safeEvents;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return safeEvents.filter((e) => {
      const t = e?.timestamp ? new Date(e.timestamp) : null;
      return t && !Number.isNaN(t.getTime()) && t >= start;
    });
  }, [safeEvents, range]);

  const columns = useMemo(
    () => [
      { label: "timestamp", value: (e) => (e.timestamp ? new Date(e.timestamp).toISOString() : "") },
      { label: "batteryId", value: (e) => e.batteryId || e.batteryName || "" },
      { label: "type", value: (e) => e.type || "" },
      { label: "message", value: (e) => e.message || "" },
    ],
    []
  );

  const handleDownloadCSV = () => {
    const csv = toCSV(todayEvents, columns);
    const rng = range === "today" ? "TODAY" : "ALL";
    downloadTextFile(`events_${rng}.csv`, csv);
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
      <Box
        sx={{
          p: 4,
          background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box
              sx={{
                p: 2,
                mr: 3,
                borderRadius: 2,
                background: "linear-gradient(135deg, #fef2f2, #fecaca)",
              }}
            >
              <Event sx={{ color: "#dc2626", fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ color: "#1e40af", fontWeight: "700", mb: 0.5 }}>
                Event Logs
              </Typography>
              <Typography variant="body1" sx={{ color: "#64748b" }}>
                System events, alerts, and notifications
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <ToggleButtonGroup
              value={range}
              exclusive
              onChange={(_, v) => v && setRange(v)}
              size="small"
            >
              <ToggleButton value="today">Today</ToggleButton>
              <ToggleButton value="all">All Data</ToggleButton>
            </ToggleButtonGroup>

            <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownloadCSV}>
              Download CSV
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 4 }}>
        <Table
          sx={{
            "& .MuiTableHead-root": {
              background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
            },
            "& .MuiTableRow-root": {
              "&:nth-of-type(even)": { backgroundColor: "#f8fafc" },
              "&:hover": { backgroundColor: "#f1f5f9" },
            },
          }}
        >
          <TableHead>
            <TableRow>
              {["Timestamp", "Battery", "Event Type", "Message"].map((h) => (
                <TableCell
                  key={h}
                  sx={{
                    fontWeight: "700",
                    color: "#1e40af",
                    borderBottom: "2px solid #cbd5e1",
                  }}
                >
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {todayEvents.length > 0 ? (
              todayEvents.map((e, i) => (
                <TableRow key={e._id || i}>
                  <TableCell>{e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}</TableCell>
                  <TableCell>{e.batteryId || e.batteryName || "System"}</TableCell>
                  <TableCell>{e.type || "—"}</TableCell>
                  <TableCell>{e.message || "—"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No events logged yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}

export default EventsTab;
