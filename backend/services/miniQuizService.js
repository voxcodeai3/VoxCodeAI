const { buildLearningRoadmap } = require("./roadmapService");
const { generateResponse } = require("./aiService");
const { isValidMcq, shuffleOptions, pickBankQuestionsForTopic } = require("./initialAssessmentService");

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

STRICT option rules for EVERY multiple_choice question:
- Provide exactly 4 options. Exactly one of them is correct.
- Every option must be plausible AND directly relevant to that specific question — believable wrong answers a beginner could pick.
- FORBIDDEN: "None of the above", "All of the above", "To manage unrelated data",
  "To handle <something>", "To bypass <something>", or any option built by swapping the topic name into a template.
- No duplicate options (case-insensitive). Shuffle the options and set expectedAnswer to the exact text of the correct option.

Return STRICTLY as minified JSON on a single line, no markdown fences:
{"questions":[{"id":"q1","type":"multiple_choice","question":"What will this print?","options":["10","11","Error","undefined"],"code":"let x=5;\\nconsole.log(x+5);","expectedAnswer":"10","topic":"${topic.title}","technology":"${techs.split(",")[0]?.trim() || "general"}"}, ...]}

For multiple_choice/true_false, provide 2-4 options and expectedAnswer must exactly equal one of them. For predict_output/code, include code snippet and expectedAnswer is the output.`;
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
  const techs = (roadmap.path.technologies || []).map((t) => t.name);
  const tech = techs[0] || "general";
  const stageTitle = (roadmap.stages.find((s) => (s.topics || []).some((t) => t.id.toString() === topic._id.toString())) || {}).title || "";
  // Topic-specific bank questions — each owns its own option array. No templates.
  const bank = pickBankQuestionsForTopic({
    topicTitle: topic.title,
    stageTitle,
    techNames: techs,
    pathTitle: roadmap.path.title,
    count: 3,
  }).map((b, i) => ({
    id: `q${i + 1}`,
    ...b,
    topic: topic.title,
    topicId: topic._id,
    technology: (topic.technologies && topic.technologies[0] && topic.technologies[0].name) || tech,
    difficulty: level,
  }));
  const out = [...bank];
  // One open-ended item for variety (no fake options attached)
  out.push({
    id: `q${out.length + 1}`,
    type: "short_answer",
    question: `Briefly explain ${topic.title} in one or two sentences, using your own words.`,
    options: [],
    code: null,
    expectedAnswer: `${topic.title}: key idea and one example`,
    topic: topic.title,
    topicId: topic._id,
    technology: tech,
    difficulty: level,
  });
  return out.slice(0, 4);
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
    // Drop broken MCQs (generic/template options, answer mismatch) and top up from the bank
    let valid = qs.filter((q) => q.type !== "multiple_choice" || isValidMcq(q));
    valid = valid.map((q) => (q.type === "multiple_choice" ? shuffleOptions(q) : q));
    if (valid.length < 3) {
      const seen = new Set(valid.map((v) => String(v.question).trim().toLowerCase()));
      const seenSets = new Set(valid.filter((v) => v.type === "multiple_choice").map((v) => [...v.options].sort().join("||")));
      const techs = (roadmap.path.technologies || []).map((t) => t.name);
      const stageTitle = (roadmap.stages.find((s) => (s.topics || []).some((t) => t.id.toString() === topic._id.toString())) || {}).title || "";
      const fill = pickBankQuestionsForTopic({
        topicTitle: topic.title, stageTitle, techNames: techs, pathTitle: roadmap.path.title,
        count: 4, excludeQuestions: [...seen],
      });
      for (const b of fill) {
        if (valid.length >= 4) break;
        const key = [...b.options].sort().join("||");
        if (seenSets.has(key)) continue;
        seenSets.add(key);
        valid.push({
          topic: topic.title, topicId: topic._id,
          technology: (topic.technologies && topic.technologies[0] && topic.technologies[0].name) || techs[0] || "general",
          difficulty: level, ...b,
        });
      }
    }
    if (valid.length < 3) throw new Error("Too few");
    // ensure topicId
    valid.forEach((q) => { if (!q.topicId) q.topicId = topic._id; });
    valid.forEach((q, i) => { q.id = `q${i + 1}`; });
    return valid.slice(0, 5);
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
  fallbackQuestions,
  QUIZ_PASS_THRESHOLD,
  QUIZ_REVIEW_THRESHOLD,
};
