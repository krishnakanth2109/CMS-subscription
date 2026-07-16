import mongoose from 'mongoose';

const matchScoreSchema = mongoose.Schema({
  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
    index: true,
  },
  requirementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true,
  },
  candidateUpdatedAt: { type: Date },
  requirementUpdatedAt: { type: Date },
  source: { type: String, default: 'fallback' },
  result: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  timestamps: true,
});

matchScoreSchema.index(
  { tenantOwnerId: 1, candidateId: 1, requirementId: 1 },
  { unique: true }
);

const MatchScore = mongoose.models.MatchScore || mongoose.model('MatchScore', matchScoreSchema);
export default MatchScore;
