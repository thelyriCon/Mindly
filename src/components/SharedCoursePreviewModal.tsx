import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Clock,
  Sparkles,
  ArrowRight,
  Layers,
  CheckCircle2,
  Calendar,
  Lock,
  ExternalLink,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { SharedCourse, Course } from '../types';
import { api } from '../lib/api';
import { NokiaLoader } from './NokiaLoader';

interface SharedCoursePreviewModalProps {
  shareId: string | null;
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  onRequireAuth: (pendingShareId: string) => void;
  onCourseImported: (course: Course) => void;
}

export const SharedCoursePreviewModal: React.FC<SharedCoursePreviewModalProps> = ({
  shareId,
  isOpen,
  onClose,
  isAuthenticated,
  onRequireAuth,
  onCourseImported,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [importing, setImporting] = useState<boolean>(false);
  const [sharedCourse, setSharedCourse] = useState<SharedCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadyImportedCourse, setAlreadyImportedCourse] = useState<Course | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !shareId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setNoticeMessage(null);
    setAlreadyImportedCourse(null);

    api
      .getSharedCourse(shareId)
      .then((res) => {
        if (!isMounted) return;
        if (res.sharedCourse) {
          setSharedCourse(res.sharedCourse);
        } else {
          setError(
            'This shared course link is invalid, has expired, or is no longer available. Please check the link or ask the creator to share it again.'
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching shared course preview:', err);
        setError(
          err.message ||
            'Unable to load the shared course. Please check your internet connection.'
        );
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, shareId]);

  if (!isOpen) return null;

  const handleContinue = async () => {
    if (!shareId || !sharedCourse) return;

    if (!isAuthenticated) {
      // Preserve the pending shareId in localStorage
      try {
        localStorage.setItem('mindly_pending_shared_course', shareId);
      } catch {}
      onRequireAuth(shareId);
      return;
    }

    // Authenticated import flow
    setImporting(true);
    setError(null);
    try {
      const res = await api.importSharedCourse(shareId);
      if ((res as any).alreadyImported && (res as any).course) {
        setAlreadyImportedCourse((res as any).course);
        setNoticeMessage(
          `"${(res as any).course.title}" is already in your courses!`
        );
      } else if (res.course) {
        // Clear pending share key
        try {
          localStorage.removeItem('mindly_pending_shared_course');
        } catch {}
        onCourseImported(res.course);
        onClose();
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setError(
        err.message || 'Failed to import course into your account. Please try again.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleOpenExisting = () => {
    if (alreadyImportedCourse) {
      try {
        localStorage.removeItem('mindly_pending_shared_course');
      } catch {}
      onCourseImported(alreadyImportedCourse);
      onClose();
    }
  };

  const lessonCount =
    (sharedCourse as any)?.lessonsCount ||
    sharedCourse?.lessonCount ||
    (Array.isArray(sharedCourse?.lessons) ? sharedCourse.lessons.length : 0);
  const studyDaysCount =
    sharedCourse?.studyDays?.length || sharedCourse?.estimatedDays || 7;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0f1117] border border-[#232738] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header / Dismiss */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2333] bg-[#121520]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Shared Course Preview</h2>
              <p className="text-[11px] text-zinc-400">
                {sharedCourse?.creatorName
                  ? `Shared by ${sharedCourse.creatorName}`
                  : 'Curriculum from Mindly Community'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-zinc-200 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4">
              <NokiaLoader label="Loading course preview..." />
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">Course Not Available</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
              >
                Close Preview
              </button>
            </div>
          ) : sharedCourse ? (
            <>
              {/* Cover Image banner */}
              {sharedCourse.coverImage ? (
                <div className="w-full h-44 sm:h-52 rounded-xl overflow-hidden border border-[#232738] relative bg-[#161a27]">
                  <img
                    src={sharedCourse.coverImage}
                    alt={sharedCourse.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f1117] via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-[#00B4FF]/90 text-[#0B1F44] shadow-md">
                      {sharedCourse.category || 'General'}
                    </span>
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-black/75 text-zinc-200 border border-white/10 backdrop-blur-sm">
                      {studyDaysCount} Study Days
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-28 rounded-xl bg-gradient-to-br from-[#121c33] to-[#1a1438] border border-[#262c45] p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#00B4FF]/20 text-[#00B4FF] border border-[#00B4FF]/30">
                      {sharedCourse.category || 'General'}
                    </span>
                    <h3 className="text-sm font-bold text-white">Curriculum Plan</h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#00B4FF]/10 border border-[#00B4FF]/20 flex items-center justify-center text-[#00B4FF]">
                    <BookOpen className="w-6 h-6" />
                  </div>
                </div>
              )}

              {/* Title & Description */}
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
                  {sharedCourse.title}
                </h1>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {sharedCourse.description ||
                    'A structured personal learning course with active recall and bite-sized lessons.'}
                </p>
              </div>

              {/* Quick Metadata Stats */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-[#141824] border border-[#232738] text-center">
                  <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-[#00B4FF]" />
                    <span>Lessons</span>
                  </div>
                  <p className="text-base font-bold text-white">{lessonCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#141824] border border-[#232738] text-center">
                  <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Progression</span>
                  </div>
                  <p className="text-base font-bold text-white">{studyDaysCount} Days</p>
                </div>
                <div className="p-3 rounded-xl bg-[#141824] border border-[#232738] text-center">
                  <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-[11px] mb-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Daily Pace</span>
                  </div>
                  <p className="text-xs font-bold text-white truncate">
                    {sharedCourse.dailyMinutesRange || '30–45m'}
                  </p>
                </div>
              </div>

              {/* Notice if already imported */}
              {noticeMessage && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{noticeMessage}</span>
                  </div>
                  <button
                    onClick={handleOpenExisting}
                    className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs shrink-0 cursor-pointer"
                  >
                    Open Course
                  </button>
                </div>
              )}

              {/* Lesson Outline Preview */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  <span>Included Lessons ({lessonCount})</span>
                  <span className="text-[11px] text-zinc-400 font-normal lowercase">full content included</span>
                </div>
                <div className="divide-y divide-[#1e2233] rounded-xl bg-[#131622] border border-[#232738] max-h-48 overflow-y-auto">
                  {Array.isArray(sharedCourse.lessons) && sharedCourse.lessons.length > 0 ? (
                    sharedCourse.lessons.map((lesson, idx) => (
                      <div
                        key={lesson.id || idx}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="w-5 h-5 rounded-full bg-[#1e2336] text-[10px] font-mono font-bold text-zinc-400 flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-zinc-200 font-medium truncate">{lesson.title}</span>
                        </div>
                        <span className="text-[11px] text-zinc-400 shrink-0 font-mono">
                          Day {lesson.dayNumber || 1}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-xs text-zinc-400">
                      Complete learning lessons and active recall checkpoints are ready to import.
                    </div>
                  )}
                </div>
              </div>

              {/* Privacy / Separation note */}
              <div className="p-3 rounded-xl bg-[#111420] border border-[#1e2336] text-[11px] text-zinc-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00B4FF] shrink-0" />
                <span>
                  Importing creates an independent, private copy in your library. Your notes, study streak, and quizzes are 100% private.
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer / Action Button */}
        {!loading && !error && sharedCourse && (
          <div className="p-4 sm:p-5 border-t border-[#1f2333] bg-[#121520] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-zinc-400 text-center sm:text-left">
              {isAuthenticated
                ? 'Ready to add to your personal Mindly curriculum.'
                : 'Sign in or register to import and start learning.'}
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors w-full sm:w-auto cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleContinue}
                disabled={importing}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-[#00B4FF] hover:from-indigo-500 hover:to-[#00a3e8] text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-[#00B4FF]/25 w-full sm:w-auto cursor-pointer disabled:opacity-50"
              >
                {importing ? (
                  <span>Importing Course...</span>
                ) : (
                  <>
                    <span>Continue with This Course</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
