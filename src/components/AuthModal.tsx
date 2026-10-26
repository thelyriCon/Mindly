import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User as UserIcon, AtSign, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';
import { MindlyLogo } from './MindlyLogo';
import { NokiaLoader } from './NokiaLoader';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin',
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'setup_profile'>('signin');
  const [realName, setRealName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Username validation state
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setInfoMessage(null);
    }
  }, [isOpen, initialMode]);

  // Debounced live username availability check
  useEffect(() => {
    const clean = username.trim().replace(/^@+/, '');
    if (!clean || clean.length < 3) {
      setUsernameAvailable(null);
      setUsernameError(clean.length > 0 ? 'Minimum 3 characters' : null);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameAvailable(false);
      setUsernameError('Letters, numbers, and underscores only');
      return;
    }

    setUsernameError(null);
    setCheckingUsername(true);

    const timer = setTimeout(async () => {
      try {
        const res = await api.checkUsername(clean);
        setUsernameAvailable(res.available);
        if (!res.available) {
          setUsernameError(res.error || 'Username is already taken');
        }
      } catch {
        setUsernameAvailable(true);
      } finally {
        setCheckingUsername(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { user } = await api.login(email, password);
        onSuccess(user);
        onClose();
      } else if (mode === 'signup') {
        if (!realName.trim()) {
          setError('Please provide your real full name for certificates.');
          setLoading(false);
          return;
        }
        if (!username.trim() || usernameAvailable === false) {
          setError('Please select an available username.');
          setLoading(false);
          return;
        }
        const cleanUser = username.trim().replace(/^@+/, '');
        const { user } = await api.register(realName.trim(), cleanUser, email.trim(), password);
        onSuccess(user);
        onClose();
      } else if (mode === 'setup_profile') {
        const cleanUser = username.trim().replace(/^@+/, '');
        const { user } = await api.setupProfile(realName.trim(), cleanUser);
        onSuccess(user);
        onClose();
      } else if (mode === 'reset') {
        const res = await api.resetPassword(email.trim());
        setInfoMessage(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.googleLogin();
      if (res.isNewUser) {
        setMode('setup_profile');
        setRealName(res.suggestedName || '');
        setEmail(res.email || '');
      } else if (res.user) {
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-7 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#9bb1d6] hover:text-white rounded-lg hover:bg-[#0f2756] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center shrink-0">
            <MindlyLogo size={24} color="#00B4FF" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {mode === 'signin' && 'Sign in to Mindly'}
              {mode === 'signup' && 'Create Your Mindly Account'}
              {mode === 'setup_profile' && 'Complete Learner Profile'}
              {mode === 'reset' && 'Reset Password'}
            </h2>
            <p className="text-xs text-[#9bb1d6]">
              {mode === 'signin' && 'Access your courses, notes, and study progress'}
              {mode === 'signup' && 'Real knowledge, clean notes, and verifiable certificates'}
              {mode === 'setup_profile' && 'Set your real name for certificates and your unique @handle'}
              {mode === 'reset' && 'Enter your email to receive recovery instructions'}
            </p>
          </div>
        </div>

        {/* Tab Switcher for Sign In vs Sign Up */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#081734] border border-[#1a366f] mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                mode === 'signin' ? 'bg-[#00B4FF] text-[#0B1F44] font-bold' : 'text-[#9bb1d6] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                mode === 'signup' ? 'bg-[#00B4FF] text-[#0B1F44] font-bold' : 'text-[#9bb1d6] hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Social Authentication */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="space-y-2 mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white text-zinc-900 font-medium text-xs hover:bg-zinc-100 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#1a366f]" />
              </div>
              <span className="relative px-2 bg-[#0B1F44] text-[11px] text-[#627ca8]">
                or continue with email
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-200 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{infoMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Real Name Input (Registration & Setup Profile) */}
          {(mode === 'signup' || mode === 'setup_profile') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-white">Real Name</label>
                <span className="text-[10px] text-[#00B4FF]">Strictly for Certificates</span>
              </div>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#627ca8] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Jimmy Wangota"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF] transition-colors"
                />
              </div>
              <p className="text-[10px] text-[#9bb1d6] mt-1">
                Official certificates will permanently be issued in this name.
              </p>
            </div>
          )}

          {/* Username Input with Live Availability Check */}
          {(mode === 'signup' || mode === 'setup_profile') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-white">Choose Username</label>
                {checkingUsername ? (
                  <span className="text-[10px] text-[#00B4FF]">Checking...</span>
                ) : usernameAvailable === true ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Available
                  </span>
                ) : usernameAvailable === false ? (
                  <span className="text-[10px] text-red-400 font-semibold">{usernameError}</span>
                ) : null}
              </div>
              <div className="relative">
                <AtSign className="w-4 h-4 text-[#627ca8] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. iCon"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#081734] border text-white placeholder-[#627ca8] focus:outline-none transition-colors ${
                    usernameAvailable === true
                      ? 'border-emerald-500/60 focus:border-emerald-500'
                      : usernameAvailable === false
                      ? 'border-red-500/60 focus:border-red-500'
                      : 'border-[#1a366f] focus:border-[#00B4FF]'
                  }`}
                />
              </div>
              <p className="text-[10px] text-[#9bb1d6] mt-1">
                Your unique handle in discussions, study rooms, and community circles.
              </p>
            </div>
          )}

          {/* Email Address */}
          {mode !== 'setup_profile' && (
            <div>
              <label className="block text-xs font-semibold text-white mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#627ca8] absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="learner@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Password */}
          {mode !== 'reset' && mode !== 'setup_profile' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-white">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError(null);
                    }}
                    className="text-[11px] text-[#00B4FF] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#627ca8] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] font-bold text-xs transition-colors shadow-md shadow-[#00B4FF]/20 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <NokiaLoader label="Authenticating..." color="#0B1F44" dotSize="w-1.5 h-1.5" />
            ) : (
              <>
                <span>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account & Start Learning'}
                  {mode === 'setup_profile' && 'Complete Profile'}
                  {mode === 'reset' && 'Send Reset Instructions'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Back Link if in Reset Mode */}
        {mode === 'reset' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className="text-xs text-[#00B4FF] hover:underline cursor-pointer font-medium"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
