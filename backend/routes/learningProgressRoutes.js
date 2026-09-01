const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getProgress, updateProgress, getSkills, updateSkill } = require("../controllers/learningProgressController");

router.get("/progress", authMiddleware, getProgress);
router.post("/progress", authMiddleware, updateProgress);
router.get("/skills", authMiddleware, getSkills);
router.post("/skills", authMiddleware, updateSkill);

module.exports = router;
