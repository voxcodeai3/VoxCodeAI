const mongoose = require("mongoose");

const miniQuizQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["multiple_choice", "true_false", "short_answer", "predict_output", "code"],
      default: "multiple_choice",
    },
    question: { type: String, required: true },
    options: { type: [String], default: [] },
    code: { type: String, default: null },
    expectedAnswer: { type: String, default: null },
    topic: { type: String, default: null },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
    technology: { type: String, default: null },
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
  },
  { _id: false }
);

const miniQuizAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    answer: { type: String, default: "" },
    isCorrect: { type: Boolean, default: null },
    score: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
    hintsUsed: { type: Number, default: 0 },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const miniQuizSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    learningPath: { type: mongoose.Schema.Types.ObjectId, ref: "LearningPath", required: true, index: true },
    stage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage" },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", required: true, index: true },
    teachingSession: { type: mongoose.Schema.Types.ObjectId, ref: "TeachingSession" },
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active", index: true },
    questions: { type: [miniQuizQuestionSchema], default: [] },
    answers: { type: [miniQuizAnswerSchema], default: [] },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

miniQuizSchema.index({ user: 1, learningPath: 1, topic: 1, status: 1 });

module.exports = mongoose.model("MiniQuiz", miniQuizSchema);
