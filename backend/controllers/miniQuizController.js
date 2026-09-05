const mongoose = require("mongoose");
const MiniQuiz = require("../models/MiniQuiz");
const LearningMemory = require("../models/LearningMemory");
const TeachingSession = require("../models/TeachingSession");
const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");
const { buildLearningRoadmap } = require("../services/roadmapService");
const { generateMiniQuizQuestions, evaluateAnswer, QUIZ_PASS_THRESHOLD, QUIZ_REVIEW_THRESHOLD } = require("../services/miniQuizService");
const { generateResponse } = require("../services/aiService");

function isValidId(id) {
  return id && mongoose.Types.ObjectId.isValid(id);
}

function sanitizeQuiz(quiz, includeAnswers = false) {
  const obj = quiz.toObject ? quiz.toObject() : quiz;
  const questions = (obj.questions || []).map((q) => {
    if (includeAnswers) return q;
    const { expectedAnswer, ...rest } = q;
    return rest;
  });
  return { ...obj, questions };
}

// POST /api/learning/quiz/start
exports.startQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topicId, learningPathId, teachingSessionId, stageId } = req.body || {};
    let topic = null;
    let stage = null;
    let pathId = learningPathId || null;
    let session = null;

    if (teachingSessionId) {
      if (!isValidId(teachingSessionId)) return res.status(400).json({ message: "Invalid teachingSessionId" });
      session = await TeachingSession.findOne({ _id: teachingSessionId, user: userId });
      if (!session) return res.status(404).json({ message: "Teaching session not found" });
      pathId = session.learningPath;
      topic = await Topic.findById(session.topic).lean();
      stage = await Stage.findById(session.stage).lean();
    } else {
      if (!topicId || !isValidId(topicId)) return res.status(400).json({ message: "topicId required" });
      topic = await Topic.findById(topicId).lean();
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      stage = await Stage.findById(topic.stage).lean();
      pathId = learningPathId || stage?.learningPath;
      if (!pathId || !isValidId(pathId)) return res.status(400).json({ message: "learningPathId required" });
      // validate topic belongs to path
      if (stage.learningPath.toString() !== pathId.toString()) {
        return res.status(400).json({ message: "Topic does not belong to path" });
      }
    }

    const mem = await LearningMemory.findOne({ user: userId }).lean();
    const level = mem?.currentLevel || mem?.assessmentLevel || "beginner";
    const weakTopics = (mem?.weakTopicsDetailed?.map((w) => w.topicName || w.topic) || mem?.weakTopics || []).slice(0, 3);

    // Check for existing active quiz for same topic
    const existing = await MiniQuiz.findOne({ user: userId, topic: topic._id, status: "active" }).sort({ createdAt: -1 });
    if (existing) {
      return res.json({ quiz: sanitizeQuiz(existing, false), resumed: true });
    }

    const roadmap = await buildLearningRoadmap(pathId);
    const questions = await generateMiniQuizQuestions(roadmap, topic, level, weakTopics);

    const quiz = await MiniQuiz.create({
      user: userId,
      learningPath: pathId,
      stage: stage?._id,
      topic: topic._id,
      teachingSession: session?._id,
      status: "active",
      questions,
      answers: [],
      total: questions.length,
    });

    // Update teaching session state to mini_quiz if linked
    if (session) {
      session.teachingState = "mini_quiz";
      session.lastActivity = new Date();
      await session.save();
      const mem2 = await LearningMemory.findOne({ user: userId });
      if (mem2) {
        mem2.learningSession = {
          status: "active",
          teachingState: "mini_quiz",
          suggestedAction: "ask_knowledge_check",
          startedAt: session.startedAt,
          lastActivity: new Date(),
          learningPath: pathId,
          stage: stage?._id,
          topic: topic._id,
          interactionCount: session.interactionCount,
          checksPassed: session.checksPassed,
        };
        await mem2.save();
      }
    }

    res.status(201).json({ quiz: sanitizeQuiz(quiz, false) });
  } catch (err) {
    console.error("startQuiz error:", err);
    res.status(500).json({ message: "Failed to start quiz" });
  }
};

// GET /api/learning/quiz/:quizId
exports.getQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;
    if (!isValidId(quizId)) return res.status(400).json({ message: "Invalid quizId" });
    const quiz = await MiniQuiz.findOne({ _id: quizId, user: userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const includeAnswers = quiz.status === "completed";
    res.json({ quiz: sanitizeQuiz(quiz, includeAnswers) });
  } catch (err) {
    console.error("getQuiz error:", err);
    res.status(500).json({ message: "Failed to load quiz" });
  }
};

