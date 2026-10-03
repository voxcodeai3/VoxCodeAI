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
const learningPathRoutes = require("./routes/learningPathRoutes");
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
const practiceRoutes = require("./routes/practiceRoutes");
const progressRoutes = require("./routes/progressRoutes");
const ttsRoutes = require("./routes/ttsRoutes");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
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
app.use("/api/learning/practice", practiceRoutes);
app.use("/api/learning/progress", progressRoutes);

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

// Learning path routes (JWT protected)
app.use("/api/learning-paths", learningPathRoutes);

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

// TTS routes (JWT protected) — configurable AI text-to-speech
app.use("/api/voice/tts", ttsRoutes);

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
const MONGO_RETRY_MS = 10000;

// Root health endpoint for hosting platforms (Render port detection / health checks).
app.get("/", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    service: "VoxCode backend",
    db: states[mongoose.connection.readyState] || "unknown",
  });
});

async function connectWithRetry() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is not set. Set it in the hosting dashboard environment variables.");
    setTimeout(connectWithRetry, MONGO_RETRY_MS);
    return;
  }
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.error(`Retrying in ${MONGO_RETRY_MS / 1000}s...`);
    setTimeout(connectWithRetry, MONGO_RETRY_MS);
  }
}

async function startServer() {
  // Bind the port FIRST so hosting platforms (Render, etc.) detect the
  // service even while the database is still connecting or retrying.
  app.listen(PORT, () => {
    console.log(`VoxCode backend running on port ${PORT}`);
  });
  await connectWithRetry();
}

startServer();