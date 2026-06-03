import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createSubmission,
  getSubmissions,
  updateSubmissionStatus,
  deleteSubmission
} from '../controllers/submissionController.js';

const router = express.Router();

// Apply auth protection middleware to all submission routes
router.use(protect);

router.post('/', createSubmission);
router.get('/', getSubmissions);
router.put('/:id', updateSubmissionStatus);
router.delete('/:id', deleteSubmission);

export default router;
