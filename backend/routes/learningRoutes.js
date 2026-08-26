const router = require("express").Router();
const {
  createSession,
  listSessions,
  getActiveSession,
  getSession,
  updateSession,
  submitAnswer,
  requestHint,
  completeSession,
} = require("../controllers/learningController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/sessions", authMiddleware, createSession);
router.get("/sessions", authMiddleware, listSessions);
router.get("/sessions/active", authMiddleware, getActiveSession);
router.get("/sessions/:id", authMiddleware, getSession);
router.patch("/sessions/:id", authMiddleware, updateSession);
router.post("/sessions/:id/answer", authMiddleware, submitAnswer);
router.post("/sessions/:id/hint", authMiddleware, requestHint);
router.post("/sessions/:id/complete", authMiddleware, completeSession);

module.exports = router;
