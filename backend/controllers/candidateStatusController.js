// --- START OF FILE candidateStatusController.js ---
import Candidate from '../models/Candidate.js';
import { sendDecisionEmail } from '../services/email.js';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';

const VALID_STATUSES = [
  'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups', 'No Show',
  'Selected', 'Joined', 'Rejected', 'Hold', 'Backout',
];

const isValidStatus = (s) =>
  VALID_STATUSES.includes(s) || /^L[1-5]\s*-\s*(SELECT|REJECT|HOLD)$/.test(s);

// Helper: send decision email silently (non-blocking)
const maybeSendDecisionEmail = (candidate, status) => {
  if (status !== 'Selected' && status !== 'Rejected') return;
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || candidate.name;
  sendDecisionEmail({ email: candidate.email, name, decision: status })
    .then(() => console.log(`[Email] Decision email sent: ${status}`))
    .catch((err) => console.error('[Email] Decision email failed:', err.message));
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Update candidate status
// @route  PUT /api/candidates/:id/status
// ─────────────────────────────────────────────────────────────────────────────
export const updateCandidateStatus = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { status, level, outcome } = req.body;

    const candidate = await Candidate.findOne({ _id: req.params.id, tenantOwnerId });
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (candidate.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this candidate' });
      }
    }

    const newStatus = level && outcome ? `${level} - ${outcome}` : status;
    if (!isValidStatus(newStatus)) {
      return res.status(400).json({ message: 'Invalid status format' });
    }

    const updated = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: { status: newStatus, updatedBy: req.user._id } },
      { new: true, runValidators: false }
    );

    res.json({ message: 'Candidate status updated successfully', candidate: updated });
    maybeSendDecisionEmail(updated, newStatus);
  } catch (error) {
    console.error('Status update error:', error);
    res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Update candidate remarks
// @route  PUT /api/candidates/:id/remarks
// ─────────────────────────────────────────────────────────────────────────────
export const updateCandidateRemarks = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { remarks } = req.body;

    const candidate = await Candidate.findOne({ _id: req.params.id, tenantOwnerId });
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (candidate.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this candidate' });
      }
    }

    const updated = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: { remarks: remarks || '', updatedBy: req.user._id } },
      { new: true }
    );

    res.json({ message: 'Candidate remarks updated successfully', candidate: updated });
  } catch (error) {
    console.error('Remarks update error:', error);
    res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Update status and remarks together (inline edit)
// @route  PUT /api/candidates/:id/inline-update
// ─────────────────────────────────────────────────────────────────────────────
export const inlineUpdateCandidate = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { status, remarks, level, outcome } = req.body;

    const candidate = await Candidate.findOne({ _id: req.params.id, tenantOwnerId });
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      if (candidate.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this candidate' });
      }
    }

    const updateData = { updatedBy: req.user._id };

    if (status) {
      updateData.status = status;
    } else if (level && outcome) {
      updateData.status = `${level} - ${outcome}`;
    }

    if (remarks !== undefined) updateData.remarks = remarks;

    const updated = await Candidate.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: false }
    );

    res.json({ message: 'Candidate updated successfully', candidate: updated });
    if (updateData.status) maybeSendDecisionEmail(updated, updateData.status);
  } catch (error) {
    console.error('Inline update error:', error);
    res.status(400).json({ message: error.message });
  }
};