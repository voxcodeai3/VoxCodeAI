require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const mongoose = require("mongoose");
const { Course, CourseModule, Lesson } = require("./models/Course");
const LearningPath = require("./models/LearningPath");

const SEED_DATA = {
  courses: [
    {
      title: "JavaScript Fundamentals",
      slug: "javascript-fundamentals",
      description: "Master the core concepts of JavaScript from variables to async programming.",
      language: "javascript",
      difficulty: "beginner",
      estimatedDuration: "~8 hours",
      skills: ["variables", "functions", "arrays", "objects", "dom", "async", "promises", "modules"],
      status: "published",
    },
    {
      title: "Advanced JavaScript",
      slug: "advanced-javascript",
      description: "Deep dive into closures, prototypes, generators, and advanced patterns.",
      language: "javascript",
      difficulty: "advanced",
      estimatedDuration: "~10 hours",
      skills: ["closures", "prototypes", "generators", "iterators", "symbols", "proxy", "meta-programming"],
      status: "published",
    },
    {
      title: "React Fundamentals",
      slug: "react-fundamentals",
      description: "Build modern UIs with React components, hooks, and state management.",
      language: "javascript",
      difficulty: "intermediate",
      estimatedDuration: "~12 hours",
      skills: ["components", "props", "state", "hooks", "effects", "context", "performance"],
      status: "published",
    },
    {
      title: "Node.js Fundamentals",
      slug: "nodejs-fundamentals",
      description: "Server-side JavaScript with Node.js, Express, and MongoDB.",
      language: "javascript",
      difficulty: "intermediate",
      estimatedDuration: "~10 hours",
      skills: ["node", "express", "mongodb", "rest-api", "authentication", "middleware"],
      status: "published",
    },
    {
      title: "Python Fundamentals",
      slug: "python-fundamentals",
      description: "Learn Python from scratch with hands-on coding exercises.",
      language: "python",
      difficulty: "beginner",
      estimatedDuration: "~8 hours",
      skills: ["variables", "functions", "classes", "file-io", "data-structures"],
      status: "published",
    },
  ],

  modules: {
    "javascript-fundamentals": [
      { title: "Getting Started", order: 1 },
      { title: "Functions & Scope", order: 2 },
      { title: "Working with Data", order: 3 },
      { title: "Async Programming", order: 4 },
    ],
    "react-fundamentals": [
      { title: "React Basics", order: 1 },
      { title: "Hooks Deep Dive", order: 2 },
      { title: "State Management", order: 3 },
    ],
    "nodejs-fundamentals": [
      { title: "Node.js Core", order: 1 },
      { title: "Express & APIs", order: 2 },
      { title: "Database Integration", order: 3 },
    ],
    "python-fundamentals": [
      { title: "Python Basics", order: 1 },
      { title: "Functions & OOP", order: 2 },
      { title: "Data Structures", order: 3 },
    ],
    "advanced-javascript": [
      { title: "Closures & Scope", order: 1 },
      { title: "Prototypes & Classes", order: 2 },
      { title: "Generators & Iterators", order: 3 },
    ],
  },

  lessons: {
    "javascript-fundamentals": {
      "Getting Started": [
        {
          title: "Variables & Data Types",
          type: "concept",
          difficulty: "beginner",
          estimatedMinutes: 15,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Variables are containers for storing data values. In JavaScript, you can declare variables using var, let, and const." },
            { type: "code", title: "Example", content: "let name = 'Alice';\nconst age = 25;\nvar isActive = true;\n\nconsole.log(name, age, isActive);", language: "javascript" },
            { type: "text", title: "Key Takeaways", content: "Use const by default. Use let when you need to reassign. Avoid var." },
          ],
        },
        {
          title: "Strings & Numbers",
          type: "coding",
          difficulty: "beginner",
          estimatedMinutes: 20,
          order: 2,
          content: [
            { type: "text", title: "Learn", content: "JavaScript has string and number primitives. Strings can use single, double, or backtick quotes." },
            { type: "code", title: "Example", content: "const greeting = `Hello, ${name}!`;\nconst price = 9.99;\nconsole.log(greeting, typeof price);", language: "javascript" },
            { type: "text", title: "Practice", content: "Create variables for your name, age, and favorite hobby. Log them to the console." },
          ],
        },
        {
          title: "Control Flow",
          type: "concept",
          difficulty: "beginner",
          estimatedMinutes: 15,
          order: 3,
          content: [
            { type: "text", title: "Introduction", content: "Control flow lets you execute different code based on conditions." },
            { type: "code", title: "Example", content: "const age = 18;\n\nif (age >= 18) {\n  console.log('Adult');\n} else {\n  console.log('Minor');\n}", language: "javascript" },
            { type: "text", title: "Key Takeaways", content: "Use if/else for branching. Use switch for multiple exact matches." },
          ],
        },
      ],
      "Functions & Scope": [
        {
          title: "Function Declarations",
          type: "concept",
          difficulty: "beginner",
          estimatedMinutes: 15,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Functions are reusable blocks of code. They can take parameters and return values." },
            { type: "code", title: "Example", content: "function add(a, b) {\n  return a + b;\n}\n\nconst result = add(3, 5);\nconsole.log(result); // 8", language: "javascript" },
            { type: "text", title: "Key Takeaways", content: "Functions let you avoid repetition. Name them clearly." },
          ],
        },
        {
          title: "Arrow Functions",
          type: "coding",
          difficulty: "beginner",
          estimatedMinutes: 20,
          order: 2,
          content: [
            { type: "text", title: "Learn", content: "Arrow functions provide a shorter syntax and lexically bind 'this'." },
            { type: "code", title: "Example", content: "const multiply = (a, b) => a * b;\nconst double = (x) => x * 2;\n\nconsole.log(multiply(4, 3)); // 12\nconsole.log(double(7)); // 14", language: "javascript" },
            { type: "text", title: "Practice", content: "Convert the add function to an arrow function. Then create a function that returns the square of a number." },
          ],
        },
        {
          title: "Scope & Closures",
          type: "concept",
          difficulty: "intermediate",
          estimatedMinutes: 20,
          order: 3,
          required: false,
          content: [
            { type: "text", title: "Introduction", content: "Scope determines where variables are accessible. Closures let functions remember their outer scope." },
            { type: "code", title: "Example", content: "function createCounter() {\n  let count = 0;\n  return {\n    increment: () => ++count,\n    getCount: () => count\n  };\n}\n\nconst counter = createCounter();\nconsole.log(counter.increment()); // 1\nconsole.log(counter.getCount()); // 1", language: "javascript" },
          ],
        },
      ],
      "Working with Data": [
        {
          title: "Arrays",
          type: "concept",
          difficulty: "beginner",
          estimatedMinutes: 15,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Arrays store ordered collections of values. They have powerful methods for transformation." },
            { type: "code", title: "Example", content: "const fruits = ['apple', 'banana', 'cherry'];\nfruits.push('date');\n\nconst upper = fruits.map(f => f.toUpperCase());\nconsole.log(upper);", language: "javascript" },
            { type: "text", title: "Key Takeaways", content: "Use map, filter, reduce for data transformation. Avoid mutating arrays." },
          ],
        },
        {
          title: "Objects",
          type: "concept",
          difficulty: "beginner",
          estimatedMinutes: 15,
          order: 2,
          content: [
            { type: "text", title: "Introduction", content: "Objects store key-value pairs. They represent real-world entities." },
            { type: "code", title: "Example", content: "const user = {\n  name: 'Alice',\n  age: 25,\n  greet() {\n    return `Hi, I'm ${this.name}`;\n  }\n};\n\nconsole.log(user.greet());", language: "javascript" },
          ],
        },
        {
          title: "Destructuring",
          type: "exercise",
          difficulty: "intermediate",
          estimatedMinutes: 20,
          order: 3,
          content: [
            { type: "text", title: "Learn", content: "Destructuring extracts values from arrays and objects into variables." },
            { type: "code", title: "Example", content: "const { name, age } = user;\nconst [first, ...rest] = fruits;\n\nconsole.log(name, first);", language: "javascript" },
            { type: "text", title: "Exercise", content: "Given an object with name, email, and role — extract all three using destructuring. Then create a function that accepts a user object and returns a greeting string using destructured values." },
          ],
        },
      ],
      "Async Programming": [
        {
          title: "Promises",
          type: "concept",
          difficulty: "intermediate",
          estimatedMinutes: 20,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Promises represent eventual completion or failure of an asynchronous operation." },
            { type: "code", title: "Example", content: "const fetchData = () => {\n  return new Promise((resolve, reject) => {\n    setTimeout(() => resolve('Data loaded'), 1000);\n  });\n};\n\nfetchData().then(data => console.log(data));", language: "javascript" },
            { type: "text", title: "Key Takeaways", content: "Promises have three states: pending, fulfilled, rejected." },
          ],
        },
        {
          title: "Async/Await",
          type: "coding",
          difficulty: "intermediate",
          estimatedMinutes: 25,
          order: 2,
          content: [
            { type: "text", title: "Learn", content: "Async/await makes asynchronous code look synchronous. It's syntactic sugar over promises." },
            { type: "code", title: "Example", content: "async function loadUser() {\n  try {\n    const response = await fetch('/api/user');\n    const user = await response.json();\n    return user;\n  } catch (error) {\n    console.error('Failed:', error);\n  }\n}", language: "javascript" },
            { type: "text", title: "Practice", content: "Create an async function that fetches data from an API and handles errors gracefully." },
          ],
        },
      ],
    },

    "react-fundamentals": {
      "React Basics": [
        {
          title: "Components & JSX",
          type: "concept",
          difficulty: "intermediate",
          estimatedMinutes: 15,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Components are the building blocks of React. JSX lets you write HTML-like syntax in JavaScript." },
            { type: "code", title: "Example", content: "function Welcome({ name }) {\n  return <h1>Hello, {name}!</h1>;\n}\n\nfunction App() {\n  return (\n    <div>\n      <Welcome name=\"Alice\" />\n    </div>\n  );\n}", language: "javascript" },
          ],
        },
        {
          title: "Props & Children",
          type: "concept",
          difficulty: "intermediate",
          estimatedMinutes: 15,
          order: 2,
          content: [
            { type: "text", title: "Introduction", content: "Props are read-only inputs passed to components. They flow downward from parent to child." },
            { type: "code", title: "Example", content: "function Card({ title, children }) {\n  return (\n    <div className=\"card\">\n      <h2>{title}</h2>\n      {children}\n    </div>\n  );\n}", language: "javascript" },
          ],
        },
      ],
      "Hooks Deep Dive": [
        {
          title: "useState & useEffect",
          type: "coding",
          difficulty: "intermediate",
          estimatedMinutes: 25,
          order: 1,
          content: [
            { type: "text", title: "Learn", content: "useState manages local state. useEffect handles side effects." },
            { type: "code", title: "Example", content: "function Counter() {\n  const [count, setCount] = useState(0);\n\n  useEffect(() => {\n    document.title = `Count: ${count}`;\n  }, [count]);\n\n  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;\n}", language: "javascript" },
            { type: "text", title: "Practice", content: "Build a timer component that counts up every second. Clean up the interval on unmount." },
          ],
        },
        {
          title: "useRef & useMemo",
          type: "concept",
          difficulty: "intermediate",
          estimatedMinutes: 20,
          order: 2,
          required: false,
          content: [
            { type: "text", title: "Introduction", content: "useRef stores mutable values that don't trigger re-renders. useMemo memoizes expensive calculations." },
            { type: "code", title: "Example", content: "const inputRef = useRef(null);\nconst expensiveValue = useMemo(() => computeExpensive(data), [data]);", language: "javascript" },
          ],
        },
      ],
      "State Management": [
        {
          title: "useContext",
          type: "concept",
          difficulty: "intermediate",
          estimatedMinutes: 20,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Context provides a way to pass data through the component tree without props drilling." },
            { type: "code", title: "Example", content: "const ThemeContext = createContext('light');\n\nfunction App() {\n  return (\n    <ThemeContext.Provider value=\"dark\">\n      <ThemedButton />\n    </ThemeContext.Provider>\n  );\n}", language: "javascript" },
          ],
        },
      ],
    },

    "nodejs-fundamentals": {
      "Node.js Core": [
        {
          title: "Node.js Basics",
          type: "concept",
          difficulty: "intermediate",
          estimatedMinutes: 15,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Node.js runs JavaScript on the server. It uses an event-driven, non-blocking I/O model." },
            { type: "code", title: "Example", content: "const http = require('http');\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'text/plain' });\n  res.end('Hello World');\n});\n\nserver.listen(3000);", language: "javascript" },
          ],
        },
      ],
      "Express & APIs": [
        {
          title: "Express Routes",
          type: "coding",
          difficulty: "intermediate",
          estimatedMinutes: 25,
          order: 1,
          content: [
            { type: "text", title: "Learn", content: "Express simplifies building APIs with routing and middleware." },
            { type: "code", title: "Example", content: "const express = require('express');\nconst app = express();\n\napp.get('/api/users', (req, res) => {\n  res.json([{ id: 1, name: 'Alice' }]);\n});\n\napp.listen(3000);", language: "javascript" },
            { type: "text", title: "Practice", content: "Create a REST API with GET, POST, and DELETE routes for a todo list." },
          ],
        },
      ],
      "Database Integration": [
        {
          title: "MongoDB with Mongoose",
          type: "coding",
          difficulty: "intermediate",
          estimatedMinutes: 30,
          order: 1,
          content: [
            { type: "text", title: "Learn", content: "Mongoose provides a schema-based solution to model your application data." },
            { type: "code", title: "Example", content: "const userSchema = new mongoose.Schema({\n  name: { type: String, required: true },\n  email: { type: String, unique: true }\n});\n\nconst User = mongoose.model('User', userSchema);", language: "javascript" },
          ],
        },
      ],
    },

    "python-fundamentals": {
      "Python Basics": [
        {
          title: "Variables & Types",
          type: "concept",
          difficulty: "beginner",
          estimatedMinutes: 15,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Python is dynamically typed. Variables don't need explicit type declarations." },
            { type: "code", title: "Example", content: "name = 'Alice'\nage = 25\npi = 3.14\nis_active = True\n\nprint(f'{name} is {age} years old')", language: "python" },
          ],
        },
      ],
      "Functions & OOP": [
        {
          title: "Functions",
          type: "concept",
          difficulty: "beginner",
          estimatedMinutes: 15,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Functions in Python use the def keyword. They can have default parameters and return values." },
            { type: "code", title: "Example", content: "def greet(name, greeting='Hello'):\n    return f'{greeting}, {name}!'\n\nprint(greet('Alice'))\nprint(greet('Bob', 'Hi'))", language: "python" },
          ],
        },
        {
          title: "Classes",
          type: "coding",
          difficulty: "intermediate",
          estimatedMinutes: 25,
          order: 2,
          content: [
            { type: "text", title: "Learn", content: "Python uses classes for object-oriented programming. The __init__ method initializes instances." },
            { type: "code", title: "Example", content: "class Dog:\n    def __init__(self, name, breed):\n        self.name = name\n        self.breed = breed\n\n    def bark(self):\n        return f'{self.name} says Woof!'\n\nrex = Dog('Rex', 'Labrador')\nprint(rex.bark())", language: "python" },
          ],
        },
      ],
      "Data Structures": [
        {
          title: "Lists & Dictionaries",
          type: "exercise",
          difficulty: "beginner",
          estimatedMinutes: 20,
          order: 1,
          content: [
            { type: "text", title: "Learn", content: "Python has powerful built-in data structures: lists for ordered data, dictionaries for key-value pairs." },
            { type: "code", title: "Example", content: "fruits = ['apple', 'banana', 'cherry']\nfruits.append('date')\n\nperson = {'name': 'Alice', 'age': 25}\nperson['email'] = 'alice@example.com'", language: "python" },
            { type: "text", title: "Exercise", content: "Create a dictionary of 3 students with their grades. Write a function that returns the average grade." },
          ],
        },
      ],
    },

    "advanced-javascript": {
      "Closures & Scope": [
        {
          title: "Advanced Closures",
          type: "concept",
          difficulty: "advanced",
          estimatedMinutes: 20,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "Closures are functions that remember their lexical scope even when executed outside that scope." },
            { type: "code", title: "Example", content: "function createPipeline(...fns) {\n  return (input) => fns.reduce((acc, fn) => fn(acc), input);\n}\n\nconst process = createPipeline(\n  x => x + 1,\n  x => x * 2,\n  x => x - 3\n);\n\nconsole.log(process(5)); // 9", language: "javascript" },
          ],
        },
      ],
      "Prototypes & Classes": [
        {
          title: "Prototypal Inheritance",
          type: "concept",
          difficulty: "advanced",
          estimatedMinutes: 20,
          order: 1,
          content: [
            { type: "text", title: "Introduction", content: "JavaScript uses prototypal inheritance. Objects can inherit directly from other objects." },
            { type: "code", title: "Example", content: "const animal = {\n  speak() { return `${this.name} makes a noise`; }\n};\n\nconst dog = Object.create(animal);\ndog.name = 'Rex';\ndog.bark = function() { return `${this.name} barks`; };\n\nconsole.log(dog.speak());\nconsole.log(dog.bark());", language: "javascript" },
          ],
        },
      ],
      "Generators & Iterators": [
        {
          title: "Generators",
          type: "coding",
          difficulty: "advanced",
          estimatedMinutes: 25,
          order: 1,
          content: [
            { type: "text", title: "Learn", content: "Generators are functions that can be paused and resumed. They yield values lazily." },
            { type: "code", title: "Example", content: "function* fibonacci() {\n  let a = 0, b = 1;\n  while (true) {\n    yield a;\n    [a, b] = [b, a + b];\n  }\n}\n\nconst fib = fibonacci();\nconsole.log(fib.next().value); // 0\nconsole.log(fib.next().value); // 1\nconsole.log(fib.next().value); // 1", language: "javascript" },
          ],
        },
      ],
    },
  },

  learningPaths: [
    {
      title: "Frontend Developer",
      slug: "frontend-developer",
      description: "Master building modern web interfaces with JavaScript and React.",
      difficulty: "beginner",
      estimatedDuration: "~30 hours",
      skills: ["javascript", "react", "css", "dom", "state-management"],
      icon: "Layout",
      status: "published",
      courseSlugs: ["javascript-fundamentals", "react-fundamentals"],
    },
    {
      title: "Backend Developer",
      slug: "backend-developer",
      description: "Build server-side applications with Node.js, Express, and MongoDB.",
      difficulty: "intermediate",
      estimatedDuration: "~20 hours",
      skills: ["node", "express", "mongodb", "rest-api", "authentication"],
      icon: "Server",
      status: "published",
      courseSlugs: ["javascript-fundamentals", "nodejs-fundamentals"],
    },
    {
      title: "Full-Stack Developer",
      slug: "fullstack-developer",
      description: "Become a complete developer with frontend, backend, and database skills.",
      difficulty: "intermediate",
      estimatedDuration: "~50 hours",
      skills: ["javascript", "react", "node", "express", "mongodb"],
      icon: "Layers",
      status: "published",
      courseSlugs: ["javascript-fundamentals", "react-fundamentals", "nodejs-fundamentals"],
    },
    {
      title: "Python Developer",
      slug: "python-developer",
      description: "Learn Python from fundamentals to building real applications.",
      difficulty: "beginner",
      estimatedDuration: "~8 hours",
      skills: ["python", "data-structures", "classes", "file-io"],
      icon: "Code2",
      status: "published",
      courseSlugs: ["python-fundamentals"],
    },
    {
      title: "JavaScript Mastery",
      slug: "javascript-mastery",
      description: "Deep dive into advanced JavaScript concepts and patterns.",
      difficulty: "advanced",
      estimatedDuration: "~18 hours",
      skills: ["closures", "prototypes", "generators", "async", "modules"],
      icon: "Zap",
      status: "published",
      courseSlugs: ["javascript-fundamentals", "advanced-javascript"],
    },
  ],
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    await Course.deleteMany({});
    await CourseModule.deleteMany({});
    await Lesson.deleteMany({});
    await LearningPath.deleteMany({});

    const courseSlugMap = {};

    for (const c of SEED_DATA.courses) {
      const course = await Course.create(c);
      courseSlugMap[c.slug] = course._id;
      console.log(`Created course: ${c.title}`);
    }

    const lessonIdMap = {};

    for (const [courseSlug, modules] of Object.entries(SEED_DATA.modules)) {
      const courseId = courseSlugMap[courseSlug];
      if (!courseId) continue;

      for (const mod of modules) {
        const module = await CourseModule.create({ ...mod, course: courseId });
        console.log(`  Created module: ${mod.title}`);

        const lessons = SEED_DATA.lessons[courseSlug]?.[mod.title] || [];
        for (const lesson of lessons) {
          const created = await Lesson.create({ ...lesson, module: module._id });
          lessonIdMap[`${courseSlug}:${mod.title}:${lesson.title}`] = created._id;
        }
      }
    }

    for (const path of SEED_DATA.learningPaths) {
      const courseIds = path.courseSlugs.map((slug, i) => ({
        course: courseSlugMap[slug],
        order: i + 1,
        required: true,
      })).filter((c) => c.course);

      await LearningPath.create({
        title: path.title,
        slug: path.slug,
        description: path.description,
        difficulty: path.difficulty,
        estimatedDuration: path.estimatedDuration,
        skills: path.skills,
        icon: path.icon,
        status: path.status,
        courses: courseIds,
      });
      console.log(`Created learning path: ${path.title}`);
    }

    console.log("\nSeed completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
