const mongoose = require("mongoose");

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, default: "" },
    expectedOutput: { type: String, default: "" },
    hidden: { type: Boolean, default: false },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["multiple_choice", "true_false", "code_output", "debugging", "code_completion", "coding", "short_answer", "conceptual"],
      required: true,
    },
    prompt: { type: String, required: true },
    skill: { type: String, required: true, index: true },
    category: { type: String, default: "general" },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    options: { type: [String], default: [] },
    correctAnswer: { type: String, default: null },
    explanation: { type: String, default: "" },
    hints: { type: [String], default: [] },
    solution: { type: String, default: null },
    code: { type: String, default: null },
    language: { type: String, default: "javascript" },
    testCases: { type: [testCaseSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false }
);

questionSchema.statics.findBySkillAndDifficulty = function (skill, difficulty, excludeIds = []) {
  const query = { skill, difficulty };
  if (excludeIds.length > 0) query._id = { $nin: excludeIds };
  return this.find(query);
};

questionSchema.statics.findBySkills = function (skills, difficulty) {
  const query = { skill: { $in: skills } };
  if (difficulty) query.difficulty = difficulty;
  return this.find(query);
};

module.exports = mongoose.model("AssessmentQuestion", questionSchema);
