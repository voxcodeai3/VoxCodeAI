/**
 * VoxCode Adaptive Memory Service (Step 7).
 *
 * Single place for all meaningful learning-memory updates.
 * MongoDB (LearningMemory) is the source of truth; the AI only recommends.
 * All functions are path-aware: progress in one path never touches another.
 *
 * Severity / priority rules (simple, college-project scale):
 * - severity high:   mistakeCount >= 3 OR lastScore < 40
 * - severity medium: mistakeCount >= 2 OR lastScore < 60
 * - severity low:    everything else
 * Review priority is derived, not stored:
 * - HIGH:   severity high AND observed in the last 7 days
 * - MEDIUM: severity medium, or low score recently
 * - LOW:    older / already reviewed once
 */

const mongoose = require("mongoose");
const LearningMemory = require("../models/LearningMemory");
const Topic = require("../models/Topic");
const { buildLearningRoadmap, getNextTopic } = require("./roadmapService");

const EVENT_TYPES = [
  "assessment_completed",
  "topic_started",
  "topic_completed",
  "check_answered",
  "quiz_completed",
  "exercise_attempted",
  "exercise_completed",
  "repeated_mistake",
  "marked_for_review",
  "topic_reviewed",
  "session_started",
  "session_paused",
  "session_resumed",
];

const MAX_EVENTS = 50;
const MAX_WEAK = 20;
const MAX_STRONG = 30;
const MAX_MISTAKES = 30;
const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isValidId(id) {
  return id && mongoose.Types.ObjectId.isValid(id);
}

function sameId(a, b) {
  if (!a || !b) return false;
  return a.toString() === b.toString();
}

function samePath(entryPath, pathId) {
  if (!pathId) return true; // no filter requested
  if (!entryPath) return false; // unscoped legacy entries don't leak into other paths
  return entryPath.toString() === pathId.toString();
}

function severityFor({ mistakeCount = 0, score = null }) {
  if (mistakeCount >= 3 || (score != null && score < 40)) return "high";
  if (mistakeCount >= 2 || (score != null && score < 60)) return "medium";
  return "low";
}

async function topicTitle(topicId, fallback = "Topic") {
  if (!isValidId(topicId)) return fallback;
  try {
    const t = await Topic.findById(topicId).select("title").lean();
    return t?.title || fallback;
  } catch {
    return fallback;
  }
}

/* ── Events ─────────────────────────────────────────────────────────── */

async function recordEvent(userId, { type, learningPath = null, stage = null, topic = null, detail = "" } = {}) {
  if (!EVENT_TYPES.includes(type)) {
    const e = new Error(`Invalid event type: ${type}`);
    e.status = 400;
    throw e;
  }
  const mem = await LearningMemory.findOrCreate(userId);
  mem.learningEvents.push({
    type,
    learningPath: isValidId(learningPath) ? learningPath : null,
    stage: isValidId(stage) ? stage : null,
    topic: isValidId(topic) ? topic : null,
    detail: String(detail || "").slice(0, 200),
  });
  if (mem.learningEvents.length > MAX_EVENTS) {
    mem.learningEvents = mem.learningEvents.slice(-MAX_EVENTS);
  }
  mem.lastActivity = new Date();
  await mem.save();
  return mem;
}

/* ── Weak topics ────────────────────────────────────────────────────── */

