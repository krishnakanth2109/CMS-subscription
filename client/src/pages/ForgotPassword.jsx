import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle2, Loader2 } from 'lucide-react';

// We need the Firebase API key to talk directly to Firebase
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // THE FIX: Tell Firebase directly to send the password reset email
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            requestType: 'PASSWORD_RESET', 
            email: email 
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to send reset email.');
      }

      // If successful, show the success screen
      setSent(true);
    } catch (err) {
      console.error(err);
      setError('Failed to send reset email. Please check the email and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-8 bg-white">
      <div className="w-full max-w-md space-y-8">

        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>

        {sent ? (
          /* Success State */
          <div className="text-center space-y-6 py-8">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-zinc-900">Check your email</h2>
              <p className="text-zinc-500">
                If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
              </p>
              <p className="text-sm text-zinc-400">
                Didn't receive it? Check your spam folder or{' '}
                <button
                  onClick={() => { setSent(false); setError(''); }}
                  className="text-blue-600 hover:underline font-medium"
                >
                  try again
                </button>.
              </p>
            </div>
          </div>
        ) : (
          /* Form State */
          <>
            <div className="text-center space-y-3">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <Mail className="h-7 w-7 text-blue-600" />
                </div>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                Forgot password?
              </h2>
              <p className="text-zinc-500">
                Enter your registered email and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full h-12 px-4 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            <p className="text-center text-sm text-zinc-500">
              Remember your password?{' '}
              <Link to="/login" className="text-blue-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}