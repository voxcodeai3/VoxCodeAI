const mongoose = require("mongoose");
const TeachingSession = require("../models/TeachingSession");
const LearningMemory = require("../models/LearningMemory");
const { buildLearningRoadmap, getPosition, getNextTopic } = require("../services/roadmapService");
const { getOrCreateSession, processMessage, completeTopic } = require("../services/teachingService");

function isValidId(id) {
  return id && mongoose.Types.ObjectId.isValid(id);
}

// POST /api/learning/teaching/session/start
exports.startSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { learningPathId, pathId, stageId, topicId } = req.body || {};
    const pid = learningPathId || pathId;
    if (!pid || !isValidId(pid)) return res.status(400).json({ message: "learningPathId required" });
    // topicId optional, stageId optional — if topicId provided validate, else auto-resolve
    let tid = topicId || null;
    if (tid && !isValidId(tid)) return res.status(400).json({ message: "Invalid topicId" });
    if (stageId && !isValidId(stageId)) return res.status(400).json({ message: "Invalid stageId" });

    // If topic not provided but stage provided, pick first topic of that stage
    if (!tid && stageId) {
      const Topic = require("../models/Topic");
      const t = await Topic.findOne({ stage: stageId, status: "published" }).sort({ order: 1 }).lean();
      if (t) tid = t._id;
    }

    const session = await getOrCreateSession(userId, pid, tid);
    // Populate for response
    await session.populate([
      { path: "learningPath", select: "title slug category" },
      { path: "stage", select: "title slug level" },
      { path: "topic", select: "title slug description" },
    ]);
    res.status(201).json({ session });
  } catch (err) {
    const status = err.status || 500;
    if (status === 404 || status === 400) return res.status(status).json({ message: err.message });
    console.error("startSession error:", err);
    res.status(500).json({ message: "Failed to start teaching session" });
  }
};

// GET /api/learning/teaching/session/current
exports.getCurrentSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const session = await TeachingSession.findOne({ user: userId, status: "active" })
      .sort({ updatedAt: -1 })
      .populate("learningPath", "title slug category")
      .populate("stage", "title slug level")
      .populate("topic", "title slug description");
    if (!session) return res.json({ session: null, hasActive: false });
    // Also return roadmap position for context
    let position = null;
    try {
      position = await getPosition(session.learningPath, session.topic);
    } catch {}
    res.json({ session, hasActive: true, position });
  } catch (err) {
    console.error("getCurrentSession error:", err);
    res.status(500).json({ message: "Failed to load current session" });
  }
};

// GET /api/learning/teaching/session/:id
exports.getSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid session id" });
    const session = await TeachingSession.findOne({ _id: id, user: userId })
      .populate("learningPath", "title slug category")
      .populate("stage", "title slug level")
      .populate("topic", "title slug description");
    if (!session) return res.status(404).json({ message: "Session not found" });
    let position = null;
    try {
      position = await getPosition(session.learningPath, session.topic);
    } catch {}
    res.json({ session, position });
  } catch (err) {
    console.error("getSession error:", err);
    res.status(500).json({ message: "Failed to load session" });
  }
};

// POST /api/learning/teaching/session/:id/message
exports.postMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { message } = req.body || {};
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid session id" });
    if (!message || typeof message !== "string" || !message.trim()) return res.status(400).json({ message: "Message required" });
    const result = await processMessage(userId, id, message);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 404 || status === 400) return res.status(status).json({ message: err.message });
    if (err.code === "AI_NOT_CONFIGURED") return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: "AI not configured" });
    if (err.code === "ALL_MODELS_UNAVAILABLE") return res.status(503).json({ code: "ALL_MODELS_UNAVAILABLE", message: "All AI models unavailable" });
    console.error("postMessage error:", err);
    res.status(500).json({ message: "Failed to process message" });
  }
};

// POST /api/learning/teaching/session/:id/complete-topic
exports.completeTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid session id" });
    const result = await completeTopic(userId, id);
    res.json({ message: "Topic completed", session: result.session, next: result.next });
  } catch (err) {
    const status = err.status || 500;
    if (status === 404 || status === 400) return res.status(status).json({ message: err.message });
    console.error("completeTopic error:", err);
    res.status(500).json({ message: "Failed to complete topic" });
  }
};

// POST /api/learning/teaching/session/:id/next-topic — move to next via roadmap
exports.nextTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid session id" });
    const session = await TeachingSession.findOne({ _id: id, user: userId });
    if (!session) return res.status(404).json({ message: "Session not found" });
    const next = await getNextTopic(session.learningPath, session.topic);
    if (next.path_completed) {
      return res.json({ path_completed: true, message: "Learning path completed" });
    }
    // Create new session for next topic
    const Topic = require("../models/Topic");
    const nextTopic = await Topic.findById(next.next.id || next.next._id).lean();
    const Stage = require("../models/Stage");
    const stage = await Stage.findById(nextTopic.stage).lean();
    const newSession = await getOrCreateSession(userId, session.learningPath, nextTopic._id);
    await newSession.populate([
      { path: "learningPath", select: "title slug" },
      { path: "stage", select: "title slug level" },
      { path: "topic", select: "title slug description" },
    ]);
    res.json({ session: newSession, next: next.next, path_completed: false });
  } catch (err) {
    const status = err.status || 500;
    if (status === 404 || status === 400) return res.status(status).json({ message: err.message });
    console.error("nextTopic error:", err);
    res.status(500).json({ message: "Failed to get next topic" });
  }
};
