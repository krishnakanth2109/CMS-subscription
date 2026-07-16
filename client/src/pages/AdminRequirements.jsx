// --- START OF FILE AdminRequirements.jsx ---
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  X, Eye, Pencil, Plus, CheckCircle, Ban,
  Briefcase, GraduationCap, Building2, Calendar, MapPin, Trash2, SlidersHorizontal, Users, Loader2
} from "lucide-react";
import { RecruiterDetailsTrigger } from "@/components/RecruiterDetailsModal";
import { MatchBreakdownBar, ScoreBadge, SkillChips } from "@/components/Score/ScoreComponents";
import { getMatchingCandidatesByJobId } from "@/utils/candidateMatching";


const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const inputCls = "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-500 bg-white dark:bg-zinc-900 dark:text-zinc-100 placeholder-zinc-400";

const ModalPortal = ({ children }) => {
  if (typeof document === 'undefined') return children;
  return createPortal(children, document.body);
};

const parseMarkdownToHtml = (markdown) => {
  if (!markdown) return "";
  
  const lines = markdown.split('\n');
  let html = [];
  let activeListType = null; // null, 'ul', or 'ol'

  const closeListIfActive = () => {
    if (activeListType === 'ul') {
      html.push("</ul>");
    } else if (activeListType === 'ol') {
      html.push("</ol>");
    }
    activeListType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Check for empty line
    if (line === "") {
      closeListIfActive();
      html.push('<div class="h-2"></div>'); // Spacing for paragraph breaks
      continue;
    }

    // Process inline formatting first (bold, italic)
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-zinc-900 dark:text-zinc-100">$1</strong>');
    line = line.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    line = line.replace(/_(.*?)_/g, '<em class="italic">$1</em>');

    // Headers
    if (line.startsWith("### ")) {
      closeListIfActive();
      html.push(`<h4 class="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2">${line.substring(4)}</h4>`);
    } else if (line.startsWith("## ")) {
      closeListIfActive();
      html.push(`<h3 class="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-5 mb-2">${line.substring(3)}</h3>`);
    } else if (line.startsWith("# ")) {
      closeListIfActive();
      html.push(`<h2 class="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3">${line.substring(2)}</h2>`);
    }
    // Unordered bullet list
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (activeListType !== 'ul') {
        closeListIfActive();
        html.push('<ul class="list-disc pl-5 my-2 space-y-1 text-zinc-700 dark:text-zinc-300">');
        activeListType = 'ul';
      }
      const content = line.substring(2);
      html.push(`<li>${content}</li>`);
    }
    // Ordered numerical list
    else if (/^\d+\.\s/.test(line)) {
      if (activeListType !== 'ol') {
        closeListIfActive();
        html.push('<ol class="list-decimal pl-5 my-2 space-y-1 text-zinc-700 dark:text-zinc-300">');
        activeListType = 'ol';
      }
      const content = line.replace(/^\d+\.\s/, '');
      html.push(`<li>${content}</li>`);
    }
    // Regular paragraph line
    else {
      closeListIfActive();
      html.push(`<p class="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed mb-1">${line}</p>`);
    }
  }

  closeListIfActive();

  return html.join("\n");
};

const getRecruiterDetailsByName = (name, recruiters = []) => {
  const displayName = name || 'Unassigned';
  const found = recruiters.find((recruiter) => recruiter.name === displayName);
  return found || { name: displayName };
};

const DEFAULT_FIELD_CONFIG = [
  { fieldName: 'clientName', label: 'Client Name', fieldType: 'text', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'jobType', label: 'Job Type', fieldType: 'select', isMandatory: true, visible: true, isDefault: true, options: ['Full-Time', 'Internship', 'Contract'] },
  { fieldName: 'location', label: 'Location', fieldType: 'text', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'experience', label: 'Experience', fieldType: 'number', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'relevantExperience', label: 'Relevant Experience', fieldType: 'number', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'qualification', label: 'Qualification', fieldType: 'text', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'salaryBudget', label: 'Salary Budget', fieldType: 'number', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'monthlySalary', label: 'Monthly Salary', fieldType: 'number', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'gender', label: 'Gender', fieldType: 'select', isMandatory: false, visible: true, isDefault: true, options: ['Male', 'Female', 'Any'] },
  { fieldName: 'noticePeriod', label: 'Notice Period', fieldType: 'text', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'tatTime', label: 'TAT Time', fieldType: 'date', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'primaryRecruiter', label: 'Primary Recruiter', fieldType: 'text', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'secondaryRecruiter', label: 'Secondary Recruiter', fieldType: 'text', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'skills', label: 'Mandatory Skills', fieldType: 'textarea', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'mandatorySkills', label: 'Mandatory Skills', fieldType: 'textarea', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'preferredSkills', label: 'Preferred Skills', fieldType: 'textarea', isMandatory: false, visible: true, isDefault: true },
  { fieldName: 'jobDescription', label: 'Job Description', fieldType: 'textarea', isMandatory: false, visible: true, isDefault: true },
];

const REQUIRED_DEFAULT_FIELD_NAMES = new Set(['clientName', 'jobType', 'location', 'experience', 'skills']);

const normalizeFieldConfig = (config = {}) => {
  const storedFields = Array.isArray(config.fields) ? config.fields : [];
  const storedCustomFields = Array.isArray(config.customFields) ? config.customFields : [];

  return {
    fields: DEFAULT_FIELD_CONFIG.map((field) => {
      const stored = storedFields.find((item) => item.fieldName === field.fieldName) || {};
      const isMandatory = REQUIRED_DEFAULT_FIELD_NAMES.has(field.fieldName) || Boolean(stored.isMandatory || field.isMandatory);
      return {
        ...field,
        ...stored,
        ...(field.options ? { options: field.options } : {}),
        isDefault: true,
        isMandatory,
        visible: isMandatory ? true : stored.visible ?? field.visible,
      };
    }),
    customFields: storedCustomFields.map((field) => ({
      ...field,
      isDefault: false,
      isMandatory: Boolean(field.isMandatory),
      visible: field.visible !== false,
    })),
  };
};

const getFieldConfig = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    return normalizeFieldConfig(user?.requirementSettings || { fields: DEFAULT_FIELD_CONFIG, customFields: [] });
  } catch {
    return normalizeFieldConfig({ fields: DEFAULT_FIELD_CONFIG, customFields: [] });
  }
};

const saveFieldConfig = (updated) => {
  try {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    user.requirementSettings = normalizeFieldConfig(updated);
    sessionStorage.setItem('currentUser', JSON.stringify(user));
  } catch (e) {
    console.error('Config save failed', e);
  }
};

