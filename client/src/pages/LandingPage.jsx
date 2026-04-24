import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Play, Search, Bell, ChevronDown, CheckCircle2, 
  Plus, MoreVertical, LayoutDashboard, FileText, 
  Users, Settings, Image as ImageIcon, BarChart3
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground font-body w-full">
      
      {/* ================= HERO SECTION (Strict 100vh Layout) ================= */}
      <section className="relative h-screen flex flex-col overflow-hidden">
        {/* Background Video */}
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-40"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4"
        />

        {/* Navbar */}
        <div className="relative z-10 flex items-center justify-between px-6 md:px-12 lg:px-20 py-5 w-full">
          <div className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <span className="text-accent">✦</span> CMS Platform
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#about" className="hover:text-foreground transition-colors">About</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </nav>
          <Link to="/login" className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity">
            Sign In
          </Link>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-start pt-12 md:pt-16 px-4 w-full text-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 backdrop-blur-md px-4 py-1.5 text-sm text-muted-foreground font-body mb-6"
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
            <Link to="/register" className="bg-primary text-primary-foreground rounded-full px-8 py-3.5 text-sm font-medium hover:opacity-90 transition-opacity">
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
              className="rounded-2xl overflow-hidden p-3 md:p-4 backdrop-blur-xl"
              style={{
                background: 'rgba(255, 255, 255, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                boxShadow: 'var(--shadow-dashboard)'
              }}
            >
              {/* Dashboard Internals */}
              <div className="bg-white rounded-xl overflow-hidden border border-border shadow-sm flex flex-col text-[11px] select-none pointer-events-none h-[400px]">
                {/* Topbar */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-border bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded flex items-center justify-center font-bold text-xs">N</div>
                    <span className="font-semibold text-sm">Nexora CMS</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-md text-muted-foreground w-48">
                      <Search className="h-3 w-3" />
                      <span>Search pages... ⌘K</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-secondary text-foreground px-3 py-1.5 rounded-md font-medium">New Post</span>
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <div className="w-6 h-6 bg-accent text-accent-foreground rounded-full flex items-center justify-center font-medium">JB</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar */}
                  <div className="w-40 border-r border-border bg-white p-3 flex flex-col gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between bg-secondary px-2 py-1.5 rounded-md font-medium text-primary">
                        <div className="flex items-center gap-2"><LayoutDashboard className="w-3 h-3" /> Dashboard</div>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5 text-muted-foreground">
                        <div className="flex items-center gap-2"><FileText className="w-3 h-3" /> Pages</div>
                        <span className="bg-accent text-accent-foreground text-[9px] px-1.5 rounded-full">10</span>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5 text-muted-foreground">
                        <div className="flex items-center gap-2"><ImageIcon className="w-3 h-3" /> Media</div>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5 text-muted-foreground">
                        <div className="flex items-center gap-2"><Users className="w-3 h-3" /> Users</div>
                        <ChevronDown className="h-3 w-3" />
                      </div>
                    </div>
                    <div>
                      <p className="px-2 text-[10px] font-semibold text-muted-foreground mb-2">WORKFLOWS</p>
                      <div className="space-y-1 text-muted-foreground">
                        <div className="px-2 py-1">SEO Tools</div>
                        <div className="px-2 py-1">Forms</div>
                        <div className="px-2 py-1">Analytics</div>
                        <div className="px-2 py-1 flex items-center gap-2"><Settings className="w-3 h-3" /> Settings</div>
                      </div>
                    </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 bg-secondary/30 p-5 overflow-hidden flex flex-col gap-4">
                    <h2 className="text-sm font-semibold text-foreground">Welcome, Jane</h2>
                    
                    <div className="flex items-center gap-2">
                      <span className="bg-accent text-accent-foreground px-3 py-1.5 rounded-full font-medium">Publish</span>
                      <span className="bg-white border border-border text-foreground px-3 py-1.5 rounded-full">Save Draft</span>
                      <span className="bg-white border border-border text-foreground px-3 py-1.5 rounded-full">Preview</span>
                      <span className="bg-white border border-border text-foreground px-3 py-1.5 rounded-full">Schedule</span>
                      <span className="text-muted-foreground ml-2">+ Customize</span>
                    </div>

                    <div className="flex gap-4">
                      {/* Left Card: Chart */}
                      <div className="flex-1 bg-white border border-border rounded-xl p-4 shadow-sm flex flex-col">
                        <div className="flex items-center gap-1 text-muted-foreground mb-2">
                          <BarChart3 className="w-3 h-3" /> Total Visitors <CheckCircle2 className="w-3 h-3 text-accent" />
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-bold text-foreground">8,450,190</span>
                          <span className="text-xs text-muted-foreground pb-1">views</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          <span className="text-emerald-500 font-medium">+1.8M</span>
                          <span className="text-muted-foreground">Last 30 Days</span>
                        </div>
                        
                        <div className="mt-4 h-20 w-full relative">
                          <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <path 
                              d="M0,50 C20,40 40,60 60,30 C80,0 100,20 120,40 C140,60 160,20 180,10 C190,5 200,15 200,15 L200,60 L0,60 Z" 
                              fill="url(#chartGradient)" 
                            />
                            <path 
                              d="M0,50 C20,40 40,60 60,30 C80,0 100,20 120,40 C140,60 160,20 180,10 C190,5 200,15 200,15" 
                              fill="none" 
                              stroke="hsl(var(--accent))" 
                              strokeWidth="1.5" 
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Right Card: Content Stats */}
                      <div className="flex-1 bg-white border border-border rounded-xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-semibold text-foreground">Content Database</span>
                          <div className="flex gap-2 text-muted-foreground">
                            <Plus className="w-3 h-3" />
                            <MoreVertical className="w-3 h-3" />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Published Pages</span>
                            <span className="font-medium">98,125</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Blog Posts</span>
                            <span className="font-medium">6,750</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Media Assets</span>
                            <span className="font-medium">1,592,864</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Table */}
                    <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
                      <h3 className="font-semibold text-foreground mb-3">Recent Activity</h3>
                      <div className="w-full text-left flex flex-col gap-2">
                        <div className="flex text-muted-foreground font-medium border-b border-border pb-2">
                          <div className="flex-1">Date</div>
                          <div className="flex-[2]">Action</div>
                          <div className="flex-1 text-right">User</div>
                          <div className="flex-1 text-right">Status</div>
                        </div>
                        <div className="flex border-b border-border pb-2">
                          <div className="flex-1 text-muted-foreground">Today</div>
                          <div className="flex-[2] font-medium">Published "Homepage V2"</div>
                          <div className="flex-1 text-right">Jane Doe</div>
                          <div className="flex-1 text-right text-emerald-600">Completed</div>
                        </div>
                        <div className="flex border-b border-border pb-2">
                          <div className="flex-1 text-muted-foreground">Yesterday</div>
                          <div className="flex-[2] font-medium">AWS Server Scale Up</div>
                          <div className="flex-1 text-right">System</div>
                          <div className="flex-1 text-right text-amber-600">Pending</div>
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


      {/* ================= EXTRA CONTENT (Scrollable area below fold) ================= */}
      
      {/* About Section */}
      <section id="about" className="py-24 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">About the Platform</h2>
        <p className="text-muted-foreground text-lg max-w-3xl mx-auto mb-12">
          Our CMS platform is a modern, user-friendly solution that allows businesses, individuals, and organizations to manage their digital content effortlessly. Whether you're running a business website, blog, or enterprise portal, our system provides all the tools you need to update content, manage users, and scale your platform efficiently.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {['Easy content editing', 'Secure architecture', 'Fast SEO structure', 'Custom layouts'].map((item, i) => (
            <div key={i} className="p-6 bg-secondary rounded-2xl">
              <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-4" />
              <h3 className="font-semibold">{item}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 md:px-12 lg:px-20 bg-secondary/50">
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
                  'Analytics & Insights Dashboard',
                  'Media Library Management',
                  'Secure Authentication System'
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
                  'REST API Integration Support',
                  'Custom Themes & UI Customization'
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

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-16">Simple Pricing Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Basic Plan */}
          <div className="border border-border p-8 rounded-3xl flex flex-col">
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
            <button className="w-full py-3 rounded-full border border-border font-medium hover:bg-secondary transition-colors">Choose Basic</button>
          </div>

          {/* Standard Plan */}
          <div className="border-2 border-accent p-8 rounded-3xl flex flex-col relative transform md:-translate-y-4 shadow-xl shadow-accent/10 bg-white">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-bold tracking-wide">MOST POPULAR</div>
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
            <button className="w-full py-3 rounded-full bg-accent text-accent-foreground font-medium hover:opacity-90 transition-opacity">Choose Standard</button>
          </div>

          {/* Premium Plan */}
          <div className="border border-border p-8 rounded-3xl flex flex-col">
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
            <button className="w-full py-3 rounded-full border border-border font-medium hover:bg-secondary transition-colors">Choose Premium</button>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <footer id="contact" className="border-t border-border mt-12 bg-secondary/30 pt-16 pb-8">
        <div className="max-w-4xl mx-auto text-center px-6 mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">Ready to build your website effortlessly?</h2>
          <p className="text-muted-foreground mb-8 text-lg">Start your journey with our CMS today and take full control of your content.</p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link to="/register" className="bg-primary text-primary-foreground rounded-full px-8 py-4 text-sm font-medium w-full sm:w-auto hover:opacity-90 transition-opacity">
              Get Started Now
            </Link>
            <button className="bg-white border border-border text-foreground rounded-full px-8 py-4 text-sm font-medium w-full sm:w-auto hover:bg-secondary transition-colors">
              Contact Us for Demo
            </button>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <span className="text-accent">✦</span> CMS Platform
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">About Us</a>
            <a href="#" className="hover:text-foreground">Contact</a>
            <a href="#" className="hover:text-foreground">Privacy Policy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
          <div>© 2024 CMS Platform. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}