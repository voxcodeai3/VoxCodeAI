/**
 * VoxCode Memory Service — extracts learning-relevant information from
 * user messages and builds structured learner context for the AI prompt.
 *
 * Philosophy: conservative updates. One mistake does not create a weakness.
 * Only store information that is genuinely useful for future tutoring.
 */

const PRIVACY_BLOCKLIST = [
  /password/i,
  /api[_\s]?key/i,
  /secret/i,
  /token/i,
  /credential/i,
  /credit[_\s]?card/i,
  /ssn/i,
  /social[_\s]?security/i,
];

/* ── Signal detection patterns ──────────────────────────────────────────── */

const GOAL_SIGNALS = [
  /(?:i(?:'m| am)\s+)?(?:preparing|getting ready|getting prepared)\s+(?:for|to)\s+(.+)/i,
  /(?:i want|want)\s+to\s+(?:learn|master|understand|get better at|improve)\s+(.+)/i,
  /(?:my goal|goal)\s+(?:is|:)\s*(.+)/i,
  /(?:i(?:'m| am)\s+)?(?:trying|attempting)\s+to\s+(?:learn|master|understand)\s+(.+)/i,
  /(?:i need|need)\s+to\s+(?:learn|master|understand)\s+(.+)/i,
];

const WEAKNESS_SIGNALS = [
  /(?:i(?:'m| am)\s+)?(?:struggling|struggle|having trouble|having a hard time|finding (?:it|this) (?:hard|difficult|confusing|tough))\s+(?:with|on|about)?\s*(.+)/i,
  /(?:i(?:'m| am)\s+)?(?:confused|lost|don'?t understand|do not understand|can'?t understand|cannot understand)\s+(?:about|on|with)?\s*(.+)/i,
  /(?:i(?:'m| am)\s+)?(?:not (?:really |completely )?(?:getting|understanding|grasping))\s+(.+)/i,
  /(?:explain|help me with)\s+(.+)/i,
  /(?:still|really|very)\s+(?:don'?t|do not)\s+understand\s+(.+)/i,
  /(?:this is|it'?s?)\s+(?:so |really |very )?(?:confusing|hard|difficult|tough)\s*(?:for me)?/i,
];

const STRENGTH_SIGNALS = [
  /(?:i(?:'m| am)\s+)?(?:getting|understanding|grasping|getting the hang of)\s+(.+)/i,
  /(?:i (?:now )?understand|got it|makes sense|clicks?|clicked|finally (?:got|understood))\s+(.+)/i,
  /(?:that was (?:clear|easy|simple|straightforward))\s*(.+)/i,
  /(?:i (?:can|could))\s+(?:now )?(?:do|use|write|build|implement)\s+(.+)/i,
];

const LANGUAGE_SIGNALS = [
  /(?:in|using|with)\s+(javascript|typescript|python|java|c\+\+|ruby|go|rust|php|swift|kotlin|html|css|sql|react|vue|angular|svelte|node\.?js|express|next\.?js|django|flask|spring)/i,
  /(?:learning|studying|practicing)\s+(javascript|typescript|python|java|c\+\+|ruby|go|rust|php|swift|kotlin|html|css|sql|react|vue|angular|svelte|node\.?js|express|next\.?js|django|flask|spring)/i,
];

const TOPIC_SIGNALS = [
  /(?:about|on|regarding|concerning|regarding)\s+(promises?|async(?:\/await)?|closures?|recursion|callbacks?|promises|destructuring|spread\s+operator|map|filter|reduce|hooks?|state\s+management|props|components?|api|rest|graphql|dom|events?|classes?|prototypes?|modules?|typescript|generics?|middleware|authentication|authorization|database|mongodb|sql|css\s+flexbox|css\s+grid|responsive|animation|testing|jest|vitest|git|docker)/i,
  /(?:can you )?(?:explain|teach|show|tell me about|help me with|walk me through)\s+(.+)/i,
];

/* ── Privacy filter ─────────────────────────────────────────────────────── */

function isPrivacySafe(text) {
  return !PRIVACY_BLOCKLIST.some((re) => re.test(text));
}

/* ── Extraction ─────────────────────────────────────────────────────────── */

function extractSignals(message) {
  if (!message || !isPrivacySafe(message)) return null;

  const extracted = {
    goals: [],
    weaknesses: [],
    strengths: [],
    languages: [],
    topics: [],
  };

  for (const pattern of GOAL_SIGNALS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      extracted.goals.push(match[1].trim().replace(/[.!?]+$/, ""));
    }
  }

  for (const pattern of WEAKNESS_SIGNALS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      extracted.weaknesses.push(match[1].trim().replace(/[.!?]+$/, ""));
    }
  }

  for (const pattern of STRENGTH_SIGNALS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      extracted.strengths.push(match[1].trim().replace(/[.!?]+$/, ""));
    }
  }

  for (const pattern of LANGUAGE_SIGNALS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      extracted.languages.push(match[1].trim());
    }
  }

  for (const pattern of TOPIC_SIGNALS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      extracted.topics.push(match[1].trim().replace(/[.!?]+$/, ""));
    }
  }

  return extracted;
}

/* ── Profile update (conservative) ──────────────────────────────────────── */

function addUnique(arr, items) {
  const lower = arr.map((s) => s.toLowerCase());
  for (const item of items) {
    const normalized = item.toLowerCase();
    if (!lower.includes(normalized)) {
      arr.push(item);
      lower.push(normalized);
    }
  }
}

function updateTopicProgress(profile, topics) {
  if (!topics.length) return;
  for (const topic of topics) {
    const normalized = topic.toLowerCase();
    const existing = profile.topicProgress.find(
      (tp) => tp.topic.toLowerCase() === normalized
    );
    if (existing) {
      existing.attempts += 1;
      existing.lastPracticed = new Date();
    } else {
      profile.topicProgress.push({
        topic,
        confidence: 0.4,
        attempts: 1,
        lastPracticed: new Date(),
      });
    }
  }
}

/**
 * Conservatively update a learner profile from extracted signals.
 * Only adds information — never removes or overrides explicit user data.
 */
function updateProfile(profile, signals) {
  if (!signals) return false;

  let changed = false;

  if (signals.goals.length) {
    addUnique(profile.learningGoals, signals.goals);
    changed = true;
  }

  if (signals.weaknesses.length) {
    addUnique(profile.weaknesses, signals.weaknesses);
    changed = true;
  }

  if (signals.strengths.length) {
    addUnique(profile.strengths, signals.strengths);
    changed = true;
  }

  if (signals.languages.length) {
    addUnique(profile.preferredLanguages, signals.languages);
    changed = true;
  }

  if (signals.topics.length) {
    addUnique(profile.currentTopics, signals.topics);
    updateTopicProgress(profile, signals.topics);
    changed = true;
  }

  return changed;
}

/* ── Context builder ────────────────────────────────────────────────────── */

/**
 * Build a structured learner context block for the AI system prompt.
 * @param {object} profile - Mongoose LearnerProfile document (or plain object)
 * @returns {string} formatted context block, or empty string if no profile
 */
function buildLearnerContext(profile) {
  if (!profile) return "";

  const parts = [];

  if (profile.experienceLevel) {
    parts.push(`Experience level: ${profile.experienceLevel}`);
  }

  if (profile.preferredLanguages?.length) {
    parts.push(`Preferred languages: ${profile.preferredLanguages.join(", ")}`);
  }

  if (profile.learningGoals?.length) {
    parts.push(`Learning goals: ${profile.learningGoals.join("; ")}`);
  }

  if (profile.strengths?.length) {
    parts.push(`Strong areas: ${profile.strengths.join(", ")}`);
  }

  if (profile.weaknesses?.length) {
    parts.push(`Weak areas: ${profile.weaknesses.join(", ")}`);
  }

  if (profile.preferredTeachingStyle) {
    const styleLabels = {
      step_by_step: "step-by-step",
      socratic: "Socratic method (ask guiding questions)",
      example_first: "examples before theory",
      concise: "brief and to the point",
      detailed: "thorough and detailed",
      practice_focused: "hands-on practice exercises",
    };
    parts.push(`Teaching style: ${styleLabels[profile.preferredTeachingStyle] || profile.preferredTeachingStyle}`);
  }

  if (profile.currentTopics?.length) {
    parts.push(`Currently exploring: ${profile.currentTopics.join(", ")}`);
  }

  if (profile.topicProgress?.length) {
    const progressLines = profile.topicProgress
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8)
      .map((tp) => {
        const level =
          tp.confidence >= 0.7
            ? "comfortable"
            : tp.confidence >= 0.4
              ? "learning"
              : "struggling";
        return `  - ${tp.topic}: ${level} (practiced ${tp.attempts}x)`;
      });
    if (progressLines.length) {
      parts.push(`Topic progress:\n${progressLines.join("\n")}`);
    }
  }

  if (!parts.length) return "";

  return `\n\nLEARNER PROFILE:\n${parts.join("\n")}`;
}

/**
 * Build a conversation summary for long conversations.
 * @param {Array} messages - conversation messages array
 * @returns {string} short summary of topics discussed
 */
function buildConversationSummary(messages) {
  if (!messages || messages.length < 10) return null;

  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  const words = userMessages.split(/\s+/).filter(Boolean);
  const keyPhrases = [];
  const seen = new Set();

  const topicKeywords = [
    "javascript", "typescript", "python", "java", "react", "node",
    "promise", "async", "await", "closure", "callback", "hook",
    "state", "component", "api", "rest", "database", "css",
    "html", "dom", "event", "class", "function", "variable",
    "array", "object", "loop", "recursion", "typescript", "git",
    "test", "debug", "deploy", "docker", "mongodb", "sql",
  ];

  for (const word of words) {
    const lower = word.toLowerCase().replace(/[^a-z]/g, "");
    if (topicKeywords.includes(lower) && !seen.has(lower)) {
      seen.add(lower);
      keyPhrases.push(lower);
    }
  }

  if (keyPhrases.length === 0) return null;

  return `This conversation covered: ${keyPhrases.slice(0, 8).join(", ")}.`;
}

/* ── Topic mastery updates from practice/quiz results ──────────────────── */

/**
 * Update topic progress in a learner profile based on practice results.
 * Conservative: multiple data points needed before significant changes.
 * @param {object} profile - Mongoose LearnerProfile document
 * @param {string} topic - topic name
 * @param {boolean} correct - whether the answer was correct
 * @param {number} score - 0.0 to 1.0
 */
function updateTopicMastery(profile, topic, correct, score = 0) {
  if (!profile || !topic) return;

  const normalized = topic.toLowerCase();
  let tp = profile.topicProgress.find((t) => t.topic.toLowerCase() === normalized);

  if (!tp) {
    tp = { topic, confidence: 0.5, attempts: 0, correct: 0, incorrect: 0, lastPracticed: new Date() };
    profile.topicProgress.push(tp);
  }

  tp.attempts += 1;
  tp.lastPracticed = new Date();

  if (correct) {
    tp.correct = (tp.correct || 0) + 1;
    // Gradually increase confidence.
    tp.confidence = Math.min(1, tp.confidence + 0.05 * score);
  } else {
    tp.incorrect = (tp.incorrect || 0) + 1;
    // Gradually decrease confidence.
    tp.confidence = Math.max(0, tp.confidence - 0.08);
  }

  // Update strengths/weaknesses based on confidence.
  if (tp.confidence >= 0.7) {
    // Add to strengths if not already there, remove from weaknesses.
    addUnique(profile.strengths, [topic]);
    profile.weaknesses = profile.weaknesses.filter((w) => w.toLowerCase() !== normalized);
  } else if (tp.confidence <= 0.3) {
    // Add to weaknesses if not already there, remove from strengths.
    addUnique(profile.weaknesses, [topic]);
    profile.strengths = profile.strengths.filter((s) => s.toLowerCase() !== normalized);
  }
}

module.exports = {
  extractSignals,
  updateProfile,
  buildLearnerContext,
  buildConversationSummary,
  isPrivacySafe,
  updateTopicMastery,
};
