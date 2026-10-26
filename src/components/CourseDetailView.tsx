import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  BookOpen,
  CheckCircle2,
  Bookmark,
  FileText,
  Trash2,
  Sparkles,
  HelpCircle,
  Clock,
  Lock,
  Unlock,
  Award,
  AlertCircle,
  Check,
  ChevronRight,
  ShieldCheck,
  Share2,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Lesson, ReviewQuestion, StudyDayMilestone } from '../types';
import { QuizModal } from './QuizModal';
import { ShareCourseModal } from './ShareCourseModal';

interface CourseDetailViewProps {
  course: Course;
  lessons: Lesson[];
  onBack: () => void;
  onSelectLesson: (lesson: Lesson) => void;
  onOpenAddMaterial: (courseId: string) => void;
  onCourseUpdated: (updatedCourse: Course, updatedLessons: Lesson[]) => void;
  onOpenNotesForCourse: (courseId: string) => void;
  onOpenTermsForCourse: (courseId: string) => void;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  course,
  lessons = [],
  onBack,
  onSelectLesson,
  onOpenAddMaterial,
  onCourseUpdated,
  onOpenNotesForCourse,
  onOpenTermsForCourse,
}) => {
  const safeLessons = Array.isArray(lessons) ? lessons : [];
  const [showNewLessonModal, setShowNewLessonModal] = useState(false);
  const [blankTitle, setBlankTitle] = useState('');
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);

  // Active Milestone Quiz state
  const [activeQuiz, setActiveQuiz] = useState<{
    isOpen: boolean;
    type: 'day_checkin' | 'final_exam';
    dayNumber?: number;
    title: string;
    questions: ReviewQuestion[];
  } | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleToggleArchive = async () => {
    setIsArchiving(true);
    try {
      const willArchive = !course.isArchived;
      const res = await api.archiveCourse(course.id, willArchive);
      onCourseUpdated(res.course, safeLessons);
      showToast(willArchive ? '📦 Course moved to Archive.' : '📂 Course restored to active library.');
    } catch (err: any) {
      console.error('Error toggling archive:', err);
      showToast(err.message || 'Failed to update course archive state.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Toggle lesson complete directly from list
  const handleToggleComplete = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    try {
      const res = await api.toggleComplete(lessonId);
      const updatedLessons = safeLessons.map((l) => (l.id === lessonId ? res.lesson : l));
      const completedCount = updatedLessons.filter((l) => l.isCompleted).length;
      const progressPercent = Math.round((completedCount / (updatedLessons.length || 1)) * 100);
      onCourseUpdated({ ...course, progressPercent }, updatedLessons);
    } catch (err) {
      console.error('Error toggling complete:', err);
    }
  };

  // Toggle lesson bookmark directly from list
  const handleToggleBookmark = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    try {
      const res = await api.toggleBookmark(lessonId);
      const updatedLessons = safeLessons.map((l) => (l.id === lessonId ? res.lesson : l));
      onCourseUpdated(course, updatedLessons);
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  // Delete a lesson
  const handleDeleteLesson = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this lesson? This action cannot be undone.')) return;
    try {
      await api.deleteLesson(lessonId);
      const updatedLessons = safeLessons.filter((l) => l.id !== lessonId);
      const completedCount = updatedLessons.filter((l) => l.isCompleted).length;
      const progressPercent = updatedLessons.length
        ? Math.round((completedCount / updatedLessons.length) * 100)
        : 0;
      onCourseUpdated({ ...course, progressPercent }, updatedLessons);
    } catch (err) {
      console.error('Error deleting lesson:', err);
    }
  };

  // Create quick manual lesson
  const handleCreateBlankLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blankTitle.trim()) return;
    setIsCreatingBlank(true);
    try {
      const res = await api.createLesson(course.id, {
        title: blankTitle.trim(),
        structuredContent: {
          title: blankTitle.trim(),
          overview: 'New self-authored lesson.',
          learningObjectives: [],
          mainConcepts: [],
          examples: [],
          importantDistinctions: [],
          keyTerms: [],
          keyTakeaways: [],
          reviewQuestions: [],
        },
      });
      const updatedLessons = [...safeLessons, res.lesson];
      onCourseUpdated(course, updatedLessons);
      setBlankTitle('');
      setShowNewLessonModal(false);
      onSelectLesson(res.lesson);
    } catch (err) {
      console.error('Create lesson error:', err);
    } finally {
      setIsCreatingBlank(false);
    }
  };

  // -------------------------------------------------------------
  // Grouping Lessons into Structured Study Days
  // -------------------------------------------------------------
  interface DayGroup {
    dayNumber: number;
    title: string;
    overview: string;
    estimatedMinutes: number;
    lessons: Lesson[];
    milestone?: StudyDayMilestone;
    isLocked: boolean;
    isPassed: boolean;
  }

  const rawStudyDays = course.studyDays || [];

  // Determine maximum day number
  let maxDayNum = 1;
  safeLessons.forEach((l) => {
    if (l.dayNumber && l.dayNumber > maxDayNum) maxDayNum = l.dayNumber;
  });
  rawStudyDays.forEach((d) => {
    if (d.dayNumber > maxDayNum) maxDayNum = d.dayNumber;
  });

  const dayGroups: DayGroup[] = [];

  for (let d = 1; d <= maxDayNum; d++) {
    const dayMilestone = rawStudyDays.find((sd) => sd.dayNumber === d);
    const dayLessons = safeLessons.filter((l) => (l.dayNumber || 1) === d);

    // If day 1, unlocked by default. Otherwise unlocked if day d-1 is passed!
    const prevDayMilestone = rawStudyDays.find((sd) => sd.dayNumber === d - 1);
    const isDayUnlocked = d === 1 || !!prevDayMilestone?.isPassed;
    const isPassed = !!dayMilestone?.isPassed;

    const defaultTitle = dayLessons[0]?.dayTitle || `Day ${d}: Core Foundations`;
    const title = dayMilestone?.title || defaultTitle;
    const totalMin =
      dayMilestone?.estimatedMinutes ||
      dayLessons.reduce((acc, curr) => acc + 20, 0) ||
      35;

    dayGroups.push({
      dayNumber: d,
      title,
      overview: dayMilestone?.overview || `Essential concepts and milestones for Day ${d}.`,
      estimatedMinutes: totalMin,
      lessons: dayLessons,
      milestone: dayMilestone,
      isLocked: !isDayUnlocked,
      isPassed,
    });
  }

  // Check for last read lesson to enable 1-tap Auto-Resume
  const lastReadLesson = React.useMemo(() => {
    try {
      const local = localStorage.getItem(`mindly_course_last_read_${course.id}`);
      if (local) {
        const parsed = JSON.parse(local);
        const match = safeLessons.find((l) => l.id === parsed.lessonId);
        if (match) return match;
      }
    } catch {
      // Ignore
    }
    if (course.lastReadLessonId) {
      const match = safeLessons.find((l) => l.id === course.lastReadLessonId);
      if (match) return match;
    }
    return safeLessons.find((l) => !l.isCompleted && !l.isLocked) || safeLessons[0] || null;
  }, [course.id, course.lastReadLessonId, safeLessons]);

  // Handle lesson click with lock enforcement
  const handleLessonClick = (lesson: Lesson, isDayLocked: boolean) => {
    if (isDayLocked || lesson.isLocked) {
      showToast(`🔒 Locked: Complete the previous Day's Milestone Check-in Quiz to unlock this material.`);
      return;
    }
    onSelectLesson(lesson);
  };

  // Handle Daily Check-in Quiz Launch
  const handleOpenDayCheckin = (group: DayGroup) => {
    if (group.isLocked) {
      showToast(`🔒 Complete Day ${group.dayNumber - 1} Check-in first to unlock this quiz.`);
      return;
    }

    // Collect questions: either from milestone.checkInQuiz or synthesize from day's lessons
    let questions: ReviewQuestion[] = group.milestone?.checkInQuiz || [];
    if (!questions || questions.length === 0) {
      const gathered: ReviewQuestion[] = [];
      group.lessons.forEach((l) => {
        if (Array.isArray(l.structuredContent?.reviewQuestions)) {
          gathered.push(...l.structuredContent.reviewQuestions);
        }
      });
      questions = gathered.slice(0, 4);
    }

    if (questions.length === 0) {
      // Fallback high-yield check-in questions
      questions = [
        {
          id: `chk_${group.dayNumber}_1`,
          question: `What is the core conceptual focus of ${group.title}?`,
          type: 'multiple_choice',
          options: [
            group.overview.slice(0, 75) || 'Understanding the primary core mechanics',
            'Arbitrary memorization without systematic principles',
            'Skipping fundamental assumptions and causality',
            'None of the above',
          ],
          answer: group.overview.slice(0, 75) || 'Understanding the primary core mechanics',
          explanation: 'The daily milestone tests comprehension of core principles established today.',
        },
      ];
    }

    setActiveQuiz({
      isOpen: true,
      type: 'day_checkin',
      dayNumber: group.dayNumber,
      title: `${group.title} &bull; Daily Check-in Quiz`,
      questions,
    });
  };

  // Handle Final Exam Launch
  const handleOpenFinalExam = () => {
    // Check if all study days are passed
    const allDaysPassed = dayGroups.every((g) => g.isPassed || g.dayNumber === 1);
    if (!allDaysPassed) {
      showToast(`🔒 The Comprehensive Final Exam is locked. Complete all daily check-in quizzes first!`);
      return;
    }

    let questions: ReviewQuestion[] = course.finalExam || [];
    if (!questions || questions.length === 0) {
      const gathered: ReviewQuestion[] = [];
      safeLessons.forEach((l) => {
        if (Array.isArray(l.structuredContent?.reviewQuestions)) {
          gathered.push(...l.structuredContent.reviewQuestions);
        }
      });
      questions = gathered.slice(0, 8);
    }

    setActiveQuiz({
      isOpen: true,
      type: 'final_exam',
      title: `Graduation Milestone: Comprehensive Final Exam`,
      questions,
    });
  };

  // Handle Quiz Modal Completion
  const handleQuizCompleted = async (score: number, total: number) => {
    if (!activeQuiz) return;

    const pct = Math.round((score / (total || 1)) * 100);

    if (activeQuiz.type === 'day_checkin' && activeQuiz.dayNumber) {
      try {
        const res = await api.passDayCheckin(course.id, activeQuiz.dayNumber, pct, total);
        onCourseUpdated(res.course, res.lessons);
        showToast(`🎉 Day ${activeQuiz.dayNumber} Milestone Passed (${pct}%)! Next Day's Material Unlocked.`);
      } catch (err: any) {
        console.error('Failed to pass day checkin:', err);
        showToast('Error recording day checkin.');
      }
    } else if (activeQuiz.type === 'final_exam') {
      try {
        const res = await api.passFinalExam(course.id, pct, total);
        onCourseUpdated(res.course, safeLessons);
        showToast(`🏆 Congratulations! You passed the Comprehensive Final Exam with ${pct}%!`);
      } catch (err: any) {
        console.error('Failed to pass final exam:', err);
        showToast('Error recording final exam completion.');
      }
    }
  };

  const completedCount = safeLessons.filter((l) => l.isCompleted).length;
  const progressPercent = safeLessons.length > 0 ? Math.round((completedCount / safeLessons.length) * 100) : 0;
  const allMilestonesPassed = dayGroups.length > 0 && dayGroups.every((g) => g.isPassed);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 p-4 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-semibold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Courses</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00B4FF]/10 border border-[#00B4FF]/30 hover:bg-[#00B4FF]/20 text-[#00B4FF] text-xs font-semibold transition-colors cursor-pointer"
            title="Share this course link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Course</span>
          </button>
          <button
            onClick={handleToggleArchive}
            disabled={isArchiving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              course.isArchived
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                : 'bg-[#16171d] border-[#272935] hover:bg-[#1e2029] text-zinc-400 hover:text-zinc-200'
            }`}
            title={course.isArchived ? 'Restore to active courses' : 'Archive this course'}
          >
            {course.isArchived ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 text-amber-400" />
                <span>Unarchive</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 text-zinc-400" />
                <span>Archive</span>
              </>
            )}
          </button>
          <button
            onClick={() => onOpenNotesForCourse(course.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16171d] border border-[#272935] hover:bg-[#1e2029] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>Course Notes</span>
          </button>
          <button
            onClick={() => onOpenTermsForCourse(course.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16171d] border border-[#272935] hover:bg-[#1e2029] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
            <span>Glossary</span>
          </button>
        </div>
      </div>

      {/* Archived Course Banner */}
      {course.isArchived && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Archive className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-amber-200">This course is archived</p>
              <p className="text-zinc-400">
                It is tucked away from your active dashboard, but your lessons, notes, and progress remain intact.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleArchive}
            disabled={isArchiving}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs shrink-0 transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            {isArchiving ? 'Restoring...' : 'Restore to Active Courses'}
          </button>
        </div>
      )}

      {/* Course Banner Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#131418] border border-[#23252e] relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                {course.category || 'General'}
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 font-bold uppercase">
                {dayGroups.length} Study Days
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                {course.dailyMinutesRange || '30–45 min/day'}
              </span>
              {course.finalExamPassed && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 font-bold">
                  🏆 Graduated ({course.finalExamScore}%)
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {course.title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {course.description || 'Structured knowledge base and lessons.'}
            </p>

            <div className="flex items-center gap-4 pt-2 text-xs text-zinc-400">
              <span>{dayGroups.length} Study Days</span>
              <span>•</span>
              <span>{safeLessons.length} Lessons</span>
              <span>•</span>
              <span>{completedCount} Completed</span>
              <span>•</span>
              <span className="text-[#00B4FF] font-medium">{progressPercent}% Progress</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-[#20222a] rounded-full overflow-hidden mt-3 max-w-md">
              <div
                className="h-full bg-[#00B4FF] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            {lastReadLesson && (
              <button
                onClick={() => onSelectLesson(lastReadLesson)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-[#00B4FF] hover:from-indigo-500 hover:to-[#009de0] text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-[#00B4FF]/25 cursor-pointer"
                title={`Resume ${lastReadLesson.title}`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="truncate max-w-[180px]">Resume: {lastReadLesson.title}</span>
              </button>
            )}
            <button
              onClick={() => onOpenAddMaterial(course.id)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold tracking-wide transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>+ Add Material (Dump)</span>
            </button>
            <button
              onClick={() => setShowNewLessonModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1d24] hover:bg-[#252631] text-zinc-200 text-xs font-medium border border-[#2c2e3c] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Blank Lesson</span>
            </button>
          </div>
        </div>
      </div>

      {/* Curriculum Day-by-Day Progression Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Day-by-Day Learning Progression
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Structured into manageable daily study allocations with milestone check-in gates.
          </p>
        </div>
      </div>

      {/* Structured Day Groups */}
      {safeLessons.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#121316] border border-dashed border-[#262831] space-y-3">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No lessons yet in this course</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Drop in YouTube transcripts, lecture notes, or screenshots to generate your first structured lesson with AI.
          </p>
          <button
            onClick={() => onOpenAddMaterial(course.id)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Add First Material</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {dayGroups.map((group) => {
            return (
              <section
                key={group.dayNumber}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  group.isLocked
                    ? 'bg-[#0e0f13]/60 border-[#1c1e27] opacity-75'
                    : 'bg-[#131418] border-[#23252e]'
                }`}
              >
                {/* Day Header Banner */}
                <div className="p-4 sm:p-5 bg-[#17181e] border-b border-[#23252e] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 font-bold">
                        Day {group.dayNumber} of {dayGroups.length}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        {group.title}
                      </h3>
                      {group.isLocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>Locked</span>
                        </span>
                      )}
                      {group.isPassed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 font-semibold">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Check-in Passed ({group.milestone?.score || 100}%)</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {group.overview}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono shrink-0">
                    <Clock className="w-3.5 h-3.5 text-[#00B4FF]" />
                    <span>~{group.estimatedMinutes} min daily block</span>
                  </div>
                </div>

                {/* Day Lessons List */}
                <div className="p-4 sm:p-5 space-y-2.5">
                  {group.lessons.map((lesson, idx) => {
                    const lessonOrderStr = String(lesson.order || idx + 1).padStart(2, '0');
                    const hasQuiz = lesson.structuredContent?.reviewQuestions?.length > 0;
                    const isLessonLocked = group.isLocked || lesson.isLocked;

                    return (
                      <div
                        key={lesson.id}
                        onClick={() => handleLessonClick(lesson, group.isLocked)}
                        className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                          isLessonLocked
                            ? 'bg-[#0e0f13] border-[#1e202a] text-zinc-500 cursor-not-allowed'
                            : 'bg-[#0a0b0e] hover:bg-[#111217] border-[#1c1e27] hover:border-indigo-500/40 text-zinc-200 cursor-pointer group'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-xs font-mono font-medium text-zinc-500 w-6">
                            {lessonOrderStr}
                          </span>

                          {/* Completion / Lock Indicator */}
                          {isLessonLocked ? (
                            <div className="p-1 text-zinc-600" title="Locked until previous milestone is passed">
                              <Lock className="w-4 h-4 text-amber-500/80" />
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleToggleComplete(e, lesson.id)}
                              className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors"
                              title={lesson.isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                            >
                              <CheckCircle2
                                className={`w-5 h-5 ${lesson.isCompleted ? 'text-emerald-400' : 'text-zinc-600'}`}
                              />
                            </button>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4
                                className={`text-sm font-medium truncate ${
                                  isLessonLocked ? 'text-zinc-500' : 'text-zinc-100 group-hover:text-white'
                                }`}
                              >
                                {lesson.title}
                              </h4>
                              {lesson.isDemo && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                                  Demo
                                </span>
                              )}
                            </div>
                            {lesson.structuredContent?.overview && (
                              <p className="text-xs text-zinc-500 truncate mt-0.5 max-w-xl">
                                {lesson.structuredContent.overview}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right badges & controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!isLessonLocked && hasQuiz && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              <HelpCircle className="w-3 h-3 text-indigo-400" />
                              <span>{lesson.quizScore !== undefined ? `${lesson.quizScore}%` : 'Quiz'}</span>
                            </span>
                          )}

                          {!isLessonLocked && (
                            <button
                              onClick={(e) => handleToggleBookmark(e, lesson.id)}
                              className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${
                                lesson.isBookmarked ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-300'
                              }`}
                              title="Bookmark"
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          )}

                          {!isLessonLocked && (
                            <button
                              onClick={(e) => handleDeleteLesson(e, lesson.id)}
                              className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Lesson"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* End-of-Day Milestone Gate: Daily Check-in Quiz */}
                  <div
                    className={`mt-4 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      group.isPassed
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                        : group.isLocked
                        ? 'bg-[#101117] border-[#1d1f2b] text-zinc-500'
                        : 'bg-indigo-950/30 border-indigo-500/50 text-indigo-200 shadow-md'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          group.isPassed
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : group.isLocked
                            ? 'bg-zinc-800 text-zinc-500'
                            : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                        }`}
                      >
                        {group.isPassed ? (
                          <Check className="w-5 h-5" />
                        ) : group.isLocked ? (
                          <Lock className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ShieldCheck className="w-5 h-5 text-indigo-300" />
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            Day {group.dayNumber} Milestone Gate: Daily Check-in Quiz
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                            {group.milestone?.checkInQuiz?.length || 3} Questions
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {group.isPassed
                            ? `Milestone gate verified! Score: ${group.milestone?.score || 100}%.`
                            : group.isLocked
                            ? `Locked until Day ${group.dayNumber - 1} Check-in is passed.`
                            : `Complete this 3-question check-in to unlock Day ${group.dayNumber + 1} material.`}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 self-end sm:self-auto">
                      {group.isPassed ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDayCheckin(group)}
                          className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Review Quiz
                        </button>
                      ) : group.isLocked ? (
                        <span className="text-xs font-mono text-zinc-500 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenDayCheckin(group)}
                          className="px-4 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer flex items-center gap-1.5"
                        >
                          <span>Take Check-in Quiz</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          {/* Graduation Milestone Gate: Comprehensive Final Exam (Exclusively at End of Final Day) */}
          <section className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-[#121624] via-[#10131e] to-[#0c0d12] border border-[#2b3147] shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    course.finalExamPassed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : allMilestonesPassed
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-zinc-800/80 text-zinc-500 border border-zinc-700'
                  }`}
                >
                  <Award className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-wider">
                      Graduation Gate
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      Comprehensive Final Exam
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                    {course.finalExamPassed
                      ? `Final exam passed with distinction (${course.finalExamScore}%). Course certificate officially issued!`
                      : allMilestonesPassed
                      ? 'All daily study milestones completed! Take the comprehensive final exam to graduate and claim your certificate.'
                      : 'Exclusively available at the end of the final study day once all daily check-in quizzes are passed.'}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-auto">
                {course.finalExamPassed ? (
                  <button
                    type="button"
                    onClick={handleOpenFinalExam}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Review Final Exam
                  </button>
                ) : allMilestonesPassed ? (
                  <button
                    type="button"
                    onClick={handleOpenFinalExam}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 text-xs font-bold hover:brightness-110 transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Start Final Exam</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
                    <Lock className="w-4 h-4 text-zinc-500" />
                    <span>Locked until Day {dayGroups.length}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Quiz Modal for Daily Check-in and Final Exam */}
      {activeQuiz && (
        <QuizModal
          isOpen={activeQuiz.isOpen}
          onClose={() => setActiveQuiz(null)}
          lessonId={course.id}
          lessonTitle={activeQuiz.title}
          questions={activeQuiz.questions}
          onQuizCompleted={handleQuizCompleted}
        />
      )}

      {/* Blank Lesson Creation Modal */}
      {showNewLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-[#131418] border border-[#272932] shadow-2xl p-6 text-zinc-100">
            <h3 className="text-sm font-semibold text-white mb-1">Create Blank Lesson</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Add a manual lesson to "{course.title}". You can write your own notes and structure.
            </p>

            <form onSubmit={handleCreateBlankLesson} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Lesson Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Higher Highs & Higher Lows Definition"
                  value={blankTitle}
                  onChange={(e) => setBlankTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewLessonModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBlank}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingBlank ? 'Creating...' : 'Create Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Course Modal */}
      <ShareCourseModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        course={course}
      />
    </div>
  );
};
