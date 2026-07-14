// routes/clientQRRoutes.js
import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  createClientQRSession,
  getDefaultClientQRSession,
  getClientQRSessions,
  getClientQRSessionDetails,
  toggleClientQRSession,
  deleteClientQRSession,
  validateClientQRToken,
  submitClientForm,
  deleteClientSubmission,
} from '../controllers/clientQRController.js';

const router = express.Router();

// ── PUBLIC routes (no auth required) ─────────────────────────────────────────
router.get('/public/:token', validateClientQRToken);
router.post('/public/:token/submit', submitClientForm);

// ── PROTECTED routes (master or admin) ───────────────────────────────────────
router.use(protect, authorize('master', 'admin', 'manager'));

// Get or create default session
router.get('/default', getDefaultClientQRSession);

router.post('/', createClientQRSession);
router.get('/', getClientQRSessions);
router.get('/:id', getClientQRSessionDetails);
router.patch('/:id/toggle', toggleClientQRSession);
router.delete('/:id', deleteClientQRSession);
router.delete('/:id/submissions/:submissionId', deleteClientSubmission);

export default router;