async function recordWeakSignal(userId, { learningPath = null, topicId = null, topicName = "", reason = "", score = null } = {}) {
  const mem = await LearningMemory.findOrCreate(userId);
  const name = (topicName || "").trim().slice(0, 80) || (await topicTitle(topicId, "Topic"));
  const pid = isValidId(learningPath) ? learningPath : null;
  const tid = isValidId(topicId) ? topicId : null;

  let entry = (mem.weakTopicsDetailed || []).find((w) =>
    tid ? w.topicId && sameId(w.topicId, tid) && (!pid || !w.learningPath || sameId(w.learningPath, pid))
         : (w.topicName || w.topic || "").toLowerCase() === name.toLowerCase()
  );
  if (!entry) {
    entry = {
      topicId: tid,
      topicName: name,
      topic: name,
      learningPath: pid,
      reason: String(reason || "").slice(0, 200),
      strength: "weak",
      severity: "low",
      lastScore: score,
      mistakeCount: 1,
      lastObservedAt: new Date(),
      lastReviewedAt: null,
    };
    mem.weakTopicsDetailed.push(entry);
    entry = mem.weakTopicsDetailed[mem.weakTopicsDetailed.length - 1];
  } else {
    entry.mistakeCount = (entry.mistakeCount || 0) + 1;
    if (reason) entry.reason = String(reason).slice(0, 200);
    if (score != null) entry.lastScore = score;
    if (pid && !entry.learningPath) entry.learningPath = pid;
    entry.lastObservedAt = new Date();
  }
  entry.severity = severityFor({ mistakeCount: entry.mistakeCount, score: entry.lastScore });
  if (mem.weakTopicsDetailed.length > MAX_WEAK) {
    mem.weakTopicsDetailed = mem.weakTopicsDetailed.slice(-MAX_WEAK);
  }

  // topicsNeedingReview (ObjectId list) when we have a real topic id
  if (tid && !mem.topicsNeedingReview.find((id) => sameId(id, tid))) {
    mem.topicsNeedingReview.push(tid);
  }
  // legacy string list stays in sync (global, kept for backward compat)
  if (!mem.weakTopics.includes(name)) mem.weakTopics = [...mem.weakTopics, name].slice(-20);

  mem.lastActivity = new Date();
  await mem.save();
  await recordEvent(userId, { type: "marked_for_review", learningPath: pid, topic: tid, detail: name }).catch(() => {});
  return entry;
}

/* ── Strengths ──────────────────────────────────────────────────────── */

async function recordSuccess(userId, { learningPath = null, topicId = null, topicName = "" } = {}) {
  const mem = await LearningMemory.findOrCreate(userId);
  const name = (topicName || "").trim().slice(0, 80) || (await topicTitle(topicId, "Topic"));
  const pid = isValidId(learningPath) ? learningPath : null;
  const tid = isValidId(topicId) ? topicId : null;

  let strong = (mem.strongTopics || []).find((s) =>
    tid ? s.topicId && sameId(s.topicId, tid) && (!pid || !s.learningPath || sameId(s.learningPath, pid))
         : (s.topicName || s.topic || "").toLowerCase() === name.toLowerCase()
  );
  if (!strong) {
    strong = {
      topicId: tid,
      topicName: name,
      topic: name,
      learningPath: pid,
      confidence: "low",
      successCount: 1,
      lastObservedAt: new Date(),
    };
    mem.strongTopics.push(strong);
    strong = mem.strongTopics[mem.strongTopics.length - 1];
  } else {
    strong.successCount = (strong.successCount || 0) + 1;
    strong.lastObservedAt = new Date();
    if (pid && !strong.learningPath) strong.learningPath = pid;
  }
  // Repeated successful evidence raises confidence; one success is NOT mastery.
  strong.confidence = strong.successCount >= 3 ? "high" : strong.successCount >= 2 ? "medium" : "low";
  if (mem.strongTopics.length > MAX_STRONG) mem.strongTopics = mem.strongTopics.slice(-MAX_STRONG);

  // Reduce review priority for the matching weak record.
  const weak = (mem.weakTopicsDetailed || []).find((w) =>
    tid ? w.topicId && sameId(w.topicId, tid) : (w.topicName || w.topic || "").toLowerCase() === name.toLowerCase()
  );
  if (weak) {
    weak.lastReviewedAt = new Date();
    if (strong.successCount >= 2) {
      weak.severity = "low";
      if (tid) mem.topicsNeedingReview = (mem.topicsNeedingReview || []).filter((id) => !sameId(id, tid));
      mem.weakTopics = (mem.weakTopics || []).filter((t) => t.toLowerCase() !== name.toLowerCase());
    }
  } else if (strong.successCount >= 2 && tid) {
    mem.topicsNeedingReview = (mem.topicsNeedingReview || []).filter((id) => !sameId(id, tid));
  }

  mem.lastActivity = new Date();
  await mem.save();
  return strong;
}

