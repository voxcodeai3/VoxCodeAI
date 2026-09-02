function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated. Please log in." });
  }
  const role = req.user.role;
  if (role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ message: "You do not have administrator access." });
  }
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated. Please log in." });
    }
    const perms = req.user.permissions || {};
    // super_admin has all via authMiddleware, but double-check
    if (req.user.role === "super_admin") return next();
    if (!perms[permission]) {
      return res.status(403).json({ message: `Missing permission: ${permission}` });
    }
    next();
  };
}

function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated. Please log in." });
  }
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ message: "Super admin access required." });
  }
  next();
}

module.exports = { requireAdmin, requirePermission, requireSuperAdmin };
