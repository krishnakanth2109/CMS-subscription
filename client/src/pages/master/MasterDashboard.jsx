import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Building2, CreditCard, TrendingUp, Users, UserX, Briefcase, GraduationCap,
  Sparkles, RefreshCw, Loader2, X, Search, ChevronLeft, ChevronRight, Mail, Phone,
  QrCode, ToggleLeft, ToggleRight, Copy, Check, Download, ExternalLink, Trash2,
  Clock, Layers, Tag, Globe, MapPin, DollarSign
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;
const FRONTEND_URL = (import.meta.env.VITE_FRONTEND_URL || window.location.origin);
const getQRUrl = (url, size = 220) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png&margin=1`;

const getName = (admin) => {
  const fullName = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
  return fullName || admin.name || admin.username || admin.email || 'Admin';
};

const formatDate = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function MasterDashboard() {
  const { authHeaders } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. General Stats Modal States (for Admins, Recruiters, Clients, Jobs)
  const [modalType, setModalType] = useState(null); // 'admins' | 'active-admins' | 'inactive-admins' | 'recruiters' | 'clients' | 'jobs' | 'active-jobs'
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalPage, setModalPage] = useState(1);
  const [modalTotalPages, setModalTotalPages] = useState(1);
  const [modalTotalItems, setModalTotalItems] = useState(0);

  // 2. Candidate Stats Modal States (Candidates Card)
  const [candidateStatsOpen, setCandidateStatsOpen] = useState(false);
  const [candidateRecruiterStats, setCandidateRecruiterStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsSearch, setStatsSearch] = useState('');

  // 3. Recruiter Candidates detail modal (Candidates by Recruiter nested level)
  const [selectedRecruiterForCandidates, setSelectedRecruiterForCandidates] = useState(null);
  const [recruiterCandidates, setRecruiterCandidates] = useState([]);
  const [recruiterCandidatesLoading, setRecruiterCandidatesLoading] = useState(false);
  const [recruiterCandidatesPage, setRecruiterCandidatesPage] = useState(1);
  const [recruiterCandidatesTotalPages, setRecruiterCandidatesTotalPages] = useState(1);
  const [recruiterCandidatesTotalItems, setRecruiterCandidatesTotalItems] = useState(0);

  // 4. Default QR Codes States
  const [qrSession, setQrSession] = useState(null); // holds candidate/client default session with submissions
  const [qrSessionType, setQrSessionType] = useState(null); // 'candidate' | 'client' | null
  const [qrLoading, setQrLoading] = useState(false);
  const [qrSubmSearch, setQrSubmSearch] = useState('');
  const [qrSubmPage, setQrSubmPage] = useState(1);
  const [qrToggling, setQrToggling] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const [resManagers, resStats] = await Promise.all([
        fetch(`${API_URL}/master/managers`, { headers }),
        fetch(`${API_URL}/master/stats`, { headers })
      ]);

      const managersData = await resManagers.json();
      const statsData = await resStats.json();

      if (!resManagers.ok) throw new Error(managersData.message || 'Failed to load admins');
      if (!resStats.ok) throw new Error(statsData.message || 'Failed to load stats');

      setAdmins(Array.isArray(managersData) ? managersData : []);
      setStats(statsData);
    } catch (err) {
      setError(err.message || 'Failed to load master dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchModalData = async (type, pageNum = 1, searchQuery = '') => {
    setModalLoading(true);
    try {
      const headers = await authHeaders();
      let url = '';
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        search: searchQuery
      });

      if (type === 'admins') {
        url = `${API_URL}/master/stats/admins`;
      } else if (type === 'active-admins') {
        url = `${API_URL}/master/stats/admins`;
        params.append('status', 'Active');
      } else if (type === 'inactive-admins') {
        url = `${API_URL}/master/stats/admins`;
        params.append('status', 'Inactive');
      } else if (type === 'recruiters') {
        url = `${API_URL}/master/stats/recruiters`;
      } else if (type === 'clients') {
        url = `${API_URL}/master/stats/clients`;
      } else if (type === 'jobs') {
        url = `${API_URL}/master/stats/jobs`;
      } else if (type === 'active-jobs') {
        url = `${API_URL}/master/stats/jobs`;
        params.append('status', 'Active');
      }

      const res = await fetch(`${url}?${params.toString()}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load details');

      if (type.includes('admin')) {
        setModalData(data.admins || []);
      } else if (type === 'recruiters') {
        setModalData(data.recruiters || []);
      } else if (type === 'clients') {
        setModalData(data.clients || []);
      } else if (type.includes('job')) {
        setModalData(data.jobs || []);
      }

      setModalPage(pageNum);
      setModalTotalPages(data.pagination?.pages || 1);
      setModalTotalItems(data.pagination?.total || 0);
      setModalType(type);
    } catch (err) {
      alert(err.message || 'Failed to load details');
    } finally {
      setModalLoading(false);
    }
  };

  const fetchCandidateRecruiterStats = async () => {
    setStatsLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/master/stats/candidates-by-recruiters`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load candidate stats');
      setCandidateRecruiterStats(data || []);
      setCandidateStatsOpen(true);
    } catch (err) {
      alert(err.message || 'Failed to load candidate details');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchRecruiterCandidates = async (recruiter, pageNum = 1) => {
    setRecruiterCandidatesLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/master/stats/candidates-by-recruiters/${recruiter.recruiterId}?page=${pageNum}&limit=10`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load candidates');
      setRecruiterCandidates(data.candidates || []);
      setRecruiterCandidatesTotalPages(data.pagination?.pages || 1);
      setRecruiterCandidatesTotalItems(data.pagination?.total || 0);
      setRecruiterCandidatesPage(pageNum);
      setSelectedRecruiterForCandidates(recruiter);
    } catch (err) {
      alert(err.message || 'Failed to load candidate details');
    } finally {
      setRecruiterCandidatesLoading(false);
    }
  };

  /* ── 4. QR Actions on Dashboard ────────────────────────────────────────── */
  const openQRModal = async (type) => {
    setQrSessionType(type);
    setQrLoading(true);
    setQrSubmSearch('');
    setQrSubmPage(1);
    try {
      const headers = await authHeaders();
      const endpoint = type === 'candidate' ? 'candidate-qr' : 'client-qr';
      const res = await fetch(`${API_URL}/${endpoint}/default`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to fetch default ${type} QR session`);
      setQrSession(data.session);
    } catch (err) {
      alert(err.message);
      setQrSessionType(null);
    } finally {
      setQrLoading(false);
    }
  };

  const toggleQRActive = async () => {
    if (!qrSession) return;
    setQrToggling(true);
    try {
      const headers = await authHeaders();
      const endpoint = qrSessionType === 'candidate' ? 'candidate-qr' : 'client-qr';
      const res = await fetch(`${API_URL}/${endpoint}/${qrSession._id}/toggle`, {
        method: 'PATCH',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to toggle status');
      setQrSession((prev) => ({ ...prev, active: data.active }));
    } catch (err) {
      alert(err.message);
    } finally {
      setQrToggling(false);
    }
  };

  const deleteQRSubmission = async (submissionId) => {
    if (!qrSession) return;
    if (!window.confirm('Are you sure you want to remove this submission?')) return;
    try {
      const headers = await authHeaders();
      const endpoint = qrSessionType === 'candidate' ? 'candidate-qr' : 'client-qr';
      const res = await fetch(`${API_URL}/${endpoint}/${qrSession._id}/submissions/${submissionId}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete submission');
      setQrSession((prev) => ({
        ...prev,
        submissions: prev.submissions.filter((sub) => sub._id !== submissionId),
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  const copyQRLink = (token) => {
    const routeName = qrSessionType === 'candidate' ? 'candidate-form' : 'client-form';
    const url = `${FRONTEND_URL}/${routeName}/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    });
  };

  const downloadQRImage = async (token, label) => {
    const routeName = qrSessionType === 'candidate' ? 'candidate-form' : 'client-form';
    const qrUrl = getQRUrl(`${FRONTEND_URL}/${routeName}/${token}`, 400);
    try {
      const res = await fetch(qrUrl);
      if (!res.ok) throw new Error('Failed to fetch image');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${qrSessionType}-qr-${label.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('QR download failed, falling back to open in tab:', err);
      const a = document.createElement('a');
      a.href = qrUrl;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.click();
    }
  };

  useEffect(() => {
    loadData();
  }, [authHeaders]);

  const cards = useMemo(() => {
    if (!stats) return [];
    return [
      { title: 'Total Admins', value: stats.totalAdmins, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
      { title: 'Active Admins', value: stats.activeAdmins, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { title: 'Inactive Admins', value: stats.inactiveAdmins, icon: UserX, color: 'text-rose-600', bg: 'bg-rose-50' },
      { title: 'Total Recruiters', value: stats.totalRecruiters, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
      { title: 'Total Clients', value: stats.totalClients, icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50' },
      { title: 'Total Jobs', value: stats.totalJobs, icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { title: 'Active Jobs', value: stats.activeJobs, icon: Sparkles, color: 'text-sky-600', bg: 'bg-sky-50' },
      { title: 'Total Candidates', value: stats.totalCandidates, icon: GraduationCap, color: 'text-teal-600', bg: 'bg-teal-50' },
    ];
  }, [stats]);

  const filteredRecruiterStats = useMemo(() => {
    if (!statsSearch.trim()) return candidateRecruiterStats;
    const q = statsSearch.toLowerCase();
    return candidateRecruiterStats.filter(item =>
      (item.recruiterName || '').toLowerCase().includes(q) ||
      (item.recruiterEmail || '').toLowerCase().includes(q) ||
      (item.companyName || '').toLowerCase().includes(q)
    );
  }, [candidateRecruiterStats, statsSearch]);

  const recentAdmins = useMemo(() => admins.slice(0, 5), [admins]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Master Dashboard</h1>
          <p className="text-sm text-slate-500">Live system-wide analytics, admin companies and stats overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openQRModal('candidate')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm hover:shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <QrCode className="w-4 h-4" />
            Candidate QR
          </button>
          <button
            onClick={() => openQRModal('client')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium shadow-sm hover:shadow-sky-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <QrCode className="w-4 h-4" />
            Client QR
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm animate-pulse h-[98px]">
              <div className="h-4 bg-slate-100 rounded w-2/3 mb-4"></div>
              <div className="h-6 bg-slate-100 rounded w-1/3"></div>
            </div>
          ))
        ) : (
          cards.map((card) => {
            const Icon = card.icon;
            
            const cardTypeMap = {
              'Total Admins': 'admins',
              'Active Admins': 'active-admins',
              'Inactive Admins': 'inactive-admins',
              'Total Recruiters': 'recruiters',
              'Total Clients': 'clients',
              'Total Jobs': 'jobs',
              'Active Jobs': 'active-jobs',
              'Total Candidates': 'candidates'
            };
            const type = cardTypeMap[card.title];

            return (
              <div
                key={card.title}
                onClick={() => {
                  if (type === 'candidates') {
                    fetchCandidateRecruiterStats();
                  } else {
                    fetchModalData(type, 1, '');
                  }
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/10 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                      {card.title}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 flex items-center gap-1.5">
                      {card.value}
                      {modalType === type && modalLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
                      {type === 'candidates' && statsLoading && <Loader2 className="w-4 h-4 animate-spin text-teal-600" />}
                    </p>
                  </div>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg}`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Revenue Card & Splits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Projected Monthly Revenue</h2>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-extrabold text-slate-900">
              {loading ? '...' : `Rs. ${(stats?.monthlyRevenue || 0).toLocaleString('en-IN')}`}
            </p>
          </div>
          <div className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-100">
            Calculated using plan price multipliers for active subscriptions.
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 md:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Plan Split</h2>
              <p className="text-xs text-slate-500">Admin accounts by subscription.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['Basic', 'Pro', 'Enterprise', 'None'].map((plan) => {
              const count = admins.filter((admin) => (admin.subscriptionPlan || 'None') === plan).length;
              const planColors = {
                Basic: 'border-slate-100 text-slate-800 bg-slate-50',
                Pro: 'border-blue-100 text-blue-800 bg-blue-50',
                Enterprise: 'border-amber-100 text-amber-800 bg-amber-50',
                None: 'border-slate-100 text-slate-500 bg-slate-50'
              };
              return (
                <div key={plan} className={`flex flex-col justify-between p-4 rounded-xl border ${planColors[plan]}`}>
                  <span className="text-xs font-semibold uppercase tracking-wider">{plan}</span>
                  <span className="text-2xl font-bold mt-2">{loading ? '-' : count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Admins table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Admin Accounts</h2>
            <p className="text-xs text-slate-500 mt-0.5">Newest companies registered in the system.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Admin</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Company</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Plan</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">Loading admins...</td></tr>
              ) : recentAdmins.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">No admin accounts found.</td></tr>
              ) : recentAdmins.map((admin) => (
                <tr key={admin._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-900">{getName(admin)}</p>
                    <p className="text-xs text-slate-500">{admin.email}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">{admin.companyName || 'Not set'}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-100">
                      {admin.subscriptionPlan || 'None'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{formatDate(admin.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Drilldown Stats Modal for other cards ─────────────────────────── */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setModalType(null); setModalSearch(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900 capitalize">
                  {modalType.replace('-', ' ')} List
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">System-wide details for selected category</p>
              </div>
              <button onClick={() => { setModalType(null); setModalSearch(''); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={modalSearch}
                  onChange={e => {
                    setModalSearch(e.target.value);
                    fetchModalData(modalType, 1, e.target.value);
                  }}
                  placeholder="Search details..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-white rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  {/* ADMINS CARD TABLE HEADERS */}
                  {modalType.includes('admin') && (
                    <tr>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Admin Name</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Company Name</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Subscription Plan</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Created Date</th>
                    </tr>
                  )}
                  {/* RECRUITERS CARD TABLE HEADERS */}
                  {modalType === 'recruiters' && (
                    <tr>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Recruiter Name</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Phone</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Role</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Company Name</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                    </tr>
                  )}
                  {/* CLIENTS CARD TABLE HEADERS */}
                  {modalType === 'clients' && (
                    <tr>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Client Name</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Industry</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Location</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Contact Person</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Company Name (Admin)</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                    </tr>
                  )}
                  {/* JOBS CARD TABLE HEADERS */}
                  {modalType.includes('job') && (
                    <tr>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Job Code</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Position</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Client</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Recruiter</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Company Name (Admin)</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {modalLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Loading details...</p>
                      </td>
                    </tr>
                  ) : modalData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-400">
                        No records matching search.
                      </td>
                    </tr>
                  ) : (
                    modalData.map((item) => (
                      <tr key={item._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        {/* ADMINS ROW RENDERING */}
                        {modalType.includes('admin') && (
                          <>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">{item.name}</td>
                            <td className="px-5 py-4 text-xs font-semibold text-slate-500">{item.email}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-800">{item.companyName || '—'}</td>
                            <td className="px-5 py-4 text-sm text-slate-700">
                              <span className="bg-slate-100 border px-2 py-0.5 rounded text-xs font-bold text-slate-700">
                                {item.subscriptionPlan}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${item.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {item.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDate(item.createdAt)}</td>
                          </>
                        )}

                        {/* RECRUITERS ROW RENDERING */}
                        {modalType === 'recruiters' && (
                          <>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">{item.name}</td>
                            <td className="px-5 py-4 text-xs font-semibold text-slate-500">{item.email}</td>
                            <td className="px-5 py-4 text-xs text-slate-600">{item.phone || '—'}</td>
                            <td className="px-5 py-4 text-sm capitalize">
                              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                                item.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                              }`}>
                                {item.role}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-800">{item.companyName || '—'}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${item.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {item.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </>
                        )}

                        {/* CLIENTS ROW RENDERING */}
                        {modalType === 'clients' && (
                          <>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">{item.companyName}</td>
                            <td className="px-5 py-4 text-sm text-slate-600">{item.industry || '—'}</td>
                            <td className="px-5 py-4 text-sm text-slate-600">{item.clientLocation || '—'}</td>
                            <td className="px-5 py-4 text-xs font-medium text-slate-600 space-y-0.5">
                              <p className="font-semibold text-slate-700">{item.contactPerson || '—'}</p>
                              {item.email && <p className="flex items-center gap-1"><Mail size={12} /> {item.email}</p>}
                              {item.phone && <p className="flex items-center gap-1"><Phone size={12} /> {item.phone}</p>}
                            </td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-850">{item.tenantCompanyName}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${item.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {item.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </>
                        )}

                        {/* JOBS ROW RENDERING */}
                        {modalType.includes('job') && (
                          <>
                            <td className="px-5 py-4 font-mono text-xs font-bold text-slate-600">{item.jobCode}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-900">{item.position}</td>
                            <td className="px-5 py-4 text-sm text-slate-700">{item.clientName}</td>
                            <td className="px-5 py-4 text-sm text-slate-600">{item.primaryRecruiter || '—'}</td>
                            <td className="px-5 py-4 text-sm font-semibold text-slate-800">{item.tenantCompanyName}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border ${item.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {item.active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!modalLoading && modalTotalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-slate-500">
                  Showing {(modalPage - 1) * 10 + 1} - {Math.min(modalPage * 10, modalTotalItems)} of {modalTotalItems} items
                </span>
                <div className="inline-flex gap-2">
                  <button
                    onClick={() => fetchModalData(modalType, modalPage - 1, modalSearch)}
                    disabled={modalPage === 1}
                    className="p-1 rounded border bg-white disabled:opacity-50 text-slate-500"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-semibold text-slate-700 flex items-center">
                    Page {modalPage} of {modalTotalPages}
                  </span>
                  <button
                    onClick={() => fetchModalData(modalType, modalPage + 1, modalSearch)}
                    disabled={modalPage === modalTotalPages}
                    className="p-1 rounded border bg-white disabled:opacity-50 text-slate-500"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
              <button
                onClick={() => {
                  setModalType(null);
                  setModalSearch('');
                }}
                className="px-5 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Candidate Recruiter Stats Modal ─────────────────────────────────── */}
      {candidateStatsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setCandidateStatsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900">Candidates by Recruiter</h2>
                <p className="text-xs text-slate-500 mt-0.5">Recruiter-wise total candidate registrations across all companies</p>
              </div>
              <button onClick={() => setCandidateStatsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={statsSearch}
                  onChange={e => setStatsSearch(e.target.value)}
                  placeholder="Search recruiter name, email, or company name..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-white rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Recruiter Name</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Company Name</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase text-center w-28">Candidates</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecruiterStats.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-14 text-center text-sm text-slate-400">
                        No recruiter details matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRecruiterStats.map((item) => (
                      <tr key={item.recruiterId || item.recruiterName} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">{item.recruiterName}</td>
                        <td className="px-5 py-4 text-xs font-semibold text-slate-500">{item.recruiterEmail}</td>
                        <td className="px-5 py-4 text-sm text-slate-700 font-semibold">{item.companyName}</td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => fetchRecruiterCandidates(item, 1)}
                            className="inline-flex items-center justify-center rounded-full bg-teal-50 hover:bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700 hover:text-teal-800 border border-teal-100 hover:border-teal-200 transition-colors"
                          >
                            {item.count}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
              <button
                onClick={() => setCandidateStatsOpen(false)}
                className="px-5 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Candidates list Modal ─────────────────────────────────────────── */}
      {selectedRecruiterForCandidates && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedRecruiterForCandidates(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900">Candidates added by {selectedRecruiterForCandidates.recruiterName}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedRecruiterForCandidates.recruiterEmail} · {selectedRecruiterForCandidates.companyName}</p>
              </div>
              <button onClick={() => setSelectedRecruiterForCandidates(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">ID</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Candidate Name</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Contact</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Role</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Client</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">Date Added</th>
                  </tr>
                </thead>
                <tbody>
                  {recruiterCandidatesLoading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Loading candidates...</p>
                      </td>
                    </tr>
                  ) : recruiterCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-400">
                        No candidates added by this recruiter.
                      </td>
                    </tr>
                  ) : (
                    recruiterCandidates.map((cand) => (
                      <tr key={cand._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-5 py-4 font-mono text-xs text-slate-500">{cand.candidateId}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">{cand.name}</td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-600">
                          <p>{cand.email}</p>
                          <p>{cand.contact}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">{cand.position || '—'}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{cand.client || '—'}</td>
                        <td className="px-5 py-4">
                          {Array.isArray(cand.status) ? (
                            <div className="flex flex-wrap gap-1">
                              {cand.status.map(st => (
                                <span key={st} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                                  {st}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                              {cand.status}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDate(cand.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!recruiterCandidatesLoading && recruiterCandidatesTotalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-slate-500">
                  Showing {(recruiterCandidatesPage - 1) * 10 + 1} - {Math.min(recruiterCandidatesPage * 10, recruiterCandidatesTotalItems)} of {recruiterCandidatesTotalItems} candidates
                </span>
                <div className="inline-flex gap-2">
                  <button
                    onClick={() => fetchRecruiterCandidates(selectedRecruiterForCandidates, recruiterCandidatesPage - 1)}
                    disabled={recruiterCandidatesPage === 1}
                    className="p-1 rounded border bg-white disabled:opacity-50 text-slate-500"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-semibold text-slate-700 flex items-center">
                    Page {recruiterCandidatesPage} of {recruiterCandidatesTotalPages}
                  </span>
                  <button
                    onClick={() => fetchRecruiterCandidates(selectedRecruiterForCandidates, recruiterCandidatesPage + 1)}
                    disabled={recruiterCandidatesPage === recruiterCandidatesTotalPages}
                    className="p-1 rounded border bg-white disabled:opacity-50 text-slate-500"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
              <button
                onClick={() => setSelectedRecruiterForCandidates(null)}
                className="px-5 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Default QR Code Modal ─────────────────────────────────────────── */}
      {qrSessionType && (
        <DashboardQRModal
          type={qrSessionType}
          session={qrSession}
          loading={qrLoading}
          toggling={qrToggling}
          copied={qrCopied}
          onClose={() => { setQrSessionType(null); setQrSession(null); }}
          onToggleActive={toggleQRActive}
          onCopyLink={copyQRLink}
          onDownloadQR={downloadQRImage}
        />
      )}
    </div>
  );
}

/* ════════════════════ DASHBOARD QR MODAL ═══════════════════════════════════ */
function DashboardQRModal({
  type, session, loading, toggling, copied,
  onClose, onToggleActive, onCopyLink, onDownloadQR
}) {
  if (loading || !session) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center justify-center shadow-2xl max-w-sm w-full">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
          <p className="text-slate-600 font-medium text-sm">Loading QR session details...</p>
        </div>
      </div>
    );
  }

  const formUrl = `${FRONTEND_URL}/${type === 'candidate' ? 'candidate-form' : 'client-form'}/${session.token}`;
  const qrImgUrl = getQRUrl(formUrl, 220);

  const isExpired = session.expiresAt && new Date() > new Date(session.expiresAt);
  const isActive = session.active && !isExpired;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <QrCode className={`w-5 h-5 ${type === 'candidate' ? 'text-indigo-600' : 'text-sky-600'}`} />
              {type === 'candidate' ? 'Candidate' : 'Client'} QR Code
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scan or copy this link to register
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col items-center">
          <div className={`p-4 rounded-2xl border-2 ${isActive ? (type === 'candidate' ? 'border-indigo-100 bg-indigo-50/50' : 'border-sky-100 bg-sky-50/50') : 'border-slate-100 bg-slate-50 grayscale'} transition-all`}>
            <img src={qrImgUrl} alt="QR Code" width={220} height={220} className="rounded-lg shadow-sm" />
          </div>

          <div className="mt-5 w-full space-y-4">
            {/* Status Badge & Toggle */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div>
                <span className="text-xs text-slate-400 block font-medium">QR Status</span>
                <span className={`text-sm font-bold ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {isActive ? 'Active' : 'Paused / Inactive'}
                </span>
              </div>
              <button
                onClick={onToggleActive}
                disabled={toggling}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-60 ${
                  isActive
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {toggling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isActive ? (
                  <ToggleRight className="w-4 h-4" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
                {isActive ? 'Active' : 'Inactive'}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => onCopyLink(session.token)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-all"
              >
                {copied ? (
                  <><Check className="w-4 h-4 text-emerald-500" /> Link Copied!</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copy Link</>
                )}
              </button>
              
              <button
                onClick={() => onDownloadQR(session.token, session.label)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition-all shadow-sm"
              >
                <Download className="w-4 h-4" /> Download QR Image
              </button>
            </div>

            <div className="text-center">
              <a href={formUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:text-sky-700 font-medium inline-flex items-center gap-1 hover:underline">
                Open Form Link <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Submission Item (Expandable Row) ── */
function SubmissionItem({ sub, type, expanded, onToggle, onDelete }) {
  const isCandidate = type === 'candidate';
  const mainTitle = isCandidate ? `${sub.firstName} ${sub.lastName || ''}` : sub.companyName;
  const subTitle = isCandidate ? sub.email : `${sub.contactPerson || 'No contact'} · ${sub.email}`;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 select-none" onClick={onToggle}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
          isCandidate ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' : 'bg-gradient-to-br from-sky-500 to-blue-600'
        }`}>
          {(mainTitle?.[0] || '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-xs truncate">{mainTitle}</p>
          <p className="text-[10px] text-slate-400 truncate">{subTitle}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {isCandidate ? (
            sub.position && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{sub.position}</span>
          ) : (
            sub.industry && <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-medium">{sub.industry}</span>
          )}
          <span className="text-[10px] text-slate-400">{formatDate(sub.submittedAt)}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 text-xs">
          {isCandidate ? (
            /* Candidate detail layout */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
              <DetailField icon={<Users className="w-3 h-3" />} label="Candidate" value={`${sub.firstName} ${sub.lastName || ''}`} />
              <DetailField icon={<Mail className="w-3 h-3" />} label="Email" value={sub.email} />
              <DetailField icon={<Phone className="w-3 h-3" />} label="Contact" value={sub.contact} />
              {sub.alternateNumber && <DetailField icon={<Phone className="w-3 h-3" />} label="Alternate" value={sub.alternateNumber} />}
              {sub.gender && <DetailField icon={<Users className="w-3 h-3" />} label="Gender" value={sub.gender} />}
              {sub.dateOfBirth && <DetailField icon={<Clock className="w-3 h-3" />} label="D.O.B." value={sub.dateOfBirth} />}
              {sub.currentLocation && <DetailField icon={<MapPin className="w-3 h-3" />} label="Current Location" value={sub.currentLocation} />}
              {sub.preferredLocation && <DetailField icon={<MapPin className="w-3 h-3" />} label="Preferred Location" value={sub.preferredLocation} />}
              {sub.linkedin && (
                <div>
                  <p className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5"><ExternalLink className="w-3 h-3" />LinkedIn</p>
                  <a href={sub.linkedin.startsWith('http') ? sub.linkedin : `https://${sub.linkedin}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                    {sub.linkedin}
                  </a>
                </div>
              )}
              <div className="border-t border-slate-200 col-span-full my-0.5" />
              {sub.position && <DetailField icon={<Briefcase className="w-3 h-3" />} label="Position" value={sub.position} />}
              {sub.currentCompany && <DetailField icon={<Building2 className="w-3 h-3" />} label="Current Company" value={sub.currentCompany} />}
              {sub.totalExperience && <DetailField icon={<Clock className="w-3 h-3" />} label="Total Exp." value={`${sub.totalExperience} Years`} />}
              {sub.relevantExperience && <DetailField icon={<Clock className="w-3 h-3" />} label="Relevant Exp." value={`${sub.relevantExperience} Years`} />}
              {sub.education && <DetailField icon={<GraduationCap className="w-3 h-3" />} label="Education" value={sub.education} />}
              {sub.skills && <DetailField icon={<Layers className="w-3 h-3" />} label="Skills" value={sub.skills} />}
              <div className="border-t border-slate-200 col-span-full my-0.5" />
              {sub.ctc && <DetailField icon={<DollarSign className="w-3 h-3" />} label="Current CTC" value={sub.ctc} />}
              {sub.ectc && <DetailField icon={<DollarSign className="w-3 h-3" />} label="Expected CTC" value={sub.ectc} />}
              {sub.noticePeriod && <DetailField icon={<Clock className="w-3 h-3" />} label="Notice Period" value={sub.noticePeriod} />}
            </div>
          ) : (
            /* Client detail layout */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
              <DetailField icon={<Building2 className="w-3 h-3" />} label="Company" value={sub.companyName} />
              <DetailField icon={<Tag className="w-3 h-3" />} label="Industry" value={sub.industry} />
              {sub.companySize && <DetailField icon={<Layers className="w-3 h-3" />} label="Company Size" value={sub.companySize} />}
              {sub.gstNumber && <DetailField icon={<FileText className="w-3 h-3" />} label="GST No." value={sub.gstNumber} />}
              {sub.website && (
                <div>
                  <p className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5"><Globe className="w-3 h-3" />Website</p>
                  <a href={sub.website.startsWith('http') ? sub.website : `https://${sub.website}`} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline flex items-center gap-0.5">
                    {sub.website} <ExternalLink size={10} />
                  </a>
                </div>
              )}
              {sub.address && <DetailField icon={<MapPin className="w-3 h-3" />} label="Address" value={[sub.address, sub.city, sub.state, sub.country].filter(Boolean).join(', ')} />}
              <div className="border-t border-slate-200 col-span-full my-0.5" />
              <DetailField icon={<Users className="w-3 h-3" />} label="Contact Person" value={sub.contactPerson} />
              {sub.designation && <DetailField icon={<Briefcase className="w-3 h-3" />} label="Designation" value={sub.designation} />}
              <DetailField icon={<Mail className="w-3 h-3" />} label="Email" value={sub.email} />
              <DetailField icon={<Phone className="w-3 h-3" />} label="Phone" value={sub.phone} />
              {sub.alternatePhone && <DetailField icon={<Phone className="w-3 h-3" />} label="Alternate" value={sub.alternatePhone} />}
              {sub.linkedin && (
                <div>
                  <p className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5"><ExternalLink className="w-3 h-3" />LinkedIn</p>
                  <a href={sub.linkedin.startsWith('http') ? sub.linkedin : `https://${sub.linkedin}`} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
                    {sub.linkedin}
                  </a>
                </div>
              )}
              <div className="border-t border-slate-200 col-span-full my-0.5" />
              {sub.hiringFor && <DetailField icon={<Briefcase className="w-3 h-3" />} label="Hiring For" value={sub.hiringFor} />}
              {sub.hiringVolume && <DetailField icon={<Users className="w-3 h-3" />} label="Positions" value={sub.hiringVolume} />}
              {sub.urgency && <DetailField icon={<Clock className="w-3 h-3" />} label="Urgency" value={sub.urgency} />}
              {sub.budgetRange && <DetailField icon={<DollarSign className="w-3 h-3" />} label="Budget" value={sub.budgetRange} />}
              {sub.preferredEngagement && <DetailField icon={<Layers className="w-3 h-3" />} label="Engagement" value={sub.preferredEngagement} />}
              {sub.notes && (
                <div className="col-span-full mt-1">
                  <p className="text-[10px] text-slate-400 mb-1">Notes</p>
                  <p className="text-[11px] text-slate-700 bg-white rounded-lg p-2 border border-slate-200 whitespace-pre-wrap">{sub.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailField({ icon, label, value }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
        {icon}
        {label}
      </p>
      <p className="font-semibold text-slate-700 truncate">{value || '—'}</p>
    </div>
  );
}
