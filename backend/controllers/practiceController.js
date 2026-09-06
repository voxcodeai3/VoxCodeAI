const mongoose = require("mongoose");
const LearningMemory = require("../models/LearningMemory");
const TeachingSession = require("../models/TeachingSession");
const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");
const Project = require("../models/Project");
const {
  getPracticeExercise,
  aiHint,
  aiReview,
  aiSolutionExplanation,
  verifyCompletion,
} = require("../services/practiceService");

function isValidId(id) {
  return id && mongoose.Types.ObjectId.isValid(id);
}

function publicExercise(ex) {
  const { solution, ...rest } = ex;
  return rest;
}

async function resolveExercise(userId, body) {
  const { pathId, learningPathId, topicId, exerciseId } = body || {};
  const pid = pathId || learningPathId;
  if (!pid || !isValidId(pid)) {
    const e = new Error("pathId required");
    e.status = 400;
    throw e;
  }
  if (!topicId || !isValidId(topicId)) {
    const e = new Error("topicId required");
    e.status = 400;
    throw e;
  }
  const mem = await LearningMemory.findOne({ user: userId }).lean();
  const level = mem?.currentLevel || mem?.assessmentLevel || "beginner";
  const ex = await getPracticeExercise({ pathId: pid, topicId, level });
  if (exerciseId && exerciseId !== ex.exerciseId) {
    // exerciseId must match the resolved exercise for this topic (prevents arbitrary IDs)
    const e = new Error("exerciseId does not match this topic");
    e.status = 400;
    throw e;
  }
  return { exercise: ex, level, mem };
}

// GET /api/learning/practice/exercise?pathId=&topicId=
exports.getExercise = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pathId, topicId } = req.query;
    if (!pathId || !isValidId(pathId)) return res.status(400).json({ message: "pathId required" });
    if (!topicId || !isValidId(topicId)) return res.status(400).json({ message: "topicId required" });
    const mem = await LearningMemory.findOne({ user: userId }).lean();
    const level = mem?.currentLevel || mem?.assessmentLevel || "beginner";
    const ex = await getPracticeExercise({ pathId, topicId, level });
    res.json({ exercise: publicExercise(ex) });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400 || status === 404) return res.status(status).json({ message: err.message });
    console.error("getExercise error:", err);
    res.status(500).json({ message: "Failed to load exercise" });
  }
};

// POST /api/learning/practice/start
exports.startPractice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pathId, learningPathId, topicId, projectId, stageId } = req.body || {};
    const pid = pathId || learningPathId;
    if (!pid || !isValidId(pid)) return res.status(400).json({ message: "pathId required" });
    if (!topicId || !isValidId(topicId)) return res.status(400).json({ message: "topicId required" });

    const topic = await Topic.findById(topicId).lean();
    if (!topic) return res.status(404).json({ message: "Topic not found" });
    const stage = await Stage.findById(topic.stage).lean();
    if (!stage || stage.learningPath.toString() !== pid.toString()) {
      return res.status(400).json({ message: "Topic does not belong to path" });
    }
    if (stageId && stageId.toString() !== stage._id.toString()) {
      return res.status(400).json({ message: "stageId does not match topic" });
    }

    let project = null;
    if (projectId) {
      if (!isValidId(projectId)) return res.status(400).json({ message: "Invalid projectId" });
      project = await Project.findOne({ _id: projectId, user: userId }).lean();
      if (!project) return res.status(404).json({ message: "Project not found" });
    }

    const mem = await LearningMemory.findOrCreate(userId);
    const level = mem.currentLevel || mem.assessmentLevel || "beginner";
    const ex = await getPracticeExercise({ pathId: pid, topicId, level });

    mem.activeLearningPath = pid;
    mem.activeLearningGoal = { type: "learning_path", learningPath: pid, name: (await LearningPath.findById(pid).lean())?.title || "Path" };
    mem.currentStage = stage._id;
    mem.currentTopic = topic._id;
    if (ex.lessonId) mem.currentLesson = ex.lessonId;
    mem.currentExercise = {
      exerciseId: ex.exerciseId,
      lessonId: ex.lessonId,
      topicId: topic._id,
      stageId: stage._id,
      learningPathId: pid,
      projectId: project?._id || mem.currentProject || null,
      filePath: ex.fileName,
      status: "in_progress",
    };
    if (project) mem.currentProject = project._id;
    // record in-progress exercise result (attempt tracking)
    const existingIdx = (mem.exerciseResults || []).findIndex((r) => r.exerciseId === ex.exerciseId);
    if (existingIdx >= 0) {
      mem.exerciseResults[existingIdx].attempts = (mem.exerciseResults[existingIdx].attempts || 0) + 1;
      mem.exerciseResults[existingIdx].status = "in_progress";
    } else {
      mem.exerciseResults.push({
        exerciseId: ex.exerciseId,
        lessonId: ex.lessonId,
        topicId: topic._id,
        topic: topic.title,
        passed: false,
        status: "in_progress",
        score: 0,
        attempts: 1,
      });
    }
    mem.lastActivity = new Date();
    mem.lastOpenedAt = new Date();
    await mem.save();

    res.status(201).json({ exercise: publicExercise(ex), project: project ? { id: project._id, name: project.name } : null });
  } catch (err) {
    console.error("startPractice error:", err);
    res.status(500).json({ message: "Failed to start practice" });
  }
};

