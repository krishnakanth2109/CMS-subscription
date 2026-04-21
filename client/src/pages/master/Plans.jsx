// src/pages/master/Plans.jsx
import React from 'react';

export default function Plans() {
  const plans = [
    { name: 'Basic', price: '$29/mo', features: ['Up to 5 Users', 'Basic Support', 'Standard Analytics'] },
    { name: 'Pro', price: '$99/mo', features: ['Up to 25 Users', 'Priority Support', 'Advanced Analytics'] },
    { name: 'Enterprise', price: '$299/mo', features: ['Unlimited Users', '24/7 Dedicated Support', 'Custom Integration'] },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Subscription Plans</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, idx) => (
          <div key={idx} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
            <p className="text-4xl font-extrabold text-blue-600 mt-4 mb-6">{plan.price}</p>
            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center text-slate-600">
                  <span className="text-emerald-500 mr-2">✔</span> {feature}
                </li>
              ))}
            </ul>
            <button className="w-full py-2 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
              Edit Plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}