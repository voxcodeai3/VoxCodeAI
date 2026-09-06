const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");
const { Lesson } = require("../models/Course");
const { buildLearningRoadmap } = require("./roadmapService");
const { generateResponse } = require("./aiService");

function blockText(block) {
  if (!block) return "";
  if (typeof block === "string") return block;
  return block.content || "";
}

function starterForTech(techName, topicTitle) {
  const t = (techName || "").toLowerCase();
  if (t.includes("python")) {
    return `# Practice: ${topicTitle}\n# Write your solution below and run it.\n\ndef solution():\n    # TODO: implement\n    pass\n\nif __name__ == "__main__":\n    print(solution())\n`;
  }
  if (t.includes("java") && !t.includes("javascript")) {
    return `// Practice: ${topicTitle}\npublic class Main {\n    public static void main(String[] args) {\n        // TODO: implement\n        System.out.println("TODO");\n    }\n}\n`;
  }
  // default: javascript
  return `// Practice: ${topicTitle}\n// Write your solution below and run it.\n\nfunction solution() {\n  // TODO: implement\n  return null;\n}\n\nconsole.log(solution());\n`;
}

function fileNameForTech(techName, topicTitle) {
  const t = (techName || "").toLowerCase();
  const slug = (topicTitle || "exercise").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "exercise";
  if (t.includes("python")) return `practice-${slug}.py`;
  if (t.includes("java") && !t.includes("javascript")) return `Practice${slug.split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("")}.java`;
  return `practice-${slug}.js`;
}

function languageForTech(techName, fileName) {
  const t = (techName || "").toLowerCase();
  if (t.includes("python") || fileName.endsWith(".py")) return "python";
  if ((t.includes("java") && !t.includes("javascript")) || fileName.endsWith(".java")) return "java";
  return "javascript";
}

// Select exercise for a topic: prefer existing Lesson.exercises, else deterministic fallback.
// Returns full exercise object; `includeSolution` controls whether solution is attached.
async function getPracticeExercise({ pathId, topicId, level }) {
  const roadmap = await buildLearningRoadmap(pathId);
  const flat = roadmap.flatTopics.find((t) => t.id.toString() === topicId.toString());
  if (!flat) {
    const e = new Error("Topic does not belong to path");
    e.status = 400;
    throw e;
  }
  const topic = await Topic.findById(topicId).populate("technologies", "name slug type").lean();
  if (!topic) {
    const e = new Error("Topic not found");
    e.status = 404;
    throw e;
  }
  const stage = await Stage.findById(topic.stage).lean();
  const path = await LearningPath.findById(pathId).lean();
  const techName = topic.technologies?.[0]?.name || roadmap.path.technologies?.[0]?.name || "JavaScript";
  const studentLevel = level || "beginner";

  // Prefer existing predefined lesson exercises for this topic
  const lesson = await Lesson.findOne({ topic: topic._id, status: "published" }).sort({ order: 1 }).lean();
  let title = `Practice: ${topic.title}`;
  let instructions = `Apply "${topic.title}" from ${stage?.title || path?.title || "your path"}. Write code in the workspace, run it, then ask the AI for feedback.`;
  let starterCode = starterForTech(techName, topic.title);
  let hints = [
    "Break the task into the smallest step first, then run.",
    "Check the exact function/variable names the instructions ask for.",
    "Read the error message line by line — it points at the failing line.",
  ];
  let solution = null;
  let expectedBehavior = "Code runs without errors and demonstrates the topic concept.";
  let exerciseId = null;
  let lessonId = lesson?._id || null;

  if (lesson?.exercises?.length) {
    const ex = lesson.exercises[0];
    exerciseId = `${lesson._id}:0`;
    title = ex.title || `Practice: ${topic.title}`;
    instructions = blockText(ex) || instructions;
    if (lesson.examples?.length) starterCode = blockText(lesson.examples[0]);
    if (lesson.commonMistakes?.length) hints = lesson.commonMistakes.slice(0, 3);
    if (lesson.examples?.length > 1) solution = blockText(lesson.examples[1]);
    else if (lesson.content?.length) solution = null;
    expectedBehavior = lesson.checkpoint || expectedBehavior;
  } else {
    if (lesson) exerciseId = `${lesson._id}:fallback`;
    else exerciseId = `${topic._id}:fallback`;
    // Deterministic topic-aware fallback
    instructions = `Practice "${topic.title}" (${stage?.title || ""}): write a small program that demonstrates the concept. Run it, check the output, then submit.`;
    if (lesson?.objective) instructions = `${lesson.objective}\n\nWrite code below, run it, then submit.`;
    if (lesson?.content?.length) {
      const firstText = lesson.content.find((c) => (c.content || "").trim());
      if (firstText) instructions = `${blockText(firstText).slice(0, 400)}\n\nWrite code below, run it, then submit.`;
    }
  }

  const fileName = fileNameForTech(techName, topic.title);
  const language = languageForTech(techName, fileName);

  return {
    exerciseId,
    pathId: path._id,
    stageId: stage?._id || null,
    topicId: topic._id,
    lessonId,
    technology: techName,
    language,
    fileName,
    title,
    instructions,
    difficulty: studentLevel,
    starterCode,
    hints,
    solution, // caller decides whether to expose
    expectedBehavior,
    topicTitle: topic.title,
    stageTitle: stage?.title || null,
    pathTitle: path?.title || null,
  };
}

