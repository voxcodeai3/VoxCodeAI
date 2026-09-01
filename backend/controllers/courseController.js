const { Course, CourseModule, Lesson } = require("../models/Course");

exports.listCourses = async (req, res) => {
  try {
    const { language, difficulty, search } = req.query;
    const query = { status: "published" };
    if (language) query.language = language;
    if (difficulty) query.difficulty = difficulty;
    if (search) query.title = { $regex: search, $options: "i" };

    const courses = await Course.find(query).sort({ difficulty: 1, title: 1 });

    const coursesWithMeta = await Promise.all(
      courses.map(async (c) => {
        const modules = await CourseModule.find({ course: c._id });
        const moduleIds = modules.map((m) => m._id);
        const lessons = await Lesson.find({ module: { $in: moduleIds } });
        return {
          ...c.toObject(),
          totalLessons: lessons.length,
          estimatedMinutes: lessons.reduce((s, l) => s + (l.estimatedMinutes || 10), 0),
        };
      })
    );

    res.json(coursesWithMeta);
  } catch (err) {
    console.error("listCourses error:", err);
    res.status(500).json({ message: "Failed to load courses" });
  }
};

exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, status: "published" });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const modules = await CourseModule.find({ course: course._id }).sort({ order: 1 });
    const modulesWithLessons = await Promise.all(
      modules.map(async (m) => {
        const lessons = await Lesson.find({ module: m._id }).sort({ order: 1 });
        return { ...m.toObject(), lessons };
      })
    );

    res.json({ ...course.toObject(), modules: modulesWithLessons });
  } catch (err) {
    console.error("getCourse error:", err);
    res.status(500).json({ message: "Failed to load course" });
  }
};

exports.getLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    const module = await CourseModule.findById(lesson.module);
    if (!module) return res.status(404).json({ message: "Module not found" });

    const siblings = await Lesson.find({ module: module._id }).sort({ order: 1 });
    const idx = siblings.findIndex((l) => l._id.toString() === lesson._id.toString());
    const nextLesson = idx < siblings.length - 1 ? siblings[idx + 1] : null;
    const prevLesson = idx > 0 ? siblings[idx - 1] : null;

    res.json({
      ...lesson.toObject(),
      module: { _id: module._id, title: module.title, course: module.course },
      nextLesson: nextLesson ? { _id: nextLesson._id, title: nextLesson.title, type: nextLesson.type } : null,
      prevLesson: prevLesson ? { _id: prevLesson._id, title: prevLesson.title, type: prevLesson.type } : null,
    });
  } catch (err) {
    console.error("getLesson error:", err);
    res.status(500).json({ message: "Failed to load lesson" });
  }
};
