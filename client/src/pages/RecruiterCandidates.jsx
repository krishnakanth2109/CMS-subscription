import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';
import {
  Plus, Search, Edit, Download, Phone, Mail,
  Building, Briefcase, Loader2, Ban, List, LayoutGrid,
  Calendar, GraduationCap, Award, UserCircle, Target,
  MessageCircle, Eye, IndianRupee, Upload, FileUp, X,
  Trash2, AlertTriangle, FileSpreadsheet, Linkedin, SlidersHorizontal,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CandidateProfileLink from '@/components/CandidateProfileLink';
import { ScoreBadge, MatchBreakdownBar, SkillChips } from '@/components/Score/ScoreComponents';
import BulkCandidateImportModal from '@/components/BulkCandidateImportModal';
import CandidateExportModal from '@/components/CandidateExportModal';
import ClientJobSubmissions from '@/components/ClientJobSubmissions';
import CandidatePipelinePanel from '@/components/CandidatePipelinePanel';
import CandidateKeywordSearch from '@/components/CandidateKeywordSearch';
import JobDetailsModal from '@/components/JobDetailsModal';
import JobInvitationModal from '@/components/JobInvitationModal';
import { candidateMatchesKeywordBadges } from '@/utils/candidateSearch';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

const ModalPortal = ({ children }) => {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getRecruiterName = (r) => {
  if (!r) return '-';
  if (r.name) return r.name;
  const first = r.firstName || '';
  const last = r.lastName || '';
  if (first || last) return `${first} ${last}`.trim();
  if (r.username) return r.username;
  return r.email || '-';
};

const normalizeSkills = (skills) => {
  const raw = Array.isArray(skills) ? skills : String(skills || '').split(/[,;\n]+/);
  const seen = new Set();
  return raw
    .map((skill) => String(skill || '').trim())
    .filter(Boolean)
    .filter((skill) => {
      const key = skill.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

// ── UI Components ─────────────────────────────────────────────────────────────

const STATUS_BADGE_CLASSES = {
  Pipeline: 'bg-gray-100 text-gray-700 border-gray-200',
  Submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  'Shared Profiles': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Yet to attend': 'bg-amber-100 text-amber-800 border-amber-200',
  Turnups: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Selected: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
  Hold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Joined: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Backout: 'bg-rose-100 text-rose-700 border-rose-200',
  'No Show': 'bg-slate-100 text-slate-700 border-slate-200',
};

const getStatusBadgeClass = (status) =>
  STATUS_BADGE_CLASSES[status] || 'bg-slate-100 text-slate-700 border-slate-200';

const StatusBadge = ({ status, className = '' }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap ${getStatusBadgeClass(status)} ${className}`}>
    {status || 'Pipeline'}
  </span>
);

const getSubmissionDateValue = (submission) =>
  submission?.submittedAt || submission?.createdAt || submission?.updatedAt || '';

const formatSubmissionDate = (submission) => {
  const value = getSubmissionDateValue(submission);
  return value ? new Date(value).toLocaleDateString('en-GB') : 'N/A';
};

const getSubmissionStatus = (submission) =>
  submission?.pipelineStage || submission?.status || 'Pipeline';

const getCandidateSubmissions = (candidate) => {
  if (!Array.isArray(candidate?.submissions)) return [];
  return [...candidate.submissions].sort((a, b) => {
    const aTime = new Date(getSubmissionDateValue(a) || 0).getTime();
    const bTime = new Date(getSubmissionDateValue(b) || 0).getTime();
    return bTime - aTime;
  });
};

const getCandidateStatuses = (candidate) => {
  const submissions = getCandidateSubmissions(candidate);
  if (submissions.length > 0) {
    // Show one status per client submission, sorted newest first
    const sorted = [...submissions].sort((a, b) => {
      const aTime = new Date(a.updatedAt || getSubmissionDateValue(a) || 0).getTime();
      const bTime = new Date(b.updatedAt || getSubmissionDateValue(b) || 0).getTime();
      return bTime - aTime;
    });
    return sorted.map((s) => getSubmissionStatus(s));
  }

  // No client submissions — show only the single latest status
  if (Array.isArray(candidate?.status)) {
    const filtered = candidate.status.filter(Boolean);
    return filtered.length > 0 ? [filtered[filtered.length - 1]] : ['Submitted'];
  }
  return [candidate?.status || 'Submitted'];
};

const getSubmissionJobDetails = (submission, jobs = []) => {
  const jobRef = submission?.jobId;
  const populatedJob = jobRef && typeof jobRef === 'object' ? jobRef : null;
  const jobId = populatedJob?._id || populatedJob?.id || jobRef;
  const job = jobs.find((item) => {
    const itemId = item?._id || item?.id;
    return (
      (jobId && itemId && String(itemId) === String(jobId)) ||
      (submission?.jobCode && item?.jobCode === submission.jobCode)
    );
  });

  return {
    ...(populatedJob || {}),
    ...(job || {}),
    jobCode: submission?.jobCode || job?.jobCode || populatedJob?.jobCode,
    clientName: submission?.clientName || job?.clientName || populatedJob?.clientName,
    position: submission?.position || job?.position || populatedJob?.position,
  };
};

const CandidateClientCell = ({ candidate, onShowMore }) => {
  const submissions = getCandidateSubmissions(candidate);
  if (submissions.length === 0) {
    return <span className="font-medium text-slate-600">{candidate.client || 'N/A'}</span>;
  }

  const [latest, ...more] = submissions;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="font-semibold text-slate-800">{latest.clientName || candidate.client || 'N/A'}</span>
      {more.length > 0 && (
        <button
          type="button"
          onClick={() => onShowMore(candidate)}
          className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          +{more.length} more
        </button>
      )}
    </div>
  );
};

const ClientSubmissionsModal = ({ candidate, jobs = [], onClose }) => {
  const submissions = getCandidateSubmissions(candidate);
  const [selectedJob, setSelectedJob] = useState(null);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Submitted Clients & Jobs</h3>
              <p className="mt-1 text-sm text-slate-500">{candidate?.name || 'Candidate'}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-auto p-5">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Client Name</th>
                    <th className="px-4 py-3">Job Code</th>
                    <th className="px-4 py-3">Job Position</th>
                    <th className="px-4 py-3">Pipeline/Status</th>
                    <th className="px-4 py-3">Submitted Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {submissions.map((submission) => (
                    <tr key={submission._id || `${submission.jobId}-${submission.jobCode}`} className="align-top">
                      <td className="px-4 py-3 font-semibold text-slate-800">{submission.clientName || 'N/A'}</td>
                      <td className="px-4 py-3">
                        {submission.jobCode ? (
                          <button
                            type="button"
                            onClick={() => setSelectedJob(getSubmissionJobDetails(submission, jobs))}
                            className="font-mono text-xs font-bold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900"
                            title="Open job details"
                          >
                            {submission.jobCode}
                          </button>
                        ) : (
                          <span className="font-mono text-xs text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{submission.position || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={getSubmissionStatus(submission)} />
                          {submission.updatedAt && (
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                              Changed: {new Date(submission.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatSubmissionDate(submission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <JobDetailsModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      </div>
    </ModalPortal>
  );
};

const Button = ({ children, onClick, disabled, className = '', variant = 'default', size = 'md', type = 'button' }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none';
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base', icon: 'p-2' };
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    link: 'text-blue-600 underline bg-transparent hover:text-blue-700 p-0',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size] ?? sizes.md} ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${className}`} {...props} />
);

const Label = ({ children, className = '', htmlFor }) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-slate-700 dark:text-slate-300 ${className}`}>{children}</label>
);

const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-slate-100 text-slate-700',
    destructive: 'bg-red-100 text-red-700',
    outline: 'border border-slate-300 text-slate-700 bg-white',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </span>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, children, maxWidth = 'max-w-2xl' }) => {
  if (!open) return null;
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className={`relative flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:bg-slate-900`}>
          {children}
        </div>
      </div>
    </ModalPortal>
  );
};
const ModalHeader = ({ children }) => <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">{children}</div>;
const ModalTitle = ({ children, className = '' }) => <h2 className={`text-xl font-bold text-slate-900 dark:text-white ${className}`}>{children}</h2>;
const ModalDesc = ({ children }) => <p className="text-sm text-slate-500 mt-1">{children}</p>;
const ModalFooter = ({ children }) => <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">{children}</div>;
const ModalBody = ({ children }) => <div className="flex-1 overflow-y-auto bg-slate-100/60 px-6 py-5">{children}</div>;

const NativeSelect = ({ value, onChange, children, className = '', disabled }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${className}`}
  >
    {children}
  </select>
);

// ── Main Component ────────────────────────────────────────────────────────────

const SkillsBadgeInput = ({ value, onChange, error }) => {
  const [draft, setDraft] = useState('');
  const skills = normalizeSkills(value);

  const addFromText = (text) => {
    const nextSkills = normalizeSkills([...skills, ...normalizeSkills(text)]);
    onChange(nextSkills);
    setDraft('');
  };

  const removeSkill = (skillToRemove) => {
    onChange(skills.filter((skill) => skill !== skillToRemove));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (draft.trim()) addFromText(draft);
    } else if (event.key === 'Backspace' && !draft && skills.length > 0) {
      removeSkill(skills[skills.length - 1]);
    }
  };

  return (
    <div className={`min-h-[42px] w-full rounded-lg border bg-white px-2 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${error ? 'border-red-500' : 'border-slate-300'}`}>
      <div className="flex flex-wrap items-center gap-2">
        {skills.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700">
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
              aria-label={`Remove ${skill}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (draft.trim()) addFromText(draft); }}
          placeholder={skills.length ? 'Add skill' : 'Type skill and press Enter'}
          className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>
    </div>
  );
};

const DEFAULT_CANDIDATE_FIELD_CONFIG = [
  { fieldName: 'firstName', label: 'First Name', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'lastName', label: 'Last Name', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'email', label: 'Email', fieldType: 'email', visible: true, isDefault: true },
  { fieldName: 'contact', label: 'Phone', fieldType: 'tel', visible: true, isDefault: true },
  { fieldName: 'dateOfBirth', label: 'Date of Birth', fieldType: 'date', visible: true, isDefault: true },
  { fieldName: 'gender', label: 'Gender', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'linkedin', label: 'LinkedIn URL', fieldType: 'url', visible: true, isDefault: true },
  { fieldName: 'currentLocation', label: 'Current Location', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'preferredLocation', label: 'Preferred Location', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'position', label: 'Current Role', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'client', label: 'Client', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'currentCompany', label: 'Current Company', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'industry', label: 'Industry', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'skills', label: 'Skills', fieldType: 'textarea', visible: true, isDefault: true },
  { fieldName: 'education', label: 'Qualification', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'totalExperience', label: 'Total Experience', fieldType: 'number', visible: true, isDefault: true },
  { fieldName: 'relevantExperience', label: 'Relevant Experience', fieldType: 'number', visible: true, isDefault: true },
  { fieldName: 'ctc', label: 'Current CTC', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'ectc', label: 'Expected CTC', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'currentTakeHome', label: 'Current Take Home', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'expectedTakeHome', label: 'Expected Take Home', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'noticePeriod', label: 'Notice Period', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'servingNoticePeriod', label: 'Serving Notice', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'reasonForChange', label: 'Reason For Change', fieldType: 'textarea', visible: true, isDefault: true },
  { fieldName: 'offersInHand', label: 'Offers in Hand', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'source', label: 'Source', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'status', label: 'Status', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'rating', label: 'Rating', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'dateAdded', label: 'Date Added', fieldType: 'date', visible: true, isDefault: true },
  { fieldName: 'remarks', label: 'Remarks', fieldType: 'textarea', visible: true, isDefault: true },
];

const REQUIRED_CANDIDATE_FIELD_NAMES = new Set(['firstName', 'lastName', 'email', 'contact', 'position', 'skills', 'status', 'dateAdded']);

const normalizeCandidateFieldConfig = (config = {}) => {
  const storedFields = Array.isArray(config.fields) ? config.fields : [];
  const storedCustomFields = Array.isArray(config.customFields) ? config.customFields : [];
  return {
    fields: DEFAULT_CANDIDATE_FIELD_CONFIG.map(field => {
      const stored = storedFields.find(item => item.fieldName === field.fieldName) || {};
      const isMandatory = field.fieldName === 'client'
        ? false
        : REQUIRED_CANDIDATE_FIELD_NAMES.has(field.fieldName) || Boolean(stored.isMandatory);
      return { ...field, ...stored, isDefault: true, isMandatory, visible: isMandatory ? true : stored.visible !== false };
    }),
    customFields: storedCustomFields.map(field => ({ ...field, isDefault: false, isMandatory: Boolean(field.isMandatory), visible: field.visible !== false })),
  };
};

const getCandidateFieldConfig = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    return normalizeCandidateFieldConfig(user?.candidateSettings || { fields: DEFAULT_CANDIDATE_FIELD_CONFIG, customFields: [] });
  } catch {
    return normalizeCandidateFieldConfig({ fields: DEFAULT_CANDIDATE_FIELD_CONFIG, customFields: [] });
  }
};

const saveCandidateFieldConfig = (config) => {
  try {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    sessionStorage.setItem('currentUser', JSON.stringify({ ...user, candidateSettings: config }));
  } catch (_) { }
};

const CandidateCustomFieldInput = ({ field, value, onChange }) => {
  const common = { value: value ?? '', onChange: e => onChange(field.fieldName, e.target.value) };
  if (field.fieldType === 'textarea') return <textarea {...common} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />;
  if (field.fieldType === 'select') return <NativeSelect value={value ?? ''} onChange={val => onChange(field.fieldName, val)}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></NativeSelect>;
  if (field.fieldType === 'checkbox') return <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(value)} onChange={e => onChange(field.fieldName, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Enabled</label>;
  return <Input type={field.fieldType || 'text'} {...common} />;
};

const CandidateFormControlModal = ({ isOpen, onClose, config, onConfigChange }) => {
  const [draftField, setDraftField] = useState({ label: '', fieldType: 'text', visible: true });
  if (!isOpen) return null;

  const toggleDefault = (fieldName) => {
    const updated = {
      ...config,
      fields: config.fields.map(field => field.fieldName === fieldName && !field.isMandatory ? { ...field, visible: !field.visible } : field),
    };
    onConfigChange(updated);
  };
  const toggleCustom = (index) => {
    const updated = { ...config, customFields: [...config.customFields] };
    updated.customFields[index] = { ...updated.customFields[index], visible: !updated.customFields[index].visible };
    onConfigChange(updated);
  };
  const updateCustomLabel = (index, value) => {
    const updated = { ...config, customFields: [...config.customFields] };
    updated.customFields[index] = { ...updated.customFields[index], label: value };
    onConfigChange(updated);
  };
  const deleteCustom = (index) => onConfigChange({ ...config, customFields: config.customFields.filter((_, idx) => idx !== index) });
  const addCustom = () => {
    const label = draftField.label.trim();
    if (!label) return;
    const fieldName = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `custom_${Date.now()}`;
    const existing = new Set([...config.fields, ...config.customFields].map(field => field.fieldName));
    let uniqueName = fieldName;
    let i = 2;
    while (existing.has(uniqueName)) uniqueName = `${fieldName}_${i++}`;
    onConfigChange({
      ...config,
      customFields: [...config.customFields, { ...draftField, label, fieldName: uniqueName, isDefault: false, isMandatory: false }],
    });
    setDraftField({ label: '', fieldType: 'text', visible: true });
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col">
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Candidate Form Control</p>
              <h2 className="text-xl font-bold text-slate-900">Manage form fields</h2>
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 text-xl leading-none">x</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
            <div className="border-r border-slate-200 bg-white p-5 lg:overflow-y-auto">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">Create additional field</p>
                <Input value={draftField.label} onChange={e => setDraftField(prev => ({ ...prev, label: e.target.value }))} placeholder="Field label" />
                <NativeSelect value={draftField.fieldType} onChange={value => setDraftField(prev => ({ ...prev, fieldType: value }))}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="email">Email</option>
                  <option value="textarea">Long Text</option>
                  <option value="select">Select</option>
                  <option value="checkbox">Checkbox</option>
                </NativeSelect>
                <Button onClick={addCustom} className="w-full"><Plus className="h-4 w-4 mr-2" /> Add Field</Button>
              </div>
            </div>
            <div className="p-5 lg:overflow-y-auto bg-slate-50 space-y-5">
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Standard Fields</p>
                  <span className="text-xs text-slate-400">{config.fields.filter(field => field.visible).length}/{config.fields.length} visible</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {config.fields.map(field => (
                    <button key={field.fieldName} onClick={() => toggleDefault(field.fieldName)} disabled={field.isMandatory} className={`text-left rounded-xl border p-3 transition ${field.visible ? 'border-blue-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-100 opacity-70'} ${field.isMandatory ? 'cursor-not-allowed' : 'hover:border-blue-300'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-800">{field.label}</span>
                        <span className={`h-5 w-9 rounded-full p-0.5 transition ${field.visible ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${field.visible ? 'translate-x-4' : ''}`} /></span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{field.isMandatory ? 'Required' : field.fieldType}</p>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Additional Fields</p>
                  <span className="text-xs text-slate-400">{config.customFields.length} fields</span>
                </div>
                {config.customFields.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center"><p className="text-sm font-medium text-slate-800">No additional fields yet</p></div>
                ) : (
                  <div className="space-y-3">
                    {config.customFields.map((field, index) => (
                      <div key={field.fieldName} className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
                        <Input value={field.label} onChange={e => updateCustomLabel(index, e.target.value)} className="sm:flex-1" />
                        <Badge variant="outline">{field.fieldType}</Badge>
                        <button onClick={() => toggleCustom(index)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${field.visible ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{field.visible ? 'Visible' : 'Hidden'}</button>
                        <button onClick={() => deleteCustom(index)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600">Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default function RecruiterCandidates() {
  const { currentUser, userRole, authHeaders } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [matchingJobsCandidate, setMatchingJobsCandidate] = useState(null);
  const [matchingJobs, setMatchingJobs] = useState([]);
  const [loadingMatchingJobs, setLoadingMatchingJobs] = useState(false);
  const [matchingJobsError, setMatchingJobsError] = useState(null);
  const [viewingJobDetails, setViewingJobDetails] = useState(null);
  const [expandedJobId, setExpandedJobId] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchKeywords, setSearchKeywords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [isJobInviteOpen, setIsJobInviteOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'candidateId', direction: 'desc' });

  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeywords, statusFilter, activeStatFilter]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [clientPopoverCandidate, setClientPopoverCandidate] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [errors, setErrors] = useState({});
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);

  const handleTopScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  const standardSources = ['Portal', 'LinkedIn', 'Referral', 'Direct', 'Agency', 'Naukri', 'Indeed'];

  const allStatuses = [
    'Shared Profiles', 'Yet to attend', 'Turnups', 'No Show', 'Selected',
    'Joined', 'Rejected', 'Pipeline', 'Hold', 'Backout'
  ];

  const [isCustomSource, setIsCustomSource] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const initialFormState = {
    firstName: '', lastName: '', email: '', contact: '', dateOfBirth: '', gender: '', linkedin: '',
    currentLocation: '', preferredLocation: '',
    position: '', client: '', industry: '', currentCompany: '', skills: [],
    totalExperience: '', relevantExperience: '',
    education: '',
    ctc: '', ectc: '',
    currentTakeHome: '',
    expectedTakeHome: '',
    noticePeriod: '',
    servingNoticePeriod: 'false',
    noticePeriodDays: '',
    lwd: '',
    reasonForChange: '',
    offersInHand: 'false',
    offerPackage: '',
    source: 'Portal',
    status: ['Submitted'],
    rating: '0', assignedJobId: '',
    dateAdded: todayStr,
    notes: '', remarks: '',
    customFields: {},
    active: true,
    submissions: [],
  };

  const [formData, setFormData] = useState(initialFormState);
  const [candidateFieldConfig, setCandidateFieldConfig] = useState(getCandidateFieldConfig);
  const [candidateFormControlOpen, setCandidateFormControlOpen] = useState(false);

  const handleCandidateConfigChange = (updated) => {
    const normalized = normalizeCandidateFieldConfig(updated);
    setCandidateFieldConfig(normalized);
    saveCandidateFieldConfig(normalized);
  };

  const isCandidateFieldVisible = (fieldName) => {
    const field = candidateFieldConfig.fields.find(item => item.fieldName === fieldName);
    return field ? field.visible !== false : true;
  };

  const visibleCustomCandidateFields = useMemo(
    () => candidateFieldConfig.customFields.filter(field => field.visible),
    [candidateFieldConfig]
  );

  const handleCustomCandidateFieldChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, [fieldName]: value } }));
  };

  const checkEmailDuplicate = async (email) => {
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) return;
    setIsCheckingEmail(true);
    try {
      const authH = await authHeaders();
      const excludeParam = selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(email.trim())}${excludeParam}`, {
        headers: { ...authH },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exists) {
        setErrors(prev => ({
          ...prev,
          email: `A candidate with this email already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})`,
        }));
      }
    } catch (_) { } finally { setIsCheckingEmail(false); }
  };

  const checkPhoneDuplicate = async (phone) => {
    const digits = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    if (!digits || digits.length !== 10) return;
    setIsCheckingPhone(true);
    try {
      const authH = await authHeaders();
      const excludeParam = selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, {
        headers: { ...authH },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exists) {
        setErrors(prev => ({
          ...prev,
          contact: `A candidate with this phone already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})`,
        }));
      }
    } catch (_) { } finally { setIsCheckingPhone(false); }
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' });
      return;
    }

    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
      toast({ title: 'Error', description: 'Invalid file type. Only PDF, DOC, and DOCX are supported.', variant: 'destructive' });
      return;
    }

    setIsParsingResume(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('resume', file);

      const authH = await authHeaders();
      const response = await fetch(`${API_URL}/candidates/parse-resume`, {
        method: 'POST',
        headers: { ...authH },
        body: uploadFormData
      });

      const result = await response.json();

      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to parse resume');

      if (result.success && result.data) {
        const cleanContact = result.data.contact ? result.data.contact.replace(/\D/g, '').slice(0, 10) : '';
        const cleanTotalExp = result.data.totalExperience ? String(result.data.totalExperience).replace(/[^0-9.]/g, '') : '';
        const parsedName = result.data.name || '';
        const nameParts = parsedName.trim().split(/\s+/);
        const parsedFirst = nameParts[0] || '';
        const parsedLast = nameParts.slice(1).join(' ') || '';
        setFormData(prev => ({
          ...prev,
          firstName: prev.firstName || parsedFirst, lastName: prev.lastName || parsedLast,
          email: prev.email || result.data.email || '', contact: prev.contact || cleanContact || '',
          linkedin: prev.linkedin || result.data.linkedin || '', gender: prev.gender || result.data.gender || 'Not Specified',
          skills: normalizeSkills(prev.skills).length ? prev.skills : normalizeSkills(result.data.skills),
          totalExperience: prev.totalExperience || cleanTotalExp || '',
          education: prev.education || result.data.education || '', currentLocation: prev.currentLocation || result.data.currentLocation || '',
          currentCompany: prev.currentCompany || result.data.currentCompany || '',
        }));
        toast({ title: 'Success', description: 'Resume parsed successfully. Fields auto-filled.' });
      }
    } catch (error) {
      toast({ title: 'Warning', description: 'Could not parse some details. Please fill manually.', variant: 'default' });
    } finally {
      setIsParsingResume(false); event.target.value = '';
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const authH = await authHeaders();
      const headers = { ...authH };

      const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
      const params = new URLSearchParams({ includeSubmissions: 'true' });
      if (!isAdminOrManager && currentUser?._id) params.set('recruiterId', currentUser._id);
      const candidateUrl = `${API_URL}/candidates?${params.toString()}`;

      const [candRes, jobRes, clientRes] = await Promise.all([
        fetch(candidateUrl, { headers }),
        fetch(`${API_URL}/jobs?view=lookup`, { headers }),
        fetch(`${API_URL}/clients?view=lookup`, { headers })
      ]);

      if (candRes.ok) {
        const allCandidates = await candRes.json();
        const fixedCandidates = allCandidates.map((c) => ({
          ...c, status: Array.isArray(c.status) ? c.status : [c.status || 'Submitted']
        }));
        setCandidates(fixedCandidates);
      }
      if (jobRes.ok) setJobs(await jobRes.json());
      if (clientRes.ok) setClients(await clientRes.json());
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load data" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchMatchingJobs = async (candidate) => {
    setLoadingMatchingJobs(true);
    setMatchingJobsError(null);
    setMatchingJobs([]);
    try {
      const authH = await authHeaders();
      const res = await fetch(`${API_URL}/candidates/${candidate._id}/matching-jobs`, {
        headers: { ...authH },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch matching jobs');
      }
      setMatchingJobs(data.jobs || []);
    } catch (err) {
      console.error(err);
      setMatchingJobsError('Detailed analysis is temporarily unavailable. Showing rule-based scores.');
    } finally {
      setLoadingMatchingJobs(false);
    }
  };

  useEffect(() => {
    if (matchingJobsCandidate) {
      fetchMatchingJobs(matchingJobsCandidate);
    }
  }, [matchingJobsCandidate]);

  const openMatchingJobsModal = (candidate) => {
    setMatchingJobsCandidate(candidate);
  };

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) { setActiveStatFilter(status); setStatusFilter('all'); }
  }, [searchParams]);

  const handleInputChange = (key, value) => {
    let newValue = value;

    if (key === 'contact') newValue = value.replace(/\D/g, '').slice(0, 10);
    else if (key === 'firstName' || key === 'lastName') newValue = value.replace(/[^a-zA-Z\s'\-]/g, '');
    else if (key === 'totalExperience' || key === 'relevantExperience') {
      newValue = value.replace(/[^0-9.]/g, '');
      const parts = newValue.split('.');
      if (parts.length > 2) newValue = parts[0] + '.' + parts.slice(1).join('');
    }

    setFormData(prev => ({ ...prev, [key]: newValue }));

    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const addStatus = (newStatus) => {
    if (newStatus === 'SELECT_ALL') setFormData(prev => ({ ...prev, status: [...allStatuses] }));
    else if (!formData.status.includes(newStatus)) setFormData(prev => ({ ...prev, status: [...prev.status, newStatus] }));
    if (errors.status) setErrors(prev => { const n = { ...prev }; delete n.status; return n; });
  };

  const removeStatus = (statusToRemove) => {
    setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== statusToRemove) }));
  };

  const validateForm = () => {
    const newErrors = {};
    const trimStr = (val) => (typeof val === 'string' ? val.trim() : val);
    const data = formData;

    const firstName = trimStr(data.firstName);
    if (!firstName) newErrors.firstName = "First Name is required";
    else if (!/^[a-zA-Z\s'\-]{2,50}$/.test(firstName)) newErrors.firstName = "Must be 2–50 letters only";

    const lastName = trimStr(data.lastName);
    if (!lastName) newErrors.lastName = "Last Name is required";
    else if (!/^[a-zA-Z\s'\-]{1,50}$/.test(lastName)) newErrors.lastName = "Must be letters only";

    if (data.dateOfBirth) {
      const todayDateStr = new Date().toLocaleDateString('en-CA');
      if (data.dateOfBirth >= todayDateStr) newErrors.dateOfBirth = 'Date of Birth must be in the past (not today or future)';
      else {
        const dob = new Date(data.dateOfBirth);
        const ageYears = (new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears < 18) newErrors.dateOfBirth = 'Candidate must be at least 18 years old';
        else if (ageYears > 80) newErrors.dateOfBirth = 'Please enter a valid Date of Birth';
      }
    }

    const email = trimStr(data.email);
    if (!email) newErrors.email = "Email is required";
    else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) newErrors.email = "Enter a valid email ending with .com, .in, etc.";
    else if (errors.email && errors.email.includes('already exists')) newErrors.email = errors.email;

    const contact = trimStr(data.contact);
    if (!contact) newErrors.contact = "Phone is required";
    else if (contact.length !== 10) newErrors.contact = "Must be exactly 10 digits";
    else if (errors.contact && errors.contact.includes('already exists')) newErrors.contact = errors.contact;

    if (data.linkedin && !/^(https?:\/\/)?([\w\d\-]+\.)+\w{2,}(\/.*)?$/i.test(trimStr(data.linkedin))) newErrors.linkedin = "Invalid LinkedIn URL format";
    if (data.currentLocation && trimStr(data.currentLocation).length > 100) newErrors.currentLocation = "Max 100 characters";
    if (data.preferredLocation && trimStr(data.preferredLocation).length > 100) newErrors.preferredLocation = "Max 100 characters";

    const pos = trimStr(data.position);
    if (!pos) newErrors.position = "Position is required";
    else if (pos.length > 100) newErrors.position = "Max 100 characters allowed";

    if (data.currentCompany && trimStr(data.currentCompany).length > 100) newErrors.currentCompany = "Max 100 characters";
    if (data.industry && trimStr(data.industry).length > 100) newErrors.industry = "Max 100 characters";

    const skills = normalizeSkills(data.skills);
    if (skills.length === 0) newErrors.skills = "At least one skill is required";
    else if (skills.join(', ').length > 500) newErrors.skills = "Max 500 characters allowed";

    if (data.education && trimStr(data.education).length > 200) newErrors.education = "Max 200 characters";

    const totExp = trimStr(data.totalExperience);
    if (totExp && isNaN(Number(totExp))) newErrors.totalExperience = "Must be a valid number";

    const relExp = trimStr(data.relevantExperience);
    if (relExp && isNaN(Number(relExp))) newErrors.relevantExperience = "Must be a valid number";

    if (data.ctc && trimStr(data.ctc).length > 50) newErrors.ctc = "Max 50 characters";
    if (data.ectc && trimStr(data.ectc).length > 50) newErrors.ectc = "Max 50 characters";
    if (data.currentTakeHome && trimStr(data.currentTakeHome).length > 50) newErrors.currentTakeHome = "Max 50 characters";
    if (data.expectedTakeHome && trimStr(data.expectedTakeHome).length > 50) newErrors.expectedTakeHome = "Max 50 characters";
    if (data.noticePeriod && trimStr(data.noticePeriod).length > 50) newErrors.noticePeriod = "Max 50 characters";

    if (data.servingNoticePeriod === 'true') {
      if (!data.lwd) newErrors.lwd = "LWD is required if currently serving notice";
    }

    if (data.reasonForChange && trimStr(data.reasonForChange).length > 500) newErrors.reasonForChange = "Max 500 characters allowed";

    if (data.offersInHand === 'true') {
      if (!trimStr(data.offerPackage)) newErrors.offerPackage = "Package amount is required";
      else if (trimStr(data.offerPackage).length > 50) newErrors.offerPackage = "Max 50 characters";
    }

    if (isCustomSource && !trimStr(data.source)) newErrors.source = "Source is required";
    if (!data.status || data.status.length === 0) newErrors.status = "At least one status is required";
    if (!data.dateAdded) newErrors.dateAdded = "Date Added is required";
    else {
      const todayDateStr = new Date().toLocaleDateString('en-CA');
      if (data.dateAdded > todayDateStr) newErrors.dateAdded = "Date Added cannot be a future date — only today or earlier";
    }
    if (data.remarks && trimStr(data.remarks).length > 1000) newErrors.remarks = "Max 1000 characters allowed";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const stats = useMemo(() => {
    const countStatus = (s) => candidates.filter(c => getCandidateStatuses(c).includes(s)).length;
    const todayStr2 = new Date().toLocaleDateString('en-CA');
    const todayCount = candidates.filter(c => {
      const d = c.dateAdded || c.createdAt;
      return d ? new Date(d).toLocaleDateString('en-CA') === todayStr2 : false;
    }).length;

    return {
      total: candidates.length, turnups: countStatus('Turnups'), noShow: countStatus('No Show'), yetToAttend: countStatus('Yet to attend'),
      selected: countStatus('Selected'), rejected: countStatus('Rejected'), hold: countStatus('Hold'), joined: countStatus('Joined'),
      pipeline: countStatus('Pipeline'), backout: countStatus('Backout'), sharedProfiles: countStatus('Shared Profiles'), todaySubmissions: todayCount,
    };
  }, [candidates]);

  const getCandidateId = (c) => c.candidateId || c._id.substring(c._id.length - 6).toUpperCase();

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ field }) => {
    if (!sortConfig || sortConfig.key !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline-block" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 text-blue-500 inline-block" />
      : <ArrowDown className="h-3 w-3 ml-1 text-blue-500 inline-block" />;
  };

  const getFilteredCandidates = useMemo(() => {
    const todayLocal = new Date().toLocaleDateString('en-CA');
    const filtered = candidates.filter(c => {
      const searchMatch = candidateMatchesKeywordBadges(c, searchKeywords);
      const currentStatusArr = getCandidateStatuses(c);

      let statCardMatch = true;
      if (activeStatFilter === 'Today') {
        const d = c.dateAdded || c.createdAt;
        statCardMatch = d ? new Date(d).toLocaleDateString('en-CA') === todayLocal : false;
      } else if (activeStatFilter) {
        statCardMatch = currentStatusArr.includes(activeStatFilter);
      }

      const statusDropdownMatch = statusFilter === 'all' || currentStatusArr.includes(statusFilter);
      return searchMatch && statusDropdownMatch && statCardMatch;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        let av = '';
        let bv = '';
        if (sortConfig.key === 'candidateId') {
          av = getCandidateId(a);
          bv = getCandidateId(b);
        } else if (sortConfig.key === 'name') {
          av = a.name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || '';
          bv = b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || '';
        } else {
          av = a[sortConfig.key] || '';
          bv = b[sortConfig.key] || '';
        }

        if (typeof av === 'string' && typeof bv === 'string') {
          return sortConfig.direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [candidates, searchKeywords, statusFilter, activeStatFilter, sortConfig]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(getFilteredCandidates.length / ITEMS_PER_PAGE);
  const paginatedCandidates = getFilteredCandidates.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const visibleCandidateIds = paginatedCandidates.map((candidate) => candidate._id);
  const allVisibleCandidatesSelected = visibleCandidateIds.length > 0
    && visibleCandidateIds.every((candidateId) => selectedCandidates.includes(candidateId));
  const selectedCandidateRecords = useMemo(() => {
    const candidatesById = new Map(candidates.map((candidate) => [String(candidate._id), candidate]));
    return selectedCandidates.map((candidateId) => candidatesById.get(String(candidateId))).filter(Boolean);
  }, [candidates, selectedCandidates]);
  const selectedInvalidEmailCount = selectedCandidateRecords.filter((candidate) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(candidate.email || '').trim())).length;

  const candidateExportColumns = useMemo(() => [
    { key: 'candidateId', label: 'Candidate ID', value: c => c.candidateId || c._id?.slice(-6).toUpperCase() || '' },
    { key: 'name', label: 'Name', value: c => c.name || '' },
    { key: 'email', label: 'Email', value: c => c.email || '' },
    { key: 'phone', label: 'Phone', value: c => c.contact || '' },
    { key: 'client', label: 'Client', value: c => getCandidateSubmissions(c)[0]?.clientName || c.client || '' },
    { key: 'position', label: 'Position', value: c => c.position || '' },
    { key: 'status', label: 'Status', value: c => getCandidateStatuses(c).join(' | ') },
    { key: 'totalExperience', label: 'Total Exp', value: c => c.totalExperience || '' },
    { key: 'ctc', label: 'Current CTC', value: c => c.ctc || '' },
    { key: 'ectc', label: 'Expected CTC', value: c => c.ectc || '' },
    { key: 'noticePeriod', label: 'Notice Period', value: c => c.noticePeriod || '' },
    { key: 'currentCompany', label: 'Current Company', value: c => c.currentCompany || '' },
    { key: 'currentLocation', label: 'Location', value: c => c.currentLocation || '' },
    { key: 'education', label: 'Qualification', value: c => c.education || '' },
    { key: 'skills', label: 'Skills', value: c => Array.isArray(c.skills) ? c.skills.join(', ') : (c.skills || '') },
    { key: 'dateAdded', label: 'Date Added', value: c => (c.dateAdded || c.createdAt) ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB') : '' },
  ], []);

  const handleExport = () => {
    if (getFilteredCandidates.length === 0) { toast({ title: "No data to export", variant: "destructive" }); return; }
    setIsExportDialogOpen(true);
  };

  const formatSkills = (skills) => !skills ? 'N/A' : Array.isArray(skills) ? skills.slice(0, 3).join(', ') + (skills.length > 3 ? '...' : '') : skills.length > 50 ? skills.substring(0, 50) + '...' : skills;
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

  const toggleSelectCandidate = (id) => setSelectedCandidates(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
  const selectAllCandidates = () => {
    setSelectedCandidates((prev) => {
      const visibleSet = new Set(visibleCandidateIds);
      if (visibleCandidateIds.length === 0) return prev;
      if (visibleCandidateIds.every((id) => prev.includes(id))) {
        return prev.filter((id) => !visibleSet.has(id));
      }
      return [...new Set([...prev, ...visibleCandidateIds])];
    });
  };
  const openViewDialog = (c) => { setViewingCandidate(c); setIsViewDialogOpen(true); };

  const openEditDialog = (c) => {
    setErrors({}); setSelectedCandidateId(c._id);
    const isStandard = standardSources.includes(c.source || 'Portal');
    setIsCustomSource(!isStandard);
    setFormData({
      firstName: c.firstName || '', lastName: c.lastName || '', email: c.email || '', contact: c.contact || '',
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
      gender: c.gender || '', linkedin: c.linkedin || '',
      currentLocation: c.currentLocation || '', preferredLocation: c.preferredLocation || '',
      position: c.position || '', client: c.client || '', industry: c.industry || '',
      currentCompany: c.currentCompany || '', skills: normalizeSkills(c.skills),
      totalExperience: c.totalExperience ? String(c.totalExperience) : '', relevantExperience: c.relevantExperience ? String(c.relevantExperience) : '',
      education: c.education || '', ctc: c.ctc ? String(c.ctc) : '', ectc: c.ectc ? String(c.ectc) : '',
      currentTakeHome: c.currentTakeHome || '', expectedTakeHome: c.expectedTakeHome || '',
      noticePeriod: c.noticePeriod ? String(c.noticePeriod) : '', servingNoticePeriod: c.servingNoticePeriod ? 'true' : 'false',
      lwd: c.lwd ? new Date(c.lwd).toISOString().split('T')[0] : '', reasonForChange: c.reasonForChange || '',
      offersInHand: c.offersInHand ? 'true' : 'false', offerPackage: c.offerPackage || '',
      source: c.source || 'Portal', status: Array.isArray(c.status) ? c.status : [c.status || 'Submitted'],
      rating: c.rating?.toString() || '0', assignedJobId: typeof c.assignedJobId === 'object' ? c.assignedJobId._id : c.assignedJobId || '',
      dateAdded: c.dateAdded ? new Date(c.dateAdded).toISOString().split('T')[0] : '',
      notes: c.notes || '', remarks: c.remarks || '',
      customFields: c.customFields || {},
      active: c.active !== false,
      submissions: [],
    });
    setIsEditDialogOpen(true);

    setIsLoadingSubmissions(true);
    authHeaders().then((headers) =>
      fetch(`${API_URL}/submissions?candidateId=${c._id}`, { headers })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          const rows = Array.isArray(data) ? data.map((sub) => ({
            _id: sub._id,
            clientName: sub.clientName || '',
            jobId: typeof sub.jobId === 'object' ? sub.jobId._id : sub.jobId || '',
            jobCode: sub.jobCode || (sub.jobId?.jobCode) || '',
            position: sub.position || (sub.jobId?.position) || '',
            pipelineStage: sub.pipelineStage || sub.status || 'Pipeline',
            _originalStage: sub.pipelineStage || sub.status || 'Pipeline',
            isExisting: true,
          })) : [];
          setFormData((prev) => ({ ...prev, submissions: rows }));
        })
        .catch(() => { })
        .finally(() => setIsLoadingSubmissions(false))
    ).catch(() => setIsLoadingSubmissions(false));
  };

  const handleSave = async (isEdit) => {
    if (formData.email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      try {
        const dupH = await authHeaders();
        const excludeParam = isEdit && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
        const dupRes = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(formData.email.trim())}${excludeParam}`, { headers: { ...dupH } });
        if (dupRes.ok) {
          const dupData = await dupRes.json();
          if (dupData.exists) {
            setErrors(prev => ({ ...prev, email: `A candidate with this email already exists` }));
            toast({ title: "Duplicate Email", description: "Email already registered", variant: "destructive" });
            return;
          }
        }
      } catch (_) { }
    }

    if (formData.contact) {
      const digits = formData.contact.replace(/\D/g, '').slice(-10);
      if (digits.length === 10) {
        try {
          const phH = await authHeaders();
          const excludeParam = isEdit && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
          const phRes = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers: { ...phH } });
          if (phRes.ok) {
            const phData = await phRes.json();
            if (phData.exists) {
              setErrors(prev => ({ ...prev, contact: `A candidate with this phone already exists` }));
              toast({ title: "Duplicate Phone", description: "Phone already registered", variant: "destructive" });
              return;
            }
          }
        } catch (_) { }
      }
    }

    if (!validateForm()) { toast({ title: "Validation Error", description: "Please fix the highlighted errors", variant: "destructive" }); return; }

    if (!isEdit && Array.isArray(formData.submissions) && formData.submissions.length > 0) {
      const seenJobIds = new Set();
      let hasDupRow = false;
      for (const sub of formData.submissions) {
        if (sub.jobId && seenJobIds.has(sub.jobId)) { hasDupRow = true; break; }
        if (sub.jobId) seenJobIds.add(sub.jobId);
      }
      if (hasDupRow) {
        toast({ title: "Duplicate Submission", description: "You have the same job added twice in submissions. Please remove the duplicate.", variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const authH = await authHeaders();
      const headers = { ...authH, 'Content-Type': 'application/json' };

      const builtName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();

      const allRows = Array.isArray(formData.submissions) ? formData.submissions : [];
      const existingRows = allRows.filter((r) => r.isExisting && r._id);
      const incompleteRow = allRows.some((r) => !r.isExisting && (r.clientName || r.jobId) && !(r.clientName && r.jobId));
      if (incompleteRow) {
        toast({ title: 'Incomplete Submission', description: 'Select both client and job, or remove the incomplete submission row.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      const newRows = allRows.filter((r) => !r.isExisting && r.clientName && r.jobId);

      if (newRows.length > 0) {
        const seenJobIds = new Set();
        existingRows.forEach((r) => seenJobIds.add(r.jobId));
        for (const sub of newRows) {
          if (seenJobIds.has(sub.jobId)) {
            toast({ title: 'Duplicate Submission', description: `Job ${sub.jobCode || sub.jobId} is already submitted. Remove the duplicate row.`, variant: 'destructive' });
            setIsSubmitting(false);
            return;
          }
          seenJobIds.add(sub.jobId);
        }
      }

      const payload = {
        ...formData,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        name: builtName,
        email: formData.email.trim(),
        contact: formData.contact.trim(),
        linkedin: formData.linkedin.trim(),
        currentLocation: formData.currentLocation.trim(),
        preferredLocation: formData.preferredLocation.trim(),
        position: formData.position.trim(),
        industry: formData.industry.trim(),
        currentCompany: formData.currentCompany.trim(),
        education: formData.education.trim(),
        ctc: formData.ctc.trim(),
        ectc: formData.ectc.trim(),
        currentTakeHome: formData.currentTakeHome.trim(),
        expectedTakeHome: formData.expectedTakeHome.trim(),
        noticePeriod: formData.noticePeriod.trim(),
        reasonForChange: formData.reasonForChange.trim(),
        offerPackage: formData.offerPackage.trim(),
        source: formData.source.trim(),
        remarks: formData.remarks.trim(),
        assignedJobId: typeof formData.assignedJobId === 'object' ? formData.assignedJobId._id : formData.assignedJobId,
        skills: normalizeSkills(formData.skills),
        rating: parseInt(formData.rating) || 0,
        servingNoticePeriod: formData.servingNoticePeriod === 'true',
        offersInHand: formData.offersInHand === 'true',
        status: formData.status,
        customFields: formData.customFields || {},
      };
      delete payload.submissions;

      const url = isEdit ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
      const method = isEdit ? 'PUT' : 'POST';

      if (!isEdit) {
        const cleanNewRows = allRows.filter((s) => s.clientName && s.jobId).map((s) => ({
          clientName: s.clientName,
          jobId: s.jobId,
          jobCode: s.jobCode,
          position: s.position,
          pipelineStage: s.pipelineStage || 'Pipeline',
          status: s.pipelineStage || 'Pipeline',
        }));
        if (cleanNewRows.length > 0) payload.submissions = cleanNewRows;
      }

      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Operation failed');

      if (isEdit) {
        const submissionPromises = [];

        for (const row of existingRows) {
          if (row._originalStage && row.pipelineStage !== row._originalStage) {
            submissionPromises.push(
              fetch(`${API_URL}/submissions/${row._id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ pipelineStage: row.pipelineStage, status: row.pipelineStage }),
              }).catch((e) => console.error('Stage update failed:', e))
            );
          }
        }

        for (const row of newRows) {
          submissionPromises.push(
            fetch(`${API_URL}/submissions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                candidateId: selectedCandidateId,
                clientName: row.clientName,
                jobId: row.jobId,
                pipelineStage: row.pipelineStage || 'Pipeline',
                status: row.pipelineStage || 'Pipeline',
              }),
            })
              .then(async (r) => {
                const body = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(body.message || 'Submission failed');
                return body;
              })
              .catch((e) => {
                console.error('New submission failed:', e);
                throw e;
              })
          );
        }

        const results = await Promise.allSettled(submissionPromises);
        const failedCount = results.filter((r) => r.status === 'rejected').length;
        const failedMessage = results.find((r) => r.status === 'rejected')?.reason?.message;

        let desc = 'Candidate updated successfully.';
        if (existingRows.filter((r) => r._originalStage !== r.pipelineStage).length > 0)
          desc += ` Pipeline stages updated.`;
        if (newRows.length > 0) desc += ` ${newRows.length} new submission(s) added.`;
        if (failedCount > 0) desc += ` ${failedCount} submission update(s) failed.${failedMessage ? ` ${failedMessage}` : ''}`;

        toast({ title: failedCount > 0 ? 'Partial Save' : 'Success', description: desc, variant: failedCount > 0 ? 'destructive' : 'default' });
      } else {
        const subCount = Array.isArray(data.submissions) ? data.submissions.length : 0;
        const subErrCount = Array.isArray(data.submissionErrors) ? data.submissionErrors.length : 0;
        let desc = 'Candidate added successfully.';
        if (subCount > 0) desc += ` ${subCount} submission(s) saved.`;
        if (subErrCount > 0) desc += ` ${subErrCount} submission(s) failed.`;
        toast({ title: 'Success', description: desc });
      }

      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      await fetchData();
      setFormData(initialFormState);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Operation failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActiveStatus = async (id, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'}?`)) return;
    try {
      const authH = await authHeaders();
      const headers = { ...authH, 'Content-Type': 'application/json' };
      await fetch(`${API_URL}/candidates/${id}`, { method: 'PUT', headers, body: JSON.stringify({ active: !currentStatus }) });
      toast({ title: "Status Updated" }); fetchData();
    } catch (error) { toast({ variant: "destructive", title: "Error" }); }
  };

  const handleBulkDelete = async () => {
    if (selectedCandidates.length === 0) return;
    setIsDeleting(true);
    try {
      const authH = await authHeaders();
      const headers = { ...authH };
      const deletePromises = selectedCandidates.map(id => fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers }));
      await Promise.all(deletePromises);
      toast({ title: "Deleted", description: `${selectedCandidates.length} candidate(s) deleted successfully` });
      setSelectedCandidates([]); fetchData(); setIsDeleteConfirmOpen(false);
    } catch (error) { toast({ variant: "destructive", title: "Error" }); }
    finally { setIsDeleting(false); }
  };

  const handleJobInviteResult = (result) => {
    if (!result || result.error) return;
    const hasIssues = (result.failed || 0) > 0 || (result.skipped || 0) > 0;
    toast({
      title: hasIssues ? 'Invitations partially sent' : 'Invitations sent',
      description: `${result.sent || 0} invitations sent, ${result.failed || 0} failed, ${result.skipped || 0} skipped.`,
      variant: hasIssues ? 'destructive' : 'default',
    });
  };

  const handleImportExcel = async () => {
    if (!importFile) { toast({ title: 'No file selected', variant: 'destructive' }); return; }
    setIsImporting(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append('file', importFile);
      const authH = await authHeaders();
      const response = await fetch(`${API_URL}/candidates/bulk-import`, { method: 'POST', headers: { ...authH }, body: fd });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Import failed');
      const successCount = result.imported ?? 0;
      setImportResult({ success: successCount, failed: Math.max(0, (result.total ?? 0) - successCount), errors: (result.errors || []).map((e) => typeof e === 'string' ? e : `Row ${e.row}: ${e.error}`) });
      if (successCount > 0) { toast({ title: 'Import Successful' }); fetchData(); }
      else toast({ title: 'Nothing Imported', variant: 'destructive' });
    } catch (error) { toast({ title: 'Import Failed', variant: 'destructive' }); }
    finally { setIsImporting(false); }
  };

  const handleDeleteSubmission = async (submissionId) => {
    const authH = await authHeaders();
    const res = await fetch(`${API_URL}/submissions/${submissionId}`, {
      method: 'DELETE',
      headers: { ...authH },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete submission');
    }
    toast({ title: 'Submission removed', description: 'The client/job submission was deleted.' });
  };

  const handleWhatsApp = (c) => {
    if (!c.contact) return;
    let phone = c.contact.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const firstName = (c.name || '').split(' ')[0];
    const message = `Hi ${firstName}, this is regarding your job application for the ${c.position} position at ${c.client || 'our client'}. Are you available?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  const renderCandidateForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="md:col-span-3 font-semibold border-b pb-1 text-slate-500 flex items-center gap-2"><UserCircle className="h-4 w-4" /> Personal Information</div>

      <div className="space-y-1">
        <Label className={errors.firstName ? "text-red-500" : ""}>First Name *</Label>
        <Input value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)} className={errors.firstName ? "border-red-500" : ""} placeholder="e.g. Rahul" />
        {errors.firstName && <span className="text-xs text-red-500">{errors.firstName}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.lastName ? "text-red-500" : ""}>Last Name *</Label>
        <Input value={formData.lastName} onChange={e => handleInputChange('lastName', e.target.value)} className={errors.lastName ? "border-red-500" : ""} placeholder="e.g. Sharma" />
        {errors.lastName && <span className="text-xs text-red-500">{errors.lastName}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.email ? "text-red-500" : ""}>Email *</Label>
        <Input value={formData.email} onChange={e => handleInputChange('email', e.target.value)} className={errors.email ? "border-red-500" : ""} placeholder="user@domain.com" />
        {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.contact ? "text-red-500" : ""}>Phone *</Label>
        <div className="relative">
          <Input value={formData.contact} onChange={e => handleInputChange('contact', e.target.value)} onBlur={e => checkPhoneDuplicate(e.target.value)} className={errors.contact ? "border-red-500" : ""} placeholder="10 Digits Only" />
          {isCheckingPhone && <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking...</span>}
        </div>
        {errors.contact && <span className="text-xs text-red-500">{errors.contact}</span>}
      </div>
      <div className={`space-y-1 ${isCandidateFieldVisible('dateOfBirth') ? '' : 'hidden'}`}>
        <Label className={errors.dateOfBirth ? "text-red-500" : ""}>Date of Birth</Label>
        <Input type="date" value={formData.dateOfBirth} onChange={e => handleInputChange('dateOfBirth', e.target.value)} max={new Date(Date.now() - 86400000).toISOString().split('T')[0]} className={errors.dateOfBirth ? "border-red-500" : ""} />
        {errors.dateOfBirth && <span className="text-xs text-red-500">{errors.dateOfBirth}</span>}
      </div>
      <div className={`space-y-1 ${isCandidateFieldVisible('gender') ? '' : 'hidden'}`}>
        <Label className={errors.gender ? "text-red-500" : ""}>Gender</Label>
        <NativeSelect value={formData.gender} onChange={val => handleInputChange('gender', val)} className={errors.gender ? "border-red-500" : ""}>
          <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option><option value="Not Specified">Not Specified</option>
        </NativeSelect>
        {errors.gender && <span className="text-xs text-red-500">{errors.gender}</span>}
      </div>

      <div className="md:col-span-3 font-semibold border-b pb-1 text-slate-500 mt-4 flex items-center gap-2"><Briefcase className="h-4 w-4" /> Professional Information</div>

      <div className="space-y-1">
        <Label className={errors.position ? "text-red-500" : ""}>Current Role *</Label>
        <Input value={formData.position} onChange={e => handleInputChange('position', e.target.value)} className={errors.position ? "border-red-500" : ""} placeholder="e.g. Frontend Developer" />
        {errors.position && <span className="text-xs text-red-500">{errors.position}</span>}
      </div>
      <div className={`space-y-1 ${isCandidateFieldVisible('currentCompany') ? '' : 'hidden'}`}>
        <Label className={errors.currentCompany ? "text-red-500" : ""}>Current Company</Label>
        <Input value={formData.currentCompany} onChange={e => handleInputChange('currentCompany', e.target.value)} className={errors.currentCompany ? "border-red-500" : ""} />
        {errors.currentCompany && <span className="text-xs text-red-500">{errors.currentCompany}</span>}
      </div>
      <div className={`space-y-1 ${isCandidateFieldVisible('industry') ? '' : 'hidden'}`}>
        <Label className={errors.industry ? "text-red-500" : ""}>Industry</Label>
        <Input value={formData.industry} onChange={e => handleInputChange('industry', e.target.value)} className={errors.industry ? "border-red-500" : ""} />
        {errors.industry && <span className="text-xs text-red-500">{errors.industry}</span>}
      </div>
      <div className="md:col-span-2 space-y-1">
        <Label className={errors.skills ? "text-red-500" : ""}>Skills *</Label>
        <SkillsBadgeInput value={formData.skills} onChange={skills => handleInputChange('skills', skills)} error={errors.skills} />
        {errors.skills && <span className="text-xs text-red-500">{errors.skills}</span>}
      </div>

      <div className="md:col-span-3 rounded-xl border border-blue-200 bg-blue-50/50 p-5 mt-2">
        <ClientJobSubmissions
          submissions={formData.submissions || []}
          clients={clients}
          jobs={jobs}
          onChange={(rows) => handleInputChange('submissions', rows)}
          errors={errors}
          isEditMode={isEditDialogOpen}
          onDeleteExisting={handleDeleteSubmission}
        />
        {isLoadingSubmissions &&
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading existing submissions...
          </div>
        }
      </div>

      <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Education</div>
      <div className={`md:col-span-3 space-y-1 ${isCandidateFieldVisible('education') ? '' : 'hidden'}`}>
        <Label className={errors.education ? "text-red-500" : ""}>Qualification</Label>
        <Input value={formData.education} onChange={e => handleInputChange('education', e.target.value)} className={errors.education ? "border-red-500" : ""} placeholder="e.g. B.Tech from IIT Delhi" />
        {errors.education && <span className="text-xs text-red-500">{errors.education}</span>}
      </div>

      <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Experience & Availability</div>

      <div className={`space-y-1 ${isCandidateFieldVisible('totalExperience') ? '' : 'hidden'}`}>
        <Label className={errors.totalExperience ? "text-red-500" : ""}>Total Exp (Yrs)</Label>
        <Input value={formData.totalExperience} onChange={e => handleInputChange('totalExperience', e.target.value)} className={errors.totalExperience ? "border-red-500" : ""} placeholder="Numbers only (e.g. 3.5)" />
        {errors.totalExperience && <span className="text-xs text-red-500">{errors.totalExperience}</span>}
      </div>
      <div className={`space-y-1 ${isCandidateFieldVisible('relevantExperience') ? '' : 'hidden'}`}>
        <Label className={errors.relevantExperience ? "text-red-500" : ""}>Relevant Exp (Yrs)</Label>
        <Input value={formData.relevantExperience} onChange={e => handleInputChange('relevantExperience', e.target.value)} className={errors.relevantExperience ? "border-red-500" : ""} placeholder="Numbers only (e.g. 2)" />
        {errors.relevantExperience && <span className="text-xs text-red-500">{errors.relevantExperience}</span>}
      </div>

      <div className={`space-y-1 ${isCandidateFieldVisible('ctc') ? '' : 'hidden'}`}>
        <Label className={errors.ctc ? "text-red-500" : ""}>Current CTC (LPA)</Label>
        <Input value={formData.ctc} onChange={e => handleInputChange('ctc', e.target.value)} className={errors.ctc ? "border-red-500" : ""} />
        {errors.ctc && <span className="text-xs text-red-500">{errors.ctc}</span>}
      </div>
      <div className={`space-y-1 ${isCandidateFieldVisible('ectc') ? '' : 'hidden'}`}>
        <Label className={errors.ectc ? "text-red-500" : ""}>Expected CTC (LPA)</Label>
        <Input value={formData.ectc} onChange={e => handleInputChange('ectc', e.target.value)} className={errors.ectc ? "border-red-500" : ""} />
        {errors.ectc && <span className="text-xs text-red-500">{errors.ectc}</span>}
      </div>

      <div className={`space-y-1 ${isCandidateFieldVisible('currentTakeHome') ? '' : 'hidden'}`}>
        <Label className={errors.currentTakeHome ? "text-red-500" : ""}>Current Take Home</Label>
        <Input value={formData.currentTakeHome} onChange={e => handleInputChange('currentTakeHome', e.target.value)} className={errors.currentTakeHome ? "border-red-500" : ""} />
        {errors.currentTakeHome && <span className="text-xs text-red-500">{errors.currentTakeHome}</span>}
      </div>
      <div className={`space-y-1 ${isCandidateFieldVisible('expectedTakeHome') ? '' : 'hidden'}`}>
        <Label className={errors.expectedTakeHome ? "text-red-500" : ""}>Expected Take Home</Label>
        <Input value={formData.expectedTakeHome} onChange={e => handleInputChange('expectedTakeHome', e.target.value)} className={errors.expectedTakeHome ? "border-red-500" : ""} />
        {errors.expectedTakeHome && <span className="text-xs text-red-500">{errors.expectedTakeHome}</span>}
      </div>

      <div className={`space-y-1 ${isCandidateFieldVisible('noticePeriod') ? '' : 'hidden'}`}>
        <Label className={errors.noticePeriod ? "text-red-500" : ""}>Notice Period</Label>
        <Input value={formData.noticePeriod} onChange={e => handleInputChange('noticePeriod', e.target.value)} className={errors.noticePeriod ? "border-red-500" : ""} placeholder="e.g. 30 Days" />
        {errors.noticePeriod && <span className="text-xs text-red-500">{errors.noticePeriod}</span>}
      </div>

      <div className={`space-y-1 ${isCandidateFieldVisible('servingNoticePeriod') ? '' : 'hidden'}`}>
        <Label className={errors.servingNoticePeriod ? "text-red-500" : ""}>Serving Notice?</Label>
        <NativeSelect value={formData.servingNoticePeriod} onChange={val => handleInputChange('servingNoticePeriod', val)} className={errors.servingNoticePeriod ? "border-red-500" : ""}>
          <option value="false">No</option><option value="true">Yes</option>
        </NativeSelect>
        {errors.servingNoticePeriod && <span className="text-xs text-red-500">{errors.servingNoticePeriod}</span>}
      </div>

      {isCandidateFieldVisible('servingNoticePeriod') && formData.servingNoticePeriod === 'true' &&
        <div className="space-y-1">
          <Label className={errors.lwd ? "text-red-500" : ""}>LWD (Last Working Day) *</Label>
          <Input type="date" value={formData.lwd} onChange={e => handleInputChange('lwd', e.target.value)} className={errors.lwd ? "border-red-500" : ""} />
          {errors.lwd && <span className="text-xs text-red-500">{errors.lwd}</span>}
        </div>
      }

      <div className={`space-y-1 md:col-span-2 ${isCandidateFieldVisible('reasonForChange') ? '' : 'hidden'}`}>
        <Label className={errors.reasonForChange ? "text-red-500" : ""}>Reason For Change</Label>
        <textarea value={formData.reasonForChange} onChange={e => handleInputChange('reasonForChange', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm h-10 ${errors.reasonForChange ? "border-red-500" : "border-slate-300"}`} />
        {errors.reasonForChange && <span className="text-xs text-red-500">{errors.reasonForChange}</span>}
      </div>

      <div className={`space-y-1 ${isCandidateFieldVisible('offersInHand') ? '' : 'hidden'}`}>
        <Label className={errors.offersInHand ? "text-red-500" : ""}>Offers in Hand?</Label>
        <NativeSelect value={formData.offersInHand} onChange={val => handleInputChange('offersInHand', val)} className={errors.offersInHand ? "border-red-500" : ""}>
          <option value="false">No</option><option value="true">Yes</option>
        </NativeSelect>
        {errors.offersInHand && <span className="text-xs text-red-500">{errors.offersInHand}</span>}
      </div>

      {isCandidateFieldVisible('offersInHand') && formData.offersInHand === 'true' &&
        <div className="space-y-1">
          <Label className={errors.offerPackage ? "text-red-500" : ""}>Package Amount *</Label>
          <Input value={formData.offerPackage} onChange={e => handleInputChange('offerPackage', e.target.value)} className={errors.offerPackage ? "border-red-500" : ""} placeholder="e.g. 15 LPA" />
          {errors.offerPackage && <span className="text-xs text-red-500">{errors.offerPackage}</span>}
        </div>
      }

      <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><Target className="h-4 w-4" /> Recruitment Details</div>

      <div className={`space-y-1 ${isCandidateFieldVisible('source') ? '' : 'hidden'}`}>
        <Label className={errors.source ? "text-red-500" : ""}>Source *</Label>
        <NativeSelect value={isCustomSource ? 'Other' : formData.source} onChange={v => { if (v === 'Other') { setIsCustomSource(true); handleInputChange('source', '') } else { setIsCustomSource(false); handleInputChange('source', v) } }} className={errors.source ? "border-red-500" : ""}>
          {standardSources.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="Other">Other</option>
        </NativeSelect>
        {isCustomSource && <Input className={`mt-1 ${errors.source ? "border-red-500" : ""}`} value={formData.source} onChange={e => handleInputChange('source', e.target.value)} placeholder="Enter Source" />}
        {errors.source && <span className="text-xs text-red-500">{errors.source}</span>}
      </div>

      <div className={`space-y-1 ${isCandidateFieldVisible('rating') ? '' : 'hidden'}`}>
        <Label className={errors.rating ? "text-red-500" : ""}>Rating</Label>
        <NativeSelect value={formData.rating} onChange={v => handleInputChange('rating', v)} className={errors.rating ? "border-red-500" : ""}>
          {[1, 2, 3, 4, 5].map(r => <option key={r} value={r.toString()}>{r} Stars</option>)}
        </NativeSelect>
        {errors.rating && <span className="text-xs text-red-500">{errors.rating}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.dateAdded ? "text-red-500" : ""}>Date Added *</Label>
        <Input type="date" value={formData.dateAdded} onChange={e => handleInputChange('dateAdded', e.target.value)} max={todayStr} className={errors.dateAdded ? "border-red-500" : ""} />
        <p className="text-xs text-slate-400 mt-0.5">Cannot be a future date. Defaults to today.</p>
        {errors.dateAdded && <span className="text-xs text-red-500">{errors.dateAdded}</span>}
      </div>
      <div className={`md:col-span-3 space-y-1 mt-2 ${isCandidateFieldVisible('remarks') ? '' : 'hidden'}`}>
        <Label className={errors.remarks ? "text-red-500" : ""}>Remarks</Label>
        <textarea value={formData.remarks} onChange={e => handleInputChange('remarks', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm min-h-[80px] ${errors.remarks ? "border-red-500" : "border-slate-300"}`} />
        {errors.remarks && <span className="text-xs text-red-500">{errors.remarks}</span>}
      </div>

      <div className="md:col-span-3 rounded-xl border border-slate-200 bg-white p-5 mt-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Additional Fields</p>
            <h3 className="text-base font-semibold text-slate-900 mt-1">Custom candidate inputs</h3>
          </div>
          {!isEditDialogOpen && (
            <Button variant="outline" onClick={() => setCandidateFormControlOpen(true)} className="gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Manage Fields
            </Button>
          )}
        </div>
        {visibleCustomCandidateFields.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleCustomCandidateFields.map(field => (
              <div key={field.fieldName} className={field.fieldType === 'textarea' ? 'md:col-span-2' : ''}>
                <Label>{field.label}</Label>
                <CandidateCustomFieldInput field={field} value={formData.customFields?.[field.fieldName]} onChange={handleCustomCandidateFieldChange} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-sm font-medium text-slate-800">No additional fields enabled</p>
            <p className="text-xs text-slate-500 mt-1">Use Form Control to add or show custom fields here.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderMatchingJobsModal = () => {
    if (!matchingJobsCandidate) return null;

    return (
      <ModalPortal>
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMatchingJobsCandidate(null)} />
          <div className="relative flex max-h-[90vh] w-[95vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between bg-slate-950 p-6 text-white">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Matching Jobs – {matchingJobsCandidate.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-white">{getCandidateId(matchingJobsCandidate)}</span>
                  <span>•</span>
                  <span>{matchingJobsCandidate.position || 'No Role Specified'}</span>
                  <span>•</span>
                  <span>Skills: {Array.isArray(matchingJobsCandidate.skills) ? matchingJobsCandidate.skills.join(', ') : (matchingJobsCandidate.skills || 'N/A')}</span>
                </div>
              </div>
              <button
                onClick={() => setMatchingJobsCandidate(null)}
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sleek-scrollbar">
              {loadingMatchingJobs ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-slate-600 animate-pulse">Calculating matching scores...</p>
                </div>
              ) : matchingJobsError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm mb-4">
                  ⚠️ {matchingJobsError}
                </div>
              ) : matchingJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Briefcase className="h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-600">No jobs matched the required skills and role.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {matchingJobs.map((item) => {
                    const { job, finalScore, matchPercentage, matchLevel, roleMatchLevel, matchedMandatorySkills, missingMandatorySkills, matchedPreferredSkills, missingPreferredSkills, experienceMatch, qualificationMatch, reason, breakdown, scoringSource, source } = item;
                    const jobId = job._id || job.id;
                    const scoreVal = finalScore ?? matchPercentage ?? 0;
                    const expanded = expandedJobId === jobId;
                    const resolvedSource = scoringSource || source || 'fallback';

                    return (
                      <div key={jobId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 font-mono text-xs text-blue-600 font-bold">
                                {job.jobCode}
                              </span>
                              <h3 className="font-bold text-slate-900 text-base">{job.position}</h3>
                              <span className="text-slate-300">•</span>
                              <span className="text-sm text-slate-500 font-medium">{job.clientName}</span>
                            </div>
                            <p className="mt-1.5 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                              <span>📍 {job.location || 'Location not set'}</span>
                              <span>•</span>
                              <span>Role Match: <strong className="capitalize text-slate-700">{roleMatchLevel || 'N/A'}</strong></span>
                              <span>•</span>
                              <span>Experience Req: <strong className="text-slate-700">{job.experience ? `${job.experience} Years` : 'Any'}</strong></span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3 justify-between sm:justify-end">
                            <div className="flex items-center gap-2">
                              <ScoreBadge score={scoreVal} />
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                {matchLevel || 'Match'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedJobId(expanded ? null : jobId)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
                                title={expanded ? "Hide Details" : "Show Details"}
                              >
                                <svg className={`h-5 w-5 transform transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingJobDetails(job)}
                                className="cursor-pointer"
                              >
                                Details
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const candidate = matchingJobsCandidate;
                                  setMatchingJobsCandidate(null);
                                  openEditDialog(candidate);
                                }}
                                className="cursor-pointer font-semibold"
                              >
                                Submit
                              </Button>
                            </div>
                          </div>
                        </div>

                        {expanded && (
                          <div className="mt-4 border-t border-slate-150 pt-4 space-y-4 animate-in fade-in duration-200">
                            {resolvedSource === 'fallback' && (
                              <div className="rounded-lg bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 border border-amber-250">
                                ⚠️ Advanced matching analysis was temporarily unavailable. Showing rule-based matching metrics.
                              </div>
                            )}

                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Match Overview</h4>
                                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                                  {reason || 'Qualified matching profile based on job requirements and skills.'}
                                </p>

                                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200">
                                  <div className="text-xs">
                                    <span className="text-slate-400 block uppercase font-bold tracking-wider text-[9px]">Role Match</span>
                                    <span className="font-semibold text-slate-800 text-sm capitalize">{roleMatchLevel || 'N/A'}</span>
                                  </div>
                                  <div className="text-xs">
                                    <span className="text-slate-400 block uppercase font-bold tracking-wider text-[9px]">Experience Req</span>
                                    <span className="font-semibold text-slate-800 text-sm">{experienceMatch || (job.experience ? `${job.experience} Years` : 'N/A')}</span>
                                  </div>
                                  <div className="text-xs mt-2">
                                    <span className="text-slate-400 block uppercase font-bold tracking-wider text-[9px]">Qualification</span>
                                    <span className="font-semibold text-slate-800 text-sm">{qualificationMatch || (job.qualification || 'N/A')}</span>
                                  </div>
                                  <div className="text-xs mt-2">
                                    <span className="text-slate-400 block uppercase font-bold tracking-wider text-[9px]">Scoring Model</span>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold border mt-0.5 ${
                                      resolvedSource === 'groq'
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-slate-100 border-slate-200 text-slate-600'
                                    }`}>
                                      {resolvedSource === 'groq' ? 'Advanced Match' : 'Rule-Based Score'}
                                    </span>
                                  </div>
                                </div>

                                {breakdown && (
                                  <div className="mt-4 pt-3 border-t border-slate-200">
                                    <MatchBreakdownBar breakdown={breakdown} />
                                  </div>
                                )}
                              </div>

                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Skill Alignments</h4>
                                <SkillChips
                                  matchedMandatory={matchedMandatorySkills || []}
                                  missingMandatory={missingMandatorySkills || []}
                                  matchedPreferred={matchedPreferredSkills || []}
                                  missingPreferred={missingPreferredSkills || []}
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
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-4">
              <Button variant="outline" onClick={() => setMatchingJobsCandidate(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </ModalPortal>
    );
  };

  return (
    <>
      <style>{`
        .sleek-scrollbar::-webkit-scrollbar { height: 10px; }
        .sleek-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 6px; }
        .sleek-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        .sleek-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      <main className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 overflow-y-auto overflow-x-hidden pb-48">
        <div className="w-full max-w-full mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">My Candidates</h1>
              <p className="text-slate-500">Manage pipeline</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              {selectedCandidates.length > 0 && (
                <>
                  <Button onClick={() => setIsJobInviteOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                    <Mail className="mr-2 h-4 w-4" /> Send Job Invite ({selectedCandidates.length})
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedCandidates([])}>
                    Clear Selection
                  </Button>
                  <Button variant="destructive" onClick={() => setIsDeleteConfirmOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedCandidates.length})
                  </Button>
                  {selectedInvalidEmailCount > 0 && (
                    <div className="flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      {selectedInvalidEmailCount} selected candidate(s) will be skipped because email is unavailable.
                    </div>
                  )}
                </>
              )}
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button variant="outline" className="border-green-500 text-green-700 hover:bg-green-50" onClick={() => setIsImportDialogOpen(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Bulk Candidates
              </Button>
              <Button onClick={() => { setFormData(initialFormState); setErrors({}); setIsAddDialogOpen(true); setIsCustomSource(false); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Candidate
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Overall Submissions" value={stats.total} color="blue" active={activeStatFilter === null} onClick={() => { setActiveStatFilter(null); setStatusFilter('all'); }} />
            <StatCard title="Today Submissions" value={stats.todaySubmissions} color="purple" active={activeStatFilter === 'Today'} onClick={() => { setActiveStatFilter('Today'); setStatusFilter('all'); }} />
            <StatCard title="Turnups" value={stats.turnups} color="cyan" active={activeStatFilter === 'Turnups'} onClick={() => { setActiveStatFilter('Turnups'); setStatusFilter('all'); }} />
            <StatCard title="No Show" value={stats.noShow} color="indigo" active={activeStatFilter === 'No Show'} onClick={() => { setActiveStatFilter('No Show'); setStatusFilter('all'); }} />
            <StatCard title="Yet to attend" value={stats.yetToAttend} color="purple" active={activeStatFilter === 'Yet to attend'} onClick={() => { setActiveStatFilter('Yet to attend'); setStatusFilter('all'); }} />
            <StatCard title="Selected" value={stats.selected} color="green" active={activeStatFilter === 'Selected'} onClick={() => { setActiveStatFilter('Selected'); setStatusFilter('all'); }} />
            <StatCard title="Rejected" value={stats.rejected} color="red" active={activeStatFilter === 'Rejected'} onClick={() => { setActiveStatFilter('Rejected'); setStatusFilter('all'); }} />
            <StatCard title="Hold" value={stats.hold} color="amber" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} />
            <StatCard title="Pipeline" value={stats.pipeline} color="orange" active={activeStatFilter === 'Pipeline'} onClick={() => { setActiveStatFilter('Pipeline'); setStatusFilter('all'); }} />
            <StatCard title="Joined" value={stats.joined} color="emerald" active={activeStatFilter === 'Joined'} onClick={() => { setActiveStatFilter('Joined'); setStatusFilter('all'); }} />
            <StatCard title="Backout" value={stats.backout} color="red" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} />
            <StatCard title="Shared Profiles" value={stats.sharedProfiles} color="cyan" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} />
          </div>

          <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="w-full md:max-w-2xl">
                <CandidateKeywordSearch
                  input={searchInput}
                  keywords={searchKeywords}
                  onInputChange={setSearchInput}
                  onKeywordsChange={setSearchKeywords}
                />
              </div>
              <div className="flex gap-3">
                <NativeSelect value={statusFilter} onChange={setStatusFilter} className="w-44">
                  <option value="all">All Status</option>
                  {allStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                </NativeSelect>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button className={`p-2 rounded text-sm ${viewMode === 'table' ? 'bg-white shadow' : ''}`} onClick={() => setViewMode('table')}><List className="h-4 w-4" /></button>
                  <button className={`p-2 rounded text-sm ${viewMode === 'grid' ? 'bg-white shadow' : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>

          {viewMode === 'table' ? (
            <div className="w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white flex flex-col">
              <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="w-full overflow-x-auto overflow-y-hidden sleek-scrollbar rounded-t-xl bg-slate-50 border-b border-slate-100"
                style={{ height: '10px' }}
              >
                <div style={{ width: '1500px', height: '1px' }}></div>
              </div>

              <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="w-full overflow-x-auto sleek-scrollbar rounded-b-xl">
                <table className="w-full text-sm text-left border-collapse min-w-[1500px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="p-4 w-12 whitespace-nowrap"><input type="checkbox" checked={allVisibleCandidatesSelected} onChange={selectAllCandidates} className="h-4 w-4 rounded border-slate-300" title="Select all visible candidates" /></th>
                      <th className="p-3 whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('candidateId')}>ID <SortIcon field="candidateId" /></th>
                      <th className="p-3 whitespace-nowrap">Matching Jobs</th>
                      <th className="p-3 whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort('name')}>Name <SortIcon field="name" /></th>
                      <th className="p-3 whitespace-nowrap">Phone</th>
                      <th className="p-3 whitespace-nowrap">Email</th>
                      <th className="p-3 whitespace-nowrap">Client</th>
                      <th className="p-3 whitespace-nowrap">Skills</th>
                      <th className="p-3 whitespace-nowrap">Date Added</th>
                      <th className="p-3 whitespace-nowrap">Experience</th>
                      <th className="p-3 whitespace-nowrap">CTC / ECTC</th>
                      <th className="p-3 whitespace-nowrap">Status</th>
                      <th className="p-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedCandidates.map((c, index) => {
                      return (
                        <tr key={c._id} className="hover:bg-slate-50">
                          <td className="p-3 pl-4 whitespace-nowrap"><input type="checkbox" checked={selectedCandidates.includes(c._id)} onChange={() => toggleSelectCandidate(c._id)} className="h-4 w-4 rounded" /></td>
                          <td className="p-3 font-mono text-xs text-blue-600 font-bold cursor-pointer whitespace-nowrap" onClick={() => { navigator.clipboard.writeText(getCandidateId(c)); toast({ title: "Copied ID" }); }}>{getCandidateId(c)}</td>
                          <td className="p-3 whitespace-nowrap">
                            {c.matchingJobsCount > 0 ? (
                              <button
                                onClick={() => openMatchingJobsModal(c)}
                                className="font-semibold text-blue-600 hover:text-blue-800 hover:underline text-sm focus:outline-none flex items-center gap-1.5 px-2 py-1 rounded bg-blue-50/50 hover:bg-blue-50 cursor-pointer"
                                title="View matching jobs"
                              >
                                {c.matchingJobsCount} {c.matchingJobsCount === 1 ? 'Job' : 'Jobs'}
                              </button>
                            ) : (
                              <span className="text-slate-400 text-sm px-2 py-1 select-none">
                                0 Jobs
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <CandidateProfileLink candidate={c}>{c.name}</CandidateProfileLink>
                            <div className="mt-0.5 text-xs font-medium text-slate-400">{c.position || '-'}</div>
                          </td>
                          <td className="p-3 text-sm text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-2">{c.contact}
                              <button className="text-green-600 hover:text-green-700" onClick={() => handleWhatsApp(c)}><MessageCircle className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-slate-600 whitespace-nowrap"><span className="truncate max-w-[150px] block" title={c.email}>{c.email}</span></td>
                          <td className="p-3 whitespace-nowrap">
                            <CandidateClientCell candidate={c} onShowMore={setClientPopoverCandidate} />
                          </td>
                          <td className="p-3 text-xs text-slate-600 max-w-[150px] truncate whitespace-nowrap" title={Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}>{formatSkills(c.skills)}</td>
                          <td className="p-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(c.dateAdded || c.createdAt)}</td>
                          <td className="p-3 text-sm whitespace-nowrap">{c.totalExperience ? `${c.totalExperience} Yrs` : '-'}</td>
                          <td className="p-3 text-xs whitespace-nowrap"><div>{c.ctc || '-'}</div><div className="text-green-600">{c.ectc || '-'}</div></td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1.5 min-w-[140px] max-w-[240px]">
                              {getCandidateStatuses(c).map((status) => (
                                <StatusBadge key={status} status={status} />
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1">
                              <button className="p-1 hover:bg-slate-100 rounded" onClick={() => openViewDialog(c)}><Eye className="h-3.5 w-3.5 text-blue-600" /></button>
                              <button className="p-1 hover:bg-slate-100 rounded" onClick={() => openEditDialog(c)}><Edit className="h-3.5 w-3.5 text-slate-600" /></button>
                              <button className="p-1 hover:bg-slate-100 rounded" onClick={() => toggleActiveStatus(c._id, c.active !== false)}><Ban className="h-3.5 w-3.5 text-red-600" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 bg-white gap-4">
                  <span className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, getFilteredCandidates.length)} of {getFilteredCandidates.length} entries
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedCandidates.map(c => (
                  <div key={c._id} className="bg-white border border-slate-200 rounded-xl hover:shadow-lg transition-all p-6">
                    <div className="flex justify-between mb-4">
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCandidates.includes(c._id)}
                          onChange={() => toggleSelectCandidate(c._id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                          title="Select candidate"
                        />
                        <div>
                          <h3 className="font-bold text-slate-900">
                            <CandidateProfileLink candidate={c}>{c.name}</CandidateProfileLink>
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-blue-600 font-mono">{getCandidateId(c)}</span>
                            <span className="text-slate-300">•</span>
                            {c.matchingJobsCount > 0 ? (
                              <button
                                onClick={() => openMatchingJobsModal(c)}
                                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                                title="View matching jobs"
                              >
                                {c.matchingJobsCount} {c.matchingJobsCount === 1 ? 'Job' : 'Jobs'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 select-none">
                                0 Jobs
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                        {getCandidateStatuses(c).slice(0, 2).map((status) => (
                          <StatusBadge key={status} status={status} />
                        ))}
                        {getCandidateStatuses(c).length > 2 && <span className="text-xs text-slate-500">+{getCandidateStatuses(c).length - 2}</span>}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2"><Building className="h-4 w-4" /> <CandidateClientCell candidate={c} onShowMore={setClientPopoverCandidate} /></div>
                      <div className="flex items-center gap-2"><Award className="h-4 w-4" /> {formatSkills(c.skills)}</div>
                      <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {c.email}</div>
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {c.contact}</div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => openViewDialog(c)}>View</Button>
                      <Button variant="outline" className="flex-1" onClick={() => openEditDialog(c)}>Edit</Button>
                      <Button variant="outline" className="text-green-600 hover:bg-green-50" onClick={() => handleWhatsApp(c)}><MessageCircle className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center p-4 border border-slate-200 rounded-xl bg-white gap-4">
                  <span className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, getFilteredCandidates.length)} of {getFilteredCandidates.length} entries
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {clientPopoverCandidate && (
        <ClientSubmissionsModal
          candidate={clientPopoverCandidate}
          jobs={jobs}
          onClose={() => setClientPopoverCandidate(null)}
        />
      )}

      <JobInvitationModal
        open={isJobInviteOpen}
        onClose={() => setIsJobInviteOpen(false)}
        candidates={selectedCandidateRecords}
        jobs={jobs}
        apiUrl={API_URL}
        authHeaders={authHeaders}
        onSent={handleJobInviteResult}
      />

      <Modal open={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)}>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> Confirm Deletion</ModalTitle>
          <ModalDesc>Are you sure you want to delete <strong>{selectedCandidates.length}</strong> selected candidate(s)? This action cannot be undone.</ModalDesc>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={isAddDialogOpen || isEditDialogOpen} onClose={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }} maxWidth="max-w-7xl">
        <ModalHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <ModalTitle>{isEditDialogOpen ? 'Edit Candidate' : 'Add New Candidate'}</ModalTitle>
            <Button variant="outline" onClick={() => setCandidateFormControlOpen(true)} className="gap-2">
              <SlidersHorizontal className="h-4 w-4" /> Form Control
            </Button>
          </div>
        </ModalHeader>
        <ModalBody>
          {!isEditDialogOpen && (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 mb-4">
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-full"><FileUp className="h-6 w-6 text-blue-600" /></div>
                <div className="text-center">
                  <h3 className="font-semibold text-slate-900 mb-1">Upload Resume to Auto-Fill</h3>
                  <p className="text-sm text-slate-500 mb-3">Upload PDF or DOC/DOCX file (max 5MB)</p>
                </div>
                <label htmlFor="resume-upload-recruiter">
                  <input id="resume-upload-recruiter" type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" disabled={isParsingResume} />
                  <Button type="button" variant="outline" disabled={isParsingResume} onClick={() => document.getElementById('resume-upload-recruiter')?.click()}>
                    {isParsingResume ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Parsing...</> : <><Upload className="mr-2 h-4 w-4" />Choose File</>}
                  </Button>
                </label>
              </div>
            </div>
          )}
          {renderCandidateForm()}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }}>Cancel</Button>
          <Button onClick={() => handleSave(isEditDialogOpen)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {isEditDialogOpen ? "Update" : "Save"}
          </Button>
        </ModalFooter>
      </Modal>

      <CandidateFormControlModal
        isOpen={candidateFormControlOpen}
        onClose={() => setCandidateFormControlOpen(false)}
        config={candidateFieldConfig}
        onConfigChange={handleCandidateConfigChange}
      />

      <BulkCandidateImportModal
        open={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        apiUrl={API_URL}
        getHeaders={async () => ({ ...(await authHeaders()), 'Content-Type': 'application/json' })}
        onImported={fetchData}
      />

      <CandidateExportModal
        open={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        candidates={getFilteredCandidates}
        standardColumns={candidateExportColumns}
        customFields={candidateFieldConfig.customFields}
      />

      {/* Premium View Modal */}
      {viewingCandidate && isViewDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsViewDialogOpen(false)}
          />

          <div
            className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col border border-zinc-200/60 dark:border-zinc-800/60"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-8 pt-8 pb-6 shrink-0">
              <button
                onClick={() => setIsViewDialogOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-5">
                <div className="w-18 h-18 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-2xl font-black select-none shrink-0 shadow-lg"
                  style={{ width: '72px', height: '72px' }}>
                  {(viewingCandidate.name || 'C').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-black text-white leading-tight truncate">
                    {viewingCandidate.name}
                  </h2>
                  <p className="text-indigo-200 text-sm font-semibold mt-0.5">
                    {viewingCandidate.position || 'Position not set'}{viewingCandidate.currentCompany ? ` · ${viewingCandidate.currentCompany}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-bold text-white">
                      <UserCircle className="w-3 h-3" /> {getCandidateId(viewingCandidate)}
                    </span>
                    {viewingCandidate.totalExperience && (
                      <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-bold text-white">
                        <Briefcase className="w-3 h-3" /> {viewingCandidate.totalExperience} yrs exp
                      </span>
                    )}
                    {viewingCandidate.currentLocation && (
                      <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-bold text-white">
                        📍 {viewingCandidate.currentLocation}
                      </span>
                    )}
                    {getCandidateStatuses(viewingCandidate).slice(0, 3).map(status => (
                      <StatusBadge key={status} status={status} />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 mr-14">
                  {viewingCandidate.contact && (
                    <a href={`tel:${viewingCandidate.contact}`}
                      className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors" title="Call">
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {viewingCandidate.email && (
                    <a href={`mailto:${viewingCandidate.email}`}
                      className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors" title="Email">
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                  {viewingCandidate.contact && (
                    <button onClick={() => handleWhatsApp(viewingCandidate)}
                      className="p-2.5 rounded-xl bg-green-500/80 hover:bg-green-500 text-white border border-green-400/40 transition-colors" title="WhatsApp">
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50/50 dark:bg-zinc-950/30 text-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 p-5 shadow-sm space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <UserCircle className="w-3.5 h-3.5" /> Personal Info
                  </h3>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: 'Email', value: viewingCandidate.email, href: `mailto:${viewingCandidate.email}` },
                      { label: 'Phone', value: viewingCandidate.contact, href: `tel:${viewingCandidate.contact}` },
                      { label: 'Date of Birth', value: formatDate(viewingCandidate.dateOfBirth) },
                      { label: 'Gender', value: viewingCandidate.gender },
                      { label: 'Current Location', value: viewingCandidate.currentLocation },
                      { label: 'Preferred Location', value: viewingCandidate.preferredLocation },
                    ].map(({ label, value, href }) => value ? (
                      <div key={label}>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</div>
                        {href
                          ? <a href={href} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate block">{value}</a>
                          : <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{value}</div>
                        }
                      </div>
                    ) : null)}
                    {viewingCandidate.linkedin && (
                      <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">LinkedIn</div>
                        <a href={viewingCandidate.linkedin} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 truncate">
                          <Linkedin className="w-3 h-3 shrink-0" /> View Profile
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 p-5 shadow-sm space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" /> Professional
                  </h3>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: 'Current Role', value: viewingCandidate.position },
                      { label: 'Current Company', value: viewingCandidate.currentCompany },
                      { label: 'Industry', value: viewingCandidate.industry },
                      { label: 'Experience', value: viewingCandidate.totalExperience ? `${viewingCandidate.totalExperience} years` : null },
                      { label: 'Education', value: viewingCandidate.education },
                    ].map(({ label, value }) => value ? (
                      <div key={label}>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{value}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 p-5 shadow-sm space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5" /> Compensation &amp; Source
                  </h3>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: 'Current CTC', value: viewingCandidate.ctc },
                      { label: 'Expected CTC', value: viewingCandidate.ectc },
                      { label: 'Notice Period', value: viewingCandidate.noticePeriod ? `${viewingCandidate.noticePeriod} days` : null },
                      { label: 'Source', value: viewingCandidate.source },
                    ].map(({ label, value }) => value ? (
                      <div key={label}>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{value}</div>
                      </div>
                    ) : null)}
                    {viewingCandidate.createdAt && (
                      <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Added On</div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {new Date(viewingCandidate.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {viewingCandidate.skills && viewingCandidate.skills.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 p-5 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-3">
                    <Award className="w-3.5 h-3.5" /> Skills &amp; Expertise
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(viewingCandidate.skills) ? viewingCandidate.skills : String(viewingCandidate.skills).split(','))
                      .map((s, i) => (
                        <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40">
                          {String(s).trim()}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 p-5 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mb-4">
                  <Target className="w-3.5 h-3.5" /> Client-wise Submission Pipeline
                </h3>
                <CandidatePipelinePanel
                  candidateId={viewingCandidate._id}
                  apiUrl={API_URL}
                  authHeaders={authHeaders}
                />
              </div>

              {viewingCandidate.notes && (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 rounded-2xl p-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">Notes</h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{viewingCandidate.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-zinc-400 font-medium">
                Candidate ID: <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{getCandidateId(viewingCandidate)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsViewDialogOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewingCandidate); }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all"
                >
                  Edit Candidate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renderMatchingJobsModal()}

      {viewingJobDetails && (
        <JobDetailsModal
          job={viewingJobDetails}
          onClose={() => setViewingJobDetails(null)}
        />
      )}
    </>
  );
}

const StatCard = ({ title, value, color, active, onClick }) => {
  const styles = {
    blue: "border-l-blue-500 text-blue-600 bg-blue-50/50",
    cyan: "border-l-cyan-500 text-cyan-600 bg-cyan-50/50",
    purple: "border-l-purple-500 text-purple-600 bg-purple-50/50",
    indigo: "border-l-indigo-500 text-indigo-600 bg-indigo-50/50",
    rose: "border-l-rose-500 text-rose-600 bg-rose-50/50",
    green: "border-l-green-500 text-green-600 bg-green-50/50",
    emerald: "border-l-emerald-500 text-emerald-600 bg-emerald-50/50",
    red: "border-l-red-500 text-red-600 bg-red-50/50",
    orange: "border-l-orange-500 text-orange-600 bg-orange-50/50",
    amber: "border-l-amber-500 text-amber-600 bg-amber-50/50",
  };
  const currentStyle = styles[color] || styles.blue;
  return (
    <div onClick={onClick} className={`p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 cursor-pointer relative overflow-hidden bg-white ${currentStyle} ${active ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
      <div className="flex justify-between items-center relative z-10">
        <div>
          <h3 className="text-2xl font-bold">{value}</h3>
          <p className="text-sm font-medium opacity-80">{title}</p>
        </div>
      </div>
      {active && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />}
    </div>
  );
};