function buildHintPrompt({ exercise, code, error, output, hintLevel, weakTopics, level }) {
  return `You are VoxCode, a patient coding teacher helping with a practice exercise. Give HINT ${hintLevel} of 3 (progressive: 1=small conceptual clue, 2=more specific direction, 3=near-solution guidance). Do NOT reveal the full solution unless hintLevel is 3, and even then explain why.

Exercise: ${exercise.title}
Instructions: ${exercise.instructions}
Technology: ${exercise.technology}, Level: ${level}
${weakTopics?.length ? `Known weak areas: ${weakTopics.join(", ")}` : ""}
Student code:
\`\`\`
${(code || "").slice(0, 2000)}
\`\`\`
${error ? `Latest error:\n${String(error).slice(0, 800)}` : ""}
${output ? `Latest output:\n${String(output).slice(0, 800)}` : ""}

Return a short hint (2-4 sentences).`;
}

function buildReviewPrompt({ exercise, code, output, error, level }) {
  return `You are VoxCode, a coding teacher reviewing a student's practice code. Be educational, kind, specific.

Exercise: ${exercise.title}
Instructions: ${exercise.instructions}
Technology: ${exercise.technology}, Level: ${level}
Student code:
\`\`\`
${(code || "").slice(0, 2500)}
\`\`\`
${output ? `Output:\n${String(output).slice(0, 800)}` : ""}
${error ? `Error:\n${String(error).slice(0, 800)}` : ""}

Respond with: 1) what looks good, 2) the likely issue or improvement, 3) one concrete next step. Do NOT rewrite the whole file. Keep it under 150 words.`;
}

// Deterministic completion check: requires real attempt, not just button click.
function verifyCompletion({ exercise, code, output, error }) {
  const trimmed = (code || "").trim();
  if (trimmed.length < 20) {
    return { passed: false, reason: "Code looks empty — write your solution before submitting." };
  }
  if (exercise.starterCode && trimmed === exercise.starterCode.trim()) {
    return { passed: false, reason: "Code is unchanged from the starter — modify it to solve the exercise." };
  }
  if (error) {
    return { passed: false, reason: "Code still produces an error — fix the error first or ask for a hint." };
  }
  // output may be empty for valid programs (e.g. function definitions); accept if code is substantial
  if (!output && trimmed.length < 60) {
    return { passed: false, reason: "Run your code first so we can verify the output." };
  }
  return { passed: true, reason: "Valid attempt: code modified and runs." };
}

async function aiHint(args) {
  const prompt = buildHintPrompt(args);
  const raw = await generateResponse({
    history: [],
    message: prompt,
    language: "english",
    level: args.level || "beginner",
    teachingMode: "learn",
    learnerContext: "",
    codingContext: "",
  });
  return (raw.reply || "").slice(0, 800) || "Try breaking the problem into the smallest step and run it.";
}

async function aiReview(args) {
  const prompt = buildReviewPrompt(args);
  const raw = await generateResponse({
    history: [],
    message: prompt,
    language: "english",
    level: args.level || "beginner",
    teachingMode: "learn",
    learnerContext: "",
    codingContext: "",
  });
  return (raw.reply || "").slice(0, 1000) || "Good effort — check the instructions against your output.";
}

async function aiSolutionExplanation({ exercise, level }) {
  const raw = await generateResponse({
    history: [],
    message: `Explain the reference solution approach for exercise "${exercise.title}": ${exercise.instructions}. Technology: ${exercise.technology}, Level: ${level}. Explain step by step without dumping a huge file.`,
    language: "english",
    level: level || "beginner",
    teachingMode: "learn",
    learnerContext: "",
    codingContext: "",
  });
  return (raw.reply || "").slice(0, 1000);
}

module.exports = {
  getPracticeExercise,
  aiHint,
  aiReview,
  aiSolutionExplanation,
  verifyCompletion,
  starterForTech,
  fileNameForTech,
  languageForTech,
};
