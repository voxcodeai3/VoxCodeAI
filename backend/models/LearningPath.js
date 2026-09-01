const mongoose = require("mongoose");

const pathCourseSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    order: { type: Number, default: 0 },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const learningPathSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    courses: { type: [pathCourseSchema], default: [] },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    estimatedDuration: { type: String, default: "" },
    skills: { type: [String], default: [] },
      icon: { type: String, default: null },
    category: {
      type: String,
      enum: ["programming_languages", "frontend", "backend", "fullstack", "mobile", "databases", "tools"],
      default: "programming_languages",
      index: true,
    },
    technologies: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Technology" }],
      default: [],
    },
    prerequisites: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "LearningPath" }],
      default: [],
    },
    order: { type: Number, default: 0 },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    active: { type: Boolean, default: true },
    pathType: {
      type: String,
      enum: ["language", "frontend", "backend", "fullstack", "mobile", "database", "tool"],
      default: "language",
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

  learningPathSchema.statics.findPublished = function () {
  return this.find({ status: "published" }).sort({ difficulty: 1, title: 1 });
};

learningPathSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug });
};

learningPathSchema.statics.findByCategory = function (category) {
  return this.find({ category, status: "published" }).sort({ difficulty: 1, order: 1 });
};

module.exports = mongoose.model("LearningPath", learningPathSchema);
