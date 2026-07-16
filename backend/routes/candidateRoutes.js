import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Candidate from '../models/Candidate.js';
import CandidateSubmission from '../models/CandidateSubmission.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Client from '../models/Client.js';
import MatchScore from '../models/MatchScore.js';
import { parseResume } from './resumeParser.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  updateCandidateStatus,
  updateCandidateRemarks,
  inlineUpdateCandidate,
} from '../controllers/candidateStatusController.js';
import { bulkImportCandidates } from '../controllers/bulkImportController.js';
import { getMatchingJobsCountForCandidates, isJobMatchingCandidate } from '../services/matchingService.js';
import { scoreCandidateForJob } from '../services/geminiMatchService.js';

const router = express.Router();

const resolveUserName = (u) => {
  if (!u) return 'Unknown';
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.username || u.email || 'Unknown';
};

const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

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

router.use(protect);

// ─── Helper: sanitize FormData strings & parse customFields ───────────────────
const sanitizeBody = (body) => {
  const data = { ...body };
  if (typeof data.skills === 'string') {
    data.skills = data.skills.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (data.offersInHand       === 'true')  data.offersInHand       = true;
  if (data.offersInHand       === 'false') data.offersInHand       = false;
  if (data.servingNoticePeriod === 'true')  data.servingNoticePeriod = true;
  if (data.servingNoticePeriod === 'false') data.servingNoticePeriod = false;

  // Process dynamic customFields if passed via FormData (which turns objects to strings)
  if (typeof data.customFields === 'string') {
    try {
      data.customFields = JSON.parse(data.customFields);
    } catch (e) {
      data.customFields = {};
    }
  }

  return data;
};

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

router.get('/', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const query = { tenantOwnerId };

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }

    if (
      req.query.recruiterId &&
      (req.user.role === 'admin' || req.user.role === 'manager')
    ) {
      query.recruiterId = req.query.recruiterId;
    }

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

    const [candidates, submissions] = await Promise.all([
      Candidate.find(query)
        .populate('recruiterId', 'name firstName lastName email')
        .sort({ createdAt: -1 })
        .lean(),
      CandidateSubmission.find({ tenantOwnerId })
        .populate('jobId', 'position jobCode')
        .lean()
    ]);

    const submissionMap = {};
    submissions.forEach(sub => {
      const candId = sub.candidateId.toString();
      if (!submissionMap[candId]) {
        submissionMap[candId] = [];
      }
      submissionMap[candId].push(sub);
    });

    let candidatesWithSubmissions = candidates.map(c => ({
      ...c,
      submissions: submissionMap[c._id.toString()] || [],
      matchingJobsCount: 0
    }));

    if (candidatesWithSubmissions.length > 0) {
      const counts = await getMatchingJobsCountForCandidates(candidatesWithSubmissions, req.user);
      candidatesWithSubmissions.forEach((candidate) => {
        candidate.matchingJobsCount = counts[candidate._id.toString()] || 0;
      });
    }

    res.json(candidatesWithSubmissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

router.post('/', upload.single('resume'), async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    let candidateData = sanitizeBody(req.body);

    let submissionsPayload = [];
    if (candidateData.submissions) {
      try {
        submissionsPayload = typeof candidateData.submissions === 'string'
          ? JSON.parse(candidateData.submissions)
          : candidateData.submissions;
      } catch (_) {
        submissionsPayload = [];
      }
      delete candidateData.submissions;
    }

    if (req.file) {
      candidateData.resumeUrl          = `/uploads/${req.file.filename}`;
      candidateData.resumeOriginalName = req.file.originalname;
    }

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
    candidateData.tenantOwnerId = tenantOwnerId;

    if (!candidateData.candidatePrefix) {
      const manager = await User.findById(tenantOwnerId).select('candidatePrefix').lean();
      candidateData.candidatePrefix = manager?.candidatePrefix || 'CAND';
    }

    const newCandidate = new Candidate(candidateData);
    await newCandidate.save();

    // ── Create CandidateSubmission records for each client/job row ─────────────
    const submissionResults = [];
    const submissionErrors  = [];

    if (Array.isArray(submissionsPayload) && submissionsPayload.length > 0) {
      const seenJobIds = new Set();

      for (const sub of submissionsPayload) {
        if (!sub.jobId) {
          submissionErrors.push({ jobId: sub.jobId, error: 'jobId is required' });
          continue;
        }

        if (seenJobIds.has(String(sub.jobId))) {
          submissionErrors.push({ jobId: sub.jobId, error: 'Duplicate jobId in request — skipped' });
          continue;
        }
        seenJobIds.add(String(sub.jobId));

        try {
          const job = await Job.findById(sub.jobId).lean();
          if (!job) {
            submissionErrors.push({ jobId: sub.jobId, error: 'Job not found' });
            continue;
          }

          const clientDoc = await Client.findOne({ companyName: job.clientName, tenantOwnerId });
          const resolvedClientId = clientDoc?._id;
          if (!resolvedClientId) {
            submissionErrors.push({ jobId: sub.jobId, error: `Client with name ${job.clientName} not found` });
            continue;
          }

          const existing = await CandidateSubmission.findOne({
            tenantOwnerId,
            candidateId: newCandidate._id,
            jobId: sub.jobId,
          }).lean();

          if (existing) {
            submissionErrors.push({ jobId: sub.jobId, error: 'Candidate already submitted to this job.' });
            continue;
          }

          const created = await CandidateSubmission.create({
            candidateId:     newCandidate._id,
            tenantOwnerId,
            clientId:        resolvedClientId,
            clientName:      job.clientName,
            jobId:           sub.jobId,
            jobCode:         job.jobCode,
            position:        job.position,
            pipelineStage:   sub.pipelineStage || 'Pipeline',
            status:          sub.status || sub.pipelineStage || 'Pipeline',
            submittedBy:     req.user._id,
            submittedByName: resolveUserName(req.user),
            submittedAt:     new Date(),
          });

          submissionResults.push(created);
        } catch (subErr) {
          console.error('Submission creation error:', subErr);
          submissionErrors.push({ jobId: sub.jobId, error: subErr.message });
        }
      }
    }

    const responseData = {
      ...newCandidate.toObject(),
      submissions: submissionResults,
      submissionErrors: submissionErrors
    };

    res.status(201).json(responseData);
  } catch (error) {
    console.error('Create Candidate Error:', error);
    res.status(400).json({ message: error.message });
  }
});


