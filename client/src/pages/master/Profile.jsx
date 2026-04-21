// src/pages/master/Profile.jsx
import React from 'react';
import { UserCircle } from 'lucide-react';

export default function Profile() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Master Profile</h1>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-6 mb-8">
          <UserCircle size={80} className="text-slate-300" />
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Super Admin</h2>
            <p className="text-slate-500">System Administrator</p>
          </div>
        </div>

        <form className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
              <input type="text" defaultValue="Super" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
              <input type="text" defaultValue="Admin" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
            <input type="email" defaultValue="admin@master.com" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button type="button" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}