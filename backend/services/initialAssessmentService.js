const { buildLearningRoadmap } = require("./roadmapService");
const { generateResponse } = require("./aiService");

// Build a compact roadmap summary for the AI prompt
function roadmapToPrompt(roadmap) {
  const techs = (roadmap.path.technologies || []).map((t) => t.name).join(", ") || "general programming";
  const stagesSummary = roadmap.stages
    .map((s) => `Stage ${s.order + 1}: ${s.title} (${s.level}) - Topics: ${s.topics.map((t) => t.title).join(", ")}`)
    .join("\n");
  const flat = roadmap.flatTopics.map((t) => `${t.title} (${t.stageTitle})`).join(", ");
  return { techs, stagesSummary, flat, pathTitle: roadmap.path.title, difficulty: roadmap.path.difficulty };
}

function buildGenerationPrompt(roadmap) {
  const { techs, stagesSummary, pathTitle } = roadmapToPrompt(roadmap);
  return `You are creating an initial knowledge assessment for a student who selected the learning goal: ${pathTitle}.

Relevant technologies: ${techs}
Roadmap:
${stagesSummary}

Task: Generate 6-8 short assessment questions (5-10 is OK) that cover prerequisite knowledge for this path. Include a mix of:
- multiple_choice (with 4 options)
- short_answer or conceptual (1-2 sentences)
- predict_output or code (small snippet)

Rules:
- Questions must be relevant to the path's technologies and roadmap topics.
- Keep each question concise and beginner-to-intermediate friendly.
- Do NOT invent topics outside the roadmap.
- Return STRICTLY as minified JSON on a single line, no markdown fences:
{"questions":[{"id":"q1","type":"multiple_choice","question":"...","options":["A","B","C","D"],"code":null,"expectedAnswer":"A","topic":"Variables","technology":"JavaScript"}, ...]}

For multiple_choice, expectedAnswer must be one of the options. For other types, expectedAnswer is the correct short answer.
Include topic and technology for each question.`;
}

function buildEvaluationPrompt(roadmap, questions, answers) {
  const { pathTitle, techs } = roadmapToPrompt(roadmap);
  const qa = questions
    .map((q, idx) => {
      const ans = answers.find((a) => a.questionId === q.id);
      return `Q${idx + 1} [${q.technology || "general"} - ${q.topic || "general"}] ${q.question}\nExpected: ${q.expectedAnswer || "N/A"}\nStudent: ${ans?.answer || "(no answer)"}`;
    })
    .join("\n\n");

  return `You are evaluating an initial assessment for learning goal: ${pathTitle} (technologies: ${techs}).

Questions and student answers:
${qa}

Task: Determine the student's approximate knowledge level and recommend where to start.
Return STRICTLY as minified JSON on a single line, no markdown fences:
{"overallLevel":"beginner|intermediate|advanced","technologyLevels":[{"technology":"JavaScript","level":"beginner|intermediate|advanced"}],"strengths":["topic1","topic2"],"weaknesses":[{"topic":"React State","reason":"struggled with ..."}],"recommendedStartingTopic":"<topic title from roadmap>","notes":"brief summary"}

Rules:
- overallLevel is approximate, be conservative (don't mark advanced unless most answers correct).
- technologyLevels should cover each major technology once.
- strengths: topics answered well.
- weaknesses: topics missed, with short reason.
- recommendedStartingTopic must be a topic title that exists in the roadmap (choose from: ${roadmap.flatTopics.map((t) => t.title).join(", ")}).
- Be kind and concise.`;
}

