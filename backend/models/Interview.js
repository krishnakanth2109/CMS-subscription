// --- START OF FILE Interview.js ---
import mongoose from 'mongoose';

const interviewSchema = mongoose.Schema({
  interviewId: { type: String, unique: true, sparse: true }, // e.g., INT-1699999999-AB12

  // ── Multi-Tenancy ─────────────────────────────────────────────────────────
  // Points to the Manager's _id (the tenant root).
  // Every query MUST filter by this field to isolate company data.
  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  candidateId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
  recruiterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },

  interviewDate: { type: Date, required: true },
  duration:      { type: Number, default: 60 },
  type: {
    type: String,
    enum: ['Virtual', 'In-person', 'Phone'],
    default: 'Virtual',
  },
  location:    { type: String, default: 'Remote' },
  meetingLink: { type: String },

  status: {
    type: String,
    enum: [
      'Scheduled', 'Completed', 'Cancelled',
      'No Show', 'Shortlisted', 'Rejected', 'Submitted', 'Hold'
    ],
    default: 'Scheduled',
  },

  round: {
    type: String,
    enum: [
      'L1 Interview', 'L2 Interview', 'L3 Interview',
      'L4 Interview', 'L5 Interview', 'Technical Round', 'HR Round'
    ],
    default: 'L1 Interview',
  },

  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  notes:    { type: String },
  feedback: { type: String },
  rating:   { type: Number },
}, {
  timestamps: true,
});

// ── Auto-generate interviewId on create ──────────────────────────────────────
interviewSchema.pre('save', function (next) {
  if (!this.isNew) return next();
  const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  this.interviewId = `INT-${uniqueSuffix}`;
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────────
interviewSchema.index({ tenantOwnerId: 1, recruiterId: 1, interviewDate: 1 }); // recruiter interviews scoped to tenant
interviewSchema.index({ tenantOwnerId: 1, candidateId: 1 });                   // candidate interviews scoped to tenant
interviewSchema.index({ tenantOwnerId: 1, interviewDate: 1 });                 // date sorts/filters per tenant
interviewSchema.index({ tenantOwnerId: 1, status: 1 });                        // status filter per tenant

const Interview = mongoose.models.Interview || mongoose.model('Interview', interviewSchema);
export default Interview;
