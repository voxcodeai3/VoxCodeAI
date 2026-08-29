const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getAnalytics, postRebuild } = require("../controllers/analyticsController");

router.get("/", authMiddleware, getAnalytics);
router.post("/rebuild", authMiddleware, postRebuild);

module.exports = router;