// POST /api/learning/quiz/:quizId/answer
exports.submitAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;
    const { questionId, answer, inputMode } = req.body || {};
    if (!isValidId(quizId)) return res.status(400).json({ message: "Invalid quizId" });
    if (!questionId || typeof answer !== "string") return res.status(400).json({ message: "questionId and answer required" });
    const quiz = await MiniQuiz.findOne({ _id: quizId, user: userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (quiz.status !== "active") return res.status(400).json({ message: "Quiz not active" });
    const q = quiz.questions.find((qq) => qq.id === questionId);
    if (!q) return res.status(400).json({ message: "Question not found" });
    // prevent duplicate
    if (quiz.answers.find((a) => a.questionId === questionId)) {
      return res.status(400).json({ message: "Already answered" });
    }

    const evaluation = await evaluateAnswer(q, answer);
    const isCorrect = evaluation.status === "correct";
    quiz.answers.push({
      questionId,
      answer: String(answer).slice(0, 1000),
      isCorrect,
      score: evaluation.score,
      feedback: evaluation.explanation || evaluation.explanation || "",
      answeredAt: new Date(),
    });
    await quiz.save();

    // return evaluation without exposing expectedAnswer for remaining questions
    res.json({
      evaluation: {
        status: evaluation.status,
        score: evaluation.score,
        explanation: evaluation.explanation,
        missingConcept: evaluation.missingConcept,
      },
      correct: isCorrect,
      progress: `${quiz.answers.length} / ${quiz.questions.length}`,
      quiz: sanitizeQuiz(quiz, false),
    });
  } catch (err) {
    console.error("submitAnswer error:", err);
    res.status(500).json({ message: "Failed to submit answer" });
  }
};

// POST /api/learning/quiz/:quizId/hint
exports.getHint = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;
    const { questionId } = req.body || {};
    if (!isValidId(quizId)) return res.status(400).json({ message: "Invalid quizId" });
    const quiz = await MiniQuiz.findOne({ _id: quizId, user: userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (quiz.status !== "active") return res.status(400).json({ message: "Quiz not active" });
    const q = quiz.questions.find((qq) => qq.id === (questionId || quiz.questions.find((qqq) => !quiz.answers.find((a) => a.questionId === qqq.id))?.id));
    if (!q) return res.status(404).json({ message: "Question not found" });

    // Generate hint via AI
    let hint = "Think about the core concept and try to recall the example we discussed.";
    try {
      const prompt = `Give a concise hint for this quiz question without revealing the answer. Question: ${q.question} ${q.code ? `Code: ${q.code}` : ""} Topic: ${q.topic}`;
      const raw = await generateResponse({
        history: [],
        message: prompt,
        language: "english",
        level: "beginner",
        teachingMode: "quiz",
        learnerContext: "",
        codingContext: "",
      });
      hint = (raw.reply || hint).slice(0, 300);
    } catch {}

    // Increment hintsUsed
    const ans = quiz.answers.find((a) => a.questionId === q.id);
    if (ans) ans.hintsUsed = (ans.hintsUsed || 0) + 1;
    else {
      // store hint usage even before answering? create placeholder
      // we just return hint without storing yet
    }
    await quiz.save().catch(() => {});
    res.json({ hint });
  } catch (err) {
    console.error("getHint error:", err);
    res.status(500).json({ message: "Failed to get hint" });
  }
};

