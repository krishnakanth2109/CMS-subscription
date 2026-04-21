// --- START OF FILE messageRoutes.js ---
import express from 'express';
import Message from '../models/Message.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Tenant helper ────────────────────────────────────────────────────────────
const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

router.use(protect);

// ── GET / — Messages (tenant-scoped, channel or DM) ───────────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const query = { tenantOwnerId };

    // Filter by channel
    if (req.query.channelId) query.channelId = req.query.channelId;

    // Filter by DM recipient
    if (req.query.to) query.to = req.query.to;

    const messages = await Message.find(query)
      .populate('senderId', 'firstName lastName profilePicture')
      .populate('replyTo',  'content senderName')
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST / — Send message ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const message = await Message.create({
      ...req.body,
      tenantOwnerId,
      senderId:   req.user._id,
      senderName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
    });
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── PUT /:id — Edit message (tenant-scoped, sender only) ──────────────────────
router.put('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const existing = await Message.findOne({ _id: req.params.id, tenantOwnerId });
    if (!existing) return res.status(404).json({ message: 'Message not found' });

    // Only the original sender (or admin/manager) can edit
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const senderStr = existing.senderId?.toString();
      if (senderStr !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to edit this message' });
      }
    }

    const updated = await Message.findByIdAndUpdate(
      req.params.id,
      { $set: { content: req.body.content, edited: true } },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── DELETE /:id — Soft-delete message (tenant-scoped) ─────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const existing = await Message.findOne({ _id: req.params.id, tenantOwnerId });
    if (!existing) return res.status(404).json({ message: 'Message not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const senderStr = existing.senderId?.toString();
      if (senderStr !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this message' });
      }
    }

    // Soft delete — preserve the record but mark as deleted
    const deleted = await Message.findByIdAndUpdate(
      req.params.id,
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    res.json({ message: 'Message deleted', data: deleted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;