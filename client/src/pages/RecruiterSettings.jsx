import React, { useState, useCallback } from 'react';
import {
  Lock, Loader2,
  Mail, CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const TBtn = ({ children, onClick, disabled, className = '', variant = 'primary', type = 'button' }) => {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center font-medium rounded-lg px-4 py-2 text-sm
        transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none
        ${styles[variant] || styles.primary} ${className}`}>
      {children}
    </button>
  );
};

const STEPS = { REQUEST: 'request', SENT: 'sent' };

export default function RecruiterSettings() {
  const { toast }       = useToast();
  const { authHeaders } = useAuth();

  const buildHeaders = useCallback(async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  const getUserEmail = () => {
    try {
      const session = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      return session.email || '';
    } catch { return ''; }
  };

  const [step, setStep] = useState(STEPS.REQUEST);
  const [sending, setSending] = useState(false);

  // ── Send Reset Link ──────────────────────────────────────────────────────
  const handleSendLink = async () => {
    const email = getUserEmail();
    if (!email) {
      toast({ title: 'Error', description: 'Session not found. Please log in again.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const headers = await buildHeaders();
      // Keep your endpoint, but handle it as sending a link
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST', headers, body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Failed to send reset link.');

      toast({
        title: 'Email Sent!',
        description: `A reset link has been sent to ${email}.`,
      });
      
      setStep(STEPS.SENT);
    } catch (err) {
      toast({ title: 'Send Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const resetFlow = () => {
    setStep(STEPS.REQUEST);
  };

  const stepIdx  = [STEPS.REQUEST, STEPS.SENT].indexOf(step);
  const stepMeta = ['Request Link', 'Link Sent'];

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your security preferences</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-md overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Request a secure password reset link to be sent to your registered email address.
            </p>
          </div>

          {/* Step indicator */}
          <div className="px-6 pt-5 flex items-center gap-2">
            {stepMeta.map((label, i) => {
              const done   = i < stepIdx || step === STEPS.SENT;
              const active = i === stepIdx;
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done   ? 'bg-green-500 text-white'
                             : active ? 'bg-blue-600 text-white'
                             : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                    }`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${active || done ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                  {i < 1 && <div className={`flex-1 h-px ${done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-600'}`} />}
                </React.Fragment>
              );
            })}
          </div>

          <div className="px-6 py-6">

            {/* STEP 1 — Request Link */}
            {step === STEPS.REQUEST && (
              <div className="space-y-5">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Verification Required</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
                      A password reset link will be sent to <strong>{getUserEmail() || 'your email'}</strong>.
                      Click the link in the email to securely update your password.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <TBtn onClick={handleSendLink} disabled={sending} className="min-w-[160px]">
                    {sending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                      : <><Mail className="mr-2 h-4 w-4" />Send Reset Link</>}
                  </TBtn>
                </div>
              </div>
            )}

            {/* STEP 2 — Link Sent UI */}
            {step === STEPS.SENT && (
              <div className="py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                  <Mail className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Check Your Inbox!</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto leading-relaxed">
                    A reset link has been successfully sent to <strong className="text-gray-800 dark:text-gray-200">{getUserEmail()}</strong>. 
                    Please check your email and click the link to reset your password.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 w-full flex justify-center">
                  <TBtn variant="outline" onClick={resetFlow}>Back to Request</TBtn>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}