import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  Building2, User, X, Eye, Pencil, Plus, CheckCircle, Ban, MapPin, DollarSign, Clock, Trash2,
  Settings2, Check, GripVertical, Loader2
} from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

// Sleek Grey Input Styling
const inputCls = "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-500 bg-white dark:bg-zinc-900 dark:text-zinc-100 transition-shadow placeholder-zinc-400";

const getCurrentUser = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getTenantClientSettings = () => {
  const user = getCurrentUser();
  return user?.clientSettings || { hiddenFields: [], customFields: [] };
};

const OPTIONAL_STANDARD_FIELDS = [
  { id: 'phone', label: 'Phone' },
  { id: 'website', label: 'Website' },
  { id: 'address', label: 'Address' },
  { id: 'clientLocation', label: 'Client Location' },
  { id: 'industry', label: 'Industry' },
  { id: 'gstNumber', label: 'GST Number' },
  { id: 'percentage', label: 'Commission Rate' },
  { id: 'candidatePeriod', label: 'Candidate Period' },
  { id: 'replacementPeriod', label: 'Replacement Period' },
  { id: 'lockingPeriod', label: 'Locking Period' },
  { id: 'paymentMode', label: 'Payment Mode' },
  { id: 'terms', label: 'Terms & Conditions' }
];

