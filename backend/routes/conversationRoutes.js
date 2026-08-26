const router = require("express").Router();
const {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
} = require("../controllers/conversationController");
const authMiddleware = require("../middleware/authMiddleware");

// All conversation endpoints require JWT authentication.
router.post("/", authMiddleware, createConversation);
router.get("/", authMiddleware, listConversations);
router.get("/:id", authMiddleware, getConversation);
router.patch("/:id", authMiddleware, updateConversation);
router.delete("/:id", authMiddleware, deleteConversation);

module.exports = router;
