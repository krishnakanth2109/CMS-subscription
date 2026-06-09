// --- START OF FILE messageRoutes.js ---
import express from 'express';
import multer  from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary }  from 'cloudinary';
import Message from '../models/Message.js';
import User    from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Tenant helper ────────────────────────────────────────────────────────────
const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

// ─── Cloudinary config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key:    process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// ─── Cloudinary storage for chat attachments ─────────────────────────────────
const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
];

const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    const isImage = file.mimetype.startsWith('image/');
    return {
      folder:        'chat_attachments',
      resource_type: isImage ? 'image' : 'raw',
      // preserve original filename (sanitised)
      public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80)}`,
    };
  },
});

const chatUpload = multer({
  storage: chatStorage,
  limits:  { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED_MIME.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Unsupported file type')),
});

router.use(protect);

// ── POST /upload — Upload a chat attachment to Cloudinary ─────────────────────
router.post('/upload', chatUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const { originalname, mimetype, size, path: fileUrl, filename } = req.file;
  res.json({
    url:          fileUrl,                        // Cloudinary secure URL
    publicId:     req.file.public_id || filename, // Cloudinary public_id for deletion
    fileName:     originalname,
    fileType:     mimetype,
    fileSize:     size,
  });
});

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
      // optional attachment
      ...(req.body.attachment ? { attachment: req.body.attachment } : {}),
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

    // Delete Cloudinary asset if attachment exists
    if (existing.attachment?.publicId) {
      try {
        const isImage = existing.attachment.fileType?.startsWith('image/');
        await cloudinary.uploader.destroy(existing.attachment.publicId, {
          resource_type: isImage ? 'image' : 'raw',
        });
      } catch (cdnErr) {
        console.warn('[Chat] Cloudinary delete failed:', cdnErr.message);
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

// ── PUT /read/:partnerId — Mark all DM messages from partner as read ───────
router.put('/read/:partnerId', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const userId = req.user._id.toString();
    const partnerId = req.params.partnerId;

    await Message.updateMany(
      { tenantOwnerId, to: userId, from: partnerId, read: false },
      { $set: { read: true } }
    );
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
