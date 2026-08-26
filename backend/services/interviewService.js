/**
 * VoxCode Interview Service — AI-powered mock interview system.
 *
 * Handles interview question generation, answer evaluation, follow-ups,
 * and final evaluation using the existing multi-model failover system.
 */

const {
  modelManager,
  categorizeError,
  isRetryable,
} = require("./modelManager");

const REQUEST_TIMEOUT_MS = 60000;

/* ── Interview system prompt ───────────────────────────────────────────── */

const INTERVIEWER_SYSTEM_PROMPT = `You are VoxCode Interviewer, a professional AI technical interviewer conducting a live interview.

CRITICAL: You are speaking DIRECTLY to the candidate face-to-face. Use "you" and "your". NEVER use "the candidate" or speak in third person. Keep responses short (1-3 sentences). Be natural and conversational.

RULES:
- If they say "I don't know", say: "No problem, let's move on." Then ask a new question.
- After they answer, briefly acknowledge and ask a follow-up OR move to the next question.
- Do NOT reveal correct answers during the interview.
- Do NOT say "Great job!" after every answer.
- Do NOT write evaluations, scores, or clinical feedback during the interview.
- For coding questions, ask about complexity and edge cases as follow-ups.
- Adapt difficulty: easier if struggling, harder if doing well.

SPEAK NATURALLY. YOU ARE A HUMAN INTERVIEWER.`;

/* ── HTTP helper ────────────────────────────────────────────────────────── */

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ── Provider call dispatch ────────────────────────────────────────────── */

