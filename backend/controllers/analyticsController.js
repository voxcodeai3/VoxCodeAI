const { getDashboardData, rebuildAnalytics } = require("../services/analyticsService");

async function getAnalytics(req, res) {
  try {
    const userId = req.user.id;
    const data = await getDashboardData(userId);
    return res.json(data);
  } catch (err) {
    console.error("Analytics error:", err.message);
    return res.status(500).json({ message: "Failed to load analytics." });
  }
}

async function postRebuild(req, res) {
  try {
    const userId = req.user.id;
    const analytics = await rebuildAnalytics(userId);
    return res.json({ message: "Analytics rebuilt.", totalSessions: analytics.totalSessions });
  } catch (err) {
    console.error("Analytics rebuild error:", err.message);
    return res.status(500).json({ message: "Failed to rebuild analytics." });
  }
}

module.exports = { getAnalytics, postRebuild };
