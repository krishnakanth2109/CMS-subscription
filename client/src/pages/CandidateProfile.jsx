import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  IndianRupee,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Star,
  UserRound,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import CandidatePipelinePanel from '@/components/CandidatePipelinePanel';
import { RecruiterDetailsTrigger } from '@/components/RecruiterDetailsModal';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const hiddenFields = new Set([
  '_id',
  'id',
  '__v',
  'candidateId',
  'name',
  'firstName',
  'lastName',
  'email',
  'contact',
  'phone',
  'alternateNumber',
  'dateOfBirth',
  'gender',
  'linkedin',
  'currentLocation',
  'preferredLocation',
  'position',
  'client',
  'currentCompany',
  'industry',
  'skills',
  'education',
  'totalExperience',
  'relevantExperience',
  'ctc',
  'ectc',
  'currentTakeHome',
  'expectedTakeHome',
  'noticePeriod',
  'servingNoticePeriod',
  'lwd',
  'reasonForChange',
  'offersInHand',
  'offerPackage',
  'source',
  'status',
  'rating',
  'dateAdded',
  'createdAt',
  'updatedAt',
  'remarks',
  'recruiterId',
  'recruiter',
  'recruiterName',
  'customFields',
  'active',
  'clientCandidateId',
  'resumeUrl',
  'resumeOriginalName',
  'candidatePrefix',
  'assignedJobId',
  'tenantOwnerId',
  'submissions',
]);

