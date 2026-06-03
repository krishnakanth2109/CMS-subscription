// src/components/MasterLayout.jsx
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function MasterLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Updated paths to /master-panel
  const navItems = [
    { name: 'Dashboard', path: '/master-panel', icon: <LayoutDashboard size={20} /> },
    { name: 'Admins', path: '/master-panel/managers', icon: <Users size={20} /> },
    { name: 'Plans', path: '/master-panel/plans', icon: <CreditCard size={20} /> },
    { name: 'Profile', path: '/master-panel/profile', icon: <User size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-[#f3f6fd] font-sans">
      <aside className="w-64 bg-[#283086] text-white flex flex-col shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
            <Shield className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-wide block">Master Admin</span>
            <span className="text-xs text-white/60">System control</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/master-panel'} // Strict matching for the dashboard base route
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-white/15 text-white font-bold' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span className="font-medium">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={() => {
              logout();
              navigate('/master');
            }}
            className="flex items-center gap-3 text-white/70 hover:text-white hover:bg-white/10 rounded-lg px-4 py-2 w-full transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
