const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");
const Technology = require("../models/Technology");
const { Lesson } = require("../models/Course");

/**
 * Build ordered roadmap for a LearningPath.
 * Reuses existing LearningPath → Stage → Topic → Lesson hierarchy.
 * Does NOT duplicate curriculum, does NOT include large lesson content.
 */
async function buildLearningRoadmap(pathId) {
  if (!pathId) {
    const err = new Error("pathId required");
    err.status = 400;
    throw err;
  }

  const path = await LearningPath.findById(pathId)
    .populate("technologies", "name slug type")
    .populate("prerequisites", "title slug")
    .lean();

  if (!path) {
    const err = new Error("LearningPath not found");
    err.status = 404;
    throw err;
  }
  if (path.status && path.status !== "published" && path.active === false) {
    const err = new Error("LearningPath is not active");
    err.status = 404;
    throw err;
  }

  const stages = await Stage.find({ learningPath: path._id, status: "published" })
    .sort({ order: 1 })
    .populate("prerequisites", "title slug")
    .lean();

  // For each stage, load ordered topics
  const stagesWithTopics = [];
  for (const stage of stages) {
    const topics = await Topic.find({ stage: stage._id, status: "published" })
      .sort({ order: 1 })
      .populate("technologies", "name slug type")
      .lean();

    const topicsCompact = topics.map((t) => ({
      id: t._id,
      title: t.title,
      slug: t.slug,
      description: t.description || "",
      order: t.order,
      estimatedMinutes: t.estimatedMinutes || null,
      level: stage.level || path.level || "beginner",
      technologies: (t.technologies || []).map((tech) => ({
        id: tech._id,
        name: tech.name,
        slug: tech.slug,
        type: tech.type,
      })),
      // Topic has no prerequisites field in current schema — expose empty for future compat
      prerequisites: [],
      stage: { id: stage._id, title: stage.title, slug: stage.slug },
    }));

    stagesWithTopics.push({
      id: stage._id,
      title: stage.title,
      slug: stage.slug,
      description: stage.description || "",
      level: stage.level,
      order: stage.order,
      estimatedMinutes: stage.estimatedMinutes || null,
      prerequisites: (stage.prerequisites || []).map((p) => ({
        id: p._id,
        title: p.title,
        slug: p.slug,
      })),
      topics: topicsCompact,
    });
  }

  // Flat ordered topic list for deterministic sequencing
  const flatTopics = [];
  for (const s of stagesWithTopics) {
    for (const t of s.topics) {
      flatTopics.push({ ...t, stageId: s.id, stageTitle: s.title, stageOrder: s.order });
    }
  }

  // Sort flat by stage order then topic order (already ordered, but ensure)
  flatTopics.sort((a, b) => a.stageOrder - b.stageOrder || a.order - b.order);

  return {
    path: {
      id: path._id,
      slug: path.slug,
      title: path.title,
      name: path.title,
      description: path.description || "",
      difficulty: path.difficulty || path.level || "beginner",
      level: path.level || "beginner",
      category: path.category || null,
      pathType: path.pathType || null,
      estimatedDuration: path.estimatedDuration || "",
      technologies: (path.technologies || []).map((tech) => ({
        id: tech._id,
        name: tech.name,
        slug: tech.slug,
        type: tech.type,
      })),
      prerequisites: (path.prerequisites || []).map((p) => ({
        id: p._id,
        title: p.title,
        slug: p.slug,
      })),
    },
    stages: stagesWithTopics,
    flatTopics,
    meta: {
      totalStages: stagesWithTopics.length,
      totalTopics: flatTopics.length,
      // keep provider-independent
    },
  };
}

/**
 * Compact AI context for a path + current topic.
 * Returns only relevant slice: current, prerequisites, upcoming.
 */
