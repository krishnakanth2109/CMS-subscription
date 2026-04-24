import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, User, Mail, Lock, Phone, ArrowRight,
  Loader2, CheckCircle2, AlertCircle,
  Sparkles, Zap, Crown, Check, X
} from 'lucide-react';

// ─── Plan Definitions ─────────────────────────────────────────────────────────
const PLANS = [
  {
    key:         'Basic',
    name:        'Free Trial',
    tagline:     '7 days free, no card needed',
    icon:        Sparkles,
    price:       0,
    color:       'border-slate-200 bg-slate-50',
    activeColor: 'border-[#283086] bg-[#283086]/5 ring-2 ring-[#283086]/20',
    iconColor:   'text-slate-500',
    priceColor:  'text-slate-700',
    features:    ['Dashboard', 'Candidates', 'Recruiters', 'Schedules'],
    locked:      ['Client Info', 'Reports', 'Invoices', 'Messages', 'Agreements', 'Mock Interviews'],
  },
  {
    key:         'Pro',
    name:        'Flexi',
    tagline:     '₹1,999/mo · Most popular',
    icon:        Zap,
    price:       1999,
    color:       'border-blue-200 bg-blue-50',
    activeColor: 'border-blue-500 bg-blue-50 ring-2 ring-blue-200',
    iconColor:   'text-blue-600',
    priceColor:  'text-blue-700',
    popular:     true,
    features:    ['Everything in Free', 'Client Info', 'Reports'],
    locked:      ['Invoices', 'Messages', 'Agreements', 'Mock Interviews'],
  },
  {
    key:         'Enterprise',
    name:        'Premium',
    tagline:     '₹4,999/mo · All features',
    icon:        Crown,
    price:       4999,
    color:       'border-amber-200 bg-amber-50',
    activeColor: 'border-amber-500 bg-amber-50 ring-2 ring-amber-200',
    iconColor:   'text-amber-600',
    priceColor:  'text-amber-700',
    features:    ['Everything in Flexi', 'Invoices', 'Messages', 'Agreements', 'Mock Interviews'],
    locked:      [],
  },
];

// ─── clsx shim ────────────────────────────────────────────────────────────────
function clsx(...args) {
  return args.filter(Boolean).join(' ');
}

// ─── Safe fetch helper ────────────────────────────────────────────────────────
// Gives a clear error instead of "JSON parse failed" when backend returns HTML.
async function safeFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    throw new Error(
      `Network error — is your backend running? (${networkErr.message})`
    );
  }

  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error(`[safeFetch] Non-JSON response from ${url} [${res.status}]:`, text.slice(0, 400));
    throw new Error(
      `Server error (${res.status}): The API at "${url}" didn't return JSON. ` +
      `Check that VITE_API_URL is correct and the backend route exists.`
    );
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// ─── Load Razorpay SDK ────────────────────────────────────────────────────────
function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script   = document.createElement('script');
    script.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = resolve;
    script.onerror = () => reject(new Error('Failed to load Razorpay. Check your internet connection.'));
    document.body.appendChild(script);
  });
}

