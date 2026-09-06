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
  let currentTechnology = null;

  const targetLessonId = lessonId || memory?.currentLesson;
  if (targetLessonId) {
    try {
      currentLesson = await Lesson.findById(targetLessonId).lean();
      if (currentLesson) {
        if (currentLesson.topic) topic = await Topic.findById(currentLesson.topic).populate("technologies").lean();
        if (topic?.technologies?.length) currentTechnology = topic.technologies[0];
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
          if (!currentTechnology && currentPath?.technologies?.length) currentTechnology = currentPath.technologies[0];
        }
      }
    } catch {}
  }

  // Fallback: topic from memory if no lesson
  if (!topic && memory?.currentTopic) {
    try { topic = await Topic.findById(memory.currentTopic).populate("technologies").lean(); } catch {}
  }
  // Resolve stage/topic from memory if still missing
  if (!currentStage && memory?.currentStage) {
    try { currentStage = await Stage.findById(memory.currentStage).lean(); } catch {}
  }
  if (!currentLesson && topic) {
    // if we have topic but no lesson, try to find first lesson of topic
    try { currentLesson = await Lesson.findOne({ topic: topic._id, status: "published" }).lean(); } catch {}
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

  // Weak topics — path-filtered (Step 7: memory never leaks across paths), relevant only if question mentions them
  const activePathId = currentPath?._id?.toString() || memory?.activeLearningPath?.toString() || null;
  const detailedWeak = (memory?.weakTopicsDetailed || []).filter(w => {
    if (!w) return false;
    if (activePathId && w.learningPath && w.learningPath.toString() !== activePathId) return false;
    return true;
  });
  const weakNames = detailedWeak.map(w => w.topicName || w.topic).filter(Boolean);
  const legacyWeak = (memory?.weakTopics || []).filter(w => !weakNames.map(n => n.toLowerCase()).includes(String(w).toLowerCase()));
  const allWeak = [...weakNames, ...legacyWeak];
  const qLower = (question || "").toLowerCase();
  const relevantWeak = allWeak.filter(w => {
    if (!qLower) return false;
    return qLower.includes(w.toLowerCase()) || (currentLesson?.title || "").toLowerCase().includes(w.toLowerCase()) || (topic?.title || "").toLowerCase().includes(w.toLowerCase());
  }).slice(0, 3);
  // Always surface the top path-relevant weakness even without a keyword match (compact: max 1 extra)
  const topWeak = detailedWeak
    .slice()
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - ({ high: 0, medium: 1, low: 2 }[b.severity] || 2)))
    .slice(0, 2)
    .map(w => ({ name: w.topicName || w.topic, severity: w.severity || "low", reason: (w.reason || "").slice(0, 120) }))
    .filter(w => w.name && !relevantWeak.map(r => r.toLowerCase()).includes(w.name.toLowerCase()))
    .slice(0, 1);
  const weakWithSeverity = relevantWeak.map(name => {
    const d = detailedWeak.find(w => (w.topicName || w.topic || "").toLowerCase() === String(name).toLowerCase());
    return d ? { name, severity: d.severity || "low", reason: (d.reason || "").slice(0, 120) } : { name, severity: "low" };
  });
  const weakForPrompt = [...weakWithSeverity, ...topWeak].slice(0, 3);

  // Strong topics — path-filtered, top by success evidence
  const strongForPath = (memory?.strongTopics || [])
    .filter(s => !activePathId || !s.learningPath || s.learningPath.toString() === activePathId)
    .slice()
    .sort((a, b) => (b.successCount || 0) - (a.successCount || 0))
    .slice(0, 3)
    .map(s => s.topicName || s.topic)
    .filter(Boolean);

  // Assessment result for the ACTIVE path only (assessments are per-path)
  const activeAssessment = (memory?.learningAssessments || []).find(a =>
    activePathId && a.learningPath && a.learningPath.toString() === activePathId && a.completed
  ) || null;

  // Topics flagged for review (resolve titles, cap 3, path-relevant first)
  let reviewTitles = [];
  try {
    const reviewIds = (memory?.topicsNeedingReview || []).slice(0, 5);
    if (reviewIds.length) {
      const docs = await Topic.find({ _id: { $in: reviewIds } }).select("title stage").lean().catch(() => []);
      reviewTitles = docs.map(d => d.title).slice(0, 3);
    }
  } catch {}

  // Recent quiz / exercise evidence for the CURRENT topic only
  const curTopicId = topic?._id?.toString() || memory?.currentTopic?.toString() || null;
  let recentQuiz = null;
  let recentExercise = null;
  if (curTopicId) {
    const quizzes = (memory?.quizResults || []).filter(q => q.topicId && q.topicId.toString() === curTopicId);
    const lastQ = quizzes[quizzes.length - 1];
    if (lastQ) recentQuiz = { score: lastQ.score, total: lastQ.total, passed: lastQ.passed };
    const exs = (memory?.exerciseResults || []).filter(e => e.topicId && e.topicId.toString() === curTopicId);
    const lastE = exs[exs.length - 1];
    if (lastE) recentExercise = { passed: lastE.passed, status: lastE.status, attempts: lastE.attempts };
  }

  // Current teaching session state (if any)
  const sessionState = memory?.learningSession?.teachingState || null;

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

  // Adaptation guidance: HOW to teach, derived from evidence (provider-independent text)
  let adaptation = null;
  const struggling = weakForPrompt.some(w => w.severity === "high") || (recentQuiz && recentQuiz.total && (recentQuiz.score / recentQuiz.total) * 100 < 60);
  const strongHere = strongForPath.length > 0 && !struggling;
  if (struggling) {
    adaptation = "Student is struggling here — use simpler language, smaller examples, more hints, and extra understanding checks. Do not skip ahead.";
  } else if (strongHere) {
    adaptation = "Student shows strength in related areas — slightly more challenging examples, less repetition, deeper questions are OK.";
  }

  const context = {
    // safe profile
    studentLevel: profile?.experienceLevel || "beginner",
    preferredTeachingStyle: profile?.preferredTeachingStyle || "step_by_step",
    // current state (AI-First: path, stage, topic, lesson)
    currentTechnology: currentTechnology ? { name: currentTechnology.name || currentTechnology.slug, type: currentTechnology.type } : null,
    learningPath: currentPath ? { title: currentPath.title, technologies: (currentPath.technologies||[]).map(t=>t.name||t.slug||t), category: currentPath.category } : null,
    currentStage: currentStage ? { title: currentStage.title, level: currentStage.level } : null,
    currentTopic: topic ? { title: topic.title, slug: topic.slug } : null,
    currentLesson: currentLesson ? { title: currentLesson.title, objective: currentLesson.objective, prerequisites: currentLesson.prerequisites, estimatedMinutes: currentLesson.estimatedMinutes, type: currentLesson.type } : null,
    completed: completedTitles,
    weakTopics: relevantWeak,
    weakTopicsDetailed: weakForPrompt,
    strongTopics: strongForPath,
    topicsNeedingReview: reviewTitles,
    assessment: activeAssessment ? { level: activeAssessment.overallLevel, strengths: (activeAssessment.strengths || []).slice(0, 3) } : null,
    recentQuiz,
    recentExercise,
    sessionState,
    adaptation,
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
  if (context.currentTechnology) parts.push(`Current Technology: ${context.currentTechnology.name} (${context.currentTechnology.type})`);
  if (context.learningPath) parts.push(`Learning Path: ${context.learningPath.title} (${(context.learningPath.technologies||[]).join(", ")})`);
  if (context.currentStage) parts.push(`Current Stage: ${context.currentStage.title} (${context.currentStage.level})`);
  if (context.currentTopic) parts.push(`Current Topic: ${context.currentTopic.title}`);
  if (context.currentLesson) parts.push(`Current Lesson: ${context.currentLesson.title} — Objective: ${context.currentLesson.objective || "learn concept"}`);
  if (context.completed?.length) parts.push(`Completed: ${context.completed.join(", ")}`);
  if (context.weakTopicsDetailed?.length) parts.push(`Struggled with: ${context.weakTopicsDetailed.map(w => `${w.name} (${w.severity}${w.reason ? `: ${w.reason}` : ""})`).join("; ")}`);
  else if (context.weakTopics?.length) parts.push(`Previously struggled with: ${context.weakTopics.join(", ")} (adapt explanation)`);
  if (context.strongTopics?.length) parts.push(`Strong in: ${context.strongTopics.join(", ")}`);
  if (context.topicsNeedingReview?.length) parts.push(`Needs review: ${context.topicsNeedingReview.join(", ")}`);
  if (context.assessment) parts.push(`Initial assessment: ${context.assessment.level}${context.assessment.strengths?.length ? ` (comfortable with: ${context.assessment.strengths.join(", ")})` : ""} — starting estimate only, still follow the roadmap`);
  if (context.recentQuiz) parts.push(`Recent quiz on this topic: ${context.recentQuiz.score}/${context.recentQuiz.total}${context.recentQuiz.passed ? " (passed)" : ""}`);
  if (context.recentExercise) parts.push(`Recent exercise: ${context.recentExercise.status}${context.recentExercise.passed ? " (passed)" : ""}`);
  if (context.sessionState) parts.push(`Teaching session state: ${context.sessionState}`);
  if (context.adaptation) parts.push(`Teaching adaptation: ${context.adaptation}`);
  if (context.currentProject) parts.push(`Current Project: ${context.currentProject.name} (${context.currentProject.fileCount} files)`);
  if (context.conversationSummary) parts.push(`Conversation summary: ${context.conversationSummary}`);
  return parts.join("\n");
}

module.exports = { buildLearningContext, contextToPrompt };
