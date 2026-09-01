const AssessmentQuestion = require("../models/AssessmentQuestion");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const Assessment = require("../models/Assessment");
const UserSkill = require("../models/UserSkill");

const DIFFICULTY_LEVELS = { easy: 1, medium: 2, hard: 3 };
const RECENT_WINDOW_SIZE = 5;
const MIN_QUESTIONS = 8;
const MAX_QUESTIONS = 20;
const STREAK_TO_INCREASE = 3;
const WEAKNESS_TO_DECREASE = 2;

exports.createAttempt = async (userId, assessmentId) => {
  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) throw new Error("Assessment not found");

  const existing = await AssessmentAttempt.findActiveForUser(userId, assessmentId);
  if (existing) return existing;

  const profile = await require("../models/LearnerProfile").findByUser(userId);
  let startDifficulty = "medium";
  if (profile?.experienceLevel === "beginner") startDifficulty = "easy";
  else if (profile?.experienceLevel === "advanced") startDifficulty = "hard";

  const firstSkill = assessment.skills?.[0] || assessment.skill || "general";

  const attempt = await AssessmentAttempt.create({
    user: userId,
    assessment: assessmentId,
    currentDifficulty: startDifficulty,
    currentSkill: firstSkill,
    mode: assessment.mode || "practice",
    totalQuestions: assessment.questionCount || 10,
  });

  return attempt;
};

exports.getNextQuestion = async (attemptId) => {
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "in_progress") throw new Error("Attempt is not active");

  const assessment = await Assessment.findById(attempt.assessment);
  if (!assessment) throw new Error("Assessment not found");

  if (attempt.answers.length >= attempt.totalQuestions) {
    return null;
  }

  if (assessment.timeLimitMinutes) {
    const elapsed = (Date.now() - attempt.startedAt.getTime()) / 60000;
    if (elapsed >= assessment.timeLimitMinutes) {
      attempt.status = "timed_out";
      attempt.completedAt = new Date();
      await attempt.save();
      return null;
    }
  }

  const query = {
    skill: { $in: assessment.skills?.length ? assessment.skills : [attempt.currentSkill] },
    difficulty: attempt.currentDifficulty,
    _id: { $nin: attempt.seenQuestionIds },
  };

  let questions = await AssessmentQuestion.find(query).limit(10);

  if (questions.length === 0) {
    delete query.difficulty;
    questions = await AssessmentQuestion.find(query).limit(10);
  }

  if (questions.length === 0) {
    query.skill = { $exists: true };
    delete query.skill;
    questions = await AssessmentQuestion.find({
      _id: { $nin: attempt.seenQuestionIds },
    }).limit(10);
  }

  if (questions.length === 0) return null;

  const question = questions[Math.floor(Math.random() * questions.length)];

  attempt.seenQuestionIds.push(question._id);
  await attempt.save();

  const { correctAnswer, hints, solution, testCases, ...safeQuestion } = question.toObject();
  return { question: safeQuestion, attemptId: attempt._id };
};

exports.submitAnswer = async (attemptId, questionId, answer, timeSpentSeconds = 0, hintsUsed = 0) => {
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status !== "in_progress") throw new Error("Attempt is not active");

  const question = await AssessmentQuestion.findById(questionId);
  if (!question) throw new Error("Question not found");

  const result = evaluateAnswer(question, answer);

  attempt.answers.push({
    question: questionId,
    answer,
    correct: result.correct,
    score: result.score,
    feedback: result.feedback,
    hintsUsed,
    timeSpentSeconds,
    answeredAt: new Date(),
  });

  attempt.recentWindow.push(result.correct);
  if (attempt.recentWindow.length > RECENT_WINDOW_SIZE) {
    attempt.recentWindow.shift();
  }

  updateDifficulty(attempt, result.correct);
  updateSkillResults(attempt, question.skill, result.correct, question.difficulty);

  await attempt.save();

  await UserSkill.updateSkillPerformance(attempt.user, question.skill, result.correct);

  return {
    correct: result.correct,
    score: result.score,
    feedback: result.feedback,
    explanation: question.explanation,
    correctAnswer: question.correctAnswer,
    currentDifficulty: attempt.currentDifficulty,
    skillResults: attempt.skillResults,
  };
};

