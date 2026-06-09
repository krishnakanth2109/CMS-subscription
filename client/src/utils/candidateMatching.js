export const normalizeSkill = (skill) => {
  const compact = (skill || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
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

const toSkillArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/[,;\n]+/);
  return [];
};

export const getJobSkills = (job) =>
  (toSkillArray(job?.mandatorySkills).length ? toSkillArray(job?.mandatorySkills) : toSkillArray(job?.skills))
    .map((skill) => normalizeSkill(skill))
    .filter(Boolean);

export const getCandidateSkills = (candidate) => {
  if (Array.isArray(candidate?.skills)) return candidate.skills;
  if (typeof candidate?.skills === 'string') return candidate.skills.split(/[,;\n]+/);
  return [];
};

export const getMatchingCandidatesForJob = (job, candidates, minimumSkillHits = 3) => {
  const required = getJobSkills(job);
  if (!required.length) return [];

  const requiredSet = new Set(required);
  const requiredHits = Math.min(minimumSkillHits, requiredSet.size);
  return (candidates || []).filter((candidate) => {
    let hit = 0;
    for (const rawSkill of getCandidateSkills(candidate)) {
      const skill = normalizeSkill(rawSkill);
      if (!skill) continue;
      if (requiredSet.has(skill)) hit += 1;
      if (hit >= requiredHits) return true;
    }
    return false;
  });
};

export const getMatchingCandidatesByJobId = (jobs, candidates, minimumSkillHits = 3) =>
  (jobs || []).reduce((acc, job) => {
    acc[job.id || job._id] = getMatchingCandidatesForJob(job, candidates, minimumSkillHits);
    return acc;
  }, {});