/* ── Repeated mistakes ──────────────────────────────────────────────── */

async function recordMistake(userId, { concept, topicId = null, topicName = "", learningPath = null } = {}) {
  const clean = (concept || "").trim().slice(0, 80);
  if (!clean) {
    const e = new Error("concept required");
    e.status = 400;
    throw e;
  }
  const mem = await LearningMemory.findOrCreate(userId);
  const pid = isValidId(learningPath) ? learningPath : null;
  const tid = isValidId(topicId) ? topicId : null;
  const tName = (topicName || "").trim().slice(0, 80);

  let m = (mem.repeatedMistakes || []).find(
    (x) => x.concept.toLowerCase() === clean.toLowerCase() && (!pid || !x.learningPath || sameId(x.learningPath, pid))
  );
  if (!m) {
    m = { concept: clean, topicId: tid, topicName: tName, learningPath: pid, mistakeCount: 1, lastObservedAt: new Date() };
    mem.repeatedMistakes.push(m);
    m = mem.repeatedMistakes[mem.repeatedMistakes.length - 1];
  } else {
    m.mistakeCount = (m.mistakeCount || 0) + 1;
    m.lastObservedAt = new Date();
    if (tid && !m.topicId) m.topicId = tid;
  }
  if (mem.repeatedMistakes.length > MAX_MISTAKES) mem.repeatedMistakes = mem.repeatedMistakes.slice(-MAX_MISTAKES);
  await mem.save();
  await recordEvent(userId, { type: "repeated_mistake", learningPath: pid, topic: tid, detail: clean }).catch(() => {});

  // A repeated mistake is also a weak signal for its topic.
  if (tid || tName) {
    await recordWeakSignal(userId, {
      learningPath: pid,
      topicId: tid,
      topicName: tName || clean,
      reason: `Repeated mistake: ${clean}`,
    });
  }
  return m;
}

/* ── Quiz / exercise outcomes (called by existing controllers) ──────── */

async function applyQuizOutcome(userId, quiz, { percentage, passed }) {
  const topicName = await topicTitle(quiz.topic, "Topic");
  if (passed) {
    await recordSuccess(userId, { learningPath: quiz.learningPath, topicId: quiz.topic, topicName });
  } else {
    await recordWeakSignal(userId, {
      learningPath: quiz.learningPath,
      topicId: quiz.topic,
      topicName,
      reason: `Quiz ${percentage}% on ${topicName}`,
      score: percentage,
    });
  }
  await recordEvent(userId, {
    type: "quiz_completed",
    learningPath: quiz.learningPath,
    stage: quiz.stage,
    topic: quiz.topic,
    detail: `${percentage}%`,
  }).catch(() => {});
}

async function applyExerciseOutcome(userId, { exercise, passed, error = "" }) {
  const topicName = exercise.topicTitle || (await topicTitle(exercise.topicId, "Topic"));
  if (passed) {
    await recordSuccess(userId, { learningPath: exercise.pathId, topicId: exercise.topicId, topicName });
  } else if (error) {
    await recordWeakSignal(userId, {
      learningPath: exercise.pathId,
      topicId: exercise.topicId,
      topicName,
      reason: `Practice struggle on ${topicName}: ${String(error).slice(0, 120)}`,
    });
  }
  await recordEvent(userId, {
    type: passed ? "exercise_completed" : "exercise_attempted",
    learningPath: exercise.pathId,
    stage: exercise.stageId,
    topic: exercise.topicId,
    detail: topicName,
  }).catch(() => {});
}

