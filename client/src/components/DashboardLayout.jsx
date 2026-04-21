import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import clsx from 'clsx';

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    // Background color #f3f6fd matches the Sidebar inverse curves
    <div className="min-h-screen bg-[#f3f6fd] flex font-sans">
      
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      <div 
        className={clsx(
          "flex-1 min-h-screen flex flex-col",
          "transition-all duration-300 ease-in-out",
          isSidebarOpen ? "ml-80" : "ml-20"
        )}
      >
        {/* ✅ FIX: Removed key={location.pathname} and keyframe animation 
            React Router handles smooth DOM diffing. Forcing a re-render 
            with a key is what caused the entire page to "blink" and flash. */}
        <main className="flex-1 w-full p-4 md:p-8 overflow-x-hidden overflow-y-auto bg-[#f3f6fd]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}