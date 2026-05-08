import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Play, Search, Bell, ChevronDown, CheckCircle2, 
  Plus, MoreVertical, LayoutDashboard, FileText, 
  Users, Settings, Image as ImageIcon, BarChart3,
  Sun, Moon // 👈 Added Sun and Moon icons for the theme toggle
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // ================= THEME TOGGLE LOGIC =================
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

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
              Nexora
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
            <button className="flex items-center justify-center h-12 w-12 rounded-full border-0 bg-background shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:bg-background/80 transition-all">
              <Play className="h-4 w-4 fill-foreground text-foreground ml-1" />
            </button>
            <span className="text-sm font-medium text-foreground ml-2 hidden sm:block">Request Demo</span>
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
                    <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center font-bold text-xs">N</div>
                    <span className="font-semibold text-sm text-slate-900">Nexora CMS</span>
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
        <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-16">Simple Pricing Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          
          {/* Basic Plan */}
          <div className="border border-border p-8 rounded-3xl flex flex-col bg-background/50 hover:border-accent/50 transition-colors">
            <h3 className="text-xl font-bold mb-2">Basic Plan</h3>
            <p className="text-muted-foreground text-sm mb-6">Best for individuals & small projects</p>
            <div className="text-4xl font-bold mb-8">₹499<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <ul className="space-y-4 mb-8 flex-1">
              {['Limited Pages & Posts', 'Basic SEO Tools', 'Standard Support', '5 GB Storage', 'Single User Access'].map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-accent" /> {feature}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handlePlanClick('Basic')} 
              className="w-full py-3 rounded-full border border-border font-medium hover:bg-secondary transition-colors"
            >
              Choose Basic
            </button>
          </div>

          {/* Standard Plan (MOST POPULAR) */}
          <div className="border-2 border-accent p-8 rounded-3xl flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-accent/20 bg-background">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent text-accent-foreground px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-lg">MOST POPULAR</div>
            <h3 className="text-xl font-bold mb-2">Standard Plan</h3>
            <p className="text-muted-foreground text-sm mb-6">Perfect for growing businesses</p>
            <div className="text-4xl font-bold mb-8 text-accent">₹999<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <ul className="space-y-4 mb-8 flex-1">
              {['Unlimited Pages & Posts', 'Advanced SEO Tools', 'Priority Support', '20 GB Storage', 'Up to 5 Users', 'Analytics Dashboard'].map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-foreground font-medium">
                  <CheckCircle2 className="w-4 h-4 text-accent" /> {feature}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handlePlanClick('Pro')} 
              className="w-full py-3 rounded-full bg-accent text-accent-foreground font-medium hover:opacity-90 transition-opacity shadow-md shadow-accent/20"
            >
              Choose Standard
            </button>
          </div>

          {/* Premium Plan */}
          <div className="border border-border p-8 rounded-3xl flex flex-col bg-background/50 hover:border-accent/50 transition-colors">
            <h3 className="text-xl font-bold mb-2">Premium Plan</h3>
            <p className="text-muted-foreground text-sm mb-6">Ideal for enterprises & large-scale</p>
            <div className="text-4xl font-bold mb-8 text-accent">₹1999<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <ul className="space-y-4 mb-8 flex-1">
              {['Unlimited Everything', 'Advanced Analytics', '24/7 Dedicated Support', '100 GB Storage', 'Unlimited Users', 'API Access'].map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-accent" /> {feature}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => handlePlanClick('Enterprise')} 
              className="w-full py-3 rounded-full border border-border font-medium hover:bg-secondary transition-colors"
            >
              Choose Premium
            </button>
          </div>
        </div>
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
            <button className="bg-transparent border border-border text-foreground rounded-full px-8 py-4 text-sm font-semibold w-full sm:w-auto hover:bg-secondary transition-colors">
              Contact Us for Demo
            </button>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img 
              src="https://image2url.com/images/1764921567560-55d1b6d6-49f3-4473-82e3-1cdd2f7c19c2.jpg" 
              alt="CMS Logo" 
              className="h-6 w-6 object-cover rounded shadow-sm opacity-80 grayscale"
            />
            <span className="font-semibold text-foreground">Nexora CMS</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">About Us</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
          <div>© {new Date().getFullYear()} Nexora CMS. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}