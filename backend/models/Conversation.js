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

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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

module.exports = mongoose.model("Conversation", conversationSchema);
