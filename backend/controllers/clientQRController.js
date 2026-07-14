// controllers/clientQRController.js
import { v4 as uuidv4 } from 'uuid';
import ClientQRSession from '../models/ClientQRSession.js';

// ─── MASTER / ADMIN: Create a new QR session ──────────────────────────────────
export const createClientQRSession = async (req, res) => {
  try {
    const { label, expiresAt } = req.body;
    const token = uuidv4();

    const session = await ClientQRSession.create({
      token,
      createdBy: req.user._id,
      label: label || 'Client / Company Registration',
      active: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error('createClientQRSession error:', err);
    res.status(500).json({ message: 'Failed to create QR session.' });
  }
};

// ─── MASTER / ADMIN: Get or create the default QR session ──────────────────────
export const getDefaultClientQRSession = async (req, res) => {
  try {
    let session = await ClientQRSession.findOne({
      createdBy: req.user._id,
      label: 'Default Client QR',
    });

    if (!session) {
      const token = uuidv4();
      session = await ClientQRSession.create({
        token,
        createdBy: req.user._id,
        label: 'Default Client QR',
        active: true,
        expiresAt: null,
      });
      console.log(`[Client QR Self-Heal] Created default Client QR session with token: ${token}`);
    }

    if (session && session.submissions) {
      session.submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    }

    res.json({ success: true, session });
  } catch (err) {
    console.error('getDefaultClientQRSession error:', err);
    res.status(500).json({ message: 'Failed to retrieve/create default Client QR session.' });
  }
};

// ─── MASTER / ADMIN: Get all sessions created by this user ────────────────────
export const getClientQRSessions = async (req, res) => {
  try {
    const raw = await ClientQRSession.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    const sessions = raw.map((s) => ({
      ...s,
      submissionCount: s.submissions?.length ?? 0,
      submissions: undefined,
    }));

    res.json({ success: true, sessions });
  } catch (err) {
    console.error('getClientQRSessions error:', err);
    res.status(500).json({ message: 'Failed to fetch QR sessions.' });
  }
};

// ─── MASTER / ADMIN: Get a single session with all submissions ─────────────────
export const getClientQRSessionDetails = async (req, res) => {
  try {
    const session = await ClientQRSession.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!session) return res.status(404).json({ message: 'Session not found.' });

    res.json({ success: true, session });
  } catch (err) {
    console.error('getClientQRSessionDetails error:', err);
    res.status(500).json({ message: 'Failed to fetch session.' });
  }
};

// ─── MASTER / ADMIN: Toggle active / deactivate ───────────────────────────────
export const toggleClientQRSession = async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const current = await ClientQRSession.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    }).select('active');

    if (!current) return res.status(404).json({ message: 'Session not found.' });

    const newActive = !(current.active !== false);

    const updated = await ClientQRSession.findByIdAndUpdate(
      req.params.id,
      { $set: { active: newActive } },
      { new: true, select: 'active' }
    );

    console.log(`[Client QR Toggle] id=${req.params.id} active: ${current.active} → ${updated.active}`);

    res.json({ success: true, active: updated.active });
  } catch (err) {
    console.error('toggleClientQRSession error:', err);
    res.status(500).json({ message: 'Failed to update session.' });
  }
};

// ─── MASTER / ADMIN: Delete a session ─────────────────────────────────────────
export const deleteClientQRSession = async (req, res) => {
  try {
    await ClientQRSession.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id,
    });
    res.json({ success: true, message: 'Session deleted.' });
  } catch (err) {
    console.error('deleteClientQRSession error:', err);
    res.status(500).json({ message: 'Failed to delete session.' });
  }
};

