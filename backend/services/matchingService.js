import Job from '../models/Job.js';

const SCORE_WEIGHTS = { skills: 50, experience: 25, role: 10, education: 10, location: 5 };

const MATCH_LEVELS = [
  { min: 85, label: 'Excellent Match' },
  { min: 70, label: 'Good Match' },
  { min: 50, label: 'Average Match' },
  { min: 30, label: 'Weak Match' },
  { min: 0, label: 'Poor Match' },
];

const normalize = (val) => (val || '').toString().trim().toLowerCase();

export const normalizeSkillLocal = (val) => {
  if (!val) return '';
  const clean = val.toLowerCase().trim();
  const compact = clean.replace(/[\s\.\-_]/g, '');
  const aliases = {
    reactjs: 'react',
    react: 'react',
    'react.js': 'react',
    nodejs: 'node',
    node: 'node',
    'node.js': 'node',
    expressjs: 'express',
    express: 'express',
    'express.js': 'express',
    mongodb: 'mongodb',
    mongo: 'mongodb',
    postgres: 'postgresql',
    postgresql: 'postgresql',
    tailwindcss: 'tailwind',
    tailwind: 'tailwind',
    javascript: 'javascript',
    js: 'javascript',
    typescript: 'typescript',
    ts: 'typescript'
  };
  return aliases[compact] || compact;
};

const normalizeSkill = (val) => {
  const compact = normalize(val).replace(/[^a-z0-9]/g, '');
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

const toArr = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
  return [];
};

export const evaluateLocalRoleRelevance = (candidateRole, jobRole) => {
  const c = (candidateRole || '').toLowerCase().trim();
  const j = (jobRole || '').toLowerCase().trim();
  if (!c || !j) return { level: 'none', score: 0 };
  
  if (c === j) return { level: 'exact', score: 20 };
  
  const cleanRole = (role) => {
    return role
      .replace(/[\s\.\-_]+/g, ' ')
      .replace(/\b(sr|jr|senior|junior|lead|expert|intern|fresher|trainee|associate)\b/gi, '')
      .trim();
  };
  
  const cClean = cleanRole(c);
  const jClean = cleanRole(j);
  
  if (cClean === jClean) return { level: 'exact', score: 20 };
  
  if (cClean.includes(jClean) || jClean.includes(cClean)) return { level: 'strong', score: 14 };
  
  const frontendRoles = ['frontend', 'front end', 'react', 'angular', 'vue', 'ui'];
  const backendRoles = ['backend', 'back end', 'node', 'express', 'python', 'java', 'golang', 'php', '.net'];
  const fullstackRoles = ['fullstack', 'full stack', 'mern', 'mean', 'web developer'];
  const devopsRoles = ['devops', 'dev ops', 'sre', 'system admin', 'cloud'];
  
  const inGroup = (role, group) => group.some(term => role.includes(term));
  
  if ((inGroup(cClean, devopsRoles) && !inGroup(jClean, devopsRoles)) || 
      (inGroup(jClean, devopsRoles) && !inGroup(cClean, devopsRoles))) {
    return { level: 'none', score: 0 };
  }
  
  if ((cClean.includes('node') && jClean.includes('backend')) || (jClean.includes('node') && cClean.includes('backend'))) {
    return { level: 'strong', score: 14 };
  }
  if ((cClean.includes('react') && jClean.includes('frontend')) || (jClean.includes('react') && cClean.includes('frontend'))) {
    return { level: 'strong', score: 14 };
  }
  if ((cClean.includes('mern') && jClean.includes('full stack')) || (cClean.includes('mern') && jClean.includes('fullstack')) ||
      (jClean.includes('mern') && cClean.includes('full stack')) || (jClean.includes('mern') && cClean.includes('fullstack'))) {
    return { level: 'strong', score: 14 };
  }
  if (cClean.includes('mern') || jClean.includes('mern')) {
    const other = cClean.includes('mern') ? jClean : cClean;
    if (other.includes('react') || other.includes('node') || other.includes('frontend') || other.includes('backend') || other.includes('fullstack') || other.includes('full stack')) {
      return { level: 'strong', score: 14 };
    }
  }
  
  const ignoreWords = ['developer', 'engineer', 'analyst', 'specialist', 'stack', 'tech', 'technology', 'role', 'consultant'];
  const cWords = cClean.split(/\s+/).filter(w => w.length > 1 && !ignoreWords.includes(w));
  const jWords = jClean.split(/\s+/).filter(w => w.length > 1 && !ignoreWords.includes(w));
  
  const common = cWords.filter(w => jWords.includes(w));
  if (common.length > 0) {
    return { level: 'partial', score: 10 };
  }
  
  return { level: 'none', score: 0 };
};

