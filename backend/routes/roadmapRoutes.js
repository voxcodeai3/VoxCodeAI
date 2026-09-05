const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getRoadmap,
  getContext,
  getNext,
  getPrevious,
  getPosition,
  getMyPosition,
} = require("../controllers/roadmapController");

// Student-specific current position — must be before /paths/:pathId to avoid param capture if mounted together
router.get("/roadmap/current", authMiddleware, getMyPosition);

router.get("/paths/:pathId/roadmap", authMiddleware, getRoadmap);
router.get("/paths/:pathId/context", authMiddleware, getContext);
router.get("/paths/:pathId/next", authMiddleware, getNext);
router.get("/paths/:pathId/previous", authMiddleware, getPrevious);
router.get("/paths/:pathId/position", authMiddleware, getPosition);

module.exports = router;
