const InterviewSession = require("../models/InterviewSession");
const LearnerProfile = require("../models/LearnerProfile");
const { buildLearnerContext } = require("../services/memoryService");
const interviewService = require("../services/interviewService");

const INTERVIEW_TYPES = [
  "frontend", "backend", "fullstack", "javascript", "react",
  "node", "python", "database", "algorithms", "data_structures",
  "system_design", "general_software",
];

const DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced", "expert"];

/* ── POST /api/interviews — Create interview session ────────────────────── */

async function createInterview(req, res) {
  try {
    const userId = req.user.id;
    const { type, difficulty, language, focusArea, durationMinutes } = req.body || {};

    if (!type || !INTERVIEW_TYPES.includes(type)) {
      return res.status(400).json({
        message: `Invalid interview type. Choose from: ${INTERVIEW_TYPES.join(", ")}`,
      });
    }

    // Check for existing active/paused interview.
    const active = await InterviewSession.findActiveForUser(userId);
    if (active) {
      return res.status(409).json({
        message: "You have an active interview session.",
        sessionId: active._id,
        session: formatSession(active),
      });
    }

    // Resolve difficulty from learner profile if not provided.
    let resolvedDifficulty = difficulty;
    if (!resolvedDifficulty || !DIFFICULTY_LEVELS.includes(resolvedDifficulty)) {
      const profile = await LearnerProfile.findByUser(userId);
      if (profile?.experienceLevel === "advanced") resolvedDifficulty = "advanced";
      else if (profile?.experienceLevel === "intermediate") resolvedDifficulty = "intermediate";
      else resolvedDifficulty = "beginner";
    }

    const session = await InterviewSession.create({
      user: userId,
      type,
      difficulty: resolvedDifficulty,
      language: language || "javascript",
      focusArea: focusArea || null,
      durationMinutes: Math.max(5, Math.min(60, durationMinutes || 20)),
      currentDifficulty: resolvedDifficulty === "beginner" ? "easy" : resolvedDifficulty === "advanced" || resolvedDifficulty === "expert" ? "hard" : "medium",
    });

    return res.status(201).json({ session: formatSession(session) });
  } catch (error) {
    console.error("createInterview error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── GET /api/interviews — List interviews ──────────────────────────────── */

async function listInterviews(req, res) {
  try {
    const sessions = await InterviewSession.findByUser(req.user.id);
    return res.json({ sessions: sessions.map(formatSession) });
  } catch (error) {
    console.error("listInterviews error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── GET /api/interviews/active — Get active interview ──────────────────── */

async function getActiveInterview(req, res) {
  try {
    const session = await InterviewSession.findActiveForUser(req.user.id);
    if (!session) return res.json({ session: null });
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("getActiveInterview error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── GET /api/interviews/:id — Get specific interview ───────────────────── */

async function getInterview(req, res) {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Interview not found." });
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("getInterview error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── PATCH /api/interviews/:id — Update interview ───────────────────────── */

async function updateInterview(req, res) {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Interview not found." });
    if (session.status === "completed" || session.status === "abandoned") {
      return res.status(400).json({ message: "Interview is no longer active." });
    }

    const body = req.body || {};

    if (body.currentDifficulty && ["easy", "medium", "hard"].includes(body.currentDifficulty)) {
      session.currentDifficulty = body.currentDifficulty;
    }

    if (body.currentQuestionIndex !== undefined) {
      session.currentQuestionIndex = body.currentQuestionIndex;
    }

    if (body.followUpCount !== undefined) {
      session.followUpCount = body.followUpCount;
    }

    await session.save();
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("updateInterview error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── POST /api/interviews/:id/question — Generate and add a question ──── */

async function generateInterviewQuestion(req, res) {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Interview not found." });
    if (session.status === "completed" || session.status === "abandoned") {
      return res.status(400).json({ message: "Interview is no longer active." });
    }

    // Build learner context.
    const profile = await LearnerProfile.findByUser(req.user.id);
    const learnerContext = profile ? buildLearnerContext(profile) : "";

    // Build interview history for AI context.
    const history = session.transcript.slice(-6).map((t) => ({
      role: t.role === "interviewer" ? "assistant" : "user",
      content: t.content,
    }));

    const question = await interviewService.generateQuestion({
      type: session.type,
      difficulty: session.currentDifficulty || session.difficulty,
      language: session.language,
      focusArea: session.focusArea,
      history,
      learnerContext,
    });

    // Add question to session.
    session.questions.push(question);
    session.currentQuestionIndex = session.questions.length - 1;
    session.followUpCount = 0;

    // Add interviewer message to transcript.
    session.transcript.push({
      role: "interviewer",
      content: question.question,
      inputMode: "text",
    });

    await session.save();
    return res.json({ session: formatSession(session), question });
  } catch (error) {
    console.error("generateInterviewQuestion error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── POST /api/interviews/:id/answer — Submit candidate answer ─────────── */

async function submitAnswer(req, res) {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Interview not found." });
    if (session.status === "completed" || session.status === "abandoned") {
      return res.status(400).json({ message: "Interview is no longer active." });
    }

    const { answer, inputMode = "text" } = req.body || {};
    if (!answer || typeof answer !== "string") {
      return res.status(400).json({ message: "Answer is required." });
    }

    // Add candidate answer to transcript.
    session.transcript.push({ role: "candidate", content: answer, inputMode });

    // Get current question.
    const currentQ = session.questions[session.currentQuestionIndex];
    if (!currentQ) {
      return res.status(400).json({ message: "No current question to answer." });
    }

    // Build history for AI.
    const history = session.transcript.slice(-8).map((t) => ({
      role: t.role === "interviewer" ? "assistant" : "user",
      content: t.content,
    }));

    // Build learner context.
    const profile = await LearnerProfile.findByUser(req.user.id);
    const learnerContext = profile ? buildLearnerContext(profile) : "";

    // Evaluate the answer.
    const evaluation = await interviewService.evaluateAnswer({
      question: currentQ.question,
      type: currentQ.type,
      expectedConcepts: currentQ.expectedConcepts,
      evaluationCriteria: currentQ.evaluationCriteria,
      candidateAnswer: answer,
      difficulty: currentQ.difficulty,
      history: history.slice(0, -1), // exclude the current answer from history
      learnerContext,
    });

    // Save evaluation.
    session.evaluations.push({
      questionId: currentQ._id,
      answer,
      score: evaluation.score,
      result: evaluation.result,
      feedback: evaluation.feedback,
      followUp: evaluation.followUp,
      complexityNote: evaluation.complexityNote,
    });

    session.score += evaluation.score;
    session.maxScore += 10;

    // Add interviewer feedback to transcript.
    // Skip if there's a follow-up — the follow-up IS the conversational response.
    if (evaluation.feedback && !evaluation.followUp) {
      session.transcript.push({
        role: "interviewer",
        content: evaluation.feedback,
        inputMode: "text",
      });
    }

    // Determine if we should follow up or move to next question.
    let nextAction = "next";
    let followUpQuestion = null;

    if (evaluation.followUp && session.followUpCount < session.maxFollowUps) {
      // Generate a follow-up.
      followUpQuestion = await interviewService.generateFollowUp({
        question: currentQ.question,
        candidateAnswer: answer,
        difficulty: currentQ.difficulty,
        history,
        learnerContext,
      });

      session.followUpCount += 1;
      nextAction = "follow_up";

      // Add follow-up to transcript.
      session.transcript.push({
        role: "interviewer",
        content: followUpQuestion.question,
        inputMode: "text",
      });
    } else {
      // Move to adaptive difficulty.
      if (evaluation.score >= 8) {
        // Strong performance — increase difficulty.
        if (session.currentDifficulty === "easy") session.currentDifficulty = "medium";
        else if (session.currentDifficulty === "medium") session.currentDifficulty = "hard";
      } else if (evaluation.score <= 3) {
        // Struggling — decrease difficulty.
        if (session.currentDifficulty === "hard") session.currentDifficulty = "medium";
        else if (session.currentDifficulty === "medium") session.currentDifficulty = "easy";
      }
    }

    await session.save();
    return res.json({
      session: formatSession(session),
      evaluation,
      nextAction,
      followUpQuestion,
    });
  } catch (error) {
    console.error("submitAnswer error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── POST /api/interviews/:id/complete — Complete or abandon ────────────── */

async function completeInterview(req, res) {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Interview not found." });
    if (session.status === "completed" || session.status === "abandoned") {
      return res.status(400).json({ message: "Interview is already completed or abandoned." });
    }

    const { action = "complete" } = req.body || {};

    if (action === "abandon") {
      session.status = "abandoned";
      session.completedAt = new Date();
      await session.save();
      return res.json({ session: formatSession(session) });
    }

    // Generate final evaluation.
    const profile = await LearnerProfile.findByUser(req.user.id);
    const learnerContext = profile ? buildLearnerContext(profile) : "";

    const history = session.transcript.slice(-8).map((t) => ({
      role: t.role === "interviewer" ? "assistant" : "user",
      content: t.content,
    }));

    const finalEval = await interviewService.generateFinalEvaluation({
      type: session.type,
      difficulty: session.difficulty,
      language: session.language,
      evaluations: session.evaluations,
      history,
      learnerContext,
    });

    session.technicalScore = finalEval.technicalScore;
    session.problemSolvingScore = finalEval.problemSolvingScore;
    session.communicationScore = finalEval.communicationScore;
    session.codeQualityScore = finalEval.codeQualityScore;
    session.score = finalEval.overallScore;
    session.maxScore = 100;
    session.feedback = {
      strengths: finalEval.strengths,
      areasToImprove: finalEval.areasToImprove,
      technicalGaps: finalEval.technicalGaps,
      communicationFeedback: finalEval.communicationFeedback,
      codingFeedback: finalEval.codingFeedback,
      recommendedTopics: finalEval.recommendedTopics,
    };
    session.status = "completed";
    session.completedAt = new Date();

    // Add final summary to transcript.
    session.transcript.push({
      role: "interviewer",
      content: `Interview complete. Overall score: ${finalEval.overallScore}/100. Thank you for your time.`,
      inputMode: "text",
    });

    await session.save();

    // Update learner memory with interview performance.
    if (profile) {
      const { updateTopicMastery } = require("../services/memoryService");
      for (const topic of session.feedback.recommendedTopics) {
        updateTopicMastery(profile, topic, false, 0.3);
      }
      for (const strength of session.feedback.strengths) {
        updateTopicMastery(profile, strength, true, 0.8);
      }
      await profile.save();
    }

    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("completeInterview error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── POST /api/interviews/:id/pause — Pause interview ──────────────────── */

async function pauseInterview(req, res) {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Interview not found." });
    if (session.status !== "active") {
      return res.status(400).json({ message: "Interview is not active." });
    }

    session.status = "paused";
    session.pausedAt = new Date();
    await session.save();
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("pauseInterview error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── POST /api/interviews/:id/resume — Resume interview ────────────────── */

async function resumeInterview(req, res) {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Interview not found." });
    if (session.status !== "paused") {
      return res.status(400).json({ message: "Interview is not paused." });
    }

    // Calculate paused duration.
    if (session.pausedAt) {
      session.totalPausedMs += Date.now() - session.pausedAt.getTime();
      session.pausedAt = null;
    }

    session.status = "active";
    await session.save();
    return res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("resumeInterview error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/* ── DELETE /api/interviews/:id — Delete an interview ────────────────────── */

async function deleteInterview(req, res) {
  try {
    const session = await InterviewSession.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ message: "Interview not found." });
    return res.json({ message: "Interview deleted." });
  } catch (error) {
    console.error("deleteInterview error:", error.message);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

function formatSession(s) {
  return {
    id: s._id,
    type: s.type,
    difficulty: s.difficulty,
    language: s.language,
    focusArea: s.focusArea,
    durationMinutes: s.durationMinutes,
    status: s.status,
    questions: s.questions,
    currentQuestionIndex: s.currentQuestionIndex,
    followUpCount: s.followUpCount,
    maxFollowUps: s.maxFollowUps,
    currentDifficulty: s.currentDifficulty,
    evaluations: s.evaluations,
    score: s.score,
    maxScore: s.maxScore,
    technicalScore: s.technicalScore,
    problemSolvingScore: s.problemSolvingScore,
    communicationScore: s.communicationScore,
    codeQualityScore: s.codeQualityScore,
    transcript: s.transcript,
    feedback: s.feedback,
    pausedAt: s.pausedAt,
    totalPausedMs: s.totalPausedMs,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    createdAt: s.createdAt,
  };
}

module.exports = {
  createInterview,
  listInterviews,
  getActiveInterview,
  getInterview,
  updateInterview,
  generateInterviewQuestion,
  submitAnswer,
  completeInterview,
  pauseInterview,
  resumeInterview,
  deleteInterview,
};