const CustomFieldInput = ({ cf, value, onChange }) => {
  if (cf.fieldType === 'boolean') {
    return (
      <select
        value={value || 'false'}
        onChange={(e) => onChange(cf.fieldName, e.target.value)}
        className={inputCls}
      >
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

/* ---------------- DETAIL MODAL ---------------- */
const ClientDetailCard = ({ client, onClose }) => {
  const settings = getTenantClientSettings();
  const hiddenFields = settings.hiddenFields || [];
  const isHidden = (fieldId) => hiddenFields.includes(fieldId);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Grey Gradient Header */}
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 text-white p-6 rounded-t-2xl border-b border-zinc-700">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{client.companyName}</h2>
                <div className="flex items-center gap-3 mt-2 text-zinc-300 text-sm">
                  <span className="bg-zinc-800 px-2 py-1 rounded-md border border-zinc-700 text-xs font-mono">
                    {client.clientId}
                  </span>
                  {client.companyCode && <span className="bg-blue-900/30 text-blue-300 px-2 py-1 rounded-md border border-blue-800 text-xs font-bold uppercase tracking-wider">{client.companyCode}</span>}
                  {!isHidden('industry') && client.industry && <span>• {client.industry}</span>}
                  {!isHidden('clientLocation') && client.clientLocation && <span>• {client.clientLocation}</span>}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 text-zinc-800 dark:text-zinc-300">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Contact Info Card */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  <User className="w-5 h-5 text-zinc-500" /> Contact Details
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="flex justify-between"><span className="text-zinc-500">Contact Person:</span> <span className="font-medium">{client.contactPerson || "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Email:</span> <span className="font-medium">{client.email || "-"}</span></p>
                  {!isHidden('phone') && <p className="flex justify-between"><span className="text-zinc-500">Phone:</span> <span className="font-medium">{client.phone || "-"}</span></p>}
                  {!isHidden('website') && <p className="flex justify-between"><span className="text-zinc-500">Website:</span> <span className="font-medium">{client.website || "-"}</span></p>}
                  {!isHidden('clientLocation') && <p className="flex justify-between"><span className="text-zinc-500">Location:</span> <span className="font-medium">{client.clientLocation || "-"}</span></p>}
                  {!isHidden('address') && client.address && <div className="pt-2"><span className="text-zinc-500 block mb-1">Address:</span> <p className="font-medium text-xs leading-relaxed">{client.address || "-"}</p></div>}
                </div>
              </div>

              {/* Business Terms Card */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  <Building2 className="w-5 h-5 text-zinc-500" /> Business Terms
                </h3>
                <div className="space-y-3 text-sm">
                  {!isHidden('percentage') && <p className="flex justify-between"><span className="text-zinc-500">Commission Rate:</span> <span className="font-medium">{client.percentage ? `${client.percentage}%` : "-"}</span></p>}
                  {!isHidden('candidatePeriod') && <p className="flex justify-between"><span className="text-zinc-500">Candidate Period:</span> <span className="font-medium">{client.candidatePeriod ? `${client.candidatePeriod} months` : "-"}</span></p>}
                  {!isHidden('replacementPeriod') && <p className="flex justify-between"><span className="text-zinc-500">Replacement:</span> <span className="font-medium">{client.replacementPeriod ? `${client.replacementPeriod} days` : "-"}</span></p>}
                  {!isHidden('lockingPeriod') && <p className="flex justify-between"><span className="text-zinc-500">Locking Period:</span> <span className="font-medium">{client.lockingPeriod || "-"}</span></p>}
                  {!isHidden('paymentMode') && <p className="flex justify-between"><span className="text-zinc-500">Payment Mode:</span> <span className="font-medium">{client.paymentMode || "-"}</span></p>}
                  {!isHidden('gstNumber') && <p className="flex justify-between"><span className="text-zinc-500">GST Number:</span> <span className="font-medium font-mono text-xs">{client.gstNumber || "-"}</span></p>}
                  <p className="flex justify-between"><span className="text-zinc-500">Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${client.active ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {client.active ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Fields Card */}
            {client.customFields && Object.keys(client.customFields).filter(key => !isHidden(key)).length > 0 && (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold text-lg mb-4 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  Additional Details
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  {Object.entries(client.customFields).filter(([key]) => !isHidden(key)).map(([key, val]) => (
                    <p key={key} className="flex justify-between border-b border-zinc-100 dark:border-zinc-800/50 pb-2">
                      <span className="text-zinc-500">{key}:</span>
                      <span className="font-medium">{val === 'true' ? 'Yes' : val === 'false' ? 'No' : val || '-'}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {!isHidden('terms') && client.terms && (
              <div className="bg-zinc-100 dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <h4 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-100">Terms & Conditions</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{client.terms}</p>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

/* ---------------- MAIN DASHBOARD ---------------- */
export default function AdminClientInfo() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();

  const user = getCurrentUser();
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  const [tenantSettings, setTenantSettings] = useState(getTenantClientSettings);
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
  const [errors, setErrors] = useState({});

  // ADDED NEW FIELDS TO INITIAL STATE
  const initialFormState = {
    companyName: "", companyId: "", companyCode: "", contactPerson: "", email: "", phone: "", website: "",
    address: "", locationLink: "", industry: "", gstNumber: "", notes: "",
    clientId: "", percentage: "", candidatePeriod: "", replacementPeriod: "",
    lockingPeriod: "", paymentMode: "", clientLocation: "", // New Fields
    terms: "", active: true,
    customFields: {},
  };
  const [form, setForm] = useState(initialFormState);

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
    setEditingClient(client);
    setForm({
      ...initialFormState, ...client,
      companyCode: client.companyCode || "",
      percentage: client.percentage?.toString() || "",
      candidatePeriod: client.candidatePeriod?.toString() || "",
      replacementPeriod: client.replacementPeriod?.toString() || "",
      lockingPeriod: client.lockingPeriod || "", // Handle new field
      paymentMode: client.paymentMode || "", // Handle new field
      clientLocation: client.clientLocation || "", // Handle new field
      active: client.active !== false,
      customFields: client.customFields || {},
    });
    setShowForm(true);
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setForm(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldName]: value
      }
    }));
  };

  const handleOpenSettings = () => {
    setTempHiddenFields([...hiddenFields]);
    setTempCustomFields([...tenantCustomFields]);
    setEditingFieldIndex(null);
    setNewFieldName('');
    setNewFieldType('text');
    setIsSettingsOpen(true);
  };

  const handleToggleHiddenField = (fieldId) => {
    setTempHiddenFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleAddOrUpdateCustomField = () => {
    if (!newFieldName.trim()) return;
    const name = newFieldName.trim();
    if (editingFieldIndex !== null) {
      setTempCustomFields((prev) =>
        prev.map((cf, idx) => (idx === editingFieldIndex ? { fieldName: name, fieldType: newFieldType } : cf))
      );
      setEditingFieldIndex(null);
    } else {
      if (tempCustomFields.some((cf) => cf.fieldName.toLowerCase() === name.toLowerCase())) {
        toast({ title: 'Duplicate Field', description: 'A field with this name already exists.', variant: 'destructive' });
        return;
      }
      setTempCustomFields((prev) => [...prev, { fieldName: name, fieldType: newFieldType }]);
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
    setTempCustomFields((prev) => prev.filter((_, i) => i !== idx));
    if (editingFieldIndex === idx) {
      setEditingFieldIndex(null);
      setNewFieldName('');
      setNewFieldType('text');
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = { clientSettings: { hiddenFields: tempHiddenFields, customFields: tempCustomFields } };
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: await getAuthHeader(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      const updatedUser = await res.json();
      const stored = sessionStorage.getItem('currentUser');
      if (stored) {
        const obj = JSON.parse(stored);
        obj.clientSettings = updatedUser.clientSettings;
        sessionStorage.setItem('currentUser', JSON.stringify(obj));
      }
      setTenantSettings(updatedUser.clientSettings || payload.clientSettings);
      setIsSettingsOpen(false);
      toast({ title: 'Saved!', description: 'Client form settings updated.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleActive = async (client) => {
    try {
      const headers = await getAuthHeader();
      await fetch(`${API_URL}/clients/${client.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ active: !client.active }),
      });
      // Update local state directly — no full refetch
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, active: !client.active } : c));
    } catch { }
  };

  // NEW: Delete Client Handler
  const handleDeleteClient = async (client) => {
    const isConfirmed = window.confirm(`Are you sure you want to delete ${client.companyName}? This action cannot be undone.`);
    if (!isConfirmed) return;

    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/clients/${client.id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error();
      // Remove from local state
      setClients(prev => prev.filter(c => c.id !== client.id));
      toast({ title: "Success", description: "Client deleted successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to delete client", variant: "destructive" });
    }
  };

  const uniqueIndustries = useMemo(() => Array.from(new Set(clients.map((c) => c.industry).filter(Boolean))), [clients]);

  const filteredClients = useMemo(() => clients.filter((c) => {
    const s = searchTerm.toLowerCase();
    const matchSearch = c.companyName.toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s);
    const matchIndustry = industryFilter === "all" || c.industry === industryFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? c.active !== false : c.active === false);
    return matchSearch && matchIndustry && matchStatus;
  }), [clients, searchTerm, industryFilter, statusFilter]);

  return (
    <div className="flex-1 p-6 space-y-8 bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Clients</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage client profiles and business terms</p>
        </div>
        <div className="flex items-center gap-3">
          {isManagerOrAdmin && (
            <button
              onClick={handleOpenSettings}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-850 shadow-sm"
            >
              <Settings2 className="w-4 h-4 text-zinc-500" />
              Form Settings
            </button>
          )}
          <button
            onClick={() => {
              setEditingClient(null);
              setShowForm(!showForm);
              setForm(initialFormState);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add Client"}
          </button>
        </div>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md overflow-hidden transition-all">
          <div className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-zinc-500" />
              {editingClient ? "Edit Client Profile" : "Create New Client"}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingClient(null);
                setForm(initialFormState);
              }}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Section 1: Company Profile */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2 border-l-2 border-zinc-500 pl-2">
                Company & Contact Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Fixed */}
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Company Name *</label>
                  <input name="companyName" value={form.companyName} onChange={handleChange} className={`${inputCls} ${errors.companyName ? 'border-red-500' : ''}`} />
                  {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Company Code</label>
                  <input name="companyCode" value={form.companyCode} onChange={handleChange} placeholder="e.g. MSFT, GOOG" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Contact Person</label>
                  <input name="contactPerson" value={form.contactPerson} onChange={handleChange} className={`${inputCls} ${errors.contactPerson ? 'border-red-500' : ''}`} />
                  {errors.contactPerson && <p className="text-xs text-red-500 mt-1">{errors.contactPerson}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
                  <input name="email" value={form.email} onChange={handleChange} className={`${inputCls} ${errors.email ? 'border-red-500' : ''}`} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                {/* Optionals */}
                {!isHidden('phone') && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Phone</label>
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit mobile number" className={`${inputCls} ${errors.phone ? 'border-red-500' : ''}`} />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                )}
                {!isHidden('website') && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Website</label>
                    <input name="website" value={form.website || ""} onChange={handleChange} placeholder="https://..." className={`${inputCls} ${errors.website ? 'border-red-500' : ''}`} />
                    {errors.website && <p className="text-xs text-red-500 mt-1">{errors.website}</p>}
                  </div>
                )}
                {!isHidden('industry') && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Industry</label>
                    <input name="industry" value={form.industry} onChange={handleChange} placeholder="e.g. IT, Healthcare" className={`${inputCls} ${errors.industry ? 'border-red-500' : ''}`} />
                    {errors.industry && <p className="text-xs text-red-500 mt-1">{errors.industry}</p>}
                  </div>
                )}
                {!isHidden('clientLocation') && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Client Location</label>
                    <input name="clientLocation" value={form.clientLocation} onChange={handleChange} placeholder="City, State" className={inputCls} />
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Business & Financial Terms */}
            {(!isHidden('percentage') || !isHidden('candidatePeriod') || !isHidden('replacementPeriod') || !isHidden('lockingPeriod') || !isHidden('paymentMode') || !isHidden('gstNumber')) && (
              <div className="space-y-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2 border-l-2 border-zinc-500 pl-2">
                  Business & Financial Terms
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {!isHidden('percentage') && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Commission %</label>
                      <input name="percentage" value={form.percentage} onChange={handleChange} placeholder="e.g. 15" className={`${inputCls} ${errors.percentage ? 'border-red-500' : ''}`} />
                      {errors.percentage && <p className="text-xs text-red-500 mt-1">{errors.percentage}</p>}
                    </div>
                  )}
                  {!isHidden('candidatePeriod') && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Candidate Period (months)</label>
                      <input name="candidatePeriod" value={form.candidatePeriod || ""} onChange={handleChange} placeholder="e.g. 3" className={`${inputCls} ${errors.candidatePeriod ? 'border-red-500' : ''}`} />
                      {errors.candidatePeriod && <p className="text-xs text-red-500 mt-1">{errors.candidatePeriod}</p>}
                    </div>
                  )}
                  {!isHidden('replacementPeriod') && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Replacement Period (days)</label>
                      <input name="replacementPeriod" value={form.replacementPeriod || ""} onChange={handleChange} placeholder="e.g. 90" className={`${inputCls} ${errors.replacementPeriod ? 'border-red-500' : ''}`} />
                      {errors.replacementPeriod && <p className="text-xs text-red-500 mt-1">{errors.replacementPeriod}</p>}
                    </div>
                  )}
                  {!isHidden('lockingPeriod') && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Locking Period (days)</label>
                      <input name="lockingPeriod" value={form.lockingPeriod} onChange={handleChange} placeholder="e.g. 30" className={`${inputCls} ${errors.lockingPeriod ? 'border-red-500' : ''}`} />
                      {errors.lockingPeriod && <p className="text-xs text-red-500 mt-1">{errors.lockingPeriod}</p>}
                    </div>
                  )}
                  {!isHidden('paymentMode') && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Payment Mode</label>
                      <input name="paymentMode" value={form.paymentMode} onChange={handleChange} placeholder="e.g. Net-30" className={`${inputCls} ${errors.paymentMode ? 'border-red-500' : ''}`} />
                      {errors.paymentMode && <p className="text-xs text-red-500 mt-1">{errors.paymentMode}</p>}
                    </div>
                  )}
                  {!isHidden('gstNumber') && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">GST Number</label>
                      <input name="gstNumber" value={form.gstNumber} onChange={handleChange} placeholder="e.g. 22AAAAA0000A1Z5" className={`${inputCls} ${errors.gstNumber ? 'border-red-500' : ''}`} />
                      {errors.gstNumber && <p className="text-xs text-red-500 mt-1">{errors.gstNumber}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 3: Additional details / address / terms */}
            {(!isHidden('address') || !isHidden('terms') || tenantCustomFields.length > 0) && (
              <div className="space-y-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2 border-l-2 border-zinc-500 pl-2">
                  Additional Details & Terms
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {!isHidden('address') && (
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Address</label>
                      <textarea name="address" value={form.address} onChange={handleChange} placeholder="Full address details..." rows={2} className={`${inputCls} resize-none`} />
                    </div>
                  )}
                  {!isHidden('terms') && (
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Terms & Conditions</label>
                      <textarea name="terms" value={form.terms || ""} onChange={handleChange} placeholder="Standard terms, locking notes, etc." rows={2} className={`${inputCls} resize-none`} />
                    </div>
                  )}

                  {/* Dynamic Custom Fields */}
                  {tenantCustomFields.filter(cf => !isHidden(cf.fieldName)).map((cf) => (
                    <div key={cf.fieldName}>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{cf.fieldName}</label>
                      <CustomFieldInput
                        cf={cf}
                        value={form.customFields?.[cf.fieldName]}
                        onChange={handleCustomFieldChange}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form Actions Footer */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50 -mx-6 -mb-6 p-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingClient(null);
                  setForm(initialFormState);
                }}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-150 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors"
              >
                {editingClient ? "Update Client" : "Save Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <input
          placeholder="Search by company or email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className={`${inputCls} flex-1`}
        />
        <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} className={`${inputCls} w-full sm:w-48`}>
          <option value="all">All Industries</option>
          {uniqueIndustries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputCls} w-full sm:w-40`}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table Area */}
      {loading ? (
        <div className="text-center p-12 text-zinc-500 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-800 rounded-full animate-spin mb-4"></div>
          Loading clients...
        </div>
      ) : (
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-zinc-900/50 text-slate-500 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600">Client</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">Code</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">Contact</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">Email</th>
                  <th className="px-6 py-4 font-semibold text-slate-600">Status</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {filteredClients.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-zinc-400">No clients found matching criteria.</td></tr>
                ) : filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/20 transition-colors">
                    {/* Client */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{client.companyName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{client.clientId || '—'}</div>
                    </td>

                    {/* Code */}
                    <td className="px-6 py-4">
                      {client.companyCode
                        ? <span className="inline-flex items-center px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-bold tracking-wider shadow-sm">{client.companyCode.toUpperCase()}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Contact */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-zinc-200 text-sm">{client.contactPerson || '—'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{client.phone || '—'}</div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4">
                      <span className="text-slate-700 dark:text-zinc-300 font-medium text-sm">{client.email || '—'}</span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold tracking-wide shadow-sm ${
                        client.active !== false
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}>
                        {client.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedClient(client)}
                          title="View Details"
                          className="p-2 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-100 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditClient(client)}
                          title="Edit"
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-transparent hover:border-slate-200 transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(client)}
                          title={client.active !== false ? 'Deactivate' : 'Activate'}
                          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 border border-transparent hover:border-slate-200 transition-all"
                        >
                          {client.active !== false
                            ? <Ban className="w-4 h-4" />
                            : <CheckCircle className="w-4 h-4 text-green-600" />}
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client)}
                          title="Delete Client"
                          className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Render Modal */}
      {selectedClient && <ClientDetailCard client={selectedClient} onClose={() => setSelectedClient(null)} />}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-zinc-500" />
                  Client Form Settings
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Customize visible fields and add custom fields for your clients.</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-zinc-650 dark:hover:text-white font-bold text-2xl leading-none px-2">×</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-zinc-800 dark:text-zinc-300">
              {/* Section 1: Toggle visibility */}
              <section>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1 uppercase tracking-wider">Standard Fields Visibility</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Uncheck fields you don't need. Fixed fields (Company Name, Contact Person, Email, Company Code) cannot be hidden.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {OPTIONAL_STANDARD_FIELDS.map((field) => {
                    const isHiddenField = tempHiddenFields.includes(field.id);
                    return (
                      <label key={field.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${!isHiddenField ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 opacity-60'}`}>
                        <input type="checkbox" checked={!isHiddenField} onChange={() => handleToggleHiddenField(field.id)} className="w-4 h-4 text-zinc-800 dark:text-zinc-200 rounded border-zinc-300 dark:border-zinc-700 focus:ring-zinc-500 cursor-pointer" />
                        <span className={`text-sm font-medium ${!isHiddenField ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 line-through'}`}>{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <hr className="border-zinc-200 dark:border-zinc-800" />

              {/* Section 2: Custom Fields */}
              <section>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-1 uppercase tracking-wider">Custom Fields</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Add new fields specific to your client tracking requirements.</p>

                {/* Input Row */}
                <div className={`flex flex-col sm:flex-row gap-3 items-start sm:items-end p-4 rounded-xl border mb-4 transition-colors ${editingFieldIndex !== null ? 'bg-zinc-100 dark:bg-zinc-800/30 border-zinc-400' : 'bg-zinc-50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800'}`}>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Field Name</label>
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddOrUpdateCustomField(); }}
                      placeholder="e.g. Agreement Signed?, Account Manager"
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-500 outline-none bg-white dark:bg-zinc-900 dark:text-zinc-100 ${editingFieldIndex !== null ? 'border-zinc-400' : 'border-zinc-300 dark:border-zinc-700'}`}
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="text-xs font-semibold text-zinc-500 uppercase mb-1 block">Field Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-500 outline-none bg-white dark:bg-zinc-900 dark:text-zinc-100 ${editingFieldIndex !== null ? 'border-zinc-400' : 'border-zinc-300 dark:border-zinc-700'}`}
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
                      className={`w-full flex items-center justify-center gap-2 text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition`}
                    >
                      {editingFieldIndex !== null ? <><Check className="w-4 h-4" /> Update</> : <><Plus className="w-4 h-4" /> Add</>}
                    </button>
                    {editingFieldIndex !== null && (
                      <button onClick={() => { setEditingFieldIndex(null); setNewFieldName(''); setNewFieldType('text'); }} className="text-xs text-center text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium transition">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Fields List */}
                {tempCustomFields.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10 text-sm">
                    No custom fields added yet. Use the form above to add your first one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {tempCustomFields.map((field, index) => {
                      const isHiddenField = tempHiddenFields.includes(field.fieldName);
                      const isEditing = editingFieldIndex === index;
                      return (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors select-none ${
                            isEditing 
                              ? 'border-zinc-500 bg-zinc-100 dark:bg-zinc-800' 
                              : !isHiddenField 
                                ? 'border-zinc-350 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900' 
                                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 opacity-60'
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={!isHiddenField}
                              onChange={() => handleToggleHiddenField(field.fieldName)}
                              className="w-4 h-4 text-zinc-800 dark:text-zinc-200 rounded border-zinc-300 dark:border-zinc-700 focus:ring-zinc-500 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className={`text-sm font-medium block truncate ${!isHiddenField ? 'text-zinc-850 dark:text-zinc-200' : 'text-zinc-500 line-through'}`}>
                                {field.fieldName}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
                                {field.fieldType}
                              </span>
                            </div>
                          </label>
                          <div className="flex gap-0.5 ml-2">
                            <button
                              onClick={() => handleEditCustomField(index)}
                              className="p-1 text-zinc-450 hover:text-zinc-900 dark:hover:text-white rounded transition"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemoveCustomField(index)}
                              className="p-1 text-zinc-450 hover:text-red-500 rounded transition"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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