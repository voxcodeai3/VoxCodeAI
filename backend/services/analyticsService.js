const LearningAnalytics = require("../models/LearningAnalytics");
const LearningSession = require("../models/LearningSession");
const InterviewSession = require("../models/InterviewSession");

// ── Helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a, b) {
  const msPerDay = 86400000;
  return Math.round((new Date(a).setHours(0, 0, 0, 0) - new Date(b).setHours(0, 0, 0, 0)) / msPerDay);
}

const DIFFICULTY_WEIGHT = { easy: 0.6, medium: 1.0, hard: 1.4 };

const MASTERY_LEVELS = [
  { label: "Not Started", min: 0 },
  { label: "Beginner", min: 0.2 },
  { label: "Developing", min: 0.45 },
  { label: "Proficient", min: 0.65 },
  { label: "Strong", min: 0.8 },
];

// ── Streak Calculation ─────────────────────────────────────────────────────

function calculateStreaks(activeDates) {
  if (!activeDates || activeDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Deduplicate and sort ascending.
  const unique = [...new Set(activeDates.map(dateStr))].sort();
  const today = todayStr();
  const yesterday = dateStr(new Date(Date.now() - 86400000));

  let longest = 1;
  let current = 1;

  // Calculate longest streak.
  for (let i = 1; i < unique.length; i++) {
    if (daysBetween(unique[i], unique[i - 1]) === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  // Recalculate current streak from the end.
  current = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    if (daysBetween(unique[i], unique[i - 1]) === 1) {
      current++;
    } else {
      break;
    }
  }

  // If the last active day isn't today or yesterday, streak is broken.
  const lastActive = unique[unique.length - 1];
  if (lastActive !== today && lastActive !== yesterday) {
    current = 0;
  }

  return { currentStreak: current, longestStreak: Math.max(longest, current) };
}

// ── Topic Mastery ──────────────────────────────────────────────────────────

function calculateConfidence(stat) {
  if (!stat || stat.attempts === 0) return 0;
  const accuracy = stat.correct / stat.attempts;
  const hintsPenalty = Math.min(stat.hintsUsed / stat.attempts, 0.3);
  const recencyBonus = stat.lastPracticed
    ? Math.max(0, 1 - daysBetween(new Date(), stat.lastPracticed) / 30) * 0.1
    : 0;
  return Math.min(1, Math.max(0, accuracy - hintsPenalty + recencyBonus));
}

function getMasteryLevel(confidence) {
  for (let i = MASTERY_LEVELS.length - 1; i >= 0; i--) {
    if (confidence >= MASTERY_LEVELS[i].min) return MASTERY_LEVELS[i].label;
  }
  return "Not Started";
}

// ── Record Activity ────────────────────────────────────────────────────────

async function recordActivity(userId, activity) {
  const analytics = await LearningAnalytics.findOrCreate(userId);

  // Update totals.
  analytics.totalSessions += 1;
  if (activity.questionsCount) analytics.totalQuestions += activity.questionsCount;
  if (activity.correctCount) analytics.totalCorrect += activity.correctCount;
  if (activity.incorrectCount) analytics.totalIncorrect += activity.incorrectCount;
  if (activity.hintsUsed) analytics.totalHints += activity.hintsUsed;
  if (activity.practiceMinutes) analytics.totalPracticeMinutes += activity.practiceMinutes;

  // Update type counts.
  if (activity.type === "quiz") analytics.quizCount += 1;
  else if (activity.type === "practice") analytics.practiceCount += 1;
  else if (activity.type === "interview") analytics.interviewCount += 1;
  else if (activity.type === "challenge") analytics.codingChallengeCount += 1;

  // Update streak.
  const now = new Date();
  analytics.lastActiveAt = now;
  const activeDates = analytics.recentActivity.map((a) => a.at);
  activeDates.push(now);
  const streaks = calculateStreaks(activeDates);
  analytics.currentStreak = streaks.currentStreak;
  analytics.longestStreak = Math.max(analytics.longestStreak, streaks.longestStreak);

  // Update topic stats.
  if (activity.topic) {
    const existing = analytics.topicStats.find((t) => t.topic === activity.topic);
    if (existing) {
      existing.attempts += activity.questionsCount || 1;
      existing.correct += activity.correctCount || 0;
      existing.incorrect += activity.incorrectCount || 0;
      existing.hintsUsed += activity.hintsUsed || 0;
      existing.confidence = calculateConfidence(existing);
      existing.lastPracticed = now;
    } else {
      analytics.topicStats.push({
        topic: activity.topic,
        attempts: activity.questionsCount || 1,
        correct: activity.correctCount || 0,
        incorrect: activity.incorrectCount || 0,
        hintsUsed: activity.hintsUsed || 0,
        confidence: calculateConfidence({
          attempts: activity.questionsCount || 1,
          correct: activity.correctCount || 0,
          hintsUsed: activity.hintsUsed || 0,
          lastPracticed: now,
        }),
        lastPracticed: now,
      });
    }
  }

  // Add to recent activity (keep last 50).
  analytics.recentActivity.unshift({
    type: activity.eventType || "topic_practiced",
    topic: activity.topic,
    score: activity.score,
    difficulty: activity.difficulty,
    language: activity.language,
    detail: activity.detail,
    at: now,
  });
  if (analytics.recentActivity.length > 50) {
    analytics.recentActivity = analytics.recentActivity.slice(0, 50);
  }

  // Update daily performance.
  const today = todayStr();
  let daily = analytics.dailyPerformance.find((d) => d.date === today);
  if (!daily) {
    daily = { date: today, sessions: 0, questions: 0, correct: 0, accuracy: 0, practiceMinutes: 0 };
    analytics.dailyPerformance.push(daily);
  }
  daily.sessions += 1;
  daily.questions += activity.questionsCount || 0;
  daily.correct += activity.correctCount || 0;
  daily.accuracy = daily.questions > 0 ? daily.correct / daily.questions : 0;
  daily.practiceMinutes += activity.practiceMinutes || 0;

  // Keep last 30 days.
  if (analytics.dailyPerformance.length > 30) {
    analytics.dailyPerformance = analytics.dailyPerformance.slice(-30);
  }

  await analytics.save();
  return analytics;
}

// ── Record Session Completion ──────────────────────────────────────────────

async function recordSessionComplete(userId, session) {
  const questionsCount = session.answers?.length || 0;
  const correctCount = session.answers?.filter((a) => a.result === "correct").length || 0;
  const incorrectCount = questionsCount - correctCount;
  const hintsUsed = session.hintsUsedTotal || 0;

  let practiceMinutes = 0;
  if (session.startedAt && session.completedAt) {
    practiceMinutes = Math.round((new Date(session.completedAt) - new Date(session.startedAt)) / 60000);
  }

  const topic = session.topic || session.focusArea || "General";
  const eventType =
    session.type === "quiz"
      ? "quiz_completed"
      : session.type === "challenge"
        ? "challenge_completed"
        : "practice_completed";

  return recordActivity(userId, {
    type: session.type,
    eventType,
    topic,
    questionsCount,
    correctCount,
    incorrectCount,
    hintsUsed,
    practiceMinutes,
    score: questionsCount > 0 ? correctCount / questionsCount : 0,
    difficulty: session.difficulty,
    language: session.language,
    detail: `${session.type} on ${topic}`,
  });
}

async function recordInterviewComplete(userId, interview) {
  let practiceMinutes = 0;
  if (interview.startedAt && interview.completedAt) {
    practiceMinutes = Math.round((new Date(interview.completedAt) - new Date(interview.startedAt)) / 60000);
  }

  const questionsCount = interview.evaluations?.length || 0;
  const correctCount =
    interview.evaluations?.filter((e) => ["strong", "mostly_correct"].includes(e.result)).length || 0;

  return recordActivity(userId, {
    type: "interview",
    eventType: "interview_completed",
    topic: interview.focusArea || interview.type || "General",
    questionsCount,
    correctCount,
    incorrectCount: questionsCount - correctCount,
    practiceMinutes,
    score: interview.maxScore > 0 ? interview.score / interview.maxScore : 0,
    difficulty: interview.difficulty,
    language: interview.language,
    detail: `${interview.type} interview`,
  });
}

// ── Recommendations ────────────────────────────────────────────────────────

function generateRecommendations(analytics) {
  const recs = [];

  // Weak topics (confidence < 0.45 and enough attempts).
  const weakTopics = analytics.topicStats
    .filter((t) => t.attempts >= 3 && t.confidence < 0.45)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 3);

  for (const t of weakTopics) {
    recs.push({
      topic: t.topic,
      action: "practice",
      reason: `Confidence is ${getMasteryLevel(t.confidence)} (${Math.round(t.confidence * 100)}%)`,
      priority: 3,
    });
  }

  // Topics needing quiz (good confidence but not quiz-tested).
  const quizCandidates = analytics.topicStats
    .filter((t) => t.confidence >= 0.5 && t.attempts >= 2)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);

  for (const t of quizCandidates) {
    recs.push({
      topic: t.topic,
      action: "quiz",
      reason: `Reinforce your ${getMasteryLevel(t.confidence)} knowledge`,
      priority: 2,
    });
  }

  // Strong topics for challenge.
  const strongTopics = analytics.topicStats
    .filter((t) => t.confidence >= 0.7)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 1);

  for (const t of strongTopics) {
    recs.push({
      topic: t.topic,
      action: "challenge",
      reason: `You're ${getMasteryLevel(t.confidence)} — try a harder challenge`,
      priority: 1,
    });
  }

  // If no topics yet, suggest starting.
  if (recs.length === 0) {
    recs.push({
      topic: "JavaScript",
      action: "practice",
      reason: "Start building your learning profile",
      priority: 3,
    });
  }

  return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

