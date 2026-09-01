const adaptiveService = require("../services/adaptiveAssessmentService");
const Assessment = require("../models/Assessment");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const UserSkill = require("../models/UserSkill");

exports.listAssessments = async (req, res) => {
  try {
    const { type, skill } = req.query;
    const query = { status: "published" };
    if (type) query.type = type;
    if (skill) query.skill = skill;

    const assessments = await Assessment.find(query).sort({ createdAt: -1 });
    res.json(assessments);
  } catch (err) {
    console.error("listAssessments error:", err);
    res.status(500).json({ message: "Failed to load assessments" });
  }
};

exports.getAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Assessment not found" });
    res.json(assessment);
  } catch (err) {
    console.error("getAssessment error:", err);
    res.status(500).json({ message: "Failed to load assessment" });
  }
};

exports.startAttempt = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const attempt = await adaptiveService.createAttempt(req.user.id, assessmentId);
    const next = await adaptiveService.getNextQuestion(attempt._id);
    res.json({ attempt, next });
  } catch (err) {
    console.error("startAttempt error:", err);
    res.status(500).json({ message: err.message || "Failed to start assessment" });
  }
};

exports.getAttempt = async (req, res) => {
  try {
    const attempt = await AssessmentAttempt.findOne({
      _id: req.params.attemptId,
      user: req.user.id,
    });
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    const assessment = await Assessment.findById(attempt.assessment);
    const next = attempt.status === "in_progress"
      ? await adaptiveService.getNextQuestion(attempt._id)
      : null;

    res.json({ attempt, assessment, next });
  } catch (err) {
    console.error("getAttempt error:", err);
    res.status(500).json({ message: "Failed to load attempt" });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, answer, timeSpentSeconds, hintsUsed } = req.body;

    const result = await adaptiveService.submitAnswer(
      attemptId, questionId, answer, timeSpentSeconds || 0, hintsUsed || 0
    );

    const attempt = await AssessmentAttempt.findById(attemptId);
    const assessment = await Assessment.findById(attempt.assessment);
    const isComplete = attempt.answers.length >= attempt.totalQuestions ||
      (assessment?.timeLimitMinutes &&
        (Date.now() - attempt.startedAt.getTime()) / 60000 >= assessment.timeLimitMinutes);

    let next = null;
    if (!isComplete && attempt.status === "in_progress") {
      next = await adaptiveService.getNextQuestion(attemptId);
    }

    res.json({ ...result, next, isComplete });
  } catch (err) {
    console.error("submitAnswer error:", err);
    res.status(500).json({ message: err.message || "Failed to submit answer" });
  }
};

exports.completeAttempt = async (req, res) => {
  try {
    const result = await adaptiveService.completeAttempt(req.params.attemptId);
    res.json(result);
  } catch (err) {
    console.error("completeAttempt error:", err);
    res.status(500).json({ message: "Failed to complete attempt" });
  }
};

exports.getResult = async (req, res) => {
  try {
    const result = await adaptiveService.getAttemptResult(req.params.attemptId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error("getResult error:", err);
    res.status(500).json({ message: "Failed to load result" });
  }
};

exports.getPlacement = async (req, res) => {
  try {
    const { skill } = req.params;
    const assessment = await adaptiveService.getPlacement(req.user.id, skill);
    if (!assessment) return res.status(404).json({ message: "No placement assessment found" });
    res.json(assessment);
  } catch (err) {
    console.error("getPlacement error:", err);
    res.status(500).json({ message: "Failed to load placement" });
  }
};

exports.startReview = async (req, res) => {
  try {
    const { skills } = req.body;
    if (!skills || !Array.isArray(skills)) {
      return res.status(400).json({ message: "skills array required" });
    }
    const assessment = await adaptiveService.startReview(req.user.id, skills);
    if (!assessment) {
      return res.json({ message: "No weak skills found to review", assessment: null });
    }
    res.json(assessment);
  } catch (err) {
    console.error("startReview error:", err);
    res.status(500).json({ message: "Failed to start review" });
  }
};

exports.getMyAttempts = async (req, res) => {
  try {
    const attempts = await AssessmentAttempt.findByUser(req.user.id);
    res.json(attempts);
  } catch (err) {
    console.error("getMyAttempts error:", err);
    res.status(500).json({ message: "Failed to load attempts" });
  }
};

exports.getWeakSkills = async (req, res) => {
  try {
    const skills = await UserSkill.findByUser(req.user.id);
    const weak = skills.filter((s) => s.confidence < 0.5 && s.attempts >= 2);
    const strong = skills.filter((s) => s.confidence >= 0.7);
    res.json({ weak, strong });
  } catch (err) {
    console.error("getWeakSkills error:", err);
    res.status(500).json({ message: "Failed to load skills" });
  }
};
