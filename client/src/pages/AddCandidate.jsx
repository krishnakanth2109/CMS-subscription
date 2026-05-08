import { useState, useEffect, useMemo, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
import {
  Search, Plus, Eye, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, Users, Download,
  X, Edit, Trash2, Calendar, ChevronDown,
  CheckCircle2, FileText, Sparkles, Settings2, Check, GripVertical,
  Clock, Ban
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── ENV Config ────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

const getAuthHeader = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    const token = stored ? JSON.parse(stored)?.idToken : null;
    return {
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

const getCurrentUser = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getTenantSettings = () => {
  const user = getCurrentUser();
  return user?.candidateSettings || { hiddenFields: [], customFields: [] };
};

const inputCls = (err) =>
  `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
  } bg-white dark:bg-slate-800`;

// ── Optional Fields that can be hidden ────────────────────────────────────────
const OPTIONAL_STANDARD_FIELDS = [
  { id: 'alternateNumber', label: 'Alternate Number' },
  { id: 'currentLocation', label: 'Current Location' },
  { id: 'preferredLocation', label: 'Preferred Location' },
  { id: 'dateOfBirth', label: 'Date of Birth' },
  { id: 'currentCompany', label: 'Current Company' },
  { id: 'reasonForChange', label: 'Reason for Change' },
  { id: 'totalExperience', label: 'Total Experience' },
  { id: 'relevantExperience', label: 'Relevant Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'ctc', label: 'Current CTC' },
  { id: 'currentTakeHome', label: 'Current Take Home' },
  { id: 'ectc', label: 'Expected CTC' },
  { id: 'expectedTakeHome', label: 'Expected Take Home' },
  { id: 'noticePeriod', label: 'Notice Period' },
  { id: 'servingNoticePeriod', label: 'Serving Notice Period?' },
  { id: 'lwd', label: 'Last Working Day (LWD)' },
  { id: 'offersInHand', label: 'Offers In Hand' },
];

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, colorTheme, active, onClick, icon: Icon }) => {
  const themes = {
    overall: 'from-blue-600 to-blue-700 text-white shadow-blue-200',
    shared: 'from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200 shadow-indigo-100',
    turnups: 'from-purple-50 to-purple-100 text-purple-700 border-purple-200 shadow-purple-100',
    noshow: 'from-slate-100 to-slate-200 text-slate-700 border-slate-300 shadow-slate-100',
    yetToAttend: 'from-violet-50 to-violet-100 text-violet-700 border-violet-200 shadow-violet-100',
    selected: 'from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 shadow-emerald-100',
    joined: 'from-teal-50 to-teal-100 text-teal-800 border-teal-200 shadow-teal-100',
    rejected: 'from-red-50 to-red-100 text-red-700 border-red-200 shadow-red-100',
    backout: 'from-rose-50 to-rose-100 text-rose-700 border-rose-200 shadow-rose-100',
    hold: 'from-amber-50 to-amber-100 text-amber-700 border-amber-200 shadow-amber-100',
    pipeline: 'from-orange-50 to-orange-100 text-orange-700 border-orange-200 shadow-orange-100',
    today: 'from-cyan-50 to-cyan-100 text-cyan-700 border-cyan-200 shadow-cyan-100',
  };
  const themeClass = themes[colorTheme] || themes.overall;
  return (
    <div
      onClick={onClick}
      className={`relative p-5 rounded-2xl border overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-md bg-gradient-to-br ${themeClass} ${onClick ? 'cursor-pointer' : ''} ${active ? 'ring-2 ring-offset-2 ring-blue-400 scale-[1.03] shadow-lg' : 'shadow-sm'}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-black tracking-tight">{value}</h3>
          <p className="text-xs mt-1 font-bold uppercase tracking-wider opacity-80">{title}</p>
        </div>
        {Icon && (
          <div className={`p-2 rounded-xl ${colorTheme === 'overall' ? 'bg-white/20' : 'bg-white/50 shadow-sm'}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {/* Decorative background element */}
      <div className="absolute -bottom-2 -right-2 opacity-10">
        {Icon && <Icon className="h-12 w-12" />}
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getCandidateId = (c) => c.candidateId || c._id?.substring(c._id.length - 6).toUpperCase();
const getStatusBadgeColor = (s) => {
  const low = (s || '').toLowerCase();
  if (low.includes('joined') || low.includes('selected')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (low.includes('rejected') || low.includes('backout') || low.includes('no show')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (low.includes('hold')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (low.includes('pipeline')) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (low.includes('shared')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (low.includes('attend') || low.includes('turnup')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};
const getSafeDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && d.length >= 10) return d.substring(0, 10);
  try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
};

const ApplicationStatusBar = ({ currentStatus }) => {
  const statusArr = (() => {
    if (Array.isArray(currentStatus)) return [...new Set(currentStatus)];
    if (typeof currentStatus === 'string') {
      const parsed = currentStatus.split(',').map(s => s.trim()).filter(Boolean);
      return [...new Set(parsed)].sort((a, b) => STATUS_FLOW_ORDER.indexOf(a) - STATUS_FLOW_ORDER.indexOf(b));
    }
    return [currentStatus || 'Submitted'];
  })();
  const terminalStatuses = ['Selected', 'Joined', 'Rejected', 'Backout', 'No Show'];

  // Also sort if it's already an array
  const sortedStatusArr = [...statusArr].sort((a, b) => STATUS_FLOW_ORDER.indexOf(a) - STATUS_FLOW_ORDER.indexOf(b));

  const isEnded = sortedStatusArr.some(s => terminalStatuses.includes(s));

  const getStatusColor = (s) => {
    if (['Joined', 'Selected'].includes(s)) return 'bg-emerald-600';
    if (['Rejected', 'Backout', 'No Show'].includes(s)) return 'bg-red-600';
    if (['Turnups'].includes(s)) return 'bg-purple-600';
    if (['Shared Profiles'].includes(s)) return 'bg-blue-500';
    if (['Pipeline'].includes(s)) return 'bg-amber-600';
    if (['Hold'].includes(s)) return 'bg-orange-600';
    return 'bg-blue-600'; // Default Submitted
  };

  const steps = sortedStatusArr.map(s => ({
    label: s,
    color: getStatusColor(s)
  }));

  if (!isEnded) {
    steps.push({
      label: 'Awaiting Action',
      color: 'bg-slate-300'
    });
  }

  const currentIndex = steps.length - 1;

  return (
    <div className="mt-8 mb-6 w-full max-w-4xl mx-auto">
      <div className="text-[10px] font-bold text-slate-400 mb-8 uppercase tracking-[0.2em] text-center">Application Timeline</div>
      <div className="relative flex justify-between items-start px-2">
        {/* Connection Line Container */}
        <div className="absolute top-[11px] left-0 w-full h-[2px] bg-slate-100 z-0" />

        {steps.map((step, idx) => {
          const isCompleted = idx < currentIndex || (isEnded && idx === currentIndex);
          const isNext = !isEnded && idx === currentIndex;

          return (
            <div key={idx} className="relative z-10 flex flex-col items-center flex-1 group/step">
              {/* Colored Connection Line (leading to this step) */}
              {idx > 0 && (
                <div className={`absolute top-[11px] right-1/2 w-full h-[2px] -z-10 transition-colors duration-500 ${idx <= currentIndex ? steps[idx - 1].color : 'bg-slate-100'
                  }`} />
              )}

              <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 shadow-sm transition-all duration-500 ${isCompleted ? `${step.color} border-transparent scale-110` : isNext ? 'bg-white border-slate-400' : 'bg-white border-slate-200'
                }`}>
                {isNext && (
                  <div className={`w-2.5 h-2.5 rounded-full ${steps[currentIndex - 1]?.color || 'bg-blue-500'} animate-pulse`} />
                )}
              </div>

              <div className={`mt-3 text-center px-1 transition-all duration-500 ${idx <= currentIndex ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'
                }`} style={{ fontSize: '9px', lineHeight: '1.2' }}>
                <div className="max-w-[80px] break-words whitespace-normal mx-auto uppercase tracking-tighter">
                  {step.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
const getRecruiterName = (r) => {
  if (!r) return 'Unassigned';
  if (r.firstName && r.lastName) return r.firstName + " " + r.lastName;
  if (r.username) return r.username;
  if (r.name) return r.name.split(' ')[0];
  return r.email || 'Unknown';
};
const getRecruiterLabel = (r) => {
  const name = getRecruiterName(r);
  const roleTag = r.role === 'admin' ? ' (Admin)' : r.role === 'manager' ? ' (Manager)' : '';
  return `${name}${roleTag}`;
};

const STATUS_FLOW_ORDER = [
  'Pipeline', 'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'Selected', 'Hold', 'Rejected', 'No Show', 'Backout', 'Joined'
];

const ALL_STATUSES = [...STATUS_FLOW_ORDER];
const SOURCES = ['LinkedIn', 'Naukri', 'Indeed', 'Portal', 'Referral', 'Other'];

// ── CustomFieldInput — renders the right input for a custom field type ────────
const CustomFieldInput = ({ cf, value, onChange }) => {
  if (cf.fieldType === 'boolean') {
    return (
      <select value={value || 'false'} onChange={(e) => onChange(cf.fieldName, e.target.value)} className={inputCls(false)}>
        <option value="false">No</option>
        <option value="true">Yes</option>
      </select>
    );
  }
  return (
    <input
      type={cf.fieldType === 'date' ? 'date' : cf.fieldType === 'number' ? 'number' : 'text'}
      value={value || ''}
      onChange={(e) => onChange(cf.fieldName, e.target.value)}
      className={inputCls(false)}
      placeholder={`Enter ${cf.fieldName}…`}
    />
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminCandidates() {
  const { toast } = useToast();
  const currentUser = getCurrentUser();
  const isManagerOrAdmin = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  // ── Data State ────────────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState({ show: false, fileName: '', fieldsCount: 0 });

  // ── Filter / Sort / Pagination State ─────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ── Tenant Settings (live, so changes reflect immediately) ────────────────
  const [tenantSettings, setTenantSettings] = useState(getTenantSettings);
  const hiddenFields = tenantSettings.hiddenFields || [];
  const tenantCustomFields = tenantSettings.customFields || [];
  const isHidden = (fieldName) => hiddenFields.includes(fieldName);

  // ── Settings Modal State ──────────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempHiddenFields, setTempHiddenFields] = useState([]);
  const [tempCustomFields, setTempCustomFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // ── Dialog State ──────────────────────────────────────────────────────────
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [viewCandidate, setViewCandidate] = useState(null);
  const [errors, setErrors] = useState({});
  const [isTodaySubOpen, setIsTodaySubOpen] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [bulkRecruiterId, setBulkRecruiterId] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const initialFormData = {
    firstName: '', lastName: '', contact: '', alternateNumber: '', email: '',
    dateOfBirth: '', dateAdded: todayStr,
    currentLocation: '', preferredLocation: '', position: '', positionOther: '', client: '', clientCandidateId: '',
    currentCompany: '', totalExperienceYears: '0', totalExperienceMonths: '0',
    relevantExperienceYears: '0', relevantExperienceMonths: '0',
    totalExperience: '', relevantExperience: '',
    ctc: '', currentTakeHome: '', ectc: '', expectedTakeHome: '',
    noticePeriod: '', servingNoticePeriod: 'false', lwd: '',
    reasonForChange: '', offersInHand: 'false', offerPackage: '', source: 'Portal',
    recruiterId: '', status: ['Submitted'],
    skills: '', remarks: '',
    customFields: {},
  };
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, recruiterFilter, clientFilter, activeStatFilter]);

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeader();
      const [resCand, resRec, resCli, resJobs] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers }),
        fetch(`${API_URL}/recruiters`, { headers }),
        fetch(`${API_URL}/clients`, { headers }),
        fetch(`${API_URL}/jobs`, { headers }),
      ]);
      if (resCand.ok) setCandidates(await resCand.json());
      if (resRec.ok) {
        const data = await resRec.json();
        setRecruiters(data.sort((a, b) => {
          const order = { admin: 0, manager: 1, recruiter: 2 };
          return (order[a.role] ?? 3) - (order[b.role] ?? 3);
        }));
      }
      if (resCli.ok) setClients(await resCli.json());
      if (resJobs.ok) {
        const data = await resJobs.json();
        setJobs(Array.isArray(data) ? data : data.jobs || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, []);

  // ── Form Handlers ─────────────────────────────────────────────────────────
  const handleInputChange = (field, value) => {
    let newValue = value;
    if (field === 'contact' || field === 'alternateNumber') {
      newValue = value.replace(/\D/g, '').slice(0, 10);
    } else if (field === 'firstName' || field === 'lastName') {
      newValue = value.replace(/[0-9]/g, '');
    } else if (field === 'ctc' || field === 'ectc') {
      newValue = value.replace(/[^0-9.]/g, '');
      const parts = newValue.split('.');
      if (parts.length > 2) newValue = parts[0] + '.' + parts.slice(1).join('');
      if (newValue !== '' && !isNaN(newValue) && parseFloat(newValue) > 50) newValue = '50';
    }

    // For years/months, we update the composite fields too
    setFormData((prev) => {
      const next = { ...prev, [field]: newValue };
      if (field.startsWith('totalExperience')) {
        next.totalExperience = `${next.totalExperienceYears} yrs ${next.totalExperienceMonths} months`;
      }
      if (field.startsWith('relevantExperience')) {
        next.relevantExperience = `${next.relevantExperienceYears} yrs ${next.relevantExperienceMonths} months`;
      }
      return next;
    });

    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setFormData((prev) => ({
      ...prev,
      customFields: { ...prev.customFields, [fieldName]: value },
    }));
  };

  const addStatus = (newStatus) => {
    if (!newStatus) return;
    if (newStatus === 'SELECT_ALL') {
      setFormData((prev) => ({ ...prev, status: [...ALL_STATUSES] }));
    } else if (!formData.status.includes(newStatus)) {
      setFormData((prev) => ({ ...prev, status: [...prev.status, newStatus] }));
    }
    if (errors.status) setErrors((prev) => { const n = { ...prev }; delete n.status; return n; });
  };
  const removeStatus = (s) => setFormData((prev) => ({ ...prev, status: prev.status.filter(x => x !== s) }));

  // ── Duplicate Checks ──────────────────────────────────────────────────────
  const checkEmailDuplicate = async (email) => {
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) return;
    setIsCheckingEmail(true);
    try {
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(email.trim())}${excludeParam}`, { headers: getAuthHeader() });
      const data = await res.json();
      if (data.exists) setErrors((prev) => ({ ...prev, email: `Already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})` }));
    } catch { /* ignore */ } finally { setIsCheckingEmail(false); }
  };

  const checkPhoneDuplicate = async (phone) => {
    const digits = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    if (!digits || digits.length !== 10) return;
    setIsCheckingPhone(true);
    try {
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers: getAuthHeader() });
      const data = await res.json();
      if (data.exists) setErrors((prev) => ({ ...prev, contact: `Already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})` }));
    } catch { /* ignore */ } finally { setIsCheckingPhone(false); }
  };

  // ── Resume Upload ─────────────────────────────────────────────────────────
  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' });
      return;
    }
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExt = ['.pdf', '.doc', '.docx'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(file.type) && !validExt.includes(fileExt)) {
      toast({ title: 'Error', description: 'Only PDF, DOC, DOCX supported.', variant: 'destructive' });
      return;
    }
    setIsParsingResume(true);
    try {
      const fd = new FormData();
      fd.append('resume', file);
      const headers = getAuthHeader();
      delete headers['Content-Type'];
      const res = await fetch(`${API_URL}/candidates/parse-resume`, { method: 'POST', headers, body: fd });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || 'Failed to parse resume');

      const { data } = result;
      let fName = '', lName = '';
      if (data.name) {
        const parts = data.name.trim().split(' ');
        fName = parts[0] || '';
        lName = parts.slice(1).join(' ') || '';
      }

      let filledCount = 0;
      const updates = {};
      if (fName) { updates.firstName = fName; filledCount++; }
      if (lName) { updates.lastName = lName; filledCount++; }
      if (data.email) { updates.email = data.email; filledCount++; }
      if (data.contact) { updates.contact = data.contact; filledCount++; }
      if (data.skills) { updates.skills = data.skills; filledCount++; }
      if (data.totalExperience) { updates.totalExperience = data.totalExperience; filledCount++; }
      if (data.position) { updates.position = data.position; filledCount++; }

      setFormData((prev) => ({ ...prev, ...updates, resume: file }));
      setResumeSuccess({ show: true, fileName: file.name, fieldsCount: filledCount });
      setTimeout(() => setResumeSuccess((s) => ({ ...s, show: false })), 5000);
    } catch (err) {
      toast({ title: 'Parse failed', description: err.message || 'Could not parse resume', variant: 'destructive' });
    } finally {
      setIsParsingResume(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = () => {
    const d = formData;
    const e = {};
    if (!d.firstName?.trim()) e.firstName = 'First name is required';
    if (!d.lastName?.trim()) e.lastName = 'Last name is required';
    if (!d.contact?.trim()) e.contact = 'Contact number is required';
    else if (!/^\d{10}$/.test(d.contact.replace(/\D/g, '').slice(-10))) e.contact = 'Enter a valid 10-digit phone number';
    if (!d.email?.trim()) e.email = 'Email is required';
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(d.email.trim())) e.email = 'Enter a valid email address';
    if (!d.position && !d.positionOther) e.position = 'Position is required';
    if (d.position === 'Other' && !d.positionOther?.trim()) e.positionOther = 'Please enter the position name';
    if (!d.client?.trim()) e.client = 'Client is required';
    if (!d.status || d.status.length === 0) e.status = 'At least one status is required';
    if (!d.dateAdded) { e.dateAdded = 'Date Added is required'; }
    else if (d.dateAdded > new Date().toLocaleDateString('en-CA')) e.dateAdded = 'Cannot be a future date';
    if (!isHidden('servingNoticePeriod') && d.servingNoticePeriod === 'true' && !d.lwd) e.lwd = 'LWD is required when serving notice period';
    if (!isHidden('offersInHand') && d.offersInHand === 'true' && !d.offerPackage?.trim()) e.offerPackage = 'Package in hand is required';

    if (d.dateOfBirth) {
      const dob = new Date(d.dateOfBirth);
      const age = (new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 18) e.dateOfBirth = 'Candidate must be atleast 18 years old';
      else if (age > 100) e.dateOfBirth = 'Please enter a valid date of birth';
    }

    // Experience Comparison
    const totalMonths = parseInt(d.totalExperienceYears || 0) * 12 + parseInt(d.totalExperienceMonths || 0);
    const relevantMonths = parseInt(d.relevantExperienceYears || 0) * 12 + parseInt(d.relevantExperienceMonths || 0);
    if (relevantMonths > totalMonths) {
      e.relevantExperience = 'Relevant experience cannot exceed total experience';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Final duplicate re-check before submit
    if (formData.email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      try {
        const res = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(formData.email.trim())}${excludeParam}`, { headers: getAuthHeader() });
        const data = await res.json();
        if (data.exists) {
          setErrors((prev) => ({ ...prev, email: `Already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})` }));
          toast({ title: 'Duplicate Email', description: 'Email already registered.', variant: 'destructive' });
          return;
        }
      } catch { /* ignore */ }
    }
    if (formData.contact) {
      const digits = formData.contact.replace(/\D/g, '').slice(-10);
      if (digits.length === 10) {
        const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
        try {
          const res = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers: getAuthHeader() });
          const data = await res.json();
          if (data.exists) {
            setErrors((prev) => ({ ...prev, contact: `Already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})` }));
            toast({ title: 'Duplicate Phone', description: 'Phone already registered.', variant: 'destructive' });
            return;
          }
        } catch { /* ignore */ }
      }
    }

    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const url = isEditMode ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
      const method = isEditMode ? 'PUT' : 'POST';

      const resolvedPosition = formData.position === 'Other' ? formData.positionOther.trim() : formData.position;

      const payload = {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        position: resolvedPosition,
        offersInHand: formData.offersInHand === 'true',
        servingNoticePeriod: formData.servingNoticePeriod === 'true',
        customFields: JSON.stringify(formData.customFields || {}),
      };
      delete payload.positionOther;

      const fd = new FormData();
      // Append resume file if present
      if (formData.resume instanceof File) fd.append('resume', formData.resume);
      Object.entries(payload).forEach(([key, val]) => {
        if (key === 'resume') return; // already appended above
        if (key === 'status' && Array.isArray(val)) {
          val.forEach(s => fd.append('status', s));
        } else if (val !== undefined && val !== null && val !== '')
          fd.append(key, String(val));
      });

      const headers = getAuthHeader();
      delete headers['Content-Type'];
      const res = await fetch(url, { method, headers, body: fd });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();

      if (isEditMode) {
        setCandidates((prev) => prev.map((c) => c._id === selectedCandidateId ? { ...c, ...saved } : c));
      } else {
        setCandidates((prev) => [saved, ...prev]);
      }
      toast({ title: 'Success', description: `Candidate ${isEditMode ? 'updated' : 'added'} successfully.` });
      setIsDialogOpen(false);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('e11000')) {
        setErrors((prev) => ({ ...prev, email: 'Email already exists in the database.' }));
        toast({ title: 'Duplicate Email', description: 'Email already registered.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to save candidate.', variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this candidate? This cannot be undone.')) return;
    try {
      await fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers: getAuthHeader() });
      toast({ title: 'Deleted', description: 'Candidate removed.' });
      setCandidates((prev) => prev.filter((c) => c._id !== id));
    } catch {
      toast({ title: 'Error', description: 'Delete failed.', variant: 'destructive' });
    }
  };

  // ── Open Dialogs ──────────────────────────────────────────────────────────
  const openAddDialog = () => {
    setIsEditMode(false);
    setSelectedCandidateId(null);
    setFormData(initialFormData);
    setErrors({});
    setResumeSuccess({ show: false, fileName: '', fieldsCount: 0 });
    setIsDialogOpen(true);
  };

  const openEditDialog = (c) => {
    setIsEditMode(true);
    setSelectedCandidateId(c._id);
    const jobTitles = jobs.map((j) => j.title || j.jobTitle || j.position || '').filter(Boolean);
    const savedPos = c.position || '';
    const isKnownJob = jobTitles.includes(savedPos);
    setFormData({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      contact: c.contact || '',
      alternateNumber: c.alternateNumber || '',
      email: c.email || '',
      dateOfBirth: c.dateOfBirth ? getSafeDate(c.dateOfBirth) : '',
      dateAdded: c.dateAdded ? getSafeDate(c.dateAdded) : '',
      currentLocation: c.currentLocation || '',
      preferredLocation: c.preferredLocation || '',
      position: isKnownJob || !savedPos ? savedPos : 'Other',
      positionOther: !isKnownJob && savedPos ? savedPos : '',
      client: c.client || '',
      clientCandidateId: c.clientCandidateId || '',
      currentCompany: c.currentCompany || '',
      totalExperience: c.totalExperience || '',
      totalExperienceYears: (c.totalExperience || '').split('yrs')[0]?.trim() || '0',
      totalExperienceMonths: (c.totalExperience || '').split('yrs')[1]?.replace('months', '')?.trim() || '0',
      relevantExperience: c.relevantExperience || '',
      relevantExperienceYears: (c.relevantExperience || '').split('yrs')[0]?.trim() || '0',
      relevantExperienceMonths: (c.relevantExperience || '').split('yrs')[1]?.replace('months', '')?.trim() || '0',
      ctc: c.ctc || '',
      currentTakeHome: c.currentTakeHome || '',
      ectc: c.ectc || '',
      expectedTakeHome: c.expectedTakeHome || '',
      noticePeriod: c.noticePeriod || '',
      servingNoticePeriod: c.servingNoticePeriod ? 'true' : 'false',
      lwd: c.lwd ? getSafeDate(c.lwd) : '',
      reasonForChange: c.reasonForChange || '',
      offersInHand: c.offersInHand ? 'true' : 'false',
      offerPackage: c.offerPackage || '',
      source: c.source || 'Portal',
      status: (() => {
        if (Array.isArray(c.status)) return c.status;
        if (typeof c.status === 'string') return c.status.split(',').map(s => s.trim()).filter(Boolean);
        return ['Submitted'];
      })(),
      recruiterId: typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId || '',
      skills: Array.isArray(c.skills) ? c.skills.join(', ') : c.skills || '',
      remarks: c.remarks || '',
      customFields: c.customFields || {},
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc',
    }));
  };
  const SortIcon = ({ field }) => {
    if (!sortConfig || sortConfig.key !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-blue-500" /> : <ArrowDown className="h-3 w-3 ml-1 text-blue-500" />;
  };

  // ── Filtered / Sorted / Paginated Candidates ──────────────────────────────
  const filteredCandidates = useMemo(() => {
    let result = candidates.filter((c) => {
      const matchSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.candidateId || '').toLowerCase().includes(searchTerm.toLowerCase());
      const statusArr = Array.isArray(c.status) ? c.status : [c.status || ''];
      const matchStatus = statusFilter === 'all' || statusArr.includes(statusFilter);
      const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
      const matchRec = recruiterFilter === 'all' || recId === recruiterFilter;
      const matchClient = clientFilter === 'all' || c.client === clientFilter;
      const statMatch = activeStatFilter ? statusArr.includes(activeStatFilter) : true;
      return matchSearch && matchStatus && matchRec && matchClient && statMatch;
    });
    if (sortConfig) {
      result.sort((a, b) => {
        const av = a[sortConfig.key] || '';
        const bv = b[sortConfig.key] || '';
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [candidates, searchTerm, statusFilter, recruiterFilter, clientFilter, activeStatFilter, sortConfig]);

  const stats = useMemo(() => {
    const count = (s) => candidates.filter((c) => (Array.isArray(c.status) ? c.status : [c.status || '']).includes(s)).length;
    const todayD = getSafeDate(new Date());
    const todayCount = candidates.filter((c) => getSafeDate(c.dateAdded || c.createdAt) === todayD).length;
    return {
      total: candidates.length, turnups: count('Turnups'), noShow: count('No Show'),
      yetToAttend: count('Yet to attend'), selected: count('Selected'), rejected: count('Rejected'),
      hold: count('Hold'), pipeline: count('Pipeline'), joined: count('Joined'), backout: count('Backout'),
      sharedProfiles: count('Shared Profiles'), todaySubmissions: todayCount,
    };
  }, [candidates]);

  const totalPages = Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE);
  const paginatedCandidates = filteredCandidates.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (filteredCandidates.length === 0) {
      toast({ title: 'No Data', description: 'Nothing to export.', variant: 'destructive' });
      return;
    }
    try {
      const rows = filteredCandidates.map((c) => {
        const flatCustom = {};
        if (c.customFields) Object.keys(c.customFields).forEach((k) => { flatCustom[`Custom: ${k}`] = c.customFields[k]; });
        return {
          'Candidate ID': c.candidateId || c._id?.slice(-6).toUpperCase() || '',
          'First Name': c.firstName || '',
          'Last Name': c.lastName || '',
          'Full Name': c.name || '',
          'Recruiter': typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '',
          'Email': c.email || '',
          'Contact': c.contact || '',
          'Status': Array.isArray(c.status) ? (c.status[c.status.length - 1] || '') : (c.status || ''),
          'Current Location': c.currentLocation || '',
          'Preferred Location': c.preferredLocation || '',
          'Total Experience': c.totalExperience || '',
          'Relevant Experience': c.relevantExperience || '',
          'Current Company': c.currentCompany || '',
          'Reason For Change': c.reasonForChange || '',
          'Current CTC': c.ctc || '',
          'Current Take Home': c.currentTakeHome || '',
          'Expected CTC': c.ectc || '',
          'Expected Take Home': c.expectedTakeHome || '',
          'Notice Period': c.noticePeriod || '',
          'Serving Notice': c.servingNoticePeriod ? 'Yes' : 'No',
          'LWD': c.lwd ? new Date(c.lwd).toLocaleDateString('en-GB') : '',
          'Offers In Hand': c.offersInHand ? 'Yes' : 'No',
          'Offer Package': c.offerPackage || '',
          'Source': c.source || '',
          'Skills': Array.isArray(c.skills) ? c.skills.join(' | ') : (c.skills || ''),
          'Date Added': (c.dateAdded || c.createdAt) ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB') : '',
          ...flatCustom,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0] || {}).map((key) => ({ wch: Math.max(key.length, ...rows.map((r) => String(r[key] || '').length), 10) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
      XLSX.writeFile(wb, `Candidates_Export_${todayStr}.xlsx`);
      toast({ title: 'Exported!', description: `${rows.length} candidate(s) exported.` });
    } catch {
      toast({ title: 'Export failed', description: 'Could not export file.', variant: 'destructive' });
    }
  };

  // ── Bulk Select ───────────────────────────────────────────────────────────
  const handleSelectAll = (e) => setSelectedIds(e.target.checked ? filteredCandidates.map((c) => c._id) : []);
  const handleSelectOne = (e, id) => setSelectedIds((prev) => e.target.checked ? [...prev, id] : prev.filter((x) => x !== id));

  const handleBulkAssign = async () => {
    if (!bulkRecruiterId) {
      toast({ title: 'Error', description: 'Please select a recruiter first.', variant: 'destructive' });
      return;
    }
    setIsBulkAssigning(true);
    try {
      const res = await fetch(`${API_URL}/candidates/bulk-assign`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({ candidateIds: selectedIds, recruiterId: bulkRecruiterId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast({ title: 'Success', description: data.message });
      setCandidates((prev) => prev.map((c) => selectedIds.includes(c._id) ? { ...c, recruiterId: bulkRecruiterId } : c));
      setSelectedIds([]);
      setBulkRecruiterId('');
    } catch {
      toast({ title: 'Error', description: 'Failed to assign.', variant: 'destructive' });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // ── Settings Modal Functions ──────────────────────────────────────────────
  const handleOpenSettings = () => {
    setTempHiddenFields(tenantSettings.hiddenFields || []);
    setTempCustomFields(tenantSettings.customFields || []);
    setNewFieldName('');
    setNewFieldType('text');
    setEditingFieldIndex(null);
    setIsSettingsOpen(true);
  };

  const handleToggleHiddenField = (fieldId) =>
    setTempHiddenFields((prev) => prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]);

  const handleEditCustomField = (index) => {
    const f = tempCustomFields[index];
    setNewFieldName(f.fieldName);
    setNewFieldType(f.fieldType);
    setEditingFieldIndex(index);
  };

  const handleAddOrUpdateCustomField = () => {
    if (!newFieldName.trim()) {
      toast({ title: 'Error', description: 'Field name is required.', variant: 'destructive' });
      return;
    }
    const isDuplicate = tempCustomFields.some((f, idx) =>
      idx !== editingFieldIndex && f.fieldName.toLowerCase() === newFieldName.trim().toLowerCase()
    );
    if (isDuplicate) {
      toast({ title: 'Error', description: 'A field with this name already exists.', variant: 'destructive' });
      return;
    }
    if (editingFieldIndex !== null) {
      const updated = [...tempCustomFields];
      updated[editingFieldIndex] = { fieldName: newFieldName.trim(), fieldType: newFieldType };
      setTempCustomFields(updated);
      setEditingFieldIndex(null);
    } else {
      setTempCustomFields((prev) => [...prev, { fieldName: newFieldName.trim(), fieldType: newFieldType }]);
    }
    setNewFieldName('');
    setNewFieldType('text');
  };

  const handleRemoveCustomField = (idx) => {
    setTempCustomFields((prev) => prev.filter((_, i) => i !== idx));
    if (editingFieldIndex === idx) { setEditingFieldIndex(null); setNewFieldName(''); setNewFieldType('text'); }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = { candidateSettings: { hiddenFields: tempHiddenFields, customFields: tempCustomFields } };
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      const updatedUser = await res.json();
      const stored = sessionStorage.getItem('currentUser');
      if (stored) {
        const obj = JSON.parse(stored);
        obj.candidateSettings = updatedUser.candidateSettings;
        sessionStorage.setItem('currentUser', JSON.stringify(obj));
      }
      setTenantSettings(updatedUser.candidateSettings || payload.candidateSettings);
      setIsSettingsOpen(false);
      toast({ title: 'Saved!', description: 'Candidate form settings updated.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 pb-48 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="w-full max-w-full mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Candidate Database</h1>
            <p className="text-slate-500 mt-1">Manage and track pipeline across all sources</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isManagerOrAdmin && (
              <button onClick={handleOpenSettings} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-blue-600 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-blue-700 transition shadow-sm">
                <Settings2 className="h-4 w-4" /> Form Settings
              </button>
            )}
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition shadow-sm">
              <Download className="h-4 w-4" /> Export Excel
            </button>
            <button onClick={openAddDialog} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
              <Plus className="h-4 w-4" /> Add Candidate
            </button>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Overall" value={stats.total} colorTheme="overall" active={activeStatFilter === null} onClick={() => { setActiveStatFilter(null); setStatusFilter('all'); }} icon={Users} />
          <StatCard title="Pipeline" value={stats.pipeline} colorTheme="pipeline" active={activeStatFilter === 'Pipeline'} onClick={() => { setActiveStatFilter('Pipeline'); setStatusFilter('all'); }} icon={GripVertical} />
          <StatCard title="Selected" value={stats.selected} colorTheme="selected" active={activeStatFilter === 'Selected'} onClick={() => { setActiveStatFilter('Selected'); setStatusFilter('all'); }} icon={CheckCircle2} />
          <StatCard title="Joined" value={stats.joined} colorTheme="joined" active={activeStatFilter === 'Joined'} onClick={() => { setActiveStatFilter('Joined'); setStatusFilter('all'); }} icon={Check} />
          <StatCard title="Turnups" value={stats.turnups} colorTheme="turnups" active={activeStatFilter === 'Turnups'} onClick={() => { setActiveStatFilter('Turnups'); setStatusFilter('all'); }} icon={Calendar} />
          <StatCard title="Shared" value={stats.sharedProfiles} colorTheme="shared" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} icon={FileText} />
          <StatCard title="Yet to Attend" value={stats.yetToAttend} colorTheme="yetToAttend" active={activeStatFilter === 'Yet to attend'} onClick={() => { setActiveStatFilter('Yet to attend'); setStatusFilter('all'); }} icon={Clock} />
          <StatCard title="Hold" value={stats.hold} colorTheme="hold" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} icon={Ban} />
          <StatCard title="Rejected" value={stats.rejected} colorTheme="rejected" active={activeStatFilter === 'Rejected'} onClick={() => { setActiveStatFilter('Rejected'); setStatusFilter('all'); }} icon={Trash2} />
          <StatCard title="No Show" value={stats.noShow} colorTheme="noshow" active={activeStatFilter === 'No Show'} onClick={() => { setActiveStatFilter('No Show'); setStatusFilter('all'); }} icon={X} />
          <StatCard title="Backout" value={stats.backout} colorTheme="backout" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} icon={ArrowDown} />
          <StatCard title="Today" value={stats.todaySubmissions} colorTheme="today" active={false} onClick={() => setIsTodaySubOpen(true)} icon={Sparkles} />
        </div>

        {/* ── Filters ── */}
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white shadow-sm flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name, email, ID…" className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto">
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Clients</option>
              {clients.map((c) => <option key={c._id || c.id} value={c.companyName || c.name}>{c.companyName || c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Status</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Users</option>
              {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
            </select>
          </div>
        </div>

        {/* ── Bulk Action Bar ── */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">{selectedIds.length} Selected</span>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <select value={bulkRecruiterId} onChange={(e) => setBulkRecruiterId(e.target.value)} className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]">
                <option value="">Assign to User…</option>
                {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
              </select>
              <button onClick={handleBulkAssign} disabled={!bulkRecruiterId || isBulkAssigning} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {isBulkAssigning && <Loader2 className="h-3 w-3 animate-spin" />} Assign Candidates
              </button>
            </div>
            <button onClick={() => setSelectedIds([])} className="ml-auto text-sm text-slate-500 hover:text-slate-800 font-medium px-2 py-1">Clear Selection</button>
          </div>
        )}

        {/* ── Table ── */}
        <style>{`.tbl-scroll::-webkit-scrollbar{height:10px}.tbl-scroll::-webkit-scrollbar-track{background:#e2e8f0;border-radius:10px}.tbl-scroll::-webkit-scrollbar-thumb{background:#475569;border-radius:10px;border:2px solid #e2e8f0}.tbl-scroll::-webkit-scrollbar-thumb:hover{background:#1e293b}.tbl-scroll{scrollbar-width:thin;scrollbar-color:#475569 #e2e8f0}`}</style>
        <div className="w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white flex flex-col">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">
                        <input type="checkbox" checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0} onChange={handleSelectAll} className="rounded border-slate-300 text-blue-600 h-4 w-4 cursor-pointer" />
                      </th>
                      <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('candidateId')}>ID <SortIcon field="candidateId" /></th>
                      <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('name')}>Candidate Name <SortIcon field="name" /></th>
                      <th className="px-4 py-3 whitespace-nowrap text-blue-600 font-bold">Recruiter</th>
                      <th className="px-4 py-3 whitespace-nowrap">Client</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date Added</th>
                      {!isHidden('totalExperience') && <th className="px-4 py-3 whitespace-nowrap">Experience</th>}
                      {!isHidden('ctc') && <th className="px-4 py-3 whitespace-nowrap">CTC / ECTC</th>}
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  {paginatedCandidates.map((c) => {
                    const statusArr = Array.isArray(c.status) ? c.status : [c.status || 'Submitted'];
                    const isSelected = selectedIds.includes(c._id);
                    return (
                      <tbody
                        key={c._id}
                        className="group border-b border-slate-100 last:border-0"
                      >
                        <tr
                          onClick={() => setExpandedRowId(expandedRowId === c._id ? null : c._id)}
                          className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={(e) => handleSelectOne(e, c._id)} className="rounded border-slate-300 text-blue-600 h-4 w-4 cursor-pointer" />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold cursor-pointer whitespace-nowrap" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(getCandidateId(c)); toast({ title: 'Copied ID' }); }}>
                            {getCandidateId(c)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shadow-sm border-2 border-white">
                                {c.name ? c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{c.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{c.position || 'No Role'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#283086] font-bold italic">{typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '-'}</td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{c.client || '-'}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-GB') : (c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '-')}</td>
                          {!isHidden('totalExperience') && <td className="px-4 py-3 text-sm whitespace-nowrap">{c.totalExperience ? `${c.totalExperience} ` : '-'}</td>}
                          {!isHidden('ctc') && <td className="px-4 py-3 text-xs whitespace-nowrap"><div>{c.ctc ? `${c.ctc} LPA` : '-'}</div><div className="text-green-600">{c.ectc ? `${c.ectc} LPA` : '-'}</div></td>}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 min-w-[120px]">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${getStatusBadgeColor(statusArr[statusArr.length - 1])}`}>
                                {statusArr[statusArr.length - 1] || 'Submitted'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex justify-end items-center gap-2">
                              <Eye className="h-4 w-4 text-blue-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); setViewCandidate(c); setIsViewDialogOpen(true); }} />
                              <Edit className="h-4 w-4 text-slate-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); openEditDialog(c); }} />
                              <Trash2 className="h-4 w-4 text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }} />
                              <div className="ml-2 pl-2 border-l border-slate-200">
                                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${expandedRowId === c._id ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr className={`bg-blue-50/20 border-blue-50/50 transition-all duration-300 ${expandedRowId === c._id ? 'border-t' : 'border-0'}`}>
                          <td colSpan="100" className="p-0">
                            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${expandedRowId === c._id ? 'max-h-[500px] opacity-100 py-4 px-8' : 'max-h-0 opacity-0'}`}>
                              <div className="flex flex-col gap-4 text-sm">
                                <div className="flex items-start gap-2">
                                  <span className="font-bold text-slate-700 min-w-[70px]">Skills:</span>
                                  <span className="text-slate-600">
                                    {!c.skills ? 'N/A' : Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="font-bold text-slate-700 min-w-[70px]">Remarks:</span>
                                  <span className="text-slate-600">{c.remarks || '-'}</span>
                                </div>
                                <ApplicationStatusBar currentStatus={c.status} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    );
                  })}
                </table>
                {filteredCandidates.length === 0 && !loading && (
                  <div className="text-center py-12 text-slate-500">No candidates match your filters.</div>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-t border-slate-100 bg-white gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-500">
                      Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCandidates.length)}</span> of <span className="text-slate-900 font-bold">{filteredCandidates.length}</span> candidates
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage((p) => p - 1)} 
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <ChevronDown className="h-4 w-4 rotate-90" />
                      Previous
                    </button>
                    
                    <div className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-sm font-bold shadow-sm">
                      Page {currentPage} <span className="mx-1.5 opacity-50 text-blue-300">/</span> {totalPages}
                    </div>

                    <button 
                      disabled={currentPage === totalPages} 
                      onClick={() => setCurrentPage((p) => p + 1)} 
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Next
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ADD / EDIT DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">

            {/* Dialog Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Candidate' : 'Add New Candidate'}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Fill out all the details for the candidate profile.</p>
              </div>
              <button onClick={() => setIsDialogOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none px-2">×</button>
            </div>

            {/* Dialog Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-8">

              {/* Resume Success Banner */}
              {resumeSuccess.show && (
                <div style={{ background: 'linear-gradient(to right,#f0fdf4,#ecfdf5,#f0fdf4)', border: '1.5px solid #86efac', borderRadius: '12px', boxShadow: '0 4px 24px rgba(34,197,94,.13)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px' }}>
                    <div style={{ flexShrink: 0, width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 style={{ width: '20px', height: '20px', color: '#16a34a' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <Sparkles style={{ width: '14px', height: '14px', color: '#22c55e' }} />
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#14532d', margin: 0 }}>Resume Extracted Successfully!</p>
                      </div>
                      <p style={{ fontSize: '12px', color: '#15803d', margin: '3px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText style={{ width: '12px', height: '12px' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{resumeSuccess.fileName}</span>
                      </p>
                      {resumeSuccess.fieldsCount > 0 && <p style={{ fontSize: '12px', color: '#16a34a', margin: '5px 0 0 0' }}>✓ {resumeSuccess.fieldsCount} field{resumeSuccess.fieldsCount !== 1 ? 's' : ''} auto-filled — review and complete missing details.</p>}
                    </div>
                    <button onClick={() => setResumeSuccess((s) => ({ ...s, show: false }))} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: '#4ade80', lineHeight: 1 }}>
                      <X style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Upload Resume ── */}
              {!isEditMode && (
                <section>
                  <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Upload Resume (Auto Fill)</h3>
                  <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors">
                    {isParsingResume ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                        <p className="text-sm text-blue-800 font-medium">Parsing resume details…</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white p-3 rounded-full mb-3 shadow-sm border border-blue-100"><Plus className="h-6 w-6 text-blue-600" /></div>
                        <p className="text-sm text-slate-600 mb-4 text-center">Upload a CV to automatically fill candidate details.<br /><span className="text-xs text-slate-400">Supported: PDF, DOC, DOCX (Max 5MB)</span></p>
                        <input type="file" id="resume-upload" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeUpload} />
                        <label htmlFor="resume-upload" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer transition shadow-sm">Browse Files</label>
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* ── Personal Information ── */}
              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">First Name *</label>
                    <input type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} className={inputCls(errors.firstName)} />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Last Name *</label>
                    <input type="text" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} className={inputCls(errors.lastName)} />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Contact Number *</label>
                    <div className="relative">
                      <input type="text" value={formData.contact} onChange={(e) => handleInputChange('contact', e.target.value)} onBlur={(e) => checkPhoneDuplicate(e.target.value)} className={inputCls(errors.contact)} maxLength={10} placeholder="10-digit number" />
                      {isCheckingPhone && <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>}
                    </div>
                    {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
                  </div>
                  {!isHidden('alternateNumber') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Alternate Number</label>
                      <input type="text" value={formData.alternateNumber} onChange={(e) => handleInputChange('alternateNumber', e.target.value)} className={inputCls(false)} placeholder="e.g. 9876543210" maxLength={10} />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Email Address *</label>
                    <div className="relative">
                      <input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} onBlur={(e) => checkEmailDuplicate(e.target.value)} className={inputCls(errors.email)} />
                      {isCheckingEmail && <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>}
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  {!isHidden('currentLocation') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Current Location</label>
                      <input type="text" value={formData.currentLocation} onChange={(e) => handleInputChange('currentLocation', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('preferredLocation') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Preferred Location</label>
                      <input type="text" value={formData.preferredLocation} onChange={(e) => handleInputChange('preferredLocation', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('dateOfBirth') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Date of Birth</label>
                      <input type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]} className={inputCls(errors.dateOfBirth)} />
                      {errors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth}</p>}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Date Added</label>
                    <input type="date" value={formData.dateAdded} onChange={(e) => handleInputChange('dateAdded', e.target.value)} max={todayStr} className={inputCls(errors.dateAdded)} />
                    <p className="text-xs text-slate-400 mt-1">Cannot be a future date. Defaults to today.</p>
                    {errors.dateAdded && <p className="text-xs text-red-500 mt-1">{errors.dateAdded}</p>}
                  </div>
                </div>
              </section>

              {/* ── Professional Details ── */}
              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Professional Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Role (Position) *</label>
                    <select value={formData.position} onChange={(e) => { handleInputChange('position', e.target.value); if (e.target.value !== 'Other') handleInputChange('positionOther', ''); }} className={inputCls(errors.position)}>
                      <option value="">Select Job Opening</option>
                      {jobs.map((j) => {
                        const title = j.title || j.jobTitle || j.position || '';
                        return title ? <option key={j._id} value={title}>{title}{j.client ? ` — ${j.client}` : ''}</option> : null;
                      })}
                      <option value="Other">Other (type manually)</option>
                    </select>
                    {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
                    {formData.position === 'Other' && (
                      <div className="mt-2">
                        <input type="text" value={formData.positionOther} onChange={(e) => handleInputChange('positionOther', e.target.value)} className={inputCls(errors.positionOther)} placeholder="Enter job opening name…" autoFocus />
                        {errors.positionOther && <p className="text-xs text-red-500 mt-1">{errors.positionOther}</p>}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-slate-700">Client / Target Company *</label>
                      {formData.clientCandidateId && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                          Company ID: {formData.clientCandidateId}
                        </span>
                      )}
                    </div>
                    <select value={formData.client} onChange={(e) => handleInputChange('client', e.target.value)} className={inputCls(errors.client)}>
                      <option value="">Select Client</option>
                      {clients.map((c) => <option key={c._id} value={c.companyName || c.name}>{c.companyName || c.name}</option>)}
                    </select>
                    {errors.client && <p className="text-xs text-red-500 mt-1">{errors.client}</p>}
                  </div>
                  {!isHidden('currentCompany') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Current Company</label>
                      <input type="text" value={formData.currentCompany} onChange={(e) => handleInputChange('currentCompany', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('reasonForChange') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Reason for Change</label>
                      <input type="text" value={formData.reasonForChange} onChange={(e) => handleInputChange('reasonForChange', e.target.value)} className={inputCls(false)} />
                    </div>
                  )}
                  {!isHidden('totalExperience') && (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Total Experience *</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <select value={formData.totalExperienceYears} onChange={(e) => handleInputChange('totalExperienceYears', e.target.value)} className={inputCls(errors.totalExperience)}>
                            {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i} Years</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <select value={formData.totalExperienceMonths} onChange={(e) => handleInputChange('totalExperienceMonths', e.target.value)} className={inputCls(errors.totalExperience)}>
                            {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i} Months</option>)}
                          </select>
                        </div>
                      </div>
                      {errors.totalExperience && <p className="text-xs text-red-500 mt-1">{errors.totalExperience}</p>}
                    </div>
                  )}
                  {!isHidden('relevantExperience') && (
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Relevant Experience</label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <select value={formData.relevantExperienceYears} onChange={(e) => handleInputChange('relevantExperienceYears', e.target.value)} className={inputCls(false)}>
                            {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{i} Years</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <select value={formData.relevantExperienceMonths} onChange={(e) => handleInputChange('relevantExperienceMonths', e.target.value)} className={inputCls(errors.relevantExperience)}>
                            {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i} Months</option>)}
                          </select>
                        </div>
                      </div>
                      {errors.relevantExperience && <p className="text-xs text-red-500 mt-1">{errors.relevantExperience}</p>}
                    </div>
                  )}
                  {!isHidden('skills') && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-slate-700">Skills (Comma Separated)</label>
                      <input type="text" value={formData.skills} onChange={(e) => handleInputChange('skills', e.target.value)} className={inputCls(false)} placeholder="React, Node, Python…" />
                    </div>
                  )}
                </div>
              </section>

              {/* ── Financial & Availability ── */}
              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Financial & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    {!isHidden('ctc') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Current CTC</label>
                        <input type="text" value={formData.ctc} onChange={(e) => handleInputChange('ctc', e.target.value)} className={inputCls(false)} placeholder="e.g. 10 LPA" />
                      </div>
                    )}
                    {!isHidden('currentTakeHome') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Current Take Home</label>
                        <input type="text" value={formData.currentTakeHome} onChange={(e) => handleInputChange('currentTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 60k/mo" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {!isHidden('ectc') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Expected CTC</label>
                        <input type="text" value={formData.ectc} onChange={(e) => handleInputChange('ectc', e.target.value)} className={inputCls(false)} placeholder="e.g. 15 LPA" />
                      </div>
                    )}
                    {!isHidden('expectedTakeHome') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Expected Take Home</label>
                        <input type="text" value={formData.expectedTakeHome} onChange={(e) => handleInputChange('expectedTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 90k/mo" />
                      </div>
                    )}
                  </div>
                  {!isHidden('noticePeriod') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Notice Period</label>
                      <input type="text" value={formData.noticePeriod} onChange={(e) => handleInputChange('noticePeriod', e.target.value)} className={inputCls(false)} placeholder="e.g. 30 Days" />
                    </div>
                  )}
                  {!isHidden('servingNoticePeriod') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Serving Notice Period?</label>
                      <select value={formData.servingNoticePeriod} onChange={(e) => handleInputChange('servingNoticePeriod', e.target.value)} className={inputCls(false)}>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                  )}
                  {!isHidden('servingNoticePeriod') && formData.servingNoticePeriod === 'true' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">LWD (Last Working Day) *</label>
                      <input type="date" value={formData.lwd} onChange={(e) => handleInputChange('lwd', e.target.value)} className={inputCls(errors.lwd)} />
                      {errors.lwd && <p className="text-xs text-red-500 mt-1">{errors.lwd}</p>}
                    </div>
                  )}
                  {!isHidden('offersInHand') && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Offer in Hand?</label>
                      <select value={formData.offersInHand} onChange={(e) => handleInputChange('offersInHand', e.target.value)} className={inputCls(false)}>
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                  )}
                  {!isHidden('offersInHand') && formData.offersInHand === 'true' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Package in Hand *</label>
                      <input type="text" value={formData.offerPackage} onChange={(e) => handleInputChange('offerPackage', e.target.value)} className={inputCls(errors.offerPackage)} placeholder="e.g. 15 LPA" />
                      {errors.offerPackage && <p className="text-xs text-red-500 mt-1">{errors.offerPackage}</p>}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Custom Fields (Tenant-defined dynamic fields) ── */}
              {tenantCustomFields.length > 0 && (
                <section>
                  <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4 flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Additional Details
                    <span className="ml-2 text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{tenantCustomFields.length} custom field{tenantCustomFields.length !== 1 ? 's' : ''}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tenantCustomFields.map((cf, idx) => (
                      <div key={idx}>
                        <label className="block text-sm font-medium mb-1 text-slate-700 flex items-center gap-1.5">
                          {cf.fieldName}
                          <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">{cf.fieldType}</span>
                        </label>
                        <CustomFieldInput
                          cf={cf}
                          value={formData.customFields?.[cf.fieldName]}
                          onChange={handleCustomFieldChange}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Tracking & Assignment ── */}
              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Tracking & Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Source</label>
                    <select value={formData.source} onChange={(e) => handleInputChange('source', e.target.value)} className={inputCls(false)}>
                      {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium mb-1 text-slate-700 font-bold text-blue-600">
                      Current Status: {formData.status[formData.status.length - 1] || 'None'}
                      {formData.status.some(s => ['Joined', 'Rejected'].includes(s)) && (
                        <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Final Stage</span>
                      )}
                    </label>

                    {!formData.status.some(s => ['Joined', 'Rejected'].includes(s)) ? (
                      <div className="flex items-center gap-2">
                        <select
                          value=""
                          onChange={(e) => addStatus(e.target.value)}
                          className={inputCls(errors.status)}
                        >
                          <option value="">Move to next stage…</option>
                          {STATUS_FLOW_ORDER.filter(s => !formData.status.includes(s)).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {formData.status.length > 1 && (
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, status: prev.status.slice(0, -1) }))}
                            className="px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded border border-red-200 transition"
                            title="Rollback to previous status"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={`p-4 rounded-xl border flex flex-col gap-3 ${formData.status[formData.status.length - 1] === 'Joined'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                          {formData.status[formData.status.length - 1] === 'Joined' ? (
                            <><CheckCircle2 className="h-4 w-4" /> Progress Completed</>
                          ) : (
                            <><X className="h-4 w-4" /> Process Ended</>
                          )}
                        </div>
                        <p className="text-sm">
                          {formData.status[formData.status.length - 1] === 'Joined'
                            ? 'Success! The candidate has successfully joined.'
                            : 'The candidate has been rejected at this stage.'}
                        </p>
                        <button
                          onClick={() => setFormData(prev => ({ ...prev, status: prev.status.slice(0, -1) }))}
                          className={`text-xs font-bold w-fit px-3 py-1.5 rounded-lg border transition ${formData.status[formData.status.length - 1] === 'Joined'
                              ? 'border-emerald-200 hover:bg-emerald-100'
                              : 'border-red-200 hover:bg-red-100'
                            }`}
                        >
                          Undo / Re-open Pipeline
                        </button>
                      </div>
                    )}
                    {errors.status && <p className="text-xs text-red-500 mt-1">{errors.status}</p>}
                  </div>
                  {isManagerOrAdmin && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1 text-slate-700">Assign to User</label>
                      <select value={formData.recruiterId} onChange={(e) => handleInputChange('recruiterId', e.target.value)} className={inputCls(false)}>
                        <option value="">Select User</option>
                        {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Remarks</label>
                    <Textarea value={formData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} className={inputCls(false)} placeholder="Add any comments or remarks here…" rows={3} />
                  </div>
                </div>
              </section>

            </div>

            {/* Dialog Footer */}
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsDialogOpen(false)} className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Cancel</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving…' : isEditMode ? 'Update Profile' : 'Save Candidate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      {isViewDialogOpen && viewCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{viewCandidate.name}</h2>
                <p className="text-sm font-mono text-blue-600 mt-1">{getCandidateId(viewCandidate)}</p>
              </div>
              <button onClick={() => setIsViewDialogOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none px-2">×</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['First Name', viewCandidate.firstName],
                  ['Last Name', viewCandidate.lastName],
                  ['Email', viewCandidate.email],
                  ['Contact', viewCandidate.contact],
                  !isHidden('alternateNumber') && ['Alt Contact', viewCandidate.alternateNumber],
                  ['Role', viewCandidate.position],
                  ['Client', viewCandidate.client],
                  !isHidden('currentCompany') && ['Current Company', viewCandidate.currentCompany],
                  !isHidden('currentLocation') && ['Current Location', viewCandidate.currentLocation],
                  !isHidden('preferredLocation') && ['Preferred Location', viewCandidate.preferredLocation],
                  !isHidden('totalExperience') && ['Total Exp', viewCandidate.totalExperience ? `${viewCandidate.totalExperience} Yrs` : null],
                  !isHidden('relevantExperience') && ['Relevant Exp', viewCandidate.relevantExperience ? `${viewCandidate.relevantExperience} Yrs` : null],
                  !isHidden('ctc') && ['Current CTC', viewCandidate.ctc ? `${viewCandidate.ctc} LPA` : null],
                  !isHidden('currentTakeHome') && ['Current Take Home', viewCandidate.currentTakeHome],
                  !isHidden('ectc') && ['Expected CTC', viewCandidate.ectc ? `${viewCandidate.ectc} LPA` : null],
                  !isHidden('expectedTakeHome') && ['Expected Take Home', viewCandidate.expectedTakeHome],
                  !isHidden('noticePeriod') && ['Notice Period', viewCandidate.noticePeriod],
                  !isHidden('servingNoticePeriod') && ['Serving Notice?', viewCandidate.servingNoticePeriod ? 'Yes' : 'No'],
                  !isHidden('lwd') && ['LWD', viewCandidate.lwd ? new Date(viewCandidate.lwd).toLocaleDateString() : null],
                  !isHidden('reasonForChange') && ['Reason for Change', viewCandidate.reasonForChange],
                  !isHidden('offersInHand') && ['Offers in Hand', viewCandidate.offersInHand ? `Yes${viewCandidate.offerPackage ? ` (${viewCandidate.offerPackage})` : ''}` : 'No'],
                  ['Source', viewCandidate.source],
                  ['Recruiter', typeof viewCandidate.recruiterId === 'object' ? getRecruiterName(viewCandidate.recruiterId) : viewCandidate.recruiterName],
                  ['Status', Array.isArray(viewCandidate.status) ? viewCandidate.status.join(', ') : viewCandidate.status],
                  ['Remarks', viewCandidate.remarks],
                  // Custom fields
                  ...(viewCandidate.customFields ? Object.entries(viewCandidate.customFields).map(([k, v]) => [k, v]) : []),
                ].filter(Boolean).map(([label, val]) => val ? (
                  <div key={label} className="col-span-2 md:col-span-1 border-b border-slate-100 pb-2">
                    <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">{label}</span>
                    <span className="text-slate-900 font-medium">{val}</span>
                  </div>
                ) : null)}
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewCandidate); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Edit Details</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FORM SETTINGS MODAL (Manager/Admin only)
      ══════════════════════════════════════════════════════════════════════ */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-blue-600" />
                  Candidate Form Settings
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Customize visible fields and add custom fields for your company.</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none px-2">×</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8">

              {/* ── Section 1: Toggle standard fields visibility ── */}
              <section>
                <h3 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wider">Standard Fields Visibility</h3>
                <p className="text-sm text-slate-500 mb-4">Uncheck fields you don't need. Mandatory fields (Name, Email, Phone) cannot be hidden.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {OPTIONAL_STANDARD_FIELDS.map((field) => {
                    const isHiddenField = tempHiddenFields.includes(field.id);
                    return (
                      <label key={field.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${!isHiddenField ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
                        <input type="checkbox" checked={!isHiddenField} onChange={() => handleToggleHiddenField(field.id)} className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" />
                        <span className={`text-sm font-medium ${!isHiddenField ? 'text-blue-900' : 'text-slate-500 line-through'}`}>{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* ── Section 2: Custom Fields (Add / Edit / Delete) ── */}
              <section>
                <h3 className="text-sm font-bold text-slate-800 mb-1 uppercase tracking-wider">Custom Fields</h3>
                <p className="text-sm text-slate-500 mb-4">Add new fields specific to your hiring needs. These appear in every candidate form and view.</p>

                {/* Input Row */}
                <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 rounded-xl border mb-4 transition-colors ${editingFieldIndex !== null ? 'bg-blue-50/60 border-blue-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Field Name</label>
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddOrUpdateCustomField(); }}
                      placeholder="e.g. Passport Number, Aadhar, Willing to Relocate?"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white ${editingFieldIndex !== null ? 'border-blue-400' : 'border-slate-300'}`}
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Field Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white ${editingFieldIndex !== null ? 'border-blue-400' : 'border-slate-300'}`}
                    >
                      <option value="text">Text (Short Answer)</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Yes / No</option>
                    </select>
                  </div>
                  <div className="w-full sm:w-auto sm:self-end flex flex-col gap-1.5">
                    <button
                      onClick={handleAddOrUpdateCustomField}
                      className={`w-full flex items-center justify-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition ${editingFieldIndex !== null ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}
                    >
                      {editingFieldIndex !== null ? <><Check className="w-4 h-4" /> Update Field</> : <><Plus className="w-4 h-4" /> Add Field</>}
                    </button>
                    {editingFieldIndex !== null && (
                      <button onClick={() => { setEditingFieldIndex(null); setNewFieldName(''); setNewFieldType('text'); }} className="text-xs text-center text-slate-500 hover:text-slate-800 font-medium transition">
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Fields List */}
                {tempCustomFields.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-sm">
                    No custom fields added yet. Use the form above to add your first one.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tempCustomFields.map((field, index) => (
                      <div key={index} className={`flex justify-between items-center p-3 border rounded-xl shadow-sm transition-colors ${editingFieldIndex === index ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-slate-300" />
                          <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${editingFieldIndex === index ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                            {field.fieldType}
                          </span>
                          <span className="font-medium text-slate-800 text-sm">{field.fieldName}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleEditCustomField(index)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleRemoveCustomField(index)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>

            {/* Settings Footer */}
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <p className="text-xs text-slate-400">{tempCustomFields.length} custom field{tempCustomFields.length !== 1 ? 's' : ''} · {OPTIONAL_STANDARD_FIELDS.length - tempHiddenFields.length} of {OPTIONAL_STANDARD_FIELDS.length} standard fields visible</p>
              <div className="flex gap-3">
                <button onClick={() => setIsSettingsOpen(false)} className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Cancel</button>
                <button onClick={handleSaveSettings} disabled={isSavingSettings} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                  {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isSavingSettings ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Today Submissions Modal ── */}
      {isTodaySubOpen && (
        <AdminTodaySubmissionsModal
          candidates={candidates}
          recruiters={recruiters}
          onClose={() => setIsTodaySubOpen(false)}
          getCandidateId={getCandidateId}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TODAY SUBMISSIONS MODAL
// ══════════════════════════════════════════════════════════════════════════════
function AdminTodaySubmissionsModal({ candidates, recruiters, onClose, getCandidateId }) {
  const todayStr = getSafeDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [recruiterFilter, setRecruiterFilter] = useState('all');

  const filtered = useMemo(() => candidates.filter((c) => {
    const d = c.dateAdded || c.createdAt;
    if (getSafeDate(d) !== selectedDate) return false;
    if (recruiterFilter === 'all') return true;
    const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
    return String(recId) === String(recruiterFilter);
  }), [candidates, selectedDate, recruiterFilter]);

  const displayDate = selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  const getRecruiterDisplayName = (rec) => {
    if (!rec) return '-';
    if (typeof rec === 'object') return getRecruiterLabel(rec);
    const found = recruiters.find((r) => r._id === rec || r.id === rec);
    return found ? getRecruiterLabel(found) : '-';
  };

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Day Submissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Viewing candidates submitted on {displayDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700 min-w-[150px]">
              <option value="all">All Recruiters</option>
              {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
            </select>
            <div className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input type="date" value={selectedDate} max={todayStr} onChange={(e) => setSelectedDate(e.target.value)} className="border-none outline-none bg-transparent text-sm text-slate-700 cursor-pointer" />
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Calendar className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No submissions for {displayDate}</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">CANDIDATE ID</th>
                  <th className="px-4 py-3 whitespace-nowrap">CANDIDATE NAME</th>
                  <th className="px-4 py-3 whitespace-nowrap">RECRUITER</th>
                  <th className="px-4 py-3 whitespace-nowrap">POSITION</th>
                  <th className="px-4 py-3 whitespace-nowrap">CLIENT</th>
                  <th className="px-4 py-3 whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const statusArr = Array.isArray(c.status) ? c.status : [c.status || 'Submitted'];
                  return (
                    <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold whitespace-nowrap">{getCandidateId(c)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{getRecruiterDisplayName(c.recruiterId)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.position || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.client || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {statusArr.map((s) => (
                            <span key={s} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s === 'Selected' || s === 'Joined' ? 'bg-green-100 text-green-800' : s === 'Rejected' || s === 'No Show' || s === 'Backout' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'}`}>{s}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing <span className="font-semibold text-slate-700">{filtered.length}</span> submission{filtered.length !== 1 ? 's' : ''} for {displayDate}</p>
          <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white transition-colors">Close Window</button>
        </div>
      </div>
    </div>
  );
}