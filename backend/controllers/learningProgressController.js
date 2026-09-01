const LearningProgress = require("../models/LearningProgress");
const UserSkill = require("../models/UserSkill");
const { Lesson, CourseModule } = require("../models/Course");
const analyticsService = require("../services/analyticsService");

exports.getProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.query;

    if (courseId) {
      const progress = await LearningProgress.courseProgress(userId, courseId);
      return res.json(progress);
    }

    const allProgress = await LearningProgress.find({ user: userId })
      .sort({ lastAccessedAt: -1 })
      .limit(50);

    res.json(allProgress);
  } catch (err) {
    console.error("getProgress error:", err);
    res.status(500).json({ message: "Failed to load progress" });
  }
};

exports.updateProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lessonId, courseId, status, progress, score } = req.body;

    if (!lessonId) return res.status(400).json({ message: "lessonId required" });

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    let resolvedCourseId = courseId || lesson.module;
    // lesson.module is a module id — resolve to actual course id
    if (resolvedCourseId) {
      const maybeCourse = await CourseModule.findById(resolvedCourseId);
      // if courseId was actually a module id, use its course
      if (maybeCourse && maybeCourse.course) {
        resolvedCourseId = maybeCourse.course;
      } else if (!maybeCourse) {
        // try as course directly — if not found, fallback via lesson's module
        const mod = await CourseModule.findById(lesson.module);
        if (mod) resolvedCourseId = mod.course;
      }
    }

    const prog = await LearningProgress.findOrCreateLesson(userId, resolvedCourseId, lessonId);

    if (status) prog.status = status;
    if (progress !== undefined) prog.progress = Math.min(100, Math.max(0, progress));
    if (score !== undefined) prog.score = score;
    prog.lastAccessedAt = new Date();
    if (status === "in_progress" && !prog.startedAt) prog.startedAt = new Date();
    if (status === "completed") {
      prog.completedAt = new Date();
      prog.progress = 100;
      prog.lastAccessedAt = new Date();

      if (lesson.type === "concept" || lesson.type === "coding" || lesson.type === "exercise") {
        const skillName = lesson.title;
        const module = await CourseModule.findById(lesson.module);
        const category = module ? module.title : "general";
        await UserSkill.updateSkillPerformance(userId, skillName, score !== null ? score >= 70 : true);
      }

      try {
        await analyticsService.recordSessionComplete(userId, {
          type: "lesson_completed",
          topic: lesson.title,
          language: "javascript",
          score: score || 100,
          difficulty: lesson.difficulty,
        });
      } catch (_) {}
    }

    await prog.save();
    res.json(prog);
  } catch (err) {
    console.error("updateProgress error:", err);
    res.status(500).json({ message: "Failed to update progress" });
  }
};

exports.getSkills = async (req, res) => {
  try {
    const userId = req.user.id;
    const skills = await UserSkill.findByUser(userId);
    const summary = await UserSkill.userSkillsSummary(userId);
    res.json({ skills, summary });
  } catch (err) {
    console.error("getSkills error:", err);
    res.status(500).json({ message: "Failed to load skills" });
  }
};

exports.updateSkill = async (req, res) => {
  try {
    const userId = req.user.id;
    const { skill, correct, category } = req.body;
    if (!skill) return res.status(400).json({ message: "skill required" });

    const updated = await UserSkill.updateSkillPerformance(userId, skill, !!correct);
    res.json(updated);
  } catch (err) {
    console.error("updateSkill error:", err);
    res.status(500).json({ message: "Failed to update skill" });
  }
};
