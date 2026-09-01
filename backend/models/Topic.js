const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },
    order: { type: Number, required: true, min: 0 },
    stage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stage",
      required: true,
      index: true,
    },
    technologies: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Technology" }],
      default: [],
    },
    estimatedMinutes: { type: Number, default: 20, min: 1 },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

topicSchema.index({ stage: 1, slug: 1 }, { unique: true });
topicSchema.index({ stage: 1, order: 1 }, { unique: true });

topicSchema.statics.findByStage = function (stageId) {
  return this.find({ stage: stageId, status: "published" }).sort({ order: 1 }).populate("technologies");
};

module.exports = mongoose.model("Topic", topicSchema);
