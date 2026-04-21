// --- START OF FILE Message.js ---
import mongoose from 'mongoose';

const messageSchema = mongoose.Schema({
  // ── Multi-Tenancy ─────────────────────────────────────────────────────────
  // Points to the Manager's _id (the tenant root).
  // Messages are fully scoped — cross-tenant reads are impossible at schema level.
  tenantOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // DM fields (kept for backward compat)
  from: { type: String },
  to:   { type: String },

  // Channel / group message fields
  channelId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
  senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  senderName:  { type: String, default: '' },

  subject: { type: String, default: '' },
  content: { type: String, required: true },
  type:    { type: String, enum: ['text', 'system', 'announcement'], default: 'text' },

  // Reply threading
  replyTo:      { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  replyPreview: { type: String, default: '' },

  // Read tracking — array of userIds who have read this
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Legacy DM support
  read:     { type: Boolean, default: false },
  fromName: { type: String },
  toName:   { type: String },

  edited:    { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

// ── Indexes ───────────────────────────────────────────────────────────────────
messageSchema.index({ tenantOwnerId: 1, channelId: 1, createdAt: -1 }); // channel messages scoped to tenant
messageSchema.index({ tenantOwnerId: 1, to: 1, createdAt: -1 });        // DMs to user, scoped to tenant
messageSchema.index({ tenantOwnerId: 1, from: 1, createdAt: -1 });      // DMs from user, scoped to tenant
messageSchema.index({ tenantOwnerId: 1, createdAt: -1 });                // recent messages per tenant

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
export default Message;
