import { GoogleGenAI, Type } from '@google/genai';

const SCORE_WEIGHTS = {
  skills: 50,
  experience: 25,
  role: 10,
  education: 10,
  location: 5,
};

export const MATCH_SCORE_VERSION = 3;

const MATCH_LEVELS = [
  { min: 85, label: 'Excellent Match' },
  { min: 70, label: 'Good Match' },
  { min: 50, label: 'Average Match' },
  { min: 30, label: 'Weak Match' },
  { min: 0, label: 'Poor Match' },
];

const MATCH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    matchPercentage: { type: Type.NUMBER },
    matchLevel: {
      type: Type.STRING,
      enum: MATCH_LEVELS.map((item) => item.label),
    },
    matchedSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    missingSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    mandatorySkillScore: { type: Type.NUMBER },
    preferredSkillScore: { type: Type.NUMBER },
    experienceScore: { type: Type.NUMBER },
    roleScore: { type: Type.NUMBER },
    educationScore: { type: Type.NUMBER },
    locationScore: { type: Type.NUMBER },
    matchedMandatorySkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    missingMandatorySkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    matchedPreferredSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    missingPreferredSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    atsFlags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    breakdown: {
      type: Type.OBJECT,
      properties: {
        skills: { type: Type.NUMBER },
        experience: { type: Type.NUMBER },
        role: { type: Type.NUMBER },
        education: { type: Type.NUMBER },
        location: { type: Type.NUMBER },
      },
      required: ['skills', 'experience', 'role', 'education', 'location'],
    },
    reason: { type: Type.STRING },
  },
  required: ['matchPercentage', 'matchLevel', 'matchedMandatorySkills', 'missingMandatorySkills', 'matchedPreferredSkills', 'missingPreferredSkills', 'breakdown', 'reason'],
};

const MAX_TEXT_LENGTH = 4000;
const MAX_ARRAY_ITEMS = 25;
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_MATCH_TIMEOUT_MS || 15000);
const GEMINI_MODEL = process.env.GEMINI_MATCH_MODEL || 'gemini-2.5-flash';
const GEMINI_QUOTA_COOLDOWN_MS = Number(process.env.GEMINI_QUOTA_COOLDOWN_MS || 10 * 60 * 1000);
const GEMINI_QUOTA_MESSAGE = 'Gemini quota exceeded, using fallback score.';

let geminiClient;
let geminiQuotaCooldownUntil = 0;

const normalize = (value) => (value || '').toString().trim().toLowerCase();

const normalizeSkill = (value) => {
  const compact = normalize(value).replace(/[^a-z0-9]/g, '');
  const aliases = {
    reactjs: 'react',
    react: 'react',
    node: 'nodejs',
    nodejs: 'nodejs',
    mongo: 'mongodb',
    mongodb: 'mongodb',
    js: 'javascript',
    javascript: 'javascript',
  };
  return aliases[compact] || compact;
};

const clamp = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
};

const roundScore = (value) => Math.round(clamp(value, 0, 100));

const getMatchLevel = (score) => {
  const rounded = roundScore(score);
  return MATCH_LEVELS.find((item) => rounded >= item.min)?.label || 'Poor Match';
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',');
  return [];
};

const cleanText = (value, maxLength = MAX_TEXT_LENGTH) => {
  const text = (value || '').toString().replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const cleanStringArray = (value) =>
  asArray(value)
    .map((item) => cleanText(item, 120))
    .filter(Boolean)
    .slice(0, MAX_ARRAY_ITEMS);

const getMandatorySkills = (job = {}) => {
  const mandatorySkills = cleanStringArray(job.mandatorySkills);
  return mandatorySkills.length ? mandatorySkills : cleanStringArray(job.skills);
};

const getPreferredSkills = (job = {}) => cleanStringArray(job.preferredSkills);

export const toGeminiJobData = (job = {}) => ({
  role: cleanText(job.position, 150),
  location: cleanText(job.location, 150),
  experience: cleanText(job.experience || job.relevantExperience, 150),
  education: cleanText(job.qualification, 200),
  mandatorySkills: getMandatorySkills(job),
  preferredSkills: getPreferredSkills(job),
  description: cleanText(job.jobDescription, 800), // Severely truncate to save tokens
});

export const toGeminiCandidateData = (candidate = {}) => ({
  role: cleanText(candidate.position, 150),
  location: cleanText(candidate.currentLocation || candidate.preferredLocation, 150),
  experience: cleanText(candidate.totalExperience || candidate.relevantExperience, 150),
  education: cleanText(candidate.education || candidate.qualification, 200),
  skills: cleanStringArray(candidate.skills),
});

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (Date.now() < geminiQuotaCooldownUntil) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
};

