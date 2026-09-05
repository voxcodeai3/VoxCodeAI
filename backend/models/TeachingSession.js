const mongoose = require("mongoose");

const teachingSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    learningPath: { type: mongoose.Schema.Types.ObjectId, ref: "LearningPath", required: true, index: true },
    stage: { type: mongoose.Schema.Types.ObjectId, ref: "Stage" },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", required: true, index: true },
    teachingState: {
      type: String,
      enum: ["teaching", "checking_understanding", "awaiting_answer", "reviewing", "ready_for_practice", "completed", "paused"],
      default: "teaching",
    },
    status: { type: String, enum: ["active", "paused", "completed"], default: "active", index: true },
    startedAt: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    // lightweight stats for completion condition
    interactionCount: { type: Number, default: 0 },
    checksPassed: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

teachingSessionSchema.index({ user: 1, learningPath: 1, topic: 1, status: 1 });
teachingSessionSchema.statics.findActive = function (userId, pathId, topicId) {
  const q = { user: userId, status: "active" };
  if (pathId) q.learningPath = pathId;
  if (topicId) q.topic = topicId;
  return this.findOne(q).sort({ updatedAt: -1 });
};

module.exports = mongoose.model("TeachingSession", teachingSessionSchema);
