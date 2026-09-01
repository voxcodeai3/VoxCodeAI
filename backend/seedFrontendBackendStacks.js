require("dotenv").config();
const mongoose = require("mongoose");
const Technology = require("./models/Technology");
const LearningPath = require("./models/LearningPath");
const Stage = require("./models/Stage");
const Topic = require("./models/Topic");
const { Lesson } = require("./models/Course");

const EXTRA_TECHS = [
  { name: "HTML", slug: "html", type: "language", category: "frontend", description: "Markup for web structure" },
  { name: "CSS", slug: "css", type: "language", category: "frontend", description: "Styling for the web" },
  { name: "React", slug: "react", type: "framework", category: "frontend", description: "UI library" },
  { name: "Vue", slug: "vue", type: "framework", category: "frontend", description: "Progressive framework" },
  { name: "Angular", slug: "angular", type: "framework", category: "frontend", description: "Platform for web apps" },
  { name: "Next.js", slug: "nextjs", type: "framework", category: "frontend", description: "React framework" },
  { name: "Node.js", slug: "nodejs", type: "runtime", category: "backend", description: "JS runtime" },
  { name: "Express", slug: "express", type: "framework", category: "backend", description: "Node framework" },
  { name: "MongoDB", slug: "mongodb", type: "database", category: "databases", description: "NoSQL database" },
  { name: "PostgreSQL", slug: "postgres", type: "database", category: "databases", description: "Relational DB" },
  { name: "Flask", slug: "flask", type: "framework", category: "backend", description: "Python microframework" },
  { name: "Django", slug: "django", type: "framework", category: "backend", description: "Python web framework" },
  { name: "FastAPI", slug: "fastapi", type: "framework", category: "backend", description: "Modern Python API" },
  { name: "Spring Boot", slug: "spring", type: "framework", category: "backend", description: "Java framework" },
  { name: "ASP.NET Core", slug: "aspnet", type: "framework", category: "backend", description: "C# web framework" },
  { name: "Gin", slug: "gin", type: "framework", category: "backend", description: "Go web framework" },
  { name: "Laravel", slug: "laravel", type: "framework", category: "backend", description: "PHP framework" },
  { name: "Rails", slug: "rails", type: "framework", category: "backend", description: "Ruby framework" },
  { name: "Ruby", slug: "ruby", type: "language", category: "backend", description: "Elegant language" },
];

