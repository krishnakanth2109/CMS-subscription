import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  Building2, User, X, Eye, Pencil, Plus, CheckCircle, Ban, SlidersHorizontal, DollarSign,
  Mail, Phone, Globe, MapPin, Percent, Calendar, ShieldAlert, FileText, Lock, CreditCard,
  Tag, StickyNote, ExternalLink, ArrowLeft, ArrowRight, ChevronDown, Check, Search
} from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

// Sleek Grey Input Styling
const inputCls = "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-500 bg-white dark:bg-zinc-900 dark:text-zinc-100 transition-shadow placeholder-zinc-400";

const DEFAULT_CLIENT_FIELD_CONFIG = [
  { fieldName: "companyName", label: "Company Name", fieldType: "text", visible: true, isDefault: true },
  { fieldName: "contactPerson", label: "Contact Person", fieldType: "text", visible: true, isDefault: true },
  { fieldName: "email", label: "Email", fieldType: "email", visible: true, isDefault: true },
  { fieldName: "phone", label: "Phone", fieldType: "tel", visible: true, isDefault: true },
  { fieldName: "website", label: "Website", fieldType: "url", visible: true, isDefault: true },
  { fieldName: "industry", label: "Industry", fieldType: "text", visible: true, isDefault: true },
  { fieldName: "clientLocation", label: "Client Location", fieldType: "text", visible: true, isDefault: true },
  { fieldName: "gstNumber", label: "GST Number", fieldType: "text", visible: true, isDefault: true },
  { fieldName: "address", label: "Address", fieldType: "textarea", visible: true, isDefault: true },
  { fieldName: "locationLink", label: "Location Link", fieldType: "url", visible: true, isDefault: true },
  { fieldName: "percentage", label: "Commission %", fieldType: "number", visible: true, isDefault: true },
  { fieldName: "candidatePeriod", label: "Candidate Period", fieldType: "number", visible: true, isDefault: true },
  { fieldName: "replacementPeriod", label: "Replacement Period", fieldType: "number", visible: true, isDefault: true },
  { fieldName: "lockingPeriod", label: "Locking Period", fieldType: "number", visible: true, isDefault: true },
  { fieldName: "paymentMode", label: "Payment Mode", fieldType: "text", visible: true, isDefault: true },
  { fieldName: "terms", label: "Terms & Conditions", fieldType: "textarea", visible: true, isDefault: true },
  { fieldName: "notes", label: "Notes", fieldType: "textarea", visible: true, isDefault: true },
];

const REQUIRED_CLIENT_FIELD_NAMES = new Set(["companyName"]);

const normalizeClientFieldConfig = (config = {}) => {
  const storedFields = Array.isArray(config.fields) ? config.fields : [];
  const storedCustomFields = Array.isArray(config.customFields) ? config.customFields : [];
  return {
    fields: DEFAULT_CLIENT_FIELD_CONFIG.map(field => {
      const stored = storedFields.find(item => item.fieldName === field.fieldName) || {};
      const isMandatory = REQUIRED_CLIENT_FIELD_NAMES.has(field.fieldName) || Boolean(stored.isMandatory);
      return { ...field, ...stored, isDefault: true, isMandatory, visible: isMandatory ? true : stored.visible !== false };
    }),
    customFields: storedCustomFields.map(field => ({
      ...field,
      isDefault: false,
      isMandatory: Boolean(field.isMandatory),
      visible: field.visible !== false,
    })),
  };
};

const getClientFieldConfig = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    return normalizeClientFieldConfig(user?.clientSettings || { fields: DEFAULT_CLIENT_FIELD_CONFIG, customFields: [] });
  } catch {
    return normalizeClientFieldConfig({ fields: DEFAULT_CLIENT_FIELD_CONFIG, customFields: [] });
  }
};

const saveClientFieldConfig = (config) => {
  try {
    const user = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    sessionStorage.setItem("currentUser", JSON.stringify({ ...user, clientSettings: config }));
  } catch (_) {}
};

const ClientCustomFieldInput = ({ field, value, onChange }) => {
  const common = { value: value ?? "", onChange: e => onChange(field.fieldName, e.target.value) };
  if (field.fieldType === "textarea") {
    return <textarea {...common} rows={3} className={`${inputCls} resize-none`} />;
  }
  if (field.fieldType === "select") {
    return (
      <select value={value ?? ""} onChange={e => onChange(field.fieldName, e.target.value)} className={inputCls}>
        <option value="">Select</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }
  if (field.fieldType === "checkbox") {
    return (
      <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(field.fieldName, e.target.checked)} className="h-4 w-4 rounded border-zinc-300 text-zinc-900" />
        Enabled
      </label>
    );
  }
  return <input type={field.fieldType || "text"} {...common} className={inputCls} />;
};