exports.completeAttempt = async (attemptId) => {
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) throw new Error("Attempt not found");

  attempt.status = "completed";
  attempt.completedAt = new Date();
  attempt.timeSpentSeconds = Math.round((Date.now() - attempt.startedAt.getTime()) / 1000);

  const totalScore = attempt.answers.reduce((s, a) => s + a.score, 0);
  const totalQuestions = attempt.answers.length;
  attempt.score = totalScore;
  attempt.percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

  for (const sr of attempt.skillResults) {
    if (sr.questionsAnswered >= 3 && sr.score >= 0.8) sr.status = "strong";
    else if (sr.score >= 0.6) sr.status = "proficient";
    else if (sr.score >= 0.3) sr.status = "developing";
    else sr.status = "not_started";

    sr.confidence = Math.min(1, sr.score * 0.7 + Math.min(0.3, sr.questionsAnswered * 0.05));
  }

  await attempt.save();
  return attempt;
};

exports.getAttemptResult = async (attemptId, userId) => {
  const attempt = await AssessmentAttempt.findOne({ _id: attemptId, user: userId })
    .populate("assessment", "title type mode skills");
  if (!attempt) throw new Error("Attempt not found");

  const strong = attempt.skillResults.filter((s) => s.status === "strong" || s.status === "proficient");
  const weak = attempt.skillResults.filter((s) => s.status === "not_started" || s.status === "developing");

  return {
    attempt,
    strong,
    weak,
    passed: attempt.percentage >= (attempt.assessment?.passingScore || 70),
  };
};

exports.getPlacement = async (userId, skill) => {
  const assessment = await Assessment.findOne({ type: "placement", skill, status: "published" });
  if (!assessment) {
    return this.createPlacementAssessment(skill);
  }
  return assessment;
};

exports.createPlacementAssessment = async (skill) => {
  const questions = await AssessmentQuestion.find({ skill }).limit(20);
  if (questions.length === 0) return null;

  const assessment = await Assessment.create({
    title: `${skill} Placement Assessment`,
    description: `Determine your starting level for ${skill}`,
    type: "placement",
    mode: "placement",
    skill,
    skills: [skill],
    questionCount: Math.min(15, questions.length),
    minQuestions: 8,
    maxQuestions: 20,
    adaptive: true,
    aiAssisted: false,
    status: "published",
  });

  return assessment;
};

exports.startReview = async (userId, skills) => {
  const weakSkills = [];
  for (const skill of skills) {
    const userSkill = await UserSkill.findOne({ user: userId, skill });
    if (userSkill && userSkill.confidence < 0.5) {
      weakSkills.push(skill);
    }
  }

  if (weakSkills.length === 0) return null;

  const assessment = await Assessment.create({
    title: `Review: ${weakSkills.join(", ")}`,
    description: `Practice and review concepts you've been struggling with`,
    type: "review",
    mode: "review",
    skills: weakSkills,
    questionCount: Math.min(15, weakSkills.length * 3 + 5),
    adaptive: true,
    aiAssisted: true,
    status: "published",
  });

  return assessment;
};

