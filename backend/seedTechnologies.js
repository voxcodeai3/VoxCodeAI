require("dotenv").config();
const mongoose = require("mongoose");
const Technology = require("./models/Technology");
const Stack = require("./models/Stack");
const { Course, CourseModule, Lesson } = require("./models/Course");
const LearningPath = require("./models/LearningPath");

const TECHNOLOGIES = [
  // Languages
  { name: "JavaScript", slug: "javascript", type: "language", category: "Programming Language", difficulty: "beginner", description: "The language of the web. Essential for frontend and backend development.", relatedGoals: ["frontend", "backend", "fullstack", "mobile", "game_dev"] },
  { name: "TypeScript", slug: "typescript", type: "language", category: "Programming Language", difficulty: "intermediate", description: "JavaScript with static typing. Industry standard for large projects.", relatedGoals: ["frontend", "backend", "fullstack"], prerequisites: ["javascript"] },
  { name: "Python", slug: "python", type: "language", category: "Programming Language", difficulty: "beginner", description: "Versatile language for web, AI, data science, and automation.", relatedGoals: ["backend", "ai_ml", "data_science", "programming_language"] },
  { name: "Java", slug: "java", type: "language", category: "Programming Language", difficulty: "intermediate", description: "Enterprise-grade language for backend and Android development.", relatedGoals: ["backend", "software_engineering", "dsa"] },
  { name: "C#", slug: "csharp", type: "language", category: "Programming Language", difficulty: "intermediate", description: "Microsoft language for game dev, enterprise apps, and web.", relatedGoals: ["game_dev", "backend", "software_engineering"] },
  { name: "C++", slug: "cpp", type: "language", category: "Programming Language", difficulty: "advanced", description: "High-performance language for systems, games, and competitive programming.", relatedGoals: ["game_dev", "dsa", "software_engineering"] },
  { name: "Go", slug: "go", type: "language", category: "Programming Language", difficulty: "intermediate", description: "Fast, simple language for backend and cloud services.", relatedGoals: ["backend", "software_engineering"] },
  { name: "Rust", slug: "rust", type: "language", category: "Programming Language", difficulty: "advanced", description: "Safe, fast language for systems programming.", relatedGoals: ["software_engineering"] },
  { name: "Kotlin", slug: "kotlin", type: "language", category: "Programming Language", difficulty: "intermediate", description: "Modern language for Android and backend development.", relatedGoals: ["mobile", "backend"] },
  { name: "Swift", slug: "swift", type: "language", category: "Programming Language", difficulty: "intermediate", description: "Apple's language for iOS and macOS development.", relatedGoals: ["mobile"] },
  { name: "Dart", slug: "dart", type: "language", category: "Programming Language", difficulty: "intermediate", description: "Language for Flutter cross-platform mobile development.", relatedGoals: ["mobile"] },
  { name: "PHP", slug: "php", type: "language", category: "Programming Language", difficulty: "beginner", description: "Server-side language powering much of the web.", relatedGoals: ["backend"] },
  { name: "Ruby", slug: "ruby", type: "language", category: "Programming Language", difficulty: "beginner", description: "Elegant language for web development with Rails.", relatedGoals: ["backend"] },
  { name: "R", slug: "r", type: "language", category: "Programming Language", difficulty: "intermediate", description: "Language for statistics and data analysis.", relatedGoals: ["data_science"] },

  // Frontend
  { name: "HTML", slug: "html", type: "language", category: "Frontend", difficulty: "beginner", description: "The structure of every web page.", relatedGoals: ["frontend", "fullstack"] },
  { name: "CSS", slug: "css", type: "language", category: "Frontend", difficulty: "beginner", description: "Styling and layout for web pages.", relatedGoals: ["frontend", "fullstack"] },
  { name: "React", slug: "react", type: "framework", category: "Frontend", difficulty: "intermediate", description: "The most popular UI library for building modern web interfaces.", relatedGoals: ["frontend", "fullstack"], prerequisites: ["javascript"] },
  { name: "Angular", slug: "angular", type: "framework", category: "Frontend", difficulty: "intermediate", description: "Full-featured framework for large-scale web applications.", relatedGoals: ["frontend", "fullstack"], prerequisites: ["typescript"] },
  { name: "Vue", slug: "vue", type: "framework", category: "Frontend", difficulty: "intermediate", description: "Progressive framework for building user interfaces.", relatedGoals: ["frontend", "fullstack"], prerequisites: ["javascript"] },
  { name: "Svelte", slug: "svelte", type: "framework", category: "Frontend", difficulty: "intermediate", description: "Compile-time framework with minimal boilerplate.", relatedGoals: ["frontend", "fullstack"], prerequisites: ["javascript"] },
  { name: "Next.js", slug: "nextjs", type: "framework", category: "Frontend", difficulty: "intermediate", description: "React framework for production-grade web apps.", relatedGoals: ["frontend", "fullstack"], prerequisites: ["react"] },
  { name: "Tailwind CSS", slug: "tailwind", type: "library", category: "Frontend", difficulty: "beginner", description: "Utility-first CSS framework for rapid UI development.", relatedGoals: ["frontend", "fullstack"] },

  // Backend
  { name: "Node.js", slug: "nodejs", type: "runtime", category: "Backend", difficulty: "intermediate", description: "JavaScript runtime for server-side development.", relatedGoals: ["backend", "fullstack"], prerequisites: ["javascript"] },
  { name: "Express", slug: "express", type: "framework", category: "Backend", difficulty: "intermediate", description: "Minimal, flexible Node.js web framework.", relatedGoals: ["backend", "fullstack"], prerequisites: ["nodejs"] },
  { name: "NestJS", slug: "nestjs", type: "framework", category: "Backend", difficulty: "advanced", description: "Progressive Node.js framework for enterprise apps.", relatedGoals: ["backend"], prerequisites: ["typescript"] },
  { name: "Django", slug: "django", type: "framework", category: "Backend", difficulty: "intermediate", description: "High-level Python web framework for rapid development.", relatedGoals: ["backend"], prerequisites: ["python"] },
  { name: "Flask", slug: "flask", type: "framework", category: "Backend", difficulty: "intermediate", description: "Lightweight Python web framework.", relatedGoals: ["backend"], prerequisites: ["python"] },
  { name: "FastAPI", slug: "fastapi", type: "framework", category: "Backend", difficulty: "intermediate", description: "Modern, fast Python API framework.", relatedGoals: ["backend"], prerequisites: ["python"] },
  { name: "Spring Boot", slug: "springboot", type: "framework", category: "Backend", difficulty: "advanced", description: "Java framework for production-ready applications.", relatedGoals: ["backend"], prerequisites: ["java"] },
  { name: "Laravel", slug: "laravel", type: "framework", category: "Backend", difficulty: "intermediate", description: "Elegant PHP framework for web applications.", relatedGoals: ["backend"], prerequisites: ["php"] },
  { name: "ASP.NET Core", slug: "aspnet", type: "framework", category: "Backend", difficulty: "advanced", description: "Cross-platform .NET framework for web apps.", relatedGoals: ["backend"], prerequisites: ["csharp"] },
  { name: "Gin", slug: "gin", type: "framework", category: "Backend", difficulty: "intermediate", description: "Fast Go web framework.", relatedGoals: ["backend"], prerequisites: ["go"] },

  // Databases
  { name: "MongoDB", slug: "mongodb", type: "database", category: "Database", difficulty: "intermediate", description: "NoSQL document database for modern apps.", relatedGoals: ["backend", "fullstack"] },
  { name: "PostgreSQL", slug: "postgresql", type: "database", category: "Database", difficulty: "intermediate", description: "Powerful open-source relational database.", relatedGoals: ["backend", "fullstack"] },
  { name: "MySQL", slug: "mysql", type: "database", category: "Database", difficulty: "intermediate", description: "World's most popular open-source database.", relatedGoals: ["backend", "fullstack"] },
  { name: "SQL Server", slug: "sqlserver", type: "database", category: "Database", difficulty: "intermediate", description: "Microsoft's enterprise relational database.", relatedGoals: ["backend"], prerequisites: ["csharp"] },

  // Mobile
  { name: "React Native", slug: "reactnative", type: "framework", category: "Mobile", difficulty: "intermediate", description: "Build mobile apps with React.", relatedGoals: ["mobile"], prerequisites: ["react"] },
  { name: "Flutter", slug: "flutter", type: "framework", category: "Mobile", difficulty: "intermediate", description: "Google's UI toolkit for cross-platform apps.", relatedGoals: ["mobile"], prerequisites: ["dart"] },

  // AI/ML
  { name: "NumPy", slug: "numpy", type: "library", category: "AI/ML", difficulty: "intermediate", description: "Numerical computing with Python.", relatedGoals: ["ai_ml", "data_science"], prerequisites: ["python"] },
  { name: "Pandas", slug: "pandas", type: "library", category: "AI/ML", difficulty: "intermediate", description: "Data manipulation and analysis.", relatedGoals: ["ai_ml", "data_science"], prerequisites: ["python"] },
  { name: "scikit-learn", slug: "sklearn", type: "library", category: "AI/ML", difficulty: "intermediate", description: "Machine learning with Python.", relatedGoals: ["ai_ml"], prerequisites: ["python"] },
  { name: "PyTorch", slug: "pytorch", type: "library", category: "AI/ML", difficulty: "advanced", description: "Deep learning framework.", relatedGoals: ["ai_ml"], prerequisites: ["python"] },
  { name: "TensorFlow", slug: "tensorflow", type: "library", category: "AI/ML", difficulty: "advanced", description: "End-to-end ML platform.", relatedGoals: ["ai_ml"], prerequisites: ["python"] },

  // Tools
  { name: "Git", slug: "git", type: "tool", category: "Tools", difficulty: "beginner", description: "Version control system for tracking code changes.", relatedGoals: ["frontend", "backend", "fullstack", "mobile", "software_engineering"] },
  { name: "Docker", slug: "docker", type: "tool", category: "Tools", difficulty: "intermediate", description: "Container platform for consistent development environments.", relatedGoals: ["backend", "fullstack", "software_engineering"] },

  // Game Engines
  { name: "Unity", slug: "unity", type: "game_engine", category: "Game Development", difficulty: "intermediate", description: "World's most popular game engine.", relatedGoals: ["game_dev"], prerequisites: ["csharp"] },
  { name: "Unreal Engine", slug: "unreal", type: "game_engine", category: "Game Development", difficulty: "advanced", description: "AAA game engine by Epic Games.", relatedGoals: ["game_dev"], prerequisites: ["cpp"] },
  { name: "Godot", slug: "godot", type: "game_engine", category: "Game Development", difficulty: "beginner", description: "Open-source game engine with GDScript.", relatedGoals: ["game_dev"] },
];

