import express from 'express';
import {
  createDemoRequest,
  getDemoRequests,
  getUnreadDemoRequestCount,
  markDemoRequestAsRead,
  updateDemoRequestStatus,
} from '../controllers/demoRequestController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', createDemoRequest);
router.get('/', protect, authorize('master'), getDemoRequests);
router.get('/unread-count', protect, authorize('master'), getUnreadDemoRequestCount);
router.patch('/:id/read', protect, authorize('master'), markDemoRequestAsRead);
router.patch('/:id/status', protect, authorize('master'), updateDemoRequestStatus);

export default router;
