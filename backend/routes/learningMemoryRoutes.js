const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getMemory,
  getResume,
  updateProgress,
  addWeakTopic,
  saveExercise,
  saveQuiz,
  saveProjectProgress,
  getWeakTopics,
} = require("../controllers/learningMemoryController");

router.get("/", authMiddleware, getMemory);
router.get("/resume", authMiddleware, getResume);
router.get("/weak-topics", authMiddleware, getWeakTopics);
router.post("/progress", authMiddleware, updateProgress);
router.post("/weak-topic", authMiddleware, addWeakTopic);
router.post("/exercise", authMiddleware, saveExercise);
router.post("/quiz", authMiddleware, saveQuiz);
router.post("/project", authMiddleware, saveProjectProgress);

module.exports = router;
