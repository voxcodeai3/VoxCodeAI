const mongoose = require("mongoose");

const topicStatSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    lastPracticed: { type: Date },
  },
  { _id: false }
);

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "practice_completed",
        "quiz_completed",
        "challenge_completed",
        "interview_completed",
        "topic_practiced",
        "goal_updated",
      ],
      required: true,
    },
    topic: { type: String },
    score: { type: Number },
    difficulty: { type: String },
    language: { type: String },
    detail: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const dailyPerformanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    sessions: { type: Number, default: 0 },
    questions: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    practiceMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const learningAnalyticsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Overall stats
    totalSessions: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    totalIncorrect: { type: Number, default: 0 },
    totalHints: { type: Number, default: 0 },
    totalPracticeMinutes: { type: Number, default: 0 },

    // Breakdown by type
    quizCount: { type: Number, default: 0 },
    practiceCount: { type: Number, default: 0 },
    interviewCount: { type: Number, default: 0 },
    codingChallengeCount: { type: Number, default: 0 },

    // Streak
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActiveAt: { type: Date },

    // Topic performance
    topicStats: [topicStatSchema],

    // Recent activity (last 50 events)
    recentActivity: [activitySchema],

    // Daily performance for charts (last 30 days)
    dailyPerformance: [dailyPerformanceSchema],

    // Recommendations (cached, refreshed periodically)
    recommendations: [
      {
        topic: String,
        action: String, // practice, quiz, challenge
        reason: String,
        priority: { type: Number, default: 0 },
      },
    ],
    recommendationsUpdatedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

learningAnalyticsSchema.statics.findByUser = function (userId) {
  return this.findOne({ user: userId });
};

learningAnalyticsSchema.statics.findOrCreate = async function (userId) {
  let analytics = await this.findOne({ user: userId });
  if (!analytics) {
    analytics = await this.create({ user: userId });
  }
  return learningAnalyticsSchema.statics.findByUser(userId);
};

module.exports = mongoose.model("LearningAnalytics", learningAnalyticsSchema);