/* ── Review list (derived priority, path-filtered) ──────────────────── */

function priorityFor(entry) {
  const recent = entry.lastObservedAt && Date.now() - new Date(entry.lastObservedAt).getTime() < REVIEW_WINDOW_MS;
  if (entry.severity === "high" && recent) return "HIGH";
  if (entry.severity === "high" || entry.severity === "medium") return recent ? "MEDIUM" : "LOW";
  if (entry.lastReviewedAt) return "LOW";
  return recent ? "MEDIUM" : "LOW";
}

async function getReviewList(userId, pathId = null) {
  const mem = await LearningMemory.findOne({ user: userId }).lean();
  if (!mem) return [];
  const pid = isValidId(pathId) ? pathId.toString() : null;
  const items = [];
  for (const w of mem.weakTopicsDetailed || []) {
    if (pid && !samePath(w.learningPath, pid)) continue;
    const title = w.topicName || w.topic || (await topicTitle(w.topicId));
    items.push({
      topicId: w.topicId,
      topicName: title,
      reason: w.reason || "",
      severity: w.severity || "low",
      lastScore: w.lastScore ?? null,
      mistakeCount: w.mistakeCount || 0,
      priority: priorityFor(w),
      lastObservedAt: w.lastObservedAt,
      source: "weak_topic",
    });
  }
  // Topics flagged for review but without a weak record yet
  for (const tid of mem.topicsNeedingReview || []) {
    if (items.find((i) => i.topicId && sameId(i.topicId, tid))) continue;
    // topicsNeedingReview is global; only include when no path filter or when the id belongs to this path's roadmap
    if (pid) {
      try {
        const roadmap = await buildLearningRoadmap(pid);
        if (!roadmap.flatTopics.find((t) => sameId(t.id, tid))) continue;
      } catch {
        continue;
      }
    }
    items.push({
      topicId: tid,
      topicName: await topicTitle(tid),
      reason: "Flagged for review",
      severity: "low",
      lastScore: null,
      mistakeCount: 0,
      priority: "LOW",
      lastObservedAt: null,
      source: "review_flag",
    });
  }
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  items.sort((a, b) => order[a.priority] - order[b.priority]);
  return items.slice(0, 10);
}

async function markReviewed(userId, topicId, pathId = null) {
  if (!isValidId(topicId)) {
    const e = new Error("Invalid topicId");
    e.status = 400;
    throw e;
  }
  const mem = await LearningMemory.findOrCreate(userId);
  const pid = isValidId(pathId) ? pathId : null;
  const weak = (mem.weakTopicsDetailed || []).find((w) => w.topicId && sameId(w.topicId, topicId) && (!pid || !w.learningPath || sameId(w.learningPath, pid)));
  if (weak) {
    weak.lastReviewedAt = new Date();
    weak.severity = "low";
  }
  await mem.save();
  await recordEvent(userId, { type: "topic_reviewed", learningPath: pid, topic: topicId, detail: weak?.topicName || "" }).catch(() => {});
  return weak || null;
}

/* ── Backend-controlled progression ─────────────────────────────────── */

