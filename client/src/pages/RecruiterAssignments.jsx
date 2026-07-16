// --- START OF FILE RecruiterAssignments.jsx ---
import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/AuthContext";
import {
  BriefcaseIcon, MapPinIcon, CurrencyDollarIcon,
  Squares2X2Icon, ListBulletIcon, EyeIcon, XMarkIcon, 
  BuildingOfficeIcon, PlusIcon, UserGroupIcon, MagnifyingGlassIcon,
  TrashIcon, UserCircleIcon, CheckCircleIcon
} from "@heroicons/react/24/outline";
import { useToast } from "@/hooks/use-toast";
import { MatchBreakdownBar, ScoreBadge, SkillChips } from "@/components/Score/ScoreComponents";
import { getMatchingCandidatesByJobId } from "@/utils/candidateMatching";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ModalPortal = ({ children }) => {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
};

// ── Plain Tailwind UI Helpers ────────────────────────────────────────────────

const Badge = ({ children, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);

const getTatBadge = (tatTime) => {
  if (!tatTime) return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">N/A</Badge>;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(tatTime);
  target.setHours(0,0,0,0);
  
  const diffDays = Math.round((target - today) / (1000 * 3600 * 24));

  if (diffDays < 0) return <Badge className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">Expired</Badge>;
  if (diffDays === 0) return <Badge className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">Expires Today</Badge>;
  if (diffDays <= 3) return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30">Due: {diffDays}d</Badge>;
  return <Badge className="bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">{diffDays} days left</Badge>;
};

// Helper to format Date
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Modal component
const Modal = ({ open, onClose, children, maxWidth = 'max-w-2xl' }) => {
  if (!open) return null;
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className={`relative bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800`}>
        {children}
      </div>
    </div>
    </ModalPortal>
  );
};

const ModalHeader = ({ children }) => <div className="px-6 pt-6 pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-4">{children}</div>;
const ModalTitle = ({ children }) => <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{children}</h2>;
const ModalDesc = ({ children }) => <p className="text-sm text-zinc-500 mt-1 pb-4">{children}</p>;
const ModalFooter = ({ children }) => <div className="px-6 pb-6 pt-4 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800 mt-4">{children}</div>;
const ModalBody = ({ children }) => <div className="px-6 py-2">{children}</div>;

const getCandidateDetailName = (candidate = {}) => (
  candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate'
);

const getCandidateDetailCode = (candidate = {}) => (
  candidate.candidateId || candidate._id?.slice(-6)?.toUpperCase() || candidate.id?.slice?.(-6)?.toUpperCase?.() || 'N/A'
);

const normalizeCandidateSkills = (skills) => {
  if (Array.isArray(skills)) return skills.filter(Boolean);
  if (typeof skills === 'string') return skills.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
  return [];
};

const getCandidateStatusList = (candidate = {}) => {
  if (Array.isArray(candidate.status)) return candidate.status.filter(Boolean);
  return candidate.status ? [candidate.status] : ['Pipeline'];
};

const CandidateDetailRow = ({ label, value, children }) => (
  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
    <div className="mt-1 break-words text-sm font-semibold text-zinc-900 dark:text-white">{children || value || 'N/A'}</div>
  </div>
);

