const router = require("express").Router();
const { chat, getConversation, clearConversation, getModelStatus } = require("../controllers/aiController");
const authMiddleware = require("../middleware/authMiddleware");

// All AI endpoints require an authenticated user (JWT Bearer token).
router.post("/chat", authMiddleware, chat);
router.get("/conversation", authMiddleware, getConversation);
router.delete("/conversation", authMiddleware, clearConversation);
router.get("/models", authMiddleware, getModelStatus);

module.exports = router;