async function checkProgression(userId, pathId, topicId) {
  if (!isValidId(pathId)) {
    const e = new Error("pathId required");
    e.status = 400;
    throw e;
  }
  if (!isValidId(topicId)) {
    const e = new Error("topicId required");
    e.status = 400;
    throw e;
  }
  const roadmap = await buildLearningRoadmap(pathId);
  const inPath = roadmap.flatTopics.find((t) => sameId(t.id, topicId));
  if (!inPath) {
    const e = new Error("Topic does not belong to path");
    e.status = 400;
    throw e;
  }
  const mem = await LearningMemory.findOne({ user: userId }).lean();
  const reasons = [];
  const tName = inPath.title;

  // 1. Already completed → READY
  if ((mem?.completedTopics || []).find((id) => sameId(id, topicId))) {
    const nxt = await getNextTopic(pathId, topicId).catch(() => null);
    return { decision: "READY", reasons: [`${tName} is already completed.`], topicId, nextTopic: nxt?.path_completed ? null : nxt?.next || null, pathCompleted: !!nxt?.path_completed };
  }

  // Evidence scoped to THIS path + topic
  const pid = pathId.toString();
  const topicQuizzes = (mem?.quizResults || [])
    .filter((q) => q.topicId && sameId(q.topicId, topicId) && samePath(q.learningPath, pid))
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const lastQuiz = topicQuizzes[topicQuizzes.length - 1] || null;
  const lastPct = lastQuiz && lastQuiz.total ? Math.round((lastQuiz.score / lastQuiz.total) * 100) : null;
  const exerciseDone = (mem?.completedExercises || []).find(
    (e) => (e.topicId && sameId(e.topicId, topicId)) || (e.exerciseId && mem?.exerciseResults?.find((r) => r.exerciseId === e.exerciseId && r.topicId && sameId(r.topicId, topicId)))
  );
  const weak = (mem?.weakTopicsDetailed || []).find(
    (w) => w.topicId && sameId(w.topicId, topicId) && (!w.learningPath || sameId(w.learningPath, pid))
  );
  const flaggedForReview = (mem?.topicsNeedingReview || []).find((id) => sameId(id, topicId));
  const unresolvedWeak = !!flaggedForReview || (weak && (weak.severity === "high" || weak.severity === "medium"));
  const sess = mem?.learningSession && mem.learningSession.topic && sameId(mem.learningSession.topic, topicId) ? mem.learningSession : null;
  const checks = sess?.checksPassed || 0;
  const interactions = sess?.interactionCount || 0;

  // 2. Flagged for review, strong weak signal, or poor quiz → REVIEW
  if (flaggedForReview || (weak && weak.severity === "high") || (lastPct != null && lastPct < 60)) {
    if (flaggedForReview) reasons.push(`${tName} is marked for review — let's go over it together.`);
    if (weak?.severity === "high") reasons.push(`${tName} has repeated mistakes — let's review it.`);
    if (lastPct != null && lastPct < 60) reasons.push(`Last quiz was ${lastPct}% — below the 60% bar.`);
    return { decision: "REVIEW", reasons, topicId, weakTopic: weak ? { topicName: weak.topicName || weak.topic, severity: weak.severity } : null };
  }
  // 3. Borderline quiz → REVIEW with follow-up
  if (lastPct != null && lastPct < 80) {
    reasons.push(`Last quiz was ${lastPct}% — mostly understood, one more review.`);
    return { decision: "REVIEW", reasons, topicId };
  }
  // 4. Solid quiz → practice or ready
  if (lastPct != null && lastPct >= 80) {
    if (exerciseDone) {
      const nxt = await getNextTopic(pathId, topicId).catch(() => null);
      reasons.push(`Quiz ${lastPct}% and practice completed — ready to move on.`);
      return { decision: "READY", reasons, topicId, nextTopic: nxt?.path_completed ? null : nxt?.next || null, pathCompleted: !!nxt?.path_completed };
    }
    reasons.push(`Quiz ${lastPct}% looks good — try the coding exercise next.`);
    return { decision: "PRACTICE", reasons, topicId };
  }
  // 5. Practice done + teaching interaction → READY
  if (exerciseDone && interactions >= 1 && !unresolvedWeak) {
    const nxt = await getNextTopic(pathId, topicId).catch(() => null);
    reasons.push("Practice completed with no weak signals — ready to move on.");
    return { decision: "READY", reasons, topicId, nextTopic: nxt?.path_completed ? null : nxt?.next || null, pathCompleted: !!nxt?.path_completed };
  }
  // 5b. Practice done and nothing unresolved → READY (exercise is strong evidence)
  if (exerciseDone && !unresolvedWeak) {
    const nxt = await getNextTopic(pathId, topicId).catch(() => null);
    reasons.push("Practice completed with no outstanding weak signals — ready to move on.");
    return { decision: "READY", reasons, topicId, nextTopic: nxt?.path_completed ? null : nxt?.next || null, pathCompleted: !!nxt?.path_completed };
  }
  // 6. Teaching evidence → PRACTICE
  if (checks >= 2) {
    reasons.push("Understanding checks look good — time for hands-on practice.");
    return { decision: "PRACTICE", reasons, topicId };
  }
  // 7. Otherwise another check first
  reasons.push("Let's do one more quick check before moving on.");
  return { decision: "RETRY_CHECK", reasons, topicId };
}

