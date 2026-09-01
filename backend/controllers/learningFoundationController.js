const Technology = require("../models/Technology");
const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");
const { Lesson } = require("../models/Course");

const CATEGORIES = [
  { id: "programming_languages", slug: "programming_languages", name: "Programming Languages", description: "Core languages for every developer" },
  { id: "frontend", slug: "frontend", name: "Frontend Development", description: "Build interfaces users love" },
  { id: "backend", slug: "backend", name: "Backend Development", description: "Servers, APIs and data" },
  { id: "fullstack", slug: "fullstack", name: "Full Stack Development", description: "End-to-end web stacks" },
  { id: "mobile", slug: "mobile", name: "Mobile Development", description: "iOS, Android and cross-platform" },
  { id: "databases", slug: "databases", name: "Databases", description: "SQL and NoSQL data" },
  { id: "tools", slug: "tools", name: "Developer Tools", description: "Git, Docker and essentials" },
];

const CATEGORY_SET = new Set(CATEGORIES.map(c => c.slug));

exports.getCategories = async (req, res) => {
  try {
    res.json(CATEGORIES);
  } catch (err) {
    res.status(500).json({ message: "Failed to load categories" });
  }
};

exports.getTechnologies = async (req, res) => {
  try {
    const { type, category, active } = req.query;
    const q = {};
    if (type) q.type = type;
    if (category) q.category = category;
    if (active !== undefined) q.active = active === "true";
    const techs = await Technology.find(q).sort({ name: 1 });
    res.json(techs);
  } catch (err) {
    res.status(500).json({ message: "Failed to load technologies" });
  }
};

exports.getTechnologyBySlug = async (req, res) => {
  try {
    const tech = await Technology.findOne({ slug: req.params.slug });
    if (!tech) return res.status(404).json({ message: "Technology not found" });
    res.json(tech);
  } catch (err) {
    res.status(500).json({ message: "Failed to load technology" });
  }
};

exports.getPaths = async (req, res) => {
  try {
    const { category, technology, difficulty, active } = req.query;
    const q = {};
    if (category) {
      if (!CATEGORY_SET.has(category)) return res.status(400).json({ message: "Invalid category" });
      q.category = category;
    }
    if (technology) q.technologies = technology;
    if (difficulty) q.difficulty = difficulty;
    if (active !== undefined) q.active = active === "true";
    // default to published only
    q.status = "published";
    const paths = await LearningPath.find(q).populate("technologies").populate("prerequisites").sort({ order: 1, title: 1 });
    res.json(paths);
  } catch (err) {
    res.status(500).json({ message: "Failed to load learning paths" });
  }
};

exports.getPathById = async (req, res) => {
  try {
    const path = await LearningPath.findById(req.params.pathId).populate("technologies").populate("prerequisites");
    if (!path) return res.status(404).json({ message: "Learning path not found" });
    const stages = await Stage.find({ learningPath: path._id, status: "published" }).sort({ order: 1 });
    res.json({ ...path.toObject(), stages });
  } catch (err) {
    if (err.kind === "ObjectId") return res.status(400).json({ message: "Invalid path id" });
    res.status(500).json({ message: "Failed to load learning path" });
  }
};

exports.getPathStages = async (req, res) => {
  try {
    const path = await LearningPath.findById(req.params.pathId);
    if (!path) return res.status(404).json({ message: "Learning path not found" });
    const stages = await Stage.find({ learningPath: req.params.pathId, status: "published" }).sort({ order: 1 });
    res.json(stages);
  } catch (err) {
    if (err.kind === "ObjectId") return res.status(400).json({ message: "Invalid path id" });
    res.status(500).json({ message: "Failed to load stages" });
  }
};

exports.getStageTopics = async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.stageId);
    if (!stage) return res.status(404).json({ message: "Stage not found" });
    const topics = await Topic.find({ stage: req.params.stageId, status: "published" }).sort({ order: 1 }).populate("technologies");
    res.json(topics);
  } catch (err) {
    if (err.kind === "ObjectId") return res.status(400).json({ message: "Invalid stage id" });
    res.status(500).json({ message: "Failed to load topics" });
  }
};

exports.getTopicLessons = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });
    const lessons = await Lesson.find({ topic: req.params.topicId, status: "published" }).sort({ order: 1 });
    res.json(lessons);
  } catch (err) {
    if (err.kind === "ObjectId") return res.status(400).json({ message: "Invalid topic id" });
    res.status(500).json({ message: "Failed to load lessons" });
  }
};
