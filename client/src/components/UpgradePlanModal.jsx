import React, { useState } from 'react';
import { X, Check, Zap, Crown, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const PLANS = [
  {
    key: 'Basic',
    name: 'Free Trial',
    icon: Sparkles,
    price: { monthly: 0, yearly: 0 },
    duration: '7 days',
    color: 'from-slate-500 to-slate-600',
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
  const { refreshUser, getIdToken } = useAuth();
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(null);
  const [error, setError]     = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  if (!isOpen) return null;

  const handleSelectPlan = async (plan) => {
    if (plan.key === 'Basic' || plan.key === currentPlan) return;

    setLoading(plan.key);
    setError('');

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Session expired. Please log in again.');

      const orderData = await safeFetch(`${API_URL}/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: plan.key, billing }),
      });

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script   = document.createElement('script');
          script.src     = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload  = resolve;
          script.onerror = () => reject(new Error('Failed to load Razorpay SDK.'));
          document.body.appendChild(script);
        });
      }

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-50 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[98vh] flex flex-col relative animate-in zoom-in-95 duration-200 border border-slate-200/50 overflow-hidden">
        
        {/* Header - Compact */}
        <div className="z-30 shrink-0 flex items-center justify-between px-5 py-3 sm:px-8 sm:py-4 bg-white border-b border-slate-200/80">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-inner hidden sm:flex">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Upgrade Plan
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Unlock powerful tools for your recruitment team.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 flex-1 flex flex-col overflow-y-auto">
          {/* Billing Toggle - Compact */}
          <div className="flex justify-center mb-6">
            <div className="bg-slate-200/70 p-1 rounded-xl flex gap-1 border border-slate-300/50 shadow-inner">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${
                  billing === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 ${
                  billing === 'yearly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                }`}
              >
                Yearly
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${billing === 'yearly' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-300 text-slate-600'}`}>
                  Save 16%
                </span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-center gap-2 text-red-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cards Grid - Tighter Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 flex-1">
            {PLANS.map((plan) => {
              const Icon      = plan.icon;
              const isCurrent = plan.key === currentPlan;
              const isLoading = loading === plan.key;
              const price     = billing === 'yearly' ? plan.price.yearly : plan.price.monthly;
              const isPopular = plan.popular;
              const isPremium = plan.key === 'Enterprise';

              return (
                <div
                  key={plan.key}
                  className={`relative flex flex-col rounded-2xl border transition-all duration-200 ${
                    isPopular
                      ? 'border-blue-500 bg-white shadow-xl shadow-blue-500/10 md:-translate-y-2'
                      : isPremium
                      ? 'border-slate-800 bg-slate-900 shadow-lg'
                      : 'border-slate-200 bg-white shadow-md'
                  } ${isCurrent ? 'ring-2 ring-emerald-500 ring-offset-2 opacity-95' : 'hover:-translate-y-1'}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 inset-x-0 flex justify-center z-10">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md uppercase tracking-widest">
                        Most Popular
                      </div>
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute top-3 right-3 z-10">
                      <div className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider border border-emerald-200">
                        <Check className="w-2.5 h-2.5" /> Active
                      </div>
                    </div>
                  )}

                  <div className={`p-5 lg:p-6 ${isPopular ? 'pt-7' : ''} flex-1 flex flex-col`}>
                    {/* Card Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isPremium ? 'bg-slate-800 border border-slate-700' : `bg-gradient-to-br ${plan.color}`
                      }`}>
                        <Icon className={`w-5 h-5 ${isPremium ? 'text-amber-400' : 'text-white'}`} />
                      </div>
                      <div>
                        <p className={`text-lg font-black leading-tight ${isPremium ? 'text-white' : 'text-slate-900'}`}>{plan.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 inline-block ${
                          isPremium ? 'bg-slate-800 text-slate-300' : plan.badgeColor
                        }`}>
                          {plan.key === 'Basic' ? '7-day trial' : billing === 'yearly' ? 'Annual' : 'Monthly'}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-5 pb-5 border-b border-slate-200/50 border-dashed">
                      {price === 0 ? (
                        <p className={`text-3xl font-black ${isPremium ? 'text-white' : 'text-slate-900'}`}>Free</p>
                      ) : (
                        <div className="flex items-end gap-1">
                          <span className={`text-sm font-bold mb-1 ${isPremium ? 'text-slate-400' : 'text-slate-500'}`}>₹</span>
                          <span className={`text-3xl font-black tracking-tight leading-none ${isPremium ? 'text-white' : 'text-slate-900'}`}>
                            {price.toLocaleString('en-IN')}
                          </span>
                          <span className={`text-xs font-semibold mb-0.5 ${isPremium ? 'text-slate-500' : 'text-slate-400'}`}>
                            /{billing === 'yearly' ? 'yr' : 'mo'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className={`flex items-start gap-2.5 text-xs font-semibold ${isPremium ? 'text-slate-300' : 'text-slate-700'}`}>
                          <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isPremium ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                            <Check className="w-2.5 h-2.5 stroke-[3px]" />
                          </div>
                          {f}
                        </li>
                      ))}
                      {plan.locked.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-xs font-medium text-slate-400 line-through">
                          <div className="mt-0.5 w-4 h-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                            <X className="w-2.5 h-2.5 stroke-[3px]" />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* Action Button */}
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent || isLoading || plan.key === 'Basic'}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-400 cursor-default'
                          : plan.key === 'Basic'
                          ? 'bg-slate-100 text-slate-400 cursor-default'
                          : isPremium
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-md shadow-amber-500/20 hover:scale-[1.02]'
                          : isPopular
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/30 hover:scale-[1.02]'
                          : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/20 hover:scale-[1.02]'
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
                        'Included'
                      ) : (
                        `Choose Plan`
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-[10px] font-bold text-slate-400 mt-6 uppercase tracking-widest">
            Secure payments via Razorpay • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}