// POST /api/learning/practice/hint
exports.getHint = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, output, error, hintLevel } = req.body || {};
    const level = Math.min(3, Math.max(1, parseInt(hintLevel, 10) || 1));
    const { exercise, level: studentLevel } = await resolveExercise(userId, req.body);
    const mem = await LearningMemory.findOne({ user: userId }).lean();
    const weakTopics = (mem?.weakTopicsDetailed?.map((w) => w.topicName || w.topic) || mem?.weakTopics || []).slice(0, 3);
    const hint = await aiHint({ exercise, code: code || "", error: error || "", output: output || "", hintLevel: level, weakTopics, level: studentLevel });
    res.json({ hint, hintLevel: level });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400 || status === 404) return res.status(status).json({ message: err.message });
    if (err.code === "AI_NOT_CONFIGURED") return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: "AI not configured" });
    if (err.code === "ALL_MODELS_UNAVAILABLE") return res.status(503).json({ code: "ALL_MODELS_UNAVAILABLE", message: "All AI models unavailable" });
    console.error("practice hint error:", err);
    res.status(500).json({ message: "Failed to get hint" });
  }
};

// POST /api/learning/practice/review
exports.reviewCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, output, error } = req.body || {};
    if (!code || typeof code !== "string" || !code.trim()) return res.status(400).json({ message: "code required" });
    const { exercise, level } = await resolveExercise(userId, req.body);
    const feedback = await aiReview({ exercise, code, output: output || "", error: error || "", level });
    res.json({ feedback });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400 || status === 404) return res.status(status).json({ message: err.message });
    if (err.code === "AI_NOT_CONFIGURED") return res.status(503).json({ code: "AI_NOT_CONFIGURED", message: "AI not configured" });
    if (err.code === "ALL_MODELS_UNAVAILABLE") return res.status(503).json({ code: "ALL_MODELS_UNAVAILABLE", message: "All AI models unavailable" });
    console.error("practice review error:", err);
    res.status(500).json({ message: "Failed to review code" });
  }
};

// POST /api/learning/practice/solution
exports.getSolution = async (req, res) => {
  try {
    const userId = req.user.id;
    const { exercise } = await resolveExercise(userId, req.body);
    const mem = await LearningMemory.findOne({ user: userId }).lean();
    const level = mem?.currentLevel || mem?.assessmentLevel || "beginner";
    const explanation = await aiSolutionExplanation({ exercise, level });
    res.json({ explanation, reference: exercise.solution || null });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400 || status === 404) return res.status(status).json({ message: err.message });
    console.error("practice solution error:", err);
    res.status(500).json({ message: "Failed to load solution" });
  }
};

