// --- START OF FILE jobRoutes.js ---
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Job from '../models/Job.js';
import CandidateSubmission from '../models/CandidateSubmission.js';
import { protect } from '../middleware/authMiddleware.js';
import { extractTextFromFile } from '../services/documents.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const allowed = name.endsWith('.pdf') || name.endsWith('.docx');
    if (!allowed) return cb(new Error('Only PDF and DOCX files are supported'));
    cb(null, true);
  },
});

// ─── Tenant helper ────────────────────────────────────────────────────────────
const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

router.use(protect);

const cleanJobDescriptionText = (text = '') => String(text)
  .replace(/\r\n?/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/[ \t]*\n[ \t]*/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .split('\n')
  .map(line => line.trim())
  .join('\n')
  .trim();

router.post('/import-jd', (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    if (uploadError) {
      const isSizeError = uploadError.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({
        message: isSizeError ? 'File is too large. Please upload a file up to 5 MB.' : uploadError.message,
      });
    }

    try {
      if (!req.file) return res.status(400).json({ message: 'Please upload a PDF or DOCX file.' });

      const text = cleanJobDescriptionText(
        await extractTextFromFile(req.file.buffer, req.file.originalname)
      );

      if (!text) return res.status(400).json({ message: 'No readable text was found in this document.' });

      res.json({ text });
    } catch (error) {
      res.status(400).json({ message: error.message || 'Unable to import Job Description.' });
    }
  });
});

// ── GET / — All jobs for this company ─────────────────────────────────────────
router.get('/candidate-counts', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const tenantObjectId = new mongoose.Types.ObjectId(String(tenantOwnerId));
    const counts = await CandidateSubmission.aggregate([
      { $match: { tenantOwnerId: tenantObjectId, jobId: { $ne: null } } },
      { $group: { _id: '$jobId', count: { $sum: 1 } } },
    ]);

    res.json(counts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {}));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/candidates', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const submissions = await CandidateSubmission.find({
      tenantOwnerId,
      jobId: req.params.id,
    })
      .populate('candidateId', 'candidateId firstName lastName name email contact recruiterName status')
      .sort({ createdAt: -1 })
      .lean();

    res.json(submissions.map(sub => ({
      id: sub._id,
      status: sub.status,
      dateAdded: sub.dateAdded || sub.createdAt,
      candidate: sub.candidateId,
    })).filter(item => item.candidate));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const query = { tenantOwnerId };

    // Auto-inactivate expired requirements for this tenant.
    // Rule: Current Date > Expiry Date (jobs expiring today remain active).
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    await Job.updateMany(
      {
        tenantOwnerId,
        active: true,
        tatTime: { $ne: null, $lt: todayStart },
      },
      { $set: { active: false } }
    );

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
