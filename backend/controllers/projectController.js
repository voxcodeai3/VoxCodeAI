const Project = require("../models/Project");
const { validateProjectFiles, normalizePath } = require("../utils/pathValidator");
const multer = require("multer");
const path = require("path");
const archiver = require("archiver");
const fs = require("fs");
const os = require("os");

const upload = multer({ dest: path.join(os.tmpdir(), "voxcode-imports"), limits: { fileSize: 5 * 1024 * 1024, files: 500 } });

const TEXT_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "java", "cpp", "c", "h", "hpp",
  "cs", "rb", "go", "rs", "swift", "kt", "scala", "php", "dart",
  "html", "htm", "css", "scss", "sass", "less",
  "json", "xml", "yaml", "yml", "toml", "ini", "cfg", "conf",
  "md", "txt", "csv", "sql", "sh", "bash", "zsh", "bat", "cmd",
  "env", "gitignore", "dockerignore", "editorconfig",
  "vue", "svelte", "astro",
  "r", "R", "lua", "pl", "pm", "ex", "exs", "erl", "hs",
  "tf", "hcl", "nix",
]);

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
        isFolder: f.isFolder || false,
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
        isFolder: f.isFolder || false,
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

function isTextFile(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return TEXT_EXTENSIONS.has(ext);
}

function isBinaryFile(buffer) {
  for (let i = 0; i < Math.min(buffer.length, 512); i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function validateName(name) {
  if (!name || typeof name !== "string") return "Name is required.";
  const trimmed = name.trim();
  if (!trimmed) return "Name cannot be empty.";
  if (trimmed.length > 200) return "Name is too long.";
  if (/[\x00-\x1f]/.test(trimmed)) return "Name contains invalid characters.";
  if (trimmed === "." || trimmed === "..") return "Invalid name.";
  if (/[\\/]/.test(trimmed)) return "Name cannot contain path separators.";
  return null;
}

async function createFolder(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, parentPath } = req.body;

    const nameErr = validateName(name);
    if (nameErr) return res.status(400).json({ message: nameErr });

    const project = await Project.findProject(userId, id);
    if (!project) return res.status(404).json({ message: "Project not found." });

    const parent = parentPath ? normalizePath(parentPath) : "";
    const folderPath = parent ? `${parent}/${name.trim()}` : name.trim();
    const normalizedPath = normalizePath(folderPath);

    const existing = (project.files || []).find((f) => f.path === normalizedPath);
    if (existing) return res.status(400).json({ message: "A file or folder with that name already exists." });

    project.files = [...(project.files || []), { name: name.trim(), path: normalizedPath, content: "", language: "", isFolder: true }];
    project.version = (project.version || 1) + 1;
    await project.save();

    return res.status(201).json({ message: "Folder created.", path: normalizedPath });
  } catch (err) {
    console.error("Create folder error:", err.message);
    return res.status(500).json({ message: "Failed to create folder." });
  }
}

async function createFileInProject(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, parentPath, content } = req.body;

    const nameErr = validateName(name);
    if (nameErr) return res.status(400).json({ message: nameErr });

    const project = await Project.findProject(userId, id);
    if (!project) return res.status(404).json({ message: "Project not found." });

    const parent = parentPath ? normalizePath(parentPath) : "";
    const filePath = parent ? `${parent}/${name.trim()}` : name.trim();
    const normalizedPath = normalizePath(filePath);

    const existing = (project.files || []).find((f) => f.path === normalizedPath);
    if (existing) return res.status(400).json({ message: "A file or folder with that name already exists." });

    project.files = [...(project.files || []), {
      name: name.trim(),
      path: normalizedPath,
      content: content || "",
      language: detectLang(name.trim()),
      isFolder: false,
    }];
    project.version = (project.version || 1) + 1;
    await project.save();

    return res.status(201).json({ message: "File created.", path: normalizedPath });
  } catch (err) {
    console.error("Create file error:", err.message);
    return res.status(500).json({ message: "Failed to create file." });
  }
}

