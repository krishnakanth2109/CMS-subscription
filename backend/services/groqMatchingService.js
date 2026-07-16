import Groq from 'groq-sdk';
import MatchScore from '../models/MatchScore.js';

// Configuration
const GROQ_MATCHING_ENABLED = process.env.GROQ_MATCHING_ENABLED !== 'false' && !!process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const BATCH_SIZE = parseInt(process.env.GROQ_MATCH_BATCH_SIZE || '5', 10);
const MAX_CANDIDATES = parseInt(process.env.GROQ_MATCH_MAX_CANDIDATES || '25', 10);

const groq = GROQ_MATCHING_ENABLED ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// Weight setup
const SCORE_WEIGHTS = {
  mandatorySkills: 45,
  roleRelevance: 25,
  preferredSkills: 10,
  experience: 10,
  qualification: 5,
  jobDescription: 0,
  otherCriteria: 5
};

// Skill normalizer
export const normalizeSkill = (val) => {
  if (!val) return '';
  const compact = val.toString().toLowerCase().trim();

  // Alias maps
  const aliases = {
    reactjs: 'react',
    'react.js': 'react',
    nodejs: 'node',
    'node.js': 'node',
    expressjs: 'express',
    'express.js': 'express',
    mongodb: 'mongo',
    javascript: 'js',
    typescript: 'ts',
    postgres: 'postgresql',
    postgresql: 'postgresql',
    mysql: 'mysql',
    sql: 'mysql',
    tailwindcss: 'tailwind',
    tailwind: 'tailwind',
    js: 'js',
    ts: 'ts',
    node: 'node',
    mongo: 'mongo',
    express: 'express'
  };

  const cleaned = compact
    .replace(/[^\w\s\.\-\+#]/g, '') // keep letters, digits, space, dot, hyphen, plus, hash
    .replace(/\s+/g, ' ')
    .trim();

  if (aliases[cleaned]) return aliases[cleaned];

  const superCompact = cleaned.replace(/[\s\.\-]/g, '');
  if (aliases[superCompact]) return aliases[superCompact];

  return cleaned;
};

// Text helpers
const toArr = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
  return [];
};

// Experience parsing
const parseExperienceToMonths = (token) => {
  const raw = token?.toString() || '';
  const number = Number(raw);
  if (Number.isFinite(number)) return number * 12;
  const decimalMatch = raw.match(/^(\d+)\.(\d{1,2})$/);
  if (decimalMatch) return Number(decimalMatch[1]) * 12 + Number(decimalMatch[2]);
  return 0;
};

const parseExperienceMonths = (value) => {
  const text = (value || '').toString().toLowerCase().trim();
  if (!text) return 0;
  let months = 0;
  const yearMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|yr)\b/g)];
  const monthMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:months?|mos?|mo)\b/g)];
  yearMatches.forEach((match) => {
    months += parseExperienceToMonths(match[1]);
  });
  monthMatches.forEach((match) => {
    months += Number(match[1]) || 0;
  });
  if (months > 0) return months;
  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? parseExperienceToMonths(match[0]) : 0;
};

const getRequiredExperienceRange = (job) => {
  const values = (job.experience || '').toString().match(/\d+(?:\.\d+)?/g);
  if (!values?.length) return { min: 0, max: 0 };
  return {
    min: parseExperienceToMonths(values[0]),
    max: parseExperienceToMonths(values[1] || values[0]),
  };
};

