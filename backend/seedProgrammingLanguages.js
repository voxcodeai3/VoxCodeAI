require("dotenv").config();
const mongoose = require("mongoose");
const Technology = require("./models/Technology");
const LearningPath = require("./models/LearningPath");
const Stage = require("./models/Stage");
const Topic = require("./models/Topic");
const { Lesson } = require("./models/Course");

const TECHS = [
  { name: "JavaScript", slug: "javascript", type: "language", category: "programming_languages", description: "The language of the web." },
  { name: "TypeScript", slug: "typescript", type: "language", category: "programming_languages", description: "Typed superset of JavaScript.", prerequisites: ["javascript"] },
  { name: "Python", slug: "python", type: "language", category: "programming_languages", description: "Simple general-purpose language." },
  { name: "Java", slug: "java", type: "language", category: "programming_languages", description: "Enterprise OOP language." },
  { name: "C", slug: "c-lang", type: "language", category: "programming_languages", description: "Systems programming foundation." },
  { name: "C++", slug: "cpp", type: "language", category: "programming_languages", description: "C with objects and modern features." },
  { name: "C#", slug: "csharp", type: "language", category: "programming_languages", description: "Microsoft's modern OOP language." },
  { name: "Go", slug: "go", type: "language", category: "programming_languages", description: "Simple concurrent language." },
  { name: "Rust", slug: "rust", type: "language", category: "programming_languages", description: "Safe systems language." },
  { name: "PHP", slug: "php", type: "language", category: "programming_languages", description: "Web scripting language." },
  { name: "Ruby", slug: "ruby", type: "language", category: "programming_languages", description: "Elegant OOP scripting." },
  { name: "Kotlin", slug: "kotlin", type: "language", category: "programming_languages", description: "Modern JVM language." },
  { name: "Swift", slug: "swift", type: "language", category: "programming_languages", description: "Apple platforms language." },
  { name: "Dart", slug: "dart", type: "language", category: "programming_languages", description: "Optimized for UI." },
];

