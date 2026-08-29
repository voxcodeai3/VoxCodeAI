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

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
  res.json({ message: "VoxCode backend is running" });
});

app.use("/api/auth", authRoutes);

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

app.use((err, req, res, next) => {
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