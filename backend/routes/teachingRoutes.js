const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  startSession,
  getCurrentSession,
  getSession,
  postMessage,
  completeTopic,
  nextTopic,
} = require("../controllers/teachingController");

// All teaching routes require JWT, user isolation via req.user.id
router.post("/session/start", authMiddleware, startSession);
router.get("/session/current", authMiddleware, getCurrentSession);
router.get("/session/:id", authMiddleware, getSession);
router.post("/session/:id/message", authMiddleware, postMessage);
router.post("/session/:id/complete-topic", authMiddleware, completeTopic);
router.post("/session/:id/next-topic", authMiddleware, nextTopic);

module.exports = router;
