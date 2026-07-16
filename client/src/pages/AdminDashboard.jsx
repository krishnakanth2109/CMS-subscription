import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users, UserCheck, TrendingUp, PauseCircle, UserX, User,
  ClipboardList, Briefcase, X, Calendar, Plus,
  ArrowUpDown, ArrowUp, ArrowDown, Search
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import CandidateProfileLink from '@/components/CandidateProfileLink';
import RecruiterPerformanceModal from '@/components/RecruiterPerformanceModal';
import { RecruiterDetailsTrigger } from '@/components/RecruiterDetailsModal';
import RecruiterCandidateGrowthChart from '@/components/RecruiterCandidateGrowthChart';

// ─── API Helpers ──────────────────────────────────────────────────────────────
// FIX 1: Computed ONCE at module level — not re-computed on every render/call.
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

// FIX 2: Token read is a plain function — no hook overhead, no closure stale state.
function getFirebaseToken() {
  try {
    const raw = sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw)?.idToken : null;
  } catch { return null; }
}

// FIX 3: Single shared apiFetch — reads token fresh per call (token can rotate).
async function apiFetch(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getFirebaseToken()}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Status Helper — defined OUTSIDE component so it is never re-created ─────
// FIX 4: Moved out of component body → no new function reference on each render.
const getSafeStatus = (s) => {
  if (Array.isArray(s)) return String(s[0] || '').trim().toLowerCase();
  return String(s || '').trim().toLowerCase();
};

const getCandidateRecruiterId = (candidate) => {
  const rec = candidate.recruiterId;
  if (!rec) return '';
  if (typeof rec === 'object') return String(rec._id || rec.id || '');
  return String(rec);
};