/* ── Authoritative completion ───────────────────────────────────────── */

async function completeTopicForUser(userId, pathId, topicId) {
  if (!isValidId(pathId) || !isValidId(topicId)) {
    const e = new Error("pathId and topicId required");
    e.status = 400;
    throw e;
  }
  const roadmap = await buildLearningRoadmap(pathId);
  const inPath = roadmap.flatTopics.find((t) => sameId(t.id, topicId));
  if (!inPath) {
    const e = new Error("Topic does not belong to path");
    e.status = 400;
    throw e;
  }
  const mem = await LearningMemory.findOrCreate(userId);
  if (!mem.completedTopics.find((id) => sameId(id, topicId))) {
    mem.completedTopics.push(topicId);
  }
  // Advance current position to the next roadmap topic (backend-controlled)
  const nxt = await getNextTopic(pathId, topicId).catch(() => null);
  if (nxt && !nxt.path_completed && nxt.next) {
    mem.currentTopic = nxt.next.id;
    const TopicModel = require("../models/Topic");
    const StageModel = require("../models/Stage");
    try {
      const nt = await TopicModel.findById(nxt.next.id).lean();
      if (nt?.stage) {
        mem.currentStage = nt.stage;
        const st = await StageModel.findById(nt.stage).lean();
        if (st?.learningPath) mem.activeLearningPath = st.learningPath;
      }
    } catch {}
  }
  mem.lastActivity = new Date();
  mem.lastOpenedAt = new Date();
  await mem.save();
  await recordEvent(userId, { type: "topic_completed", learningPath: pathId, topic: topicId, detail: inPath.title }).catch(() => {});
  return { completedTopic: { id: inPath.id, title: inPath.title }, nextTopic: nxt?.path_completed ? null : nxt?.next || null, pathCompleted: !!nxt?.path_completed };
}

/* ── Progress summary (roadmap-authoritative) ───────────────────────── */

async function getProgressSummary(userId, pathId) {
  if (!isValidId(pathId)) {
    const e = new Error("pathId required");
    e.status = 400;
    throw e;
  }
  const roadmap = await buildLearningRoadmap(pathId);
  const mem = await LearningMemory.findOne({ user: userId }).lean();
  const completedIds = (mem?.completedTopics || []).map((id) => id.toString());
  const completedInPath = roadmap.flatTopics.filter((t) => completedIds.includes(t.id.toString()));
  const total = roadmap.flatTopics.length;
  const done = completedInPath.length;
  return {
    path: { id: roadmap.path.id, title: roadmap.path.title },
    completed: done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    currentTopic: mem?.currentTopic || null,
    reviewCount: (await getReviewList(userId, pathId)).length,
  };
}

module.exports = {
  EVENT_TYPES,
  recordEvent,
  recordWeakSignal,
  recordSuccess,
  recordMistake,
  applyQuizOutcome,
  applyExerciseOutcome,
  getReviewList,
  markReviewed,
  checkProgression,
  completeTopicForUser,
  getProgressSummary,
};
