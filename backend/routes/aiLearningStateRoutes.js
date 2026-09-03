const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getState, patchState, getCurrent } = require("../controllers/aiLearningStateController");

// All routes require JWT, user isolation via req.user.id
router.get("/state", authMiddleware, getState);
router.patch("/state", authMiddleware, patchState);
router.get("/current", authMiddleware, getCurrent);

module.exports = router;
