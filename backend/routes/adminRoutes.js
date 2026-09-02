const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin, requirePermission } = require("../middleware/adminMiddleware");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const LearningMemory = require("../models/LearningMemory");
const PlatformSettings = require("../models/PlatformSettings");
const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const { Lesson } = require("../models/Course");

// All admin routes require auth + admin
router.use(authMiddleware, requireAdmin);

// ─── Helpers ────────────────────────────────────────────────────────
function sanitizeUser(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar || null,
    authProvider: u.authProvider || "local",
    createdAt: u.createdAt,
    lastUsedAt: u.lastUsedAt || null,
    aiUsage: u.aiUsage || { total: 0, voice: 0, text: 0, lastUsedAt: null },
  };
}

// ─── GET /api/admin/me ─────────────────────────────────────────────
router.get("/me", (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      permissions: req.user.permissions,
    },
  });
});

// ─── GET /api/admin/stats ──────────────────────────────────────────
router.get("/stats", requirePermission("viewUsers"), async (req, res) => {
  try {
    const [totalUsers, totalAdmins, totalSuperAdmins, aiUsageResult, activeLearning] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "super_admin" }),
      User.aggregate([
        { $group: { _id: null, totalAI: { $sum: "$aiUsage.total" } } },
      ]),
      LearningMemory.countDocuments({ activeLearningPath: { $ne: null } }),
    ]);

    return res.json({
      totalUsers,
      totalAdmins: totalAdmins + totalSuperAdmins,
      totalAIRequests: aiUsageResult[0]?.totalAI || 0,
      activeLearningUsers: activeLearning,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return res.status(500).json({ message: "Failed to load stats" });
  }
});

// ─── GET /api/admin/users ──────────────────────────────────────────
// Query params: page (default 1), limit (default 20), search, role, learning
router.get("/users", requirePermission("viewUsers"), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const roleFilter = req.query.role || "";
    const learningFilter = req.query.learning || ""; // "yes" | "no" | ""

    // Build user query
    const userQuery = {};
    if (search) {
      userQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (roleFilter && ["student", "admin", "super_admin"].includes(roleFilter)) {
      userQuery.role = roleFilter;
    }

    // If filtering by active learning, get matching user IDs first
    if (learningFilter === "yes" || learningFilter === "no") {
      const memoryQuery = learningFilter === "yes"
        ? { activeLearningPath: { $ne: null } }
        : { $or: [{ activeLearningPath: null }, { activeLearningPath: { $exists: false } }] };
      const memoryUserIds = await LearningMemory.distinct("user", memoryQuery);
      if (learningFilter === "yes") {
        userQuery._id = { $in: memoryUserIds };
      } else {
        userQuery._id = { $nin: memoryUserIds };
      }
    }

    const [users, total] = await Promise.all([
      User.find(userQuery)
        .select("name email role avatar authProvider adminPermissions createdAt lastUsedAt aiUsage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(userQuery),
    ]);

    // Fetch learning progress for each user
    const userIds = users.map((u) => u._id);
    const memories = await LearningMemory.find({ user: { $in: userIds } })
      .select("user activeLearningPath currentStage currentLesson completedLessons completedStages")
      .populate("activeLearningPath", "title")
      .populate("currentStage", "title")
      .populate("currentLesson", "title")
      .lean();

    const memoryMap = {};
    for (const m of memories) {
      memoryMap[m.user.toString()] = m;
    }

    const enrichedUsers = users.map((u) => {
      const mem = memoryMap[u._id.toString()];
      const completedLessons = mem?.completedLessons?.length || 0;
      const completedStages = mem?.completedStages?.length || 0;

      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatar: u.avatar || null,
        authProvider: u.authProvider || "local",
        adminPermissions: u.adminPermissions || { viewUsers: false, viewProgress: false, viewAIUsage: false, deleteUsers: false, manageAdmins: false, manageSettings: false },
        permissions: u.role === "super_admin"
          ? { viewUsers: true, viewProgress: true, viewAIUsage: true, deleteUsers: true, manageAdmins: true, manageSettings: true }
          : (u.adminPermissions || { viewUsers: false, viewProgress: false, viewAIUsage: false, deleteUsers: false, manageAdmins: false, manageSettings: false }),
        createdAt: u.createdAt,
        lastUsedAt: u.lastUsedAt || null,
        aiUsage: u.aiUsage || { total: 0, voice: 0, text: 0, lastUsedAt: null },
        learning: {
          activePath: mem?.activeLearningPath?.title || null,
          currentStage: mem?.currentStage?.title || null,
          currentLesson: mem?.currentLesson?.title || null,
          completedLessons,
          completedStages,
          hasActivePath: !!mem?.activeLearningPath,
        },
      };
    });

    return res.json({
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Admin users list error:", err);
    return res.status(500).json({ message: "Failed to load users" });
  }
});

// ─── GET /api/admin/users/:id ──────────────────────────────────────
router.get("/users/:id", requirePermission("viewUsers"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id)
      .select("name email role avatar authProvider adminPermissions createdAt lastUsedAt aiUsage")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch learning memory
    const mem = await LearningMemory.findOne({ user: id })
      .select("activeLearningPath currentStage currentLesson completedLessons completedStages quizResults exerciseResults weakTopics")
      .populate("activeLearningPath", "title slug category")
      .populate("currentStage", "title slug order")
      .populate("currentLesson", "title slug")
      .lean();

    const completedLessons = mem?.completedLessons?.length || 0;
    const completedStages = mem?.completedStages?.length || 0;

    // Get total lessons in the active path (if exists) for progress calculation
    let totalLessons = 0;
    if (mem?.activeLearningPath) {
      const stages = await Stage.find({ learningPath: mem.activeLearningPath._id, status: "published" }).select("_id").lean();
      const stageIds = stages.map((s) => s._id);
      if (stageIds.length > 0) {
        totalLessons = await Lesson.countDocuments({ topic: { $in: (await require("../models/Topic").find({ stage: { $in: stageIds } }).select("_id").lean()).map((t) => t._id) } });
      }
    }

    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
        authProvider: user.authProvider || "local",
        adminPermissions: user.adminPermissions || {},
        createdAt: user.createdAt,
        lastUsedAt: user.lastUsedAt || null,
        aiUsage: user.aiUsage || { total: 0, voice: 0, text: 0, lastUsedAt: null },
      },
      learning: {
        activePath: mem?.activeLearningPath
          ? { id: mem.activeLearningPath._id, title: mem.activeLearningPath.title, category: mem.activeLearningPath.category }
          : null,
        currentStage: mem?.currentStage
          ? { id: mem.currentStage._id, title: mem.currentStage.title }
          : null,
        currentLesson: mem?.currentLesson
          ? { id: mem.currentLesson._id, title: mem.currentLesson.title }
          : null,
        completedLessons,
        completedStages,
        totalLessons,
        progressPercent,
        weakTopics: mem?.weakTopics || [],
        quizResults: mem?.quizResults || [],
        exerciseResults: mem?.exerciseResults || [],
      },
    });
  } catch (err) {
    console.error("Admin user detail error:", err);
    return res.status(500).json({ message: "Failed to load user details" });
  }
});

