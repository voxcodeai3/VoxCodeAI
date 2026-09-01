const LearnerProfile = require("../models/LearnerProfile");
const curriculumService = require("../services/curriculumService");

exports.getGoals = async (req, res) => {
  try {
    res.json(curriculumService.getAllGoals());
  } catch (err) {
    res.status(500).json({ message: "Failed to load goals" });
  }
};

exports.getStacks = async (req, res) => {
  try {
    const { goal } = req.query;
    if (!goal) return res.status(400).json({ message: "goal query param required" });
    const stacks = await curriculumService.getGoalStacks(goal);
    res.json(stacks);
  } catch (err) {
    res.status(500).json({ message: "Failed to load stacks" });
  }
};

exports.getTechnologies = async (req, res) => {
  try {
    const { goal } = req.query;
    const techs = goal
      ? await curriculumService.getTechnologies(goal)
      : await require("../models/Technology").findAvailable();
    res.json(techs);
  } catch (err) {
    res.status(500).json({ message: "Failed to load technologies" });
  }
};

exports.getStackCurriculum = async (req, res) => {
  try {
    const { slug } = req.params;
    const curriculum = await curriculumService.resolveStackCurriculum(slug);
    if (!curriculum) return res.status(404).json({ message: "Stack not found" });
    res.json(curriculum);
  } catch (err) {
    res.status(500).json({ message: "Failed to load curriculum" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const profile = await LearnerProfile.findOrCreate(req.user.id);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: "Failed to load profile" });
  }
};

exports.saveProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      selectedGoal, selectedStack, selectedTechnologies,
      experienceLevel, learningGoals, preferredLearningStyle,
      weeklyGoalHours, preferredLanguages,
    } = req.body;

    const profile = await LearnerProfile.findOrCreate(userId);

    if (selectedGoal !== undefined) profile.selectedGoal = selectedGoal;
    if (selectedStack !== undefined) profile.selectedStack = selectedStack;
    if (selectedTechnologies !== undefined) profile.selectedTechnologies = selectedTechnologies;
    if (experienceLevel !== undefined) profile.experienceLevel = experienceLevel;
    if (learningGoals !== undefined) profile.learningGoals = learningGoals;
    if (preferredLearningStyle !== undefined) profile.preferredLearningStyle = preferredLearningStyle;
    if (weeklyGoalHours !== undefined) profile.weeklyGoalHours = weeklyGoalHours;
    if (preferredLanguages !== undefined) profile.preferredLanguages = preferredLanguages;

    profile.onboardingComplete = true;
    await profile.save();

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ message: "Failed to save profile" });
  }
};

exports.startLearning = async (req, res) => {
  try {
    const userId = req.user.id;
    const { stackSlug } = req.body;

    const profile = await LearnerProfile.findOrCreate(userId);
    if (!profile.selectedGoal || !stackSlug) {
      return res.status(400).json({ message: "Complete onboarding first" });
    }

    const path = await curriculumService.createLearningPathFromStack(userId, stackSlug, profile.experienceLevel);
    if (!path) {
      return res.status(404).json({ message: "No curriculum available for this stack" });
    }

    profile.activePath = path._id;
    profile.selectedStack = stackSlug;
    await profile.save();

    const startingPoint = await curriculumService.getDetermineStartingPoint(userId, stackSlug, profile.experienceLevel);

    res.json({
      success: true,
      path,
      startingCourse: startingPoint,
      profile,
    });
  } catch (err) {
    console.error("startLearning error:", err);
    res.status(500).json({ message: "Failed to start learning" });
  }
};
