// --- START OF FILE RecruiterAssignments.jsx ---
import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  BriefcaseIcon, MapPinIcon, CurrencyDollarIcon,
  Squares2X2Icon, ListBulletIcon, EyeIcon, XMarkIcon,
  BuildingOfficeIcon, PlusIcon, UserGroupIcon, MagnifyingGlassIcon,
  TrashIcon, UserCircleIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon
} from "@heroicons/react/24/outline";
import { useToast } from "@/hooks/use-toast";
import JobDetailsModal, { JobCodeButton } from "@/components/JobDetailsModal";
import CandidateDetailsModal from "@/components/CandidateDetailsModal";
import { ScoreBadge, MatchBreakdownBar, SkillChips, MatchReasonBox, getScoreValue, getMatchLevelClass } from "@/components/Score/ScoreComponents";
import { getMatchingCandidatesByJobId } from "@/utils/candidateMatching";

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

// ── Plain Tailwind UI Helpers ────────────────────────────────────────────────

const Badge = ({ children, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);

const getTatBadge = (tatTime) => {
  if (!tatTime) return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">N/A</Badge>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(tatTime);
  target.setHours(0, 0, 0, 0);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800`}>
        {children}
      </div>
    </div>
  );
};

const ModalHeader = ({ children }) => <div className="px-6 pt-6 pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-4">{children}</div>;
const ModalTitle = ({ children }) => <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{children}</h2>;
const ModalDesc = ({ children }) => <p className="text-sm text-zinc-500 mt-1 pb-4">{children}</p>;
const ModalFooter = ({ children }) => <div className="px-6 pb-6 pt-4 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800 mt-4">{children}</div>;
const ModalBody = ({ children }) => <div className="px-6 py-2">{children}</div>;

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
  <input className={`w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 placeholder-zinc-400 ${className}`} {...props} />
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

const splitSkills = (value) => {
  if (Array.isArray(value)) return value.map(skill => String(skill).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,;\n]+/).map(skill => skill.trim()).filter(Boolean);
  return [];
};

export default function RecruiterAssignments() {
  const { authHeaders } = useAuth();
  const { toast } = useToast();

  const [jobs, setJobs] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);
  const [candidateCounts, setCandidateCounts] = useState({});
  const [allCandidates, setAllCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [dueDaysSort, setDueDaysSort] = useState('none');
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetailJob, setJobDetailJob] = useState(null);
  const [candidateModalJob, setCandidateModalJob] = useState(null);
  const [candidateModalMode, setCandidateModalMode] = useState('submitted');
  const [candidateModalSearch, setCandidateModalSearch] = useState('');
  const [jobCandidates, setJobCandidates] = useState([]);
  const [isLoadingJobCandidates, setIsLoadingJobCandidates] = useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = useState(null);
  const [selectedCandidateDetails, setSelectedCandidateDetails] = useState(null);

  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const initialJobForm = {
    jobCode: '', clientName: '', position: '', skills: '', mandatorySkills: '', preferredSkills: '', salaryBudget: '', monthlySalary: '',
    location: '', experience: '', gender: 'Any', interviewMode: 'Virtual',
    tatTime: '', jobDescription: '', comments: '', primaryRecruiter: '', secondaryRecruiter: ''
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
      const [resJobs, resRecs, resClients, resSubmissions, resCandidates] = await Promise.all([
        fetch(`${API_URL}/jobs`, { headers }),
        fetch(`${API_URL}/recruiters/by-role?role=recruiter`, { headers }),
        fetch(`${API_URL}/clients`, { headers }),
        fetch(`${API_URL}/submissions`, { headers }),
        fetch(`${API_URL}/candidates`, { headers })
      ]);
      if (resJobs.ok) {
        const data = await resJobs.json();
        const list = Array.isArray(data) ? data : data.data || [];
        setJobs(list.map((j) => ({ ...j, id: j._id || j.id })));
      }
      if (resRecs.ok) setRecruiters(await resRecs.json());
      if (resClients.ok) setClients(await resClients.json());
      if (resSubmissions.ok) {
        const submissions = await resSubmissions.json();
        setCandidateCounts((Array.isArray(submissions) ? submissions : []).reduce((acc, sub) => {
          const jobId = typeof sub.jobId === 'object' ? sub.jobId?._id : sub.jobId;
          if (jobId) acc[jobId] = (acc[jobId] || 0) + 1;
          return acc;
        }, {}));
      }
      if (resCandidates.ok) {
        const candidates = await resCandidates.json();
        setAllCandidates(Array.isArray(candidates) ? candidates : []);
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
      mandatorySkills: splitSkills(job.mandatorySkills).length ? splitSkills(job.mandatorySkills).join(', ') : (job.skills || ''),
      preferredSkills: splitSkills(job.preferredSkills).join(', '),
      salaryBudget: job.salaryBudget || '',
      monthlySalary: job.monthlySalary || '',
      location: job.location || '',
      experience: job.experience || '',
      gender: job.gender || 'Any',
      interviewMode: job.interviewMode || 'Virtual',
      tatTime: job.tatTime ? new Date(job.tatTime).toISOString().substring(0, 10) : '',
      jobDescription: job.jobDescription || '',
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
    if (splitSkills(jobForm.mandatorySkills || jobForm.skills).length === 0) return toast({ title: "Validation", description: "Mandatory skills are required", variant: "destructive" });

    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const mandatorySkills = splitSkills(jobForm.mandatorySkills || jobForm.skills);
      const preferredSkills = splitSkills(jobForm.preferredSkills);
      const res = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...jobForm,
          skills: mandatorySkills.join(', '),
          mandatorySkills,
          preferredSkills,
        })
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
    const getDueDays = (tatTime) => {
      if (!tatTime) return null;
      const expiry = new Date(tatTime);
      if (Number.isNaN(expiry.getTime())) return null;
      expiry.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.round((expiry - today) / (1000 * 60 * 60 * 24));
    };

    let result = jobs.filter(job => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        job.position?.toLowerCase().includes(query) ||
        job.clientName?.toLowerCase().includes(query) ||
        job.jobCode?.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;

      const dueDays = getDueDays(job.tatTime);
      if (expiryFilter === 'expired') return dueDays !== null && dueDays < 0;
      if (expiryFilter === 'today') return dueDays === 0;
      if (expiryFilter === 'upcoming') return dueDays !== null && dueDays > 0;
      if (expiryFilter === 'next7') return dueDays !== null && dueDays >= 0 && dueDays <= 7;
      if (expiryFilter === 'next30') return dueDays !== null && dueDays >= 0 && dueDays <= 30;
      if (expiryFilter === 'withDate') return dueDays !== null;
      if (expiryFilter === 'noDate') return dueDays === null;
      return true;
    });

    if (dueDaysSort === 'asc' || dueDaysSort === 'desc') {
      result = [...result].sort((a, b) => {
        const aDue = getDueDays(a.tatTime);
        const bDue = getDueDays(b.tatTime);
        const aVal = aDue === null ? Number.POSITIVE_INFINITY : aDue;
        const bVal = bDue === null ? Number.POSITIVE_INFINITY : bDue;
        return dueDaysSort === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return result;
  }, [jobs, searchQuery, expiryFilter, dueDaysSort]);

  const matchingCandidatesByJobId = useMemo(
    () => getMatchingCandidatesByJobId(filteredJobs, allCandidates),
    [filteredJobs, allCandidates]
  );

  const matchingCounts = useMemo(() => {
    const out = {};
    Object.entries(matchingCandidatesByJobId).forEach(([jobId, list]) => {
      out[jobId] = Array.isArray(list) ? list.length : 0;
    });
    return out;
  }, [matchingCandidatesByJobId]);

  const resolveCandidate = (candidateRef) => {
    if (candidateRef && typeof candidateRef === 'object') return candidateRef;
    const id = candidateRef?.toString();
    if (!id) return null;
    return allCandidates.find((candidate) => (candidate._id || candidate.id)?.toString() === id) || null;
  };

  const handleOpenCandidateModal = async (job) => {
    setCandidateModalJob(job);
    setCandidateModalMode('submitted');
    setCandidateModalSearch('');
    setExpandedCandidateId(null);
    setJobCandidates([]);
    setIsLoadingJobCandidates(true);
    try {
      const headers = await getAuthHeader();
      const jobId = job.id || job._id;
      const res = await fetch(`${API_URL}/submissions?jobId=${jobId}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load candidates');
      setJobCandidates((Array.isArray(data) ? data : []).map(sub => ({
        id: sub._id || sub.id,
        status: sub.status,
        dateAdded: sub.dateAdded || sub.createdAt,
        clientName: sub.clientName || sub.submittedClient || job.clientName,
        candidate: resolveCandidate(sub.candidateId),
      })).filter(item => item.candidate));
    } catch (error) {
      toast({ title: "Error", description: error.message || "Failed to load candidates.", variant: "destructive" });
    } finally {
      setIsLoadingJobCandidates(false);
    }
  };

  const openCandidatesModalForJob = async (job, mode) => {
    setCandidateModalJob(job);
    setCandidateModalMode(mode);
    setCandidateModalSearch('');
    setExpandedCandidateId(null);
    setSelectedCandidateDetails(null);
    setJobCandidates([]);

    if (mode === 'matching') {
      setIsLoadingJobCandidates(true);
      try {
        const candidatesToScore = matchingCandidatesByJobId[job.id] || [];
        if (candidatesToScore.length === 0) {
          setJobCandidates([]);
          return;
        }

        const headers = await getAuthHeader();
        const scoreRes = await fetch(`${API_URL}/score-match/bulk`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requirementId: job.id,
            candidateIds: candidatesToScore.map((candidate) => candidate._id || candidate.id),
          }),
        });
        const scorePayload = await scoreRes.json();
        if (!scoreRes.ok) throw new Error(scorePayload.message || 'Failed to score candidates');

        const candidatesById = new Map(candidatesToScore.map((candidate) => [(candidate._id || candidate.id)?.toString(), candidate]));
        const candidatesWithScores = (scorePayload.scores || []).map((scoreData) => {
          const candidate = candidatesById.get(scoreData.candidateId?.toString());
          if (!candidate) return null;
          return {
            id: candidate._id || candidate.id,
            status: Array.isArray(candidate.status) ? candidate.status[0] : candidate.status,
            clientName: candidate.clientName || job.clientName,
            candidate,
            scoreData,
          };
        }).filter(Boolean);
        setJobCandidates(candidatesWithScores);
      } catch (error) {
        toast({ title: "Error", description: "Failed to score matching candidates.", variant: "destructive" });
      } finally {
        setIsLoadingJobCandidates(false);
      }
      return;
    }

    await handleOpenCandidateModal(job);
  };

  const displayCandidates = useMemo(() => {
    const q = candidateModalSearch.trim().toLowerCase();
    if (!q) return jobCandidates;
    return (jobCandidates || []).filter(({ candidate, clientName }) => {
      if (!candidate) return false;
      const name = (candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || '').toLowerCase();
      const role = (candidate.position || '').toLowerCase();
      const skills = Array.isArray(candidate.skills) ? candidate.skills.join(', ') : (candidate.skills || '');
      const recruiter = (candidate.recruiterName || '').toLowerCase();
      const email = (candidate.email || '').toLowerCase();
      const contact = (candidate.phone || candidate.contact || candidate.mobile || '').toString().toLowerCase();
      return (
        name.includes(q) ||
        role.includes(q) ||
        skills.toLowerCase().includes(q) ||
        recruiter.includes(q) ||
        email.includes(q) ||
        contact.includes(q) ||
        (clientName || '').toLowerCase().includes(q)
      );
    });
  }, [jobCandidates, candidateModalSearch]);

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
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
            <div className="w-full md:flex-1 flex flex-col md:flex-row gap-3">
              <div className="relative w-full md:max-w-96">
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by Job Code, Role or Client..."
                  className="w-full pl-9 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
                className="w-full md:w-52 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none"
              >
                <option value="all">All</option>
                <option value="expired">Expired</option>
                <option value="today">Expiring Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="next7">Due in Next 7 Days</option>
                <option value="next30">Due in Next 30 Days</option>
                <option value="withDate">With Expiry Date</option>
                <option value="noDate">No Expiry Date</option>
              </select>
              <select
                value={dueDaysSort}
                onChange={(e) => setDueDaysSort(e.target.value)}
                className="w-full md:w-60 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none"
              >
                <option value="none">Sort By: Default</option>
                <option value="asc">Due Days (Ascending)</option>
                <option value="desc">Due Days (Descending)</option>
              </select>
            </div>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                <ListBulletIcon className="w-5 h-5" />
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
              <BriefcaseIcon className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 text-lg">No assigned jobs found.</p>
              <p className="text-zinc-400 text-sm mt-1">You haven't been assigned to any active requirements yet.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map(job => {
                // Determine if Job is explicitly EXPIRED (TAT passed)
                const isExpired = job.tatTime && (new Date(job.tatTime).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0));

                return (
                  <div key={job.id} className={`p-6 rounded-xl shadow-sm border transition-all relative group bg-white dark:bg-zinc-900 ${isExpired ? 'border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/20 opacity-80' : 'border-zinc-200 dark:border-zinc-800 hover:shadow-md'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <JobCodeButton
                          jobCode={job.jobCode}
                          onClick={() => setJobDetailJob(job)}
                          className="text-[10px] px-2 py-1"
                        />
                        <h3 className={`text-lg font-bold mt-2.5 truncate max-w-[200px] ${isExpired ? 'text-red-900 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`} title={job.position}>{job.position}</h3>
                        <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-1"><BuildingOfficeIcon className="w-4 h-4" /> {job.clientName}</p>
                      </div>
                    </div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCandidatesModalForJob(job, 'submitted')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                        title="View submitted candidates"
                      >
                        <UserGroupIcon className="h-3.5 w-3.5" />
                        Submitted: {candidateCounts[job.id] || 0}
                      </button>
                      <button
                        type="button"
                        onClick={() => openCandidatesModalForJob(job, 'matching')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                        title="View matching candidates (>= 3 skills match)"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        Matching: {matchingCounts[job.id] || 0}
                      </button>
                    </div>
                    <div className="space-y-2 text-sm mb-4 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                      <div className="flex justify-between items-center"><span className="text-zinc-500">Location:</span> <span className="font-medium text-zinc-900 dark:text-zinc-100">{job.location || 'Remote'}</span></div>
                      <div className="flex justify-between items-center"><span className="text-zinc-500">Salary:</span> <span className="font-medium text-zinc-900 dark:text-zinc-100">{job.salaryBudget || 'N/A'}</span></div>
                      {/* ✅ Added Assigned Date to Grid */}
                      <div className="flex justify-between items-center"><span className="text-zinc-500">Assigned Date:</span> <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatDate(job.createdAt)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-zinc-500">Date of Expiry:</span> {getTatBadge(job.tatTime)}</div>
                    </div>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button className="h-8 w-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors" onClick={() => openViewModal(job)}>
                        <EyeIcon className="w-4 h-4" />
                      </button>

                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 uppercase text-xs">
                  <tr>
                    <th className="p-4 font-semibold">Job Code</th>
                    <th className="p-4 font-semibold">Candidates</th>
                    <th className="p-4 font-semibold">Position</th>
                    <th className="p-4 font-semibold">Salary</th>
                    <th className="p-4 font-semibold">Client</th>
                    <th className="p-4 font-semibold">Location</th>
                    {/* ✅ Added Assigned Date to Table Header */}
                    <th className="p-4 font-semibold">Assigned Date</th>
                    <th className="p-4 font-semibold">Expiry (TAT)</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredJobs.map(job => {
                    const isExpired = job.tatTime && (new Date(job.tatTime).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0));
                    return (
                      <tr key={job.id} className={`transition-colors ${isExpired ? 'bg-red-50/20 dark:bg-red-900/10' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20'}`}>
                        <td className="p-4">
                          <JobCodeButton jobCode={job.jobCode} onClick={() => setJobDetailJob(job)} />
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-start gap-1.5 xl:flex-row xl:items-center">
                            <button
                              type="button"
                              onClick={() => openCandidatesModalForJob(job, 'submitted')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                              title="View submitted candidates"
                            >
                              <UserGroupIcon className="h-3.5 w-3.5" />
                             {candidateCounts[job.id] || 0}
                            </button>
                            <button
                              type="button"
                              onClick={() => openCandidatesModalForJob(job, 'matching')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                              title="View matching candidates (>= 3 skills match)"
                            >
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                               {matchingCounts[job.id] || 0}
                            </button>
                          </div>
                        </td>
                        <td className={`p-4 font-medium ${isExpired ? 'text-red-900 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{job.position}</td>
                        <td className="p-4 text-zinc-600 dark:text-zinc-400">{job.salaryBudget || 'N/A'}</td>
                        <td className="p-4 text-zinc-600 dark:text-zinc-400">{job.clientName}</td>
                        <td className="p-4 text-zinc-600 dark:text-zinc-400">{job.location}</td>
                        {/* ✅ Added Assigned Date to Table Row */}
                        <td className="p-4 text-zinc-600 dark:text-zinc-400">{formatDate(job.createdAt)}</td>
                        <td className="p-4">{getTatBadge(job.tatTime)}</td>
                        <td className="p-4 flex gap-2 justify-end">
                          <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors" onClick={() => openViewModal(job)}><EyeIcon className="w-4 h-4" /></button>

                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {jobDetailJob && (
        <JobDetailsModal
          job={jobDetailJob}
          onClose={() => setJobDetailJob(null)}
          stats={{
            submitted: candidateCounts[jobDetailJob.id] || 0,
            matching: matchingCounts[jobDetailJob.id] || 0,
          }}
        />
      )}

      {candidateModalJob && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedCandidateDetails(null); setCandidateModalJob(null); }}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserGroupIcon className="w-5 h-5 text-zinc-300" />
                  {candidateModalMode === 'matching' ? 'Matching Candidates' : 'Submitted Candidates'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">{candidateModalJob.position} - {candidateModalJob.jobCode}</p>
              </div>
              <button onClick={() => { setSelectedCandidateDetails(null); setCandidateModalJob(null); }} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <Input
                  value={candidateModalSearch}
                  onChange={(e) => setCandidateModalSearch(e.target.value)}
                  placeholder="Search by name, skill, recruiter, email, contact, client..."
                />
                <div className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                  Showing {displayCandidates.length} candidate(s)
                </div>
              </div>
              {isLoadingJobCandidates ? (
                <div className="py-12 text-center text-zinc-500 flex flex-col items-center">
                  <div className="h-8 w-8 border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100 rounded-full animate-spin mb-3" />
                  Loading candidates...
                </div>
              ) : displayCandidates.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  No candidates found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className={`${candidateModalMode === 'matching' ? 'min-w-[980px]' : 'min-w-[1120px]'} w-full text-left text-sm`}>
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase text-zinc-500 font-semibold">
                      <tr>
                        {candidateModalMode === 'matching' ? (
                          <>
                            <th className="px-4 py-3">Avatar</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Current Role</th>
                            <th className="px-4 py-3 text-center">Match Score</th>
                            <th className="px-4 py-3">Match Level</th>
                            <th className="px-4 py-3"></th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3">Candidate Name</th>
                            <th className="px-4 py-3">Email / Contact</th>
                            <th className="px-4 py-3">Skills</th>
                            <th className="px-4 py-3">Experience</th>
                            <th className="px-4 py-3">Current Status</th>
                            <th className="px-4 py-3">Client</th>
                            <th className="px-4 py-3">Recruiter</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {displayCandidates.map(({ id, status, candidate, clientName, scoreData }) => {
                        const name = candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate';
                        const skills = Array.isArray(candidate.skills) ? candidate.skills : (typeof candidate.skills === 'string' ? candidate.skills.split(',') : []);
                        const exp = candidate.totalExperience || candidate.relevantExperience || candidate.experience || '';
                        const contact = candidate.phone || candidate.contact || candidate.mobile || candidate.contactNumber || '';
                        const avatarLetter = name.charAt(0).toUpperCase();
                        const isExpanded = expandedCandidateId === id;
                        return (
                          <React.Fragment key={id}>
                            <tr className={`bg-white dark:bg-zinc-900 transition-colors ${isExpanded ? 'bg-zinc-50 dark:bg-zinc-800/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/20'}`}>
                              {candidateModalMode === 'matching' ? (
                                <>
                                  <td className="px-4 py-3 w-12">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-xs">{avatarLetter}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCandidateDetails({ candidate, status, clientName: clientName || candidateModalJob.clientName })}
                                      className="text-left font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
                                    >
                                      {name}
                                    </button>
                                    <div className="text-xs text-zinc-400">{candidate.candidateId || candidate._id?.slice(-6).toUpperCase()}</div>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{candidate.position || 'N/A'}</td>
                                  <td className="px-4 py-3 text-center">
                                    <ScoreBadge score={getScoreValue(scoreData)} />
                                  </td>
                                  <td className="px-4 py-3">
                                    {scoreData?.matchLevel ? (
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getMatchLevelClass(scoreData.matchLevel, true)}`}>
                                        {scoreData.matchLevel}
                                      </span>
                                    ) : (
                                      <span className="text-xs font-semibold text-zinc-400">N/A</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {scoreData && (
                                      <button
                                        onClick={() => setExpandedCandidateId(isExpanded ? null : id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                                      >
                                        {isExpanded ? 'Hide Breakdown' : 'View Breakdown'}
                                        {isExpanded ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                                      </button>
                                    )}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{name}</div>
                                    <div className="text-xs text-zinc-400">{candidate.candidateId || candidate._id?.slice(-6).toUpperCase()}</div>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                                    <div>{candidate.email || 'N/A'}</div>
                                    <div className="text-xs text-zinc-400">{contact || 'N/A'}</div>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                                    <div className="max-w-[320px] truncate" title={skills.filter(Boolean).join(', ')}>
                                      {skills.filter(Boolean).join(', ') || 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{exp || 'N/A'}</td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                      {status || 'Submitted'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{clientName || candidateModalJob.clientName || 'N/A'}</td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{candidate.recruiterName || candidate.assignedRecruiter || 'Unassigned'}</td>
                                </>
                              )}
                            </tr>

                            {candidateModalMode === 'matching' && isExpanded && scoreData && (
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
            </div>
          </div>
        </div>
      )}

      {selectedCandidateDetails && (
        <CandidateDetailsModal
          candidate={selectedCandidateDetails.candidate}
          status={selectedCandidateDetails.status}
          clientName={selectedCandidateDetails.clientName}
          baseUrl={BASE_URL}
          onClose={() => setSelectedCandidateDetails(null)}
        />
      )}

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
              <Input id="jobCode" placeholder="Auto-generated" value={jobForm.jobCode} onChange={e => setJobForm({ ...jobForm, jobCode: e.target.value })} disabled className="bg-zinc-100 dark:bg-zinc-800 opacity-70 cursor-not-allowed" />
            </div>
            <div>
              <Label htmlFor="clientName">Client *</Label>
              <NativeSelect value={jobForm.clientName} onChange={val => setJobForm({ ...jobForm, clientName: val })} disabled={isEditMode}>
                <option value="">Select Client</option>
                {clients.map(c => <option key={c._id} value={c.companyName}>{c.companyName}</option>)}
              </NativeSelect>
              {!isEditMode && clients.length === 0 && <div className="text-xs text-red-500 mt-1">No clients found. Please add a client first.</div>}
            </div>
            <div>
              <Label htmlFor="position">Position Title *</Label>
              <Input id="position" placeholder="e.g. React Developer" value={jobForm.position} onChange={e => setJobForm({ ...jobForm, position: e.target.value })} disabled={isEditMode} />
            </div>
            <div>
              <Label htmlFor="salaryBudget">Maximum Salary Range</Label>
              <Input id="salaryBudget" placeholder="e.g. 15 LPA" value={jobForm.salaryBudget} onChange={e => setJobForm({ ...jobForm, salaryBudget: e.target.value })} disabled={isEditMode} />
            </div>
            <div>
              <Label htmlFor="monthlySalary">Monthly Salary</Label>
              <Input id="monthlySalary" placeholder="e.g. 50k - 60k" value={jobForm.monthlySalary} onChange={e => setJobForm({ ...jobForm, monthlySalary: e.target.value })} disabled={isEditMode} />
            </div>
            <div>
              <Label htmlFor="location">Location *</Label>
              <Input id="location" value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} disabled={isEditMode} />
            </div>
            <div>
              <Label htmlFor="experience">Experience (E.g. 0.6 - 2) *</Label>
              <Input id="experience" placeholder="e.g. 0.6 - 2" value={jobForm.experience} onChange={e => setJobForm({ ...jobForm, experience: e.target.value })} disabled={isEditMode} />
            </div>
            <div>
              <Label htmlFor="tatTime">Date of Expiry (TAT)</Label>
              <Input id="tatTime" type="date" value={jobForm.tatTime} onChange={e => setJobForm({ ...jobForm, tatTime: e.target.value })} disabled={isEditMode} />
            </div>
            <div>
              <Label>Interview Mode</Label>
              <NativeSelect value={jobForm.interviewMode} onChange={val => setJobForm({ ...jobForm, interviewMode: val })} disabled={isEditMode}>
                <option value="Virtual">Virtual</option>
                <option value="In-Person">In-Person</option>
                <option value="Hybrid">Hybrid</option>
              </NativeSelect>
            </div>
            {/* ✅ ADDED GENDER FIELD HERE */}
            <div>
              <Label>Gender Preference</Label>
              <NativeSelect value={jobForm.gender} onChange={val => setJobForm({ ...jobForm, gender: val })} disabled={isEditMode}>
                <option value="Any">Any</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </NativeSelect>
            </div>

            <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-zinc-900 dark:text-white"><UserGroupIcon className="w-4 h-4" /> Assign Recruiters</h4>
            </div>

            <div>
              <Label>Primary Recruiter</Label>
              <NativeSelect value={jobForm.primaryRecruiter} onChange={val => setJobForm({ ...jobForm, primaryRecruiter: val })} disabled={isEditMode}>
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
              <NativeSelect value={jobForm.secondaryRecruiter} onChange={val => setJobForm({ ...jobForm, secondaryRecruiter: val })} disabled={isEditMode}>
                <option value="">Select Recruiter</option>
                <option value="Unassigned">None</option>
                {recruiters.map(r => {
                  const name = formatRecruiterName(r);
                  return <option key={r._id} value={name}>{name}</option>;
                })}
              </NativeSelect>
            </div>

            <div className="col-span-1 md:col-span-2">
              <Label>Mandatory Skills *</Label>
              <textarea className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[80px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 placeholder-zinc-400" value={jobForm.mandatorySkills || jobForm.skills} onChange={e => setJobForm({ ...jobForm, mandatorySkills: e.target.value, skills: e.target.value })} disabled={isEditMode} />
            </div>
            <div className="col-span-1 md:col-span-2">
              <Label>Preferred Skills</Label>
              <textarea className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[80px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 placeholder-zinc-400" value={jobForm.preferredSkills} onChange={e => setJobForm({ ...jobForm, preferredSkills: e.target.value })} disabled={isEditMode} />
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

    </>
  );
}