const parseQualifications = (value) => {
  if (!value) return [];
  return value
    .toString()
    .split(/[,/]+/)
    .map((qualification) => qualification.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
};

// Local Role Relevance Evaluator
const evaluateLocalRoleRelevance = (candidateRole, jobRole) => {
  const c = (candidateRole || '').toLowerCase().trim();
  const j = (jobRole || '').toLowerCase().trim();
  if (!c || !j) return { level: 'none', score: 0 };
  if (c === j) return { level: 'exact', score: 20 };
  if (c.includes(j) || j.includes(c)) return { level: 'strong', score: 14 };

  const cWords = c.split(/\s+/).filter(w => w.length > 2);
  const jWords = j.split(/\s+/).filter(w => w.length > 2);
  const common = cWords.filter(w => jWords.includes(w));
  if (common.length > 0) return { level: 'partial', score: 10 };

  return { level: 'none', score: 0 };
};

// Deterministic matching builder
const buildDeterministicScore = (candidate, job) => {
  const candidateSkills = toArr(candidate.skills);
  const mandatorySkills = toArr(job.mandatorySkills).length ? toArr(job.mandatorySkills) : toArr(job.skills);
  const preferredSkills = toArr(job.preferredSkills);

  const candidateSkillSet = new Set(candidateSkills.map(normalizeSkill).filter(Boolean));
  const matchedMandatorySkills = [];
  const missingMandatorySkills = [];
  const matchedPreferredSkills = [];
  const missingPreferredSkills = [];

  mandatorySkills.forEach((skill) => {
    if (candidateSkillSet.has(normalizeSkill(skill))) matchedMandatorySkills.push(skill);
    else missingMandatorySkills.push(skill);
  });
  preferredSkills.forEach((skill) => {
    if (candidateSkillSet.has(normalizeSkill(skill))) matchedPreferredSkills.push(skill);
    else missingPreferredSkills.push(skill);
  });

  // Calculate scores
  const activeCategories = [];

  // 1. Mandatory Skills
  let mandatorySkillPct = 0;
  if (mandatorySkills.length > 0) {
    mandatorySkillPct = (matchedMandatorySkills.length / mandatorySkills.length) * 100;
    activeCategories.push({
      name: 'mandatorySkills',
      score: mandatorySkillPct,
      weight: SCORE_WEIGHTS.mandatorySkills
    });
  }

  // 2. Preferred Skills
  let preferredSkillPct = 0;
  if (preferredSkills.length > 0) {
    preferredSkillPct = (matchedPreferredSkills.length / preferredSkills.length) * 100;
    activeCategories.push({
      name: 'preferredSkills',
      score: preferredSkillPct,
      weight: SCORE_WEIGHTS.preferredSkills
    });
  }

  // 3. Experience
  const candidateMonths = parseExperienceMonths(candidate.totalExperience || candidate.experience);
  const { min: reqMinMonths } = getRequiredExperienceRange(job);
  let experiencePct = 100;
  if (reqMinMonths > 0) {
    experiencePct = candidateMonths >= reqMinMonths ? 100 : Math.round((candidateMonths / reqMinMonths) * 100);
  }
  activeCategories.push({
    name: 'experience',
    score: experiencePct,
    weight: SCORE_WEIGHTS.experience
  });

  // 4. Qualification
  const candidateEduList = parseQualifications(candidate.education || candidate.qualification);
  const jobEduList = parseQualifications(job.qualification || job.education);
  let qualificationPct = 100;
  if (jobEduList.length > 0) {
    qualificationPct = candidateEduList.some((candidateEdu) =>
      jobEduList.some((jobEdu) => candidateEdu.includes(jobEdu) || jobEdu.includes(candidateEdu))
    ) ? 100 : 0;
  }
  activeCategories.push({
    name: 'qualification',
    score: qualificationPct,
    weight: SCORE_WEIGHTS.qualification
  });

  // 5. Location, Notice Period, etc.
  const candidateLocations = [
    candidate.currentLocation,
    candidate.preferredLocation,
  ].map(loc => (loc || '').toString().toLowerCase().trim()).filter(Boolean);
  const jobLoc = (job.location || '').toString().toLowerCase().trim();
  const locationMatch = !jobLoc || candidateLocations.some((loc) => loc.includes(jobLoc) || jobLoc.includes(loc));

  const noticeMatch = true; // Placeholder for notice period business logic
  const otherPct = (locationMatch ? 50 : 0) + (noticeMatch ? 50 : 0);
  activeCategories.push({
    name: 'otherCriteria',
    score: otherPct,
    weight: SCORE_WEIGHTS.otherCriteria
  });

  // 6. Role Relevance (Fallback Local)
  const localRole = evaluateLocalRoleRelevance(candidate.position, job.position);
  const rolePct = (localRole.score / SCORE_WEIGHTS.roleRelevance) * 100;
  activeCategories.push({
    name: 'roleRelevance',
    score: rolePct,
    weight: SCORE_WEIGHTS.roleRelevance
  });

  // 7. Job Description (Fallback Local)
  let jdOverlapPct = 0;
  if (job.jobDescription) {
    // Basic local check: overlapping skills
    const jdText = job.jobDescription.toLowerCase();
    const matchedOverlap = candidateSkills.filter(skill => jdText.includes(skill.toLowerCase()));
    jdOverlapPct = candidateSkills.length ? Math.round((matchedOverlap.length / candidateSkills.length) * 100) : 50;
    activeCategories.push({
      name: 'jobDescription',
      score: jdOverlapPct,
      weight: SCORE_WEIGHTS.jobDescription
    });
  }

  // Calculate Weighted Sum
  const totalActiveWeight = activeCategories.reduce((sum, cat) => sum + cat.weight, 0);
  const finalScore = Math.round(
    activeCategories.reduce((sum, cat) => sum + (cat.score * (cat.weight / 100)), 0) * (100 / totalActiveWeight)
  );

  const matchLevel = getMatchLevelFromScore(finalScore);

  const expMatchText = reqMinMonths > 0
    ? `Candidate has ${Math.round(candidateMonths / 12 * 10) / 10} yrs (Required: ${Math.round(reqMinMonths / 12 * 10) / 10} yrs)`
    : 'No minimum experience specified';

  const qualMatchText = jobEduList.length > 0
    ? (qualificationPct > 0 ? 'Qualification matches' : 'Qualification mismatch')
    : 'No specific qualification required';

  const breakdown = {
    skills: Math.round(((mandatorySkillPct * 45 + preferredSkillPct * 10) / 55) * 0.55), // out of 55
    experience: Math.round(experiencePct * 0.10), // out of 10
    role: Math.round(rolePct * 0.25), // out of 25
    education: Math.round(qualificationPct * 0.05), // out of 5
    location: Math.round(otherPct * 0.05), // out of 5
    mandatorySkills: Math.round(mandatorySkillPct * 0.45),
    preferredSkills: Math.round(preferredSkillPct * 0.10),
    roleRelevance: Math.round(rolePct * 0.25),
    qualification: Math.round(qualificationPct * 0.05),
    jobDescription: Math.round(jdOverlapPct * 0.00),
    otherCriteria: Math.round(otherPct * 0.05)
  };

  return {
    finalScore,
    matchPercentage: finalScore,
    matchLevel,
    matchedMandatorySkills,
    missingMandatorySkills,
    matchedPreferredSkills,
    missingPreferredSkills,
    roleMatchLevel: localRole.level,
    experienceMatch: expMatchText,
    qualificationMatch: qualMatchText,
    strengths: matchedMandatorySkills.length ? `Matches mandatory skills: ${matchedMandatorySkills.slice(0, 3).join(', ')}` : 'Has relevant skills',
    gaps: missingMandatorySkills.length ? `Missing mandatory skills: ${missingMandatorySkills.slice(0, 3).join(', ')}` : 'None identified',
    recommendation: matchLevel,
    scoringSource: 'fallback',
    breakdown,
    reason: `Deterministic scoring completed. Matches ${matchedMandatorySkills.length} mandatory skills. Role match is ${localRole.level}.`
  };
};

const getMatchLevelFromScore = (score) => {
  if (score >= 85) return 'Excellent Match';
  if (score >= 70) return 'Strong Match';
  if (score >= 55) return 'Moderate Match';
  if (score >= 40) return 'Low Match';
  return 'Not Recommended';
};

// Parse JSON response safely with retries
const cleanAndParseJSON = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in LLM response');
  }
  const clean = text.slice(start, end + 1);
  return JSON.parse(clean);
};

