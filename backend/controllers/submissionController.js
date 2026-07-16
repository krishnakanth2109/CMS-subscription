import CandidateSubmission from '../models/CandidateSubmission.js';
import Candidate from '../models/Candidate.js';
import Client from '../models/Client.js';
import Job from '../models/Job.js';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';

// @desc    Create a candidate-client assignment (submission)
// @route   POST /api/submissions
export const createSubmission = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { candidateId, clientId, jobId, clientName, remarks } = req.body;

    let resolvedClientId = clientId;
    if (!resolvedClientId) {
      let cName = clientName;
      if (!cName && jobId) {
        const job = await Job.findById(jobId);
        if (job) cName = job.clientName;
      }
      if (cName) {
        const clientDoc = await Client.findOne({ companyName: cName, tenantOwnerId });
        if (clientDoc) {
          resolvedClientId = clientDoc._id;
        }
      }
    }

    if (!candidateId || !resolvedClientId || !jobId) {
      return res.status(400).json({ message: 'candidateId, clientId, and jobId are required' });
    }

    // Verify candidate exists under this tenant
    const candidate = await Candidate.findOne({ _id: candidateId, tenantOwnerId });
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Verify client exists under this tenant
    const client = await Client.findOne({ _id: resolvedClientId, tenantOwnerId });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Check if duplicate submission already exists
    const query = { tenantOwnerId, candidateId, clientId: resolvedClientId };
    if (jobId) query.jobId = jobId;
    
    const existing = await CandidateSubmission.findOne(query);
    if (existing) {
      return res.status(400).json({ message: 'Candidate is already submitted to this client/job' });
    }

    const newSubmission = new CandidateSubmission({
      tenantOwnerId,
      candidateId,
      clientId: resolvedClientId,
      clientName: client.companyName,
      jobId: jobId || null,
      remarks: remarks || '',
      status: 'Submitted'
    });

    await newSubmission.save();
    
    // Sync Candidate model to maintain single source of truth for dashboard/tables
    await Candidate.findByIdAndUpdate(candidateId, {
      $set: {
        client: client.companyName,
        status: ['Submitted']
      }
    });

    res.status(201).json({ message: 'Candidate successfully delivered to client', submission: newSubmission });
  } catch (error) {
    console.error('Create submission error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all candidate-client submissions
// @route   GET /api/submissions
export const getSubmissions = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const query = { tenantOwnerId };

    if (req.query.candidateId) {
      query.candidateId = req.query.candidateId;
    }
    if (req.query.clientId) {
      query.clientId = req.query.clientId;
    }
    if (req.query.jobId) {
      query.jobId = req.query.jobId;
    }

    const submissions = await CandidateSubmission.find(query)
      .populate('candidateId', 'firstName lastName name email contact phone mobile contactNumber position candidateId recruiterName assignedRecruiter status skills totalExperience relevantExperience experience')
      .populate('jobId', 'jobCode position')
      .sort({ createdAt: -1 })
      .lean();

    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update submission status and remarks
// @route   PUT /api/submissions/:id
export const updateSubmissionStatus = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);
    const { status, remarks } = req.body;

    const submission = await CandidateSubmission.findOne({ _id: req.params.id, tenantOwnerId });
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (remarks !== undefined) updateData.remarks = remarks;

    const updated = await CandidateSubmission.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    // Sync Candidate model to keep dashboards and UI in sync
    if (status) {
      await Candidate.findByIdAndUpdate(updated.candidateId, {
        $set: { status: [status] }
      });
    }

    res.json({ message: 'Submission updated successfully', submission: updated });
  } catch (error) {
    console.error('Update submission error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a submission
// @route   DELETE /api/submissions/:id
export const deleteSubmission = async (req, res) => {
  try {
    const tenantOwnerId = getTenantOwnerId(req.user);

    const submission = await CandidateSubmission.findOne({ _id: req.params.id, tenantOwnerId });
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    await CandidateSubmission.findByIdAndDelete(req.params.id);
    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Delete submission error:', error);
    res.status(500).json({ message: error.message });
  }
};
