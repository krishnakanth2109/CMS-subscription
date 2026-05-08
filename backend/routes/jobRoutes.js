// --- START OF FILE jobRoutes.js ---
import express from 'express';
import Job from '../models/Job.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Tenant helper ────────────────────────────────────────────────────────────
const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

router.use(protect);

// ── GET / — All jobs for this company ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const query = { tenantOwnerId };

    // Optional active filter: ?active=true / ?active=false
    if (req.query.active !== undefined) {
      query.active = req.query.active === 'true';
    }

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .lean();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST / — Create job ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to create jobs' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    //  const job = await Job.create({
    //   ...req.body,
    //   tenantOwnerId,
    //   createdBy: req.user._id,
    // });
    const jobData = { ...req.body, createdBy: req.user._id, tenantOwnerId };

    if (!jobData.tatTime || jobData.tatTime === '') jobData.tatTime = null;

    // Auto-increment jobCode scoped to THIS tenant
    const allJobs = await Job.find(
      { tenantOwnerId, jobCode: { $regex: /^REQ\d+$/ } },
      { jobCode: 1 }
    ).lean();

    let maxNum = 0;
    if (allJobs.length > 0) {
      const nums = allJobs.map(j => {
        const m = j.jobCode.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      });
      maxNum = Math.max(...nums);
    }
    jobData.jobCode = `REQ${String(maxNum + 1).padStart(4, '0')}`;

    const job = await Job.create(jobData);
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── PUT /:id — Update job (tenant-scoped) ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to update jobs' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    const updateData = { ...req.body };
    if (updateData.tatTime === '') updateData.tatTime = null;
    delete updateData.tenantOwnerId; // never allow tenant hop

    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, tenantOwnerId },
      { $set: updateData },
      { new: true }
    );

    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── DELETE /:id — Delete job (tenant-scoped) ───────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to delete jobs' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    const job = await Job.findOneAndDelete({ _id: req.params.id, tenantOwnerId });
    if (!job) return res.status(404).json({ message: 'Job not found' });

    res.json({ message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;