// Fallback questions from roadmap topics when AI fails
function fallbackQuestions(roadmap) {
  const techs = roadmap.path.technologies || [];
  const topics = roadmap.flatTopics.slice(0, 8);
  const fallback = topics.map((t, idx) => ({
    id: `q${idx + 1}`,
    type: "multiple_choice",
    question: `What is the primary purpose of ${t.title} in ${t.stageTitle}?`,
    options: [`To handle ${t.title.toLowerCase()}`, `To manage unrelated data`, `To bypass ${t.stageTitle}`, `None of the above`],
    code: null,
    expectedAnswer: `To handle ${t.title.toLowerCase()}`,
    topic: t.title,
    topicId: t.id,
    technology: t.technologies?.[0]?.name || techs[0]?.name || "general",
  }));
  // Ensure 5-8
  if (fallback.length < 5) {
    const extra = [
      {
        id: `q${fallback.length + 1}`,
        type: "conceptual",
        question: `Briefly explain what ${roadmap.path.title} is used for.`,
        options: [],
        code: null,
        expectedAnswer: `${roadmap.path.title} is used for building applications`,
        topic: roadmap.path.title,
        technology: techs[0]?.name || "general",
      },
    ];
    fallback.push(...extra);
  }
  return fallback.slice(0, 8);
}

async function generateQuestions(roadmap) {
  const prompt = buildGenerationPrompt(roadmap);
  try {
    const raw = await generateResponse({
      history: [],
      message: prompt,
      language: "english",
      level: "beginner",
      teachingMode: "assessment",
      learnerContext: "",
      codingContext: "",
    });
    // raw.reply should be JSON string with {questions: [...]}
    const text = (raw.reply || "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON");
    const parsed = JSON.parse(text.slice(start, end + 1));
    let qs = parsed.questions || parsed.items || [];
    if (!Array.isArray(qs) || qs.length === 0) throw new Error("Empty questions");
    // Normalize to 5-10
    qs = qs.slice(0, 10).map((q, idx) => ({
      id: q.id || `q${idx + 1}`,
      type: ["multiple_choice", "short_answer", "predict_output", "code", "conceptual", "true_false"].includes(q.type) ? q.type : "multiple_choice",
      question: String(q.question || "").slice(0, 500),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map((o) => String(o).slice(0, 200)) : [],
      code: q.code ? String(q.code).slice(0, 500) : null,
      expectedAnswer: String(q.expectedAnswer || q.answer || q.correctAnswer || "").slice(0, 500),
      topic: String(q.topic || "").slice(0, 80),
      topicId: q.topicId || null,
      technology: String(q.technology || "").slice(0, 40),
    })).filter((q) => q.question);
    if (qs.length < 5) throw new Error("Too few questions");
    // Map topic titles to actual topicIds from roadmap for validation
    for (const q of qs) {
      const match = roadmap.flatTopics.find((t) => t.title.toLowerCase() === q.topic.toLowerCase());
      if (match) q.topicId = match.id;
    }
    return qs.slice(0, 8);
  } catch (e) {
    console.log("AI question generation failed, using fallback:", e.message);
    return fallbackQuestions(roadmap);
  }
}

