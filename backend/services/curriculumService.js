const Stack = require("../models/Stack");
const Technology = require("../models/Technology");
const { Course, CourseModule, Lesson } = require("../models/Course");
const LearningPath = require("../models/LearningPath");
const LearnerProfile = require("../models/LearnerProfile");

exports.resolveStackCurriculum = async (stackSlug) => {
  const stack = await Stack.findBySlug(stackSlug);
  if (!stack) return null;

  const techDetails = await Promise.all(
    stack.technologies.map(async (t) => {
      const tech = await Technology.findOne({ slug: t });
      return tech ? tech.toObject() : { slug: t, name: t };
    })
  );

  const courses = [];
  for (const tech of techDetails) {
    const course = await Course.findOne({ slug: { $regex: tech.slug, $options: "i" }, status: "published" });
    if (course) {
      const modules = await CourseModule.find({ course: course._id }).sort({ order: 1 });
      const moduleIds = modules.map((m) => m._id);
      const lessons = await Lesson.find({ module: { $in: moduleIds } });
      courses.push({
        ...course.toObject(),
        technology: tech.slug,
        totalLessons: lessons.length,
        estimatedMinutes: lessons.reduce((s, l) => s + (l.estimatedMinutes || 10), 0),
      });
    }
  }

  return {
    stack,
    technologies: techDetails,
    courses,
    totalLessons: courses.reduce((s, c) => s + c.totalLessons, 0),
    estimatedWeeks: stack.estimatedWeeks,
  };
};

exports.getGoalStacks = async (goal) => {
  return Stack.findByGoal(goal);
};

exports.getTechnologies = async (goal) => {
  return Technology.findAvailable({ relatedGoals: goal });
};

exports.getAllGoals = () => [
  { id: "frontend", label: "Frontend Developer", description: "Build modern web interfaces", icon: "Layout" },
  { id: "backend", label: "Backend Developer", description: "Build server-side applications", icon: "Server" },
  { id: "fullstack", label: "Full-Stack Developer", description: "Master both frontend and backend", icon: "Layers" },
  { id: "mobile", label: "Mobile Developer", description: "Build iOS and Android apps", icon: "Smartphone" },
  { id: "python", label: "Python Developer", description: "Learn Python from scratch", icon: "Code2" },
  { id: "ai_ml", label: "AI / ML Developer", description: "Build intelligent applications", icon: "Brain" },
  { id: "data_science", label: "Data Scientist", description: "Analyze data and build models", icon: "BarChart" },
  { id: "game_dev", label: "Game Developer", description: "Create games and interactive experiences", icon: "Gamepad2" },
  { id: "software_engineering", label: "Software Engineer", description: "Master software engineering principles", icon: "Wrench" },
  { id: "dsa", label: "DSA / Competitive Programmer", description: "Master data structures and algorithms", icon: "Binary" },
  { id: "programming_language", label: "Learn a Language", description: "Pick a programming language to learn", icon: "Code" },
];

exports.createLearningPathFromStack = async (userId, stackSlug, experienceLevel) => {
  const stack = await Stack.findBySlug(stackSlug);
  if (!stack) throw new Error("Stack not found");

  const existing = await LearningPath.findOne({ slug: `user-${userId}-${stackSlug}` });
  if (existing) return existing;

  const courses = [];
  let order = 1;
  for (const techSlug of stack.technologies) {
    const course = await Course.findOne({ slug: { $regex: techSlug, $options: "i" }, status: "published" });
    if (course) {
      courses.push({ course: course._id, order: order++, required: true });
    }
  }

  if (courses.length === 0) return null;

  const path = await LearningPath.create({
    title: stack.name,
    slug: `user-${userId}-${stackSlug}`,
    description: stack.description,
    courses,
    difficulty: stack.difficulty,
    estimatedDuration: `${stack.estimatedWeeks} weeks`,
    skills: stack.skills,
    status: "published",
  });

  return path;
};

exports.getDetermineStartingPoint = async (userId, stackSlug, experienceLevel) => {
  const curriculum = await this.resolveStackCurriculum(stackSlug);
  if (!curriculum || curriculum.courses.length === 0) return null;

  if (experienceLevel === "advanced") {
    return curriculum.courses[Math.min(2, curriculum.courses.length - 1)] || curriculum.courses[0];
  }
  if (experienceLevel === "intermediate") {
    return curriculum.courses[Math.min(1, curriculum.courses.length - 1)] || curriculum.courses[0];
  }
  return curriculum.courses[0];
};
