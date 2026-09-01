const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  listAssessments, getAssessment, startAttempt, getAttempt,
  submitAnswer, completeAttempt, getResult,
  getPlacement, startReview, getMyAttempts, getWeakSkills,
} = require("../controllers/assessmentController");

router.get("/", authMiddleware, listAssessments);
router.get("/weak-skills", authMiddleware, getWeakSkills);
router.get("/my-attempts", authMiddleware, getMyAttempts);
router.get("/placement/:skill", authMiddleware, getPlacement);
router.post("/review", authMiddleware, startReview);
router.get("/:id", authMiddleware, getAssessment);
router.post("/:assessmentId/start", authMiddleware, startAttempt);
router.get("/attempts/:attemptId", authMiddleware, getAttempt);
router.post("/attempts/:attemptId/answer", authMiddleware, submitAnswer);
router.post("/attempts/:attemptId/complete", authMiddleware, completeAttempt);
router.get("/attempts/:attemptId/result", authMiddleware, getResult);

module.exports = router;
