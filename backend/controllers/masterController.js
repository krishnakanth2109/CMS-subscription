import User from '../models/User.js';
import { admin } from '../middleware/authMiddleware.js';
import Client from '../models/Client.js';
import Job from '../models/Job.js';
import Candidate from '../models/Candidate.js';
import CandidateSubmission from '../models/CandidateSubmission.js';
import MatchScore from '../models/MatchScore.js';

// @desc    Seed Master Admin Account (Run once securely)
// @route   POST /api/master/seed
// @access  Public (But blocks if master already exists)
export const seedMaster = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // 1. Check if ANY master exists in DB to prevent duplicate seeding
    const existingMaster = await User.findOne({ role: 'master' });
    if (existingMaster) {
      return res.status(403).json({ message: 'Master account already exists. Seeding blocked.' });
    }

    // 2. Safely create or fetch Firebase User
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(email);
      // If user exists in Firebase but not Mongo, update password
      await admin.auth().updateUser(firebaseUser.uid, { password, displayName: name });
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        firebaseUser = await admin.auth().createUser({ email, password, displayName: name });
      } else {
        throw err;
      }
    }

    // 3. Create Master in MongoDB
    const master = await User.create({
      firebaseUid: firebaseUser.uid,
      email,
      firstName: name.split(' ')[0],
      lastName: name.split(' ')[1] || '',
      role: 'master',
      active: true,
    });

    res.status(201).json({
      message: 'Master Admin seeded successfully.',
      master: { _id: master._id, email: master.email }
    });

  } catch (error) {
    console.error('Master Seeding Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all Managers for the Master Dashboard
// @route   GET /api/master/managers
// @access  Private (Master only)
export const getAllManagers = async (req, res) => {
  try {
    // Find all users who own a company
    const managers = await User.find({ role: 'manager' })
      .select('-password -firebaseUid')
      .sort({ createdAt: -1 });

    res.json(managers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching managers.' });
  }
};

// @desc    Update a Manager's Subscription Plan or Status
// @route   PUT /api/master/managers/:id
// @access  Private (Master only)
export const updateManager = async (req, res) => {
  try {
    const { subscriptionPlan, active } = req.body;
    
    const manager = await User.findById(req.params.id);
    if (!manager) return res.status(404).json({ message: 'Manager not found.' });
    if (manager.role !== 'manager') return res.status(400).json({ message: 'User is not a manager.' });

    if (subscriptionPlan !== undefined) manager.subscriptionPlan = subscriptionPlan;
    if (active !== undefined) manager.active = active;

    const updated = await manager.save();

    res.json({
      message: 'Manager updated successfully',
      manager: updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating manager.' });
  }
};

// @desc    Delete a Manager/Admin account
// @route   DELETE /api/master/managers/:id
// @access  Private (Master only)
export const deleteManager = async (req, res) => {
  try {
    const manager = await User.findById(req.params.id);
    if (!manager) return res.status(404).json({ message: 'Manager not found.' });
    if (manager.role !== 'manager') return res.status(400).json({ message: 'User is not a manager.' });

    if (manager.firebaseUid) {
      try {
        await admin.auth().deleteUser(manager.firebaseUid);
      } catch (error) {
        console.error('Firebase delete (non-fatal):', error.message);
      }
    }

    await manager.deleteOne();
    res.json({ message: 'Manager deleted successfully', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting manager.' });
  }
};

// @desc    Get master dashboard stats
// @route   GET /api/master/stats
// @access  Private (Master only)
export const getMasterStats = async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' }).select('_id');
    const managerIds = managers.map(m => m._id);

    const totalAdmins = managers.length;
    const activeAdmins = await User.countDocuments({ role: 'manager', active: { $ne: false } });
    const inactiveAdmins = totalAdmins - activeAdmins;
    const totalRecruiters = await User.countDocuments({ role: 'recruiter', tenantOwnerId: { $in: managerIds } });
    const totalClients = await Client.countDocuments({ tenantOwnerId: { $in: managerIds } });
    const totalJobs = await Job.countDocuments({ tenantOwnerId: { $in: managerIds } });
    const activeJobs = await Job.countDocuments({ tenantOwnerId: { $in: managerIds }, active: { $ne: false } });
    const totalCandidates = await Candidate.countDocuments({ tenantOwnerId: { $in: managerIds } });

    // Projected Monthly Revenue
    const allAdmins = await User.find({ role: 'manager' }).select('subscriptionPlan subscriptionBilling');
    const planPrice = { Basic: 0, Pro: 1999, Enterprise: 4999, None: 0 };
    let monthlyRevenue = 0;
    allAdmins.forEach(admin => {
      const price = planPrice[admin.subscriptionPlan] || 0;
      const multiplier = admin.subscriptionBilling === 'yearly' ? 12 : 1;
      monthlyRevenue += price * multiplier;
    });

    res.json({
      totalAdmins,
      activeAdmins,
      inactiveAdmins,
      totalRecruiters,
      totalClients,
      totalJobs,
      activeJobs,
      totalCandidates,
      monthlyRevenue
    });
  } catch (error) {
    console.error('Error in getMasterStats:', error);
    res.status(500).json({ message: 'Error fetching master dashboard stats.' });
  }
};

// @desc    Get all admins (managers) with recruiter/client/job/candidate counts
// @route   GET /api/master/admins/overview
// @access  Private (Master only)
export const getAdminsOverview = async (req, res) => {
  try {
    const { search, plan, status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', startDate, endDate } = req.query;

    const matchQuery = { role: 'manager' };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { companyName: searchRegex }
      ];
    }

    if (plan && plan !== 'All') {
      matchQuery.subscriptionPlan = plan;
    }

    if (status && status !== 'All') {
      matchQuery.active = status === 'Active';
    }

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const sortObj = {};
    if (sortBy === 'name') {
      sortObj.firstName = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    // Fetch paginated managers
    const managers = await User.find(matchQuery)
      .select('-password -firebaseUid')
      .sort(sortObj)
      .skip(skipNum)
      .limit(limitNum)
      .lean();

    const total = await User.countDocuments(matchQuery);

    const managerIds = managers.map(m => m._id);

    // Aggregate counts - count both recruiters and admins under this tenant
    const recruiterCounts = await User.aggregate([
      { $match: { tenantOwnerId: { $in: managerIds }, role: { $in: ['recruiter', 'admin'] } } },
      { $group: { _id: '$tenantOwnerId', count: { $sum: 1 } } }
    ]);

    const clientCounts = await Client.aggregate([
      { $match: { tenantOwnerId: { $in: managerIds } } },
      { $group: { _id: '$tenantOwnerId', count: { $sum: 1 } } }
    ]);

    const jobCounts = await Job.aggregate([
      { $match: { tenantOwnerId: { $in: managerIds } } },
      { $group: { _id: '$tenantOwnerId', count: { $sum: 1 } } }
    ]);

    const candidateCounts = await Candidate.aggregate([
      { $match: { tenantOwnerId: { $in: managerIds } } },
      { $group: { _id: '$tenantOwnerId', count: { $sum: 1 } } }
    ]);

    const recruiterCountMap = new Map(recruiterCounts.map(item => [item._id.toString(), item.count]));
    const clientCountMap = new Map(clientCounts.map(item => [item._id.toString(), item.count]));
    const jobCountMap = new Map(jobCounts.map(item => [item._id.toString(), item.count]));
    const candidateCountMap = new Map(candidateCounts.map(item => [item._id.toString(), item.count]));

    const admins = managers.map(m => {
      const mIdStr = m._id.toString();
      return {
        adminId: m._id,
        _id: m._id, // compatibility
        firstName: m.firstName,
        lastName: m.lastName,
        name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        companyName: m.companyName || '',
        email: m.email,
        phone: m.phone || '',
        plan: m.subscriptionPlan || 'None',
        subscriptionPlan: m.subscriptionPlan || 'None', // compatibility
        active: m.active !== false,
        status: m.active !== false ? 'Active' : 'Inactive',
        recruiterCount: recruiterCountMap.get(mIdStr) || 0,
        clientCount: clientCountMap.get(mIdStr) || 0,
        jobCount: jobCountMap.get(mIdStr) || 0,
        candidateCount: candidateCountMap.get(mIdStr) || 0,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      };
    });

    res.json({
      admins,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error in getAdminsOverview:', error);
    res.status(500).json({ message: 'Error fetching admins overview.' });
  }
};

// @desc    Get detailed summary for a specific admin/manager
// @route   GET /api/master/admins/:adminId/summary
// @access  Private (Master only)
export const getAdminSummary = async (req, res) => {
  try {
    const { adminId } = req.params;

    // Verify adminId exists and is a manager
    const manager = await User.findOne({ _id: adminId, role: 'manager' }).select('-password -firebaseUid');
    if (!manager) {
      return res.status(404).json({ message: 'Admin/Manager not found.' });
    }

    // Run aggregations for this admin - include both recruiters and admins
    const totalRecruiters = await User.countDocuments({ tenantOwnerId: adminId, role: { $in: ['recruiter', 'admin'] } });
    const activeRecruiters = await User.countDocuments({ tenantOwnerId: adminId, role: { $in: ['recruiter', 'admin'] }, active: { $ne: false } });

    const totalClients = await Client.countDocuments({ tenantOwnerId: adminId });
    const activeClients = await Client.countDocuments({ tenantOwnerId: adminId, active: { $ne: false } });

    const totalJobs = await Job.countDocuments({ tenantOwnerId: adminId });
    const activeJobs = await Job.countDocuments({ tenantOwnerId: adminId, active: { $ne: false } });
    const closedJobs = totalJobs - activeJobs;

    const totalCandidates = await Candidate.countDocuments({ tenantOwnerId: adminId });

    // Pipeline status counts
    const pipelineCounts = await Candidate.aggregate([
      { $match: { tenantOwnerId: manager._id } },
      { $unwind: '$status' },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const pipelineMap = {};
    const statusEnums = [
      'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
      'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
    ];
    statusEnums.forEach(status => {
      pipelineMap[status] = 0;
    });
    pipelineCounts.forEach(item => {
      if (item._id) {
        pipelineMap[item._id] = item.count;
      }
    });

    // Recruiter candidate distribution
    const recruiterCandidates = await Candidate.aggregate([
      { $match: { tenantOwnerId: manager._id } },
      { $group: { 
          _id: '$recruiterId', 
          recruiterName: { $first: '$recruiterName' },
          count: { $sum: 1 } 
        } 
      }
    ]);

    // Retrieve recruiters (recruiters and admins registered under the tenant)
    const recruiters = await User.find({
      tenantOwnerId: adminId,
      role: { $in: ['recruiter', 'admin'] }
    }).select('firstName lastName email active role');

    const recruiterDistribution = recruiters.map(rec => {
      const match = recruiterCandidates.find(rc => rc._id && rc._id.toString() === rec._id.toString());
      return {
        recruiterId: rec._id,
        recruiterName: rec.role === 'admin'
          ? `${rec.firstName || ''} ${rec.lastName || ''} (Admin)`.trim() || `${rec.email} (Admin)`
          : `${rec.firstName || ''} ${rec.lastName || ''}`.trim() || rec.email,
        email: rec.email,
        active: rec.active !== false,
        count: match ? match.count : 0
      };
    });

    // Add recruiters that might have candidates but are deleted/missing
    recruiterCandidates.forEach(rc => {
      if (rc._id) {
        const found = recruiterDistribution.some(rd => rd.recruiterId.toString() === rc._id.toString());
        if (!found) {
          recruiterDistribution.push({
            recruiterId: rc._id,
            recruiterName: rc.recruiterName || 'Unknown Recruiter',
            count: rc.count,
            active: false
          });
        }
      }
    });

    res.json({
      manager,
      kpis: {
        totalRecruiters,
        activeRecruiters,
        totalClients,
        activeClients,
        totalJobs,
        activeJobs,
        closedJobs,
        totalCandidates
      },
      pipeline: pipelineMap,
      recruiterDistribution
    });
  } catch (error) {
    console.error('Error in getAdminSummary:', error);
    res.status(500).json({ message: 'Error fetching admin summary.' });
  }
};

// @desc    Get detailed recruiters for a specific admin
// @route   GET /api/master/admins/:adminId/recruiters
// @access  Private (Master only)
export const getAdminRecruiters = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { search, status, page = 1, limit = 10 } = req.query;

    const matchQuery = { tenantOwnerId: adminId, role: { $in: ['recruiter', 'admin'] } };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    if (status && status !== 'All') {
      matchQuery.active = status === 'Active';
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    // Fetch matching users, sorting by createdAt
    const recruiters = await User.find(matchQuery)
      .select('-password -firebaseUid')
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await User.countDocuments(matchQuery);

    const recruiterData = await Promise.all(recruiters.map(async (rec) => {
      const rawName = `${rec.firstName || ''} ${rec.lastName || ''}`.trim() || rec.email;
      const recName = rec.role === 'admin' ? `${rawName} (Admin)` : rawName;

      const totalCandidates = await Candidate.countDocuments({ tenantOwnerId: adminId, recruiterId: rec._id });
      const submitted = await Candidate.countDocuments({ tenantOwnerId: adminId, recruiterId: rec._id, status: 'Submitted' });
      const selected = await Candidate.countDocuments({ tenantOwnerId: adminId, recruiterId: rec._id, status: 'Selected' });
      const joined = await Candidate.countDocuments({ tenantOwnerId: adminId, recruiterId: rec._id, status: 'Joined' });
      const rejected = await Candidate.countDocuments({ tenantOwnerId: adminId, recruiterId: rec._id, status: 'Rejected' });

      // Match job primaryRecruiter or secondaryRecruiter with the name (support with or without "(Admin)" suffix)
      const assignedJobsCount = await Job.countDocuments({
        tenantOwnerId: adminId,
        $or: [
          { primaryRecruiter: recName },
          { secondaryRecruiter: recName },
          { primaryRecruiter: rawName },
          { secondaryRecruiter: rawName }
        ]
      });

      return {
        ...rec,
        recruiterName: recName,
        totalCandidates,
        submitted,
        selected,
        joined,
        rejected,
        assignedJobsCount
      };
    }));

    res.json({
      recruiters: recruiterData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error in getAdminRecruiters:', error);
    res.status(500).json({ message: 'Error fetching recruiters.' });
  }
};

// @desc    Get detailed clients for a specific admin
// @route   GET /api/master/admins/:adminId/clients
// @access  Private (Master only)
export const getAdminClients = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { search, status, page = 1, limit = 10 } = req.query;

    const matchQuery = { tenantOwnerId: adminId };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { companyName: searchRegex },
        { industry: searchRegex },
        { contactPerson: searchRegex },
        { clientLocation: searchRegex }
      ];
    }

    if (status && status !== 'All') {
      matchQuery.active = status === 'Active';
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const clients = await Client.find(matchQuery)
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await Client.countDocuments(matchQuery);

    const clientData = await Promise.all(clients.map(async (client) => {
      const totalJobs = await Job.countDocuments({ tenantOwnerId: adminId, clientName: client.companyName });
      const activeJobs = await Job.countDocuments({ tenantOwnerId: adminId, clientName: client.companyName, active: { $ne: false } });
      const submittedCandidates = await CandidateSubmission.countDocuments({ tenantOwnerId: adminId, clientId: client._id });
      const selectedCandidates = await CandidateSubmission.countDocuments({ tenantOwnerId: adminId, clientId: client._id, status: 'Selected' });

      return {
        ...client,
        totalJobs,
        activeJobs,
        submittedCandidates,
        selectedCandidates
      };
    }));

    res.json({
      clients: clientData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error in getAdminClients:', error);
    res.status(500).json({ message: 'Error fetching clients.' });
  }
};

// @desc    Get detailed jobs for a specific admin
// @route   GET /api/master/admins/:adminId/jobs
// @access  Private (Master only)
export const getAdminJobs = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { search, status, client, recruiter, page = 1, limit = 10 } = req.query;

    const matchQuery = { tenantOwnerId: adminId };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { jobCode: searchRegex },
        { position: searchRegex },
        { location: searchRegex }
      ];
    }

    if (status && status !== 'All') {
      matchQuery.active = status === 'Active';
    }

    if (client && client !== 'All') {
      matchQuery.clientName = client;
    }

    if (recruiter && recruiter !== 'All') {
      matchQuery.$or = [
        { primaryRecruiter: recruiter },
        { secondaryRecruiter: recruiter }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const jobs = await Job.find(matchQuery)
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await Job.countDocuments(matchQuery);

    const jobData = await Promise.all(jobs.map(async (job) => {
      const submittedCandidates = await CandidateSubmission.countDocuments({ tenantOwnerId: adminId, jobId: job._id });
      const matchingCandidates = await MatchScore.countDocuments({ tenantOwnerId: adminId, requirementId: job._id });

      return {
        ...job,
        submittedCandidates,
        matchingCandidates
      };
    }));

    res.json({
      jobs: jobData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error in getAdminJobs:', error);
    res.status(500).json({ message: 'Error fetching jobs.' });
  }
};

// @desc    Get detailed candidates for a specific admin
// @route   GET /api/master/admins/:adminId/candidates
// @access  Private (Master only)
export const getAdminCandidates = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { search, recruiterId, client, status, page = 1, limit = 10, startDate, endDate } = req.query;

    const matchQuery = { tenantOwnerId: adminId };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { candidateId: searchRegex },
        { name: searchRegex },
        { email: searchRegex },
        { contact: searchRegex },
        { position: searchRegex }
      ];
    }

    if (recruiterId && recruiterId !== 'All') {
      matchQuery.recruiterId = recruiterId;
    }

    if (client && client !== 'All') {
      matchQuery.client = client;
    }

    if (status && status !== 'All') {
      matchQuery.status = status;
    }

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const candidates = await Candidate.find(matchQuery)
      .select('candidateId name firstName lastName email contact position client recruiterId recruiterName status createdAt active')
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await Candidate.countDocuments(matchQuery);

    res.json({
      candidates,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error in getAdminCandidates:', error);
    res.status(500).json({ message: 'Error fetching candidates.' });
  }
};

// @desc    Get recruiter-wise candidate count stats across all tenants
// @route   GET /api/master/stats/candidates-by-recruiters
// @access  Private (Master only)
export const getCandidatesByRecruitersStats = async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' }).select('_id');
    const managerIds = managers.map(m => m._id);

    const stats = await Candidate.aggregate([
      { $match: { tenantOwnerId: { $in: managerIds } } },
      {
        $group: {
          _id: '$recruiterId',
          recruiterName: { $first: '$recruiterName' },
          tenantOwnerId: { $first: '$tenantOwnerId' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const populatedStats = await Promise.all(stats.map(async (item) => {
      let recruiterEmail = '—';
      let companyName = '—';

      if (item._id) {
        const recruiterUser = await User.findById(item._id).select('email role tenantOwnerId');
        if (recruiterUser) {
          recruiterEmail = recruiterUser.email;
        }
      }

      if (item.tenantOwnerId) {
        const managerUser = await User.findById(item.tenantOwnerId).select('companyName');
        if (managerUser) {
          companyName = managerUser.companyName || '—';
        }
      }

      return {
        recruiterId: item._id,
        recruiterName: item.recruiterName || 'Unknown Recruiter/Admin',
        recruiterEmail,
        companyName,
        count: item.count
      };
    }));

    res.json(populatedStats);
  } catch (error) {
    console.error('Error in getCandidatesByRecruitersStats:', error);
    res.status(500).json({ message: 'Error fetching candidate stats.' });
  }
};

// @desc    Get candidates by a specific recruiter across all tenants (Master only)
// @route   GET /api/master/stats/candidates-by-recruiters/:recruiterId
// @access  Private (Master only)
export const getCandidatesByRecruiterId = async (req, res) => {
  try {
    const { recruiterId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const managers = await User.find({ role: 'manager' }).select('_id');
    const managerIds = managers.map(m => m._id);

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const query = { recruiterId, tenantOwnerId: { $in: managerIds } };

    const candidates = await Candidate.find(query)
      .select('candidateId name email contact position client status createdAt')
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await Candidate.countDocuments(query);

    res.json({
      candidates,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error in getCandidatesByRecruiterId:', error);
    res.status(500).json({ message: 'Error fetching candidates for recruiter.' });
  }
};

// @desc    Get detailed list of admins for stats modal
// @route   GET /api/master/stats/admins
// @access  Private (Master only)
export const getStatsAdmins = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const matchQuery = { role: 'manager' };
    
    if (status === 'Active') {
      matchQuery.active = { $ne: false };
    } else if (status === 'Inactive') {
      matchQuery.active = false;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { companyName: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const admins = await User.find(matchQuery)
      .select('firstName lastName email companyName subscriptionPlan active createdAt')
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await User.countDocuments(matchQuery);

    res.json({
      admins: admins.map(a => ({
        ...a,
        name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error in getStatsAdmins:', error);
    res.status(500).json({ message: 'Error fetching admin stats.' });
  }
};

// @desc    Get detailed list of recruiters for stats modal
// @route   GET /api/master/stats/recruiters
// @access  Private (Master only)
export const getStatsRecruiters = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const managers = await User.find({ role: 'manager' }).select('_id');
    const managerIds = managers.map(m => m._id);
    const matchQuery = { role: { $in: ['recruiter', 'admin'] }, tenantOwnerId: { $in: managerIds } };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const recruiters = await User.find(matchQuery)
      .select('firstName lastName email phone role tenantOwnerId active createdAt')
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await User.countDocuments(matchQuery);

    const recruitersData = await Promise.all(recruiters.map(async (rec) => {
      let companyName = '—';
      if (rec.tenantOwnerId) {
        const manager = await User.findById(rec.tenantOwnerId).select('companyName');
        if (manager) {
          companyName = manager.companyName || '—';
        }
      }
      return {
        ...rec,
        name: `${rec.firstName || ''} ${rec.lastName || ''}`.trim() || rec.email,
        companyName
      };
    }));

    res.json({
      recruiters: recruitersData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error in getStatsRecruiters:', error);
    res.status(500).json({ message: 'Error fetching recruiter stats.' });
  }
};

// @desc    Get detailed list of clients for stats modal
// @route   GET /api/master/stats/clients
// @access  Private (Master only)
export const getStatsClients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const managers = await User.find({ role: 'manager' }).select('_id');
    const managerIds = managers.map(m => m._id);
    const matchQuery = { tenantOwnerId: { $in: managerIds } };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { companyName: searchRegex },
        { industry: searchRegex },
        { contactPerson: searchRegex },
        { clientLocation: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const clients = await Client.find(matchQuery)
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await Client.countDocuments(matchQuery);

    const clientsData = await Promise.all(clients.map(async (client) => {
      let tenantCompanyName = '—';
      if (client.tenantOwnerId) {
        const manager = await User.findById(client.tenantOwnerId).select('companyName');
        if (manager) {
          tenantCompanyName = manager.companyName || '—';
        }
      }
      return {
        ...client,
        tenantCompanyName
      };
    }));

    res.json({
      clients: clientsData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error in getStatsClients:', error);
    res.status(500).json({ message: 'Error fetching client stats.' });
  }
};

// @desc    Get detailed list of jobs for stats modal
// @route   GET /api/master/stats/jobs
// @access  Private (Master only)
export const getStatsJobs = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const managers = await User.find({ role: 'manager' }).select('_id');
    const managerIds = managers.map(m => m._id);
    const matchQuery = { tenantOwnerId: { $in: managerIds } };

    if (status === 'Active') {
      matchQuery.active = { $ne: false };
    } else if (status === 'Inactive') {
      matchQuery.active = false;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      matchQuery.$or = [
        { jobCode: searchRegex },
        { position: searchRegex },
        { clientName: searchRegex }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const jobs = await Job.find(matchQuery)
      .skip(skipNum)
      .limit(limitNum)
      .sort({ createdAt: -1 })
      .lean();

    const total = await Job.countDocuments(matchQuery);

    const jobsData = await Promise.all(jobs.map(async (job) => {
      let tenantCompanyName = '—';
      if (job.tenantOwnerId) {
        const manager = await User.findById(job.tenantOwnerId).select('companyName');
        if (manager) {
          tenantCompanyName = manager.companyName || '—';
        }
      }
      return {
        ...job,
        tenantCompanyName
      };
    }));

    res.json({
      jobs: jobsData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error in getStatsJobs:', error);
    res.status(500).json({ message: 'Error fetching job stats.' });
  }
};
