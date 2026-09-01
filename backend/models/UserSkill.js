const mongoose = require("mongoose");

const userSkillSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    skill: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "general",
    },
    status: {
      type: String,
      enum: ["not_started", "learning", "developing", "proficient", "mastered"],
      default: "not_started",
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    attempts: { type: Number, default: 0 },
    correctAttempts: { type: Number, default: 0 },
    lastPracticed: { type: Date, default: null },
    lastReviewedAt: { type: Date, default: null },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

userSkillSchema.statics.findByUser = function (userId) {
  return this.find({ user: userId }).sort({ confidence: -1 });
};

userSkillSchema.statics.findOrCreateSkill = async function (userId, skill, category = "general") {
  let userSkill = await this.findOne({ user: userId, skill });
  if (!userSkill) {
    userSkill = await this.create({
      user: userId,
      skill,
      category,
      status: "learning",
      confidence: 0.1,
    });
  }
  return userSkill;
};

userSkillSchema.statics.updateSkillPerformance = async function (userId, skill, correct) {
  const userSkill = await this.findOne({ user: userId, skill });
  if (!userSkill) {
    return this.create({
      user: userId,
      skill,
      status: "learning",
      confidence: correct ? 0.2 : 0.05,
      attempts: 1,
      correctAttempts: correct ? 1 : 0,
      lastPracticed: new Date(),
    });
  }

  userSkill.attempts += 1;
  if (correct) userSkill.correctAttempts += 1;
  userSkill.lastPracticed = new Date();

  const accuracy = userSkill.correctAttempts / userSkill.attempts;
  const attemptBoost = Math.min(0.3, userSkill.attempts * 0.02);
  userSkill.confidence = Math.min(1, accuracy * 0.7 + attemptBoost + (correct ? 0.05 : -0.05));
  userSkill.confidence = Math.max(0, userSkill.confidence);

  if (userSkill.confidence >= 0.85 && userSkill.attempts >= 5) {
    userSkill.status = "mastered";
  } else if (userSkill.confidence >= 0.6) {
    userSkill.status = "proficient";
  } else if (userSkill.confidence >= 0.3) {
    userSkill.status = "developing";
  } else {
    userSkill.status = "learning";
  }

  await userSkill.save();
  return userSkill;
};

userSkillSchema.statics.userSkillsSummary = async function (userId) {
  const skills = await this.find({ user: userId });
  const byCategory = {};
  for (const s of skills) {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
  }
  return {
    total: skills.length,
    mastered: skills.filter((s) => s.status === "mastered").length,
    proficient: skills.filter((s) => s.status === "proficient").length,
    developing: skills.filter((s) => s.status === "developing").length,
    learning: skills.filter((s) => s.status === "learning").length,
    byCategory,
  };
};

module.exports = mongoose.model("UserSkill", userSkillSchema);
