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
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
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

module.exports = mongoose.model("LearningPath", learningPathSchema);
