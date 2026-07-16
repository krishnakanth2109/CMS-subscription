import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Users, ChevronDown } from 'lucide-react';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MAX_VISIBLE_RECRUITERS = 5;

const PALETTE = [
  { stroke: '#6366f1', gradStart: 'rgba(99,102,241,0.35)',  gradEnd: 'rgba(99,102,241,0)',   badge: '#ede9fe', badgeText: '#4f46e5' },
  { stroke: '#10b981', gradStart: 'rgba(16,185,129,0.30)',  gradEnd: 'rgba(16,185,129,0)',   badge: '#d1fae5', badgeText: '#059669' },
  { stroke: '#f59e0b', gradStart: 'rgba(245,158,11,0.30)',  gradEnd: 'rgba(245,158,11,0)',   badge: '#fef3c7', badgeText: '#d97706' },
  { stroke: '#ec4899', gradStart: 'rgba(236,72,153,0.28)',  gradEnd: 'rgba(236,72,153,0)',   badge: '#fce7f3', badgeText: '#db2777' },
  { stroke: '#3b82f6', gradStart: 'rgba(59,130,246,0.28)',  gradEnd: 'rgba(59,130,246,0)',   badge: '#dbeafe', badgeText: '#2563eb' },
];

// ─── helpers ────────────────────────────────────────────────────────────────
const getName = (r = {}) =>
  r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim() ||
  r.username || r.email || 'Unnamed';

const firstName = (name = '') => String(name).trim().split(/\s+/)[0] || name;

const getRecruiterId = (c = {}) => {
  const r = c.recruiterId;
  if (!r) return '';
  return typeof r === 'object' ? String(r._id || r.id || '') : String(r);
};

const getDate = (c = {}) => {
  const raw = c.createdAt || c.dateAdded;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const monthKey  = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d) => MONTH_LABELS[d.getMonth()];
