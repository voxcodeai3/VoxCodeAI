const express = require("express");
const {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  me,
  googleAuth,
  googleCallback,
  emailDiagnostics,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/email-diagnostics", authMiddleware, requireAdmin, emailDiagnostics);
router.get("/me", authMiddleware, me);
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

module.exports = router;
