const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getExercise,
  startPractice,
  getHint,
  reviewCode,
  getSolution,
  completeExercise,
} = require("../controllers/practiceController");

router.get("/exercise", authMiddleware, getExercise);
router.post("/start", authMiddleware, startPractice);
router.post("/hint", authMiddleware, getHint);
router.post("/review", authMiddleware, reviewCode);
router.post("/solution", authMiddleware, getSolution);
router.post("/complete", authMiddleware, completeExercise);

module.exports = router;
