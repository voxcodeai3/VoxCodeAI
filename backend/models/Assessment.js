const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseModule",
      default: null,
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      default: null,
    },
    skill: { type: String, default: null },
    type: {
      type: String,
      enum: ["placement", "lesson", "practice", "review", "course", "skill"],
      required: true,
    },
    mode: {
      type: String,
      enum: ["practice", "exam", "placement", "review"],
      default: "practice",
    },
    skills: { type: [String], default: [] },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    questionCount: { type: Number, default: 10 },
    minQuestions: { type: Number, default: 8 },
    maxQuestions: { type: Number, default: 20 },
    timeLimitMinutes: { type: Number, default: null },
    passingScore: { type: Number, default: 70 },
    adaptive: { type: Boolean, default: true },
    aiAssisted: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
  },
  { timestamps: true, versionKey: false }
);

assessmentSchema.statics.findPublished = function (query = {}) {
  return this.find({ ...query, status: "published" });
};

assessmentSchema.statics.findByCourse = function (courseId) {
  return this.find({ course: courseId, status: "published" });
};

assessmentSchema.statics.findPlacement = function (skill) {
  return this.findOne({ type: "placement", skill, status: "published" });
};

module.exports = mongoose.model("Assessment", assessmentSchema);
