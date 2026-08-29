const Project = require("../models/Project");
const { validateProjectFiles, normalizePath } = require("../utils/pathValidator");

const TEMPLATES = {
  blank: { name: "Blank Project", files: [] },
  javascript: {
    name: "JavaScript",
    files: [
      { name: "main.js", path: "main.js", content: '// JavaScript Project\n\nconsole.log("Hello, World!");\n', language: "javascript" },
      { name: "package.json", path: "package.json", content: '{\n  "name": "my-project",\n  "version": "1.0.0"\n}\n', language: "json" },
    ],
  },
  react: {
    name: "React",
    files: [
      { name: "App.jsx", path: "src/App.jsx", content: 'import React from "react";\n\nexport default function App() {\n  return (\n    <div>\n      <h1>Hello React</h1>\n    </div>\n  );\n}\n', language: "javascript" },
      { name: "main.jsx", path: "src/main.jsx", content: 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\n\nReactDOM.createRoot(document.getElementById("root")).render(<App />);\n', language: "javascript" },
      { name: "styles.css", path: "src/styles.css", content: "body {\n  margin: 0;\n  font-family: sans-serif;\n}\n", language: "css" },
    ],
  },
  node: {
    name: "Node.js",
    files: [
      { name: "index.js", path: "index.js", content: 'const http = require("http");\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { "Content-Type": "text/plain" });\n  res.end("Hello, World!\\n");\n});\n\nserver.listen(3000, () => {\n  console.log("Server running on port 3000");\n});\n', language: "javascript" },
      { name: "package.json", path: "package.json", content: '{\n  "name": "my-node-app",\n  "version": "1.0.0",\n  "main": "index.js"\n}\n', language: "json" },
    ],
  },
  python: {
    name: "Python",
    files: [
      { name: "main.py", path: "main.py", content: '# Python Project\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n', language: "python" },
    ],
  },
  html: {
    name: "HTML/CSS",
    files: [
      { name: "index.html", path: "index.html", content: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>My Project</title>\n  <link rel=\"stylesheet\" href=\"styles.css\">\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <script src=\"main.js\"></script>\n</body>\n</html>\n", language: "html" },
      { name: "styles.css", path: "styles.css", content: "body {\n  margin: 0;\n  font-family: sans-serif;\n}\n", language: "css" },
      { name: "main.js", path: "main.js", content: 'console.log("Hello from main.js");\n', language: "javascript" },
    ],
  },
};

function detectLang(filename) {
  if (!filename) return "plaintext";
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map = { js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", java: "java", cpp: "cpp", c: "c", css: "css", html: "html", json: "json", md: "markdown", sql: "sql", xml: "xml", sh: "shell", yaml: "yaml", yml: "yaml", txt: "plaintext" };
  return map[ext] || "plaintext";
}

async function createProject(req, res) {
  try {
    const userId = req.user.id;
    const { name, description, language, template } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Project name is required." });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ message: "Project name must be 100 characters or less." });
    }

    const maxProjects = parseInt(process.env.MAX_PROJECTS_PER_USER || "50", 10);
    const projectCount = await Project.countDocuments({ user: userId });
    if (projectCount >= maxProjects) {
      return res.status(400).json({ message: `You can have up to ${maxProjects} projects.` });
    }

    let files = [];
    if (template && TEMPLATES[template]) {
      files = TEMPLATES[template].files.map((f) => ({
        name: f.name,
        path: f.path,
        content: f.content,
        language: f.language || detectLang(f.name),
      }));
    }

    const project = await Project.create({
      user: userId,
      name: name.trim(),
      description: (description || "").trim(),
      language: language || "javascript",
      template: template || "blank",
      files,
      activeFile: files.length > 0 ? files[0].path : null,
    });

    return res.status(201).json({
      message: "Project created successfully",
      project: { id: project._id, name: project.name },
    });
  } catch (err) {
    console.error("Create project error:", err.message);
    return res.status(500).json({ message: "Failed to create project." });
  }
}

async function listProjects(req, res) {
  try {
    const userId = req.user.id;
    const projects = await Project.find({ user: userId })
      .select("name description language template activeFile createdAt updatedAt lastOpenedAt")
      .sort({ updatedAt: -1 });

    return res.json({ projects });
  } catch (err) {
    console.error("List projects error:", err.message);
    return res.status(500).json({ message: "Failed to load projects." });
  }
}

async function getProject(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    project.lastOpenedAt = new Date();
    await project.save();

    return res.json({ project });
  } catch (err) {
    console.error("Get project error:", err.message);
    return res.status(500).json({ message: "Failed to load project." });
  }
}

async function updateProject(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, description, files, activeFile, version } = req.body;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    if (version != null && version !== project.version) {
      return res.status(409).json({
        message: "This project was updated elsewhere.",
        code: "PROJECT_CONFLICT",
        serverVersion: project.version,
        clientVersion: version,
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: "Project name cannot be empty." });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ message: "Project name must be 100 characters or less." });
      }
      project.name = name.trim();
    }

    if (description !== undefined) {
      project.description = description.trim().slice(0, 500);
    }

    if (files !== undefined) {
      const fileValidation = validateProjectFiles(files);
      if (!fileValidation.valid) {
        return res.status(400).json({ message: fileValidation.error, code: "INVALID_FILES" });
      }

      project.files = files.map((f) => ({
        name: f.name,
        path: normalizePath(f.path),
        content: f.content || "",
        language: f.language || detectLang(f.name),
      }));
    }

    if (activeFile !== undefined) {
      project.activeFile = activeFile;
    }

    project.version = (project.version || 1) + 1;
    project.lastSavedAt = new Date();
    await project.save();

    return res.json({
      message: "Project saved.",
      version: project.version,
      updatedAt: project.updatedAt,
    });
  } catch (err) {
    console.error("Update project error:", err.message);
    return res.status(500).json({ message: "Failed to save project.", code: "SAVE_FAILED" });
  }
}

async function deleteProject(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    await Project.deleteOne({ _id: project._id });
    return res.json({ message: "Project deleted." });
  } catch (err) {
    console.error("Delete project error:", err.message);
    return res.status(500).json({ message: "Failed to delete project." });
  }
}

async function duplicateProject(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    const maxProjects = parseInt(process.env.MAX_PROJECTS_PER_USER || "50", 10);
    const projectCount = await Project.countDocuments({ user: userId });
    if (projectCount >= maxProjects) {
      return res.status(400).json({ message: `You can have up to ${maxProjects} projects.` });
    }

    const duplicate = await Project.create({
      user: userId,
      name: `${project.name} Copy`,
      description: project.description,
      language: project.language,
      template: project.template,
      files: project.files.map((f) => ({ ...f })),
      activeFile: project.activeFile,
    });

    return res.status(201).json({
      message: "Project duplicated.",
      project: { id: duplicate._id, name: duplicate.name },
    });
  } catch (err) {
    console.error("Duplicate project error:", err.message);
    return res.status(500).json({ message: "Failed to duplicate project." });
  }
}

async function renameProject(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Project name is required." });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ message: "Project name must be 100 characters or less." });
    }

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    project.name = name.trim();
    project.version = (project.version || 1) + 1;
    await project.save();

    return res.json({ message: "Project renamed.", name: project.name });
  } catch (err) {
    console.error("Rename project error:", err.message);
    return res.status(500).json({ message: "Failed to rename project." });
  }
}

module.exports = {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  duplicateProject,
  renameProject,
  TEMPLATES,
};
