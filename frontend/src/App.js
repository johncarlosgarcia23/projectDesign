import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress, Fade } from "@mui/material";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Import your pages
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import Dashboard from "./pages/Dashboard";

// A simple component for your loading screen
function LoadingScreen() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        bgcolor: "#282C35", // Dark background
      }}
    >
      <Fade in={true} timeout={1500}>
        {/* You could put your logo here */}
        <CircularProgress color="inherit" sx={{ color: "white" }} />
      </Fade>
    </Box>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // <-- Loading state

  // This simulates your app "booting up"
  useEffect(() => {
    // This timer simulates fetching user data, etc.
    const timer = setTimeout(() => {
      setIsLoading(false); // Stop loading after 1.5 seconds
    }, 1500);

    return () => clearTimeout(timer); // Cleanup timer
  }, []);

  // 1. Show the loading screen while "booting up"
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 2. Once loaded, show the app
  return (
    <GoogleOAuthProvider clientId="347206632967-93rouj3vl4ksokcpupgfuejgpgn1hp2l.apps.googleusercontent.com">
      <Router>
        <Routes>
          <Route
            path="/login"
            element={<LoginPage setIsAuthenticated={setIsAuthenticated} />}
          />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Protected Route for Dashboard */}
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
            }
          />

          {/* Default route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;