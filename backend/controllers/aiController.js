const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const { generateResponse } = require("../services/aiService");

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
      });
    } else {
      conversation.language = language || conversation.language;
      conversation.level = level || conversation.level;
      conversation.teachingMode = teachingMode || conversation.teachingMode;
    }

    const history = conversation.messages
      .slice(-HISTORY_WINDOW)
      .map((m) => ({ role: m.role, content: m.content }));

    let result;
    try {
      result = await generateResponse({
        history,
        message,
        language: conversation.language,
        level: conversation.level,
        teachingMode: conversation.teachingMode,
      });
    } catch (error) {
      if (error.code === "AI_NOT_CONFIGURED") {
        return res.status(503).json({
          message:
            "The AI engine isn't configured on the server yet. Please add your provider API key to the backend environment.",
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

module.exports = { chat, getConversation, clearConversation };