const labelFromKey = (key = '') => (
  String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const fullName = (candidate = {}) => (
  candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown Candidate'
);

const candidateCode = (candidate = {}) => (
  candidate.candidateId || candidate._id?.slice(-6)?.toUpperCase() || 'N/A'
);

const statusList = (candidate = {}) => {
  if (Array.isArray(candidate.status)) return candidate.status.filter(Boolean);
  return candidate.status ? [candidate.status] : ['Submitted'];
};

const recruiterName = (candidate = {}) => {
  const recruiter = candidate.recruiterId || candidate.recruiter;
  if (recruiter && typeof recruiter === 'object') {
    return recruiter.name || `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim() || recruiter.email || '-';
  }
  return candidate.recruiterName || recruiter || '-';
};

const recruiterDetails = (candidate = {}) => {
  const recruiter = candidate.recruiterId || candidate.recruiter;
  return recruiter && typeof recruiter === 'object' ? recruiter : { name: recruiterName(candidate) };
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatBoolean = (value) => {
  if (value === true || value === 'true') return 'Yes';
  if (value === false || value === 'false') return 'No';
  return value || '-';
};

const normalizeSkills = (skills) => {
  if (Array.isArray(skills)) return skills.filter(Boolean);
  if (typeof skills === 'string') return skills.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
};

const formatValue = (value, key = '') => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return formatBoolean(value);
  if (key.toLowerCase().includes('date') || key === 'lwd') return formatDate(value);
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const statusTone = (status = '') => {
  const text = status.toLowerCase();
  if (text.includes('join') || text.includes('select')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50';
  }
  if (text.includes('reject') || text.includes('no show') || text.includes('backout')) {
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50';
  }
  if (text.includes('hold')) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50';
  }
  if (text.includes('turn')) {
    return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/50';
  }
  return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50';
};

const parseCTC = (ctcStr) => {
  if (!ctcStr) return null;
  const cleaned = String(ctcStr)
    .toLowerCase()
    .replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  if (isNaN(val)) return null;
  return val;
};

const calculateHike = (ctc, ectc) => {
  const current = parseCTC(ctc);
  const expected = parseCTC(ectc);
  if (!current || !expected || current <= 0) return null;
  const hike = ((expected - current) / current) * 100;
  return hike > 0 ? Math.round(hike) : null;
};

const DetailEntry = ({ label, value }) => (
  <div className="space-y-0.5">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value || '-'}</div>
  </div>
);

export default function CandidateProfile() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const { authHeaders } = useAuth();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const loadCandidate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      let found = null;
      const response = await fetch(`${API_URL}/candidates/${encodeURIComponent(candidateId)}`, { headers });
      if (response.ok) {
        found = await response.json();
      } else {
        const listResponse = await fetch(`${API_URL}/candidates`, { headers });
        if (listResponse.ok) {
          const list = await listResponse.json();
          found = list.find((item) => (
            item._id === candidateId || item.id === candidateId || item.candidateId === candidateId
          ));
        }
      }

      if (!found) throw new Error('Candidate profile was not found.');
      setCandidate(found);
    } catch (err) {
      setError(err.message || 'Unable to load candidate profile.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, candidateId]);

  useEffect(() => {
    loadCandidate();
  }, [loadCandidate]);

  const skills = useMemo(() => normalizeSkills(candidate?.skills), [candidate]);

  const additionalDetails = useMemo(() => {
    if (!candidate) return [];
    const directFields = Object.entries(candidate)
      .filter(([key, value]) => !hiddenFields.has(key) && value !== null && value !== undefined && value !== '')
      .map(([key, value]) => [labelFromKey(key), formatValue(value, key)]);

    const customFields = candidate.customFields && typeof candidate.customFields === 'object'
      ? Object.entries(candidate.customFields)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => [labelFromKey(key), formatValue(value, key)])
      : [];

    return [...customFields, ...directFields];
  }, [candidate]);

  const copyCode = () => {
    if (!candidate) return;
    navigator.clipboard.writeText(candidateCode(candidate));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const hike = useMemo(() => {
    if (!candidate) return null;
    return calculateHike(candidate.ctc, candidate.ectc);
  }, [candidate]);

  const renderStars = (rating) => {
    const count = Number(rating) || 0;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 transition-all ${
              star <= count
                ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                : 'text-slate-200 dark:text-slate-700/80'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white px-8 py-6 text-sm font-semibold text-slate-700 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold text-slate-800 dark:text-slate-200">Loading profile</span>
            <span className="text-xs font-normal text-slate-400">Fetching candidate information...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <button
          onClick={() => navigate(-1)}
          className="group mb-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back
        </button>
        <div className="overflow-hidden rounded-2xl border border-red-100 bg-red-50 shadow-lg dark:border-red-950/30 dark:bg-red-950/20">
          <div className="flex items-start gap-4 p-6">
            <div className="rounded-xl bg-red-100 p-3 text-red-600 dark:bg-red-900/50 dark:text-red-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-800 dark:text-red-200">Candidate Profile Unavailable</h3>
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={loadCandidate}
                className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
              >
                Retry Loading
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 py-8 px-4 text-slate-800 dark:bg-[#050505] dark:text-slate-100 sm:px-6 lg:px-8">
      {/* Background decoration gradient */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/40 via-transparent to-transparent dark:from-indigo-950/10 pointer-events-none" />

      <div className="mx-auto max-w-7xl space-y-6 relative">
        {/* Top Header Row */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Candidates
          </button>
        </div>

        {/* Hero Card */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
          
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                {/* Large Avatar */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-2xl font-black text-white shadow-md">
                  {fullName(candidate).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span>{candidateCode(candidate)}</span>
                      <button
                        onClick={copyCode}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        title="Copy Candidate ID"
                      >
                        {copiedCode ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    {statusList(candidate).map((status) => (
                      <span
                        key={status}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-bold shadow-sm ${statusTone(status)}`}
                      >
                        {status}
                      </span>
                    ))}
                  </div>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {fullName(candidate)}
                  </h1>
                  <p className="mt-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    {candidate.position || 'Role not added'}
                    {candidate.client && (
                      <span className="text-slate-400 font-normal"> at {candidate.client}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Dynamic Action Link Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {candidate.email && (
                  <a
                    href={`mailto:${candidate.email}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                    title="Email Candidate"
                  >
                    <Mail className="h-5 w-5" />
                  </a>
                )}
                {(candidate.contact || candidate.phone) && (
                  <a
                    href={`tel:${candidate.contact || candidate.phone}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                    title="Call Candidate"
                  >
                    <Phone className="h-5 w-5" />
                  </a>
                )}
                {candidate.linkedin && (
                  <a
                    href={candidate.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                    title="LinkedIn Profile"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick Primary Contacts Row */}
            <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                  <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-300">{candidate.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Number</p>
                  <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-300">{candidate.contact || candidate.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Company</p>
                  <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-300">{candidate.currentCompany || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <UserRound className="h-4 w-4 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Recruiter</p>
                  <RecruiterDetailsTrigger recruiter={recruiterDetails(candidate)}>
                    <p className="cursor-pointer truncate text-sm font-bold text-slate-700 hover:text-indigo-600 hover:underline dark:text-slate-300 dark:hover:text-indigo-400">
                      {recruiterName(candidate)}
                    </p>
                  </RecruiterDetailsTrigger>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Double Column Details Area */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Left Column: Personal and Professional */}
          <div className="space-y-6">
            
            {/* Card: Personal Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <UserRound className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Personal Information</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Candidate identification and demographics</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailEntry label="Date of Birth" value={formatDate(candidate.dateOfBirth)} />
                <DetailEntry label="Gender" value={candidate.gender} />
                <DetailEntry label="Current Location" value={candidate.currentLocation} />
                <DetailEntry label="Preferred Location" value={candidate.preferredLocation} />
                <DetailEntry label="Alternate Contact" value={candidate.alternateNumber} />
                <DetailEntry
                  label="LinkedIn Link"
                  value={candidate.linkedin ? (
                    <a
                      href={candidate.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Open LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : '-'}
                />
              </div>
            </div>

            {/* Card: Professional Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <BriefcaseBusiness className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Professional Background</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Employment history, experience, and qualifications</p>
                </div>
              </div>
              
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailEntry label="Current Role" value={candidate.position} />
                <DetailEntry label="Target Client" value={candidate.client} />
                <DetailEntry label="Industry Sector" value={candidate.industry} />
                <DetailEntry label="Education/Qualification" value={candidate.education} />
                <DetailEntry label="Total Experience" value={candidate.totalExperience ? `${candidate.totalExperience} Years` : '-'} />
                <DetailEntry label="Relevant Experience" value={candidate.relevantExperience ? `${candidate.relevantExperience} Years` : '-'} />
              </div>

              {/* Skills Area inside Card */}
              <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Technical Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills.length ? (
                    skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-1 text-xs font-bold text-indigo-600 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-400"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-medium text-slate-400 italic">No skills listed</span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Compensation and Tracking */}
          <div className="space-y-6">
            
            {/* Card: Financials & Notice */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <IndianRupee className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Compensation & Notice</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Salaries, offer details, and notice availability</p>
                  </div>
                </div>
                {hike && (
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow-sm">
                    +{hike}% Hike
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailEntry label="Current CTC" value={candidate.ctc} />
                <DetailEntry label="Expected CTC" value={candidate.ectc} />
                <DetailEntry label="Current Take Home" value={candidate.currentTakeHome} />
                <DetailEntry label="Expected Take Home" value={candidate.expectedTakeHome} />
                <DetailEntry label="Notice Period" value={candidate.noticePeriod} />
                <DetailEntry label="Serving Notice Period" value={formatBoolean(candidate.servingNoticePeriod)} />
                <DetailEntry label="Last Working Day" value={formatDate(candidate.lwd)} />
                <DetailEntry
                  label="Offers in Hand"
                  value={candidate.offersInHand ? `Yes ${candidate.offerPackage ? `(${candidate.offerPackage})` : ''}` : 'No'}
                />
              </div>

              {/* Active Serving Notice Warning Indicator */}
              {candidate.servingNoticePeriod && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-amber-500 animate-spin" />
                    <span className="font-bold text-xs">Currently serving notice period</span>
                  </div>
                  {candidate.lwd && (
                    <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
                      Last working day: <span className="font-bold">{formatDate(candidate.lwd)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Card: Sourcing & Remarks */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Recruitment Tracking</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Pipeline sourcing, ratings, and changes</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <DetailEntry label="Sourcing Lead" value={candidate.source} />
                <DetailEntry label="Applicant Rating" value={candidate.rating ? (
                  <div className="flex items-center gap-1">
                    {renderStars(candidate.rating)}
                    <span className="text-xs text-slate-500 ml-1">({candidate.rating})</span>
                  </div>
                ) : '-'} />
                <DetailEntry label="Date Added" value={formatDate(candidate.dateAdded || candidate.createdAt)} />
                <DetailEntry label="Reason For Change" value={candidate.reasonForChange} />
              </div>

              {/* Internal notes quotes styling */}
              {candidate.remarks && (
                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Remarks & Interview Notes</p>
                  <p className="mt-2.5 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300 italic pl-3 border-l-2 border-indigo-500">
                    "{candidate.remarks}"
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Dynamic Configured Fields Grid */}
        {additionalDetails.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Additional Metadata</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Configuration fields and attributes captured from schema</p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {additionalDetails.map(([label, value]) => (
                <div key={`${label}-${value}`} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/40 dark:bg-slate-900/20">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="mt-1 break-words text-sm font-bold text-slate-800 dark:text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Client Submissions Visual Pipeline Flow */}
        {candidate?._id && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CandidatePipelinePanel
              candidateId={candidate._id}
              apiUrl={API_URL}
              authHeaders={authHeaders}
            />
          </section>
        )}

      </div>
    </main>
  );
}
