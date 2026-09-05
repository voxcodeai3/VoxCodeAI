const { buildLearningRoadmap } = require("./roadmapService");
const { generateResponse } = require("./aiService");

const QUIZ_PASS_THRESHOLD = 80;
const QUIZ_REVIEW_THRESHOLD = 60;

function buildQuizPrompt(roadmap, topic, level, weakTopics) {
  const techs = (roadmap.path.technologies || []).map((t) => t.name).join(", ") || topic.title;
  return `Create a mini-quiz for topic: ${topic.title} — ${topic.description || "learn concept"} (Stage: ${roadmap.stages.find((s) => s.topics.some((t) => t.id.toString() === topic._id.toString()))?.title || "current"})

Learning path: ${roadmap.path.title} (${roadmap.path.category}), Level: ${level}
Technologies: ${techs}
Weak areas to reinforce if relevant: ${weakTopics?.length ? weakTopics.join(", ") : "none"}

Generate 3-5 questions (exactly 4 is ideal) covering this topic only. Mix types: multiple_choice, true_false, short_answer, predict_output, code
Each question must be concise, beginner-friendly if level is beginner.

Return STRICTLY as minified JSON on a single line, no markdown fences:
{"questions":[{"id":"q1","type":"multiple_choice","question":"What will this print?","options":["10","11","Error","undefined"],"code":"let x=5;\\nconsole.log(x+5);","expectedAnswer":"10","topic":"${topic.title}","technology":"${techs.split(",")[0]?.trim() || "general"}"}, ...]}

For multiple_choice/true_false, provide 2-4 options and expectedAnswer must be one of them. For predict_output/code, include code snippet and expectedAnswer is the output.`;
}

function buildEvaluationPrompt(question, studentAnswer) {
  return `Evaluate this student answer.

Question [${question.type}] ${question.question}
${question.code ? `Code:\n${question.code}` : ""}
Expected: ${question.expectedAnswer}
Student: ${studentAnswer}

Return STRICTLY as minified JSON on a single line:
{"result":"correct|partial|incorrect|unclear","score":0.0-1.0,"explanation":"short what was correct/missing","missingConcept":"... if any"}

Rules: correct 0.8-1.0, partial 0.4-0.7, incorrect 0-0.3, unclear 0. Be kind, no shaming.`;
}

function fallbackQuestions(topic, roadmap, level) {
  const tech = (roadmap.path.technologies?.[0]?.name) || "general";
  const base = [
    {
      id: "q1",
      type: "multiple_choice",
      question: `What is the main purpose of ${topic.title}?`,
      options: [`To handle ${topic.title.toLowerCase()}`, "To manage unrelated data", "To bypass rendering", "None of the above"],
      code: null,
      expectedAnswer: `To handle ${topic.title.toLowerCase()}`,
      topic: topic.title,
      technology: tech,
      difficulty: level,
    },
    {
      id: "q2",
      type: "true_false",
      question: `${topic.title} is an important concept in ${roadmap.path.title}.`,
      options: ["True", "False"],
      code: null,
      expectedAnswer: "True",
      topic: topic.title,
      technology: tech,
      difficulty: level,
    },
    {
      id: "q3",
      type: "short_answer",
      question: `Briefly explain ${topic.title} in one sentence.`,
      options: [],
      code: null,
      expectedAnswer: `${topic.title} helps organize code`,
      topic: topic.title,
      technology: tech,
      difficulty: level,
    },
  ];
  return base;
}

async function generateMiniQuizQuestions(roadmap, topic, level, weakTopics) {
  const prompt = buildQuizPrompt(roadmap, topic, level, weakTopics);
  try {
    const raw = await generateResponse({
      history: [],
      message: prompt,
      language: "english",
      level,
      teachingMode: "quiz",
      learnerContext: "",
      codingContext: "",
    });
    const text = (raw.reply || "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON");
    const parsed = JSON.parse(text.slice(start, end + 1));
    let qs = parsed.questions || [];
    if (!Array.isArray(qs) || qs.length === 0) throw new Error("Empty");
    qs = qs.slice(0, 5).map((q, idx) => ({
      id: q.id || `q${idx + 1}`,
      type: ["multiple_choice", "true_false", "short_answer", "predict_output", "code"].includes(q.type) ? q.type : "multiple_choice",
      question: String(q.question || "").slice(0, 500),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => String(o).slice(0, 200)) : [],
      code: q.code ? String(q.code).slice(0, 500) : null,
      expectedAnswer: String(q.expectedAnswer || q.answer || "").slice(0, 500),
      topic: String(q.topic || topic.title).slice(0, 80),
      topicId: topic._id,
      technology: String(q.technology || "").slice(0, 40) || topic.title,
      difficulty: level,
    })).filter((q) => q.question && q.expectedAnswer);
    if (qs.length < 3) throw new Error("Too few");
    // ensure topicId
    qs.forEach((q) => { if (!q.topicId) q.topicId = topic._id; });
    return qs.slice(0, 5);
  } catch (e) {
    console.log("mini-quiz generation fallback:", e.message);
    return fallbackQuestions(topic, roadmap, level);
  }
}

async function evaluateAnswer(question, studentAnswer) {
  // Prefer backend validation for deterministic types
  const ans = String(studentAnswer || "").trim();
  const exp = String(question.expectedAnswer || "").trim();
  if (!ans) return { status: "incorrect", score: 0, explanation: "No answer provided.", missingConcept: question.topic };

  // Multiple choice / true_false exact match
  if (question.type === "multiple_choice" || question.type === "true_false") {
    const correct = ans.toLowerCase() === exp.toLowerCase();
    return {
      status: correct ? "correct" : "incorrect",
      score: correct ? 1 : 0,
      explanation: correct ? "Correct!" : `The correct answer is: ${exp}`,
      missingConcept: correct ? null : question.topic,
    };
  }

  // For other types, use AI
  try {
    const prompt = buildEvaluationPrompt(question, ans);
    const raw = await generateResponse({
      history: [],
      message: prompt,
      language: "english",
      level: "beginner",
      teachingMode: "quiz",
      learnerContext: "",
      codingContext: "",
    });
    const text = (raw.reply || "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON");
    const parsed = JSON.parse(text.slice(start, end + 1));
    const result = parsed.result || parsed.status;
    const status = ["correct", "partial", "incorrect", "unclear"].includes(result) ? result : result === "partially_correct" ? "partial" : "incorrect";
    const score = typeof parsed.score === "number" ? Math.max(0, Math.min(1, parsed.score)) : status === "correct" ? 1 : status === "partial" ? 0.5 : 0;
    return {
      status,
      score,
      explanation: String(parsed.explanation || parsed.feedback || "").slice(0, 300) || (status === "correct" ? "Correct!" : "Not quite."),
      missingConcept: parsed.missingConcept || (status !== "correct" ? question.topic : null),
    };
  } catch (e) {
    // Fallback simple string match
    const correct = ans.toLowerCase() === exp.toLowerCase();
    if (correct) return { status: "correct", score: 1, explanation: "Correct!" };
    // partial if contains expected substring
    if (exp && ans.toLowerCase().includes(exp.toLowerCase().slice(0, 8))) {
      return { status: "partial", score: 0.5, explanation: "You are on the right track, but check the details." };
    }
    return { status: "incorrect", score: 0, explanation: `Expected: ${exp}` };
  }
}

module.exports = {
  generateMiniQuizQuestions,
  evaluateAnswer,
  QUIZ_PASS_THRESHOLD,
  QUIZ_REVIEW_THRESHOLD,
};
