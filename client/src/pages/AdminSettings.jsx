import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock, User, Mail, Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

// ── ENV ───────────────────────────────────────────────────────────────────────
// VITE_API_URL="http://localhost:5000"  (no trailing /api in .env)
// We always append /api here so every fetch hits the correct endpoint.
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const STEPS = { REQUEST: 'request', SENT: 'sent' };

export default function AdminSettings() {
  const { toast }      = useToast();
  const { authHeaders } = useAuth();   // ← async token getter from AuthContext

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  // Profile form
  const [formData, setFormData] = useState({ name: '', email: '', username: '' });

  // Password Link flow
  const [step,      setStep]      = useState(STEPS.REQUEST);
  const [sending,   setSending]   = useState(false);

  // ── Auth header builder ───────────────────────────────────────────────────
  // Uses AuthContext.authHeaders() which auto-refreshes the Firebase token
  // if it's within 5 minutes of expiry, and respects the 9-hour session cap.
  // MUST be awaited: const headers = await buildHeaders();
  const buildHeaders = useCallback(async () => {
    const ah = await authHeaders();    // { Authorization: 'Bearer <fresh-token>' }
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  // ── Read email from session ───────────────────────────────────────────────
  const getUserEmail = useCallback(() => {
    try {
      const session = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      return session.email || formData.email || '';
    } catch { return formData.email || ''; }
  }, [formData.email]);

  // ── Fetch profile on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const headers = await buildHeaders();
        const res     = await fetch(`${API_URL}/auth/profile`, { headers });
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        setFormData({ name: data.name || '', email: data.email || '', username: data.username || '' });
      } catch (err) {
        toast({ title: 'Error', description: 'Could not load user profile.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);    // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile save ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const headers = await buildHeaders();
      const res     = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT', headers,
        body: JSON.stringify({ name: formData.name, email: formData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      // Sync sessionStorage so getUserEmail() stays accurate
      try {
        const session = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        sessionStorage.setItem('currentUser', JSON.stringify({ ...session, name: data.name, email: data.email }));
      } catch {}

      toast({ title: 'Profile saved', description: 'Your profile has been updated.' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

        <div>
          <h1 className="text-4xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
        </div>

        {/* ── Profile Card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={formData.username} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Username cannot be changed.</p>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Password Reset Card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <CardDescription>Request a secure password reset link to be sent to your registered email address.</CardDescription>
          </CardHeader>
          <CardContent>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {stepMeta.map((label, i) => {
                const done   = i < stepIdx || step === STEPS.SENT;
                const active = i === stepIdx;
                return (
                  <React.Fragment key={label}>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        done   ? 'bg-green-500 text-white'
                               : active ? 'bg-primary text-primary-foreground'
                               : 'bg-muted text-muted-foreground'
                      }`}>
                        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                    </div>
                    {i < 1 && <div className={`flex-1 h-px ${done ? 'bg-green-400' : 'bg-border'}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* STEP 1 — Request Link */}
            {step === STEPS.REQUEST && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Identity Verification Required</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
                      A password reset link will be sent to <strong>{getUserEmail()}</strong>. Click the link in the email to securely update your password.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSendLink} disabled={sending} className="min-w-[160px]">
                    {sending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                      : <><Mail className="mr-2 h-4 w-4" />Send Reset Link</>}
                  </Button>
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
                  <h3 className="text-xl font-semibold text-foreground">Check Your Inbox!</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                    A reset link has been successfully sent to <strong className="text-foreground">{getUserEmail()}</strong>.
                    Please check your email and click the link to reset your password.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border w-full flex justify-center">
                  <Button variant="outline" onClick={resetFlow}>Back to Request</Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  );
}