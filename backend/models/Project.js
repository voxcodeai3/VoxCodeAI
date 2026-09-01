const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    path: { type: String, required: true },
    content: { type: String, default: "" },
    language: { type: String, default: "plaintext" },
    isFolder: { type: Boolean, default: false },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    language: {
      type: String,
      default: "javascript",
    },
    template: {
      type: String,
      default: "blank",
    },
    files: {
      type: [fileSchema],
      default: [],
    },
    activeFile: {
      type: String,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },
    lastOpenedAt: {
      type: Date,
      default: null,
    },
    lastSavedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

projectSchema.statics.findByUser = function (userId) {
  return this.find({ user: userId }).sort({ updatedAt: -1 });
};

projectSchema.statics.findProject = function (userId, projectId) {
  return this.findOne({ _id: projectId, user: userId });
};

module.exports = mongoose.model("Project", projectSchema);
