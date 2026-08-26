const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    code: { type: String, default: null },
    inputMode: { type: String, enum: ["voice", "text"], default: "text" },
    modality: { type: String, enum: ["text", "voice", "text_voice"], default: "text" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TITLE_MAX_LENGTH = 80;

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Conversation",
      trim: true,
      maxlength: TITLE_MAX_LENGTH,
    },
    language: { type: String, default: "javascript", lowercase: true, trim: true },
    level: { type: String, default: "beginner", trim: true },
    teachingMode: { type: String, default: "learn", trim: true },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

conversationSchema.statics.findLatestForUser = function (userId) {
  return this.findOne({ userId }).sort({ updatedAt: -1 });
};

conversationSchema.statics.findByUser = function (userId) {
  return this.find({ userId }).sort({ updatedAt: -1 });
};

/**
 * Generate a short title from the first user message.
 * Takes the first ~60 words, truncates at a word boundary.
 */
conversationSchema.statics.generateTitle = function (content) {
  if (!content || typeof content !== "string") return "New Conversation";
  const cleaned = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/[#!*\-_>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "New Conversation";
  const words = cleaned.split(" ").slice(0, 10);
  let title = words.join(" ");
  if (title.length > TITLE_MAX_LENGTH) {
    title = title.slice(0, TITLE_MAX_LENGTH).replace(/\s+\S*$/, "");
  }
  return title || "New Conversation";
};

module.exports = mongoose.model("Conversation", conversationSchema);
