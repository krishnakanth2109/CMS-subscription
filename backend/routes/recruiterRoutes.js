// --- START OF FILE recruiterRoutes.js ---
import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  getRecruiters,
  createRecruiter,
  updateRecruiter,
  deleteRecruiter,
  toggleRecruiterStatus,
  getUsersByRole,
} from '../controllers/recruiterController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Tenant helper (exported so controllers can reuse the same logic) ─────────
// For a Manager  → tenantOwnerId = their own _id  (they are the root)
// For Admin      → tenantOwnerId = their manager's _id
// For Recruiter  → tenantOwnerId = their manager's _id
export const getTenantOwnerId = (user) =>
  user.role === 'manager' ? user._id : user.tenantOwnerId;

router.use(protect);

// ── Static paths — must be BEFORE /:id ────────────────────────────────────────

// Own profile — any authenticated user
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);

// GET /by-role?role=recruiter  → only users in the SAME company
// GET /by-role?role=manager    → managers (scoped to tenant for DM recipient dropdown)
router.get('/by-role', getUsersByRole);

// ── Recruiter CRUD — admin / manager only ─────────────────────────────────────
// All controller functions must use getTenantOwnerId(req.user) internally
// to scope User.find / User.create to the correct tenant.

router.route('/')
  .get(getRecruiters)     // returns only recruiters under this tenant
  .post(createRecruiter); // creates recruiter + sets tenantOwnerId automatically

router.route('/:id')
  .put(updateRecruiter)
  .delete(deleteRecruiter);

router.patch('/:id/status', toggleRecruiterStatus);

export default router;