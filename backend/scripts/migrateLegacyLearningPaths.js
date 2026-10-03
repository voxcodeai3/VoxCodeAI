require("dotenv").config();
const mongoose = require("mongoose");

const LearningPath = require("../models/LearningPath");
const Stage = require("../models/Stage");
const Topic = require("../models/Topic");

const MONGO_URI = process.env.MONGO_URI;

const PLAN = [
  {
    target: "frontend-developer",
    sources: ["html-css-javascript-react"],
    meta: {
      category: "frontend",
      pathType: "frontend",
      level: "beginner",
      difficulty: "beginner",
      estimatedDuration: "~32 hours",
    },
  },
  {
    target: "backend-developer",
    sources: ["nodejs-express-mongodb"],
    meta: {
      category: "backend",
      pathType: "backend",
      level: "intermediate",
      difficulty: "intermediate",
      estimatedDuration: "~18 hours",
    },
  },
  {
    target: "fullstack-developer",
    sources: ["html-css-javascript-react", "nodejs-express-mongodb"],
    meta: {
      category: "fullstack",
      pathType: "fullstack",
      level: "intermediate",
      difficulty: "intermediate",
      estimatedDuration: "~50 hours",
    },
  },
  {
    target: "python-developer",
    sources: ["python-programming"],
    meta: {
      category: "programming_languages",
      pathType: "language",
      level: "beginner",
      difficulty: "beginner",
      estimatedDuration: "~20 hours",
    },
  },
  {
    target: "javascript-mastery",
    sources: ["javascript-programming"],
    meta: {
      category: "programming_languages",
      pathType: "language",
      level: "beginner",
      difficulty: "beginner",
      estimatedDuration: "~20 hours",
    },
  },
];

async function cloneCurriculum(targetSlug, sourceSlugs) {
  const target = await LearningPath.findOne({ slug: targetSlug });
  if (!target) throw new Error(`LearningPath not found: ${targetSlug}`);

  // Idempotency guard: never duplicate a path that already has a curriculum.
  const existingStages = await Stage.countDocuments({ learningPath: target._id });
  if (existingStages > 0) {
    return { target: targetSlug, skipped: true, stages: existingStages };
  }

  const sources = [];
  for (const slug of sourceSlugs) {
    const source = await LearningPath.findOne({ slug }).lean();
    if (!source) throw new Error(`Source LearningPath not found: ${slug}`);

    const stages = await Stage.find({
      learningPath: source._id,
      status: "published",
    }).sort({ order: 1 }).lean();

    const topics = await Topic.find({
      stage: { $in: stages.map((stage) => stage._id) },
      status: "published",
    }).sort({ order: 1 }).lean();

    sources.push({ stages, topics });
  }

  let stageOrder = 0;
  const stageMap = new Map();
  const stageDocs = [];

  for (const source of sources) {
    for (const stage of source.stages) {
      const doc = {
        title: stage.title,
        slug: `${targetSlug}-${stage.slug}`,
        description: stage.description || "",
        level: stage.level,
        order: stageOrder++,
        learningPath: target._id,
        prerequisites: [],
        estimatedMinutes: stage.estimatedMinutes || 30,
        status: "published",
        active: true,
      };

      stageDocs.push(doc);
    }
  }

  const insertedStages = await Stage.insertMany(stageDocs);

  // Rebuild the source-stage -> target-stage mapping by insertion order.
  let insertedIndex = 0;
  for (const source of sources) {
    for (const stage of source.stages) {
      stageMap.set(String(stage._id), insertedStages[insertedIndex++]._id);
    }
  }

  const topicDocs = [];
  for (const source of sources) {
    for (const topic of source.topics) {
      const targetStage = stageMap.get(String(topic.stage));
      if (!targetStage) {
        throw new Error(`Could not map topic stage: ${topic.title}`);
      }

      topicDocs.push({
        title: topic.title,
        slug: `${targetSlug}-${topic.slug}`,
        description: topic.description || "",
        order: topic.order,
        stage: targetStage,
        technologies: topic.technologies || [],
        estimatedMinutes: topic.estimatedMinutes || 20,
        status: "published",
        active: true,
      });
    }
  }

  await Topic.insertMany(topicDocs);

  return {
    target: targetSlug,
    skipped: false,
    stages: insertedStages.length,
    topics: topicDocs.length,
  };
}

async function main() {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set.");

  await mongoose.connect(MONGO_URI);

  for (const item of PLAN) {
    await LearningPath.updateOne(
      { slug: item.target },
      { $set: item.meta }
    );

    const result = await cloneCurriculum(item.target, item.sources);
    console.log(JSON.stringify(result));
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Legacy LearningPath migration failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
