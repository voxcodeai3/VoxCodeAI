const mongoose = require("mongoose");

const versionFileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    path: { type: String, required: true },
    content: { type: String, default: "" },
    language: { type: String, default: "plaintext" },
  },
  { _id: false }
);

const projectVersionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
      default: "Manual checkpoint",
      maxlength: 200,
    },
    branch: {
      type: String,
      default: "main",
    },
    source: {
      type: String,
      enum: ["manual", "autosave", "ai_change", "challenge", "checkpoint", "restore"],
      default: "manual",
    },
    aiAction: {
      type: String,
      enum: ["debug", "refactor", "optimize", "generate", "explain", null],
      default: null,
    },
    files: {
      type: [versionFileSchema],
      default: [],
    },
    activeFile: {
      type: String,
      default: null,
    },
    parentVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectVersion",
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

projectVersionSchema.index({ project: 1, versionNumber: -1 });
projectVersionSchema.index({ project: 1, createdAt: -1 });

projectVersionSchema.statics.findForProject = function (projectId) {
  return this.find({ project: projectId }).sort({ versionNumber: -1 });
};

projectVersionSchema.statics.findVersion = function (projectId, versionId) {
  return this.findOne({ _id: versionId, project: projectId });
};

projectVersionSchema.statics.getLatestVersionNumber = async function (projectId) {
  const latest = await this.findOne({ project: projectId })
    .sort({ versionNumber: -1 })
    .select("versionNumber");
  return latest ? latest.versionNumber : 0;
};

module.exports = mongoose.model("ProjectVersion", projectVersionSchema);
