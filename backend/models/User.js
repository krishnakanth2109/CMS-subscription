// --- START OF FILE User.js ---
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true },
    recruiterId: { type: String, unique: true, sparse: true },

    // ── SaaS Multi-Tenancy Root ───────────────────────────────────────────────
    // Manager  → tenantOwnerId: null  (they ARE the tenant root / company owner)
    // Admin    → tenantOwnerId = Manager's _id
    // Recruiter→ tenantOwnerId = Manager's _id
    //
    // Every other model (Candidate, Job, Client, etc.) stores this same value
    // so all data is hard-scoped to one company. Never changes after creation.
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

    // ── Candidate ID Prefix (Manager-level setting) ───────────────────────────
    // The Manager sets this once for their entire company.
    // Format: exactly 4 uppercase letters, e.g. "ACME", "GLOB", "HIRE"
    // All new candidates created under this tenant will use this prefix:
    //   ACME-0000001, ACME-0000002 ...
    // Defaults to 'CAND' if not configured.
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

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, active: 1 });   // role-based queries
userSchema.index({ firebaseUid: 1 });        // Firebase auth lookup
userSchema.index({ tenantOwnerId: 1 });      // list all users under a tenant/manager

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;