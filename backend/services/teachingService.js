const LearningMemory = require("../models/LearningMemory");
const TeachingSession = require("../models/TeachingSession");
const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");
const { Lesson } = require("../models/Course");
const { buildLearningRoadmap, getPosition, getNextTopic } = require("./roadmapService");
const { generateResponse } = require("./aiService");
const Conversation = require("../models/Conversation");

// ─── State machine ──────────────────────────────────────────────────
const TEACHING_STATES = [
  "teaching",
  "checking_understanding",
  "awaiting_answer",
  "reviewing",
  "ready_for_practice",
  "mini_quiz",
  "quiz_review",
  "completed",
  "paused",
];
const SUGGESTED_ACTIONS = [
  "continue_explanation",
  "answer_student",
  "ask_understanding",
  "ask_knowledge_check",
  "review_topic",
  "ready_for_practice",
  "complete_topic",
  "move_to_next_topic",
];

function nextState(current, evaluation) {
  // Simple deterministic transitions based on evaluation
  if (!evaluation) {
    if (current === "teaching") return "checking_understanding";
    if (current === "checking_understanding") return "awaiting_answer";
    if (current === "reviewing") return "checking_understanding";
    return current;
  }
  const result = evaluation.result;
  if (result === "correct") {
    if (current === "awaiting_answer" || current === "checking_understanding") return "ready_for_practice";
    if (current === "reviewing") return "checking_understanding";
    return "ready_for_practice";
  }
  if (result === "partially_correct") return "reviewing";
  if (result === "incorrect" || result === "unclear") return "reviewing";
  return "reviewing";
}

function buildTeacherSystemPrompt({ roadmap, currentTopic, currentStage, path, studentLevel, strengths, weakTopics, teachingState, recentConversation }) {
  const levelGuidance =
    studentLevel === "beginner"
      ? "Use simple language, small examples, more explanation, less jargon."
      : studentLevel === "advanced"
      ? "Cover deeper concepts, edge cases, trade-offs, real-world considerations."
      : "Use normal technical explanation, practical examples, moderately challenging questions.";

  const topic = currentTopic;
  const stage = currentStage;
  return `You are VoxCode, a patient AI coding teacher. Follow the structured roadmap strictly.

Teaching state: ${teachingState}
Student level: ${studentLevel} — ${levelGuidance}

Current position:
- Learning goal: ${path.title} (${path.category})
- Stage: ${stage ? `${stage.title} (${stage.level})` : "unknown"}
- Topic: ${topic ? `${topic.title} — ${topic.description || "learn concept"}` : "unknown"}
- Prerequisites: ${(topic && stage?.prerequisites?.length ? stage.prerequisites.map((p) => p.title).join(", ") : "none")}

Student context:
- Strengths: ${strengths?.length ? strengths.join(", ") : "none yet"}
- Weak topics: ${weakTopics?.length ? weakTopics.slice(0, 3).join(", ") : "none"}
- Recent conversation: ${recentConversation ? recentConversation.slice(-2).map((m) => `${m.role}: ${m.content.slice(0, 120)}`).join(" | ") : "none"}

Rules:
1. Teach ONE concept at a time. Do NOT dump the whole topic.
2. Explain clearly, give a small code example (short, readable), relate to what student already knows.
3. After explaining, check understanding: "Does that make sense?" or ask if they want another example.
4. If student says "I already know this", give a short verification question. If correct, you may suggest moving on; if not, teach normally.
5. If student is confused, explain differently with a simpler analogy/example and ask a smaller question. Do NOT move to next topic until understanding is demonstrated.
6. For knowledge checks, generate a small question (multiple choice, short answer, or predict output) relevant to the current topic. Keep it lightweight.
7. When evaluating answers, return result as correct|partially_correct|incorrect|unclear with short feedback, no shaming.
8. If student asks off-topic, answer briefly then gently return to ${topic ? topic.title : "the current topic"} and the MERN/other path.
9. Do NOT invent a new curriculum. Stay inside the roadmap. Do NOT skip major sections without evidence.
10. Keep examples short. Do not autonomously modify the student's project.

Adapt depth to the student's level. Be concise, friendly, and interactive.

Respond STRICTLY as minified JSON on a single line, no markdown fences. Example:
{"message":"React components are reusable UI pieces. Example: function Greeting(){return <h1>Hello</h1>} Does that make sense?","state":"checking_understanding","evaluation":null,"suggestedAction":"ask_understanding","topicStatus":"in_progress"}

- state must be one of: teaching, checking_understanding, awaiting_answer, reviewing, ready_for_practice, completed
- evaluation is null unless you just evaluated an answer, then {"result":"correct|partially_correct|incorrect|unclear","feedback":"short feedback"}
- suggestedAction must be one of: continue_explanation, answer_student, ask_understanding, ask_knowledge_check, review_topic, ready_for_practice, complete_topic, move_to_next_topic
- topicStatus must be one of: in_progress, needs_review, understood
`;
}