// POST /api/learning/practice/complete
exports.completeExercise = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, output, error, projectId } = req.body || {};
    const { exercise } = await resolveExercise(userId, req.body);
    const check = verifyCompletion({ exercise, code: code || "", output: output || "", error: error || "" });
    if (!check.passed) {
      // Centralized weak signal on genuine struggle (Step 7) — nothing marked completed.
      if (error) {
        const { applyExerciseOutcome } = require("../services/memoryUpdateService");
        await applyExerciseOutcome(userId, { exercise, passed: false, error }).catch(() => {});
      }
      return res.status(400).json({ message: check.reason, passed: false });
    }

    const mem = await LearningMemory.findOrCreate(userId);
    // exerciseResults
    const idx = (mem.exerciseResults || []).findIndex((r) => r.exerciseId === exercise.exerciseId);
    if (idx >= 0) {
      mem.exerciseResults[idx].passed = true;
      mem.exerciseResults[idx].status = "completed";
      mem.exerciseResults[idx].score = 1;
      mem.exerciseResults[idx].attempts = (mem.exerciseResults[idx].attempts || 0) + 1;
      mem.exerciseResults[idx].completedAt = new Date();
    } else {
      mem.exerciseResults.push({
        exerciseId: exercise.exerciseId,
        lessonId: exercise.lessonId,
        topicId: exercise.topicId,
        topic: exercise.topicTitle,
        passed: true,
        status: "completed",
        score: 1,
        attempts: 1,
      });
    }
    if (!mem.completedExercises.find((e) => e.exerciseId === exercise.exerciseId)) {
      mem.completedExercises.push({ exerciseId: exercise.exerciseId, lessonId: exercise.lessonId, topicId: exercise.topicId });
    }
    // currentExercise -> completed
    mem.currentExercise = {
      exerciseId: exercise.exerciseId,
      lessonId: exercise.lessonId,
      topicId: exercise.topicId,
      stageId: exercise.stageId,
      learningPathId: exercise.pathId,
      projectId: projectId && isValidId(projectId) ? projectId : mem.currentExercise?.projectId || mem.currentProject || null,
      filePath: exercise.fileName,
      status: "completed",
    };
    // projectProgress
    const pid = (projectId && isValidId(projectId) ? projectId : mem.currentProject)?.toString();
    if (pid) {
      const proj = await Project.findOne({ _id: pid, user: userId }).lean();
      const pIdx = (mem.projectProgress || []).findIndex((p) => p.projectId?.toString() === pid);
      if (pIdx >= 0) {
        mem.projectProgress[pIdx].status = "in_progress";
        mem.projectProgress[pIdx].completedTasks = (mem.projectProgress[pIdx].completedTasks || 0) + 1;
        if (!mem.projectProgress[pIdx].totalTasks) mem.projectProgress[pIdx].totalTasks = mem.projectProgress[pIdx].completedTasks + 1;
        mem.projectProgress[pIdx].lastActivity = new Date();
      } else {
        mem.projectProgress.push({ projectId: pid, title: proj?.name || "Project", status: "in_progress", completedTasks: 1, totalTasks: 2 });
      }
    }
    // Centralized success update (Step 7): strength evidence + reduced review priority.
    await mem.save();
    const { applyExerciseOutcome } = require("../services/memoryUpdateService");
    await applyExerciseOutcome(userId, { exercise, passed: true }).catch(() => {});
    const mem2 = await LearningMemory.findOne({ user: userId });
    // teaching session progress
    const sess = await TeachingSession.findOne({ user: userId, learningPath: exercise.pathId, topic: exercise.topicId, status: "active" });
    if (sess) {
      sess.checksPassed += 1;
      sess.lastActivity = new Date();
      if (sess.teachingState === "ready_for_practice" || sess.teachingState === "mini_quiz" || sess.teachingState === "quiz_review") {
        sess.teachingState = "ready_for_practice";
      }
      await sess.save();
    }
    if (mem2?.learningSession) {
      mem2.learningSession.checksPassed = (mem2.learningSession.checksPassed || 0) + 1;
      mem2.learningSession.lastActivity = new Date();
    }
    if (mem2) {
      mem2.lastActivity = new Date();
      await mem2.save();
    }
    res.json({ message: "Exercise completed", passed: true, exerciseId: exercise.exerciseId });
  } catch (err) {
    const status = err.status || 500;
    if (status === 400 || status === 404) return res.status(status).json({ message: err.message });
    console.error("completeExercise error:", err);
    res.status(500).json({ message: "Failed to complete exercise" });
  }
};