// ─── Register Component ───────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name:        '',
    companyName: '',
    email:       '',
    phone:       '',
    password:    '',
  });
  const [selectedPlan, setSelectedPlan] = useState('Basic');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [success, setSuccess]           = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  // ── Step 1: Create Firebase user + MongoDB record ─────────────────────────
  const registerAccount = () =>
    safeFetch(`${API_URL}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        subscriptionPlan: selectedPlan,
        role:             'manager',
        tenantOwnerId:    null,
      }),
    });

  // ── Step 2: Create Razorpay order (PUBLIC endpoint — no auth needed) ──────
  const createGuestOrder = () =>
    safeFetch(`${API_URL}/payments/create-order-guest`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan:    selectedPlan,
        billing: 'monthly',
        email:   formData.email,
        name:    formData.name,
        phone:   formData.phone,
      }),
    });

  // ── Step 3: Open Razorpay checkout modal ──────────────────────────────────
  const openRazorpayCheckout = async (orderData) => {
    await loadRazorpay();

    const plan = PLANS.find(p => p.key === selectedPlan);

    return new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        'VTS Tracker',
        description: `${plan.name} Plan — Monthly`,
        order_id:    orderData.orderId,
        prefill: {
          name:    formData.name,
          email:   formData.email,
          contact: formData.phone,
        },
        theme: { color: '#283086' },
        modal: {
          ondismiss: () =>
            reject(new Error('Payment cancelled. Your account was created — log in and upgrade anytime.')),
        },
        handler: (response) => resolve(response),
      });
      rzp.open();
    });
  };

  // ── Step 4: Verify payment (PUBLIC endpoint — no auth needed) ────────────
  const verifyGuestPayment = (paymentResponse) =>
    safeFetch(`${API_URL}/payments/verify-guest`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...paymentResponse,
        plan:    selectedPlan,
        billing: 'monthly',
        email:   formData.email,
      }),
    });

  // ── Main submit handler ───────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Register account (Firebase + MongoDB)
      await registerAccount();

      if (selectedPlan === 'Basic') {
        // Free trial — no payment needed, go to login
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      // 2. Create Razorpay order via PUBLIC endpoint (no auth token required)
      const orderData = await createGuestOrder();

      // 3. Open Razorpay checkout and wait for user to complete payment
      const paymentResponse = await openRazorpayCheckout(orderData);

      // 4. Verify payment via PUBLIC endpoint — upgrades plan in MongoDB by email
      await verifyGuestPayment(paymentResponse);

      // 5. All done!
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);

    } catch (err) {
      console.error('Registration Error:', err);
      // If payment was cancelled but account was created, account still works
      if (err.message?.includes('Payment cancelled')) {
        setError(err.message); // Show "log in and upgrade anytime" message
        setTimeout(() => navigate('/login'), 3500);
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-slate-500 text-sm mt-1">Start your free trial or pick a plan</p>
        </div>

        {success ? (
          /* ── Success State ── */
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Account Created!</h3>
            <p className="text-slate-500 text-sm">Redirecting you to login...</p>
          </div>
        ) : (
          /* ── Registration Form ── */
          <form onSubmit={handleRegister} className="space-y-5">

            {/* Error banner */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text" name="name" required
                  value={formData.name} onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Company / Workspace
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text" name="companyName" required
                  value={formData.companyName} onChange={handleChange}
                  placeholder="Acme Corp"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email" name="email" required
                  value={formData.email} onChange={handleChange}
                  placeholder="john@company.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel" name="phone"
                  value={formData.phone} onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password" name="password" required minLength="6"
                  value={formData.password} onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
              </div>
            </div>

            {/* Plan Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Choose Your Plan
              </label>

              <div className="grid grid-cols-3 gap-3">
                {PLANS.map((plan) => {
                  const Icon     = plan.icon;
                  const isActive = selectedPlan === plan.key;
                  return (
                    <button
                      key={plan.key}
                      type="button"
                      onClick={() => setSelectedPlan(plan.key)}
                      className={clsx(
                        'relative flex flex-col items-center p-3 rounded-2xl border-2 transition-all text-center cursor-pointer hover:shadow-md',
                        isActive ? plan.activeColor : plan.color,
                      )}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                          POPULAR
                        </span>
                      )}
                      {isActive && (
                        <div className="absolute top-2 right-2 w-4 h-4 bg-[#283086] rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      <Icon className={clsx('w-6 h-6 mb-1.5', isActive ? plan.iconColor : 'text-slate-400')} />
                      <p className={clsx('text-xs font-bold', isActive ? 'text-slate-900' : 'text-slate-500')}>
                        {plan.name}
                      </p>
                      <p className={clsx('text-[10px] mt-0.5 leading-tight', isActive ? plan.priceColor : 'text-slate-400')}>
                        {plan.price === 0 ? 'Free · 7 days' : `₹${plan.price.toLocaleString('en-IN')}/mo`}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Feature preview for selected plan */}
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  {PLANS.find(p => p.key === selectedPlan)?.name} includes
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {PLANS.find(p => p.key === selectedPlan)?.features.map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                  {PLANS.find(p => p.key === selectedPlan)?.locked.map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <X className="w-3 h-3 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#283086] text-white py-3.5 rounded-xl font-bold hover:bg-[#1e2567] transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : selectedPlan === 'Basic' ? (
                <>Start Free Trial <ArrowRight className="w-5 h-5" /></>
              ) : (
                <>Create & Pay ₹{PLANS.find(p => p.key === selectedPlan)?.price.toLocaleString('en-IN')} <ArrowRight className="w-5 h-5" /></>
              )}
            </button>

            {selectedPlan !== 'Basic' && (
              <p className="text-center text-xs text-slate-400 -mt-2">
                Secure payment via Razorpay · Cancel anytime
              </p>
            )}
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Sign in here
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}