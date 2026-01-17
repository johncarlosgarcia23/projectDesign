// SignUpPage.js
import React, { useState } from "react";
import axios from "axios";
import {
  Container,
  TextField,
  Button,
  Paper,
  Typography,
  Box,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

function SignUpPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const validatePassword = (password) => {
    const regex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}[\]:;<>,.?~\\/-]).{8,}$/;
    return regex.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword(form.password)) {
      alert(
        "Password must be at least 8 characters, include one uppercase letter, one number, and one special character."
      );
      return;
    }

    try {
      const res = await axios.post(
        "https://projectdesign.onrender.com/api/users/register",
        form
      );

      if (res.status === 201) {
        alert("Account created successfully. You can now log in.");
        navigate("/login");
      } else {
        alert(res.data.message || "Signup failed");
      }
    } catch (err) {
      console.error("Signup error:", err);

      if (err.response && err.response.status === 409) {
        alert("Signup failed due to an unexpected error.");
        return;
      }

      if (err.code === "ERR_NETWORK") {
        alert("Cannot reach server. Check your connection.");
        return;
      }

      alert("This email is already registered.");
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
            textAlign="center"
            gutterBottom
            sx={{
              color: "#282C35",
              fontWeight: 700,
            }}
          >
            Create Account
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              name="name"
              label="Name"
              margin="normal"
              value={form.name}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              name="email"
              label="Email"
              margin="normal"
              value={form.email}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              name="password"
              label="Password"
              type="password"
              margin="normal"
              value={form.password}
              onChange={handleChange}
              helperText="Min. 8 characters, 1 uppercase, 1 number, 1 special character."
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                mt: 3,
                py: 1.5,
                bgcolor: "#1e40af",
                "&:hover": {
                  bgcolor: "#1d4ed8",
                },
              }}
            >
              Sign Up
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
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  console.log("Google Sign-Up Success:", credentialResponse);
                  alert("Google account linked successfully!");
                  navigate("/login");
                }}
                onError={() => {
                  console.log("Google Sign-Up Failed");
                  alert("Google sign-up failed");
                }}
              />
            </Box>
          </GoogleOAuthProvider>

          <Box textAlign="center" sx={{ mt: 3 }}>
            <Button onClick={() => navigate("/login")} sx={{ color: "#1e40af" }}>
              Already have an account? Login
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default SignUpPage;