const getRecruiterName = (recruiter = {}) => (
  recruiter.name ||
  `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim() ||
  recruiter.username ||
  recruiter.email ||
  'Unnamed Recruiter'
);

const statusMatchesMetric = (candidate, metric) => {
  // status may be a plain string or [String] array — normalise to string
  const statusVal = candidate.status;
  const statusStr = Array.isArray(statusVal)
    ? String(statusVal[statusVal.length - 1] || '').trim().toLowerCase()
    : String(statusVal || '').trim().toLowerCase();

  if (metric === 'submissions') return true;
  if (metric === 'pending') return ['submitted', 'pending', 'pipeline'].includes(statusStr);
  return statusStr === metric.toLowerCase();
};

const RECRUITER_PERFORMANCE_COLUMNS = [
  { key: 'submissions', label: 'Submissions', className: 'text-blue-600 font-black' },
  { key: 'hold', label: 'Hold', className: 'text-orange-400 font-bold' },
  { key: 'joined', label: 'Joined', className: 'text-green-600 font-black' },
  { key: 'rejected', label: 'Rejected', className: 'text-red-500 font-medium' },
  { key: 'pending', label: 'Pending', className: 'text-gray-500 font-medium' },
];

// ─── REUSABLE CARD COMPONENTS ─────────────────────────────────────────────────
// FIX 5: Both card components are defined outside the parent component.
//        Defining components inside another component forces React to unmount/
//        remount them on every render of the parent — very expensive for tables
//        and grids with many cards.

const PrimaryStatCard = React.memo(({ title, value, trend = 0, progress = 0, icon: Icon, onClick }) => (
  <div
    onClick={onClick}
    className="relative overflow-hidden bg-[#3530a0] rounded-[1.5rem] p-6 text-white shadow-lg h-44 flex flex-col justify-between cursor-pointer"
  >
    <div className="relative z-10 flex justify-between items-start">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">{title}</p>
        <h3 className="text-4xl font-bold mt-2">{value}</h3>
      </div>
      <div className="p-2 bg-white/10 rounded-lg">
        <Icon className="w-7 h-7 text-white" />
      </div>
    </div>
    <div className="relative z-10 mt-auto">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'px-2 py-0.5 rounded text-[10px] font-bold text-white',
            trend >= 0 ? 'bg-green-500' : 'bg-red-500'
          )}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-[10px] opacity-70">vs last month</span>
        </div>
        <span className="text-[10px] font-bold text-white/80">{progress}%</span>
      </div>
      <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
        <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 pointer-events-none" />
  </div>
));

const BUBBLE_THEMES = {
  green: { bubble: 'bg-[#e8f5e9]', iconBg: 'bg-[#e8f5e9]', iconText: 'text-green-600', badge: 'bg-green-500', bar: 'bg-green-500' },
  blue: { bubble: 'bg-[#e3f2fd]', iconBg: 'bg-[#e3f2fd]', iconText: 'text-blue-600', badge: 'bg-blue-500', bar: 'bg-blue-500' },
  purple: { bubble: 'bg-[#f3e5f5]', iconBg: 'bg-[#f3e5f5]', iconText: 'text-purple-600', badge: 'bg-purple-500', bar: 'bg-purple-500' },
  orange: { bubble: 'bg-[#fff3e0]', iconBg: 'bg-[#fff3e0]', iconText: 'text-orange-500', badge: 'bg-orange-400', bar: 'bg-orange-400' },
  red: { bubble: 'bg-[#ffebee]', iconBg: 'bg-[#ffebee]', iconText: 'text-red-500', badge: 'bg-red-500', bar: 'bg-red-500' },
};

// FIX 6: Theme map is module-level constant — not re-created inside the component on every render.
const BubbleStatCard = React.memo(({ title, value, trend = 0, progress = 0, icon: Icon, theme = 'blue', onClick }) => {
  const t = BUBBLE_THEMES[theme] || BUBBLE_THEMES.blue;
  return (
    <div
      onClick={onClick}
      className="relative bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100 h-44 flex flex-col justify-between cursor-pointer overflow-hidden"
    >
      <div className={clsx('absolute -top-6 -left-6 w-36 h-36 rounded-full pointer-events-none', t.bubble)} />
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
          <h3 className="text-4xl font-bold mt-2 text-slate-800">{value}</h3>
        </div>
        <div className={clsx('p-2 rounded-lg', t.iconBg)}>
          <Icon className={clsx('w-6 h-6', t.iconText)} />
        </div>
      </div>
      <div className="relative z-10 mt-auto">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className={clsx(
              'px-2 py-0.5 rounded text-[10px] font-bold text-white',
              trend >= 0 ? t.badge : 'bg-red-500'
            )}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
            <span className="text-[10px] text-gray-400">vs last month</span>
          </div>
          <span className="text-[10px] font-bold text-gray-500">{progress}%</span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full transition-all duration-500', t.bar)} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
});

// ─── Loading Spinner ───────────────────────────────────────────────────────────
const RecruiterMetricButton = ({ value, className, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'inline-flex min-w-6 justify-center rounded-sm underline-offset-4 transition hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200',
      className
    )}
  >
    {value}
  </button>
);

const FullPageSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#f3f6fd]">
    <div className="animate-spin h-12 w-12 border-4 border-[#283086] border-t-transparent rounded-full" />
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [performanceModal, setPerformanceModal] = useState(null);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recruiterFilter, setRecruiterFilter] = useState('All');
  const [sortField, setSortField] = useState('submissions');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableStartDate, setTableStartDate] = useState('');
  const [tableEndDate, setTableEndDate] = useState('');

  // ── FIX 7: Initial fetch — all 4 endpoints in parallel, settled so a single
  //    slow/failing endpoint never blocks the others from painting data. ────────
  useEffect(() => {
    let cancelled = false; // FIX 8: Cleanup flag — prevents state update if component unmounts mid-fetch

    const fetchData = async () => {
      try {
        const [candR, recR, jobsR] = await Promise.allSettled([
          apiFetch('/candidates?view=dashboard'),
          apiFetch('/recruiters?view=lookup'),
          apiFetch('/jobs?view=dashboard'),
        ]);
        if (cancelled) return;
        if (candR.status === 'fulfilled') setCandidates(candR.value);
        if (recR.status === 'fulfilled') setRecruiters(recR.value);
        if (jobsR.status === 'fulfilled') setJobs(jobsR.value);
      } catch {
        if (!cancelled) toast({ title: 'Sync Error', description: 'Check server connection', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FIX 10: Modal fetch — useCallback so the function reference is stable;
  //    only re-created when filterDate changes (not on every render). ───────────
  const fetchModalData = useCallback(async () => {
    setModalLoading(true);
    try {
      const data = await apiFetch(`/candidates?view=dashboard&date=${filterDate}`);
      setModalData(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch day submissions', variant: 'destructive' });
    } finally {
      setModalLoading(false);
    }
  }, [filterDate, toast]);

  useEffect(() => {
    if (isModalOpen) fetchModalData();
  }, [isModalOpen, fetchModalData]);

  // ── Computed stats — all useMemo with correct minimal dep arrays ─────────────
  const recruiterOptions = useMemo(() => (
    recruiters
      .filter(r => r._id || r.id)
      .map(r => ({ id: String(r._id || r.id), name: getRecruiterName(r) }))
      .filter(r => r.name.trim() !== '')
      .sort((a, b) => a.name.localeCompare(b.name))
  ), [recruiters]);

  const selectedRecruiterName = useMemo(() => {
    if (recruiterFilter === 'All') return 'all recruiters';
    return recruiterOptions.find(r => r.id === recruiterFilter)?.name || 'selected recruiter';
  }, [recruiterFilter, recruiterOptions]);

  const scopedCandidates = useMemo(() => (
    recruiterFilter === 'All'
      ? candidates
      : candidates.filter(c => getCandidateRecruiterId(c) === recruiterFilter)
  ), [candidates, recruiterFilter]);

  const visibleRecruiters = useMemo(() => (
    recruiterFilter === 'All'
      ? recruiters
      : recruiters.filter(r => String(r._id || r.id || '') === recruiterFilter)
  ), [recruiters, recruiterFilter]);

  const hasStatus = useCallback((c, targetStatus) => {
    const statusVal = c.status;
    const statusStr = Array.isArray(statusVal)
      ? String(statusVal[statusVal.length - 1] || '').trim().toLowerCase()
      : String(statusVal || '').trim().toLowerCase();
    const targets = Array.isArray(targetStatus)
      ? targetStatus.map(t => String(t || '').trim().toLowerCase())
      : [String(targetStatus || '').trim().toLowerCase()];
    return targets.includes(statusStr);
  }, []);

  const stats = useMemo(() => {
    const total = scopedCandidates.length;
    const submitted = scopedCandidates.filter(c => hasStatus(c, ['Submitted', 'Pending', 'Pipeline'])).length;
    const joined = scopedCandidates.filter(c => hasStatus(c, 'Joined')).length;
    const hold = scopedCandidates.filter(c => hasStatus(c, 'Hold')).length;
    const rejected = scopedCandidates.filter(c => hasStatus(c, 'Rejected')).length;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todaySubmissions = scopedCandidates.filter(c => {
      const d = new Date(c.dateAdded || c.createdAt);
      return d >= todayStart && d <= todayEnd;
    }).length;

    return { total, submitted, joined, hold, rejected, todaySubmissions };
  }, [scopedCandidates, hasStatus]);

  const scopedJobs = useMemo(() => {
    if (recruiterFilter === 'All') return jobs;
    const rec = recruiters.find(r => String(r._id || r.id) === recruiterFilter);
    if (!rec) return jobs;
    const recId = String(rec._id || rec.id);
    const recName = `${rec.firstName || ''} ${rec.lastName || ''}`.trim().toLowerCase();
    const recUsername = (rec.username || '').toLowerCase();
    const recEmail = (rec.email || '').toLowerCase();

    return jobs.filter(j => {
      const primary = String(j.primaryRecruiter || '').toLowerCase();
      const secondary = String(j.secondaryRecruiter || '').toLowerCase();
      const assigned = String(j.assignedRecruiter || j.recruiterId || '');
      return assigned === recId || 
             primary === recName || 
             secondary === recName || 
             primary === recUsername || 
             secondary === recUsername || 
             primary === recEmail || 
             secondary === recEmail;
    });
  }, [jobs, recruiters, recruiterFilter]);

  const avgTimeToHireDays = useMemo(() => {
    const joinedCandidates = scopedCandidates.filter(c => hasStatus(c, 'Joined'));
    if (joinedCandidates.length === 0) return 0;
    const totalDays = joinedCandidates.reduce((sum, c) => {
      const start = new Date(c.dateAdded || c.createdAt);
      const end = new Date(c.statusChangedAt || new Date());
      const diffTime = Math.max(0, end - start);
      return sum + (diffTime / (1000 * 60 * 60 * 24));
    }, 0);
    return parseFloat((totalDays / joinedCandidates.length).toFixed(1));
  }, [scopedCandidates, hasStatus]);

  const getTrendForItems = useCallback((items, dateField = 'createdAt') => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const currentMonth = items.filter(item => new Date(item[dateField]) >= currentMonthStart).length;
    const prevMonth = items.filter(item => {
      const d = new Date(item[dateField]);
      return d >= prevMonthStart && d <= prevMonthEnd;
    }).length;

    if (prevMonth > 0) return Math.round(((currentMonth - prevMonth) / prevMonth) * 100);
    if (currentMonth > 0) return 100;
    return 0;
  }, []);

  const trends = useMemo(() => {
    return {
      candidates: getTrendForItems(scopedCandidates, 'createdAt'),
      recruiters: getTrendForItems(visibleRecruiters.filter(r => r.role === 'recruiter'), 'createdAt'),
      jobs: getTrendForItems(scopedJobs, 'createdAt'),
      todaySubmissions: getTrendForItems(scopedCandidates.filter(c => {
        const d = new Date(c.dateAdded || c.createdAt);
        return d.toDateString() === new Date().toDateString();
      }), 'createdAt'),
      submitted: getTrendForItems(scopedCandidates.filter(c => hasStatus(c, ['Submitted', 'Pending', 'Pipeline'])), 'createdAt'),
      joined: getTrendForItems(scopedCandidates.filter(c => hasStatus(c, 'Joined')), 'createdAt'),
      hold: getTrendForItems(scopedCandidates.filter(c => hasStatus(c, 'Hold')), 'createdAt'),
      rejected: getTrendForItems(scopedCandidates.filter(c => hasStatus(c, 'Rejected')), 'createdAt'),
    };
  }, [scopedCandidates, visibleRecruiters, scopedJobs, getTrendForItems, hasStatus]);

  const ratios = useMemo(() => {
    const total = stats.total;

    const active = scopedCandidates.filter(c => {
      const s = String(c.status || '').trim().toLowerCase();
      return !['rejected', 'backout', 'no show'].includes(s);
    }).length;

    const rTotal = visibleRecruiters.filter(r => r.role === 'recruiter').length;
    const rActive = visibleRecruiters.filter(r => r.role === 'recruiter' && r.active !== false).length;

    const jTotal = scopedJobs.length;
    const jActive = scopedJobs.filter(j => j.active !== false).length;

    const todayTarget = Math.max(10, stats.total * 0.02);
    const todayPct = Math.min(100, Math.round((stats.todaySubmissions / todayTarget) * 100));

    const pct = (count) => total > 0 ? Math.round((count / total) * 100) : 0;

    return {
      candidates: total > 0 ? Math.round((active / total) * 100) : 0,
      recruiters:  rTotal > 0 ? Math.round((rActive / rTotal) * 100) : 0,
      jobs:        jTotal > 0 ? Math.round((jActive / jTotal) * 100) : 0,
      todaySubmissions: todayPct,
      submitted:   pct(stats.submitted),
      joined:      pct(stats.joined),
      hold:        pct(stats.hold),
      rejected:    pct(stats.rejected),
    };
  }, [stats, scopedCandidates, visibleRecruiters, scopedJobs]);

  const recruiterStats = useMemo(() => {
    let stats = visibleRecruiters
      .filter(r => r._id || r.id)
      .map(r => {
        const rid = r._id || r.id;
        let cands = candidates.filter(c => getCandidateRecruiterId(c) === String(rid));

        if (tableStartDate) {
          const start = new Date(tableStartDate);
          start.setHours(0, 0, 0, 0);
          cands = cands.filter(c => new Date(c.dateAdded || c.createdAt) >= start);
        }
        if (tableEndDate) {
          const end = new Date(tableEndDate);
          end.setHours(23, 59, 59, 999);
          cands = cands.filter(c => new Date(c.dateAdded || c.createdAt) <= end);
        }

        const name = getRecruiterName(r);
        return {
          id: String(rid),
          recruiter: r,
          fullName: name,
          submissions: cands.length,
          joined: cands.filter(c => statusMatchesMetric(c, 'joined')).length,
          pending: cands.filter(c => statusMatchesMetric(c, 'pending')).length,
          hold: cands.filter(c => statusMatchesMetric(c, 'hold')).length,
          rejected: cands.filter(c => statusMatchesMetric(c, 'rejected')).length,
          selected: cands.filter(c => statusMatchesMetric(c, 'selected')).length,
          avgTimeToHire: 0,
        };
      })
      .filter(r => r.fullName !== '');

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      stats = stats.filter(r => r.fullName.toLowerCase().includes(q));
    }

    stats.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc'
          ? (valA || 0) - (valB || 0)
          : (valB || 0) - (valA || 0);
      }
    });

    return stats;
  }, [candidates, visibleRecruiters, sortField, sortOrder, searchQuery, tableStartDate, tableEndDate]);

  const recruiterTotals = useMemo(() => (
    RECRUITER_PERFORMANCE_COLUMNS.reduce((totals, column) => {
      totals[column.key] = recruiterStats.reduce((sum, row) => sum + (Number(row[column.key]) || 0), 0);
      return totals;
    }, {})
  ), [recruiterStats]);

  const barData = useMemo(
    () => [...recruiterStats]
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 6)
      .map(r => ({
        name: r.fullName.split(' ')[0],
        submissions: r.submissions,
        selected: r.selected,
        rejected: r.rejected
      })),
    [recruiterStats]
  );

  const filteredModalData = useMemo(() => {
    if (recruiterFilter === 'All') return modalData;
    return modalData.filter(c => getCandidateRecruiterId(c) === recruiterFilter);
  }, [modalData, recruiterFilter]);

  const openPerformanceModal = useCallback((recruiterRow, column) => {
    const rows = candidates.filter(candidate => (
      getCandidateRecruiterId(candidate) === recruiterRow.id && statusMatchesMetric(candidate, column.key)
    ));
    setPerformanceModal({
      title: `${recruiterRow.fullName} - ${column.label}`,
      subtitle: `${column.label} candidates for ${recruiterRow.fullName}`,
      rows,
    });
  }, [candidates]);

  const openPerformanceTotalModal = useCallback((column) => {
    const visibleRecruiterIds = new Set(recruiterStats.map(row => row.id));
    const rows = candidates.filter(candidate => (
      visibleRecruiterIds.has(getCandidateRecruiterId(candidate)) && statusMatchesMetric(candidate, column.key)
    ));
    setPerformanceModal({
      title: `Total ${column.label}`,
      subtitle: `${column.label} candidates across all recruiters in this table`,
      rows,
    });
  }, [candidates, recruiterStats]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField, sortOrder]);

  const renderSortIcon = useCallback((field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400 opacity-60 inline-block" />;
    }
    if (sortOrder === 'asc') {
      return <ArrowUp className="w-3 h-3 ml-1 text-[#283086] inline-block" />;
    }
    return <ArrowDown className="w-3 h-3 ml-1 text-[#283086] inline-block" />;
  }, [sortField, sortOrder]);

  if (loading) return <FullPageSpinner />;

  const formattedDate = format(new Date(), 'dd MMM, yyyy').toUpperCase();

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white/50 p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-[#283086] tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Welcome back <span className="text-[#283086] font-bold">{currentUser?.firstName || 'Admin'}</span>, Have a nice day..!
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <select
              value={recruiterFilter}
              onChange={(e) => setRecruiterFilter(e.target.value)}
              className="pl-4 pr-10 py-2.5 text-xs font-bold uppercase tracking-wider border border-gray-200 rounded-xl text-[#283086] focus:ring-4 focus:ring-blue-100 focus:outline-none bg-white appearance-none cursor-pointer shadow-sm transition-all hover:border-[#283086]"
            >
              <option value="All">All Recruiters</option>
              {recruiterOptions.map(recruiter => (
                <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-[#283086] transition-colors">
              <Plus size={14} className="rotate-45" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-gray-400 bg-white border border-gray-100 px-5 py-2.5 rounded-xl shadow-sm">
            <span className="flex items-center gap-2 px-2 border-r border-gray-100 mr-2">
              <Calendar size={12} className="text-[#283086]" />
              {formattedDate}
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#283086]" />
            </span>
          </div>
        </div>
      </div>

      {/* Row 1: Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PrimaryStatCard
          title="Total Candidates"
          value={stats.total}
          trend={trends.candidates}
          progress={ratios.candidates}
          icon={Users}
          onClick={() => navigate('/admin/add-candidate', { state: { filter: 'All' } })}
        />
        <BubbleStatCard title="Recruiters" value={visibleRecruiters.filter(r => r.role === 'recruiter').length} trend={trends.recruiters} progress={ratios.recruiters} icon={UserCheck} theme="green" onClick={() => navigate('/admin/recruiters')} />
        <BubbleStatCard title="Total Jobs" value={scopedJobs.length} trend={trends.jobs} progress={ratios.jobs} icon={Briefcase} theme="blue" onClick={() => navigate('/admin/requirements')} />
        <BubbleStatCard title="Today Submissions" value={stats.todaySubmissions} trend={trends.todaySubmissions} progress={ratios.todaySubmissions} icon={ClipboardList} theme="purple" onClick={openModal} />
      </div>

      {/* Row 2: Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <BubbleStatCard title="Submitted" value={stats.submitted} trend={trends.submitted} progress={ratios.submitted} icon={User} theme="purple" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Submitted' } })} />
        <BubbleStatCard title="Joined" value={stats.joined} trend={trends.joined} progress={ratios.joined} icon={UserCheck} theme="green" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Joined' } })} />
        <BubbleStatCard title="Hold" value={stats.hold} trend={trends.hold} progress={ratios.hold} icon={PauseCircle} theme="orange" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Hold' } })} />
        <BubbleStatCard title="Rejected" value={stats.rejected} trend={trends.rejected} progress={ratios.rejected} icon={UserX} theme="red" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Rejected' } })} />
      </div>

      {/* Row 3: Middle Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avg. Time of Hire</p>
            <h3 className="text-4xl font-bold text-slate-800 mt-2">{avgTimeToHireDays > 0 ? `${avgTimeToHireDays} Days` : '0.0 Days'}</h3>
            <div className="w-full h-2 bg-gray-100 rounded-full mt-6">
              <div className="h-full bg-[#283086] rounded-full transition-all duration-500" style={{ width: `${avgTimeToHireDays > 0 ? Math.max(10, Math.min(100, Math.round((1 - avgTimeToHireDays / 45) * 100))) : 0}%` }} />
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl"><TrendingUp size={32} className="text-blue-600" /></div>
        </div>
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Joining Pipeline</p>
            <h3 className="text-4xl font-bold text-slate-800 mt-2">{stats.total}</h3>
            <p className="text-xs text-gray-400 mt-2">Active candidates in pipeline</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-xl"><User size={32} className="text-indigo-600" /></div>
        </div>
      </div>

      {/* Row 4: Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100 h-full min-h-[460px] dark:border-white/10 dark:bg-slate-900">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Top Recruiters (Upload Report)</h3>
            <span className="text-xs text-gray-400">
              {recruiterFilter === 'All'
                ? `showing ${Math.min(6, recruiterStats.length)} of ${recruiterStats.length}`
                : selectedRecruiterName}
            </span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barSize={35} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${v}`} />
                <Tooltip
                  cursor={{ fill: '#f8fafc', radius: 8 }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="submissions" name="Total" fill="#5664d2" radius={[6, 6, 0, 0]} />
                <Bar dataKey="selected" name="Selected" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="rejected" name="Rejected" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <RecruiterCandidateGrowthChart
          candidates={candidates}
          recruiters={recruiters}
          loading={loading}
        />
      </div>

      {/* Row 5: Table */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 flex justify-between items-center bg-[#f8faff] border-b border-gray-100 flex-wrap gap-4">
          <h3 className="text-base font-bold text-slate-800">Recruiter Performance Details</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search recruiter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-4 py-2.5 text-xs border border-gray-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-[#283086] focus:outline-none w-48 bg-white"
              />
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-gray-400" />
            </div>

            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm text-[11px] text-slate-600 font-semibold">
              <input
                type="date"
                value={tableStartDate}
                onChange={(e) => setTableStartDate(e.target.value)}
                className="border-none focus:outline-none bg-transparent text-slate-700 w-28 cursor-pointer"
                title="Start Date"
              />
              <span className="text-gray-400 font-normal">to</span>
              <input
                type="date"
                value={tableEndDate}
                onChange={(e) => setTableEndDate(e.target.value)}
                className="border-none focus:outline-none bg-transparent text-slate-700 w-28 cursor-pointer"
                title="End Date"
              />
              {(tableStartDate || tableEndDate) && (
                <button
                  onClick={() => { setTableStartDate(''); setTableEndDate(''); }}
                  className="text-gray-400 hover:text-red-500 ml-1 transition-colors"
                  title="Clear Date Range"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button onClick={() => navigate('/admin/recruiters')} className="bg-[#283086] text-white px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wide hover:bg-blue-900 shadow-lg whitespace-nowrap">
              View All Recruiters
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f8faff] text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
              <tr>
                <th
                  className="px-8 py-5 text-left cursor-pointer select-none hover:text-slate-800 transition-colors"
                  onClick={() => handleSort('fullName')}
                >
                  <div className="flex items-center gap-1">
                    <span>Recruiter</span>
                    {renderSortIcon('fullName')}
                  </div>
                </th>
                {RECRUITER_PERFORMANCE_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-5 text-center cursor-pointer select-none hover:text-slate-800 transition-colors"
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{column.label}</span>
                      {renderSortIcon(column.key)}
                    </div>
                  </th>
                ))}
                <th
                  className="px-8 py-5 text-right cursor-pointer select-none hover:text-slate-800 transition-colors"
                  onClick={() => handleSort('avgTimeToHire')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Avg. Time to Hire</span>
                    {renderSortIcon('avgTimeToHire')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {recruiterStats.map((r, i) => (
                <tr key={r.fullName || i} className="hover:bg-blue-50/30">
                  <td className="px-8 py-5 font-bold text-slate-700">
                    <RecruiterDetailsTrigger recruiter={r.recruiter} className="text-slate-700 font-bold">
                      {r.fullName}
                    </RecruiterDetailsTrigger>
                  </td>
                  {RECRUITER_PERFORMANCE_COLUMNS.map((column) => (
                    <td key={column.key} className="px-4 py-5 text-center">
                      <RecruiterMetricButton
                         value={r[column.key]}
                         className={column.className}
                         onClick={() => openPerformanceModal(r, column)}
                       />
                    </td>
                  ))}
                  <td className="px-8 py-5 text-right font-black text-red-500">0.0%</td>
                </tr>
              ))}
              {recruiterStats.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No active recruiter data available</td></tr>
              )}
            </tbody>
            {recruiterStats.length > 0 && (
              <tfoot className="bg-[#f8faff] border-t border-gray-100">
                <tr>
                  <td className="px-8 py-5 font-black text-slate-800">Total</td>
                  {RECRUITER_PERFORMANCE_COLUMNS.map((column) => (
                    <td key={column.key} className="px-4 py-5 text-center">
                      <RecruiterMetricButton
                        value={recruiterTotals[column.key] || 0}
                        className={column.className}
                        onClick={() => openPerformanceTotalModal(column)}
                      />
                    </td>
                  ))}
                  <td className="px-8 py-5 text-right font-black text-red-500">0.0%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MODAL: Day Submissions */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#f8faff]">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-purple-600" />
                  Day Submissions
                </h2>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Viewing candidates submitted by {selectedRecruiterName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={recruiterFilter}
                  onChange={(e) => setRecruiterFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-[#283086] focus:outline-none bg-white appearance-none cursor-pointer"
                >
                  <option value="All">All Recruiters</option>
                  {recruiterOptions.map(recruiter => (
                    <option key={recruiter.id} value={recruiter.id}>{recruiter.name}</option>
                  ))}
                </select>
                <div className="relative flex items-center">
                  <Calendar className="absolute left-3 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={filterDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-[#283086] focus:outline-none"
                  />
                </div>
                <button onClick={closeModal} className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-white p-0">
              {modalLoading ? (
                <div className="flex flex-col h-64 items-center justify-center gap-3">
                  <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
                  <p className="text-sm text-gray-500 font-medium tracking-wide">Fetching Submissions...</p>
                </div>
              ) : filteredModalData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="bg-gray-50 p-4 rounded-full mb-3">
                    <ClipboardList className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-slate-800 font-bold">No submissions found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {recruiterFilter !== 'All'
                      ? `No candidates submitted by ${selectedRecruiterName} on ${filterDate}`
                      : `No candidates were added on ${filterDate}`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead className="bg-[#f8faff] text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 text-left">Candidate ID</th>
                        <th className="px-6 py-4 text-left">Candidate Name</th>
                        <th className="px-6 py-4 text-left">Recruiter</th>
                        <th className="px-6 py-4 text-left">Position</th>
                        <th className="px-6 py-4 text-left">Client</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredModalData.map((c) => {
                        const rec = c.recruiterId;
                        const recruiterName = rec
                          ? (typeof rec === 'object'
                            ? `${rec.firstName || rec.name || ''} ${rec.lastName || ''}`.trim() || rec.username || 'Unknown'
                            : 'Unknown')
                          : (c.recruiterName || 'Unknown');
                        const recruiterDetails = typeof rec === 'object' ? rec : { name: recruiterName };
                        const cStatus = Array.isArray(c.status) ? c.status[0] : c.status;
                        return (
                          <tr key={c._id} className="hover:bg-purple-50/30">
                            <td className="px-6 py-4 font-bold text-[#283086]">{c.candidateId || 'N/A'}</td>
                            <td className="px-6 py-4">
                              <CandidateProfileLink candidate={c} className="text-slate-800">
                                {c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown Candidate'}
                              </CandidateProfileLink>
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-600">
                              <RecruiterDetailsTrigger recruiter={recruiterDetails} className="text-gray-600 font-medium">
                                {recruiterName}
                              </RecruiterDetailsTrigger>
                            </td>
                            <td className="px-6 py-4 text-gray-500">{c.position || '-'}</td>
                            <td className="px-6 py-4 text-gray-500">{c.client || '-'}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {cStatus || 'SUBMITTED'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!modalLoading && filteredModalData.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs font-medium text-gray-500">
                <p>
                  Showing {filteredModalData.length} submission(s) for the selected date
                  {recruiterFilter !== 'All' && <span> · <span className="text-purple-600 font-semibold">{selectedRecruiterName}</span></span>}
                </p>
                <button onClick={closeModal} className="text-slate-700 hover:text-[#283086] font-bold uppercase tracking-wider">
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <RecruiterPerformanceModal
        detail={performanceModal}
        onClose={() => setPerformanceModal(null)}
      />
    </div>
  );
}