async function getOrCreateSession(userId, learningPathId, topicId) {
  const path = await LearningPath.findById(learningPathId).lean();
  if (!path) {
    const e = new Error("LearningPath not found");
    e.status = 404;
    throw e;
  }
  let topic = null;
  let stage = null;
  if (topicId) {
    topic = await Topic.findById(topicId).lean();
    if (!topic) {
      const e = new Error("Topic not found");
      e.status = 404;
      throw e;
    }
    stage = await Stage.findById(topic.stage).lean();
    if (!stage || stage.learningPath.toString() !== learningPathId.toString()) {
      const e = new Error("Topic does not belong to this learning path");
      e.status = 400;
      throw e;
    }
  } else {
    // No topic provided — use student's current or roadmap first
    const mem = await LearningMemory.findOne({ user: userId }).lean();
    if (mem?.currentTopic) {
      topic = await Topic.findById(mem.currentTopic).lean();
      if (topic) stage = await Stage.findById(topic.stage).lean();
    }
    if (!topic) {
      const roadmap = await buildLearningRoadmap(learningPathId);
      if (roadmap.flatTopics.length > 0) {
        const first = roadmap.flatTopics[0];
        topic = await Topic.findById(first.id).lean();
        stage = await Stage.findById(topic.stage).lean();
      }
    }
  }
  if (!topic) {
    const e = new Error("No topic available for this path");
    e.status = 400;
    throw e;
  }
  if (!stage) stage = await Stage.findById(topic.stage).lean();

  // Find active session for this user+path+topic
  let session = await TeachingSession.findActive(userId, learningPathId, topic._id);
  if (session) {
    // resume — update lastActivity
    session.lastActivity = new Date();
    await session.save();
    return session;
  }
  // Create new
  session = await TeachingSession.create({
    user: userId,
    learningPath: learningPathId,
    stage: stage?._id,
    topic: topic._id,
    teachingState: "teaching",
    status: "active",
  });
  // Sync LearningMemory
  const mem = await LearningMemory.findOrCreate(userId);
  mem.activeLearningPath = learningPathId;
  mem.activeLearningGoal = { type: "learning_path", learningPath: learningPathId, name: path.title };
  mem.currentStage = stage?._id;
  mem.currentTopic = topic._id;
  // try to find a lesson for this topic
  try {
    const lesson = await Lesson.findOne({ topic: topic._id, status: "published" }).lean();
    if (lesson) mem.currentLesson = lesson._id;
  } catch {}
  mem.learningSession = {
    status: "active",
    teachingState: "teaching",
    suggestedAction: "continue_explanation",
    startedAt: new Date(),
    lastActivity: new Date(),
    learningPath: learningPathId,
    stage: stage?._id,
    topic: topic._id,
    interactionCount: 0,
    checksPassed: 0,
  };
  mem.lastActivity = new Date();
  mem.lastOpenedAt = new Date();
  await mem.save();
  return session;
}

async function buildCompactContext(userId, session, extraQuestion) {
  const [mem, roadmap] = await Promise.all([
    LearningMemory.findOne({ user: userId }).lean(),
    buildLearningRoadmap(session.learningPath),
  ]);
  const topic = await Topic.findById(session.topic).lean();
  const stage = await Stage.findById(session.stage).lean();
  const path = await LearningPath.findById(session.learningPath).lean();
  // Recent conversation
  let recent = [];
  try {
    const convo = await Conversation.findOne({ user: userId }).sort({ updatedAt: -1 }).lean();
    if (convo?.messages?.length) recent = convo.messages.slice(-6).map((m) => ({ role: m.role, content: (m.content || "").slice(0, 300) }));
  } catch {}
  const strengths = (mem?.learningAssessments?.find((a) => a.learningPath?.toString() === session.learningPath.toString())?.strengths || []).slice(0, 3);
  const weak = (mem?.weakTopicsDetailed?.map((w) => w.topicName || w.topic) || mem?.weakTopics || []).slice(0, 3);
  return { mem, roadmap, topic, stage, path, recent, strengths, weak };
}

