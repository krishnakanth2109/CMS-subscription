import Candidate from '../models/Candidate.js';
import Job from '../models/Job.js';
import MatchScore from '../models/MatchScore.js';
import { processMatchingCandidates, evaluateCandidateJobMatch } from '../services/groqMatchingService.js';

export const scoreMatch = async (req, res) => {
  try {
    const { candidateId, requirementId } = req.body;

    if (!candidateId || !requirementId) {
      return res.status(400).json({ message: 'candidateId and requirementId are required' });
    }

    const [candidate, requirement] = await Promise.all([
      Candidate.findById(candidateId).lean(),
      Job.findById(requirementId).lean()
    ]);

    if (!candidate || !requirement) {
      return res.status(404).json({ message: 'Candidate or Requirement not found' });
    }

    const score = await evaluateCandidateJobMatch(candidate, requirement);

    // Save cache (same format as groqMatchingService)
    const tenantOwnerId = requirement.createdBy || req.user?._id;
    await MatchScore.findOneAndUpdate(
      {
        tenantOwnerId,
        candidateId,
        requirementId
      },
      {
        tenantOwnerId,
        candidateId,
        requirementId,
        candidateUpdatedAt: candidate.updatedAt,
        requirementUpdatedAt: requirement.updatedAt,
        source: score.scoringSource,
        result: score
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json(score);
  } catch (err) {
    console.error('[scoreMatch] single score failed:', err);
    return res.status(500).json({ message: err.message });
  }
};

export const scoreMatchesForRequirement = async (req, res) => {
  try {
    const { candidateIds = [], requirementId } = req.body;

    if (!requirementId) {
      return res.status(400).json({ message: 'requirementId is required' });
    }

    const requirement = await Job.findById(requirementId).lean();
    if (!requirement) {
      return res.status(404).json({ message: 'Job requirement not found' });
    }

    const ids = Array.isArray(candidateIds) ? candidateIds.filter(Boolean) : [];
    if (!ids.length) {
      return res.json({ requirementId, scores: [] });
    }

    const query = { _id: { $in: ids } };
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'manager') {
      query.recruiterId = req.user._id;
    }

    const candidates = await Candidate.find(query).lean();

    const matchResult = await processMatchingCandidates(candidates, requirement, req.user);
    const scores = matchResult.candidates;

    return res.json({
      requirementId,
      success: true,
      totalEvaluated: matchResult.totalEvaluated,
      locallyRejected: matchResult.locallyRejected,
      aiScored: matchResult.aiScored,
      cached: matchResult.cached,
      failed: matchResult.failed,
      candidates: scores,
      scores
    });
  } catch (err) {
    console.error('[scoreMatch] bulk score failed:', err);
    return res.status(500).json({ message: err.message });
  }
};
