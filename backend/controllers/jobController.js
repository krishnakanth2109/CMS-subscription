// --- START OF FILE jobController.js ---
import Job from '../models/Job.js';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';

// @desc   Get all jobs for this tenant
// @route  GET /api/jobs
export const getJobs = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const query = { tenantOwnerId };

    // Recruiters: only jobs where they are primary or secondary recruiter
    if (req.user.role === 'recruiter') {
      const possibleNames = [
        req.user.firstName && req.user.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : null,
        req.user.username,
        req.user.email,
      ].filter(Boolean);

      query.$or = [
        { primaryRecruiter:   { $in: possibleNames } },
        { secondaryRecruiter: { $in: possibleNames } },
      ];
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 }).lean();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc   Create a job (auto-generates jobCode per tenant)
// @route  POST /api/jobs
export const createJob = async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to create jobs' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    const jobData = { ...req.body, createdBy: req.user._id, tenantOwnerId };

    if (!jobData.tatTime || jobData.tatTime === '') jobData.tatTime = null;
    delete jobData.tenantOwnerId; // will be re-attached below cleanly

    // Auto-increment jobCode scoped to THIS tenant
    // Format: REQ0001, REQ0002 ... independently per company
    const allJobs = await Job.find(
      { tenantOwnerId, jobCode: { $regex: /^REQ\d+$/ } },
      { jobCode: 1 }
    ).lean();

    let maxNum = 0;
    if (allJobs.length > 0) {
      const nums = allJobs.map(j => {
        const m = j.jobCode.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      });
      maxNum = Math.max(...nums);
    }
    jobData.jobCode = `REQ${String(maxNum + 1).padStart(4, '0')}`;

    const job = await Job.create({ ...jobData, tenantOwnerId });
    res.status(201).json(job);
  } catch (error) {
    console.error('Create Job Error:', error);
    res.status(400).json({
      message: error.code === 11000 ? 'Job Code collision. Try again.' : error.message,
    });
  }
};

// @desc   Update a job (tenant-scoped)
// @route  PUT /api/jobs/:id
export const updateJob = async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to update jobs' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    const updateData    = { ...req.body };
    if (updateData.tatTime === '') updateData.tatTime = null;
    delete updateData.tenantOwnerId;

    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, tenantOwnerId },
      { $set: updateData },
      { new: true, lean: true }
    );
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc   Delete a job (tenant-scoped)
// @route  DELETE /api/jobs/:id
export const deleteJob = async (req, res) => {
  try {
    if (req.user.role === 'recruiter') {
      return res.status(403).json({ message: 'Not authorized to delete jobs' });
    }

    const tenantOwnerId = getTenantOwnerId(req.user);
    const job = await Job.findOneAndDelete({ _id: req.params.id, tenantOwnerId });
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ message: 'Job removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};