async function getLearningContext(pathId, currentTopicId) {
  const roadmap = await buildLearningRoadmap(pathId);

  let current = null;
  let currentIndex = -1;
  if (currentTopicId) {
    currentIndex = roadmap.flatTopics.findIndex((t) => t.id.toString() === currentTopicId.toString());
    if (currentIndex !== -1) current = roadmap.flatTopics[currentIndex];
  }

  // If no currentTopicId, default to first topic
  if (!current && roadmap.flatTopics.length > 0) {
    current = roadmap.flatTopics[0];
    currentIndex = 0;
  }

  const previousTopics = currentIndex > 0 ? roadmap.flatTopics.slice(Math.max(0, currentIndex - 3), currentIndex) : [];
  const upcomingTopics = currentIndex !== -1 ? roadmap.flatTopics.slice(currentIndex + 1, currentIndex + 4) : roadmap.flatTopics.slice(0, 3);
  const nextTopic = currentIndex !== -1 && currentIndex + 1 < roadmap.flatTopics.length ? roadmap.flatTopics[currentIndex + 1] : null;
  const isLast = currentIndex !== -1 && currentIndex === roadmap.flatTopics.length - 1;

  // Prerequisites for current: stage prerequisites + previous topics in same stage
  let prerequisites = [];
  if (current) {
    const stage = roadmap.stages.find((s) => s.id.toString() === current.stageId.toString());
    if (stage?.prerequisites?.length) prerequisites = stage.prerequisites;
    // also add previous topic in same stage as implicit prerequisite
    const prevInStage = roadmap.flatTopics.filter((t) => t.stageId.toString() === current.stageId.toString() && t.order < current.order);
    if (prevInStage.length) {
      const lastPrev = prevInStage[prevInStage.length - 1];
      if (!prerequisites.find((p) => p.id.toString() === lastPrev.id.toString())) {
        prerequisites = [...prerequisites, { id: lastPrev.id, title: lastPrev.title, slug: lastPrev.slug }];
      }
    }
  }

  return {
    path: roadmap.path,
    current: current
      ? {
          id: current.id,
          title: current.title,
          description: current.description,
          stage: { id: current.stageId, title: current.stageTitle },
          order: current.order,
          prerequisites,
        }
      : null,
    previousTopics: previousTopics.map((t) => ({ id: t.id, title: t.title, stageTitle: t.stageTitle })),
    nextTopic: nextTopic ? { id: nextTopic.id, title: nextTopic.title, stageTitle: nextTopic.stageTitle } : null,
    upcomingTopics: upcomingTopics.map((t) => ({ id: t.id, title: t.title, stageTitle: t.stageTitle })),
    isLast,
    pathCompleted: isLast && !nextTopic && roadmap.flatTopics.length > 0 ? false : false, // will be true when current is last and asked for next
  };
}

/**
 * Deterministic next topic.
 * If current is last topic of stage, returns first topic of next stage.
 * If current is last topic of path, returns { path_completed: true }.
 */
async function getNextTopic(pathId, currentTopicId) {
  const roadmap = await buildLearningRoadmap(pathId);
  if (roadmap.flatTopics.length === 0) {
    return { path_completed: true, reason: "No topics in path" };
  }
  if (!currentTopicId) {
    return { next: roadmap.flatTopics[0], path_completed: false };
  }
  const idx = roadmap.flatTopics.findIndex((t) => t.id.toString() === currentTopicId.toString());
  if (idx === -1) {
    const err = new Error("Topic not found in this path");
    err.status = 404;
    throw err;
  }
  if (idx + 1 >= roadmap.flatTopics.length) {
    return { path_completed: true, current: roadmap.flatTopics[idx] };
  }
  return { next: roadmap.flatTopics[idx + 1], path_completed: false };
}

async function getPreviousTopic(pathId, currentTopicId) {
  const roadmap = await buildLearningRoadmap(pathId);
  if (!currentTopicId) return { previous: null };
  const idx = roadmap.flatTopics.findIndex((t) => t.id.toString() === currentTopicId.toString());
  if (idx <= 0) return { previous: null };
  return { previous: roadmap.flatTopics[idx - 1] };
}

async function getPosition(pathId, currentTopicId) {
  const roadmap = await buildLearningRoadmap(pathId);
  const idx = currentTopicId ? roadmap.flatTopics.findIndex((t) => t.id.toString() === currentTopicId.toString()) : -1;
  const current = idx !== -1 ? roadmap.flatTopics[idx] : null;
  const previous = idx > 0 ? roadmap.flatTopics[idx - 1] : null;
  const next = idx !== -1 && idx + 1 < roadmap.flatTopics.length ? roadmap.flatTopics[idx + 1] : null;
  const stage = current ? roadmap.stages.find((s) => s.id.toString() === current.stageId.toString()) : null;
  return {
    current,
    previous,
    next,
    stage,
    path: roadmap.path,
    isFirst: idx === 0,
    isLast: idx === roadmap.flatTopics.length - 1,
    path_completed: idx !== -1 && idx === roadmap.flatTopics.length - 1,
    flatIndex: idx,
    totalTopics: roadmap.flatTopics.length,
  };
}

module.exports = {
  buildLearningRoadmap,
  getLearningContext,
  getNextTopic,
  getPreviousTopic,
  getPosition,
};