const ClientFormControlModal = ({ isOpen, onClose, config, onConfigChange }) => {
  const [draftField, setDraftField] = useState({ label: "", fieldType: "text", visible: true });
  if (!isOpen) return null;

  const toggleDefault = (fieldName) => {
    onConfigChange({
      ...config,
      fields: config.fields.map(field => field.fieldName === fieldName && !field.isMandatory ? { ...field, visible: !field.visible } : field),
    });
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
    const baseName = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `custom_${Date.now()}`;
    const existing = new Set([...config.fields, ...config.customFields].map(field => field.fieldName));
    let fieldName = baseName;
    let counter = 2;
    while (existing.has(fieldName)) fieldName = `${baseName}_${counter++}`;
    onConfigChange({
      ...config,
      customFields: [...config.customFields, { ...draftField, label, fieldName, isDefault: false, isMandatory: false }],
    });
    setDraftField({ label: "", fieldType: "text", visible: true });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto lg:overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-808 flex flex-col">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Client Form Control</p>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Manage client fields</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-lg text-zinc-500 hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white text-xl leading-none">x</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] lg:h-[calc(92vh-82px)] h-auto min-h-0 flex-1 lg:overflow-hidden">
          <div className="border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 lg:overflow-y-auto overflow-visible">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955 p-4 space-y-3">
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">Create additional field</p>
              <input value={draftField.label} onChange={e => setDraftField(prev => ({ ...prev, label: e.target.value }))} placeholder="Field label" className={inputCls} />
              <select value={draftField.fieldType} onChange={e => setDraftField(prev => ({ ...prev, fieldType: e.target.value }))} className={inputCls}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="email">Email</option>
                <option value="url">URL</option>
                <option value="textarea">Long Text</option>
                <option value="select">Select</option>
                <option value="checkbox">Checkbox</option>
              </select>
              <button onClick={addCustom} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> Add Field
              </button>
            </div>
          </div>
          <div className="p-5 lg:overflow-y-auto overflow-visible bg-zinc-50 dark:bg-zinc-955 space-y-5">
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Standard Fields</p>
                <span className="text-xs text-zinc-400">{config.fields.filter(field => field.visible).length}/{config.fields.length} visible</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {config.fields.map(field => (
                  <button key={field.fieldName} onClick={() => toggleDefault(field.fieldName)} disabled={field.isMandatory} className={`text-left rounded-xl border p-3 transition ${field.visible ? "border-zinc-300 bg-white dark:bg-zinc-900 shadow-sm" : "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 opacity-70"} ${field.isMandatory ? "cursor-not-allowed" : "hover:border-zinc-400"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-zinc-850 dark:text-zinc-100">{field.label}</span>
                      <span className={`h-5 w-9 rounded-full p-0.5 transition ${field.visible ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"}`}>
                        <span className={`block h-4 w-4 rounded-full transition ${field.visible ? "translate-x-4 bg-white dark:bg-zinc-900" : "bg-white"}`} />
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{field.isMandatory ? "Required" : field.fieldType}</p>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Additional Fields</p>
                <span className="text-xs text-zinc-400">{config.customFields.length} fields</span>
              </div>
              {config.customFields.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">No additional fields yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {config.customFields.map((field, index) => (
                    <div key={field.fieldName} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
                      <input value={field.label} onChange={e => updateCustomLabel(index, e.target.value)} className={`${inputCls} sm:flex-1`} />
                      <span className="px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-505">{field.fieldType}</span>
                      <button onClick={() => toggleCustom(index)} className={`px-3 py-2 rounded-lg text-xs font-semibold ${field.visible ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-550 dark:bg-zinc-800"}`}>{field.visible ? "Visible" : "Hidden"}</button>
                      <button onClick={() => deleteCustom(index)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600 dark:bg-red-900/20">Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium">Done</button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- DETAIL MODAL ---------------- */
const ClientDetailCard = ({ client, onClose }) => {
  const initials = (client.companyName || "C")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const hasCustomFields = client.customFields && Object.keys(client.customFields).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose} 
      />

      {/* Main Modal Card */}
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Column: Client Summary Card */}
        <div className="w-full md:w-80 bg-zinc-50 dark:bg-zinc-955/40 p-8 border-b md:border-b-0 md:border-r border-zinc-200/60 dark:border-zinc-800/60 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-3xl shadow-lg shadow-indigo-600/20 select-none">
                {initials}
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">{client.companyName}</h2>
                {client.industry && (
                  <span className="text-xs font-semibold text-zinc-400 block">{client.industry}</span>
                )}
              </div>
              <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                client.active !== false
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-455 border border-emerald-200 dark:border-emerald-900/30"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-955/30 dark:text-rose-455 border border-rose-200 dark:border-rose-900/30"
              }`}>
                {client.active !== false ? "Active Partner" : "Inactive"}
              </span>
            </div>

            <div className="h-px bg-zinc-200/60 dark:bg-zinc-800/60" />

            {/* Quick stats list */}
            <div className="space-y-4 text-xs font-semibold text-zinc-655 dark:text-zinc-400">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Client Identifier</span>
                <span className="text-zinc-800 dark:text-zinc-300 font-mono tracking-wider bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-200/50 dark:border-zinc-800/50 inline-block">
                  {client.clientId || "N/A"}
                </span>
              </div>

              {client.clientLocation && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Office Location</span>
                  <span className="text-zinc-850 dark:text-zinc-200 font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-455 shrink-0" />
                    {client.clientLocation}
                  </span>
                </div>
              )}

              {client.gstNumber && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">GST IN</span>
                  <span className="text-zinc-855 dark:text-zinc-200 font-bold font-mono tracking-wide">
                    {client.gstNumber}
                  </span>
                </div>
              )}

              {client.website && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Website URL</span>
                  <a
                    href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 font-bold flex items-center gap-1"
                  >
                    {client.website.replace(/^https?:\/\/(www\.)?/, '')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-200/60 dark:bg-transparent dark:border-zinc-800/60 text-[10px] font-bold text-zinc-400 space-y-2">
            <div className="flex justify-between">
              <span>Date Added:</span>
              <span className="text-zinc-650 dark:text-zinc-400">{client.createdAt ? new Date(client.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Sync:</span>
              <span className="text-zinc-655 dark:text-zinc-400">{client.updatedAt ? new Date(client.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Information Display */}
        <div className="flex-1 overflow-y-auto max-h-[85vh] md:max-h-none flex flex-col justify-between">
          <div className="p-8 space-y-8">
            
            {/* Header Title bar (hidden on mobile header) */}
            <div className="hidden md:flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white">Partner Fact Sheet</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Comprehensive view of business agreements and records</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-655 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Information Grid Section */}
            <div className="space-y-6">
              
              {/* Primary Contact details */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" />
                  Primary Point of Contact
                </h4>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/40 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-900/20">
                    <span className="text-zinc-400 font-medium">Contact Person</span>
                    <span className="text-zinc-900 dark:text-white font-bold">{client.contactPerson || "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-900/20">
                    <span className="text-zinc-400 font-medium">Email Address</span>
                    {client.email ? (
                      <a href={`mailto:${client.email}`} className="text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 font-bold">
                        {client.email}
                      </a>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-400 font-medium">Phone / mobile</span>
                    {client.phone ? (
                      <a href={`tel:${client.phone}`} className="text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 font-bold">
                        {client.phone}
                      </a>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </div>
                  {client.locationLink && (
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400 font-medium">Google Maps</span>
                      <a
                        href={client.locationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 font-bold"
                      >
                        View Map Location <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {client.address && (
                    <div className="col-span-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/40 space-y-1.5">
                      <span className="text-zinc-400 font-medium block">Office Address</span>
                      <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium bg-white dark:bg-zinc-955 px-4 py-3 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 font-sans">{client.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Commercial Terms details */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" />
                  Commercial Agreement Parameters
                </h4>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/40 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-900/20">
                    <span className="text-zinc-455 font-medium">Commission Rate</span>
                    <span className="text-zinc-900 dark:text-white font-bold">{client.percentage ? `${client.percentage}%` : "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-900/20">
                    <span className="text-zinc-455 font-medium">Candidate Period</span>
                    <span className="text-zinc-900 dark:text-white font-bold">{client.candidatePeriod ? `${client.candidatePeriod} Months` : "—"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-455 font-medium">Replacement Period</span>
                    <span className="text-zinc-900 dark:text-white font-bold">{client.replacementPeriod ? `${client.replacementPeriod} Days` : "—"}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-455 font-medium">Locking Period</span>
                    <span className="text-zinc-950 dark:text-white font-bold">{client.lockingPeriod ? `${client.lockingPeriod} Days` : "—"}</span>
                  </div>
                  <div className="col-span-2 flex justify-between py-1 border-t border-zinc-150 dark:border-zinc-805 pt-3">
                    <span className="text-zinc-455 font-medium">Payment terms / Mode</span>
                    <span className="text-zinc-900 dark:text-white font-bold">{client.paymentMode || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Custom fields details */}
              {hasCustomFields && (
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Additional Metadata Fields
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(client.customFields).map(([key, val]) => {
                      if (val === undefined || val === null || val === "") return null;
                      const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                      return (
                        <div key={key} className="bg-zinc-50/50 dark:bg-zinc-900/20 px-4 py-3.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 flex justify-between items-center text-xs font-semibold">
                          <span className="text-zinc-455 font-medium">{label}</span>
                          <span className="text-zinc-900 dark:text-white font-bold">{String(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Terms and Notes block */}
              {(client.terms || client.notes) && (
                <div className="grid md:grid-cols-2 gap-6 pt-2">
                  {client.terms && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Special Terms & Conditions</span>
                      <p className="text-xs text-zinc-655 dark:text-zinc-400 leading-relaxed font-semibold whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-955 p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 font-sans">{client.terms}</p>
                    </div>
                  )}
                  {client.notes && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Internal Account Notes</span>
                      <p className="text-xs text-zinc-655 dark:text-zinc-400 leading-relaxed font-semibold whitespace-pre-wrap bg-amber-50/20 dark:bg-amber-955/10 p-4 rounded-2xl border border-amber-100/20 dark:border-amber-900/10 font-sans">{client.notes}</p>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

          {/* Footer Actions */}
          <div className="px-8 py-5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-955/50 flex justify-end gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 rounded-xl text-xs font-bold uppercase tracking-wide shadow-md transition-all duration-150"
            >
              Close Fact Sheet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- CLIENT CANDIDATES POPUP MODAL ---------------- */
const ClientCandidatesModal = ({ client, onClose, getAuthHeader }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeader();
        const res = await fetch(`${API_URL}/submissions?clientName=${encodeURIComponent(client.companyName)}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data);
        }
      } catch (err) {
        console.error("Failed to load candidate submissions for client modal:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [client, getAuthHeader]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />

      {/* Modal Content */}
      <div 
        className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Block */}
        <div className="px-6 py-5 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-955 flex items-center justify-between gap-4 select-none shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 font-bold shrink-0" />
              Submissions for {client.companyName}
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Submitted candidates list & related client agreement terms</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-zinc-455 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-150 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable layout splits into Client Terms details & Candidate List) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Related Client Details banner */}
          <div className="bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-150/40 dark:border-indigo-900/30 rounded-2xl p-5 select-none">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" /> Related Client Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Short Code</span>
                <span className="text-zinc-900 dark:text-white font-bold">{client.clientId || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Commission Fee</span>
                <span className="text-zinc-900 dark:text-white font-bold">{client.percentage ? `${client.percentage}%` : "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Replacement Period</span>
                <span className="text-zinc-900 dark:text-white font-bold">{client.replacementPeriod ? `${client.replacementPeriod} Days` : "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Locking Period</span>
                <span className="text-zinc-900 dark:text-white font-bold">{client.lockingPeriod ? `${client.lockingPeriod} Days` : "—"}</span>
              </div>
              {client.contactPerson && (
                <div className="col-span-2 md:col-span-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Primary Contact</span>
                  <span className="text-zinc-900 dark:text-white font-bold block truncate">{client.contactPerson}</span>
                </div>
              )}
              {client.email && (
                <div className="col-span-2 md:col-span-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Contact Email</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold block truncate">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="col-span-2 md:col-span-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Contact Phone</span>
                  <span className="text-zinc-900 dark:text-white font-bold block truncate">{client.phone}</span>
                </div>
              )}
              {client.clientLocation && (
                <div className="col-span-2 md:col-span-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Location</span>
                  <span className="text-zinc-900 dark:text-white font-bold block truncate">{client.clientLocation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submissions Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-550 dark:text-zinc-400">
              Submitted Candidates ({submissions.length})
            </h3>
            
            {loading ? (
              <div className="py-12 text-center text-zinc-500 flex flex-col items-center">
                <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin mb-3"></div>
                Loading candidates...
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-12 border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 rounded-2xl text-center text-sm font-semibold text-zinc-400">
                No candidates have been submitted to this client yet.
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-semibold whitespace-nowrap">
                    <thead className="bg-zinc-50/70 border-b border-zinc-200 dark:bg-zinc-955/30 dark:border-zinc-800/80 text-[10px] text-zinc-400 dark:text-zinc-505 uppercase tracking-wider select-none">
                      <tr>
                        <th className="px-5 py-3 font-bold">Candidate Name</th>
                        <th className="px-5 py-3 font-bold">Job Position</th>
                        <th className="px-5 py-3 font-bold">Pipeline Stage</th>
                        <th className="px-5 py-3 font-bold">Submitted By</th>
                        <th className="px-5 py-3 font-bold">Submission Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-zinc-700 dark:text-zinc-300">
                      {submissions.map((sub) => {
                        const candidate = sub.candidateId || {};
                        const candidateName = candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown';
                        return (
                          <tr key={sub._id || sub.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/10">
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-zinc-900 dark:text-white text-sm">{candidateName}</div>
                              <div className="text-[10px] text-zinc-405 mt-0.5">{candidate.email || 'No email'} • {candidate.contact || 'No contact'}</div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-zinc-800 dark:text-zinc-250 text-sm">{sub.position}</div>
                              <div className="text-[10px] font-mono tracking-wide text-zinc-450 mt-0.5">{sub.jobCode}</div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-750 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                                {sub.pipelineStage || sub.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="text-zinc-850 dark:text-zinc-300 font-bold">{sub.submittedByName || 'system'}</div>
                            </td>
                            <td className="px-5 py-3.5 text-zinc-450 dark:text-zinc-500 font-medium">
                              {new Date(sub.submittedAt || sub.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
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

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955 flex justify-end shrink-0 select-none">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 rounded-xl text-xs font-bold uppercase tracking-wide shadow-md"
          >
            Close list
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- MAIN DASHBOARD ---------------- */
export default function AdminClientInfo() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();

  const getAuthHeader = useCallback(async () => ({
    "Content-Type": "application/json",
    ...(await authHeaders()),
  }), [authHeaders]);

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedClient, setSelectedClient] = useState(null);
  const [submissionsModalClient, setSubmissionsModalClient] = useState(null);
  const [errors, setErrors] = useState({});

  // ADDED NEW FIELDS TO INITIAL STATE
  const initialFormState = {
    companyName: "", contactPerson: "", email: "", phone: "", website: "",
    address: "", locationLink: "", industry: "", gstNumber: "", notes: "",
    clientId: "", percentage: "", candidatePeriod: "", replacementPeriod: "",
    lockingPeriod: "", paymentMode: "", clientLocation: "", // New Fields
    terms: "", customFields: {}, active: true,
  };
  const [form, setForm] = useState(initialFormState);
  const [clientFieldConfig, setClientFieldConfig] = useState(getClientFieldConfig);
  const [clientFormControlOpen, setClientFormControlOpen] = useState(false);
  const [formTab, setFormTab] = useState("company");

  const handleClientConfigChange = (updated) => {
    const normalized = normalizeClientFieldConfig(updated);
    setClientFieldConfig(normalized);
    saveClientFieldConfig(normalized);
  };

  const isClientFieldVisible = (fieldName) => {
    const field = clientFieldConfig.fields.find(item => item.fieldName === fieldName);
    return field ? field.visible !== false : true;
  };

  const visibleCustomClientFields = useMemo(
    () => clientFieldConfig.customFields.filter(field => field.visible),
    [clientFieldConfig]
  );

  const handleCustomClientFieldChange = (fieldName, value) => {
    setForm(prev => ({ ...prev, customFields: { ...prev.customFields, [fieldName]: value } }));
  };

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/clients`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClients(data.map((c) => ({ ...c, id: c._id })));
    } catch {
      toast({ title: "Error", description: "Failed to load clients", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { fetchClients(); }, []);

  const validateForm = () => {
    const e = {};

    // ── Company Name: required, letters/spaces/punctuation only, 2–100 chars
    if (!form.companyName.trim()) {
      e.companyName = "Company name is required";
    } else if (!/^[a-zA-Z\s'.,&()\-]{2,100}$/.test(form.companyName.trim())) {
      e.companyName = "Company name must contain letters only (no numbers)";
    }

    // ── Contact Person: optional, letters/spaces only if filled ──────────────
    if (form.contactPerson.trim() && !/^[a-zA-Z\s'.'\-]{2,80}$/.test(form.contactPerson.trim())) {
      e.contactPerson = "Contact person must be letters only (2–80 chars)";
    }

    // ── Email: optional, valid format if filled ───────────────────────────────
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      e.email = "Enter a valid email address (e.g. name@company.com)";
    }

    // ── Phone: optional, exactly 10 digits starting with 6-9 if filled ───────
    if (form.phone.trim()) {
      const cleanPhone = form.phone.replace(/[\s\-+]/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        e.phone = "Enter a valid 10-digit Indian mobile number (starts with 6–9)";
      }
    }

    // ── Industry: optional, letters/spaces only if filled ────────────────────
    if (form.industry.trim() && !/^[a-zA-Z\s&\/\-,]{2,80}$/.test(form.industry.trim())) {
      e.industry = "Industry must be letters only (2–80 chars)";
    }

    // ── Website: optional, must look like a URL if filled ────────────────────
    if (form.website.trim() && !/^(https?:\/\/)?(www\.)?[\w\-]+\.[a-zA-Z]{2,}(\/\S*)?$/.test(form.website.trim())) {
      e.website = "Enter a valid website URL (e.g. https://company.com)";
    }

    // ── GST Number: optional, standard 15-char Indian GST format if filled ───
    if (form.gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.trim().toUpperCase())) {
      e.gstNumber = "Enter a valid 15-character GST number (e.g. 22AAAAA0000A1Z5)";
    }

    // ── Commission %: optional, must be a number 0–100 if filled ─────────────
    if (form.percentage.toString().trim() !== "") {
      const pct = Number(form.percentage);
      if (isNaN(pct) || !/^\d+(\.\d+)?$/.test(form.percentage.toString().trim())) {
        e.percentage = "Commission must be a number (e.g. 15 or 15.5)";
      } else if (pct < 0 || pct > 100) {
        e.percentage = "Commission % must be between 0 and 100";
      }
    }

    // ── Candidate Period: optional, must be a positive integer (months) ───────
    if (form.candidatePeriod.toString().trim() !== "") {
      const cp = Number(form.candidatePeriod);
      if (!Number.isInteger(cp) || cp < 1 || cp > 120) {
        e.candidatePeriod = "Must be a whole number of months (1–120)";
      }
    }

    // ── Replacement Period: optional, must be a positive integer (days) ───────
    if (form.replacementPeriod.toString().trim() !== "") {
      const rp = Number(form.replacementPeriod);
      if (!Number.isInteger(rp) || rp < 1 || rp > 365) {
        e.replacementPeriod = "Must be a whole number of days (1–365)";
      }
    }

    // ── Locking Period: optional, must be a positive integer (days) ────────────
    if (form.lockingPeriod.toString().trim() !== "") {
      const lp = Number(form.lockingPeriod);
      if (!Number.isInteger(lp) || lp < 1 || lp > 365) {
        e.lockingPeriod = "Locking period must be a whole number of days (1–365)";
      }
    }

    // ── Payment Mode: optional, letters/numbers/hyphens if filled ────────────
    if (form.paymentMode.trim() && !/^[a-zA-Z0-9\s\-\/]{2,50}$/.test(form.paymentMode.trim())) {
      e.paymentMode = "Payment mode must be 2–50 alphanumeric characters (e.g. Net-30)";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "phone" && /[^0-9]/.test(value)) return;
    if (name === "phone" && value.length > 10) return;
    if (name === "lockingPeriod" && value !== "" && /[^0-9]/.test(value)) return;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    if (errors[name]) {
      const copy = { ...errors };
      delete copy[name];
      setErrors(copy);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      const url = editingClient ? `${API_URL}/clients/${editingClient.id}` : `${API_URL}/clients`;
      const headers = await getAuthHeader();
      const res = await fetch(url, {
        method: editingClient ? "PUT" : "POST",
        headers,
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      const normalized = { ...saved, id: saved._id };

      // Update local state directly — no full refetch needed
      if (editingClient) {
        setClients(prev => prev.map(c => c.id === editingClient.id ? normalized : c));
      } else {
        setClients(prev => [normalized, ...prev]);
      }

      toast({ title: "Success", description: "Client saved successfully" });
      setShowForm(false);
      setEditingClient(null);
      setForm(initialFormState);
    } catch {
      toast({ title: "Error", description: "Save failed", variant: "destructive" });
    }
  };

  const handleEditClient = (client) => {
    setErrors({});
    setEditingClient(client);
    setForm({
      ...initialFormState, ...client,
      percentage: client.percentage?.toString() || "",
      candidatePeriod: client.candidatePeriod?.toString() || "",
      replacementPeriod: client.replacementPeriod?.toString() || "",
      lockingPeriod: client.lockingPeriod || "",
      paymentMode: client.paymentMode || "",
      clientLocation: client.clientLocation || "",
      customFields: client.customFields || {},
      active: client.active !== false,
    });
    setFormTab("company");
    setShowForm(true);
  };

  const handleToggleActive = async (client) => {
    try {
      const headers = await getAuthHeader();
      const nextActive = client.active === false;
      await fetch(`${API_URL}/clients/${client.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ active: nextActive }),
      });
      // Update local state directly — no full refetch
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, active: nextActive } : c));
    } catch { }
  };

  const uniqueIndustries = useMemo(() => Array.from(new Set(clients.map((c) => c.industry).filter(Boolean))), [clients]);

  const filteredClients = useMemo(() => clients.filter((c) => {
    const s = searchTerm.toLowerCase();
    const matchSearch = c.companyName.toLowerCase().includes(s) || 
                        (c.email || "").toLowerCase().includes(s) || 
                        (c.contactPerson || "").toLowerCase().includes(s);
    const matchIndustry = industryFilter === "all" || c.industry === industryFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? c.active !== false : c.active === false);
    return matchSearch && matchIndustry && matchStatus;
  }), [clients, searchTerm, industryFilter, statusFilter]);

  const getFieldsForTab = (tabId) => {
    switch (tabId) {
      case "company":
        return ["companyName", "industry", "clientLocation", "website", "gstNumber", "locationLink", "address"];
      case "contact":
        return ["contactPerson", "email", "phone"];
      case "commercial":
        return ["percentage", "candidatePeriod", "replacementPeriod", "lockingPeriod", "paymentMode", "terms", "notes"];
      default:
        return [];
    }
  };

  const tabs = [
    { id: "company", label: "Company Info", icon: Building2 },
    { id: "contact", label: "Contact Details", icon: User },
    { id: "commercial", label: "Commercial Terms", icon: DollarSign },
    ...(visibleCustomClientFields.length > 0 ? [{ id: "custom", label: "Custom Fields", icon: SlidersHorizontal }] : []),
  ];

  // Dynamic statistics calculations
  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter(c => c.active !== false).length;
    const commissions = clients.map(c => Number(c.percentage)).filter(pct => !isNaN(pct) && pct > 0);
    const avgCommission = commissions.length > 0
      ? (commissions.reduce((a, b) => a + b, 0) / commissions.length).toFixed(1)
      : "0";
    return { total, active, avgCommission };
  }, [clients]);

  const renderClientField = (name, label, options = {}) => {
    if (!isClientFieldVisible(name)) return null;
    const { type = "text", placeholder = "", required = false, textarea = false } = options;
    const hasError = !!errors[name];

    // Icon mapping for inputs
    const iconMap = {
      companyName: Building2,
      industry: Tag,
      clientLocation: MapPin,
      website: Globe,
      gstNumber: FileText,
      locationLink: ExternalLink,
      address: MapPin,
      contactPerson: User,
      email: Mail,
      phone: Phone,
      percentage: Percent,
      candidatePeriod: Calendar,
      replacementPeriod: Calendar,
      lockingPeriod: Lock,
      paymentMode: CreditCard,
      terms: StickyNote,
      notes: StickyNote,
    };
    const IconComponent = iconMap[name] || null;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        <label className="text-xs font-semibold text-zinc-555 dark:text-zinc-400 flex items-center gap-1 select-none">
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
        <div className="relative rounded-xl shadow-sm transition-all duration-200">
          {IconComponent && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-455 dark:text-zinc-505">
              <IconComponent className="w-4 h-4" />
            </div>
          )}
          {textarea ? (
            <textarea
              name={name}
              value={form[name] || ""}
              onChange={handleChange}
              placeholder={placeholder}
              rows={name === "terms" ? 4 : 3}
              className={`w-full ${IconComponent ? "pl-10" : "px-4"} pr-4 py-2.5 text-sm border bg-white dark:bg-zinc-900 dark:text-zinc-100 rounded-xl outline-none transition-all resize-none placeholder-zinc-400 dark:placeholder-zinc-650 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-indigo-400/20 dark:focus:border-indigo-400 ${
                hasError 
                  ? "border-red-500 dark:border-red-500 focus:ring-red-500/20 focus:border-red-500" 
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-355 hover:border-zinc-350 dark:hover:border-zinc-700"
              }`}
            />
          ) : (
            <input
              type={type}
              name={name}
              value={form[name] || ""}
              onChange={handleChange}
              placeholder={placeholder}
              className={`w-full ${IconComponent ? "pl-10" : "px-4"} pr-4 py-2.5 text-sm border bg-white dark:bg-zinc-900 dark:text-zinc-100 rounded-xl outline-none transition-all placeholder-zinc-400 dark:placeholder-zinc-650 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-indigo-400/20 dark:focus:border-indigo-400 ${
                hasError 
                  ? "border-red-500 dark:border-red-500 focus:ring-red-500/20 focus:border-red-500" 
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700"
              }`}
            />
          )}
        </div>
        {hasError && <p className="text-xs text-rose-500 dark:text-rose-455 mt-0.5 select-none font-medium">{errors[name]}</p>}
      </div>
    );
  };

  return (
    <div className="flex-1 p-6 space-y-6 bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100 font-sans">

      {/* Header Panel */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between select-none">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white leading-none">Clients Profile</h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Corporate partners fact sheet &amp; parameters</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setClientFormControlOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:bg-zinc-955 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800"
            >
              Form Settings
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setEditingClient(null);
                setShowForm(true);
                setForm(initialFormState);
                setErrors({});
                setFormTab("company");
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white shadow-md transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              <Plus className="h-4 w-4" />
              Add Client Partner
            </button>
          </div>
        </div>

        {/* Dynamic Filters Bar */}
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              placeholder="Search by company, email, or contact name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-11 w-full pl-10 pr-4 rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-955 dark:text-white dark:focus:border-zinc-700 placeholder-zinc-405"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={industryFilter}
              onChange={e => setIndustryFilter(e.target.value)}
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-500/20 dark:bg-zinc-955 dark:text-zinc-300 dark:border-zinc-800 sm:w-44"
            >
              <option value="all">All Industries</option>
              {uniqueIndustries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-500/20 dark:bg-zinc-955 dark:text-zinc-300 dark:border-zinc-800 sm:w-40"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 select-none">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider">Total Partnerships</p>
            <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1 leading-none">{stats.total}</h3>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-455 dark:text-zinc-500 uppercase tracking-wider">Active Partners</p>
            <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1 leading-none">{stats.active}</h3>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-455 dark:text-zinc-505 uppercase tracking-wider">Avg Placement Rate</p>
            <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1 leading-none">{stats.avgCommission}%</h3>
          </div>
        </div>
      </div>

      {/* Client Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300" onClick={() => { setShowForm(false); setEditingClient(null); setErrors({}); }} />

          {/* Modal Container */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] border border-zinc-200 dark:border-zinc-800/80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955 flex items-center justify-between gap-4 select-none">
              <div>
                <h3 className="font-extrabold text-xl text-zinc-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  {editingClient ? "Edit Client Profile" : "Create New Client"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Configure client details, point of contact, and business terms.</p>
              </div>
              <div className="flex items-center gap-2.5">
                {!editingClient && (
                  <button onClick={() => setClientFormControlOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Form Fields
                  </button>
                )}
                <button
                  onClick={() => { setShowForm(false); setEditingClient(null); setErrors({}); }}
                  className="p-1.5 rounded-lg text-zinc-455 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-white dark:bg-zinc-900 flex flex-col">
              
              {/* Form Tabs */}
              <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-805 pb-3.5 mb-5 overflow-x-auto select-none">
                {tabs.map(tab => {
                  const TabIcon = tab.icon;
                  const isSelected = formTab === tab.id;
                  const hasFieldsInTab = getFieldsForTab(tab.id).some(fName => isClientFieldVisible(fName)) || tab.id === "custom";
                  if (!hasFieldsInTab) return null;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFormTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                        isSelected 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-105" 
                          : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <TabIcon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Form Inputs Container */}
              <div className="flex-1 space-y-5 min-h-[300px]">
                {formTab === "company" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderClientField("companyName", "Company Name", { required: true, placeholder: "e.g. Acme Corporation" })}
                    {renderClientField("industry", "Industry", { placeholder: "e.g. Information Technology" })}
                    {renderClientField("clientLocation", "Client Location", { placeholder: "e.g. Mumbai, Maharashtra" })}
                    {renderClientField("website", "Website URL", { type: "url", placeholder: "https://acme.com" })}
                    {renderClientField("gstNumber", "GST Number", { placeholder: "e.g. 22AAAAA0000A1Z5" })}
                    {renderClientField("locationLink", "Google Maps Link", { type: "url", placeholder: "https://maps.google.com/..." })}
                    <div className="md:col-span-2">
                      {renderClientField("address", "Registered Address", { textarea: true, placeholder: "Full office address..." })}
                    </div>
                  </div>
                )}

                {formTab === "contact" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderClientField("contactPerson", "Contact Person Name", { placeholder: "e.g. John Doe" })}
                    {renderClientField("email", "Business Email", { type: "email", placeholder: "johndoe@acme.com" })}
                    <div className="md:col-span-2">
                      {renderClientField("phone", "Mobile / Phone (10 digits)", { type: "tel", placeholder: "e.g. 9876543210" })}
                    </div>
                  </div>
                )}

                {formTab === "commercial" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderClientField("percentage", "Placement Commission %", { placeholder: "e.g. 8.33" })}
                    {renderClientField("candidatePeriod", "Candidate Period (Months)", { placeholder: "e.g. 3" })}
                    {renderClientField("replacementPeriod", "Replacement Period (Days)", { placeholder: "e.g. 90" })}
                    {renderClientField("lockingPeriod", "Locking Period (Days)", { placeholder: "e.g. 60" })}
                    {renderClientField("paymentMode", "Payment Mode / Net Days", { placeholder: "e.g. Net 15" })}
                    <div className="md:col-span-2">
                      {renderClientField("terms", "Special Terms & Conditions", { textarea: true, placeholder: "Add custom clauses or agreement specifics here..." })}
                    </div>
                    <div className="md:col-span-2">
                      {renderClientField("notes", "Internal Account Notes", { textarea: true, placeholder: "Enter internal notes regarding this client..." })}
                    </div>
                  </div>
                )}

                {formTab === "custom" && (
                  <div>
                    {visibleCustomClientFields.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {visibleCustomClientFields.map(field => (
                          <div key={field.fieldName} className={field.fieldType === "textarea" ? "md:col-span-2" : ""}>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 select-none">{field.label}</label>
                            <ClientCustomFieldInput field={field} value={form.customFields?.[field.fieldName]} onChange={handleCustomClientFieldChange} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955/20 p-8 text-center">
                        <SlidersHorizontal className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No additional fields active</p>
                        <p className="text-xs text-zinc-455 mt-1">Configure additional custom fields in Form Settings.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Navigation Footer */}
              <div className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-805 flex justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingClient(null); setErrors({}); }}
                  className="px-5 py-2.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors uppercase tracking-wider"
                >
                  Cancel
                </button>
                <div className="flex gap-2">
                  {tabs.findIndex(t => t.id === formTab) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = tabs.findIndex(t => t.id === formTab);
                        setFormTab(tabs[idx - 1].id);
                      }}
                      className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-905 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 uppercase tracking-wider"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                  )}
                  {tabs.findIndex(t => t.id === formTab) < tabs.length - 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = tabs.findIndex(t => t.id === formTab);
                        setFormTab(tabs[idx + 1].id);
                      }}
                      className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 uppercase tracking-wider"
                    >
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 rounded-xl text-xs font-extrabold transition-all uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-zinc-950/10 dark:shadow-none"
                  >
                    {editingClient ? "Update Client" : "Save Client"}
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="text-center p-12 text-zinc-500 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-805 rounded-full animate-spin mb-4"></div>
          Loading client information...
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left whitespace-nowrap border-collapse">
              <thead className="bg-zinc-50/70 text-[10.5px] uppercase tracking-widest text-zinc-400 border-b border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-505 dark:border-zinc-800/80 select-none">
                <tr>
                  <th className="px-6 py-3 font-bold">Client Code</th>
                  <th className="px-6 py-3 font-bold">Client Profile</th>
                  <th className="px-6 py-3 font-bold">Primary Contact</th>
                  <th className="px-6 py-3 font-bold">Terms &amp; Commission</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  <th className="px-6 py-3 font-bold text-right pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredClients.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-20 text-sm font-semibold text-zinc-400 dark:text-zinc-500">No clients found matching filter criteria.</td></tr>
                ) : filteredClients.map((client) => {
                  const clientCode = client.clientCode || client.code || client.shortCode || (client.companyName || "CLI")
                    .replace(/[^a-zA-Z]/g, "")
                    .slice(0, 3)
                    .toUpperCase() || "CLI";

                  const rowInitials = (client.companyName || "C")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  // Premium dynamic color assignment for avatars
                  const colors = [
                    "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-150/40 dark:border-indigo-900/30",
                    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-450 border border-emerald-150/40 dark:border-indigo-900/30",
                    "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-150/40 dark:border-indigo-900/30",
                    "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-150/40 dark:border-indigo-900/30",
                    "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-150/40 dark:border-indigo-900/30",
                  ];
                  const colorIdx = (client.companyName || "").charCodeAt(0) % colors.length;
                  const avatarClass = colors[colorIdx];

                  return (
                  <tr key={client.id} className="transition duration-150 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/15">
                    {/* Column 1: Client Code */}
                    <td className="px-6 py-2.5">
                      <span className="inline-flex min-w-[50px] items-center justify-center rounded-lg bg-zinc-100/70 border border-zinc-200/80 dark:border-zinc-800 dark:bg-zinc-955 px-2.5 py-1 text-sm font-mono font-bold leading-none text-zinc-700 dark:text-zinc-355 shadow-sm select-all">
                        {client.clientId || clientCode}
                      </span>
                    </td>

                    {/* Column 2: Client Profile */}
                    <td className="px-6 py-2.5">
                      <div className="flex items-center gap-3.5">
                        <div 
                          onClick={() => setSelectedClient(client)}
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-[13.5px] shrink-0 select-none cursor-pointer transition transform hover:scale-105 ${avatarClass}`}
                        >
                          {rowInitials}
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span 
                              onClick={() => setSelectedClient(client)}
                              className="text-base font-bold text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors leading-tight"
                            >
                              {client.companyName}
                            </span>
                            {!!client.submissionCount && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSubmissionsModalClient(client); }} 
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-855 dark:hover:text-indigo-300 font-bold hover:underline transition-colors text-sm shrink-0 leading-none"
                              >
                                ({client.submissionCount})
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5 font-medium leading-none select-none">
                            {client.industry && (
                              <span className="bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded text-[11px] text-zinc-650 dark:text-zinc-455 border border-zinc-200/40 dark:border-zinc-700/40">
                                {client.industry}
                              </span>
                            )}
                            {client.clientLocation && (
                              <span className="flex items-center gap-0.5 text-zinc-400">
                                <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                                {client.clientLocation}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 3: Primary Contact */}
                    <td className="px-6 py-2.5">
                      {client.contactPerson ? (
                        <div className="text-base font-semibold leading-tight text-zinc-850 dark:text-zinc-100">{client.contactPerson}</div>
                      ) : (
                        <span className="text-zinc-350 dark:text-zinc-700 font-normal text-sm select-none">No contact added</span>
                      )}
                      {client.phone && (
                        <div className="mt-1.5 text-sm text-zinc-400 font-semibold flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <a href={`tel:${client.phone}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{client.phone}</a>
                        </div>
                      )}
                    </td>

                    {/* Column 4: Terms & Commission */}
                    <td className="px-6 py-2.5">
                      {client.percentage ? (
                        <div className="text-base font-bold leading-none text-zinc-850 dark:text-zinc-100">{client.percentage}% fee</div>
                      ) : (
                        <span className="text-zinc-355 dark:text-zinc-700 font-normal text-sm select-none">No commission fee</span>
                      )}
                      <div className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1.5 font-medium leading-none select-none">
                        <span>{client.replacementPeriod ? `${client.replacementPeriod}d replacement` : "no replacement"}</span>
                        {client.lockingPeriod && <span>• {client.lockingPeriod}d locking</span>}
                      </div>
                    </td>
                    <td className="px-6 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                        client.active !== false
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/20"
                          : "bg-zinc-100 text-zinc-505 dark:bg-zinc-800/40 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800/50"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${client.active !== false ? "bg-emerald-505 animate-pulse" : "bg-zinc-400"}`} />
                        {client.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-right pr-8">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedClient(client)}
                          title="View Details"
                          className="p-2 rounded-xl text-zinc-400 hover:text-indigo-650 hover:bg-indigo-50 dark:text-zinc-555 dark:hover:text-indigo-400 dark:hover:bg-indigo-955/30 transition-all duration-150"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditClient(client)}
                          title="Edit Profile"
                          className="p-2 rounded-xl text-zinc-400 hover:text-amber-650 hover:bg-amber-50 dark:text-zinc-555 dark:hover:text-amber-400 dark:hover:bg-amber-955/30 transition-all duration-150"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(client)}
                          title={client.active !== false ? "Deactivate Partner" : "Activate Partner"}
                          className={`p-2 rounded-xl transition-all duration-150 ${
                            client.active !== false
                              ? "text-zinc-400 hover:text-rose-650 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-455 dark:hover:bg-rose-955/30"
                              : "text-zinc-400 hover:text-emerald-650 hover:bg-emerald-50 dark:text-zinc-500 dark:hover:text-emerald-455 dark:hover:bg-emerald-955/30"
                          }`}
                        >
                          {client.active !== false ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ClientFormControlModal
        isOpen={clientFormControlOpen}
        onClose={() => setClientFormControlOpen(false)}
        config={clientFieldConfig}
        onConfigChange={handleClientConfigChange}
      />

      {/* Render Modal */}
      {selectedClient && <ClientDetailCard client={selectedClient} onClose={() => setSelectedClient(null)} />}

      {submissionsModalClient && (
        <ClientCandidatesModal
          client={submissionsModalClient}
          onClose={() => setSubmissionsModalClient(null)}
          getAuthHeader={getAuthHeader}
        />
      )}
    </div>
  );
}