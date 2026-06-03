// src/pages/master/MasterDashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Building2, CreditCard, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const planPrice = {
  Basic: 0,
  Pro: 1999,
  Enterprise: 4999,
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadAdmins = async () => {
      setLoading(true);
      setError('');
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_URL}/master/managers`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load admins');
        if (!ignore) setAdmins(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load master dashboard');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadAdmins();
    return () => { ignore = true; };
  }, [authHeaders]);

  const stats = useMemo(() => {
    const totalAdmins = admins.length;
    const activeAdmins = admins.filter((admin) => admin.active !== false).length;
    const enterpriseAdmins = admins.filter((admin) => admin.subscriptionPlan === 'Enterprise').length;
    const monthlyRevenue = admins.reduce((sum, admin) => {
      const billingMultiplier = admin.subscriptionBilling === 'yearly' ? 12 : 1;
      return sum + ((planPrice[admin.subscriptionPlan] || 0) * billingMultiplier);
    }, 0);

    return [
      { title: 'Total Admins', value: totalAdmins, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
      { title: 'Active Accounts', value: activeAdmins, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { title: 'Enterprise Plans', value: enterpriseAdmins, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
      {
        title: 'Projected Revenue',
        value: `Rs. ${monthlyRevenue.toLocaleString('en-IN')}`,
        icon: TrendingUp,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
      },
    ];
  }, [admins]);

  const recentAdmins = useMemo(() => admins.slice(0, 5), [admins]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Master Dashboard</h1>
        <p className="text-sm text-slate-500">Live overview of admin companies and subscription status.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{stat.title}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{loading ? '...' : stat.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
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

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Plan Split</h2>
              <p className="text-xs text-slate-500">Admin accounts by subscription.</p>
            </div>
          </div>

          <div className="space-y-3">
            {['Basic', 'Pro', 'Enterprise', 'None'].map((plan) => {
              const count = admins.filter((admin) => (admin.subscriptionPlan || 'None') === plan).length;
              return (
                <div key={plan} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">{plan}</span>
                  <span className="text-sm font-bold text-slate-900">{loading ? '-' : count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
