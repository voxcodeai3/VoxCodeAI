const mongoose = require("mongoose");

const quizResultSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    topic: { type: String },
    score: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    attempts: { type: Number, default: 1 },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const exerciseResultSchema = new mongoose.Schema(
  {
    exerciseId: { type: String },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    topic: { type: String },
    passed: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectProgressSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId },
    title: { type: String },
    status: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started" },
    completedTasks: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
  },
  { _id: false }
);

const learningMemorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    activeLearningPath: { type: mongoose.Schema.Types.ObjectId, ref: "LearningPath", default: null },
    currentStage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage", default: null },
    currentLesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
    completedLessons: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }], default: [] },
    completedStages: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Stage" }], default: [] },
    quizResults: { type: [quizResultSchema], default: [] },
    exerciseResults: { type: [exerciseResultSchema], default: [] },
    weakTopics: { type: [String], default: [] },
    projectProgress: { type: [projectProgressSchema], default: [] },
    lastActivity: { type: Date, default: Date.now },
    lastOpenedAt: { type: Date, default: Date.now },
    conversationSummary: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

learningMemorySchema.statics.findOrCreate = async function (userId) {
  let doc = await this.findOne({ user: userId });
  if (!doc) {
    doc = await this.create({ user: userId });
  }
  return doc;
};

learningMemorySchema.methods.touch = function () {
  this.lastActivity = new Date();
  this.lastOpenedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("LearningMemory", learningMemorySchema);
