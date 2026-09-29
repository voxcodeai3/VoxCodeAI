const mongoose = require("mongoose");

// A signup stays here until the owner proves the email address. Nothing is
// written to the User collection (so it never shows up in admin lists and
// cannot sign in) until verify-email succeeds.
const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    verificationCodeHash: { type: String, required: true, select: false },
    verificationExpiresAt: { type: Date, required: true, select: false },
    verificationAttempts: { type: Number, default: 0, select: false },
    verificationLastSentAt: { type: Date, select: false },
    // Hard drop-dead time: the whole pending record is removed by MongoDB's
    // TTL monitor once this passes, so abandoned signups never linger.
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema,
);
