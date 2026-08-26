const mongoose = require("mongoose");

const transcriptEntrySchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["interviewer", "candidate"], required: true },
    content: { type: String, required: true },
    inputMode: { type: String, enum: ["voice", "text"], default: "text" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const interviewQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    type: {
      type: String,
      enum: ["conceptual", "coding", "debugging", "system_design", "behavioral", "output_prediction"],
      default: "conceptual",
    },
    topic: { type: String, default: null },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    expectedConcepts: { type: [String], default: [] },
    evaluationCriteria: { type: String, default: null },
    followUps: { type: [String], default: [] },
    code: { type: String, default: null },
    hints: { type: [String], default: [] },
    solution: { type: String, default: null },
  },
  { _id: true }
);

const answerEvaluationSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    answer: { type: String, required: true },
    score: { type: Number, default: 0, min: 0, max: 10 },
    result: {
      type: String,
      enum: ["strong", "mostly_correct", "partially_correct", "weak", "incorrect", "no_answer"],
      default: "no_answer",
    },
    feedback: { type: String, default: null },
    followUp: { type: String, default: null },
    complexityNote: { type: String, default: null },
    evaluatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "frontend", "backend", "fullstack", "javascript", "react",
        "node", "python", "database", "algorithms", "data_structures",
        "system_design", "general_software",
      ],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "intermediate",
    },
    language: { type: String, default: "javascript" },
    focusArea: { type: String, default: null },
    durationMinutes: { type: Number, default: 20 },
    pausedAt: { type: Date, default: null },
    totalPausedMs: { type: Number, default: 0 },
    questions: { type: [interviewQuestionSchema], default: [] },
    evaluations: { type: [answerEvaluationSchema], default: [] },
    currentQuestionIndex: { type: Number, default: 0 },
    followUpCount: { type: Number, default: 0 },
    maxFollowUps: { type: Number, default: 2 },
    currentDifficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: null,
    },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    problemSolvingScore: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 0 },
    codeQualityScore: { type: Number, default: 0 },
    transcript: { type: [transcriptEntrySchema], default: [] },
    feedback: {
      strengths: { type: [String], default: [] },
      areasToImprove: { type: [String], default: [] },
      technicalGaps: { type: [String], default: [] },
      communicationFeedback: { type: String, default: null },
      codingFeedback: { type: String, default: null },
      recommendedTopics: { type: [String], default: [] },
    },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned", "paused"],
      default: "active",
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

interviewSessionSchema.statics.findActiveForUser = function (userId) {
  return this.findOne({ user: userId, status: { $in: ["active", "paused"] } }).sort({ updatedAt: -1 });
};

interviewSessionSchema.statics.findByUser = function (userId) {
  return this.find({ user: userId }).sort({ updatedAt: -1 });
};

module.exports = mongoose.model("InterviewSession", interviewSessionSchema);
