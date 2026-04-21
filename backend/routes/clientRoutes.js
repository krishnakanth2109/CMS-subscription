// --- START OF FILE clientRoutes.js ---
import express from 'express';
import Client from '../models/Client.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Tenant helper ────────────────────────────────────────────────────────────
const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

router.use(protect);

// ── GET / — All clients for this company ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const clients = await Client.find({ tenantOwnerId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST / — Create client (auto-attach tenant) ────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    // Only managers and admins can create clients
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to create clients' });
    }

    const client = await Client.create({ ...req.body, tenantOwnerId });
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── PUT /:id — Update client (tenant-scoped) ──────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to update clients' });
    }

    // Never allow tenantOwnerId to be changed
    const updateData = { ...req.body };
    delete updateData.tenantOwnerId;

    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, tenantOwnerId },
      { $set: updateData },
      { new: true }
    );

    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── DELETE /:id — Delete client (tenant-scoped) ───────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to delete clients' });
    }

    const client = await Client.findOneAndDelete({ _id: req.params.id, tenantOwnerId });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    res.json({ message: 'Client deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;