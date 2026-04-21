// src/pages/master/MasterDashboard.jsx
import React from 'react';
import { Users, CreditCard, Activity, TrendingUp } from 'lucide-react';

export default function MasterDashboard() {
  const stats = [
    { title: 'Total Managers', value: '1,248', icon: <Users size={24} className="text-blue-600" /> },
    { title: 'Active Subscriptions', value: '892', icon: <CreditCard size={24} className="text-emerald-600" /> },
    { title: 'Monthly Revenue', value: '$45,200', icon: <TrendingUp size={24} className="text-indigo-600" /> },
    { title: 'System Uptime', value: '99.9%', icon: <Activity size={24} className="text-orange-600" /> },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              {stat.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.title}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}   