// Call Groq API with retries
const callGroqScoring = async (jobPayload, candidatePayload, retry = false) => {
  const systemPrompt = `You are a high-performance ATS (Applicant Tracking System) candidate-to-job matcher. 
Evaluate the candidate's alignment to the job role and job description.
Return a valid JSON object ONLY. Do not write markdown blocks (like \`\`\`json), do not write explanation text before or after the JSON.

JSON Schema:
{
  "roleMatchLevel": "exact" | "strong" | "partial" | "weak" | "none",
  "roleScore": number, // 0 to 20 points based on how closely their role matches. MERN Developer vs React Developer is strong (14). Unrelated DevOps vs React is none (0).
  "jobDescriptionScore": number, // 0 to 5 points based on domain/JD overlap.
  "relatedSkills": string[], // Related technologies the candidate has that complement the job requirements (max 5)
  "reason": "Clear 2-sentence summary explaining this semantic match.",
  "riskFlags": string[] // Clear warnings if there is a mismatch, empty list if none
}`;

  const userPrompt = `
Job Requirements:
${JSON.stringify(jobPayload, null, 2)}

Candidate details:
${JSON.stringify(candidatePayload, null, 2)}

${retry ? 'CRITICAL: Your previous response was invalid. Ensure you return valid JSON strictly matching the schema above without any wrapping formatting.' : ''}
`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: GROQ_MODEL,
    temperature: 0.1,
    max_tokens: 600,
    response_format: { type: 'json_object' }
  });

  const responseText = completion.choices?.[0]?.message?.content || '';
  try {
    return cleanAndParseJSON(responseText);
  } catch (error) {
    if (!retry) {
      console.warn('[groqMatchingService] JSON parsing failed, retrying with correction prompt...');
      return callGroqScoring(jobPayload, candidatePayload, true);
    }
    throw error;
  }
};

