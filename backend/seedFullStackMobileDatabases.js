require("dotenv").config();
const mongoose = require("mongoose");
const Technology = require("./models/Technology");
const LearningPath = require("./models/LearningPath");
const Stage = require("./models/Stage");
const Topic = require("./models/Topic");
const { Lesson } = require("./models/Course");

const EXTRA_TECHS = [
  { name: "Flutter", slug: "flutter", type: "framework", category: "mobile", description: "Google UI toolkit" },
  { name: "React Native", slug: "react-native", type: "framework", category: "mobile", description: "React for mobile" },
  { name: "MySQL", slug: "mysql", type: "database", category: "databases", description: "Popular RDBMS" },
  { name: "Redis", slug: "redis", type: "database", category: "databases", description: "In-memory store" },
  { name: "SQL", slug: "sql", type: "database", category: "databases", description: "Query language" },
];

const FULLSTACK = [
  {
    slug: "mern", title: "MERN", desc: "MongoDB · Express · React · Node.js — end-to-end JavaScript full stack.", techs: ["mongodb","express","react","nodejs"], difficulty: "intermediate", duration: "~40 hours",
    beginner: ["Web Foundations","HTML & CSS","JavaScript","React","Node.js","Express"],
    intermediate: ["MongoDB","REST APIs","Authentication","Frontend/Backend Integration"],
    advanced: ["Testing","Security","Deployment","Capstone Project"],
    projects: ["Simple CRUD application","Authentication application","Full-stack application with database and API","Production-style full-stack application"]
  },
  {
    slug: "pern", title: "PERN", desc: "PostgreSQL · Express · React · Node.js — relational full stack.", techs: ["postgres","express","react","nodejs"], difficulty: "intermediate", duration: "~42 hours",
    beginner: ["HTML/CSS","JavaScript","React","Node.js","Express","PostgreSQL","SQL"],
    intermediate: ["REST APIs","Authentication","Authorization","Integration"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["CRUD with Postgres","Auth app","Full-stack PERN app"]
  },
  {
    slug: "mean", title: "MEAN", desc: "MongoDB · Express · Angular · Node.js — Angular full stack.", techs: ["mongodb","express","angular","nodejs","typescript"], difficulty: "intermediate", duration: "~44 hours",
    beginner: ["HTML/CSS","JavaScript","TypeScript","Angular","Node.js","Express","MongoDB"],
    intermediate: ["REST APIs","Authentication","Integration"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["MEAN CRUD","Auth MEAN app"]
  },
  {
    slug: "python-django-react", title: "Python + Django + React", techs: ["python","django","react"], difficulty: "intermediate", duration: "~36 hours",
    desc: "Python backend with Django and React frontend.",
    beginner: ["Python fundamentals","Web fundamentals","HTML/CSS","JavaScript","React","Django","Django ORM"],
    intermediate: ["REST APIs","Authentication","Database","Frontend/backend integration"],
    advanced: ["Testing","Security","Deployment","Capstone"],
    projects: ["Blog with React","Capstone"]
  },
  {
    slug: "python-flask-react", title: "Python + Flask + React", techs: ["python","flask","react"], difficulty: "intermediate", duration: "~30 hours",
    desc: "Lightweight Python + React stack.",
    beginner: ["Python","HTML/CSS","JavaScript","React","Flask"],
    intermediate: ["REST APIs","Database","Authentication","Integration"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["Flask+React CRUD","Auth app"]
  },
  {
    slug: "python-fastapi-react", title: "Python + FastAPI + React", techs: ["python","fastapi","react"], difficulty: "intermediate", duration: "~32 hours",
    desc: "Modern async Python + React.",
    beginner: ["Python","HTML/CSS","JavaScript","React","FastAPI","Pydantic"],
    intermediate: ["REST APIs","Async concepts","Database","Authentication","Integration"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["FastAPI React app"]
  },
  {
    slug: "java-spring-react", title: "Java + Spring Boot + React", techs: ["java","spring","react"], difficulty: "intermediate", duration: "~40 hours",
    desc: "Enterprise Java with React frontend.",
    beginner: ["Java","OOP","Collections","HTML/CSS","JavaScript","React","Spring Boot"],
    intermediate: ["REST APIs","JPA","Database","Authentication","Spring Security","Frontend/backend integration"],
    advanced: ["Testing","Security","Deployment","Capstone"],
    projects: ["Employee management","E-commerce backend + React"]
  },
  {
    slug: "java-spring-angular", title: "Java + Spring Boot + Angular", techs: ["java","spring","angular","typescript"], difficulty: "intermediate", duration: "~42 hours",
    desc: "Java enterprise with Angular.",
    beginner: ["Java","OOP","TypeScript","Angular","Spring Boot"],
    intermediate: ["REST APIs","JPA","Database","Authentication","Security"],
    advanced: ["Testing","Integration","Deployment"],
    projects: ["Angular+Spring app"]
  },
  {
    slug: "csharp-aspnet-react", title: "C# + ASP.NET Core + React", techs: ["csharp","aspnet","react"], difficulty: "intermediate", duration: "~36 hours",
    desc: "Microsoft stack with React.",
    beginner: ["C#","OOP","HTML/CSS","JavaScript","React","ASP.NET Core"],
    intermediate: ["REST APIs","Entity Framework Core","Database","Authentication","Authorization"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["ASP.NET React app"]
  },
  {
    slug: "php-laravel-react", title: "PHP + Laravel + React", techs: ["php","laravel","react"], difficulty: "intermediate", duration: "~34 hours",
    desc: "Laravel backend with React frontend.",
    beginner: ["PHP","Laravel","React","HTML/CSS","JavaScript"],
    intermediate: ["APIs","Database","Auth"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["Laravel React CRUD"]
  },
  {
    slug: "ruby-rails-react", title: "Ruby + Rails + React", techs: ["ruby","rails","react"], difficulty: "intermediate", duration: "~34 hours",
    desc: "Rails backend with React.",
    beginner: ["Ruby","Rails","React"],
    intermediate: ["APIs","Database","Auth"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["Rails React app"]
  },
  {
    slug: "go-gin-react", title: "Go + Gin + React", techs: ["go","gin","react"], difficulty: "intermediate", duration: "~32 hours",
    desc: "Go performant backend with React.",
    beginner: ["Go","Gin","React"],
    intermediate: ["APIs","Database","Auth"],
    advanced: ["Testing","Security","Deployment"],
    projects: ["Go React app"]
  },
];

const MOBILE = [
  {
    slug: "flutter-dart", title: "Flutter + Dart", techs: ["flutter","dart"], difficulty: "beginner", duration: "~28 hours",
    desc: "Cross-platform mobile with Flutter and Dart.",
    beginner: ["Dart fundamentals","Flutter fundamentals","Widgets","Layouts","Navigation","State"],
    intermediate: ["Forms","Networking","REST APIs","Local storage","Authentication","Animations"],
    advanced: ["Testing","Performance","Deployment","Capstone application"],
    projects: ["Counter/utility app","Notes app","Expense tracker","API-based application","Capstone application"]
  },
  {
    slug: "react-native-js", title: "React Native + JavaScript", techs: ["react-native","javascript","react"], difficulty: "intermediate", duration: "~26 hours",
    desc: "Mobile with React Native and JS.",
    beginner: ["JavaScript","React fundamentals","React Native setup","Components","Layouts","Navigation","State"],
    intermediate: ["Forms","Networking","API integration","Storage","Authentication","Device APIs"],
    advanced: ["Testing","Performance","Deployment"],
    projects: ["Notes app","API app"]
  },
  {
    slug: "react-native-ts", title: "React Native + TypeScript", techs: ["react-native","typescript","react"], difficulty: "intermediate", duration: "~28 hours",
    desc: "Type-safe React Native.",
    beginner: ["TypeScript","React","React Native setup","Components"],
    intermediate: ["Navigation","State","Networking","Storage","Auth"],
    advanced: ["Testing","Performance","Deployment"],
    projects: ["Type-safe mobile app"]
  },
  {
    slug: "kotlin-android", title: "Kotlin + Android", techs: ["kotlin"], difficulty: "intermediate", duration: "~30 hours",
    desc: "Native Android with Kotlin.",
    beginner: ["Kotlin fundamentals","Android fundamentals","Project structure","Activities/screens","Layouts/UI","Navigation","State"],
    intermediate: ["Storage","Networking","APIs","Authentication"],
    advanced: ["Testing","Performance","Deployment"],
    projects: ["Android notes","API app"]
  },
  {
    slug: "swift-ios", title: "Swift + iOS", techs: ["swift"], difficulty: "intermediate", duration: "~30 hours",
    desc: "Native iOS with Swift.",
    beginner: ["Swift fundamentals","iOS fundamentals","UI","Navigation","State"],
    intermediate: ["Networking","Storage","Authentication"],
    advanced: ["Testing","Performance","Deployment"],
    projects: ["iOS app"]
  },
];

const DATABASES = [
  {
    slug: "sql-fundamentals", title: "SQL Fundamentals", techs: ["sql"], difficulty: "beginner", duration: "~14 hours",
    desc: "Core SQL for every developer.",
    beginner: ["Databases","Tables","Rows","Columns","Data types","SELECT","INSERT","UPDATE","DELETE","WHERE","ORDER BY"],
    intermediate: ["GROUP BY","JOIN","Subqueries","Constraints","Indexes","Transactions","Normalization","Database design","Practical exercises"],
    advanced: ["Performance","Projects"],
    projects: ["Design DB","Query project"]
  },
  {
    slug: "postgresql", title: "PostgreSQL", techs: ["postgres"], difficulty: "intermediate", duration: "~16 hours",
    desc: "Advanced relational DB.",
    beginner: ["PostgreSQL setup","Tables","Queries","Relationships","Constraints"],
    intermediate: ["Indexes","Transactions","Views","Functions"],
    advanced: ["Performance","Security","Backup concepts","Practical project"],
    projects: ["Postgres project"]
  },
  {
    slug: "mysql", title: "MySQL", techs: ["mysql"], difficulty: "beginner", duration: "~14 hours",
    desc: "Popular MySQL.",
    beginner: ["SQL fundamentals","MySQL setup","Queries","Relationships","Constraints"],
    intermediate: ["Indexes","Transactions","Database design"],
    advanced: ["Performance","Security","Practical projects"],
    projects: ["MySQL project"]
  },
  {
    slug: "mongodb-path", title: "MongoDB", techs: ["mongodb"], difficulty: "beginner", duration: "~14 hours",
    desc: "NoSQL with MongoDB.",
    beginner: ["NoSQL concepts","Documents","Collections","CRUD","Queries","Indexes"],
    intermediate: ["Aggregation","Schema design","Relationships/references","Transactions","MongoDB with Node.js","Mongoose"],
    advanced: ["Performance","Security","Practical project"],
    projects: ["MongoDB project"]
  },
  {
    slug: "redis", title: "Redis", techs: ["redis"], difficulty: "intermediate", duration: "~10 hours",
    desc: "In-memory caching.",
    beginner: ["Caching fundamentals","Key/value data","Strings","Lists","Sets","Hashes","Expiration"],
    intermediate: ["Caching patterns","Sessions","Pub/sub concepts"],
    advanced: ["Performance","Practical usage"],
    projects: ["Cache project"]
  },
];

function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }

async function upsertTechs(){
  const map={};
  for(const t of EXTRA_TECHS){
    let doc=await Technology.findOne({slug:t.slug});
    if(!doc) doc=await Technology.findOne({name:t.name});
    if(!doc){
      try{ doc=await Technology.create({...t, status:"available", active:true}); console.log(`Tech ${t.slug}`);}catch(e){ if(e.code===11000){ doc=await Technology.findOne({name:t.name}); } else throw e; }
    } else {
      await Technology.updateOne({_id:doc._id},{$set:{...t, status:"available", active:true}});
      doc=await Technology.findOne({_id:doc._id});
    }
    map[t.slug]=doc;
    map[t.name.toLowerCase()]=doc;
  }
  for(const s of ["javascript","typescript","python","java","nodejs","express","react","angular","vue","nextjs","html","css","go","rust","php","ruby","kotlin","swift","dart","flutter","react-native","mysql","redis","sql","postgres","mongodb","spring","aspnet","gin","laravel","rails","csharp","c-lang","cpp","django","flask","fastapi"]){
    const d=await Technology.findOne({slug:s})||await Technology.findOne({name:new RegExp(`^${s}$`,'i')});
    if(d) map[s]=d;
  }
  return map;
}

async function createPath(def, techMap, order){
  const techIds=def.techs.map(s=>techMap[s]?._id).filter(Boolean);
  let existing=await LearningPath.findOne({slug:def.slug});
  if(existing){
    const stages=await Stage.find({learningPath:existing._id});
    for(const s of stages){ const topics=await Topic.find({stage:s._id}); for(const t of topics) await Lesson.deleteMany({topic:t._id}); await Topic.deleteMany({stage:s._id}); }
    await Stage.deleteMany({learningPath:existing._id});
    await LearningPath.deleteOne({_id:existing._id});
    console.log(`Cleaned ${def.slug}`);
  }
  const catMap={ "mern":"fullstack","pern":"fullstack","mean":"fullstack","python-django-react":"fullstack","python-flask-react":"fullstack","python-fastapi-react":"fullstack","java-spring-react":"fullstack","java-spring-angular":"fullstack","csharp-aspnet-react":"fullstack","php-laravel-react":"fullstack","ruby-rails-react":"fullstack","go-gin-react":"fullstack","flutter-dart":"mobile","react-native-js":"mobile","react-native-ts":"mobile","kotlin-android":"mobile","swift-ios":"mobile","sql-fundamentals":"databases","postgresql":"databases","mysql":"databases","mongodb-path":"databases","redis":"databases"};
  const category = catMap[def.slug] || "fullstack";
  const pathType = category === "fullstack" ? "fullstack" : category === "mobile" ? "mobile" : "database";
  const path=await LearningPath.create({
    title: def.title, slug: def.slug, description: def.desc, category, technologies: techIds,
    difficulty: def.difficulty, estimatedDuration: def.duration, level: def.difficulty, order, status:"published", active:true, pathType,
  });
  console.log(`Path ${def.slug}`);
  let o=0;
  const levels={ beginner:def.beginner, intermediate:def.intermediate, advanced:def.advanced };
  for(const level of ["beginner","intermediate","advanced"]){
    const groups=chunk(levels[level]||[], 5);
    for(let gi=0;gi<groups.length;gi++){
      const group=groups[gi];
      const stage=await Stage.create({ title:`${level.charAt(0).toUpperCase()+level.slice(1)} Stage ${gi+1}`, slug:`${def.slug}-${level}-${gi+1}`, description: group.join(", "), level, order:o++, learningPath:path._id, estimatedMinutes: group.length*15, status:"published", active:true });
      const tChunks=chunk(group,2);
      for(let ti=0;ti<tChunks.length;ti++){
        const tg=tChunks[ti];
        const topic=await Topic.create({ title:tg[0], slug:`${stage.slug}-${ti}-${tg[0].toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, description: tg.join(", "), order:ti, stage:stage._id, technologies: techIds.slice(0,1), status:"published", active:true });
        for(let li=0;li<tg.length;li++){
          const lessonTitle=tg[li];
          await Lesson.create({ title:lessonTitle, slug:`${topic.slug}-${lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, description:`Learn ${lessonTitle}`, objective:`Understand ${lessonTitle} in ${def.title}`, topic:topic._id, order:li, type:"concept", difficulty:level, estimatedMinutes:15, status:"published", content:[{type:"text",title:"Objective",content:`Understand ${lessonTitle}`},{type:"code",title:"Example",content:`// ${lessonTitle}`} ] });
        }
      }
    }
  }
  if(def.projects){
    const ps=await Stage.create({ title:"Projects", slug:`${def.slug}-projects`, description: def.projects.join(", "), level:"advanced", order:o++, learningPath:path._id, estimatedMinutes:def.projects.length*60, status:"published", active:true });
    const pt=await Topic.create({ title:"Projects", slug:`${def.slug}-projects-topic`, description:def.projects.join(", "), order:0, stage:ps._id, technologies:techIds.slice(0,1), status:"published", active:true });
    for(let i=0;i<def.projects.length;i++){
      const proj=def.projects[i];
      await Lesson.create({ title:proj, slug:`${pt.slug}-${proj.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, description:`Build ${proj}`, objective:`Build ${proj}`, topic:pt._id, order:i, type:"project", difficulty:"advanced", estimatedMinutes:60, status:"published", content:[{type:"text",title:"Project",content:`Build: ${proj}`}] });
    }
  }
  return path;
}

async function seed(){
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");
  const techMap=await upsertTechs();
  let order=20;
  for(const def of FULLSTACK) await createPath(def, techMap, order++);
  for(const def of MOBILE) await createPath(def, techMap, order++);
  for(const def of DATABASES) await createPath(def, techMap, order++);
  console.log("Seed fullstack/mobile/databases complete");
  await mongoose.disconnect();
  process.exit(0);
}
seed().catch(e=>{console.error(e);process.exit(1);});
