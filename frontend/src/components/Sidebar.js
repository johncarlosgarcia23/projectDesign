import React from "react";
import { Typography, Tabs, Tab, Box } from "@mui/material";
import { Assessment, Timeline, Event, Settings } from "@mui/icons-material";

function Sidebar({ tab, handleTabChange }) {
  return (
    <Box
      sx={{
        width: 280,
        background: "linear-gradient(180deg, #282C35 0%, #1a1a1a 100%)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 4,
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        zIndex: 1000,
        overflowY: "auto",
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, #ffffff, #cccccc, #999999)",
        },
      }}
    >
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: "800",
            background: "linear-gradient(45deg, #ffffff, #cccccc)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Smart Battery
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: "#cccccc",
            fontWeight: "500",
            letterSpacing: "0.05em",
          }}
        >
          Monitoring System
        </Typography>
      </Box>
      <Tabs
        orientation="vertical"
        value={tab}
        onChange={handleTabChange}
        textColor="inherit"
        indicatorColor="secondary"
        sx={{
          width: "100%",
          "& .MuiTab-root": {
            minHeight: 56,
            borderRadius: 2,
            mx: 1,
            mb: 1,
            transition: "all 0.3s ease",
            "&:hover": {
              backgroundColor: "rgba(255,255,255,0.1)",
              transform: "translateX(4px)",
            },
            "&.Mui-selected": {
              backgroundColor: "rgba(255,255,255,0.15)",
              fontWeight: "600",
            },
          },
        }}
      >
        <Tab
          icon={<Assessment sx={{ fontSize: 20 }} />}
          label="Overview"
          iconPosition="start"
          sx={{ justifyContent: "flex-start", pl: 3 }}
        />
        <Tab
          icon={<Timeline sx={{ fontSize: 20 }} />}
          label="Battery Logs"
          iconPosition="start"
          sx={{ justifyContent: "flex-start", pl: 3 }}
        />
        <Tab
          icon={<Event sx={{ fontSize: 20 }} />}
          label="Events"
          iconPosition="start"
          sx={{ justifyContent: "flex-start", pl: 3 }}
        />
        
        <Tab
          icon={<Settings sx={{ fontSize: 20 }} />}
          label="Settings"
          iconPosition="start"
          sx={{ justifyContent: "flex-start", pl: 3 }}
        />
      </Tabs>
    </Box>
  );
}

export default Sidebar;