// --- START OF FILE messageRoutes.js ---
import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
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
    const userId = req.user._id.toString();
    let query = { tenantOwnerId };

    if (req.query.channelId) {
      // ── Channel messages ───────────────────────────────────────────────────
      query.channelId = req.query.channelId;
    } else {
      // ── DM messages — always exclude channel messages ──────────────────────
      query.channelId = null;

      if (req.query.to) {
        // Load a specific DM thread (both directions)
        query.$or = [
          { from: userId,          to: req.query.to },
          { from: req.query.to,    to: userId       },
        ];
      } else {
        // Load all DMs involving current user (for sidebar / initial load)
        query.$or = [
          { from: userId },
          { to:   userId },
        ];
      }
    }

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

    const senderName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
    let toName = '';
    
    if (req.body.to) {
      const toUser = await User.findById(req.body.to).select('firstName lastName email');
      if (toUser) {
        toName = `${toUser.firstName || ''} ${toUser.lastName || ''}`.trim() || toUser.email;
      }
    }

    const message = await Message.create({
      ...req.body,
      tenantOwnerId,
      senderId:   req.user._id,
      senderName: senderName,
      from:       req.user._id.toString(),
      fromName:   senderName,
      ...(toName && { toName }),
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