async function renameFileFolder(req, res) {
  try {
    const userId = req.user.id;
    const { id, filePath: encodedPath } = req.params;
    const { newName } = req.body;

    const nameErr = validateName(newName);
    if (nameErr) return res.status(400).json({ message: nameErr });

    const project = await Project.findProject(userId, id);
    if (!project) return res.status(404).json({ message: "Project not found." });

    const oldPath = decodeURIComponent(encodedPath);
    const item = (project.files || []).find((f) => f.path === oldPath);
    if (!item) return res.status(404).json({ message: "File or folder not found." });

    const parentDir = oldPath.includes("/") ? oldPath.substring(0, oldPath.lastIndexOf("/")) : "";
    const newPath = parentDir ? `${parentDir}/${newName.trim()}` : newName.trim();
    const normalizedNewPath = normalizePath(newPath);

    if (normalizedNewPath !== oldPath) {
      const dup = (project.files || []).find((f) => f.path === normalizedNewPath && f.path !== oldPath);
      if (dup) return res.status(400).json({ message: "A file or folder with that name already exists." });
    }

    if (item.isFolder) {
      const prefix = oldPath + "/";
      project.files = (project.files || []).map((f) => {
        if (f.path === oldPath) return { ...f, name: newName.trim(), path: normalizedNewPath };
        if (f.path.startsWith(prefix)) {
          const relativeSuffix = f.path.substring(prefix.length);
          return { ...f, path: `${normalizedNewPath}/${relativeSuffix}` };
        }
        return f;
      });
    } else {
      project.files = (project.files || []).map((f) =>
        f.path === oldPath ? { ...f, name: newName.trim(), path: normalizedNewPath, language: detectLang(newName.trim()) } : f
      );
    }

    if (project.activeFile === oldPath) project.activeFile = normalizedNewPath;

    project.version = (project.version || 1) + 1;
    await project.save();

    return res.json({ message: "Renamed.", oldPath, newPath: normalizedNewPath });
  } catch (err) {
    console.error("Rename error:", err.message);
    return res.status(500).json({ message: "Failed to rename." });
  }
}

async function deleteFileFolder(req, res) {
  try {
    const userId = req.user.id;
    const { id, filePath: encodedPath } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) return res.status(404).json({ message: "Project not found." });

    const targetPath = decodeURIComponent(encodedPath);
    const item = (project.files || []).find((f) => f.path === targetPath);
    if (!item) return res.status(404).json({ message: "File or folder not found." });

    let deletedFiles = 0;
    let deletedFolders = 0;

    if (item.isFolder) {
      const prefix = targetPath + "/";
      const removed = (project.files || []).filter((f) => f.path !== targetPath && !f.path.startsWith(prefix));
      deletedFiles = removed.filter((f) => !f.isFolder).length;
      deletedFolders = removed.filter((f) => f.isFolder).length;
      project.files = (project.files || []).filter((f) => f.path === targetPath || !f.path.startsWith(prefix));
    } else {
      project.files = (project.files || []).filter((f) => f.path !== targetPath);
      deletedFiles = 1;
    }

    if (project.activeFile === targetPath) project.activeFile = null;

    project.version = (project.version || 1) + 1;
    await project.save();

    return res.json({ message: "Deleted.", deletedFiles, deletedFolders });
  } catch (err) {
    console.error("Delete error:", err.message);
    return res.status(500).json({ message: "Failed to delete." });
  }
}

const EXCLUDED_DIRS = new Set([
  "node_modules", "dist", "build", ".next", ".cache", ".git",
  "__pycache__", ".venv", "venv", "coverage", ".nyc_output",
  ".angular", ".sass-cache", "vendor", ".bundle",
]);

const EXCLUDED_FILES = new Set([
  ".env", ".env.local", ".env.development.local", ".env.test.local",
  ".env.production.local", "*.pem", "*.key",
]);

const SENSITIVE_EXTENSIONS = new Set(["pem", "key", "p12", "pfx", "jks"]);

function shouldExcludePath(relativePath) {
  const parts = relativePath.split("/").filter(Boolean);
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return true;
  }
  const basename = parts[parts.length - 1] || "";
  if (EXCLUDED_FILES.has(basename)) return true;
  const ext = basename.split(".").pop()?.toLowerCase() || "";
  if (SENSITIVE_EXTENSIONS.has(ext)) return true;
  return false;
}