// ─── GET /api/admin/admins ─────────────────────────────────────────
router.get("/admins", requirePermission("manageAdmins"), async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } })
      .select("name email role avatar authProvider adminPermissions createdAt lastUsedAt updatedAt")
      .sort({ role: -1, createdAt: -1 })
      .lean();
    const sanitized = admins.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar || null,
      authProvider: u.authProvider || "local",
      // super_admin always shows full permissions
      permissions: u.role === "super_admin"
        ? { viewUsers: true, viewProgress: true, viewAIUsage: true, deleteUsers: true, manageAdmins: true, manageSettings: true }
        : (u.adminPermissions || { viewUsers: false, viewProgress: false, viewAIUsage: false, deleteUsers: false, manageAdmins: false, manageSettings: false }),
      createdAt: u.createdAt,
      lastUsedAt: u.lastUsedAt || null,
      updatedAt: u.updatedAt || null,
    }));
    return res.json({ admins: sanitized });
  } catch (err) {
    console.error("Admin admins list error:", err);
    return res.status(500).json({ message: "Failed to load administrators" });
  }
});

// ─── Permission helpers ─────────────────────────────────────────────
const VALID_PERMS = ["viewUsers", "viewProgress", "viewAIUsage", "deleteUsers", "manageAdmins", "manageSettings"];

function normalizePermissions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out = {};
  for (const k of VALID_PERMS) {
    if (k in input) {
      if (typeof input[k] !== "boolean") return null;
      out[k] = input[k];
    } else {
      out[k] = false;
    }
  }
  // reject unknown keys
  for (const k of Object.keys(input)) {
    if (!VALID_PERMS.includes(k)) return null;
  }
  return out;
}

