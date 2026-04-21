// --- START OF FILE candidateRoutes.js ---
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Candidate from '../models/Candidate.js';
import User from '../models/User.js';
import { parseResume } from './resumeParser.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  updateCandidateStatus,
  updateCandidateRemarks,
  inlineUpdateCandidate,
} from '../controllers/candidateStatusController.js';

const router = express.Router();

// ─── Shared helper — resolve display name from a User doc ─────────────────────
const resolveUserName = (u) => {
  if (!u) return 'Unknown';
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.username || u.email || 'Unknown';
};

// ─── Tenant helper ────────────────────────────────────────────────────────────
// For a Manager  → tenantOwnerId = their own _id
// For Admin/Recruiter → tenantOwnerId = their manager's _id (stored on the user doc)
// This is injected into EVERY query so data is 100% company-scoped.
const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

// ─── Multer Setup ─────────────────────────────────────────────────────────────
const UPLOAD_DIR = 'uploads/';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Invalid file type. Only PDF and Docx allowed.'));
  },
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.use(protect);

// ─── Helper: sanitize FormData strings from Multer ────────────────────────────
const sanitizeBody = (body) => {
  const data = { ...body };
  if (typeof data.skills === 'string') {
    data.skills = data.skills.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (data.offersInHand       === 'true')  data.offersInHand       = true;
  if (data.offersInHand       === 'false') data.offersInHand       = false;
  if (data.servingNoticePeriod === 'true')  data.servingNoticePeriod = true;
  if (data.servingNoticePeriod === 'false') data.servingNoticePeriod = false;
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Static paths (/parse-resume, /check-email, etc.) MUST come before
//       parameterised paths (/:id) to avoid Express route conflicts.
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /parse-resume ────────────────────────────────────────────────────────
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No file uploaded' });

    const fileBuffer  = fs.readFileSync(req.file.path);
    const parsedResult = await parseResume(fileBuffer, req.file.mimetype);

    try { fs.unlinkSync(req.file.path); } catch (e) {
      console.error('Failed to delete temp file:', e);
    }

    if (parsedResult.success) {
      return res.json({
        success: true,
        data: {
          name:            parsedResult.data.name            || '',
          email:           parsedResult.data.email           || '',
          contact:         parsedResult.data.contact         || '',
          skills:          parsedResult.data.skills          || '',
          totalExperience: parsedResult.data.totalExperience || '',
          position:        parsedResult.data.position        || '',
        },
      });
    }
    res.json({ success: false, message: 'Could not parse resume', data: {} });
  } catch (error) {
    console.error('Resume parsing error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    res.status(500).json({ success: false, message: 'Error parsing resume', error: error.message });
  }
});