// POST /api/learning/quiz/:quizId/complete
exports.completeQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quizId } = req.params;
    if (!isValidId(quizId)) return res.status(400).json({ message: "Invalid quizId" });
    const quiz = await MiniQuiz.findOne({ _id: quizId, user: userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (quiz.status !== "active") return res.status(400).json({ message: "Quiz not active" });

    const total = quiz.questions.length;
    const answered = quiz.answers.length;
    // Allow complete even if not all answered? For 3-5, require at least 1
    if (answered === 0) return res.status(400).json({ message: "No answers submitted" });

    const score = quiz.answers.reduce((s, a) => s + (a.score || 0), 0);
    const percentage = total ? Math.round((score / total) * 100) : 0;
    const passed = percentage >= QUIZ_PASS_THRESHOLD;
    const needsReview = percentage < QUIZ_REVIEW_THRESHOLD;
    const review = percentage >= QUIZ_REVIEW_THRESHOLD && percentage < QUIZ_PASS_THRESHOLD;

    quiz.score = score;
    quiz.total = total;
    quiz.percentage = percentage;
    quiz.passed = passed;
    quiz.status = "completed";
    quiz.completedAt = new Date();
    await quiz.save();

    // Update LearningMemory
    const mem = await LearningMemory.findOrCreate(userId);
    // quizResults path-specific
    mem.quizResults.push({
      quizId: quiz._id,
      topicId: quiz.topic,
      topic: quiz.topic ? (await Topic.findById(quiz.topic).lean())?.title || "Topic" : "Topic",
      score,
      total,
      passed,
      attempts: 1,
    });
    if (mem.quizResults.length > 50) mem.quizResults = mem.quizResults.slice(-50);

    // Weak topics tracking
    if (needsReview || review) {
      const topicDoc = await Topic.findById(quiz.topic).lean();
      const topicName = topicDoc?.title || "Topic";
      const reason = `Quiz ${percentage}% on ${topicName}`;
      const exists = (mem.weakTopicsDetailed || []).find((w) => w.topicId?.toString() === quiz.topic.toString());
      if (!exists) {
        mem.weakTopicsDetailed.push({ topicId: quiz.topic, topicName, topic: topicName, reason, strength: "weak", lastReviewedAt: null });
      } else {
        exists.reason = reason;
        exists.strength = "needs_review";
      }
      if (!mem.weakTopics.includes(topicName)) mem.weakTopics = [...mem.weakTopics, topicName].slice(-20);
      if (!mem.topicsNeedingReview.find((id) => id.toString() === quiz.topic.toString())) mem.topicsNeedingReview.push(quiz.topic);
      // teaching session -> quiz_review
      if (quiz.teachingSession) {
        const sess = await TeachingSession.findById(quiz.teachingSession);
        if (sess) {
          sess.teachingState = "quiz_review";
          sess.lastActivity = new Date();
          await sess.save();
        }
      }
      if (mem.learningSession) {
        mem.learningSession.teachingState = "quiz_review";
        mem.learningSession.suggestedAction = "review_topic";
      }
    } else if (passed) {
      // strong -> reduce review need, update weakTopics if previously weak and now passed
      const idx = (mem.weakTopicsDetailed || []).findIndex((w) => w.topicId?.toString() === quiz.topic.toString());
      if (idx >= 0) {
        // keep but mark as reviewed
        mem.weakTopicsDetailed[idx].lastReviewedAt = new Date();
        mem.weakTopicsDetailed[idx].strength = "weak"; // keep but could be updated
      }
      // remove from topicsNeedingReview if passed strongly
      mem.topicsNeedingReview = (mem.topicsNeedingReview || []).filter((id) => id.toString() !== quiz.topic.toString());
      // If teaching session, mark ready_for_practice
      if (quiz.teachingSession) {
        const sess = await TeachingSession.findById(quiz.teachingSession);
        if (sess) {
          sess.teachingState = "ready_for_practice";
          sess.checksPassed += 1;
          sess.lastActivity = new Date();
          await sess.save();
        }
      }
      if (mem.learningSession) {
        mem.learningSession.teachingState = "ready_for_practice";
        mem.learningSession.suggestedAction = "ready_for_practice";
        mem.learningSession.checksPassed = (mem.learningSession.checksPassed || 0) + 1;
      }
      // Consider topic completed if passed and not already
      if (!mem.completedTopics.find((id) => id.toString() === quiz.topic.toString()) && percentage >= 80) {
        // only add if strong, but keep conservative — add to completedTopics
        mem.completedTopics.push(quiz.topic);
      }
    }

    mem.lastActivity = new Date();
    await mem.save();

    // Also update teaching session if linked
    let nextTopicInfo = null;
    if (passed && quiz.learningPath && quiz.topic) {
      try {
        const { getNextTopic } = require("../services/roadmapService");
        const nxt = await getNextTopic(quiz.learningPath, quiz.topic);
        if (!nxt.path_completed) nextTopicInfo = nxt.next;
      } catch {}
    }

    res.json({
      quiz: sanitizeQuiz(quiz, true),
      result: {
        score,
        total,
        percentage,
        passed,
        needsReview,
        review,
        topicStatus: passed ? "understood" : needsReview ? "needs_review" : "in_progress",
        nextTopic: nextTopicInfo,
      },
    });
  } catch (err) {
    console.error("completeQuiz error:", err);
    res.status(500).json({ message: "Failed to complete quiz" });
  }
};
