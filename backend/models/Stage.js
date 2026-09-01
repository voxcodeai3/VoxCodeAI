const mongoose = require("mongoose");

const stageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
      default: "beginner",
      index: true,
    },
    order: { type: Number, required: true, min: 0 },
    learningPath: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LearningPath",
      required: true,
      index: true,
    },
    prerequisites: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Stage" }],
      default: [],
    },
    estimatedMinutes: { type: Number, default: 30, min: 1 },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

// Prevent duplicate slugs per learning path
stageSchema.index({ learningPath: 1, slug: 1 }, { unique: true });
stageSchema.index({ learningPath: 1, order: 1 }, { unique: true });

stageSchema.statics.findByPath = function (pathId) {
  return this.find({ learningPath: pathId, status: "published" }).sort({ order: 1 });
};

stageSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug });
};

module.exports = mongoose.model("Stage", stageSchema);