function canGrant(requesterPerms, requestedPerms, isSuperAdmin) {
  if (isSuperAdmin) return true;
  for (const k of VALID_PERMS) {
    if (requestedPerms[k] === true && !requesterPerms[k]) return false;
  }
  return true;
}

// ─── PATCH /api/admin/users/:id/role ───────────────────────────────
router.patch("/users/:id/role", requirePermission("manageAdmins"), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (id === req.user.id.toString()) {
      return res.status(400).json({ message: "You cannot change your own role." });
    }
    if (!role || !["admin", "student"].includes(role)) {
      return res.status(400).json({ message: "Role must be 'admin' or 'student'." });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "User not found" });

    // Protect super_admin completely
    if (target.role === "super_admin") {
      return res.status(403).json({ message: "Super admin accounts cannot be modified through this action." });
    }
    // Prevent privilege escalation: cannot create super_admin via this route
    if (role === "super_admin") {
      return res.status(403).json({ message: "Cannot assign super_admin role through this action." });
    }

    // Validate allowed transitions
    if (target.role === "student" && role === "admin") {
      // promotion — validate permissions payload if provided
      let permsToSet;
      if (permissions !== undefined) {
        const normalized = normalizePermissions(permissions);
        if (!normalized) return res.status(400).json({ message: "Invalid permissions object." });
        if (!canGrant(req.user.permissions, normalized, req.user.role === "super_admin")) {
          return res.status(403).json({ message: "You cannot grant permissions you do not have." });
        }
        permsToSet = normalized;
      } else {
        // sensible defaults for college project — view trio on, dangerous off
        permsToSet = { viewUsers: true, viewProgress: true, viewAIUsage: true, deleteUsers: false, manageAdmins: false, manageSettings: false };
        // intersect defaults with requester's perms to prevent escalation
        if (req.user.role !== "super_admin") {
          for (const k of VALID_PERMS) {
            if (permsToSet[k] && !req.user.permissions[k]) permsToSet[k] = false;
          }
        }
      }
      target.role = "admin";
      target.adminPermissions = permsToSet;
      await target.save();
      return res.json({
        message: `${target.name} is now an admin.`,
        user: { id: target._id, name: target.name, email: target.email, role: target.role, permissions: target.adminPermissions },
      });
    }

    if (target.role === "admin" && role === "student") {
      // demotion — also requires manageAdmins, already checked
      target.role = "student";
      target.adminPermissions = { viewUsers: false, viewProgress: false, viewAIUsage: false, deleteUsers: false, manageAdmins: false, manageSettings: false };
      await target.save();
      return res.json({
        message: `Administrator access removed from ${target.name}.`,
        user: { id: target._id, name: target.name, email: target.email, role: target.role },
      });
    }

    // no-op or invalid transition (e.g. admin->admin)
    return res.status(400).json({ message: `Cannot change role from ${target.role} to ${role}.` });
  } catch (err) {
    console.error("Admin role change error:", err);
    return res.status(500).json({ message: "Failed to update role" });
  }
});

// ─── PATCH /api/admin/users/:id/permissions ────────────────────────
router.patch("/users/:id/permissions", requirePermission("manageAdmins"), async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (id === req.user.id.toString()) {
      return res.status(400).json({ message: "You cannot change your own permissions." });
    }
    const normalized = normalizePermissions(permissions);
    if (!normalized) return res.status(400).json({ message: "Invalid permissions object. Each permission must be true or false." });

    if (!canGrant(req.user.permissions, normalized, req.user.role === "super_admin")) {
      return res.status(403).json({ message: "You cannot grant permissions you do not have." });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.role === "super_admin") {
      return res.status(403).json({ message: "Super admin permissions cannot be modified." });
    }
    if (target.role !== "admin") {
      return res.status(400).json({ message: "Only admin accounts have editable permissions. Promote the user to admin first." });
    }

    target.adminPermissions = normalized;
    await target.save();
    return res.json({
      message: `Permissions updated for ${target.name}.`,
      user: { id: target._id, name: target.name, email: target.email, role: target.role, permissions: target.adminPermissions },
    });
  } catch (err) {
    console.error("Admin permissions update error:", err);
    return res.status(500).json({ message: "Failed to update permissions" });
  }
});

