const mongoose = require("mongoose");

const quizResultSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
    topic: { type: String },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 5 },
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
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
    topic: { type: String },
    passed: { type: Boolean, default: false },
    status: { type: String, enum: ["not_started", "in_progress", "completed", "needs_review"], default: "completed" },
    score: { type: Number, default: 0 },
    attempts: { type: Number, default: 1 },
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

// — New AI-First schemas (lightweight, college project) —
const weakTopicDetailSchema = new mongoose.Schema(
  {
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
    topicName: { type: String, trim: true },
    topic: { type: String, trim: true }, // legacy string fallback
    reason: { type: String, default: "" },
    strength: { type: String, enum: ["weak", "needs_review"], default: "weak" },
    lastReviewedAt: { type: Date, default: null },
  },
  { _id: false }
);

const completedExerciseSchema = new mongoose.Schema(
  {
    exerciseId: { type: String, required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const assessmentResultSchema = new mongoose.Schema(
  {
    technology: { type: String, trim: true },
    estimatedLevel: { type: String, enum: ["beginner", "intermediate", "advanced"] },
    confidence: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    notes: { type: String, default: "" },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const learningSessionSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["active", "paused", "completed"], default: "active" },
    teachingState: {
      type: String,
      enum: ["teaching", "checking_understanding", "awaiting_answer", "reviewing", "ready_for_practice", "completed", "paused"],
      default: "teaching",
    },
    suggestedAction: {
      type: String,
      enum: [
        "continue_explanation",
        "answer_student",
        "ask_understanding",
        "ask_knowledge_check",
        "review_topic",
        "ready_for_practice",
        "complete_topic",
        "move_to_next_topic",
      ],
      default: "continue_explanation",
    },
    startedAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    learningPath: { type: mongoose.Schema.Types.ObjectId, ref: "LearningPath" },
    stage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage" },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
    interactionCount: { type: Number, default: 0 },
    checksPassed: { type: Number, default: 0 },
  },
  { _id: false }
);

const activeGoalSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["learning_path", "custom"], default: "learning_path" },
    learningPath: { type: mongoose.Schema.Types.ObjectId, ref: "LearningPath" },
    name: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const learningAssessmentEntrySchema = new mongoose.Schema(
  {
    learningPath: { type: mongoose.Schema.Types.ObjectId, ref: "LearningPath", required: true },
    completed: { type: Boolean, default: false },
    overallLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    technologyLevels: {
      type: [
        {
          technology: { type: String, trim: true },
          level: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
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
          topicName: { type: String, trim: true },
          reason: { type: String, default: "" },
          _id: false,
        },
      ],
      default: [],
    },
    recommendedStartingTopic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", default: null },
    recommendedStage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage", default: null },
    assessedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const learningMemorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    // — existing curriculum position (kept for backward compat) —
    activeLearningPath: { type: mongoose.Schema.Types.ObjectId, ref: "LearningPath", default: null },
    currentStage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage", default: null },
    currentLesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
    completedLessons: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }], default: [] },
    completedStages: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Stage" }], default: [] },
    quizResults: { type: [quizResultSchema], default: [] },
    exerciseResults: { type: [exerciseResultSchema], default: [] },
    // legacy string weak topics — kept for backward compat, do not remove
    weakTopics: { type: [String], default: [] },
    projectProgress: { type: [projectProgressSchema], default: [] },
    lastActivity: { type: Date, default: Date.now },
    lastOpenedAt: { type: Date, default: Date.now },
    conversationSummary: { type: String, default: "" },

    // — AI-First extensions (Step 1) —
    activeLearningGoal: { type: activeGoalSchema, default: null },
    currentTopic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", default: null },
    currentExercise: {
      exerciseId: { type: String, default: null },
      lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
    },
    currentProject: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },

    completedTopics: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }], default: [] },
    completedExercises: { type: [completedExerciseSchema], default: [] },

    currentLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },

    assessmentCompleted: { type: Boolean, default: false },
    assessmentLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], default: null },
    assessmentResults: { type: assessmentResultSchema, default: null },

    // structured weaknesses — alongside legacy weakTopics
    weakTopicsDetailed: { type: [weakTopicDetailSchema], default: [] },
    topicsNeedingReview: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }], default: [] },

    // session
    learningSession: { type: learningSessionSchema, default: null },
    lastLearningSession: { type: learningSessionSchema, default: null },

    // per-path assessments (Step 3) — keeps MERN, Python etc. separate
    learningAssessments: { type: [learningAssessmentEntrySchema], default: [] },
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