// ── GET / — All candidates (tenant-scoped) ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    // Base query — always scoped to this company
    const query = { tenantOwnerId };

    // Recruiters see only their own candidates
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }

    // Admin/Manager can optionally filter to a specific recruiter's candidates
    if (
      req.query.recruiterId &&
      (req.user.role === 'admin' || req.user.role === 'manager')
    ) {
      query.recruiterId = req.query.recruiterId;
    }

    // Date filtering — parsed as local date to avoid UTC midnight offset issues
    if (req.query.date) {
      const [yyyy, mm, dd] = req.query.date.split('-').map(Number);
      query.createdAt = {
        $gte: new Date(yyyy, mm - 1, dd, 0, 0, 0, 0),
        $lte: new Date(yyyy, mm - 1, dd, 23, 59, 59, 999),
      };
    } else if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      query.createdAt = {
        $gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
        $lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
      };
    }

    const candidates = await Candidate.find(query)
      .populate('recruiterId', 'name firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`[getCandidates] tenant:${tenantOwnerId} → ${candidates.length} records`);
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /check-email — Duplicate email check (tenant-scoped) ──────────────────
router.get('/check-email', async (req, res) => {
  try {
    const { email, excludeId } = req.query;
    if (!email) return res.json({ exists: false });

    const query = {
      tenantOwnerId: getTenantOwnerId(req.user),
      email: email.trim().toLowerCase(),
    };
    if (excludeId) query._id = { $ne: excludeId };

    const existing = await Candidate.findOne(query).select('_id name candidateId').lean();
    if (existing) {
      const id = existing.candidateId || existing._id.toString().slice(-6).toUpperCase();
      return res.json({ exists: true, candidateId: id, name: existing.name || '' });
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /check-phone — Duplicate phone check (tenant-scoped) ──────────────────
router.get('/check-phone', async (req, res) => {
  try {
    const { phone, excludeId } = req.query;
    if (!phone) return res.json({ exists: false });

    const digits = phone.trim().replace(/\D/g, '').replace(/^91/, '').slice(-10);
    if (digits.length !== 10) return res.json({ exists: false });

    const query = {
      tenantOwnerId: getTenantOwnerId(req.user),
      contact: digits,
    };
    if (excludeId) query._id = { $ne: excludeId };

    const existing = await Candidate.findOne(query).select('_id name candidateId').lean();
    if (existing) {
      const id = existing.candidateId || existing._id.toString().slice(-6).toUpperCase();
      return res.json({ exists: true, candidateId: id, name: existing.name || '' });
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST / — Create Candidate ─────────────────────────────────────────────────
router.post('/', upload.single('resume'), async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    let candidateData = sanitizeBody(req.body);

    // Attach resume file info if uploaded
    if (req.file) {
      candidateData.resumeUrl          = `/uploads/${req.file.filename}`;
      candidateData.resumeOriginalName = req.file.originalname;
    }

    // Resolve recruiter
    let targetRecruiterId   = req.user._id;
    let targetRecruiterName = resolveUserName(req.user);

    if (
      (req.user.role === 'admin' || req.user.role === 'manager') &&
      candidateData.recruiterId
    ) {
      const assignedRecruiter = await User.findById(candidateData.recruiterId);
      if (assignedRecruiter) {
        targetRecruiterId   = assignedRecruiter._id;
        targetRecruiterName = resolveUserName(assignedRecruiter);
      }
    }

    candidateData.recruiterId   = targetRecruiterId;
    candidateData.recruiterName = targetRecruiterName;

    // Attach tenant — scope this candidate to the company
    candidateData.tenantOwnerId = tenantOwnerId;

    // candidatePrefix: use tenant-level prefix if set on the Manager's user doc,
    // or whatever was passed in the body, or fall back to 'CAND'.
    // Priority: body.candidatePrefix > tenant manager's prefix > 'CAND'
    if (!candidateData.candidatePrefix) {
      // Try to load the manager's configured prefix
      const manager = await User.findById(tenantOwnerId).select('candidatePrefix').lean();
      candidateData.candidatePrefix = manager?.candidatePrefix || 'CAND';
    }

    const newCandidate = new Candidate(candidateData);
    await newCandidate.save();
    res.status(201).json(newCandidate);
  } catch (error) {
    console.error('Create Candidate Error:', error);
    res.status(400).json({ message: error.message });
  }
});

// ── PUT /bulk-assign — Bulk reassign candidates (tenant-scoped) ───────────────
// MUST be defined BEFORE /:id to prevent Express treating "bulk-assign" as an id
router.put('/bulk-assign', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Not authorized to bulk assign candidates' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    const { candidateIds, recruiterId } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ message: 'Please provide at least one candidate ID' });
    }
    if (!recruiterId) {
      return res.status(400).json({ message: 'Please provide a recruiter/user ID to assign to' });
    }

    // Ensure target recruiter belongs to the same tenant
    const targetUser = await User.findOne({ _id: recruiterId, tenantOwnerId });
    if (!targetUser) {
      return res.status(404).json({ message: 'Target recruiter not found in your company' });
    }

    const recruiterName = resolveUserName(targetUser);

    // Only update candidates that belong to this tenant
    const result = await Candidate.updateMany(
      { _id: { $in: candidateIds }, tenantOwnerId },
      { $set: { recruiterId: targetUser._id, recruiterName } }
    );

    res.json({
      message:       `Successfully assigned ${result.modifiedCount} candidate(s) to ${recruiterName}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ── GET /:id — Single candidate (tenant-scoped) ───────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const candidate = await Candidate.findOne({
      _id: req.params.id,
      tenantOwnerId,
    }).populate('recruiterId', 'name firstName lastName email');

    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    // Recruiters can only view their own candidates
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const ownerIdStr =
        candidate.recruiterId?._id?.toString() || candidate.recruiterId?.toString();
      if (ownerIdStr !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this candidate' });
      }
    }

    res.json(candidate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Specialised sub-routes — must come BEFORE generic PUT /:id ────────────────
router.put('/:id/status',        updateCandidateStatus);
router.put('/:id/remarks',       updateCandidateRemarks);
router.put('/:id/inline-update', inlineUpdateCandidate);

// ── PUT /:id — Update Candidate (tenant-scoped) ───────────────────────────────
router.put('/:id', upload.single('resume'), async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    let updateData = sanitizeBody(req.body);

    // Never overwrite immutable / system timestamps
    delete updateData.dateAdded;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    // Never allow tenantOwnerId to be changed via an update
    delete updateData.tenantOwnerId;

    // Rebuild name if name parts changed (findByIdAndUpdate bypasses pre-save hooks)
    if (updateData.firstName || updateData.lastName) {
      updateData.name = `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim();
    }

    // Verify candidate exists and belongs to this tenant
    const existing = await Candidate.findOne({ _id: req.params.id, tenantOwnerId });
    if (!existing) return res.status(404).json({ message: 'Candidate not found' });

    // Recruiters can only edit their own candidates
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (existing.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    if (req.file) {
      updateData.resumeUrl          = `/uploads/${req.file.filename}`;
      updateData.resumeOriginalName = req.file.originalname;
    }

    // Sync recruiterName if recruiter is reassigned
    if ((req.user.role === 'admin' || req.user.role === 'manager') && updateData.recruiterId) {
      const assignedRecruiter = await User.findOne({
        _id: updateData.recruiterId,
        tenantOwnerId,
      });
      if (assignedRecruiter) {
        updateData.recruiterName = resolveUserName(assignedRecruiter);
      }
    }

    const updatedCandidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    res.json(updatedCandidate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ── DELETE /:id — Delete Candidate (tenant-scoped) ────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const candidate = await Candidate.findOne({ _id: req.params.id, tenantOwnerId });
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    // Recruiters can only delete their own candidates
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (candidate.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    // Clean up resume file from disk if present
    if (candidate.resumeUrl) {
      const filePath = path.join(process.cwd(), candidate.resumeUrl);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {
          console.error('File delete error:', e);
        }
      }
    }

    await Candidate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Candidate deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;