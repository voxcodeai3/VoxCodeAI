const mongoose = require("mongoose");

const attemptAnswerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentQuestion",
      required: true,
    },
    answer: { type: String, default: null },
    correct: { type: Boolean, default: false },
    score: { type: Number, default: 0, min: 0, max: 1 },
    feedback: { type: String, default: null },
    hintsUsed: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const skillResultSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true },
    questionsAnswered: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    score: { type: Number, default: 0, min: 0, max: 1 },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    status: {
      type: String,
      enum: ["not_started", "developing", "proficient", "strong"],
      default: "not_started",
    },
    difficultyBreakdown: {
      easy: { correct: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
      medium: { correct: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
      hard: { correct: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
    },
  },
  { _id: false }
);

const assessmentAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    answers: { type: [attemptAnswerSchema], default: [] },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    skillResults: { type: [skillResultSchema], default: [] },
    currentDifficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    currentSkill: { type: String, default: null },
    recentCorrect: { type: Number, default: 0 },
    recentTotal: { type: Number, default: 0 },
    recentWindow: { type: [Boolean], default: [] },
    seenQuestionIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    timeSpentSeconds: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["in_progress", "completed", "abandoned", "timed_out"],
      default: "in_progress",
    },
    mode: {
      type: String,
      enum: ["practice", "exam", "placement", "review"],
      default: "practice",
    },
  },
  { timestamps: true, versionKey: false }
);

assessmentAttemptSchema.statics.findActiveForUser = function (userId, assessmentId) {
  const query = { user: userId, status: "in_progress" };
  if (assessmentId) query.assessment = assessmentId;
  return this.findOne(query).sort({ updatedAt: -1 });
};

assessmentAttemptSchema.statics.findByUser = function (userId) {
  return this.find({ user: userId }).sort({ updatedAt: -1 });
};

module.exports = mongoose.model("AssessmentAttempt", assessmentAttemptSchema);
