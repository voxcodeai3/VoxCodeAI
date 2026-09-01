const mongoose = require("mongoose");

const lessonContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "code", "example", "note"],
    },
    title: { type: String },
    content: { type: String, default: "" },
    language: { type: String, default: null },
  },
  { _id: false }
);

const lessonSchema = new mongoose.Schema(
  {
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseModule",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type: {
      type: String,
      enum: ["concept", "coding", "exercise", "quiz", "project", "review"],
      default: "concept",
    },
    content: { type: [lessonContentSchema], default: [] },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    estimatedMinutes: { type: Number, default: 10 },
    order: { type: Number, default: 0 },
    required: { type: Boolean, default: true },
    prerequisites: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

const moduleSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    language: {
      type: String,
      enum: ["javascript", "python", "java", "cpp", "go", "rust", "general"],
      default: "javascript",
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    thumbnail: { type: String, default: null },
    estimatedDuration: { type: String, default: "" },
    skills: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    courseVersion: { type: Number, default: 1 },
  },
  { timestamps: true, versionKey: false }
);

courseSchema.statics.findPublished = function (query = {}) {
  return this.find({ ...query, status: "published" }).sort({ difficulty: 1, title: 1 });
};

courseSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug });
};

const Course = mongoose.model("Course", courseSchema);
const CourseModule = mongoose.model("CourseModule", moduleSchema);
const Lesson = mongoose.model("Lesson", lessonSchema);

module.exports = { Course, CourseModule, Lesson };
