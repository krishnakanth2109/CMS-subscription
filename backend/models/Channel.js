// --- START OF FILE Channel.js ---
import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  type:        { type: String, enum: ['public', 'private', 'announcement'], default: 'public' },
  icon:        { type: String, default: '' },
  color:       { type: String, default: 'blue' },

  // ── Multi-Tenancy ─────────────────────────────────────────────────────────
  // Points to the Manager's _id (the tenant root).
  // Channels are fully scoped — users from other tenants never see these.
  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Members must all belong to the same tenant
  members:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Only admins/managers can post in announcement channels
  canPost:   { type: String, enum: ['all', 'admin_manager'], default: 'all' },

  lastMessageAt: { type: Date, default: null },
  lastMessage:   { type: String, default: '' },

  pinned: { type: Boolean, default: false },
}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
channelSchema.index({ tenantOwnerId: 1, members: 1 });           // member's channels scoped to tenant
channelSchema.index({ tenantOwnerId: 1, createdBy: 1 });         // channels created by user, scoped to tenant
channelSchema.index({ tenantOwnerId: 1, lastMessageAt: -1 });    // recent activity per tenant

const Channel = mongoose.models.Channel || mongoose.model('Channel', channelSchema);
export default Channel;
