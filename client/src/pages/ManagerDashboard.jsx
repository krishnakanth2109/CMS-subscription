import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, UserCheck, TrendingUp, PauseCircle, UserX, User,
  ClipboardList, Briefcase, FileText, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  LineChart, Line
} from 'recharts';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

// ─── API Helpers ──────────────────────────────────────────────────────────────
// Module-level constants — computed once, never re-derived on re-render.
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

function getFirebaseToken() {
  try {
    const raw = sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw)?.idToken : null;
  } catch { return null; }
}

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

// ─── Status helper — module level so it's never re-created ───────────────────
const getSafeStatus = (s) => {
  if (Array.isArray(s)) return String(s[0] || '').toLowerCase();
  return String(s || '').toLowerCase();
};

// ─── Helper to safely get candidate's recruiter name ─────────────────────────
const getRecruiterNameOfCandidate = (c) => {
  const rec = c.recruiterId;
  if (!rec) return 'Unknown';
  if (typeof rec === 'object') {
    return `${rec.firstName || rec.name || ''} ${rec.lastName || ''}`.trim() || rec.username || 'Unknown';
  }
  return 'Unknown';
};

// ─── Theme map — module level constant, not recreated per render ──────────────
const BUBBLE_THEMES = {
  green: { bubble: 'bg-[#e8f5e9]', iconBg: 'bg-[#e8f5e9]', iconText: 'text-green-600', badge: 'bg-green-500', bar: 'bg-green-500' },
  blue: { bubble: 'bg-[#e3f2fd]', iconBg: 'bg-[#e3f2fd]', iconText: 'text-blue-600', badge: 'bg-blue-500', bar: 'bg-blue-500' },
  purple: { bubble: 'bg-[#f3e5f5]', iconBg: 'bg-[#f3e5f5]', iconText: 'text-purple-600', badge: 'bg-purple-500', bar: 'bg-purple-500' },
  orange: { bubble: 'bg-[#fff3e0]', iconBg: 'bg-[#fff3e0]', iconText: 'text-orange-500', badge: 'bg-orange-400', bar: 'bg-orange-400' },
  red: { bubble: 'bg-[#ffebee]', iconBg: 'bg-[#ffebee]', iconText: 'text-red-500', badge: 'bg-red-500', bar: 'bg-red-500' },
};

// ─── Card components — defined OUTSIDE parent so React doesn't unmount/remount
//     them on every parent re-render. Wrapped in React.memo for extra safety. ──

const PrimaryStatCard = React.memo(({ title, value, trend, icon: Icon, onClick }) => (
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
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-green-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">+{trend}%</span>
        <span className="text-[10px] opacity-70">vs last month</span>
      </div>
      <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
        <div className="h-full bg-blue-400 rounded-full w-2/5" />
      </div>
    </div>
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 pointer-events-none" />
  </div>
));

