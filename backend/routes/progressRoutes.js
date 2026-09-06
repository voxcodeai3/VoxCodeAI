const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  postEvent,
  postMistake,
  getCheck,
  postCompleteTopic,
  getReview,
  postReviewed,
  getSummary,
} = require("../controllers/progressController");

// All routes require JWT; user isolation via req.user.id (never trust client userId)
router.post("/event", authMiddleware, postEvent);
router.post("/mistake", authMiddleware, postMistake);
router.get("/check", authMiddleware, getCheck);
router.post("/complete-topic", authMiddleware, postCompleteTopic);
router.get("/review", authMiddleware, getReview);
router.post("/review/:topicId", authMiddleware, postReviewed);
router.get("/summary", authMiddleware, getSummary);

module.exports = router;