async function callModel(model, { systemPrompt, history, message }) {
  const provider = (model.provider || "").toLowerCase();
  let baseUrl;
  const extraHeaders = {};

  if (provider === "openrouter") {
    baseUrl = model.baseUrl || "https://openrouter.ai/api/v1";
    extraHeaders["HTTP-Referer"] = process.env.FRONTEND_URL || "http://localhost:5173";
  } else if (provider === "openai") {
    baseUrl = model.baseUrl || "https://api.openai.com/v1";
  } else {
    baseUrl = model.baseUrl;
    if (!baseUrl) {
      const err = new Error("AI_BASE_URL is required for the 'compatible' provider.");
      err.code = "AI_NOT_CONFIGURED";
      throw err;
    }
  }

  const res = await fetchWithTimeout(
    `${baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model: model.name || "gpt-4o-mini",
        temperature: 0.6,
        max_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
          { role: "user", content: message },
        ],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`AI API error ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/* ── Response parsing ──────────────────────────────────────────────────── */

function extractJson(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/* ── Core AI functions with failover ──────────────────────────────────── */

async function callAIWithFailover(systemPrompt, history, message) {
  modelManager.init();
  if (modelManager.size === 0) {
    const err = new Error("AI_NOT_CONFIGURED");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }

  for (let attempt = 0; attempt < modelManager.size; attempt++) {
    const model = modelManager.select();
    if (!model) break;

    try {
      const raw = await callModel(model, { systemPrompt, history, message });
      modelManager.release(model.id);
      return raw;
    } catch (err) {
      const category = categorizeError(err);
      if (category === "RATE_LIMITED") {
        modelManager.markRateLimited(model.id, category);
        continue;
      }
      if (isRetryable(category)) {
        modelManager.markError(model.id, category);
        continue;
      }
      modelManager.markUnavailable(model.id, category);
      if (modelManager.size === 1) throw err;
    }
  }

  const err = new Error("All configured AI models are temporarily unavailable.");
  err.code = "ALL_MODELS_UNAVAILABLE";
  throw err;
}

/**
 * Generate the first interview question or a new question.
 * Never throws — returns a fallback question on AI failure.
 */
async function generateQuestion({ type, difficulty, language, focusArea, history, learnerContext = "" }) {
  const prompt = `You are an interviewer speaking to a candidate. Generate a ${difficulty || "intermediate"} level ${type || "general_software"} interview question about ${language || "javascript"}.
${focusArea ? `Focus area: ${focusArea}` : ""}

The question will be displayed as text the candidate reads. Make it realistic and specific. For the first question, start with something appropriate for the difficulty level.`;

  try {
    const raw = await callAIWithFailover(INTERVIEWER_SYSTEM_PROMPT, history || [], prompt);
    const parsed = extractJson(raw);

    if (!parsed || parsed.type === "evaluation" || parsed.type === "final") {
      return {
        question: String(raw || "Tell me about your experience with this technology."),
        type: "conceptual",
        topic: focusArea || type || "general",
        difficulty: difficulty || "medium",
        expectedConcepts: [],
        evaluationCriteria: null,
        code: null,
      };
    }

    return {
      question: parsed.question || "Tell me about yourself in the context of this role.",
      type: ["conceptual", "coding", "debugging", "system_design", "behavioral", "output_prediction"].includes(parsed.type) ? parsed.type : "conceptual",
      topic: parsed.topic || focusArea || type || "general",
      difficulty: ["easy", "medium", "hard"].includes(parsed.difficulty) ? parsed.difficulty : "medium",
      expectedConcepts: Array.isArray(parsed.expectedConcepts) ? parsed.expectedConcepts : [],
      evaluationCriteria: parsed.evaluationCriteria || null,
      code: parsed.code || parsed.starterCode || null,
      hints: [],
      solution: null,
    };
  } catch (err) {
    console.error("generateQuestion AI failed, using fallback:", err.message);
    // Fallback questions based on type and difficulty.
    const fallbacks = {
      frontend: [
        "Can you explain the difference between `let`, `const`, and `var` in JavaScript?",
        "How does the virtual DOM work in React?",
        "What is event delegation and when would you use it?",
        "Explain CSS specificity. How do you override inline styles?",
      ],
      backend: [
        "What is middleware in Express.js?",
        "Explain the difference between SQL and NoSQL databases.",
        "How would you design a RESTful API for a todo application?",
        "What is connection pooling and why is it important?",
      ],
      javascript: [
        "What is a closure? Can you give an example?",
        "Explain the event loop in JavaScript.",
        "What is the difference between `==` and `===`?",
        "How does prototypal inheritance work?",
      ],
    };
    const pool = fallbacks[type] || fallbacks.javascript;
    const question = pool[Math.floor(Math.random() * pool.length)];
    return {
      question,
      type: "conceptual",
      topic: focusArea || type || "general",
      difficulty: difficulty || "medium",
      expectedConcepts: [],
      evaluationCriteria: null,
      code: null,
      hints: [],
      solution: null,
    };
  }
}

/**
 * Evaluate a candidate's answer to an interview question.
 * Never throws — returns a neutral evaluation on AI failure.
 */
async function evaluateAnswer({ question, type, expectedConcepts, evaluationCriteria, candidateAnswer, difficulty, history, learnerContext = "" }) {
  const prompt = `You are an interviewer evaluating a candidate's answer. Score it 0-10.

Question: ${question}
Candidate answer: ${candidateAnswer}
${expectedConcepts?.length ? `Key concepts: ${expectedConcepts.join(", ")}` : ""}

Return ONLY this JSON (no markdown):
{"score":<0-10>,"result":"<strong|mostly_correct|partially_correct|weak|incorrect>","feedback":"<1-2 sentence conversational response TO the candidate>","followUp":<null or a follow-up question>}

CRITICAL: The "feedback" field is what you will SAY OUT LOUD to the candidate. Write it as if you are speaking to them directly. Use "you". Never use "the candidate". Examples of good feedback:
- "Good, that makes sense. Let's try something different."
- "I see what you mean. Can you go a bit deeper on that?"
- "That's close but not quite. The key thing is..."
- "No worries. Let's move on to the next topic."
- "Interesting approach. What about edge cases?"`;

  // Handle "I don't know" — skip AI call, return conversational response.
  const dontKnowPatterns = /^(i don'?t know|i do not know|idk|no idea|not sure|dunno|no clue)/i;
  if (dontKnowPatterns.test(String(candidateAnswer).trim())) {
    return {
      score: 2,
      result: "weak",
      feedback: "No problem, let's move on.",
      followUp: null,
      complexityNote: null,
    };
  }

  try {
    const raw = await callAIWithFailover(INTERVIEWER_SYSTEM_PROMPT, history || [], prompt);
    const parsed = extractJson(raw);

    if (!parsed || parsed.type !== "evaluation") {
      return {
        score: 5,
        result: "partially_correct",
        feedback: "Could not fully evaluate the response.",
        followUp: null,
        complexityNote: null,
      };
    }

    return {
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(10, parsed.score)) : 5,
      result: ["strong", "mostly_correct", "partially_correct", "weak", "incorrect"].includes(parsed.result) ? parsed.result : "partially_correct",
      feedback: parsed.feedback || "No feedback available.",
      followUp: parsed.followUp || null,
      complexityNote: parsed.complexityNote || null,
    };
  } catch (err) {
    console.error("evaluateAnswer AI failed, using fallback:", err.message);
    // Score based on answer length as a basic heuristic.
    const len = (candidateAnswer || "").length;
    const score = len > 200 ? 6 : len > 100 ? 5 : len > 30 ? 4 : 3;
    return {
      score,
      result: score >= 6 ? "mostly_correct" : score >= 4 ? "partially_correct" : "weak",
      feedback: "AI evaluation unavailable. Your response has been recorded.",
      followUp: null,
      complexityNote: null,
    };
  }
}

/**
 * Generate a follow-up question based on the candidate's last answer.
 * Never throws — returns null on AI failure (no follow-up).
 */
async function generateFollowUp({ question, candidateAnswer, difficulty, history, learnerContext = "" }) {
  const prompt = `The candidate just answered: "${candidateAnswer}"
Original question: ${question}

You are the interviewer speaking DIRECTLY to the candidate. Generate ONE brief follow-up question. Start with a short acknowledgment (like "Good" or "I see" or "Makes sense"), then ask the follow-up. Keep it to 1-2 sentences total.`;

  try {
    const raw = await callAIWithFailover(INTERVIEWER_SYSTEM_PROMPT, history || [], prompt);
    const parsed = extractJson(raw);

    if (parsed && (parsed.type === "follow_up" || parsed.type === "question")) {
      return {
        question: parsed.question,
        topic: parsed.topic || null,
        difficulty: parsed.difficulty || difficulty || "medium",
      };
    }

    return {
      question: String(raw || "Can you elaborate on that?").slice(0, 300),
      topic: null,
      difficulty: difficulty || "medium",
    };
  } catch (err) {
    console.error("generateFollowUp AI failed:", err.message);
    return null;
  }
}

/**
 * Generate the final interview evaluation and feedback.
 * Never throws — returns a basic evaluation on AI failure.
 */
async function generateFinalEvaluation({ type, difficulty, language, evaluations, history, learnerContext = "" }) {
  const evalSummary = evaluations.map((e, i) =>
    `Q${i + 1}: Score ${e.score}/10 (${e.result}) — ${e.feedback || "No feedback"}`
  ).join("\n");

  const prompt = `The interview is complete. Generate the final evaluation.

Interview type: ${type}
Difficulty: ${difficulty}
Language: ${language}
${learnerContext ? `Candidate profile: ${learnerContext}` : ""}

Question evaluations:
${evalSummary}

Generate overall scores (0-100) and detailed feedback. Be honest and constructive.`;

  try {
    const raw = await callAIWithFailover(INTERVIEWER_SYSTEM_PROMPT, history || [], prompt);
    const parsed = extractJson(raw);

    if (parsed && parsed.type === "final") {
      return {
        technicalScore: typeof parsed.technicalScore === "number" ? Math.max(0, Math.min(100, parsed.technicalScore)) : 50,
        problemSolvingScore: typeof parsed.problemSolvingScore === "number" ? Math.max(0, Math.min(100, parsed.problemSolvingScore)) : 50,
        communicationScore: typeof parsed.communicationScore === "number" ? Math.max(0, Math.min(100, parsed.communicationScore)) : 50,
        codeQualityScore: typeof parsed.codeQualityScore === "number" ? Math.max(0, Math.min(100, parsed.codeQualityScore)) : 50,
        overallScore: typeof parsed.overallScore === "number" ? Math.max(0, Math.min(100, parsed.overallScore)) : 50,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        areasToImprove: Array.isArray(parsed.areasToImprove) ? parsed.areasToImprove : [],
        technicalGaps: Array.isArray(parsed.technicalGaps) ? parsed.technicalGaps : [],
        communicationFeedback: parsed.communicationFeedback || null,
        codingFeedback: parsed.codingFeedback || null,
        recommendedTopics: Array.isArray(parsed.recommendedTopics) ? parsed.recommendedTopics : [],
      };
    }
  } catch (err) {
    console.error("generateFinalEvaluation AI failed, using fallback:", err.message);
  }

  // Fallback evaluation based on actual scores.
  const avgScore = evaluations.length
    ? Math.round(evaluations.reduce((s, e) => s + (e.score || 5), 0) / evaluations.length * 10)
    : 50;

  return {
    technicalScore: avgScore,
    problemSolvingScore: avgScore,
    communicationScore: avgScore,
    codeQualityScore: avgScore,
    overallScore: avgScore,
    strengths: ["Completed the interview"],
    areasToImprove: ["Review topics covered"],
    technicalGaps: [],
    communicationFeedback: null,
    codingFeedback: null,
    recommendedTopics: [],
  };
}

module.exports = {
  generateQuestion,
  evaluateAnswer,
  generateFollowUp,
  generateFinalEvaluation,
};
