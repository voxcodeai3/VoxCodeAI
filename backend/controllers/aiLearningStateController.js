const mongoose = require("mongoose");
const LearningMemory = require("../models/LearningMemory");
const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");
const { Lesson } = require("../models/Course");
const Project = require("../models/Project");

const LEVEL_ENUM = ["beginner", "intermediate", "advanced"];
const SESSION_STATUS = ["active", "paused", "completed"];
const CONFIDENCE_ENUM = ["low", "medium", "high"];

// Helper: ensure existing progress is not lost — we never overwrite completed arrays destructively
function isValidId(id) {
  return id && mongoose.Types.ObjectId.isValid(id);
}

async function getOrCreateState(userId) {
  const mem = await LearningMemory.findOrCreate(userId);
  return mem;
}

// Populate all refs for a full state response
async function populateState(mem) {
  await mem.populate([
    { path: "activeLearningPath", select: "title slug category level" },
    { path: "activeLearningGoal.learningPath", select: "title slug category level" },
    { path: "currentStage", select: "title slug level order" },
    { path: "currentTopic", select: "title slug order" },
    { path: "currentLesson", select: "title slug objective type difficulty" },
    { path: "currentProject", select: "name" },
    { path: "currentExercise.lessonId", select: "title" },
    { path: "completedTopics", select: "title slug" },
    { path: "topicsNeedingReview", select: "title slug" },
    { path: "weakTopicsDetailed.topicId", select: "title slug" },
    { path: "learningSession.learningPath", select: "title" },
    { path: "learningSession.stage", select: "title" },
    { path: "learningSession.topic", select: "title" },
  ]);
  return mem;
}

// GET /api/learning/state — full learning state for authenticated user
exports.getState = async (req, res) => {
  try {
    const userId = req.user.id;
    const mem = await getOrCreateState(userId);
    await populateState(mem);
    res.json(mem);
  } catch (err) {
    console.error("getState error:", err);
    res.status(500).json({ message: "Failed to load learning state" });
  }
};

