const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createVersion,
  listVersions,
  getVersion,
  compareVersions,
  restoreVersion,
  createAICheckpoint,
} = require("../controllers/versionController");

router.post("/:id/versions", authMiddleware, createVersion);
router.get("/:id/versions", authMiddleware, listVersions);
router.get("/:id/versions/:versionId", authMiddleware, getVersion);
router.get("/:id/compare", authMiddleware, compareVersions);
router.post("/:id/versions/:versionId/restore", authMiddleware, restoreVersion);
router.post("/:id/ai-checkpoint", authMiddleware, createAICheckpoint);

module.exports = router;