// ─── Bulk Import (JSON body — no file upload) ─────────────────────────────────
router.post('/bulk-import', express.json({ limit: '10mb' }), bulkImportCandidates);

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

    const targetUser = await User.findOne({ _id: recruiterId, tenantOwnerId });
    if (!targetUser) {
      return res.status(404).json({ message: 'Target recruiter not found in your company' });
    }

    const recruiterName = resolveUserName(targetUser);

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
const processDetailedMatchingForCandidate = async (candidate, qualifyingJobs, reqUser) => {
  const results = [];
  const tenantOwnerId = candidate.recruiterId || reqUser?._id;

  for (const job of qualifyingJobs) {
    const jobId = job._id || job.id;

    // Check cache
    const cacheDoc = await MatchScore.findOne({
      tenantOwnerId,
      candidateId: candidate._id || candidate.id,
      requirementId: jobId
    }).lean();

    if (cacheDoc && cacheDoc.result) {
      const candidateUpdatedTime = new Date(candidate.updatedAt).getTime();
      const jobUpdatedTime = new Date(job.updatedAt).getTime();
      const cacheCandTime = cacheDoc.candidateUpdatedAt ? new Date(cacheDoc.candidateUpdatedAt).getTime() : 0;
      const cacheJobTime = cacheDoc.requirementUpdatedAt ? new Date(cacheDoc.requirementUpdatedAt).getTime() : 0;

      const cacheFresh = cacheCandTime === candidateUpdatedTime &&
                         cacheJobTime === jobUpdatedTime;

      if (cacheFresh) {
        results.push({
          job,
          ...cacheDoc.result,
          scoringSource: cacheDoc.source || 'gemini'
        });
        continue;
      }
    }

    // Score via Gemini (or fallback if Gemini fails)
    const scoreResult = await scoreCandidateForJob(candidate, job);
    
    // Save to cache
    await MatchScore.findOneAndUpdate(
      {
        tenantOwnerId,
        candidateId: candidate._id || candidate.id,
        requirementId: jobId
      },
      {
        tenantOwnerId,
        candidateId: candidate._id || candidate.id,
        requirementId: jobId,
        candidateUpdatedAt: candidate.updatedAt,
        requirementUpdatedAt: job.updatedAt,
        source: scoreResult.source || 'gemini',
        result: scoreResult
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    results.push({
      job,
      ...scoreResult,
      scoringSource: scoreResult.source || 'gemini'
    });
  }

  // Sort by matchPercentage descending
  results.sort((a, b) => {
    const scoreA = a.matchPercentage ?? 0;
    const scoreB = b.matchPercentage ?? 0;
    return scoreB - scoreA;
  });

  return results;
};

// ── GET matching jobs for a candidate (detailed scoring) ──────────────────────────
router.get('/:candidateId/matching-jobs', async (req, res) => {
  try {
    const { candidateId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      return res.status(400).json({ message: 'Invalid candidate ID' });
    }

    const candidate = await Candidate.findById(candidateId).lean();
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Access control
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const ownerIdStr = candidate.recruiterId?._id?.toString() || candidate.recruiterId?.toString();
      if (ownerIdStr !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this candidate' });
      }
    }

    // Fetch active accessible jobs
    const jobQuery = { active: true };
    if (req.user && req.user.role === 'recruiter') {
      const possibleNames = [
        (req.user.firstName && req.user.lastName) ? `${req.user.firstName} ${req.user.lastName}` : null,
        req.user.name, req.user.fullName, req.user.username, req.user.email
      ].filter(Boolean);

      jobQuery.$or = [
        { primaryRecruiter: { $in: possibleNames } },
        { secondaryRecruiter: { $in: possibleNames } }
      ];
    }
    const jobs = await Job.find(jobQuery).lean();

    // Filter qualifying jobs
    const qualifyingJobs = jobs.filter(job => isJobMatchingCandidate(candidate, job));

    if (qualifyingJobs.length === 0) {
      return res.json({
        success: true,
        candidateName: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
        jobs: []
      });
    }

    // Run detailed scoring
    const detailedMatches = await processDetailedMatchingForCandidate(candidate, qualifyingJobs, req.user);

    return res.json({
      success: true,
      candidateName: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
      jobs: detailedMatches
    });
  } catch (error) {
    console.error('Detailed candidate matching error:', error);
    res.status(500).json({ message: error.message || 'Failed to calculate matching jobs.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const candidate = await Candidate.findOne({
      _id: req.params.id,
      tenantOwnerId,
    }).populate('recruiterId', 'name firstName lastName email').lean();

    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      const ownerIdStr =
        candidate.recruiterId?._id?.toString() || candidate.recruiterId?.toString();
      if (ownerIdStr !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this candidate' });
      }
    }

    const submissions = await CandidateSubmission.find({
      candidateId: candidate._id,
      tenantOwnerId
    }).populate('jobId', 'jobCode position').lean();

    candidate.submissions = submissions || [];

    res.json(candidate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/status',        updateCandidateStatus);
router.put('/:id/remarks',       updateCandidateRemarks);
router.put('/:id/inline-update', inlineUpdateCandidate);

router.put('/:id', upload.single('resume'), async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    let updateData = sanitizeBody(req.body);

    delete updateData.dateAdded;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.tenantOwnerId;

    if (updateData.firstName || updateData.lastName) {
      updateData.name = `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim();
    }

    const existing = await Candidate.findOne({ _id: req.params.id, tenantOwnerId });
    if (!existing) return res.status(404).json({ message: 'Candidate not found' });

    if (updateData.status && JSON.stringify(updateData.status) !== JSON.stringify(existing.status)) {
      updateData.statusChangedAt = new Date();
    }

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (existing.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    if (req.file) {
      updateData.resumeUrl          = `/uploads/${req.file.filename}`;
      updateData.resumeOriginalName = req.file.originalname;
    }

    if ((req.user.role === 'admin' || req.user.role === 'manager') && updateData.recruiterId) {
      const assignedRecruiter = await User.findOne({
        _id: updateData.recruiterId,
        tenantOwnerId,
      });
      if (assignedRecruiter) {
        updateData.recruiterName = resolveUserName(assignedRecruiter);
      }
    }

    // $set will cleanly save the updated customFields object
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

router.delete('/:id', async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const candidate = await Candidate.findOne({ _id: req.params.id, tenantOwnerId });
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (candidate.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

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
