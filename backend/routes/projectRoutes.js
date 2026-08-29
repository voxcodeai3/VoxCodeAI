const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  duplicateProject,
  renameProject,
  TEMPLATES,
} = require("../controllers/projectController");

router.get("/templates", authMiddleware, (req, res) => {
  const templates = Object.entries(TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    fileCount: t.files.length,
  }));
  res.json({ templates });
});

router.post("/", authMiddleware, createProject);
router.get("/", authMiddleware, listProjects);
router.get("/:id", authMiddleware, getProject);
router.patch("/:id", authMiddleware, updateProject);
router.delete("/:id", authMiddleware, deleteProject);
router.post("/:id/duplicate", authMiddleware, duplicateProject);
router.patch("/:id/rename", authMiddleware, renameProject);

module.exports = router;
