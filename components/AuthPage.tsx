import React, { useState } from 'react';
import { Loader2, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error } = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-2 h-6 bg-black rounded-full block"></span>
            <h1 className="text-2xl font-bold tracking-tight">NCS Scanner</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
              />
            </div>

            {/* Confirm Password (Sign Up only) */}
            {isSignUp && (
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all"
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-600 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white font-semibold py-4 rounded-2xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Toggle Sign In/Sign Up */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
