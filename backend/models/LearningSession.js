const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    topic: { type: String, default: null },
    language: { type: String, default: null },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    type: {
      type: String,
      enum: ["multiple_choice", "coding", "debugging", "output_prediction", "conceptual", "true_false"],
      default: "conceptual",
    },
    options: { type: [String], default: [] },
    expectedAnswer: { type: String, default: null },
    expectedConcepts: { type: [String], default: [] },
    hints: { type: [String], default: [] },
    solution: { type: String, default: null },
    explanation: { type: String, default: null },
    code: { type: String, default: null },
  },
  { _id: true }
);

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    answer: { type: String, required: true },
    result: {
      type: String,
      enum: ["correct", "partially_correct", "incorrect"],
      required: true,
    },
    score: { type: Number, default: 0, min: 0, max: 1 },
    feedback: { type: String, default: null },
    hintsUsed: { type: Number, default: 0 },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const learningSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["practice", "quiz", "challenge", "interview"],
      required: true,
    },
    topic: { type: String, default: null },
    language: { type: String, default: "javascript" },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    questions: { type: [questionSchema], default: [] },
    currentQuestion: { type: Number, default: 0 },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, default: 0 },
    totalPossible: { type: Number, default: 0 },
    hintsUsedTotal: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

learningSessionSchema.statics.findActiveForUser = function (userId) {
  return this.findOne({ user: userId, status: "active" }).sort({ updatedAt: -1 });
};

learningSessionSchema.statics.findByUser = function (userId) {
  return this.find({ user: userId }).sort({ updatedAt: -1 });
};

module.exports = mongoose.model("LearningSession", learningSessionSchema);