const isGeminiQuotaError = (error) => {
  const status = error?.status || error?.code || error?.response?.status;
  const message = `${error?.message || ''} ${error?.statusText || ''}`.toLowerCase();
  return status === 429 ||
    message.includes('429') ||
    message.includes('resource_exhausted') ||
    message.includes('quota');
};

const markGeminiQuotaCooldown = () => {
  const nextCooldown = Date.now() + GEMINI_QUOTA_COOLDOWN_MS;
  const shouldLog = Date.now() >= geminiQuotaCooldownUntil;
  geminiQuotaCooldownUntil = Math.max(geminiQuotaCooldownUntil, nextCooldown);
  if (shouldLog) {
    console.warn(`${GEMINI_QUOTA_MESSAGE} Gemini calls paused temporarily.`);
  }
};

const buildPrompt = (jobData, candidateData) => `Compare this candidate with this job requirement and return ONLY valid JSON.

Scoring factors:
Mandatory Skills, Preferred Skills, Experience, Role, Education, Location.

Do not include salary or notice period.
Use this weighted breakdown only:
skills out of 50, experience out of 25, role out of 10, education out of 10, location out of 5.

Mandatory skills are must-have skills and preferred skills are good-to-have skills.
Calculate skills by averaging mandatory skill match percentage and preferred skill match percentage, then applying that average to 50 points.
If the job has no preferred skills, calculate the skills average from mandatory skills only.
If mandatory skill match is below 60%, include "Low Mandatory Skill Match" in atsFlags.

Return:
matchPercentage number 0-100,
matchLevel,
mandatorySkillScore percentage 0-100,
preferredSkillScore percentage 0-100,
experienceScore percentage 0-100,
roleScore percentage 0-100,
educationScore percentage 0-100,
locationScore percentage 0-100,
matchedMandatorySkills array,
missingMandatorySkills array,
matchedPreferredSkills array,
missingPreferredSkills array,
breakdown object,
atsFlags array,
reason short string.

Match levels:
85-100 = Excellent Match
70-84 = Good Match
50-69 = Average Match
30-49 = Weak Match
0-29 = Poor Match

Job:
${JSON.stringify(jobData)}

Candidate:
${JSON.stringify(candidateData)}`;

const parseGeminiJson = (text) => {
  const raw = (text || '').toString().trim();
  if (!raw) throw new Error('Gemini returned empty response');

  try {
    return JSON.parse(raw);
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini response was not JSON');
    return JSON.parse(jsonMatch[0]);
  }
};

