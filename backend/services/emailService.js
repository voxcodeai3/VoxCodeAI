const nodemailer = require("nodemailer");

// Fail fast. Nodemailer defaults (2 min connection / 10 min socket) will
// otherwise stall any handler that touches the mailer long past the
// browser's request timeout.
const TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
};

function baseOptions() {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    console.warn(
      "Email service is not fully configured in environment variables.",
    );
  }

  return {
    host: host || "smtp.gmail.com",
    auth: {
      user: user,
      pass: pass,
    },
  };
}

// The configured transport first, then the two standard Gmail submission
// ports. Some hosts block 587 (STARTTLS) while 465 (implicit TLS) works, so
// trying both is what makes delivery survive a blocked port.
function buildCandidates() {
  const base = baseOptions();
  const configuredPort = parseInt(process.env.EMAIL_PORT || "587", 10);
  const configuredSecure =
    process.env.EMAIL_SECURE === "true" || configuredPort === 465;

  const candidates = [
    { ...base, port: configuredPort, secure: configuredSecure },
    { ...base, port: 587, secure: false },
    { ...base, port: 465, secure: true },
  ];

  const seen = new Set();
  return candidates.filter((c) => {
    const key = `${c.port}:${c.secure}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function sendWithFallback(mailOptions) {
  const candidates = buildCandidates();
  const failures = [];

  for (const options of candidates) {
    const transporter = nodemailer.createTransport({
      ...options,
      ...TIMEOUTS,
    });

    try {
      await transporter.sendMail(mailOptions);
      transporter.close();
      return true;
    } catch (error) {
      failures.push(`port ${options.port}: ${error.message}`);
      transporter.close();
    }
  }

  console.error(
    "Email delivery failed on every transport:\n  " + failures.join("\n  "),
  );
  return false;
}

function getFrom() {
  return process.env.EMAIL_FROM || "VoxCode <no-reply@voxcode.com>";
}

async function sendVerificationEmail(toEmail, code) {
  try {
    return await sendWithFallback({
      from: getFrom(),
      to: toEmail,
      subject: "Verify your email address - VoxCode",
      text: `VoxCode\n\nVerify your email address\n\nYour verification code:\n\n${code}\n\nThis code expires in 10 minutes.\n\nIf you did not create this account, you can ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w-md: 600px; margin: 0 auto; padding: 20px;">
          <h2>VoxCode</h2>
          <p>Verify your email address</p>
          <p>Your verification code:</p>
          <h1 style="letter-spacing: 0.2em; color: #333;">${code}</h1>
          <p>This code expires in 10 minutes.</p>
          <p style="color: #666; font-size: 12px; margin-top: 40px;">If you did not create this account, you can ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send verification email:", error.message);
    return false;
  }
}

async function sendPasswordResetEmail(toEmail, code) {
  try {
    return await sendWithFallback({
      from: getFrom(),
      to: toEmail,
      subject: "Reset your password - VoxCode",
      text: `VoxCode\n\nPassword Reset Request\n\nYour password reset code:\n\n${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w-md: 600px; margin: 0 auto; padding: 20px;">
          <h2>VoxCode</h2>
          <p>Password Reset Request</p>
          <p>Your password reset code:</p>
          <h1 style="letter-spacing: 0.2em; color: #333;">${code}</h1>
          <p>This code expires in 10 minutes.</p>
          <p style="color: #666; font-size: 12px; margin-top: 40px;">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error.message);
    return false;
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
