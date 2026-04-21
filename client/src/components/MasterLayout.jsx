// src/components/MasterLayout.jsx
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, User, LogOut, Shield } from 'lucide-react';

export default function MasterLayout() {
  const navigate = useNavigate();

  // Updated paths to /master-panel
  const navItems = [
    { name: 'Dashboard', path: '/master-panel', icon: <LayoutDashboard size={20} /> },
    { name: 'Managers', path: '/master-panel/managers', icon: <Users size={20} /> },
    { name: 'Plans', path: '/master-panel/plans', icon: <CreditCard size={20} /> },
    { name: 'Profile', path: '/master-panel/profile', icon: <User size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Shield className="text-blue-500 w-8 h-8" />
          <span className="text-xl font-bold tracking-wide">MasterAdmin</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/master-panel'} // Strict matching for the dashboard base route
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span className="font-medium">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => navigate('/master')} // Logs out back to the Master Login page
            className="flex items-center gap-3 text-slate-400 hover:text-red-400 px-4 py-2 w-full transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}