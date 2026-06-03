// src/pages/master/Managers.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Search, RefreshCw, Edit2, X, Check,
  AlertCircle, Loader2, ChevronUp, ChevronDown,
  Building2, Mail, Calendar, Trash2,
} from 'lucide-react';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const PLANS = ['Basic', 'Pro', 'Enterprise', 'None'];

const PLAN_STYLE = {
  Basic:      'bg-slate-100  text-slate-700  border-slate-200',
  Pro:        'bg-blue-50    text-blue-700   border-blue-200',
  Enterprise: 'bg-amber-50  text-amber-700  border-amber-200',
  None:       'bg-gray-50   text-gray-500   border-gray-200',
};

const getName = (a) => {
  const full = [a.firstName, a.lastName].filter(Boolean).join(' ');
  return full || a.name || a.username || a.email || 'Admin';
};

const fmt = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Managers() {
  const { authHeaders } = useAuth();

  const [admins,       setAdmins]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [search,       setSearch]       = useState('');
  const [planFilter,   setPlanFilter]   = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField,    setSortField]    = useState('createdAt');
  const [sortDir,      setSortDir]      = useState('desc');
  const [selectedIds,  setSelectedIds]  = useState([]);
  const [deleting,     setDeleting]     = useState(false);

  // Edit modal
  const [editing,   setEditing]   = useState(null); // { admin, active }
  const [saving,    setSaving]    = useState(false);
  const [editError, setEditError] = useState('');

  /* ── Fetch ─────────────────────────────────────────────────────────────── */
  const fetchAdmins = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res  = await fetch(`${API_URL}/master/managers`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load admins');
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []); // eslint-disable-line

  /* ── Derived list ───────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = [...admins];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        getName(a).toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.companyName || '').toLowerCase().includes(q),
      );
    }

    if (planFilter !== 'All')
      list = list.filter(a => (a.subscriptionPlan || 'None') === planFilter);

    if (statusFilter === 'Active')
      list = list.filter(a => a.active !== false);
    else if (statusFilter === 'Inactive')
      list = list.filter(a => a.active === false);

    list.sort((a, b) => {
      let va = sortField === 'name' ? getName(a) : (a[sortField] ?? '');
      let vb = sortField === 'name' ? getName(b) : (b[sortField] ?? '');
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    return list;
  }, [admins, search, planFilter, statusFilter, sortField, sortDir]);

  const filteredIds = useMemo(() => filtered.map(admin => admin._id), [filtered]);
  const allVisibleSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds(prev => {
      if (allVisibleSelected) return prev.filter(id => !filteredIds.includes(id));
      return Array.from(new Set([...prev, ...filteredIds]));
    });
  };

  /* ── Edit ───────────────────────────────────────────────────────────────── */
  const openEdit = (admin) => {
    setEditing({ admin, active: admin.active !== false });
    setEditError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setEditError('');
    try {
      const headers = await authHeaders();
      const res  = await fetch(`${API_URL}/master/managers/${editing.admin._id}`, {
        method:  'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ active: editing.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update');
      setAdmins(prev =>
        prev.map(a =>
          a._id === editing.admin._id
            ? { ...a, active: editing.active }
            : a,
        ),
      );
      setEditing(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAdmins = async (ids) => {
    if (!ids.length) return;
    const label = ids.length === 1 ? 'this admin account' : `${ids.length} selected admin accounts`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setDeleting(true);
    setError('');
    try {
      const headers = await authHeaders();
      await Promise.all(ids.map(async (id) => {
        const res = await fetch(`${API_URL}/master/managers/${id}`, {
          method: 'DELETE',
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to delete admin');
      }));

      setAdmins(prev => prev.filter(admin => !ids.includes(admin._id)));
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  /* ── Sort icon ──────────────────────────────────────────────────────────── */
  const SortIcon = ({ field }) =>
    sortField !== field
      ? <span className="ml-1 text-slate-300 text-xs">↕</span>
      : sortDir === 'asc'
        ? <ChevronUp   className="inline w-3.5 h-3.5 ml-0.5" />
        : <ChevronDown className="inline w-3.5 h-3.5 ml-0.5" />;

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Loading…' : `${admins.length} registered admin account${admins.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchAdmins}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or company…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Plans</option>
          {PLANS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-700">
            {selectedIds.length} admin account{selectedIds.length !== 1 ? 's' : ''} selected
          </p>
          <button
            onClick={() => deleteAdmins(selectedIds)}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete Selected
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5 w-12">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={filteredIds.length === 0 || loading}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    title="Select all visible admins"
                  />
                </th>
                {[
                  { label: 'Admin',   field: 'name' },
                  { label: 'Company', field: 'companyName' },
                  { label: 'Plan',    field: 'subscriptionPlan' },
                  { label: 'Status',  field: null },
                  { label: 'Joined',  field: 'createdAt' },
                ].map(col => (
                  <th
                    key={col.label}
                    onClick={() => col.field && toggleSort(col.field)}
                    className={`px-5 py-3.5 text-xs font-bold text-slate-500 uppercase ${col.field ? 'cursor-pointer select-none hover:text-slate-700' : ''}`}
                  >
                    {col.label}
                    {col.field && <SortIcon field={col.field} />}
                  </th>
                ))}
                <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Loading admin accounts…</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500">
                    No admin accounts match your filters.
                  </td>
                </tr>
              ) : filtered.map(admin => (
                <tr key={admin._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">

                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(admin._id)}
                      onChange={() => toggleSelected(admin._id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      title={`Select ${getName(admin)}`}
                    />
                  </td>

                  {/* Name / email */}
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-900">{getName(admin)}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {admin.email}
                    </p>
                  </td>

                  {/* Company */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {admin.companyName || <span className="text-slate-400 italic">Not set</span>}
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${PLAN_STYLE[admin.subscriptionPlan || 'None'] || PLAN_STYLE.None}`}>
                      {admin.subscriptionPlan || 'None'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${admin.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {admin.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />{fmt(admin.createdAt)}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(admin)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />Edit
                      </button>
                      <button
                        onClick={() => deleteAdmins([admin._id])}
                        disabled={deleting}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            Showing {filtered.length} of {admins.length} admin{admins.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Admin Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">{getName(editing.admin)} · {editing.admin.email}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {editError && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{editError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Account Status</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditing(e => ({ ...e, active: true }))}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-semibold transition-all ${editing.active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    ✓ Active
                  </button>
                  <button
                    onClick={() => setEditing(e => ({ ...e, active: false }))}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-semibold transition-all ${!editing.active ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    ✗ Inactive
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
