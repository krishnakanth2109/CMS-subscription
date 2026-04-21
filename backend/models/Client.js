// --- START OF FILE Client.js ---
import mongoose from 'mongoose';

const clientSchema = mongoose.Schema({
  clientId: { type: String, unique: true },

  // ── Multi-Tenancy ─────────────────────────────────────────────────────────
  // Points to the Manager's _id (the tenant root).
  // Every query MUST filter by this field to isolate company data.
  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  companyName:     { type: String, required: true },
  contactPerson:   { type: String },
  email:           { type: String },
  phone:           { type: String },
  website:         { type: String },
  address:         { type: String },
  clientLocation:  { type: String },
  industry:        { type: String },
  gstNumber:       { type: String },
  notes:           { type: String },
  percentage:      { type: String }, // Commission %
  candidatePeriod: { type: String },
  replacementPeriod: { type: String },
  lockingPeriod:   { type: String },
  paymentMode:     { type: String },
  terms:           { type: String },
  active:          { type: Boolean, default: true },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────
clientSchema.index({ tenantOwnerId: 1, companyName: 1 }); // search by company name scoped to tenant
clientSchema.index({ tenantOwnerId: 1, active: 1 });       // active filter scoped to tenant
clientSchema.index({ tenantOwnerId: 1, industry: 1 });     // industry filter scoped to tenant
clientSchema.index({ tenantOwnerId: 1, createdAt: -1 });   // default sort newest first per tenant

const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);
export default Client;
