// src/pages/master/Managers.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Search, RefreshCw, Edit2, X, Check,
  AlertCircle, Loader2, ChevronUp, ChevronDown,
  Building2, Mail, Calendar, Trash2, Eye,
  Users, Briefcase, GraduationCap, ChevronLeft, ChevronRight
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
  const navigate = useNavigate();

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

  // Pagination State
  const [page,         setPage]         = useState(1);
  const [limit]                         = useState(10);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalItems,   setTotalItems]   = useState(0);

  // Edit modal
  const [editing,   setEditing]   = useState(null); // { admin, active }
  const [saving,    setSaving]    = useState(false);
  const [editError, setEditError] = useState('');

  /* ── Fetch ─────────────────────────────────────────────────────────────── */
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const params = new URLSearchParams({
        search: search.trim(),
        plan: planFilter,
        status: statusFilter,
        page: page.toString(),
        limit: limit.toString(),
        sortBy: sortField,
        sortOrder: sortDir
      });

      const res = await fetch(`${API_URL}/master/admins/overview?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load admins');
      
      setAdmins(data.admins || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalItems(data.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, search, planFilter, statusFilter, page, limit, sortField, sortDir]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, planFilter, statusFilter]);

  const allVisibleSelected = admins.length > 0 && admins.every(admin => selectedIds.includes(admin._id));

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = admins.map(a => a._id);
    setSelectedIds(prev => {
      if (allVisibleSelected) return prev.filter(id => !visibleIds.includes(id));
      return Array.from(new Set([...prev, ...visibleIds]));
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
            ? { ...a, active: editing.active, status: editing.active ? 'Active' : 'Inactive' }
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
      fetchAdmins();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const navigateToDetails = (adminId, tab = 'overview') => {
    navigate(`/master-panel/admins/${adminId}?tab=${tab}`);
  };

  /* ── Sort icon ──────────────────────────────────────────────────────────── */
  const SortIcon = ({ field }) =>
    sortField !== field
      ? <span className="ml-1 text-slate-300 text-xs">↕</span>
      : sortDir === 'asc'
        ? <ChevronUp   className="inline w-3.5 h-3.5 ml-0.5" />
        : <ChevronDown className="inline w-3.5 h-3.5 ml-0.5" />;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Loading…' : `${totalItems} registered admin account${totalItems !== 1 ? 's' : ''}`}
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
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
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

      {/* Table / Mobile Cards */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={admins.length === 0 || loading}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    title="Select all visible admins"
                  />
                </th>
                <th onClick={() => toggleSort('name')} className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-1/5">
                  Admin <SortIcon field="name" />
                </th>
                <th onClick={() => toggleSort('companyName')} className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-1/5">
                  Company <SortIcon field="companyName" />
                </th>
                <th onClick={() => toggleSort('subscriptionPlan')} className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-24">
                  Plan <SortIcon field="subscriptionPlan" />
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase w-20">Status</th>
                <th className="px-3 py-3.5 text-xs font-bold text-slate-500 uppercase text-center w-24">Recruiters</th>
                <th className="px-3 py-3.5 text-xs font-bold text-slate-500 uppercase text-center w-20">Clients</th>
                <th className="px-3 py-3.5 text-xs font-bold text-slate-500 uppercase text-center w-20">Jobs</th>
                <th className="px-3 py-3.5 text-xs font-bold text-slate-500 uppercase text-center w-24">Candidates</th>
                <th onClick={() => toggleSort('createdAt')} className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-28">
                  Joined <SortIcon field="createdAt" />
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-500 uppercase text-right w-44">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-5 py-14 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Loading admin accounts…</p>
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-14 text-center text-sm text-slate-500">
                    No admin accounts match your filters.
                  </td>
                </tr>
              ) : admins.map(admin => (
                <tr key={admin._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(admin._id)}
                      onChange={() => toggleSelected(admin._id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      title={`Select ${getName(admin)}`}
                    />
                  </td>

                  {/* Name */}
                  <td className="px-4 py-4 truncate">
                    <p className="text-sm font-semibold text-slate-900 truncate">{getName(admin)}</p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate" title={admin.email}>
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {admin.email}
                    </p>
                  </td>

                  {/* Company */}
                  <td className="px-4 py-4 truncate">
                    <div className="flex items-center gap-1.5 text-sm text-slate-700 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {admin.companyName || <span className="text-slate-400 italic">Not set</span>}
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${PLAN_STYLE[admin.plan || 'None'] || PLAN_STYLE.None}`}>
                      {admin.plan || 'None'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${admin.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {admin.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Clickable counts */}
                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => admin.recruiterCount > 0 && navigateToDetails(admin._id, 'recruiters')}
                      disabled={admin.recruiterCount === 0}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${admin.recruiterCount > 0 ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:text-purple-800 transition-colors' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                    >
                      <Users size={12} />
                      {admin.recruiterCount}
                    </button>
                  </td>

                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => admin.clientCount > 0 && navigateToDetails(admin._id, 'clients')}
                      disabled={admin.clientCount === 0}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${admin.clientCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:text-amber-800 transition-colors' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                    >
                      <Building2 size={12} />
                      {admin.clientCount}
                    </button>
                  </td>

                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => admin.jobCount > 0 && navigateToDetails(admin._id, 'jobs')}
                      disabled={admin.jobCount === 0}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${admin.jobCount > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 transition-colors' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                    >
                      <Briefcase size={12} />
                      {admin.jobCount}
                    </button>
                  </td>

                  <td className="px-3 py-4 text-center">
                    <button
                      onClick={() => admin.candidateCount > 0 && navigateToDetails(admin._id, 'candidates')}
                      disabled={admin.candidateCount === 0}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${admin.candidateCount > 0 ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:text-teal-800 transition-colors' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                    >
                      <GraduationCap size={12} />
                      {admin.candidateCount}
                    </button>
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{fmt(admin.createdAt)}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigateToDetails(admin._id, 'overview')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded-lg transition-colors"
                        title="View Full Details"
                      >
                        <Eye className="w-3.5 h-3.5" />Details
                      </button>
                      <button
                        onClick={() => openEdit(admin)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />Edit
                      </button>
                      <button
                        onClick={() => deleteAdmins([admin._id])}
                        disabled={deleting}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View - Cards Layout */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Loading admin accounts…</p>
            </div>
          ) : admins.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No admin accounts match your filters.
            </div>
          ) : (
            admins.map(admin => (
              <div key={admin._id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{getName(admin)}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{admin.email}</p>
                    <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                      <Building2 size={12} className="text-slate-400" />
                      {admin.companyName || 'No Company'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${PLAN_STYLE[admin.plan || 'None'] || PLAN_STYLE.None}`}>
                    {admin.plan || 'None'}
                  </span>
                </div>

                {/* Counts grid on mobile */}
                <div className="grid grid-cols-4 gap-2 py-1 bg-slate-50 rounded-xl p-2">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">Recs</p>
                    <button
                      onClick={() => admin.recruiterCount > 0 && navigateToDetails(admin._id, 'recruiters')}
                      disabled={admin.recruiterCount === 0}
                      className="text-xs font-bold text-purple-700 disabled:text-slate-400 mt-0.5"
                    >
                      {admin.recruiterCount}
                    </button>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">Clients</p>
                    <button
                      onClick={() => admin.clientCount > 0 && navigateToDetails(admin._id, 'clients')}
                      disabled={admin.clientCount === 0}
                      className="text-xs font-bold text-amber-700 disabled:text-slate-400 mt-0.5"
                    >
                      {admin.clientCount}
                    </button>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">Jobs</p>
                    <button
                      onClick={() => admin.jobCount > 0 && navigateToDetails(admin._id, 'jobs')}
                      disabled={admin.jobCount === 0}
                      className="text-xs font-bold text-indigo-700 disabled:text-slate-400 mt-0.5"
                    >
                      {admin.jobCount}
                    </button>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">Cands</p>
                    <button
                      onClick={() => admin.candidateCount > 0 && navigateToDetails(admin._id, 'candidates')}
                      disabled={admin.candidateCount === 0}
                      className="text-xs font-bold text-teal-700 disabled:text-slate-400 mt-0.5"
                    >
                      {admin.candidateCount}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Joined: {fmt(admin.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateToDetails(admin._id, 'overview')}
                      className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-bold"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => openEdit(admin)}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-bold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAdmins([admin._id])}
                      className="p-1 bg-red-50 text-red-600 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Server Side Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing {(page - 1) * limit + 1} - {Math.min(page * limit, totalItems)} of {totalItems} admins
            </span>
            <div className="inline-flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
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