// central matching core
export const evaluateCandidateJobMatch = async (candidate, job) => {
  // 1. Run deterministic local breakdown
  const localEval = buildDeterministicScore(candidate, job);

  // If Groq is disabled, return local evaluation immediately
  if (!GROQ_MATCHING_ENABLED || !groq) {
    return {
      ...localEval,
      scoringSource: 'fallback'
    };
  }

  // Token-efficient compact payloads
  const compactJob = {
    role: job.position,
    mandatorySkills: toArr(job.mandatorySkills).length ? toArr(job.mandatorySkills) : toArr(job.skills),
    preferredSkills: toArr(job.preferredSkills),
    experience: job.experience,
    qualification: job.qualification,
    location: job.location,
    jobDescriptionSummary: (job.jobDescription || '').slice(0, 1000)
  };

  const compactCandidate = {
    role: candidate.position,
    skills: toArr(candidate.skills),
    totalExperience: candidate.totalExperience,
    relevantExperience: candidate.relevantExperience,
    qualification: candidate.education || candidate.qualification,
    location: [candidate.currentLocation, candidate.preferredLocation].filter(Boolean).join(' / '),
    profileSummary: (candidate.remarks || candidate.notes || '').slice(0, 1200)
  };

  try {
    const aiResult = await callGroqScoring(compactJob, compactCandidate);

    // Validate and sanitize AI values
    const roleMatchLevel = ['exact', 'strong', 'partial', 'weak', 'none'].includes(aiResult.roleMatchLevel)
      ? aiResult.roleMatchLevel
      : localEval.roleMatchLevel;

    // Clamp score fields to expected ranges
    const roleScore = Math.max(0, Math.min(20, Number(aiResult.roleScore) || 0));
    const jobDescriptionScore = Math.max(0, Math.min(5, Number(aiResult.jobDescriptionScore) || 0));

    // Combine local scoring with AI evaluations
    const activeCategories = [];

    // Local deterministic pieces
    const mandatorySkills = toArr(job.mandatorySkills).length ? toArr(job.mandatorySkills) : toArr(job.skills);
    if (mandatorySkills.length > 0) {
      const matchedMandatory = localEval.matchedMandatorySkills.length;
      activeCategories.push({
        name: 'mandatorySkills',
        score: (matchedMandatory / mandatorySkills.length) * 100,
        weight: SCORE_WEIGHTS.mandatorySkills
      });
    }

    const preferredSkills = toArr(job.preferredSkills);
    if (preferredSkills.length > 0) {
      const matchedPreferred = localEval.matchedPreferredSkills.length;
      activeCategories.push({
        name: 'preferredSkills',
        score: (matchedPreferred / preferredSkills.length) * 100,
        weight: SCORE_WEIGHTS.preferredSkills
      });
    }

    const candidateMonths = parseExperienceMonths(candidate.totalExperience || candidate.experience);
    const { min: reqMinMonths } = getRequiredExperienceRange(job);
    let experiencePct = 100;
    if (reqMinMonths > 0) {
      experiencePct = candidateMonths >= reqMinMonths ? 100 : Math.round((candidateMonths / reqMinMonths) * 100);
    }
    activeCategories.push({
      name: 'experience',
      score: experiencePct,
      weight: SCORE_WEIGHTS.experience
    });

    const candidateEduList = parseQualifications(candidate.education || candidate.qualification);
    const jobEduList = parseQualifications(job.qualification || job.education);
    let qualificationPct = 100;
    if (jobEduList.length > 0) {
      qualificationPct = candidateEduList.some((candidateEdu) =>
        jobEduList.some((jobEdu) => candidateEdu.includes(jobEdu) || jobEdu.includes(candidateEdu))
      ) ? 100 : 0;
    }
    activeCategories.push({
      name: 'qualification',
      score: qualificationPct,
      weight: SCORE_WEIGHTS.qualification
    });

    const candidateLocations = [
      candidate.currentLocation,
      candidate.preferredLocation,
    ].map(loc => (loc || '').toString().toLowerCase().trim()).filter(Boolean);
    const jobLoc = (job.location || '').toString().toLowerCase().trim();
    const locationMatch = !jobLoc || candidateLocations.some((loc) => loc.includes(jobLoc) || jobLoc.includes(loc));
    const noticeMatch = true;
    const otherPct = (locationMatch ? 50 : 0) + (noticeMatch ? 50 : 0);
    activeCategories.push({
      name: 'otherCriteria',
      score: otherPct,
      weight: SCORE_WEIGHTS.otherCriteria
    });

    // AI evaluated components
    activeCategories.push({
      name: 'roleRelevance',
      score: (roleScore / 20) * 100,
      weight: SCORE_WEIGHTS.roleRelevance
    });

    activeCategories.push({
      name: 'jobDescription',
      score: (jobDescriptionScore / 5) * 100,
      weight: SCORE_WEIGHTS.jobDescription
    });

    // Compute Weighted Score
    const totalActiveWeight = activeCategories.reduce((sum, cat) => sum + cat.weight, 0);
    const finalScore = Math.round(
      activeCategories.reduce((sum, cat) => sum + (cat.score * (cat.weight / 100)), 0) * (100 / totalActiveWeight)
    );

    const matchLevel = getMatchLevelFromScore(finalScore);

    const mandatorySkillPct = mandatorySkills.length ? (localEval.matchedMandatorySkills.length / mandatorySkills.length) * 100 : 0;
    const preferredSkillPct = preferredSkills.length ? (localEval.matchedPreferredSkills.length / preferredSkills.length) * 100 : 0;
    const rolePct = (roleScore / 20) * 100;

    const breakdown = {
      skills: Math.round(((mandatorySkillPct * 45 + preferredSkillPct * 10) / 55) * 0.55), // out of 55
      experience: Math.round(experiencePct * 0.10), // out of 10
      role: Math.round(rolePct * 0.25), // out of 25
      education: Math.round(qualificationPct * 0.05), // out of 5
      location: Math.round(otherPct * 0.05), // out of 5
      mandatorySkills: Math.round(mandatorySkillPct * 0.45),
      preferredSkills: Math.round(preferredSkillPct * 0.10),
      roleRelevance: Math.round(rolePct * 0.25),
      qualification: Math.round(qualificationPct * 0.05),
      jobDescription: Math.round(jobDescriptionScore * 0.00),
      otherCriteria: Math.round(otherPct * 0.05)
    };

    return {
      finalScore,
      matchPercentage: finalScore,
      matchLevel,
      matchedMandatorySkills: localEval.matchedMandatorySkills,
      missingMandatorySkills: localEval.missingMandatorySkills,
      matchedPreferredSkills: localEval.matchedPreferredSkills,
      missingPreferredSkills: localEval.missingPreferredSkills,
      roleMatchLevel,
      experienceMatch: localEval.experienceMatch,
      qualificationMatch: localEval.qualificationMatch,
      strengths: aiResult.reason,
      gaps: aiResult.riskFlags?.join('; ') || (localEval.missingMandatorySkills.length ? `Missing skills: ${localEval.missingMandatorySkills.join(', ')}` : 'None identified'),
      recommendation: matchLevel,
      scoringSource: 'groq',
      breakdown,
      reason: aiResult.reason
    };

  } catch (error) {
    console.error(`[groqMatchingService] Groq failed for candidate ${candidate._id || candidate.id}:`, error.message);
    // Fall back gracefully to deterministic local matching
    return {
      ...localEval,
      scoringSource: 'fallback',
      reason: `AI Evaluation failed (${error.message}). Showing rule-based score.`
    };
  }
};

