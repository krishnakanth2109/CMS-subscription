import express from 'express';
import multer from 'multer';
import { getJobs, createJob, updateJob, deleteJob, generateJobDescription } from '../controllers/jobController.js';
import { protect } from '../middleware/authMiddleware.js';
import Job from '../models/Job.js';
import { extractTextFromFile } from '../services/documents.js';

const router = express.Router();
const uploadJD = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const cleanExtractedJDText = (text = '') => (
  String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
);

// ── PUBLIC ─────────────────────────────────────────────────────────────────────
// GET /api/jobs/public  — Fetch active jobs for the public-facing frontend website
router.get('/public', async (req, res) => {
  try {
    const jobs = await Job.find({ active: true })
      .select('jobCode position clientName location experience skills noticePeriod')
      .sort({ createdAt: -1 })
      .lean();

    // Map internal field names to what the frontend expects
    const mapped = jobs.map(job => ({
      _id:        job._id,
      title:      job.position,
      company:    job.clientName,
      location:   job.location,
      experience: job.experience,
      skills:     job.skills ? job.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      noticePeriod: job.noticePeriod,
      jobCode:    job.jobCode,
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── PROTECTED ──────────────────────────────────────────────────────────────────
router.use(protect);
router.post('/generate-jd', generateJobDescription);
router.post('/import-jd', (req, res) => {
  uploadJD.single('file')(req, res, async (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size must be less than 5MB.' });
    }
    if (error) {
      return res.status(400).json({ message: error.message || 'Unable to upload file.' });
    }

    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: 'Please upload a file.' });

      const lowerName = String(file.originalname || '').toLowerCase();
      const isPdf = file.mimetype === 'application/pdf' || lowerName.endsWith('.pdf');
      const isDocx = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerName.endsWith('.docx');
      if (!isPdf && !isDocx) {
        return res.status(400).json({ message: 'Please upload a valid PDF or DOCX file.' });
      }

      const extracted = await extractTextFromFile(file.buffer, file.originalname);
      const text = cleanExtractedJDText(extracted);
      if (!text) {
        return res.status(400).json({ message: 'No readable text found in this file.' });
      }

      return res.json({ text });
    } catch (err) {
      return res.status(500).json({ message: err.message || 'Failed to extract job description text.' });
    }
  });
});

router.route('/').get(getJobs).post(createJob);
router.route('/:id').put(updateJob).delete(deleteJob);

export default router;
