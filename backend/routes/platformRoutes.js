const express = require("express");
const router = express.Router();
const PlatformSettings = require("../models/PlatformSettings");

// Public status — safe booleans only, no secrets, no auth required
router.get("/status", async (req, res) => {
  try {
    const status = await PlatformSettings.getPublicStatus();
    return res.json(status);
  } catch (err) {
    console.error("Platform status error:", err);
    return res.status(500).json({ message: "Failed to load platform status" });
  }
});

module.exports = router;
