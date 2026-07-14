import mongoose from 'mongoose';

const clientQRSessionSchema = new mongoose.Schema({
  // Unique session token embedded in the QR URL
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Which master admin created this QR
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Optional label / title for the session
  label: {
    type: String,
    default: 'Client / Company Registration',
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

  // Client / Company submissions collected via this QR
  submissions: [
    {
      // Company info
      companyName:   { type: String, required: true, trim: true },
      industry:      { type: String, trim: true },
      website:       { type: String, trim: true },
      companySize:   { type: String, trim: true },
      address:       { type: String, trim: true },
      city:          { type: String, trim: true },
      state:         { type: String, trim: true },
      country:       { type: String, trim: true },
      gstNumber:     { type: String, trim: true },

      // Contact person
      contactPerson: { type: String, trim: true },
      designation:   { type: String, trim: true },
      email:         { type: String, required: true, trim: true, lowercase: true },
      phone:         { type: String, required: true, trim: true },
      alternatePhone:{ type: String, trim: true },
      linkedin:      { type: String, trim: true },

      // Hiring requirements
      hiringFor:         { type: String, trim: true },  // roles they want to hire
      hiringVolume:      { type: String, trim: true },  // how many positions
      urgency:           { type: String, trim: true },  // Immediate / 1 Month / etc.
      budgetRange:       { type: String, trim: true },
      preferredEngagement: { type: String, trim: true }, // Contract / Permanent / Both

      // Additional
      notes:       { type: String, trim: true },
      source:      { type: String, default: 'QR' },
      submittedAt: { type: Date, default: Date.now },
      ipAddress:   { type: String },
    },
  ],
}, { timestamps: true });

const ClientQRSession =
  mongoose.models.ClientQRSession ||
  mongoose.model('ClientQRSession', clientQRSessionSchema);

export default ClientQRSession;
