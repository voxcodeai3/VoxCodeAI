const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const LearnerProfile = require("../models/LearnerProfile");
const LearningMemory = require("../models/LearningMemory");
const User = require("../models/User");
const { generateResponse, generateQuestion, evaluateAnswer } = require("../services/aiService");
const { modelManager } = require("../services/modelManager");
const {
  extractSignals,
  updateProfile: updateLearnerProfile,
  buildLearnerContext,
  buildConversationSummary,
} = require("../services/memoryService");
const { buildLearningContext, contextToPrompt } = require("../services/ai/contextBuilder");

const MAX_MESSAGE_LENGTH = 4000;
const HISTORY_WINDOW = 12;

/**
 * POST /api/ai/chat
 * Body: { message, conversationId?, inputMode?, language?, level?, teachingMode? }
 * Response: { message, code, responseMode, conversationId, language }
 */
async function chat(req, res) {
  try {
    const userId = req.user.id;

    let {
      message,
      conversationId,
      inputMode = "text",
      language = "javascript",
      level = "beginner",
      teachingMode = "learn",
      codingContext,
      practiceMode,
      lessonId,
      projectId,
    } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Please include a message." });
    }
    message = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!["voice", "text"].includes(inputMode)) inputMode = "text";

    let conversation = null;
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findOne({ _id: conversationId, userId });
    }
    if (!conversation) {
      conversation = await Conversation.findLatestForUser(userId);
    }

    // Reuse the latest conversation so follow-ups keep their context.
    if (!conversation) {
      conversation = await Conversation.create({
        userId,
        language,
        level,
        teachingMode,
        title: Conversation.generateTitle(message),
      });
    } else {
      conversation.language = language || conversation.language;
      conversation.level = level || conversation.level;
      conversation.teachingMode = teachingMode || conversation.teachingMode;
    }

    const history = conversation.messages
      .slice(-HISTORY_WINDOW)
      .map((m) => ({ role: m.role, content: m.content }));

    // Load learner profile and build context for personalized responses.
    const learnerProfile = await LearnerProfile.findOrCreate(userId);
    const learnerContextBase = buildLearnerContext(learnerProfile);

    // Persistent learning memory — MongoDB is source of truth, not AI
    const learningMemory = await LearningMemory.findOrCreate(userId);
    // Keep memory's current lesson in sync with what frontend is viewing
    if (lessonId && mongoose.Types.ObjectId.isValid(lessonId)) {
      learningMemory.currentLesson = lessonId;
      learningMemory.lastActivity = new Date();
      learningMemory.lastOpenedAt = new Date();
      // Best-effort: also set currentStage/currentPath if we can resolve
      try {
        const { Lesson } = require("../models/Course");
        const Topic = require("../models/Topic");
        const Stage = require("../models/Stage");
        const l = await Lesson.findById(lessonId).lean();
        if (l?.topic) {
          const t = await Topic.findById(l.topic).lean();
          if (t?.stage) {
            learningMemory.currentStage = t.stage;
            const st = await Stage.findById(t.stage).lean();
            if (st?.learningPath) learningMemory.activeLearningPath = st.learningPath;
          }
        }
      } catch {}
      await learningMemory.save();
    } else {
      // touch lastOpenedAt even without lesson
      learningMemory.lastOpenedAt = new Date();
      await learningMemory.save().catch(() => {});
    }

    // Build compact, model-independent learning context (3 layers)
    let learningContextObj = null;
    let learningContext = "";
    try {
      learningContextObj = await buildLearningContext(userId, {
        lessonId: lessonId || learningMemory.currentLesson,
        projectId: projectId || codingContext?.projectId,
        question: message,
      });
      learningContext = contextToPrompt(learningContextObj);
      console.log(`AI request: user=${userId} lesson=${learningContextObj.currentLesson?.title || "none"} stage=${learningContextObj.currentStage?.title || "none"} path=${learningContextObj.learningPath?.title || "none"} modelPending`);
    } catch (e) {
      console.log("Learning context build failed, continuing with base context:", e.message);
    }
    const learnerContext = [learnerContextBase, learningContext].filter(Boolean).join("\n\n--- Learning Context ---\n");

    // Practice mode: generate question or evaluate code via dedicated functions.
    if (practiceMode === "generate") {
      try {
        const topic = codingContext?.topic || message;
        const difficulty = codingContext?.difficulty || "medium";
        const qType = codingContext?.type || "coding";
        const question = await generateQuestion({ topic, language, difficulty, learnerContext, type: qType });
        return res.json({
          message: question.question || question,
          code: null,
          responseMode: "text",
          conversationId: conversation?._id || null,
          language,
          practice: { action: "question", question },
        });
      } catch (err) {
        console.error("Practice generate error:", err.message);
        return res.status(502).json({ message: "Failed to generate question. Please try again." });
      }
    }

    if (practiceMode === "evaluate") {
      try {
        const questionText = codingContext?.question || "";
        const studentCode = codingContext?.code || message;
        const expectedConcepts = codingContext?.expectedConcepts || [];
        const evaluation = await evaluateAnswer({
          question: questionText,
          expectedAnswer: codingContext?.expectedAnswer || "",
          expectedConcepts,
          studentAnswer: studentCode,
          difficulty: codingContext?.difficulty || "medium",
          learnerContext,
        });
        return res.json({
          message: evaluation.feedback || "Evaluation complete.",
          code: null,
          responseMode: "text",
          conversationId: conversation?._id || null,
          language,
          practice: { action: "evaluation", evaluation },
        });
      } catch (err) {
        console.error("Practice evaluate error:", err.message);
        return res.status(502).json({ message: "Failed to evaluate answer. Please try again." });
      }
    }

    // Extract learning signals from the user's message and update profile.
    const signals = extractSignals(message);
    if (signals) {
      updateLearnerProfile(learnerProfile, signals);
    }

    // Build coding context block for the AI prompt.
    let codingContextBlock = "";
    if (codingContext && typeof codingContext === "object") {
      const parts = [];
      if (codingContext.activeFile) {
        parts.push(`Active file: ${codingContext.activeFile}`);
      }
      if (codingContext.language) {
        parts.push(`File language: ${codingContext.language}`);
      }
      if (codingContext.selectedCode) {
        parts.push(`Selected code:\n\`\`\`\n${codingContext.selectedCode}\n\`\`\``);
      }
      if (codingContext.currentCode) {
        parts.push(`Current file content:\n\`\`\`\n${codingContext.currentCode}\n\`\`\``);
      }
      if (codingContext.projectFiles?.length) {
        parts.push(`Project files: ${codingContext.projectFiles.join(", ")}`);
      }
      if (codingContext.error) {
        parts.push(`Error message: ${codingContext.error}`);
      }
      if (parts.length) {
        codingContextBlock = `\n\nCODING WORKSPACE:\n${parts.join("\n")}`;
      }
    }

    let result;
    try {
      result = await generateResponse({
        history,
        message,
        language: conversation.language,
        level: conversation.level,
        teachingMode: conversation.teachingMode,
        learnerContext,
        codingContext: codingContextBlock,
      });
    } catch (error) {
      if (error.code === "AI_NOT_CONFIGURED") {
        return res.status(503).json({
          code: "AI_NOT_CONFIGURED",
          message:
            "The AI engine isn't configured on the server yet. Please add your provider API key to the backend environment.",
        });
      }
      if (error.code === "ALL_MODELS_UNAVAILABLE") {
        return res.status(503).json({
          code: "ALL_MODELS_UNAVAILABLE",
          message: "All AI models are temporarily unavailable. Please try again later.",
        });
      }
      console.error("AI generation failed:", error.message);
      return res.status(502).json({
        message: "I had trouble reaching the AI engine. Please try again in a moment.",
      });
    }

    conversation.messages.push({
      role: "user",
      content: message,
      inputMode,
      modality: result.responseMode,
    });
    conversation.messages.push({
      role: "assistant",
      content: result.reply,
      code: result.code,
      modality: result.responseMode,
    });

    // Hard cap stored history per conversation to control document size.
    if (conversation.messages.length > 200) {
      conversation.messages = conversation.messages.slice(-200);
    }

    await conversation.save();

    // Track AI usage on the user document
    try {
      const usageField = inputMode === "voice" ? "aiUsage.voice" : "aiUsage.text";
      await User.findByIdAndUpdate(userId, {
        $inc: { "aiUsage.total": 1, [usageField]: 1 },
        $set: { "aiUsage.lastUsedAt": new Date(), lastUsedAt: new Date() },
      });
    } catch (e) {
      console.log("AI usage tracking failed (non-fatal):", e.message);
    }

    // Save learner profile updates (conservative — only changed if new signals were found).
    if (signals) {
      await learnerProfile.save();
    }

    // Update persistent learning memory (meaningful changes only, validated on backend)
    try {
      const mem = await LearningMemory.findOne({ user: userId });
      if (mem) {
        mem.lastActivity = new Date();
        // Track weak topics if question suggests struggle and current lesson exists
        const struggleHints = ["don't understand", "confused", "not working", "error", "failed", "struggling"];
        const qLower = message.toLowerCase();
        const isStruggle = struggleHints.some(h => qLower.includes(h));
        if (isStruggle && learningContextObj?.currentLesson?.title) {
          const topic = learningContextObj.currentLesson.title;
          if (!mem.weakTopics.includes(topic)) {
            mem.weakTopics = [...mem.weakTopics, topic].slice(-20);
          }
        }
        // Conversation summarization for long threads
        if (conversation.messages.length > 20 && conversation.messages.length % 10 === 0) {
          try {
            const summary = buildConversationSummary(conversation.messages);
            if (summary) mem.conversationSummary = summary.slice(0, 500);
          } catch {}
        }
        await mem.save();
        console.log(`Learning memory updated for user=${userId} weakTopics=${mem.weakTopics.length}`);
      }
    } catch (e) {
      console.log("Memory update failed (non-fatal):", e.message);
    }
    console.log(`AI response generated via model, conversation=${conversation._id}`);

    return res.json({
      message: result.reply,
      code: result.code ?? null,
      responseMode: result.responseMode,
      conversationId: conversation._id,
      language: conversation.language,
    });
  } catch (error) {
    console.error("chat error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

/**
 * GET /api/ai/conversation
 * Returns the user's most recent conversation for continuity after reloads.
 */
async function getConversation(req, res) {
  try {
    const conversation = await Conversation.findLatestForUser(req.user.id).limit(1);
    if (!conversation) {
      return res.json({ conversationId: null, messages: [] });
    }
    return res.json({
      conversationId: conversation._id,
      language: conversation.language,
      level: conversation.level,
      teachingMode: conversation.teachingMode,
      messages: conversation.messages.slice(-50),
    });
  } catch (error) {
    console.error("getConversation error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

/**
 * DELETE /api/ai/conversation — start a fresh conversation.
 */
async function clearConversation(req, res) {
  try {
    await Conversation.deleteMany({ userId: req.user.id });
    return res.json({ message: "Conversation cleared." });
  } catch (error) {
    console.error("clearConversation error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

/**
 * GET /api/ai/models — model pool status (no secrets exposed).
 */
function getModelStatus(req, res) {
  try {
    modelManager.init();
    return res.json({ models: modelManager.getStatus() });
  } catch (error) {
    console.error("getModelStatus error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

module.exports = { chat, getConversation, clearConversation, getModelStatus };
