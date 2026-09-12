/**
 * seedAdmin.js — Creates the initial super_admin account from .env credentials.
 *
 * Usage:
 *   node backend/seedAdmin.js
 *
 * Required environment variables:
 *   SUPER_ADMIN_EMAIL     — real email address for the admin
 *   SUPER_ADMIN_PASSWORD  — strong password (min 8 characters)
 *   SUPER_ADMIN_NAME      — display name (optional, defaults to "VoxCode Super Admin")
 *
 * Behaviour:
 *   - Fails immediately if required credentials are missing.
 *   - If a super_admin already exists, does nothing (no duplicates).
 *   - Sets emailVerified = true so the admin can log in without OTP.
 *   - Hashes the password with bcryptjs before storing.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("Error: MONGO_URI not found. Configure backend/.env.");
  process.exit(1);
}

const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;
const name = process.env.SUPER_ADMIN_NAME || "VoxCode Super Admin";

if (!email) {
  console.error("Error: SUPER_ADMIN_EMAIL is not set in .env.");
  process.exit(1);
}
if (!password) {
  console.error("Error: SUPER_ADMIN_PASSWORD is not set in .env.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Error: SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const normalizedEmail = email.trim().toLowerCase();

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.\n");

  const existing = await User.findOne({ role: "super_admin" });
  if (existing) {
    console.log(`Super admin already exists: ${existing.email} (${existing._id})`);
    console.log("No action taken.");
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    emailVerified: true,
    role: "super_admin",
    adminPermissions: {
      viewUsers: true,
      viewProgress: true,
      viewAIUsage: true,
      deleteUsers: true,
      manageAdmins: true,
      manageSettings: true,
    },
    authProvider: "local",
    lastUsedAt: new Date(),
    aiUsage: { total: 0, voice: 0, text: 0, lastUsedAt: null },
  });

  console.log("Super admin created:");
  console.log(`  ID:       ${admin._id}`);
  console.log(`  Name:     ${admin.name}`);
  console.log(`  Email:    ${admin.email}`);
  console.log(`  Role:     ${admin.role}`);
  console.log(`\nYou can now log in at /login using the Admin toggle.`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
