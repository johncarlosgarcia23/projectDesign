// frontend/src/components/EventsTab.js
import React, { useMemo } from "react";
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
} from "@mui/material";
import { Event } from "@mui/icons-material";

function EventsTab({ events }) {
  const safeEvents = useMemo(() => (Array.isArray(events) ? events : []), [events]);

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
              <TableCell
                sx={{
                  fontWeight: "700",
                  color: "#1e40af",
                  borderBottom: "2px solid #cbd5e1",
                }}
              >
                Timestamp
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "700",
                  color: "#1e40af",
                  borderBottom: "2px solid #cbd5e1",
                }}
              >
                Battery
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "700",
                  color: "#1e40af",
                  borderBottom: "2px solid #cbd5e1",
                }}
              >
                Event Type
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "700",
                  color: "#1e40af",
                  borderBottom: "2px solid #cbd5e1",
                }}
              >
                Message
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {safeEvents.length > 0 ? (
              safeEvents.map((e, i) => (
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
