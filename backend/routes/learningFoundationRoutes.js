const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getCategories,
  getTechnologies,
  getTechnologyBySlug,
  getPaths,
  getPathById,
  getPathStages,
  getStageTopics,
  getTopicLessons,
} = require("../controllers/learningFoundationController");

router.get("/categories", authMiddleware, getCategories);
router.get("/technologies", authMiddleware, getTechnologies);
router.get("/technologies/:slug", authMiddleware, getTechnologyBySlug);
router.get("/paths", authMiddleware, getPaths);
router.get("/paths/:pathId", authMiddleware, getPathById);
router.get("/paths/:pathId/stages", authMiddleware, getPathStages);
router.get("/stages/:stageId/topics", authMiddleware, getStageTopics);
router.get("/topics/:topicId/lessons", authMiddleware, getTopicLessons);

module.exports = router;
