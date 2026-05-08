
import mongoose from 'mongoose';

const candidateSchema = mongoose.Schema({
  candidateId: { type: String, unique: true, sparse: true },
  clientCandidateId: { type: String }, // New field for Client Code based ID (e.g., INF001)

  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

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

  position:           { type: String, default: '' },
  client:             { type: String, default: '' },
  currentCompany:     { type: String },
  industry:           { type: String },
  totalExperience:    { type: String },
  relevantExperience: { type: String },
  reasonForChange:    { type: String },
  education:          { type: String },
  skills:             { type: [String] },

  ctc:              { type: String },
  currentTakeHome:  { type: String },
  ectc:             { type: String },
  expectedTakeHome: { type: String },

  noticePeriod:        { type: String },
  servingNoticePeriod: { type: Boolean, default: false },
  lwd:                 { type: Date },
  offersInHand:        { type: Boolean, default: false },
  offerPackage:        { type: String },

  source:        { type: String, default: 'Portal' },
  recruiterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recruiterName: { type: String },
  remarks:       { type: String },
  notes:         { type: String },
  rating:        { type: Number, default: 0 },

  status: {
    type: [String],
    enum: [
      'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
      'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
    ],
    default: ['Submitted']
  },

  // ── Dynamic Tenant Fields ───────────────────────────────────────────────────
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },

  active:             { type: Boolean, default: true },
  dateAdded:          { type: Date, default: () => new Date(), immutable: true },
  resumeUrl:          { type: String },
  resumeOriginalName: { type: String },
}, {
  timestamps: true,
});

candidateSchema.index({ tenantOwnerId: 1, recruiterId: 1, createdAt: -1 });
candidateSchema.index({ tenantOwnerId: 1, createdAt: -1 });
candidateSchema.index({ tenantOwnerId: 1, status: 1 });
candidateSchema.index({ tenantOwnerId: 1, email: 1 });
candidateSchema.index({ tenantOwnerId: 1, contact: 1 });
candidateSchema.index({ candidateId: 1 });

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

let isCounterSynced = false;

candidateSchema.pre('save', async function (next) {
  if (this.firstName || this.lastName) {
    this.name = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }

  if (!this.isNew || this.candidateId) return next();

  try {
    if (!isCounterSynced) {
      const highestCandidate = await this.constructor
        .findOne({ candidateId: { $regex: /^CAND-/ } }, { candidateId: 1 })
        .sort({ candidateId: -1 });

      let maxSeq = 0;
      if (highestCandidate?.candidateId) {
        const match = highestCandidate.candidateId.match(/^[A-Z]+-0*(\d+)$/);
        if (match) maxSeq = parseInt(match[1], 10);
      }

      await Counter.findOneAndUpdate(
        { _id: 'candidate' },
        { $set: { seq: maxSeq } },
        { upsert: true, new: true }
      );
      isCounterSynced = true;
    }

    const counter = await Counter.findOneAndUpdate(
      { _id: 'candidate' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    this.candidateId = `CAND-${counter.seq.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Candidate ID generation error:', error);
  }

  // ── Client-Specific ID Generation (e.g., INF001) ──────────────────────────
  try {
    if (this.client && (this.isNew || this.isModified('client'))) {
      const ClientModel = mongoose.model('Client');
      const clientDoc = await ClientModel.findOne({
        tenantOwnerId: this.tenantOwnerId,
        companyName: this.client
      }).lean();

      if (clientDoc && clientDoc.companyCode) {
        const code = clientDoc.companyCode.toUpperCase();
        // Find the highest sequence for this specific company code within this tenant
        const lastCandidate = await this.constructor.findOne({
          tenantOwnerId: this.tenantOwnerId,
          clientCandidateId: { $regex: new RegExp(`^${code}`) }
        }).sort({ clientCandidateId: -1 }).lean();

        let nextNum = 1;
        if (lastCandidate && lastCandidate.clientCandidateId) {
          const numPart = lastCandidate.clientCandidateId.replace(code, '');
          const lastNum = parseInt(numPart, 10);
          if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }

        this.clientCandidateId = `${code}${nextNum.toString().padStart(3, '0')}`;
      }
    }
  } catch (err) {
    console.error('Client candidate ID generation error:', err);
  }

  next();
});

const Candidate = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema);
export default Candidate;