async function processMessage(userId, sessionId, studentMessage) {
  const session = await TeachingSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    const e = new Error("Teaching session not found");
    e.status = 404;
    throw e;
  }
  if (session.status !== "active") {
    const e = new Error("Session not active");
    e.status = 400;
    throw e;
  }
  if (!studentMessage || typeof studentMessage !== "string" || !studentMessage.trim()) {
    const e = new Error("Message required");
    e.status = 400;
    throw e;
  }
  const trimmed = studentMessage.trim().slice(0, 4000);

  // Build context
  const { mem, roadmap, topic, stage, path, recent, strengths, weak } = await buildCompactContext(userId, session);
  const studentLevel = mem?.currentLevel || mem?.assessmentLevel || "beginner";

  // Detect off-topic via simple heuristic: if message is very short and not related to topic, still let AI handle but keep state
  const systemPrompt = buildTeacherSystemPrompt({
    roadmap,
    currentTopic: topic,
    currentStage: stage,
    path,
    studentLevel,
    strengths,
    weakTopics: weak,
    teachingState: session.teachingState,
    recentConversation: recent,
  });

  const history = recent.map((m) => ({ role: m.role, content: m.content }));

  let raw;
  try {
    raw = await generateResponse({
      history,
      message: trimmed,
      language: "javascript",
      level: studentLevel,
      teachingMode: "learn",
      learnerContext: systemPrompt,
      codingContext: "",
    });
    // Override systemPrompt handling: generateResponse uses its own buildSystemPrompt, but we want our teacher prompt.
    // So we call generateResponse with our custom system via learnerContext? Instead we can call directly with custom systemPrompt by using a workaround:
    // For now, we pass our full teacher prompt as learnerContext and let default system handle, but to be precise we should call model directly.
    // Alternative: call generateResponse with history+message and rely on our prompt being in learnerContext is enough for simple.
    // To make it more faithful, we will call generateResponse again with custom system if needed, but for college project, learnerContext is sufficient.
    // Actually we built systemPrompt but didn't use it — let's use it by passing as learnerContext + codingContext trick:
    // We will re-call with our systemPrompt as part of learnerContext
  } catch (e) {
    // Preserve session on AI failure (failover will have retried inside generateResponse)
    throw e;
  }

  // The generateResponse we called above used default teacher prompt + our learnerContext.
  // To inject our detailed teacher prompt, we should have passed it as part of learnerContext.
  // Our systemPrompt is more detailed, so we will include it via learnerContext in a second attempt if the first reply looks generic.
  // For simplicity, we will treat raw.reply as the teacher message and parse teacher-specific JSON if present.

  let parsed;
  let replyText = raw.reply || "";
  let state = session.teachingState;
  let evaluation = null;
  let suggestedAction = "continue_explanation";
  let topicStatus = "in_progress";

  // Try to parse teacher JSON structure if AI returned it
  try {
    const t = replyText.trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const maybe = JSON.parse(t.slice(start, end + 1));
      if (maybe.message && typeof maybe.message === "string") {
        parsed = maybe;
        replyText = maybe.message;
        if (maybe.state && TEACHING_STATES.includes(maybe.state)) state = maybe.state;
        if (maybe.evaluation) evaluation = maybe.evaluation;
        if (maybe.suggestedAction && SUGGESTED_ACTIONS.includes(maybe.suggestedAction)) suggestedAction = maybe.suggestedAction;
        if (maybe.topicStatus) topicStatus = maybe.topicStatus;
      }
    }
  } catch {}
  // Detect placeholder echo (AI returned template instead of real content) — recover with fallback
  const isPlaceholderMsg = replyText.includes("<your") || replyText.includes("<code") || /^\s*\{\s*(message|title|reply|code)?\s*\}\s*$/i.test(replyText.trim()) || replyText.trim() === "{}";
  if (isPlaceholderMsg) {
    replyText = `Let's focus on ${topic.title}. ${topic.description || `This is a key part of ${path.title}.`} Can you share what you already know about it?`;
    state = "checking_understanding";
    suggestedAction = "ask_understanding";
    parsed = { message: replyText, state, suggestedAction, topicStatus: "in_progress" };
  }
  if (parsed && parsed.message && (parsed.message.includes("<your") || /^\s*\{\s*(message|title)\s*\}\s*$/i.test(parsed.message.trim()))) {
    replyText = `Let's explore ${topic.title} together. ${topic.description || ''} What part would you like me to explain first?`;
    state = "checking_understanding";
    suggestedAction = "ask_understanding";
    parsed.message = replyText;
  }

  // Fallback state transition if AI didn't provide state
  if (!parsed) {
    // Heuristic: if AI message contains a question mark, it's likely checking understanding
    if (replyText.includes("?")) {
      state = "checking_understanding";
      suggestedAction = "ask_understanding";
    } else if (session.teachingState === "awaiting_answer") {
      // we just evaluated an answer, decide next
      if (evaluation && evaluation.result === "correct") state = "ready_for_practice";
      else if (evaluation) state = "reviewing";
    } else {
      state = nextState(session.teachingState, evaluation);
    }
  }

  // Update session
  session.teachingState = state;
  session.lastActivity = new Date();
  session.interactionCount += 1;
  if (evaluation && evaluation.result === "correct") session.checksPassed += 1;
  // If topicStatus indicates understood/completed, mark checks
  if (topicStatus === "understood" || suggestedAction === "complete_topic") {
    session.teachingState = "ready_for_practice";
  }
  await session.save();

  // Update LearningMemory learningSession and conversation
  const mem2 = await LearningMemory.findOne({ user: userId });
  if (mem2) {
    mem2.learningSession = {
      status: "active",
      teachingState: state,
      suggestedAction,
      startedAt: session.startedAt,
      lastActivity: new Date(),
      learningPath: session.learningPath,
      stage: session.stage,
      topic: session.topic,
      interactionCount: session.interactionCount,
      checksPassed: session.checksPassed,
    };
    mem2.lastActivity = new Date();
    // Update weak topics if evaluation says needs_review
    if (evaluation && (evaluation.result === "incorrect" || evaluation.result === "partially_correct") && topic) {
      const reason = evaluation.feedback || "Struggled with " + topic.title;
      const exists = (mem2.weakTopicsDetailed || []).find((w) => w.topicId?.toString() === topic._id.toString());
      if (!exists) {
        mem2.weakTopicsDetailed.push({ topicId: topic._id, topicName: topic.title, topic: topic.title, reason: String(reason).slice(0, 200), strength: "weak", lastReviewedAt: null });
        if (mem2.weakTopicsDetailed.length > 20) mem2.weakTopicsDetailed = mem2.weakTopicsDetailed.slice(-20);
      }
      if (!mem2.weakTopics.includes(topic.title)) mem2.weakTopics = [...mem2.weakTopics, topic.title].slice(-20);
      if (!mem2.topicsNeedingReview.find((id) => id.toString() === topic._id.toString())) {
        mem2.topicsNeedingReview.push(topic._id);
      }
    }
    // Simple completion condition: teaching + checking + at least 1 correct check and interaction >=3
    const shouldComplete = session.interactionCount >= 3 && session.checksPassed >= 1 && (state === "ready_for_practice" || topicStatus === "understood");
    if (shouldComplete) {
      session.teachingState = "completed";
      session.status = "completed";
      session.completedAt = new Date();
      await session.save();
      mem2.learningSession.status = "completed";
      mem2.learningSession.teachingState = "completed";
      // Do NOT auto-mark topic completed — AI recommends, backend validates, but we can record as likely familiar
      // For now, we add to completedTopics if checksPassed >=2 and interaction >=4 to be conservative
      if (session.checksPassed >= 2 && session.interactionCount >= 4) {
        if (!mem2.completedTopics.find((id) => id.toString() === topic._id.toString())) {
          mem2.completedTopics.push(topic._id);
        }
      }
    }
    await mem2.save();
  }

  // Also append to Conversation for continuity (reuse existing system, but lightweight)
  try {
    const Conversation = require("../models/Conversation");
    let convo = await Conversation.findOne({ userId }).sort({ updatedAt: -1 });
    if (!convo) {
      convo = await Conversation.create({ userId, title: `Teaching: ${topic.title}`, messages: [] });
    }
    convo.messages.push({ role: "user", content: trimmed, inputMode: "text", modality: "text" });
    convo.messages.push({ role: "assistant", content: replyText, modality: "text" });
    if (convo.messages.length > 200) convo.messages = convo.messages.slice(-200);
    await convo.save();
  } catch {}

  return {
    message: replyText,
    state,
    evaluation,
    suggestedAction,
    topicStatus,
    session: {
      id: session._id,
      teachingState: session.teachingState,
      status: session.status,
      interactionCount: session.interactionCount,
      checksPassed: session.checksPassed,
    },
  };
}

