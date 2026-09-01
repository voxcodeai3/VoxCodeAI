const LearningProgress = require("../models/LearningProgress");
const UserSkill = require("../models/UserSkill");
const LearnerProfile = require("../models/LearnerProfile");
const LearningPath = require("../models/LearningPath");

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await LearnerProfile.findByUser(userId);
    const allProgress = await LearningProgress.find({ user: userId }).sort({ lastAccessedAt: -1 });
    const skills = await UserSkill.findByUser(userId);

    const completedCount = allProgress.filter((p) => p.status === "completed").length;
    const inProgressCount = allProgress.filter((p) => p.status === "in_progress").length;

    const recentActivity = allProgress.slice(0, 10).map((p) => ({
      lessonId: p.lesson,
      courseId: p.course,
      status: p.status,
      progress: p.progress,
      score: p.score,
      lastAccessedAt: p.lastAccessedAt,
    }));

    const streak = profile ? calculateStreak(allProgress) : 0;
    const weeklyMinutes = calculateWeeklyMinutes(allProgress);

    let activePath = null;
    if (profile?.activePath) {
      activePath = await LearningPath.findById(profile.activePath).lean();
    }

    res.json({
      completedLessons: completedCount,
      inProgressLessons: inProgressCount,
      totalSkills: skills.length,
      masteredSkills: skills.filter((s) => s.status === "mastered").length,
      recentActivity,
      streak,
      weeklyMinutes,
      experienceLevel: profile ? profile.experienceLevel : null,
      learningGoal: profile ? profile.learningGoals[0] : null,
      activePath,
      hasOnboarded: !!(profile?.activePath || (profile?.learningGoals && profile.learningGoals.length > 0)),
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
};

exports.saveOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const { learningGoal, experienceLevel, preferredLanguages, weeklyGoal, activePathId } = req.body;

    const profile = await LearnerProfile.findOrCreate(userId);
    if (learningGoal) profile.learningGoals = [learningGoal];
    if (experienceLevel) profile.experienceLevel = experienceLevel;
    if (preferredLanguages) profile.preferredLanguages = preferredLanguages;
    if (activePathId) profile.activePath = activePathId;
    await profile.save();

    res.json({ success: true, profile });
  } catch (err) {
    console.error("saveOnboarding error:", err);
    res.status(500).json({ message: "Failed to save onboarding" });
  }
};

exports.getCalendar = async (req, res) => {
  try {
    const userId = req.user.id;
    const allProgress = await LearningProgress.find({ user: userId });

    const dayMap = {};
    for (const p of allProgress) {
      if (p.lastAccessedAt) {
        const key = p.lastAccessedAt.toISOString().slice(0, 10);
        dayMap[key] = true;
      }
      if (p.completedAt) {
        const key = p.completedAt.toISOString().slice(0, 10);
        dayMap[key] = true;
      }
    }

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        day: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        active: !!dayMap[key],
      });
    }

    res.json({ days });
  } catch (err) {
    console.error("getCalendar error:", err);
    res.status(500).json({ message: "Failed to load calendar" });
  }
};

function calculateStreak(progress) {
  const days = new Set();
  for (const p of progress) {
    if (p.lastAccessedAt) days.add(p.lastAccessedAt.toISOString().slice(0, 10));
  }
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function calculateWeeklyMinutes(progress) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return progress
    .filter((p) => p.lastAccessedAt && p.lastAccessedAt >= weekAgo)
    .reduce((sum, p) => sum + (p.timeSpentMinutes || 0), 0);
}

exports.setActivePath = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pathId } = req.body;

    const profile = await LearnerProfile.findOrCreate(userId);
    profile.activePath = pathId || null;
    await profile.save();

    res.json({ success: true, activePath: profile.activePath });
  } catch (err) {
    console.error("setActivePath error:", err);
    res.status(500).json({ message: "Failed to set active path" });
  }
};
