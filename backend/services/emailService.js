const nodemailer = require("nodemailer");

// Fail fast. Nodemailer defaults (2 min connection / 10 min socket) will
// otherwise stall any handler that touches the mailer long past the
// browser's request timeout.
const TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
};

// Personal Google-account relay: a Apps Script web app (deployed by the app
// owner) calls MailApp.sendEmail, so mail leaves from Gmail's own servers.
// Only HTTPS is used, which works even where outbound SMTP ports are blocked.
async function sendViaAppsScript(mailOptions) {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) throw new Error("APPS_SCRIPT_URL is not set");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: process.env.APPS_SCRIPT_SECRET,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Apps Script HTTP ${response.status}`);
  }
  const data = await response.json().catch(() => null);
  if (!data || data.ok !== true) {
    throw new Error(data && data.error ? data.error : "unexpected response");
  }
  return data;
}

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

// Primary transport: the Google relay above. Direct SMTP stays as the
// fallback because it works on normal networks (local dev); on free Render
// instances outbound SMTP ports are blocked, so the relay must be configured.
async function sendWithFallback(mailOptions) {
  const failures = [];

  if (process.env.APPS_SCRIPT_URL) {
    try {
      await sendViaAppsScript(mailOptions);
      return true;
    } catch (error) {
      failures.push(`apps script: ${error.message}`);
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
    appsScriptConfigured: !!process.env.APPS_SCRIPT_URL,
    appsScript: null,
    smtpHost: process.env.EMAIL_HOST || "smtp.gmail.com",
    from: getFrom(),
    transports: [],
  };

  if (report.appsScriptConfigured) {
    try {
      if (sendTo) {
        await sendViaAppsScript({
          to: sendTo,
          subject: "VoxCode email diagnostics (Apps Script relay)",
          text: "If you received this, the Apps Script relay works.",
          html: "<p>If you received this, the Apps Script relay works.</p>",
        });
        report.appsScript = { ok: true, testEmailSentTo: sendTo };
      } else {
        const response = await fetch(process.env.APPS_SCRIPT_URL, {
          method: "GET",
          signal: AbortSignal.timeout(15000),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok !== true) {
          throw new Error(
            data && data.error ? data.error : `HTTP ${response.status}`,
          );
        }
        report.appsScript = { ok: true, note: "web app reachable" };
      }
    } catch (error) {
      report.appsScript = { ok: false, error: error.message };
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
