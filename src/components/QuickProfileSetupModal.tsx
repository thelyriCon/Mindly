import React, { useState } from 'react';
import { User, Sparkles, Clock, ArrowRight, ShieldCheck, Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { persistenceEngine } from '../lib/persistence';
import { auth } from '../lib/firebase';

interface QuickProfileSetupModalProps {
  isOpen: boolean;
  onComplete: (user: any) => void;
  onClose?: () => void;
}

export const QuickProfileSetupModal: React.FC<QuickProfileSetupModalProps> = ({
  isOpen,
  onComplete,
  onClose,
}) => {
  const [realName, setRealName] = useState('');
  const [username, setUsername] = useState('');
  const [dailyGoal, setDailyGoal] = useState<number>(35);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    if (!auth.currentUser) {
      setErrorMsg('You must be signed in with Firebase to update your profile.');
      setIsSubmitting(false);
      return;
    }

    const finalName = realName.trim() || auth.currentUser.displayName || 'Mindly Learner';
    const finalUsername =
      username.trim().replace(/^@+/, '') ||
      `learner_${auth.currentUser.uid.slice(0, 5)}`;

    try {
      const res = await api.createOrUpdateProfile({
        realName: finalName,
        name: finalName,
        username: finalUsername,
        dailyStudyGoalMinutes: dailyGoal,
        interests: ['General Knowledge'],
      });

      if (res.user) {
        await persistenceEngine.saveUserProfile(res.user);
        onComplete(res.user);
      }
    } catch (err: any) {
      console.error('Quick setup error:', err);
      setErrorMsg(err?.message || 'Failed to update profile. Please ensure you are authenticated.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goalOptions = [
    { minutes: 15, label: '15 min/day', desc: 'Bite-sized microlearning' },
    { minutes: 35, label: '35 min/day', desc: 'Optimal retention (Recommended)' },
    { minutes: 60, label: '60 min/day', desc: 'Deep immersion study' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-md rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-200 relative">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-[#9bb1d6] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close setup modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF] mx-auto shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            10-Second Quick Setup
          </h2>
          <p className="text-xs text-[#9bb1d6] max-w-sm mx-auto">
            Set up your persistent learning profile. Your courses, streaks, and exact reading spots will stay saved across app restarts.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              autoFocus
              value={realName}
              onChange={(e) => {
                setRealName(e.target.value);
                if (!username) {
                  const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (slug) setUsername(slug);
                }
              }}
              placeholder="e.g. Alex Vance"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#081734] border border-[#1a366f] hover:border-[#00B4FF]/60 focus:border-[#00B4FF] text-white text-xs sm:text-sm font-medium transition-all focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs text-[#00B4FF] font-mono">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="alex_learns"
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-[#081734] border border-[#1a366f] hover:border-[#00B4FF]/60 focus:border-[#00B4FF] text-white text-xs sm:text-sm font-medium transition-all focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#00B4FF]" />
              <span>Daily Study Commitment</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {goalOptions.map((opt) => (
                <button
                  key={opt.minutes}
                  type="button"
                  onClick={() => setDailyGoal(opt.minutes)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    dailyGoal === opt.minutes
                      ? 'bg-[#00B4FF]/20 border-[#00B4FF] text-white'
                      : 'bg-[#081734] border-[#1a366f] text-[#9bb1d6] hover:border-[#627ca8]'
                  }`}
                >
                  <div className="text-xs font-bold">{opt.label}</div>
                  <div className="text-[10px] text-[#9bb1d6] mt-0.5 line-clamp-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-lg shadow-[#00B4FF]/25 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Initializing Workspace...' : 'Start Learning Journey'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              className="w-full py-2 text-center text-xs text-[#9bb1d6] hover:text-white transition-colors cursor-pointer"
            >
              Quick Start with Defaults
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#627ca8]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00B4FF]" />
          <span>Offline-first IndexedDB + Server Sync Active</span>
        </div>
      </div>
    </div>
  );
};
