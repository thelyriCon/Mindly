import React, { useState, useRef } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Bookmark,
  Settings,
  Lock,
  Download,
  Upload,
  Camera,
  Trash2,
  ShieldCheck,
  Check,
  LogOut,
  Sparkles,
  Award,
  Users,
  Eye,
  Globe,
  AtSign,
  Database,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { User, Course, Note, KeyTermItem, PrivacySettings } from '../types';
import { api } from '../lib/api';
import { persistenceEngine } from '../lib/persistence';
import { NokiaLoader } from './NokiaLoader';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeToggle } from './ThemeToggle';

interface ProfileViewProps {
  user: User;
  courses: Course[];
  notes: Note[];
  terms: KeyTermItem[];
  onOpenAuth: () => void;
  onUserUpdated: (user: User) => void;
  onNavigateToCertificates?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  courses,
  notes,
  terms,
  onOpenAuth,
  onUserUpdated,
  onNavigateToCertificates,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [realName, setRealName] = useState(user.realName || user.name || '');
  const [username, setUsername] = useState(user.username || '');
  const [email, setEmail] = useState(user.email || '');
  const [bio, setBio] = useState(user.bio || '');
  const [profileInterests, setProfileInterests] = useState<string[]>(
    user.interests && user.interests.length > 0
      ? user.interests
      : ['Technology', 'Space', 'Aerodynamics', 'Psychology']
  );
  const [newInterestInput, setNewInterestInput] = useState('');

  // Privacy Settings state
  const [privacy, setPrivacy] = useState<PrivacySettings>(
    user.privacySettings || {
      profileVisibility: 'members',
      showCompletedCourses: true,
      showCertificates: true,
      showStudyActivity: false,
    }
  );