const FRONTEND_STACKS = [
  {
    slug: "html-css", title: "HTML + CSS", category: "frontend", pathType: "frontend",
    techs: ["html","css"], difficulty: "beginner", duration: "~14 hours",
    desc: "Learn web foundations with HTML and CSS — from semantics to responsive layouts.",
    beginner: ["Web fundamentals","HTML fundamentals","Semantic HTML","Forms","Tables","Accessibility","CSS fundamentals","Selectors","Box model","Display","Positioning"],
    intermediate: ["Flexbox","Grid","Responsive design","Typography","Transitions","Animations","CSS variables","Accessibility","Practical layouts"],
    advanced: ["Testing","Performance","Deployment"],
    projects: ["Personal portfolio","Responsive landing page","Product page"],
    prereqs: []
  },
  {
    slug: "html-css-javascript", title: "HTML + CSS + JavaScript", category: "frontend", pathType: "frontend",
    techs: ["html","css","javascript"], difficulty: "beginner", duration: "~24 hours",
    desc: "Build interactive websites with HTML, CSS and JavaScript.",
    beginner: ["Web foundations","HTML","CSS","Responsive design","JavaScript fundamentals","DOM","Events","Forms"],
    intermediate: ["Browser APIs","Fetch","Async JavaScript","Error handling","Modules"],
    advanced: ["Testing","Performance","Deployment"],
    projects: ["Calculator","Todo application","Quiz application","Weather application"],
    prereqs: ["html-css"]
  },
  {
    slug: "html-css-javascript-react", title: "HTML + CSS + JavaScript + React", category: "frontend", pathType: "frontend",
    techs: ["html","css","javascript","react"], difficulty: "intermediate", duration: "~32 hours",
    desc: "Build modern interactive web applications with React.",
    beginner: ["Web foundations","HTML","CSS","JavaScript fundamentals","Modern JavaScript"],
    intermediate: ["DOM and browser APIs","React fundamentals","JSX","Components","Props","State","Events","Hooks","Forms","Routing"],
    advanced: ["API integration","Context","Application architecture","Testing","Performance","Deployment"],
    projects: ["Todo app","Dashboard","API application","Final project"],
    prereqs: ["html-css-javascript"]
  },
  {
    slug: "html-css-javascript-vue", title: "HTML + CSS + JavaScript + Vue", category: "frontend", pathType: "frontend",
    techs: ["html","css","javascript","vue"], difficulty: "intermediate", duration: "~28 hours",
    desc: "Progressive frontend with Vue — components, reactivity and routing.",
    beginner: ["HTML","CSS","JavaScript","Vue fundamentals"],
    intermediate: ["Components","Templates","Props","Events","State","Composition API","Routing"],
    advanced: ["API integration","Forms","Testing","Performance","Deployment"],
    projects: ["Todo Vue","Dashboard"],
    prereqs: ["html-css-javascript"]
  },
  {
    slug: "html-css-javascript-angular", title: "HTML + CSS + JavaScript + Angular", category: "frontend", pathType: "frontend",
    techs: ["html","css","javascript","angular","typescript"], difficulty: "intermediate", duration: "~34 hours",
    desc: "Enterprise frontend with Angular and TypeScript.",
    beginner: ["HTML","CSS","JavaScript fundamentals","TypeScript"],
    intermediate: ["Angular fundamentals","Components","Templates","Services","Dependency injection","Routing","Forms","HTTP","RxJS fundamentals"],
    advanced: ["State concepts","Testing","Architecture","Deployment"],
    projects: ["Angular dashboard","Admin panel"],
    prereqs: ["html-css-javascript"]
  },
  {
    slug: "html-css-javascript-nextjs", title: "HTML + CSS + JavaScript + Next.js", category: "frontend", pathType: "frontend",
    techs: ["html","css","javascript","react","nextjs"], difficulty: "intermediate", duration: "~32 hours",
    desc: "Full-featured React apps with Next.js — routing, SSR and deployment.",
    beginner: ["HTML","CSS","JavaScript","React fundamentals"],
    intermediate: ["Next.js fundamentals","Routing","Layouts","Server/client concepts","Data fetching","API routes"],
    advanced: ["Authentication","Rendering strategies","Performance","Deployment"],
    projects: ["Blog with Next.js","E-commerce frontend"],
    prereqs: ["html-css-javascript-react"]
  },
  {
    slug: "html-css-typescript-react", title: "HTML + CSS + TypeScript + React", category: "frontend", pathType: "frontend",
    techs: ["html","css","typescript","react"], difficulty: "intermediate", duration: "~34 hours",
    desc: "Type-safe React applications with TypeScript.",
    beginner: ["HTML","CSS","JavaScript fundamentals","TypeScript"],
    intermediate: ["React","React + TypeScript","Advanced React patterns"],
    advanced: ["Testing","Performance","Deployment"],
    projects: ["Type-safe Todo","Dashboard"],
    prereqs: ["html-css-javascript-react"]
  },
  {
    slug: "html-css-typescript-angular", title: "HTML + CSS + TypeScript + Angular", category: "frontend", pathType: "frontend",
    techs: ["html","css","typescript","angular"], difficulty: "advanced", duration: "~36 hours",
    desc: "Angular with TypeScript — services, DI and RxJS.",
    beginner: ["HTML","CSS","TypeScript"],
    intermediate: ["Angular fundamentals","Components","Templates","Services","Routing","Forms","HTTP"],
    advanced: ["RxJS","Testing","Architecture","Deployment"],
    projects: ["Enterprise Angular app"],
    prereqs: ["html-css-javascript-angular"]
  },
  {
    slug: "python-html-css", title: "Python + HTML + CSS", category: "frontend", pathType: "frontend",
    techs: ["python","html","css"], difficulty: "beginner", duration: "~16 hours",
    desc: "Python as server side with HTML/CSS frontend — understand full web stack basics.",
    beginner: ["Python fundamentals","HTML","CSS","HTTP basics"],
    intermediate: ["Templates","Static files","Forms"],
    advanced: ["Deployment"],
    projects: ["Simple Python site"],
    prereqs: []
  },
  {
    slug: "python-html-css-javascript", title: "Python + HTML + CSS + JavaScript", category: "frontend", pathType: "frontend",
    techs: ["python","html","css","javascript"], difficulty: "beginner", duration: "~20 hours",
    desc: "Python backend serving interactive frontend.",
    beginner: ["Python","HTML","CSS","JavaScript fundamentals"],
    intermediate: ["DOM","Fetch","API integration"],
    advanced: ["Deployment"],
    projects: ["Interactive Python site"],
    prereqs: ["python-html-css"]
  },
  {
    slug: "python-flask-html-css-javascript", title: "Python + Flask + HTML + CSS + JavaScript", category: "frontend", pathType: "frontend",
    techs: ["python","flask","html","css","javascript"], difficulty: "intermediate", duration: "~26 hours",
    desc: "Flask-backed web apps with full frontend.",
    beginner: ["Python","Flask fundamentals","HTML","CSS"],
    intermediate: ["Routing","Templates","JavaScript","Fetch","REST APIs"],
    advanced: ["Authentication","Deployment"],
    projects: ["Flask blog","Task manager"],
    prereqs: ["python-html-css-javascript"]
  },
  {
    slug: "python-django-html-css-javascript", title: "Python + Django + HTML + CSS + JavaScript", category: "frontend", pathType: "frontend",
    techs: ["python","django","html","css","javascript"], difficulty: "intermediate", duration: "~30 hours",
    desc: "Django-powered full web apps.",
    beginner: ["Python","Django fundamentals","HTML","CSS"],
    intermediate: ["Models","Views","Templates","JavaScript","APIs"],
    advanced: ["Auth","Deployment"],
    projects: ["Django site","E-commerce"],
    prereqs: ["python-html-css-javascript"]
  },
];

