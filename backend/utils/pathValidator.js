const path = require("path");

const SENSITIVE_PATTERNS = [
  /\.env/i,
  /\.env\./i,
  /credentials\.json/i,
  /\.pem$/i,
  /\.key$/i,
  /private[_-]?key/i,
];

function isSafePath(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("../") || normalized.includes("/../")) return false;
  if (normalized.startsWith("/")) return false;
  if (normalized.includes("//")) return false;
  const parts = normalized.split("/").filter(Boolean);
  for (const part of parts) {
    if (part === ".." || part === "." || part === "") return false;
  }
  return true;
}

function normalizePath(filePath) {
  if (!filePath) return "";
  return filePath.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function isSensitiveFile(filePath) {
  if (!filePath) return false;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return { valid: false, error: "File path is required." };
  }
  const normalized = normalizePath(filePath);
  if (!normalized) {
    return { valid: false, error: "File path cannot be empty." };
  }
  if (!isSafePath(normalized)) {
    return { valid: false, error: "Invalid file path: path traversal detected." };
  }
  if (normalized.length > 500) {
    return { valid: false, error: "File path is too long." };
  }
  return { valid: true, path: normalized };
}

function validateProjectFiles(files, limits = {}) {
  const {
    maxFiles = parseInt(process.env.MAX_PROJECT_FILES || "100", 10),
    maxFileSizeKB = parseInt(process.env.MAX_PROJECT_FILE_SIZE_KB || "512", 10),
    maxProjectSizeMB = parseInt(process.env.MAX_PROJECT_SIZE_MB || "10", 10),
  } = limits;

  if (!Array.isArray(files)) {
    return { valid: false, error: "Files must be an array." };
  }
  if (files.length > maxFiles) {
    return { valid: false, error: `Project cannot exceed ${maxFiles} files.` };
  }

  let totalSize = 0;
  for (const file of files) {
    if (!file.name || !file.path) {
      return { valid: false, error: "Each file must have a name and path." };
    }
    const pathCheck = validateFilePath(file.path);
    if (!pathCheck.valid) {
      return { valid: false, error: `Invalid path "${file.path}": ${pathCheck.error}` };
    }
    if (file.isFolder) continue;
    const contentSize = Buffer.byteLength(file.content || "", "utf8");
    if (contentSize > maxFileSizeKB * 1024) {
      return { valid: false, error: `File "${file.name}" exceeds ${maxFileSizeKB}KB limit.` };
    }
    totalSize += contentSize;
  }
  if (totalSize > maxProjectSizeMB * 1024 * 1024) {
    return { valid: false, error: `Project size exceeds ${maxProjectSizeMB}MB limit.` };
  }

  return { valid: true };
}

module.exports = {
  isSafePath,
  normalizePath,
  isSensitiveFile,
  validateFilePath,
  validateProjectFiles,
};
