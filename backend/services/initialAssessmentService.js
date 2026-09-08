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

Task: Generate 6-8 short assessment questions (5-10 is OK) that cover prerequisite knowledge for this path. Spread questions across DIFFERENT stages/topics — do not test the same concept twice. Include a mix of:
- multiple_choice (with exactly 4 options)
- short_answer or conceptual (1-2 sentences)
- predict_output or code (small snippet)

STRICT option rules for EVERY multiple_choice question:
- Exactly 4 options. Exactly one of them is correct.
- Every option must be plausible AND directly relevant to that specific question.
- Distractors must be believable wrong answers a beginner could pick — never generic filler.
- FORBIDDEN option patterns: "None of the above", "All of the above", "To manage unrelated data",
  "To handle <something>", "To bypass <something>", or any option built by swapping a topic/stage name into a template.
- No duplicate options within a question (case-insensitive).
- Shuffle the options so the correct answer is not always first, and return the shuffled list with
  "expectedAnswer" set to the exact text of the correct option.
- Return STRICTLY as minified JSON on a single line, no markdown fences:
{"questions":[{"id":"q1","type":"multiple_choice","question":"...","options":["...","...","...","..."],"code":null,"expectedAnswer":"<exact text of the correct option>","explanation":"why the correct option is right (1 sentence)","topic":"Variables","technology":"JavaScript","difficulty":"beginner"}, ...]}