const BubbleStatCard = React.memo(({ title, value, trend, icon: Icon, theme = 'blue', onClick }) => {
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
        <div className="flex items-center gap-2 mb-2">
          <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold text-white', t.badge)}>+{trend}%</span>
          <span className="text-[10px] text-gray-400">vs last month</span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full w-2/5', t.bar)} />
        </div>
      </div>
    </div>
  );
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
// NOTE: Export name kept as AdminDashboard to avoid breaking existing route imports.
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Line chart state
  const [lineGraphView, setLineGraphView] = useState('month');
  const [lineRecruiterFilter, setLineRecruiterFilter] = useState('All');
  const [performanceModal, setPerformanceModal] = useState(null);

  // FIX: Added cleanup flag to prevent setState on unmounted component.
  // FIX: Promise.allSettled so a slow /jobs or /clients endpoint never blocks
  //      candidates (the most important data) from rendering.
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [candR, recR, jobsR, clientR] = await Promise.allSettled([
          apiFetch('/candidates'),
          apiFetch('/recruiters'),
          apiFetch('/jobs'),
          apiFetch('/clients'),
        ]);
        if (cancelled) return;
        if (candR.status === 'fulfilled') setCandidates(candR.value);
        if (recR.status === 'fulfilled') setRecruiters(recR.value);
        if (jobsR.status === 'fulfilled') setJobs(jobsR.value);
        if (clientR.status === 'fulfilled') setClients(clientR.value);
      } catch {
        if (!cancelled) toast({ title: 'Sync Error', description: 'Check server connection', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Memoized computed values ──────────────────────────────────────────────
  const stats = useMemo(() => {
    // Exact count helper from AddCandidate.jsx (Progress Theory)
    const count = (s) => candidates.filter((c) => (Array.isArray(c.status) ? c.status : [c.status || '']).includes(s)).length;

    return {
      total: candidates.length,
      submitted: count('Submitted'),
      joined: count('Joined'),
      hold: count('Hold'),
      rejected: count('Rejected'),
      pipeline: count('Pipeline'),
      selected: count('Selected'),
    };
  }, [candidates]);

  const recruiterStats = useMemo(() => {
    return recruiters
      .filter(r => r._id || r.id)
      .map(r => {
        const rid = r._id || r.id;
        const cands = candidates.filter(c => (c.recruiterId?._id || c.recruiterId) === rid);
        const name = r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim();
        const getCount = (s) => cands.filter((c) => (Array.isArray(c.status) ? c.status : [c.status || '']).includes(s)).length;
        return {
          fullName: name,
          candidates: cands,
          submissions: cands.length,
          joined: getCount('Joined'),
          pending: getCount('Submitted'),
          hold: getCount('Hold'),
          rejected: getCount('Rejected'),
          selected: getCount('Selected'),
        };
      })
      .filter(r => r.fullName !== '')
      .sort((a, b) => b.submissions - a.submissions);
  }, [candidates, recruiters]);

  const performanceTotals = useMemo(() => recruiterStats.reduce((sum, r) => ({
    submissions: sum.submissions + r.submissions,
    hold: sum.hold + r.hold,
    joined: sum.joined + r.joined,
    rejected: sum.rejected + r.rejected,
    pending: sum.pending + r.pending,
  }), { submissions: 0, hold: 0, joined: 0, rejected: 0, pending: 0 }), [recruiterStats]);

  const openPerformanceModal = (recruiter, type, label) => {
    const list = recruiter.candidates.filter(c => {
      const statuses = Array.isArray(c.status) ? c.status : [c.status || ''];
      if (type === 'submissions') return true;
      if (type === 'pending') return statuses.includes('Submitted');
      return statuses.some(status => String(status).toLowerCase() === type);
    });
    setPerformanceModal({ title: `${label} - ${recruiter.fullName}`, candidates: list });
  };

  const openTotalPerformanceModal = (type, label) => {
    const allCandidates = recruiterStats.flatMap(r => r.candidates);
    const list = allCandidates.filter(c => {
      const statuses = Array.isArray(c.status) ? c.status : [c.status || ''];
      if (type === 'submissions') return true;
      if (type === 'pending') return statuses.includes('Submitted');
      return statuses.some(status => String(status).toLowerCase() === type);
    });
    setPerformanceModal({ title: `${label} - All Recruiters`, candidates: list });
  };

  const CountButton = ({ value, className, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!value}
      className={clsx("font-inherit hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60", className)}
    >
      {value}
    </button>
  );

  // FIX: barData was computed inline in JSX — now memoized.
  const barData = useMemo(
    () => recruiterStats.slice(0, 6).map(r => ({
      name: r.fullName.split(' ')[0],
      submissions: r.submissions,
      joined: r.joined,
      rejected: r.rejected
    })),
    [recruiterStats]
  );

  // ── Line chart data logic ─────────────────────────────────────────────────
  const recruiterNamesForLine = useMemo(() => {
    const names = new Set();
    candidates.forEach(c => {
      const name = getRecruiterNameOfCandidate(c);
      if (name && name !== 'Unknown') names.add(name);
    });
    return Array.from(names).sort();
  }, [candidates]);

  const lineChartData = useMemo(() => {
    let yearToUse = new Date().getFullYear();
    const yearsWithData = new Set();
    candidates.forEach(c => {
      const dateStr = c.dateAdded || c.createdAt;
      if (dateStr) {
        const y = new Date(dateStr).getFullYear();
        if (!isNaN(y)) yearsWithData.add(y);
      }
    });
    if (yearsWithData.size > 0) {
      const sortedYears = Array.from(yearsWithData).sort((a, b) => b - a);
      if (!yearsWithData.has(yearToUse)) {
        yearToUse = sortedYears[0];
      }
    }

    if (lineGraphView === 'month') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthNames.map((monthName, mIndex) => {
        const point = { name: `${monthName} (${yearToUse})` };
        recruiterNamesForLine.forEach(rName => { point[rName] = 0; });
        candidates.forEach(c => {
          const dateStr = c.dateAdded || c.createdAt;
          if (dateStr) {
            const date = new Date(dateStr);
            if (date.getFullYear() === yearToUse && date.getMonth() === mIndex) {
              const rName = getRecruiterNameOfCandidate(c);
              if (rName !== 'Unknown' && recruiterNamesForLine.includes(rName)) {
                point[rName] = (point[rName] || 0) + 1;
              }
            }
          }
        });
        return point;
      });
    } else {
      const years = Array.from(yearsWithData).sort();
      if (years.length === 0) years.push(yearToUse);
      return years.map(y => {
        const point = { name: String(y) };
        recruiterNamesForLine.forEach(rName => { point[rName] = 0; });
        candidates.forEach(c => {
          const dateStr = c.dateAdded || c.createdAt;
          if (dateStr) {
            const date = new Date(dateStr);
            if (date.getFullYear() === y) {
              const rName = getRecruiterNameOfCandidate(c);
              if (rName !== 'Unknown' && recruiterNamesForLine.includes(rName)) {
                point[rName] = (point[rName] || 0) + 1;
              }
            }
          }
        });
        return point;
      });
    }
  }, [candidates, lineGraphView, recruiterNamesForLine]);

  const recruitersToDraw = useMemo(() => {
    if (lineRecruiterFilter === 'All') return recruiterNamesForLine;
    return [lineRecruiterFilter];
  }, [lineRecruiterFilter, recruiterNamesForLine]);

  // Line chart colors
  const LINE_COLORS = ['#5664d2', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f3f6fd]">
      <div className="animate-spin h-12 w-12 border-4 border-[#283086] border-t-transparent rounded-full" />
    </div>
  );

  const formattedDate = format(new Date(), 'dd MMM, yyyy').toUpperCase();

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#283086]">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Welcome back {currentUser?.firstName || 'Manager'}, Have a nice day..!
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm">
          <span>{formattedDate}</span>
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
          </span>
        </div>
      </div>

      {/* ── Row 1: Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PrimaryStatCard
          title="Total Candidates"
          value={stats.total}
          trend={12}
          icon={Users}
          onClick={() => navigate('/admin/add-candidate', { state: { filter: 'All' } })}
        />
        <BubbleStatCard title="Recruiters" value={recruiters.length} trend={5} icon={UserCheck} theme="green" onClick={() => navigate('/admin/recruiters')} />
        <BubbleStatCard title="Total Jobs" value={jobs.length} trend={8} icon={Briefcase} theme="blue" onClick={() => navigate('/admin/requirements')} />
        <BubbleStatCard title="Total Clients" value={clients.length} trend={3} icon={FileText} theme="purple" onClick={() => navigate('/admin/clients')} />
      </div>

      {/* ── Row 2: Status Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <BubbleStatCard title="Submitted" value={stats.submitted} trend={12} icon={User} theme="purple" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Submitted' } })} />
        <BubbleStatCard title="Joined" value={stats.joined} trend={7} icon={UserCheck} theme="green" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Joined' } })} />
        <BubbleStatCard title="Hold" value={stats.hold} trend={4} icon={PauseCircle} theme="orange" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Hold' } })} />
        <BubbleStatCard title="Rejected" value={stats.rejected} trend={5} icon={UserX} theme="red" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Rejected' } })} />
      </div>

      {/* ── Row 3: Middle Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avg. Time of Hire</p>
            <h3 className="text-4xl font-bold text-slate-800 mt-2">0.0%</h3>
            <div className="w-full h-2 bg-gray-100 rounded-full mt-6">
              <div className="h-full bg-[#283086] rounded-full w-[30%]" />
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

      {/* ── Row 4: Charts (Bar + Line side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100 min-w-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-bold text-slate-800">Top Recruiters (Upload Report)</h3>
            <span className="text-xs text-gray-400">showing {Math.min(6, recruiters.length)} of {recruiters.length}</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} barSize={35} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc', radius: 8 }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px 12px', fontSize: '11px' }}
                  itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                  labelStyle={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#6b7280' }}
                />
                <Bar dataKey="submissions" name="Total" fill="#5664d2" radius={[6, 6, 0, 0]} />
                <Bar dataKey="joined" name="Joined" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="rejected" name="Rejected" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart */}
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col justify-between min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <h3 className="text-base font-bold text-slate-800">Candidate Count</h3>
            <div className="flex flex-wrap items-center gap-2">
              {/* Recruiter Selector Dropdown */}
              <select
                value={lineRecruiterFilter}
                onChange={(e) => setLineRecruiterFilter(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white"
              >
                <option value="All">All Recruiters</option>
                {recruiterNamesForLine.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              {/* Month/Year View Selector Dropdown */}
              <select
                value={lineGraphView}
                onChange={(e) => setLineGraphView(e.target.value)}
                className="pl-3 pr-8 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white"
              >
                <option value="month">Month wise</option>
                <option value="year">Year wise</option>
              </select>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px 12px', fontSize: '11px' }}
                  itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                  labelStyle={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#6b7280' }}
                />
                {recruitersToDraw.map((rName, idx) => (
                  <Line
                    key={rName}
                    type="monotone"
                    dataKey={rName}
                    name={rName}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 5: Table ── */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 flex justify-between items-center bg-[#f8faff] border-b border-gray-100">
          <h3 className="text-base font-bold text-slate-800">Recruiter Performance Details</h3>
          <button onClick={() => navigate('/admin/recruiters')} className="bg-[#283086] text-white px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wide hover:bg-blue-900 shadow-lg">
            View All Recruiters
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f8faff] text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-left">Recruiter</th>
                <th className="px-4 py-5 text-center">Submissions</th>
                <th className="px-4 py-5 text-center">Hold</th>
                <th className="px-4 py-5 text-center">Joined</th>
                <th className="px-4 py-5 text-center">Rejected</th>
                <th className="px-4 py-5 text-center">Pending</th>
                <th className="px-8 py-5 text-right">Avg. Time to Hire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {recruiterStats.map((r, i) => (
                <tr key={r.fullName || i} className="hover:bg-blue-50/30">
                  <td className="px-8 py-5 font-bold text-slate-700">{r.fullName}</td>
                  <td className="px-4 py-5 text-center text-blue-600 font-black">
                    <CountButton value={r.submissions} onClick={() => openPerformanceModal(r, 'submissions', 'Submissions')} />
                  </td>
                  <td className="px-4 py-5 text-center text-orange-400 font-bold">
                    <CountButton value={r.hold} onClick={() => openPerformanceModal(r, 'hold', 'Hold')} />
                  </td>
                  <td className="px-4 py-5 text-center text-green-600 font-black">
                    <CountButton value={r.joined} onClick={() => openPerformanceModal(r, 'joined', 'Joined')} />
                  </td>
                  <td className="px-4 py-5 text-center text-red-500 font-medium">
                    <CountButton value={r.rejected} onClick={() => openPerformanceModal(r, 'rejected', 'Rejected')} />
                  </td>
                  <td className="px-4 py-5 text-center text-gray-400 font-medium">
                    <CountButton value={r.pending} onClick={() => openPerformanceModal(r, 'pending', 'Pending')} />
                  </td>
                  <td className="px-8 py-5 text-right font-black text-red-500">0.0%</td>
                </tr>
              ))}
              {recruiterStats.length > 0 && (
                <tr className="bg-[#f8faff] border-t border-gray-100">
                  <td className="px-8 py-4 font-black text-slate-800">Total</td>
                  <td className="px-4 py-4 text-center text-blue-700 font-black"><CountButton value={performanceTotals.submissions} onClick={() => openTotalPerformanceModal('submissions', 'Total Submissions')} /></td>
                  <td className="px-4 py-4 text-center text-orange-500 font-black"><CountButton value={performanceTotals.hold} onClick={() => openTotalPerformanceModal('hold', 'Total Hold')} /></td>
                  <td className="px-4 py-4 text-center text-green-700 font-black"><CountButton value={performanceTotals.joined} onClick={() => openTotalPerformanceModal('joined', 'Total Joined')} /></td>
                  <td className="px-4 py-4 text-center text-red-600 font-black"><CountButton value={performanceTotals.rejected} onClick={() => openTotalPerformanceModal('rejected', 'Total Rejected')} /></td>
                  <td className="px-4 py-4 text-center text-gray-600 font-black"><CountButton value={performanceTotals.pending} onClick={() => openTotalPerformanceModal('pending', 'Total Pending')} /></td>
                  <td className="px-8 py-4 text-right font-black text-red-500">0.0%</td>
                </tr>
              )}
              {recruiterStats.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No active recruiter data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {performanceModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center gap-4 bg-[#f8faff]">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#283086]" />
                  {performanceModal.title}
                </h2>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Total: {performanceModal.candidates.length} candidate{performanceModal.candidates.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setPerformanceModal(null)} className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              {performanceModal.candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="bg-gray-50 p-4 rounded-full mb-3">
                    <ClipboardList className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-slate-800 font-bold">No candidates found</h3>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[#f8faff] text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-left">Candidate ID</th>
                      <th className="px-6 py-4 text-left">Candidate Name</th>
                      <th className="px-6 py-4 text-left">Position</th>
                      <th className="px-6 py-4 text-left">Client</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {performanceModal.candidates.map((c) => {
                      const cStatus = Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status;
                      return (
                        <tr key={c._id || c.id} className="hover:bg-blue-50/30">
                          <td className="px-6 py-4 font-bold text-[#283086]">{c.candidateId || 'N/A'}</td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '-'}</td>
                          <td className="px-6 py-4 text-gray-500">{c.position || '-'}</td>
                          <td className="px-6 py-4 text-gray-500">{c.client || '-'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              {cStatus || 'Submitted'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button onClick={() => setPerformanceModal(null)} className="text-slate-700 hover:text-[#283086] font-bold uppercase tracking-wider text-xs">
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
