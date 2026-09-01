const LearningMemory = require("../models/LearningMemory");
const LearningProgress = require("../models/LearningProgress");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");
const { Lesson } = require("../models/Course");
const LearningPath = require("../models/LearningPath");
const mongoose = require("mongoose");

exports.getMemory = async (req, res) => {
  try {
    const userId = req.user.id;
    const mem = await LearningMemory.findOrCreate(userId);
    await mem.populate("activeLearningPath currentStage currentLesson");
    res.json(mem);
  } catch (err) {
    res.status(500).json({ message: "Failed to load learning memory" });
  }
};

exports.getResume = async (req, res) => {
  try {
    const userId = req.user.id;
    const mem = await LearningMemory.findOne({ user: userId }).populate("activeLearningPath currentStage currentLesson");
    if (!mem || !mem.currentLesson) {
      return res.json({ hasProgress: false, message: "No progress yet" });
    }
    // Enrich lesson with stage/path
    let lesson = null;
    let stage = null;
    let path = null;
    if (mem.currentLesson) {
      lesson = await Lesson.findById(mem.currentLesson).lean();
      if (lesson?.topic) {
        const topic = await Topic.findById(lesson.topic).lean();
        if (topic?.stage) {
          stage = await Stage.findById(topic.stage).lean();
          if (stage?.learningPath) path = await LearningPath.findById(stage.learningPath).lean();
        }
      }
    }
    const completedCount = mem.completedLessons?.length || 0;
    res.json({
      hasProgress: true,
      currentLesson: lesson,
      currentStage: stage,
      learningPath: path,
      activeLearningPath: mem.activeLearningPath,
      progressPercent: 0, // could compute
      completedLessons: completedCount,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load resume" });
  }
};

exports.updateProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lessonId, stageId, pathId, status } = req.body;
    if (!lessonId || !mongoose.Types.ObjectId.isValid(lessonId)) return res.status(400).json({ message: "lessonId required" });
    if (!["not_started","in_progress","completed"].includes(status)) return res.status(400).json({ message: "Invalid status" });

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    const mem = await LearningMemory.findOrCreate(userId);
    mem.currentLesson = lessonId;
    if (stageId && mongoose.Types.ObjectId.isValid(stageId)) mem.currentStage = stageId;
    else if (lesson.topic) {
      const topic = await Topic.findById(lesson.topic).lean();
      if (topic?.stage) mem.currentStage = topic.stage;
    }
    if (pathId && mongoose.Types.ObjectId.isValid(pathId)) mem.activeLearningPath = pathId;
    else if (mem.currentStage) {
      const st = await Stage.findById(mem.currentStage).lean();
      if (st?.learningPath) mem.activeLearningPath = st.learningPath;
    }

    if (status === "completed" && !mem.completedLessons.find(id => id.toString() === lessonId)) {
      mem.completedLessons.push(lessonId);
    }
    if (status === "completed" && mem.currentStage) {
      // check if stage complete (all lessons in stage completed)
      const stageTopics = await Topic.find({ stage: mem.currentStage }).select("_id");
      const topicIds = stageTopics.map(t => t._id);
      const stageLessons = await Lesson.find({ topic: { $in: topicIds } }).select("_id");
      const allIds = stageLessons.map(l => l._id.toString());
      const done = allIds.every(id => mem.completedLessons.map(c=>c.toString()).includes(id));
      if (done && !mem.completedStages.find(id => id.toString() === mem.currentStage.toString())) {
        mem.completedStages.push(mem.currentStage);
      }
    }
    mem.lastActivity = new Date();
    mem.lastOpenedAt = new Date();
    await mem.save();
    res.json(mem);
  } catch (err) {
    res.status(500).json({ message: "Failed to update progress" });
  }
};

exports.addWeakTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic } = req.body;
    if (!topic || typeof topic !== "string") return res.status(400).json({ message: "topic required" });
    const mem = await LearningMemory.findOrCreate(userId);
    if (!mem.weakTopics.includes(topic)) {
      mem.weakTopics = [...mem.weakTopics, topic].slice(-20);
      await mem.save();
    }
    res.json(mem);
  } catch (err) {
    res.status(500).json({ message: "Failed to save weak topic" });
  }
};

exports.saveExercise = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lessonId, exerciseId, passed, score, topic } = req.body;
    const mem = await LearningMemory.findOrCreate(userId);
    mem.exerciseResults.push({ exerciseId: exerciseId || `ex-${Date.now()}`, lessonId, topic, passed: !!passed, score: score || 0 });
    if (!passed && topic && !mem.weakTopics.includes(topic)) mem.weakTopics = [...mem.weakTopics, topic].slice(-20);
    mem.lastActivity = new Date();
    await mem.save();
    res.json(mem);
  } catch (err) {
    res.status(500).json({ message: "Failed to save exercise" });
  }
};

exports.saveQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lessonId, topic, score, passed } = req.body;
    const mem = await LearningMemory.findOrCreate(userId);
    mem.quizResults.push({ lessonId, topic, score: score || 0, passed: !!passed, attempts: 1 });
    if (!passed && topic && !mem.weakTopics.includes(topic)) mem.weakTopics = [...mem.weakTopics, topic].slice(-20);
    mem.lastActivity = new Date();
    await mem.save();
    res.json(mem);
  } catch (err) {
    res.status(500).json({ message: "Failed to save quiz" });
  }
};

exports.saveProjectProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId, title, status, completedTasks, totalTasks } = req.body;
    const mem = await LearningMemory.findOrCreate(userId);
    const idx = mem.projectProgress.findIndex(p => (p.projectId && projectId && p.projectId.toString() === projectId) || p.title === title);
    if (idx >= 0) {
      if (status) mem.projectProgress[idx].status = status;
      if (completedTasks !== undefined) mem.projectProgress[idx].completedTasks = completedTasks;
      if (totalTasks !== undefined) mem.projectProgress[idx].totalTasks = totalTasks;
      mem.projectProgress[idx].lastActivity = new Date();
    } else {
      mem.projectProgress.push({ projectId, title, status: status || "in_progress", completedTasks: completedTasks || 0, totalTasks: totalTasks || 0 });
    }
    mem.lastActivity = new Date();
    await mem.save();
    res.json(mem);
  } catch (err) {
    res.status(500).json({ message: "Failed to save project progress" });
  }
};

exports.getWeakTopics = async (req, res) => {
  try {
    const mem = await LearningMemory.findOne({ user: req.user.id }).select("weakTopics");
    res.json({ weakTopics: mem?.weakTopics || [] });
  } catch (err) {
    res.status(500).json({ message: "Failed to load weak topics" });
  }
};
