const mongoose = require("mongoose");

const stackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    goal: {
      type: String,
      enum: [
        "frontend", "backend", "fullstack", "mobile", "python",
        "ai_ml", "data_science", "game_dev", "software_engineering",
        "dsa", "programming_language",
      ],
      required: true,
      index: true,
    },
    description: { type: String, default: "" },
    technologies: { type: [String], required: true },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    estimatedWeeks: { type: String, default: "" },
    skills: { type: [String], default: [] },
    whatYouWillLearn: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["available", "coming_soon", "deprecated"],
      default: "available",
    },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

stackSchema.statics.findByGoal = function (goal) {
  return this.find({ goal, status: "available" }).sort({ sortOrder: 1, name: 1 });
};

stackSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug, status: "available" });
};

module.exports = mongoose.model("Stack", stackSchema);
