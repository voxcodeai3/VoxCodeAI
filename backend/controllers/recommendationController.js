const LearningProgress = require("../models/LearningProgress");
const UserSkill = require("../models/UserSkill");
const LearningPath = require("../models/LearningPath");
const { Course, CourseModule, Lesson } = require("../models/Course");
const LearnerProfile = require("../models/LearnerProfile");

exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const recommendations = [];

    const profile = await LearnerProfile.findByUser(userId);
    const allProgress = await LearningProgress.find({ user: userId }).sort({ lastAccessedAt: -1 });
    const skills = await UserSkill.findByUser(userId);

    const inProgress = allProgress.filter((p) => p.status === "in_progress");
    if (inProgress.length > 0) {
      const latest = inProgress[0];
      const lesson = await Lesson.findById(latest.lesson);
      if (lesson) {
        recommendations.push({
          type: "continue",
          title: lesson.title,
          lessonId: lesson._id,
          courseId: latest.course,
          reason: "Continue where you left off.",
          priority: 10,
        });
      }
    }

    const weakSkills = skills.filter((s) => s.confidence < 0.4 && s.attempts >= 3);
    for (const skill of weakSkills.slice(0, 2)) {
      recommendations.push({
        type: "review",
        title: skill.skill,
        skill: skill.skill,
        reason: `You've been struggling with ${skill.skill}. A quick review can help.`,
        confidence: skill.confidence,
        priority: 8,
      });
    }

    const completedLessonIds = allProgress
      .filter((p) => p.status === "completed")
      .map((p) => p.lesson.toString());

    const paths = profile?.activePath
      ? await LearningPath.find({ _id: profile.activePath, status: "published" })
      : await LearningPath.find({ status: "published" });
    for (const path of paths) {
      for (const pc of path.courses) {
        const course = await Course.findById(pc.course);
        if (!course) continue;
        const modules = await CourseModule.find({ course: course._id });
        const moduleIds = modules.map((m) => m._id);
        const lessons = await Lesson.find({ module: { $in: moduleIds } }).sort({ order: 1 });

        for (const lesson of lessons) {
          if (completedLessonIds.includes(lesson._id.toString())) continue;

          const prereqsMet = !lesson.prerequisites || lesson.prerequisites.length === 0 ||
            lesson.prerequisites.every((pid) => completedLessonIds.includes(pid.toString()));

          if (prereqsMet) {
            const alreadyStarted = allProgress.find(
              (p) => p.lesson.toString() === lesson._id.toString()
            );
            if (!alreadyStarted) {
              recommendations.push({
                type: "new_lesson",
                title: lesson.title,
                lessonId: lesson._id,
                courseId: course._id,
                courseName: course.title,
                pathName: path.title,
                reason: `Start a new lesson in ${course.title}.`,
                priority: 5,
              });
            }
            break;
          }
        }
        break;
      }
      if (recommendations.filter((r) => r.type === "new_lesson").length >= 2) break;
    }

    const recentCorrect = allProgress.filter(
      (p) => p.status === "completed" && p.score && p.score >= 80
    );
    if (recentCorrect.length >= 3) {
      const bestSkill = skills.sort((a, b) => b.confidence - a.confidence)[0];
      if (bestSkill) {
        recommendations.push({
          type: "practice",
          title: `Challenge: ${bestSkill.skill}`,
          skill: bestSkill.skill,
          reason: `You're doing well with ${bestSkill.skill}. Try a harder challenge!`,
          priority: 4,
        });
      }
    }

    recommendations.sort((a, b) => b.priority - a.priority);
    res.json({ recommendations: recommendations.slice(0, 6) });
  } catch (err) {
    console.error("getRecommendations error:", err);
    res.status(500).json({ message: "Failed to load recommendations" });
  }
};
