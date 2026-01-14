//Dashboard.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, Fade } from "@mui/material";
import Sidebar from "../components/Sidebar";
import OverviewTab from "../components/OverviewTab";
import LogsTab from "../components/LogsTab";
import EventsTab from "../components/EventsTab";
import SettingsTab from "../components/SettingsTab";

function Dashboard() {
  const [tab, setTab] = useState(0);
  const [sensorData, setSensorData] = useState([]);
  const [events, setEvents] = useState([]);
  const [compareMode, setCompareMode] = useState("voltage");
  const [expanded, setExpanded] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "timestamp",
    direction: "desc",
  });
  const [page, setPage] = useState(0);
  const [range, setRange] = useState("today");
  const [socAlgorithm, setSocAlgorithm] = useState("kalman");

  const rowsPerPage = 10;

  const handleTabChange = (_, newValue) => setTab(newValue);
  const handleCompareChange = (_, newValue) =>
    newValue && setCompareMode(newValue);
  const handleRangeChange = (e) => setRange(e.target.value);
  const handleSocAlgorithmChange = (event) =>
    setSocAlgorithm(event.target.value);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // ---- Fetch calibrated + computed readings ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [processedRes, eventRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/sensor/processed?range=${range}`),
          axios.get("http://localhost:5000/api/battery/events"),
        ]);

        let data = processedRes.data || [];

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const endOfYesterday = new Date(startOfToday);

        if (range === "today") {
          data = data.filter((d) => new Date(d.timestamp) >= startOfToday);
        } else if (range === "yesterday") {
          data = data.filter(
            (d) =>
              new Date(d.timestamp) >= startOfYesterday &&
              new Date(d.timestamp) < endOfYesterday
          );
        }

        setSensorData(data);
        setEvents(eventRes.data);
      } catch (err) {
        console.error("Error fetching processed readings from microgridDB:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [range]);

  const sortedData = [...sensorData].sort((a, b) => {
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    if (a[sortConfig.key] < b[sortConfig.key]) return -1 * dir;
    if (a[sortConfig.key] > b[sortConfig.key]) return 1 * dir;
    return 0;
  });

  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    (page + 1) * rowsPerPage
  );

  const combinedData = Array.isArray(sensorData)
    ? sensorData
        .slice(-100)
        .filter((a) => a && a.timestamp)
        .map((a) => ({
          time: a.timestamp,
          Voltage: a.voltage_V ?? 0,
          Current: a.current_A ?? 0,
          SoC:
            socAlgorithm === "ocv"
              ? a.soc_ocv ?? 0
              : socAlgorithm === "cc"
              ? a.soc_cc ?? 0
              : a.soc_kf ?? 0,
          SoH: a.soh_pct ?? 100,
          Temp: a.temperature_C ?? 25,
        }))
    : [];

  const getRangeLabel = () => {
    if (range === "today") return "Today";
    if (range === "yesterday") return "Yesterday";
    return "All Recorded Data";
  };

  return (
    <Fade in={true} timeout={1000}>
      <Box sx={{ display: "flex", height: "100vh", bgcolor: "#f8fafc" }}>
        <Sidebar tab={tab} handleTabChange={handleTabChange} />

        <Box
          sx={{
            flex: 1,
            p: 4,
            overflowY: "auto",
            background: "#ffffff",
            minHeight: "100vh",
            marginLeft: "280px",
            width: "calc(100% - 280px)",
            borderTopLeftRadius: 20,
            borderBottomLeftRadius: 20,
          }}
        >
          {tab === 0 && (
            <OverviewTab
              batteryA={Array.isArray(sensorData) ? sensorData : []}
              combinedData={Array.isArray(combinedData) ? combinedData : []}
              compareMode={compareMode}
              handleCompareChange={handleCompareChange}
              expanded={expanded}
              setExpanded={setExpanded}
              socAlgorithm={socAlgorithm}
            />
          )}

          {tab === 1 && (
            <LogsTab
              sensorData={sensorData}
              range={range}
              handleRangeChange={handleRangeChange}
              getRangeLabel={getRangeLabel}
              sortConfig={sortConfig}
              handleSort={handleSort}
              paginatedData={paginatedData}
              page={page}
              setPage={setPage}
              rowsPerPage={rowsPerPage}
            />
          )}

          {tab === 2 && <EventsTab events={events} />}

          {tab === 3 && (
            <SettingsTab
              socAlgorithm={socAlgorithm}
              handleSocAlgorithmChange={handleSocAlgorithmChange}
            />
          )}
        </Box>
      </Box>
    </Fade>
  );
}

export default Dashboard;