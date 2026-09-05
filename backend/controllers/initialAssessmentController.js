const mongoose = require("mongoose");
const InitialAssessment = require("../models/InitialAssessment");
const LearningMemory = require("../models/LearningMemory");
const LearningPath = require("../models/LearningPath");
const { buildLearningRoadmap } = require("../services/roadmapService");
const { generateQuestions, evaluateAssessment } = require("../services/initialAssessmentService");

function isValidId(id) {
  return id && mongoose.Types.ObjectId.isValid(id);
}

// POST /api/learning/assessment/start
exports.startAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { learningPathId, learningPath } = req.body || {};
    const pathId = learningPathId || learningPath;
    if (!pathId || !isValidId(pathId)) return res.status(400).json({ message: "learningPathId required" });
    const path = await LearningPath.findById(pathId).lean();
    if (!path) return res.status(404).json({ message: "LearningPath not found" });
    if (path.status !== "published") return res.status(400).json({ message: "LearningPath not active" });

    // If already completed for this path, return completed and skip
    const completed = await InitialAssessment.findCompleted(userId, pathId);
    if (completed) {
      return res.json({ alreadyCompleted: true, assessment: sanitizeForStudent(completed), message: "Assessment already completed for this path" });
    }
    // If active exists, resume it
    const active = await InitialAssessment.findActive(userId, pathId);
    if (active) {
      return res.json({ resumed: true, assessment: sanitizeForStudent(active) });
    }

    // Build roadmap and generate questions via AI
    const roadmap = await buildLearningRoadmap(pathId);
    const questions = await generateQuestions(roadmap);

    const assessment = await InitialAssessment.create({
      user: userId,
      learningPath: pathId,
      status: "active",
      questions,
      answers: [],
    });

    res.status(201).json({ assessment: sanitizeForStudent(assessment) });
  } catch (err) {
    console.error("startAssessment error:", err);
    res.status(500).json({ message: "Failed to start assessment" });
  }
};

// GET /api/learning/assessment/:id
exports.getAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid assessment id" });
    const a = await InitialAssessment.findOne({ _id: id, user: userId });
    if (!a) return res.status(404).json({ message: "Assessment not found" });
    res.json({ assessment: sanitizeForStudent(a) });
  } catch (err) {
    console.error("getAssessment error:", err);
    res.status(500).json({ message: "Failed to load assessment" });
  }
};

// GET /api/learning/assessment/by-path/:pathId — check existing for path
exports.getByPath = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pathId } = req.params;
    if (!isValidId(pathId)) return res.status(400).json({ message: "Invalid pathId" });
    const active = await InitialAssessment.findActive(userId, pathId);
    if (active) return res.json({ assessment: sanitizeForStudent(active), status: "active" });
    const completed = await InitialAssessment.findCompleted(userId, pathId);
    if (completed) return res.json({ assessment: sanitizeForStudent(completed), status: "completed" });
    return res.json({ assessment: null, status: "none" });
  } catch (err) {
    console.error("getByPath error:", err);
    res.status(500).json({ message: "Failed to load assessment status" });
  }
};

// POST /api/learning/assessment/:id/answer
exports.submitAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { questionId, answer } = req.body || {};
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid assessment id" });
    if (!questionId || typeof answer !== "string") return res.status(400).json({ message: "questionId and answer required" });
    const a = await InitialAssessment.findOne({ _id: id, user: userId });
    if (!a) return res.status(404).json({ message: "Assessment not found" });
    if (a.status !== "active") return res.status(400).json({ message: "Assessment not active" });
    const q = a.questions.find((qq) => qq.id === questionId);
    if (!q) return res.status(400).json({ message: "Question not found" });

    // Upsert answer
    const existingIdx = a.answers.findIndex((ans) => ans.questionId === questionId);
    if (existingIdx >= 0) {
      a.answers[existingIdx].answer = String(answer).slice(0, 1000);
      a.answers[existingIdx].answeredAt = new Date();
    } else {
      a.answers.push({ questionId, answer: String(answer).slice(0, 1000), answeredAt: new Date() });
    }
    await a.save();
    res.json({ assessment: sanitizeForStudent(a) });
  } catch (err) {
    console.error("submitAnswer error:", err);
    res.status(500).json({ message: "Failed to save answer" });
  }
};