export const sanitizeMatchResult = (raw, fallbackData = {}) => {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid match result');

  const breakdown = raw.breakdown && typeof raw.breakdown === 'object' ? raw.breakdown : {};
  const fallbackMandatoryPercent = breakdown.mandatorySkills != null
    ? (clamp(breakdown.mandatorySkills, 0, 40) / 40) * 100
    : SCORE_WEIGHTS.skills
      ? (clamp(breakdown.skills, 0, SCORE_WEIGHTS.skills) / SCORE_WEIGHTS.skills) * 100
      : 0;
  const fallbackPreferredPercent = breakdown.preferredSkills != null
    ? (clamp(breakdown.preferredSkills, 0, 10) / 10) * 100
    : SCORE_WEIGHTS.skills
      ? (clamp(breakdown.skills, 0, SCORE_WEIGHTS.skills) / SCORE_WEIGHTS.skills) * 100
      : 0;
  const mandatorySkillPercent = roundScore(raw.mandatorySkillScore ?? fallbackMandatoryPercent);
  const preferredSkillPercent = roundScore(raw.preferredSkillScore ?? fallbackPreferredPercent);
  const hasPreferredSignal = fallbackData.hasPreferredSkills ?? (raw.preferredSkillScore != null || breakdown.preferredSkills != null);
  const combinedSkillPercent = hasPreferredSignal
    ? Math.round((mandatorySkillPercent + preferredSkillPercent) / 2)
    : mandatorySkillPercent;

  const sanitizedBreakdown = {
    skills: Math.round((combinedSkillPercent / 100) * SCORE_WEIGHTS.skills),
    experience: Math.round(clamp(breakdown.experience, 0, SCORE_WEIGHTS.experience)),
    role: Math.round(clamp(breakdown.role, 0, SCORE_WEIGHTS.role)),
    education: Math.round(clamp(breakdown.education ?? breakdown.qualification, 0, SCORE_WEIGHTS.education)),
    location: Math.round(clamp(breakdown.location, 0, SCORE_WEIGHTS.location)),
  };
  const weightedTotal = Object.values(sanitizedBreakdown).reduce((sum, value) => sum + value, 0);
  const hasBreakdown = Object.keys(breakdown).length > 0;
  const matchPercentage = roundScore(hasBreakdown ? weightedTotal : (raw.matchPercentage ?? raw.totalScore ?? weightedTotal));
  const matchedMandatorySkills = cleanStringArray(raw.matchedMandatorySkills);
  const missingMandatorySkills = cleanStringArray(raw.missingMandatorySkills);
  const matchedPreferredSkills = cleanStringArray(raw.matchedPreferredSkills);
  const missingPreferredSkills = cleanStringArray(raw.missingPreferredSkills);

  const sanitized = {
    scoreVersion: MATCH_SCORE_VERSION,
    matchPercentage,
    totalScore: matchPercentage,
    matchLevel: getMatchLevel(matchPercentage),
    skillScore: combinedSkillPercent,
    mandatorySkillScore: mandatorySkillPercent,
    preferredSkillScore: preferredSkillPercent,
    experienceScore: roundScore(raw.experienceScore ?? (SCORE_WEIGHTS.experience ? (sanitizedBreakdown.experience / SCORE_WEIGHTS.experience) * 100 : 0)),
    roleScore: roundScore(raw.roleScore ?? (SCORE_WEIGHTS.role ? (sanitizedBreakdown.role / SCORE_WEIGHTS.role) * 100 : 0)),
    educationScore: roundScore(raw.educationScore ?? (SCORE_WEIGHTS.education ? (sanitizedBreakdown.education / SCORE_WEIGHTS.education) * 100 : 0)),
    locationScore: roundScore(raw.locationScore ?? (SCORE_WEIGHTS.location ? (sanitizedBreakdown.location / SCORE_WEIGHTS.location) * 100 : 0)),
    matchedMandatorySkills,
    missingMandatorySkills,
    matchedPreferredSkills,
    missingPreferredSkills,
    matchedSkills: cleanStringArray(raw.matchedSkills).length
      ? cleanStringArray(raw.matchedSkills)
      : [...matchedMandatorySkills, ...matchedPreferredSkills],
    missingSkills: cleanStringArray(raw.missingSkills).length
      ? cleanStringArray(raw.missingSkills)
      : [...missingMandatorySkills, ...missingPreferredSkills],
    breakdown: sanitizedBreakdown,
    atsFlags: cleanStringArray(raw.atsFlags),
    reason: cleanText(raw.reason, 300) || 'Candidate match was evaluated against mandatory skills, preferred skills, experience, role, education, and location.',
    source: fallbackData.source || 'gemini',
  };

  if (fallbackData.candidateId) sanitized.candidateId = fallbackData.candidateId;
  if (fallbackData.candidateName) sanitized.candidateName = fallbackData.candidateName;
  if (fallbackData.requirementId) sanitized.requirementId = fallbackData.requirementId;
  if (fallbackData.jobRole) sanitized.jobRole = fallbackData.jobRole;
  if (fallbackData.error) sanitized.error = fallbackData.error;
  if (fallbackData.message) sanitized.message = fallbackData.message;

  return sanitized;
};

