import React from 'react';
import {
  X, Briefcase, GraduationCap, Calendar, MapPin, Users, Building2,
  ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { ScoreBadge, MatchBreakdownBar, SkillChips, MatchReasonBox, getScoreValue, getMatchLevelClass } from './Score/ScoreComponents';
import { useAuth } from '../context/AuthContext';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

const getHiddenFields = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    const user = stored ? JSON.parse(stored) : null;
    return user?.requirementSettings?.hiddenFields || [];
  } catch {
    return [];
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getDueDays = (tatTime) => {
  if (!tatTime) return null;
  const expiry = new Date(tatTime);
  if (Number.isNaN(expiry.getTime())) return null;
  expiry.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiry - today) / (1000 * 60 * 60 * 24));
};

const parseSkills = (skills) => {
  if (Array.isArray(skills)) return skills.map((s) => String(s).trim()).filter(Boolean);
  if (typeof skills === 'string') return skills.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  return [];
};

const Row = ({ label, value }) => (
  <p className="flex justify-between gap-4 text-sm">
    <span className="text-zinc-500 shrink-0">{label}</span>
    <span className="font-medium text-right text-zinc-900 dark:text-zinc-100">{value ?? '—'}</span>
  </p>
);

const Section = ({ title, icon: Icon, children }) => (
  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
    <h3 className="font-semibold text-base mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
      {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
      {title}
    </h3>
    <div className="space-y-2.5">{children}</div>
  </div>
);

/**
 * Shared job/requirement details modal for Admin, Manager, and Recruiter panels.
 * @param {{ job: object, onClose: () => void, stats?: { submitted?: number, matching?: number }, hiddenFields?: string[] }} props
 */
export default function JobDetailsModal({ job, onClose, stats, hiddenFields: hiddenFieldsProp }) {
  const { authHeaders } = useAuth();
  const [currentUser, setCurrentUser] = React.useState(null);
  const [isScoring, setIsScoring] = React.useState(false);
  const [scoredCandidates, setScoredCandidates] = React.useState(null);
  const [expandedCandidateId, setExpandedCandidateId] = React.useState(null);

  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem('currentUser');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  const handleScoreAll = async () => {
    setIsScoring(true);
    setScoredCandidates(null);
    setExpandedCandidateId(null);
    try {
      // Fetch all linked candidates (submissions) for this job
      const authHeader = await authHeaders();
      const subRes = await fetch(`${API_URL}/submissions?jobId=${job._id || job.id}`, { headers: authHeader });
      const submissions = await subRes.json();
      if (!subRes.ok) throw new Error(submissions.message || 'Failed to fetch submissions');

      const linkedCandidates = (Array.isArray(submissions) ? submissions : []).map(s => s.candidateId).filter(Boolean);
      
      if (linkedCandidates.length === 0) {
        setScoredCandidates([]);
        setIsScoring(false);
        return;
      }

      const scoreRes = await fetch(`${API_URL}/score-match/bulk`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirementId: job._id || job.id,
          candidateIds: linkedCandidates.map(c => c._id || c.id),
        })
      });
      const scorePayload = await scoreRes.json();
      if (!scoreRes.ok) throw new Error(scorePayload.message || 'Failed to score candidates');

      const candidatesById = new Map(linkedCandidates.map(c => [(c._id || c.id)?.toString(), c]));
      const candidatesWithScores = (scorePayload.scores || []).map((scoreData) => {
        const c = candidatesById.get(scoreData.candidateId?.toString());
        if (!c) return null;
        return { candidate: c, scoreData };
      }).filter(Boolean);
      
      setScoredCandidates(candidatesWithScores);
    } catch (err) {
      console.error("Error scoring candidates:", err);
      alert("Failed to score candidates.");
    } finally {
      setIsScoring(false);
    }
  };

  if (!job) return null;

  const hiddenFields = hiddenFieldsProp ?? getHiddenFields();
  const isHidden = (fieldId) => hiddenFields.includes(fieldId);

  const legacySkills = parseSkills(job.skills);
  const mandatorySkills = parseSkills(job.mandatorySkills).length ? parseSkills(job.mandatorySkills) : legacySkills;
  const preferredSkills = parseSkills(job.preferredSkills);
  const dueDays = getDueDays(job.tatTime);
  const isActive = job.active !== false;
  const statusLabel = isActive ? 'Active' : 'Inactive';
  const dueLabel = dueDays === null
    ? '—'
    : dueDays < 0
      ? `Expired (${Math.abs(dueDays)} day(s) ago)`
      : dueDays === 0
        ? 'Due today'
        : `${dueDays} day(s) remaining`;

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 text-white p-6 shrink-0 border-b border-zinc-700">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight truncate">{job.position || 'Job Requirement'}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-zinc-300 text-sm">
                <span className="bg-zinc-800 px-2 py-1 rounded-md border border-zinc-700 text-xs font-mono">{job.jobCode || '—'}</span>
                {job.clientName && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> {job.clientName}
                  </span>
                )}
                {job.jobType && (
                  <span className="bg-zinc-700 px-2 py-1 rounded-md text-xs">{job.jobType}</span>
                )}
                <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${isActive ? 'bg-green-900/40 border-green-700 text-green-200' : 'bg-red-900/40 border-red-700 text-red-200'}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {currentUser && ['admin', 'manager', 'master'].includes(currentUser.role) && (
                <button
                  type="button"
                  onClick={handleScoreAll}
                  disabled={isScoring}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  {isScoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Scoring...</> : 'Score All Candidates'}
                </button>
              )}
              <button type="button" onClick={onClose} className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto text-zinc-800 dark:text-zinc-300 flex-1">
          {/* Overview */}
          <Section title="Overview" icon={Briefcase}>
            <Row label="Job Code" value={job.jobCode} />
            <Row label="Role / Position" value={job.position} />
            <Row label="Client" value={job.clientName} />
            {job.department && <Row label="Department" value={job.department} />}
            <Row label="Job Type" value={job.jobType || '—'} />
            <Row label="Work Mode" value={job.interviewMode || job.workMode || '—'} />
            <Row label="Location" value={job.location} />
          </Section>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Requirements */}
            <Section title="Requirements" icon={GraduationCap}>
              <div className="text-sm">
                <span className="text-zinc-500 block mb-2">Mandatory Skills</span>
                {!isHidden('skills') && mandatorySkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {mandatorySkills.map((skill) => (
                      <span key={skill} className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="font-medium">—</span>
                )}
              </div>
              <div className="text-sm">
                <span className="text-zinc-500 block mb-2">Preferred Skills</span>
                {!isHidden('skills') && preferredSkills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {preferredSkills.map((skill) => (
                      <span key={skill} className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="font-medium">—</span>
                )}
              </div>
              <Row label="Experience Required" value={job.experience ? `${job.experience}` : '—'} />
              {!isHidden('relevantExperience') && (
                <Row label="Relevant Experience" value={job.relevantExperience || '—'} />
              )}
              {!isHidden('qualification') && (
                <Row label="Education" value={job.qualification || job.education || '—'} />
              )}
              {!isHidden('gender') && <Row label="Gender Preference" value={job.gender || 'Any'} />}
              {job.openPositions != null && job.openPositions !== '' && (
                <Row label="Open Positions" value={String(job.openPositions)} />
              )}
            </Section>

            {/* Compensation */}
            <Section title="Compensation" icon={Briefcase}>
              {!isHidden('salaryBudget') && (
                <Row label="Salary Range" value={job.salaryBudget || '—'} />
              )}
              {!isHidden('monthlySalary') && (
                <Row label="Monthly Salary" value={job.monthlySalary || '—'} />
              )}
              {job.currency && <Row label="Currency" value={job.currency} />}
              {!isHidden('noticePeriod') && (
                <Row label="Notice Period" value={job.noticePeriod || '—'} />
              )}
            </Section>
          </div>

          {/* Timeline */}
          <Section title="Timeline" icon={Calendar}>
            <Row label="Created Date" value={formatDate(job.createdAt || job.dateAdded)} />
            <Row label="Last Updated" value={formatDate(job.updatedAt)} />
            {!isHidden('tatTime') && (
              <>
                <Row label="Expiry Date" value={formatDate(job.tatTime)} />
                <Row label="Remaining Days" value={dueLabel} />
              </>
            )}
            <Row label="Status" value={statusLabel} />
          </Section>

          {/* Assignment & stats */}
          <Section title="Recruiter & Candidate Statistics" icon={Users}>
            {!isHidden('primaryRecruiter') && (
              <Row label="Primary Recruiter" value={job.primaryRecruiter || 'Unassigned'} />
            )}
            {!isHidden('secondaryRecruiter') && (
              <Row label="Secondary Recruiter" value={job.secondaryRecruiter || 'Unassigned'} />
            )}
            {stats?.submitted != null && (
              <Row label="Submitted Candidates" value={String(stats.submitted)} />
            )}
            {stats?.matching != null && (
              <Row label="Matching Candidates" value={String(stats.matching)} />
            )}
          </Section>

          {!isHidden('jobDescription') && job.jobDescription && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <h4 className="font-semibold mb-3 text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-zinc-500" /> Job Description
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{job.jobDescription}</p>
            </div>
          )}

          {(job.comments || job.notes || job.remarks) && (
            <Section title="Additional Information" icon={MapPin}>
              {job.comments && <Row label="Notes" value={job.comments} />}
              {job.notes && <Row label="Notes" value={job.notes} />}
              {job.remarks && <Row label="Remarks" value={job.remarks} />}
              <Row label="Created By" value={job.createdBy?.name || job.createdByName || (typeof job.createdBy === 'string' ? job.createdBy : '—')} />
            </Section>
          )}

          {job.customFields && Object.keys(job.customFields).filter((key) => !isHidden(key)).length > 0 && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
              <h3 className="font-semibold text-base mb-4 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">Custom Fields</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                {Object.entries(job.customFields).filter(([key]) => !isHidden(key)).map(([key, val]) => (
                  <Row
                    key={key}
                    label={key}
                    value={val === 'true' ? 'Yes' : val === 'false' ? 'No' : val || '—'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Scored Candidates Table */}
          {scoredCandidates !== null && (
            <Section title="Scored Linked Candidates" icon={Users}>
              {scoredCandidates.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">No candidates linked to this requirement.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2">
                  <table className="min-w-[700px] w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase text-zinc-500 font-semibold">
                      <tr>
                        <th className="px-4 py-3">Avatar</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Current Role</th>
                        <th className="px-4 py-3 text-center">Match Score</th>
                        <th className="px-4 py-3">Match Level</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {scoredCandidates.map(({ candidate, scoreData }, idx) => {
                        const id = candidate._id || candidate.id || idx;
                        const name = candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate';
                        const avatarLetter = name.charAt(0).toUpperCase();
                        const isExpanded = expandedCandidateId === id;

                        return (
                          <React.Fragment key={id}>
                            <tr className={`bg-white dark:bg-zinc-900 transition-colors ${isExpanded ? 'bg-zinc-50 dark:bg-zinc-800/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/20'}`}>
                              <td className="px-4 py-3 w-12">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-xs">{avatarLetter}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{name}</div>
                                <div className="text-xs text-zinc-400">{candidate.candidateId || candidate._id?.slice(-6).toUpperCase()}</div>
                              </td>
                              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{candidate.position || '—'}</td>
                              
                              <td className="px-4 py-3 text-center">
                                <ScoreBadge score={getScoreValue(scoreData)} />
                              </td>
                              <td className="px-4 py-3">
                                {scoreData?.matchLevel && (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getMatchLevelClass(scoreData.matchLevel, true)}`}>
                                    {scoreData.matchLevel}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {scoreData && (
                                  <button 
                                    onClick={() => setExpandedCandidateId(isExpanded ? null : id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                                  >
                                    {isExpanded ? 'Hide Breakdown' : 'View Breakdown'}
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </td>
                            </tr>
                            
                            {isExpanded && scoreData && (
                              <tr className="bg-zinc-50/80 dark:bg-zinc-900/50 border-t-0">
                                <td colSpan={6} className="px-6 py-5">
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div>
                                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        Score Breakdown
                                        <span className="text-xs font-normal text-zinc-500">(Out of 100)</span>
                                      </h4>
                                      <MatchBreakdownBar breakdown={scoreData.breakdown} />
                                    </div>
                                    <div className="space-y-4">
                                      <MatchReasonBox reason={scoreData.reason} flags={scoreData.atsFlags} />
                                      <SkillChips
                                        matched={scoreData.matchedSkills}
                                        missing={scoreData.missingSkills}
                                        matchedMandatory={scoreData.matchedMandatorySkills}
                                        missingMandatory={scoreData.missingMandatorySkills}
                                        matchedPreferred={scoreData.matchedPreferredSkills}
                                        missingPreferred={scoreData.missingPreferredSkills}
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

/** Clickable job code badge/button for tables and cards */
export function JobCodeButton({ jobCode, onClick, className = '' }) {
  if (!jobCode) return <span className="text-zinc-400">—</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      title="View job details"
      className={`inline-flex items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded text-xs border border-zinc-200 dark:border-zinc-700 font-mono font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors cursor-pointer ${className}`}
    >
      {jobCode}
    </button>
  );
}
