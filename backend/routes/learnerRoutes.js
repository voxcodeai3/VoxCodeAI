const router = require("express").Router();
const { getProfile, updateProfile } = require("../controllers/learnerController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/profile", authMiddleware, getProfile);
router.patch("/profile", authMiddleware, updateProfile);

module.exports = router;
