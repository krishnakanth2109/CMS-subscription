import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Play, Search, Bell, ChevronDown, CheckCircle2, 
  Plus, MoreVertical, LayoutDashboard, FileText, 
  Users, Settings, Image as ImageIcon, BarChart3,
  Sun, Moon // 👈 Added Sun and Moon icons for the theme toggle
} from 'lucide-react';
import { Loader2, AlertCircle, ArrowRight, Crown, Sparkles, Zap } from 'lucide-react';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const formatPlanPrice = (price) => {
  if (!price) return 'Free';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
};

const PLAN_VISUALS = {
  Basic: {
    Icon: Sparkles,
    eyebrow: 'Starter access',
    iconClass: 'bg-slate-100 text-slate-600 border-slate-200',
    priceClass: 'text-foreground',
  },
  Pro: {
    Icon: Zap,
    eyebrow: 'Most popular',
    iconClass: 'bg-accent/10 text-accent border-accent/30',
    priceClass: 'text-accent',
  },
  Enterprise: {
    Icon: Crown,
    eyebrow: 'Full platform',
    iconClass: 'bg-amber-100 text-amber-700 border-amber-200',
    priceClass: 'text-amber-600 dark:text-amber-400',
  },
};

const getPlanVisual = (plan) =>
  PLAN_VISUALS[plan.key] || {
    Icon: Sparkles,
    eyebrow: plan.name || 'Plan',
    iconClass: 'bg-secondary text-foreground border-border',
    priceClass: 'text-foreground',
  };

const getPlanCardClass = (plan) =>
  [
    'relative flex h-full min-w-0 flex-col rounded-xl border p-5 shadow-sm transition-all duration-300 sm:p-6 lg:p-7',
    'bg-background/85 shadow-sm hover:-translate-y-1 hover:shadow-xl',
    plan.popular
      ? 'border-accent shadow-accent/10'
      : 'border-border hover:border-accent/40',
  ].join(' ');

const getPlanButtonClass = (plan) =>
  [
    'mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all',
    plan.popular
      ? 'bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:opacity-90'
      : 'border border-border bg-background hover:border-accent/50 hover:bg-secondary',
  ].join(' ');

export default function LandingPage() {
  const navigate = useNavigate();

  // ================= THEME TOGGLE LOGIC =================
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [pricingPlans, setPricingPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');

  useEffect(() => {
    // Apply the theme to the <html> tag
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Save to local storage so it remembers on refresh
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let ignore = false;

    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError('');

      try {
        const res = await fetch(`${API_URL}/payments/plans`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to load plans');
        if (!ignore) setPricingPlans(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!ignore) setPlansError(err.message || 'Unable to load plans');
      } finally {
        if (!ignore) setPlansLoading(false);
      }
    };

    fetchPlans();

    return () => {
      ignore = true;
    };
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  // ======================================================

  // Navigation handler for pricing plans
  const handlePlanClick = (planName) => {
    navigate(`/register?plan=${planName}`);
  };

  return (
    <div className="bg-background text-foreground font-body w-full transition-colors duration-300">
      
      {/* ================= HERO SECTION ================= */}
      <section className="relative h-screen flex flex-col overflow-hidden">
        {/* Background Video */}
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-40 dark:opacity-30"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4"
        />

        {/* Navbar */}
        <div className="relative z-10 flex items-center justify-between px-6 md:px-12 lg:px-20 py-5 w-full">
          {/* 👈 Added Logo Image Here */}
          <div className="flex items-center gap-3">
            <img 
              src="https://image2url.com/images/1764921567560-55d1b6d6-49f3-4473-82e3-1cdd2f7c19c2.jpg" 
              alt="CMS Logo" 
              className="h-10 w-10 object-cover rounded-lg shadow-sm"
            />
            <span className="text-xl font-semibold tracking-tight text-foreground">
              VTS Tracker
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground font-medium">
            <a href="#about" className="hover:text-foreground transition-colors">About</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </nav>
          
          <div className="flex items-center gap-4">
            {/* 👈 Theme Toggle Button Here */}
            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-secondary/50 text-foreground hover:bg-secondary transition-all shadow-sm backdrop-blur-sm border border-border"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            <Link to="/login" className="bg-primary text-primary-foreground rounded-full px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
              Sign In
            </Link>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-start pt-12 md:pt-16 px-4 w-full text-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-sm text-muted-foreground font-body mb-6 shadow-sm"
          >
            <span>The Ultimate Candidate Management System ✨</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl md:text-6xl lg:text-[5rem] leading-[0.95] tracking-tight text-foreground max-w-3xl"
          >
            Build, Manage & Grow Your Website with <span className="italic text-accent">Ease</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-base md:text-lg text-muted-foreground max-w-[650px] leading-relaxed font-body"
          >
            A powerful Content Management System (CMS) designed to help you create, edit, and manage your website without any technical complexity.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex items-center gap-4"
          >
            <Link to="/register" className="bg-primary text-primary-foreground rounded-full px-8 py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
              Get Started
            </Link>
            <Link to="/request-demo" className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-accent transition-colors">
              <span className="flex items-center justify-center h-12 w-12 rounded-full border-0 bg-background shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-background/80 transition-all">
                <Play className="h-4 w-4 fill-foreground text-foreground ml-1" />
              </span>
              <span className="hidden sm:block">Request Demo</span>
            </Link>
          </motion.div>

          {/* Custom Coded Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-12 w-full max-w-5xl px-4"
          >
            <div 
              className="rounded-2xl overflow-hidden p-3 md:p-4 backdrop-blur-xl border border-border bg-background/40 shadow-2xl"
            >
              <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm flex flex-col text-[11px] select-none pointer-events-none h-[400px]">
                {/* Topbar */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-slate-200 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center font-bold text-xs">V</div>
                    <span className="font-semibold text-sm text-slate-900">VTS Tracker</span>
                    <ChevronDown className="h-3 w-3 text-slate-500" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md text-slate-500 w-48">
                      <Search className="h-3 w-3" />
                      <span>Search pages... ⌘K</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-100 text-slate-900 px-3 py-1.5 rounded-md font-medium">New Post</span>
                      <Bell className="h-4 w-4 text-slate-500" />
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">JB</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar */}
                  <div className="w-40 border-r border-slate-200 bg-white p-3 flex flex-col gap-4 text-slate-600">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between bg-slate-100 px-2 py-1.5 rounded-md font-medium text-blue-600">
                        <div className="flex items-center gap-2"><LayoutDashboard className="w-3 h-3" /> Dashboard</div>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-2"><FileText className="w-3 h-3" /> Pages</div>
                        <span className="bg-blue-100 text-blue-600 text-[9px] px-1.5 rounded-full">10</span>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-2"><ImageIcon className="w-3 h-3" /> Media</div>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-2"><Users className="w-3 h-3" /> Users</div>
                        <ChevronDown className="h-3 w-3" />
                      </div>
                    </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 bg-slate-50 p-5 overflow-hidden flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-slate-900">Welcome, Jane</h2>
                    
                    <div className="flex gap-4">
                      {/* Left Card: Chart */}
                      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
                        <div className="flex items-center gap-1 text-slate-500 mb-2">
                          <BarChart3 className="w-3 h-3" /> Total Visitors <CheckCircle2 className="w-3 h-3 text-blue-500" />
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-bold text-slate-900">8,450,190</span>
                          <span className="text-xs text-slate-500 pb-1">views</span>
                        </div>
                      </div>

                      {/* Right Card: Content Stats */}
                      <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-semibold text-slate-900">Content Database</span>
                          <div className="flex gap-2 text-slate-400">
                            <Plus className="w-3 h-3" />
                            <MoreVertical className="w-3 h-3" />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Published Pages</span>
                            <span className="font-medium text-slate-900">98,125</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= EXTRA CONTENT ================= */}
      
      {/* About Section */}
      <section id="about" className="py-24 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">About the Platform</h2>
        <p className="text-muted-foreground text-lg max-w-3xl mx-auto mb-12">
          Our CMS platform is a modern, user-friendly solution that allows businesses, individuals, and organizations to manage their digital content effortlessly.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {['Easy content editing', 'Secure architecture', 'Fast SEO structure', 'Custom layouts'].map((item, i) => (
            <div key={i} className="p-6 bg-secondary rounded-2xl border border-border">
              <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-4" />
              <h3 className="font-semibold">{item}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 md:px-12 lg:px-20 bg-secondary/30 border-y border-border">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-16">Powerful Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">✨ Core Features</h3>
              <ul className="space-y-4">
                {[
                  'Content Creation & Editing (Pages, Blogs, Media)',
                  'User Management & Role-Based Access',
                  'SEO Optimization Tools',
                  'Analytics & Insights Dashboard'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">⚙️ Advanced Features</h3>
              <ul className="space-y-4">
                {[
                  'Multi-language Support',
                  'Scheduling & Publishing Control',
                  'Automated Backup & Restore',
                  'REST API Integration Support'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PRICING SECTION ================= */}
      <section id="pricing" className="py-24 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Pricing</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold">Choose the plan that fits your hiring flow</h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            Start lean, unlock advanced workflows when your team needs them, and keep every plan connected to the same VTS Tracker workspace.
          </p>
        </div>

        {plansLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-secondary/20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading plans...
          </div>
        ) : plansError ? (
          <div className="max-w-xl mx-auto rounded-lg border border-destructive/20 bg-destructive/10 p-5 text-destructive flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load pricing plans</p>
              <p className="text-sm opacity-80 mt-1">{plansError}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
            {pricingPlans.map((plan) => {
              const visual = getPlanVisual(plan);
              const Icon = visual.Icon;

              return (
                <motion.div
                  key={plan.key}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.45 }}
                  className={getPlanCardClass(plan)}
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${visual.iconClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex min-w-0 flex-wrap justify-end gap-2">
                      {plan.popular}
                      <span className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {visual.eyebrow}
                      </span>
                    </div>
                  </div>

                  <div className="mt-7">
                    <h3 className="break-words text-2xl font-bold tracking-tight">{plan.label}</h3>
                    <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
                  </div>

                  <div className="mt-6 border-y border-border py-5">
                    <div className={`break-words text-4xl font-extrabold tracking-tight ${visual.priceClass}`}>
                      {formatPlanPrice(plan.priceMonthly)}
                      {plan.priceMonthly > 0 && (
                        <span className="ml-1 text-base font-semibold text-muted-foreground">/mo</span>
                      )}
                    </div>
                    <p className="mt-2 break-words text-xs font-medium leading-relaxed text-muted-foreground">
                      {plan.priceYearly > 0
                        ? `${formatPlanPrice(plan.priceYearly)} billed yearly available`
                        : `${plan.durationDays || 7} days free trial included`}
                    </p>
                  </div>

                  <ul className="mt-6 flex-1 space-y-3 pb-6">
                    {(plan.features || []).map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <span className="min-w-0 break-words leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePlanClick(plan.key)}
                    className={getPlanButtonClass(plan)}
                  >
                    {plan.ctaLabel || `Choose ${plan.label}`}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA Footer Section */}
      <footer id="contact" className="border-t border-border mt-12 bg-secondary/20 pt-16 pb-8">
        <div className="max-w-4xl mx-auto text-center px-6 mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Ready to build your website effortlessly?</h2>
          <p className="text-muted-foreground mb-8 text-lg">Start your journey with our CMS today and take full control of your content.</p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link to="/register" className="bg-primary text-primary-foreground rounded-full px-8 py-4 text-sm font-semibold w-full sm:w-auto hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
              Get Started Now
            </Link>
            <Link to="/request-demo" className="bg-transparent border border-border text-foreground rounded-full px-8 py-4 text-sm font-semibold w-full sm:w-auto hover:bg-secondary transition-colors text-center">
              Contact Us for Demo
            </Link>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img 
              src="https://image2url.com/images/1764921567560-55d1b6d6-49f3-4473-82e3-1cdd2f7c19c2.jpg" 
              alt="CMS Logo" 
              className="h-6 w-6 object-cover rounded shadow-sm opacity-80 grayscale"
            />
            <span className="font-semibold text-foreground">VTS Tracker</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">About Us</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
          <div>© {new Date().getFullYear()} VTS Tracker. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}