function detectTechStack(files) {
  const techs = new Set();
  const extMap = {
    jsx: "React", tsx: "React", vue: "Vue", svelte: "Svelte",
    py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java",
    php: "PHP", swift: "Swift", kt: "Kotlin",
  };
  for (const f of files) {
    const ext = f.name?.split(".").pop()?.toLowerCase() || "";
    if (extMap[ext]) techs.add(extMap[ext]);
    if (f.name === "package.json") techs.add("npm");
    if (f.name === "requirements.txt" || f.name === "Pipfile") techs.add("pip");
    if (f.name === "Cargo.toml") techs.add("cargo");
    if (f.name === "go.mod") techs.add("go");
    if (f.name === "Gemfile") techs.add("bundler");
    if (f.name === "tsconfig.json") techs.add("TypeScript");
    if (f.name === "angular.json") techs.add("Angular");
    if (f.name === "next.config.js" || f.name === "next.config.mjs") techs.add("Next.js");
    if (f.name === "nuxt.config.js" || f.name === "nuxt.config.ts") techs.add("Nuxt");
    if (f.name === "vite.config.js" || f.name === "vite.config.ts") techs.add("Vite");
    if (f.name === "webpack.config.js") techs.add("Webpack");
    if (f.name === "Dockerfile") techs.add("Docker");
    if (f.name === "docker-compose.yml" || f.name === "docker-compose.yaml") techs.add("Docker");
  }
  return Array.from(techs);
}

function buildImportTree(files) {
  const tree = {};
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = null;
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }
  }
  return tree;
}

function renderTree(tree, prefix = "", isLast = true) {
  const lines = [];
  const entries = Object.entries(tree);
  entries.forEach(([name, children], i) => {
    const last = i === entries.length - 1;
    const connector = last ? "└── " : "├── ";
    const isDir = children !== null;
    lines.push(prefix + connector + (isDir ? name + "/" : name));
    if (isDir) {
      const childPrefix = prefix + (last ? "    " : "│   ");
      lines.push(...renderTree(children, childPrefix, last));
    }
  });
  return lines;
}

function getMaxFileSize() {
  return parseInt(process.env.MAX_IMPORT_FILE_SIZE || "524288", 10);
}

function getExcludedDirs() {
  return EXCLUDED_DIRS;
}

function getExcludedFiles() {
  return EXCLUDED_FILES;
}

async function moveFileFolder(req, res) {
  try {
    const userId = req.user.id;
    const { id, filePath: encodedPath } = req.params;
    const { destinationPath, overwrite } = req.body;

    const project = await Project.findProject(userId, id);
    if (!project) return res.status(404).json({ message: "Project not found." });

    const sourcePath = decodeURIComponent(encodedPath);
    const item = (project.files || []).find((f) => f.path === sourcePath);
    if (!item) return res.status(404).json({ message: "File or folder not found." });

    const dest = destinationPath ? normalizePath(destinationPath) : "";
    const itemName = sourcePath.split("/").pop();
    const newPath = dest ? `${dest}/${itemName}` : itemName;
    const normalizedNewPath = normalizePath(newPath);

    if (normalizedNewPath === sourcePath) {
      return res.json({ message: "No change needed." });
    }

    const existing = (project.files || []).find((f) => f.path === normalizedNewPath);
    if (existing && !overwrite) {
      return res.status(400).json({ message: "A file or folder with that name already exists at the destination.", code: "NAME_CONFLICT" });
    }

    if (existing && overwrite) {
      if (existing.isFolder) {
        const prefix = normalizedNewPath + "/";
        project.files = (project.files || []).filter((f) => f.path !== normalizedNewPath && !f.path.startsWith(prefix));
      } else {
        project.files = (project.files || []).filter((f) => f.path !== normalizedNewPath);
      }
    }

    if (normalizedNewPath.startsWith(sourcePath + "/")) {
      return res.status(400).json({ message: "Cannot move a folder into itself." });
    }

    if (item.isFolder) {
      const oldPrefix = sourcePath + "/";
      const newPrefix = normalizedNewPath + "/";
      project.files = (project.files || []).map((f) => {
        if (f.path === sourcePath) return { ...f, path: normalizedNewPath };
        if (f.path.startsWith(oldPrefix)) {
          const suffix = f.path.substring(oldPrefix.length);
          return { ...f, path: newPrefix + suffix };
        }
        return f;
      });
    } else {
      project.files = (project.files || []).map((f) =>
        f.path === sourcePath ? { ...f, path: normalizedNewPath, name: itemName } : f
      );
    }

    if (project.activeFile === sourcePath) project.activeFile = normalizedNewPath;

    project.version = (project.version || 1) + 1;
    await project.save();

    return res.json({ message: "Moved.", oldPath: sourcePath, newPath: normalizedNewPath });
  } catch (err) {
    console.error("Move error:", err.message);
    return res.status(500).json({ message: "Failed to move." });
  }
}

