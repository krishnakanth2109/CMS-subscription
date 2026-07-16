import express from 'express';
import {
  getCompanyBanks,
  createCompanyBank,
  updateCompanyBank,
  deleteCompanyBank,
} from '../controllers/companyBankController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

router.get('/', getCompanyBanks);
router.post('/', createCompanyBank);
router.put('/:id', updateCompanyBank);
router.delete('/:id', deleteCompanyBank);

export default router;
