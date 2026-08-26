const router = require("express").Router();
const {
  createInterview,
  listInterviews,
  getActiveInterview,
  getInterview,
  updateInterview,
  generateInterviewQuestion,
  submitAnswer,
  completeInterview,
  pauseInterview,
  resumeInterview,
  deleteInterview,
} = require("../controllers/interviewController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createInterview);
router.get("/", authMiddleware, listInterviews);
router.get("/active", authMiddleware, getActiveInterview);
router.get("/:id", authMiddleware, getInterview);
router.patch("/:id", authMiddleware, updateInterview);
router.post("/:id/question", authMiddleware, generateInterviewQuestion);
router.post("/:id/answer", authMiddleware, submitAnswer);
router.post("/:id/complete", authMiddleware, completeInterview);
router.post("/:id/pause", authMiddleware, pauseInterview);
router.post("/:id/resume", authMiddleware, resumeInterview);
router.delete("/:id", authMiddleware, deleteInterview);

module.exports = router;