async function importPreview(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) return res.status(404).json({ message: "Project not found." });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files provided." });
    }

    const maxFileSize = getMaxFileSize();
    const files = Array.from(req.files);
    const excluded = [];
    const preview = [];
    const techSet = new Set();

    for (const file of files) {
      const relativePath = file.originalname;
      const basename = relativePath.split("/").pop() || relativePath;

      if (shouldExcludePath(relativePath)) {
        excluded.push({ path: relativePath, reason: "generated/dependency" });
        continue;
      }

      if (SENSITIVE_EXTENSIONS.has(basename.split(".").pop()?.toLowerCase() || "")) {
        excluded.push({ path: relativePath, reason: "sensitive file" });
        continue;
      }

      if (file.size > maxFileSize) {
        excluded.push({ path: relativePath, reason: `exceeds ${Math.round(maxFileSize / 1024)}KB limit` });
        continue;
      }

      const ext = basename.split(".").pop()?.toLowerCase() || "";
      if (["jsx", "tsx", "vue", "svelte"].includes(ext)) techSet.add("React/Vue/Svelte");
      if (["py"].includes(ext)) techSet.add("Python");
      if (["ts", "tsx"].includes(ext)) techSet.add("TypeScript");
      if (ext === "json" && basename === "package.json") techSet.add("npm");
      if (ext === "json" && basename === "tsconfig.json") techSet.add("TypeScript");
      if (basename === "Dockerfile") techSet.add("Docker");

      preview.push({ path: relativePath, size: file.size });
    }

    const tree = buildImportTree(preview);
    const treeLines = renderTree(tree);

    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);

    return res.json({
      projectName: safeName,
      totalFiles: preview.length,
      totalFolders: new Set(preview.map((f) => {
        const parts = f.path.split("/").slice(0, -1);
        return parts.join("/");
      }).filter(Boolean)).size,
      excluded,
      detectedTechs: Array.from(techSet),
      treePreview: treeLines.slice(0, 50),
      hasMore: treeLines.length > 50,
    });
  } catch (err) {
    console.error("Import preview error:", err.message);
    return res.status(500).json({ message: "Failed to generate preview." });
  }
}

async function importFiles(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files provided." });
    }

    const maxFiles = 500;
    const maxFileSize = getMaxFileSize();
    if (req.files.length > maxFiles) {
      return res.status(400).json({ message: `Maximum ${maxFiles} files per import.` });
    }

    const existingPaths = new Set((project.files || []).map((f) => f.path));
    const imported = [];
    const skipped = [];

    for (const file of req.files) {
      const relativePath = file.originalname;
      const safePath = normalizePath(relativePath);

      if (shouldExcludePath(relativePath)) {
        skipped.push(relativePath);
        fs.unlinkSync(file.path);
        continue;
      }

      if (existingPaths.has(safePath)) {
        skipped.push(relativePath);
        fs.unlinkSync(file.path);
        continue;
      }

      if (file.size > maxFileSize) {
        skipped.push(relativePath);
        fs.unlinkSync(file.path);
        continue;
      }

      const buffer = fs.readFileSync(file.path);

      if (isBinaryFile(buffer) && !isTextFile(relativePath)) {
        skipped.push(relativePath);
        fs.unlinkSync(file.path);
        continue;
      }

      const content = buffer.toString("utf8");
      imported.push({
        name: path.basename(relativePath),
        path: safePath,
        content,
        language: detectLang(relativePath),
      });

      existingPaths.add(safePath);
      fs.unlinkSync(file.path);
    }

    if (imported.length === 0) {
      return res.json({
        message: skipped.length > 0
          ? `No new files imported. ${skipped.length} file(s) already existed or were unsupported.`
          : "No files to import.",
        imported: [],
        skipped,
      });
    }

    project.files = [...(project.files || []), ...imported];
    project.version = (project.version || 1) + 1;
    await project.save();

    return res.json({
      message: `${imported.length} file(s) imported${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}.`,
      imported: imported.map((f) => f.path),
      skipped,
    });
  } catch (err) {
    console.error("Import files error:", err.message);
    return res.status(500).json({ message: "Failed to import files." });
  }
}

