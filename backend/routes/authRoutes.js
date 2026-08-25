const express = require("express");
const { register, login, me, googleAuth, googleCallback } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, me);
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

module.exports = router;