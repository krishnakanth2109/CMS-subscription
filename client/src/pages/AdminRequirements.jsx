import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  X, Eye, Pencil, Plus, CheckCircle, Ban,
  Briefcase, Building2, Calendar, MapPin, Trash2,
  Settings2, Check, Loader2, Upload, Users, ChevronDown, ChevronUp, Info
} from "lucide-react";
import JobDetailsModal, { JobCodeButton } from "@/components/JobDetailsModal";
import CandidateDetailsModal from "@/components/CandidateDetailsModal";
import { ScoreBadge, MatchBreakdownBar, SkillChips, MatchReasonBox, getScoreValue, getMatchLevelClass } from "@/components/Score/ScoreComponents";
import { getMatchingCandidatesByJobId } from "@/utils/candidateMatching";

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

const inputCls = "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-500 bg-white dark:bg-zinc-900 dark:text-zinc-100 placeholder-zinc-400";

// Score components imported from shared module — re-exported for backward compatibility
export { ScoreBadge, MatchBreakdownBar, SkillChips, MatchReasonBox, getScoreValue, getMatchLevelClass } from "@/components/Score/ScoreComponents";

const getCurrentUser = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
};

const getTenantRequirementSettings = () => {
  const user = getCurrentUser();
  return user?.requirementSettings || { hiddenFields: [], customFields: [] };
};

const OPTIONAL_STANDARD_FIELDS = [
  { id: 'relevantExperience', label: 'Relevant Experience' },
  { id: 'qualification', label: 'Educational Qualification' },
  { id: 'salaryBudget', label: 'Maximum Salary Range' },
  { id: 'monthlySalary', label: 'Monthly Salary' },
  { id: 'gender', label: 'Gender Preference' },
  { id: 'noticePeriod', label: 'Notice Period' },
  { id: 'tatTime', label: 'Date of Expiry (TAT)' },
  { id: 'primaryRecruiter', label: 'Primary Recruiter' },
  { id: 'secondaryRecruiter', label: 'Secondary Recruiter' },
  { id: 'skills', label: 'Skills' },
  { id: 'jobDescription', label: 'Job Description' },
];

const CustomFieldInput = ({ cf, value, onChange }) => {
  if (cf.fieldType === 'boolean') {
    return (
      <select value={value || 'false'} onChange={(e) => onChange(cf.fieldName, e.target.value)} className={inputCls}>
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
      className={inputCls}
      placeholder={`Enter ${cf.fieldName}...`}
    />
  );
};

const splitSkills = (value) => {
  if (Array.isArray(value)) return value.map(skill => String(skill).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,;\n]+/).map(skill => skill.trim()).filter(Boolean);
  return [];
};