For multiple_choice, expectedAnswer MUST exactly equal one of the options. For other types, expectedAnswer is the correct short answer.
"difficulty" must be one of: beginner, intermediate, advanced.
Include topic and technology for each question. Every question must test a REAL concept from the roadmap above —
never ask vague meta-questions like "What is the primary purpose of X in Stage Y?".`;
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

// ── MCQ validation ───────────────────────────────────────────────────────
// Rejects generic/template options so a broken question can never be served.
const BANNED_OPTION_PATTERNS = [
  /manage unrelated data/i,
  /none of the above/i,
  /all of the above/i,
  /^to handle\b/i,
  /^to bypass\b/i,
  /^to manage\b/i,
];

function isValidMcq(q) {
  if (!q || q.type !== "multiple_choice") return true; // only MCQ needs options
  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.length !== 4) return false;
  if (opts.some((o) => typeof o !== "string" || !o.trim())) return false;
  const norm = opts.map((o) => o.trim().toLowerCase());
  if (new Set(norm).size !== 4) return false; // no duplicates
  if (BANNED_OPTION_PATTERNS.some((re) => norm.some((o) => re.test(o)))) return false;
  if (!q.expectedAnswer || typeof q.expectedAnswer !== "string") return false;
  if (!norm.includes(q.expectedAnswer.trim().toLowerCase())) return false; // answer must match exactly one option
  if (!q.question || !String(q.question).trim()) return false;
  return true;
}

function shuffleOptions(question) {
  const opts = [...(question.options || [])];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return { ...question, options: opts };
}

// ── Fallback question bank ───────────────────────────────────────────────
// Every entry owns its own question-specific options. Entries are matched to
// roadmap topics by keyword and never reused within one assessment, so two
// questions can never share the same option list.
const FALLBACK_BANK = [
  { keys: ["semantic", "markup", "elements", "document structure"], q: "Which HTML element is the most appropriate wrapper for the main content of a page?", options: ["<main>", "<div>", "<span>", "<b>"], explanation: "<main> semantically marks the primary content; the others are generic or inline.", difficulty: "beginner" },
  { keys: ["form", "input", "attribute", "html"], q: "Which attribute makes an HTML form field required before the form can be submitted?", options: ["required", "placeholder", "value", "id"], explanation: "The required attribute blocks submission until the field has a value.", difficulty: "beginner" },
  { keys: ["link", "anchor", "href", "html"], q: "Which attribute of the <a> tag specifies the destination URL?", options: ["href", "src", "alt", "title"], explanation: "href holds the link destination; src is for embedded resources like images.", difficulty: "beginner" },
  { keys: ["accessibility", "alt", "image", "screen reader"], q: "What is the purpose of the alt attribute on an <img> tag?", options: ["It describes the image for screen readers and when the image fails to load", "It sets the width of the image in pixels", "It links the image to another web page", "It changes the image file format"], explanation: "alt text is read by assistive technology and shown if the image cannot load.", difficulty: "beginner" },
  { keys: ["structure", "content", "web foundations", "markup", "skeleton"], q: "What does HTML primarily define in a web page?", options: ["The structure and content of the page", "The visual styling of elements", "The server-side business logic", "The database storage format"], explanation: "HTML provides structure and content; styling and logic belong to CSS and JavaScript.", difficulty: "beginner" },
  { keys: ["selector", "class", "css", "styling"], q: "Which CSS selector targets every element with class=\"card\"?", options: [".card", "#card", "card", "*card"], explanation: "A leading dot selects by class; # selects by id and a bare name selects by tag.", difficulty: "beginner" },
  { keys: ["box model", "padding", "margin", "border"], q: "In the CSS box model, which property adds space INSIDE the border, between the border and the content?", options: ["padding", "margin", "outline", "border-collapse"], explanation: "padding is inner spacing; margin is outer spacing outside the border.", difficulty: "beginner" },
  { keys: ["specificity", "cascade", "override"], q: "Which selector has the highest specificity?", options: ["#header .nav a", ".nav a", "header a", "a"], explanation: "ID selectors outweigh classes, which outweigh element selectors.", difficulty: "intermediate" },
  { keys: ["flexbox", "flex", "justify", "align"], q: "Which CSS declaration centers flex items along the main (horizontal) axis?", options: ["justify-content: center", "display: block", "float: left", "position: static"], explanation: "justify-content aligns items on the main axis; the others do not center flex items.", difficulty: "beginner" },
  { keys: ["responsive", "media query", "viewport", "mobile"], q: "What does the rule @media (max-width: 600px) { ... } do?", options: ["It applies the enclosed styles only on viewports 600px wide or narrower", "It fixes the page width to exactly 600px", "It downloads a separate stylesheet file", "It hides every image on the page"], explanation: "Media queries conditionally apply styles based on viewport characteristics.", difficulty: "beginner" },
  { keys: ["presentation", "visual", "design", "stylesheet"], q: "What does CSS primarily control in a web page?", options: ["The presentation and visual styling of HTML elements", "The server-side database connection", "The execution of backend JavaScript", "The HTTP protocol used by the browser"], explanation: "CSS controls presentation; databases, backend code, and protocols are separate concerns.", difficulty: "beginner" },
  { keys: ["variable", "let", "const", "scope", "declaration"], q: "Which keyword declares a block-scoped variable that CAN be reassigned later?", options: ["let", "const", "static", "final"], explanation: "let is block-scoped and reassignable; const cannot be reassigned.", difficulty: "beginner" },
  { keys: ["data types", "typeof", "nan", "primitive"], q: "What does typeof NaN evaluate to in JavaScript?", options: ["\"number\"", "\"NaN\"", "\"undefined\"", "\"object\""], explanation: "NaN is a value of the Number type, so typeof returns \"number\".", difficulty: "beginner" },
  { keys: ["operator", "coercion", "concatenation", "string"], q: "What is the result of 2 + \"2\" in JavaScript?", options: ["\"22\"", "4", "NaN", "A TypeError is thrown"], explanation: "The number is coerced to a string, so + performs string concatenation.", difficulty: "beginner" },
  { keys: ["condition", "decision", "branch", "if"], q: "Which JavaScript feature allows a program to make decisions based on a condition?", options: ["if/else statements", "CSS selectors", "HTML attributes", "MongoDB collections"], explanation: "if/else branches execution on a condition; the others belong to styling, markup, and databases.", difficulty: "beginner" },
  { keys: ["function", "arrow"], q: "Which of these is a VALID arrow function that adds 1 to its argument?", options: ["const f = (a) => a + 1", "const f = function => (a) + 1", "const f => (a) => a + 1", "function f(a) => a + 1"], explanation: "Only the first has valid arrow syntax; the rest mix function and arrow grammar.", difficulty: "beginner" },
  { keys: ["array", "map", "list", "iteration"], q: "Which array method creates a NEW array by transforming each element?", options: ["map()", "forEach()", "push()", "splice()"], explanation: "map() returns a new transformed array; forEach returns undefined and push/splice mutate.", difficulty: "beginner" },
  { keys: ["object", "property", "key", "dot notation"], q: "Given const user = { name: \"Ava\" }, how do you correctly read the name value?", options: ["user.name", "user[name]", "user->name", "user::name"], explanation: "Dot notation (or bracket with a quoted key) accesses properties; the others are invalid.", difficulty: "beginner" },
  { keys: ["dom", "document", "queryselector", "browser"], q: "Which method selects the FIRST element in the document matching a CSS selector?", options: ["document.querySelector()", "document.getElementsByClassName()", "document.querySelectorAll()", "document.write()"], explanation: "querySelector returns the first match; querySelectorAll returns all matches.", difficulty: "beginner" },
  { keys: ["async", "await", "promise"], q: "What does await do inside an async function?", options: ["It pauses the function until the promise settles, then resumes with its value", "It blocks the entire browser tab until the code finishes", "It runs the code on a separate CPU thread", "It converts the function back to synchronous code"], explanation: "await suspends only that async function; the event loop keeps running.", difficulty: "intermediate" },
  { keys: ["spread", "es6", "destructuring", "rest"], q: "What does [...a, ...b] produce for two arrays a and b?", options: ["A new array containing all elements of a followed by all elements of b", "Both arrays sorted in place", "A new array with duplicates removed", "A merged plain object"], explanation: "Spread expands each array's elements into a new array literal.", difficulty: "intermediate" },
  { keys: ["jsx", "react", "component"], q: "What is JSX in React?", options: ["A syntax extension that lets you write HTML-like code inside JavaScript", "A CSS preprocessor like Sass", "A database query language", "A JavaScript bundler"], explanation: "JSX describes UI structure and compiles to React.createElement calls.", difficulty: "beginner" },
  { keys: ["props", "parent", "child", "data flow"], q: "How is data passed from a parent component to a child component in React?", options: ["Via props", "Via CSS classes", "Via SQL queries", "Via attributes on the <html> tag"], explanation: "Props are React's one-way parent-to-child data channel.", difficulty: "beginner" },
  { keys: ["hook", "usestate", "state"], q: "Which hook is used to add state to a React function component?", options: ["useState", "useEffect", "useRef", "componentDidMount"], explanation: "useState declares state; useEffect handles side effects and componentDidMount is class-only.", difficulty: "beginner" },
  { keys: ["node", "express", "server", "backend"], q: "What is Express.js primarily used for?", options: ["Building web servers and APIs in Node.js", "Styling web pages", "Designing SQL database schemas", "Compiling TypeScript to JavaScript"], explanation: "Express is a minimal Node.js web framework for routing and middleware.", difficulty: "beginner" },
  { keys: ["rest", "resource", "endpoint", "url"], q: "In a REST API, how are individual resources identified?", options: ["By URLs (URIs)", "By CSS selectors", "By SQL table names", "By HTML form tags"], explanation: "REST addresses every resource with a unique URL.", difficulty: "beginner" },
  { keys: ["http", "method", "post", "get"], q: "Which HTTP method is conventionally used to CREATE a new resource?", options: ["POST", "GET", "DELETE", "CONNECT"], explanation: "POST submits data for creation; GET reads and DELETE removes.", difficulty: "beginner" },
  { keys: ["middleware", "routing", "request pipeline"], q: "What is middleware in an Express application?", options: ["Functions that process a request before it reaches the final handler", "CSS files loaded by the browser", "Database migration scripts", "HTML page templates"], explanation: "Middleware runs in the request pipeline for auth, parsing, logging, etc.", difficulty: "intermediate" },
  { keys: ["mongodb", "document", "nosql", "collection"], q: "How is data primarily stored in MongoDB?", options: ["As JSON-like documents grouped in collections", "As relational tables with fixed schemas", "As plain text log files", "As CSS stylesheets"], explanation: "MongoDB is document-oriented; collections hold flexible BSON documents.", difficulty: "beginner" },
  { keys: ["sql", "select", "query", "table"], q: "Which SQL statement retrieves data from a table?", options: ["SELECT", "UPDATE", "INSERT", "DROP"], explanation: "SELECT reads rows; UPDATE modifies, INSERT adds, DROP deletes.", difficulty: "beginner" },
  { keys: ["schema", "relational", "nosql vs sql"], q: "What is the main difference between SQL and NoSQL databases?", options: ["SQL uses fixed schemas and relations; NoSQL is flexible and often schema-less", "NoSQL is always faster than SQL", "SQL cannot store text data", "NoSQL requires HTML to work"], explanation: "The core distinction is rigid relational schemas versus flexible document/key-value models.", difficulty: "beginner" },
  { keys: ["primary key", "unique", "constraint"], q: "What does a primary key guarantee in a database table?", options: ["Every row is uniquely identifiable", "Queries always run at maximum speed", "Backups happen automatically", "All stored data is encrypted"], explanation: "Uniqueness per row is the defining guarantee of a primary key.", difficulty: "beginner" },
  { keys: ["python", "list", "mutable"], q: "Which Python data type is an ordered collection whose items CAN be changed?", options: ["list", "tuple", "set", "frozenset"], explanation: "Lists are ordered and mutable; tuples are immutable and sets are unordered.", difficulty: "beginner" },
  { keys: ["python", "len", "string"], q: "What does len(\"hello\") return in Python?", options: ["5", "\"hello\"", "4", "It raises a TypeError"], explanation: "len counts the 5 characters in the string.", difficulty: "beginner" },
  { keys: ["python", "def", "define function"], q: "Which keyword defines a named function in Python?", options: ["def", "function", "func", "define"], explanation: "def starts a function definition; the others belong to other languages.", difficulty: "beginner" },
  { keys: ["python", "dict", "dictionary", "key-value"], q: "What is a Python dictionary?", options: ["A collection of key-value pairs written inside {}", "An ordered list of numbers", "A type of loop", "A file format"], explanation: "Dicts map unique keys to values using curly-brace syntax.", difficulty: "beginner" },
  { keys: ["java", "main", "entry point"], q: "Which method is the entry point of a Java program?", options: ["public static void main(String[] args)", "start()", "init()", "run()"], explanation: "The JVM looks for exactly the main method signature to start execution.", difficulty: "beginner" },
  { keys: ["java", "int", "declare", "variable"], q: "Which line correctly declares an integer variable in Java?", options: ["int count = 5;", "count int = 5;", "integer count = 5;", "var count int;"], explanation: "Java requires type-first declarations; the other forms are invalid syntax.", difficulty: "beginner" },
  { keys: ["java", "inheritance", "oop", "class", "extends"], q: "What is inheritance in object-oriented programming?", options: ["A class acquiring the fields and methods of another class", "Copying files between folders", "Linking a CSS file to an HTML page", "Merging two Git branches"], explanation: "Inheritance models is-a relationships through class extension.", difficulty: "beginner" },
  { keys: ["git", "version control", "commit", "repository"], q: "What is Git primarily used for?", options: ["Tracking changes in source code over time", "Styling web pages", "Running database servers", "Compiling Java programs"], explanation: "Git is a distributed version-control system for code history.", difficulty: "beginner" },
];

function scoreBankEntry(entry, topicHaystack) {
  let score = 0;
  for (const k of entry.keys) {
    if (topicHaystack.includes(k)) score += 1;
  }
  return score;
}

// Words from the path title (e.g. "python", "html", "css") boost entries from
// the same technology family — matters most for legacy paths with no tech refs.
const PATH_WORD_STOPLIST = new Set(["developer", "developers", "programming", "programmer", "mastery", "full", "stack", "course", "path", "learn", "learning", "guide", "and", "the", "with"]);

function pathTitleWords(pathTitle) {
  return String(pathTitle || "").toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2 && !PATH_WORD_STOPLIST.has(w));
}

// Pick up to `count` unused bank entries best matching a single topic.
// Returns validated, shuffled MCQ objects (topic fields filled by caller).
function pickBankQuestionsForTopic({ topicTitle, stageTitle, techNames = [], pathTitle = "", count = 4, excludeQuestions = [] }) {
  const haystack = `${topicTitle || ""} ${stageTitle || ""} ${techNames.join(" ")}`.toLowerCase();
  const titleWords = pathTitleWords(pathTitle);
  const excluded = new Set(excludeQuestions.map((q) => String(q || "").trim().toLowerCase()));
  const ranked = FALLBACK_BANK.map((entry, i) => {
    let s = scoreBankEntry(entry, haystack);
    for (const k of entry.keys) {
      if (titleWords.some((w) => k.includes(w) || w.includes(k))) { s += 3; break; }
    }
    return { entry, i, s };
  }).sort((a, b) => b.s - a.s);
  const out = [];
  for (const { entry } of ranked) {
    if (out.length >= count) break;
    if (excluded.has(entry.q.trim().toLowerCase())) continue;
    if (out.some((o) => o.question === entry.q)) continue;
    const correct = entry.options[0];
    const shuffled = [...entry.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    out.push({
      type: "multiple_choice",
      question: entry.q,
      options: shuffled,
      code: null,
      expectedAnswer: correct,
      explanation: entry.explanation,
      difficulty: entry.difficulty,
    });
  }
  return out;
}

// Build roadmap-specific fallback questions: keyword-matched, never reused,
// spread across stages for coverage. No templates, no shared option arrays.
function fallbackQuestions(roadmap) {
  const techs = roadmap.path.technologies || [];
  const techNames = techs.map((t) => (t.name || "").toLowerCase());
  // Round-robin across stages so coverage spans the whole path
  const byStage = roadmap.stages.map((s) => ({
    stage: s,
    topics: (s.topics || []).slice(),
  })).filter((g) => g.topics.length > 0);
  const ordered = [];
  let added = true;
  while (added && ordered.length < 8) {
    added = false;
    for (const g of byStage) {
      if (ordered.length >= 8) break;
      const t = g.topics.shift();
      if (t) { ordered.push({ topic: t, stage: g.stage }); added = true; }
    }
  }
  const topics = ordered.length > 0 ? ordered : roadmap.flatTopics.slice(0, 8).map((t) => ({ topic: t, stage: null }));
  const titleWords = pathTitleWords(roadmap.path.title);

  const used = new Set();
  const out = [];
  topics.slice(0, 8).forEach(({ topic, stage }, idx) => {
    const haystack = `${topic.title || ""} ${(stage && stage.title) || topic.stageTitle || ""} ${techNames.join(" ")}`.toLowerCase();
    let best = -1;
    let bestScore = -1;
    FALLBACK_BANK.forEach((entry, i) => {
      if (used.has(i)) return;
      let s = scoreBankEntry(entry, haystack);
      // Prefer the path's own technology family (e.g. python entries for a Python path)
      for (const k of entry.keys) {
        if (titleWords.some((w) => k.includes(w) || w.includes(k))) { s += 3; break; }
      }
      if (s > bestScore) { bestScore = s; best = i; }
    });
    if (best === -1) {
      // Bank exhausted (should not happen with 40 entries / 8 questions):
      // emit a conceptual question instead of fake MCQ options.
      out.push({
        id: `q${idx + 1}`,
        type: "conceptual",
        question: `In one or two sentences, explain what you already know about ${topic.title}.`,
        options: [],
        code: null,
        expectedAnswer: `${topic.title} basics`,
        explanation: "Open-ended baseline of prior knowledge.",
        topic: topic.title,
        topicId: topic.id || null,
        technology: (topic.technologies && topic.technologies[0] && topic.technologies[0].name) || techs[0]?.name || "general",
        difficulty: "beginner",
      });
      return;
    }
    used.add(best);
    const entry = FALLBACK_BANK[best];
    const correct = entry.options[0];
    const shuffled = [...entry.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    out.push({
      id: `q${idx + 1}`,
      type: "multiple_choice",
      question: entry.q,
      options: shuffled,
      code: null,
      expectedAnswer: correct,
      explanation: entry.explanation,
      topic: topic.title,
      topicId: topic.id || null,
      technology: (topic.technologies && topic.technologies[0] && topic.technologies[0].name) || techs[0]?.name || "general",
      difficulty: entry.difficulty,
    });
  });
  // Ensure 5-8
  if (out.length < 5) {
    const extra = [
      {
        id: `q${out.length + 1}`,
        type: "conceptual",
        question: `Briefly explain what ${roadmap.path.title} is used for.`,
        options: [],
        code: null,
        expectedAnswer: `${roadmap.path.title} is used for building applications`,
        explanation: "Baseline familiarity with the learning goal.",
        topic: roadmap.path.title,
        technology: techs[0]?.name || "general",
        difficulty: "beginner",
      },
    ];
    out.push(...extra);
  }
  return out.slice(0, 8);
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
      explanation: q.explanation ? String(q.explanation).slice(0, 300) : null,
      topic: String(q.topic || "").slice(0, 80),
      topicId: q.topicId || null,
      technology: String(q.technology || "").slice(0, 40),
      difficulty: ["beginner", "intermediate", "advanced"].includes(q.difficulty) ? q.difficulty : "beginner",
    })).filter((q) => q.question);
    if (qs.length < 5) throw new Error("Too few questions");
    // Map topic titles to actual topicIds from roadmap for validation
    for (const q of qs) {
      const match = roadmap.flatTopics.find((t) => t.title.toLowerCase() === q.topic.toLowerCase());
      if (match) q.topicId = match.id;
    }
    // Validate every MCQ; replace broken ones with bank-backed questions.
    // Never serve generic/template options to the student.
    const bankFill = fallbackQuestions(roadmap);
    let fillIdx = 0;
    const validated = [];
    for (const q of qs) {
      if (q.type === "multiple_choice" && !isValidMcq(q)) {
        console.log(`Dropping invalid MCQ (bad options/answer): ${q.question.slice(0, 80)}`);
        continue;
      }
      validated.push(q.type === "multiple_choice" ? shuffleOptions(q) : q);
    }
    // Top up with bank questions (unique, roadmap-specific) if AI output was short or partly invalid
    const seenOptionSets = new Set(validated.filter((v) => v.type === "multiple_choice").map((v) => [...v.options].sort().join("||")));
    while (validated.length < 6 && fillIdx < bankFill.length) {
      const cand = bankFill[fillIdx++];
      if (cand.type === "multiple_choice") {
        const key = [...cand.options].sort().join("||");
        if (seenOptionSets.has(key)) continue;
        seenOptionSets.add(key);
      }
      if (validated.some((v) => v.question.trim().toLowerCase() === cand.question.trim().toLowerCase())) continue;
      validated.push(cand);
    }
    if (validated.length < 5) throw new Error("Too few valid questions");
    // Renumber sequentially so kept AI ids and bank ids never collide
    validated.forEach((q, i) => { q.id = `q${i + 1}`; });
    return validated.slice(0, 8);
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

module.exports = { generateQuestions, evaluateAssessment, buildGenerationPrompt, buildEvaluationPrompt, fallbackQuestions, isValidMcq, shuffleOptions, pickBankQuestionsForTopic };
