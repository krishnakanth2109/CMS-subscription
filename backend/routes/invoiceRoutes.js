import express from 'express';
import multer from 'multer';
import { createInvoice, getInvoices, getInvoiceById, deleteInvoice, updateInvoice } from '../controllers/invoiceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Protect all routes
router.use(protect);

router.post('/', upload.single('file'), createInvoice);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.put('/:id', upload.single('file'), updateInvoice);
router.delete('/:id', deleteInvoice);

export default router;
