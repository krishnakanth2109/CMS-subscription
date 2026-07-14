import express from 'express';
import {
  seedMaster,
  getAllManagers,
  updateManager,
  deleteManager,
  getMasterStats,
  getAdminsOverview,
  getAdminSummary,
  getAdminRecruiters,
  getAdminClients,
  getAdminJobs,
  getAdminCandidates,
  getCandidatesByRecruitersStats,
  getCandidatesByRecruiterId,
  getStatsAdmins,
  getStatsRecruiters,
  getStatsClients,
  getStatsJobs
} from '../controllers/masterController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly accessible but locks itself after first execution
router.post('/seed', seedMaster);

// Protected Routes - Only 'master' can access these
router.get('/managers', protect, authorize('master'), getAllManagers);
router.put('/managers/:id', protect, authorize('master'), updateManager);
router.delete('/managers/:id', protect, authorize('master'), deleteManager);

// Analytics and Drill-down details for Master Dashboard
router.get('/stats', protect, authorize('master'), getMasterStats);
router.get('/stats/candidates-by-recruiters', protect, authorize('master'), getCandidatesByRecruitersStats);
router.get('/stats/candidates-by-recruiters/:recruiterId', protect, authorize('master'), getCandidatesByRecruiterId);
router.get('/stats/admins', protect, authorize('master'), getStatsAdmins);
router.get('/stats/recruiters', protect, authorize('master'), getStatsRecruiters);
router.get('/stats/clients', protect, authorize('master'), getStatsClients);
router.get('/stats/jobs', protect, authorize('master'), getStatsJobs);

router.get('/admins/overview', protect, authorize('master'), getAdminsOverview);
router.get('/admins/:adminId/summary', protect, authorize('master'), getAdminSummary);
router.get('/admins/:adminId/recruiters', protect, authorize('master'), getAdminRecruiters);
router.get('/admins/:adminId/clients', protect, authorize('master'), getAdminClients);
router.get('/admins/:adminId/jobs', protect, authorize('master'), getAdminJobs);
router.get('/admins/:adminId/candidates', protect, authorize('master'), getAdminCandidates);

export default router;