// PATCH /api/learning/state — validated partial updates
exports.patchState = async (req, res) => {
  try {
    const userId = req.user.id;
    const mem = await getOrCreateState(userId);
    const body = req.body || {};

    // Whitelist — only these keys can be patched via this endpoint
    const allowed = [
      "activeLearningGoal",
      "activeLearningPath",
      "currentStage",
      "currentTopic",
      "currentLesson",
      "currentExercise",
      "currentProject",
      "currentLevel",
      "assessmentCompleted",
      "assessmentLevel",
      "assessmentResults",
      "learningSession",
      "lastLearningSession",
      "weakTopicsDetailed",
      "topicsNeedingReview",
    ];

    for (const k of Object.keys(body)) {
      if (!allowed.includes(k)) {
        return res.status(400).json({ message: `Field not allowed: ${k}` });
      }
    }

    // — activeLearningGoal —
    if ("activeLearningGoal" in body) {
      const g = body.activeLearningGoal;
      if (g === null) {
        mem.activeLearningGoal = null;
      } else if (typeof g === "object") {
        const type = g.type || "learning_path";
        if (!["learning_path", "custom"].includes(type)) return res.status(400).json({ message: "activeLearningGoal.type must be learning_path or custom" });
        let lp = null;
        let name = (g.name || "").trim().slice(0, 80);
        if (g.learningPath || g.learningPathId) {
          const lpId = g.learningPath || g.learningPathId;
          if (!isValidId(lpId)) return res.status(400).json({ message: "Invalid learningPath id" });
          const exists = await LearningPath.findById(lpId).select("_id title").lean();
          if (!exists) return res.status(404).json({ message: "LearningPath not found" });
          lp = exists._id;
          if (!name) name = exists.title;
        }
        mem.activeLearningGoal = { type, learningPath: lp, name };
        // keep activeLearningPath in sync for backward compat
        if (lp) mem.activeLearningPath = lp;
      } else {
        return res.status(400).json({ message: "Invalid activeLearningGoal" });
      }
    }

    if ("activeLearningPath" in body) {
      const v = body.activeLearningPath;
      if (v === null) mem.activeLearningPath = null;
      else {
        if (!isValidId(v)) return res.status(400).json({ message: "Invalid activeLearningPath" });
        const exists = await LearningPath.findById(v).lean();
        if (!exists) return res.status(404).json({ message: "LearningPath not found" });
        mem.activeLearningPath = v;
        // also keep goal in sync if goal was learning_path
        if (mem.activeLearningGoal && mem.activeLearningGoal.type === "learning_path") {
          mem.activeLearningGoal.learningPath = v;
          mem.activeLearningGoal.name = exists.title;
        }
      }
    }

    if ("currentStage" in body) {
      const v = body.currentStage;
      if (v === null) mem.currentStage = null;
      else {
        if (!isValidId(v)) return res.status(400).json({ message: "Invalid currentStage" });
        const exists = await Stage.findById(v).lean();
        if (!exists) return res.status(404).json({ message: "Stage not found" });
        mem.currentStage = v;
      }
    }

    if ("currentTopic" in body) {
      const v = body.currentTopic;
      if (v === null) mem.currentTopic = null;
      else {
        if (!isValidId(v)) return res.status(400).json({ message: "Invalid currentTopic" });
        const exists = await Topic.findById(v).lean();
        if (!exists) return res.status(404).json({ message: "Topic not found" });
        mem.currentTopic = v;
      }
    }

    if ("currentLesson" in body) {
      const v = body.currentLesson;
      if (v === null) mem.currentLesson = null;
      else {
        if (!isValidId(v)) return res.status(400).json({ message: "Invalid currentLesson" });
        const exists = await Lesson.findById(v).lean();
        if (!exists) return res.status(404).json({ message: "Lesson not found" });
        mem.currentLesson = v;
      }
    }

    if ("currentExercise" in body) {
      const ex = body.currentExercise;
      if (ex === null) mem.currentExercise = { exerciseId: null, lessonId: null };
      else if (typeof ex === "object") {
        const exerciseId = ex.exerciseId ? String(ex.exerciseId).slice(0, 100) : null;
        let lessonId = ex.lessonId || null;
        if (lessonId && !isValidId(lessonId)) return res.status(400).json({ message: "Invalid currentExercise.lessonId" });
        if (lessonId) {
          const exists = await Lesson.findById(lessonId).lean();
          if (!exists) return res.status(404).json({ message: "Lesson not found for currentExercise" });
        }
        mem.currentExercise = { exerciseId, lessonId };
      } else return res.status(400).json({ message: "Invalid currentExercise" });
    }

    if ("currentProject" in body) {
      const v = body.currentProject;
      if (v === null) mem.currentProject = null;
      else {
        if (!isValidId(v)) return res.status(400).json({ message: "Invalid currentProject" });
        const exists = await Project.findOne({ _id: v, user: userId }).lean();
        if (!exists) return res.status(404).json({ message: "Project not found" });
        mem.currentProject = v;
      }
    }

    if ("currentLevel" in body) {
      const v = body.currentLevel;
      if (!LEVEL_ENUM.includes(v)) return res.status(400).json({ message: "currentLevel must be beginner|intermediate|advanced" });
      mem.currentLevel = v;
    }

    if ("assessmentCompleted" in body) {
      if (typeof body.assessmentCompleted !== "boolean") return res.status(400).json({ message: "assessmentCompleted must be boolean" });
      mem.assessmentCompleted = body.assessmentCompleted;
    }

    if ("assessmentLevel" in body) {
      const v = body.assessmentLevel;
      if (v !== null && !LEVEL_ENUM.includes(v)) return res.status(400).json({ message: "assessmentLevel must be beginner|intermediate|advanced or null" });
      mem.assessmentLevel = v;
    }

    if ("assessmentResults" in body) {
      const ar = body.assessmentResults;
      if (ar === null) mem.assessmentResults = null;
      else if (typeof ar === "object") {
        const out = {};
        if (ar.technology) out.technology = String(ar.technology).slice(0, 80);
        if (ar.estimatedLevel) {
          if (!LEVEL_ENUM.includes(ar.estimatedLevel)) return res.status(400).json({ message: "assessmentResults.estimatedLevel invalid" });
          out.estimatedLevel = ar.estimatedLevel;
        }
        if (ar.confidence) {
          if (!CONFIDENCE_ENUM.includes(ar.confidence)) return res.status(400).json({ message: "assessmentResults.confidence must be low|medium|high" });
          out.confidence = ar.confidence;
        }
        if (ar.notes) out.notes = String(ar.notes).slice(0, 500);
        out.completedAt = new Date();
        mem.assessmentResults = out;
        mem.assessmentCompleted = true;
        if (out.estimatedLevel) mem.assessmentLevel = out.estimatedLevel;
      } else return res.status(400).json({ message: "Invalid assessmentResults" });
    }

    if ("learningSession" in body || "lastLearningSession" in body) {
      const key = "learningSession" in body ? "learningSession" : "lastLearningSession";
      const s = body[key];
      if (s === null) mem[key] = null;
      else if (typeof s === "object") {
        const sess = {};
        if (s.status && !SESSION_STATUS.includes(s.status)) return res.status(400).json({ message: "learningSession.status must be active|paused|completed" });
        sess.status = s.status || "active";
        sess.startedAt = s.startedAt ? new Date(s.startedAt) : new Date();
        sess.lastActivity = new Date();
        if (s.learningPath) {
          if (!isValidId(s.learningPath)) return res.status(400).json({ message: "Invalid learningSession.learningPath" });
          sess.learningPath = s.learningPath;
        }
        if (s.stage) {
          if (!isValidId(s.stage)) return res.status(400).json({ message: "Invalid learningSession.stage" });
          sess.stage = s.stage;
        }
        if (s.topic) {
          if (!isValidId(s.topic)) return res.status(400).json({ message: "Invalid learningSession.topic" });
          sess.topic = s.topic;
        }
        mem[key] = sess;
      } else return res.status(400).json({ message: "Invalid learningSession" });
    }

    if ("weakTopicsDetailed" in body) {
      const arr = body.weakTopicsDetailed;
      if (!Array.isArray(arr)) return res.status(400).json({ message: "weakTopicsDetailed must be array" });
      if (arr.length > 30) return res.status(400).json({ message: "Too many weak topics" });
      const cleaned = [];
      for (const w of arr) {
        if (typeof w !== "object") continue;
        const topicId = w.topicId && isValidId(w.topicId) ? w.topicId : null;
        const topicName = (w.topicName || w.topic || "").trim().slice(0, 80);
        if (!topicId && !topicName) continue;
        cleaned.push({
          topicId,
          topicName,
          topic: topicName,
          reason: String(w.reason || "").slice(0, 200),
          strength: ["weak", "needs_review"].includes(w.strength) ? w.strength : "weak",
          lastReviewedAt: w.lastReviewedAt ? new Date(w.lastReviewedAt) : null,
        });
      }
      mem.weakTopicsDetailed = cleaned;
    }

    if ("topicsNeedingReview" in body) {
      const arr = body.topicsNeedingReview;
      if (!Array.isArray(arr)) return res.status(400).json({ message: "topicsNeedingReview must be array" });
      const cleaned = [];
      for (const id of arr) {
        if (!isValidId(id)) continue;
        const exists = await Topic.findById(id).select("_id").lean();
        if (exists) cleaned.push(id);
      }
      mem.topicsNeedingReview = cleaned.slice(0, 30);
    }

    mem.lastActivity = new Date();
    mem.lastOpenedAt = new Date();
    await mem.save();
    await populateState(mem);
    res.json(mem);
  } catch (err) {
    console.error("patchState error:", err);
    res.status(500).json({ message: "Failed to update learning state" });
  }
};

