// --- START OF FILE Candidate.js ---
import mongoose from 'mongoose';

const candidateSchema = mongoose.Schema({
  candidateId: { type: String, unique: true, sparse: true },

  // ── Multi-Tenancy ─────────────────────────────────────────────────────────
  // Points to the Manager's _id (User.tenantOwnerId root).
  // Every query MUST filter by this field to isolate company data.
  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // --- Personal Info ---
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  name:      { type: String },

  email:             { type: String, required: true },
  contact:           { type: String, required: true },
  alternateNumber:   { type: String },
  currentLocation:   { type: String },
  preferredLocation: { type: String },
  dateOfBirth:       { type: Date },
  gender:            { type: String },
  linkedin:          { type: String },

  // --- Professional Info ---
  position:           { type: String, default: '' },
  client:             { type: String, default: '' },
  currentCompany:     { type: String },
  industry:           { type: String },
  totalExperience:    { type: String },
  relevantExperience: { type: String },
  reasonForChange:    { type: String },
  education:          { type: String },
  skills:             { type: [String] },

  // --- Financial ---
  ctc:              { type: String },
  currentTakeHome:  { type: String },
  ectc:             { type: String },
  expectedTakeHome: { type: String },

  // --- Availability & Offers ---
  noticePeriod:        { type: String },
  servingNoticePeriod: { type: Boolean, default: false },
  lwd:                 { type: Date },
  offersInHand:        { type: Boolean, default: false },
  offerPackage:        { type: String },

  // --- Recruitment ---
  source:        { type: String, default: 'Portal' },
  recruiterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recruiterName: { type: String },
  remarks:       { type: String },
  notes:         { type: String },
  rating:        { type: Number, default: 0 },

  // --- Status ---
  status: {
    type: [String],
    enum: [
      'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
      'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
    ],
    default: ['Submitted']
  },

  // --- System ---
  active:             { type: Boolean, default: true },
  dateAdded:          { type: Date, default: () => new Date(), immutable: true },
  resumeUrl:          { type: String },
  resumeOriginalName: { type: String },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────
// tenantOwnerId is the PRIMARY discriminator — always the first field in compound indexes
candidateSchema.index({ tenantOwnerId: 1, recruiterId: 1, createdAt: -1 }); // recruiter list scoped to tenant
candidateSchema.index({ tenantOwnerId: 1, createdAt: -1 });                  // admin all-candidates for tenant
candidateSchema.index({ tenantOwnerId: 1, status: 1 });                      // status filter scoped to tenant
candidateSchema.index({ tenantOwnerId: 1, email: 1 });                       // duplicate email check within tenant
candidateSchema.index({ tenantOwnerId: 1, contact: 1 });                     // duplicate phone check within tenant
candidateSchema.index({ candidateId: 1 });                                    // global ID lookup

// ── Counter Schema (stored in 'counters' collection) ─────────────────────────
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// Sync flag — reset once per server startup
let isCounterSynced = false;

candidateSchema.pre('save', async function (next) {
  // Always sync name from firstName + lastName
  if (this.firstName || this.lastName) {
    this.name = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  // Only auto-generate candidateId for brand-new records without one
  if (!this.isNew || this.candidateId) return next();

  try {
    // 1. Auto-healing: sync counter with the highest existing CAND- ID
    if (!isCounterSynced) {
      const highestCandidate = await this.constructor
        .findOne({ candidateId: { $regex: /^CAND-/ } }, { candidateId: 1 })
        .sort({ candidateId: -1 });

      let maxSeq = 0;
      if (highestCandidate?.candidateId) {
        const match = highestCandidate.candidateId.match(/^CAND-0*(\d+)$/);
        if (match) maxSeq = parseInt(match[1], 10);
      }

      await Counter.findOneAndUpdate(
        { _id: 'candidate' },
        { $set: { seq: maxSeq } },
        { upsert: true, new: true }
      );

      isCounterSynced = true;
    }

    // 2. Atomic increment — race-condition-proof
    const counter = await Counter.findOneAndUpdate(
      { _id: 'candidate' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    this.candidateId = `CAND-${counter.seq.toString().padStart(7, '0')}`;
    next();
  } catch (error) {
    console.error('Error generating Candidate ID:', error);
    next(error);
  }
});

const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
export default Candidate;