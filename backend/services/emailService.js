const nodemailer = require("nodemailer");

// Fail fast. Nodemailer defaults (2 min connection / 10 min socket) will
// otherwise stall any handler that touches the mailer long past the
// browser's request timeout.
const TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
};

const RESEND_API_URL = "https://api.resend.com";

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

async function resendRequest(path, { method = "GET", body } = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const response = await fetch(`${RESEND_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Resend API HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json().catch(() => ({}));
}

// HTTPS transport. Works even when the host blocks every outbound SMTP port,
// which is common on free hosting. Preferred whenever RESEND_API_KEY is set.
async function sendViaResend(mailOptions) {
  await resendRequest("/emails", {
    method: "POST",
    body: {
      from: mailOptions.from,
      to: [mailOptions.to],
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
    },
  });
}

async function sendWithFallback(mailOptions) {
  const failures = [];

  if (process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(mailOptions);
      return true;
    } catch (error) {
      failures.push(`resend api: ${error.message}`);
    }
  }

  for (const options of buildCandidates()) {
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

// Used by the admin diagnostics endpoint to explain delivery failures
// without guessing. Never throws; returns a structured report.
async function diagnose(sendTo) {
  const report = {
    resendConfigured: !!process.env.RESEND_API_KEY,
    resend: null,
    smtpHost: process.env.EMAIL_HOST || "smtp.gmail.com",
    from: getFrom(),
    transports: [],
  };

  if (report.resendConfigured) {
    try {
      if (sendTo) {
        await sendViaResend({
          from: getFrom(),
          to: sendTo,
          subject: "VoxCode email diagnostics",
          text: "If you received this, Resend delivery works.",
          html: "<p>If you received this, Resend delivery works.</p>",
        });
        report.resend = { ok: true, testEmailSentTo: sendTo };
      } else {
        await resendRequest("/emails?limit=1");
        report.resend = { ok: true, note: "API key accepted" };
      }
    } catch (error) {
      report.resend = { ok: false, error: error.message };
    }
  }

  for (const options of buildCandidates()) {
    const entry = {
      port: options.port,
      secure: options.secure,
      connectAndAuth: null,
      send: null,
      ms: 0,
    };
    const started = Date.now();
    const transporter = nodemailer.createTransport({
      ...options,
      ...TIMEOUTS,
    });

    try {
      await transporter.verify();
      entry.connectAndAuth = "ok";
      if (sendTo) {
        await transporter.sendMail({
          from: getFrom(),
          to: sendTo,
          subject: "VoxCode email diagnostics (SMTP)",
          text: "If you received this, SMTP delivery works.",
          html: "<p>If you received this, SMTP delivery works.</p>",
        });
        entry.send = `ok (sent to ${sendTo})`;
      }
    } catch (error) {
      const target = entry.connectAndAuth === null ? "connectAndAuth" : "send";
      entry[target] = `FAILED: ${error.code ? error.code + " " : ""}${error.message}`;
    } finally {
      entry.ms = Date.now() - started;
      transporter.close();
    }

    report.transports.push(entry);
  }

  return report;
}

async function sendVerificationEmail(toEmail, code) {
  try {
    return await sendWithFallback({
      from: getFrom(),
      to: toEmail,
      subject: "Verify your email address - VoxCode",
      text: `VoxCode\n\nVerify your email address\n\nYour verification code:\n\n${code}\n\nThis code expires in 10 minutes.\n\nIf you did not create this account, you can ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
  diagnose,
};
