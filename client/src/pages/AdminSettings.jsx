import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  User, Mail, Loader2,
  Hash, AlertCircle, Info, Crown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import UpgradePlanModal from '@/components/UpgradePlanModal';

// ── ENV ───────────────────────────────────────────────────────────────────────
// VITE_API_URL="http://localhost:5000"  (no trailing /api in .env)
// We always append /api here so every fetch hits the correct endpoint.
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;
export default function AdminSettings() {
  const { toast }       = useToast();
  const { authHeaders, userRole, currentUser } = useAuth();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const currentPlan = currentUser?.subscriptionPlan || 'Basic';
  const daysLeft = currentUser?.subscriptionDaysLeft ?? null;
  const isExpired = daysLeft !== null && daysLeft === 0;
  const showBanner = isExpired || (currentPlan === 'Basic' && daysLeft !== null && daysLeft <= 7);

  // Profile form
  const [formData, setFormData] = useState({ name: '', email: '', username: '' });

  // Candidate ID Prefix
  const [prefix,       setPrefix]       = useState('CAND');
  const [prefixInput,  setPrefixInput]  = useState('CAND');
  const [prefixSaving, setPrefixSaving] = useState(false);
  const [prefixError,  setPrefixError]  = useState('');

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
        const p = (data.candidatePrefix || 'CAND').toUpperCase();
        setPrefix(p);
        setPrefixInput(p);
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

  // ── Candidate Prefix save ─────────────────────────────────────────────────
  const handleSavePrefix = async () => {
    const cleaned = prefixInput.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
    if (cleaned.length !== 4) {
      setPrefixError('Prefix must be exactly 4 letters (A–Z). No numbers or symbols.');
      return;
    }
    setPrefixError('');
    setPrefixSaving(true);
    try {
      const headers = await buildHeaders();
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT', headers,
        body: JSON.stringify({ candidatePrefix: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update prefix');
      setPrefix(cleaned);
      setPrefixInput(cleaned);
      toast({ title: 'Prefix updated', description: `New candidates will use "${cleaned}-XXXXXXX" as their ID.` });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPrefixSaving(false);
    }
  };



  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

        <div>
          <h1 className="text-4xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-2">Manage your account and preferences</p>
        </div>

        {/* ── Profile Card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-600" />
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
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input id="email" type="email" value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={formData.username} disabled className="bg-gray-100 text-gray-500" />
              <p className="text-xs text-gray-400">Username cannot be changed.</p>
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




        {/* ── Candidate ID Prefix Card (managers / admins only) ── */}
        {(userRole === 'manager' || userRole === 'admin') && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-indigo-600" />
                <CardTitle>Candidate ID Prefix</CardTitle>
              </div>
              <CardDescription>
                Customise the 4-letter prefix used when auto-generating candidate IDs.
                Currently: <span className="font-mono font-semibold text-gray-900">{prefix}-001</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Changing the prefix only affects <strong>new</strong> candidates. Existing IDs
                  (e.g. <span className="font-mono">{prefix}-014</span>) are <strong>not</strong> renamed.
                </p>
              </div>

              {/* Input row */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="candidate-prefix">New Prefix (4 uppercase letters)</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="candidate-prefix"
                      value={prefixInput}
                      maxLength={4}
                      placeholder="e.g. ACME"
                      className={`pl-10 font-mono uppercase tracking-widest ${prefixError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      onChange={e => {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
                        setPrefixInput(val);
                        if (val.length === 4) setPrefixError('');
                      }}
                    />
                  </div>
                  {prefixError && (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />{prefixError}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Preview: <span className="font-mono font-semibold text-gray-900">{(prefixInput || '????').padEnd(4,'?').substring(0,4)}-001</span>
                  </p>
                </div>
                <Button
                  onClick={handleSavePrefix}
                  disabled={prefixSaving || prefixInput.length !== 4 || prefixInput === prefix}
                  className="min-w-[140px]"
                >
                  {prefixSaving
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    : 'Save Prefix'}
                </Button>
              </div>

            </CardContent>
          </Card>
        )}

        {/* ── Subscription Plan Card ── */}
        {(userRole === 'manager' || userRole === 'admin') && (
          <Card className="overflow-hidden border border-slate-200">
            <CardHeader className="bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <CardTitle>Subscription Plan</CardTitle>
              </div>
              <CardDescription>View and manage your organization's subscription plan</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Plan</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-slate-900">
                      {currentPlan === 'Basic' ? 'Free Trial' : currentPlan === 'Pro' ? 'Flexi Plan' : 'Premium Plan'}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      currentPlan === 'Enterprise'
                        ? 'bg-amber-100 text-amber-800'
                        : currentPlan === 'Pro'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {currentPlan}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {isExpired ? (
                      <span className="text-red-600 font-bold">Expired</span>
                    ) : daysLeft !== null ? (
                      `${daysLeft} days remaining`
                    ) : (
                      'Active'
                    )}
                  </p>
                </div>

                <Button 
                  onClick={() => setShowUpgradeModal(true)}
                  className="bg-[#283086] hover:bg-[#1a2060] font-bold shadow-lg shadow-indigo-600/10 min-w-[140px]"
                >
                  Upgrade Plan
                </Button>
              </div>

              {showBanner && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      {isExpired ? 'Subscription Expired' : 'Subscription Ending Soon'}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {isExpired 
                        ? 'Your access to premium features has expired. Upgrade your plan to restore full access.'
                        : `Your free trial is ending in ${daysLeft} days. Upgrade now to avoid service interruption.`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      <UpgradePlanModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={currentPlan}
      />
    </div>
  );
}