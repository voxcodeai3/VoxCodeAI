const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { generateSpeech, isConfigured, MAX_TEXT_LENGTH } = require("../services/ttsService");

// POST /api/voice/tts — generate speech audio
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { text, voice, speed } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "Text is required" });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        message: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
      });
    }

    const result = await generateSpeech(text, { voice, speed });

    if (!result) {
      return res.status(503).json({
        code: "TTS_NOT_CONFIGURED",
        message: "AI TTS is not configured. Using browser speech synthesis.",
      });
    }

    res.set({
      "Content-Type": result.contentType,
      "Content-Length": result.audio.length,
      "X-TTS-Provider": result.provider,
    });
    res.send(result.audio);
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ message: "TTS generation failed" });
  }
});

// GET /api/voice/tts/status — check if AI TTS is available
router.get("/status", authMiddleware, (req, res) => {
  res.json({ configured: isConfigured() });
});

module.exports = router;
