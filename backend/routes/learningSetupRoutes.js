const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getGoals, getStacks, getTechnologies, getStackCurriculum,
  getProfile, saveProfile, startLearning,
} = require("../controllers/learningSetupController");

router.get("/goals", authMiddleware, getGoals);
router.get("/stacks", authMiddleware, getStacks);
router.get("/technologies", authMiddleware, getTechnologies);
router.get("/curriculum/:slug", authMiddleware, getStackCurriculum);
router.get("/profile", authMiddleware, getProfile);
router.post("/profile", authMiddleware, saveProfile);
router.post("/start", authMiddleware, startLearning);

module.exports = router;
