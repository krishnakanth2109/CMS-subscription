import mongoose from 'mongoose';

const allowedCompanySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

const demoRequestSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    workEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    companySize: {
      type: String,
      required: true,
      enum: allowedCompanySizes,
    },
    designation: {
      type: String,
      default: '',
      trim: true,
    },
    preferredDemoTime: {
      type: Date,
      required: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    source: {
      type: String,
      default: 'CMS Demo Request',
      trim: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'scheduled', 'closed'],
      default: 'new',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

demoRequestSchema.index({ isRead: 1, createdAt: -1 });
demoRequestSchema.index({ status: 1, createdAt: -1 });
demoRequestSchema.index({ workEmail: 1, createdAt: -1 });
demoRequestSchema.index({ phoneNumber: 1, createdAt: -1 });

const DemoRequest = mongoose.models.DemoRequest || mongoose.model('DemoRequest', demoRequestSchema);

export default DemoRequest;
