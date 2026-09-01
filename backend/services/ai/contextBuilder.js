const LearnerProfile = require("../../models/LearnerProfile");
const LearningMemory = require("../../models/LearningMemory");
const LearningProgress = require("../../models/LearningProgress");
const UserSkill = require("../../models/UserSkill");
const Conversation = require("../../models/Conversation");
const Project = require("../../models/Project");
const { Lesson } = require("../../models/Course");
const Stage = require("../../models/Stage");
const Topic = require("../../models/Topic");
const LearningPath = require("../../models/LearningPath");
// Ensure Technology model is registered for populate
require("../../models/Technology");

// Compact, model-independent context builder — 3 layers: persistent state, recent conversation, relevant memory

async function buildLearningContext(userId, { lessonId, projectId, question }) {
  const start = Date.now();
  // Layer 1: persistent learning state (MongoDB is source of truth)
  const [profile, memory] = await Promise.all([
    LearnerProfile.findOne({ user: userId }).lean().catch(() => null),
    LearningMemory.findOne({ user: userId }).lean().catch(() => null),
  ]);

  let currentLesson = null;
  let currentStage = null;
  let currentPath = null;
  let topic = null;

  const targetLessonId = lessonId || memory?.currentLesson;
  if (targetLessonId) {
    try {
      currentLesson = await Lesson.findById(targetLessonId).lean();
      if (currentLesson) {
        if (currentLesson.topic) topic = await Topic.findById(currentLesson.topic).lean();
        // resolve stage via topic or via lesson's old module field
        const stageId = topic?.stage || memory?.currentStage;
        if (stageId) currentStage = await Stage.findById(stageId).lean();
        // resolve path via stage
        const pathId = currentStage?.learningPath || memory?.activeLearningPath;
        if (pathId) {
          try {
            currentPath = await LearningPath.findById(pathId).populate("technologies").lean();
            if (!currentPath) currentPath = await LearningPath.findById(pathId).lean();
          } catch {
            try { currentPath = await LearningPath.findById(pathId).lean(); } catch {}
          }
        }
      }
    } catch {}
  }

  // Fallback: try memory's active path directly
  if (!currentPath && memory?.activeLearningPath) {
    try {
      currentPath = await LearningPath.findById(memory.activeLearningPath).populate("technologies").lean();
      if (!currentPath) currentPath = await LearningPath.findById(memory.activeLearningPath).lean();
    } catch {
      try { currentPath = await LearningPath.findById(memory.activeLearningPath).lean(); } catch {}
    }
  }

  // Weak topics — relevant only if question mentions them
  const allWeak = memory?.weakTopics || [];
  const qLower = (question || "").toLowerCase();
  const relevantWeak = allWeak.filter(w => {
    if (!qLower) return false;
    return qLower.includes(w.toLowerCase()) || (currentLesson?.title || "").toLowerCase().includes(w.toLowerCase());
  }).slice(0, 3);

  // Completed — last 10 only to keep compact
  const completedLessons = (memory?.completedLessons || []).slice(-10);
  let completedTitles = [];
  if (completedLessons.length) {
    try {
      const docs = await Lesson.find({ _id: { $in: completedLessons } }).select("title").lean();
      completedTitles = docs.map(d => d.title).slice(0, 8);
    } catch {}
  }

  // Layer 2: recent conversation (limited window, not entire history)
  let recentConversation = [];
  let conversationSummary = memory?.conversationSummary || "";
  try {
    const convo = await Conversation.findOne({ user: userId }).sort({ updatedAt: -1 }).lean();
    if (convo?.messages?.length) {
      // keep last 5 exchanges (10 messages) max
      recentConversation = convo.messages.slice(-10).map(m => ({
        role: m.role,
        content: (m.content || "").slice(0, 300),
      }));
      // if long, keep summary + recent
      if (convo.messages.length > 20 && !conversationSummary) {
        // simple keyword summary fallback
        conversationSummary = `Student is learning ${currentPath?.title || "coding"} — ${currentStage?.title || ""} — ${currentLesson?.title || ""}`;
      }
    }
  } catch {}

  // Current project context (selected project)
  let currentProject = null;
  try {
    if (projectId) {
      currentProject = await Project.findOne({ _id: projectId, user: userId }).select("name files activeFile").lean();
    } else {
      currentProject = await Project.findOne({ user: userId }).sort({ lastOpenedAt: -1, updatedAt: -1 }).select("name files").lean();
    }
    if (currentProject) {
      // don't send file contents — just structure
      currentProject = {
        name: currentProject.name,
        fileCount: (currentProject.files || []).length,
        fileList: (currentProject.files || []).slice(0, 10).map(f => f.path),
      };
    }
  } catch {}

  // Progress snapshot
  let progressPercent = 0;
  try {
    if (currentPath?._id) {
      const prog = await LearningProgress.find({ user: userId, course: currentPath._id }).lean();
      // approximate — if no direct, use memory completed count
      if (prog.length) {
        const completed = prog.filter(p => p.status === "completed").length;
        progressPercent = Math.round((completed / Math.max(1, prog.length)) * 100);
      }
    }
  } catch {}

  const context = {
    // safe profile
    studentLevel: profile?.experienceLevel || "beginner",
    preferredTeachingStyle: profile?.preferredTeachingStyle || "step_by_step",
    // current state
    learningPath: currentPath ? { title: currentPath.title, technologies: (currentPath.technologies||[]).map(t=>t.name||t.slug||t), category: currentPath.category } : null,
    currentStage: currentStage ? { title: currentStage.title, level: currentStage.level } : null,
    currentLesson: currentLesson ? { title: currentLesson.title, objective: currentLesson.objective, prerequisites: currentLesson.prerequisites, estimatedMinutes: currentLesson.estimatedMinutes, type: currentLesson.type } : null,
    completed: completedTitles,
    weakTopics: relevantWeak,
    progressPercent,
    currentProject,
    recentConversation,
    conversationSummary: conversationSummary ? conversationSummary.slice(0, 300) : undefined,
    // meta
    _meta: { builtInMs: Date.now() - start, hasMemory: !!memory, hasLesson: !!currentLesson },
  };

  // Remove empty keys to keep compact
  Object.keys(context).forEach(k => {
    if (context[k] == null || (Array.isArray(context[k]) && context[k].length === 0)) delete context[k];
  });

  return context;
}

function contextToPrompt(context) {
  if (!context || Object.keys(context).length <= 1) return "";
  const parts = [];
  if (context.studentLevel) parts.push(`Student level: ${context.studentLevel}`);
  if (context.learningPath) parts.push(`Learning Path: ${context.learningPath.title} (${(context.learningPath.technologies||[]).join(", ")})`);
  if (context.currentStage) parts.push(`Current Stage: ${context.currentStage.title} (${context.currentStage.level})`);
  if (context.currentLesson) parts.push(`Current Lesson: ${context.currentLesson.title} — Objective: ${context.currentLesson.objective || "learn concept"}`);
  if (context.completed?.length) parts.push(`Completed: ${context.completed.join(", ")}`);
  if (context.weakTopics?.length) parts.push(`Previously struggled with: ${context.weakTopics.join(", ")} (adapt explanation)`);
  if (context.currentProject) parts.push(`Current Project: ${context.currentProject.name} (${context.currentProject.fileCount} files)`);
  if (context.conversationSummary) parts.push(`Conversation summary: ${context.conversationSummary}`);
  return parts.join("\n");
}

module.exports = { buildLearningContext, contextToPrompt };
