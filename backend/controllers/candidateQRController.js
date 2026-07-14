// controllers/candidateQRController.js
import { v4 as uuidv4 } from 'uuid';
import CandidateQRSession from '../models/CandidateQRSession.js';

// ─── MASTER / ADMIN: Create a new QR session ─────────────────────────────────
export const createQRSession = async (req, res) => {
  try {
    const { label, expiresAt } = req.body;
    const token = uuidv4();

    const session = await CandidateQRSession.create({
      token,
      createdBy: req.user._id,
      label: label || 'Candidate Registration',
      active: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error('createQRSession error:', err);
    res.status(500).json({ message: 'Failed to create QR session.' });
  }
};

// ─── MASTER / ADMIN: Get or create the default QR session ──────────────────────
export const getDefaultQRSession = async (req, res) => {
  try {
    let session = await CandidateQRSession.findOne({
      createdBy: req.user._id,
      label: 'Default Candidate QR',
    });

    if (!session) {
      const token = uuidv4();
      session = await CandidateQRSession.create({
        token,
        createdBy: req.user._id,
        label: 'Default Candidate QR',
        active: true,
        expiresAt: null,
      });
      console.log(`[QR Self-Heal] Created default Candidate QR session with token: ${token}`);
    }

    if (session && session.submissions) {
      session.submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    }

    res.json({ success: true, session });
  } catch (err) {
    console.error('getDefaultQRSession error:', err);
    res.status(500).json({ message: 'Failed to retrieve/create default Candidate QR session.' });
  }
};

// ─── MASTER / ADMIN: Get all QR sessions created by this user ─────────────────
export const getQRSessions = async (req, res) => {
  try {
    const raw = await CandidateQRSession.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    // Attach submission count without sending all submission data
    const sessions = raw.map((s) => ({
      ...s,
      submissionCount: s.submissions?.length ?? 0,
      submissions: undefined,  // strip from response
    }));

    res.json({ success: true, sessions });
  } catch (err) {
    console.error('getQRSessions error:', err);
    res.status(500).json({ message: 'Failed to fetch QR sessions.' });
  }
};

// ─── MASTER / ADMIN: Get a single session with all submissions ────────────────
export const getQRSessionDetails = async (req, res) => {
  try {
    const session = await CandidateQRSession.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!session) return res.status(404).json({ message: 'Session not found.' });

    res.json({ success: true, session });
  } catch (err) {
    console.error('getQRSessionDetails error:', err);
    res.status(500).json({ message: 'Failed to fetch session.' });
  }
};

// ─── MASTER / ADMIN: Toggle active / deactivate a session ─────────────────
export const toggleQRSession = async (req, res) => {
  try {
    // First read the current value
    const current = await CandidateQRSession.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    }).select('active');

    if (!current) return res.status(404).json({ message: 'Session not found.' });

    // Determine new state: treat undefined/null as true (default active)
    const newActive = !(current.active !== false);

    // Use $set for a guaranteed atomic write — no .save() race conditions
    const updated = await CandidateQRSession.findByIdAndUpdate(
      req.params.id,
      { $set: { active: newActive } },
      { new: true, select: 'active' }
    );

    console.log(`[QR Toggle] id=${req.params.id} active: ${current.active} → ${updated.active}`);

    res.json({ success: true, active: updated.active });
  } catch (err) {
    console.error('toggleQRSession error:', err);
    res.status(500).json({ message: 'Failed to update session.' });
  }
};

// ─── MASTER / ADMIN: Delete a session ─────────────────────────────────────────
export const deleteQRSession = async (req, res) => {
  try {
    await CandidateQRSession.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id,
    });
    res.json({ success: true, message: 'Session deleted.' });
  } catch (err) {
    console.error('deleteQRSession error:', err);
    res.status(500).json({ message: 'Failed to delete session.' });
  }
};

// ─── PUBLIC: Validate a QR token (so the form page can show label) ────────────
export const validateQRToken = async (req, res) => {
  // Never let the browser or CDN cache this response —
  // the QR can be toggled on/off at any time by the admin
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');

  try {
    const { token } = req.params;
    const session = await CandidateQRSession.findOne({ token })
      .select('label active expiresAt');

    if (!session) return res.status(404).json({ message: 'Invalid QR code.' });

    // console.log(`[QR Validate] token=${token.slice(0,8)}… active=${session.active} expires=${session.expiresAt}`);

    // ⚠️  Explicitly check for false — undefined/null means field missing → treat as active
    if (session.active === false) {
      return res.status(410).json({ message: 'This QR code has been deactivated.' });
    }

    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
      return res.status(410).json({ message: 'This QR code has expired.' });
    }

    res.json({ success: true, label: session.label || 'Candidate Registration' });
  } catch (err) {
    console.error('validateQRToken error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── PUBLIC: Submit candidate form via QR ─────────────────────────────────────
export const submitCandidateForm = async (req, res) => {
  try {
    const { token } = req.params;
    const session = await CandidateQRSession.findOne({ token });

    if (!session) return res.status(404).json({ message: 'Invalid QR code.' });

    // ⚠️  Explicitly check for false — undefined/null means field missing → treat as active
    if (session.active === false) {
      return res.status(410).json({ message: 'This QR code has been deactivated.' });
    }

    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
      return res.status(410).json({ message: 'This QR code has expired.' });
    }

    const {
      firstName, lastName, email, contact, alternateNumber,
      dateOfBirth, gender, currentLocation, preferredLocation, linkedin,
      position, currentCompany, totalExperience, relevantExperience,
      education, skills, ctc, ectc, noticePeriod,
    } = req.body;

    if (!firstName || !email || !contact) {
      return res.status(400).json({ message: 'First name, email, and contact are required.' });
    }

    // Prevent duplicate registrations from the same candidate (email or contact)
    const duplicate = session.submissions.some(
      (sub) =>
        String(sub.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase() ||
        String(sub.contact || '').trim().replace(/[\s\-\(\)\+]/g, '') === String(contact || '').trim().replace(/[\s\-\(\)\+]/g, '')
    );

    if (duplicate) {
      return res.status(400).json({
        message: 'You have already submitted your registration using this QR code.'
      });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    session.submissions.push({
      firstName, lastName, email, contact, alternateNumber,
      dateOfBirth, gender, currentLocation, preferredLocation, linkedin,
      position, currentCompany, totalExperience, relevantExperience,
      education, skills, ctc, ectc, noticePeriod,
      source: 'QR',
      submittedAt: new Date(),
      ipAddress,
    });

    await session.save();

    res.json({ success: true, message: 'Your details have been submitted successfully!' });
  } catch (err) {
    console.error('submitCandidateForm error:', err);
    res.status(500).json({ message: 'Failed to submit form.' });
  }
};

// ─── MASTER / ADMIN: Delete a specific submission ─────────────────────────────
export const deleteSubmission = async (req, res) => {
  try {
    const { id, submissionId } = req.params;

    const session = await CandidateQRSession.findOne({
      _id: id,
      createdBy: req.user._id,
    });

    if (!session) return res.status(404).json({ message: 'Session not found.' });

    session.submissions = session.submissions.filter(
      (s) => s._id.toString() !== submissionId
    );
    await session.save();

    res.json({ success: true, message: 'Submission deleted.' });
  } catch (err) {
    console.error('deleteSubmission error:', err);
    res.status(500).json({ message: 'Failed to delete submission.' });
  }
};
