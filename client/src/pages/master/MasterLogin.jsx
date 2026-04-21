import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, CheckCircle2, Loader2, Database } from 'lucide-react';
import { useAuth } from '@/context/AuthContext'; // Adjust path if needed

export default function MasterLogin() {
  const navigate = useNavigate();
  
  // Bring in login and logout from your Auth Context
  const { login, logout } = useAuth(); 

  // State Management
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // API Base URL
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // ─────────────────────────────────────────────────────────────────────────
  // getFriendlyError (from your main Login)
  // ─────────────────────────────────────────────────────────────────────────
  const getFriendlyError = (err) => {
    const code = (err.code || err.message || '').toUpperCase();

    if (
      code.includes('INVALID_LOGIN_CREDENTIALS') ||
      code.includes('INVALID_PASSWORD')          ||
      code.includes('EMAIL_NOT_FOUND')           ||
      code.includes('INVALID_EMAIL')             ||
      code.includes('WRONG_PASSWORD')
    ) return 'Invalid Master ID or Passcode.';

    if (code.includes('TOO_MANY_ATTEMPTS')) return 'Too many failed attempts. Try again later.';
    if (code.includes('USER_DISABLED')) return 'Master account disabled.';
    if (code.includes('NETWORK')) return 'Network error. Please check your connection.';

    return err.message || 'Something went wrong. Please try again.';
  };

  // ============================================================
  // 1. LOGIN LOGIC
  // ============================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim();

    try {
      // 1. Use the globally initialized AuthContext to log in
      const user = await login(cleanEmail, password);

      // 2. STRICT ROLE CHECK: Only allow 'master' role
      if (user?.role !== 'master') {
        if (logout) await logout(); // Force sign out if they aren't a master
        throw new Error('Access Denied. You do not have Master Admin privileges.');
      }

      // 3. Success!
      setSuccess('Authentication successful. Entering master panel...');
      
      setTimeout(() => {
        navigate('/master-panel');
      }, 1000);

    } catch (err) {
      console.error('Master Login Error:', err);
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // 2. MASTER SEEDING LOGIC
  // ============================================================
  const handleSeedMaster = async () => {
    if (!email || !password) {
      setError('Please enter an email and password to use for seeding the Master account.');
      return;
    }
    
    if (!window.confirm(`Initialize the database with Master Admin: ${email}? This can only be done once.`)) return;

    setSeedLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/master/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(), 
          password, 
          name: 'Super Admin'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to seed master account. It may already exist.');
      }

      setSuccess('Master account created successfully! You can now log in.');
      setPassword(''); 
    } catch (err) {
      setError(err.message);
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-body">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
        
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-blue-600/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="bg-blue-600/20 p-4 rounded-full mb-4 ring-1 ring-blue-500/30">
            <Shield className="h-10 w-10 text-blue-500" />
          </div>
          <h2 className="text-3xl font-bold text-white text-center tracking-tight">Master Access</h2>
          <p className="text-slate-400 mt-2 text-sm font-medium">Restricted system administration area</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-400 font-medium">{success}</p>
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Master Email (ID)</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-600" 
              placeholder="admin@master.com" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Passcode</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-600" 
              placeholder="••••••••" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || seedLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authenticate & Enter'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-700/50 text-center relative z-10">
          <p className="text-xs text-slate-500 mb-3">First time deployment?</p>
          <button 
            type="button"
            onClick={handleSeedMaster}
            disabled={loading || seedLoading}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-blue-400 transition-colors bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700 hover:border-blue-500/50"
          >
            {seedLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Initialize System Database
          </button>
        </div>

      </div>
    </div>
  );
}