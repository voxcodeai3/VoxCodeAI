const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { listCourses, getCourse, getLesson } = require("../controllers/courseController");

router.get("/", authMiddleware, listCourses);
router.get("/:id", authMiddleware, getCourse);
router.get("/lesson/:lessonId", authMiddleware, getLesson);

module.exports = router;
