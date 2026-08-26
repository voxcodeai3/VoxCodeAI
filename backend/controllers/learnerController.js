const LearnerProfile = require("../models/LearnerProfile");

const ALLOWED_TEACHING_STYLES = [
  "step_by_step",
  "socratic",
  "example_first",
  "concise",
  "detailed",
  "practice_focused",
];

const ALLOWED_LEVELS = ["beginner", "intermediate", "advanced"];

/**
 * GET /api/learner/profile
 * Returns the authenticated user's learner profile (creates one if none exists).
 */
async function getProfile(req, res) {
  try {
    const profile = await LearnerProfile.findOrCreate(req.user.id);
    return res.json({
      preferredLanguages: profile.preferredLanguages,
      experienceLevel: profile.experienceLevel,
      learningGoals: profile.learningGoals,
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
      interests: profile.interests,
      preferredTeachingStyle: profile.preferredTeachingStyle,
      currentTopics: profile.currentTopics,
      topicProgress: profile.topicProgress,
      conversationSummary: profile.conversationSummary,
    });
  } catch (error) {
    console.error("getProfile error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

/**
 * PATCH /api/learner/profile
 * Manually update learner profile fields. Only provided fields are updated.
 */
async function updateProfile(req, res) {
  try {
    const profile = await LearnerProfile.findOrCreate(req.user.id);
    const body = req.body || {};

    if (body.preferredLanguages !== undefined) {
      if (!Array.isArray(body.preferredLanguages)) {
        return res.status(400).json({ message: "preferredLanguages must be an array." });
      }
      profile.preferredLanguages = body.preferredLanguages
        .filter((v) => typeof v === "string" && v.trim())
        .map((v) => v.trim())
        .slice(0, 10);
    }

    if (body.experienceLevel !== undefined) {
      if (body.experienceLevel !== null && !ALLOWED_LEVELS.includes(body.experienceLevel)) {
        return res.status(400).json({ message: "Invalid experience level." });
      }
      profile.experienceLevel = body.experienceLevel;
    }

    if (body.learningGoals !== undefined) {
      if (!Array.isArray(body.learningGoals)) {
        return res.status(400).json({ message: "learningGoals must be an array." });
      }
      profile.learningGoals = body.learningGoals
        .filter((v) => typeof v === "string" && v.trim())
        .map((v) => v.trim())
        .slice(0, 10);
    }

    if (body.strengths !== undefined) {
      if (!Array.isArray(body.strengths)) {
        return res.status(400).json({ message: "strengths must be an array." });
      }
      profile.strengths = body.strengths
        .filter((v) => typeof v === "string" && v.trim())
        .map((v) => v.trim())
        .slice(0, 15);
    }

    if (body.weaknesses !== undefined) {
      if (!Array.isArray(body.weaknesses)) {
        return res.status(400).json({ message: "weaknesses must be an array." });
      }
      profile.weaknesses = body.weaknesses
        .filter((v) => typeof v === "string" && v.trim())
        .map((v) => v.trim())
        .slice(0, 15);
    }

    if (body.interests !== undefined) {
      if (!Array.isArray(body.interests)) {
        return res.status(400).json({ message: "interests must be an array." });
      }
      profile.interests = body.interests
        .filter((v) => typeof v === "string" && v.trim())
        .map((v) => v.trim())
        .slice(0, 10);
    }

    if (body.preferredTeachingStyle !== undefined) {
      if (
        body.preferredTeachingStyle !== null &&
        !ALLOWED_TEACHING_STYLES.includes(body.preferredTeachingStyle)
      ) {
        return res.status(400).json({ message: "Invalid teaching style." });
      }
      profile.preferredTeachingStyle = body.preferredTeachingStyle;
    }

    await profile.save();

    return res.json({
      preferredLanguages: profile.preferredLanguages,
      experienceLevel: profile.experienceLevel,
      learningGoals: profile.learningGoals,
      strengths: profile.strengths,
      weaknesses: profile.weaknesses,
      interests: profile.interests,
      preferredTeachingStyle: profile.preferredTeachingStyle,
      currentTopics: profile.currentTopics,
      topicProgress: profile.topicProgress,
      conversationSummary: profile.conversationSummary,
    });
  } catch (error) {
    console.error("updateProfile error:", error.message);
    return res.status(500).json({
      message: "Something went wrong on our side. Please try again.",
    });
  }
}

module.exports = { getProfile, updateProfile };
