require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(
    "MONGO_URI not found in environment. Make sure .env is configured.",
  );
  process.exit(1);
}

async function migrate() {
  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(MONGO_URI);
  console.log("Connected.\n");

  console.log("Migrating users to support email verification...");

  // 1. Admins & Super Admins should be verified
  const adminRes = await User.updateMany(
    { role: { $in: ["admin", "super_admin"] }, emailVerified: { $ne: true } },
    { $set: { emailVerified: true } },
  );
  console.log(`Verified ${adminRes.modifiedCount} admin/super_admin users.`);

  // 2. Google authenticated users should be verified
  const googleRes = await User.updateMany(
    { authProvider: "google", emailVerified: { $ne: true } },
    { $set: { emailVerified: true } },
  );
  console.log(
    `Verified ${googleRes.modifiedCount} Google authenticated users.`,
  );

  // 3. For existing local students without emailVerified set at all, we will set them to false explicitly
  // so that the next time they login, they are prompted to verify.
  const studentRes = await User.updateMany(
    { emailVerified: { $exists: false } },
    { $set: { emailVerified: false } },
  );
  console.log(
    `Set emailVerified to false for ${studentRes.modifiedCount} unverified users.`,
  );

  console.log("\nMigration complete.");
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