  const [groundingStrictness, setGroundingStrictness] = useState<'strict' | 'balanced'>(
    user.settings?.aiStrictness === 'strict' || user.settings?.aiStrictness === 'strict_material_only'
      ? 'strict'
      : 'balanced'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const completedLessonsCount = courses.reduce((acc, c) => {
    const lessons = c.lessonCount || 0;
    const completed = Math.round(((c.progressPercent || 0) / 100) * lessons);
    return acc + completed;
  }, 0);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const cleanUser = username.trim().replace(/^@+/, '');
      const res = await api.updateProfile({
        name: realName.trim(),
        realName: realName.trim(),
        username: cleanUser,
        email: email.trim(),
        interests: profileInterests,
      });
      await api.updateCommunityProfile({
        bio: bio.trim(),
        privacySettings: privacy,
      });
      onUserUpdated(res.user);
      setIsEditing(false);
      showFeedback('Profile updated successfully.');
    } catch (err: any) {
      console.error('Update profile error:', err);
      showFeedback(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGroundingChange = async (strictness: 'strict' | 'balanced') => {
    setGroundingStrictness(strictness);
    try {
      const updatedSettings = {
        ...(user.settings || { theme: 'dark' as const, fontSize: 'normal' as const, dailyStudyGoalMinutes: 30 }),
        aiStrictness: strictness,
      };
      const res = await api.updateProfile({ settings: updatedSettings });
      onUserUpdated(res.user);
      showFeedback(
        strictness === 'strict'
          ? 'AI Tutor set to Strict Material Grounding mode.'
          : 'AI Tutor set to Balanced mode with helpful analogies.'
      );
    } catch (err) {
      console.error('Failed to persist grounding setting:', err);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const res = await api.uploadAvatar(file, file.name);
      if (res.user) {
        onUserUpdated(res.user);
      } else {
        onUserUpdated({ ...user, profileImage: res.profileImage });
      }
      showFeedback('Profile photo updated.');
    } catch (err: any) {
      console.error('Avatar upload failed:', err);
      showFeedback(err.message || 'Failed to update profile photo.');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await api.removeAvatar();
      onUserUpdated({ ...user, profileImage: '' });
      showFeedback('Profile photo removed.');
    } catch (err) {
      console.error('Failed to remove avatar:', err);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const dump = await persistenceEngine.exportAllData();
      const dateStr = new Date().toISOString().split('T')[0];
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindly-progress-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback('Full Knowledge & Progress Backup exported.');
    } catch (err) {
      console.error('Export failed:', err);
      showFeedback('Failed to generate backup export.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text);
        const res = await api.importUserData(parsed);
        if (parsed.userProfile) {
          onUserUpdated(parsed.userProfile);
        }
        showFeedback(`Successfully imported knowledge data!`);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err: any) {
        console.error('Import error:', err);
        showFeedback(err?.message || 'Invalid JSON backup file format.');
      } finally {
        setIsImporting(false);
        if (importFileInputRef.current) {
          importFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetLocalCache = async () => {
    try {
      await persistenceEngine.clearAllLocalData();
      setShowResetModal(false);
      showFeedback('Local cache cleared. Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      console.error('Failed to reset cache:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      window.location.reload();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {feedbackMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#00B4FF] text-[#0B1F44] text-xs font-bold shadow-xl animate-in slide-in-from-top-3">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Header Profile Identity Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#0B1F44] border border-[#1a366f] flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-md">
        <div className="flex items-center gap-4">
          {/* Avatar with Upload Capability */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#081734] border-2 border-[#00B4FF]/40 flex items-center justify-center text-xl font-bold text-[#00B4FF] shadow-inner">
              {user.profileImage ? (
                <img
                  src={user.profileImage}
                  alt={user.realName || user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {(user.realName || user.name || 'ML').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-semibold transition-opacity cursor-pointer"
            >
              <Camera className="w-4 h-4 mb-0.5 text-[#00B4FF]" />
              <span>Change</span>
            </button>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarFile}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {user.realName || user.name}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/30 font-bold">
                {user.username ? `@${user.username}` : '@learner'}
              </span>
            </div>
            <p className="text-xs text-[#9bb1d6] mt-0.5">{user.email}</p>
            {user.bio && (
              <p className="text-xs text-[#9bb1d6] mt-1.5 line-clamp-2 max-w-md">
                {user.bio}
              </p>
            )}
            {user.interests && user.interests.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] font-mono text-[#9bb1d6]">Focus Areas:</span>
                {user.interests.map((int: string) => (
                  <span
                    key={int}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/30"
                  >
                    {int}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2">
              <p className="text-[11px] text-[#627ca8]">
                Member since {new Date(user.createdAt).toLocaleDateString()}
              </p>
              {user.profileImage && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-[11px] text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 rounded-xl bg-[#081734] hover:bg-[#0f2756] border border-[#1a366f] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {isEditing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Switch / Sign In</span>
          </button>
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-[#081734] hover:bg-red-950/40 border border-[#1a366f] text-[#627ca8] hover:text-red-400 transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit Profile Form */}
      {isEditing && (
        <form
          onSubmit={handleSaveProfile}
          className="p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-4 animate-in fade-in duration-150 text-white"
        >
          <h3 className="text-sm font-bold text-white">Edit Learner Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-white">Real Name</label>
                <span className="text-[10px] text-[#00B4FF]">Strictly for Certificates</span>
              </div>
              <input
                type="text"
                required
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-white">Username Handle</label>
                <span className="text-[10px] text-[#9bb1d6]">Community & Discussions</span>
              </div>
              <div className="relative">
                <AtSign className="w-4 h-4 text-[#627ca8] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">Learner Bio</label>
              <input
                type="text"
                placeholder="What are your areas of research or study goals?"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF]"
              />
            </div>
          </div>

          {/* Intellectual Interests & Focus Areas Editor */}
          <div className="pt-3 border-t border-[#1a366f]/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-white">
                Intellectual Interests & Curated Topics ({profileInterests.length})
              </label>
              <span className="text-[10px] text-[#9bb1d6]">Drives your Home Discovery Feed</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {profileInterests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 text-xs font-semibold"
                >
                  <span>{interest}</span>
                  <button
                    type="button"
                    onClick={() => setProfileInterests(profileInterests.filter((i) => i !== interest))}
                    className="hover:text-red-400 cursor-pointer ml-0.5 text-sm leading-none"
                    aria-label={`Remove ${interest}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add another topic (e.g. Astrophysics, Fluid Dynamics)..."
                value={newInterestInput}
                onChange={(e) => setNewInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = newInterestInput.trim();
                    if (val && !profileInterests.some((i) => i.toLowerCase() === val.toLowerCase())) {
                      setProfileInterests([...profileInterests, val]);
                      setNewInterestInput('');
                    }
                  }
                }}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
              />
              <button
                type="button"
                onClick={() => {
                  const val = newInterestInput.trim();
                  if (val && !profileInterests.some((i) => i.toLowerCase() === val.toLowerCase())) {
                    setProfileInterests([...profileInterests, val]);
                    setNewInterestInput('');
                  }
                }}
                disabled={!newInterestInput.trim()}
                className="px-4 py-2 rounded-xl bg-[#081734] border border-[#00B4FF] text-[#00B4FF] hover:bg-[#00B4FF] hover:text-[#0B1F44] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {/* Privacy Settings in Edit Form */}
          <div className="pt-3 border-t border-[#1a366f]/60 space-y-2">
            <h4 className="text-xs font-bold text-[#00B4FF] uppercase tracking-wider">
              Community Privacy Controls
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-[#9bb1d6]">
                <input
                  type="checkbox"
                  checked={privacy.showCompletedCourses}
                  onChange={(e) =>
                    setPrivacy({ ...privacy, showCompletedCourses: e.target.checked })
                  }
                  className="rounded border-[#1a366f] text-[#00B4FF] focus:ring-0"
                />
                <span>Show completed courses on public profile</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[#9bb1d6]">
                <input
                  type="checkbox"
                  checked={privacy.showCertificates}
                  onChange={(e) =>
                    setPrivacy({ ...privacy, showCertificates: e.target.checked })
                  }
                  className="rounded border-[#1a366f] text-[#00B4FF] focus:ring-0"
                />
                <span>Show certificates on public profile</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#1a366f]">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-xl bg-[#081734] text-[#9bb1d6] text-xs hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold shadow-md shadow-[#00B4FF]/20 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Learning Statistics Bento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-1">
          <BookOpen className="w-4 h-4 text-[#00B4FF] mb-2" />
          <div className="text-2xl font-extrabold text-white">{courses.length}</div>
          <div className="text-xs text-[#9bb1d6]">Total Courses</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-2" />
          <div className="text-2xl font-extrabold text-white">{completedLessonsCount}</div>
          <div className="text-xs text-[#9bb1d6]">Lessons Mastered</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-1">
          <FileText className="w-4 h-4 text-[#00B4FF] mb-2" />
          <div className="text-2xl font-extrabold text-white">{notes.length}</div>
          <div className="text-xs text-[#9bb1d6]">Study Notes</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-1">
          <Bookmark className="w-4 h-4 text-[#00B4FF] mb-2" />
          <div className="text-2xl font-extrabold text-white">{terms.length}</div>
          <div className="text-xs text-[#9bb1d6]">Glossary Terms</div>
        </div>
      </div>

      {/* PWA Install Card */}
      <div className="p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white mb-1">Install Mindly on This Device</h3>
          <p className="text-xs text-[#9bb1d6]">
            Get standalone access, offline study support, and fast launches from your home screen or dock.
          </p>
        </div>
        <PWAInstallButton variant="header" />
      </div>

      {/* Global Theme & Accessibility Settings */}
      <div className="p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-4">
        <ThemeToggle variant="pill" />
      </div>

      {/* Pedagogical AI Grounding Controls */}
      <div className="p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#00B4FF]" />
          <h3 className="text-sm font-bold text-white">Pedagogical Grounding Strictness</h3>
        </div>
        <p className="text-xs text-[#9bb1d6] leading-relaxed">
          Configure how closely the AI Tutor and lesson generators anchor to your uploaded source materials versus incorporating outside analogies.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => handleGroundingChange('strict')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              groundingStrictness === 'strict'
                ? 'bg-[#00B4FF]/10 border-[#00B4FF] text-white shadow-sm'
                : 'bg-[#081734] border-[#1a366f] text-[#9bb1d6] hover:border-[#627ca8]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white">Strict Source Grounding</span>
              {groundingStrictness === 'strict' && (
                <Check className="w-4 h-4 text-[#00B4FF] stroke-[3]" />
              )}
            </div>
            <p className="text-[11px] text-[#9bb1d6] leading-relaxed">
              Tutor only answers using statements directly present in your source material. No external assumptions.
            </p>
          </div>

          <div
            onClick={() => handleGroundingChange('balanced')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              groundingStrictness === 'balanced'
                ? 'bg-[#00B4FF]/10 border-[#00B4FF] text-white shadow-sm'
                : 'bg-[#081734] border-[#1a366f] text-[#9bb1d6] hover:border-[#627ca8]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white">Balanced Pedagogical Tutor</span>
              {groundingStrictness === 'balanced' && (
                <Check className="w-4 h-4 text-[#00B4FF] stroke-[3]" />
              )}
            </div>
            <p className="text-[11px] text-[#9bb1d6] leading-relaxed">
              Answers anchor primarily in your material, but allows intuitive real-world metaphors to clarify dense points.
            </p>
          </div>
        </div>
      </div>

      {/* Data Sovereignty & Offline-First Persistence Controls (Tester Suite) */}
      <div className="p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[#00B4FF]" />
          <div>
            <h3 className="text-sm font-bold text-white">Data Sovereignty & Persistence Engine</h3>
            <p className="text-xs text-[#9bb1d6]">
              Offline-first IndexedDB storage + automated server sync. Export, restore, or wipe test data.
            </p>
          </div>
        </div>

        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Backup / Export Data (JSON) */}
          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#081734] hover:bg-[#00B4FF] border border-[#1a366f] hover:border-[#00B4FF] text-[#9bb1d6] hover:text-[#0B1F44] text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{isExporting ? 'Exporting...' : 'Backup / Export (JSON)'}</span>
          </button>

          {/* 2. Import Progress Data */}
          <div>
            <input
              type="file"
              ref={importFileInputRef}
              onChange={handleImportFile}
              accept=".json,application/json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importFileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#081734] hover:bg-[#00B4FF] border border-[#1a366f] hover:border-[#00B4FF] text-[#9bb1d6] hover:text-[#0B1F44] text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>{isImporting ? 'Importing Vault...' : 'Import Progress Data'}</span>
            </button>
          </div>

          {/* 3. Reset Local Cache */}
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#081734] hover:bg-rose-600/20 border border-[#1a366f] hover:border-rose-500/60 text-[#9bb1d6] hover:text-rose-300 text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0 text-rose-400" />
            <span>Reset Local Cache</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Reset Local Cache */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
          <div className="w-full max-w-md rounded-2xl bg-[#0B1F44] border border-rose-500/40 p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Local Cache?</h3>
                <p className="text-xs text-rose-300/80">Tester action: Irreversible local wipe</p>
              </div>
            </div>

            <p className="text-xs text-[#9bb1d6] leading-relaxed">
              This will clear all locally cached IndexedDB object stores (user profiles, courses, lessons, notes, key terms, reading position memories, and preferences) so you can test fresh app initialization.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#081734] hover:bg-[#0f2756] text-[#9bb1d6] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetLocalCache}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Yes, Reset Local Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
