//LoginPage.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  TextField,
  Container,
  Typography,
  Paper,
  Box,
  Fade,
} from "@mui/material";
import axios from "axios";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

function LoginPage({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://projectdesign.onrender.com/api/users/login", form);
      if (res.data.success) {
        setIsAuthenticated(true);
        navigate("/dashboard");
      } else {
        alert(res.data.message || "Login failed");
      }
    } catch (err) {
      console.error(err);

      if (err.response && err.response.status === 401) {
        alert("Incorrect email or password.");
        return;
      }

      if (err.code === "ERR_NETWORK") {
        alert("Cannot connect to server. Network error.");
        return;
      }

      alert("Login failed due to an unexpected error.");
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        bgcolor: "#f8fafc", 
      }}
    >
      <Container maxWidth="xs">
        <Fade in={true} timeout={1000}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 3, 
            boxShadow:
              "0 10px 25px rgba(0,0,0,0.15), 0 4px 6px rgba(0,0,0,0.1)", 
            border: "2px solid #282C35", 
          }}
        >
          <Typography
            variant="h4"
            gutterBottom
            textAlign="center"
            sx={{
              color: "#282C35", 
              fontWeight: 700,
            }}
          >
            Login
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              margin="normal"
              id="email"
              name="email"
              label="Email"
              value={form.email}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              id="password"
              name="password"
              label="Password"
              type="password"
              value={form.password}
              onChange={handleChange}
            />
            <Button
              variant="contained"
              fullWidth
              type="submit"
              sx={{
                mt: 3,
                py: 1.5,
                bgcolor: "#1e40af", 
                "&:hover": {
                  bgcolor: "#1d4ed8",
                },
              }}
            >
              Login
            </Button>
          </form>

          <Typography
            variant="body2"
            align="center"
            sx={{ my: 2, color: "gray" }}
          >
            — OR —
          </Typography>

          <GoogleOAuthProvider clientId="347206632967-93rouj3vl4ksokcpupgfuejgpgn1hp2l.apps.googleusercontent.com">
            <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  console.log("Google Login Success:", credentialResponse);
                  setIsAuthenticated(true);
                  navigate("/dashboard");
                }}
                onError={() => {
                  console.log("Google Login Failed");
                  alert("Login failed");
                }}
              />
            </Box>
          </GoogleOAuthProvider>

          <Box textAlign="center" sx={{ mt: 3 }}>
            <Button
              onClick={() => navigate("/signup")}
              sx={{ color: "#1e40af" }}
            >
              Don’t have an account? Sign Up
            </Button>
          </Box>
        </Paper>
        </Fade>
      </Container>
    </Box>
  );
}

export default LoginPage;
