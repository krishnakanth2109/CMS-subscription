// routes/candidateQRRoutes.js
import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  createQRSession,
  getDefaultQRSession,
  getQRSessions,
  getQRSessionDetails,
  toggleQRSession,
  deleteQRSession,
  validateQRToken,
  submitCandidateForm,
  deleteSubmission,
} from '../controllers/candidateQRController.js';

const router = express.Router();

// ── PUBLIC routes (no auth required) ─────────────────────────────────────────
// Candidate scans QR → validate token & get label
router.get('/public/:token', validateQRToken);

// Candidate submits the form
router.post('/public/:token/submit', submitCandidateForm);

// ── PROTECTED routes (master or admin) ───────────────────────────────────────
router.use(protect, authorize('master', 'admin', 'manager'));

// Get or create default session
router.get('/default', getDefaultQRSession);

// Create a new QR session
router.post('/', createQRSession);

// Get all sessions created by this user
router.get('/', getQRSessions);

// Get a single session with all submissions
router.get('/:id', getQRSessionDetails);

// Toggle active status
router.patch('/:id/toggle', toggleQRSession);

// Delete a session
router.delete('/:id', deleteQRSession);

// Delete a single submission
router.delete('/:id/submissions/:submissionId', deleteSubmission);

export default router;
