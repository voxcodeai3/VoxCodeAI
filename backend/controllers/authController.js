const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const PlatformSettings = require("../models/PlatformSettings");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getGoogleClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );
}

function publicUser(user) {
  const isSuper = user.role === "super_admin";
  const perms = isSuper
    ? {
        viewUsers: true,
        viewProgress: true,
        viewAIUsage: true,
        deleteUsers: true,
        manageAdmins: true,
        manageSettings: true,
      }
    : user.role === "admin"
      ? { ...user.adminPermissions }
      : {
          viewUsers: false,
          viewProgress: false,
          viewAIUsage: false,
          deleteUsers: false,
          manageAdmins: false,
          manageSettings: false,
        };
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || null,
    authProvider: user.authProvider || "local",
    role: user.role || "student",
    permissions: perms,
  };
}

function signToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function redirectToFrontend(res, { token, user, error }) {
  const params = new URLSearchParams();
  if (token) {
    params.set("token", token);
    params.set("id", user.id);
    params.set("name", user.name);
    params.set("email", user.email);
    if (user.avatar) params.set("avatar", user.avatar);
    params.set("authProvider", user.authProvider);
  }
  if (error) {
    params.set("error", error);
  }
  res.redirect(`${FRONTEND_URL}/oauth/callback?${params.toString()}`);
}

async function register(req, res) {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long" });
  }

  try {
    // Registration control — checked server-side so hiding the form is not enough
    try {
      const settings = await PlatformSettings.getSettings();
      if (settings.allowRegistration === false) {
        return res.status(403).json({ message: "New student registration is currently disabled." });
      }
    } catch (_) {
      // if settings lookup fails, allow registration (fail open for college project)
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Always create as student — ignore any role/permissions from client
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      authProvider: "local",
      role: "student",
    });

    return res.status(201).json({
      message: "Account created successfully",
      user: publicUser(user),
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    console.error("Register error:", error);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

async function login(req, res) {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const isAdminLogin = req.body.isAdminLogin === true || req.body.loginType === "admin" || req.body.role === "admin";

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (isAdminLogin) {
      if (user.role !== "admin" && user.role !== "super_admin") {
        return res.status(403).json({ message: "You do not have administrator access." });
      }
    }

    // Update lastUsedAt on successful login
    user.lastUsedAt = new Date();
    await user.save();

    const token = signToken(user);

    return res.json({
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired session." });
    }
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error("Me error:", error);
    return res.status(500).json({ message: "Something went wrong on our side. Please try again." });
  }
}

async function googleAuth(req, res) {
  const client = getGoogleClient();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
  res.redirect(authUrl);
}

async function googleCallback(req, res) {
  const code = req.query.code;
  if (!code) {
    return redirectToFrontend(res, {
      error: "Google authentication was cancelled.",
    });
  }

  let idToken;
  try {
    const client = getGoogleClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    idToken = tokens.id_token;
  } catch (error) {
    console.error("Google token exchange failed:", error.message);
    return redirectToFrontend(res, {
      error: "Unable to authenticate with Google. Please try again.",
    });
  }

  let payload;
  try {
    const client = getGoogleClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("Google ID token verification failed:", error.message);
    return redirectToFrontend(res, {
      error: "Unable to authenticate with Google. Please try again.",
    });
  }

  if (!payload || !payload.email) {
    return redirectToFrontend(res, {
      error: "Authentication failed. Please try again.",
    });
  }

  const googleId = payload.sub;
  const email = (payload.email || "").toLowerCase();
  const name = payload.name || email.split("@")[0];
  const avatar = payload.picture || null;

  try {
    let user = await User.findOne({ email });

    if (user && user.authProvider === "google" && user.googleId === googleId) {
      const token = signToken(user);
      return redirectToFrontend(res, { token, user: publicUser(user) });
    }

    if (user && user.authProvider === "local") {
      return redirectToFrontend(res, {
        error:
          "An account with this email already exists. Please sign in with your password.",
      });
    }

    if (user && user.googleId && user.googleId !== googleId) {
      return redirectToFrontend(res, {
        error: "Authentication failed. Please try again.",
      });
    }

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        authProvider: "google",
        avatar,
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.authProvider = "google";
      user.avatar = avatar;
      await user.save();
    }

    const token = signToken(user);
    return redirectToFrontend(res, { token, user: publicUser(user) });
  } catch (error) {
    console.error("Google callback error:", error);
    return redirectToFrontend(res, {
      error: "Unable to authenticate with Google. Please try again.",
    });
  }
}

module.exports = { register, login, me, googleAuth, googleCallback };