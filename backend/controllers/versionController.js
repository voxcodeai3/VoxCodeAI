const Project = require("../models/Project");
const ProjectVersion = require("../models/ProjectVersion");

const MAX_VERSIONS = parseInt(process.env.MAX_PROJECT_VERSIONS || "100", 10);

async function createVersion(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { message, source, aiAction } = req.body;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    const versionCount = await ProjectVersion.countDocuments({ project: id });
    if (versionCount >= MAX_VERSIONS) {
      return res.status(400).json({
        message: `Version limit reached (${MAX_VERSIONS}). Please clean up old versions.`,
        code: "VERSION_LIMIT_REACHED",
      });
    }

    const versionNumber = (await ProjectVersion.getLatestVersionNumber(id)) + 1;

    const version = await ProjectVersion.create({
      project: id,
      user: userId,
      versionNumber,
      message: (message || "Manual checkpoint").trim().slice(0, 200),
      source: source || "manual",
      aiAction: aiAction || null,
      files: project.files.map((f) => ({
        name: f.name,
        path: f.path,
        content: f.content,
        language: f.language,
      })),
      activeFile: project.activeFile,
    });

    return res.status(201).json({
      message: "Version created successfully",
      version: {
        id: version._id,
        versionNumber: version.versionNumber,
        message: version.message,
        source: version.source,
      },
    });
  } catch (err) {
    console.error("Create version error:", err.message);
    return res.status(500).json({ message: "Failed to create version." });
  }
}

async function listVersions(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    const versions = await ProjectVersion.find({ project: id, user: userId })
      .select("versionNumber message source aiAction branch createdAt")
      .sort({ versionNumber: -1 });

    return res.json({ versions });
  } catch (err) {
    console.error("List versions error:", err.message);
    return res.status(500).json({ message: "Failed to load versions." });
  }
}

async function getVersion(req, res) {
  try {
    const userId = req.user.id;
    const { id, versionId } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    const version = await ProjectVersion.findVersion(id, versionId);
    if (!version) {
      return res.status(404).json({ message: "Version not found.", code: "VERSION_NOT_FOUND" });
    }

    return res.json({ version });
  } catch (err) {
    console.error("Get version error:", err.message);
    return res.status(500).json({ message: "Failed to load version." });
  }
}

async function compareVersions(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "Both 'from' and 'to' version IDs are required." });
    }

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    const [versionA, versionB] = await Promise.all([
      ProjectVersion.findVersion(id, from),
      ProjectVersion.findVersion(id, to),
    ]);

    if (!versionA || !versionB) {
      return res.status(404).json({ message: "One or both versions not found.", code: "VERSION_NOT_FOUND" });
    }

    const filesA = new Map(versionA.files.map((f) => [f.path, f]));
    const filesB = new Map(versionB.files.map((f) => [f.path, f]));
    const allPaths = new Set([...filesA.keys(), ...filesB.keys()]);

    const diffs = [];
    for (const path of allPaths) {
      const before = filesA.get(path);
      const after = filesB.get(path);

      if (before && !after) {
        diffs.push({ path, status: "deleted", before: before.content, after: "" });
      } else if (!before && after) {
        diffs.push({ path, status: "added", before: "", after: after.content });
      } else if (before.content !== after.content) {
        diffs.push({ path, status: "modified", before: before.content, after: after.content });
      }
    }

    return res.json({
      from: { id: versionA._id, versionNumber: versionA.versionNumber, message: versionA.message },
      to: { id: versionB._id, versionNumber: versionB.versionNumber, message: versionB.message },
      files: diffs,
    });
  } catch (err) {
    console.error("Compare versions error:", err.message);
    return res.status(500).json({ message: "Failed to compare versions.", code: "COMPARE_FAILED" });
  }
}

async function restoreVersion(req, res) {
  try {
    const userId = req.user.id;
    const { id, versionId } = req.params;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    const version = await ProjectVersion.findVersion(id, versionId);
    if (!version) {
      return res.status(404).json({ message: "Version not found.", code: "VERSION_NOT_FOUND" });
    }

    const backupVersionNumber = (await ProjectVersion.getLatestVersionNumber(id)) + 1;

    await ProjectVersion.create({
      project: id,
      user: userId,
      versionNumber: backupVersionNumber,
      message: `Backup before restoring to v${version.versionNumber}`,
      source: "restore",
      files: project.files.map((f) => ({
        name: f.name,
        path: f.path,
        content: f.content,
        language: f.language,
      })),
      activeFile: project.activeFile,
      branch: "main",
    });

    project.files = version.files.map((f) => ({
      name: f.name,
      path: f.path,
      content: f.content,
      language: f.language,
    }));
    project.activeFile = version.activeFile;
    project.version = (project.version || 0) + 1;
    project.lastSavedAt = new Date();
    await project.save();

    return res.json({
      message: `Restored to v${version.versionNumber}. Backup created as v${backupVersionNumber}.`,
      project: {
        _id: project._id,
        files: project.files,
        activeFile: project.activeFile,
        version: project.version,
      },
    });
  } catch (err) {
    console.error("Restore version error:", err.message);
    return res.status(500).json({ message: "Failed to restore version.", code: "RESTORE_FAILED" });
  }
}

async function createAICheckpoint(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { message, aiAction } = req.body;

    const project = await Project.findProject(userId, id);
    if (!project) {
      return res.status(404).json({ message: "Project not found.", code: "PROJECT_NOT_FOUND" });
    }

    const versionCount = await ProjectVersion.countDocuments({ project: id });
    if (versionCount >= MAX_VERSIONS) {
      return res.json({ message: "Version limit reached, skipping AI checkpoint." });
    }

    const versionNumber = (await ProjectVersion.getLatestVersionNumber(id)) + 1;

    const version = await ProjectVersion.create({
      project: id,
      user: userId,
      versionNumber,
      message: (message || "AI change").trim().slice(0, 200),
      source: "ai_change",
      aiAction: aiAction || null,
      files: project.files.map((f) => ({
        name: f.name,
        path: f.path,
        content: f.content,
        language: f.language,
      })),
      activeFile: project.activeFile,
    });

    return res.status(201).json({
      message: "AI checkpoint created",
      version: {
        id: version._id,
        versionNumber: version.versionNumber,
      },
    });
  } catch (err) {
    console.error("Create AI checkpoint error:", err.message);
    return res.status(500).json({ message: "Failed to create AI checkpoint." });
  }
}

module.exports = {
  createVersion,
  listVersions,
  getVersion,
  compareVersions,
  restoreVersion,
  createAICheckpoint,
};
