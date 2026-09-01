const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { listPaths, getPath } = require("../controllers/learningPathController");

router.get("/", authMiddleware, listPaths);
router.get("/:id", authMiddleware, getPath);

module.exports = router;
