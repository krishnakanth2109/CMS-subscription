// src/pages/master/Plans.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Users, TrendingUp, Crown, Zap, Sparkles,
  RefreshCw, AlertCircle, Loader2, Check,
} from 'lucide-react';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

// Static plan metadata — pricing / features never change at runtime
const PLAN_META = {
  Basic: {
    label:    'Free Trial',
    icon:     Sparkles,
    price:    0,
    billing:  '7 days free',
    features: [
      'Dashboard & Analytics',
      'Candidate Management',
      'Recruiter Accounts',
      'Interview Schedules',
    ],
    locked: ['Client Info', 'Reports', 'Invoices', 'Messages', 'Agreements', 'Mock Interviews'],
    ring:   'ring-slate-200',
    iconBg: 'bg-slate-100',
    iconFg: 'text-slate-600',
    badge:  'bg-slate-100 text-slate-700',
  },
  Pro: {
    label:    'Flexi Plan',
    icon:     Zap,
    price:    1999,
    billing:  'per month',
    features: [
      'Everything in Free Trial',
      'Client Info & Management',
      'Advanced Reports',
    ],
    locked: ['Invoices', 'Messages', 'Agreements', 'Mock Interviews'],
    popular: true,
    ring:   'ring-blue-400',
    iconBg: 'bg-blue-50',
    iconFg: 'text-blue-600',
    badge:  'bg-blue-100 text-blue-700',
  },
  Enterprise: {
    label:    'Premium Plan',
    icon:     Crown,
    price:    4999,
    billing:  'per month',
    features: [
      'Everything in Flexi',
      'Invoice Generation',
      'Team Messages',
      'Agreement Templates',
      'AI Mock Interviews',
    ],
    locked: [],
    ring:   'ring-amber-400',
    iconBg: 'bg-amber-50',
    iconFg: 'text-amber-600',
    badge:  'bg-amber-100 text-amber-700',
  },
};

export default function Plans() {
  const { authHeaders } = useAuth();
  const [admins,  setAdmins]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res  = await fetch(`${API_URL}/master/managers`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []); // eslint-disable-line

  /* ── Aggregate stats from live data ──────────────────────────────────────── */
  const stats = useMemo(() => {
    const counts  = { Basic: 0, Pro: 0, Enterprise: 0 };
    let revenue   = 0;

    admins.forEach(a => {
      const plan = a.subscriptionPlan;
      if (plan && counts[plan] !== undefined) counts[plan]++;
      revenue += (PLAN_META[plan]?.price || 0);
    });

    return { counts, revenue, total: admins.length };
  }, [admins]);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Subscription Plans</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live subscriber counts and revenue — fetched from the database.
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Admins',     value: stats.total,   icon: Users,      bg: 'bg-blue-50',    fg: 'text-blue-600' },
          { label: 'Monthly Revenue',  value: `₹${stats.revenue.toLocaleString('en-IN')}`, icon: TrendingUp, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
          { label: 'Enterprise Plans', value: stats.counts.Enterprise, icon: Crown, bg: 'bg-amber-50',  fg: 'text-amber-600' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${s.fg}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400 mt-1" /> : s.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(PLAN_META).map(([key, cfg]) => {
          const Icon        = cfg.icon;
          const count       = stats.counts[key] ?? 0;
          const planRevenue = count * cfg.price;

          return (
            <div
              key={key}
              className={`relative bg-white border-2 rounded-2xl shadow-sm p-6 flex flex-col ring-2 ${cfg.ring}`}
            >
              {/* Popular badge */}
              {cfg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${cfg.iconBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${cfg.iconFg}`} />
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>{key}</span>
              </div>

              <h3 className="text-lg font-bold text-slate-900">{cfg.label}</h3>
              <p className="mt-1">
                {cfg.price === 0
                  ? <span className="text-3xl font-extrabold text-slate-900">Free</span>
                  : <>
                      <span className="text-3xl font-extrabold text-slate-900">
                        ₹{cfg.price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-sm font-medium text-slate-500 ml-1">{cfg.billing}</span>
                    </>
                }
              </p>

              {/* Features */}
              <ul className="mt-4 space-y-2 flex-1">
                {cfg.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                    </span>
                    {f}
                  </li>
                ))}
                {cfg.locked.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-[10px]">✕</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Live stats footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Subscribers</span>
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    : <span className="text-xl font-bold text-slate-900">{count}</span>
                  }
                </div>
                {cfg.price > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Monthly revenue</span>
                    {loading
                      ? <span className="text-xs text-slate-400">—</span>
                      : <span className="text-sm font-bold text-emerald-600">
                          ₹{planRevenue.toLocaleString('en-IN')}
                        </span>
                    }
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}