export const isJobMatchingCandidate = (candidate, job) => {
  const cSkills = toArr(candidate.skills);
  const jMandatory = toArr(job.mandatorySkills).length ? toArr(job.mandatorySkills) : toArr(job.skills);
  
  const candidateSkillSet = new Set(cSkills.map(normalizeSkillLocal).filter(Boolean));
  const matchedMandatorySkills = jMandatory.filter(skill => candidateSkillSet.has(normalizeSkillLocal(skill)));
  
  const totalMandatorySkills = jMandatory.length;
  const requiredSkillMatches = Math.min(3, totalMandatorySkills);
  
  const skillsMatch = totalMandatorySkills > 0 && matchedMandatorySkills.length >= requiredSkillMatches;
  
  const roleRelevance = evaluateLocalRoleRelevance(candidate.position, job.position);
  const roleMatch = roleRelevance.level !== 'none' && roleRelevance.level !== 'weak';
  
  return skillsMatch || roleMatch;
};

export const getMatchingJobsCountForCandidates = async (candidates, user) => {
  if (!candidates || candidates.length === 0) return {};
  
  const jobQuery = { active: true };
  if (user && user.role === 'recruiter') {
    const possibleNames = [
      (user.firstName && user.lastName) ? `${user.firstName} ${user.lastName}` : null,
      user.name, user.fullName, user.username, user.email
    ].filter(Boolean);

    jobQuery.$or = [
      { primaryRecruiter: { $in: possibleNames } },
      { secondaryRecruiter: { $in: possibleNames } }
    ];
  }
  
  const jobs = await Job.find(jobQuery)
    .select('_id position mandatorySkills skills active clientName location')
    .lean();
    
  const counts = {};
  for (const candidate of candidates) {
    let count = 0;
    for (const job of jobs) {
      if (isJobMatchingCandidate(candidate, job)) {
        count++;
      }
    }
    counts[candidate._id.toString()] = count;
  }
  return counts;
};

const parseExperienceToMonths = (token) => {
  const raw = token?.toString() || '';
  const number = Number(raw);
  if (Number.isFinite(number)) return number * 12;
  const decimalMatch = raw.match(/^(\d+)\.(\d{1,2})$/);
  if (decimalMatch) return Number(decimalMatch[1]) * 12 + Number(decimalMatch[2]);
  return 0;
};

