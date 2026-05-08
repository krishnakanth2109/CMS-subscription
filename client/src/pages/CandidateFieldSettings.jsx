import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Loader2, Check, X, Settings2,
  Edit, GripVertical, Eye, EyeOff, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL  = `${BASE_URL}/api`;

const getAuthHeader = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    const token  = stored ? JSON.parse(stored)?.idToken : null;
    return { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

// These are the optional standard fields that can be hidden
const OPTIONAL_STANDARD_FIELDS = [
  { id: 'alternateNumber',    label: 'Alternate Number',        section: 'Personal' },
  { id: 'currentLocation',    label: 'Current Location',        section: 'Personal' },
  { id: 'preferredLocation',  label: 'Preferred Location',      section: 'Personal' },
  { id: 'dateOfBirth',        label: 'Date of Birth',           section: 'Personal' },
  { id: 'currentCompany',     label: 'Current Company',         section: 'Professional' },
  { id: 'reasonForChange',    label: 'Reason for Change',       section: 'Professional' },
  { id: 'totalExperience',    label: 'Total Experience',        section: 'Professional' },
  { id: 'relevantExperience', label: 'Relevant Experience',     section: 'Professional' },
  { id: 'skills',             label: 'Skills',                  section: 'Professional' },
  { id: 'ctc',                label: 'Current CTC',             section: 'Financial' },
  { id: 'currentTakeHome',    label: 'Current Take Home',       section: 'Financial' },
  { id: 'ectc',               label: 'Expected CTC',            section: 'Financial' },
  { id: 'expectedTakeHome',   label: 'Expected Take Home',      section: 'Financial' },
  { id: 'noticePeriod',       label: 'Notice Period',           section: 'Availability' },
  { id: 'servingNoticePeriod',label: 'Serving Notice Period?',  section: 'Availability' },
  { id: 'lwd',                label: 'Last Working Day (LWD)',  section: 'Availability' },
  { id: 'offersInHand',       label: 'Offers In Hand',          section: 'Availability' },
];

const FIELD_TYPE_META = {
  text:    { label: 'Short Text',   color: 'bg-blue-100 text-blue-700',   desc: 'Single line text answer' },
  number:  { label: 'Number',       color: 'bg-purple-100 text-purple-700', desc: 'Numeric value' },
  date:    { label: 'Date',         color: 'bg-green-100 text-green-700', desc: 'Date picker' },
  boolean: { label: 'Yes / No',     color: 'bg-orange-100 text-orange-700', desc: 'Dropdown — Yes or No' },
};

const SECTIONS = ['Personal', 'Professional', 'Financial', 'Availability'];

// ── Input style helper ────────────────────────────────────────────────────────
const inputCls = (hasError = false) =>
  `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white transition ${hasError ? 'border-red-500' : 'border-slate-300 hover:border-slate-400'}`;

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function CandidateFieldSettings() {
  const { toast } = useToast();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Live form state
  const [hiddenFields,  setHiddenFields]  = useState([]);
  const [customFields,  setCustomFields]  = useState([]);

  // New/edit field form state
  const [newFieldName,      setNewFieldName]      = useState('');
  const [newFieldType,      setNewFieldType]      = useState('text');
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);
  const [fieldNameError,    setFieldNameError]    = useState('');

  // UI state
  const [expandedSection, setExpandedSection] = useState(null);

  // Original state for detecting changes
  const [originalState, setOriginalState] = useState(null);

  useEffect(() => { fetchProfileSettings(); }, []);

  // Detect unsaved changes
  useEffect(() => {
    if (!originalState) return;
    const same =
      JSON.stringify(hiddenFields.slice().sort()) === JSON.stringify(originalState.hiddenFields.slice().sort()) &&
      JSON.stringify(customFields) === JSON.stringify(originalState.customFields);
    setHasChanges(!same);
  }, [hiddenFields, customFields, originalState]);

  const fetchProfileSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/profile`, { headers: getAuthHeader() });
      if (res.ok) {
        const data     = await res.json();
        const settings = data.candidateSettings || { hiddenFields: [], customFields: [] };
        const hf = settings.hiddenFields || [];
        const cf = settings.customFields || [];
        setHiddenFields(hf);
        setCustomFields(cf);
        setOriginalState({ hiddenFields: [...hf], customFields: JSON.parse(JSON.stringify(cf)) });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to load settings.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Toggle standard field visibility ─────────────────────────────────────
  const handleToggleField = (fieldId) => {
    setHiddenFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleShowAll = ()  => setHiddenFields([]);
  const handleHideAll = ()  => setHiddenFields(OPTIONAL_STANDARD_FIELDS.map((f) => f.id));

  // ── Custom field: begin editing ───────────────────────────────────────────
  const startEditField = (index) => {
    const f = customFields[index];
    setNewFieldName(f.fieldName);
    setNewFieldType(f.fieldType);
    setEditingFieldIndex(index);
    setFieldNameError('');
  };

  const cancelEdit = () => {
    setEditingFieldIndex(null);
    setNewFieldName('');
    setNewFieldType('text');
    setFieldNameError('');
  };

  // ── Custom field: add or update ───────────────────────────────────────────
  const handleAddOrUpdate = () => {
    const trimmed = newFieldName.trim();
    if (!trimmed) { setFieldNameError('Field name is required.'); return; 
      
    const isDuplicate = customFields.some((f, idx) =>
      idx !== editingFieldIndex && f.fieldName.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) { setFieldNameError('A field with this name already exists.'); return; }

    setFieldNameError('');

    if (editingFieldIndex !== null) {
      setCustomFields((prev) => {
        const updated = [...prev];
        updated[editingFieldIndex] = { fieldName: trimmed, fieldType: newFieldType };
        return updated;
      });
      cancelEdit();
    } else {
      setCustomFields((prev) => [...prev, { fieldName: trimmed, fieldType: newFieldType }]);
      setNewFieldName('');
      setNewFieldType('text');
    }
  };

  const handleRemoveCustomField = (idx) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== idx));
    if (editingFieldIndex === idx) cancelEdit();
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const payload = { candidateSettings: { hiddenFields, customFields } };
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update settings');

      const updatedUser = await res.json();

      // Sync to sessionStorage so rest of the app picks up new settings immediately
      const stored = sessionStorage.getItem('currentUser');
      if (stored) {
        const userObj = JSON.parse(stored);
        userObj.candidateSettings = updatedUser.candidateSettings;
        sessionStorage.setItem('currentUser', JSON.stringify(userObj));
      }

      const saved = updatedUser.candidateSettings || payload.candidateSettings;
      setOriginalState({ hiddenFields: [...saved.hiddenFields], customFields: JSON.parse(JSON.stringify(saved.customFields)) });
      setHasChanges(false);
      toast({ title: 'Settings Saved', description: 'Candidate form settings updated successfully.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Discard changes ───────────────────────────────────────────────────────
  const handleDiscard = () => {
    if (!originalState) return;
    setHiddenFields([...originalState.hiddenFields]);
    setCustomFields(JSON.parse(JSON.stringify(originalState.customFields)));
    cancelEdit();
    setHasChanges(false);
  };

  // ── Group fields by section ───────────────────────────────────────────────
  const fieldsBySection = SECTIONS.reduce((acc, section) => {
    acc[section] = OPTIONAL_STANDARD_FIELDS.filter((f) => f.section === section);
    return acc;
  }, {});

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
          <p className="text-sm text-slate-500">Loading settings…</p>
        </div>
      </div>
    );
  }

  const visibleCount = OPTIONAL_STANDARD_FIELDS.length - hiddenFields.length;
  const hiddenCount  = hiddenFields.length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Settings2 className="w-6 h-6 text-blue-600" />
            Candidate Form Settings
          </h2>
          <p className="text-slate-500 mt-1 text-sm">Customize the candidate form for your entire company. Changes apply to all recruiters.</p>
        </div>
        {/* Unsaved changes badge */}
        {hasChanges && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Unsaved changes
          </span>
        )}
      </div>

      {/* ── Summary Strip ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center shadow-sm">
          <span className="text-3xl font-bold text-blue-600">{visibleCount}</span>
          <span className="text-xs text-slate-500 mt-1 font-medium text-center">Standard Fields Visible</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center shadow-sm">
          <span className="text-3xl font-bold text-slate-400">{hiddenCount}</span>
          <span className="text-xs text-slate-500 mt-1 font-medium text-center">Standard Fields Hidden</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center shadow-sm">
          <span className="text-3xl font-bold text-purple-600">{customFields.length}</span>
          <span className="text-xs text-slate-500 mt-1 font-medium text-center">Custom Fields Added</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — Standard Field Visibility
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-slate-500" />
              Standard Fields Visibility
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Mandatory fields (Name, Email, Phone) are always shown and cannot be hidden.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleShowAll} className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition">
              <ToggleRight className="w-3.5 h-3.5" /> Show All
            </button>
            <button onClick={handleHideAll} className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition">
              <ToggleLeft className="w-3.5 h-3.5" /> Hide All
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {SECTIONS.map((section) => {
            const sectionFields = fieldsBySection[section];
            const sectionHidden = sectionFields.filter((f) => hiddenFields.includes(f.id)).length;
            const isExpanded    = expandedSection === section || expandedSection === null;

            return (
              <div key={section}>
                {/* Section sub-header */}
                <button
                  onClick={() => setExpandedSection(isExpanded && expandedSection === section ? null : section)}
                  className="flex items-center justify-between w-full mb-3 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition">{section}</span>
                    {sectionHidden > 0 && (
                      <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{sectionHidden} hidden</span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {sectionFields.map((field) => {
                      const hidden = hiddenFields.includes(field.id);
                      return (
                        <label
                          key={field.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                            !hidden
                              ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                              : 'border-slate-200 bg-slate-50 opacity-60 hover:opacity-80'
                          }`}
                        >
                          <div className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-colors ${!hidden ? 'bg-blue-500' : 'bg-slate-300'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${!hidden ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            <input type="checkbox" checked={!hidden} onChange={() => handleToggleField(field.id)} className="sr-only" />
                          </div>
                          <span className={`text-sm font-medium ${!hidden ? 'text-blue-900' : 'text-slate-400 line-through'}`}>
                            {field.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — Custom Fields
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-slate-500" />
            Custom Fields
            {customFields.length > 0 && (
              <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{customFields.length}</span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Add bespoke fields for your hiring process. They appear in every candidate form and export.</p>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Add / Edit Field Form ── */}
          <div className={`rounded-xl border p-4 transition-all ${editingFieldIndex !== null ? 'bg-blue-50/60 border-blue-300 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
            {editingFieldIndex !== null && (
              <div className="flex items-center gap-2 mb-3 text-blue-700 text-sm font-semibold">
                <Edit className="w-4 h-4" />
                Editing: <span className="font-bold">{customFields[editingFieldIndex]?.fieldName}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              {/* Field Name */}
              <div className="flex-1 w-full">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Field Name *</label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => { setNewFieldName(e.target.value); if (fieldNameError) setFieldNameError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddOrUpdate(); if (e.key === 'Escape') cancelEdit(); }}
                  placeholder="e.g. Passport Number, PAN Card, Aadhar…"
                  className={inputCls(!!fieldNameError)}
                  autoComplete="off"
                />
                {fieldNameError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><X className="w-3 h-3" />{fieldNameError}</p>}
              </div>

              {/* Field Type */}
              <div className="w-full sm:w-52">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Field Type</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  className={inputCls(false)}
                >
                  {Object.entries(FIELD_TYPE_META).map(([value, meta]) => (
                    <option key={value} value={value}>{meta.label} — {meta.desc}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="w-full sm:w-auto sm:self-end flex flex-col gap-1.5">
                <button
                  onClick={handleAddOrUpdate}
                  className={`w-full flex items-center justify-center gap-2 text-white px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
                    editingFieldIndex !== null
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {editingFieldIndex !== null ? <><Check className="w-4 h-4" /> Update Field</> : <><Plus className="w-4 h-4" /> Add Field</>}
                </button>
                {editingFieldIndex !== null && (
                  <button onClick={cancelEdit} className="text-xs text-center text-slate-500 hover:text-slate-800 font-medium py-0.5 transition">
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>

            {/* Type preview */}
            {newFieldType && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>This will render as a <span className={`font-semibold px-1.5 py-0.5 rounded ${FIELD_TYPE_META[newFieldType]?.color}`}>{FIELD_TYPE_META[newFieldType]?.label}</span> input — {FIELD_TYPE_META[newFieldType]?.desc}</span>
              </div>
            )}
          </div>

          {/* ── Custom Field List ── */}
          {customFields.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Settings2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">No custom fields yet</p>
              <p className="text-xs text-slate-400 mt-1">Use the form above to add your first custom field.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customFields.map((field, index) => {
                const typeMeta    = FIELD_TYPE_META[field.fieldType] || {};
                const isEditing   = editingFieldIndex === index;
                return (
                  <div
                    key={index}
                    className={`flex justify-between items-center px-4 py-3 border rounded-xl transition-all ${
                      isEditing
                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      <span className={`flex-shrink-0 font-mono text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${typeMeta.color}`}>
                        {typeMeta.label || field.fieldType}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{field.fieldName}</p>
                        <p className="text-[11px] text-slate-400">{typeMeta.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                      <button
                        onClick={() => isEditing ? cancelEdit() : startEditField(index)}
                        className={`p-1.5 rounded-lg transition ${isEditing ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                        title={isEditing ? 'Cancel edit' : 'Edit field'}
                      >
                        {isEditing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRemoveCustomField(index)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {customFields.length > 0 && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              {customFields.length} custom field{customFields.length !== 1 ? 's' : ''} will appear in the "Additional Details" section of the candidate form.
            </p>
          )}
        </div>
      </div>

      {/* ── Save / Discard Footer ── */}
      <div className={`sticky bottom-0 bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-6 py-4 flex justify-between items-center shadow-lg transition-all ${hasChanges ? 'opacity-100' : 'opacity-70 pointer-events-none'}`}>
        <div className="text-sm text-slate-600">
          {hasChanges ? (
            <span className="flex items-center gap-2 font-medium text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              You have unsaved changes
            </span>
          ) : (
            <span className="text-slate-400">All changes saved</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDiscard}
            disabled={!hasChanges || saving}
            className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Discard Changes
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save All Settings'}
          </button>
        </div>
      </div>

    </div>
  );
}