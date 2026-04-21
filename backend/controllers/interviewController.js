// --- START OF FILE interviewController.js ---
import Interview from '../models/Interview.js';
import Candidate from '../models/Candidate.js';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';

// @desc   Get interviews for this tenant
// @route  GET /api/interviews
export const getInterviews = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const query = { tenantOwnerId };

    // Recruiters see only their own
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }

    const interviews = await Interview.find(query)
      .populate('candidateId', 'name firstName lastName email contact position')
      .populate('recruiterId', 'name firstName lastName email')
      .sort({ interviewDate: 1 })
      .lean();

    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Schedule a new interview
// @route  POST /api/interviews
export const createInterview = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const {
      candidateId, interviewDate, interviewTime, type, location,
      duration, notes, priority, round, meetingLink,
    } = req.body;

    // Verify candidate belongs to this tenant before scheduling
    const candidate = await Candidate.findOne({ _id: candidateId, tenantOwnerId });
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found in your company' });
    }

    const dateTime = new Date(`${interviewDate}T${interviewTime}`);

    const interview = await Interview.create({
      tenantOwnerId,
      candidateId,
      recruiterId:   req.user._id,
      interviewDate: dateTime,
      duration:      parseInt(duration) || 60,
      type,
      location,
      meetingLink,
      notes,
      priority,
      round,
    });

    // Sync candidate status to the interview round
    await Candidate.findByIdAndUpdate(candidateId, { status: round });

    res.status(201).json(interview);
  } catch (error) {
    console.error('Create Interview Error:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc   Update interview details (tenant-scoped)
// @route  PUT /api/interviews/:id
export const updateInterview = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { status, round, interviewDate, interviewTime, meetingLink, notes } = req.body;

    const interview = await Interview.findOne({ _id: req.params.id, tenantOwnerId });
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    if (status)                       interview.status      = status;
    if (round)                        interview.round       = round;
    if (meetingLink !== undefined)    interview.meetingLink = meetingLink;
    if (notes       !== undefined)    interview.notes       = notes;

    if (interviewDate && interviewTime) {
      interview.interviewDate = new Date(`${interviewDate}T${interviewTime}`);
    } else if (interviewDate) {
      const datePart = new Date(interviewDate);
      const current  = new Date(interview.interviewDate);
      datePart.setHours(current.getHours(), current.getMinutes(), current.getSeconds());
      interview.interviewDate = datePart;
    }

    await interview.save();

    // Sync candidate status
    if (status || round) {
      const candidateStatus = status && status !== 'Scheduled' ? status : round;
      await Candidate.findByIdAndUpdate(interview.candidateId, { status: candidateStatus });
    }

    res.json(interview);
  } catch (error) {
    console.error('Update Interview Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc   Delete interview (tenant-scoped)
// @route  DELETE /api/interviews/:id
export const deleteInterview = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const interview = await Interview.findOne({ _id: req.params.id, tenantOwnerId });
    if (!interview) return res.status(404).json({ message: 'Interview not found' });

    await interview.deleteOne();
    res.json({ message: 'Interview removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};