// Batch processor with controlled concurrency
export const processMatchingCandidates = async (candidates, job, reqUser) => {
  const results = [];
  const candidatesToScore = [];
  let cachedCount = 0;

  const tenantOwnerId = job.createdBy || reqUser?._id;

  // 1. First Pass: Cache check and local deterministic pre-filtering
  for (const candidate of candidates) {
    const candidateId = candidate._id || candidate.id;

    // A. Eligibility check (Stage 1 pre-filter)
    const candidateSkills = toArr(candidate.skills);
    const mandatorySkills = toArr(job.mandatorySkills).length ? toArr(job.mandatorySkills) : toArr(job.skills);
    const preferredSkills = toArr(job.preferredSkills);

    const candidateSkillSet = new Set(candidateSkills.map(normalizeSkill).filter(Boolean));
    const matchedMandatory = mandatorySkills.filter(skill => candidateSkillSet.has(normalizeSkill(skill)));
    const matchedPreferred = preferredSkills.filter(skill => candidateSkillSet.has(normalizeSkill(skill)));

    const totalMatchedSkills = matchedMandatory.length + matchedPreferred.length;
    const totalJobSkills = mandatorySkills.length + preferredSkills.length;
    const requiredMinimumMatches = Math.min(3, totalJobSkills);

    const localRole = evaluateLocalRoleRelevance(candidate.position, job.position);

    // Recommended pre-filter rule
    const passesPreFilter = totalMatchedSkills >= requiredMinimumMatches && (
      matchedMandatory.length >= 1 ||
      localRole.level !== 'none' ||
      totalJobSkills < 3
    );

    if (!passesPreFilter) {
      // Create local fallback score for excluded candidates
      const deterministicResult = buildDeterministicScore(candidate, job);
      results.push({
        candidateId,
        candidateName: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate',
        ...deterministicResult,
        eligibleForAI: false
      });
      continue;
    }

    // B. Check cache
    const cacheDoc = await MatchScore.findOne({
      tenantOwnerId,
      candidateId,
      requirementId: job._id || job.id
    }).lean();

    // Verify if cache is fresh
    if (cacheDoc && cacheDoc.result) {
      const candidateUpdatedTime = new Date(candidate.updatedAt).getTime();
      const jobUpdatedTime = new Date(job.updatedAt).getTime();
      const cacheCandTime = cacheDoc.candidateUpdatedAt ? new Date(cacheDoc.candidateUpdatedAt).getTime() : 0;
      const cacheJobTime = cacheDoc.requirementUpdatedAt ? new Date(cacheDoc.requirementUpdatedAt).getTime() : 0;

      // Ensure cache was scored using same source configuration (e.g. if GROQ was enabled, was it scored via GROQ?)
      const expectedSource = GROQ_MATCHING_ENABLED ? 'groq' : 'fallback';
      const cacheFresh = cacheCandTime === candidateUpdatedTime && 
                         cacheJobTime === jobUpdatedTime &&
                         cacheDoc.source === expectedSource;

      if (cacheFresh) {
        cachedCount++;
        results.push({
          candidateId,
          candidateName: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate',
          ...cacheDoc.result,
          eligibleForAI: true
        });
        continue;
      }
    }

    // Eligible and cache miss -> add to scoring queue
    candidatesToScore.push(candidate);
  }

  // 2. Rank candidates locally to send only the top MAX_CANDIDATES to Groq
  // Compute preliminary deterministic score for cache-miss candidates to rank them
  const rankedMisses = candidatesToScore.map(candidate => {
    const localEval = buildDeterministicScore(candidate, job);
    return {
      candidate,
      preliminaryScore: localEval.finalScore
    };
  }).sort((a, b) => b.preliminaryScore - a.preliminaryScore);

  // Split into: top MAX_CANDIDATES for AI scoring, and others fallback scored
  const candidatesForAI = [];
  const candidatesForFallback = [];

  rankedMisses.forEach((item, index) => {
    if (index < MAX_CANDIDATES) {
      candidatesForAI.push(item.candidate);
    } else {
      candidatesForFallback.push(item.candidate);
    }
  });

  // Calculate scores for fallback ones immediately
  candidatesForFallback.forEach(candidate => {
    const localEval = buildDeterministicScore(candidate, job);
    results.push({
      candidateId: candidate._id || candidate.id,
      candidateName: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate',
      ...localEval,
      eligibleForAI: true,
      reason: 'Rule-based evaluation (limit exceeded)'
    });
  });

  // 3. Process candidatesForAI in batches with controlled concurrency
  let aiScoredCount = 0;
  let failedCount = 0;

  for (let i = 0; i < candidatesForAI.length; i += BATCH_SIZE) {
    const batch = candidatesForAI.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (candidate) => {
      const matchResult = await evaluateCandidateJobMatch(candidate, job);
      const isGroq = matchResult.scoringSource === 'groq';

      // Save to cache
      await MatchScore.findOneAndUpdate(
        {
          tenantOwnerId,
          candidateId: candidate._id || candidate.id,
          requirementId: job._id || job.id
        },
        {
          tenantOwnerId,
          candidateId: candidate._id || candidate.id,
          requirementId: job._id || job.id,
          candidateUpdatedAt: candidate.updatedAt,
          requirementUpdatedAt: job.updatedAt,
          source: matchResult.scoringSource,
          result: matchResult
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (isGroq) aiScoredCount++;
      else failedCount++;

      return {
        candidateId: candidate._id || candidate.id,
        candidateName: candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate',
        ...matchResult,
        eligibleForAI: true
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // Sort overall results by finalScore descending
  results.sort((a, b) => b.finalScore - a.finalScore);

  return {
    success: true,
    totalEvaluated: candidates.length,
    locallyRejected: results.filter(r => !r.eligibleForAI).length,
    aiScored: aiScoredCount,
    cached: cachedCount,
    failed: failedCount,
    candidates: results
  };
};

export const processDetailedMatchingForCandidate = async (candidate, qualifyingJobs, reqUser) => {
  const results = [];
  const tenantOwnerId = candidate.recruiterId || reqUser?._id;
  const expectedSource = GROQ_MATCHING_ENABLED ? 'groq' : 'fallback';

  const jobEvaluations = qualifyingJobs.map(job => {
    const localEval = buildDeterministicScore(candidate, job);
    return {
      job,
      preliminaryScore: localEval.finalScore,
      localEval
    };
  }).sort((a, b) => b.preliminaryScore - a.preliminaryScore);

  const topJobsLimit = parseInt(process.env.GROQ_MATCH_MAX_CANDIDATES || '10', 10);

  for (let i = 0; i < jobEvaluations.length; i++) {
    const { job, localEval, preliminaryScore } = jobEvaluations[i];
    const jobId = job._id || job.id;

    // Check cache
    const cacheDoc = await MatchScore.findOne({
      tenantOwnerId,
      candidateId: candidate._id || candidate.id,
      requirementId: jobId
    }).lean();

    if (cacheDoc && cacheDoc.result) {
      const candidateUpdatedTime = new Date(candidate.updatedAt).getTime();
      const jobUpdatedTime = new Date(job.updatedAt).getTime();
      const cacheCandTime = cacheDoc.candidateUpdatedAt ? new Date(cacheDoc.candidateUpdatedAt).getTime() : 0;
      const cacheJobTime = cacheDoc.requirementUpdatedAt ? new Date(cacheDoc.requirementUpdatedAt).getTime() : 0;

      const cacheFresh = cacheCandTime === candidateUpdatedTime &&
                         cacheJobTime === jobUpdatedTime &&
                         cacheDoc.source === expectedSource;

      if (cacheFresh) {
        results.push({
          job,
          ...cacheDoc.result,
          preliminaryScore
        });
        continue;
      }
    }

    if (i < topJobsLimit) {
      const matchResult = await evaluateCandidateJobMatch(candidate, job);

      await MatchScore.findOneAndUpdate(
        {
          tenantOwnerId,
          candidateId: candidate._id || candidate.id,
          requirementId: jobId
        },
        {
          tenantOwnerId,
          candidateId: candidate._id || candidate.id,
          requirementId: jobId,
          candidateUpdatedAt: candidate.updatedAt,
          requirementUpdatedAt: job.updatedAt,
          source: matchResult.scoringSource,
          result: matchResult
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      results.push({
        job,
        ...matchResult,
        preliminaryScore
      });
    } else {
      results.push({
        job,
        ...localEval,
        preliminaryScore,
        reason: 'Rule-based evaluation (limit exceeded)'
      });
    }
  }

  results.sort((a, b) => b.finalScore - a.finalScore);
  return results;
};
