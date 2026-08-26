const LearningSession = require("../models/LearningSession");
const LearnerProfile = require("../models/LearnerProfile");

const MAX_QUESTIONS = 10;

/**
 * POST /api/learning/sessions
 * Create a new learning session.
 */
async function createSession(req, res) {
  try {
    const userId = req.user.id;
    const { type = "practice", topic, language = "javascript", difficulty } = req.body || {};

    if (!["practice", "quiz", "challenge", "interview"].includes(type)) {
      return res.status(400).json({ message: "Invalid session type." });
    }

    // Check for existing active session.
    const active = await LearningSession.findActiveForUser(userId);
    if (active) {
      return res.status(409).json({
        message: "You have an active learning session.",
        sessionId: active._id,
        session: formatSession(active),
      });
    }

    // Determine difficulty from learner profile if not provided.
    let resolvedDifficulty = difficulty;
    if (!resolvedDifficulty) {
      const profile = await LearnerProfile.findByUser(userId);
      if (profile?.experienceLevel === "advanced") resolvedDifficulty = "hard";
      else if (profile?.experienceLevel === "intermediate") resolvedDifficulty = "medium";
      else resolvedDifficulty = "easy";
    }

    const session = await LearningSession.create({
      user: userId,
      type,
      topic: topic || null,
      language,
      difficulty: resolvedDifficulty,
    });

    return res.status(201).json({ session: formatSession(session) });
  } catch (error) {
    console.error("createSession error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/**
 * GET /api/learning/sessions
 * List user's learning sessions.
 */
async function listSessions(req, res) {
  try {
    const sessions = await LearningSession.findByUser(req.user.id);
    return res.json({ sessions: sessions.map(formatSession) });
  } catch (error) {
    console.error("listSessions error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/**
 * GET /api/learning/sessions/active
 * Get the user's currently active session (if any).
 */
async function getActiveSession(req, res) {
  try {
    const session = await LearningSession.findActiveForUser(req.user.id);
    if (!session) return res.json({ session: null });
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("getActiveSession error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/**
 * GET /api/learning/sessions/:id
 * Get a specific learning session.
 */
async function getSession(req, res) {
  try {
    const session = await LearningSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Session not found." });
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("getSession error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/**
 * PATCH /api/learning/sessions/:id
 * Update session (add question, update difficulty, etc.).
 */
async function updateSession(req, res) {
  try {
    const session = await LearningSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Session not found." });
    if (session.status !== "active") {
      return res.status(400).json({ message: "Session is no longer active." });
    }

    const body = req.body || {};

    if (body.question && typeof body.question === "object") {
      if (session.questions.length >= MAX_QUESTIONS) {
        return res.status(400).json({ message: "Maximum questions reached." });
      }
      session.questions.push(body.question);
    }

    if (body.difficulty && ["easy", "medium", "hard"].includes(body.difficulty)) {
      session.difficulty = body.difficulty;
    }

    if (body.currentQuestion !== undefined) {
      session.currentQuestion = body.currentQuestion;
    }

    await session.save();
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("updateSession error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/**
 * POST /api/learning/sessions/:id/answer
 * Submit an answer to the current question.
 */
async function submitAnswer(req, res) {
  try {
    const session = await LearningSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Session not found." });
    if (session.status !== "active") {
      return res.status(400).json({ message: "Session is no longer active." });
    }

    const { answer, result = "incorrect", score = 0, feedback = null, hintsUsed = 0 } = req.body || {};
    if (!answer || typeof answer !== "string") {
      return res.status(400).json({ message: "Answer is required." });
    }

    const currentQ = session.questions[session.currentQuestion];
    if (!currentQ) {
      return res.status(400).json({ message: "No current question." });
    }

    session.answers.push({
      questionId: currentQ._id,
      answer,
      result,
      score: Math.max(0, Math.min(1, score)),
      feedback,
      hintsUsed,
    });

    session.score += score;
    session.totalPossible += 1;
    session.hintsUsedTotal += hintsUsed;

    // Move to next question or mark done.
    if (session.currentQuestion < session.questions.length - 1) {
      session.currentQuestion += 1;
    }

    await session.save();
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("submitAnswer error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/**
 * POST /api/learning/sessions/:id/hint
 * Request a hint for the current question.
 */
async function requestHint(req, res) {
  try {
    const session = await LearningSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Session not found." });
    if (session.status !== "active") {
      return res.status(400).json({ message: "Session is no longer active." });
    }

    const currentQ = session.questions[session.currentQuestion];
    if (!currentQ) {
      return res.status(400).json({ message: "No current question." });
    }

    const { hintIndex = 0 } = req.body || {};
    const hints = currentQ.hints || [];
    const hint = hints[Math.min(hintIndex, hints.length - 1)] || null;

    if (!hint) {
      return res.json({ hint: "No more hints available for this question.", hintIndex, totalHints: hints.length });
    }

    return res.json({ hint, hintIndex, totalHints: hints.length });
  } catch (error) {
    console.error("requestHint error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/**
 * POST /api/learning/sessions/:id/complete
 * Complete or abandon a learning session.
 */
async function completeSession(req, res) {
  try {
    const session = await LearningSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Session not found." });
    if (session.status !== "active") {
      return res.status(400).json({ message: "Session is already completed or abandoned." });
    }

    const { action = "complete" } = req.body || {};
    session.status = action === "abandon" ? "abandoned" : "completed";
    session.completedAt = new Date();
    await session.save();

    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("completeSession error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function formatSession(s) {
  return {
    id: s._id,
    type: s.type,
    topic: s.topic,
    language: s.language,
    difficulty: s.difficulty,
    questions: s.questions,
    currentQuestion: s.currentQuestion,
    answers: s.answers,
    score: s.score,
    totalPossible: s.totalPossible,
    hintsUsedTotal: s.hintsUsedTotal,
    status: s.status,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    createdAt: s.createdAt,
  };
}

module.exports = {
  createSession,
  listSessions,
  getActiveSession,
  getSession,
  updateSession,
  submitAnswer,
  requestHint,
  completeSession,
};