const parseExperienceTokenToMonths = (token) => {
  const raw = token?.toString() || '';
  const number = Number(raw);
  if (!Number.isFinite(number)) return 0;
  const decimalMatch = raw.match(/^(\d+)\.(\d{1,2})$/);
  if (decimalMatch) {
    const years = Number(decimalMatch[1]);
    const months = Number(decimalMatch[2]);
    if (months > 0 && months <= 11) return (years * 12) + months;
  }
  return number * 12;
};

const parseExperienceMonths = (value) => {
  const text = (value || '').toString().toLowerCase();
  if (!text.trim()) return 0;

  let months = 0;
  const yearMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|yr)\b/g)];
  const monthMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:months?|mos?|mo)\b/g)];
  yearMatches.forEach((match) => { months += parseExperienceTokenToMonths(match[1]); });
  monthMatches.forEach((match) => { months += Number(match[1]) || 0; });
  if (months > 0) return months;

  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? parseExperienceTokenToMonths(match[0]) : 0;
};

const getRequiredExperienceRange = (job = {}) => {
  const values = (job.experience || job.relevantExperience || '').toString().match(/\d+(?:\.\d+)?/g);
  if (!values?.length) return { min: 0, max: 0 };
  return {
    min: parseExperienceTokenToMonths(values[0]),
    max: parseExperienceTokenToMonths(values[1] || values[0]),
  };
};

const formatList = (list) => {
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return list.join(' and ');
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
};

export const buildFallbackMatchResult = (candidate = {}, job = {}, error = null) => {
  const candidateSkills = cleanStringArray(candidate.skills);
  const mandatorySkills = getMandatorySkills(job);
  const preferredSkills = getPreferredSkills(job);
  const candidateSkillSet = new Set(candidateSkills.map(normalizeSkill));
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

  const mandatorySkillPercent = mandatorySkills.length
    ? (matchedMandatorySkills.length / mandatorySkills.length) * 100
    : 100;
  const preferredSkillPercent = preferredSkills.length
    ? (matchedPreferredSkills.length / preferredSkills.length) * 100
    : mandatorySkillPercent;
  const combinedSkillPercent = preferredSkills.length
    ? (mandatorySkillPercent + preferredSkillPercent) / 2
    : mandatorySkillPercent;
  const skillsScore = (combinedSkillPercent / 100) * SCORE_WEIGHTS.skills;

  const candidateExperienceMonths = parseExperienceMonths(
    candidate.totalExperience || candidate.relevantExperience || candidate.experience
  );
  const { max } = getRequiredExperienceRange(job);
  const experienceScore = max > 0
    ? Math.min((candidateExperienceMonths / max) * SCORE_WEIGHTS.experience, SCORE_WEIGHTS.experience)
    : SCORE_WEIGHTS.experience;

  const candidateRole = normalize(candidate.position);
  const jobRole = normalize(job.position);
  const roleScore = candidateRole && jobRole && (candidateRole.includes(jobRole) || jobRole.includes(candidateRole))
    ? SCORE_WEIGHTS.role
    : 0;

  const candidateEducation = normalize(candidate.education || candidate.qualification);
  const jobEducation = normalize(job.qualification || job.education);
  const educationScore = !jobEducation || (
    candidateEducation &&
    (candidateEducation.includes(jobEducation) || jobEducation.includes(candidateEducation))
  )
    ? SCORE_WEIGHTS.education
    : 0;

  const candidateLocation = normalize(candidate.currentLocation || candidate.preferredLocation);
  const jobLocation = normalize(job.location);
  const locationScore = !jobLocation || (
    candidateLocation &&
    (candidateLocation.includes(jobLocation) || jobLocation.includes(candidateLocation))
  )
    ? SCORE_WEIGHTS.location
    : 0;

  const matchPercentage = roundScore(skillsScore + experienceScore + roleScore + educationScore + locationScore);
  const passed = [];
  const failed = [];
  if (mandatorySkillPercent >= 60) passed.push('mandatory skills'); else failed.push('mandatory skills');
  if (!preferredSkills.length || preferredSkillPercent >= 50) passed.push('preferred skills'); else failed.push('preferred skills');
  if (experienceScore >= SCORE_WEIGHTS.experience * 0.5) passed.push('experience'); else failed.push('experience');
  if (roleScore > 0) passed.push('role'); else failed.push('role');
  if (educationScore > 0) passed.push('education'); else failed.push('education');
  if (locationScore > 0) passed.push('location'); else failed.push('location');
  const atsFlags = mandatorySkills.length && mandatorySkillPercent < 60 ? ['Low Mandatory Skill Match'] : [];

  const reasonParts = [];
  if (passed.length) reasonParts.push(`Candidate matches ${formatList(passed)} criteria.`);
  if (failed.length) reasonParts.push(`Gaps found in ${formatList(failed)}.`);

  const isQuotaFallback = isGeminiQuotaError(error);

  return sanitizeMatchResult({
    matchPercentage,
    skillScore: combinedSkillPercent,
    mandatorySkillScore: mandatorySkillPercent,
    preferredSkillScore: preferredSkillPercent,
    experienceScore: SCORE_WEIGHTS.experience ? (experienceScore / SCORE_WEIGHTS.experience) * 100 : 0,
    roleScore: SCORE_WEIGHTS.role ? (roleScore / SCORE_WEIGHTS.role) * 100 : 0,
    educationScore: SCORE_WEIGHTS.education ? (educationScore / SCORE_WEIGHTS.education) * 100 : 0,
    locationScore: SCORE_WEIGHTS.location ? (locationScore / SCORE_WEIGHTS.location) * 100 : 0,
    matchedMandatorySkills,
    missingMandatorySkills,
    matchedPreferredSkills,
    missingPreferredSkills,
    matchedSkills: [...matchedMandatorySkills, ...matchedPreferredSkills],
    missingSkills: [...missingMandatorySkills, ...missingPreferredSkills],
    breakdown: {
      skills: skillsScore,
      experience: experienceScore,
      role: roleScore,
      education: educationScore,
      location: locationScore,
    },
    atsFlags,
    reason: reasonParts.join(' ') || 'Candidate match was evaluated with available data.',
  }, {
    candidateId: candidate._id?.toString(),
    candidateName: candidate.name,
    requirementId: job._id?.toString(),
    jobRole: job.position,
    source: 'fallback',
    error: error ? cleanText(isQuotaFallback ? GEMINI_QUOTA_MESSAGE : (error.message || error), 200) : undefined,
    message: isQuotaFallback ? GEMINI_QUOTA_MESSAGE : undefined,
  });
};

