import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
import {
  Search, Plus, Eye, Loader2, MessageCircle,
  ArrowUpDown, ArrowUp, ArrowDown, Users, Download,
  X, Edit, Trash2, Ban, List, LayoutGrid, Calendar,
  GraduationCap, Award, UserCircle, Target, IndianRupee,
  Upload, FileUp, AlertTriangle, FileSpreadsheet, Linkedin,
  Building, Mail, Phone, Briefcase, UserPlus,
  CheckCircle2, FileText, Sparkles, SlidersHorizontal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CandidateProfileLink from '@/components/CandidateProfileLink';
import { ScoreBadge, MatchBreakdownBar, SkillChips } from '@/components/Score/ScoreComponents';
import BulkCandidateImportModal from '@/components/BulkCandidateImportModal';
import CandidateExportModal from '@/components/CandidateExportModal';
import ClientJobSubmissions from '@/components/ClientJobSubmissions';
import CandidatePipelinePanel from '@/components/CandidatePipelinePanel';
import { RecruiterDetailsTrigger } from '@/components/RecruiterDetailsModal';
import CandidateKeywordSearch from '@/components/CandidateKeywordSearch';
import JobDetailsModal from '@/components/JobDetailsModal';
import JobInvitationModal from '@/components/JobInvitationModal';
import { candidateMatchesKeywordBadges } from '@/utils/candidateSearch';

// ── ENV Config ────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

const ModalPortal = ({ children }) => {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
};

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

const inputCls = (err) =>
  `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
  } bg-white dark:bg-slate-800`;

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

const DEFAULT_CANDIDATE_FIELD_CONFIG = [
  { fieldName: 'firstName', label: 'First Name', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'lastName', label: 'Last Name', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'contact', label: 'Contact Number', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'alternateNumber', label: 'Alternate Number', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'email', label: 'Email Address', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'currentLocation', label: 'Current Location', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'preferredLocation', label: 'Preferred Location', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'dateOfBirth', label: 'Date of Birth', fieldType: 'date', visible: true, isDefault: true },
  { fieldName: 'dateAdded', label: 'Date Added', fieldType: 'date', visible: true, isDefault: true },
  { fieldName: 'position', label: 'Current Role', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'client', label: 'Client / Target Company', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'currentCompany', label: 'Current Company', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'reasonForChange', label: 'Reason for Change', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'totalExperience', label: 'Total Experience', fieldType: 'number', visible: true, isDefault: true },
  { fieldName: 'relevantExperience', label: 'Relevant Experience', fieldType: 'number', visible: true, isDefault: true },
  { fieldName: 'skills', label: 'Skills', fieldType: 'textarea', visible: true, isDefault: true },
  { fieldName: 'education', label: 'Qualification', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'ctc', label: 'Current CTC', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'currentTakeHome', label: 'Current Take Home', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'ectc', label: 'Expected CTC', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'expectedTakeHome', label: 'Expected Take Home', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'noticePeriod', label: 'Notice Period', fieldType: 'text', visible: true, isDefault: true },
  { fieldName: 'servingNoticePeriod', label: 'Serving Notice Period', fieldType: 'boolean', visible: true, isDefault: true },
  { fieldName: 'offersInHand', label: 'Offer in Hand', fieldType: 'boolean', visible: true, isDefault: true },
  { fieldName: 'source', label: 'Source', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'status', label: 'Status', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'recruiterId', label: 'Assign to User', fieldType: 'select', visible: true, isDefault: true },
  { fieldName: 'remarks', label: 'Remarks', fieldType: 'textarea', visible: true, isDefault: true },
];

const REQUIRED_CANDIDATE_FIELD_NAMES = new Set(['firstName', 'lastName', 'contact', 'email', 'position', 'skills', 'status']);

const normalizeCandidateFieldConfig = (config = {}) => {
  const storedFields = Array.isArray(config.fields) ? config.fields : [];
  const storedCustomFields = Array.isArray(config.customFields) ? config.customFields : [];
  return {
    fields: DEFAULT_CANDIDATE_FIELD_CONFIG.map((field) => {
      const stored = storedFields.find(item => item.fieldName === field.fieldName) || {};
      const isMandatory = field.fieldName === 'client'
        ? false
        : REQUIRED_CANDIDATE_FIELD_NAMES.has(field.fieldName) || Boolean(stored.isMandatory);
      return { ...field, ...stored, isDefault: true, isMandatory, visible: isMandatory ? true : stored.visible ?? field.visible };
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

const saveCandidateFieldConfig = (updated) => {
  try {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    user.candidateSettings = normalizeCandidateFieldConfig(updated);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
  } catch (e) {
    console.error('Candidate config save failed', e);
  }
};

const CandidateCustomFieldInput = ({ field, value, onChange }) => {
  const handle = (e) => onChange(field.fieldName, e.target.value);
  if (field.fieldType === 'boolean') {
    return (
      <select value={value ?? ''} onChange={handle} className={inputCls(false)}>
        <option value="">Select</option><option value="true">Yes</option><option value="false">No</option>
      </select>
    );
  }
  if (field.fieldType === 'textarea') {
    return <Textarea value={value ?? ''} onChange={handle} className={inputCls(false)} rows={3} />;
  }
  if (field.fieldType === 'select') {
    return (
      <select value={value ?? ''} onChange={handle} className={inputCls(false)}>
        <option value="">Select</option>
        {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  return <input type={field.fieldType === 'date' ? 'date' : field.fieldType === 'number' ? 'number' : 'text'} value={value ?? ''} onChange={handle} className={inputCls(false)} />;
};

const CandidateFormControlModal = ({ isOpen, onClose, config, onConfigChange }) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [newField, setNewField] = useState({ label: '', fieldType: 'text', options: '' });
  if (!isOpen) return null;

  const toggleDefault = (i) => {
    const updated = { ...config, fields: [...config.fields] };
    if (updated.fields[i].isMandatory) return;
    updated.fields[i] = { ...updated.fields[i], visible: !updated.fields[i].visible };
    onConfigChange(updated);
  };
  const toggleCustom = (i) => {
    const updated = { ...config, customFields: [...config.customFields] };
    updated.customFields[i] = { ...updated.customFields[i], visible: !updated.customFields[i].visible };
    onConfigChange(updated);
  };
  const editCustomLabel = (i, value) => {
    const updated = { ...config, customFields: [...config.customFields] };
    updated.customFields[i] = { ...updated.customFields[i], label: value };
    onConfigChange(updated);
  };
  const deleteCustom = (i) => onConfigChange({ ...config, customFields: config.customFields.filter((_, idx) => idx !== i) });
  const addCustomField = () => {
    if (!newField.label.trim()) return;
    const baseName = newField.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_field';
    const existing = new Set([...config.fields, ...config.customFields].map(field => field.fieldName));
    let fieldName = baseName;
    let suffix = 2;
    while (existing.has(fieldName)) { fieldName = `${baseName}_${suffix}`; suffix += 1; }
    const entry = {
      fieldName, label: newField.label.trim(), fieldType: newField.fieldType,
      isDefault: false, isMandatory: false, visible: true,
      ...(newField.fieldType === 'select' && { options: newField.options.split(',').map(option => option.trim()).filter(Boolean) }),
    };
    onConfigChange({ ...config, customFields: [...config.customFields, entry] });
    setNewField({ label: '', fieldType: 'text', options: '' });
  };

  const visibleDefaultCount = config.fields.filter(field => field.visible).length;
  const visibleCustomCount = config.customFields.filter(field => field.visible).length;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-955/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-50 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto lg:overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center"><SlidersHorizontal className="w-5 h-5" /></span>
            <div><h2 className="text-xl font-bold text-slate-900">Candidate Form Control</h2><p className="text-sm text-slate-500 mt-0.5">Configure fields for admin and recruiter candidate forms.</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">{visibleDefaultCount} standard active</span>
            <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">{visibleCustomCount} additional active</span>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="grid lg:grid-cols-[320px_1fr] lg:h-[calc(92vh-82px)] h-auto min-h-0 lg:overflow-hidden">
          <aside className="bg-white border-r border-slate-200 p-5 min-h-0 lg:overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Add Custom Field</p>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Field Label</label><input placeholder="Example: Portfolio Link" value={newField.label} onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))} className={inputCls(false)} /></div>
              <div><label className="block text-xs font-medium text-slate-500 mb-1">Field Type</label><select value={newField.fieldType} onChange={(e) => setNewField(prev => ({ ...prev, fieldType: e.target.value }))} className={inputCls(false)}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="boolean">Yes/No</option><option value="textarea">Textarea</option><option value="select">Select</option></select></div>
              {newField.fieldType === 'select' && <div><label className="block text-xs font-medium text-slate-500 mb-1">Options</label><input placeholder="Option 1, Option 2" value={newField.options} onChange={(e) => setNewField(prev => ({ ...prev, options: e.target.value }))} className={inputCls(false)} /></div>}
              <button onClick={addCustomField} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"><Plus className="w-4 h-4" />Add Field</button>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-900">Additional fields</p><p className="text-xs text-slate-500 mt-1">New fields appear in a separate section in the add candidate modal.</p></div>
          </aside>
          <div className="p-5 min-h-0 lg:overflow-y-auto overflow-visible">
            <div className="grid md:grid-cols-2 gap-5 md:h-full md:min-h-0">
              <section className="space-y-3 md:min-h-0 md:flex md:flex-col">
                <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Standard Fields</p><span className="text-xs text-slate-400">{config.fields.length} fields</span></div>
                <div className="space-y-2 md:min-h-0 md:overflow-y-auto md:pr-1">
                  {config.fields.map((field, i) => (
                    <div key={field.fieldName} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center gap-3">
                        <button type="button" disabled={field.isMandatory} onClick={() => toggleDefault(i)} className={`relative h-6 w-11 rounded-full transition-colors ${field.visible ? 'bg-blue-600' : 'bg-slate-200'} disabled:opacity-60`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${field.visible ? 'left-6' : 'left-1'}`} /></button>
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900 truncate">{field.label}</p><p className="text-xs text-slate-400 mt-0.5">{field.fieldName}</p></div>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">{field.fieldType}</span>
                      </div>
                      {field.isMandatory && <p className="text-xs text-red-500 mt-2">Required fields stay visible.</p>}
                    </div>
                  ))}
                </div>
              </section>
              <section className="space-y-3 md:min-h-0 md:flex md:flex-col">
                <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Additional Fields</p><span className="text-xs text-slate-400">{config.customFields.length} fields</span></div>
                {config.customFields.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center"><p className="text-sm font-medium text-slate-800">No additional fields yet</p><p className="text-xs text-slate-500 mt-1">Create one from the panel on the left.</p></div> : (
                  <div className="space-y-2 md:min-h-0 md:overflow-y-auto md:pr-1">
                    {config.customFields.map((field, i) => (
                      <div key={field.fieldName} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => toggleCustom(i)} className={`relative h-6 w-11 rounded-full transition-colors ${field.visible ? 'bg-blue-600' : 'bg-slate-200'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${field.visible ? 'left-6' : 'left-1'}`} /></button>
                          <div className="min-w-0 flex-1">{editingIndex === i ? <input autoFocus value={field.label} onChange={(e) => editCustomLabel(i, e.target.value)} onBlur={() => setEditingIndex(null)} className={inputCls(false)} /> : <><p className="text-sm font-medium text-slate-900 truncate">{field.label}</p><p className="text-xs text-slate-400 mt-0.5">{field.fieldName}</p></>}</div>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">{field.fieldType}</span>
                        </div>
                        <div className="flex justify-end gap-1 mt-3"><button onClick={() => setEditingIndex(i)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"><Edit className="w-3.5 h-3.5" />Edit</button><button onClick={() => deleteCustom(i)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" />Delete</button></div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

// ── StatCard Component ────────────────────────────────────────────────────────
const StatCard = ({ title, value, colorTheme, active, onClick, hasDot }) => {
  const themes = {
    overall: 'bg-blue-600 text-white border-blue-700 dark:bg-blue-700',
    shared: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200',
    turnups: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/60 dark:text-purple-200',
    noshow: 'bg-neutral-300 text-black border-neutral-400 dark:bg-neutral-700 dark:text-white',
    yetToAttend: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200',
    selected: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/60 dark:text-green-200',
    joined: 'bg-emerald-200 text-emerald-900 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200',
    rejected: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-200',
    backout: 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/60 dark:text-rose-200',
    hold: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/60 dark:text-orange-200',
    pipeline: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200',
    today: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/60 dark:text-violet-200',
  };
  const themeClass = themes[colorTheme] || themes.overall;

  return (
    <div onClick={onClick} className={`relative p-4 rounded-xl shadow-sm border ${themeClass} ${onClick ? 'cursor-pointer' : ''} ${active ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500' : ''}`}>
      {hasDot && <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-white opacity-80"></span>}
      <h3 className="text-2xl font-bold">{value}</h3>
      <p className="text-sm mt-1 font-medium opacity-90">{title}</p>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getInitials = (name = '') => name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
const getCandidateId = (c) => c.candidateId || c._id?.substring(c._id.length - 6).toUpperCase();
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
const formatSkills = (skills) => !skills ? 'N/A' : Array.isArray(skills) ? skills.slice(0, 3).join(', ') + (skills.length > 3 ? '...' : '') : skills.length > 50 ? skills.substring(0, 50) + '...' : skills;

// ✅ Robust Date Extractor
const getSafeDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && d.length >= 10) return d.substring(0, 10);
  try { return new Date(d).toISOString().split('T')[0]; } catch (e) { return ''; }
};

// ✅ Returns firstName only for recruiter column display
const getRecruiterName = (r) => {
  if (!r) return 'Unassigned';
  if (r.firstName) return r.firstName;
  if (r.username) return r.username;
  if (r.name) return r.name.split(' ')[0];
  return r.email || 'Unknown';
};

const getCandidateRecruiterDetails = (candidate, recruiters = []) => {
  const recruiter = candidate?.recruiterId;
  if (recruiter && typeof recruiter === 'object') return recruiter;
  const recruiterId = recruiter ? String(recruiter) : '';
  const found = recruiterId
    ? recruiters.find(r => String(r._id || r.id || '') === recruiterId)
    : null;
  return found || { name: candidate?.recruiterName || 'Unassigned' };
};

// ✅ Returns a display label with role indicator for dropdowns
const getRecruiterLabel = (r) => {
  const name = getRecruiterName(r);
  const roleTag = r.role === 'admin' ? ' (Admin)' : r.role === 'manager' ? ' (Manager)' : '';
  return `${name}${roleTag}`;
};

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
    <div className={`min-h-[42px] w-full rounded-lg border bg-white px-2 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${error ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}>
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

const ALL_STATUSES = [
  'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
];

const SOURCES = ['LinkedIn', 'Naukri', 'Indeed', 'Portal', 'Referral', 'Other'];

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

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap ${getStatusBadgeClass(status)}`}>
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

const getSubmittedByLabel = (submission) => {
  if (submission?.submittedByName) return submission.submittedByName;
  const submittedBy = submission?.submittedBy;
  if (!submittedBy || typeof submittedBy !== 'object') return 'N/A';
  const fullName = `${submittedBy.firstName || ''} ${submittedBy.lastName || ''}`.trim();
  return fullName || submittedBy.name || submittedBy.email || 'N/A';
};

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

const candidateMatchesClient = (candidate, clientFilter) => {
  if (clientFilter === 'all') return true;
  const submissions = getCandidateSubmissions(candidate);
  if (submissions.length > 0) {
    return submissions.some((submission) => submission.clientName === clientFilter);
  }
  return candidate?.client === clientFilter;
};

const CandidateClientCell = ({ candidate, onShowMore }) => {
  const submissions = getCandidateSubmissions(candidate);
  if (submissions.length === 0) {
    return <span className="text-slate-600 font-medium">{candidate.client || 'N/A'}</span>;
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

// ── Main Component ────────────────────────────────────────────────────────────
const ClientSubmissionsModal = ({ candidate, jobs = [], onClose }) => {
  const submissions = getCandidateSubmissions(candidate);
  const [selectedJob, setSelectedJob] = useState(null);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl border border-slate-200">
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
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm min-w-[650px]">
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

export default function AdminCandidates() {
  const { toast } = useToast();

  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState({ show: false, fileName: '', fieldsCount: 0 });
  const [matchingJobsCandidate, setMatchingJobsCandidate] = useState(null);
  const [matchingJobs, setMatchingJobs] = useState([]);
  const [loadingMatchingJobs, setLoadingMatchingJobs] = useState(false);
  const [matchingJobsError, setMatchingJobsError] = useState(null);
  const [viewingJobDetails, setViewingJobDetails] = useState(null);
  const [expandedJobId, setExpandedJobId] = useState(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchKeywords, setSearchKeywords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'candidateId', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [isJobInviteOpen, setIsJobInviteOpen] = useState(false);

  // --- Pagination States ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeywords, statusFilter, recruiterFilter, clientFilter, activeStatFilter]);

  // Bulk Assign States
  const [bulkRecruiterId, setBulkRecruiterId] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [viewCandidate, setViewCandidate] = useState(null);
  const [clientPopoverCandidate, setClientPopoverCandidate] = useState(null);
  const [errors, setErrors] = useState({});
  const [candidateFieldConfig, setCandidateFieldConfig] = useState(getCandidateFieldConfig);
  const [candidateFormControlOpen, setCandidateFormControlOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Today Submissions modal (Admin)
  const [isTodaySubOpen, setIsTodaySubOpen] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

  // Refs for Top and Bottom Scrollbars
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

  // Today in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  const initialFormData = {
    firstName: '', lastName: '', contact: '', alternateNumber: '', email: '',
    dateOfBirth: '', dateAdded: todayStr,
    currentLocation: '', preferredLocation: '', position: '', positionOther: '', client: '', currentCompany: '',
    totalExperience: '', relevantExperience: '', education: '',
    ctc: '', currentTakeHome: '', ectc: '', expectedTakeHome: '',
    noticePeriod: '', servingNoticePeriod: 'false', lwd: '',
    reasonForChange: '', offersInHand: 'false', offerPackage: '', source: 'Portal',
    recruiterId: '', status: ['Submitted'], // 🔴 Multi-Select Array
    skills: [], remarks: '', customFields: {},
    submissions: [],  // ← multi client/job submission rows
  };
  const [formData, setFormData] = useState(initialFormData);

  const handleCandidateConfigChange = (updated) => {
    const normalized = normalizeCandidateFieldConfig(updated);
    setCandidateFieldConfig(normalized);
    saveCandidateFieldConfig(normalized);
  };

  const isCandidateFieldVisible = (fieldName) => {
    const field = candidateFieldConfig.fields.find(item => item.fieldName === fieldName);
    return field?.visible !== false;
  };

  const visibleCustomCandidateFields = useMemo(
    () => candidateFieldConfig.customFields.filter(field => field.visible),
    [candidateFieldConfig]
  );

  const handleCustomCandidateFieldChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, [fieldName]: value } }));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeader();
      const [resCand, resRec, resCli, resJobs] = await Promise.all([
        fetch(`${API_URL}/candidates?includeSubmissions=true`, { headers }),
        fetch(`${API_URL}/recruiters?view=lookup`, { headers }),
        fetch(`${API_URL}/clients?view=lookup`, { headers }),
        fetch(`${API_URL}/jobs?view=lookup`, { headers }),
      ]);

      if (resCand.ok) {
        const data = await resCand.json();
        setCandidates(data);
      }
      if (resRec.ok) {
        const data = await resRec.json();
        // Sort: admins first, then managers, then recruiters
        const sorted = data.sort((a, b) => {
          const order = { admin: 0, manager: 1, recruiter: 2 };
          return (order[a.role] ?? 3) - (order[b.role] ?? 3);
        });
        setRecruiters(sorted);
      }
      if (resCli.ok) {
        const data = await resCli.json();
        setClients(data);
      }
      if (resJobs.ok) {
        const data = await resJobs.json();
        setJobs(Array.isArray(data) ? data : data.jobs || []);
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fetchMatchingJobs = async (candidate) => {
    setLoadingMatchingJobs(true);
    setMatchingJobsError(null);
    setMatchingJobs([]);
    try {
      const headers = getAuthHeader();
      const res = await fetch(`${API_URL}/candidates/${candidate._id}/matching-jobs`, {
        headers,
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

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  // ✅ Status Multi-Select Handlers
  const addStatus = (newStatus) => {
    if (!newStatus) return;
    if (newStatus === 'SELECT_ALL') {
      setFormData(prev => ({ ...prev, status: [...ALL_STATUSES] }));
    } else if (!formData.status.includes(newStatus)) {
      setFormData(prev => ({ ...prev, status: [...prev.status, newStatus] }));
    }
    if (errors.status) setErrors(prev => { const n = { ...prev }; delete n.status; return n; });
  };

  const removeStatus = (statusToRemove) => {
    setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== statusToRemove) }));
  };

  // ── Email duplicate check (called onBlur) ──────────────────────────────────
  const checkEmailDuplicate = async (email) => {
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) return;
    setIsCheckingEmail(true);
    try {
      const headers = getAuthHeader();
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(email.trim())}${excludeParam}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exists) {
        setErrors(prev => ({
          ...prev,
          email: `A candidate with this email already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})`,
        }));
      }
    } catch (_) {
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // ── Phone duplicate check (called onBlur on contact field) ─────────────────
  const checkPhoneDuplicate = async (phone) => {
    const digits = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    if (!digits || digits.length !== 10) return;
    setIsCheckingPhone(true);
    try {
      const headers = getAuthHeader();
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exists) {
        setErrors(prev => ({
          ...prev,
          contact: `A candidate with this phone already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})`,
        }));
      }
    } catch (_) {
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
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

      const headers = getAuthHeader();
      delete headers['Content-Type'];

      const res = await fetch(`${API_URL}/candidates/parse-resume`, {
        method: 'POST',
        headers,
        body: uploadFormData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to parse resume');
      }

      const { data } = result;

      let fName = '', lName = '';
      if (data.name) {
        const nameParts = data.name.trim().split(' ');
        fName = nameParts[0] || '';
        lName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      }

      setFormData(prev => ({
        ...prev,
        firstName: prev.firstName || fName,
        lastName: prev.lastName || lName,
        email: prev.email || data.email || '',
        contact: prev.contact || data.contact || '',
        skills: normalizeSkills(prev.skills).length ? prev.skills : normalizeSkills(data.skills),
        totalExperience: prev.totalExperience || data.totalExperience || '',
        education: prev.education || data.education || '',
        currentCompany: prev.currentCompany || data.currentCompany || '',
        currentLocation: prev.currentLocation || data.currentLocation || '',
      }));

      setResumeSuccess({
        show: true,
        fileName: file.name,
        fieldsCount: Object.values({
          name: data.name, email: data.email, contact: data.contact,
          skills: data.skills, experience: data.totalExperience,
          education: data.education,
          company: data.currentCompany, location: data.currentLocation,
        }).filter(Boolean).length,
      });
      setTimeout(() => setResumeSuccess(s => ({ ...s, show: false })), 5000);
    } catch (error) {
      console.error('Parsing error:', error);
      toast({ title: 'Warning', description: 'Could not parse resume automatically. Please fill in details manually.', variant: 'default' });
    } finally {
      setIsParsingResume(false);
      e.target.value = '';
    }
  };

  const validateForm = () => {
    const e = {};
    const d = formData;

    if (!d.firstName.trim()) {
      e.firstName = 'First Name is required';
    } else if (!/^[a-zA-Z\s'\-]{2,50}$/.test(d.firstName.trim())) {
      e.firstName = 'First Name must be 2–50 characters (letters only)';
    }

    if (!d.lastName.trim()) {
      e.lastName = 'Last Name is required';
    } else if (!/^[a-zA-Z\s'\-]{1,50}$/.test(d.lastName.trim())) {
      e.lastName = 'Last Name must be letters only';
    }

    if (!d.email.trim()) {
      e.email = 'Email address is required';
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(d.email.trim())) {
      e.email = 'Enter a valid email ending with .com, .in, etc.';
    } else if (errors.email && errors.email.includes('already exists')) {
      e.email = errors.email;
    }

    if (!d.contact.trim()) {
      e.contact = 'Contact number is required';
    } else if (!/^[6-9]\d{9}$/.test(d.contact.replace(/[\s\-+]/g, ''))) {
      e.contact = 'Enter a valid 10-digit Indian mobile number (starts with 6–9)';
    } else if (errors.contact && errors.contact.includes('already exists')) {
      e.contact = errors.contact;
    }

    if (d.alternateNumber.trim()) {
      if (!/^[6-9]\d{9}$/.test(d.alternateNumber.replace(/[\s\-+]/g, ''))) {
        e.alternateNumber = 'Enter a valid 10-digit mobile number';
      } else if (d.contact.replace(/[\s\-+]/g, '') === d.alternateNumber.replace(/[\s\-+]/g, '')) {
        e.alternateNumber = 'Alternate number must be different from primary contact';
      }
    }

    if (!d.position.trim()) {
      e.position = 'Current Role is required';
    } else if (d.position.trim().length < 2) {
      e.position = 'Current Role must be at least 2 characters';
    }

    const skills = normalizeSkills(d.skills);
    if (skills.length === 0) {
      e.skills = 'At least one skill is required';
    } else if (skills.join(', ').length > 500) {
      e.skills = 'Max 500 characters allowed';
    }

    if (d.totalExperience.trim() !== '') {
      const totalExp = Number(d.totalExperience);
      if (isNaN(totalExp) || !/^\d+(\.\d+)?$/.test(d.totalExperience.trim())) {
        e.totalExperience = 'Must be a number (e.g. 5 or 5.5)';
      } else if (totalExp < 0 || totalExp > 60) {
        e.totalExperience = 'Experience must be between 0 and 60 years';
      }
    }

    if (d.relevantExperience.trim() !== '') {
      const relExp = Number(d.relevantExperience);
      if (isNaN(relExp) || !/^\d+(\.\d+)?$/.test(d.relevantExperience.trim())) {
        e.relevantExperience = 'Must be a number (e.g. 3 or 3.5)';
      } else if (relExp < 0 || relExp > 60) {
        e.relevantExperience = 'Experience must be between 0 and 60 years';
      } else if (
        d.totalExperience.trim() !== '' &&
        !isNaN(Number(d.totalExperience)) &&
        relExp > Number(d.totalExperience)
      ) {
        e.relevantExperience = 'Relevant experience cannot exceed total experience';
      }
    }

    if (d.servingNoticePeriod === 'true' && !d.lwd) {
      e.lwd = 'Last Working Day is required when serving notice period';
    }

    if (d.offersInHand === 'true' && !d.offerPackage.trim()) {
      e.offerPackage = 'Please enter the offer package amount';
    }

    if (d.dateOfBirth) {
      const todayDateStr = new Date().toLocaleDateString('en-CA');
      if (d.dateOfBirth >= todayDateStr) {
        e.dateOfBirth = 'Date of Birth must be in the past (not today or future)';
      } else {
        const dob = new Date(d.dateOfBirth);
        const ageYears = (new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears < 18) {
          e.dateOfBirth = 'Candidate must be at least 18 years old';
        } else if (ageYears > 80) {
          e.dateOfBirth = 'Please enter a valid Date of Birth';
        }
      }
    }

    if (!d.dateAdded) {
      e.dateAdded = 'Date Added is required';
    } else {
      const todayDateStr = new Date().toLocaleDateString('en-CA');
      if (d.dateAdded > todayDateStr) {
        e.dateAdded = 'Date Added cannot be a future date — only today or earlier is allowed';
      }
    }

    if (!d.status || d.status.length === 0) {
      e.status = 'At least one status is required';
    }

    if (d.education && d.education.trim().length > 200) {
      e.education = 'Qualification must be under 200 characters';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (formData.email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      try {
        const dupHeaders = getAuthHeader();
        const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
        const dupRes = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(formData.email.trim())}${excludeParam}`, { headers: dupHeaders });
        if (dupRes.ok) {
          const dupData = await dupRes.json();
          if (dupData.exists) {
            const dupMsg = `A candidate with this email already exists (ID: ${dupData.candidateId}${dupData.name ? ' — ' + dupData.name : ''})`;
            setErrors(prev => ({ ...prev, email: dupMsg }));
            toast({ title: 'Duplicate Email', description: 'This email is already registered to another candidate.', variant: 'destructive' });
            return;
          }
        }
      } catch (_) { }
    }

    if (formData.contact) {
      const digits = formData.contact.replace(/\D/g, '').slice(-10);
      if (digits.length === 10) {
        try {
          const phHeaders = getAuthHeader();
          const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
          const phRes = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers: phHeaders });
          if (phRes.ok) {
            const phData = await phRes.json();
            if (phData.exists) {
              const phMsg = `A candidate with this phone already exists (ID: ${phData.candidateId}${phData.name ? ' — ' + phData.name : ''})`;
              setErrors(prev => ({ ...prev, contact: phMsg }));
              toast({ title: 'Duplicate Phone', description: 'This phone number is already registered to another candidate.', variant: 'destructive' });
              return;
            }
          }
        } catch (_) { }
      }
    }

    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const url = isEditMode ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
      const method = isEditMode ? 'PUT' : 'POST';

      const computedName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
      const resolvedPosition = formData.position.trim();

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
        const seenJobIds = new Set(existingRows.map((r) => r.jobId));
        for (const sub of newRows) {
          if (seenJobIds.has(sub.jobId)) {
            toast({ title: 'Duplicate Submission', description: `Job ${sub.jobCode || sub.jobId} is already submitted. Remove the duplicate.`, variant: 'destructive' });
            setIsSubmitting(false);
            return;
          }
          seenJobIds.add(sub.jobId);
        }
      }

      const payload = {
        ...formData,
        name: computedName,
        position: resolvedPosition,
        offersInHand: formData.offersInHand === 'true',
        servingNoticePeriod: formData.servingNoticePeriod === 'true',
        status: formData.status,
        customFields: formData.customFields || {},
        skills: normalizeSkills(formData.skills),
      };
      delete payload.positionOther;
      delete payload.submissions;

      if (!isEditMode) {
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

      const headers = getAuthHeader();
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const savedCandidate = await res.json();

      if (isEditMode) {
        const subPromises = [];

        for (const row of existingRows) {
          if (row._originalStage && row.pipelineStage !== row._originalStage) {
            subPromises.push(
              fetch(`${API_URL}/submissions/${row._id}`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pipelineStage: row.pipelineStage, status: row.pipelineStage }),
              }).catch((e) => console.error('Stage update failed:', e))
            );
          }
        }

        for (const row of newRows) {
          subPromises.push(
            fetch(`${API_URL}/submissions`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
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

        const subResults = await Promise.allSettled(subPromises);
        const failedCount = subResults.filter((r) => r.status === 'rejected').length;
        const failedMessage = subResults.find((r) => r.status === 'rejected')?.reason?.message;

        const stageChanges = existingRows.filter((r) => r._originalStage !== r.pipelineStage).length;
        let desc = 'Candidate updated successfully.';
        if (stageChanges > 0) desc += ` ${stageChanges} pipeline stage(s) updated.`;
        if (newRows.length > 0) desc += ` ${newRows.length} new submission(s) added.`;
        if (failedCount > 0) desc += ` ${failedCount} submission update(s) failed.${failedMessage ? ` ${failedMessage}` : ''}`;
        toast({ title: failedCount > 0 ? 'Partial Save' : 'Success', description: desc, variant: failedCount > 0 ? 'destructive' : 'default' });
      } else {
        const subCount = Array.isArray(savedCandidate.submissions) ? savedCandidate.submissions.length : 0;
        const subErrCount = Array.isArray(savedCandidate.submissionErrors) ? savedCandidate.submissionErrors.length : 0;
        let desc = 'Candidate added successfully.';
        if (subCount > 0) desc += ` ${subCount} submission(s) saved.`;
        if (subErrCount > 0) desc += ` ${subErrCount} submission(s) failed.`;
        toast({ title: 'Success', description: desc });
      }

      await fetchData();
      setIsDialogOpen(false);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('e11000')) {
        setErrors((prev) => ({ ...prev, email: 'A candidate with this email already exists in the database.' }));
        toast({ title: 'Duplicate Email', description: 'This email is already registered to another candidate.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;
    try {
      await fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers: getAuthHeader() });
      toast({ title: 'Deleted', description: 'Candidate removed' });
      setCandidates(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    const headers = getAuthHeader();
    const res = await fetch(`${API_URL}/submissions/${submissionId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete submission');
    }
    toast({ title: 'Submission removed', description: 'The client/job submission was deleted.' });
  };

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

    setFormData({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      contact: c.contact || '',
      alternateNumber: c.alternateNumber || '',
      email: c.email || '',
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
      currentLocation: c.currentLocation || '',
      preferredLocation: c.preferredLocation || '',
      position: c.position || '',
      positionOther: '',
      client: c.client || '',
      currentCompany: c.currentCompany || '',
      totalExperience: c.totalExperience || '',
      relevantExperience: c.relevantExperience || '',
      education: c.education || '',
      ctc: c.ctc || '',
      currentTakeHome: c.currentTakeHome || '',
      ectc: c.ectc || '',
      expectedTakeHome: c.expectedTakeHome || '',
      noticePeriod: c.noticePeriod || '',
      servingNoticePeriod: c.servingNoticePeriod ? 'true' : 'false',
      lwd: c.lwd ? new Date(c.lwd).toISOString().split('T')[0] : '',
      reasonForChange: c.reasonForChange || '',
      offersInHand: c.offersInHand ? 'true' : 'false',
      offerPackage: c.offerPackage || '',
      source: c.source || 'Portal',
      status: Array.isArray(c.status) ? c.status : [c.status || 'Submitted'],
      recruiterId: typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId || '',
      skills: normalizeSkills(c.skills),
      remarks: c.remarks || '',
      dateAdded: c.dateAdded ? new Date(c.dateAdded).toISOString().split('T')[0] : '',
      customFields: c.customFields || {},
      submissions: [],
    });
    setErrors({});
    setIsDialogOpen(true);

    setIsLoadingSubmissions(true);
    const headers = getAuthHeader();
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
      .finally(() => setIsLoadingSubmissions(false));
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ field }) => {
    if (!sortConfig || sortConfig.key !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-blue-500" /> : <ArrowDown className="h-3 w-3 ml-1 text-blue-500" />;
  };

  const filteredCandidates = useMemo(() => {
    let result = candidates.filter((c) => {
      const matchSearch = candidateMatchesKeywordBadges(c, searchKeywords);

      const statusArr = getCandidateStatuses(c);
      const matchStatus = statusFilter === 'all' || statusArr.includes(statusFilter);

      const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
      const matchRec = recruiterFilter === 'all' || recId === recruiterFilter;

      const matchClient = candidateMatchesClient(c, clientFilter);

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
  }, [candidates, searchKeywords, statusFilter, recruiterFilter, clientFilter, activeStatFilter, sortConfig]);

  const stats = useMemo(() => {
    const count = (s) => candidates.filter((c) => getCandidateStatuses(c).includes(s)).length;
    const todayDate = getSafeDate(new Date());
    const todayCount = candidates.filter(c => {
      const d = c.dateAdded || c.createdAt;
      return getSafeDate(d) === todayDate;
    }).length;

    return {
      total: candidates.length, turnups: count('Turnups'), noShow: count('No Show'), yetToAttend: count('Yet to attend'),
      selected: count('Selected'), rejected: count('Rejected'), hold: count('Hold'), pipeline: count('Pipeline'),
      joined: count('Joined'), backout: count('Backout'), sharedProfiles: count('Shared Profiles'),
      todaySubmissions: todayCount,
    };
  }, [candidates]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE);
  const paginatedCandidates = filteredCandidates.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const visibleCandidateIds = paginatedCandidates.map((candidate) => candidate._id);
  const allVisibleCandidatesSelected = visibleCandidateIds.length > 0
    && visibleCandidateIds.every((candidateId) => selectedIds.includes(candidateId));
  const selectedCandidateRecords = useMemo(() => {
    const candidatesById = new Map(candidates.map((candidate) => [String(candidate._id), candidate]));
    return selectedIds.map((candidateId) => candidatesById.get(String(candidateId))).filter(Boolean);
  }, [candidates, selectedIds]);
  const selectedInvalidEmailCount = selectedCandidateRecords.filter((candidate) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(candidate.email || '').trim())).length;

  const candidateExportColumns = useMemo(() => [
    { key: 'candidateId', label: 'Candidate ID', value: c => c.candidateId || c._id?.slice(-6).toUpperCase() || '' },
    { key: 'firstName', label: 'First Name', value: c => c.firstName || '' },
    { key: 'lastName', label: 'Last Name', value: c => c.lastName || '' },
    { key: 'fullName', label: 'Full Name', value: c => c.name || '' },
    {
      key: 'recruiter',
      label: 'Recruiter',
      value: c => typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '',
    },
    { key: 'email', label: 'Email', value: c => c.email || '' },
    { key: 'contact', label: 'Contact', value: c => c.contact || '' },
    { key: 'status', label: 'Status', value: c => Array.isArray(c.status) ? c.status.join(' | ') : (c.status || '') },
    { key: 'currentLocation', label: 'Current Location', value: c => c.currentLocation || '' },
    { key: 'preferredLocation', label: 'Preferred Location', value: c => c.preferredLocation || '' },
    { key: 'totalExperience', label: 'Total Experience', value: c => c.totalExperience || '' },
    { key: 'relevantExperience', label: 'Relevant Experience', value: c => c.relevantExperience || '' },
    { key: 'education', label: 'Qualification', value: c => c.education || '' },
    { key: 'currentCompany', label: 'Current Company', value: c => c.currentCompany || '' },
    { key: 'reasonForChange', label: 'Reason For Change', value: c => c.reasonForChange || '' },
    { key: 'ctc', label: 'Current CTC', value: c => c.ctc || '' },
    { key: 'currentTakeHome', label: 'Current Take Home', value: c => c.currentTakeHome || '' },
    { key: 'ectc', label: 'Expected CTC', value: c => c.ectc || '' },
    { key: 'expectedTakeHome', label: 'Expected Take Home', value: c => c.expectedTakeHome || '' },
    { key: 'noticePeriod', label: 'Notice Period', value: c => c.noticePeriod || '' },
    { key: 'servingNoticePeriod', label: 'Serving Notice', value: c => c.servingNoticePeriod ? 'Yes' : 'No' },
    { key: 'lwd', label: 'LWD', value: c => c.lwd ? new Date(c.lwd).toLocaleDateString('en-GB') : '' },
    { key: 'offersInHand', label: 'Offers In Hand', value: c => c.offersInHand ? 'Yes' : 'No' },
    { key: 'offerPackage', label: 'Offer Package', value: c => c.offerPackage || '' },
    { key: 'source', label: 'Source', value: c => c.source || '' },
    { key: 'skills', label: 'Skills', value: c => Array.isArray(c.skills) ? c.skills.join(' | ') : (c.skills || '') },
    { key: 'dateAdded', label: 'Date Added', value: c => (c.dateAdded || c.createdAt) ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB') : '' },
  ], []);

  const handleExportExcel = () => {
    if (filteredCandidates.length === 0) {
      toast({ title: 'No Data', description: 'No candidates available to export.', variant: 'destructive' });
      return;
    }
    setIsExportDialogOpen(true);
  };

  const handleSelectAll = (e) => {
    const visibleSet = new Set(visibleCandidateIds);
    if (e.target.checked) {
      setSelectedIds(prev => [...new Set([...prev, ...visibleCandidateIds])]);
    } else {
      setSelectedIds(prev => prev.filter(id => !visibleSet.has(id)));
    }
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkRecruiterId) {
      toast({ title: 'Error', description: 'Please select a recruiter first', variant: 'destructive' });
      return;
    }
    setIsBulkAssigning(true);
    try {
      const res = await fetch(`${API_URL}/candidates/bulk-assign`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({
          candidateIds: selectedIds,
          recruiterId: bulkRecruiterId
        })
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      toast({ title: 'Success', description: data.message || `Successfully assigned ${selectedIds.length} candidates` });
      setCandidates(prev => prev.map(c =>
        selectedIds.includes(c._id) ? { ...c, recruiterId: bulkRecruiterId } : c
      ));
      setSelectedIds([]);
      setBulkRecruiterId('');
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to assign candidates', variant: 'destructive' });
    } finally {
      setIsBulkAssigning(false);
    }
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

  const handleWhatsApp = (c) => {
    if (!c.contact) return;
    let phone = c.contact.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const msg = `Hi ${c.firstName || c.name.split(' ')[0]}, regarding your application for ${c.position} at ${c.client}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const renderMatchingJobsModal = () => {
    if (!matchingJobsCandidate) return null;

    return (
      <ModalPortal>
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-955/60 backdrop-blur-sm" onClick={() => setMatchingJobsCandidate(null)} />
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
                                <span className="text-slate-350">•</span>
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
                                <button
                                  onClick={() => setViewingJobDetails(job)}
                                  className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition"
                                  title="View Job Details"
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => {
                                    const candidate = matchingJobsCandidate;
                                    setMatchingJobsCandidate(null);
                                    openEditDialog(candidate);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition text-white"
                                >
                                  Submit
                                </button>
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
              <button
                onClick={() => setMatchingJobsCandidate(null)}
                className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    );
  };

  return (
    <div className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 pb-48 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="w-full max-w-full mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Candidate Database</h1>
            <p className="text-slate-500 mt-1">Manage and track pipeline across all sources</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition shadow-sm">
              <Download className="h-4 w-4" /> Export Excel
            </button>
            <button onClick={openAddDialog} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
              <Plus className="h-4 w-4" /> Add Candidate
            </button>
            <button onClick={() => setIsImportDialogOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-green-500 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition shadow-sm">
              <FileSpreadsheet className="h-4 w-4" /> Import Bulk Candidates
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Overall Candidates" value={stats.total} colorTheme="overall" hasDot={true} active={activeStatFilter === null} onClick={() => { setActiveStatFilter(null); setStatusFilter('all'); }} />
          <StatCard title="Turnups" value={stats.turnups} colorTheme="turnups" active={activeStatFilter === 'Turnups'} onClick={() => { setActiveStatFilter('Turnups'); setStatusFilter('all'); }} />
          <StatCard title="No Show" value={stats.noShow} colorTheme="noshow" active={activeStatFilter === 'No Show'} onClick={() => { setActiveStatFilter('No Show'); setStatusFilter('all'); }} />
          <StatCard title="Yet to attend" value={stats.yetToAttend} colorTheme="yetToAttend" active={activeStatFilter === 'Yet to attend'} onClick={() => { setActiveStatFilter('Yet to attend'); setStatusFilter('all'); }} />
          <StatCard title="Selected" value={stats.selected} colorTheme="selected" active={activeStatFilter === 'Selected'} onClick={() => { setActiveStatFilter('Selected'); setStatusFilter('all'); }} />
          <StatCard title="Rejected" value={stats.rejected} colorTheme="rejected" active={activeStatFilter === 'Rejected'} onClick={() => { setActiveStatFilter('Rejected'); setStatusFilter('all'); }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-2">
          <StatCard title="Hold" value={stats.hold} colorTheme="hold" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} />
          <StatCard title="Pipeline" value={stats.pipeline} colorTheme="pipeline" active={activeStatFilter === 'Pipeline'} onClick={() => { setActiveStatFilter('Pipeline'); setStatusFilter('all'); }} />
          <StatCard title="Joined" value={stats.joined} colorTheme="joined" active={activeStatFilter === 'Joined'} onClick={() => { setActiveStatFilter('Joined'); setStatusFilter('all'); }} />
          <StatCard title="Backout" value={stats.backout} colorTheme="backout" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} />
          <StatCard title="Shared Profiles" value={stats.sharedProfiles} colorTheme="shared" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} />
          <StatCard title="Today Submissions" value={stats.todaySubmissions} colorTheme="today" active={false} onClick={() => setIsTodaySubOpen(true)} />
        </div>

        {/* Filters */}
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white shadow-sm flex flex-col md:flex-row gap-4 justify-between">
          <div className="w-full md:max-w-2xl">
            <CandidateKeywordSearch
              input={searchInput}
              keywords={searchKeywords}
              onInputChange={setSearchInput}
              onKeywordsChange={setSearchKeywords}
            />
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

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-4 flex-wrap animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-semibold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">
              {selectedIds.length} Selected
            </span>
            <button
              onClick={() => setIsJobInviteOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              <Mail className="h-4 w-4" />
              Send Job Invite ({selectedIds.length})
            </button>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <select
                value={bulkRecruiterId}
                onChange={(e) => setBulkRecruiterId(e.target.value)}
                className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]"
              >
                <option value="">Assign to User...</option>
                {recruiters.map((r) => (
                  <option key={r._id || r.id} value={r._id || r.id}>
                    {getRecruiterLabel(r)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkRecruiterId || isBulkAssigning}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isBulkAssigning && <Loader2 className="h-3 w-3 animate-spin" />}
                Assign Candidates
              </button>
            </div>
            {selectedInvalidEmailCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                {selectedInvalidEmailCount} selected candidate(s) will be skipped because email is unavailable.
              </div>
            )}
            <button
              onClick={() => setSelectedIds([])}
              className="ml-auto text-sm text-slate-500 hover:text-slate-800 font-medium px-2 py-1"
            >
              Clear Selection
            </button>
          </div>
        )}

        <style>{`
          .tbl-scroll::-webkit-scrollbar { height: 10px; }
          .tbl-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 10px; }
          .tbl-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; border: 2px solid #e2e8f0; }
          .tbl-scroll::-webkit-scrollbar-thumb:hover { background: #1e293b; }
          .tbl-scroll { scrollbar-width: thin; scrollbar-color: #475569 #e2e8f0; }
        `}</style>

        <div className="w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white flex flex-col">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : (
            <>
              {/* TOP SCROLLBAR */}
              <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="tbl-scroll rounded-t-xl bg-slate-100 border-b border-slate-200 w-full"
                style={{ overflowX: 'auto', overflowY: 'hidden', height: '18px' }}
              >
                <div style={{ width: '1700px', height: '1px' }}></div>
              </div>

              {/* TABLE CONTAINER */}
              <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="tbl-scroll w-full hidden md:block" style={{ overflowX: 'auto' }}>
                <table className="w-full text-sm text-left border-collapse min-w-[1700px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={allVisibleCandidatesSelected}
                          onChange={handleSelectAll}
                          title="Select all visible candidates"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('candidateId')}>ID <SortIcon field="candidateId" /></th>
                      <th className="px-4 py-3 whitespace-nowrap">Matching Jobs</th>
                      <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('name')}>Candidate Name <SortIcon field="name" /></th>
                      <th className="px-4 py-3 whitespace-nowrap text-blue-600 font-bold">Recruiter</th>
                      <th className="px-4 py-3 whitespace-nowrap">Client</th>
                      <th className="px-4 py-3 whitespace-nowrap">Skills</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date Added</th>
                      <th className="px-4 py-3 whitespace-nowrap">Experience</th>
                      <th className="px-4 py-3 whitespace-nowrap">CTC / ECTC</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedCandidates.map((c) => {
                      const statusArr = getCandidateStatuses(c);
                      const isSelected = selectedIds.includes(c._id);
                      return (
                        <tr key={c._id} className={`transition-colors ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectOne(e, c._id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold cursor-pointer whitespace-nowrap" onClick={() => { navigator.clipboard.writeText(getCandidateId(c)); toast({ title: "Copied ID" }); }}>{getCandidateId(c)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
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
                          <td className="px-4 py-3 whitespace-nowrap">
                            <CandidateProfileLink candidate={c} className="text-slate-900">{c.name}</CandidateProfileLink>
                            <div className="mt-0.5 text-xs font-medium text-slate-400">{c.position || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-[#283086] font-bold whitespace-nowrap italic">
                            <RecruiterDetailsTrigger recruiter={getCandidateRecruiterDetails(c, recruiters)} className="text-[#283086] font-bold italic">
                              {typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '-'}
                            </RecruiterDetailsTrigger>
                          </td>
                          <td className="px-4 py-3">
                            <CandidateClientCell candidate={c} onShowMore={setClientPopoverCandidate} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate" title={Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}>
                            {!c.skills ? 'N/A' : Array.isArray(c.skills) ? c.skills.slice(0, 3).join(', ') + (c.skills.length > 3 ? '...' : '') : c.skills.length > 50 ? c.skills.substring(0, 50) + '...' : c.skills}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-GB') : (c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '-')}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">{c.totalExperience ? `${c.totalExperience} Yrs` : '-'}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap"><div>{c.ctc || '-'}</div><div className="text-green-600">{c.ectc || '-'}</div></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5 min-w-[140px] max-w-[240px]">
                              {statusArr.map((s) => (
                                <StatusBadge key={s} status={s} />
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex justify-end items-center gap-2">
                              <Eye className="h-4 w-4 text-blue-600 cursor-pointer" onClick={() => { setViewCandidate(c); setIsViewDialogOpen(true); }} />
                              <Edit className="h-4 w-4 text-slate-600 cursor-pointer" onClick={() => openEditDialog(c)} />
                              <Trash2 className="h-4 w-4 text-red-500 cursor-pointer" onClick={() => handleDelete(c._id)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredCandidates.length === 0 && !loading && (
                  <div className="text-center py-12 text-slate-500">No candidates match your search filters.</div>
                )}
              </div>

              {/* Mobile Card List */}
              <div className="block md:hidden space-y-4 p-4 bg-transparent">
                {paginatedCandidates.map((c) => {
                  const statusArr = getCandidateStatuses(c);
                  const isSelected = selectedIds.includes(c._id);
                  return (
                    <div key={c._id} className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow ${isSelected ? 'bg-blue-50/20 border-blue-200' : ''}`}>
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={(e) => handleSelectOne(e, c._id)} 
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                          />
                          <span 
                            onClick={() => { navigator.clipboard.writeText(getCandidateId(c)); toast({ title: "Copied ID" }); }}
                            className="font-mono text-xs text-blue-600 font-bold cursor-pointer"
                          >
                            {getCandidateId(c)}
                          </span>
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
                        <div className="flex items-center gap-1">
                          <button className="p-1 hover:bg-slate-100 rounded text-blue-600" onClick={() => { setViewCandidate(c); setIsViewDialogOpen(true); }}><Eye className="h-4 w-4" /></button>
                          <button className="p-1 hover:bg-slate-100 rounded text-slate-600" onClick={() => openEditDialog(c)}><Edit className="h-4 w-4 text-slate-600" /></button>
                          <button className="p-1 hover:bg-slate-100 rounded text-red-600" onClick={() => handleDelete(c._id)}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>

                      <div>
                        <CandidateProfileLink candidate={c} className="font-bold text-slate-900 text-base">{c.name}</CandidateProfileLink>
                        <div className="text-xs font-medium text-slate-500 mt-0.5">{c.position || 'No Position'}</div>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center justify-between">
                        <div className="text-xs text-slate-500 font-medium">
                          Recruiter: <RecruiterDetailsTrigger recruiter={getCandidateRecruiterDetails(c, recruiters)} className="text-[#283086] font-bold italic underline">
                            {typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '-'}
                          </RecruiterDetailsTrigger>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {statusArr.map((s) => (
                            <StatusBadge key={s} status={s} />
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                        <div>
                          <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px] mb-0.5">Contact</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{c.contact}</span>
                            <button className="text-green-600 hover:text-green-700" onClick={() => handleWhatsApp(c)}>
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px] mb-0.5">Experience</span>
                          <span>{c.totalExperience ? `${c.totalExperience} Yrs` : 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px] mb-0.5">Client</span>
                          <CandidateClientCell candidate={c} onShowMore={setClientPopoverCandidate} />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px] mb-0.5">CTC / ECTC</span>
                          <span>{c.ctc || '-'} / <span className="text-green-600 font-medium">{c.ectc || '-'}</span></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* --- PAGINATION CONTROLS --- */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 bg-white gap-4">
                  <span className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredCandidates.length)} of {filteredCandidates.length} entries
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
      </div>

      {clientPopoverCandidate && (
        <ClientSubmissionsModal
          candidate={clientPopoverCandidate}
          jobs={jobs}
          onClose={() => setClientPopoverCandidate(null)}
        />
      )}

      {isDialogOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDialogOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Candidate' : 'Add New Candidate'}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Fill out all the details required for the candidate profile.</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditMode && (
                  <button onClick={() => setCandidateFormControlOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">
                    <SlidersHorizontal className="h-4 w-4" /> Form Control
                  </button>
                )}
                <button onClick={() => setIsDialogOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2">×</button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-100/60 pb-48">
              {resumeSuccess.show && (
                <div style={{
                  background: 'linear-gradient(to right, #f0fdf4, #ecfdf5, #f0fdf4)',
                  border: '1.5px solid #86efac',
                  borderRadius: '12px',
                  boxShadow: '0 4px 24px rgba(34,197,94,0.13)',
                  overflow: 'hidden',
                  animation: 'resumeSlideIn 0.35s cubic-bezier(0.16,1,0.3,1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px' }}>
                    <div style={{
                      flexShrink: 0, width: '40px', height: '40px', borderRadius: '50%',
                      background: '#dcfce7', border: '2px solid #86efac',
                      display: 'flex', alignItems: 'center', justifycontent: 'center'
                    }}>
                      <CheckCircle2 style={{ width: '20px', height: '20px', color: '#16a34a' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <Sparkles style={{ width: '14px', height: '14px', color: '#22c55e' }} />
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#14532d', margin: 0 }}>
                          Resume Extracted Successfully!
                        </p>
                      </div>
                      <p style={{ fontSize: '12px', color: '#15803d', margin: '3px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {resumeSuccess.fileName}
                        </span>
                      </p>
                      {resumeSuccess.fieldsCount > 0 && (
                        <p style={{ fontSize: '12px', color: '#16a34a', margin: '5px 0 0 0' }}>
                          ✓ {resumeSuccess.fieldsCount} field{resumeSuccess.fieldsCount !== 1 ? 's' : ''} auto-filled — please review and complete any missing details.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setResumeSuccess(s => ({ ...s, show: false }))}
                      style={{
                        flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px', borderRadius: '6px', color: '#4ade80', lineHeight: 1
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#bbf7d0'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <X style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                  <div style={{ height: '3px', background: '#bbf7d0' }}>
                    <div style={{
                      height: '100%', background: '#22c55e',
                      animation: 'resumeBarShrink 5s linear forwards'
                    }} />
                  </div>
                </div>
              )}

              <style>{`
                @keyframes resumeSlideIn {
                  from { opacity: 0; transform: translateY(-12px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes resumeBarShrink {
                  from { width: 100%; }
                  to   { width: 0%; }
                }
              `}</style>

              {!isEditMode && (
                <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Upload Resume (Auto Fill)</h3>
                  <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors">
                    {isParsingResume ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                        <p className="text-sm text-blue-800 font-medium">Parsing resume details...</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white p-3 rounded-full mb-3 shadow-sm border border-blue-100">
                          <Plus className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-sm text-slate-600 mb-4 text-center">
                          Upload a CV to automatically fill candidate details.<br />
                          <span className="text-xs text-slate-400">Supported: PDF, DOC, DOCX (Max 5MB)</span>
                        </p>
                        <input
                          type="file"
                          id="resume-upload"
                          className="hidden"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleResumeUpload}
                        />
                        <label
                          htmlFor="resume-upload"
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer transition shadow-sm"
                        >
                          Browse Files
                        </label>
                      </>
                    )}
                  </div>
                </section>
              )}

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                      <input
                        type="text"
                        value={formData.contact}
                        onChange={(e) => handleInputChange('contact', e.target.value)}
                        onBlur={(e) => checkPhoneDuplicate(e.target.value)}
                        className={inputCls(errors.contact)}
                      />
                      {isCheckingPhone && (
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                        </span>
                      )}
                    </div>
                    {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
                  </div>
                  {isCandidateFieldVisible('alternateNumber') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Alternate Number</label>
                    <input type="text" value={formData.alternateNumber} onChange={(e) => handleInputChange('alternateNumber', e.target.value)} className={inputCls(errors.alternateNumber)} placeholder="e.g. 9876543210" />
                    {errors.alternateNumber && <p className="text-xs text-red-500 mt-1">{errors.alternateNumber}</p>}
                  </div>}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Email Address *</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        onBlur={(e) => checkEmailDuplicate(e.target.value)}
                        className={inputCls(errors.email)}
                      />
                      {isCheckingEmail && (
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                        </span>
                      )}
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  {isCandidateFieldVisible('currentLocation') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Current Location</label>
                    <input type="text" value={formData.currentLocation} onChange={(e) => handleInputChange('currentLocation', e.target.value)} className={inputCls(false)} />
                  </div>}
                  {isCandidateFieldVisible('preferredLocation') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Preferred Location</label>
                    <input type="text" value={formData.preferredLocation} onChange={(e) => handleInputChange('preferredLocation', e.target.value)} className={inputCls(false)} />
                  </div>}
                  {isCandidateFieldVisible('dateOfBirth') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      max={new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]}
                      className={inputCls(errors.dateOfBirth)}
                    />
                    {errors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth}</p>}
                  </div>}
                  {isCandidateFieldVisible('dateAdded') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Date Added</label>
                    <input
                      type="date"
                      value={formData.dateAdded}
                      onChange={(e) => handleInputChange('dateAdded', e.target.value)}
                      max={todayStr}
                      className={inputCls(errors.dateAdded)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Cannot be a future date. Defaults to today.</p>
                    {errors.dateAdded && <p className="text-xs text-red-500 mt-1">{errors.dateAdded}</p>}
                  </div>}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Professional Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Current Role *</label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      className={inputCls(errors.position)}
                      placeholder="e.g. React Developer"
                    />
                    {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
                  </div>
                  {isCandidateFieldVisible('currentCompany') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Current Company</label>
                    <input type="text" value={formData.currentCompany} onChange={(e) => handleInputChange('currentCompany', e.target.value)} className={inputCls(false)} />
                  </div>}
                  {isCandidateFieldVisible('reasonForChange') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Reason for Change</label>
                    <input type="text" value={formData.reasonForChange} onChange={(e) => handleInputChange('reasonForChange', e.target.value)} className={inputCls(false)} />
                  </div>}
                  {isCandidateFieldVisible('totalExperience') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Total Experience (Years)</label>
                    <input type="text" value={formData.totalExperience} onChange={(e) => handleInputChange('totalExperience', e.target.value)} className={inputCls(errors.totalExperience)} placeholder="e.g. 5" />
                    {errors.totalExperience && <p className="text-xs text-red-500 mt-1">{errors.totalExperience}</p>}
                  </div>}
                  {isCandidateFieldVisible('relevantExperience') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Relevant Experience (Years)</label>
                    <input type="text" value={formData.relevantExperience} onChange={(e) => handleInputChange('relevantExperience', e.target.value)} className={inputCls(errors.relevantExperience)} placeholder="e.g. 3" />
                    {errors.relevantExperience && <p className="text-xs text-red-500 mt-1">{errors.relevantExperience}</p>}
                  </div>}
                  {isCandidateFieldVisible('skills') && <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Skills *</label>
                    <SkillsBadgeInput value={formData.skills} onChange={(skills) => handleInputChange('skills', skills)} error={errors.skills} />
                    {errors.skills && <p className="text-xs text-red-500 mt-1">{errors.skills}</p>}
                  </div>}
                  <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50/40 p-5">
                    <ClientJobSubmissions
                      submissions={formData.submissions || []}
                      clients={clients}
                      jobs={jobs}
                      onChange={(rows) => handleInputChange('submissions', rows)}
                      errors={errors}
                      isEditMode={isEditMode}
                      onDeleteExisting={handleDeleteSubmission}
                    />
                    {isLoadingSubmissions && (
                      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading existing submissions...
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {isCandidateFieldVisible('education') && (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" /> Education & Qualification
                  </h3>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Qualification</label>
                    <input
                      type="text"
                      value={formData.education}
                      onChange={(e) => handleInputChange('education', e.target.value)}
                      className={inputCls(errors.education)}
                      placeholder="e.g. B.Tech from IIT Delhi"
                    />
                    {errors.education && <p className="text-xs text-red-500 mt-1">{errors.education}</p>}
                  </div>
                </section>
              )}

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Financial & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(isCandidateFieldVisible('ctc') || isCandidateFieldVisible('currentTakeHome')) && <div className="flex flex-col sm:flex-row gap-2">
                    {isCandidateFieldVisible('ctc') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Current CTC</label>
                        <input type="text" value={formData.ctc} onChange={(e) => handleInputChange('ctc', e.target.value)} className={inputCls(false)} placeholder="e.g. 10 LPA" />
                      </div>
                    )}
                    {isCandidateFieldVisible('currentTakeHome') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Current Take Home</label>
                        <input type="text" value={formData.currentTakeHome} onChange={(e) => handleInputChange('currentTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 60k/mo" />
                      </div>
                    )}
                  </div>}

                  {(isCandidateFieldVisible('ectc') || isCandidateFieldVisible('expectedTakeHome')) && <div className="flex flex-col sm:flex-row gap-2">
                    {isCandidateFieldVisible('ectc') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Expected CTC</label>
                        <input type="text" value={formData.ectc} onChange={(e) => handleInputChange('ectc', e.target.value)} className={inputCls(false)} placeholder="e.g. 15 LPA" />
                      </div>
                    )}
                    {isCandidateFieldVisible('expectedTakeHome') && (
                      <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Expected Take Home</label>
                        <input type="text" value={formData.expectedTakeHome} onChange={(e) => handleInputChange('expectedTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 90k/mo" />
                      </div>
                    )}
                  </div>}

                  {isCandidateFieldVisible('noticePeriod') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Notice Period (N/P)</label>
                    <input type="text" value={formData.noticePeriod} onChange={(e) => handleInputChange('noticePeriod', e.target.value)} className={inputCls(false)} placeholder="e.g. 30 Days" />
                  </div>}
                  {isCandidateFieldVisible('servingNoticePeriod') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Serving Notice Period?</label>
                    <select value={formData.servingNoticePeriod} onChange={(e) => handleInputChange('servingNoticePeriod', e.target.value)} className={inputCls(false)}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>}

                  {formData.servingNoticePeriod === 'true' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">LWD (Last Working Day) *</label>
                      <input type="date" value={formData.lwd} onChange={(e) => handleInputChange('lwd', e.target.value)} className={inputCls(errors.lwd)} />
                      {errors.lwd && <p className="text-xs text-red-500 mt-1">{errors.lwd}</p>}
                    </div>
                  )}

                  {isCandidateFieldVisible('offersInHand') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Offer in Hand?</label>
                    <select value={formData.offersInHand} onChange={(e) => handleInputChange('offersInHand', e.target.value)} className={inputCls(false)}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>}

                  {formData.offersInHand === 'true' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Package in Hand *</label>
                      <input type="text" value={formData.offerPackage} onChange={(e) => handleInputChange('offerPackage', e.target.value)} className={inputCls(errors.offerPackage)} placeholder="e.g. 15 LPA" />
                      {errors.offerPackage && <p className="text-xs text-red-500 mt-1">{errors.offerPackage}</p>}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Tracking &amp; Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isCandidateFieldVisible('source') && <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Source</label>
                    <select value={formData.source} onChange={(e) => handleInputChange('source', e.target.value)} className={inputCls(false)}>
                      {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>}

                  {isCandidateFieldVisible('recruiterId') && <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Assign to User</label>
                    <select value={formData.recruiterId} onChange={(e) => handleInputChange('recruiterId', e.target.value)} className={inputCls(false)}>
                      <option value="">Select User</option>
                      {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
                    </select>
                  </div>}
                  {isCandidateFieldVisible('remarks') && <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Remarks</label>
                    <Textarea value={formData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} className={inputCls(false)} placeholder="Add any comments or remarks here..." rows={3} />
                  </div>}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Additional Fields</p>
                    <h3 className="text-base font-semibold text-slate-900 mt-1">Custom candidate inputs</h3>
                  </div>
                  <button onClick={() => setCandidateFormControlOpen(true)} className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">
                    <SlidersHorizontal className="h-4 w-4" /> Manage Fields
                  </button>
                </div>
                {visibleCustomCandidateFields.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleCustomCandidateFields.map(field => (
                      <div key={field.fieldName} className={field.fieldType === 'textarea' ? 'md:col-span-2' : ''}>
                        <label className="block text-sm font-medium mb-1 text-slate-700">{field.label}</label>
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
              </section>
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsDialogOpen(false)} className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Cancel</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving...' : isEditMode ? 'Update Profile' : 'Save Candidate'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

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
        getHeaders={getAuthHeader}
        onImported={fetchData}
      />

      <CandidateExportModal
        open={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        candidates={filteredCandidates}
        standardColumns={candidateExportColumns}
        customFields={candidateFieldConfig.customFields}
      />

      <JobInvitationModal
        open={isJobInviteOpen}
        onClose={() => setIsJobInviteOpen(false)}
        candidates={selectedCandidateRecords}
        jobs={jobs}
        apiUrl={API_URL}
        authHeaders={getAuthHeader}
        onSent={handleJobInviteResult}
      />

      {isViewDialogOpen && viewCandidate && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsViewDialogOpen(false)} />
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
                <div
                  className="rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-2xl font-black select-none shrink-0 shadow-lg"
                  style={{ width: '72px', height: '72px' }}
                >
                  {(viewCandidate.name || `${viewCandidate.firstName || ''} ${viewCandidate.lastName || ''}`.trim() || 'C')
                    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-black text-white leading-tight truncate">
                    <CandidateProfileLink candidate={viewCandidate} className="text-white hover:text-indigo-100 transition-colors">
                      {viewCandidate.name || `${viewCandidate.firstName || ''} ${viewCandidate.lastName || ''}`.trim()}
                    </CandidateProfileLink>
                  </h2>
                  <p className="text-indigo-200 text-sm font-semibold mt-0.5">
                    {viewCandidate.position || 'Position not set'}{viewCandidate.currentCompany ? ` · ${viewCandidate.currentCompany}` : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-bold text-white">
                      <UserCircle className="w-3 h-3" /> {getCandidateId(viewCandidate)}
                    </span>
                    {viewCandidate.totalExperience && (
                      <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-bold text-white">
                        <Briefcase className="w-3 h-3" /> {viewCandidate.totalExperience} yrs exp
                      </span>
                    )}
                    {viewCandidate.currentLocation && (
                      <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-bold text-white">
                        📍 {viewCandidate.currentLocation}
                      </span>
                    )}
                    {getCandidateStatuses(viewCandidate).slice(0, 3).map(status => (
                      <StatusBadge key={status} status={status} />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 mr-14">
                  {viewCandidate.contact && (
                    <a href={`tel:${viewCandidate.contact}`}
                      className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors" title="Call">
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {viewCandidate.email && (
                    <a href={`mailto:${viewCandidate.email}`}
                      className="p-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors" title="Email">
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                  {viewCandidate.contact && (
                    <button onClick={() => handleWhatsApp(viewCandidate)}
                      className="p-2.5 rounded-xl bg-green-500/80 hover:bg-green-500 text-white border border-green-400/40 transition-colors" title="WhatsApp">
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-50/50 dark:bg-zinc-950/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 p-5 shadow-sm space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <UserCircle className="w-3.5 h-3.5" /> Personal Info
                  </h3>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: 'First Name', value: viewCandidate.firstName },
                      { label: 'Last Name', value: viewCandidate.lastName },
                      { label: 'Email', value: viewCandidate.email, href: `mailto:${viewCandidate.email}` },
                      { label: 'Phone', value: viewCandidate.contact, href: `tel:${viewCandidate.contact}` },
                      { label: 'Alt Contact', value: viewCandidate.alternateNumber },
                      { label: 'Date of Birth', value: viewCandidate.dateOfBirth ? new Date(viewCandidate.dateOfBirth).toLocaleDateString() : null },
                      { label: 'Gender', value: viewCandidate.gender },
                      { label: 'Current Location', value: viewCandidate.currentLocation },
                      { label: 'Preferred Location', value: viewCandidate.preferredLocation },
                    ].map(({ label, value, href }) => value ? (
                      <div key={label}>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</div>
                        {href
                          ? <a href={href} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate block">{value}</a>
                          : <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{value}</div>
                        }
                      </div>
                    ) : null)}
                    {viewCandidate.linkedin && (
                      <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">LinkedIn</div>
                        <a href={viewCandidate.linkedin} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 truncate">
                          <Linkedin className="w-3.5 h-3.5 shrink-0" /> View Profile
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
                      { label: 'Current Role', value: viewCandidate.position },
                      { label: 'Current Company', value: viewCandidate.currentCompany },
                      { label: 'Total Experience', value: viewCandidate.totalExperience ? `${viewCandidate.totalExperience} Yrs` : null },
                      { label: 'Relevant Experience', value: viewCandidate.relevantExperience ? `${viewCandidate.relevantExperience} Yrs` : null },
                      { label: 'Notice Period', value: viewCandidate.noticePeriod },
                      { label: 'Serving Notice?', value: viewCandidate.servingNoticePeriod ? 'Yes' : null },
                      { label: 'Last Working Day', value: viewCandidate.lwd ? new Date(viewCandidate.lwd).toLocaleDateString() : null },
                      { label: 'Offers in Hand', value: viewCandidate.offersInHand ? `Yes${viewCandidate.offerPackage ? ` (${viewCandidate.offerPackage})` : ''}` : null },
                      { label: 'Remarks', value: viewCandidate.remarks },
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
                      { label: 'Current CTC', value: viewCandidate.ctc },
                      { label: 'Expected CTC', value: viewCandidate.ectc },
                      { label: 'Source', value: viewCandidate.source },
                    ].map(({ label, value }) => value ? (
                      <div key={label}>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{value}</div>
                      </div>
                    ) : null)}
                    <div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Assigned Recruiter</div>
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        <RecruiterDetailsTrigger
                          recruiter={getCandidateRecruiterDetails(viewCandidate, recruiters)}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {typeof viewCandidate.recruiterId === 'object'
                            ? getRecruiterName(viewCandidate.recruiterId)
                            : viewCandidate.recruiterName || 'Unassigned'}
                        </RecruiterDetailsTrigger>
                      </div>
                    </div>
                    {viewCandidate.createdAt && (
                      <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Added On</div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {new Date(viewCandidate.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </div>
                      </div>
                    )}
                    {getCandidateStatuses(viewCandidate).length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Pipeline Status</div>
                        <div className="flex flex-wrap gap-1.5">
                          {getCandidateStatuses(viewCandidate).map(status => (
                            <StatusBadge key={status} status={status} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {viewCandidate.skills && viewCandidate.skills.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/60 p-5 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-3">
                    <Award className="w-3.5 h-3.5" /> Skills &amp; Expertise
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(viewCandidate.skills) ? viewCandidate.skills : String(viewCandidate.skills).split(','))
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
                  candidateId={viewCandidate._id}
                  apiUrl={API_URL}
                  authHeaders={getAuthHeader}
                />
              </div>

              {viewCandidate.notes && (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 rounded-2xl p-5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">Notes</h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{viewCandidate.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-zinc-400 font-medium">
                Candidate ID: <span className="font-mono font-bold text-zinc-600 dark:text-zinc-300">{getCandidateId(viewCandidate)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsViewDialogOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewCandidate); }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all"
                >
                  Edit Details
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {renderMatchingJobsModal()}

      {viewingJobDetails && (
        <JobDetailsModal
          job={viewingJobDetails}
          onClose={() => setViewingJobDetails(null)}
        />
      )}

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

// ── Admin Today Submissions Modal ─────────────────────────────────────────────
function AdminTodaySubmissionsModal({ candidates, recruiters, onClose, getCandidateId }) {
  const todayStr = getSafeDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [recruiterFilter, setRecruiterFilter] = useState('all');

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      const d = c.dateAdded || c.createdAt;
      const dateMatch = getSafeDate(d) === selectedDate;
      if (!dateMatch) return false;

      if (recruiterFilter === 'all') return true;
      const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
      return String(recId) === String(recruiterFilter);
    });
  }, [candidates, selectedDate, recruiterFilter]);

  const displayDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const getRecruiterDisplayName = (rec) => {
    if (!rec) return '-';
    if (typeof rec === 'object') return getRecruiterLabel(rec);
    const found = recruiters.find(r => r._id === rec || r.id === rec);
    if (found) return getRecruiterLabel(found);
    return '-';
  };

  const selectedRecruiterName = recruiterFilter === 'all'
    ? 'All Recruiters'
    : getRecruiterDisplayName(recruiterFilter);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Day Submissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Viewing candidates submitted by {recruiterFilter === 'all' ? 'all recruiters' : selectedRecruiterName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={recruiterFilter}
              onChange={e => setRecruiterFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700 min-w-[150px]"
            >
              <option value="all">All Recruiters</option>
              {recruiters.map(r => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {getRecruiterLabel(r)}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={e => setSelectedDate(e.target.value)}
                className="border-none outline-none bg-transparent text-sm text-slate-700 cursor-pointer"
              />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Calendar className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No submissions for {displayDate}</p>
              {recruiterFilter !== 'all' && (
                <p className="text-xs mt-1 text-slate-400">Try selecting "All Recruiters"</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left border-collapse min-w-[800px]">
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
                {filtered.map(c => {
                  const statusArr = Array.isArray(c.status) ? c.status : [c.status || 'Submitted'];
                  return (
                    <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold whitespace-nowrap">
                        {getCandidateId(c)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <CandidateProfileLink candidate={c} className="text-slate-900">{c.name}</CandidateProfileLink>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        <RecruiterDetailsTrigger recruiter={getCandidateRecruiterDetails(c, recruiters)} className="text-slate-600 font-medium">
                          {getRecruiterDisplayName(c.recruiterId)}
                        </RecruiterDetailsTrigger>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.position || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.client || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {statusArr.map(s => (
                            <span
                              key={s}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s === 'Selected' || s === 'Joined'
                                  ? 'bg-green-100 text-green-800'
                                  : s === 'Rejected' || s === 'No Show' || s === 'Backout'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> submission{filtered.length !== 1 ? 's' : ''} for {displayDate}
            {recruiterFilter !== 'all' && <span className="ml-1">· <span className="font-medium text-violet-600">{selectedRecruiterName}</span></span>}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