const CandidateDetailsModal = ({ candidate, onClose }) => {
  if (!candidate) return null;

  const skills = normalizeCandidateSkills(candidate.skills);
  const statuses = getCandidateStatusList(candidate);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Candidate Details</p>
            <h3 className="mt-1 break-words text-xl font-bold text-zinc-900 dark:text-white">{getCandidateDetailName(candidate)}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {getCandidateDetailCode(candidate)}
              </span>
              {statuses.map((status) => (
                <span key={status} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                  {status}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto bg-zinc-50 p-5 dark:bg-zinc-950">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="mb-4 text-sm font-bold text-zinc-900 dark:text-white">Contact</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <CandidateDetailRow label="Email" value={candidate.email} />
                <CandidateDetailRow label="Phone" value={candidate.contact || candidate.phone} />
                <CandidateDetailRow label="Alternate Number" value={candidate.alternateNumber} />
                <CandidateDetailRow label="LinkedIn">
                  {candidate.linkedin ? <a href={candidate.linkedin} target="_blank" rel="noopener noreferrer" className="break-all text-blue-700 hover:underline dark:text-blue-300">{candidate.linkedin}</a> : 'N/A'}
                </CandidateDetailRow>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="mb-4 text-sm font-bold text-zinc-900 dark:text-white">Profile</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <CandidateDetailRow label="Current Role" value={candidate.position} />
                <CandidateDetailRow label="Current Company" value={candidate.currentCompany} />
                <CandidateDetailRow label="Current Location" value={candidate.currentLocation} />
                <CandidateDetailRow label="Preferred Location" value={candidate.preferredLocation} />
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="mb-4 text-sm font-bold text-zinc-900 dark:text-white">Experience & Salary</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <CandidateDetailRow label="Total Experience" value={candidate.totalExperience ? `${candidate.totalExperience} Years` : ''} />
                <CandidateDetailRow label="Relevant Experience" value={candidate.relevantExperience ? `${candidate.relevantExperience} Years` : ''} />
                <CandidateDetailRow label="Current CTC" value={candidate.ctc} />
                <CandidateDetailRow label="Expected CTC" value={candidate.ectc} />
                <CandidateDetailRow label="Notice Period" value={candidate.noticePeriod} />
                <CandidateDetailRow label="Source" value={candidate.source} />
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="mb-4 text-sm font-bold text-zinc-900 dark:text-white">Skills</h4>
              {skills.length ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span key={skill} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No skills added.</p>
              )}
            </section>
          </div>

          {candidate.remarks && (
            <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Remarks</h4>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600 dark:text-zinc-300">{candidate.remarks}</p>
            </section>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

const CandidateMatchesModal = ({
  job,
  mode,
  rows,
  loading,
  expandedCandidateId,
  onToggleCandidate,
  onClose,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  if (!job) return null;

  const title = mode === 'matching' ? 'Matching Candidates' : 'Submitted Candidates';
  const emptyText = mode === 'matching'
    ? 'No candidates meet the minimum skill-match threshold for this requirement.'
    : 'No candidates have been submitted to this requirement yet.';
  const getCandidateName = (candidate = {}) => (
    candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate'
  );

  return (
    <Modal open={Boolean(job)} onClose={onClose} maxWidth="max-w-5xl">
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
        <ModalDesc>{job.jobCode} • {job.position} • {job.clientName}</ModalDesc>
      </ModalHeader>
      <ModalBody>
        {loading ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 text-zinc-500">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100" />
            Loading candidates...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((item) => {
              const candidate = item.candidate || {};
              const candidateId = item.id || candidate._id || candidate.id;
              const score = item.scoreData;
              const expanded = expandedCandidateId === candidateId;

                return (
                  <div key={candidateId} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidate(candidate)}
                            className="text-left font-semibold text-zinc-900 underline-offset-4 hover:text-blue-700 hover:underline dark:text-white dark:hover:text-blue-300"
                            title="Open candidate details"
                          >
                            {getCandidateName(candidate)}
                          </button>
                          {candidate.candidateId && (
                            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-500 dark:bg-zinc-800">
                              {candidate.candidateId}
                            </span>
                          )}
                          {item.status && (
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                              {item.status}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">
                          {candidate.position || 'No role'} • {candidate.totalExperience || 'Experience not set'} • {candidate.currentLocation || candidate.preferredLocation || 'Location not set'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {score && (
                          <>
                            {score.eligibleForAI === false ? (
                              <span className="rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 px-2.5 py-1 text-xs font-semibold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                                Not shortlisted for AI scoring
                              </span>
                            ) : (
                              <>
                                <ScoreBadge score={score.matchPercentage} />
                                <span className="text-xs font-semibold text-zinc-500">{score.matchLevel}</span>
                              </>
                            )}
                          </>
                        )}
                        {score && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onToggleCandidate(expanded ? null : candidateId)}
                          >
                            {expanded ? 'Hide Details' : 'Details'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {score && expanded && (
                      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800 space-y-4">
                        {score.scoringSource === 'fallback' && (
                          <div className="rounded-lg bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800/50">
                            AI analysis unavailable. Showing rule-based score.
                          </div>
                        )}
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Match Overview</h4>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">{score.reason}</p>
                            
                            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                              <div className="text-xs">
                                <span className="text-zinc-400 block uppercase font-bold tracking-wider text-[10px]">Role Match</span>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm capitalize">{score.roleMatchLevel || 'N/A'}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-zinc-400 block uppercase font-bold tracking-wider text-[10px]">Experience</span>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{score.experienceMatch || 'N/A'}</span>
                              </div>
                              <div className="text-xs mt-2">
                                <span className="text-zinc-400 block uppercase font-bold tracking-wider text-[10px]">Qualification</span>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{score.qualificationMatch || 'N/A'}</span>
                              </div>
                              <div className="text-xs mt-2">
                                <span className="text-zinc-400 block uppercase font-bold tracking-wider text-[10px]">Scoring Model</span>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold border mt-0.5 ${score.scoringSource === 'groq' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' : 'bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                                  {score.scoringSource === 'groq' ? 'Groq AI scored' : 'Deterministic'}
                                </span>
                              </div>
                            </div>

                            {score.breakdown && (
                              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                <MatchBreakdownBar breakdown={score.breakdown} />
                              </div>
                            )}
                          </div>
                          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <h4 className="text-sm font-bold text-zinc-950 dark:text-white mb-3">Skill Alignments</h4>
                            <SkillChips
                              matchedMandatory={score.matchedMandatorySkills}
                              missingMandatory={score.missingMandatorySkills}
                              matchedPreferred={score.matchedPreferredSkills}
                              missingPreferred={score.missingPreferredSkills}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
            })}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Close</Button>
      </ModalFooter>
      <CandidateDetailsModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
    </Modal>
  );
};

const Button = ({ children, onClick, disabled, className = '', variant = 'default', size = 'md' }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none shadow-sm';
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-4 py-2 text-sm', icon: 'p-2' };
  const variants = {
    default: 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
    outline: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
    ghost: 'bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-none',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size] ?? sizes.md} ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input className={`w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 placeholder-zinc-400 ${className}`} {...props}/>
);

const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">{children}</label>
);

const NativeSelect = ({ value, onChange, children, disabled, className = '' }) => (
  <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
    className={`w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${className}`}>
    {children}
  </select>
);

// ─────────────────────────────────────────────────────────────────────────────

export default function RecruiterAssignments() {
  const { authHeaders, currentUser } = useAuth();
  const { toast } = useToast();
  
  const [jobs, setJobs] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [candidateModalJob, setCandidateModalJob] = useState(null);
  const [candidateModalMode, setCandidateModalMode] = useState('submitted');
  const [jobCandidates, setJobCandidates] = useState([]);
  const [isLoadingJobCandidates, setIsLoadingJobCandidates] = useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);

  const initialJobForm = {
    jobCode: '', clientName: '', position: '', skills: '', salaryBudget: '', monthlySalary: '',
    location: '', experience: '', gender: 'Any', interviewMode: 'Virtual',
    tatTime: '', jdLink: '', comments: '', primaryRecruiter: '', secondaryRecruiter: ''
  };

  const [jobForm, setJobForm] = useState(initialJobForm);

  const [clientForm, setClientForm] = useState({
    companyName: '', industry: '', location: '', website: '', contactPerson: '', email: '', phone: ''
  });

  const getAuthHeader = async () => {
    const h = await authHeaders();
    return { 'Content-Type': 'application/json', ...h };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const [resJobs, resRecs, resClients, resCandidates] = await Promise.all([
        fetch(`${API_URL}/jobs`, { headers }),
        fetch(`${API_URL}/users/active-list`, { headers }),
        fetch(`${API_URL}/clients`, { headers }),
        fetch(`${API_URL}/candidates?view=matching&includeSubmissions=true`, { headers })
      ]);
      if (resJobs.ok) {
        const data = await resJobs.json();
        setJobs(data.map((j) => ({ ...j, id: j._id })));
      }
      if (resRecs.ok) setRecruiters(await resRecs.json());
      if (resClients.ok) setClients(await resClients.json());
      if (resCandidates.ok) {
        const data = await resCandidates.json();
        const candidatesArray = Array.isArray(data) ? data : data.data || [];
        setCandidates(candidatesArray.map((candidate) => ({
          ...candidate,
          id: candidate._id || candidate.id,
        })));
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const formatRecruiterName = (r) => {
    if (r.firstName && r.lastName) return `${r.firstName} ${r.lastName}`;
    return r.name || r.username || r.fullName || r.firstName || r.email || 'Unknown';
  };

  const openViewModal = (job) => {
    setJobForm({
      jobCode: job.jobCode || '',
      clientName: job.clientName || '',
      position: job.position || '',
      skills: job.skills || '',
      salaryBudget: job.salaryBudget || '',
      monthlySalary: job.monthlySalary || '',
      location: job.location || '',
      experience: job.experience || '',
      gender: job.gender || 'Any',
      interviewMode: job.interviewMode || 'Virtual',
      tatTime: job.tatTime ? new Date(job.tatTime).toISOString().substring(0, 10) : '',
      jdLink: job.jdLink || '',
      comments: job.comments || '',
      primaryRecruiter: job.primaryRecruiter || '',
      secondaryRecruiter: job.secondaryRecruiter || ''
    });
    setSelectedJob(job);
    setIsEditMode(true);
    setIsJobModalOpen(true);
  };

  const handleCreateJob = async () => {
    if (!jobForm.position.trim()) return toast({ title: "Validation", description: "Position is required", variant: "destructive" });
    if (!jobForm.clientName) return toast({ title: "Validation", description: "Client is required", variant: "destructive" });
    
    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(jobForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create job");
      toast({ title: "Success", description: "New requirement posted successfully" });
      setIsJobModalOpen(false);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/jobs/${jobToDelete._id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error("Failed to delete job");
      toast({ title: "Success", description: "Job deleted successfully" });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      setSelectedJob(null);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filteredJobs = useMemo(() => {
    const currentRecruiterName = currentUser ? formatRecruiterName(currentUser).toLowerCase() : '';
    const userRole = currentUser?.role?.toLowerCase() || '';

    return jobs.filter(job => {
      if (userRole === 'recruiter') {
        const primary = String(job.primaryRecruiter || '').toLowerCase();
        const secondary = String(job.secondaryRecruiter || '').toLowerCase();
        if (primary !== currentRecruiterName && secondary !== currentRecruiterName) {
          return false;
        }
      }

      const query = searchQuery.toLowerCase();
      return (
        job.position?.toLowerCase().includes(query) ||
        job.clientName?.toLowerCase().includes(query) ||
        job.jobCode?.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query)
      );
    });
  }, [jobs, searchQuery, currentUser]);

  const candidateCounts = useMemo(() => {
    const countsByJob = new Map();

    candidates.forEach((candidate) => {
      const submittedJobIds = new Set();
      (candidate.submissions || []).forEach((submission) => {
        const jobId = submission.jobId?._id || submission.jobId || submission.requirementId?._id || submission.requirementId;
        if (jobId) submittedJobIds.add(String(jobId));
      });

      submittedJobIds.forEach((jobId) => {
        countsByJob.set(jobId, (countsByJob.get(jobId) || 0) + 1);
      });
    });

    return Object.fromEntries(countsByJob);
  }, [candidates]);

  const matchingCandidatesByJobId = useMemo(
    () => getMatchingCandidatesByJobId(jobs, candidates, 3),
    [jobs, candidates]
  );

  const matchingCounts = useMemo(() => (
    Object.fromEntries(
      Object.entries(matchingCandidatesByJobId).map(([jobId, matchedCandidates]) => [jobId, matchedCandidates.length])
    )
  ), [matchingCandidatesByJobId]);

  const openCandidatesModalForJob = async (job, mode = 'submitted') => {
    const jobId = job?._id || job?.id;
    if (!jobId) return;

    setCandidateModalJob(job);
    setCandidateModalMode(mode);
    setJobCandidates([]);
    setExpandedCandidateId(null);
    setIsLoadingJobCandidates(true);

    try {
      const headers = await getAuthHeader();

      if (mode === 'matching') {
        const quickMatches = matchingCandidatesByJobId[jobId] || [];

        if (!quickMatches.length) {
          setJobCandidates([]);
          return;
        }

        const res = await fetch(`${API_URL}/score-match/bulk`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requirementId: jobId,
            candidateIds: quickMatches.map((candidate) => candidate._id || candidate.id),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load candidate scores');

        const scoreByCandidate = new Map(
          (data.scores || []).map((score) => [String(score.candidateId), score])
        );

        setJobCandidates(
          quickMatches
            .map((candidate) => {
              const candidateId = candidate._id || candidate.id;
              return {
                id: candidateId,
                candidate,
                scoreData: scoreByCandidate.get(String(candidateId)),
              };
            })
            .filter((item) => item.scoreData)
            .sort((a, b) => (b.scoreData?.matchPercentage || 0) - (a.scoreData?.matchPercentage || 0))
        );
        return;
      }

      const res = await fetch(`${API_URL}/submissions?jobId=${jobId}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load submitted candidates');

      const submissions = Array.isArray(data) ? data : data.data || [];
      setJobCandidates(
        submissions.map((submission) => {
          const populatedCandidate = typeof submission.candidateId === 'object' ? submission.candidateId : null;
          const fallbackCandidate = candidates.find((candidate) => (
            String(candidate._id || candidate.id) === String(submission.candidateId)
          ));
          const candidate = populatedCandidate || fallbackCandidate || {};
          const candidateId = candidate._id || candidate.id || submission.candidateId || submission._id;

          return {
            id: candidateId,
            candidate,
            status: submission.status || submission.pipelineStage || 'Submitted',
            submission,
          };
        })
      );
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Could not load candidates for this requirement',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingJobCandidates(false);
    }
  };

  return (
    <>
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100">
        <div className="max-w-[1600px] mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">My Assignments</h1>
              <p className="text-zinc-500 mt-1 flex items-center gap-2">
                <UserCircleIcon className="w-4 h-4 text-blue-600" />
                Showing jobs assigned to you
              </p>
            </div>
          </div>

          {/* Search / View Toggle */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
            <div className="relative w-full sm:w-96">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400"/>
              <input 
                type="text" 
                placeholder="Search by Job Code, Role or Client..." 
                className="w-full pl-9 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex justify-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 self-center sm:self-auto">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                <Squares2X2Icon className="w-5 h-5"/>
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                <ListBulletIcon className="w-5 h-5"/>
              </button>
            </div>
          </div>

          {/* Jobs Grid / List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-10 w-10 border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100 rounded-full animate-spin mb-4" />
              <p className="text-zinc-500 font-medium">Fetching assignments...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <BriefcaseIcon className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4"/>
              <p className="text-zinc-500 text-lg">No assigned jobs found.</p>
              <p className="text-zinc-400 text-sm mt-1">You haven't been assigned to any active requirements yet.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map(job => {
                // Determine if Job is explicitly EXPIRED (TAT passed)
                const isExpired = job.tatTime && (new Date(job.tatTime).setHours(0,0,0,0) < new Date().setHours(0,0,0,0));

                return (
                  <div key={job.id} className={`p-6 rounded-xl shadow-sm border transition-all relative group bg-white dark:bg-zinc-900 ${isExpired ? 'border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/20 opacity-80' : 'border-zinc-200 dark:border-zinc-800 hover:shadow-md'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">{job.jobCode}</span>
                        <h3 className={`text-lg font-bold mt-2.5 truncate max-w-[200px] ${isExpired ? 'text-red-900 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`} title={job.position}>{job.position}</h3>
                        <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-1"><BuildingOfficeIcon className="w-4 h-4"/> {job.clientName}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm mb-4 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                      <div className="flex justify-between items-center"><span className="text-zinc-500">Location:</span> <span className="font-medium text-zinc-900 dark:text-zinc-100">{job.location || 'Remote'}</span></div>
                      {/* ✅ Added Assigned Date to Grid */}
                      <div className="flex justify-between items-center"><span className="text-zinc-500">Assigned Date:</span> <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatDate(job.createdAt)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-zinc-500">Date of Expiry:</span> {getTatBadge(job.tatTime)}</div>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openCandidatesModalForJob(job, 'submitted')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                      >
                        <UserGroupIcon className="h-3.5 w-3.5" />
                        {candidateCounts[job._id || job.id] || 0} Submitted
                      </button>
                      <button
                        type="button"
                        onClick={() => openCandidatesModalForJob(job, 'matching')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        {matchingCounts[job._id || job.id] || 0} Matching
                      </button>
                    </div>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button className="h-8 w-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors" onClick={() => openViewModal(job)}>
                        <EyeIcon className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[1000px]">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 uppercase text-xs">
                    <tr>
                      <th className="p-4 font-semibold">Job Code</th>
                      <th className="p-4 font-semibold">Candidates</th>
                      <th className="p-4 font-semibold">Position</th>
                      <th className="p-4 font-semibold">Client</th>
                      <th className="p-4 font-semibold">Location</th>
                      <th className="p-4 font-semibold">Assigned Date</th>
                      <th className="p-4 font-semibold">Expiry (TAT)</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredJobs.map(job => {
                      const isExpired = job.tatTime && (new Date(job.tatTime).setHours(0,0,0,0) < new Date().setHours(0,0,0,0));
                      return (
                        <tr key={job.id} className={`transition-colors ${isExpired ? 'bg-red-50/20 dark:bg-red-900/10' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20'}`}>
                          <td className="p-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">{job.jobCode}</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openCandidatesModalForJob(job, 'submitted')}
                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300"
                              >
                                <UserGroupIcon className="h-3.5 w-3.5" />
                                {candidateCounts[job._id || job.id] || 0}
                              </button>
                              <button
                                type="button"
                                onClick={() => openCandidatesModalForJob(job, 'matching')}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                              >
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                {matchingCounts[job._id || job.id] || 0}
                              </button>
                            </div>
                          </td>
                          <td className={`p-4 font-medium ${isExpired ? 'text-red-900 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{job.position}</td>
                          <td className="p-4 text-zinc-600 dark:text-zinc-400">{job.clientName}</td>
                          <td className="p-4 text-zinc-600 dark:text-zinc-400">{job.location}</td>
                          <td className="p-4 text-zinc-600 dark:text-zinc-400">{formatDate(job.createdAt)}</td>
                          <td className="p-4">{getTatBadge(job.tatTime)}</td>
                          <td className="p-4 flex gap-2 justify-end">
                            <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors" onClick={() => openViewModal(job)}><EyeIcon className="w-4 h-4"/></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post / View Requirement Modal */}
      <Modal open={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} maxWidth="max-w-4xl">
        <ModalHeader>
          <ModalTitle>{isEditMode ? 'View Job Requirement' : 'Post New Requirement'}</ModalTitle>
          <ModalDesc>{isEditMode ? 'Job details are read-only.' : 'Fill in the details below. Fields marked with * are required.'}</ModalDesc>
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="jobCode">Job Code</Label>
              <Input id="jobCode" placeholder="Auto-generated" value={jobForm.jobCode} onChange={e => setJobForm({...jobForm, jobCode: e.target.value})} disabled className="bg-zinc-100 dark:bg-zinc-800 opacity-70 cursor-not-allowed"/>
            </div>
            <div>
              <Label htmlFor="clientName">Client *</Label>
              <NativeSelect value={jobForm.clientName} onChange={val => setJobForm({...jobForm, clientName: val})} disabled={isEditMode}>
                <option value="">Select Client</option>
                {clients.map(c => <option key={c._id} value={c.companyName}>{c.companyName}</option>)}
              </NativeSelect>
              {!isEditMode && clients.length === 0 && <div className="text-xs text-red-500 mt-1">No clients found. Please add a client first.</div>}
            </div>
            <div>
              <Label htmlFor="position">Position Title *</Label>
              <Input id="position" placeholder="e.g. React Developer" value={jobForm.position} onChange={e => setJobForm({...jobForm, position: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="salaryBudget">Maximum Salary Range</Label>
              <Input id="salaryBudget" placeholder="e.g. 15 LPA" value={jobForm.salaryBudget} onChange={e => setJobForm({...jobForm, salaryBudget: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="monthlySalary">Monthly Salary</Label>
              <Input id="monthlySalary" placeholder="e.g. 50k - 60k" value={jobForm.monthlySalary} onChange={e => setJobForm({...jobForm, monthlySalary: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input id="location" value={jobForm.location} onChange={e => setJobForm({...jobForm, location: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="experience">Experience (E.g. 0.6 - 2) *</Label>
              <Input id="experience" placeholder="e.g. 0.6 - 2" value={jobForm.experience} onChange={e => setJobForm({...jobForm, experience: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="tatTime">Date of Expiry (TAT)</Label>
              <Input id="tatTime" type="date" value={jobForm.tatTime} onChange={e => setJobForm({...jobForm, tatTime: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label>Interview Mode</Label>
              <NativeSelect value={jobForm.interviewMode} onChange={val => setJobForm({...jobForm, interviewMode: val})} disabled={isEditMode}>
                <option value="Virtual">Virtual</option>
                <option value="In-Person">In-Person</option>
                <option value="Hybrid">Hybrid</option>
              </NativeSelect>
            </div>
            {/* ✅ ADDED GENDER FIELD HERE */}
            <div>
              <Label>Gender Preference</Label>
              <NativeSelect value={jobForm.gender} onChange={val => setJobForm({...jobForm, gender: val})} disabled={isEditMode}>
                <option value="Any">Any</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </NativeSelect>
            </div>

            <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-zinc-900 dark:text-white"><UserGroupIcon className="w-4 h-4"/> Assign Recruiters</h4>
            </div>

            <div>
              <Label>Primary Recruiter</Label>
              <NativeSelect value={jobForm.primaryRecruiter} onChange={val => setJobForm({...jobForm, primaryRecruiter: val})} disabled={isEditMode}>
                <option value="">Select Recruiter</option>
                <option value="Unassigned">None</option>
                {recruiters.map(r => {
                  const name = formatRecruiterName(r);
                  return <option key={r._id} value={name}>{name}</option>;
                })}
              </NativeSelect>
            </div>
            <div>
              <Label>Secondary Recruiter</Label>
              <NativeSelect value={jobForm.secondaryRecruiter} onChange={val => setJobForm({...jobForm, secondaryRecruiter: val})} disabled={isEditMode}>
                <option value="">Select Recruiter</option>
                <option value="Unassigned">None</option>
                {recruiters.map(r => {
                  const name = formatRecruiterName(r);
                  return <option key={r._id} value={name}>{name}</option>;
                })}
              </NativeSelect>
            </div>

            <div className="col-span-1 md:col-span-2">
              <Label>Required Skills *</Label>
              <textarea className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[80px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 placeholder-zinc-400" value={jobForm.skills} onChange={e => setJobForm({...jobForm, skills: e.target.value})} disabled={isEditMode}/>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          {isEditMode ? (
            <Button onClick={() => setIsJobModalOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsJobModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateJob} disabled={submitting}>
                {submitting ? 'Saving...' : 'Post Requirement'}
              </Button>
            </>
          )}
        </ModalFooter>
      </Modal>

      {/* Delete Confirm Modal */}
      {/* (Space reserved if you add delete functionality back in the future) */}

      <CandidateMatchesModal
        job={candidateModalJob}
        mode={candidateModalMode}
        rows={jobCandidates}
        loading={isLoadingJobCandidates}
        expandedCandidateId={expandedCandidateId}
        onToggleCandidate={setExpandedCandidateId}
        onClose={() => {
          setCandidateModalJob(null);
          setJobCandidates([]);
          setExpandedCandidateId(null);
        }}
      />

    </>
  );
}
