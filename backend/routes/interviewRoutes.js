// --- START OF FILE interviewRoutes.js ---
import express from 'express';
import Interview from '../models/Interview.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Tenant helper ────────────────────────────────────────────────────────────
const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

router.use(protect);

// ── GET / — All interviews for this company ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const query = { tenantOwnerId };

    // Recruiters see only their own interviews
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }

    // Admin/Manager can filter by specific recruiter
    if (req.query.recruiterId && (req.user.role === 'admin' || req.user.role === 'manager')) {
      query.recruiterId = req.query.recruiterId;
    }

    // Optional status filter
    if (req.query.status) query.status = req.query.status;

    const interviews = await Interview.find(query)
      .populate('candidateId', 'firstName lastName name candidateId')
      .populate('recruiterId', 'firstName lastName email')
      .populate('jobId',       'jobCode position clientName')
      .sort({ interviewDate: 1 })
      .lean();

    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST / — Create interview ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const interview = await Interview.create({
      ...req.body,
      tenantOwnerId,
      recruiterId: req.body.recruiterId || req.user._id,
    });
    res.status(201).json(interview);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── PUT /:id — Update interview (tenant-scoped) ────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    // Verify ownership before allowing update
    const existing = await Interview.findOne({ _id: req.params.id, tenantOwnerId });
    if (!existing) return res.status(404).json({ message: 'Interview not found' });

    // Recruiters can only update their own interviews
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (existing.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    const updateData = { ...req.body };
    delete updateData.tenantOwnerId; // never allow tenant hop

    const updated = await Interview.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── DELETE /:id — Delete interview (tenant-scoped) ────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const existing = await Interview.findOne({ _id: req.params.id, tenantOwnerId });
    if (!existing) return res.status(404).json({ message: 'Interview not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (existing.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    await Interview.findByIdAndDelete(req.params.id);
    res.json({ message: 'Interview deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;