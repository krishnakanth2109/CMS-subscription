// --- START OF FILE Job.js ---
import mongoose from 'mongoose';

const jobSchema = mongoose.Schema({
  jobCode: { type: String, required: true, unique: true, trim: true },

  // ── Multi-Tenancy ─────────────────────────────────────────────────────────
  // Points to the Manager's _id (the tenant root).
  // Every query MUST filter by this field to isolate company data.
  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  clientName:          { type: String, required: true, trim: true },
  position:            { type: String, required: true, trim: true },
  location:            { type: String, default: '' },
  experience:          { type: String, default: '' },
  relevantExperience:  { type: String, default: '' },
  qualification:       { type: String, default: '' },
  salaryBudget:        { type: String, default: '' },
  monthlySalary:       { type: String, default: '' },
  gender:              { type: String, enum: ['Any', 'Male', 'Female'], default: 'Any' },
  noticePeriod:        { type: String, default: '' },
  tatTime:             { type: Date },
  primaryRecruiter:    { type: String, default: '' },
  secondaryRecruiter:  { type: String, default: '' },
  skills:              { type: String, default: '' },
  jdLink:              { type: String, default: '' },
  active:              { type: Boolean, default: true },
  createdBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────
jobSchema.index({ tenantOwnerId: 1, jobCode: 1 });        // job code lookup scoped to tenant
jobSchema.index({ tenantOwnerId: 1, clientName: 1 });     // filter by client scoped to tenant
jobSchema.index({ tenantOwnerId: 1, position: 1 });       // filter by position scoped to tenant
jobSchema.index({ tenantOwnerId: 1, active: 1 });         // active jobs per tenant
jobSchema.index({ tenantOwnerId: 1, createdAt: -1 });     // newest jobs per tenant

const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
export default Job;
