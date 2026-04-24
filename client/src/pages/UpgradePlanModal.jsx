import React, { useState } from 'react';
import { X, Check, Zap, Crown, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { auth } from './firebase'; // ✅ Pre-initialized singleton — no getAuth() needed

const PLANS = [
  {
    key: 'Basic',
    name: 'Free Trial',
    icon: Sparkles,
    price: { monthly: 0, yearly: 0 },
    duration: '7 days',
    color: 'from-slate-500 to-slate-600',
    borderColor: 'border-slate-200',
    badgeColor: 'bg-slate-100 text-slate-600',
    features: [
      'Dashboard',
      'Candidate Management',
      'Recruiter Management',
      'Requirements',
      'Schedules',
      'Settings',
    ],
    locked: ['Client Info', 'Invoices', 'Messages', 'Agreements', 'Mock Interviews', 'Reports'],
  },
  {
    key: 'Pro',
    name: 'Flexi Plan',
    icon: Zap,
    price: { monthly: 1999, yearly: 19999 },
    duration: '30 days',
    color: 'from-blue-500 to-indigo-600',
    borderColor: 'border-blue-400',
    badgeColor: 'bg-blue-100 text-blue-700',
    popular: true,
    features: [
      'Dashboard',
      'Candidate Management',
      'Recruiter Management',
      'Client Info',
      'Requirements',
      'Schedules',
      'Reports',
      'Settings',
    ],
    locked: ['Invoices', 'Messages', 'Agreements', 'Mock Interviews'],
  },
  {
    key: 'Enterprise',
    name: 'Premium',
    icon: Crown,
    price: { monthly: 4999, yearly: 49999 },
    duration: '30 days',
    color: 'from-amber-500 to-orange-600',
    borderColor: 'border-amber-400',
    badgeColor: 'bg-amber-100 text-amber-700',
    features: [
      'Everything in Flexi, plus:',
      'Invoices',
      'Messages',
      'Agreements',
      'Mock Interviews',
      'Full Reports',
      'Priority Support',
    ],
    locked: [],
  },
];

// ─── Safe fetch ────────────────────────────────────────────────────────────────
async function safeFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    throw new Error(`Network error — is your backend running? (${networkErr.message})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    console.error(`[safeFetch] Non-JSON from ${url} [${res.status}]:`, text.slice(0, 300));
    throw new Error(
      `Server error (${res.status}): API at "${url}" did not return JSON. ` +
      `Verify VITE_API_URL is correct and the backend route exists.`
    );
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export default function UpgradePlanModal({ isOpen, onClose, currentPlan }) {
  const { refreshUser } = useAuth();
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(null);
  const [error, setError]     = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  if (!isOpen) return null;

  // ✅ Uses the imported singleton — no dynamic import, no getAuth(), no uninitialized app
  const getAuthToken = () => auth.currentUser?.getIdToken();

  const handleSelectPlan = async (plan) => {
    if (plan.key === 'Basic' || plan.key === currentPlan) return;

    setLoading(plan.key);
    setError('');

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Session expired. Please log in again.');

      // 1. Create Razorpay order
      const orderData = await safeFetch(`${API_URL}/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: plan.key, billing }),
      });

      // 2. Load Razorpay SDK if needed
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script   = document.createElement('script');
          script.src     = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload  = resolve;
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK.'));
          document.body.appendChild(script);
        });
      }

      // 3. Open Razorpay checkout
      const options = {
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        'VTS Tracker',
        description: `${plan.name} — ${billing === 'yearly' ? 'Annual' : 'Monthly'}`,
        order_id:    orderData.orderId,
        prefill: {
          name:    orderData.userName,
          email:   orderData.userEmail,
          contact: orderData.userPhone,
        },
        theme: { color: '#283086' },
        modal: {
          ondismiss: () => setLoading(null),
        },
        handler: async (response) => {
          // 4. Verify payment
          try {
            await safeFetch(`${API_URL}/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                plan: plan.key,
                billing,
              }),
            });

            // 5. Refresh user so sidebar/plan badge updates immediately
            if (refreshUser) await refreshUser();
            onClose();
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(null);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Upgrade Your Plan</h2>
            <p className="text-sm text-slate-500 mt-0.5">Choose the plan that fits your team</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8">
          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-slate-100 rounded-xl p-1 flex gap-1">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  billing === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  billing === 'yearly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Yearly
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  SAVE 16%
                </span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => {
              const Icon      = plan.icon;
              const isCurrent = plan.key === currentPlan;
              const isLoading = loading === plan.key;
              const price     = billing === 'yearly' ? plan.price.yearly : plan.price.monthly;

              return (
                <div
                  key={plan.key}
                  className={`relative flex flex-col rounded-2xl border-2 overflow-hidden transition-all ${
                    plan.popular
                      ? 'border-blue-400 shadow-lg shadow-blue-100'
                      : plan.borderColor
                  } ${isCurrent ? 'opacity-80' : ''}`}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-bold text-center py-1 tracking-wider">
                      MOST POPULAR
                    </div>
                  )}

                  <div className={`p-6 ${plan.popular ? 'mt-6' : ''}`}>
                    {/* Icon + Name */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-lg">{plan.name}</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${plan.badgeColor}`}>
                          {plan.key === 'Basic' ? '7-day trial' : billing === 'yearly' ? 'Annual' : 'Monthly'}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-5">
                      {price === 0 ? (
                        <p className="text-3xl font-extrabold text-slate-900">Free</p>
                      ) : (
                        <div className="flex items-end gap-1">
                          <span className="text-sm text-slate-500 mb-1">₹</span>
                          <span className="text-3xl font-extrabold text-slate-900">
                            {price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-slate-400 text-sm mb-1">
                            /{billing === 'yearly' ? 'yr' : 'mo'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                      {plan.locked.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-slate-400 line-through">
                          <X className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent || isLoading || plan.key === 'Basic'}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-400 cursor-default'
                          : plan.key === 'Basic'
                          ? 'bg-slate-100 text-slate-400 cursor-default'
                          : plan.popular
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5'
                          : `bg-gradient-to-r ${plan.color} text-white hover:shadow-lg hover:-translate-y-0.5`
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : isCurrent ? (
                        'Current Plan'
                      ) : plan.key === 'Basic' ? (
                        'Free Trial'
                      ) : (
                        `Upgrade to ${plan.name}`
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Payments are processed securely via Razorpay · All prices in INR · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}