const BACKEND_STACKS = [
  {
    slug: "nodejs-express", title: "Node.js + Express", category: "backend", pathType: "backend",
    techs: ["nodejs","express"], difficulty: "beginner", duration: "~18 hours",
    desc: "Server-side JavaScript with Node and Express — REST APIs from scratch.",
    beginner: ["JavaScript fundamentals","Node.js fundamentals","Modules","npm","File system","HTTP","Environment variables"],
    intermediate: ["Express","Routing","Middleware","Controllers","REST APIs","Validation","Error handling","Authentication","JWT","Authorization"],
    advanced: ["Databases","Testing","Security","Logging","Deployment"],
    projects: ["REST API","Authentication API"],
    prereqs: []
  },
  {
    slug: "nodejs-express-mongodb", title: "Node.js + Express + MongoDB", category: "backend", pathType: "backend",
    techs: ["nodejs","express","mongodb"], difficulty: "intermediate", duration: "~22 hours",
    desc: "MERN-style backend with MongoDB and Mongoose.",
    beginner: ["Node.js","Express","REST APIs"],
    intermediate: ["MongoDB fundamentals","Mongoose","CRUD","Data modeling","Validation","Authentication","JWT","Authorization"],
    advanced: ["Error handling","Testing","Security","Deployment","Capstone"],
    projects: ["Task API","Blog API"],
    prereqs: ["nodejs-express"]
  },
  {
    slug: "nodejs-express-postgres", title: "Node.js + Express + PostgreSQL", category: "backend", pathType: "backend",
    techs: ["nodejs","express","postgres"], difficulty: "intermediate", duration: "~24 hours",
    desc: "Relational backend with PostgreSQL.",
    beginner: ["Node.js","Express","REST"],
    intermediate: ["SQL fundamentals","PostgreSQL","Database design","Queries","Relationships","Transactions","ORM"],
    advanced: ["Authentication","Authorization","Testing","Security","Deployment"],
    projects: ["Inventory API"],
    prereqs: ["nodejs-express"]
  },
  {
    slug: "python-flask", title: "Python + Flask", category: "backend", pathType: "backend",
    techs: ["python","flask"], difficulty: "beginner", duration: "~16 hours",
    desc: "Lightweight Python APIs with Flask.",
    beginner: ["Python fundamentals","Modules/packages","Virtual environments","Flask fundamentals","Routing","Requests/responses"],
    intermediate: ["Templates","REST APIs","Validation","Database integration","Authentication"],
    advanced: ["Testing","Error handling","Security","Deployment"],
    projects: ["Flask API","Microservice"],
    prereqs: []
  },
  {
    slug: "python-django", title: "Python + Django", category: "backend", pathType: "backend",
    techs: ["python","django"], difficulty: "intermediate", duration: "~22 hours",
    desc: "Batteries-included Django backend.",
    beginner: ["Python prerequisites","Django fundamentals","Project structure","Apps","URLs","Views"],
    intermediate: ["Templates","Models","ORM","Forms","Admin","Authentication","Authorization","REST APIs"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["Blog","Task manager"],
    prereqs: ["python-flask"]
  },
  {
    slug: "python-fastapi", title: "Python + FastAPI", category: "backend", pathType: "backend",
    techs: ["python","fastapi"], difficulty: "intermediate", duration: "~20 hours",
    desc: "Modern async APIs with FastAPI and Pydantic.",
    beginner: ["Python fundamentals","FastAPI","Routes","Request validation","Pydantic","REST APIs"],
    intermediate: ["Async concepts","Database integration","Authentication","JWT"],
    advanced: ["Testing","Documentation","Security","Deployment"],
    projects: ["FastAPI service"],
    prereqs: ["python-flask"]
  },
  {
    slug: "java-spring-boot", title: "Java + Spring Boot", category: "backend", pathType: "backend",
    techs: ["java","spring"], difficulty: "intermediate", duration: "~30 hours",
    desc: "Enterprise Java backend with Spring Boot.",
    beginner: ["Java fundamentals","OOP","Collections","Exceptions","Generics","Streams"],
    intermediate: ["Spring fundamentals","Dependency Injection","Spring Boot","REST APIs","Controllers","Services","Repositories","JPA","Database integration","Validation"],
    advanced: ["Authentication","Spring Security","Testing","Architecture","Deployment"],
    projects: ["Employee management API","E-commerce backend"],
    prereqs: []
  },
  {
    slug: "csharp-aspnet", title: "C# + ASP.NET Core", category: "backend", pathType: "backend",
    techs: ["csharp","aspnet"], difficulty: "intermediate", duration: "~26 hours",
    desc: "C# backend with ASP.NET Core.",
    beginner: ["C# fundamentals","OOP","Collections","LINQ","Async/await"],
    intermediate: ["ASP.NET Core","Routing","Controllers","REST APIs","Dependency injection","Entity Framework Core","Database integration"],
    advanced: ["Authentication","Authorization","Testing","Security","Deployment"],
    projects: ["Web API","Task API"],
    prereqs: []
  },
  {
    slug: "go-gin", title: "Go + Gin", category: "backend", pathType: "backend",
    techs: ["go","gin"], difficulty: "intermediate", duration: "~18 hours",
    desc: "Fast Go APIs with Gin.",
    beginner: ["Go fundamentals","Packages","Structs","Interfaces","Error handling","HTTP"],
    intermediate: ["Gin","Routing","Middleware","REST APIs","Database integration","Authentication"],
    advanced: ["Testing","Concurrency","Security","Deployment"],
    projects: ["Go API"],
    prereqs: []
  },
  {
    slug: "php-laravel", title: "PHP + Laravel", category: "backend", pathType: "backend",
    techs: ["php","laravel"], difficulty: "beginner", duration: "~20 hours",
    desc: "PHP backend with Laravel.",
    beginner: ["PHP fundamentals","Composer","Laravel fundamentals","Routing","Controllers"],
    intermediate: ["Blade","Models","Eloquent","Database","Validation","Authentication","Authorization","APIs"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["Blog","Shop"],
    prereqs: []
  },
  {
    slug: "ruby-rails", title: "Ruby + Rails", category: "backend", pathType: "backend",
    techs: ["ruby","rails"], difficulty: "intermediate", duration: "~22 hours",
    desc: "Ruby backend with Rails MVC.",
    beginner: ["Ruby fundamentals","OOP","Gems","Rails fundamentals","MVC","Routes","Controllers"],
    intermediate: ["Views","Models","Active Record","Database","Authentication","APIs"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["Rails blog"],
    prereqs: []
  },
];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsertTechs() {
  const techMap = {};
  for (const t of EXTRA_TECHS) {
    const { prerequisites, ...rest } = t;
    let doc = await Technology.findOne({ slug: t.slug });
    if (!doc) doc = await Technology.findOne({ name: t.name });
    if (!doc) {
      try {
        doc = await Technology.create({ ...rest, status: "available", active: true });
        console.log(`Tech created ${t.slug}`);
      } catch (e) {
        if (e.code === 11000) {
          doc = await Technology.findOne({ name: t.name });
          if (doc) await Technology.updateOne({ _id: doc._id }, { $set: { ...rest, status: "available", active: true } });
          doc = await Technology.findOne({ name: t.name });
        } else throw e;
      }
    } else {
      await Technology.updateOne({ _id: doc._id }, { $set: { ...rest, status: "available", active: true } });
      doc = await Technology.findOne({ _id: doc._id });
    }
    techMap[t.slug] = doc;
    // also map by name lower
    techMap[t.name.toLowerCase()] = doc;
  }
  for (const slug of ["javascript","typescript","python","java","go","rust","php","ruby","kotlin","swift","dart","html","css","react"]) {
    const d = await Technology.findOne({ slug });
    if (d) techMap[slug] = d;
    else {
      const byName = await Technology.findOne({ name: new RegExp(`^${slug}$`, 'i') });
      if (byName) techMap[slug] = byName;
    }
  }
  return techMap;
}

async function createPathWithCurriculum(def, techMap, orderOffset) {
  const techIds = def.techs.map(s => techMap[s]?._id).filter(Boolean);
  // prerequisites: map slug to path id if exists
  const prereqIds = [];
  for (const p of def.prereqs || []) {
    const pr = await LearningPath.findOne({ slug: p });
    if (pr) prereqIds.push(pr._id);
  }
  // clean old
  let existing = await LearningPath.findOne({ slug: def.slug });
  if (existing) {
    const stages = await Stage.find({ learningPath: existing._id });
    for (const s of stages) {
      const topics = await Topic.find({ stage: s._id });
      for (const t of topics) await Lesson.deleteMany({ topic: t._id });
      await Topic.deleteMany({ stage: s._id });
    }
    await Stage.deleteMany({ learningPath: existing._id });
    await LearningPath.deleteOne({ _id: existing._id });
    console.log(`Cleaned ${def.slug}`);
  }
  const path = await LearningPath.create({
    title: def.title,
    slug: def.slug,
    description: def.desc,
    category: def.category,
    technologies: techIds,
    prerequisites: prereqIds,
    difficulty: def.difficulty,
    estimatedDuration: def.duration,
    level: def.difficulty,
    order: orderOffset,
    status: "published",
    active: true,
    pathType: def.category === "frontend" ? "frontend" : "backend",
  });
  console.log(`Path ${def.slug}`);

  let order = 0;
  const levelMap = { beginner: def.beginner, intermediate: def.intermediate, advanced: def.advanced };
  for (const level of ["beginner","intermediate","advanced"]) {
    const topics = levelMap[level] || [];
    const groups = chunk(topics, 4);
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const stageTitle = `${level.charAt(0).toUpperCase()+level.slice(1)} Stage ${gi+1}`;
      const stageSlug = `${def.slug}-${level}-${gi+1}`;
      const stage = await Stage.create({
        title: stageTitle,
        slug: stageSlug,
        description: `${def.title} — ${level}: ${group.join(", ")}`,
        level,
        order: order++,
        learningPath: path._id,
        estimatedMinutes: group.length * 15,
        status: "published",
        active: true,
      });
      const topicChunks = chunk(group, 2);
      for (let ti = 0; ti < topicChunks.length; ti++) {
        const tGroup = topicChunks[ti];
        const topicTitle = tGroup[0];
        const topic = await Topic.create({
          title: topicTitle,
          slug: `${stageSlug}-${ti}-${topicTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
          description: tGroup.join(", "),
          order: ti,
          stage: stage._id,
          technologies: techIds.slice(0,1),
          status: "published",
          active: true,
        });
        for (let li = 0; li < tGroup.length; li++) {
          const lessonTitle = tGroup[li];
          await Lesson.create({
            title: lessonTitle,
            slug: `${topic.slug}-${lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
            description: `Learn ${lessonTitle}`,
            objective: `Understand ${lessonTitle} in ${def.title}`,
            topic: topic._id,
            order: li,
            type: li === tGroup.length -1 && level === "advanced" ? "project" : "concept",
            difficulty: level,
            estimatedMinutes: 15,
            status: "published",
            content: [
              { type: "text", title: "Objective", content: `Understand ${lessonTitle}` },
              { type: "code", title: "Example", content: `// ${lessonTitle} example` },
            ],
            examples: [],
            exercises: [],
            commonMistakes: [`Mistaking ${lessonTitle}`],
            checkpoint: `Explain ${lessonTitle}`,
          });
        }
      }
      // add projects as extra stage for this level if needed? Already in advanced groups projects handled separately
    }
  }
  // projects stage
  if (def.projects && def.projects.length) {
    const projStage = await Stage.create({
      title: "Projects",
      slug: `${def.slug}-projects`,
      description: `${def.title} projects`,
      level: "advanced",
      order: order++,
      learningPath: path._id,
      estimatedMinutes: def.projects.length * 60,
      status: "published",
      active: true,
    });
    const projTopic = await Topic.create({
      title: "Projects",
      slug: `${def.slug}-projects-topic`,
      description: def.projects.join(", "),
      order: 0,
      stage: projStage._id,
      technologies: techIds.slice(0,1),
      status: "published", active: true,
    });
    for (let i=0;i<def.projects.length;i++) {
      const proj = def.projects[i];
      await Lesson.create({
        title: proj,
        slug: `${projTopic.slug}-${proj.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
        description: `Build ${proj}`,
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
  return path;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");
  const techMap = await upsertTechs();
  let order = 10;
  for (const def of FRONTEND_STACKS) await createPathWithCurriculum(def, techMap, order++);
  for (const def of BACKEND_STACKS) await createPathWithCurriculum(def, techMap, order++);
  console.log("Seed frontend/backend complete");
  await mongoose.disconnect();
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });
