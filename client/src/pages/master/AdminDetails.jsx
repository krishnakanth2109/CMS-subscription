// src/pages/master/AdminDetails.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Building2, User, Mail, Phone, Calendar, RefreshCw, Briefcase,
  GraduationCap, Clock, Check, X, Search, Shield, ChevronLeft,
  ChevronRight, BarChart2, Edit2, ArrowLeft, Users, AlertCircle,
  Eye, CheckCircle2, UserCheck, XCircle, Trash2, HelpCircle, Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from 'recharts';
import JobDetailsModal from '@/components/JobDetailsModal';
import CandidateDetailsModal from '@/components/CandidateDetailsModal';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const PLAN_STYLE = {
  Basic:      'bg-slate-100  text-slate-700  border-slate-200',
  Pro:        'bg-blue-50    text-blue-700   border-blue-200',
  Enterprise: 'bg-amber-50  text-amber-700  border-amber-200',
  None:       'bg-gray-50   text-gray-500   border-gray-200',
};

const STATUS_ENUMS = [
  'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
];

export default function AdminDetails() {
  const { adminId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authHeaders } = useAuth();

  // Active Tab State (URL parameter driven)
  const activeTab = searchParams.get('tab') || 'overview';
  
  // Modals state
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  // Detail filters
  const [recruiterFilter, setRecruiterFilter] = useState(searchParams.get('recruiterId') || 'All');
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || 'All');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [jobFilter, setJobFilter] = useState(searchParams.get('jobCode') || 'All');

  // Sync filters if search parameters change
  useEffect(() => {
    setRecruiterFilter(searchParams.get('recruiterId') || 'All');
    setClientFilter(searchParams.get('client') || 'All');
    setStatusFilter(searchParams.get('status') || 'All');
    setJobFilter(searchParams.get('jobCode') || 'All');
  }, [searchParams]);

  // Main Admin Summary State
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  // Paginated List States
  const [listData, setListData] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [listStatus, setListStatus] = useState('All');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/master/admins/${adminId}/summary`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load admin details');
      setSummary(data);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setSummaryLoading(false);
    }
  }, [adminId, authHeaders]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Fetch paginated tab lists
  const fetchTabList = useCallback(async () => {
    if (activeTab === 'overview' || activeTab === 'pipeline') return;
    setListLoading(true);
    setListError('');
    try {
      const headers = await authHeaders();
      let endpoint = `${API_URL}/master/admins/${adminId}/${activeTab}`;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search: listSearch.trim(),
        status: activeTab === 'candidates' ? statusFilter : listStatus,
      });

      if (activeTab === 'candidates') {
        if (recruiterFilter !== 'All') params.append('recruiterId', recruiterFilter);
        if (clientFilter !== 'All') params.append('client', clientFilter);
      }
      if (activeTab === 'jobs') {
        if (clientFilter !== 'All') params.append('client', clientFilter);
        if (recruiterFilter !== 'All') params.append('recruiter', recruiterFilter);
      }

      const res = await fetch(`${endpoint}?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load list details');

      if (activeTab === 'recruiters') {
        setListData(data.recruiters || []);
      } else if (activeTab === 'clients') {
        setListData(data.clients || []);
      } else if (activeTab === 'jobs') {
        setListData(data.jobs || []);
      } else if (activeTab === 'candidates') {
        setListData(data.candidates || []);
      }

      setTotalPages(data.pagination?.pages || 1);
      setTotalItems(data.pagination?.total || 0);
    } catch (err) {
      setListError(err.message);
    } finally {
      setListLoading(false);
    }
  }, [adminId, activeTab, page, listSearch, listStatus, recruiterFilter, clientFilter, statusFilter, authHeaders]);

  useEffect(() => {
    fetchTabList();
  }, [fetchTabList]);

  // Reset page and list filters on tab change
  useEffect(() => {
    setPage(1);
    setListSearch('');
    setListStatus('All');
  }, [activeTab]);

  const handleTabChange = (tabName) => {
    // Clear filters except searchParams base
    setSearchParams({ tab: tabName });
  };

  const handleQuickFilter = (tabName, filtersObj) => {
    const params = { tab: tabName, ...filtersObj };
    setSearchParams(params);
  };

  // Format Helper
  const fmtDate = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Recharts color palette
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6', '#06b6d4', '#64748b', '#ef4444'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back navigation & Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate('/master-panel/managers')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Back to Admins
        </button>

        {summaryLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-pulse flex items-center justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="h-6 bg-slate-100 rounded w-1/3"></div>
              <div className="h-4 bg-slate-100 rounded w-1/4"></div>
            </div>
            <div className="w-20 h-8 bg-slate-100 rounded"></div>
          </div>
        ) : summaryError ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{summaryError}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 text-xl font-bold uppercase">
                {summary.manager.companyName?.slice(0, 2) || summary.manager.firstName?.slice(0, 2) || 'AD'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {summary.manager.companyName || 'No Company Name'}
                  </h1>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${summary.manager.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {summary.manager.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  Admin: {summary.manager.firstName} {summary.manager.lastName} · {summary.manager.email}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                  {summary.manager.phone && <span className="flex items-center gap-1"><Phone size={12} /> {summary.manager.phone}</span>}
                  <span className="flex items-center gap-1"><Calendar size={12} /> Joined {fmtDate(summary.manager.createdAt)}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> Updated {fmtDate(summary.manager.updatedAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${PLAN_STYLE[summary.manager.subscriptionPlan || 'None']}`}>
                Plan: {summary.manager.subscriptionPlan || 'None'}
              </span>
              {summary.manager.subscriptionExpiresAt && (
                <span className="text-xs font-bold text-slate-400">
                  Expires: {fmtDate(summary.manager.subscriptionExpiresAt)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      {!summaryLoading && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Recruiters</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{summary.kpis.totalRecruiters}</p>
                <p className="text-[10px] font-semibold text-emerald-600 mt-1">{summary.kpis.activeRecruiters} Active</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Clients</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{summary.kpis.totalClients}</p>
                <p className="text-[10px] font-semibold text-emerald-600 mt-1">{summary.kpis.activeClients} Active</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Jobs</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{summary.kpis.totalJobs}</p>
                <p className="text-[10px] font-semibold text-indigo-600 mt-1">{summary.kpis.activeJobs} Active · {summary.kpis.closedJobs} Closed</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Candidates</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{summary.kpis.totalCandidates}</p>
                <p className="text-[10px] font-semibold text-teal-600 mt-1">Total Pipeline Scoped</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-teal-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="border-b border-slate-200 flex flex-wrap gap-2">
        {[
          { id: 'overview', label: 'Overview', icon: <BarChart2 size={16} /> },
          { id: 'recruiters', label: 'Recruiters', icon: <Users size={16} /> },
          { id: 'clients', label: 'Clients', icon: <Building2 size={16} /> },
          { id: 'jobs', label: 'Jobs', icon: <Briefcase size={16} /> },
          { id: 'candidates', label: 'Candidates', icon: <GraduationCap size={16} /> },
          { id: 'pipeline', label: 'Pipeline Analytics', icon: <CheckCircle2 size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENTS ────────────────────────────────────────────────────── */}
      
      {/* 1. OVERVIEW / DASHBOARD TAB */}
      {activeTab === 'overview' && !summaryLoading && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Candidate Distribution by Recruiter Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[350px]">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Candidate Distribution by Recruiter</h3>
              <p className="text-xs text-slate-400 mt-0.5">Performance tracking of recruiter registrations</p>
            </div>
            <div className="h-64 mt-4 w-full">
              {summary.recruiterDistribution.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">No recruiter data found.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.recruiterDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="recruiterName" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '8px', border: 'none' }} />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={30}>
                      {summary.recruiterDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Candidate Pipeline Summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[350px]">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Candidate Pipeline breakdown</h3>
              <p className="text-xs text-slate-400 mt-0.5">Admin-wide summary of candidates by workflow status</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 items-center">
              <div className="h-48 w-full flex items-center justify-center">
                {Object.values(summary.pipeline).reduce((a, b) => a + b, 0) === 0 ? (
                  <div className="text-sm text-slate-400">No candidates in pipeline.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(summary.pipeline).map(([name, value]) => ({ name, value })).filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {Object.entries(summary.pipeline).map(([name, value], index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-56 pr-2">
                {Object.entries(summary.pipeline).map(([status, count], index) => (
                  <button
                    key={status}
                    onClick={() => count > 0 && handleQuickFilter('candidates', { status })}
                    disabled={count === 0}
                    className="w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="font-semibold text-slate-700">{status}</span>
                    </div>
                    <span className="font-bold text-slate-900">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. RECRUITERS TAB */}
      {activeTab === 'recruiters' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Search recruiter name, email, or phone..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={listStatus}
              onChange={e => setListStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Recruiter Name</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Email / Phone</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center">Assigned Jobs</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center">Total Candidates</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center text-slate-500">Submitted</th>
                    <th className="px-5 py-3 text-xs font-bold text-emerald-600 uppercase text-center">Selected</th>
                    <th className="px-5 py-3 text-xs font-bold text-indigo-600 uppercase text-center">Joined</th>
                    <th className="px-5 py-3 text-xs font-bold text-red-600 uppercase text-center">Rejected</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-14 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Loading recruiters...</p>
                      </td>
                    </tr>
                  ) : listData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-14 text-center text-sm text-slate-500">No recruiters found.</td>
                    </tr>
                  ) : listData.map((rec) => (
                    <tr key={rec._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-semibold text-slate-900">{rec.recruiterName}</p>
                          {rec.role && (
                            <span className={`inline-flex items-center w-fit rounded-md px-1.5 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                              rec.role === 'manager' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                              rec.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              'bg-slate-50 text-slate-600 border-slate-100'
                            }`}>
                              {rec.role === 'manager' ? 'Manager' : rec.role === 'admin' ? 'Admin' : 'Recruiter'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600 space-y-0.5">
                        <p className="flex items-center gap-1"><Mail size={12} /> {rec.email}</p>
                        {rec.phone && <p className="flex items-center gap-1"><Phone size={12} /> {rec.phone}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${rec.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {rec.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-sm font-bold text-slate-700">
                        {rec.assignedJobsCount}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => rec.totalCandidates > 0 && handleQuickFilter('candidates', { recruiterId: rec._id })}
                          disabled={rec.totalCandidates === 0}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border ${rec.totalCandidates > 0 ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                        >
                          {rec.totalCandidates}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => rec.submitted > 0 && handleQuickFilter('candidates', { recruiterId: rec._id, status: 'Submitted' })}
                          disabled={rec.submitted === 0}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border ${rec.submitted > 0 ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                        >
                          {rec.submitted}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => rec.selected > 0 && handleQuickFilter('candidates', { recruiterId: rec._id, status: 'Selected' })}
                          disabled={rec.selected === 0}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border ${rec.selected > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                        >
                          {rec.selected}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => rec.joined > 0 && handleQuickFilter('candidates', { recruiterId: rec._id, status: 'Joined' })}
                          disabled={rec.joined === 0}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border ${rec.joined > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                        >
                          {rec.joined}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => rec.rejected > 0 && handleQuickFilter('candidates', { recruiterId: rec._id, status: 'Rejected' })}
                          disabled={rec.rejected === 0}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border ${rec.rejected > 0 ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                        >
                          {rec.rejected}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap">
                        {fmtDate(rec.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {!listLoading && totalPages > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">Showing {listData.length} of {totalItems} recruiters</span>
                <div className="inline-flex gap-2">
                  <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="p-1.5 rounded-lg border bg-white disabled:opacity-50"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-semibold text-slate-700 flex items-center">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="p-1.5 rounded-lg border bg-white disabled:opacity-50"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. CLIENTS TAB */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Search client name, industry, contact person, location..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={listStatus}
              onChange={e => setListStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Client Name</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Industry</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Location</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Contact Person</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center">Active Jobs</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center">Total Jobs</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center">Submitted Candidates</th>
                    <th className="px-5 py-3 text-xs font-bold text-emerald-600 uppercase text-center">Selected Candidates</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-14 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Loading clients...</p>
                      </td>
                    </tr>
                  ) : listData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-14 text-center text-sm text-slate-500">No clients found.</td>
                    </tr>
                  ) : listData.map((client) => (
                    <tr key={client._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedClient(client)}
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline text-left block font-medium"
                        >
                          {client.companyName}
                        </button>
                        {client.clientId && <span className="text-[10px] bg-slate-150 border px-1.5 py-0.5 rounded text-slate-500 font-mono mt-1 inline-block">{client.clientId}</span>}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{client.industry || '—'}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{client.clientLocation || '—'}</td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600 space-y-0.5">
                        <p className="font-semibold text-slate-700">{client.contactPerson || '—'}</p>
                        {client.email && <p className="flex items-center gap-1"><Mail size={12} /> {client.email}</p>}
                        {client.phone && <p className="flex items-center gap-1"><Phone size={12} /> {client.phone}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${client.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {client.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-sm font-bold text-slate-700">{client.activeJobs}</td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => client.totalJobs > 0 && handleQuickFilter('jobs', { client: client.companyName })}
                          disabled={client.totalJobs === 0}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border ${client.totalJobs > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                        >
                          {client.totalJobs}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center text-sm font-semibold text-slate-700">{client.submittedCandidates}</td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => client.selectedCandidates > 0 && handleQuickFilter('candidates', { client: client.companyName, status: 'Selected' })}
                          disabled={client.selectedCandidates === 0}
                          className={`px-2 py-1.5 rounded-lg text-xs font-bold border ${client.selectedCandidates > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                        >
                          {client.selectedCandidates}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap">{fmtDate(client.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {!listLoading && totalPages > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">Showing {listData.length} of {totalItems} clients</span>
                <div className="inline-flex gap-2">
                  <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="p-1.5 rounded-lg border bg-white disabled:opacity-50"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-semibold text-slate-700 flex items-center">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="p-1.5 rounded-lg border bg-white disabled:opacity-50"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. JOBS TAB */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Search job code, position, location..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={listStatus}
              onChange={e => setListStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Job Code</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Position</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Client</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Location</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Primary Recruiter</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center">Matching Candidates</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center">Submitted Candidates</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Expiry / TAT</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-14 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Loading jobs...</p>
                      </td>
                    </tr>
                  ) : listData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-14 text-center text-sm text-slate-500">No jobs found.</td>
                    </tr>
                  ) : listData.map((job) => (
                    <tr key={job._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {job.jobCode}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">{job.position}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{job.clientName}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{job.location || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${job.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {job.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {job.primaryRecruiter || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-5 py-4 text-center text-sm font-bold text-slate-700">{job.matchingCandidates}</td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => job.submittedCandidates > 0 && handleQuickFilter('candidates', { client: job.clientName, jobCode: job.jobCode })}
                          disabled={job.submittedCandidates === 0}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${job.submittedCandidates > 0 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                        >
                          {job.submittedCandidates}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap">
                        {job.tatTime ? fmtDate(job.tatTime) : '—'}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap">{fmtDate(job.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {!listLoading && totalPages > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">Showing {listData.length} of {totalItems} jobs</span>
                <div className="inline-flex gap-2">
                  <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="p-1.5 rounded-lg border bg-white disabled:opacity-50"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-semibold text-slate-700 flex items-center">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="p-1.5 rounded-lg border bg-white disabled:opacity-50"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. CANDIDATES TAB */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Search candidate ID, name, email, contact..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={e => handleQuickFilter('candidates', { recruiterId: recruiterFilter, client: clientFilter, status: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Pipeline Statuses</option>
              {STATUS_ENUMS.map(status => <option key={status}>{status}</option>)}
            </select>

            {summary && (
              <>
                <select
                  value={recruiterFilter}
                  onChange={e => handleQuickFilter('candidates', { recruiterId: e.target.value, client: clientFilter, status: statusFilter })}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                >
                  <option value="All">All Recruiters</option>
                  {summary.recruiterDistribution.map(rec => (
                    <option key={rec.recruiterId} value={rec.recruiterId}>{rec.recruiterName}</option>
                  ))}
                </select>
                <select
                  value={clientFilter}
                  onChange={e => handleQuickFilter('candidates', { recruiterId: recruiterFilter, client: e.target.value, status: statusFilter })}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                >
                  <option value="All">All Clients</option>
                  {summary.recruiterDistribution.map(rec => rec.clientName).filter(Boolean).map(clientName => (
                    <option key={clientName} value={clientName}>{clientName}</option>
                  ))}
                  {/* Fallback to fetch client names from listData or database if needed */}
                </select>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Candidate ID</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Candidate Name</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Email / Contact</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Current Role</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Client</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Recruiter</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Pipeline Status</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Loading candidates...</p>
                      </td>
                    </tr>
                  ) : listData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-500">No candidates found.</td>
                    </tr>
                  ) : listData.map((cand) => (
                    <tr key={cand._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {cand.candidateId}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedCandidate(cand)}
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline text-left block"
                        >
                          {cand.name}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600 space-y-0.5 whitespace-nowrap">
                        <p className="flex items-center gap-1"><Mail size={12} /> {cand.email}</p>
                        <p className="flex items-center gap-1"><Phone size={12} /> {cand.contact}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">{cand.position || '—'}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{cand.client || '—'}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{cand.recruiterName || '—'}</td>
                      <td className="px-5 py-4">
                        {Array.isArray(cand.status) ? (
                          <div className="flex flex-wrap gap-1">
                            {cand.status.map(st => (
                              <span key={st} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
                                {st}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
                            {cand.status}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-500 whitespace-nowrap">{fmtDate(cand.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {!listLoading && totalPages > 1 && (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-500">Showing {listData.length} of {totalItems} candidates</span>
                <div className="inline-flex gap-2">
                  <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="p-1.5 rounded-lg border bg-white disabled:opacity-50"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-semibold text-slate-700 flex items-center">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="p-1.5 rounded-lg border bg-white disabled:opacity-50"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. PIPELINE ANALYTICS TAB */}
      {activeTab === 'pipeline' && !summaryLoading && summary && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Pipeline Status Counts</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(summary.pipeline).map(([status, count]) => (
                <button
                  key={status}
                  onClick={() => count > 0 && handleQuickFilter('candidates', { status })}
                  disabled={count === 0}
                  className="flex flex-col items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-sm transition-all text-center bg-slate-50 disabled:opacity-50"
                >
                  <span className="text-xs font-semibold text-slate-500 h-8 flex items-center">{status}</span>
                  <span className="text-2xl font-bold mt-2 text-slate-900">{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-96">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Status Distribution Comparison</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(summary.pipeline).map(([name, value]) => ({ name, value }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {Object.entries(summary.pipeline).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── DETAIL MODALS ─────────────────────────────────────────────────── */}

      {/* 1. Job details Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {/* 2. Candidate details Modal */}
      {selectedCandidate && (
        <CandidateDetailsModal
          candidate={selectedCandidate}
          baseUrl={BASE_URL}
          onClose={() => setSelectedCandidate(null)}
        />
      )}

      {/* 3. Client Details Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedClient(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-55 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedClient.companyName}</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {selectedClient.clientId}</p>
              </div>
              <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-slate-650 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Industry</p>
                <p className="text-sm font-semibold text-slate-800">{selectedClient.industry || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Location</p>
                <p className="text-sm font-semibold text-slate-800">{selectedClient.clientLocation || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Contact Person</p>
                <p className="text-sm font-semibold text-slate-800">{selectedClient.contactPerson || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Email</p>
                <p className="text-sm font-semibold text-slate-800">{selectedClient.email || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Phone</p>
                <p className="text-sm font-semibold text-slate-800">{selectedClient.phone || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Website</p>
                <p className="text-sm font-semibold text-slate-800">{selectedClient.website || '—'}</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Address</p>
                <p className="text-sm font-semibold text-slate-800">{selectedClient.address || '—'}</p>
              </div>
              {selectedClient.notes && (
                <div className="space-y-1 md:col-span-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Notes / Special Instructions</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedClient.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-5 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
