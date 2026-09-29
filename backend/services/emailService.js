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
const BREVO_API_URL = "https://api.brevo.com";

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

// EMAIL_FROM is written as `Name <address@domain>` (or a bare address).
function parseFrom(raw) {
  const value = raw || "VoxCode <no-reply@voxcode.com>";
  const angled = value.match(/^\s*"?([^"<]*)"?\s*<([^<>]+)>\s*$/);
  if (angled) {
    return { name: angled[1].trim() || undefined, email: angled[2].trim() };
  }
  return { email: value.trim() };
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

// HTTPS transport for Resend. Only usable for arbitrary recipients once a
// domain is verified; otherwise Resend limits sends to your own account
// address, so Brevo is preferred for accounts without a domain.
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

async function brevoRequest(path, { method = "GET", body } = {}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");

  const response = await fetch(`${BREVO_API_URL}${path}`, {
    method,
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Brevo API HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json().catch(() => ({}));
}

// Brevo (free 300/day): the sender address is verified by clicking a link in
// an email, so no domain/DNS ownership is required. Also pure HTTPS, so it
// works from hosts that block SMTP.
async function sendViaBrevo(mailOptions) {
  const from = parseFrom(mailOptions.from);
  await brevoRequest("/v3/smtp/email", {
    method: "POST",
    body: {
      sender: { name: from.name || "VoxCode", email: from.email },
      to: [{ email: mailOptions.to }],
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
    },
  });
}

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

  if (process.env.BREVO_API_KEY) {
    try {
      await sendViaBrevo(mailOptions);
      return true;
    } catch (error) {
      failures.push(`brevo api: ${error.message}`);
    }
  }

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
    appsScriptConfigured: !!process.env.APPS_SCRIPT_URL,
    appsScript: null,
    brevoConfigured: !!process.env.BREVO_API_KEY,
    brevo: null,
    resendConfigured: !!process.env.RESEND_API_KEY,
    resend: null,
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

  if (report.brevoConfigured) {
    try {
      if (sendTo) {
        await sendViaBrevo({
          from: getFrom(),
          to: sendTo,
          subject: "VoxCode email diagnostics (Brevo)",
          text: "If you received this, Brevo delivery works.",
          html: "<p>If you received this, Brevo delivery works.</p>",
        });
        report.brevo = { ok: true, testEmailSentTo: sendTo };
      } else {
        await brevoRequest("/v3/smtp/email?limit=1");
        report.brevo = { ok: true, note: "API key accepted" };
      }
    } catch (error) {
      report.brevo = { ok: false, error: error.message };
    }
  }

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
