const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/:key", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM app_config WHERE key = $1",
      [req.params.key]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Config key not found" });
    }
    return res.json({ key: req.params.key, value: result.rows[0].value });
  } catch {
    return res.status(500).json({ error: "Failed to fetch config" });
  }
});

router.put("/:key", auth, async (req, res) => {
  try {
    const { value } = req.body || {};
    if (typeof value !== "string") {
      return res.status(400).json({ error: "value must be a string" });
    }
    const result = await pool.query(
      `INSERT INTO app_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [req.params.key, value]
    );
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ error: "Failed to update config" });
  }
});

module.exports = router;
