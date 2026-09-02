/**
 * seedAdmin.js — One-time script to create a super_admin account.
 *
 * Usage:
 *   node backend/seedAdmin.js
 *   node backend/seedAdmin.js --email admin@voxcode.com --password mypassword123
 *
 * Defaults:
 *   email:    admin@voxcode.com
 *   password: admin123
 *   name:     Super Admin
 *
 * Only runs if no super_admin exists yet.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI not found in environment. Make sure .env is configured.");
  process.exit(1);
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return null;
}

async function seed() {
  const email = getArg("--email") || "admin@voxcode.com";
  const password = getArg("--password") || "admin123";
  const name = getArg("--name") || "Super Admin";

  console.log(`Connecting to MongoDB...`);
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
    name,
    email,
    password: hashedPassword,
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
