const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { startQuiz, getQuiz, submitAnswer, getHint, completeQuiz } = require("../controllers/miniQuizController");

router.post("/start", authMiddleware, startQuiz);
router.get("/:quizId", authMiddleware, getQuiz);
router.post("/:quizId/answer", authMiddleware, submitAnswer);
router.post("/:quizId/hint", authMiddleware, getHint);
router.post("/:quizId/complete", authMiddleware, completeQuiz);

module.exports = router;
