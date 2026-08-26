const Conversation = require("../models/Conversation");

/**
 * POST /api/conversations
 * Create a new empty conversation.
 */
async function createConversation(req, res) {
  try {
    const { title } = req.body || {};
    const conversation = await Conversation.create({
      userId: req.user.id,
      title: title || "New Conversation",
    });
    return res.status(201).json({
      id: conversation._id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error("createConversation error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

/**
 * GET /api/conversations
 * List all conversations for the authenticated user (newest first).
 */
async function listConversations(req, res) {
  try {
    const conversations = await Conversation.findByUser(req.user.id);
    return res.json(
      conversations.map((c) => ({
        id: c._id,
        title: c.title,
        messageCount: c.messages.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
    );
  } catch (error) {
    console.error("listConversations error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

/**
 * GET /api/conversations/:id
 * Get a single conversation with all messages. Verifies ownership.
 */
async function getConversation(req, res) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }
    return res.json({
      id: conversation._id,
      title: conversation.title,
      language: conversation.language,
      level: conversation.level,
      teachingMode: conversation.teachingMode,
      messages: conversation.messages.slice(-200),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error("getConversation error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

/**
 * PATCH /api/conversations/:id
 * Update a conversation's title. Verifies ownership.
 */
async function updateConversation(req, res) {
  try {
    const { title } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Title is required." });
    }
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { title: title.trim().slice(0, 80) },
      { new: true }
    );
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }
    return res.json({
      id: conversation._id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error("updateConversation error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

/**
 * DELETE /api/conversations/:id
 * Delete a single conversation. Verifies ownership.
 */
async function deleteConversation(req, res) {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found." });
    }
    return res.json({ message: "Conversation deleted." });
  } catch (error) {
    console.error("deleteConversation error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

module.exports = {
  createConversation,
  listConversations,
  getConversation,
  updateConversation,
  deleteConversation,
};