// POST /api/learning/assessment/:id/complete
exports.completeAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid assessment id" });
    const a = await InitialAssessment.findOne({ _id: id, user: userId }).populate("learningPath", "title slug");
    if (!a) return res.status(404).json({ message: "Assessment not found" });
    if (a.status !== "active") return res.status(400).json({ message: "Assessment not active" });
    if (a.answers.length === 0) return res.status(400).json({ message: "No answers submitted" });

    const roadmap = await buildLearningRoadmap(a.learningPath._id || a.learningPath);
    const result = await evaluateAssessment(roadmap, a.questions, a.answers);

    a.overallLevel = result.overallLevel;
    a.technologyLevels = result.technologyLevels;
    a.strengths = result.strengths;
    a.weaknesses = result.weaknesses.map((w) => ({
      topicId: w.topicId || null,
      topicName: w.topic || w.topicName,
      reason: w.reason || "",
    }));
    // Map recommended title to actual topicId if needed
    let recTopicId = result.recommendedStartingTopic;
    if (!recTopicId && result.recommendedStartingTopicTitle) {
      const match = roadmap.flatTopics.find((t) => t.title.toLowerCase() === result.recommendedStartingTopicTitle.toLowerCase());
      if (match) recTopicId = match.id;
    }
    // Validate recommended topic belongs to roadmap
    if (recTopicId) {
      const belongs = roadmap.flatTopics.find((t) => t.id.toString() === recTopicId.toString());
      if (!belongs) recTopicId = roadmap.flatTopics[0]?.id || null;
    } else {
      recTopicId = roadmap.flatTopics[0]?.id || null;
    }
    a.recommendedStartingTopic = recTopicId;
    const recStage = recTopicId ? roadmap.stages.find((s) => s.topics.some((t) => t.id.toString() === recTopicId.toString())) : null;
    a.recommendedStage = recStage ? recStage.id : null;
    a.status = "completed";
    a.completedAt = new Date();
    await a.save();

    // Update LearningMemory — per-path and single fields for backward compat
    const mem = await LearningMemory.findOrCreate(userId);
    // per-path array
    const existingIdx = (mem.learningAssessments || []).findIndex((ea) => ea.learningPath?.toString() === a.learningPath.toString());
    const entry = {
      learningPath: a.learningPath,
      completed: true,
      overallLevel: result.overallLevel,
      technologyLevels: result.technologyLevels,
      strengths: result.strengths,
      weaknesses: result.weaknesses.map((w) => ({ topicId: w.topicId || null, topicName: w.topic || w.topicName, reason: w.reason })),
      recommendedStartingTopic: recTopicId,
      recommendedStage: recStage ? recStage.id : null,
      assessedAt: new Date(),
    };
    if (existingIdx >= 0) mem.learningAssessments[existingIdx] = entry;
    else mem.learningAssessments.push(entry);

    // also update single assessment fields + current position
    mem.assessmentCompleted = true;
    mem.assessmentLevel = result.overallLevel;
    mem.assessmentResults = {
      technology: result.technologyLevels[0]?.technology || a.learningPath.title || "general",
      estimatedLevel: result.overallLevel,
      confidence: "medium",
      notes: result.notes || `Assessment for ${a.learningPath.title || "path"}: ${result.strengths.join(", ")}; weak: ${result.weaknesses.map((w)=>w.topic).join(", ")}`,
    };
    mem.currentLevel = result.overallLevel;
    // set current stage/topic to recommended, but do NOT mark as completed
    if (recTopicId) mem.currentTopic = recTopicId;
    if (recStage) mem.currentStage = recStage.id;
    // active path/goal
    mem.activeLearningPath = a.learningPath;
    mem.activeLearningGoal = { type: "learning_path", learningPath: a.learningPath, name: a.learningPath.title || "Path" };
    // weak topics detailed — merge
    for (const w of result.weaknesses) {
      if (!w.topic) continue;
      const exists = (mem.weakTopicsDetailed || []).find((wt) => (wt.topicName || wt.topic) === w.topic);
      if (!exists) {
        mem.weakTopicsDetailed.push({ topicName: w.topic, topic: w.topic, reason: w.reason || "Assessment indicated difficulty", strength: "weak", lastReviewedAt: null });
      }
      if (!mem.weakTopics.includes(w.topic)) mem.weakTopics = [...mem.weakTopics, w.topic].slice(-20);
    }
    // learning session — start at recommended
    mem.learningSession = {
      status: "active",
      startedAt: new Date(),
      lastActivity: new Date(),
      learningPath: a.learningPath,
      stage: recStage ? recStage.id : null,
      topic: recTopicId,
    };
    mem.lastActivity = new Date();
    mem.lastOpenedAt = new Date();
    await mem.save();

    res.json({
      assessment: sanitizeForStudent(a),
      result: {
        overallLevel: result.overallLevel,
        technologyLevels: result.technologyLevels,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        recommendedStartingTopic: recTopicId,
        recommendedStartingTopicTitle: result.recommendedStartingTopicTitle,
        notes: result.notes,
      },
    });
  } catch (err) {
    console.error("completeAssessment error:", err);
    res.status(500).json({ message: "Failed to complete assessment" });
  }
};

function sanitizeForStudent(a) {
  const obj = a.toObject ? a.toObject() : a;
  // Hide correct answers until completed, but keep expectedAnswer hidden for active
  const isCompleted = obj.status === "completed";
  const questions = (obj.questions || []).map((q) => {
    const { expectedAnswer, ...rest } = q;
    // For active, don't expose expectedAnswer; for completed, expose for review
    return isCompleted ? q : rest;
  });
  return { ...obj, questions };
}