const STACKS = [
  // Frontend
  { name: "HTML + CSS + JavaScript", slug: "html-css-js", goal: "frontend", technologies: ["html", "css", "javascript"], difficulty: "beginner", estimatedWeeks: "4-6", whatYouWillLearn: ["Web page structure", "Styling and layout", "Interactive web pages"], description: "The foundation of all web development." },
  { name: "React Frontend", slug: "react-frontend", goal: "frontend", technologies: ["html", "css", "javascript", "react"], difficulty: "intermediate", estimatedWeeks: "8-12", whatYouWillLearn: ["Component architecture", "State management", "Modern UI development"], description: "Build modern, interactive user interfaces with React." },
  { name: "React + TypeScript", slug: "react-typescript", goal: "frontend", technologies: ["html", "css", "javascript", "typescript", "react"], difficulty: "intermediate", estimatedWeeks: "10-14", whatYouWillLearn: ["Type-safe React", "Enterprise patterns", "Scalable frontend"], description: "Type-safe React development for production apps." },
  { name: "Next.js + TypeScript", slug: "nextjs-typescript", goal: "frontend", technologies: ["html", "css", "javascript", "typescript", "react", "nextjs"], difficulty: "intermediate", estimatedWeeks: "12-16", whatYouWillLearn: ["Server-side rendering", "Full-stack React", "Production deployment"], description: "Production-grade React with Next.js." },
  { name: "Vue Frontend", slug: "vue-frontend", goal: "frontend", technologies: ["html", "css", "javascript", "vue"], difficulty: "intermediate", estimatedWeeks: "8-12", whatYouWillLearn: ["Reactive UI", "Component system", "Vue ecosystem"], description: "Progressive framework for building UIs." },
  { name: "Angular Frontend", slug: "angular-frontend", goal: "frontend", technologies: ["html", "css", "typescript", "angular"], difficulty: "intermediate", estimatedWeeks: "10-14", whatYouWillLearn: ["Enterprise Angular", "TypeScript patterns", "Large-scale apps"], description: "Full-featured framework for enterprise applications." },

  // Backend
  { name: "Node.js + Express + MongoDB", slug: "node-express-mongo", goal: "backend", technologies: ["javascript", "nodejs", "express", "mongodb"], difficulty: "intermediate", estimatedWeeks: "8-12", whatYouWillLearn: ["REST APIs", "Database design", "Authentication"], description: "Build RESTful APIs with the MERN stack backend." },
  { name: "Node.js + Express + PostgreSQL", slug: "node-express-pg", goal: "backend", technologies: ["javascript", "nodejs", "express", "postgresql"], difficulty: "intermediate", estimatedWeeks: "8-12", whatYouWillLearn: ["SQL databases", "REST APIs", "Data modeling"], description: "Node.js backend with PostgreSQL." },
  { name: "Python + Django + PostgreSQL", slug: "python-django-pg", goal: "backend", technologies: ["python", "django", "postgresql"], difficulty: "intermediate", estimatedWeeks: "10-14", whatYouWillLearn: ["Django patterns", "ORM", "Admin interface"], description: "Rapid web development with Django." },
  { name: "Python + FastAPI + PostgreSQL", slug: "python-fastapi-pg", goal: "backend", technologies: ["python", "fastapi", "postgresql"], difficulty: "intermediate", estimatedWeeks: "8-12", whatYouWillLearn: ["Async APIs", "Type hints", "Modern Python"], description: "High-performance Python APIs with FastAPI." },
  { name: "Java + Spring Boot + PostgreSQL", slug: "java-spring-pg", goal: "backend", technologies: ["java", "springboot", "postgresql"], difficulty: "advanced", estimatedWeeks: "12-16", whatYouWillLearn: ["Enterprise Java", "Spring ecosystem", "Microservices"], description: "Enterprise-grade backend with Spring Boot." },

  // Full-Stack
  { name: "MERN Stack", slug: "mern", goal: "fullstack", technologies: ["javascript", "react", "nodejs", "express", "mongodb"], difficulty: "intermediate", estimatedWeeks: "14-20", whatYouWillLearn: ["Frontend + Backend", "Full-stack apps", "Database design", "Authentication", "REST APIs"], description: "MongoDB, Express, React, Node.js — the complete JavaScript stack." },
  { name: "PERN Stack", slug: "pern", goal: "fullstack", technologies: ["javascript", "react", "nodejs", "express", "postgresql"], difficulty: "intermediate", estimatedWeeks: "14-20", whatYouWillLearn: ["Full-stack development", "SQL databases", "Production deployment"], description: "PostgreSQL, Express, React, Node.js." },
  { name: "Next.js + PostgreSQL", slug: "nextjs-pg", goal: "fullstack", technologies: ["typescript", "react", "nextjs", "postgresql"], difficulty: "intermediate", estimatedWeeks: "14-18", whatYouWillLearn: ["Full-stack Next.js", "Server components", "Database integration"], description: "Modern full-stack with Next.js." },
  { name: "React + Django + PostgreSQL", slug: "react-django-pg", goal: "fullstack", technologies: ["python", "react", "django", "postgresql"], difficulty: "intermediate", estimatedWeeks: "14-20", whatYouWillLearn: ["Python backend", "React frontend", "Full-stack deployment"], description: "React frontend with Django backend." },

  // Mobile
  { name: "React Native + JavaScript", slug: "rn-js", goal: "mobile", technologies: ["javascript", "react", "reactnative"], difficulty: "intermediate", estimatedWeeks: "10-14", whatYouWillLearn: ["Cross-platform mobile", "React Native patterns", "Mobile APIs"], description: "Build iOS and Android apps with React Native." },
  { name: "Flutter + Dart", slug: "flutter-dart", goal: "mobile", technologies: ["dart", "flutter"], difficulty: "intermediate", estimatedWeeks: "10-14", whatYouWillLearn: ["Cross-platform mobile", "Widget system", "Mobile development"], description: "Beautiful cross-platform apps with Flutter." },

  // Python / AI
  { name: "Python Fundamentals", slug: "python-fundamentals", goal: "python", technologies: ["python"], difficulty: "beginner", estimatedWeeks: "6-8", whatYouWillLearn: ["Python syntax", "Data structures", "OOP", "File handling"], description: "Learn Python from scratch." },
  { name: "Python for AI", slug: "python-ai", goal: "ai_ml", technologies: ["python", "numpy", "pandas", "sklearn"], difficulty: "intermediate", estimatedWeeks: "12-16", whatYouWillLearn: ["Data manipulation", "ML fundamentals", "Model building"], description: "Python foundation for AI and machine learning." },
  { name: "Machine Learning with Python", slug: "ml-python", goal: "ai_ml", technologies: ["python", "numpy", "pandas", "sklearn", "pytorch"], difficulty: "advanced", estimatedWeeks: "16-20", whatYouWillLearn: ["ML algorithms", "Deep learning", "Neural networks"], description: "Deep dive into machine learning." },

  // DSA
  { name: "DSA with JavaScript", slug: "dsa-js", goal: "dsa", technologies: ["javascript"], difficulty: "intermediate", estimatedWeeks: "12-16", whatYouWillLearn: ["Data structures", "Algorithms", "Problem solving", "Complexity analysis"], description: "Master data structures and algorithms with JavaScript." },
  { name: "DSA with Python", slug: "dsa-python", goal: "dsa", technologies: ["python"], difficulty: "intermediate", estimatedWeeks: "12-16", whatYouWillLearn: ["Data structures", "Algorithms", "Competitive programming"], description: "DSA with Python." },
  { name: "DSA with C++", slug: "dsa-cpp", goal: "dsa", technologies: ["cpp"], difficulty: "advanced", estimatedWeeks: "14-18", whatYouWillLearn: ["Low-level data structures", "Optimized algorithms", "Competitive programming"], description: "DSA with C++ for competitive programming." },

  // Game Dev
  { name: "C# + Unity", slug: "csharp-unity", goal: "game_dev", technologies: ["csharp", "unity"], difficulty: "intermediate", estimatedWeeks: "14-20", whatYouWillLearn: ["Game physics", "Unity scripting", "2D/3D games"], description: "Build games with Unity and C#." },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    await Technology.deleteMany({});
    await Stack.deleteMany({});

    const techResult = await Technology.insertMany(TECHNOLOGIES);
    console.log(`Created ${techResult.length} technologies`);

    const stackResult = await Stack.insertMany(STACKS);
    console.log(`Created ${stackResult.length} stacks`);

    // Ensure existing courses have correct slugs for linking
    const existingCourses = await Course.find({});
    console.log(`\nExisting courses: ${existingCourses.length}`);
    for (const c of existingCourses) {
      console.log(`  - ${c.title} (${c.slug})`);
    }

    const existingPaths = await LearningPath.find({});
    console.log(`Existing learning paths: ${existingPaths.length}`);
    for (const p of existingPaths) {
      console.log(`  - ${p.title} (${p.slug})`);
    }

    console.log("\nTechnology & Stack seed completed!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
