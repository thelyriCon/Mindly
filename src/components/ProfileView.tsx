import React, { useState } from 'react';
import { User as UserIcon, BookOpen, CheckCircle2, FileText, Bookmark, Settings, Award, LogOut, Lock } from 'lucide-react';
import { User, Course, Note, KeyTermItem } from '../types';
import { api } from '../lib/api';

interface ProfileViewProps {
  user: User;
  courses: Course[];
  notes: Note[];
  terms: KeyTermItem[];
  onOpenAuth: () => void;
  onUserUpdated: (user: User) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  courses,
  notes,
  terms,
  onOpenAuth,
  onUserUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [groundingStrictness, setGroundingStrictness] = useState<'strict' | 'balanced'>('balanced');
  const [isSaving, setIsSaving] = useState(false);

  const completedLessonsCount = courses.reduce((acc, c) => {
    // estimated from progress
    const lessons = c.lessonCount || 0;
    const completed = Math.round(((c.progressPercent || 0) / 100) * lessons);
    return acc + completed;
  }, 0);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.updateProfile({ name, email });
      onUserUpdated(res.user);
      setIsEditing(false);
    } catch (err) {
      console.error('Update profile error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Learner Profile</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
          Your personal learning history, statistics, preferences, and account settings.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#131418] border border-[#23252e] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-xl font-bold text-indigo-300">
            {user.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{user.name}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                PRO LEARNER
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{user.email}</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            {isEditing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Switch / Sign In</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Form */}
      {isEditing && (
        <form
          onSubmit={handleSaveProfile}
          className="p-5 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4 animate-in fade-in duration-150"
        >
          <h3 className="text-sm font-semibold text-white">Edit Learner Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              {isSaving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Learning Statistics Bento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#131418] border border-[#23252e] space-y-1">
          <BookOpen className="w-4 h-4 text-indigo-400 mb-2" />
          <div className="text-2xl font-bold text-white">{courses.length}</div>
          <div className="text-xs text-zinc-400">Total Courses</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#131418] border border-[#23252e] space-y-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-2" />
          <div className="text-2xl font-bold text-white">{completedLessonsCount}</div>
          <div className="text-xs text-zinc-400">Lessons Mastered</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#131418] border border-[#23252e] space-y-1">
          <FileText className="w-4 h-4 text-amber-400 mb-2" />
          <div className="text-2xl font-bold text-white">{notes.length}</div>
          <div className="text-xs text-zinc-400">Personal Notes</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#131418] border border-[#23252e] space-y-1">
          <Bookmark className="w-4 h-4 text-purple-400 mb-2" />
          <div className="text-2xl font-bold text-white">{terms.length}</div>
          <div className="text-xs text-zinc-400">Key Terms</div>
        </div>
      </div>

      {/* Focus Interests / Subjects */}
      <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-3">
        <h3 className="text-sm font-semibold text-white">Active Focus Subjects</h3>
        <p className="text-xs text-zinc-400">Topics you are currently exploring and building courses in.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {user.interests && user.interests.length > 0 ? (
            user.interests.map((interest, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1b22] text-zinc-200 border border-[#2a2c38]"
              >
                {interest}
              </span>
            ))
          ) : (
            <span className="text-xs text-zinc-500">No subjects selected yet.</span>
          )}
        </div>
      </div>

      {/* AI Grounding & Tutoring Preferences */}
      <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">AI Grounding & Tutor Behavior</h3>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Configure how strictly Mindly's Gemini AI stays within your uploaded material versus offering supplementary conceptual analogies.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setGroundingStrictness('strict')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
              groundingStrictness === 'strict'
                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                : 'bg-[#0e0f12] border-[#22242c] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="text-xs font-semibold text-zinc-200 mb-1">
              Strict Material Grounding
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Explanations and tutor responses only use content directly stated in your uploads. Minimal external expansion.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setGroundingStrictness('balanced')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
              groundingStrictness === 'balanced'
                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                : 'bg-[#0e0f12] border-[#22242c] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="text-xs font-semibold text-zinc-200 mb-1">
              Balanced (Recommended)
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Prioritizes your uploaded material, but includes crystal-clear analogies and beginner-friendly clarifications.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};
