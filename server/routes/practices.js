const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/", auth, async (req, res) => {
  try {
    const {
      session_id,
      pose_name,
      pose_sanskrit,
      pose_category,
      started_at,
      ended_at,
      duration_seconds,
      stopped_by,
    } = req.body || {};

    if (!session_id || !pose_name || !started_at || !ended_at || duration_seconds == null || !stopped_by) {
      return res.status(400).json({ error: "Missing required practice fields" });
    }

    const result = await pool.query(
      `INSERT INTO pose_practices
      (session_id, user_id, pose_name, pose_sanskrit, pose_category, started_at, ended_at, duration_seconds, stopped_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id`,
      [session_id, req.user.id, pose_name, pose_sanskrit || null, pose_category || null, started_at, ended_at, duration_seconds, stopped_by]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch {
    return res.status(500).json({ error: "Failed to save practice" });
  }
});

router.get("/session/:session_id", auth, async (req, res) => {
  try {
    const practicesResult = await pool.query(
      `SELECT id, pose_name, pose_sanskrit, pose_category, started_at, ended_at, duration_seconds, stopped_by, status
       FROM pose_practices
       WHERE user_id = $1 AND session_id = $2
       ORDER BY started_at ASC`,
      [req.user.id, req.params.session_id]
    );
    const countsResult = await pool.query(
      `SELECT pose_name, COUNT(*)::int AS total_count
       FROM pose_practices
       WHERE user_id = $1 AND session_id = $2
       GROUP BY pose_name
       ORDER BY pose_name ASC`,
      [req.user.id, req.params.session_id]
    );
    return res.json({ practices: practicesResult.rows, by_pose: countsResult.rows });
  } catch {
    return res.status(500).json({ error: "Failed to fetch session practices" });
  }
});

router.get("/user/stats", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        pose_name,
        pose_sanskrit,
        COUNT(*)::int AS total_count,
        COALESCE(SUM(duration_seconds), 0)::float AS total_seconds
       FROM pose_practices
       WHERE user_id = $1
       GROUP BY pose_name, pose_sanskrit
       ORDER BY total_count DESC, pose_name ASC`,
      [req.user.id]
    );
    return res.json({ rows: result.rows });
  } catch {
    return res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

router.get("/user/history", auth, async (req, res) => {
  try {
    const sessionsResult = await pool.query(
      `SELECT id, started_at, ended_at, status
       FROM sessions
       WHERE user_id = $1
       ORDER BY started_at DESC`,
      [req.user.id]
    );
    const practicesResult = await pool.query(
      `SELECT id, session_id, pose_name, pose_sanskrit, pose_category, started_at, ended_at, duration_seconds, stopped_by, status
       FROM pose_practices
       WHERE user_id = $1
       ORDER BY started_at ASC`,
      [req.user.id]
    );

    const practicesBySession = practicesResult.rows.reduce((acc, item) => {
      if (!acc[item.session_id]) acc[item.session_id] = [];
      acc[item.session_id].push(item);
      return acc;
    }, {});

    const history = sessionsResult.rows.map((session) => ({
      ...session,
      practices: practicesBySession[session.id] || [],
    }));
    return res.json({ sessions: history });
  } catch {
    return res.status(500).json({ error: "Failed to fetch history" });
  }
});

module.exports = router;
