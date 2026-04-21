import express from 'express';
import { seedMaster, getAllManagers, updateManager } from '../controllers/masterController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly accessible but locks itself after first execution
router.post('/seed', seedMaster);

// Protected Routes - Only 'master' can access these
router.get('/managers', protect, authorize('master'), getAllManagers);
router.put('/managers/:id', protect, authorize('master'), updateManager);

export default router;