// ── Get Dashboard Data ─────────────────────────────────────────────────────

async function getDashboardData(userId) {
  const analytics = await LearningAnalytics.findOrCreate(userId);

  // Refresh recommendations if stale (older than 1 hour).
  if (
    !analytics.recommendationsUpdatedAt ||
    Date.now() - new Date(analytics.recommendationsUpdatedAt).getTime() > 3600000
  ) {
    analytics.recommendations = generateRecommendations(analytics);
    analytics.recommendationsUpdatedAt = new Date();
    await analytics.save();
  }

  // Compute strengths and weak areas.
  const strengths = analytics.topicStats
    .filter((t) => t.attempts >= 3 && t.confidence >= 0.65)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((t) => ({
      topic: t.topic,
      confidence: t.confidence,
      level: getMasteryLevel(t.confidence),
    }));

  const weakAreas = analytics.topicStats
    .filter((t) => t.attempts >= 2 && t.confidence < 0.5)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 5)
    .map((t) => ({
      topic: t.topic,
      confidence: t.confidence,
      level: getMasteryLevel(t.confidence),
    }));

  // Overall accuracy.
  const accuracy =
    analytics.totalQuestions > 0 ? analytics.totalCorrect / analytics.totalQuestions : 0;

  // Weekly stats.
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const weeklyActivity = analytics.recentActivity.filter(
    (a) => new Date(a.at) >= weekAgo
  );

  // Active session.
  const activeSession = await LearningSession.findActiveForUser(userId);

  // Interview stats from model.
  const interviews = await InterviewSession.findByUser(userId);
  const completedInterviews = interviews.filter((i) => i.status === "completed");
  const avgInterviewScore =
    completedInterviews.length > 0
      ? completedInterviews.reduce((sum, i) => sum + (i.maxScore > 0 ? i.score / i.maxScore : 0), 0) /
        completedInterviews.length
      : 0;
  const bestInterviewScore =
    completedInterviews.length > 0
      ? Math.max(...completedInterviews.map((i) => (i.maxScore > 0 ? i.score / i.maxScore : 0)))
      : 0;
  const recentInterviewScore =
    completedInterviews.length > 0
      ? completedInterviews[0].maxScore > 0
        ? completedInterviews[0].score / completedInterviews[0].maxScore
        : 0
      : 0;

  return {
    overview: {
      practiceSessions: analytics.practiceCount,
      quizCount: analytics.quizCount,
      interviewCount: analytics.interviewCount,
      codingChallengeCount: analytics.codingChallengeCount,
      questions: analytics.totalQuestions,
      correct: analytics.totalCorrect,
      accuracy,
      currentStreak: analytics.currentStreak,
      longestStreak: analytics.longestStreak,
      totalPracticeMinutes: analytics.totalPracticeMinutes,
      totalSessions: analytics.totalSessions,
    },
    topics: analytics.topicStats.map((t) => ({
      topic: t.topic,
      attempts: t.attempts,
      correct: t.correct,
      incorrect: t.incorrect,
      confidence: t.confidence,
      level: getMasteryLevel(t.confidence),
      lastPracticed: t.lastPracticed,
    })),
    strengths,
    weakAreas,
    recentActivity: analytics.recentActivity.slice(0, 20),
    dailyPerformance: analytics.dailyPerformance.slice(-14),
    recommendations: analytics.recommendations,
    interviews: {
      completed: completedInterviews.length,
      averageScore: avgInterviewScore,
      bestScore: bestInterviewScore,
      recentScore: recentInterviewScore,
    },
    activeSession: activeSession
      ? {
          id: activeSession._id,
          type: activeSession.type,
          topic: activeSession.topic,
          currentQuestion: activeSession.currentQuestion,
          totalQuestions: activeSession.questions?.length || 0,
        }
      : null,
    weeklyActivity: {
      sessions: weeklyActivity.length,
      questions: weeklyActivity.reduce((s, a) => s + (a.type.includes("completed") ? 1 : 0), 0),
    },
  };
}

