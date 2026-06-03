import mongoose from 'mongoose';

const candidateSubmissionSchema = mongoose.Schema({
  // Multi-Tenancy: Points to the Manager's _id
  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
    index: true,
  },

  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true,
  },

  clientName: {
    type: String,
    required: true,
  },

  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    index: true,
  },

  clientCandidateId: {
    type: String,
    index: true,
  },

  status: {
    type: String,
    enum: [
      'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
      'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
    ],
    default: 'Submitted'
  },

  remarks: {
    type: String,
    default: ''
  },

  dateAdded: {
    type: Date,
    default: () => new Date()
  }
}, {
  timestamps: true,
});

// Create indexes for efficient querying
candidateSubmissionSchema.index({ tenantOwnerId: 1, candidateId: 1 });
candidateSubmissionSchema.index({ tenantOwnerId: 1, clientId: 1 });
candidateSubmissionSchema.index({ tenantOwnerId: 1, jobId: 1 });
candidateSubmissionSchema.index({ tenantOwnerId: 1, status: 1 });

// Auto-generate clientCandidateId on creation if not provided
candidateSubmissionSchema.pre('save', async function (next) {
  if (!this.isNew || this.clientCandidateId) return next();

  try {
    const ClientModel = mongoose.model('Client');
    const clientDoc = await ClientModel.findOne({
      tenantOwnerId: this.tenantOwnerId,
      _id: this.clientId
    }).lean();

    if (clientDoc && clientDoc.companyCode) {
      const code = clientDoc.companyCode.toUpperCase();
      // Find the highest sequence for this specific company code within this tenant
      const lastSubmission = await this.constructor.findOne({
        tenantOwnerId: this.tenantOwnerId,
        clientCandidateId: { $regex: new RegExp(`^${code}`) }
      }).sort({ clientCandidateId: -1 }).lean();

      let nextNum = 1;
      if (lastSubmission && lastSubmission.clientCandidateId) {
        const numPart = lastSubmission.clientCandidateId.replace(code, '');
        const lastNum = parseInt(numPart, 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }

      this.clientCandidateId = `${code}${nextNum.toString().padStart(3, '0')}`;
    }
  } catch (err) {
    console.error('Client candidate ID generation error in submission:', err);
  }

  next();
});

const CandidateSubmission = mongoose.models.CandidateSubmission || mongoose.model('CandidateSubmission', candidateSubmissionSchema);
export default CandidateSubmission;