const monthTip  = (d) => `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;

const buildMonthPeriods = (year) =>
  Array.from({ length: 12 }, (_, m) => {
    const d = new Date(year, m, 1);
    return { key: monthKey(d), label: monthLabel(d), tip: monthTip(d), sort: year * 100 + m };
  });

const buildYearPeriods = (dates) => {
  if (!dates.length) {
    const y = new Date().getFullYear();
    return [{ key: String(y), label: String(y), sort: y }];
  }
  const years = dates.map((d) => d.getFullYear());
  const min = Math.min(...years), max = Math.max(...years, new Date().getFullYear());
  return Array.from({ length: max - min + 1 }, (_, i) => {
    const y = min + i;
    return { key: String(y), label: String(y), sort: y };
  });
};

const dedupe = (recruiters) => {
  const counts = new Map();
  return recruiters.map((r) => {
    const n = counts.get(r.name) || 0;
    counts.set(r.name, n + 1);
    return { ...r, chartKey: n === 0 ? r.name : `${r.name} (${n + 1})` };
  });
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const tip = payload[0]?.payload?.tooltipPeriod || label;
  const total = payload.reduce((s, e) => s + (Number(e.value) || 0), 0);
  return (
    <div style={{
      background: 'linear-gradient(135deg,#1e1b4b 0%,#0f172a 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '14px 18px',
      boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
      minWidth: 190,
    }}>
      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>
        {tip}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...payload].reverse().map((e) => (
          <div key={e.dataKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{firstName(e.name)}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: e.color }}>{e.value}</span>
          </div>
        ))}
      </div>
      {payload.length > 1 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#f8fafc' }}>{total}</span>
        </div>
      )}
    </div>
  );
};

// ─── Pill select ─────────────────────────────────────────────────────────────
const Pill = ({ value, onChange, children }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      className="appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-8 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none transition hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────
export default function RecruiterCandidateGrowthChart({
  candidates = [],
  recruiters = [],
  loading = false,
}) {
  const [groupBy, setGroupBy]   = useState('month');
  const [selId,   setSelId]     = useState('all');
  const [year,    setYear]      = useState(String(new Date().getFullYear()));

  const availableYears = useMemo(() => {
    const set = new Set();
    candidates.forEach((c) => { const d = getDate(c); if (d) set.add(d.getFullYear()); });
    if (!set.size) set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [candidates]);

  useEffect(() => {
    if (!availableYears.includes(Number(year)))
      setYear(String(availableYears[0] ?? new Date().getFullYear()));
  }, [availableYears, year]);

  const trend = useMemo(() => {
    const rMap = new Map(
      recruiters.filter((r) => r._id || r.id).map((r) => {
        const id = String(r._id || r.id);
        return [id, { id, name: getName(r), total: 0 }];
      })
    );

    const dates = [];
    const seen  = new Set();
    const byPeriod = new Map();

    const inc = (pKey, rid) => {
      if (!byPeriod.has(pKey)) byPeriod.set(pKey, new Map());
      const m = byPeriod.get(pKey);
      m.set(rid, (m.get(rid) || 0) + 1);
    };

    candidates.forEach((c, idx) => {
      const cid = String(c._id || c.id || c.candidateId || idx);
      if (seen.has(cid)) return;
      seen.add(cid);
      const rid = getRecruiterId(c);
      const d   = getDate(c);
      if (!rid || !d) return;
      if (!rMap.has(rid)) {
        const ro = typeof c.recruiterId === 'object' ? c.recruiterId : {};
        rMap.set(rid, { id: rid, name: c.recruiterName || getName(ro), total: 0 });
      }
      dates.push(d);
      rMap.get(rid).total += 1;
      inc(monthKey(d), rid);
      inc(String(d.getFullYear()), rid);
    });

    const all = dedupe(
      [...rMap.values()]
        .filter((r) => r.name.trim())
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    );

    const found   = all.find((r) => r.id === selId);
    const visible = selId === 'all' ? all.slice(0, MAX_VISIBLE_RECRUITERS) : found ? [found] : [];

    const periods = (groupBy === 'month' ? buildMonthPeriods(Number(year)) : buildYearPeriods(dates))
      .sort((a, b) => a.sort - b.sort);

    const data = periods.map((p) => {
      const row = { period: p.label, tooltipPeriod: p.tip || p.label };
      const pm  = byPeriod.get(p.key) || new Map();
      visible.forEach((r) => { row[r.chartKey] = pm.get(r.id) || 0; });
      return row;
    });

    const total = data.reduce((s, row) =>
      s + visible.reduce((rs, r) => rs + (Number(row[r.chartKey]) || 0), 0), 0);

    return { all, visible, data, total };
  }, [candidates, recruiters, groupBy, selId, year]);

  const limitNote = selId === 'all' && trend.all.length > MAX_VISIBLE_RECRUITERS;

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg dark:border-white/[0.06] dark:bg-slate-900">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5 dark:border-white/[0.06] dark:from-slate-800/60 dark:to-slate-900 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40">
            <TrendingUp className="h-4 w-4 text-white" />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-white">
              Candidate Growth Trend
            </h3>
            <p className="text-[11px] font-medium text-slate-400">
              Registrations by recruiter over time
              {limitNote && <span className="ml-1 font-semibold text-indigo-500">· Top {MAX_VISIBLE_RECRUITERS} shown</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill value={selId} onChange={(e) => setSelId(e.target.value)}>
            <option value="all">All Recruiters</option>
            {trend.all.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Pill>

          <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5 shadow-sm dark:border-white/10 dark:bg-slate-800">
            {[['month', 'Monthly'], ['year', 'Yearly']].map(([v, lbl]) => (
              <button
                key={v} type="button"
                onClick={() => setGroupBy(v)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  groupBy === v
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {groupBy === 'month' && (
            <Pill value={year} onChange={(e) => setYear(e.target.value)}>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </Pill>
          )}
        </div>
      </div>

      {/* ── Badge row ── */}
      {!loading && trend.total > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-3 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 mr-2">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400">Total in view:</span>
            <span className="text-sm font-black text-slate-800 dark:text-white">{trend.total}</span>
          </div>
          {trend.visible.map((r, i) => {
            const p = PALETTE[i % PALETTE.length];
            const t = trend.data.reduce((s, row) => s + (Number(row[r.chartKey]) || 0), 0);
            return (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
                style={{ background: p.badge, color: p.badgeText }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '55%', background: p.stroke, flexShrink: 0, display: 'inline-block' }} />
                {firstName(r.name)} · {t}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Chart ── */}
      <div className="flex min-h-72 flex-1 items-center justify-center px-2 pb-5 pt-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-200 border-t-indigo-600" />
            <p className="text-xs font-semibold text-slate-400">Loading data…</p>
          </div>
        ) : !trend.visible.length || !trend.total ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
              <TrendingUp className="h-6 w-6 text-slate-400" />
            </span>
            <p className="max-w-xs text-sm font-semibold text-slate-400">
              No data available for the selected period.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trend.data} margin={{ top: 10, right: 20, left: -12, bottom: 0 }}>

              {/* SVG gradient defs */}
              <defs>
                {PALETTE.map((p, i) => (
                  <linearGradient key={i} id={`fill${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={p.stroke} stopOpacity={0.28} />
                    <stop offset="85%"  stopColor={p.stroke} stopOpacity={0.04} />
                    <stop offset="100%" stopColor={p.stroke} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid
                strokeDasharray="0"
                stroke="#f1f5f9"
                vertical={false}
                strokeWidth={1}
              />

              <XAxis
                dataKey="period"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                dy={10}
              />

              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 500 }}
                width={28}
              />

              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: '#c7d2fe', strokeWidth: 1.5, strokeDasharray: '4 3' }}
              />

              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: 18 }}
                iconType="circle"
                iconSize={9}
                formatter={(value, entry) => (
                  <span style={{ fontSize: 11, fontWeight: 700, color: entry.color }}>
                    {firstName(value)}
                  </span>
                )}
              />

              {trend.visible.map((r, i) => {
                const p = PALETTE[i % PALETTE.length];
                return (
                  <Area
                    key={r.id}
                    type="monotone"
                    dataKey={r.chartKey}
                    name={r.name}
                    stroke={p.stroke}
                    strokeWidth={2.5}
                    fill={`url(#fill${i})`}
                    dot={{ r: 3.5, fill: '#fff', stroke: p.stroke, strokeWidth: 2.5 }}
                    activeDot={{ r: 6, fill: p.stroke, stroke: '#fff', strokeWidth: 2.5 }}
                    connectNulls
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