const CustomFieldInput = ({ field, value, onChange, className = inputCls, placeholder = "" }) => {
  const handle = (e) => onChange(field.fieldName, e.target.value);

  if (field.fieldType === 'boolean') {
    return (
      <select value={value ?? ''} onChange={handle} className={className}>
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (field.fieldType === 'textarea') {
    return (
      <textarea value={value ?? ''} onChange={handle} rows={3} placeholder={placeholder} className={`${className} resize-none`} />
    );
  }

  if (field.fieldType === 'select') {
    return (
      <select value={value ?? ''} onChange={handle} className={className}>
        <option value="">{field.selectPlaceholder || 'Select'}</option>
        {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }

  const inputType = field.fieldType === 'date' ? 'date' : field.fieldType === 'number' && !field.isDefault ? 'number' : 'text';
  return (
    <input
      type={inputType}
      value={value ?? ''}
      onChange={handle}
      placeholder={placeholder}
      className={className}
    />
  );
};




const FormControlModal = ({ isOpen, onClose, config, onConfigChange }) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingType, setEditingType] = useState(null);
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

  const deleteCustom = (i) => {
    onConfigChange({ ...config, customFields: config.customFields.filter((_, idx) => idx !== i) });
  };

  const addCustomField = () => {
    if (!newField.label.trim()) return;

    const baseName = newField.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_field';
    const existingNames = new Set([...config.fields, ...config.customFields].map((field) => field.fieldName));
    let fieldName = baseName;
    let suffix = 2;
    while (existingNames.has(fieldName)) {
      fieldName = `${baseName}_${suffix}`;
      suffix += 1;
    }

    const entry = {
      fieldName,
      label: newField.label.trim(),
      fieldType: newField.fieldType,
      isDefault: false,
      isMandatory: false,
      visible: true,
      ...(newField.fieldType === 'select' && {
        options: newField.options.split(',').map((option) => option.trim()).filter(Boolean),
      }),
    };

    onConfigChange({ ...config, customFields: [...config.customFields, entry] });
    setNewField({ label: '', fieldType: 'text', options: '' });
  };

  const visibleDefaultCount = config.fields.filter(field => field.visible).length;
  const visibleCustomCount = config.customFields.filter(field => field.visible).length;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-slate-50 dark:bg-zinc-950 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto lg:overflow-hidden border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-zinc-900 px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Form Control</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">Configure requirement fields and add custom inputs.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {visibleDefaultCount} default active
              </span>
              <span className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {visibleCustomCount} custom active
              </span>
              <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] lg:h-[calc(92vh-82px)] h-auto min-h-0 lg:overflow-hidden">
          <aside className="bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-5 min-h-0 lg:overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">Add Custom Field</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Field Label</label>
                <input
                  placeholder="Example: Work Mode"
                  value={newField.label}
                  onChange={(e) => setNewField((prev) => ({ ...prev, label: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Field Type</label>
                <select
                  value={newField.fieldType}
                  onChange={(e) => setNewField((prev) => ({ ...prev, fieldType: e.target.value }))}
                  className={inputCls}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Yes/No</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Select</option>
                </select>
              </div>
              {newField.fieldType === 'select' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Options</label>
                  <input
                    placeholder="Remote, Hybrid, On-site"
                    value={newField.options}
                    onChange={(e) => setNewField((prev) => ({ ...prev, options: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              )}
              <button
                onClick={addCustomField}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Field
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Additional fields</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">New fields appear in their own section in the requirement form.</p>
            </div>
          </aside>

          <div className="p-5 min-h-0 lg:overflow-y-auto overflow-visible">
            <div className="grid md:grid-cols-2 gap-5 md:h-full md:min-h-0">
              <section className="space-y-3 md:min-h-0 md:flex md:flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Standard Fields</p>
                  <span className="text-xs text-zinc-400">{config.fields.length} fields</span>
                </div>
                <div className="space-y-2 md:min-h-0 md:overflow-y-auto md:pr-1">
                  {config.fields.map((field, i) => (
                    <div key={field.fieldName} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={field.isMandatory}
                          onClick={() => toggleDefault(i)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${field.visible ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-700'} disabled:opacity-60`}
                          title={field.isMandatory ? 'Required field' : 'Toggle field visibility'}
                        >
                          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${field.visible ? 'left-6 dark:bg-zinc-900' : 'left-1'}`} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{field.label}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{field.fieldName}</p>
                        </div>
                        <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">{field.fieldType}</span>
                      </div>
                      {field.isMandatory && <p className="text-xs text-red-500 mt-2">Required fields stay visible.</p>}
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3 md:min-h-0 md:flex md:flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Additional Fields</p>
                  <span className="text-xs text-zinc-400">{config.customFields.length} fields</span>
                </div>
                {config.customFields.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No additional fields yet</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Create one from the panel on the left.</p>
                  </div>
                ) : (
                  <div className="space-y-2 md:min-h-0 md:overflow-y-auto md:pr-1">
                    {config.customFields.map((field, i) => (
                      <div key={field.fieldName} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleCustom(i)}
                            className={`relative h-6 w-11 rounded-full transition-colors ${field.visible ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            title="Toggle field visibility"
                          >
                            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${field.visible ? 'left-6 dark:bg-zinc-900' : 'left-1'}`} />
                          </button>
                          <div className="min-w-0 flex-1">
                            {editingIndex === i && editingType === 'custom' ? (
                              <input
                                autoFocus
                                value={field.label}
                                onChange={(e) => editCustomLabel(i, e.target.value)}
                                onBlur={() => { setEditingIndex(null); setEditingType(null); }}
                                className={inputCls}
                              />
                            ) : (
                              <>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{field.label}</p>
                                <p className="text-xs text-zinc-400 mt-0.5">{field.fieldName}</p>
                              </>
                            )}
                          </div>
                          <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">{field.fieldType}</span>
                        </div>
                        <div className="flex justify-end gap-1 mt-3">
                          <button
                            onClick={() => { setEditingIndex(i); setEditingType('custom'); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCustom(i)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
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

/* ---------------- JOB DETAIL MODAL ---------------- */
const formatJobDate = (value, withTime = false) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

const formatJobValue = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '-';
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive';
  if (value == null || value === '') return '-';
  return String(value);
};

const DetailRow = ({ label, value, children }) => (
  <div className="rounded-lg border border-zinc-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
    <div className="mt-1 break-words text-sm font-medium text-zinc-800 dark:text-zinc-100">
      {children || formatJobValue(value)}
    </div>
  </div>
);

const DetailSection = ({ title, icon: Icon, children }) => (
  <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-800/40">
    <h3 className="mb-4 flex items-center gap-2 border-b border-zinc-200 pb-2 text-base font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
      {Icon && <Icon className="h-4 w-4 text-zinc-500" />}
      {title}
    </h3>
    {children}
  </section>
);

const SkillList = ({ value }) => {
  const items = Array.isArray(value)
    ? value.filter(Boolean)
    : String(value || '').split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);

  if (!items.length) return <span>-</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {item}
        </span>
      ))}
    </div>
  );
};

const parseSkillItems = (value) => {
  if (Array.isArray(value)) return value.map(skill => String(skill).trim()).filter(Boolean);
  return String(value || '').split(/[,;|\n]+/).map(skill => skill.trim()).filter(Boolean);
};

const JobDetailCard = ({ job, onClose, recruiters = [] }) => {
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800"
        onClick={e => e.stopPropagation()}
      >
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 text-white p-6 rounded-t-2xl border-b border-zinc-700">
             <div className="flex justify-between items-start gap-4">
                <div>
                   <h2 className="text-2xl font-bold tracking-tight">{job.position}</h2>
                   <div className="flex flex-wrap items-center gap-3 mt-2 text-zinc-300 text-sm">
                     <span className="bg-zinc-800 px-2 py-1 rounded-md border border-zinc-700 text-xs font-mono">
                       {job.jobCode}
                     </span>
                     <span>{job.clientName}</span>
                     <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${job.active !== false ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30' : 'bg-red-500/15 text-red-200 border border-red-400/30'}`}>
                       {job.active !== false ? 'Active' : 'Inactive'}
                     </span>
                   </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white">
                   <X className="w-6 h-6" />
                </button>
             </div>
          </div>

          <div className="p-6 space-y-6 text-zinc-800 dark:text-zinc-300">
             <div className="grid gap-6 lg:grid-cols-2">
                <DetailSection title="Core Details" icon={Briefcase}>
                   <div className="grid gap-3 sm:grid-cols-2">
                     <DetailRow label="Job Code" value={job.jobCode} />
                     <DetailRow label="Status" value={job.active !== false} />
                     <DetailRow label="Client Name" value={job.clientName} />
                     <DetailRow label="Job Type" value={job.jobType} />
                     <DetailRow label="Role / Position" value={job.position} />
                     <DetailRow label="Location" value={job.location} />
                   </div>
                </DetailSection>

                <DetailSection title="Candidate Criteria" icon={GraduationCap}>
                   <div className="grid gap-3 sm:grid-cols-2">
                     <DetailRow label="Experience" value={job.experience ? `${job.experience} Years` : ''} />
                     <DetailRow label="Relevant Experience" value={job.relevantExperience ? `${job.relevantExperience} Years` : ''} />
                     <DetailRow label="Qualification" value={job.qualification} />
                     <DetailRow label="Gender" value={job.gender || 'Any'} />
                     <DetailRow label="Mandatory Skills">
                       <SkillList value={job.mandatorySkills?.length ? job.mandatorySkills : job.skills} />
                     </DetailRow>
                     <DetailRow label="Preferred Skills">
                       <SkillList value={job.preferredSkills} />
                     </DetailRow>
                   </div>
                </DetailSection>

                <DetailSection title="Compensation & Timeline" icon={Calendar}>
                   <div className="grid gap-3 sm:grid-cols-2">
                     <DetailRow label="Salary Budget" value={job.salaryBudget} />
                     <DetailRow label="Monthly Salary" value={job.monthlySalary} />
                     <DetailRow label="Notice Period" value={job.noticePeriod} />
                     <DetailRow label="Expiry / TAT" value={formatJobDate(job.tatTime)} />
                   </div>
                </DetailSection>

                <DetailSection title="Recruiter Assignment" icon={Users}>
                   <div className="grid gap-3 sm:grid-cols-2">
                     <DetailRow label="Primary Recruiter">
                       {job.primaryRecruiter ? (
                         <RecruiterDetailsTrigger recruiter={getRecruiterDetailsByName(job.primaryRecruiter, recruiters)} className="font-medium text-zinc-800 dark:text-zinc-100">
                           {job.primaryRecruiter}
                         </RecruiterDetailsTrigger>
                       ) : 'Unassigned'}
                     </DetailRow>
                     <DetailRow label="Secondary Recruiter">
                       {job.secondaryRecruiter ? (
                         <RecruiterDetailsTrigger recruiter={getRecruiterDetailsByName(job.secondaryRecruiter, recruiters)} className="font-medium text-zinc-800 dark:text-zinc-100">
                           {job.secondaryRecruiter}
                         </RecruiterDetailsTrigger>
                       ) : 'Unassigned'}
                     </DetailRow>
                     <DetailRow label="Created At" value={formatJobDate(job.createdAt, true)} />
                     <DetailRow label="Updated At" value={formatJobDate(job.updatedAt, true)} />
                   </div>
                </DetailSection>
             </div>

             <DetailSection title="Description & Links" icon={Eye}>
               <div className="space-y-4">
                 <DetailRow label="JD Link">
                   {job.jdLink ? (
                     <a href={job.jdLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all dark:text-blue-400">
                       {job.jdLink}
                     </a>
                   ) : '-'}
                 </DetailRow>
                 <DetailRow label="Job Description">
                   {job.jobDescription ? (
                     <div className="max-h-80 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                       <div
                         className="text-sm leading-6 text-zinc-700 dark:text-zinc-300 select-text"
                         dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(job.jobDescription) }}
                       />
                     </div>
                   ) : '-'}
                 </DetailRow>
               </div>
             </DetailSection>
          </div>
      </div>
    </div>
    </ModalPortal>
  );
};

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
            <X className="h-5 w-5" />
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

  const getStatusBadgeClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (['selected', 'joined'].includes(s)) {
      return "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400";
    }
    if (['rejected', 'backout'].includes(s)) {
      return "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400";
    }
    if (['hold'].includes(s)) {
      return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-400";
    }
    return "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-800 dark:text-indigo-400";
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
            <h3 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{job.position}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {job.jobCode} • {job.clientName}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-[260px] overflow-y-auto bg-zinc-50 p-5 dark:bg-zinc-950">
          {loading ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="h-7 w-7 animate-spin" />
              Loading candidates...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
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
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusBadgeClass(item.status)}`}>
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
                        {(score || mode === 'submitted') && (
                          <button
                            type="button"
                            onClick={() => onToggleCandidate(expanded ? null : candidateId)}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            {expanded ? 'Hide Details' : 'Details'}
                          </button>
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

                    {mode === 'submitted' && expanded && (
                      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800 space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          {/* Submission Details */}
                          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Submission Info</h4>
                            
                            <div className="space-y-2 mt-2">
                              <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/50 dark:border-zinc-800/50">
                                <span className="text-zinc-500 font-medium">Recruiter</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.submittedByName || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/50 dark:border-zinc-800/50">
                                <span className="text-zinc-500 font-medium">Submitted Date</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                  {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-zinc-500 font-medium">Current Status</span>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getStatusBadgeClass(item.status)}`}>
                                  {item.status || 'Pipeline'}
                                </span>
                              </div>
                            </div>

                            {item.notes && (
                              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] block mb-1">Recruiter Notes</span>
                                <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs italic text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed shadow-sm">
                                  "{item.notes}"
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Candidate Fast-Facts / Profile */}
                          <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <h4 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Candidate Profile</h4>
                            
                            <div className="space-y-2 mt-2">
                              <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/50 dark:border-zinc-800/50">
                                <span className="text-zinc-500 font-medium">Contact Email</span>
                                <a href={`mailto:${candidate.email}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">{candidate.email || 'N/A'}</a>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/50 dark:border-zinc-800/50">
                                <span className="text-zinc-500 font-medium">Phone / Contact</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{candidate.contact || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/50 dark:border-zinc-800/50">
                                <span className="text-zinc-500 font-medium">Total Experience</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{candidate.totalExperience || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-zinc-500 font-medium">Location</span>
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{candidate.currentLocation || candidate.preferredLocation || 'N/A'}</span>
                              </div>
                            </div>

                            {candidate.skills && (
                              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] block mb-1.5">Candidate Skills</span>
                                <div className="flex flex-wrap gap-1">
                                  {String(candidate.skills).split(',').map((skill, sIdx) => (
                                    <span key={sIdx} className="inline-flex items-center rounded-md bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                      {skill.trim()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
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
      </div>
      <CandidateDetailsModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
    </div>
    </ModalPortal>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */
export default function AdminRequirements() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();

  const getAuthHeader = useCallback(async () => ({
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  }), [authHeaders]);

  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientFilter, setSelectedClientFilter] = useState("");

  const initialFormState = {
    jobCode: "", clientName: "", position: "", location: "",
    experience: "", relevantExperience: "", qualification: "",
    salaryBudget: "", monthlySalary: "", gender: "Any", noticePeriod: "",
    tatTime: "",
    primaryRecruiter: "", secondaryRecruiter: "", skills: "", mandatorySkills: "",
    preferredSkills: "", jobType: "", jobDescription: "", jdLink: "",
    active: true, customFields: {},
  };

  const [form, setForm] = useState(initialFormState);
  const [fieldConfig, setFieldConfig] = useState(getFieldConfig);
  const [formControlOpen, setFormControlOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [jobDescriptionModalOpen, setJobDescriptionModalOpen] = useState(false);
  const [mandatorySkillInput, setMandatorySkillInput] = useState("");
  const [preferredSkillInput, setPreferredSkillInput] = useState("");
  const [isImportingJD, setIsImportingJD] = useState(false);
  const [isGeneratingJD, setIsGeneratingJD] = useState(false);
  const [jdTab, setJdTab] = useState("write");
  const [candidateModalJob, setCandidateModalJob] = useState(null);
  const [candidateModalMode, setCandidateModalMode] = useState('submitted');
  const [jobCandidates, setJobCandidates] = useState([]);
  const [isLoadingJobCandidates, setIsLoadingJobCandidates] = useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = useState(null);
  const pdfInputRef = useRef(null);
  const docxInputRef = useRef(null);

  const handleConfigChange = (updated) => {
    const normalized = normalizeFieldConfig(updated);
    setFieldConfig(normalized);
    saveFieldConfig(normalized);
  };

  const closeRequirementForm = () => {
    setShowForm(false);
    setEditingJob(null);
    setJobDescriptionModalOpen(false);
    setMandatorySkillInput("");
    setPreferredSkillInput("");
    setJdTab("write");
    setErrors({});
    setForm(initialFormState);
  };

  // ─── SCROLLBAR SYNC REFS & LOGIC ───────────────────────────────────────
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [scrollWidth, setScrollWidth] = useState('100%');
  
  const isSyncingTop = useRef(false);
  const isSyncingBottom = useRef(false);

  useEffect(() => {
    const tableEl = tableRef.current;
    if (!tableEl) return;

    const updateWidth = () => {
      setScrollWidth(`${tableEl.scrollWidth}px`);
    };

    const observer = new ResizeObserver(updateWidth);
    observer.observe(tableEl);
    
    updateWidth();

    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [jobs, searchTerm, selectedClientFilter, showForm]);

  const handleTopScroll = (e) => {
    if (isSyncingTop.current) {
      isSyncingTop.current = false;
      return;
    }
    if (bottomScrollRef.current) {
      isSyncingBottom.current = true;
      bottomScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleBottomScroll = (e) => {
    if (isSyncingBottom.current) {
      isSyncingBottom.current = false;
      return;
    }
    if (topScrollRef.current) {
      isSyncingTop.current = true;
      topScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };
  // ───────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const [jobsRes, clientsRes, recRes, candidatesRes] = await Promise.all([
        fetch(`${API_URL}/jobs`,       { headers }),
        fetch(`${API_URL}/clients`,    { headers }),
        fetch(`${API_URL}/recruiters?view=lookup`, { headers }),
        fetch(`${API_URL}/candidates?view=matching&includeSubmissions=true`, { headers })
      ]);

      if(jobsRes.ok) {
        const data = await jobsRes.json();
        const jobsArray = Array.isArray(data) ? data : data.data || [];
        setJobs(jobsArray.map((j) => ({ ...j, id: j._id })));
      }
      if(clientsRes.ok) {
        const data = await clientsRes.json();
        const clientsArray = Array.isArray(data) ? data : data.data || [];
        setClients(clientsArray.map((c) => ({ id: c._id, companyName: c.companyName })));
      }
      if(recRes.ok) {
        const data = await recRes.json();
        const recruitersArray = Array.isArray(data) ? data : data.data || data.recruiters || [];
        setRecruiters(recruitersArray.map((r) => {
          let recName = r.name || r.username || r.fullName || r.email || 'Unnamed Recruiter';
          if (r.firstName && r.lastName) recName = `${r.firstName} ${r.lastName}`;
          return { id: r._id || r.id, name: recName, email: r.email };
        }));
      }
      if(candidatesRes.ok) {
        const data = await candidatesRes.json();
        const candidatesArray = Array.isArray(data) ? data : data.data || [];
        setCandidates(candidatesArray.map((candidate) => ({ ...candidate, id: candidate._id || candidate.id })));
      }
    } catch (error) {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { fetchData(); }, []);

  // ✅ REAL-TIME INPUT RESTRICTION
  const sanitizeRequirementValue = (name, value, type = 'text', checked = false) => {
    let newValue = type === 'checkbox' ? checked : value;

    if (type !== 'checkbox') {
      if (name === 'position') {
        newValue = newValue.replace(/[^a-zA-Z\s]/g, '');
      } else if (name === 'qualification') {
        newValue = newValue.replace(/[^a-zA-Z\s,/]/g, '');
      } else if (name === 'location') {
        newValue = newValue.replace(/[0-9]/g, '');
      } else if (name === 'experience' || name === 'relevantExperience') {
        newValue = newValue.replace(/[^0-9.\- ]/g, '');
      } else if (name === 'jobCode') {
        newValue = newValue.replace(/[^a-zA-Z0-9\-_]/g, '');
      }
    }

    return newValue;
  };

  const updateFormField = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
        setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    updateFormField(name, sanitizeRequirementValue(name, value, type, checked));
  };

  const handleDefaultFieldChange = (fieldName, value) => {
    updateFormField(fieldName, sanitizeRequirementValue(fieldName, value));
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setForm(prev => ({ ...prev, customFields: { ...prev.customFields, [fieldName]: value } }));
  };

  const cleanImportedJDText = (text = "") => (
    String(text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );

  const decodeXmlText = (text = "") => (
    String(text)
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
  );

  const extractPdfJDText = async (file) => {
    const pdfjsLib = await import("pdfjs-dist");
    const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const textItems = content.items
        .map((item) => {
          const str = item.str || "";
          const [, , , height = 10, x = 0, y = 0] = item.transform || [];
          return { str, x, y, height: Math.abs(height) || 10, width: item.width || 0 };
        })
        .filter((item) => item.str.trim());

      const sortedItems = textItems.sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > Math.max(a.height, b.height) * 0.45) return yDiff;
        return a.x - b.x;
      });

      const lines = [];
      sortedItems.forEach((item) => {
        const currentLine = lines[lines.length - 1];
        const tolerance = item.height * 0.45;

        if (!currentLine || Math.abs(currentLine.y - item.y) > tolerance) {
          lines.push({ y: item.y, height: item.height, items: [item] });
          return;
        }

        currentLine.items.push(item);
        currentLine.height = Math.max(currentLine.height, item.height);
      });

      const pageLines = lines.map((line) => {
        const ordered = line.items.sort((a, b) => a.x - b.x);
        let previousEnd = null;

        return ordered.reduce((lineText, item) => {
          const value = item.str.trim();
          if (!value) return lineText;

          if (!lineText) {
            previousEnd = item.x + item.width;
            return value;
          }

          const gap = previousEnd == null ? 0 : item.x - previousEnd;
          previousEnd = item.x + item.width;
          const needsSpace = gap > Math.max(item.height * 0.2, 1.5) && !/[-/(]$/.test(lineText) && !/^[,.;:)]/.test(value);

          return `${lineText}${needsSpace ? " " : ""}${value}`;
        }, "");
      });

      const formattedLines = [];
      pageLines.forEach((lineText, index) => {
        const previous = lines[index - 1];
        const current = lines[index];
        if (previous && previous.y - current.y > Math.max(previous.height, current.height) * 1.8) {
          formattedLines.push("");
        }
        formattedLines.push(lineText);
      });

      pages.push(formattedLines.join("\n"));
    }

    return pages.join("\n\n");
  };

  const extractDocxJDText = async (file) => {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const documentFile = zip.file("word/document.xml");

    if (!documentFile) {
      throw new Error("Unable to read this DOCX file.");
    }

    const xml = await documentFile.async("string");
    return decodeXmlText(
      xml
        .replace(/<w:tab\s*\/>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
    );
  };

  const handleImportJD = async (event, expectedType) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || lowerName.endsWith(".docx");

    if (expectedType === "pdf" && !isPdf) {
      toast({ title: "Invalid File", description: "Please upload a valid PDF file.", variant: "destructive" });
      return;
    }
    if (expectedType === "docx" && !isDocx) {
      toast({ title: "Invalid File", description: "Please upload a valid DOCX file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "File size must be less than 5MB.", variant: "destructive" });
      return;
    }

    setIsImportingJD(true);
    try {
      const importedText = expectedType === "pdf"
        ? await extractPdfJDText(file)
        : await extractDocxJDText(file);
      const text = cleanImportedJDText(importedText);

      if (!text) {
        throw new Error("No readable text found in this file.");
      }

      setForm(prev => ({ ...prev, jobDescription: text }));
      setJdTab("preview");
      toast({ title: "Imported", description: "Job description extracted successfully." });
    } catch (error) {
      toast({ title: "Import Failed", description: error.message || "Failed to import job description.", variant: "destructive" });
    } finally {
      setIsImportingJD(false);
    }
  };

  const handleGenerateJD = async () => {
    if (!form.position) {
      toast({ title: "Role Required", description: "Please enter a Position / Role first to generate a JD.", variant: "destructive" });
      return;
    }

    setIsGeneratingJD(true);
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/jobs/generate-jd`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          position: form.position,
          clientName: form.clientName,
          jobType: form.jobType,
          location: form.location,
          experience: form.experience,
          relevantExperience: form.relevantExperience,
          qualification: form.qualification,
          salaryBudget: form.salaryBudget,
          skills: form.skills,
          preferredSkills: form.preferredSkills,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate Job Description');
      }

      const data = await response.json();
      setForm(prev => ({ ...prev, jobDescription: data.text || "" }));
      setJdTab("preview");
      toast({ title: "JD Generated", description: "Professional JD has been drafted and loaded below." });
    } catch (error) {
      toast({ title: "Generation Failed", description: error.message || "Failed to generate job description.", variant: "destructive" });
    } finally {
      setIsGeneratingJD(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const trimStr = (val) => (typeof val === "string" ? val.trim() : val);

    if (!form.clientName) newErrors.clientName = "Please select a client";
    if (!form.jobType) newErrors.jobType = "Please select a job type";
    
    const position = trimStr(form.position);
    if (!position) newErrors.position = "Role is required";
    else if (position.length < 2) newErrors.position = "Must be at least 2 characters";

    const loc = trimStr(form.location);
    if (!loc) newErrors.location = "Location is required";

    const exp = trimStr(form.experience);
    if (!exp) newErrors.experience = "Experience is required";

    if (form.primaryRecruiter && form.secondaryRecruiter && form.primaryRecruiter === form.secondaryRecruiter) {
      newErrors.secondaryRecruiter = "Secondary Recruiter cannot be the same as Primary";
      newErrors.primaryRecruiter = "Must be different from Secondary";
    }

    const skills = trimStr(form.skills);
    if (!skills) newErrors.skills = "At least one mandatory skill is required";

    const link = trimStr(form.jdLink);
    if (link) {
      const urlPattern = /^(https?:\/\/)?([\w\d\-]+\.)+\w{2,}(\/.*)?$/i;
      if (!urlPattern.test(link)) {
        newErrors.jdLink = "Please enter a valid URL (e.g., https://example.com)";
      }
    }

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors
    };
  };

  const handleSubmit = async () => {
    const { isValid, errors: validationErrors } = validateForm();
    if (!isValid) {
      const errorMsg = Object.values(validationErrors).join(". ");
      toast({ 
        title: "Validation Error", 
        description: errorMsg || "Please fix the highlighted fields", 
        variant: "destructive" 
      });
      return;
    }

    const sanitizedPayload = {
      ...form,
      position: form.position.trim(),
      location: form.location.trim(),
      experience: form.experience.trim(),
      relevantExperience: form.relevantExperience?.trim() || "",
      qualification: form.qualification?.trim() || "",
      salaryBudget: form.salaryBudget?.trim() || "",
      monthlySalary: form.monthlySalary?.trim() || "",
      noticePeriod: form.noticePeriod?.trim() || "",
      tatTime: form.tatTime || null,
      jobType: form.jobType,
      skills: form.skills.trim(),
      mandatorySkills: mandatorySkillItems,
      preferredSkills: parseSkillItems(form.preferredSkills),
      jobDescription: form.jobDescription?.trim() || "",
      jdLink: form.jdLink?.trim() || "",
      customFields: form.customFields || {}
    };

    try {
      const url = editingJob ? `${API_URL}/jobs/${editingJob.id}` : `${API_URL}/jobs`;
      const response = await fetch(url, {
        method: editingJob ? 'PUT' : 'POST',
        headers: await getAuthHeader(),
        body: JSON.stringify(sanitizedPayload)
      });

      if (!response.ok) throw new Error('Failed to save job');

      const saved = await response.json();
      const normalized = {
        ...(editingJob || {}),
        ...sanitizedPayload,
        ...saved,
        id: saved._id || saved.id || editingJob?.id,
        jobType: saved.jobType ?? sanitizedPayload.jobType,
        jobDescription: saved.jobDescription ?? sanitizedPayload.jobDescription,
      };

      if (editingJob) {
        setJobs(prev => prev.map(j => j.id === editingJob.id ? normalized : j));
      } else {
        setJobs(prev => [normalized, ...prev]);
      }

      toast({ title: "Success", description: "Job requirement saved successfully" });
      setShowForm(false);
      setEditingJob(null);
      setMandatorySkillInput("");
      setPreferredSkillInput("");
      setErrors({});
      setForm(initialFormState);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save data. Please try again.", variant: "destructive" });
    }
  };

  const handleEditJob = (job) => {
    setEditingJob(job);
    setErrors({});
    setMandatorySkillInput("");
    setPreferredSkillInput("");
    setForm({
      ...initialFormState,
      ...job,
      jobDescription: job.jobDescription || "",
      jdLink: job.jdLink || "",
      customFields: job.customFields || {},
      tatTime: job.tatTime ? new Date(job.tatTime).toISOString().substring(0, 10) : ""
    });
    setShowForm(true);
  };

  const handleToggleActive = async (job) => {
    try {
      await fetch(`${API_URL}/jobs/${job.id}`, {
        method: 'PUT',
        headers: await getAuthHeader(),
        body: JSON.stringify({ active: !job.active })
      });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, active: !job.active } : j));
      toast({ title: "Status Updated" });
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this requirement? This action cannot be undone.")) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: await getAuthHeader()
      });
      if (!response.ok) throw new Error('Failed to delete job');
      setJobs(prev => prev.filter(j => j.id !== jobId));
      toast({ title: "Deleted", description: "Requirement deleted successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete requirement.", variant: "destructive" });
    }
  };

  const filteredJobs = useMemo(() => jobs.filter(j => {
    const matchesSearch = j.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          j.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          j.jobCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = selectedClientFilter === "" || j.clientName === selectedClientFilter;
    return matchesSearch && matchesClient;
  }), [jobs, searchTerm, selectedClientFilter]);

  const candidateCounts = useMemo(() => {
    const counts = {};
    candidates.forEach((candidate) => {
      (candidate.submissions || []).forEach((submission) => {
        const jobId = typeof submission.jobId === 'object' ? submission.jobId?._id : submission.jobId;
        if (!jobId) return;
        counts[jobId] = (counts[jobId] || 0) + 1;
      });
    });
    return counts;
  }, [candidates]);

  const matchingCandidatesByJobId = useMemo(
    () => getMatchingCandidatesByJobId(jobs, candidates, 3),
    [jobs, candidates]
  );

  const matchingCounts = useMemo(() => (
    Object.fromEntries(
      Object.entries(matchingCandidatesByJobId).map(([jobId, matchingCandidates]) => [jobId, matchingCandidates.length])
    )
  ), [matchingCandidatesByJobId]);

  const openCandidatesModalForJob = async (job, mode) => {
    setCandidateModalJob(job);
    setCandidateModalMode(mode);
    setExpandedCandidateId(null);
    setJobCandidates([]);
    setIsLoadingJobCandidates(true);

    try {
      const headers = await getAuthHeader();
      if (mode === 'matching') {
        const candidatesToScore = matchingCandidatesByJobId[job._id || job.id] || [];
        if (candidatesToScore.length === 0) {
          setJobCandidates([]);
          return;
        }

        const res = await fetch(`${API_URL}/score-match/bulk`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requirementId: job._id || job.id,
            candidateIds: candidatesToScore.map((candidate) => candidate._id || candidate.id),
          }),
        });

        if (!res.ok) throw new Error('Failed to score matching candidates');

        const data = await res.json();
        const scoredList = (data.scores || []).map((scoreData) => {
          const matchingCandidate = candidatesToScore.find(
            (candidate) => String(candidate._id || candidate.id) === String(scoreData.candidateId)
          );
          return {
            id: matchingCandidate?._id || matchingCandidate?.id || scoreData.candidateId,
            candidate: matchingCandidate,
            scoreData,
          };
        }).filter((item) => item.candidate);

        setJobCandidates(scoredList);
        return;
      }

      const res = await fetch(`${API_URL}/submissions?jobId=${job._id || job.id}`, { headers });
      if (!res.ok) throw new Error('Failed to load submitted candidates');

      const data = await res.json();
      setJobCandidates((data || []).map((submission) => ({
        id: submission.candidateId?._id || submission.candidateId || submission._id,
        status: submission.pipelineStage || submission.status,
        candidate: submission.candidateId,
        submittedByName: submission.submittedByName || (submission.submittedBy ? `${submission.submittedBy.firstName || ''} ${submission.submittedBy.lastName || ''}`.trim() : null) || 'N/A',
        submittedAt: submission.submittedAt || submission.createdAt,
        notes: submission.notes || '',
      })).filter((item) => item.candidate));
    } catch (error) {
      toast({
        title: 'Unable to load candidates',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingJobCandidates(false);
    }
  };

  const visibleDefaults = useMemo(
    () => (fieldConfig?.fields || []).filter(field => field.visible),
    [fieldConfig]
  );
  const visibleDefaultByName = useMemo(
    () => new Map(visibleDefaults.map(field => [field.fieldName, field])),
    [visibleDefaults]
  );
  const coreDetailFields = useMemo(
    () => ['clientName', 'jobType', 'location', 'experience', 'relevantExperience', 'qualification']
      .map(fieldName => visibleDefaultByName.get(fieldName))
      .filter(Boolean),
    [visibleDefaultByName]
  );
  const compensationFields = useMemo(
    () => ['salaryBudget', 'monthlySalary', 'gender', 'noticePeriod', 'tatTime']
      .map(fieldName => visibleDefaultByName.get(fieldName))
      .filter(Boolean),
    [visibleDefaultByName]
  );
  const assignmentSkillFields = useMemo(
    () => ['primaryRecruiter', 'secondaryRecruiter']
      .map(fieldName => visibleDefaultByName.get(fieldName))
      .filter(Boolean),
    [visibleDefaultByName]
  );
  const jobDescriptionField = visibleDefaultByName.get('jobDescription');
  const visibleCustom = useMemo(
    () => (fieldConfig?.customFields || []).filter(field => field.visible),
    [fieldConfig]
  );

  const defaultFieldPlaceholders = {
    clientName: 'Select Client',
    location: 'City / Remote',
    experience: 'E.g. 0.6 - 2',
    relevantExperience: 'E.g. 1 - 2',
    qualification: 'E.g. BTech',
    salaryBudget: 'E.g. 10-12 LPA',
    monthlySalary: 'E.g. 50k - 60k',
    noticePeriod: 'E.g. 15 Days',
    primaryRecruiter: 'Select Recruiter',
    secondaryRecruiter: 'Select Recruiter',
    skills: 'React, Node.js, etc.',
  };

  const getDefaultField = (field) => {
    if (field.fieldName === 'clientName') {
      return { ...field, fieldType: 'select', selectPlaceholder: 'Select Client', options: clients.map(client => client.companyName) };
    }

    if (field.fieldName === 'primaryRecruiter' || field.fieldName === 'secondaryRecruiter') {
      return { ...field, fieldType: 'select', selectPlaceholder: 'Select Recruiter', options: recruiters.map(recruiter => recruiter.name) };
    }

    return field;
  };

  const getFieldWrapperClass = (field) => {
    if (field.fieldName === 'jobDescription') return 'md:col-span-4';
    if (field.fieldType === 'textarea' || field.fieldName === 'skills') return 'md:col-span-2';
    return 'md:col-span-1';
  };

  const getFieldInputClass = (field) => `${inputCls} ${errors[field.fieldName] ? "border-red-500 focus:ring-red-500" : ""}`;

  const mandatorySkillItems = useMemo(
    () => parseSkillItems(form.skills),
    [form.skills]
  );

  const preferredSkillItems = useMemo(
    () => parseSkillItems(form.preferredSkills),
    [form.preferredSkills]
  );

  const commitSkill = (fieldName, items, rawValue, clearInput) => {
    const additions = rawValue.split(/[,;|\n]+/).map(skill => skill.trim()).filter(Boolean);
    if (additions.length === 0) return;
    const existing = new Set(items.map(skill => skill.toLowerCase()));
    const next = [...items];
    additions.forEach(skill => {
      if (!existing.has(skill.toLowerCase())) {
        existing.add(skill.toLowerCase());
        next.push(skill);
      }
    });
    handleDefaultFieldChange(fieldName, next.join(', '));
    clearInput("");
  };

  const removeSkill = (fieldName, items, skillToRemove) => {
    const next = items.filter(skill => skill !== skillToRemove);
    handleDefaultFieldChange(fieldName, next.join(', '));
  };

  const commitMandatorySkill = (rawValue = mandatorySkillInput) => {
    commitSkill('skills', mandatorySkillItems, rawValue, setMandatorySkillInput);
  };

  const removeMandatorySkill = (skillToRemove) => {
    removeSkill('skills', mandatorySkillItems, skillToRemove);
  };

  const commitPreferredSkill = (rawValue = preferredSkillInput) => {
    commitSkill('preferredSkills', preferredSkillItems, rawValue, setPreferredSkillInput);
  };

  const removePreferredSkill = (skillToRemove) => {
    removeSkill('preferredSkills', preferredSkillItems, skillToRemove);
  };

  const renderSkillBadgeField = ({
    label,
    required = false,
    items,
    inputValue,
    setInputValue,
    commit,
    remove,
    error,
  }) => {
    return (
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-zinc-500 mb-1">{label}{required ? ' *' : ''}</label>
        <div className={`min-h-[42px] w-full rounded-lg border bg-white dark:bg-zinc-900 px-2 py-2 text-sm transition-shadow focus-within:ring-2 focus-within:ring-zinc-500 ${error ? "border-red-500 focus-within:ring-red-500" : "border-zinc-300 dark:border-zinc-700"}`}>
          <div className="flex flex-wrap items-center gap-2">
            {items.map(skill => (
              <span key={skill} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {skill}
                <button type="button" onClick={() => remove(skill)} className="rounded-full text-zinc-400 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  commit();
                }
                if (e.key === 'Backspace' && !inputValue && items.length > 0) {
                  remove(items[items.length - 1]);
                }
              }}
              onBlur={() => commit()}
              placeholder={items.length ? "Add more..." : "Type a skill and press Enter"}
              className="min-w-[160px] flex-1 bg-transparent px-1 py-1 text-sm outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  };

  const renderMandatorySkillsField = () => {
    const skillsField = visibleDefaultByName.get('skills');
    if (!skillsField) return null;

    return renderSkillBadgeField({
      fieldName: 'skills',
      label: 'Mandatory Skills',
      required: true,
      items: mandatorySkillItems,
      inputValue: mandatorySkillInput,
      setInputValue: setMandatorySkillInput,
      commit: commitMandatorySkill,
      remove: removeMandatorySkill,
      error: errors.skills,
    });
  };

  const renderPreferredSkillsField = () => {
    const skillsField = visibleDefaultByName.get('preferredSkills');
    if (!skillsField) return null;

    return renderSkillBadgeField({
      fieldName: 'preferredSkills',
      label: 'Preferred Skills',
      items: preferredSkillItems,
      inputValue: preferredSkillInput,
      setInputValue: setPreferredSkillInput,
      commit: commitPreferredSkill,
      remove: removePreferredSkill,
      error: errors.preferredSkills,
    });
  };

  const renderDefaultField = (field) => {
    const resolvedField = getDefaultField(field);
    const label = `${field.label}${field.isMandatory ? ' *' : ''}`;

    return (
      <div key={field.fieldName} className={getFieldWrapperClass(field)}>
        <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
        <CustomFieldInput
          field={resolvedField}
          value={form[field.fieldName]}
          onChange={handleDefaultFieldChange}
          placeholder={defaultFieldPlaceholders[field.fieldName] || field.label}
          className={getFieldInputClass(field)}
        />
        {errors[field.fieldName] && <p className="text-xs text-red-500 mt-1">{errors[field.fieldName]}</p>}
      </div>
    );
  };

  const renderCustomField = (field) => (
    <div key={field.fieldName} className={getFieldWrapperClass(field)}>
      <label className="block text-xs font-medium text-zinc-500 mb-1">{field.label}</label>
      <CustomFieldInput
        field={field}
        value={form.customFields?.[field.fieldName]}
        onChange={handleCustomFieldChange}
        placeholder={field.label}
      />
    </div>
  );

  return (
    <div className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 space-y-8 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100">
      
      {/* Header */}
      <div className="w-full max-w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Job Requirements</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage active openings and allocations</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFormControlOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Form Control
            </button>
            <button
              onClick={() => {
                setEditingJob(null);
                setShowForm(true);
                setForm(initialFormState);
                setMandatorySkillInput("");
                setErrors({});
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Requirement
            </button>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-full sm:flex-1">
            <input
              placeholder="Search by Role, Job Code, or Company..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="w-full sm:w-64">
            <select 
              value={selectedClientFilter} 
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className={inputCls}
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.companyName}>{c.companyName}</option>
              ))}
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

        {/* ✅ DUAL SCROLLBAR TABLE CONTAINER */}
        <div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm bg-white dark:bg-zinc-900 flex flex-col relative overflow-hidden">
          {loading ? (
            <div className="text-center p-12 text-zinc-500 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-800 rounded-full animate-spin mb-4"></div>
              Loading jobs...
            </div>
          ) : (
            <>
              {/* TOP SCROLLBAR */}
              <div 
                ref={topScrollRef} 
                onScroll={handleTopScroll} 
                className="tbl-scroll overflow-x-auto overflow-y-hidden border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 z-20 sticky top-0 rounded-t-xl"
                style={{ height: '18px' }}
              >
                <div style={{ width: scrollWidth, height: '1px' }}></div>
              </div>

              {/* BOTTOM TABLE CONTAINER WITH STICKY HEADER */}
              <div 
                ref={bottomScrollRef} 
                onScroll={handleBottomScroll} 
                className="no-scrollbar max-h-[calc(100vh-16rem)] min-h-[400px] overflow-auto rounded-b-xl w-full"
              >
                <table ref={tableRef} className="min-w-[1540px] w-full text-left text-sm whitespace-nowrap border-collapse">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-xs uppercase text-zinc-500 font-semibold tracking-wider sticky top-0 z-10 shadow-[0_1px_0_0_#e4e4e7] dark:shadow-[0_1px_0_0_#27272a]">
                    <tr>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Job Code</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 text-center">Candidates</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Role</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Company</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Location</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Primary Recruiter</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Secondary Recruiter</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Expiry (TAT)</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 text-center">Status</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 text-right">Actions</th>
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 bg-white dark:bg-zinc-900">
                    {filteredJobs.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-12 text-zinc-400">No requirements found.</td></tr>
                    ) : filteredJobs.map(job => (
                      <tr key={job.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                        
                        {/* Job Code */}
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedJob(job)}
                            title="View Details"
                            className="inline-flex items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded text-xs border border-zinc-200 dark:border-zinc-700 font-mono font-medium hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:hover:bg-zinc-700 dark:hover:text-blue-300 dark:hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {job.jobCode}
                          </button>
                        </td>

                        {/* Candidates */}
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openCandidatesModalForJob(job, 'submitted')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300"
                              title="View submitted candidates"
                            >
                              <Users className="h-3.5 w-3.5" />
                              {candidateCounts[job.id || job._id] || 0}
                            </button>
                            <button
                              type="button"
                              onClick={() => openCandidatesModalForJob(job, 'matching')}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                              title="View matching candidates (3+ skills match)"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              {matchingCounts[job.id || job._id] || 0}
                            </button>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{job.position}</div>
                        </td>

                        {/* Company */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-zinc-400" />
                            {job.clientName}
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-zinc-400" />
                            {job.location || 'N/A'}
                          </div>
                        </td>

                        {/* Primary Recruiter */}
                        <td className="px-6 py-4">
                          {job.primaryRecruiter ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-200 dark:border-blue-800">
                                {job.primaryRecruiter.charAt(0).toUpperCase()}
                              </div>
                              <RecruiterDetailsTrigger recruiter={getRecruiterDetailsByName(job.primaryRecruiter, recruiters)} className="font-medium text-zinc-700 dark:text-zinc-300">
                                {job.primaryRecruiter}
                              </RecruiterDetailsTrigger>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-700">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Secondary Recruiter */}
                        <td className="px-6 py-4">
                          {job.secondaryRecruiter ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-200 dark:border-purple-800">
                                {job.secondaryRecruiter.charAt(0).toUpperCase()}
                              </div>
                              <RecruiterDetailsTrigger recruiter={getRecruiterDetailsByName(job.secondaryRecruiter, recruiters)} className="font-medium text-zinc-700 dark:text-zinc-300">
                                {job.secondaryRecruiter}
                              </RecruiterDetailsTrigger>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-700">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Expiry (TAT) */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {job.tatTime 
                              ? new Date(job.tatTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                              : 'No TAT'
                            }
                          </div>
                          {job.tatTime && new Date(job.tatTime).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && (
                            <span className="text-[10px] text-red-500 font-medium block mt-0.5">Expired</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            job.active !== false 
                              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50" 
                              : "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"
                          }`}>
                            {job.active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => setSelectedJob(job)} title="View Details" className="p-1.5 rounded-lg text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400">
                              <Eye className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleEditJob(job)} title="Edit Requirement" className="p-1.5 rounded-lg text-zinc-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-zinc-800 dark:hover:text-amber-400">
                              <Pencil className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleToggleActive(job)} title={job.active !== false ? "Mark as Inactive" : "Mark as Active"} className={`p-1.5 rounded-lg ${job.active !== false ? 'text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400' : 'text-zinc-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-zinc-800 dark:hover:text-green-400'}`}>
                              {job.active !== false ? <Ban className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                            </button>
                            <button onClick={() => handleDeleteJob(job.id)} title="Delete Requirement" className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400">
                              <Trash2 className="w-5 h-5" />
                            </button>
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

      {showForm && (
        <ModalPortal>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeRequirementForm} />
          <div
            className="relative w-full max-w-[1400px] max-h-[94vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-bold text-xl tracking-tight">
                      {editingJob ? "Edit Job Requirement" : "New Job Requirement"}
                    </h3>
                    {form.jobCode && (
                      <span className="inline-flex items-center rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-mono text-zinc-100">
                        {form.jobCode}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 mt-1">Complete the requirement details and assignment preferences.</p>
                </div>
                <button onClick={closeRequirementForm} className="p-2 rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-zinc-50 dark:bg-zinc-950">
              <section className="rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/10 p-5">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Core Details</p>
                  <h4 className="text-base font-semibold text-zinc-900 dark:text-white mt-1">Role and client information</h4>
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Job Code</label>
                    <input name="jobCode" placeholder="Auto-generated" value={form.jobCode} disabled className={`${inputCls} bg-zinc-100 dark:bg-zinc-800 opacity-70 cursor-not-allowed`} />
                  </div>

                  {coreDetailFields.slice(0, 1).map(renderDefaultField)}

                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Role / Position *</label>
                    <input name="position" placeholder="E.g. Software Engineer" value={form.position} onChange={handleChange} className={`${inputCls} ${errors.position ? "border-red-500 focus:ring-red-500" : ""}`} />
                    {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
                  </div>

                  {coreDetailFields.slice(1).map(renderDefaultField)}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/10 p-5">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Compensation & Preferences</p>
                  <h4 className="text-base font-semibold text-zinc-900 dark:text-white mt-1">Budget, notice, and timeline</h4>
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  {compensationFields.map(renderDefaultField)}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/10 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Assignment & Skills</p>
                  <h4 className="text-base font-semibold text-zinc-900 dark:text-white mt-1 mb-4">Recruiter ownership and skill requirements</h4>
                </div>
                <div className="grid md:grid-cols-4 gap-4">
                  {assignmentSkillFields.slice(0, 2).map(renderDefaultField)}
                  {renderMandatorySkillsField()}
                  {renderPreferredSkillsField()}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/10 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Custom Fields</p>
                    <h4 className="text-base font-semibold text-zinc-900 dark:text-white mt-1">Configured requirement inputs</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormControlOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Manage Fields
                  </button>
                </div>

                {visibleCustom.length > 0 ? (
                  <div className="grid md:grid-cols-4 gap-4">
                    {visibleCustom.map(renderCustomField)}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-6 text-center">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No additional fields enabled</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Use Form Control to add or show custom fields here.</p>
                  </div>
                )}
              </section>
            </div>

            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {jobDescriptionField && (
                  <button
                    type="button"
                    onClick={() => setJobDescriptionModalOpen(true)}
                    className="inline-flex items-center justify-center px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {form.jobDescription ? "Edit Job Description" : "Add Job Description"}
                  </button>
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button onClick={closeRequirementForm} className="px-5 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Cancel
                </button>
                <button onClick={handleSubmit} className="px-6 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm">
                  {editingJob ? "Update Requirement" : "Save Requirement"}
                </button>
              </div>
            </div>
          </div>

          {jobDescriptionModalOpen && (
            <ModalPortal>
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setJobDescriptionModalOpen(false)} />
                <div
                  className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-6 py-5 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950 text-white flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800">
                    <div>
                      <h3 className="font-bold text-lg tracking-tight">Job Description</h3>
                    </div>
                    <button onClick={() => setJobDescriptionModalOpen(false)} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isImportingJD}
                        onClick={() => pdfInputRef.current?.click()}
                        className="inline-flex items-center justify-center px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {isImportingJD ? "Importing..." : "Import PDF"}
                      </button>
                      <button
                        type="button"
                        disabled={isImportingJD}
                        onClick={() => docxInputRef.current?.click()}
                        className="inline-flex items-center justify-center px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {isImportingJD ? "Importing..." : "Import DOCX"}
                      </button>

                      <button
                        type="button"
                        disabled={isGeneratingJD || isImportingJD}
                        onClick={handleGenerateJD}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white dark:bg-indigo-500 rounded-lg text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 shadow-sm transition-all"
                      >
                        {isGeneratingJD ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <span>✨ Generate JD</span>
                          </>
                        )}
                      </button>

                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(event) => handleImportJD(event, "pdf")}
                      />
                      <input
                        ref={docxInputRef}
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(event) => handleImportJD(event, "docx")}
                      />
                    </div>
                  <div className="flex flex-col h-[400px]">
                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setJdTab("write")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            jdTab === "write"
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setJdTab("preview")}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            jdTab === "preview"
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          Preview
                        </button>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                        {(form.jobDescription || "").length} characters
                      </span>
                    </div>

                    <div className="flex-1 min-h-0">
                      {jdTab === "write" ? (
                        <textarea
                          value={form.jobDescription || ""}
                          onChange={(e) => setForm(prev => ({ ...prev, jobDescription: e.target.value }))}
                          placeholder="Describe responsibilities, requirements, and role context..."
                          className={`${inputCls} w-full h-full min-h-[300px] resize-none ${
                            errors.jobDescription ? "border-red-500 focus:ring-red-500" : ""
                          }`}
                        />
                      ) : (
                        <div
                          className="w-full h-full min-h-[300px] p-4 overflow-y-auto border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-200 select-text"
                          dangerouslySetInnerHTML={{
                            __html: parseMarkdownToHtml(form.jobDescription) || '<p class="text-zinc-400 dark:text-zinc-500 italic text-center py-8">No description generated yet.</p>'
                          }}
                        />
                      )}
                    </div>
                    {errors.jobDescription && <p className="text-xs text-red-500 mt-1">{errors.jobDescription}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">JD Link</label>
                    <input
                      type="url"
                      name="jdLink"
                      value={form.jdLink || ""}
                      onChange={handleChange}
                      placeholder="https://example.com/job-description"
                      className={`${inputCls} ${errors.jdLink ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {errors.jdLink && <p className="text-xs text-red-500 mt-1">{errors.jdLink}</p>}
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end gap-2">
                  <button onClick={() => setForm(prev => ({ ...prev, jobDescription: "" }))} className="px-5 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Clear
                  </button>
                  <button onClick={() => setJobDescriptionModalOpen(false)} className="px-5 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Done
                  </button>
                </div>
              </div>
            </div>
            </ModalPortal>
          )}
        </div>
        </ModalPortal>
      )}

      {selectedJob && <JobDetailCard job={selectedJob} recruiters={recruiters} onClose={() => setSelectedJob(null)} />}
      {candidateModalJob && (
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
      )}
      <FormControlModal
        isOpen={formControlOpen}
        onClose={() => setFormControlOpen(false)}
        config={fieldConfig}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}
