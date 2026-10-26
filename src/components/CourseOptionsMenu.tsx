import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  BookOpen,
  Pencil,
  Info,
  RotateCcw,
  Archive,
  ArchiveRestore,
  Trash2,
  Share2,
  AlertTriangle,
  X,
  Check,
  Clock,
  Sparkles,
  Layers,
  Calendar,
  Compass,
} from 'lucide-react';
import { Course, Lesson } from '../types';
import { api } from '../lib/api';
import { CourseThumbnail } from './CourseThumbnail';

interface CourseOptionsMenuProps {
  course: Course;
  onSelectCourse: (course: Course) => void;
  onCourseUpdated?: (course: Course, lessons?: Lesson[]) => void;
  onCourseDeleted?: (courseId: string) => void;
  onShareCourse?: (course: Course) => void;
  className?: string;
  triggerButtonClassName?: string;
}

export const CourseOptionsMenu: React.FC<CourseOptionsMenuProps> = ({
  course,
  onSelectCourse,
  onCourseUpdated,
  onCourseDeleted,
  onShareCourse,
  className = '',
  triggerButtonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modal dialog states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  // Rename state
  const [renameTitle, setRenameTitle] = useState(course.title);
  const [isRenaming, setIsRenaming] = useState(false);

  // Reset progress state
  const [isResetting, setIsResetting] = useState(false);

  // Archive & Delete workflow state: 'choose' | 'confirm_archive' | 'confirm_restore' | 'confirm_delete'
  const [manageStep, setManageStep] = useState<
    'choose' | 'confirm_archive' | 'confirm_restore' | 'confirm_delete'
  >('choose');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Close dropdown on outside click or escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Keep renameTitle in sync if course prop changes
  useEffect(() => {
    setRenameTitle(course.title);
  }, [course.title]);

  // Handle Rename
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clean = renameTitle.trim();
    if (!clean || clean === course.title) {
      setShowRenameModal(false);
      return;
    }

    setIsRenaming(true);
    setActionError(null);
    try {
      const res = await api.updateCourse(course.id, { title: clean });
      if (onCourseUpdated) onCourseUpdated(res.course);
      showToast('Course renamed successfully.');
      setShowRenameModal(false);
    } catch (err: any) {
      console.error('Rename course error:', err);
      setActionError(err.message || 'Failed to rename course.');
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle Reset Progress
  const handleResetProgressSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResetting(true);
    setActionError(null);
    try {
      const res = await api.resetCourseProgress(course.id);
      if (onCourseUpdated) {
        onCourseUpdated(res.course, res.lessons);
      }
      showToast('Progress reset to Day 1. Completed lessons and quizzes reset.');
      setShowResetModal(false);
    } catch (err: any) {
      console.error('Reset progress error:', err);
      setActionError(err.message || 'Failed to reset course progress.');
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Archival
  const handleExecuteArchive = async (e: React.MouseEvent, shouldArchive: boolean) => {
    e.stopPropagation();
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      const res = await api.archiveCourse(course.id, shouldArchive);
      if (onCourseUpdated) {
        onCourseUpdated(res.course);
      }
      showToast(
        shouldArchive
          ? 'Course moved to Archived tab. Progress and lessons preserved.'
          : 'Course restored to your active curriculum.'
      );
      setShowManageModal(false);
      setManageStep('choose');
    } catch (err: any) {
      console.error('Archive course error:', err);
      setActionError(err.message || 'Failed to update course archive state.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Permanent Delete
  const handleExecutePermanentDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    setActionError(null);
    try {
      await api.deleteCourse(course.id);
      if (onCourseDeleted) {
        onCourseDeleted(course.id);
      }
      showToast('Course and course lessons permanently deleted.');
      setShowManageModal(false);
      setManageStep('choose');
    } catch (err: any) {
      console.error('Permanent delete course error:', err);
      setActionError(err.message || 'Failed to delete course.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Derived course metrics
  const totalLessons =
    course.totalLessonsCount ||
    course.lessonsCount ||
    course.lessonCount ||
    (Array.isArray(course.studyDays) ? course.studyDays.length : 0);

  const completedLessons =
    course.completedLessonsCount ??
    (course.progressPercent && totalLessons > 0
      ? Math.round((course.progressPercent / 100) * totalLessons)
      : course.isCompleted
      ? totalLessons
      : 0);

  const percent =
    totalLessons > 0
      ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
      : course.progressPercent || 0;

  const depthLabel =
    course.depth === 'quick'
      ? 'Quick Primer (3–5 Days)'
      : course.depth === 'deep'
      ? 'Deep Mastery (7–14 Days)'
      : 'Standard Course (5–7 Days)';

  return (
    <div
      ref={menuRef}
      className={`relative inline-block text-left ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Three-Dot Menu Trigger Button */}
      <button
        type="button"
        aria-label="Course options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#122549] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4FF] ${
          isOpen ? 'bg-[#122549] text-white ring-1 ring-[#00B4FF]/40' : ''
        } ${triggerButtonClassName}`}
        title="Course options"
      >
        <MoreVertical className="w-4 h-4 stroke-[2.2]" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full mt-1.5 z-40 w-52 py-1.5 rounded-xl bg-[#081734] border border-[#1a366f] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 text-left overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Open Course */}
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onSelectCourse(course);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0f2756] hover:text-[#00B4FF] transition-colors cursor-pointer text-left"
          >
            <BookOpen className="w-4 h-4 text-[#00B4FF] shrink-0" />
            <span>Open Course</span>
          </button>

          {/* 2. Rename Course */}
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              setRenameTitle(course.title);
              setActionError(null);
              setShowRenameModal(true);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#9bb1d6] hover:bg-[#0f2756] hover:text-white transition-colors cursor-pointer text-left"
          >
            <Pencil className="w-4 h-4 text-[#627ca8] shrink-0" />
            <span>Rename Course</span>
          </button>

          {/* 3. View Course Details */}
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              setShowDetailsModal(true);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#9bb1d6] hover:bg-[#0f2756] hover:text-white transition-colors cursor-pointer text-left"
          >
            <Info className="w-4 h-4 text-[#627ca8] shrink-0" />
            <span>View Course Details</span>
          </button>

          {/* 4. Reset Progress */}
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              setActionError(null);
              setShowResetModal(true);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#9bb1d6] hover:bg-[#0f2756] hover:text-amber-300 transition-colors cursor-pointer text-left"
          >
            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Reset Progress</span>
          </button>

          {/* Share Course (if supported/provided) */}
          {onShareCourse && (
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onShareCourse(course);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#9bb1d6] hover:bg-[#0f2756] hover:text-white transition-colors cursor-pointer text-left"
            >
              <Share2 className="w-4 h-4 text-[#627ca8] shrink-0" />
              <span>Share Course</span>
            </button>
          )}

          {/* Divider */}
          <div className="my-1 border-t border-[#1a366f]" />

          {/* 5. Archive / Delete */}
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              setActionError(null);
              setManageStep('choose');
              setShowManageModal(true);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-amber-300/90 hover:bg-[#0f2756] hover:text-amber-200 transition-colors cursor-pointer text-left"
          >
            {course.isArchived ? (
              <>
                <ArchiveRestore className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Restore or Delete...</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Archive or Delete...</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 p-4 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-semibold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: Rename Course                                   */}
      {/* ======================================================== */}
      {showRenameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowRenameModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#081734] border border-[#1a366f] p-6 shadow-2xl text-left space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/20">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Rename Course</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="p-1 rounded-lg text-[#627ca8] hover:text-white hover:bg-[#0f2756] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#9bb1d6] leading-relaxed">
              Update the title of your course. Your lessons, study progress, and personal notes will remain completely intact.
            </p>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9bb1d6] mb-1.5">
                  Course Title
                </label>
                <input
                  type="text"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  placeholder="Enter new course title..."
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B1F44] border border-[#1a366f] text-sm text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  disabled={isRenaming}
                  className="px-4 py-2 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] text-[#9bb1d6] hover:text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming || !renameTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer disabled:opacity-50"
                >
                  {isRenaming ? 'Saving...' : 'Save Title'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: View Course Details                             */}
      {/* ======================================================== */}
      {showDetailsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowDetailsModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#081734] border border-[#1a366f] p-6 shadow-2xl text-left space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/30 font-semibold uppercase">
                  {course.category || 'General'}
                </span>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {course.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="p-1 rounded-lg text-[#627ca8] hover:text-white hover:bg-[#0f2756] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thumbnail Banner */}
            <div className="h-32 w-full rounded-xl overflow-hidden border border-[#1a366f] relative">
              <CourseThumbnail
                title={course.title}
                category={course.category}
                coverImage={course.coverImage}
                coverIcon={course.coverIcon}
                alt={course.title}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#9bb1d6]">
                Overview & Description
              </span>
              <p className="text-xs text-[#9bb1d6] leading-relaxed bg-[#0B1F44] p-3 rounded-xl border border-[#1a366f]">
                {course.description || 'No description provided for this course.'}
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-[#0B1F44] border border-[#1a366f] space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-[#627ca8] font-mono uppercase">
                  <Compass className="w-3.5 h-3.5 text-[#00B4FF]" />
                  <span>Learning Depth</span>
                </div>
                <p className="text-xs font-bold text-white">{depthLabel}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#0B1F44] border border-[#1a366f] space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-[#627ca8] font-mono uppercase">
                  <Clock className="w-3.5 h-3.5 text-[#00B4FF]" />
                  <span>Daily Commitment</span>
                </div>
                <p className="text-xs font-bold text-white">
                  {course.dailyMinutesRange || `${course.dailyStudyGoalMinutes || 35} min/day`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0B1F44] border border-[#1a366f] space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-[#627ca8] font-mono uppercase">
                  <Layers className="w-3.5 h-3.5 text-[#00B4FF]" />
                  <span>Curriculum Scope</span>
                </div>
                <p className="text-xs font-bold text-white">
                  {totalLessons === 1 ? '1 Lesson' : `${totalLessons} Lessons`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0B1F44] border border-[#1a366f] space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-[#627ca8] font-mono uppercase">
                  <Calendar className="w-3.5 h-3.5 text-[#00B4FF]" />
                  <span>Estimated Days</span>
                </div>
                <p className="text-xs font-bold text-white">
                  {course.estimatedDays ? `${course.estimatedDays} Days` : '7 Days'}
                </p>
              </div>
            </div>

            {/* Progress Bar Module */}
            <div className="p-3.5 rounded-xl bg-[#0B1F44] border border-[#1a366f] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9bb1d6]">Study Progress</span>
                <span className="font-bold text-[#00B4FF]">
                  {completedLessons}/{totalLessons} Lessons ({percent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-[#081734] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1E60FF] to-[#00B4FF] rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Learning Objectives (if available) */}
            {Array.isArray(course.learningObjectives) && course.learningObjectives.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#9bb1d6]">
                  Learning Objectives
                </span>
                <ul className="space-y-1.5 bg-[#0B1F44] p-3 rounded-xl border border-[#1a366f]">
                  {course.learningObjectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#9bb1d6]">
                      <Check className="w-3.5 h-3.5 text-[#00B4FF] shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1a366f]">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] text-[#9bb1d6] hover:text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  onSelectCourse(course);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Open Course</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: Reset Course Progress Confirmation              */}
      {/* ======================================================== */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isResetting && setShowResetModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#081734] border border-amber-500/30 p-6 shadow-2xl text-left space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Course Progress?</h3>
                <span className="text-xs text-amber-300 font-mono">Restarts from Day 1</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B1F44] border border-[#1a366f] space-y-2 text-xs text-[#9bb1d6] leading-relaxed">
              <p>
                Are you sure you want to restart <strong className="text-white font-semibold">{course.title}</strong> from the beginning?
              </p>
              <p className="text-amber-200/90 font-medium">
                Your completed lesson marks, daily milestone check-ins, and exam scores will be reset to 0%.
              </p>
              <p className="text-emerald-300">
                &bull; Your course lessons, personal notes, and captured study materials will NOT be deleted.
              </p>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] text-[#9bb1d6] hover:text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetProgressSubmit}
                disabled={isResetting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isResetting ? 'Resetting Progress...' : 'Reset Progress'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: Archive and Delete Confirmation Workflow       */}
      {/* ======================================================== */}
      {showManageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => !isSubmittingAction && setShowManageModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#081734] border border-[#1a366f] p-6 shadow-2xl text-left space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-white">
                  {manageStep === 'choose'
                    ? course.isArchived
                      ? 'Manage Archived Course'
                      : 'Archive or Delete Course'
                    : manageStep === 'confirm_archive'
                    ? 'Confirm Course Archival'
                    : manageStep === 'confirm_restore'
                    ? 'Confirm Restore to Active'
                    : 'Permanently Delete Course'}
                </h3>
                <p className="text-xs text-[#9bb1d6] truncate max-w-sm">
                  {course.title}
                </p>
              </div>
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setShowManageModal(false)}
                className="p-1 rounded-lg text-[#627ca8] hover:text-white hover:bg-[#0f2756] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* STEP 1: CHOOSE (Clear, distinct options) */}
            {manageStep === 'choose' && (
              <div className="space-y-3.5">
                <p className="text-xs text-[#9bb1d6] leading-relaxed">
                  Choose what you would like to do with this course:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Archive (or Restore) */}
                  <div
                    onClick={() => {
                      setActionError(null);
                      setManageStep(course.isArchived ? 'confirm_restore' : 'confirm_archive');
                    }}
                    className="p-4 rounded-xl bg-[#0B1F44] hover:bg-[#0e2552] border border-[#1a366f] hover:border-amber-400/50 transition-all cursor-pointer space-y-2.5 flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="w-9 h-9 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center justify-center">
                        {course.isArchived ? (
                          <ArchiveRestore className="w-4 h-4" />
                        ) : (
                          <Archive className="w-4 h-4" />
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                        {course.isArchived ? 'Restore Course' : 'Archive Course'}
                      </h4>
                      <p className="text-[11px] text-[#9bb1d6] leading-relaxed">
                        {course.isArchived
                          ? 'Restore this course back to your active curriculum and dashboard.'
                          : 'Move course out of active view while preserving all lessons, notes, and study progress.'}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 pt-1">
                      {course.isArchived ? 'Restore to Active &rarr;' : 'Archive Safely &rarr;'}
                    </span>
                  </div>

                  {/* Option 2: Delete Permanently */}
                  <div
                    onClick={() => {
                      setActionError(null);
                      setManageStep('confirm_delete');
                    }}
                    className="p-4 rounded-xl bg-[#0B1F44] hover:bg-[#1a1226] border border-[#1a366f] hover:border-red-400/50 transition-all cursor-pointer space-y-2.5 flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="w-9 h-9 rounded-lg bg-red-400/10 text-red-400 border border-red-400/20 flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-red-300 transition-colors">
                        Delete Permanently
                      </h4>
                      <p className="text-[11px] text-[#9bb1d6] leading-relaxed">
                        Permanently delete this course and all its course-specific lessons. This action cannot be undone.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-red-400 flex items-center gap-1 pt-1">
                      Delete Course &rarr;
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowManageModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] text-[#9bb1d6] hover:text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CONFIRM ARCHIVE */}
            {manageStep === 'confirm_archive' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2 leading-relaxed">
                  <p className="font-semibold text-amber-100">
                    Move &ldquo;{course.title}&rdquo; to the Archived tab?
                  </p>
                  <p className="text-amber-200/90">
                    This course will be removed from your active curriculum and Home dashboard. All your bite-sized lessons, personal notes, captured materials, and study progress remain safely saved.
                  </p>
                  <p className="text-white/80">
                    You can find and restore this course at any time from the <strong className="text-amber-300">Archived</strong> tab in your Library.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setManageStep('choose')}
                    disabled={isSubmittingAction}
                    className="text-xs text-[#9bb1d6] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    &larr; Back to options
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManageModal(false)}
                      disabled={isSubmittingAction}
                      className="px-4 py-2 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] text-[#9bb1d6] hover:text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleExecuteArchive(e, true)}
                      disabled={isSubmittingAction}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                    >
                      <Archive className="w-4 h-4" />
                      <span>{isSubmittingAction ? 'Archiving...' : 'Archive Course'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: CONFIRM RESTORE */}
            {manageStep === 'confirm_restore' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#00B4FF]/10 border border-[#00B4FF]/30 text-xs text-[#9bb1d6] space-y-2 leading-relaxed">
                  <p className="font-semibold text-white">
                    Restore &ldquo;{course.title}&rdquo; to active curriculum?
                  </p>
                  <p>
                    This course will reappear in your active curriculum and on your Home study dashboard with all of your previous progress and notes ready.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setManageStep('choose')}
                    disabled={isSubmittingAction}
                    className="text-xs text-[#9bb1d6] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    &larr; Back to options
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManageModal(false)}
                      disabled={isSubmittingAction}
                      className="px-4 py-2 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] text-[#9bb1d6] hover:text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleExecuteArchive(e, false)}
                      disabled={isSubmittingAction}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer disabled:opacity-50"
                    >
                      <ArchiveRestore className="w-4 h-4" />
                      <span>{isSubmittingAction ? 'Restoring...' : 'Restore Course'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: CONFIRM DELETE (Explicit Mandatory Warning) */}
            {manageStep === 'confirm_delete' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 space-y-2.5 leading-relaxed">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>Warning: Irreversible Deletion</span>
                  </div>
                  <p className="font-semibold text-white">
                    Permanently delete this course? Its lessons, saved course-specific progress, and associated course data will be deleted. This action cannot be undone.
                  </p>
                  <p className="text-[#9bb1d6] text-[11px]">
                    Shared notes or captured materials belonging to you independently of this course will not be deleted.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setManageStep('choose')}
                    disabled={isSubmittingAction}
                    className="text-xs text-[#9bb1d6] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    &larr; Back to options
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManageModal(false)}
                      disabled={isSubmittingAction}
                      className="px-4 py-2 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] text-[#9bb1d6] hover:text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecutePermanentDelete}
                      disabled={isSubmittingAction}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/30 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{isSubmittingAction ? 'Deleting...' : 'Delete Permanently'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