const parseExperienceMonths = (value) => {
  const text = normalize(value);
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

const formatList = (list) => {
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return list.join(' and ');
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
};

const parseQualifications = (value) => {
  if (!value) return [];
  return value
    .toString()
    .split(/[,/]+/)
    .map((qualification) => qualification.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
};

export const buildFallbackMatchResult = (candidate, job) => {
  const candidateSkills = toArr(candidate.skills);
  const mandatorySkills = toArr(job.mandatorySkills).length ? toArr(job.mandatorySkills) : toArr(job.skills);
  const preferredSkills = toArr(job.preferredSkills);

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

  const candidateMonths = parseExperienceMonths(candidate.totalExperience || candidate.experience);
  const { max } = getRequiredExperienceRange(job);
  const experienceScore = max > 0
    ? Math.min((candidateMonths / max) * SCORE_WEIGHTS.experience, SCORE_WEIGHTS.experience)
    : SCORE_WEIGHTS.experience;

  const candidateRole = normalize(candidate.position);
  const jobRole = normalize(job.position);
  const roleScore = candidateRole && jobRole && (candidateRole.includes(jobRole) || jobRole.includes(candidateRole))
    ? SCORE_WEIGHTS.role
    : 0;

  const candidateEduList = parseQualifications(candidate.education || candidate.qualification);
  const jobEduList = parseQualifications(job.qualification || job.education);
  const educationScore = !jobEduList.length || candidateEduList.some((candidateEdu) => (
    jobEduList.some((jobEdu) => candidateEdu.includes(jobEdu) || jobEdu.includes(candidateEdu))
  ))
    ? SCORE_WEIGHTS.education
    : 0;

  const candidateLocations = [
    candidate.currentLocation,
    candidate.preferredLocation,
  ].map(normalize).filter(Boolean);
  const jobLoc = normalize(job.location);
  const locationScore = !jobLoc || candidateLocations.some((loc) => loc.includes(jobLoc) || jobLoc.includes(loc))
    ? SCORE_WEIGHTS.location
    : 0;

  const matchPercentage = Math.round(skillsScore + experienceScore + roleScore + educationScore + locationScore);
  const matchLevel = MATCH_LEVELS.find((level) => matchPercentage >= level.min)?.label || 'Poor Match';

  const passed = [];
  const failed = [];
  if (mandatorySkillPercent >= 60) passed.push('mandatory skills');
  else failed.push('mandatory skills');
  if (!preferredSkills.length || preferredSkillPercent >= 50) passed.push('preferred skills');
  else failed.push('preferred skills');
  if (experienceScore >= SCORE_WEIGHTS.experience * 0.5) passed.push('experience');
  else failed.push('experience');
  if (roleScore > 0) passed.push('role');
  else failed.push('role');
  if (educationScore > 0) passed.push('education');
  else failed.push('education');
  if (locationScore > 0) passed.push('location');
  else failed.push('location');

  const reasonParts = [];
  if (passed.length) reasonParts.push(`Candidate matches ${formatList(passed)} criteria.`);
  if (failed.length) reasonParts.push(`Gaps found in ${formatList(failed)}.`);

  return {
    scoreVersion: 3,
    matchPercentage,
    totalScore: matchPercentage,
    matchLevel,
    skillScore: Math.round(combinedSkillPercent),
    mandatorySkillScore: Math.round(mandatorySkillPercent),
    preferredSkillScore: Math.round(preferredSkillPercent),
    experienceScore: Math.round((experienceScore / SCORE_WEIGHTS.experience) * 100),
    roleScore: Math.round((roleScore / SCORE_WEIGHTS.role) * 100),
    educationScore: Math.round((educationScore / SCORE_WEIGHTS.education) * 100),
    locationScore: Math.round((locationScore / SCORE_WEIGHTS.location) * 100),
    matchedMandatorySkills,
    missingMandatorySkills,
    matchedPreferredSkills,
    missingPreferredSkills,
    matchedSkills: [...matchedMandatorySkills, ...matchedPreferredSkills],
    missingSkills: [...missingMandatorySkills, ...missingPreferredSkills],
    breakdown: {
      skills: Math.round(skillsScore),
      experience: Math.round(experienceScore),
      role: Math.round(roleScore),
      education: Math.round(educationScore),
      location: Math.round(locationScore),
    },
    atsFlags: mandatorySkills.length && mandatorySkillPercent < 60 ? ['Low Mandatory Skill Match'] : [],
    reason: reasonParts.join(' ') || 'Evaluation completed successfully.',
    source: 'fallback',
  };
};
