// --- START OF FILE User.js ---
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true },
    recruiterId: { type: String, unique: true, sparse: true },

    // ── SaaS Multi-Tenancy Root ───────────────────────────────────────────────
    tenantOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    firstName:      { type: String, trim: true },
    lastName:       { type: String, trim: true },
    username:       { type: String, unique: true, sparse: true, trim: true },
    email:          { type: String, unique: true, lowercase: true, trim: true },
    phone:          { type: String },
    profilePicture: { type: String, default: '' },

    // ── Role Management ───────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['master', 'admin', 'manager', 'recruiter'],
      default: 'recruiter',
    },

    // ── Manager-specific SaaS fields ──────────────────────────────────────────
    companyName: { type: String, trim: true },

    subscriptionPlan: {
      type: String,
      enum: ['Basic', 'Pro', 'Enterprise', 'None'],
      default: 'None',
    },

    // ── Razorpay Subscription Fields ──────────────────────────────────────────
    subscriptionBilling:   { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    subscriptionExpiresAt: { type: Date, default: null },
    subscriptionPaymentId: { type: String, default: '' },
    subscriptionOrderId:   { type: String, default: '' },
    // For free trial: set when manager registers with Basic plan
    trialStartedAt:        { type: Date, default: null },

    // ── Candidate ID Prefix (Manager-level setting) ───────────────────────────
    candidatePrefix: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'CAND',
      validate: {
        validator: (v) => /^[A-Z]{4}$/.test(v),
        message: 'candidatePrefix must be exactly 4 uppercase letters (A-Z).',
      },
    },

    active:         { type: Boolean, default: true },
    location:       { type: String },
    specialization: { type: String },
    experience:     { type: String },
    bio:            { type: String },
    socials: {
      linkedin: String,
      github:   String,
      twitter:  String,
      website:  String,
    },
    password: { type: String },
  },
  { timestamps: true },
);

// ── Virtual: is trial expired? ────────────────────────────────────────────────
userSchema.virtual('isTrialExpired').get(function () {
  if (this.subscriptionPlan !== 'Basic' || !this.trialStartedAt) return false;
  const trialEnd = new Date(this.trialStartedAt);
  trialEnd.setDate(trialEnd.getDate() + 7);
  return new Date() > trialEnd;
});

// ── Virtual: days left in current plan ────────────────────────────────────────
userSchema.virtual('subscriptionDaysLeft').get(function () {
  if (!this.subscriptionExpiresAt) return null;
  return Math.max(
    0,
    Math.ceil((new Date(this.subscriptionExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
  );
});

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, active: 1 });
userSchema.index({ firebaseUid: 1 });
userSchema.index({ tenantOwnerId: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;