const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const LearnerProfile = require("../models/LearnerProfile");
const { generateResponse, generateQuestion, evaluateAnswer } = require("../services/aiService");
const { modelManager } = require("../services/modelManager");
const {
  extractSignals,
  updateProfile: updateLearnerProfile,
  buildLearnerContext,
  buildConversationSummary,
} = require("../services/memoryService");

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
    const learnerContext = buildLearnerContext(learnerProfile);

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

    // Save learner profile updates (conservative — only changed if new signals were found).
    if (signals) {
      await learnerProfile.save();
    }

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