/* ────────────────────── MAIN COMPONENT ──────────────────────── */
export default function AdminRequirements() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();
  const user = getCurrentUser();
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  const [tenantSettings, setTenantSettings] = useState(getTenantRequirementSettings);
  const hiddenFields = tenantSettings.hiddenFields || [];
  const tenantCustomFields = tenantSettings.customFields || [];
  const isHidden = (fieldName) => hiddenFields.includes(fieldName);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempHiddenFields, setTempHiddenFields] = useState([]);
  const [tempCustomFields, setTempCustomFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const getAuthHeader = useCallback(async () => ({
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  }), [authHeaders]);

  const [jobs, setJobs] = useState([]);
  const [candidateCounts, setCandidateCounts] = useState({});
  const [candidateModalJob, setCandidateModalJob] = useState(null);
  const [candidateModalMode, setCandidateModalMode] = useState('submitted'); // 'submitted' | 'matching'
  const [candidateModalSearch, setCandidateModalSearch] = useState('');
  const [jobCandidates, setJobCandidates] = useState([]);
  const [isLoadingJobCandidates, setIsLoadingJobCandidates] = useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = useState(null);
  const [selectedCandidateDetails, setSelectedCandidateDetails] = useState(null);
  const [allCandidates, setAllCandidates] = useState([]);
  const [clients, setClients] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientFilter, setSelectedClientFilter] = useState("");
  const [selectedLocationFilter, setSelectedLocationFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("");

  const initialFormState = {
    jobCode: "", clientName: "", position: "", location: "", jobType: "",
    experience: "", relevantExperience: "", qualification: "",
    salaryBudget: "", monthlySalary: "", gender: "Any", noticePeriod: "",
    tatTime: "", primaryRecruiter: "", secondaryRecruiter: "", skills: "",
    mandatorySkills: [], preferredSkills: [],
    jobDescription: "", active: true, customFields: {},
  };

  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [preferredSkillInput, setPreferredSkillInput] = useState("");
  const [isJDModalOpen, setIsJDModalOpen] = useState(false);
  const [isImportingJD, setIsImportingJD] = useState(false);
  const pdfInputRef = useRef(null);
  const docxInputRef = useRef(null);

  const closeRequirementForm = () => {
    setShowForm(false);
    setEditingJob(null);
    setForm(initialFormState);
    setErrors({});
    setSkillInput("");
    setPreferredSkillInput("");
    setIsJDModalOpen(false);
    setIsImportingJD(false);
  };

  const openNewRequirementForm = () => {
    setEditingJob(null);
    setForm(initialFormState);
    setErrors({});
    setSkillInput("");
    setPreferredSkillInput("");
    setIsImportingJD(false);
    setShowForm(true);
  };

  // ── Dual scrollbar refs ────────────────────────────────────────
  const handleImportJD = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const extension = file.name.toLowerCase().split('.').pop();
    if (!['pdf', 'docx'].includes(extension)) {
      toast({ title: "Unsupported file", description: "Please import a PDF or DOCX file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please import a file up to 5 MB.", variant: "destructive" });
      return;
    }

    setIsImportingJD(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const response = await fetch(`${API_URL}/jobs/import-jd`, {
        method: 'POST',
        headers: await authHeaders(),
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to import Job Description.');
      setForm(prev => ({ ...prev, jobDescription: result.text || '' }));
      toast({ title: "Imported", description: "Job Description imported successfully." });
    } catch (error) {
      toast({ title: "Import failed", description: error.message || "Unable to import this document.", variant: "destructive" });
    } finally {
      setIsImportingJD(false);
    }
  };

  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [scrollWidth, setScrollWidth] = useState('100%');
  const isSyncingTop = useRef(false);
  const isSyncingBottom = useRef(false);

  useEffect(() => {
    const tableEl = tableRef.current;
    if (!tableEl) return;
    const updateWidth = () => setScrollWidth(`${tableEl.scrollWidth}px`);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(tableEl);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateWidth); };
  }, [jobs, searchTerm, selectedClientFilter, showForm]);

  const handleTopScroll = (e) => {
    if (isSyncingTop.current) { isSyncingTop.current = false; return; }
    if (bottomScrollRef.current) { isSyncingBottom.current = true; bottomScrollRef.current.scrollLeft = e.target.scrollLeft; }
  };
  const handleBottomScroll = (e) => {
    if (isSyncingBottom.current) { isSyncingBottom.current = false; return; }
    if (topScrollRef.current) { isSyncingTop.current = true; topScrollRef.current.scrollLeft = e.target.scrollLeft; }
  };

  // ── Fetch ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const [jobsRes, clientsRes, recRes, submissionsRes, candidatesRes] = await Promise.all([
        fetch(`${API_URL}/jobs`, { headers }),
        fetch(`${API_URL}/clients`, { headers }),
        fetch(`${API_URL}/recruiters`, { headers }),
        fetch(`${API_URL}/submissions`, { headers }),
        fetch(`${API_URL}/candidates`, { headers }),
      ]);
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs((Array.isArray(data) ? data : data.data || []).map(j => ({ ...j, id: j._id })));
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients((Array.isArray(data) ? data : data.data || []).map(c => ({ id: c._id, companyName: c.companyName })));
      }
      if (recRes.ok) {
        const data = await recRes.json();
        setRecruiters((Array.isArray(data) ? data : data.data || data.recruiters || []).map(r => {
          let recName = r.name || r.username || r.fullName || r.email || 'Unnamed Recruiter';
          if (r.firstName && r.lastName) recName = `${r.firstName} ${r.lastName}`;
          return { id: r._id || r.id, name: recName, email: r.email };
        }));
      }
      if (submissionsRes.ok) {
        const submissions = await submissionsRes.json();
        setCandidateCounts((Array.isArray(submissions) ? submissions : []).reduce((acc, sub) => {
          const jobId = typeof sub.jobId === 'object' ? sub.jobId?._id : sub.jobId;
          if (jobId) acc[jobId] = (acc[jobId] || 0) + 1;
          return acc;
        }, {}));
      }
      if (candidatesRes.ok) {
        const candidates = await candidatesRes.json();
        setAllCandidates(Array.isArray(candidates) ? candidates : []);
      }
    } catch { toast({ title: "Error loading data", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [getAuthHeader]);

  useEffect(() => { fetchData(); }, []);

  // ── handleChange ───────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    if (type !== 'checkbox') {
      if (name === 'position' || name === 'qualification') newValue = newValue.replace(/[^a-zA-Z\s]/g, '');
      else if (name === 'location') newValue = newValue.replace(/[0-9]/g, '');
      else if (name === 'experience' || name === 'relevantExperience') newValue = newValue.replace(/[^0-9.\- ]/g, '');
      else if (name === 'jobCode') newValue = newValue.replace(/[^a-zA-Z0-9\-_]/g, '');
    }
    setForm({ ...form, [name]: newValue });
    if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setForm(prev => ({ ...prev, customFields: { ...prev.customFields, [fieldName]: value } }));
  };

  const skillBadges = useMemo(() => {
    const mandatorySkills = splitSkills(form.mandatorySkills);
    return mandatorySkills.length ? mandatorySkills : splitSkills(form.skills);
  }, [form.mandatorySkills, form.skills]);

  const preferredSkillBadges = useMemo(
    () => splitSkills(form.preferredSkills),
    [form.preferredSkills],
  );

  const updateSkills = (nextSkills, field = 'mandatorySkills') => {
    setForm(prev => ({
      ...prev,
      [field]: nextSkills,
      ...(field === 'mandatorySkills' ? { skills: nextSkills.join(", ") } : {}),
    }));
    if (errors.skills) setErrors(prev => { const n = { ...prev }; delete n.skills; return n; });
  };

  const addSkillsFromText = (text, field = 'mandatorySkills') => {
    const incoming = text.split(/[\n,;]+/).map(skill => skill.trim()).filter(Boolean);
    if (!incoming.length) return;
    const source = field === 'preferredSkills' ? preferredSkillBadges : skillBadges;
    const merged = [...source];
    incoming.forEach(skill => {
      if (!merged.some(existing => existing.toLowerCase() === skill.toLowerCase())) merged.push(skill);
    });
    updateSkills(merged, field);
    if (field === 'preferredSkills') setPreferredSkillInput("");
    else setSkillInput("");
  };

  const handleSkillKeyDown = (e, field = 'mandatorySkills') => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkillsFromText(field === 'preferredSkills' ? preferredSkillInput : skillInput, field);
    }
  };

  const handleSkillPaste = (e, field = 'mandatorySkills') => {
    const pasted = e.clipboardData.getData("text");
    if (!/[\n,;]/.test(pasted)) return;
    e.preventDefault();
    addSkillsFromText(pasted, field);
  };

  const removeSkill = (skillToRemove, field = 'mandatorySkills') => {
    const source = field === 'preferredSkills' ? preferredSkillBadges : skillBadges;
    updateSkills(source.filter(skill => skill !== skillToRemove), field);
  };

  // ── Settings ───────────────────────────────────────────────────
  const handleOpenSettings = () => {
    setTempHiddenFields([...hiddenFields]);
    setTempCustomFields([...tenantCustomFields]);
    setEditingFieldIndex(null);
    setNewFieldName('');
    setNewFieldType('text');
    setIsSettingsOpen(true);
  };
  const handleToggleHiddenField = (fieldId) => {
    setTempHiddenFields(prev => prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]);
  };
  const handleAddOrUpdateCustomField = () => {
    if (!newFieldName.trim()) return;
    const name = newFieldName.trim();
    if (editingFieldIndex !== null) {
      setTempCustomFields(prev => prev.map((cf, idx) => idx === editingFieldIndex ? { fieldName: name, fieldType: newFieldType } : cf));
      setEditingFieldIndex(null);
    } else {
      if (tempCustomFields.some(cf => cf.fieldName.toLowerCase() === name.toLowerCase())) {
        toast({ title: 'Duplicate Field', description: 'A field with this name already exists.', variant: 'destructive' });
        return;
      }
      setTempCustomFields(prev => [...prev, { fieldName: name, fieldType: newFieldType }]);
    }
    setNewFieldName('');
    setNewFieldType('text');
  };
  const handleEditCustomField = (index) => {
    const cf = tempCustomFields[index];
    setNewFieldName(cf.fieldName);
    setNewFieldType(cf.fieldType);
    setEditingFieldIndex(index);
  };
  const handleRemoveCustomField = (idx) => {
    setTempCustomFields(prev => prev.filter((_, i) => i !== idx));
    if (editingFieldIndex === idx) { setEditingFieldIndex(null); setNewFieldName(''); setNewFieldType('text'); }
  };
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = { requirementSettings: { hiddenFields: tempHiddenFields, customFields: tempCustomFields } };
      const res = await fetch(`${API_URL}/auth/profile`, { method: 'PUT', headers: await getAuthHeader(), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to update settings');
      const updatedUser = await res.json();
      const stored = sessionStorage.getItem('currentUser');
      if (stored) {
        const obj = JSON.parse(stored);
        obj.requirementSettings = updatedUser.requirementSettings;
        sessionStorage.setItem('currentUser', JSON.stringify(obj));
      }
      setTenantSettings(updatedUser.requirementSettings || payload.requirementSettings);
      setIsSettingsOpen(false);
      toast({ title: 'Saved!', description: 'Requirement form settings updated.' });
    } catch { toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' }); }
    finally { setIsSavingSettings(false); }
  };

  // ── Validation ─────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};
    const trimStr = (val) => (typeof val === "string" ? val.trim() : val);
    if (!form.clientName) newErrors.clientName = "Please select a client";
    const position = trimStr(form.position);
    if (!position) newErrors.position = "Role is required";
    else if (position.length < 2) newErrors.position = "Must be at least 2 characters";
    if (!trimStr(form.location)) newErrors.location = "Location is required";
    if (!form.jobType) newErrors.jobType = "Please select a type";
    if (!trimStr(form.experience)) newErrors.experience = "Experience is required";
    if (!isHidden('primaryRecruiter') && !isHidden('secondaryRecruiter')) {
      if (form.primaryRecruiter && form.secondaryRecruiter && form.primaryRecruiter === form.secondaryRecruiter) {
        newErrors.secondaryRecruiter = "Secondary Recruiter cannot be the same as Primary";
        newErrors.primaryRecruiter = "Must be different from Secondary";
      }
    }
    if (!isHidden('skills') && skillBadges.length === 0) newErrors.skills = "At least one mandatory skill is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({ title: "Validation Error", description: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    const sanitizedPayload = {
      ...form,
      position: form.position.trim(),
      location: form.location.trim(),
      experience: form.experience.trim(),
      relevantExperience: isHidden('relevantExperience') ? "" : (form.relevantExperience?.trim() || ""),
      qualification: isHidden('qualification') ? "" : (form.qualification?.trim() || ""),
      salaryBudget: isHidden('salaryBudget') ? "" : (form.salaryBudget?.trim() || ""),
      monthlySalary: isHidden('monthlySalary') ? "" : (form.monthlySalary?.trim() || ""),
      noticePeriod: isHidden('noticePeriod') ? "" : (form.noticePeriod?.trim() || ""),
      tatTime: isHidden('tatTime') ? null : (form.tatTime || null),
      skills: isHidden('skills') ? "" : skillBadges.join(", "),
      mandatorySkills: isHidden('skills') ? [] : skillBadges,
      preferredSkills: isHidden('skills') ? [] : preferredSkillBadges,
      jobDescription: isHidden('jobDescription') ? "" : (form.jobDescription?.trim() || ""),
      jobType: form.jobType || "",
      customFields: form.customFields || {},
    };
    try {
      const url = editingJob ? `${API_URL}/jobs/${editingJob.id}` : `${API_URL}/jobs`;
      const response = await fetch(url, {
        method: editingJob ? 'PUT' : 'POST',
        headers: await getAuthHeader(),
        body: JSON.stringify(sanitizedPayload),
      });
      if (!response.ok) throw new Error('Failed to save job');
      const saved = await response.json();
      const normalized = { ...saved, id: saved._id };
      if (editingJob) setJobs(prev => prev.map(j => j.id === editingJob.id ? normalized : j));
      else setJobs(prev => [normalized, ...prev]);
      toast({ title: "Success", description: "Job requirement saved successfully" });
      closeRequirementForm();
    } catch { toast({ title: "Error", description: "Failed to save data. Please try again.", variant: "destructive" }); }
  };

  const handleEditJob = (job) => {
    setEditingJob(job);
    setErrors({});
    setSkillInput("");
    setPreferredSkillInput("");
    setForm({
      ...initialFormState,
      ...job,
      mandatorySkills: splitSkills(job.mandatorySkills).length ? splitSkills(job.mandatorySkills) : splitSkills(job.skills),
      preferredSkills: splitSkills(job.preferredSkills),
      tatTime: job.tatTime ? new Date(job.tatTime).toISOString().substring(0, 10) : "",
      customFields: job.customFields || {},
    });
    setShowForm(true);
  };
  const handleToggleActive = async (job) => {
    try {
      await fetch(`${API_URL}/jobs/${job.id}`, { method: 'PUT', headers: await getAuthHeader(), body: JSON.stringify({ active: !job.active }) });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, active: !job.active } : j));
      toast({ title: "Status Updated" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  };
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this requirement? This action cannot be undone.")) return;
    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}`, { method: 'DELETE', headers: await getAuthHeader() });
      if (!response.ok) throw new Error('Failed to delete job');
      setJobs(prev => prev.filter(j => j.id !== jobId));
      setCandidateCounts(prev => { const next = { ...prev }; delete next[jobId]; return next; });
      toast({ title: "Deleted", description: "Requirement deleted successfully." });
    } catch { toast({ title: "Error", description: "Failed to delete requirement.", variant: "destructive" }); }
  };

  const handleOpenCandidateModal = async (job) => {
    setCandidateModalJob(job);
    setCandidateModalMode('submitted');
    setCandidateModalSearch('');
    setJobCandidates([]);
    setIsLoadingJobCandidates(true);
    try {
      const res = await fetch(`${API_URL}/submissions?jobId=${job.id}`, { headers: await getAuthHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load candidates');
      setJobCandidates((Array.isArray(data) ? data : []).map(sub => ({
        id: sub._id || sub.id,
        status: sub.status,
        dateAdded: sub.dateAdded || sub.createdAt,
        candidate: sub.candidateId,
      })).filter(item => item.candidate));
    } catch (error) {
      toast({ title: "Error", description: error.message || "Failed to load candidates.", variant: "destructive" });
    } finally {
      setIsLoadingJobCandidates(false);
    }
  };

  const filteredJobs = useMemo(() => jobs.filter(j => {
    const matchesSearch = j.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.jobCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = selectedClientFilter === "" || j.clientName === selectedClientFilter;
    const matchesLocation = selectedLocationFilter === "" || j.location === selectedLocationFilter;
    const statusVal = j.active !== false ? "Active" : "Inactive";
    const matchesStatus = selectedStatusFilter === "" || statusVal === selectedStatusFilter;
    
    return matchesSearch && matchesClient && matchesLocation && matchesStatus;
  }), [jobs, searchTerm, selectedClientFilter, selectedLocationFilter, selectedStatusFilter]);

  const uniqueLocations = useMemo(() => [...new Set(jobs.map(j => j.location).filter(Boolean))].sort(), [jobs]);
  const uniqueClients = useMemo(() => [...new Set(clients.map(c => c.companyName).filter(Boolean))].sort(), [clients]);
  const uniqueStatuses = useMemo(() => [...new Set(jobs.map(j => j.active !== false ? "Active" : "Inactive"))].sort(), [jobs]);

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
          setIsLoadingJobCandidates(false);
          return;
        }

        const headers = await getAuthHeader();
        const scoreRes = await fetch(`${API_URL}/score-match/bulk`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requirementId: job.id,
            candidateIds: candidatesToScore.map(c => c._id || c.id),
          })
        });
        const scorePayload = await scoreRes.json();
        if (!scoreRes.ok) throw new Error(scorePayload.message || 'Failed to score candidates');

        const candidatesById = new Map(candidatesToScore.map(c => [(c._id || c.id)?.toString(), c]));
        const candidatesWithScores = (scorePayload.scores || []).map((scoreData) => {
          const c = candidatesById.get(scoreData.candidateId?.toString());
          if (!c) return null;
          return {
            id: c._id || c.id,
            status: Array.isArray(c.status) ? c.status[0] : c.status,
            candidate: c,
            scoreData
          };
        }).filter(Boolean);
        
        setJobCandidates(candidatesWithScores);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to score candidates', variant: 'destructive' });
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
    return (jobCandidates || []).filter(({ candidate }) => {
      if (!candidate) return false;
      const name = (candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || '').toLowerCase();
      const role = (candidate.position || '').toLowerCase();
      const skills = Array.isArray(candidate.skills) ? candidate.skills.join(', ') : (candidate.skills || '');
      const recruiter = (candidate.recruiterName || '').toLowerCase();
      const email = (candidate.email || '').toLowerCase();
      return (
        name.includes(q) ||
        role.includes(q) ||
        skills.toLowerCase().includes(q) ||
        recruiter.includes(q) ||
        email.includes(q)
      );
    });
  }, [jobCandidates, candidateModalSearch]);

  /* ── Section label helper ─────────────────────────────────────── */
  const SectionLabel = ({ text }) => (
    <div className="flex items-center gap-2 mb-3 select-none">
      <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 dark:bg-zinc-400" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {text}
      </span>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 space-y-8 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100">
      <div className="w-full max-w-full mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Job Requirements</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage active openings and allocations</p>
          </div>
          <div className="flex items-center gap-3">
            {isManagerOrAdmin && (
              <button onClick={handleOpenSettings} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm">
                <Settings2 className="w-4 h-4 text-zinc-500" /> Form Settings
              </button>
            )}
            <button
              onClick={openNewRequirementForm}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Requirement
            </button>
          </div>
        </div>

        {/* ── Form ── */}
        {showForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeRequirementForm}>
            <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

              {/* Form header banner */}
              <div className="px-6 py-4 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-white">{editingJob ? "Edit Job Requirement" : "New Job Requirement"}</h3>
                  <p className="text-zinc-400 text-xs mt-0.5">{editingJob ? 'Update the' : 'Create a new'} job opening below</p>
                </div>
                <div className="flex items-center gap-3">
                  {form.jobCode && (
                    <span className="text-xs font-mono bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-600">{form.jobCode}</span>
                  )}
                  <button type="button" onClick={closeRequirementForm} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors" title="Close form">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1">

                {/* Section 1: Core Details */}
                <div className="bg-zinc-50/50 dark:bg-zinc-800/10 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 transition-all hover:shadow-sm">
                  <SectionLabel text="Core Details" />
                  <div className="grid md:grid-cols-4 gap-4">

                    {/* Job Code */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Job Code</label>
                      <input name="jobCode" placeholder="Auto-generated" value={form.jobCode} disabled className={`${inputCls} bg-zinc-100 dark:bg-zinc-800 opacity-60 cursor-not-allowed`} />
                    </div>

                    {/* Client */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Client <span className="text-red-500">*</span></label>
                      <select name="clientName" value={form.clientName} onChange={handleChange} className={`${inputCls} ${errors.clientName ? "border-red-500 focus:ring-red-500" : ""}`}>
                        <option value="">Select Client</option>
                        {clients.map(c => <option key={c.id} value={c.companyName}>{c.companyName}</option>)}
                      </select>
                      {errors.clientName && <p className="text-xs text-red-500 mt-1">{errors.clientName}</p>}
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Role / Position <span className="text-red-500">*</span></label>
                      <input name="position" placeholder="E.g. Software Engineer" value={form.position} onChange={handleChange} className={`${inputCls} ${errors.position ? "border-red-500 focus:ring-red-500" : ""}`} />
                      {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
                    </div>

                    {/* Job Type */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Job Type</label>
                      <select name="jobType" value={form.jobType} onChange={handleChange} className={`${inputCls} ${errors.jobType ? "border-red-500 focus:ring-red-500" : ""}`}>
                        <option value="">Select Type</option>
                        <option value="Full Time">Full Time</option>
                        <option value="Contract">Contract</option>
                        <option value="Internship">Internship</option>
                      </select>
                      {errors.jobType && <p className="text-xs text-red-500 mt-1">{errors.jobType}</p>}
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Location <span className="text-red-500">*</span></label>
                      <input name="location" placeholder="City / Remote" value={form.location} onChange={handleChange} className={`${inputCls} ${errors.location ? "border-red-500 focus:ring-red-500" : ""}`} />
                      {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
                    </div>

                    {/* Experience */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Experience (Yrs) <span className="text-red-500">*</span></label>
                      <input name="experience" placeholder="E.g. 0.6 - 2" value={form.experience} onChange={handleChange} className={`${inputCls} ${errors.experience ? "border-red-500 focus:ring-red-500" : ""}`} />
                      {errors.experience && <p className="text-xs text-red-500 mt-1">{errors.experience}</p>}
                    </div>

                    {/* Relevant Experience */}
                    {!isHidden('relevantExperience') && (
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Relevant Experience (Yrs)</label>
                        <input name="relevantExperience" placeholder="E.g. 1 - 2" value={form.relevantExperience} onChange={handleChange} className={`${inputCls} ${errors.relevantExperience ? "border-red-500 focus:ring-red-500" : ""}`} />
                        {errors.relevantExperience && <p className="text-xs text-red-500 mt-1">{errors.relevantExperience}</p>}
                      </div>
                    )}

                    {/* Qualification */}
                    {!isHidden('qualification') && (
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Educational Qualification</label>
                        <input name="qualification" placeholder="E.g. BTech" value={form.qualification} onChange={handleChange} className={inputCls} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Compensation & Preferences */}
                {(!isHidden('salaryBudget') || !isHidden('monthlySalary') || !isHidden('gender') || !isHidden('noticePeriod') || !isHidden('tatTime')) && (
                  <div className="bg-zinc-50/50 dark:bg-zinc-800/10 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 transition-all hover:shadow-sm">
                    <SectionLabel text="Compensation & Preferences" />
                    <div className="grid md:grid-cols-4 gap-4">
                      {!isHidden('salaryBudget') && (
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Max Salary Range</label>
                          <input name="salaryBudget" placeholder="E.g. 10-12 LPA" value={form.salaryBudget} onChange={handleChange} className={inputCls} />
                        </div>
                      )}
                      {!isHidden('monthlySalary') && (
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Monthly Salary</label>
                          <input name="monthlySalary" placeholder="E.g. 50k - 60k" value={form.monthlySalary} onChange={handleChange} className={inputCls} />
                        </div>
                      )}
                      {!isHidden('gender') && (
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Gender Preference</label>
                          <select name="gender" value={form.gender} onChange={handleChange} className={inputCls}>
                            <option value="Any">Any</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                      )}
                      {!isHidden('noticePeriod') && (
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Notice Period</label>
                          <input name="noticePeriod" placeholder="E.g. 15 Days" value={form.noticePeriod} onChange={handleChange} className={inputCls} />
                        </div>
                      )}
                      {!isHidden('tatTime') && (
                        <div>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Date of Expiry (TAT)</label>
                          <input type="date" name="tatTime" value={form.tatTime} onChange={handleChange} className={inputCls} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 3: Assignment & Skills */}
                <div className="bg-zinc-50/50 dark:bg-zinc-800/10 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 transition-all hover:shadow-sm">
                  <SectionLabel text="Assignment & Skills" />
                  <div className="grid md:grid-cols-4 gap-4">
                    {!isHidden('primaryRecruiter') && (
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Primary Recruiter</label>
                        <select name="primaryRecruiter" value={form.primaryRecruiter} onChange={handleChange} className={`${inputCls} ${errors.primaryRecruiter ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <option value="">Select Recruiter</option>
                          {recruiters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                        {errors.primaryRecruiter && <p className="text-xs text-red-500 mt-1">{errors.primaryRecruiter}</p>}
                      </div>
                    )}
                    {!isHidden('secondaryRecruiter') && (
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Secondary Recruiter</label>
                        <select name="secondaryRecruiter" value={form.secondaryRecruiter} onChange={handleChange} className={`${inputCls} ${errors.secondaryRecruiter ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <option value="">Select Recruiter</option>
                          {recruiters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                        {errors.secondaryRecruiter && <p className="text-xs text-red-500 mt-1">{errors.secondaryRecruiter}</p>}
                      </div>
                    )}
                    {!isHidden('skills') && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Mandatory Skills <span className="text-red-500">*</span></label>
                        <div className={`min-h-[42px] flex flex-wrap items-center gap-2 rounded-lg border bg-white px-2 py-1.5 text-sm dark:bg-zinc-900 ${errors.skills ? "border-red-500 focus-within:ring-red-500" : "border-zinc-300 dark:border-zinc-700 focus-within:ring-zinc-500"} focus-within:ring-2`}>
                          {skillBadges.map(skill => (
                            <span key={skill} className="inline-flex max-w-full items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                              <span className="truncate">{skill}</span>
                              <button
                                type="button"
                                onClick={() => removeSkill(skill, 'mandatorySkills')}
                                className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                                title={`Remove ${skill}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          <input
                            value={skillInput}
                            onChange={e => setSkillInput(e.target.value)}
                            onKeyDown={e => handleSkillKeyDown(e, 'mandatorySkills')}
                            onPaste={e => handleSkillPaste(e, 'mandatorySkills')}
                            onBlur={() => addSkillsFromText(skillInput, 'mandatorySkills')}
                            placeholder={skillBadges.length ? "Add skill..." : "Type a skill and press Enter"}
                            className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder-zinc-400 dark:text-zinc-100"
                          />
                        </div>
                        {errors.skills && <p className="text-xs text-red-500 mt-1">{errors.skills}</p>}
                      </div>
                    )}
                    {!isHidden('skills') && (
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Preferred Skills</label>
                        <div className="min-h-[42px] flex flex-wrap items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-zinc-500">
                          {preferredSkillBadges.map(skill => (
                            <span key={skill} className="inline-flex max-w-full items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                              <span className="truncate">{skill}</span>
                              <button
                                type="button"
                                onClick={() => removeSkill(skill, 'preferredSkills')}
                                className="rounded-full p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-200"
                                title={`Remove ${skill}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          <input
                            value={preferredSkillInput}
                            onChange={e => setPreferredSkillInput(e.target.value)}
                            onKeyDown={e => handleSkillKeyDown(e, 'preferredSkills')}
                            onPaste={e => handleSkillPaste(e, 'preferredSkills')}
                            onBlur={() => addSkillsFromText(preferredSkillInput, 'preferredSkills')}
                            placeholder={preferredSkillBadges.length ? "Add preferred skill..." : "Type a preferred skill and press Enter"}
                            className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder-zinc-400 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Fields */}
                {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).length > 0 && (
                  <div className="bg-zinc-50/50 dark:bg-zinc-800/10 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 transition-all hover:shadow-sm">
                    <div className="flex items-center gap-2 mb-3 select-none">
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 dark:bg-zinc-400" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Custom Fields</span>
                    </div>
                    <div className="grid md:grid-cols-4 gap-4">
                      {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).map(cf => (
                        <div key={cf.fieldName}>
                          <label className="block text-xs font-semibold text-zinc-500 mb-1.5">{cf.fieldName}</label>
                          <CustomFieldInput cf={cf} value={form.customFields?.[cf.fieldName]} onChange={handleCustomFieldChange} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer: JD button + save/cancel */}
                <div className="flex items-center justify-between pt-5 border-t border-zinc-100 dark:border-zinc-800">
                  {!isHidden('jobDescription') ? (
                    <button
                      type="button"
                      onClick={() => setIsJDModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm transition-colors"
                    >
                      <Briefcase className="w-4 h-4 text-zinc-500" />
                      {form.jobDescription ? 'Edit Job Description' : 'Add Job Description'}
                      {form.jobDescription && <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5" title="JD added" />}
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeRequirementForm}
                      className="px-5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-6 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors"
                    >
                      {editingJob ? 'Update Requirement' : 'Save Requirement'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-4 items-center flex-wrap">
          <div className="w-full sm:flex-1 min-w-[200px]">
            <input placeholder="Search by Role, Job Code, or Company..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputCls} />
          </div>
          <div className="w-full sm:w-48">
            <select value={selectedLocationFilter} onChange={e => setSelectedLocationFilter(e.target.value)} className={inputCls}>
              <option value="">All Locations</option>
              {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <select value={selectedClientFilter} onChange={e => setSelectedClientFilter(e.target.value)} className={inputCls}>
              <option value="">All Companies</option>
              {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <select value={selectedStatusFilter} onChange={e => setSelectedStatusFilter(e.target.value)} className={inputCls}>
              <option value="">All Status</option>
              {uniqueStatuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        <style>{`
          .tbl-scroll::-webkit-scrollbar { height: 10px; }
          .tbl-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 10px; }
          .tbl-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; border: 2px solid #e2e8f0; }
          .tbl-scroll::-webkit-scrollbar-thumb:hover { background: #1e293b; }
          .tbl-scroll { scrollbar-width: thin; scrollbar-color: #475569 #e2e8f0; }
          .dark .tbl-scroll::-webkit-scrollbar-track { background: #27272a; }
          .dark .tbl-scroll::-webkit-scrollbar-thumb { background: #52525b; border-color: #27272a; }
          .dark .tbl-scroll::-webkit-scrollbar-thumb:hover { background: #71717a; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        `}</style>

        {/* ── Table ── */}
        <div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm bg-white dark:bg-zinc-900 flex flex-col relative overflow-hidden">
          {loading ? (
            <div className="text-center p-12 text-zinc-500 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-800 rounded-full animate-spin mb-4" />
              Loading jobs...
            </div>
          ) : (
            <>
              <div className="tbl-scroll max-h-[calc(100vh-16rem)] min-h-[400px] overflow-auto rounded-xl w-full">
                <table ref={tableRef} className="min-w-[1500px] w-full text-left text-sm whitespace-nowrap border-collapse">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-xs uppercase text-zinc-500 font-semibold tracking-wider sticky top-0 z-10 shadow-[0_1px_0_0_#e4e4e7] dark:shadow-[0_1px_0_0_#27272a]">
                    <tr>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Job Code</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 text-center">Candidates</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Role</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Company</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Location</th>
                      {!isHidden('primaryRecruiter') && <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Primary Recruiter</th>}
                      {!isHidden('secondaryRecruiter') && <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Secondary Recruiter</th>}
                      {!isHidden('tatTime') && <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Expiry (TAT)</th>}
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 text-center">Status</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 bg-white dark:bg-zinc-900">
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={7 + (!isHidden('primaryRecruiter') ? 1 : 0) + (!isHidden('secondaryRecruiter') ? 1 : 0) + (!isHidden('tatTime') ? 1 : 0)} className="text-center py-12 text-zinc-400">
                          No requirements found.
                        </td>
                      </tr>
                    ) : filteredJobs.map(job => (
                      <tr key={job.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                        <td className="px-6 py-4">
                          <JobCodeButton jobCode={job.jobCode} onClick={() => setSelectedJob(job)} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openCandidatesModalForJob(job, 'submitted')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                              title="View submitted candidates"
                            >
                              <Users className="h-3.5 w-3.5" />
                              {candidateCounts[job.id] || 0}
                            </button>
                            <button
                              type="button"
                              onClick={() => openCandidatesModalForJob(job, 'matching')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                              title="View matching candidates (≥ 3 skills match)"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              {matchingCounts[job.id] || 0}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{job.position}</div>
                          {job.jobType && <div className="text-xs text-zinc-400 mt-0.5">{job.jobType}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-zinc-400" />{job.clientName}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-zinc-400" />{job.location || 'N/A'}</div>
                        </td>
                        {!isHidden('primaryRecruiter') && (
                          <td className="px-6 py-4">
                            {job.primaryRecruiter ? (
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-200 dark:border-blue-800">{job.primaryRecruiter.charAt(0).toUpperCase()}</div>
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">{job.primaryRecruiter}</span>
                              </div>
                            ) : <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-700">Unassigned</span>}
                          </td>
                        )}
                        {!isHidden('secondaryRecruiter') && (
                          <td className="px-6 py-4">
                            {job.secondaryRecruiter ? (
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-200 dark:border-purple-800">{job.secondaryRecruiter.charAt(0).toUpperCase()}</div>
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">{job.secondaryRecruiter}</span>
                              </div>
                            ) : <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-700">Unassigned</span>}
                          </td>
                        )}
                        {!isHidden('tatTime') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                            <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{job.tatTime ? new Date(job.tatTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No TAT'}</div>
                            {job.tatTime && new Date(job.tatTime).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) && <span className="text-[10px] text-red-500 font-medium block mt-0.5">Expired</span>}
                          </td>
                        )}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${job.active !== false ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50" : "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"}`}>
                            {job.active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => setSelectedJob(job)} title="View Details" className="p-1.5 rounded-lg text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400"><Eye className="w-5 h-5" /></button>
                            <button onClick={() => handleEditJob(job)} title="Edit Requirement" className="p-1.5 rounded-lg text-zinc-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-zinc-800 dark:hover:text-amber-400"><Pencil className="w-5 h-5" /></button>
                            <button onClick={() => handleToggleActive(job)} title={job.active !== false ? "Mark as Inactive" : "Mark as Active"} className={`p-1.5 rounded-lg ${job.active !== false ? 'text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400' : 'text-zinc-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-zinc-800 dark:hover:text-green-400'}`}>
                              {job.active !== false ? <Ban className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                            </button>
                            <button onClick={() => handleDeleteJob(job.id)} title="Delete Requirement" className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          hiddenFields={hiddenFields}
          stats={{
            submitted: candidateCounts[selectedJob.id] || 0,
            matching: matchingCounts[selectedJob.id] || 0,
          }}
        />
      )}

      {candidateModalJob && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedCandidateDetails(null); setCandidateModalJob(null); }}>
          <div className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full ${candidateModalMode === 'matching' ? 'max-w-6xl' : 'max-w-4xl'} max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 overflow-hidden`} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-zinc-300" />
                  {candidateModalMode === 'matching' ? 'Matching Candidates' : 'Submitted Candidates'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">{candidateModalJob.position} • {candidateModalJob.jobCode}</p>
              </div>
              <button onClick={() => { setSelectedCandidateDetails(null); setCandidateModalJob(null); }} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <input
                  value={candidateModalSearch}
                  onChange={(e) => setCandidateModalSearch(e.target.value)}
                  placeholder="Search by name, role, skill, recruiter, email..."
                  className={inputCls}
                />
                <div className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                  Showing {displayCandidates.length} candidate(s)
                </div>
              </div>
              {isLoadingJobCandidates ? (
                <div className="py-12 text-center text-zinc-500 flex flex-col items-center">
                  <Loader2 className="w-7 h-7 animate-spin mb-3" />
                  Loading candidates...
                </div>
              ) : displayCandidates.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  No candidates found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase text-zinc-500 font-semibold">
                      <tr>
                        <th className="px-4 py-3">Avatar</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Current Role</th>
                        {candidateModalMode === 'matching' && (
                          <>
                            <th className="px-4 py-3 text-center">Match Score</th>
                            <th className="px-4 py-3">Match Level</th>
                            <th className="px-4 py-3"></th>
                          </>
                        )}
                        {candidateModalMode !== 'matching' && (
                          <>
                            <th className="px-4 py-3">Skills</th>
                            <th className="px-4 py-3">Experience</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Recruiter</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {displayCandidates.map(({ id, status, candidate, scoreData }) => {
                        const name = candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unnamed Candidate';
                        const skills = Array.isArray(candidate.skills) ? candidate.skills : (typeof candidate.skills === 'string' ? candidate.skills.split(',') : []);
                        const exp = candidate.totalExperience || candidate.relevantExperience || candidate.experience || '';
                        const avatarLetter = name.charAt(0).toUpperCase();
                        const isExpanded = expandedCandidateId === id;

                        return (
                          <React.Fragment key={id}>
                            <tr className={`bg-white dark:bg-zinc-900 transition-colors ${isExpanded ? 'bg-zinc-50 dark:bg-zinc-800/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/20'}`}>
                              <td className="px-4 py-3 w-12">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-xs">{avatarLetter}</div>
                              </td>
                              <td className="px-4 py-3">
                                {candidateModalMode === 'matching' ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCandidateDetails({ candidate, status, clientName: candidate.clientName || candidateModalJob.clientName })}
                                    className="text-left font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
                                  >
                                    {name}
                                  </button>
                                ) : (
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{name}</div>
                                )}
                                <div className="text-xs text-zinc-400">{candidate.candidateId || candidate._id?.slice(-6).toUpperCase()}</div>
                              </td>
                              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{candidate.position || '—'}</td>
                              
                              {candidateModalMode === 'matching' && (
                                <>
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
                                </>
                              )}

                              {candidateModalMode !== 'matching' && (
                                <>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                                    <div className="max-w-[360px] truncate" title={skills.filter(Boolean).join(', ')}>
                                      {skills.filter(Boolean).join(', ') || '—'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{exp || '—'}</td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{status || 'Submitted'}</span>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{candidate.recruiterName || 'Unassigned'}</td>
                                </>
                              )}
                            </tr>
                            
                            {/* Expanded Breakdown Row */}
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
            </div>
          </div>
        </div>
      )}

      {/* ── Job Description Modal ── */}
      {selectedCandidateDetails && (
        <CandidateDetailsModal
          candidate={selectedCandidateDetails.candidate}
          status={selectedCandidateDetails.status}
          clientName={selectedCandidateDetails.clientName}
          baseUrl={BASE_URL}
          onClose={() => setSelectedCandidateDetails(null)}
        />
      )}

      {isJDModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsJDModalOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Briefcase className="w-4 h-4 text-zinc-500" />Job Description</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Write a detailed description for this job requirement.</p>
              </div>
              <button onClick={() => setIsJDModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleImportJD} />
              <input ref={docxInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleImportJD} />
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Import a PDF or DOCX to fill the editor.</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isImportingJD}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {isImportingJD ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Import PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => docxInputRef.current?.click()}
                    disabled={isImportingJD}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {isImportingJD ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Import DOCX
                  </button>
                </div>
              </div>
              <textarea
                value={form.jobDescription || ''}
                onChange={e => setForm(prev => ({ ...prev, jobDescription: e.target.value }))}
                placeholder="Describe the role, responsibilities, requirements, and any other relevant information..."
                rows={14}
                className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-500 bg-white dark:bg-zinc-800 dark:text-zinc-100 placeholder-zinc-400 resize-none leading-relaxed"
              />
              <p className="text-xs text-zinc-400 mt-2">{(form.jobDescription || '').length} characters</p>
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3">
              <button onClick={() => { setForm(prev => ({ ...prev, jobDescription: '' })); setIsJDModalOpen(false); }} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">Clear</button>
              <button onClick={() => setIsJDModalOpen(false)} className="px-5 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Settings Modal ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Settings2 className="w-5 h-5 text-zinc-500" />Requirement Form Settings</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Customize visible fields and add custom fields for your requirements.</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white font-bold text-2xl leading-none px-2">×</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-zinc-800 dark:text-zinc-300">
              <section>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1 uppercase tracking-wider">Standard Fields Visibility</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Uncheck fields you don't need. Fixed fields (Client, Role/Position, Location, Experience) cannot be hidden.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {OPTIONAL_STANDARD_FIELDS.map(field => {
                    const isHiddenField = tempHiddenFields.includes(field.id);
                    return (
                      <label key={field.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${!isHiddenField ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 opacity-60'}`}>
                        <input type="checkbox" checked={!isHiddenField} onChange={() => handleToggleHiddenField(field.id)} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 focus:ring-zinc-500 cursor-pointer" />
                        <span className={`text-sm font-medium ${!isHiddenField ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 line-through'}`}>{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <hr className="border-zinc-200 dark:border-zinc-800" />

              <section>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1 uppercase tracking-wider">Custom Fields</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Add new fields specific to your requirement tracking process.</p>

                <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 rounded-xl border mb-4 transition-colors ${editingFieldIndex !== null ? 'bg-zinc-100 dark:bg-zinc-800/30 border-zinc-400' : 'bg-zinc-50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800'}`}>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Field Name</label>
                    <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddOrUpdateCustomField(); }} placeholder="e.g. Budget Approved?, Account Manager" className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-500 outline-none bg-white dark:bg-zinc-900 dark:text-zinc-100 ${editingFieldIndex !== null ? 'border-zinc-400' : 'border-zinc-300 dark:border-zinc-700'}`} />
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Field Type</label>
                    <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-500 outline-none bg-white dark:bg-zinc-900 dark:text-zinc-100 ${editingFieldIndex !== null ? 'border-zinc-400' : 'border-zinc-300 dark:border-zinc-700'}`}>
                      <option value="text">Text (Short Answer)</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Yes / No</option>
                    </select>
                  </div>
                  <div className="w-full sm:w-auto sm:self-end flex flex-col gap-1.5">
                    <button onClick={handleAddOrUpdateCustomField} className="w-full flex items-center justify-center gap-2 text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition">
                      {editingFieldIndex !== null ? <><Check className="w-4 h-4" />Update</> : <><Plus className="w-4 h-4" />Add</>}
                    </button>
                    {editingFieldIndex !== null && (
                      <button onClick={() => { setEditingFieldIndex(null); setNewFieldName(''); setNewFieldType('text'); }} className="text-xs text-center text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium transition">Cancel</button>
                    )}
                  </div>
                </div>

                {tempCustomFields.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10 text-sm">No custom fields added yet.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {tempCustomFields.map((field, index) => {
                      const isHiddenField = tempHiddenFields.includes(field.fieldName);
                      const isEditing = editingFieldIndex === index;
                      return (
                        <div key={index} className={`flex items-center justify-between p-3 rounded-lg border transition-colors select-none ${isEditing ? 'border-zinc-500 bg-zinc-100 dark:bg-zinc-800' : !isHiddenField ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 opacity-60'}`}>
                          <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                            <input type="checkbox" checked={!isHiddenField} onChange={() => handleToggleHiddenField(field.fieldName)} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 focus:ring-zinc-500 cursor-pointer" />
                            <div className="min-w-0">
                              <span className={`text-sm font-medium block truncate ${!isHiddenField ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 line-through'}`}>{field.fieldName}</span>
                              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">{field.fieldType}</span>
                            </div>
                          </label>
                          <div className="flex gap-0.5 ml-2 shrink-0">
                            <button onClick={() => handleEditCustomField(index)} className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded transition" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleRemoveCustomField(index)} className="p-1 text-zinc-400 hover:text-red-500 rounded transition" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsSettingsOpen(false)} className="px-5 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">Cancel</button>
              <button onClick={handleSaveSettings} disabled={isSavingSettings} className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50">
                {isSavingSettings && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
