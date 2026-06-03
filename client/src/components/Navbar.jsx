import React, { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, UserPlus, Briefcase,
  Building2, Receipt, ClipboardList, MessageSquare,
  BarChart3, Settings, Power, User, Users, Calendar,
  Video, FileText, Handshake, Lock, Zap, Crown, Sparkles,
  ChevronRight, AlertTriangle, Menu, X, MoreHorizontal, ChevronDown,
  Loader2, CheckCircle2, Mail
} from 'lucide-react';
import clsx from 'clsx';
import UpgradePlanModal from './UpgradePlanModal';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

// ── Plan feature gate config ──────────────────────────────────────────────────
// 'all'  = visible to all plans
// 'pro'  = Pro + Enterprise only
// 'enterprise' = Enterprise only
const ROUTE_ACCESS = {
  '/admin': 'all',
  '/admin/add-candidate': 'all',
  '/admin/my-candidates': 'all',
  '/admin/recruiters': 'all',
  '/admin/requirements': 'all',
  '/admin/schedules': 'all',
  '/admin/profile': 'all',
  '/admin/clients': 'pro',
  '/admin/reports': 'pro',
  '/admin/invoices': 'enterprise',
  '/admin/messages': 'enterprise',
  '/admin/agreements': 'enterprise',
  '/admin/mock': 'enterprise',
  '/recruiter': 'all',
  '/recruiter/candidates': 'all',
  '/recruiter/assignments': 'all',
  '/recruiter/schedules': 'all',
  '/recruiter/profile': 'all',
  '/recruiter/settings': 'all',
  '/recruiter/messages': 'enterprise',
  '/recruiter/mock': 'enterprise',
  '/recruiter/reports': 'pro',
};

const planLevel = (plan) => {
  if (plan === 'Enterprise') return 3;
  if (plan === 'Pro') return 2;
  return 1; // Basic / None / trial
};

const requiredLevel = (access) => {
  if (access === 'enterprise') return 3;
  if (access === 'pro') return 2;
  return 1;
};

const isLocked = (path, plan) => {
  const access = ROUTE_ACCESS[path];
  if (!access || access === 'all') return false;
  return planLevel(plan) < requiredLevel(access);
};

const lockLabel = (path) => {
  const access = ROUTE_ACCESS[path];
  if (access === 'enterprise') return 'Premium';
  if (access === 'pro') return 'Flexi+';
  return null;
};

export default function Navbar() {
  const { userRole, logout, currentUser, authHeaders } = useAuth();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const dropdownRef = React.useRef(null);
  const moreDropdownRef = React.useRef(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalStep, setPasswordModalStep] = useState('request');
  const [sendingPasswordLink, setSendingPasswordLink] = useState(false);
  const { toast } = useToast();

  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  React.useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSendPasswordLink = async () => {
    const email = currentUser?.email;
    if (!email) {
      toast({ title: 'Error', description: 'User email not found. Please log in again.', variant: 'destructive' });
      return;
    }
    setSendingPasswordLink(true);
    try {
      const authH = await authHeaders();
      const headers = { 'Content-Type': 'application/json', ...authH };
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to send reset link.');

      toast({
        title: 'Email Sent!',
        description: `A reset link has been sent to ${email}.`,
      });

      setPasswordModalStep('sent');
    } catch (err) {
      toast({ title: 'Send Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSendingPasswordLink(false);
    }
  };

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentPlan = currentUser?.subscriptionPlan || 'Basic';
  const daysLeft = currentUser?.subscriptionDaysLeft ?? null;
  const isExpired = daysLeft !== null && daysLeft === 0;
  const showBanner = isExpired || (currentPlan === 'Basic' && daysLeft !== null && daysLeft <= 7);

  const navbarBg = "bg-[#283086]";
  const activeBgClass = "bg-white/15";
  const activeTextClass = "text-white font-bold";
  const inactiveText = "text-white/70 font-medium hover:bg-white/10 hover:text-white";

  // Manager links
  const managerLinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'OverAll Candidates', path: '/admin/add-candidate', icon: Users },
    { name: 'Recruiters', path: '/admin/recruiters', icon: Briefcase },
    { name: 'Client Info', path: '/admin/clients', icon: Building2 },
    { name: 'Invoices', path: '/admin/invoices', icon: Receipt },
    { name: 'Requirements', path: '/admin/requirements', icon: ClipboardList },
    { name: 'Schedules', path: '/admin/schedules', icon: Calendar },
    { name: 'Messages', path: '/admin/messages', icon: MessageSquare },
    { name: 'Agreements', path: '/admin/agreements', icon: Handshake },
    { name: 'Mock Interviews', path: '/admin/mock', icon: Video },
    { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
  ];

  const adminLinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'OverAll Candidates', path: '/admin/add-candidate', icon: Users },
    { name: 'My Candidates', path: '/admin/my-candidates', icon: UserPlus },
    { name: 'Recruiters', path: '/admin/recruiters', icon: Briefcase },
    { name: 'Requirements', path: '/admin/requirements', icon: ClipboardList },
    { name: 'Schedules', path: '/admin/schedules', icon: Calendar },
    { name: 'Messages', path: '/admin/messages', icon: MessageSquare },
    { name: 'Agreements', path: '/admin/agreements', icon: Handshake },
    { name: 'Mock Interviews', path: '/admin/mock', icon: Video },
    { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
  ];

  const recruiterLinks = [
    { name: 'Dashboard', path: '/recruiter', icon: LayoutDashboard },
    { name: 'My Candidates', path: '/recruiter/candidates', icon: UserPlus },
    { name: 'Assignments', path: '/recruiter/assignments', icon: Briefcase },
    { name: 'Schedules', path: '/recruiter/schedules', icon: Calendar },
    { name: 'Messages', path: '/recruiter/messages', icon: MessageSquare },
    { name: 'Mock Interviews', path: '/recruiter/mock', icon: Video },
    { name: 'Reports', path: '/recruiter/reports', icon: BarChart3 },
  ];

  let links = recruiterLinks;
  if (userRole === 'manager') links = managerLinks;
  else if (userRole === 'admin') links = adminLinks;

  // Determine visible vs hidden links based on screen size
  const { visibleLinks, hiddenLinks } = useMemo(() => {
    let limit = links.length;
    if (screenWidth < 1024) {
      limit = 0;
    } else if (screenWidth < 1200) {
      limit = 2;
    } else if (screenWidth < 1360) {
      limit = 4;
    } else if (screenWidth < 1536) {
      limit = 6;
    }
    return {
      visibleLinks: links.slice(0, limit),
      hiddenLinks: links.slice(limit)
    };
  }, [links, screenWidth]);

  const PlanIcon = useMemo(() => {
    if (currentPlan === 'Enterprise') return Crown;
    if (currentPlan === 'Pro') return Zap;
    return Sparkles;
  }, [currentPlan]);

  const planColor = useMemo(() => {
    if (currentPlan === 'Enterprise') return 'text-amber-400';
    if (currentPlan === 'Pro') return 'text-blue-300';
    return 'text-slate-300';
  }, [currentPlan]);

  return (
    <>
      <nav className={clsx("w-full z-40 shadow-lg", navbarBg, "sticky top-0")}>
        {/* Main Header Container */}
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center flex-wrap min-h-[5rem] py-2">

            {/* Left Side: Hamburger Menu + Logo */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden text-white p-2 -ml-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors focus:outline-none"
              >
                <Menu className="h-6 w-6" />
              </button>

              {/* Logo */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden lg:flex w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl items-center justify-center border border-white/10 shadow-inner">
                  <span className="text-white font-extrabold text-xl">V</span>
                </div>
                <span className="text-white font-bold text-xl sm:text-2xl tracking-tight">
                  VTS Tracker
                </span>
              </div>
            </div>

            {/* Bottom Row: Desktop Navigation Links */}
            <div className="hidden lg:flex w-full order-last justify-center items-center gap-4 xl:gap-6 mt-3 pt-3 pb-1 border-t border-white/10 flex-wrap">
              {visibleLinks.map((link) => {
                const locked = isLocked(link.path, currentPlan);
                if (locked) {
                  return (
                    <button
                      key={link.path}
                      onClick={() => setShowUpgradeModal(true)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-all whitespace-nowrap text-[13px] font-semibold"
                    >
                      <link.icon className="h-[15px] w-[15px] stroke-[2px]" />
                      <span>{link.name}</span>
                      <Lock className="w-3 h-3 ml-0.5" />
                    </button>
                  );
                }

                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    end={link.path === '/admin' || link.path === '/recruiter'}
                    className={({ isActive }) =>
                      clsx(
                        "group relative flex items-center gap-1 px-2 py-1.5 rounded-lg select-none outline-none transition-all whitespace-nowrap text-[13px] font-semibold",
                        isActive ? "bg-white/20 text-white font-bold shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <link.icon className="h-[15px] w-[15px] stroke-[2px]" />
                        <span>{link.name}</span>
                        {isActive && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-white/20 pointer-events-none z-10" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}

              {/* More Dropdown */}
              {hiddenLinks.length > 0 && (
                <div className="relative" ref={moreDropdownRef}>
                  <button
                    onClick={() => setIsMoreOpen(!isMoreOpen)}
                    className={clsx(
                      "flex items-center gap-1 px-2 py-1.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white font-semibold text-[13px] transition-all",
                      isMoreOpen && "bg-white/10 text-white"
                    )}
                  >
                    <span>More</span>
                    <ChevronDown className="h-[15px] w-[15px]" />
                  </button>

                  {isMoreOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-[#212870] border border-white/10 rounded-xl shadow-xl py-1 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      {hiddenLinks.map((link) => {
                        const locked = isLocked(link.path, currentPlan);
                        if (locked) {
                          return (
                            <button
                              key={link.path}
                              onClick={() => {
                                setIsMoreOpen(false);
                                setShowUpgradeModal(true);
                              }}
                              className="flex items-center justify-between w-full px-3 py-2 text-[13px] text-white/40 hover:bg-white/5 transition-all text-left font-semibold"
                            >
                              <span className="flex items-center gap-1.5">
                                <link.icon className="h-[15px] w-[15px]" />
                                {link.name}
                              </span>
                              <Lock className="w-3 h-3" />
                            </button>
                          );
                        }

                        return (
                          <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.path === '/admin' || link.path === '/recruiter'}
                            onClick={() => setIsMoreOpen(false)}
                            className={({ isActive }) =>
                              clsx(
                                "flex items-center gap-1.5 px-3 py-2 text-[13px] transition-all text-left w-full",
                                isActive
                                  ? "bg-white/20 text-white font-bold"
                                  : "text-white/70 hover:bg-white/10 hover:text-white font-semibold"
                              )
                            }
                          >
                            <link.icon className="h-[15px] w-[15px]" />
                            {link.name}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Side: User Profile Trigger */}
            <div className="hidden lg:flex items-center gap-4 shrink-0">

              {/* User Profile Circle Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <div
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="relative flex items-center gap-3 cursor-pointer bg-white/5 py-1.5 pl-4 pr-1.5 rounded-full border border-transparent border-white/10 transition-all"
                >
                  <div className="flex flex-col items-end text-right">
                    <span className="text-white font-bold text-sm leading-none mb-1">{currentUser?.name || 'User'}</span>
                    <span className="text-white/60 text-[11px] leading-none max-w-[150px] truncate">{currentUser?.email}</span>
                  </div>

                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden bg-gray-200 shadow-sm flex items-center justify-center">
                      {currentUser?.profilePicture ? (
                        <img src={currentUser.profilePicture} className="w-full h-full object-cover" alt="Profile" />
                      ) : (
                        <User className="h-full w-full p-2 text-gray-500" />
                      )}
                    </div>
                    {currentPlan === 'Enterprise' && (
                      <div className="absolute -top-1 -right-1 bg-amber-400 text-[#283086] rounded-full p-0.5 border border-[#212870] shadow-md z-10 animate-bounce-short">
                        <Crown className="w-3 h-3 fill-amber-400 stroke-[#283086]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-xl py-2 z-50 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="px-4 py-3 border-b border-slate-100 mb-1 bg-slate-50/50">
                      <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                        <span>{currentUser?.name || 'User'}</span>
                        {currentPlan === 'Enterprise' && (
                          <Crown className="w-3.5 h-3.5 fill-amber-400 stroke-amber-600 shrink-0" />
                        )}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{currentUser?.email}</p>
                    </div>

                    <NavLink
                      to={userRole === 'recruiter' ? '/recruiter/profile' : '/admin/profile'}
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className={({ isActive }) => clsx("flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors", isActive ? "text-blue-600 bg-blue-50" : "text-slate-700 hover:bg-slate-50 hover:text-blue-600")}
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </NavLink>

                    {userRole === 'recruiter' && (
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setShowUpgradeModal(true);
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 w-full text-left transition-colors"
                      >
                        <Zap className="w-4 h-4" />
                        Upgrade Plan
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setShowPasswordModal(true);
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 w-full text-left transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      Change Password
                    </button>

                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          setShowLogoutModal(true);
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                      >
                        <Power className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Mobile Navigation Menu (Drawer) */}
        <div className={clsx(
          "fixed inset-0 z-50 lg:hidden transition-opacity duration-300",
          isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}>
          {/* Backdrop */}
          <div
            className={clsx(
              "absolute inset-0 bg-black/50 transition-opacity duration-300",
              isMobileMenuOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer */}
          <div className={clsx(
            "absolute top-0 left-0 h-full w-72 bg-[#212870] shadow-2xl flex flex-col transition-transform duration-300 transform",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="text-white font-bold text-lg">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors focus:outline-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Mobile Plan Banner */}
              {userRole === 'manager' && (
                <div className="p-4 border-b border-white/10 flex flex-col gap-3">
                  {showBanner && (
                    <div className="p-3 bg-amber-500/20 border border-amber-400/30 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <p className="text-amber-300 text-sm font-bold">
                        {isExpired ? 'Trial Expired' : `${daysLeft} days left`}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="flex items-center justify-center bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl px-4 py-3 transition-all gap-2"
                  >
                    <PlanIcon className={clsx("w-5 h-5", planColor)} />
                    <span className={clsx("text-sm font-bold", planColor)}>
                      Upgrade to {currentPlan === 'Basic' ? 'Pro' : 'Enterprise'}
                    </span>
                  </button>
                </div>
              )}

              <div className="px-3 pt-3 pb-6 space-y-1">
                {links.map((link) => {
                  const locked = isLocked(link.path, currentPlan);
                  const badge = lockLabel(link.path);

                  if (locked) {
                    return (
                      <button
                        key={link.path}
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setShowUpgradeModal(true);
                        }}
                        className="group flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-white/40 hover:bg-white/5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <link.icon className="h-[17px] w-[17px]" />
                          <span className="text-[14px] font-medium">{link.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-1 rounded-full text-white/50">
                            {badge}
                          </span>
                          <Lock className="w-4 h-4" />
                        </div>
                      </button>
                    );
                  }

                  return (
                    <NavLink
                      key={link.path}
                      to={link.path}
                      end={link.path === '/admin' || link.path === '/recruiter'}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          "group relative flex items-center gap-3 px-4 py-3.5 rounded-xl select-none outline-none transition-all",
                          isActive ? "bg-white/20 text-white font-bold" : "text-white/70 font-medium hover:bg-white/5 hover:text-white"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <link.icon className={clsx("h-[17px] w-[17px]", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                          <span className="text-[14px]">{link.name}</span>
                          {isActive && (
                            <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[12px] border-l-white/20 z-10" />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}

                <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
                  <NavLink
                    to={userRole === 'recruiter' ? '/recruiter/profile' : '/admin/profile'}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        "group relative flex items-center gap-3 px-4 py-3.5 rounded-xl select-none outline-none transition-all",
                        isActive ? "bg-white/20 text-white font-bold" : "text-white/70 font-medium hover:bg-white/5 hover:text-white"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <User className={clsx("h-[17px] w-[17px]", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                        <span className="text-[14px]">My Profile</span>
                        {isActive && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[12px] border-l-white/20 z-10" />
                        )}
                      </>
                    )}
                  </NavLink>

                  {userRole === 'recruiter' && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setShowUpgradeModal(true);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-white/70 hover:bg-white/5 hover:text-white font-medium transition-all"
                    >
                      <Zap className="h-[17px] w-[17px] stroke-[2px]" />
                      <span className="text-[14px]">Upgrade Plan</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setShowPasswordModal(true);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-white/70 hover:bg-white/5 hover:text-white font-medium transition-all"
                  >
                    <Lock className="h-[17px] w-[17px] stroke-[2px]" />
                    <span className="text-[14px]">Change Password</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setShowLogoutModal(true);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold transition-all mt-2"
                  >
                    <Power className="h-[17px] w-[17px] stroke-[2.5px]" />
                    <span className="text-[14px]">Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <Power className="h-8 w-8 text-red-500 stroke-[2.5px]" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Sign Out</h3>
              <p className="text-slate-500 text-sm mb-8">Are you sure you want to sign out of your account?</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={logout}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <Lock className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 animate-fade-in">Change Password</h3>
                    <p className="text-slate-500 text-xs mt-0.5">Secure your account credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordModalStep('request');
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {passwordModalStep === 'request' ? (
                <div className="space-y-6">
                  <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <Mail className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800">Identity Verification</p>
                      <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                        A secure password reset link will be sent to <strong>{currentUser?.email}</strong>.
                        Click the link in the email to set a new password.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowPasswordModal(false)}
                      className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendPasswordLink}
                      disabled={sendingPasswordLink}
                      className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-[#283086] hover:bg-[#1a2060] shadow-lg shadow-indigo-600/30 transition-all text-sm flex items-center justify-center gap-1.5"
                    >
                      {sendingPasswordLink ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          Send Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-4 flex flex-col items-center gap-4 text-center animate-fade-in">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-2 animate-bounce">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Check Your Inbox</h4>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed font-medium">
                      A reset link has been successfully sent to <strong className="text-slate-800">{currentUser?.email}</strong>.
                      Please click the link inside the email to complete the password reset.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordModalStep('request');
                    }}
                    className="mt-6 w-full px-4 py-3 rounded-xl font-bold text-white bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/30 transition-all text-sm"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={currentPlan}
      />
    </>
  );
}
