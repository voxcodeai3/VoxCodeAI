const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getDashboard, saveOnboarding, getCalendar, setActivePath } = require("../controllers/learningDashboardController");

router.get("/dashboard", authMiddleware, getDashboard);
router.post("/onboarding", authMiddleware, saveOnboarding);
router.get("/calendar", authMiddleware, getCalendar);
router.post("/active-path", authMiddleware, setActivePath);

module.exports = router;
