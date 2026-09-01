require("dotenv").config();
const mongoose = require("mongoose");
const AssessmentQuestion = require("./models/AssessmentQuestion");
const Assessment = require("./models/Assessment");

const QUESTIONS = [
  // ===== JAVASCRIPT VARIABLES =====
  {
    type: "multiple_choice", skill: "Variables", category: "JavaScript", difficulty: "easy",
    prompt: "Which keyword declares a block-scoped variable that can be reassigned?",
    options: ["var", "let", "const", "define"],
    correctAnswer: "let",
    explanation: "let is block-scoped and can be reassigned. const is block-scoped but cannot be reassigned. var is function-scoped.",
    tags: ["variables", "scope"],
  },
  {
    type: "true_false", skill: "Variables", category: "JavaScript", difficulty: "easy",
    prompt: "const variables in JavaScript can be reassigned after declaration.",
    correctAnswer: "false",
    explanation: "const prevents reassignment of the variable binding, not the value itself (objects/arrays can still be mutated).",
    tags: ["variables", "const"],
  },
  {
    type: "code_output", skill: "Variables", category: "JavaScript", difficulty: "medium",
    prompt: "What does this code output?\n\nlet x = 10;\nlet y = x;\ny = 20;\nconsole.log(x, y);",
    correctAnswer: "10 20",
    explanation: "Primitives are copied by value. Changing y doesn't affect x.",
    tags: ["variables", "primitives"],
  },

  // ===== FUNCTIONS =====
  {
    type: "multiple_choice", skill: "Functions", category: "JavaScript", difficulty: "easy",
    prompt: "What is the correct way to declare an arrow function that takes one parameter and returns its value doubled?",
    options: ["const double = x => x * 2", "const double = (x) -> x * 2", "const double = x -> x * 2", "const double = => x * 2"],
    correctAnswer: "const double = x => x * 2",
    explanation: "Arrow functions use => syntax. Single parameters don't need parentheses.",
    tags: ["functions", "arrow-functions"],
  },
  {
    type: "code_output", skill: "Functions", category: "JavaScript", difficulty: "medium",
    prompt: "What does this return?\n\nfunction greet(name = 'World') {\n  return `Hello, ${name}!`;\n}\nconsole.log(greet());",
    correctAnswer: "Hello, World!",
    explanation: "Default parameters are used when no argument is passed.",
    tags: ["functions", "defaults"],
  },
  {
    type: "debugging", skill: "Functions", category: "JavaScript", difficulty: "medium",
    prompt: "This function should return the sum of two numbers but returns NaN. Fix it.\n\nfunction add(a, b) {\n  return a + b;\n}\nadd('5', 3);",
    correctAnswer: "function add(a, b) { return Number(a) + Number(b); }",
    explanation: "String + Number results in string concatenation or NaN. Convert to numbers first.",
    tags: ["functions", "type-coercion"],
    code: "function add(a, b) {\n  return a + b;\n}",
    language: "javascript",
  },

  // ===== ARRAYS =====
  {
    type: "multiple_choice", skill: "Arrays", category: "JavaScript", difficulty: "easy",
    prompt: "What does Array.map() return?",
    options: ["The original array", "A new array", "A boolean", "Undefined"],
    correctAnswer: "A new array",
    explanation: "map() creates a new array with the results of calling a function on every element.",
    tags: ["arrays", "map"],
  },
  {
    type: "code_output", skill: "Arrays", category: "JavaScript", difficulty: "medium",
    prompt: "What does this output?\n\nconst nums = [1, 2, 3, 4, 5];\nconst result = nums.filter(n => n > 2).map(n => n * 10);\nconsole.log(result);",
    correctAnswer: "[ 30, 40, 50 ]",
    explanation: "filter keeps elements > 2 (3,4,5), then map multiplies each by 10.",
    tags: ["arrays", "filter", "map"],
  },
  {
    type: "code_output", skill: "Arrays", category: "JavaScript", difficulty: "hard",
    prompt: "What does this output?\n\nconst arr = [1, 2, 3];\nconst result = arr.reduce((acc, val) => acc + val, 0);\nconsole.log(result);",
    correctAnswer: "6",
    explanation: "reduce accumulates: 0+1=1, 1+2=3, 3+3=6.",
    tags: ["arrays", "reduce"],
  },
  {
    type: "multiple_choice", skill: "Arrays", category: "JavaScript", difficulty: "medium",
    prompt: "Which method checks if at least one element passes a test?",
    options: ["every()", "some()", "find()", "filter()"],
    correctAnswer: "some()",
    explanation: "some() returns true if at least one element passes the test. every() requires all elements.",
    tags: ["arrays", "some"],
  },

  // ===== OBJECTS =====
  {
    type: "code_output", skill: "Objects", category: "JavaScript", difficulty: "easy",
    prompt: "What does this output?\n\nconst person = { name: 'Alice', age: 25 };\nconst { name, age } = person;\nconsole.log(name, age);",
    correctAnswer: "Alice 25",
    explanation: "Destructuring extracts properties into variables.",
    tags: ["objects", "destructuring"],
  },
  {
    type: "multiple_choice", skill: "Objects", category: "JavaScript", difficulty: "medium",
    prompt: "What does Object.keys() return?",
    options: ["An array of values", "An array of keys", "An object", "A string"],
    correctAnswer: "An array of keys",
    explanation: "Object.keys() returns an array of a given object's own enumerable property names.",
    tags: ["objects", "keys"],
  },
  {
    type: "code_output", skill: "Objects", category: "JavaScript", difficulty: "hard",
    prompt: "What does this output?\n\nconst a = { x: 1 };\nconst b = { y: 2 };\nconst c = { ...a, ...b };\nconsole.log(c);",
    correctAnswer: "{ x: 1, y: 2 }",
    explanation: "The spread operator merges properties from both objects into a new object.",
    tags: ["objects", "spread"],
  },

  // ===== PROMISES / ASYNC =====
  {
    type: "multiple_choice", skill: "Promises", category: "JavaScript", difficulty: "easy",
    prompt: "What are the three states of a Promise?",
    options: ["start, middle, end", "pending, fulfilled, rejected", "open, closed, paused", "init, run, done"],
    correctAnswer: "pending, fulfilled, rejected",
    explanation: "A Promise starts pending, then either fulfills (resolves) or rejects.",
    tags: ["promises", "states"],
  },
  {
    type: "code_output", skill: "Promises", category: "JavaScript", difficulty: "medium",
    prompt: "What does this output?\n\nPromise.resolve(42).then(v => v * 2).then(v => console.log(v));",
    correctAnswer: "84",
    explanation: "Promise.resolve(42) resolves with 42, first then doubles to 84, second then logs it.",
    tags: ["promises", "chaining"],
  },
  {
    type: "multiple_choice", skill: "Promises", category: "JavaScript", difficulty: "medium",
    prompt: "What does Promise.all() do?",
    options: ["Returns the first resolved promise", "Waits for all promises to resolve", "Cancels all promises", "Runs promises sequentially"],
    correctAnswer: "Waits for all promises to resolve",
    explanation: "Promise.all() takes an iterable of promises and returns a single promise that resolves when all input promises resolve.",
    tags: ["promises", "promise-all"],
  },
  {
    type: "code_output", skill: "Promises", category: "JavaScript", difficulty: "hard",
    prompt: "What does this output?\n\nasync function foo() {\n  const a = Promise.resolve(1);\n  const b = Promise.resolve(2);\n  const [x, y] = await Promise.all([a, b]);\n  console.log(x + y);\n}\nfoo();",
    correctAnswer: "3",
    explanation: "Promise.all resolves both, destructuring gives x=1, y=2, sum is 3.",
    tags: ["promises", "async-await", "promise-all"],
  },

  // ===== ASYNC/AWAIT =====
  {
    type: "multiple_choice", skill: "Async/Await", category: "JavaScript", difficulty: "easy",
    prompt: "What does the await keyword do?",
    options: ["Pauses the function", "Stops the program", "Creates a loop", "Imports a module"],
    correctAnswer: "Pauses the function",
    explanation: "await pauses async function execution until the Promise settles.",
    tags: ["async", "await"],
  },
  {
    type: "debugging", skill: "Async/Await", category: "JavaScript", difficulty: "medium",
    prompt: "This async function throws an error. What's wrong?\n\nasync function fetchData() {\n  const response = fetch('/api/data');\n  const data = response.json();\n  return data;\n}",
    correctAnswer: "async function fetchData() {\n  const response = await fetch('/api/data');\n  const data = await response.json();\n  return data;\n}",
    explanation: "Both fetch() and .json() return Promises. You need await before each.",
    tags: ["async", "await", "fetch"],
    code: "async function fetchData() {\n  const response = fetch('/api/data');\n  const data = response.json();\n  return data;\n}",
    language: "javascript",
  },
  {
    type: "code_output", skill: "Async/Await", category: "JavaScript", difficulty: "hard",
    prompt: "What does this output?\n\nasync function bar() {\n  console.log('1');\n  await Promise.resolve();\n  console.log('2');\n}\nconsole.log('3');\nbar();\nconsole.log('4');",
    correctAnswer: "3 1 4 2",
    explanation: "Sync code runs first (3), bar starts (1), await yields, sync continues (4), then bar resumes (2).",
    tags: ["async", "await", "execution-order"],
  },

  // ===== DOM =====
  {
    type: "multiple_choice", skill: "DOM", category: "JavaScript", difficulty: "easy",
    prompt: "Which method selects an element by its ID?",
    options: ["querySelector()", "getElementById()", "getElementsByClassName()", "getElement()"],
    correctAnswer: "getElementById()",
    explanation: "getElementById() returns the element with the specified ID.",
    tags: ["dom", "selection"],
  },
  {
    type: "multiple_choice", skill: "DOM", category: "JavaScript", difficulty: "medium",
    prompt: "What is event delegation?",
    options: ["Removing events from elements", "Using a parent to handle events from children", "Calling events manually", "Delaying event execution"],
    correctAnswer: "Using a parent to handle events from children",
    explanation: "Event delegation uses a single event listener on a parent to handle events from child elements via event bubbling.",
    tags: ["dom", "events"],
  },

  // ===== REACT COMPONENTS =====
  {
    type: "multiple_choice", skill: "Components", category: "React", difficulty: "easy",
    prompt: "What must a React component return?",
    options: ["HTML string", "JSX elements", "A DOM node", "A CSS class"],
    correctAnswer: "JSX elements",
    explanation: "React components return JSX, which describes what the UI should look like.",
    tags: ["react", "components"],
  },
  {
    type: "code_output", skill: "Components", category: "React", difficulty: "medium",
    prompt: "What will this component render?\n\nfunction Greeting({ name }) {\n  return <h1>Hello, {name}!</h1>;\n}\n// Used as: <Greeting name=\"Alice\" />",
    correctAnswer: "<h1>Hello, Alice!</h1>",
    explanation: "The name prop is interpolated into the JSX.",
    tags: ["react", "props"],
  },

  // ===== REACT HOOKS =====
  {
    type: "multiple_choice", skill: "Hooks", category: "React", difficulty: "easy",
    prompt: "Which hook is used to add state to a functional component?",
    options: ["useEffect", "useState", "useContext", "useRef"],
    correctAnswer: "useState",
    explanation: "useState adds state to functional components. It returns [state, setState].",
    tags: ["react", "hooks", "useState"],
  },
  {
    type: "code_output", skill: "Hooks", category: "React", difficulty: "medium",
    prompt: "What happens when setCount is called?\n\nconst [count, setCount] = useState(0);\nsetCount(count + 1);\n// What is count after this?",
    correctAnswer: "0",
    explanation: "State updates are asynchronous. count still holds the old value until the next render.",
    tags: ["react", "hooks", "state"],
  },
  {
    type: "multiple_choice", skill: "Hooks", category: "React", difficulty: "medium",
    prompt: "When does useEffect run by default?",
    options: ["Only on mount", "After every render", "Only on unmount", "Before render"],
    correctAnswer: "After every render",
    explanation: "Without a dependency array, useEffect runs after every render. With [], it runs only on mount.",
    tags: ["react", "hooks", "useEffect"],
  },

  // ===== NODE.JS =====
  {
    type: "multiple_choice", skill: "Node", category: "Node.js", difficulty: "easy",
    prompt: "What is Node.js?",
    options: ["A frontend framework", "A JavaScript runtime", "A database", "A CSS preprocessor"],
    correctAnswer: "A JavaScript runtime",
    explanation: "Node.js allows JavaScript to run on the server side.",
    tags: ["node", "basics"],
  },
  {
    type: "code_output", skill: "Express", category: "Node.js", difficulty: "medium",
    prompt: "What does this Express route do?\n\napp.get('/users/:id', (req, res) => {\n  res.json({ id: req.params.id });\n});\n// Request: GET /users/42",
    correctAnswer: '{"id":"42"}',
    explanation: "req.params.id captures the route parameter '42' and returns it as JSON.",
    tags: ["express", "routing"],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    await AssessmentQuestion.deleteMany({});
    await Assessment.deleteMany({});

    const created = await AssessmentQuestion.insertMany(QUESTIONS);
    console.log(`Created ${created.length} questions`);

    const skills = [...new Set(QUESTIONS.map((q) => q.skill))];
    for (const skill of skills) {
      const skillQuestions = created.filter((q) => q.skill === skill);
      const assessment = await Assessment.create({
        title: `${skill} Assessment`,
        description: `Test your knowledge of ${skill}`,
        type: "skill",
        mode: "practice",
        skill,
        skills: [skill],
        questionCount: Math.min(10, skillQuestions.length),
        passingScore: 70,
        adaptive: true,
        aiAssisted: true,
        status: "published",
      });
      console.log(`Created assessment: ${assessment.title}`);
    }

    const jsSkills = ["Variables", "Functions", "Arrays", "Objects", "Promises", "Async/Await", "DOM"];
    const jsQuestions = created.filter((q) => jsSkills.includes(q.skill));
    await Assessment.create({
      title: "JavaScript Fundamentals Assessment",
      description: "Comprehensive assessment covering core JavaScript concepts",
      type: "course",
      mode: "practice",
      skills: jsSkills,
      questionCount: 15,
      passingScore: 70,
      adaptive: true,
      aiAssisted: true,
      status: "published",
    });
    console.log("Created JavaScript Fundamentals Assessment");

    const reactSkills = ["Components", "Hooks"];
    await Assessment.create({
      title: "React Fundamentals Assessment",
      description: "Test your React components and hooks knowledge",
      type: "course",
      mode: "practice",
      skills: reactSkills,
      questionCount: 10,
      passingScore: 70,
      adaptive: true,
      aiAssisted: true,
      status: "published",
    });
    console.log("Created React Fundamentals Assessment");

    await Assessment.create({
      title: "JavaScript Placement Test",
      description: "Determine your JavaScript starting level",
      type: "placement",
      mode: "placement",
      skills: jsSkills,
      questionCount: 15,
      minQuestions: 8,
      maxQuestions: 20,
      passingScore: 60,
      adaptive: true,
      aiAssisted: false,
      status: "published",
    });
    console.log("Created JavaScript Placement Test");

    console.log("\nAssessment seed completed!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