// GET /api/learning/current — compact context for AI (no full history)
exports.getCurrent = async (req, res) => {
  try {
    const userId = req.user.id;
    const mem = await LearningMemory.findOne({ user: userId })
      .populate("activeLearningPath", "title slug category level")
      .populate("activeLearningGoal.learningPath", "title slug")
      .populate("currentStage", "title slug level order")
      .populate("currentTopic", "title slug order")
      .populate("currentLesson", "title slug objective type difficulty")
      .populate("currentProject", "name")
      .lean();

    if (!mem) {
      return res.json({
        hasState: false,
        activeLearningPath: null,
        activeLearningGoal: null,
        currentStage: null,
        currentTopic: null,
        currentLesson: null,
        currentExercise: null,
        currentProject: null,
        currentLevel: "beginner",
        completed: { lessons: 0, topics: 0, stages: 0, exercises: 0 },
        weakTopics: [],
        topicsNeedingReview: [],
        assessment: { completed: false, level: null, result: null },
        recentQuizResults: [],
        recentExerciseResults: [],
        session: null,
      });
    }

    // Recent completed titles (limit 5)
    let recentCompletedTitles = [];
    if (mem.completedLessons?.length) {
      const ids = mem.completedLessons.slice(-5);
      const docs = await Lesson.find({ _id: { $in: ids } }).select("title").lean();
      recentCompletedTitles = docs.map((d) => d.title);
    }

    res.json({
      hasState: !!mem.activeLearningPath || !!mem.activeLearningGoal,
      activeLearningPath: mem.activeLearningPath || null,
      activeLearningGoal: mem.activeLearningGoal || null,
      currentStage: mem.currentStage || null,
      currentTopic: mem.currentTopic || null,
      currentLesson: mem.currentLesson || null,
      currentExercise: mem.currentExercise || null,
      currentProject: mem.currentProject || null,
      currentLevel: mem.currentLevel || "beginner",
      completed: {
        lessons: mem.completedLessons?.length || 0,
        topics: mem.completedTopics?.length || 0,
        stages: mem.completedStages?.length || 0,
        exercises: mem.completedExercises?.length || 0,
      },
      recentCompleted: recentCompletedTitles,
      weakTopics: mem.weakTopicsDetailed?.length ? mem.weakTopicsDetailed.slice(0, 5) : (mem.weakTopics || []).slice(0, 5),
      topicsNeedingReview: mem.topicsNeedingReview || [],
      assessment: {
        completed: !!mem.assessmentCompleted,
        level: mem.assessmentLevel || null,
        result: mem.assessmentResults || null,
      },
      recentQuizResults: (mem.quizResults || []).slice(-3),
      recentExerciseResults: (mem.exerciseResults || []).slice(-3),
      session: mem.learningSession || mem.lastLearningSession || null,
      lastActivity: mem.lastActivity,
      lastOpenedAt: mem.lastOpenedAt,
    });
  } catch (err) {
    console.error("getCurrent error:", err);
    res.status(500).json({ message: "Failed to load current learning context" });
  }
};
