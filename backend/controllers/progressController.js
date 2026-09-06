const mongoose = require("mongoose");
const {
  EVENT_TYPES,
  recordEvent,
  recordMistake,
  getReviewList,
  markReviewed,
  checkProgression,
  completeTopicForUser,
  getProgressSummary,
} = require("../services/memoryUpdateService");

function isValidId(id) {
  return id && mongoose.Types.ObjectId.isValid(id);
}

// POST /api/learning/progress/event
exports.postEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, pathId, learningPathId, stageId, topicId, detail } = req.body || {};
    if (!type || !EVENT_TYPES.includes(type)) {
      return res.status(400).json({ message: `type must be one of: ${EVENT_TYPES.join(", ")}` });
    }
    const pid = pathId || learningPathId || null;
    if (pid && !isValidId(pid)) return res.status(400).json({ message: "Invalid pathId" });
    if (stageId && !isValidId(stageId)) return res.status(400).json({ message: "Invalid stageId" });
    if (topicId && !isValidId(topicId)) return res.status(400).json({ message: "Invalid topicId" });
    // Validate topic belongs to path when both are given (backend is authoritative)
    if (pid && topicId) {
      const Topic = require("../models/Topic");
      const Stage = require("../models/Stage");
      const t = await Topic.findById(topicId).lean();
      if (!t) return res.status(404).json({ message: "Topic not found" });
      const st = await Stage.findById(t.stage).lean();
      if (!st || st.learningPath.toString() !== pid.toString()) {
        return res.status(400).json({ message: "Topic does not belong to path" });
      }
    }
    await recordEvent(userId, {
      type,
      learningPath: pid,
      stage: stageId || null,
      topic: topicId || null,
      detail: detail || "",
    });
    res.status(201).json({ message: "Event recorded", type });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400) return res.status(400).json({ message: err.message });
    console.error("postEvent error:", err);
    res.status(500).json({ message: "Failed to record event" });
  }
};

// POST /api/learning/progress/mistake — lightweight repeated-mistake tracking
exports.postMistake = async (req, res) => {
  try {
    const userId = req.user.id;
    const { concept, topicId, pathId, learningPathId } = req.body || {};
    if (!concept || typeof concept !== "string" || !concept.trim()) {
      return res.status(400).json({ message: "concept required" });
    }
    const pid = pathId || learningPathId || null;
    if (pid && !isValidId(pid)) return res.status(400).json({ message: "Invalid pathId" });
    if (topicId && !isValidId(topicId)) return res.status(400).json({ message: "Invalid topicId" });
    let topicName = "";
    if (topicId) {
      const Topic = require("../models/Topic");
      const t = await Topic.findById(topicId).lean();
      if (!t) return res.status(404).json({ message: "Topic not found" });
      topicName = t.title;
    }
    const m = await recordMistake(userId, { concept, topicId, topicName, learningPath: pid });
    res.status(201).json({ mistake: { concept: m.concept, mistakeCount: m.mistakeCount } });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400) return res.status(400).json({ message: err.message });
    console.error("postMistake error:", err);
    res.status(500).json({ message: "Failed to record mistake" });
  }
};

// GET /api/learning/progress/check?pathId=&topicId=
exports.getCheck = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pathId, topicId } = req.query;
    const result = await checkProgression(userId, pathId, topicId);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 400 || status === 404) return res.status(status).json({ message: err.message });
    console.error("getCheck error:", err);
    res.status(500).json({ message: "Failed to check progression" });
  }
};

// POST /api/learning/progress/complete-topic
exports.postCompleteTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pathId, learningPathId, topicId } = req.body || {};
    const result = await completeTopicForUser(userId, pathId || learningPathId, topicId);
    res.json({ message: "Topic completed", ...result });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400 || status === 404) return res.status(status).json({ message: err.message });
    console.error("postCompleteTopic error:", err);
    res.status(500).json({ message: "Failed to complete topic" });
  }
};

// GET /api/learning/progress/review?pathId=
exports.getReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pathId } = req.query;
    if (pathId && !isValidId(pathId)) return res.status(400).json({ message: "Invalid pathId" });
    const items = await getReviewList(userId, pathId || null);
    res.json({ items });
  } catch (err) {
    console.error("getReview error:", err);
    res.status(500).json({ message: "Failed to load review list" });
  }
};

// POST /api/learning/progress/review/:topicId — mark a topic reviewed (reduces priority)
exports.postReviewed = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topicId } = req.params;
    const { pathId, learningPathId } = req.body || {};
    const pid = pathId || learningPathId || null;
    if (pid && !isValidId(pid)) return res.status(400).json({ message: "Invalid pathId" });
    const updated = await markReviewed(userId, topicId, pid);
    res.json({ message: "Review priority reduced", reviewed: !!updated });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400) return res.status(400).json({ message: err.message });
    console.error("postReviewed error:", err);
    res.status(500).json({ message: "Failed to mark reviewed" });
  }
};

// GET /api/learning/progress/summary?pathId= — roadmap-authoritative progress
exports.getSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pathId } = req.query;
    const summary = await getProgressSummary(userId, pathId);
    res.json(summary);
  } catch (err) {
    const status = err.status || 500;
    if (status === 400 || status === 404) return res.status(status).json({ message: err.message });
    console.error("getSummary error:", err);
    res.status(500).json({ message: "Failed to load progress" });
  }
};