// Curriculum per language — topics split by level (from spec §§5-18)
const CURRICULUM = {
  javascript: {
    beginner: ["Introduction","Environment/Setup","Syntax","Variables","let / const","Data types","Operators","Type conversion","Conditions","if / else","switch","Loops","for","while","Functions","Parameters","Return values","Scope","Arrays","Objects","Basic error handling"],
    intermediate: ["Array methods","Object methods","Destructuring","Spread/rest","Template literals","Higher-order functions","Callbacks","Closures","this","Classes","Modules","ES modules","DOM","Events","Forms","Browser APIs","JSON","Fetch","Promises","async/await","Error handling","Local storage"],
    advanced: ["Event loop","Execution model","Prototypes","Prototype chain","Advanced closures","Advanced async","Generators","Iterators","Web APIs","Performance","Memory concepts","Code organization","Testing fundamentals","Production practices"],
    projects: ["Calculator","Todo application","Interactive web application","API-based application"]
  },
  typescript: {
    beginner: ["TypeScript introduction","Setup","Type annotations","Primitive types","Arrays","Objects","Functions","Interfaces","Type aliases"],
    intermediate: ["Unions","Intersections","Generics","Enums","Narrowing","Utility types","Classes","Modules","Type-safe APIs","Configuration"],
    advanced: ["Advanced generics","Conditional types","Mapped types","Type inference","Advanced utility types","Architecture","Type-safe application design","Testing"],
    projects: ["Type-safe Todo","API client","Large TS project"]
  },
  python: {
    beginner: ["Python setup","Syntax","Variables","Data types","Strings","Numbers","Boolean","Operators","Conditions","Loops","Functions","Lists","Tuples","Sets","Dictionaries","Basic exceptions","Modules"],
    intermediate: ["File handling","Modules and packages","OOP","Classes","Inheritance","Encapsulation","Polymorphism","Iterators","Generators","Decorators","Lambda functions","Comprehensions","Virtual environments","Package management","Type hints","Testing","Working with APIs","JSON"],
    advanced: ["Advanced OOP","Async programming","Concurrency","Threading concepts","Multiprocessing concepts","Performance","Memory concepts","Advanced typing","Architecture","Testing strategies","Production practices"],
    projects: ["CLI application","Automation project","API project","Advanced Python application"]
  },
  java: {
    beginner: ["Java setup","Syntax","Variables","Data types","Operators","Conditions","Loops","Methods","Arrays","Strings","Classes","Objects","Constructors"],
    intermediate: ["OOP","Inheritance","Polymorphism","Encapsulation","Interfaces","Abstract classes","Collections","Generics","Exceptions","File handling","Packages","Streams","Lambda expressions","Date/time APIs","Testing fundamentals"],
    advanced: ["Advanced collections","Concurrency","Threads","JVM concepts","Memory management concepts","Performance","Design patterns","Architecture","Testing strategies","Production practices"],
    projects: ["Console application","Banking application","Inventory application"]
  },
  "c-lang": {
    beginner: ["Setup","Syntax","Variables","Data types","Operators","Conditions","Loops","Functions","Arrays","Strings","Pointers fundamentals"],
    intermediate: ["Pointers","Memory","Structures","Unions","Enums","File handling","Dynamic memory","Header files","Multi-file programs"],
    advanced: ["Memory management","Function pointers","Data structures","Low-level concepts","Performance","Debugging","Larger C projects"],
    projects: ["CLI utility","Data-structure project"]
  },
  cpp: {
    beginner: ["C++ setup","Syntax","Variables","Data types","Conditions","Loops","Functions","Arrays","Strings","References"],
    intermediate: ["Classes","Objects","Constructors","Destructors","Inheritance","Polymorphism","Encapsulation","Templates","STL","Vectors","Maps","Sets","Iterators","Exceptions"],
    advanced: ["Smart pointers","Move semantics","RAII","Lambdas","Modern C++","Concurrency","Performance","Memory management","Design patterns"],
    projects: ["OOP application","STL project"]
  },
  csharp: {
    beginner: ["C# setup","Syntax","Variables","Data types","Conditions","Loops","Methods","Arrays","Strings","Classes"],
    intermediate: ["OOP","Interfaces","Inheritance","Generics","Collections","LINQ","Exceptions","Delegates","Events","Async/await","File handling"],
    advanced: ["Advanced async programming","Memory concepts","Performance","Architecture","Testing","Dependency concepts","Production practices"],
    projects: ["Console app","Data app"]
  },
  go: {
    beginner: ["Go setup","Syntax","Variables","Types","Functions","Conditions","Loops","Arrays","Slices","Maps","Structs"],
    intermediate: ["Methods","Interfaces","Pointers","Error handling","Packages","Modules","File handling","JSON","Testing"],
    advanced: ["Goroutines","Channels","Concurrency","Context","Performance","Networking","Architecture","Production practices"],
    projects: ["CLI tool","Web service"]
  },
  rust: {
    beginner: ["Rust setup","Syntax","Variables","Data types","Functions","Conditions","Loops","Structs","Enums"],
    intermediate: ["Ownership","Borrowing","References","Lifetimes fundamentals","Traits","Generics","Error handling","Collections","Modules","Cargo","Testing"],
    advanced: ["Advanced lifetimes","Smart pointers","Concurrency","Async Rust","Performance","Memory concepts","Advanced traits","Production practices"],
    projects: ["CLI tool","Systems project"]
  },
  php: {
    beginner: ["PHP setup","Syntax","Variables","Data types","Conditions","Loops","Functions","Arrays","Strings","Forms"],
    intermediate: ["OOP","Classes","Interfaces","Traits","Namespaces","Exceptions","Composer","File handling","Sessions","Cookies","APIs","JSON"],
    advanced: ["Architecture","Security","Performance","Testing","Dependency management","Production practices"],
    projects: ["Form app","API project"]
  },
  ruby: {
    beginner: ["Ruby setup","Syntax","Variables","Data types","Strings","Arrays","Hashes","Conditions","Loops","Methods"],
    intermediate: ["Blocks","Iterators","OOP","Modules","Mixins","Exceptions","Gems","File handling","Testing"],
    advanced: ["Metaprogramming fundamentals","Concurrency concepts","Architecture","Performance","Testing","Production practices"],
    projects: ["Script project","Gem project"]
  },
  kotlin: {
    beginner: ["Kotlin setup","Syntax","Variables","Types","Functions","Conditions","Loops","Collections","Null safety"],
    intermediate: ["Classes","Interfaces","Data classes","Sealed classes","Generics","Extension functions","Lambdas","Coroutines fundamentals","Exception handling"],
    advanced: ["Advanced coroutines","Flow","Concurrency","Performance","Architecture","Testing","Production practices"],
    projects: ["Console app","Android logic"]
  },
  swift: {
    beginner: ["Swift setup","Syntax","Variables","Constants","Types","Conditions","Loops","Functions","Arrays","Dictionaries","Optionals"],
    intermediate: ["Structs","Classes","Protocols","Extensions","Generics","Error handling","Closures","Collections","Async/await"],
    advanced: ["Concurrency","Actors","Memory concepts","Performance","Architecture","Testing","Production practices"],
    projects: ["Logic app","Async app"]
  },
  dart: {
    beginner: ["Dart setup","Syntax","Variables","Types","Operators","Conditions","Loops","Functions","Lists","Maps","Sets"],
    intermediate: ["Classes","OOP","Mixins","Extensions","Generics","Futures","Async/await","Streams","Error handling","Packages"],
    advanced: ["Advanced asynchronous programming","Streams","Isolates","Performance","Architecture","Testing","Production practices"],
    projects: ["CLI app","Async app"]
  },
};

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  // Upsert technologies
  const techMap = {};
  for (const t of TECHS) {
    const { prerequisites: pre, ...rest } = t;
    let doc = await Technology.findOne({ slug: t.slug });
    if (!doc) {
      doc = await Technology.create({ ...rest, status: "available", active: true });
      console.log(`Tech created ${t.slug}`);
    } else {
      await Technology.updateOne({ slug: t.slug }, { $set: { ...rest, status: "available", active: true } });
      doc = await Technology.findOne({ slug: t.slug });
    }
    if (pre) {
      const prereqIds = [];
      for (const p of pre) {
        const pr = await Technology.findOne({ slug: p });
        if (pr) prereqIds.push(pr._id);
      }
      await Technology.updateOne({ slug: t.slug }, { $set: { prerequisites: prereqIds } });
      doc = await Technology.findOne({ slug: t.slug });
    }
    techMap[t.slug] = doc;
  }

  // For each language, create/replace LearningPath + Stages/Topics/Lessons
  for (const [slug, levels] of Object.entries(CURRICULUM)) {
    const tech = techMap[slug];
    if (!tech) continue;
    const pathSlug = `${slug}-programming`;
    let path = await LearningPath.findOne({ slug: pathSlug });
    // clean old stages/topics/lessons for this path
    if (path) {
      const stages = await Stage.find({ learningPath: path._id });
      for (const s of stages) {
        const topics = await Topic.find({ stage: s._id });
        for (const tp of topics) await Lesson.deleteMany({ topic: tp._id });
        await Topic.deleteMany({ stage: s._id });
      }
      await Stage.deleteMany({ learningPath: path._id });
      await LearningPath.deleteOne({ _id: path._id });
      console.log(`Cleaned ${pathSlug}`);
    }
    path = await LearningPath.create({
      title: `${tech.name} Programming`,
      slug: pathSlug,
      description: `Learn ${tech.name} from beginner to advanced — structured curriculum with practice and projects.`,
      category: "programming_languages",
      technologies: [tech._id],
      prerequisites: tech.slug === "typescript" ? [techMap.javascript?._id].filter(Boolean) : [],
      difficulty: "beginner",
      estimatedDuration: "~20 hours",
      level: "beginner",
      order: Object.keys(CURRICULUM).indexOf(slug),
      status: "published",
      active: true,
    });
    console.log(`Path ${pathSlug}`);

    let order = 0;
    const levelStages = {
      beginner: chunk(levels.beginner, 5),
      intermediate: chunk(levels.intermediate, 5),
      advanced: chunk(levels.advanced, 5),
    };
    for (const level of ["beginner", "intermediate", "advanced"]) {
      const groups = levelStages[level];
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi];
        const stageTitle = `${level.charAt(0).toUpperCase()+level.slice(1)} Stage ${gi+1}`;
        const stageSlug = `${slug}-${level}-${gi+1}`;
        const stage = await Stage.create({
          title: stageTitle,
          slug: stageSlug,
          description: `${tech.name} ${level} — ${group.join(", ")}`,
          level,
          order: order++,
          learningPath: path._id,
          estimatedMinutes: group.length * 15,
          status: "published",
          active: true,
        });
        // each group -> 1 topic with multiple lessons (one per item)
        // to show topics meaningfully, split group into topics
        const topicChunks = chunk(group, Math.ceil(group.length / 2) || 1);
        for (let ti = 0; ti < topicChunks.length; ti++) {
          const tGroup = topicChunks[ti];
          const topicTitle = tGroup[0];
          const topic = await Topic.create({
            title: topicTitle,
            slug: `${stageSlug}-${ti}-${topicTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
            description: tGroup.join(", "),
            order: ti,
            stage: stage._id,
            technologies: [tech._id],
            status: "published",
            active: true,
          });
          for (let li = 0; li < tGroup.length; li++) {
            const lessonTitle = tGroup[li];
            await Lesson.create({
              title: lessonTitle,
              slug: `${topic.slug}-${lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
              description: `Learn ${lessonTitle} in ${tech.name}`,
              objective: `Understand and apply ${lessonTitle}`,
              topic: topic._id,
              order: li,
              type: "concept",
              difficulty: level,
              estimatedMinutes: 15,
              status: "published",
              content: [
                { type: "text", title: "Objective", content: `Understand and apply ${lessonTitle} in ${tech.name}.` },
                { type: "code", title: "Example", content: `// ${lessonTitle} example in ${tech.name}\n// See lesson content` },
                { type: "text", title: "Practice", content: `Complete exercises for ${lessonTitle}.` },
                { type: "text", title: "Common mistakes", content: `Avoid common pitfalls with ${lessonTitle}.` },
                { type: "text", title: "Checkpoint", content: `Can you explain ${lessonTitle}?` },
              ],
              examples: [],
              exercises: [],
              commonMistakes: [`Confusing ${lessonTitle} with related concepts`],
              checkpoint: `Explain ${lessonTitle}`,
            });
          }
        }
      }
    }
    // projects as final advanced stage
    if (levels.projects && levels.projects.length) {
      const projStage = await Stage.create({
        title: "Projects",
        slug: `${slug}-projects`,
        description: `${tech.name} projects — apply what you learned`,
        level: "advanced",
        order: order++,
        learningPath: path._id,
        estimatedMinutes: levels.projects.length * 60,
        status: "published",
        active: true,
      });
      const projTopic = await Topic.create({
        title: "Projects",
        slug: `${slug}-projects-topic`,
        description: levels.projects.join(", "),
        order: 0,
        stage: projStage._id,
        technologies: [tech._id],
        status: "published",
        active: true,
      });
      for (let i=0;i<levels.projects.length;i++) {
        const proj = levels.projects[i];
        await Lesson.create({
          title: proj,
          slug: `${projTopic.slug}-${proj.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
          description: `Build a ${proj.toLowerCase()} in ${tech.name}`,
          objective: `Build ${proj}`,
          topic: projTopic._id,
          order: i,
          type: "project",
          difficulty: "advanced",
          estimatedMinutes: 60,
          status: "published",
          content: [{ type: "text", title: "Project", content: `Build: ${proj}` }],
        });
      }
    }
  }

  console.log("Seed programming languages complete");
  await mongoose.disconnect();
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });
