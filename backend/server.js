require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const aiRoutes = require("./routes/aiRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const learnerRoutes = require("./routes/learnerRoutes");
const learningRoutes = require("./routes/learningRoutes");
const interviewRoutes = require("./routes/interviewRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const projectRoutes = require("./routes/projectRoutes");
const versionRoutes = require("./routes/versionRoutes");
const courseRoutes = require("./routes/courseRoutes");
const learningPathRoutes = require("./routes/learningPathRoutes");
const learningProgressRoutes = require("./routes/learningProgressRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const learningDashboardRoutes = require("./routes/learningDashboardRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const learningSetupRoutes = require("./routes/learningSetupRoutes");
const learningFoundationRoutes = require("./routes/learningFoundationRoutes");
const learningMemoryRoutes = require("./routes/learningMemoryRoutes");
const adminRoutes = require("./routes/adminRoutes");
const platformRoutes = require("./routes/platformRoutes");
const aiLearningStateRoutes = require("./routes/aiLearningStateRoutes");
const roadmapRoutes = require("./routes/roadmapRoutes");
const initialAssessmentRoutes = require("./routes/initialAssessmentRoutes");
const teachingRoutes = require("./routes/teachingRoutes");
const miniQuizRoutes = require("./routes/miniQuizRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
  res.json({ message: "VoxCode backend is running" });
});

app.use("/api/platform", platformRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/learning", aiLearningStateRoutes);
app.use("/api/learning", roadmapRoutes);
app.use("/api/learning/assessment", initialAssessmentRoutes);
app.use("/api/learning/teaching", teachingRoutes);
app.use("/api/learning/quiz", miniQuizRoutes);

// AI tutor routes (JWT protected)
app.use("/api/ai", aiRoutes);

// Conversation history routes (JWT protected)
app.use("/api/conversations", conversationRoutes);

// Learner profile routes (JWT protected)
app.use("/api/learner", learnerRoutes);

// Learning session routes (JWT protected)
app.use("/api/learning", learningRoutes);

// Interview session routes (JWT protected)
app.use("/api/interviews", interviewRoutes);

// Learning analytics routes (JWT protected)
app.use("/api/analytics", analyticsRoutes);

// Course routes (JWT protected)
app.use("/api/courses", courseRoutes);

// Learning path routes (JWT protected)
app.use("/api/learning-paths", learningPathRoutes);

// Learning progress & skill routes (JWT protected)
app.use("/api/learning", learningProgressRoutes);

// Learning dashboard routes (JWT protected)
app.use("/api/learning-dashboard", learningDashboardRoutes);

// Recommendation routes (JWT protected)
app.use("/api/recommendations", recommendationRoutes);

// Assessment routes (JWT protected)
app.use("/api/assessments", assessmentRoutes);

// Learning setup routes (JWT protected)
app.use("/api/setup", learningSetupRoutes);

// Learning foundation routes (JWT protected) — Step 1 foundation
app.use("/api/learning", learningFoundationRoutes);

// Learning memory routes (JWT protected) — Step 5 persistent memory
app.use("/api/learning/memory", learningMemoryRoutes);

// Admin routes (JWT + admin role required)
app.use("/api/admin", adminRoutes);

// Project version routes (JWT protected) — must be before project routes
app.use("/api/projects", versionRoutes);

// Project management routes (JWT protected)
app.use("/api/projects", projectRoutes);

app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File too large. Maximum 5MB per file." });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({ message: "Too many files. Maximum 500 files per import." });
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ message: "Unexpected file field." });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Something went wrong on our side. Please try again." });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(`VoxCode backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();