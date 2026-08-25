const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated. Please log in." });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: "Not authenticated. Please log in." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: "Your session has expired. Please log in again." });
  }

  try {
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
    }
    req.user = { id: user._id, name: user.name, email: user.email };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

module.exports = authMiddleware;