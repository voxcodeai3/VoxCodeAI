const mongoose = require("mongoose");

const topicProgressSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, trim: true },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    attempts: { type: Number, default: 0 },
    lastPracticed: { type: Date, default: Date.now },
  },
  { _id: false }
);

const learnerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    onboardingComplete: { type: Boolean, default: false },
    selectedGoal: {
      type: String,
      enum: [
        "frontend", "backend", "fullstack", "mobile", "python",
        "ai_ml", "data_science", "game_dev", "software_engineering",
        "dsa", "programming_language", null,
      ],
      default: null,
    },
    selectedStack: { type: String, default: null },
    selectedTechnologies: { type: [String], default: [] },
    experienceLevel: {
      type: String,
      enum: ["complete_beginner", "beginner", "intermediate", "advanced"],
      default: null,
    },
    learningGoals: { type: [String], default: [] },
    preferredLearningStyle: {
      type: String,
      enum: ["explanation", "coding", "project_based", "practice_heavy", "quiz_heavy", "balanced"],
      default: "balanced",
    },
    weeklyGoalHours: { type: Number, default: null },
    preferredLanguages: { type: [String], default: [] },
    preferredTeachingStyle: {
      type: String,
      enum: [
        "step_by_step", "socratic", "example_first",
        "concise", "detailed", "practice_focused",
      ],
      default: null,
    },
    activePath: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LearningPath",
      default: null,
    },
    currentTopics: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    topicProgress: { type: [topicProgressSchema], default: [] },
    conversationSummary: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

learnerProfileSchema.statics.findByUser = function (userId) {
  return this.findOne({ user: userId });
};

learnerProfileSchema.statics.findOrCreate = async function (userId) {
  let profile = await this.findOne({ user: userId });
  if (!profile) {
    profile = await this.create({ user: userId });
  }
  return profile;
};

module.exports = mongoose.model("LearnerProfile", learnerProfileSchema);
