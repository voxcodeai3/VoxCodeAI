const mongoose = require("mongoose");

const technologySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ["language", "framework", "library", "runtime", "database", "tool", "platform", "game_engine"],
      required: true,
    },
    category: { type: String, required: true, index: true },
    description: { type: String, default: "" },
    icon: { type: String, default: null },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    status: {
      type: String,
      enum: ["available", "coming_soon", "deprecated"],
      default: "available",
    },
    prerequisites: { type: [String], default: [] },
    relatedGoals: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false }
);

technologySchema.statics.findAvailable = function (query = {}) {
  return this.find({ ...query, status: "available" }).sort({ name: 1 });
};

technologySchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug });
};

module.exports = mongoose.model("Technology", technologySchema);
