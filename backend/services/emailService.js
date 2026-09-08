const nodemailer = require("nodemailer");

function createTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  if (!host || !user || !pass) {
    console.warn(
      "Email service is not fully configured in environment variables.",
    );
  }

  return nodemailer.createTransport({
    host: host || "smtp.gmail.com",
    port: parseInt(port || "587", 10),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: user,
      pass: pass,
    },
  });
}

function getFrom() {
  return process.env.EMAIL_FROM || "VoxCode <no-reply@voxcode.com>";
}

async function sendVerificationEmail(toEmail, code) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
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
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error.message);
    return false; // Fail silently or throw based on requirements. Here we just return false.
  }
}

async function sendPasswordResetEmail(toEmail, code) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
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
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Failed to send password reset email:", error.message);
    return false;
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