// ─── PATCH /api/admin/profile — update own name ───────────────────
router.patch("/profile", async (req, res) => {
  try {
    const { name } = req.body || {};
    const trimmed = (name || "").trim();
    if (!trimmed) return res.status(400).json({ message: "Name is required." });
    if (trimmed.length < 2) return res.status(400).json({ message: "Name must be at least 2 characters." });
    if (trimmed.length > 50) return res.status(400).json({ message: "Name is too long." });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    user.name = trimmed;
    await user.save();

    // keep req.user in sync for this request
    req.user.name = trimmed;

    return res.json({ message: "Profile updated.", user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Admin profile update error:", err);
    return res.status(500).json({ message: "Failed to update profile." });
  }
});

// ─── PATCH /api/admin/password — change own password ───────────────
router.patch("/password", async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Current password, new password and confirmation are required." });
    }
    if (newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters." });
    if (newPassword !== confirmPassword) return res.status(400).json({ message: "New passwords do not match." });

    const user = await User.findById(req.user.id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found." });
    if (!user.password) return res.status(400).json({ message: "Password change is not available for this account. Please use your OAuth provider." });

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) return res.status(401).json({ message: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("Admin password change error:", err);
    return res.status(500).json({ message: "Failed to change password." });
  }
});

// ─── GET /api/admin/settings ───────────────────────────────────────
router.get("/settings", requirePermission("manageSettings"), async (req, res) => {
  try {
    const s = await PlatformSettings.getSettings();
    return res.json({
      allowRegistration: s.allowRegistration,
      maintenanceMode: s.maintenanceMode,
      aiTeacherEnabled: s.aiTeacherEnabled,
      voiceAIEnabled: s.voiceAIEnabled,
      defaultAIModel: s.defaultAIModel,
      updatedAt: s.updatedAt,
    });
  } catch (err) {
    console.error("Admin get settings error:", err);
    return res.status(500).json({ message: "Failed to load settings." });
  }
});

// ─── PATCH /api/admin/settings ─────────────────────────────────────
router.patch("/settings", requirePermission("manageSettings"), async (req, res) => {
  try {
    const allowed = ["allowRegistration", "maintenanceMode", "aiTeacherEnabled", "voiceAIEnabled", "defaultAIModel"];
    const updates = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid settings provided." });
    }
    // validate types
    if ("allowRegistration" in updates && typeof updates.allowRegistration !== "boolean") return res.status(400).json({ message: "allowRegistration must be true or false." });
    if ("maintenanceMode" in updates && typeof updates.maintenanceMode !== "boolean") return res.status(400).json({ message: "maintenanceMode must be true or false." });
    if ("aiTeacherEnabled" in updates && typeof updates.aiTeacherEnabled !== "boolean") return res.status(400).json({ message: "aiTeacherEnabled must be true or false." });
    if ("voiceAIEnabled" in updates && typeof updates.voiceAIEnabled !== "boolean") return res.status(400).json({ message: "voiceAIEnabled must be true or false." });
    if ("defaultAIModel" in updates) {
      if (typeof updates.defaultAIModel !== "string") return res.status(400).json({ message: "defaultAIModel must be a string." });
      updates.defaultAIModel = updates.defaultAIModel.trim().slice(0, 100);
    }
    // reject unknown keys
    for (const k of Object.keys(req.body)) {
      if (!allowed.includes(k)) return res.status(400).json({ message: `Unknown setting: ${k}` });
    }

    const s = await PlatformSettings.getSettings();
    Object.assign(s, updates);
    await s.save();
    return res.json({
      message: "Settings updated.",
      settings: {
        allowRegistration: s.allowRegistration,
        maintenanceMode: s.maintenanceMode,
        aiTeacherEnabled: s.aiTeacherEnabled,
        voiceAIEnabled: s.voiceAIEnabled,
        defaultAIModel: s.defaultAIModel,
        updatedAt: s.updatedAt,
      },
    });
  } catch (err) {
    console.error("Admin patch settings error:", err);
    return res.status(500).json({ message: "Failed to update settings." });
  }
});

// ─── DELETE /api/admin/users/:id ───────────────────────────────────
router.delete("/users/:id", requirePermission("deleteUsers"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Prevent self-deletion
    if (id === req.user.id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    const user = await User.findById(id).select("role name email").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deletion of super_admin by normal admin
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "You cannot delete a super admin account." });
    }

    // Remove associated learning data
    await Promise.all([
      LearningMemory.deleteOne({ user: id }),
    ]);

    // Delete the user
    await User.deleteOne({ _id: id });

    return res.json({ message: `User "${user.name}" has been deleted.` });
  } catch (err) {
    console.error("Admin delete user error:", err);
    return res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;
