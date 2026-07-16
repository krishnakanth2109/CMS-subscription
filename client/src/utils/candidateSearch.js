export const normalizeValue = (value) =>
  String(value || '')
    .toLowerCase()
    .trim();

export const normalizeText = normalizeValue;

const splitDelimiterRegex = /[^a-z0-9#]+/i;

// These tokens must never be extracted as sub-parts from a longer compound token.
// e.g. 'java' must NOT be extracted from 'javascript'.
const subPartDenyList = new Set(['java', 'script']);

// Tokens in this set require an exact match during search (startsWith is not enough).
// e.g. searching 'java' should NOT match a candidate who only has 'javascript'.
const exactOnlySearchTokens = new Set(['java']);
const exactOnlyBadgeTokens = new Set(['java']);

// Keep legacy alias for any code that may reference the old name
const exactOnlyMultiSearchTokens = exactOnlySearchTokens;

const normalizeCompact = (value) =>
  normalizeValue(value).replace(/[^a-z0-9#]/g, '');

const techAliasTokens = {
  mysql: ['my', 'sql'],
  postgresql: ['postgres', 'postgre', 'sql'],
  postgres: ['postgresql', 'postgre', 'sql'],
  reactjs: ['react', 'js'],
  react: ['reactjs'],
  nodejs: ['node', 'js'],
  node: ['nodejs'],
  javascript: ['js'],
  js: ['javascript'],
};

const addToken = (tokens, token) => {
  const compact = normalizeCompact(token);
  if (!compact) return;

  tokens.add(compact);
  if (/^\d{11,}$/.test(compact)) tokens.add(compact.slice(-10));

  const alphaNumericParts = compact.match(/[a-z]+|\d+/g) || [];
  alphaNumericParts.forEach((part) => {
    if (!subPartDenyList.has(part)) tokens.add(part);
  });
};

const addKnownAliases = (tokens, token) => {
  (techAliasTokens[token] || []).forEach((alias) => tokens.add(alias));
};

const addPhraseCompoundTokens = (tokens, parts) => {
  if (parts.length < 2) return;
  for (let index = 0; index < parts.length - 1; index += 1) {
    addToken(tokens, `${parts[index]}${parts[index + 1]}`);
  }
};

export const tokenizeValue = (value) => {
  const tokens = new Set();
  const normalized = normalizeValue(value);
  if (!normalized) return [];

  const parts = normalized
    .split(splitDelimiterRegex)
    .filter(Boolean)
    .map(normalizeCompact)
    .filter(Boolean);

  parts.forEach((part) => addToken(tokens, part));
  addPhraseCompoundTokens(tokens, parts);

  addToken(tokens, normalized);

  [...tokens].forEach((token) => addKnownAliases(tokens, token));
  return [...tokens];
};

export const parseSearchQuery = (query) => {
  const seen = new Set();
  return normalizeValue(query)
    .split(splitDelimiterRegex)
    .map(normalizeCompact)
    .filter(Boolean)
    .filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
};

export const parseSearchTokens = parseSearchQuery;

export const normalizeSkills = (skills) => {
  if (Array.isArray(skills)) return skills;
  return String(skills || '').split(/[,;\n]+/);
};

const getSubmissionValue = (submission, key) => {
  const job = submission?.jobId && typeof submission.jobId === 'object' ? submission.jobId : {};
  return submission?.[key] || job?.[key] || '';
};

const getRecruiterValues = (candidate) => {
  const recruiter = candidate?.recruiterId && typeof candidate.recruiterId === 'object'
    ? candidate.recruiterId
    : {};

  return [
    candidate?.recruiterName,
    recruiter?.name,
    recruiter?.username,
    recruiter?.email,
    `${recruiter?.firstName || ''} ${recruiter?.lastName || ''}`.trim(),
  ];
};

const collectCandidateSearchValues = (candidate) => {
  const submissions = Array.isArray(candidate?.submissions) ? candidate.submissions : [];
  const statuses = Array.isArray(candidate?.status) ? candidate.status : [candidate?.status];

  const values = [
    candidate?.candidateId,
    candidate?.name,
    candidate?.firstName,
    candidate?.lastName,
    candidate?.email,
    candidate?.contact,
    candidate?.phone,
    candidate?.alternateNumber,
    candidate?.position,
    candidate?.currentRole,
    candidate?.role,
    candidate?.client,
    candidate?.currentCompany,
    candidate?.source,
    candidate?.currentLocation,
    candidate?.preferredLocation,
    candidate?.location,
    candidate?.totalExperience,
    candidate?.relevantExperience,
    candidate?.experience,
    ...normalizeSkills(candidate?.skills),
    ...getRecruiterValues(candidate),
    ...statuses,
  ];

  submissions.forEach((submission) => {
    values.push(
      submission?.clientName,
      submission?.client,
      submission?.jobCode,
      submission?.position,
      submission?.pipelineStage,
      submission?.status,
      submission?.recruiterName,
      submission?.location,
      getSubmissionValue(submission, 'clientName'),
      getSubmissionValue(submission, 'client'),
      getSubmissionValue(submission, 'jobCode'),
      getSubmissionValue(submission, 'position'),
      getSubmissionValue(submission, 'status'),
      getSubmissionValue(submission, 'pipelineStage'),
      getSubmissionValue(submission, 'recruiterName'),
      getSubmissionValue(submission, 'location')
    );
  });

  return values;
};

export const getCandidateSearchTokens = (candidate) => {
  const tokens = new Set();
  collectCandidateSearchValues(candidate).forEach((value) => {
    tokenizeValue(value).forEach((token) => tokens.add(token));
  });
  return [...tokens];
};

export const getCandidateSearchText = (candidate) =>
  getCandidateSearchTokens(candidate).join(' ');

export const candidateMatchesSearch = (candidate, searchQuery) => {
  const queryTokens = parseSearchQuery(searchQuery);
  if (queryTokens.length === 0) return true;

  const candidateTokens = getCandidateSearchTokens(candidate);
  return queryTokens.every((queryToken) => {
    if (exactOnlySearchTokens.has(queryToken)) {
      return candidateTokens.some((candidateToken) => candidateToken === queryToken);
    }
    return candidateTokens.some((candidateToken) => candidateToken.startsWith(queryToken));
  });
};

export const candidateMatchesKeywordBadges = (candidate, badges = []) => {
  const badgeTokens = [...new Set(
    (badges || [])
      .map(normalizeCompact)
      .filter(Boolean)
  )];
  if (badgeTokens.length === 0) return true;

  const candidateTokens = getCandidateSearchTokens(candidate);
  return badgeTokens.every((badge) => {
    if (exactOnlyBadgeTokens.has(badge)) {
      return candidateTokens.some((candidateToken) => candidateToken === badge);
    }
    return candidateTokens.some((candidateToken) => candidateToken.startsWith(badge));
  });
};
