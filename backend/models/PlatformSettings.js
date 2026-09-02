const mongoose = require("mongoose");

const platformSettingsSchema = new mongoose.Schema(
  {
    // singleton key — only one document with this key should exist
    key: { type: String, default: "singleton", unique: true, index: true },
    allowRegistration: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    aiTeacherEnabled: { type: Boolean, default: true },
    voiceAIEnabled: { type: Boolean, default: true },
    defaultAIModel: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

// Ensure defaults are applied even if document is created empty
platformSettingsSchema.statics.getSettings = async function () {
  let doc = await this.findOne({ key: "singleton" });
  if (!doc) {
    doc = await this.create({ key: "singleton" });
  }
  return doc;
};

platformSettingsSchema.statics.getPublicStatus = async function () {
  const s = await this.getSettings();
  return {
    allowRegistration: s.allowRegistration,
    maintenanceMode: s.maintenanceMode,
    aiTeacherEnabled: s.aiTeacherEnabled,
    voiceAIEnabled: s.voiceAIEnabled,
  };
};

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
