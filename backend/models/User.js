const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ["student", "admin", "super_admin"],
      default: "student",
      index: true,
    },
    adminPermissions: {
      viewUsers: { type: Boolean, default: false },
      viewProgress: { type: Boolean, default: false },
      viewAIUsage: { type: Boolean, default: false },
      deleteUsers: { type: Boolean, default: false },
      manageAdmins: { type: Boolean, default: false },
      manageSettings: { type: Boolean, default: false },
    },
    lastUsedAt: { type: Date, default: Date.now },
    aiUsage: {
      total: { type: Number, default: 0 },
      voice: { type: Number, default: 0 },
      text: { type: Number, default: 0 },
      lastUsedAt: { type: Date, default: null },
    },
    googleId: {
      type: String,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    avatar: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.methods.isAdmin = function () {
  return this.role === "admin" || this.role === "super_admin";
};

userSchema.methods.isSuperAdmin = function () {
  return this.role === "super_admin";
};

userSchema.methods.hasPermission = function (perm) {
  if (this.role === "super_admin") return true;
  if (this.role !== "admin") return false;
  return !!this.adminPermissions?.[perm];
};

userSchema.methods.getEffectivePermissions = function () {
  if (this.role === "super_admin") {
    return {
      viewUsers: true,
      viewProgress: true,
      viewAIUsage: true,
      deleteUsers: true,
      manageAdmins: true,
      manageSettings: true,
    };
  }
  if (this.role === "admin") {
    return { ...this.adminPermissions };
  }
  return {
    viewUsers: false,
    viewProgress: false,
    viewAIUsage: false,
    deleteUsers: false,
    manageAdmins: false,
    manageSettings: false,
  };
};

module.exports = mongoose.model("User", userSchema);