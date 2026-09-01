const LearningPath = require("../models/LearningPath");
const { Course, CourseModule, Lesson } = require("../models/Course");

exports.listPaths = async (req, res) => {
  try {
    const paths = await LearningPath.find({ status: "published" }).sort({ difficulty: 1, title: 1 });

    const pathsWithMeta = await Promise.all(
      paths.map(async (p) => {
        const courseIds = p.courses.map((c) => c.course);
        const courses = await Course.find({ _id: { $in: courseIds } });
        let totalLessons = 0;
        let estimatedMinutes = 0;
        for (const c of courses) {
          const modules = await CourseModule.find({ course: c._id });
          const moduleIds = modules.map((m) => m._id);
          const lessons = await Lesson.find({ module: { $in: moduleIds } });
          totalLessons += lessons.length;
          estimatedMinutes += lessons.reduce((s, l) => s + (l.estimatedMinutes || 10), 0);
        }
        return {
          ...p.toObject(),
          courseCount: courses.length,
          totalLessons,
          estimatedMinutes,
        };
      })
    );

    res.json(pathsWithMeta);
  } catch (err) {
    console.error("listPaths error:", err);
    res.status(500).json({ message: "Failed to load learning paths" });
  }
};

exports.getPath = async (req, res) => {
  try {
    const path = await LearningPath.findOne({ _id: req.params.id, status: "published" });
    if (!path) return res.status(404).json({ message: "Learning path not found" });

    const coursesWithMeta = await Promise.all(
      path.courses
        .sort((a, b) => a.order - b.order)
        .map(async (pc) => {
          const course = await Course.findById(pc.course);
          if (!course) return null;
          const modules = await CourseModule.find({ course: course._id });
          const moduleIds = modules.map((m) => m._id);
          const lessons = await Lesson.find({ module: { $in: moduleIds } });
          return {
            ...course.toObject(),
            order: pc.order,
            required: pc.required,
            totalLessons: lessons.length,
            estimatedMinutes: lessons.reduce((s, l) => s + (l.estimatedMinutes || 10), 0),
          };
        })
    );

    res.json({ ...path.toObject(), courses: coursesWithMeta.filter(Boolean) });
  } catch (err) {
    console.error("getPath error:", err);
    res.status(500).json({ message: "Failed to load learning path" });
  }
};