// ── Rebuild Analytics from Existing Data ───────────────────────────────────

async function rebuildAnalytics(userId) {
  const analytics = await LearningAnalytics.findOrCreate(userId);

  // Reset.
  analytics.totalSessions = 0;
  analytics.totalQuestions = 0;
  analytics.totalCorrect = 0;
  analytics.totalIncorrect = 0;
  analytics.totalHints = 0;
  analytics.totalPracticeMinutes = 0;
  analytics.quizCount = 0;
  analytics.practiceCount = 0;
  analytics.interviewCount = 0;
  analytics.codingChallengeCount = 0;
  analytics.topicStats = [];
  analytics.recentActivity = [];
  analytics.dailyPerformance = [];

  // Replay all learning sessions.
  const sessions = await LearningSession.findByUser(userId);
  for (const s of sessions) {
    if (s.status === "completed") {
      await recordSessionComplete(userId, s);
    }
  }

  // Replay all interviews.
  const interviews = await InterviewSession.findByUser(userId);
  for (const i of interviews) {
    if (i.status === "completed") {
      await recordInterviewComplete(userId, i);
    }
  }

  return analytics;
}

module.exports = {
  recordActivity,
  recordSessionComplete,
  recordInterviewComplete,
  getDashboardData,
  rebuildAnalytics,
  calculateStreaks,
  getMasteryLevel,
  calculateConfidence,
};