// ─── PUBLIC: Validate a QR token ──────────────────────────────────────────────
export const validateClientQRToken = async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');

  try {
    const { token } = req.params;
    const session = await ClientQRSession.findOne({ token })
      .select('label active expiresAt');

    if (!session) return res.status(404).json({ message: 'Invalid QR code.' });

    // console.log(`[Client QR Validate] token=${token.slice(0, 8)}… active=${session.active} expires=${session.expiresAt}`);

    if (session.active === false) {
      return res.status(410).json({ message: 'This QR code has been deactivated.' });
    }

    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
      return res.status(410).json({ message: 'This QR code has expired.' });
    }

    res.json({ success: true, label: session.label || 'Client / Company Registration' });
  } catch (err) {
    console.error('validateClientQRToken error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── PUBLIC: Submit client/company form ───────────────────────────────────────
export const submitClientForm = async (req, res) => {
  try {
    const { token } = req.params;
    const session = await ClientQRSession.findOne({ token });

    if (!session) return res.status(404).json({ message: 'Invalid QR code.' });

    if (session.active === false) {
      return res.status(410).json({ message: 'This QR code has been deactivated.' });
    }

    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
      return res.status(410).json({ message: 'This QR code has expired.' });
    }

    const {
      companyName, industry, website, companySize, address, city, state, country, gstNumber,
      contactPerson, designation, email, phone, alternatePhone, linkedin,
      hiringFor, hiringVolume, urgency, budgetRange, preferredEngagement, notes,
    } = req.body;

    if (!companyName || !email || !phone) {
      return res.status(400).json({ message: 'Company name, email, and phone are required.' });
    }

    // Prevent duplicate submissions from the same client for the same requirement
    /*
    console.log('[Duplicate Check] incoming token:', token);
    console.log('[Duplicate Check] incoming details:', { companyName, email, hiringFor });
    console.log('[Duplicate Check] existing count:', session.submissions.length);
    
    session.submissions.forEach((sub, i) => {
      console.log(`[Duplicate Check] Sub #${i} in DB:`, { companyName: sub.companyName, email: sub.email, hiringFor: sub.hiringFor });
      console.log(`  - name match: "${sub.companyName}" === "${companyName}" ->`, String(sub.companyName || '').trim().toLowerCase() === String(companyName || '').trim().toLowerCase());
      console.log(`  - email match: "${sub.email}" === "${email}" ->`, String(sub.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase());
      console.log(`  - hiringFor match: "${sub.hiringFor}" === "${hiringFor}" ->`, String(sub.hiringFor || '').trim().toLowerCase() === String(hiringFor || '').trim().toLowerCase());
    });
    */

    const duplicate = session.submissions.some(
      (sub) =>
        String(sub.companyName || '').trim().toLowerCase() === String(companyName || '').trim().toLowerCase() &&
        String(sub.email || '').trim().toLowerCase() === String(email || '').trim().toLowerCase() &&
        String(sub.hiringFor || '').trim().toLowerCase() === String(hiringFor || '').trim().toLowerCase()
    );
    // console.log('[Duplicate Check] Final result:', duplicate);

    if (duplicate) {
      return res.status(400).json({
        message: 'A submission from your company for this specific hiring requirement has already been received.'
      });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    session.submissions.push({
      companyName, industry, website, companySize, address, city, state, country, gstNumber,
      contactPerson, designation, email, phone, alternatePhone, linkedin,
      hiringFor, hiringVolume, urgency, budgetRange, preferredEngagement, notes,
      source: 'QR',
      submittedAt: new Date(),
      ipAddress,
    });

    await session.save();

    res.json({ success: true, message: 'Your company details have been submitted successfully!' });
  } catch (err) {
    console.error('submitClientForm error:', err);
    res.status(500).json({ message: 'Failed to submit form.' });
  }
};

// ─── MASTER / ADMIN: Delete a specific submission ─────────────────────────────
export const deleteClientSubmission = async (req, res) => {
  try {
    const { id, submissionId } = req.params;

    const session = await ClientQRSession.findOne({
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
    console.error('deleteClientSubmission error:', err);
    res.status(500).json({ message: 'Failed to delete submission.' });
  }
};
