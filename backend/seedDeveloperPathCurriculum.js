require("dotenv").config();
const mongoose = require("mongoose");
const LearningPath = require("./models/LearningPath");
const Stage = require("./models/Stage");
const Topic = require("./models/Topic");
const Technology = require("./models/Technology");

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// seedCourses.js creates these paths with only `courseSlugs` (Course → Lesson
// hierarchy) and never creates Stage/Topic docs. The ai-first teaching roadmap
// is built exclusively from Stage → Topic, so those paths render empty.
// This seed backfills a publishable Stage → Topic curriculum for them.
const PATH_CURRICULUM = [
  {
    slug: "frontend-developer",
    title: "Frontend Developer",
    techs: ["javascript", "react"],
    stages: [
      { title: "Web Foundations", level: "beginner", topics: ["HTML essentials", "CSS essentials", "Responsive layouts", "Git and GitHub"] },
      { title: "JavaScript", level: "beginner", topics: ["JavaScript fundamentals", "DOM and events", "Arrays and objects", "Async JavaScript", "Fetching data from APIs"] },
      { title: "React", level: "intermediate", topics: ["React components and JSX", "Props and composition", "State and hooks", "Routing and navigation", "Forms and data flow"] },
      { title: "Frontend Projects", level: "advanced", topics: ["Portfolio website", "Dashboard application", "Production deployment"] },
    ],
  },
  {
    slug: "backend-developer",
    title: "Backend Developer",
    techs: ["nodejs", "express", "mongodb"],
    stages: [
      { title: "Node.js Foundations", level: "beginner", topics: ["Node.js runtime fundamentals", "npm and modules", "File system and streams"] },
      { title: "Express and APIs", level: "beginner", topics: ["Express basics", "Routing and controllers", "Middleware", "REST API design"] },
      { title: "Databases", level: "intermediate", topics: ["MongoDB fundamentals", "Mongoose schemas", "Data modeling and relationships"] },
      { title: "Auth and Security", level: "intermediate", topics: ["Authentication with JWT", "Password hashing", "Security best practices"] },
      { title: "Backend Projects", level: "advanced", topics: ["REST API project", "Full backend service", "Deployment and monitoring"] },
    ],
  },
  {
    slug: "fullstack-developer",
    title: "Full-Stack Developer",
    techs: ["javascript", "react", "nodejs", "express", "mongodb"],
    stages: [
      { title: "Frontend Foundations", level: "beginner", topics: ["HTML and CSS", "JavaScript fundamentals", "React fundamentals"] },
      { title: "Backend Foundations", level: "beginner", topics: ["Node.js and Express", "REST APIs", "MongoDB with Mongoose"] },
      { title: "Authentication and Integration", level: "intermediate", topics: ["User authentication", "Connecting frontend to API", "State management"] },
      { title: "Full-Stack Projects", level: "advanced", topics: ["Social application", "E-commerce application", "Capstone deployment"] },
    ],
  },
  {
    slug: "python-developer",
    title: "Python Developer",
    techs: ["python", "flask"],
    stages: [
      { title: "Python Fundamentals", level: "beginner", topics: ["Syntax and variables", "Control flow", "Functions", "Data structures"] },
      { title: "Intermediate Python", level: "intermediate", topics: ["Object-oriented programming", "Modules and packages", "Error handling", "File handling"] },
      { title: "Python for the Web", level: "intermediate", topics: ["Flask basics", "Building REST APIs", "Working with databases"] },
      { title: "Python Projects", level: "advanced", topics: ["Command-line tool", "Web application", "Automation project"] },
    ],
  },
  {
    slug: "javascript-mastery",
    title: "JavaScript Mastery",
    techs: ["javascript"],
    stages: [
      { title: "Core JavaScript", level: "intermediate", topics: ["Scope and closures", "Prototypes and classes", "The this keyword", "Higher-order functions"] },
      { title: "Async and the Event Loop", level: "intermediate", topics: ["Promises", "Async/await", "Event loop and microtasks", "Generators and iterators"] },
      { title: "Advanced Patterns", level: "advanced", topics: ["Modules and bundling", "Design patterns", "Functional programming", "Performance and memory"] },
      { title: "Mastery Projects", level: "advanced", topics: ["Library from scratch", "Full-stack JavaScript application", "Interview-style challenges"] },
    ],
  },
];

async function resolveTechs(slugs) {
  const ids = [];
  for (const slug of slugs) {
    let doc = await Technology.findOne({ slug });
    if (!doc) doc = await Technology.findOne({ name: new RegExp(`^${slug}$`, "i") });
    if (doc) ids.push(doc._id);
  }
  return ids;
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    for (const def of PATH_CURRICULUM) {
      const techIds = await resolveTechs(def.techs);

      let path = await LearningPath.findOne({ slug: def.slug });
      if (!path) {
        path = await LearningPath.create({
          title: def.title,
          slug: def.slug,
          description: `Learn ${def.title} step by step — structured curriculum with practice and projects.`,
          difficulty: "intermediate",
          status: "published",
          active: true,
          technologies: techIds,
        });
        console.log(`Created path ${def.slug}`);
      } else if (path.technologies.length === 0 && techIds.length) {
        await LearningPath.updateOne({ _id: path._id }, { $set: { technologies: techIds } });
        console.log(`Attached technologies to ${def.slug}`);
      }

      const existingStages = await Stage.countDocuments({ learningPath: path._id, status: "published" });
      if (existingStages > 0) {
        console.log(`Skipped ${def.slug} — already has ${existingStages} published stages`);
        continue;
      }

      let order = 0;
      for (const st of def.stages) {
        const stageSlug = `${def.slug}-${slugify(st.title)}`;
        const stage = await Stage.create({
          title: st.title,
          slug: stageSlug,
          description: `${st.title} — ${st.topics.join(", ")}`,
          level: st.level,
          order: order++,
          learningPath: path._id,
          estimatedMinutes: st.topics.length * 20,
          status: "published",
          active: true,
        });

        for (let ti = 0; ti < st.topics.length; ti++) {
          const title = st.topics[ti];
          await Topic.create({
            title,
            slug: `${stageSlug}-${slugify(title)}`,
            description: `${title} — core concepts, worked examples and practice.`,
            order: ti,
            stage: stage._id,
            technologies: techIds,
            status: "published",
            active: true,
          });
        }
      }
      console.log(`Seeded ${def.stages.length} stages / ${def.stages.reduce((n, s) => n + s.topics.length, 0)} topics for ${def.slug}`);
    }

    console.log("\nDeveloper path curriculum seed completed!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
