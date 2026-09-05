const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  startAssessment,
  getAssessment,
  getByPath,
  submitAnswer,
  completeAssessment,
} = require("../controllers/initialAssessmentController");

router.post("/start", authMiddleware, startAssessment);
router.get("/by-path/:pathId", authMiddleware, getByPath);
router.get("/:id", authMiddleware, getAssessment);
router.post("/:id/answer", authMiddleware, submitAnswer);
router.post("/:id/complete", authMiddleware, completeAssessment);

module.exports = router;
