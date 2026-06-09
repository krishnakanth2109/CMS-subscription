import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import {
  Download, Users, Briefcase, Calendar, CheckCircle2,
  XCircle, Clock, Search, Filter, Loader2, ChevronDown,
  ChevronLeft, ChevronRight, FileText, Activity, Target, TrendingUp, UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e'];
const PIPELINE_STEPS = [
  'Submitted',
  'Shared Profiles',
  'Yet to Attend',
  'Turnups',
  'Selected',
  'Hold',
  'Rejected',
  'No Show',
  'Backout',
  'Joined',
];

const normalizePipelineStatus = (status) => {
  if (!status) return 'Submitted';
  const cleaned = String(status).trim();
  const lowered = cleaned.toLowerCase();
  const compact = lowered.replace(/[^a-z0-9]/g, '');
  if (compact === 'yettoattend') return 'Yet to Attend';
  if (['sharedprofile', 'sharedprofiles', 'shareprofile', 'shareprofiles'].includes(compact)) return 'Shared Profiles';
  if (compact === 'turnup' || compact === 'turnups') return 'Turnups';
  return cleaned;
};

const getPipelineStatuses = (status) => {
  const statuses = Array.isArray(status)
    ? status
    : String(status || 'Submitted').split(',').map(s => s.trim()).filter(Boolean);

  return [...new Set(statuses.map(normalizePipelineStatus))]
    .filter(statusName => PIPELINE_STEPS.includes(statusName));
};

const safeDate = (d) => {
  if (!d) return null;
  const pd = new Date(d);
  return isNaN(pd.getTime()) ? null : pd;
};

// ── CUSTOM HOOK FOR DATA FETCHING AND FILTERING ──
function useReportsData(authHeaders, toast) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ candidates: [], jobs: [], interviews: [] });

  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: '',
    status: 'all',
    department: 'all',
    position: 'all',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const h = { 'Content-Type': 'application/json', ...headers };

      const [cRes, jRes, iRes] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers: h }),
        fetch(`${API_URL}/jobs`, { headers: h }),
        fetch(`${API_URL}/interviews`, { headers: h }),
      ]);

      const candidates = cRes.ok ? await cRes.json() : [];
      const jobs = jRes.ok ? await jRes.json() : [];
      const interviews = iRes.ok ? await iRes.json() : [];

      setData({
        candidates: Array.isArray(candidates) ? candidates : [],
        jobs: Array.isArray(jobs) ? jobs : [],
        interviews: Array.isArray(interviews) ? interviews : [],
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to fetch report data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filtered Data
  const filteredData = useMemo(() => {
    const { candidates, jobs, interviews } = data;
    
    const fc = candidates.filter(c => {
      // Date filter
      if (filters.dateStart || filters.dateEnd) {
        const cd = safeDate(c.dateAdded || c.createdAt);
        if (!cd) return false;
        if (filters.dateStart && cd < new Date(filters.dateStart)) return false;
        if (filters.dateEnd && cd > new Date(filters.dateEnd + 'T23:59:59')) return false;
      }
      
      // Status filter
      if (filters.status !== 'all') {
        const s = Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status;
        if (!s || s.toLowerCase() !== filters.status.toLowerCase()) return false;
      }
      
      // Dept/Client filter
      if (filters.department !== 'all') {
        if (c.client !== filters.department) return false;
      }

      // Position filter
      if (filters.position !== 'all') {
        if (c.position !== filters.position) return false;
      }
      
      return true;
    });

    const fInterviews = interviews.filter(i => {
      if (filters.dateStart || filters.dateEnd) {
        const id = safeDate(i.interviewDate);
        if (!id) return false;
        if (filters.dateStart && id < new Date(filters.dateStart)) return false;
        if (filters.dateEnd && id > new Date(filters.dateEnd + 'T23:59:59')) return false;
      }
      return true;
    });

    return { candidates: fc, jobs, interviews: fInterviews };
  }, [data, filters]);

  return { loading, data, filteredData, filters, setFilters, refetch: fetchData };
}

// ── MAIN COMPONENT ──
export default function RecruiterReports() {
  const { currentUser, authHeaders } = useAuth();
  const { toast } = useToast();
  const { loading, data, filteredData, filters, setFilters, refetch } = useReportsData(authHeaders, toast);
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalCandidates, setModalCandidates] = useState([]);

  // Interview Modal State
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [interviewModalData, setInterviewModalData] = useState(null);

  const openCandidateModal = (title, candidatesList) => {
    setModalTitle(title);
    setModalCandidates(candidatesList);
    setModalOpen(true);
  };

  // ── Metrics Calculation ──
  const metrics = useMemo(() => {
    const { candidates, jobs, interviews } = filteredData;
    
    let active = 0, selected = 0, rejected = 0;
    candidates.forEach(c => {
      const s = Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status;
      if (s?.includes('Select') || s?.includes('Joined')) selected++;
      else if (s?.includes('Reject')) rejected++;
      else active++;
    });

    const upcomingInts = interviews.filter(i => i.status === 'Scheduled' && safeDate(i.interviewDate) >= new Date()).length;
    const openJobs = jobs.filter(j => j.active).length;

    // Pipeline Data
    const statusCounts = {};
    candidates.forEach(c => {
      getPipelineStatuses(c.status).forEach(statusName => {
        statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
      });
    });
    const pipelineData = PIPELINE_STEPS.map(name => ({ name, value: statusCounts[name] || 0 }));

    // Source Data
    const sourceCounts = {};
    candidates.forEach(c => {
      const src = c.source || 'Portal';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));

    // Department/Client Data
    const deptMap = {};
    candidates.forEach(c => {
      const dept = c.client || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { department: dept, total: 0, selected: 0, active: 0, allCandidates: [] };
      deptMap[dept].total++;
      deptMap[dept].allCandidates.push(c);
      const s = Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status;
      if (s?.includes('Select') || s?.includes('Joined')) deptMap[dept].selected++;
      else if (!s?.includes('Reject')) deptMap[dept].active++;
    });
    const departmentData = Object.values(deptMap).sort((a,b) => b.total - a.total);

    return {
      total: candidates.length,
      active, selected, rejected, upcomingInts, openJobs,
      pipelineData, sourceData, departmentData
    };
  }, [filteredData]);

  // ── Options for Dropdowns ──
  const uniqueDepts = useMemo(() => [...new Set(data.candidates.map(c => c.client).filter(Boolean))], [data.candidates]);
  const uniqueRoles = useMemo(() => [...new Set(data.candidates.map(c => c.position).filter(Boolean))], [data.candidates]);
  const uniqueStatus = useMemo(() => [...new Set(data.candidates.map(c => Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status).filter(Boolean))], [data.candidates]);

  // ── EXPORTS ──
  const handleExport = (format) => {
    setIsExporting(true);
    try {
      const exportData = filteredData.candidates.map(c => ({
        ID: c.candidateId || '-',
        Name: c.name || '-',
        Email: c.email || '-',
        Phone: c.contact || '-',
        Department: c.client || '-',
        Position: c.position || '-',
        Source: c.source || '-',
        Status: Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status,
        DateAdded: safeDate(c.dateAdded || c.createdAt)?.toLocaleDateString() || '-'
      }));

      if (format === 'csv' || format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Candidates Report');
        XLSX.writeFile(wb, `Report_${new Date().getTime()}.${format === 'csv' ? 'csv' : 'xlsx'}`);
      } else if (format === 'pdf') {
        const doc = new jsPDF('landscape');
        doc.text('Candidate Reports', 14, 15);
        autoTable(doc, {
          startY: 20,
          head: [['ID', 'Name', 'Department', 'Position', 'Status', 'Date']],
          body: exportData.map(c => [c.ID, c.Name, c.Department, c.Position, c.Status, c.DateAdded]),
          styles: { fontSize: 8 }
        });
        doc.save(`Report_${new Date().getTime()}.pdf`);
      }
      toast({ title: 'Success', description: `Exported as ${format.toUpperCase()}` });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to export', variant: 'destructive' });
    }
    setIsExporting(false);
  };

  // ── RENDER HELPERS ──
  const StatCard = ({ title, value, icon: Icon, colorClass, trend }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colorClass}`}><Icon className="w-5 h-5" /></div>
        {trend && <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">{trend}</span>}
      </div>
      <h3 className="text-slate-500 text-sm font-semibold">{title}</h3>
      <p className="text-3xl font-black text-slate-800 mt-1">{value}</p>
    </div>
  );

  if (loading && !data.candidates.length) {
    return (
      <div className="flex-1 p-6 h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 font-medium animate-pulse">Aggregating analytics data...</p>
      </div>
    );
  }

  const displayName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email
    : 'Recruiter';

  return (
    <div className="flex-1 bg-slate-50 min-h-screen overflow-y-auto pb-10">
      
      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Reports & Analysis</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Performance analytics for <span className="text-blue-600 font-semibold">{displayName}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleExport('excel')} disabled={isExporting} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> Export Excel <Download className="w-4 h-4" />
            </button>
            <button onClick={() => handleExport('pdf')} disabled={isExporting} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export PDF
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="max-w-[1600px] mx-auto px-6 flex gap-6 border-t border-slate-100">
          {['overview', 'pipeline', 'departments', 'interviews'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* ── FILTERS BAR ── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 px-2"><Filter className="w-4 h-4"/> Filters</div>
          <input type="date" value={filters.dateStart} onChange={e => setFilters({...filters, dateStart: e.target.value})} className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" title="Start Date" />
          <input type="date" value={filters.dateEnd} onChange={e => setFilters({...filters, dateEnd: e.target.value})} className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" title="End Date" />
          
          <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer">
            <option value="all">All Statuses</option>
            {uniqueStatus.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          
          <select value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})} className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer">
            <option value="all">All Departments</option>
            {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select value={filters.position} onChange={e => setFilters({...filters, position: e.target.value})} className="px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer">
            <option value="all">All Roles</option>
            {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard title="Total Candidates" value={metrics.total} icon={Users} colorClass="bg-blue-100 text-blue-600" />
              <StatCard title="Active Process" value={metrics.active} icon={Activity} colorClass="bg-amber-100 text-amber-600" />
              <StatCard title="Selected" value={metrics.selected} icon={CheckCircle2} colorClass="bg-emerald-100 text-emerald-600" />
              <StatCard title="Rejected" value={metrics.rejected} icon={XCircle} colorClass="bg-red-100 text-red-600" />
              <StatCard title="Interviews" value={metrics.upcomingInts} icon={Calendar} colorClass="bg-purple-100 text-purple-600" />
              <StatCard title="Open Positions" value={metrics.openJobs} icon={Briefcase} colorClass="bg-cyan-100 text-cyan-600" />
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Candidate Pipeline Status</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" interval={0} tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[6,6,0,0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Sourcing Channels</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={metrics.sourceData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                        {metrics.sourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── PIPELINE TAB ── */}
        {activeTab === 'pipeline' && (
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[500px]">
             <h3 className="text-lg font-bold text-slate-800 mb-6">Pipeline Trends (Area)</h3>
             <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.pipelineData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" interval={0} tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)'}} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
           </div>
        )}

        {/* ── DEPARTMENTS TAB ── */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
               <h3 className="text-lg font-bold text-slate-800">Department / Client Analytics</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Department / Client</th>
                    <th className="px-6 py-4">Total Candidates</th>
                    <th className="px-6 py-4">Active Process</th>
                    <th className="px-6 py-4">Selected/Hired</th>
                    <th className="px-6 py-4">Conversion Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.departmentData.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800">{d.department}</td>
                      <td className="px-6 py-4 font-semibold text-slate-600">
                        <button onClick={() => openCandidateModal(`Candidates for ${d.department}`, d.allCandidates)} className="text-blue-600 hover:underline cursor-pointer focus:outline-none">
                          {d.total}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-amber-600 font-semibold">
                        <button onClick={() => openCandidateModal(`Active Candidates for ${d.department}`, d.allCandidates.filter(c => { const s = Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status; return !(s?.includes('Select') || s?.includes('Joined') || s?.includes('Reject')); }))} className="hover:underline cursor-pointer focus:outline-none">
                          {d.active}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-emerald-600 font-semibold">
                        <button onClick={() => openCandidateModal(`Selected/Hired for ${d.department}`, d.allCandidates.filter(c => { const s = Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status; return s?.includes('Select') || s?.includes('Joined'); }))} className="hover:underline cursor-pointer focus:outline-none">
                          {d.selected}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{width: `${d.total ? (d.selected/d.total)*100 : 0}%`}} />
                          </div>
                          <span className="text-xs font-bold">{d.total ? ((d.selected/d.total)*100).toFixed(0) : 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {metrics.departmentData.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No department data found for these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── INTERVIEWS TAB ── */}
        {activeTab === 'interviews' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
               <h3 className="text-lg font-bold text-slate-800">Interview Tracking</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Interview ID</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Candidate</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.interviews.sort((a,b) => new Date(b.interviewDate) - new Date(a.interviewDate)).slice(0, 50).map((i) => (
                    <tr key={i._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">
                        <button onClick={() => { setInterviewModalData(i); setInterviewModalOpen(true); }} className="text-blue-600 hover:underline focus:outline-none cursor-pointer">
                          {i.interviewId || i._id.slice(-6).toUpperCase()}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{new Date(i.interviewDate).toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold">
                        <button onClick={() => { setInterviewModalData(i); setInterviewModalOpen(true); }} className="text-slate-800 hover:text-blue-600 hover:underline focus:outline-none cursor-pointer">
                          {typeof i.candidateId === 'object' ? i.candidateId.name || `${i.candidateId.firstName} ${i.candidateId.lastName}`.trim() : 'Unknown'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{i.type || i.round || 'Standard'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          i.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          i.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                       }`}>
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredData.interviews.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No interview data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ── CANDIDATE MODAL ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{modalTitle}</h2>
                <p className="text-sm font-semibold text-slate-500 mt-1">Total: {modalCandidates.length} candidate(s)</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-red-500 bg-white rounded-full p-2 shadow-sm transition-colors focus:outline-none">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modalCandidates.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">{c.candidateId || c._id?.slice(-6).toUpperCase()}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{c.position || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                          {Array.isArray(c.status) ? c.status[c.status.length - 1] : c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-500">{safeDate(c.dateAdded || c.createdAt)?.toLocaleDateString() || '-'}</td>
                    </tr>
                  ))}
                  {modalCandidates.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-semibold">No candidates found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── INTERVIEW DETAILS MODAL ── */}
      {interviewModalOpen && interviewModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Interview Details</h2>
                <p className="text-sm font-semibold text-slate-500 mt-1">ID: {interviewModalData.interviewId || interviewModalData._id?.slice(-6).toUpperCase()}</p>
              </div>
              <button onClick={() => setInterviewModalOpen(false)} className="text-slate-400 hover:text-red-500 bg-white rounded-full p-2 shadow-sm transition-colors focus:outline-none">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Candidate Info</h4>
                  <p className="font-bold text-slate-800 text-lg">{typeof interviewModalData.candidateId === 'object' ? interviewModalData.candidateId.name || `${interviewModalData.candidateId.firstName} ${interviewModalData.candidateId.lastName}`.trim() : 'Unknown'}</p>
                  <p className="text-sm font-semibold text-slate-600 mt-1">Cand ID: {typeof interviewModalData.candidateId === 'object' ? interviewModalData.candidateId.candidateId || '-' : '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Recruiter Info</h4>
                  <p className="font-bold text-slate-800 text-lg">{typeof interviewModalData.recruiterId === 'object' ? (interviewModalData.recruiterId.firstName + ' ' + (interviewModalData.recruiterId.lastName || '')).trim() : 'Unknown'}</p>
                  <p className="text-sm font-semibold text-slate-600 mt-1">{typeof interviewModalData.recruiterId === 'object' ? interviewModalData.recruiterId.email : ''}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-50 pb-2">Meeting Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                  <div><span className="text-slate-500 font-semibold">Date & Time:</span> <span className="font-bold text-slate-800 ml-1">{new Date(interviewModalData.interviewDate).toLocaleString()}</span></div>
                  <div><span className="text-slate-500 font-semibold">Duration:</span> <span className="font-bold text-slate-800 ml-1">{interviewModalData.duration || 60} mins</span></div>
                  <div><span className="text-slate-500 font-semibold">Type:</span> <span className="font-bold text-slate-800 ml-1">{interviewModalData.type || 'Virtual'}</span></div>
                  <div><span className="text-slate-500 font-semibold">Round:</span> <span className="font-bold text-slate-800 ml-1">{interviewModalData.round || 'N/A'}</span></div>
                  <div className="col-span-2 flex items-center">
                    <span className="text-slate-500 font-semibold mr-2">Status:</span> 
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      interviewModalData.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                      interviewModalData.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {interviewModalData.status}
                    </span>
                  </div>
                  {interviewModalData.meetingLink && (
                    <div className="col-span-2 flex items-start flex-col gap-1 mt-1">
                      <span className="text-slate-500 font-semibold">Meeting Link:</span> 
                      <a href={interviewModalData.meetingLink} target="_blank" rel="noreferrer" className="font-bold text-blue-600 hover:underline break-all bg-blue-50 px-3 py-2 rounded-lg inline-block w-full">{interviewModalData.meetingLink}</a>
                    </div>
                  )}
                </div>
              </div>

              {(interviewModalData.notes || interviewModalData.feedback) && (
                <div className="border border-slate-100 rounded-xl p-4 bg-white shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-50 pb-2">Feedback & Notes</h4>
                  {interviewModalData.notes && (
                    <div>
                      <span className="text-slate-500 font-semibold text-xs uppercase block mb-1">Internal Notes:</span> 
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">{interviewModalData.notes}</p>
                    </div>
                  )}
                  {interviewModalData.feedback && (
                    <div>
                      <span className="text-slate-500 font-semibold text-xs uppercase block mb-1">Interview Feedback:</span> 
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">{interviewModalData.feedback}</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
