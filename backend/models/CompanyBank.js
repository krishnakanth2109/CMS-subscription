import mongoose from 'mongoose';

const companyBankSchema = new mongoose.Schema({
  label: { type: String, required: true }, // e.g., "ICICI Main", "HDFC Current"
  accountNumber: { type: String, required: true },
  name: { type: String, required: true }, // Name on Account
  bank: { type: String, required: true }, // Bank Name
  branch: { type: String, required: true },
  ifsc: { type: String, required: true },
  pan: { type: String },
  gst: { type: String },
  isDefault: { type: Boolean, default: false },
}, {
  timestamps: true,
});

const CompanyBank = mongoose.models.CompanyBank || mongoose.model('CompanyBank', companyBankSchema);
export default CompanyBank;
