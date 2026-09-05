const mongoose = require("mongoose");
const { buildLearningRoadmap, getLearningContext, getNextTopic, getPreviousTopic, getPosition } = require("../services/roadmapService");
const LearningMemory = require("../models/LearningMemory");

function isValidId(id) {
  return id && mongoose.Types.ObjectId.isValid(id);
}

// GET /api/learning/paths/:pathId/roadmap
exports.getRoadmap = async (req, res) => {
  try {
    const { pathId } = req.params;
    if (!isValidId(pathId)) return res.status(400).json({ message: "Invalid pathId" });
    const roadmap = await buildLearningRoadmap(pathId);
    // Return compact without duplicating flatTopics twice — keep stages + meta
    res.json({
      path: roadmap.path,
      stages: roadmap.stages,
      meta: roadmap.meta,
      totalTopics: roadmap.flatTopics.length,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status === 404) return res.status(404).json({ message: err.message });
    if (status === 400) return res.status(400).json({ message: err.message });
    console.error("getRoadmap error:", err);
    res.status(500).json({ message: "Failed to load roadmap" });
  }
};

// GET /api/learning/paths/:pathId/context?currentTopicId=xxx
exports.getContext = async (req, res) => {
  try {
    const { pathId } = req.params;
    const { currentTopicId } = req.query;
    if (!isValidId(pathId)) return res.status(400).json({ message: "Invalid pathId" });
    if (currentTopicId && !isValidId(currentTopicId)) return res.status(400).json({ message: "Invalid currentTopicId" });
    const ctx = await getLearningContext(pathId, currentTopicId || null);
    res.json(ctx);
  } catch (err) {
    const status = err.status || 500;
    if (status === 404) return res.status(404).json({ message: err.message });
    if (status === 400) return res.status(400).json({ message: err.message });
    console.error("getContext error:", err);
    res.status(500).json({ message: "Failed to load learning context" });
  }
};

// GET /api/learning/paths/:pathId/next?currentTopicId=xxx
exports.getNext = async (req, res) => {
  try {
    const { pathId } = req.params;
    const { currentTopicId } = req.query;
    if (!isValidId(pathId)) return res.status(400).json({ message: "Invalid pathId" });
    if (currentTopicId && !isValidId(currentTopicId)) return res.status(400).json({ message: "Invalid currentTopicId" });
    const result = await getNextTopic(pathId, currentTopicId || null);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 404) return res.status(404).json({ message: err.message });
    if (status === 400) return res.status(400).json({ message: err.message });
    console.error("getNext error:", err);
    res.status(500).json({ message: "Failed to get next topic" });
  }
};

// GET /api/learning/paths/:pathId/previous?currentTopicId=xxx
exports.getPrevious = async (req, res) => {
  try {
    const { pathId } = req.params;
    const { currentTopicId } = req.query;
    if (!isValidId(pathId)) return res.status(400).json({ message: "Invalid pathId" });
    if (currentTopicId && !isValidId(currentTopicId)) return res.status(400).json({ message: "Invalid currentTopicId" });
    const result = await getPreviousTopic(pathId, currentTopicId || null);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 404) return res.status(404).json({ message: err.message });
    console.error("getPrevious error:", err);
    res.status(500).json({ message: "Failed to get previous topic" });
  }
};

// GET /api/learning/paths/:pathId/position?currentTopicId=xxx
// If currentTopicId not provided, uses student's saved currentTopic for that path
exports.getPosition = async (req, res) => {
  try {
    const { pathId } = req.params;
    let { currentTopicId } = req.query;
    if (!isValidId(pathId)) return res.status(400).json({ message: "Invalid pathId" });
    if (currentTopicId && !isValidId(currentTopicId)) return res.status(400).json({ message: "Invalid currentTopicId" });

    // Fallback to student's LearningMemory if no topic provided
    if (!currentTopicId && req.user?.id) {
      const mem = await LearningMemory.findOne({ user: req.user.id }).select("currentTopic activeLearningPath").lean();
      // only use if student's active path matches requested path
      if (mem?.currentTopic && mem?.activeLearningPath?.toString() === pathId.toString()) {
        currentTopicId = mem.currentTopic;
      } else if (mem?.currentTopic) {
        // if student has a current topic but path differs, don't auto-use — treat as no current
        currentTopicId = null;
      }
    }

    const pos = await getPosition(pathId, currentTopicId || null);
    res.json(pos);
  } catch (err) {
    const status = err.status || 500;
    if (status === 404) return res.status(404).json({ message: err.message });
    console.error("getPosition error:", err);
    res.status(500).json({ message: "Failed to get position" });
  }
};

// GET /api/learning/roadmap/current — student-specific, uses JWT's currentTopic
exports.getMyPosition = async (req, res) => {
  try {
    const mem = await LearningMemory.findOne({ user: req.user.id }).select("currentTopic activeLearningPath activeLearningGoal").lean();
    if (!mem?.activeLearningPath && !mem?.activeLearningGoal?.learningPath) {
      return res.json({ hasActivePath: false, message: "No active learning path" });
    }
    const pathId = mem.activeLearningPath || mem.activeLearningGoal?.learningPath;
    if (!pathId) return res.json({ hasActivePath: false });
    const pos = await getPosition(pathId, mem.currentTopic || null);
    // enrich with student's completed topics count for context
    const roadmap = await buildLearningRoadmap(pathId);
    res.json({
      hasActivePath: true,
      path: pos.path,
      current: pos.current,
      previous: pos.previous,
      next: pos.next,
      isFirst: pos.isFirst,
      isLast: pos.isLast,
      path_completed: pos.path_completed,
      totalTopics: pos.totalTopics,
      flatIndex: pos.flatIndex,
      stage: pos.stage,
      roadmapMeta: roadmap.meta,
    });
  } catch (err) {
    console.error("getMyPosition error:", err);
    res.status(500).json({ message: "Failed to load current position" });
  }
};