async function exportProject(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    let files = (project.files || []).filter((f) => !f.isFolder);

    // Support exporting a specific folder (e.g. ?folderPath=src/components)
    const folderPath = req.query.folderPath ? normalizePath(req.query.folderPath) : null;
    if (folderPath) {
      const prefix = folderPath + "/";
      files = files.filter((f) => f.path === folderPath || f.path.startsWith(prefix));
      if (files.length === 0) {
        return res.status(400).json({ message: "No files in selected folder to export." });
      }
    }

    if (files.length === 0) {
      return res.status(400).json({ message: "Project has no files to export." });
    }

    const safeName = project.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);
    const zipName = folderPath ? folderPath.split("/").pop() : safeName;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("error", (err) => {
      console.error("Archiver error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to create zip file." });
      }
    });

    archive.pipe(res);

    for (const file of files) {
      const filePath = file.path || file.name;
      // When exporting a specific folder, keep the folder itself in the zip
      // src  -> src/About.jsx (folder preserved, not flattened)
      // src/components -> components/Header.jsx (per spec §59)
      let outPath = filePath;
      if (folderPath) {
        const parentPrefix = folderPath.includes("/") ? folderPath.substring(0, folderPath.lastIndexOf("/") + 1) : "";
        outPath = parentPrefix ? filePath.substring(parentPrefix.length) : filePath;
      }
      archive.append(file.content || "", { name: outPath });
    }

    await archive.finalize();
  } catch (err) {
    console.error("Export project error:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Failed to export project." });
    }
  }
}

async function runCode(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { filePath } = req.body;
    const project = await Project.findProject(userId, id);
    if (!project) return res.status(404).json({ message: "Project not found." });
    const targetPath = filePath ? normalizePath(filePath) : project.activeFile;
    if (!targetPath) return res.status(400).json({ message: "No file to run." });
    const file = (project.files || []).find(f => f.path === targetPath && !f.isFolder);
    if (!file) return res.status(404).json({ message: "File not found." });
    const content = file.content || "";
    const lang = file.language || detectLang(file.name);
    // Simple JS execution via vm, others return placeholder
    if (lang === "javascript" || lang === "plaintext" && file.name.endsWith(".js")) {
      const vm = require("vm");
      let output = "";
      let error = null;
      const sandbox = {
        console: { log: (...args) => { output += args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ") + "\n"; } },
        setTimeout, setInterval, clearTimeout, clearInterval,
      };
      try {
        const script = new vm.Script(content, { timeout: 2000 });
        const context = vm.createContext(sandbox);
        const result = script.runInContext(context, { timeout: 2000 });
        if (result !== undefined) output += String(result) + "\n";
      } catch (e) {
        error = e.message;
      }
      return res.json({ output: output.trim(), error, language: lang, file: targetPath });
    }
    // For other languages, return content preview as output
    return res.json({ output: `Executed ${file.name} (${lang}) — preview:\n${content.slice(0,500)}`, error: null, language: lang, file: targetPath });
  } catch (err) {
    console.error("Run code error:", err.message);
    return res.status(500).json({ message: "Failed to run code." });
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
  importFiles,
  importPreview,
  exportProject,
  createFolder,
  createFileInProject,
  renameFileFolder,
  deleteFileFolder,
  moveFileFolder,
  runCode,
  upload,
  TEMPLATES,
};
