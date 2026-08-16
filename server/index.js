const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");
const authRoutes = require("./routes/auth");
const sessionRoutes = require("./routes/sessions");
const practiceRoutes = require("./routes/practices");
const configRoutes = require("./routes/config");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ ok: true, db: "connected" });
  } catch {
    return res.status(500).json({ ok: false, db: "disconnected" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/practices", practiceRoutes);
app.use("/api/config", configRoutes);

app.use((_req, res) => {
  return res.status(404).json({ error: "Route not found" });
});

app.listen(port, () => {
  console.log(`Yoga app backend listening on port ${port}`);
});
