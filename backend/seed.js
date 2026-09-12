require("dotenv").config();
const { execFileSync } = require("child_process");
const path = require("path");

if (!process.env.MONGO_URI) {
  console.error("Error: MONGO_URI not found in environment.");
  console.error("Make sure backend/.env is configured with a valid MONGO_URI.");
  process.exit(1);
}

const seeds = [
  { name: "Technologies & Stacks", file: "seedTechnologies.js" },
  { name: "Courses & Learning Paths", file: "seedCourses.js" },
  { name: "Programming Languages", file: "seedProgrammingLanguages.js" },
  { name: "Frontend & Backend Stacks", file: "seedFrontendBackendStacks.js" },
  { name: "Full-Stack, Mobile & Databases", file: "seedFullStackMobileDatabases.js" },
  { name: "Assessments", file: "seedAssessments.js" },
  { name: "Admin User", file: "seedAdmin.js" },
];

console.log("========================================");
console.log("  VoxCode Seed Runner");
console.log("========================================\n");

let succeeded = 0;
let failed = 0;

for (const seed of seeds) {
  const num = succeeded + failed + 1;
  console.log(`\n>> [${num}/${seeds.length}] ${seed.name}`);
  console.log("   " + "-".repeat(40));

  try {
    execFileSync(process.execPath, [path.join(__dirname, seed.file)], {
      stdio: "inherit",
      cwd: __dirname,
    });
    succeeded++;
  } catch (err) {
    failed++;
    console.error(`   FAILED: ${seed.file}`);
    if (err.status !== undefined && err.status !== null) {
      console.error(`   Exit code: ${err.status}`);
    }
  }
}

console.log("\n========================================");
console.log(`  Results: ${succeeded} succeeded, ${failed} failed`);
console.log("========================================");

if (failed > 0) {
  process.exit(1);
}
