const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

router.post("/signup", async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      age,
      gender,
      height_cm,
      weight_kg,
      experience_level,
    } = req.body || {};

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "full_name, email, password are required" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      `INSERT INTO users
      (full_name, email, password_hash, age, gender, height_cm, weight_kg, experience_level)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id, full_name, email, age, gender, height_cm, weight_kg, experience_level, created_at`,
      [full_name, email, password_hash, age || null, gender || null, height_cm || null, weight_kg || null, experience_level || null]
    );

    const user = inserted.rows[0];
    const token = signToken(user.id);
    return res.status(201).json({ token, user });
  } catch (error) {
    return res.status(500).json({ error: "Failed to sign up" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, age, gender, height_cm, weight_kg, experience_level, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const row = result.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      age: row.age,
      gender: row.gender,
      height_cm: row.height_cm,
      weight_kg: row.weight_kg,
      experience_level: row.experience_level,
      created_at: row.created_at,
    };
    const token = signToken(user.id);
    return res.json({ token, user });
  } catch {
    return res.status(500).json({ error: "Failed to login" });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, age, gender, height_cm, weight_kg, experience_level, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({ user: result.rows[0] });
  } catch {
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;
