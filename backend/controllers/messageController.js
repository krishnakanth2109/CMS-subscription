// --- START OF FILE messageController.js ---
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';

// Batch-resolve display names for from/to values within the same tenant
const batchResolveNames = async (values, tenantOwnerId) => {
  const unique    = [...new Set(values.filter(Boolean))];
  const objectIds = unique.filter(v => /^[a-f\d]{24}$/i.test(v));

  const tenantFilter = tenantOwnerId
    ? { _id: { $in: objectIds }, $or: [{ tenantOwnerId }, { _id: tenantOwnerId }] }
    : { _id: { $in: objectIds } };

  const users = objectIds.length
    ? await User.find(tenantFilter).select('_id firstName lastName username').lean()
    : [];

  const userMap = {};
  users.forEach(u => {
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ');
    userMap[String(u._id)] = full || u.username || 'User';
  });

  return (v) => {
    if (!v)          return 'Unknown';
    if (v === 'admin') return 'Admin';
    if (v === 'all')   return 'Everyone';
    return userMap[v] || v;
  };
};

// @desc   Get messages for a user (tenant-scoped)
// @route  GET /api/messages
export const getMessages = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { role, _id } = req.user;
    const id = _id.toString();

    // Base tenant filter
    const tenantFilter = tenantOwnerId ? { tenantOwnerId } : {};

    let recipientFilter;
    if (role === 'admin' || role === 'manager') {
      recipientFilter = {
        $or: [
          { to: id },
          { to: 'admin' },
          { to: 'all' },
          { from: id },
          { from: 'admin' },
        ],
      };
    } else {
      recipientFilter = {
        $or: [
          { to: id },
          { to: req.user.username },
          { to: 'all' },
          { from: id },
          { from: req.user.username },
        ],
      };
    }

    const messages = await Message.find({ ...tenantFilter, ...recipientFilter })
      .sort({ createdAt: -1 })
      .lean();

    const allValues = messages.flatMap(m => [m.from, m.to]);
    const resolve   = await batchResolveNames(allValues, tenantOwnerId);

    const enhanced = messages.map(msg => ({
      ...msg,
      fromName: resolve(msg.from),
      toName:   resolve(msg.to),
    }));

    res.json(enhanced);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Send a message (tenant-scoped)
// @route  POST /api/messages
export const sendMessage = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { to, subject, content } = req.body;
    const { role, _id } = req.user;

    const from = role === 'admin' || role === 'manager' ? 'admin' : _id.toString();

    const message = await Message.create({
      tenantOwnerId,
      from,
      to,
      subject,
      content,
      senderId:   _id,
      senderName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
    });

    const resolve = await batchResolveNames([from, to], tenantOwnerId);
    res.status(201).json({ ...message.toObject(), fromName: resolve(from), toName: resolve(to) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc   Update a message (mark read, edit content) — tenant-scoped
// @route  PUT /api/messages/:id
export const updateMessage = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const message = await Message.findOne({ _id: req.params.id, tenantOwnerId });
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const isAdmin     = req.user.role === 'admin' || req.user.role === 'manager';
    const idStr       = req.user._id.toString();
    const isSender    = message.from === idStr || (isAdmin && message.from === 'admin');
    const isRecipient =
      message.to === idStr ||
      message.to === req.user.username ||
      (isAdmin && (message.to === 'admin' || message.to === 'all'));

    if (!isAdmin && !isSender && !isRecipient) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (typeof req.body.read === 'boolean' && isRecipient) {
      message.read = req.body.read;
    }
    if (isSender || isAdmin) {
      if (req.body.subject !== undefined) message.subject = req.body.subject || message.subject;
      if (req.body.content !== undefined) message.content = req.body.content || message.content;
    }

    const updated = await message.save();
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc   Delete a message (tenant-scoped, soft or hard)
// @route  DELETE /api/messages/:id
export const deleteMessage = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const message = await Message.findOne({ _id: req.params.id, tenantOwnerId });
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const isAdmin  = req.user.role === 'admin' || req.user.role === 'manager';
    const isSender = message.from === req.user._id.toString();

    if (!isAdmin && !isSender) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Soft delete — keeps the record but hides it from UI
    const deleted = await Message.findByIdAndUpdate(
      req.params.id,
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    res.json({ message: 'Message removed', id: req.params.id, data: deleted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};