const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/start", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO sessions (user_id) VALUES ($1) RETURNING id`,
      [req.user.id]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch {
    return res.status(500).json({ error: "Failed to start session" });
  }
});

router.post("/:id/end", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE sessions
       SET ended_at = NOW(), status = 'completed'
       WHERE id = $1 AND user_id = $2
       RETURNING id, ended_at, status`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: "Failed to end session" });
  }
});

module.exports = router;