function evaluateAnswer(question, answer) {
  if (!question || answer === undefined || answer === null) {
    return { correct: false, score: 0, feedback: "No answer provided." };
  }

  const answerStr = String(answer).trim().toLowerCase();
  const correctStr = String(question.correctAnswer).trim().toLowerCase();

  if (question.type === "multiple_choice" || question.type === "true_false") {
    const correct = answerStr === correctStr;
    return {
      correct,
      score: correct ? 1 : 0,
      feedback: correct ? "Correct!" : `The correct answer is: ${question.correctAnswer}`,
    };
  }

  if (question.type === "code_output" || question.type === "conceptual") {
    const correct = normalizeAnswer(answerStr) === normalizeAnswer(correctStr);
    return {
      correct,
      score: correct ? 1 : 0,
      feedback: correct ? "Correct!" : `Expected: ${question.correctAnswer}`,
    };
  }

  if (question.type === "coding" || question.type === "code_completion" || question.type === "debugging") {
    if (!question.testCases || question.testCases.length === 0) {
      const correct = normalizeAnswer(answerStr) === normalizeAnswer(correctStr);
      return {
        correct,
        score: correct ? 1 : 0,
        feedback: correct ? "Correct!" : "Your answer doesn't match the expected output.",
      };
    }

    let passed = 0;
    const total = question.testCases.length;
    for (const tc of question.testCases) {
      try {
        const result = executeInSandbox(answer, tc.input, question.language);
        if (normalizeAnswer(result) === normalizeAnswer(tc.expectedOutput)) passed++;
      } catch (_) {
        // test case failed
      }
    }

    const score = total > 0 ? passed / total : 0;
    const visiblePassed = question.testCases.filter((tc) => !tc.hidden).length;
    const visibleTotal = question.testCases.filter((tc) => !tc.hidden).length;
    const hiddenTotal = total - visibleTotal;

    return {
      correct: score >= 0.7,
      score,
      feedback: `${passed}/${total} test cases passed${hiddenTotal > 0 ? ` (${hiddenTotal} hidden)` : ''}`,
    };
  }

  if (question.type === "short_answer") {
    const answerWords = new Set(answerStr.split(/\s+/));
    const keyWords = new Set(correctStr.split(/\s+/));
    const overlap = [...answerWords].filter((w) => keyWords.has(w)).length;
    const score = keyWords.size > 0 ? Math.min(1, overlap / keyWords.size) : 0;
    return {
      correct: score >= 0.5,
      score,
      feedback: score >= 0.5 ? "Looks good!" : "Your answer could be more complete.",
    };
  }

  return { correct: false, score: 0, feedback: "Unable to evaluate." };
}

function normalizeAnswer(str) {
  return str.replace(/\s+/g, "").replace(/['"]/g, "").replace(/;$/, "").toLowerCase();
}

function executeInSandbox(code, input, language) {
  try {
    if (language === "javascript" || !language) {
      const fn = new Function("input", `
        const console = { log: (...args) => this._output = args.join(' ') };
        this._output = '';
        ${code}
        return this._output;
      `);
      return String(fn(input)).trim();
    }
    return "";
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

function updateDifficulty(attempt, correct) {
  attempt.recentCorrect = attempt.recentWindow.filter((c) => c).length;
  attempt.recentTotal = attempt.recentWindow.length;

  if (attempt.recentWindow.length < 3) return;

  const recentCorrectCount = attempt.recentWindow.filter((c) => c).length;
  const recentWrongCount = attempt.recentWindow.length - recentCorrectCount;

  const currentLevel = DIFFICULTY_LEVELS[attempt.currentDifficulty] || 2;

  if (recentCorrectCount >= STREAK_TO_INCREASE && currentLevel < 3) {
    const newLevel = currentLevel + 1;
    attempt.currentDifficulty = Object.keys(DIFFICULTY_LEVELS).find(
      (k) => DIFFICULTY_LEVELS[k] === newLevel
    );
    attempt.recentWindow = [];
  } else if (recentWrongCount >= WEAKNESS_TO_DECREASE && currentLevel > 1) {
    const newLevel = currentLevel - 1;
    attempt.currentDifficulty = Object.keys(DIFFICULTY_LEVELS).find(
      (k) => DIFFICULTY_LEVELS[k] === newLevel
    );
    attempt.recentWindow = [];
  }
}

function updateSkillResults(attempt, skill, correct, difficulty) {
  let sr = attempt.skillResults.find((s) => s.skill === skill);
  if (!sr) {
    sr = { skill, questionsAnswered: 0, correct: 0, score: 0, confidence: 0, status: "not_started" };
    attempt.skillResults.push(sr);
  }

  sr.questionsAnswered += 1;
  if (correct) sr.correct += 1;
  sr.score = sr.correct / sr.questionsAnswered;

  if (sr.difficultyBreakdown[difficulty]) {
    sr.difficultyBreakdown[difficulty].total += 1;
    if (correct) sr.difficultyBreakdown[difficulty].correct += 1;
  }

  const nextSkillIdx = attempt.skillResults.indexOf(sr) + 1;
  const assessment = attempt._assessment;
  if (assessment?.skills?.length > 0) {
    const currentIdx = assessment.skills.indexOf(skill);
    if (currentIdx >= 0 && currentIdx < assessment.skills.length - 1) {
      if (sr.questionsAnswered >= 2) {
        attempt.currentSkill = assessment.skills[currentIdx + 1];
      }
    }
  }
}
