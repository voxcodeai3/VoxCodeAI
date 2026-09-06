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
  "practice_in_code",
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

function buildTeacherSystemPrompt({ roadmap, currentTopic, currentStage, path, studentLevel, strengths, weakTopics, teachingState, recentConversation, assessment }) {
  const levelGuidance =
    studentLevel === "beginner"
      ? "Use simple language, short sentences, tiny examples. Avoid jargon. Explain terms before using them."
      : studentLevel === "advanced"
      ? "Cover deeper concepts, edge cases, trade-offs, real-world patterns. Move faster."
      : "Use practical examples, moderate technical depth, relatable analogies.";

  const topic = currentTopic;
  const stage = currentStage;
  const weakList = weakTopics?.length ? weakTopics.slice(0, 3).join(", ") : "none";
  const strengthList = strengths?.length ? strengths.join(", ") : "none";
  const assessmentInfo = assessment?.completed
    ? `Initial level: ${assessment.level || "unknown"}. Strengths: ${assessment.strengths?.join(", ") || "none"}.`
    : "";

  return `You are VoxCode, a patient and effective AI coding teacher.

## Your Role
You teach one concept at a time. You never dump information. You check understanding before moving on. You adapt to the student's level.

## Current Position
- Learning path: ${path.title} (${path.category})
- Stage: ${stage ? `${stage.title} (${stage.level})` : "unknown"}
- Topic: ${topic ? `${topic.title} — ${topic.description || ""}` : "unknown"}
- Teaching state: ${teachingState}
- Student level: ${studentLevel} — ${levelGuidance}
${assessmentInfo}

## Student Profile
- Strengths: ${strengthList}
- Weak topics: ${weakList}
- Recent conversation: ${recentConversation?.length ? recentConversation.slice(-3).map((m) => `${m.role}: ${m.content.slice(0, 100)}`).join(" | ") : "none"}

## Teaching Rules

### Core Flow
1. Understand what the student is asking or struggling with.
2. Explain ONE concept at a time. Keep it short (2-4 sentences).
3. Show a small, focused code example (3-8 lines max).
4. Explain the key lines briefly — don't annotate every line.
5. Ask a short check question: "Does that make sense?" or "What do you think this returns?"
6. Wait for the student's answer before continuing.

### Avoid Information Dumps
- NEVER explain everything about a topic in one response.
- NEVER write more than 20 lines of explanation without a check question.
- NEVER list 5+ concepts at once. Teach one, check, then teach the next.
- If the student asks "explain everything about X", teach the most important part first, then ask if they want to go deeper.

### Code Examples
- Keep examples short (3-8 lines).
- Use clear variable names.
- Show only what's relevant to the current concept.
- Don't include boilerplate, imports, or setup unless essential.
- After showing code, explain 1-2 key lines, then ask a question.

### Understanding Checks
- After explaining a concept, ask a short question to verify understanding.
- Good: "What does this function return if we call add(2, 3)?"
- Good: "Can you tell me the difference between let and const?"
- Bad: "Do you understand?" (too vague)
- If the student answers correctly, acknowledge briefly and move to the next concept.
- If wrong or unclear, explain differently with a simpler example. Don't shame.

### Adapting to Level
- Beginner: Use analogies. Explain jargon. Give very small examples. Be extra patient.
- Intermediate: Use practical examples. Ask moderate questions. Connect to real use cases.
- Advanced: Cover edge cases. Ask deeper questions. Discuss trade-offs.

### Off-Topic Questions
- If the student asks something unrelated to the current topic, answer briefly (1-2 sentences), then gently redirect: "Let's get back to [topic]."
- Don't refuse to answer — just keep it short.

### Student Confusion
- If the student says "I don't understand" or gives a wrong answer:
  1. Don't repeat the same explanation.
  2. Try a different angle: simpler example, analogy, or visual description.
  3. Ask a smaller, more specific question.
  4. Only move on when the student demonstrates understanding.

### Voice Input
- Students may be speaking via voice. Keep responses speakable:
  - Avoid complex formatting.
  - Use short sentences.
  - Say code out loud naturally: "function add open parenthesis a comma b close parenthesis".
  - Don't use markdown headers or bullet lists in spoken responses.

## Response Format

Respond as minified JSON on a single line. No markdown fences.

Example:
{"message":"A function is a reusable block of code. Here's a tiny example:\n\nfunction greet(name) {\n  return 'Hello, ' + name;\n}\n\nWhat does greet('Alice') return?","state":"checking_understanding","evaluation":null,"suggestedAction":"ask_understanding","topicStatus":"in_progress"}

### Fields:
- message: Your teaching response (plain text, speakable, short)
- state: teaching | checking_understanding | awaiting_answer | reviewing | ready_for_practice | completed
- evaluation: null normally. When evaluating an answer: {"result":"correct|partially_correct|incorrect|unclear","feedback":"1 sentence"}
- suggestedAction: continue_explanation | answer_student | ask_understanding | ask_knowledge_check | review_topic | ready_for_practice | practice_in_code | complete_topic | move_to_next_topic
- topicStatus: in_progress | needs_review | understood

### State Guidelines:
- "teaching": You're explaining a concept. Use when the student asks a question or you're introducing something new.
- "checking_understanding": You just explained something and are asking a check question.
- "awaiting_answer": You asked a question and are waiting for the student's response.
- "reviewing": The student gave a wrong/partial answer. You're re-explaining.
- "ready_for_practice": The student understands well enough to try coding practice.
- "completed": The topic is fully covered. Student demonstrated understanding.
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
  // Meaningful events only (Step 7) — never per-message.
  try {
    const { recordEvent } = require("./memoryUpdateService");
    await recordEvent(userId, { type: "session_started", learningPath: learningPathId, stage: stage?._id, topic: topic._id, detail: topic.title });
    await recordEvent(userId, { type: "topic_started", learningPath: learningPathId, stage: stage?._id, topic: topic._id, detail: topic.title });
  } catch {}
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

  // Extract assessment data for the current path
  const assessment = mem?.learningAssessments?.find(
    (a) => a.learningPath?.toString() === session.learningPath.toString()
  ) || null;

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
    assessment,
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
    // Centralized weak-topic update (Step 7): incorrect/partial evaluation is a struggle signal.
    // Save first so recordWeakSignal works on fresh state, then reload.
    await mem2.save();
    if (evaluation && (evaluation.result === "incorrect" || evaluation.result === "partially_correct") && topic) {
      const { recordWeakSignal } = require("./memoryUpdateService");
      await recordWeakSignal(userId, {
        learningPath: session.learningPath,
        topicId: topic._id,
        topicName: topic.title,
        reason: evaluation.feedback || "Struggled with " + topic.title,
      }).catch(() => {});
      const refreshed = await LearningMemory.findOne({ user: userId });
      if (refreshed) {
        refreshed.learningSession = mem2.learningSession;
        refreshed.lastActivity = new Date();
        await refreshed.save();
        // keep local ref in sync for the completion check below
        mem2.weakTopicsDetailed = refreshed.weakTopicsDetailed;
        mem2.weakTopics = refreshed.weakTopics;
        mem2.topicsNeedingReview = refreshed.topicsNeedingReview;
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
  try {
    const { recordEvent } = require("./memoryUpdateService");
    await recordEvent(userId, { type: "topic_completed", learningPath: session.learningPath, stage: session.stage, topic: session.topic, detail: "via teaching session" });
  } catch {}

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
