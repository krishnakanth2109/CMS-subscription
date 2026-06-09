import express from 'express';
import { scoreMatch, scoreMatchesForRequirement } from '../controllers/scoreMatch.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/bulk', protect, scoreMatchesForRequirement);
router.post('/', protect, scoreMatch);

export default router;
