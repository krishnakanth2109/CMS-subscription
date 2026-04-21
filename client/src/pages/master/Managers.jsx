// src/pages/master/Managers.jsx
import React from 'react';

export default function Managers() {
  const managers = [
    { id: 1, name: 'Alice Johnson', company: 'TechNova', email: 'alice@technova.com', plan: 'Pro', status: 'Active' },
    { id: 2, name: 'Bob Smith', company: 'CloudSync', email: 'bob@cloudsync.com', plan: 'Enterprise', status: 'Active' },
    { id: 3, name: 'Charlie Davis', company: 'DataFlow', email: 'charlie@dataflow.com', plan: 'Basic', status: 'Inactive' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Manager Management</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700">Add Manager manually</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 font-semibold text-slate-600">Name</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Company</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Plan</th>
              <th className="px-6 py-4 font-semibold text-slate-600">Status</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {managers.map((mgr) => (
              <tr key={mgr.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-slate-800">{mgr.name}</p>
                  <p className="text-sm text-slate-500">{mgr.email}</p>
                </td>
                <td className="px-6 py-4 text-slate-700">{mgr.company}</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">{mgr.plan}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${mgr.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {mgr.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}