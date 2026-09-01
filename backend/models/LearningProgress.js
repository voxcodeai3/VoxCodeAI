const mongoose = require("mongoose");

const learningProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    lesson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    score: { type: Number, default: null },
    timeSpentMinutes: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

learningProgressSchema.statics.findByUserAndCourse = function (userId, courseId) {
  return this.find({ user: userId, course: courseId }).sort({ createdAt: -1 });
};

learningProgressSchema.statics.findLessonProgress = function (userId, lessonId) {
  return this.findOne({ user: userId, lesson: lessonId });
};

learningProgressSchema.statics.findOrCreateLesson = async function (userId, courseId, lessonId) {
  let progress = await this.findOne({ user: userId, lesson: lessonId });
  if (!progress) {
    progress = await this.create({
      user: userId,
      course: courseId,
      lesson: lessonId,
      status: "in_progress",
      startedAt: new Date(),
      lastAccessedAt: new Date(),
    });
  }
  return progress;
};

learningProgressSchema.statics.courseProgress = async function (userId, courseId) {
  const Lesson = mongoose.model("Lesson");
  const CourseModule = mongoose.model("CourseModule");

  const modules = await CourseModule.find({ course: courseId }).sort({ order: 1 });
  const moduleIds = modules.map((m) => m._id);
  const lessons = await Lesson.find({ module: { $in: moduleIds } });
  const lessonIds = lessons.map((l) => l._id);
  const requiredLessons = lessons.filter((l) => l.required !== false);

  const progressRecords = await this.find({
    user: userId,
    lesson: { $in: lessonIds },
  });

  const completed = progressRecords.filter((p) => p.status === "completed").length;
  const totalRequired = requiredLessons.length || lessons.length;
  const totalLessons = lessons.length;
  const totalTime = lessons.reduce((sum, l) => sum + (l.estimatedMinutes || 10), 0);

  const completedTime = progressRecords
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => {
      const lesson = lessons.find((l) => l._id.toString() === p.lesson.toString());
      return sum + (lesson ? lesson.estimatedMinutes : 10);
    }, 0);

  return {
    totalLessons,
    completedLessons: completed,
    totalRequired,
    percentage: totalRequired > 0 ? Math.round((completed / totalRequired) * 100) : 0,
    estimatedRemaining: Math.max(0, totalTime - completedTime),
    lessons: lessons.map((l) => {
      const prog = progressRecords.find(
        (p) => p.lesson.toString() === l._id.toString()
      );
      return {
        lesson: l,
        status: prog ? prog.status : "not_started",
        progress: prog ? prog.progress : 0,
        score: prog ? prog.score : null,
      };
    }),
  };
};

module.exports = mongoose.model("LearningProgress", learningProgressSchema);