const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini scoring timed out')), GEMINI_TIMEOUT_MS);
    }),
  ]);

export const scoreCandidateForJob = async (candidate, job) => {
  const fallbackMeta = {
    candidateId: candidate._id?.toString(),
    candidateName: candidate.name,
    requirementId: job._id?.toString(),
    jobRole: job.position,
    hasPreferredSkills: getPreferredSkills(job).length > 0,
  };

  try {
    const ai = getGeminiClient();
    if (!ai) {
      if (Date.now() < geminiQuotaCooldownUntil) {
        return buildFallbackMatchResult(candidate, job, new Error(GEMINI_QUOTA_MESSAGE));
      }
      return buildFallbackMatchResult(candidate, job, new Error('GEMINI_API_KEY is not configured'));
    }

    const response = await withTimeout(ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(toGeminiJobData(job), toGeminiCandidateData(candidate)),
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: MATCH_SCHEMA,
      },
    }));

    const parsed = parseGeminiJson(response.text);
    return sanitizeMatchResult(parsed, fallbackMeta);
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      markGeminiQuotaCooldown();
      return buildFallbackMatchResult(candidate, job, error);
    }
    console.warn('Gemini match scoring fallback:', error.message);
    return buildFallbackMatchResult(candidate, job, error);
  }
};

export const scoreCandidatesForJob = async (candidates, job, concurrency = 3) => {
  const queue = [...candidates];
  const results = [];

  const worker = async () => {
    while (queue.length) {
      const candidate = queue.shift();
      if (!candidate) continue;
      results.push(await scoreCandidateForJob(candidate, job));
    }
  };

  const workerCount = Math.min(Math.max(1, concurrency), Math.max(1, queue.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));
};
