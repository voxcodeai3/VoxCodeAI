const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["multiple_choice", "short_answer", "predict_output", "code", "conceptual", "true_false"],
      default: "multiple_choice",
    },
    question: { type: String, required: true },
    options: { type: [String], default: [] },
    code: { type: String, default: null },
    expectedAnswer: { type: String, default: null },
    topic: { type: String, default: null },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
    technology: { type: String, default: null },
  },
  { _id: false }
);

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    answer: { type: String, default: "" },
    isCorrect: { type: Boolean, default: null },
    score: { type: Number, default: 0 },
    answeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const initialAssessmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    learningPath: { type: mongoose.Schema.Types.ObjectId, ref: "LearningPath", required: true, index: true },
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active", index: true },
    questions: { type: [questionSchema], default: [] },
    answers: { type: [answerSchema], default: [] },
    overallLevel: { type: String, enum: ["beginner", "intermediate", "advanced"] },
    technologyLevels: {
      type: [
        {
          technology: { type: String },
          level: { type: String, enum: ["beginner", "intermediate", "advanced"] },
          _id: false,
        },
      ],
      default: [],
    },
    strengths: { type: [String], default: [] },
    weaknesses: {
      type: [
        {
          topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
          topicName: { type: String },
          reason: { type: String, default: "" },
          _id: false,
        },
      ],
      default: [],
    },
    recommendedStartingTopic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
    recommendedStage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

initialAssessmentSchema.index({ user: 1, learningPath: 1, status: 1 });

initialAssessmentSchema.statics.findActive = function (userId, pathId) {
  return this.findOne({ user: userId, learningPath: pathId, status: "active" }).sort({ createdAt: -1 });
};

initialAssessmentSchema.statics.findCompleted = function (userId, pathId) {
  return this.findOne({ user: userId, learningPath: pathId, status: "completed" }).sort({ completedAt: -1 });
};

module.exports = mongoose.model("InitialAssessment", initialAssessmentSchema);