async function evaluateAssessment(roadmap, questions, answers) {
  const prompt = buildEvaluationPrompt(roadmap, questions, answers);
  try {
    const raw = await generateResponse({
      history: [],
      message: prompt,
      language: "english",
      level: "beginner",
      teachingMode: "assessment",
      learnerContext: "",
      codingContext: "",
    });
    const text = (raw.reply || "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON");
    const parsed = JSON.parse(text.slice(start, end + 1));
    // Validate
    let overallLevel = ["beginner", "intermediate", "advanced"].includes(parsed.overallLevel) ? parsed.overallLevel : "beginner";
    let techLevels = Array.isArray(parsed.technologyLevels) ? parsed.technologyLevels : [];
    techLevels = techLevels
      .map((tl) => ({
        technology: String(tl.technology || "").slice(0, 40),
        level: ["beginner", "intermediate", "advanced"].includes(tl.level) ? tl.level : "beginner",
      }))
      .filter((tl) => tl.technology);
    // Ensure at least path techs are represented
    if (techLevels.length === 0) {
      const techs = (roadmap.path.technologies || []).map((t) => t.name).slice(0, 4);
      techLevels = techs.map((tech) => ({ technology: tech, level: overallLevel }));
    }
    let strengths = Array.isArray(parsed.strengths) ? parsed.strengths.map((s) => String(s).slice(0, 80)).slice(0, 5) : [];
    let weaknesses = Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses.map((w) => ({
          topic: String(w.topic || w.topicName || "").slice(0, 80),
          topicName: String(w.topic || w.topicName || "").slice(0, 80),
          reason: String(w.reason || "").slice(0, 150),
        })).filter((w) => w.topic)
      : [];
    let recommended = String(parsed.recommendedStartingTopic || "").trim();
    // Validate recommended topic belongs to roadmap
    let recTopic = roadmap.flatTopics.find((t) => t.title.toLowerCase() === recommended.toLowerCase());
    if (!recTopic) {
      // heuristic: if overall beginner, start at first topic; intermediate -> middle; advanced -> later stage
      if (overallLevel === "beginner") recTopic = roadmap.flatTopics[0];
      else if (overallLevel === "intermediate") recTopic = roadmap.flatTopics[Math.min(2, Math.floor(roadmap.flatTopics.length / 3))];
      else recTopic = roadmap.flatTopics[Math.min(5, Math.floor(roadmap.flatTopics.length / 2))];
    }
    return {
      overallLevel,
      technologyLevels: techLevels,
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 5),
      recommendedStartingTopic: recTopic ? recTopic.id : null,
      recommendedStartingTopicTitle: recTopic ? recTopic.title : null,
      recommendedStage: recTopic ? roadmap.stages.find((s) => s.id.toString() === recTopic.stageId?.toString())?.id || null : null,
      notes: String(parsed.notes || "").slice(0, 300),
    };
  } catch (e) {
    console.log("AI evaluation failed, using heuristic:", e.message);
    // Heuristic fallback
    const correctCount = answers.filter((a) => {
      const q = questions.find((qq) => qq.id === a.questionId);
      if (!q || !q.expectedAnswer) return false;
      return String(a.answer || "").trim().toLowerCase() === String(q.expectedAnswer).trim().toLowerCase();
    }).length;
    const total = questions.length;
    const ratio = total ? correctCount / total : 0;
    let overallLevel = "beginner";
    if (ratio >= 0.7) overallLevel = "advanced";
    else if (ratio >= 0.4) overallLevel = "intermediate";
    const techs = (roadmap.path.technologies || []).map((t) => t.name);
    const techLevels = techs.slice(0, 4).map((tech) => ({ technology: tech, level: overallLevel }));
    const strengths = correctCount > 0 ? questions.filter((q) => answers.find((a) => a.questionId === q.id && String(a.answer).trim().toLowerCase() === String(q.expectedAnswer).trim().toLowerCase())).map((q) => q.topic).slice(0, 3) : [];
    const weaknesses = questions.filter((q) => {
      const a = answers.find((ans) => ans.questionId === q.id);
      return !a || String(a.answer).trim().toLowerCase() !== String(q.expectedAnswer).trim().toLowerCase();
    }).slice(0, 3).map((q) => ({ topic: q.topic, topicName: q.topic, reason: `Missed ${q.topic}` }));
    let recTopic = null;
    if (overallLevel === "beginner") recTopic = roadmap.flatTopics[0];
    else if (overallLevel === "intermediate") recTopic = roadmap.flatTopics[Math.floor(roadmap.flatTopics.length / 3)];
    else recTopic = roadmap.flatTopics[Math.floor(roadmap.flatTopics.length / 2)];
    return {
      overallLevel,
      technologyLevels: techLevels,
      strengths,
      weaknesses,
      recommendedStartingTopic: recTopic ? recTopic.id : null,
      recommendedStartingTopicTitle: recTopic ? recTopic.title : null,
      recommendedStage: recTopic ? roadmap.stages.find((s) => s.id.toString() === recTopic.stageId?.toString())?.id || null : null,
      notes: `Heuristic: ${correctCount}/${total} correct`,
    };
  }
}

module.exports = { generateQuestions, evaluateAssessment, buildGenerationPrompt, buildEvaluationPrompt };
