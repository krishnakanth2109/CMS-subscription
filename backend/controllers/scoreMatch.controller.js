import mongoose from 'mongoose';
import Candidate from '../models/Candidate.js';
import Job from '../models/Job.js';
import MatchScore from '../models/MatchScore.js';
import { getTenantOwnerId } from '../middleware/authMiddleware.js';
import {
  MATCH_SCORE_VERSION,
  scoreCandidateForJob,
  scoreCandidatesForJob,
} from '../services/geminiMatchService.js';

const FALLBACK_CACHE_TTL_MS = Number(process.env.MATCH_FALLBACK_CACHE_TTL_MS || 10 * 60 * 1000);

const buildTenantQuery = (req, extra = {}) => {
  const tenantOwnerId = getTenantOwnerId(req.user);
  return tenantOwnerId ? { ...extra, tenantOwnerId } : extra;
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const getCacheTenantId = (req) => getTenantOwnerId(req.user) || null;

const isCacheFresh = (cache, candidate, requirement) => {
  if (!cache?.result) return false;
  if (cache.result.scoreVersion !== MATCH_SCORE_VERSION) return false;

  const candidateChangedAt = candidate.updatedAt || candidate.createdAt;
  const requirementChangedAt = requirement.updatedAt || requirement.createdAt;
  if (candidateChangedAt && cache.candidateUpdatedAt && cache.candidateUpdatedAt < candidateChangedAt) return false;
  if (requirementChangedAt && cache.requirementUpdatedAt && cache.requirementUpdatedAt < requirementChangedAt) return false;

  if (cache.source === 'fallback') {
    return Date.now() - new Date(cache.updatedAt || cache.createdAt).getTime() <= FALLBACK_CACHE_TTL_MS;
  }

  return true;
};

const findCachedScore = async (req, candidate, requirement) => {
  const cache = await MatchScore.findOne({
    tenantOwnerId: getCacheTenantId(req),
    candidateId: candidate._id,
    requirementId: requirement._id,
  }).lean();

  return isCacheFresh(cache, candidate, requirement) ? cache.result : null;
};

const saveScoreCache = async (req, candidate, requirement, score) => {
  try {
    await MatchScore.findOneAndUpdate(
      {
        tenantOwnerId: getCacheTenantId(req),
        candidateId: candidate._id,
        requirementId: requirement._id,
      },
      {
        tenantOwnerId: getCacheTenantId(req),
        candidateId: candidate._id,
        requirementId: requirement._id,
        candidateUpdatedAt: candidate.updatedAt || candidate.createdAt,
        requirementUpdatedAt: requirement.updatedAt || requirement.createdAt,
        source: score.source === 'gemini' ? 'gemini' : 'fallback',
        result: score,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.warn('Match score cache save skipped:', error.message);
  }
};

export const scoreMatch = async (req, res) => {
  try {
    const { candidateId, requirementId } = req.body;

    if (!candidateId || !requirementId) {
      return res.status(400).json({ message: 'candidateId and requirementId are required' });
    }

    if (!isValidId(candidateId) || !isValidId(requirementId)) {
      return res.status(400).json({ message: 'Invalid candidateId or requirementId' });
    }

    const [candidate, requirement] = await Promise.all([
      Candidate.findOne(buildTenantQuery(req, { _id: candidateId })).lean(),
      Job.findOne(buildTenantQuery(req, { _id: requirementId })).lean(),
    ]);

    if (!candidate || !requirement) {
      return res.status(404).json({ message: 'Candidate or Requirement not found' });
    }

    const cachedScore = await findCachedScore(req, candidate, requirement);
    if (cachedScore) return res.json(cachedScore);

    const score = await scoreCandidateForJob(candidate, requirement);
    await saveScoreCache(req, candidate, requirement, score);
    res.json(score);
  } catch (error) {
    console.error('Error in scoreMatch:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const scoreMatchesForRequirement = async (req, res) => {
  try {
    const { candidateIds, requirementId } = req.body;

    if (!requirementId || !Array.isArray(candidateIds)) {
      return res.status(400).json({ message: 'requirementId and candidateIds are required' });
    }

    const uniqueCandidateIds = [...new Set(candidateIds.map((id) => id?.toString()).filter(Boolean))];
    if (!isValidId(requirementId) || uniqueCandidateIds.some((id) => !isValidId(id))) {
      return res.status(400).json({ message: 'Invalid requirementId or candidateIds' });
    }

    const requirement = await Job.findOne(buildTenantQuery(req, { _id: requirementId })).lean();
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    if (uniqueCandidateIds.length === 0) {
      return res.json({ requirementId, scores: [] });
    }

    const candidates = await Candidate.find(
      buildTenantQuery(req, { _id: { $in: uniqueCandidateIds } })
    ).lean();

    if (candidates.length === 0) {
      return res.json({ requirementId, scores: [] });
    }

    const cacheDocs = await MatchScore.find({
      tenantOwnerId: getCacheTenantId(req),
      requirementId,
      candidateId: { $in: candidates.map((candidate) => candidate._id) },
    }).lean();

    const candidateById = new Map(candidates.map((candidate) => [candidate._id.toString(), candidate]));
    const cacheByCandidateId = new Map(cacheDocs.map((cache) => [cache.candidateId.toString(), cache]));
    const scores = [];
    const candidatesToScore = [];

    candidates.forEach((candidate) => {
      const cache = cacheByCandidateId.get(candidate._id.toString());
      if (isCacheFresh(cache, candidate, requirement)) {
        scores.push(cache.result);
      } else {
        candidatesToScore.push(candidate);
      }
    });

    if (candidatesToScore.length > 0) {
      const newScores = await scoreCandidatesForJob(candidatesToScore, requirement);
      scores.push(...newScores);

      const writes = newScores.map((score) => {
        const candidate = candidateById.get(score.candidateId?.toString());
        if (!candidate) return null;
        return {
          updateOne: {
            filter: {
              tenantOwnerId: getCacheTenantId(req),
              candidateId: candidate._id,
              requirementId: requirement._id,
            },
            update: {
              $set: {
                tenantOwnerId: getCacheTenantId(req),
                candidateId: candidate._id,
                requirementId: requirement._id,
                candidateUpdatedAt: candidate.updatedAt || candidate.createdAt,
                requirementUpdatedAt: requirement.updatedAt || requirement.createdAt,
                source: score.source === 'gemini' ? 'gemini' : 'fallback',
                result: score,
              },
            },
            upsert: true,
          },
        };
      }).filter(Boolean);

      if (writes.length > 0) {
        try {
          await MatchScore.bulkWrite(writes, { ordered: false });
        } catch (error) {
          console.warn('Match score bulk cache save skipped:', error.message);
        }
      }
    }

    scores.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));
    res.json({
      requirementId,
      scores,
    });
  } catch (error) {
    console.error('Error in scoreMatchesForRequirement:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
