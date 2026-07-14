import mongoose from 'mongoose';

const candidateQRSessionSchema = new mongoose.Schema({
  // Unique session token embedded in the QR URL
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Which master admin (or manager) created this QR
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Optional label / title for the session
  label: {
    type: String,
    default: 'Candidate Registration',
    trim: true,
  },

  // Whether the QR is still accepting responses
  active: {
    type: Boolean,
    default: true,
  },

  // Expiry date (optional — null = never expires)
  expiresAt: {
    type: Date,
    default: null,
  },

  // Candidate submissions collected via this QR
  submissions: [
    {
      // Personal
      firstName:         { type: String, required: true, trim: true },
      lastName:          { type: String, trim: true },
      email:             { type: String, required: true, trim: true, lowercase: true },
      contact:           { type: String, required: true, trim: true },
      alternateNumber:   { type: String, trim: true },
      dateOfBirth:       { type: String },
      gender:            { type: String, enum: ['Male', 'Female', 'Other', ''] },
      currentLocation:   { type: String, trim: true },
      preferredLocation: { type: String, trim: true },
      linkedin:          { type: String, trim: true },

      // Professional
      position:           { type: String, trim: true },
      currentCompany:     { type: String, trim: true },
      totalExperience:    { type: String, trim: true },
      relevantExperience: { type: String, trim: true },
      education:          { type: String, trim: true },
      skills:             { type: String, trim: true }, // comma-separated

      // Compensation
      ctc:              { type: String, trim: true },
      ectc:             { type: String, trim: true },
      noticePeriod:     { type: String, trim: true },

      // Meta
      source:      { type: String, default: 'QR' },
      submittedAt: { type: Date, default: Date.now },
      ipAddress:   { type: String },
    },
  ],
}, { timestamps: true });

const CandidateQRSession =
  mongoose.models.CandidateQRSession ||
  mongoose.model('CandidateQRSession', candidateQRSessionSchema);

export default CandidateQRSession;