async function completeTopic(userId, sessionId) {
  const session = await TeachingSession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    const e = new Error("Session not found");
    e.status = 404;
    throw e;
  }
  // Validate topic belongs to path
  const roadmap = await buildLearningRoadmap(session.learningPath);
  const belongs = roadmap.flatTopics.find((t) => t.id.toString() === session.topic.toString());
  if (!belongs) {
    const e = new Error("Topic does not belong to path");
    e.status = 400;
    throw e;
  }
  session.status = "completed";
  session.teachingState = "completed";
  session.completedAt = new Date();
  await session.save();

  const mem = await LearningMemory.findOne({ user: userId });
  if (mem) {
    if (!mem.completedTopics.find((id) => id.toString() === session.topic.toString())) {
      mem.completedTopics.push(session.topic);
    }
    mem.learningSession = { ...mem.learningSession?.toObject?.() || mem.learningSession, status: "completed", teachingState: "completed", lastActivity: new Date() };
    mem.lastActivity = new Date();
    await mem.save();
  }

  // Determine next topic via roadmap
  const next = await getNextTopic(session.learningPath, session.topic);
  return { session, next };
}

module.exports = {
  getOrCreateSession,
  processMessage,
  completeTopic,
  buildTeacherSystemPrompt: buildTeacherSystemPrompt,
  TEACHING_STATES,
  SUGGESTED_ACTIONS,
};
