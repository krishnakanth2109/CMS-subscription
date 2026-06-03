import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#f3f6fd] flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 w-full p-4 md:p-8 overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}