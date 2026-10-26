import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Bookmark,
  Sparkles,
  HelpCircle,
  FileText,
  Edit,
  Save,
  Send,
  Eye,
  Type,
  Plus,
  Trash2,
  BookOpen,
  MessageSquare,
  X,
  ExternalLink,
  Clock,
  RotateCcw,
  Image as ImageIcon,
  MoreVertical,
  Calendar,
  Award,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { api } from '../lib/api';
import { persistenceEngine } from '../lib/persistence';
import {
  Lesson,
  Course,
  StructuredContent,
  KeyTermItem,
  SpacedRepetitionRating,
  ReviewQuestion,
} from '../types';
import { QuizModal } from './QuizModal';
import { ConceptReferenceDrawer } from './ConceptReferenceDrawer';
import { DiagramViewer } from './DiagramViewer';

interface LessonDetailViewProps {
  lesson: Lesson;
  course: Course;
  allLessons?: Lesson[];
  onBack: () => void;
  onLessonUpdated: (updatedLesson: Lesson) => void;
  onCourseUpdated?: (updatedCourse: Course, updatedLessons: Lesson[]) => void;
  onNavigateLesson?: (lesson: Lesson) => void;
  onOpenAddNote: (courseId: string, lessonId: string, initialTitle: string) => void;
  onSelectTerm?: (term: KeyTermItem) => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export const LessonDetailView: React.FC<LessonDetailViewProps> = ({
  lesson,
  course,
  allLessons,
  onBack,
  onLessonUpdated,
  onCourseUpdated,
  onNavigateLesson,
  onOpenAddNote,
  onSelectTerm,
  isFocusMode = false,
  onToggleFocusMode,
}) => {
  const [internalFocusMode, setInternalFocusMode] = useState(false);
  const isFocus = onToggleFocusMode ? isFocusMode : internalFocusMode;
  const toggleFocus = onToggleFocusMode || (() => setInternalFocusMode((prev) => !prev));

  const [activeTab, setActiveTab] = useState<'structured' | 'original'>('structured');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [isEditing, setIsEditing] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  const defaultStructured: StructuredContent = {
    title: lesson.title || 'Lesson Overview',
    overview: '',
    learningObjectives: [],
    mainConcepts: [],
    diagrams: [],
    images: [],
    examples: [],
    importantDistinctions: [],
    keyTerms: [],
    keyTakeaways: [],
    reviewQuestions: [],
  };

  const [editedContent, setEditedContent] = useState<StructuredContent>(
    lesson.structuredContent || defaultStructured
  );
  const [editedTitle, setEditedTitle] = useState(lesson.title || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedContent(lesson.structuredContent || defaultStructured);
    setEditedTitle(lesson.title || '');
  }, [lesson]);

  // Active Study Time Tracking for Daily Goal
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Local state for tracking and storing scrollY position of active lesson content
  const [scrollY, setScrollY] = useState<number>(() => {
    try {
      const localData = localStorage.getItem(`mindly_reading_${lesson.id}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (typeof parsed.scrollY === 'number') return parsed.scrollY;
      }
      if (lesson.readingPosition && typeof lesson.readingPosition.scrollY === 'number') {
        return lesson.readingPosition.scrollY;
      }
    } catch {
      // Ignore
    }
    return 0;
  });

  const [resumedPositionNotice, setResumedPositionNotice] = useState(false);
  const scrollSaveTimerRef = useRef<any>(null);

  // Automatically use window.scrollTo on component mount to restore user's reading position
  useEffect(() => {
    let targetY = scrollY;
    if (targetY <= 0) {
      try {
        const localData = localStorage.getItem(`mindly_reading_${lesson.id}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          if (typeof parsed.scrollY === 'number') targetY = parsed.scrollY;
        } else if (lesson.readingPosition && typeof lesson.readingPosition.scrollY === 'number') {
          targetY = lesson.readingPosition.scrollY;
        }
      } catch {
        // Ignore
      }
    }

    if (targetY > 60) {
      // Allow DOM to layout content before restoring reading position via window.scrollTo
      const restoreTimer = setTimeout(() => {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
        const mainEl = document.querySelector('main');
        if (mainEl && mainEl.scrollTop !== targetY) {
          mainEl.scrollTo({ top: targetY, behavior: 'smooth' });
        }
        setResumedPositionNotice(true);
      }, 100);

      const dismissTimer = setTimeout(() => {
        setResumedPositionNotice(false);
      }, 4000);

      return () => {
        clearTimeout(restoreTimer);
        clearTimeout(dismissTimer);
      };
    }
  }, [lesson.id]);

  // Track scroll percentage for Focus Mode ambient progress indicator
  useEffect(() => {
    const handleScrollProgress = () => {
      const scrollElement = document.querySelector('main') || document.documentElement;
      const totalHeight = scrollElement.scrollHeight - scrollElement.clientHeight;
      if (totalHeight > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((scrollElement.scrollTop / totalHeight) * 100)));
        setScrollProgress(pct);
      }
    };

    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScrollProgress, { passive: true });
    }
    window.addEventListener('scroll', handleScrollProgress, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', handleScrollProgress);
      window.removeEventListener('scroll', handleScrollProgress);
    };
  }, []);

  // Keyboard shortcut listener: 'F' toggles Focus Mode, 'Escape' exits Focus Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFocus();
      } else if (e.key === 'Escape' && isFocus) {
        e.preventDefault();
        toggleFocus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocus, toggleFocus]);

  useEffect(() => {
    let unloggedSeconds = 0;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setSessionSeconds((prev) => prev + 1);
        unloggedSeconds += 1;

        // Auto-flush every 15 seconds
        if (unloggedSeconds >= 15) {
          api.logStudyTime(unloggedSeconds, lesson.id).catch((err) => {
            console.error('Study log failed:', err);
          });
          unloggedSeconds = 0;
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (unloggedSeconds > 0) {
        api.logStudyTime(unloggedSeconds, lesson.id).catch(() => {});
      }
    };
  }, [lesson.id]);

  // Quiz Modal state
  const [showQuizModal, setShowQuizModal] = useState(false);

  // Day Pacing Metrics & Milestone State
  const safeLessons = allLessons && allLessons.length > 0 ? allLessons : [lesson];
  const currentDayNumber = lesson.dayNumber || 1;
  const totalDays =
    course.studyDays && course.studyDays.length > 0
      ? course.studyDays.length
      : course.estimatedDays || Math.max(...safeLessons.map((l) => l.dayNumber || 1), 1);

  const dayLessons = safeLessons
    .filter((l) => (l.dayNumber || 1) === currentDayNumber)
    .sort((a, b) => a.order - b.order);

  const lessonIndexInDay = dayLessons.findIndex((l) => l.id === lesson.id);
  const lessonNumberInDay = (lessonIndexInDay >= 0 ? lessonIndexInDay : 0) + 1;
  const isEndOfDayLesson = lessonIndexInDay === dayLessons.length - 1 || dayLessons.length <= 1;

  const nextLessonInDay = !isEndOfDayLesson && lessonIndexInDay >= 0 ? dayLessons[lessonIndexInDay + 1] : null;

  const dayMilestone = course.studyDays?.find((d) => d.dayNumber === currentDayNumber);
  const [dayCheckinPassed, setDayCheckinPassed] = useState<boolean>(dayMilestone?.isPassed ?? false);
  const [dayCheckinScore, setDayCheckinScore] = useState<number | null>(dayMilestone?.score ?? null);
  const [showDayCheckinModal, setShowDayCheckinModal] = useState<boolean>(false);
  const [isSubmittingDayCheckin, setIsSubmittingDayCheckin] = useState(false);

  useEffect(() => {
    if (dayMilestone) {
      setDayCheckinPassed(dayMilestone.isPassed ?? false);
      setDayCheckinScore(dayMilestone.score ?? null);
    }
  }, [dayMilestone]);

  // Track and store scrollY position in local state and persistent storage
  useEffect(() => {
    const mainEl = document.querySelector('main');

    const handleScroll = () => {
      const currentY = Math.max(
        0,
        mainEl ? mainEl.scrollTop : window.scrollY || document.documentElement.scrollTop
      );

      // Track and store scrollY position of active lesson content in local state
      setScrollY(currentY);

      if (scrollSaveTimerRef.current) {
        clearTimeout(scrollSaveTimerRef.current);
      }

      scrollSaveTimerRef.current = setTimeout(() => {
        if (currentY > 50) {
          const posData = {
            scrollY: Math.round(currentY),
            dayNumber: currentDayNumber,
            updatedAt: Date.now(),
          };

          try {
            localStorage.setItem(`mindly_reading_${lesson.id}`, JSON.stringify(posData));
            localStorage.setItem(
              `mindly_course_last_read_${course.id}`,
              JSON.stringify({
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                dayNumber: currentDayNumber,
                scrollY: Math.round(currentY),
                updatedAt: Date.now(),
              })
            );
          } catch {
            // Ignore
          }

          api.saveReadingPosition(lesson.id, {
            scrollY: currentY,
            dayNumber: currentDayNumber,
          }).catch(() => {});
        }
      }, 350);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
      if (scrollSaveTimerRef.current) {
        clearTimeout(scrollSaveTimerRef.current);
      }
    };
  }, [lesson.id, lesson.title, course.id, currentDayNumber]);

  // Concept Reference Drawer state
  const [selectedDrawerTerm, setSelectedDrawerTerm] = useState<KeyTermItem | null>(null);

  // AI Tutor Drawer state
  const [showTutor, setShowTutor] = useState(false);
  const [tutorQuery, setTutorQuery] = useState('');
  const [tutorMessages, setTutorMessages] = useState<
    Array<{ sender: 'user' | 'tutor'; text: string; groundedInSource?: boolean }>
  >([
    {
      sender: 'tutor',
      text: `Hello! I'm your Mindly study assistant for "${lesson.title}". What would you like clarified from this lesson?`,
      groundedInSource: true,
    },
  ]);
  const [isTutorThinking, setIsTutorThinking] = useState(false);

  // Bookmark and Complete actions
  const handleToggleBookmark = async () => {
    try {
      const res = await api.toggleBookmark(lesson.id);
      onLessonUpdated(res.lesson);
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  };

  const handleToggleComplete = async () => {
    try {
      const res = await api.toggleComplete(lesson.id);
      onLessonUpdated(res.lesson);
    } catch (err) {
      console.error('Complete error:', err);
    }
  };

  // Spaced Repetition Review Handlers
  const [srSubmitting, setSrSubmitting] = useState(false);
  const [srFeedback, setSrFeedback] = useState<string | null>(null);

  const handleLogSpacedReview = async (rating: SpacedRepetitionRating) => {
    if (srSubmitting) return;
    setSrSubmitting(true);
    try {
      const res = await api.recordLessonReview(lesson.id, rating);
      onLessonUpdated(res.lesson);
      setSrFeedback(`Recall recorded (${rating.toUpperCase()}). Next review in ${res.nextReviewInDays} days!`);
      setTimeout(() => setSrFeedback(null), 4000);
    } catch (err) {
      console.error('Spaced review error:', err);
    } finally {
      setSrSubmitting(false);
    }
  };

  const handleInitSpacedReview = async () => {
    if (srSubmitting) return;
    setSrSubmitting(true);
    try {
      const res = await api.initLessonReview(lesson.id);
      onLessonUpdated(res.lesson);
      setSrFeedback('Enrolled in optimal spaced-repetition retention!');
      setTimeout(() => setSrFeedback(null), 4000);
    } catch (err) {
      console.error('Init spaced review error:', err);
    } finally {
      setSrSubmitting(false);
    }
  };

  // Save manual lesson edits
  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      const updated = {
        ...lesson,
        title: editedTitle,
        structuredContent: editedContent,
      };
      await persistenceEngine.saveLesson(updated);
      const res = await api.updateLesson(lesson.id, {
        title: editedTitle,
        structuredContent: editedContent,
      });
      if (res.lesson) {
        await persistenceEngine.saveLesson(res.lesson);
        onLessonUpdated(res.lesson);
      } else {
        onLessonUpdated(updated);
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Send question to AI Tutor
  const handleAskTutor = async (questionText?: string) => {
    const q = questionText || tutorQuery;
    if (!q.trim() || isTutorThinking) return;

    const newMessages = [...tutorMessages, { sender: 'user' as const, text: q }];
    setTutorMessages(newMessages);
    setTutorQuery('');
    setIsTutorThinking(true);

    try {
      const res = await api.askTutor({
        question: q,
        lessonId: lesson.id,
        lessonContext: lesson.structuredContent,
        courseContext: course.title,
        originalMaterial: lesson.originalMaterial?.content,
      });
      setTutorMessages([
        ...newMessages,
        {
          sender: 'tutor',
          text: res.answer,
          groundedInSource: res.groundedInSource ?? true,
        },
      ]);
    } catch (err) {
      setTutorMessages([
        ...newMessages,
        {
          sender: 'tutor',
          text: 'Sorry, I encountered an issue connecting to the tutoring engine. Please try again.',
        },
      ]);
    } finally {
      setIsTutorThinking(false);
    }
  };

  // Complete End-of-Day Check-in Quiz
  const handleCompleteDayCheckin = async (score: number, total: number) => {
    const pct = Math.round((score / (total || 1)) * 100);
    setIsSubmittingDayCheckin(true);
    try {
      const res = await api.passDayCheckin(course.id, currentDayNumber, pct, total);
      setDayCheckinPassed(true);
      setDayCheckinScore(pct);
      setShowDayCheckinModal(false);
      if (onCourseUpdated) {
        onCourseUpdated(res.course, res.lessons);
      }
    } catch (err) {
      console.error('Failed to record day checkin:', err);
    } finally {
      setIsSubmittingDayCheckin(false);
    }
  };

  // Actionable feedback jump to section in study notes
  const handleJumpToSection = (sectionTitleOrId: string) => {
    try {
      const headingElements = Array.from(document.querySelectorAll('h2, h3, h4, section, p'));
      const target = headingElements.find((el) =>
        el.textContent?.toLowerCase().includes(sectionTitleOrId.toLowerCase().slice(0, 25))
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('bg-[#00B4FF]/25', 'p-2', 'rounded-xl', 'transition-all');
        setTimeout(() => {
          target.classList.remove('bg-[#00B4FF]/25');
        }, 3500);
      }
    } catch (e) {
      console.warn('Scroll to section notice:', e);
    }
  };

  // Collect 3 to 5 questions for Day Check-in Quiz
  const getDayCheckinQuestions = (): ReviewQuestion[] => {
    const gathered: ReviewQuestion[] = [];
    if (dayMilestone?.checkInQuiz && dayMilestone.checkInQuiz.length > 0) {
      dayMilestone.checkInQuiz.forEach((q) => {
        gathered.push({
          ...q,
          sectionTitle: q.sectionTitle || lesson.title,
          context: q.context || lesson.title,
        });
      });
    }
    dayLessons.forEach((l) => {
      if (Array.isArray(l.structuredContent?.reviewQuestions)) {
        l.structuredContent.reviewQuestions.forEach((q) => {
          gathered.push({
            ...q,
            sectionTitle: q.sectionTitle || l.title,
            context: q.context || l.title,
          });
        });
      }
    });

    if (gathered.length < 3) {
      dayLessons.forEach((l, idx) => {
        const overview = l.structuredContent?.overview || l.title;
        gathered.push({
          id: `dyn_chk_${currentDayNumber}_${idx + 1}`,
          question: `Regarding "${l.title}", which statement correctly represents the core concept?`,
          type: 'multiple_choice',
          options: [
            overview.slice(0, 95) || 'Applied understanding of key mechanisms',
            'Superficial memorization without underlying principles',
            'Arbitrary conventions with no foundational causality',
            'Ignoring real-world boundaries and structural rules',
          ],
          answer: overview.slice(0, 95) || 'Applied understanding of key mechanisms',
          explanation: `In "${l.title}": ${overview.slice(0, 160)}`,
          sectionTitle: l.title,
        });
      });
    }

    const shuffled = [...gathered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(Math.max(3, shuffled.length), 5));
  };

  const handleRetakeDayCheckin = (): ReviewQuestion[] => {
    return getDayCheckinQuestions();
  };

  const handleProceedNextDay = () => {
    const nextDayLessons = safeLessons
      .filter((l) => (l.dayNumber || 1) === currentDayNumber + 1)
      .sort((a, b) => a.order - b.order);
    if (nextDayLessons.length > 0 && onNavigateLesson) {
      onNavigateLesson(nextDayLessons[0]);
    } else {
      onBack();
    }
  };

  // Font size class mapping
  const textSizeClass =
    fontSize === 'xlarge'
      ? 'text-lg leading-relaxed'
      : fontSize === 'large'
      ? 'text-base leading-relaxed'
      : 'text-sm leading-relaxed';

  return (
    <div className={`min-h-screen bg-[#0c0d10] text-zinc-100 flex flex-col transition-all ${isFocus ? 'focus-mode-active' : ''}`}>
      {/* Focus Mode Ambient Reading Progress Bar */}
      {isFocus && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-[#1a1c24] z-50">
          <div
            className="h-full bg-gradient-to-r from-[#00B4FF] via-sky-400 to-[#00B4FF] transition-all duration-150 ease-out shadow-sm shadow-[#00B4FF]/40"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      )}

      {/* 1. MINIMALIST STICKY TOP BAR (With Back, Timer, Focus Mode, More Options) */}
      <header className={`sticky top-0 z-30 transition-all ${
        isFocus
          ? 'bg-[#0c0d10]/95 backdrop-blur-md border-b border-[#1f212a] px-4 sm:px-8 py-3'
          : 'bg-[#111216]/95 backdrop-blur-md border-b border-[#20222a] px-4 sm:px-6 py-2.5'
      }`}>
        <div className={`${isFocus ? 'max-w-5xl' : 'max-w-4xl'} mx-auto flex items-center justify-between gap-3`}>
          {/* Item 1 (Left): Back Button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer text-xs font-semibold shrink-0"
            title="Back to Course"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {/* Item 2 (Center): Focus Indicator (Timer is now ambient in Floating Bottom-Right badge) */}
          <div className="flex items-center gap-2">
            {isFocus && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00B4FF]/15 border border-[#00B4FF]/30 text-[#00B4FF] text-xs font-mono uppercase tracking-wider font-semibold">
                Focus Mode &bull; {scrollProgress}%
              </span>
            )}
          </div>

          {/* Item 3 (Right): Focus Mode Toggle & More Options Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Dedicated Focus Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleFocus}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isFocus
                  ? 'bg-[#00B4FF] text-[#0B1F44] border-[#00B4FF] shadow-md shadow-[#00B4FF]/25 font-bold hover:bg-[#009de0]'
                  : 'bg-[#181920] border-[#262833] text-zinc-300 hover:text-white hover:border-[#00B4FF]/60 hover:bg-[#20222a]'
              }`}
              title={isFocus ? 'Exit Focus Mode (Esc or F)' : 'Enter Focus Mode (F)'}
              aria-label={isFocus ? 'Exit Focus Mode' : 'Enter Focus Mode'}
            >
              {isFocus ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-[#00B4FF]" />}
              <span className="hidden sm:inline">{isFocus ? 'Exit Focus (Esc)' : 'Focus Mode'}</span>
            </button>

            {/* Single "More Options" Dropdown Menu */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                  showMoreMenu
                    ? 'bg-zinc-700 text-white border-zinc-600 shadow-md'
                    : 'bg-[#181920] border-[#262833] text-zinc-400 hover:text-white hover:bg-[#20222a]'
                }`}
                title="More Options"
                aria-label="More Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown Menu Panel */}
              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#14151b] border border-[#272935] shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 space-y-1">
                  {/* Focus Mode Action in Dropdown */}
                  <button
                    onClick={() => {
                      toggleFocus();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-zinc-300 hover:text-white hover:bg-[#1f212c] transition-colors cursor-pointer"
                  >
                    {isFocus ? (
                      <Minimize2 className="w-4 h-4 text-[#00B4FF]" />
                    ) : (
                      <Maximize2 className="w-4 h-4 text-[#00B4FF]" />
                    )}
                    <span>{isFocus ? 'Exit Focus Mode (Esc)' : 'Focus Mode (Distraction-Free)'}</span>
                  </button>
                {/* Text Sizing Row */}
                <div className="p-2 border-b border-[#22242f]">
                  <div className="text-[10px] font-mono uppercase text-zinc-400 mb-1.5 flex items-center justify-between">
                    <span>Text Sizing</span>
                    <span className="text-zinc-500 font-semibold">{fontSize.toUpperCase()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#0c0d10] p-1 border border-[#1e2029]">
                    <button
                      onClick={() => setFontSize('normal')}
                      className={`py-1 rounded text-xs transition-colors font-medium cursor-pointer ${
                        fontSize === 'normal' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      A
                    </button>
                    <button
                      onClick={() => setFontSize('large')}
                      className={`py-1 rounded text-xs transition-colors font-medium cursor-pointer ${
                        fontSize === 'large' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      A+
                    </button>
                    <button
                      onClick={() => setFontSize('xlarge')}
                      className={`py-1 rounded text-xs transition-colors font-medium cursor-pointer ${
                        fontSize === 'xlarge' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      A++
                    </button>
                  </div>
                </div>

                {/* Bookmark Action */}
                <button
                  onClick={() => {
                    handleToggleBookmark();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-zinc-300 hover:text-white hover:bg-[#1f212c] transition-colors cursor-pointer"
                >
                  <Bookmark
                    className={`w-4 h-4 ${lesson.isBookmarked ? 'text-amber-400 fill-amber-400/20' : 'text-zinc-400'}`}
                  />
                  <span>{lesson.isBookmarked ? 'Remove Bookmark' : 'Bookmark Lesson'}</span>
                </button>

                {/* Mark Complete Action */}
                <button
                  onClick={() => {
                    handleToggleComplete();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-zinc-300 hover:text-white hover:bg-[#1f212c] transition-colors cursor-pointer"
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${lesson.isCompleted ? 'text-emerald-400' : 'text-zinc-400'}`}
                  />
                  <span>{lesson.isCompleted ? 'Mark as Incomplete' : 'Mark Complete'}</span>
                </button>

                {/* Test Yourself Action */}
                {lesson.structuredContent?.reviewQuestions && lesson.structuredContent.reviewQuestions.length > 0 && (
                  <button
                    onClick={() => {
                      setShowQuizModal(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/40 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                    <span>Test Yourself ({lesson.structuredContent.reviewQuestions.length} Questions)</span>
                  </button>
                )}

                {/* Add Note Action */}
                <button
                  onClick={() => {
                    onOpenAddNote(course.id, lesson.id, `Notes on ${lesson.title}`);
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-zinc-300 hover:text-white hover:bg-[#1f212c] transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span>Add Note</span>
                </button>

                {/* Edit Lesson Action */}
                <button
                  onClick={() => {
                    setIsEditing(!isEditing);
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-zinc-300 hover:text-white hover:bg-[#1f212c] transition-colors cursor-pointer"
                >
                  <Edit className="w-4 h-4 text-zinc-400" />
                  <span>{isEditing ? 'Cancel Editing' : 'Edit Lesson Content'}</span>
                </button>

                {/* AI Tutor Assistant Action */}
                <button
                  onClick={() => {
                    setShowTutor(!showTutor);
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left text-zinc-300 hover:text-white hover:bg-[#1f212c] transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span>{showTutor ? 'Hide Lesson Tutor' : 'Ask Lesson Tutor'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </header>

      {/* Main Reading Section Container */}
      <div
        className={`flex-1 w-full mx-auto p-4 sm:p-8 space-y-6 transition-all ${
          isFocus ? 'max-w-3xl sm:max-w-4xl py-6 sm:py-12' : 'max-w-4xl'
        }`}
      >
        {/* Workspace Mode Tabs: Structured Lesson vs Original Material */}
        <div className="flex items-center justify-between border-b border-[#22242c] pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('structured')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'structured'
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Structured Lesson</span>
            </button>
            <button
              onClick={() => setActiveTab('original')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'original'
                  ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Original Material (Preserved)</span>
            </button>
          </div>

          {activeTab === 'structured' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAddNote(course.id, lesson.id, `Notes on ${lesson.title}`)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>+ Add Note</span>
              </button>

              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Edits'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab 1: STRUCTURED LESSON */}
        {activeTab === 'structured' ? (
          <article className="space-y-8 animate-in fade-in duration-150">
            {/* Demo marker notice */}
            {lesson.isDemo && (
              <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-[11px] text-indigo-300 flex items-center justify-between">
                <span>[Guided Curriculum] Structured learning material.</span>
                <span className="text-zinc-400">Untouched original source preserved in tab</span>
              </div>
            )}

            {/* Spaced Repetition Optimal Retention Widget */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#081734] border border-[#1a366f] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-[#00B4FF]" />
                  <span className="text-xs font-semibold text-[#9bb1d6] uppercase tracking-wider">
                    Spaced Repetition Engine
                  </span>
                  {lesson.spacedRepetition ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 font-bold">
                      Stage {lesson.spacedRepetition.stage}/5 · {lesson.spacedRepetition.intervalDays}d Interval
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Not Scheduled
                    </span>
                  )}
                </div>

                {lesson.spacedRepetition && (
                  <div className="text-xs text-[#9bb1d6]">
                    Next Review:{' '}
                    <span className="font-semibold text-white">
                      {new Date(lesson.spacedRepetition.nextReviewDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>{' '}
                    {new Date(lesson.spacedRepetition.nextReviewDate).getTime() <= Date.now() && (
                      <span className="text-[10px] font-mono text-[#00B4FF] font-bold uppercase ml-1">
                        (Due Now)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {srFeedback && (
                <div className="p-2 rounded-lg bg-[#00B4FF]/15 border border-[#00B4FF]/40 text-xs text-[#00B4FF] font-medium animate-in fade-in">
                  {srFeedback}
                </div>
              )}

              {lesson.spacedRepetition ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-full rounded-sm transition-colors ${
                          lvl <= (lesson.spacedRepetition?.stage || 1)
                            ? 'bg-[#00B4FF]'
                            : 'bg-[#1a366f]'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <span className="text-[10px] font-mono uppercase text-[#627ca8]">
                      Log Study Recall:
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 w-full sm:w-auto">
                      <button
                        disabled={srSubmitting}
                        onClick={() => handleLogSpacedReview('again')}
                        className="px-2.5 py-1 rounded-lg bg-[#0B1F44] border border-[#1a366f] hover:border-red-400 hover:text-red-400 text-center text-[11px] font-semibold text-[#9bb1d6] transition-all cursor-pointer disabled:opacity-50"
                      >
                        Again (1d)
                      </button>
                      <button
                        disabled={srSubmitting}
                        onClick={() => handleLogSpacedReview('hard')}
                        className="px-2.5 py-1 rounded-lg bg-[#0B1F44] border border-[#1a366f] hover:border-amber-400 hover:text-amber-400 text-center text-[11px] font-semibold text-[#9bb1d6] transition-all cursor-pointer disabled:opacity-50"
                      >
                        Hard (~2d)
                      </button>
                      <button
                        disabled={srSubmitting}
                        onClick={() => handleLogSpacedReview('good')}
                        className="px-2.5 py-1 rounded-lg bg-[#0B1F44] border border-[#1a366f] hover:border-[#00B4FF] hover:text-[#00B4FF] text-center text-[11px] font-semibold text-[#9bb1d6] transition-all cursor-pointer disabled:opacity-50"
                      >
                        Good (~5d)
                      </button>
                      <button
                        disabled={srSubmitting}
                        onClick={() => handleLogSpacedReview('easy')}
                        className="px-2.5 py-1 rounded-lg bg-[#0B1F44] border border-[#1a366f] hover:border-emerald-400 hover:text-emerald-400 text-center text-[11px] font-semibold text-[#9bb1d6] transition-all cursor-pointer disabled:opacity-50"
                      >
                        Easy (~10d)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-[#9bb1d6]">
                    Reinforce this lesson by placing it on an optimal Leitner/SM-2 review interval.
                  </p>
                  <button
                    disabled={srSubmitting}
                    onClick={handleInitSpacedReview}
                    className="px-3 py-1.5 rounded-lg bg-[#00B4FF] text-[#0B1F44] text-xs font-bold hover:bg-[#009de0] transition-colors cursor-pointer shrink-0"
                  >
                    Schedule Review
                  </button>
                </div>
              )}
            </div>

            {/* 2. READING SECTION HEADER: DAY INDICATOR BADGE & RELOCATED LESSON TITLE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4 shadow-sm">
              {/* Day Header Badge */}
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00B4FF]/10 border border-[#00B4FF]/30 text-[#00B4FF] text-xs font-mono font-bold tracking-wider uppercase">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    DAY {currentDayNumber} OF {totalDays} &bull; LESSON {lessonNumberInDay} OF {dayLessons.length}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-medium hidden sm:inline">
                  {course.title}
                </span>
              </div>

              {/* Bold Relocated Lesson Title */}
              {!isEditing ? (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 leading-tight">
                    {lesson.structuredContent?.title || lesson.title}
                  </h1>
                  <p className={`text-zinc-300 ${textSizeClass}`}>
                    {lesson.structuredContent?.overview}
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 block mb-1">Lesson Title</label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full px-3 py-2 text-base font-bold rounded-xl bg-[#090a0d] border border-[#272935] text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-zinc-400 block mb-1">Lesson Overview</label>
                    <textarea
                      rows={3}
                      value={editedContent.overview}
                      onChange={(e) =>
                        setEditedContent({ ...editedContent, overview: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#090a0d] border border-[#272935] text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Learning Objectives */}
            {lesson.structuredContent?.learningObjectives &&
              lesson.structuredContent.learningObjectives.length > 0 && (
                <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e]">
                  <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    Learning Objectives
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {lesson.structuredContent.learningObjectives.map((obj, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0e0f12] border border-[#1f2027] text-xs text-zinc-200"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Main Concepts */}
            <div className="space-y-6">
              {lesson.structuredContent?.mainConcepts?.map((concept, idx) => (
                <div
                  key={concept.id || idx}
                  className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4"
                >
                  <h3 className="text-base sm:text-lg font-semibold text-white">
                    {concept.title}
                  </h3>
                  <p className={`text-zinc-300 ${textSizeClass}`}>{concept.explanation}</p>

                  {/* Subtopics */}
                  {concept.subtopics && concept.subtopics.length > 0 && (
                    <div className="space-y-3 pt-2 pl-3 sm:pl-4 border-l-2 border-indigo-500/40">
                      {concept.subtopics.map((sub, sIdx) => (
                        <div key={sIdx} className="space-y-1">
                          <h4 className="text-xs font-semibold text-indigo-300">{sub.title}</h4>
                          <p className={`text-zinc-400 ${textSizeClass}`}>{sub.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Visual Process Architecture (Concept Diagrams) */}
            {lesson.structuredContent?.diagrams && lesson.structuredContent.diagrams.length > 0 && (
              <DiagramViewer diagrams={lesson.structuredContent.diagrams} />
            )}

            {/* Real-World Royalty-Free Images & Scientific Illustrations */}
            {lesson.structuredContent?.images && lesson.structuredContent.images.length > 0 && (
              <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                      Real-World Visual Evidence & Reference Imagery
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Verified public-domain and Creative Commons scientific diagrams & photography
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {lesson.structuredContent.images.map((img, iIdx) => (
                    <div
                      key={iIdx}
                      className="group rounded-xl overflow-hidden bg-[#0a0b0e] border border-[#1f2027] hover:border-indigo-500/40 transition-all flex flex-col"
                    >
                      <div className="relative aspect-video w-full bg-[#12131a] overflow-hidden flex items-center justify-center p-2">
                        <img
                          src={img.url}
                          alt={img.caption}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                        <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                          {img.caption}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-t border-[#1a1b23]">
                          <span className="truncate max-w-[210px]" title={img.source}>
                            {img.source}
                          </span>
                          <a
                            href={img.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#00B4FF] hover:underline shrink-0 flex items-center gap-1 font-mono"
                          >
                            <span>High-Res</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Important Distinctions */}
            {(lesson.structuredContent?.importantDistinctions?.length ?? 0) > 0 && (
              <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e]">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Important Distinctions (Avoid Confusion)
                </h2>
                <div className="space-y-3">
                  {lesson.structuredContent?.importantDistinctions?.map((dist, dIdx) => (
                    <div
                      key={dIdx}
                      className="p-4 rounded-xl bg-[#0e0f12] border border-[#1f2027] space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 font-semibold border border-indigo-800/40">
                          {dist.conceptA}
                        </span>
                        <span className="text-zinc-500 font-bold">vs</span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                          {dist.conceptB}
                        </span>
                      </div>
                      <p className={`text-zinc-300 ${textSizeClass}`}>{dist.distinction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Glossary / Key Terms */}
            {(lesson.structuredContent?.keyTerms?.length ?? 0) > 0 && (
              <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e]">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Key Terms & Definitions
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lesson.structuredContent?.keyTerms?.map((term, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-4 rounded-xl bg-[#0e0f12] border border-[#1f2027] space-y-1.5"
                    >
                      <h4 className="text-xs font-bold text-white tracking-wide">{term.term}</h4>
                      <p className={`text-zinc-300 ${textSizeClass}`}>{term.definition}</p>
                      {term.context && (
                        <p className="text-[11px] text-zinc-500 italic pt-1 border-t border-[#1a1b22]">
                          "{term.context}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Takeaways */}
            {(lesson.structuredContent?.keyTakeaways?.length ?? 0) > 0 && (
              <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e]">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Key Takeaways
                </h2>
                <ul className="space-y-2.5">
                  {lesson.structuredContent?.keyTakeaways?.map((takeaway, tkIdx) => (
                    <li key={tkIdx} className="flex items-start gap-3 text-xs text-zinc-200">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 font-mono text-[10px]">
                        {tkIdx + 1}
                      </span>
                      <span className={textSizeClass}>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Transparent Pedagogical Origin Badges */}
            <div className="p-4 rounded-xl bg-[#0e0f12] border border-[#1f2027] text-xs space-y-2">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Source Attribution & Grounding
              </div>
              {lesson.structuredContent?.fromMaterialNotes && (
                <div className="flex items-start gap-2 text-zinc-300">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 shrink-0">
                    From Material
                  </span>
                  <span>{lesson.structuredContent.fromMaterialNotes}</span>
                </div>
              )}
              {lesson.structuredContent?.aiExplanations && (
                <div className="flex items-start gap-2 text-zinc-300">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40 shrink-0">
                    AI Clarification
                  </span>
                  <span>{lesson.structuredContent.aiExplanations}</span>
                </div>
              )}
            </div>

            {/* 3. END-OF-DAY PROGRESSION FLOW & NEXT DAY BUTTON */}
            <div className="pt-4 pb-8 border-t border-[#1f212c]">
              {/* Scenario A: There is another lesson in today's study block */}
              {nextLessonInDay ? (
                <div className="p-6 rounded-2xl bg-[#081734] border border-[#1a366f] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#00B4FF] font-bold">
                      Day {currentDayNumber} Pacing &bull; Lesson {lessonNumberInDay} of {dayLessons.length}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">
                      Ready for the next lesson?
                    </h3>
                    <p className="text-xs text-[#9bb1d6] mt-0.5">
                      Continue to "{nextLessonInDay.title}"
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (onNavigateLesson) {
                        onNavigateLesson(nextLessonInDay);
                      }
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] font-bold text-xs transition-all shadow-lg shadow-[#00B4FF]/25 cursor-pointer shrink-0"
                  >
                    <span>Next Lesson</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : isEndOfDayLesson ? (
                /* Scenario B: End of the Day reached -> Milestone Gate Card */
                <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#091838] to-[#07132b] border border-[#1a366f] shadow-xl space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF] shrink-0">
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#00B4FF]">
                            Day {currentDayNumber} Milestone Gate
                          </span>
                          {dayCheckinPassed && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                              Passed ({dayCheckinScore || 100}%)
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                          Day {currentDayNumber} Complete!
                        </h2>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-[#9bb1d6] leading-relaxed">
                    {dayCheckinPassed
                      ? `Congratulations! You've mastered all learning objectives and passed the Day ${currentDayNumber} Milestone Check-in.`
                      : `You have completed all reading material for Day ${currentDayNumber}. Complete the required Daily Check-in Quiz (3–5 questions) to verify your recall and unlock Day ${currentDayNumber + 1}.`}
                  </p>

                  {/* Milestone Action Area */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {!dayCheckinPassed ? (
                      <button
                        onClick={() => setShowDayCheckinModal(true)}
                        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs sm:text-sm hover:bg-[#009de0] transition-all shadow-lg shadow-[#00B4FF]/30 cursor-pointer"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>Take Day {currentDayNumber} Check-in Quiz</span>
                      </button>
                    ) : (
                      /* Revealed "Proceed to Next Day" button upon completing the daily quiz */
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-between">
                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Day {currentDayNumber} Milestone Cleared &bull; Next Day Unlocked</span>
                        </div>

                        {currentDayNumber < totalDays ? (
                          <button
                            onClick={() => {
                              const nextDayLessons = safeLessons
                                .filter((l) => (l.dayNumber || 1) === currentDayNumber + 1)
                                .sort((a, b) => a.order - b.order);
                              if (nextDayLessons.length > 0 && onNavigateLesson) {
                                onNavigateLesson(nextDayLessons[0]);
                              } else {
                                onBack();
                              }
                            }}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs sm:text-sm hover:bg-[#009de0] transition-all shadow-xl shadow-[#00B4FF]/30 cursor-pointer animate-in fade-in"
                          >
                            <span>Proceed to Day {currentDayNumber + 1}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={onBack}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-amber-400 text-[#0B1F44] font-bold text-xs sm:text-sm hover:bg-amber-300 transition-all shadow-xl shadow-amber-400/30 cursor-pointer"
                          >
                            <span>All Days Completed! Take Final Exam</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        ) : (
          /* Tab 2: UNTOUCHED ORIGINAL MATERIAL */
          <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#20222a]">
              <div>
                <h3 className="text-sm font-semibold text-white">Original Raw Material</h3>
                <p className="text-xs text-zinc-400">
                  Imported on{' '}
                  {new Date(lesson.originalMaterial?.uploadedAt || lesson.createdAt).toLocaleDateString()}{' '}
                  • Source: {lesson.originalMaterial?.sourceTitle || 'Knowledge Dump'}
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 uppercase">
                {lesson.originalMaterial?.type || 'Text'}
              </span>
            </div>

            {/* If image material was uploaded */}
            {lesson.originalMaterial?.type === 'image' && (
              <div className="rounded-xl overflow-hidden border border-[#262833] max-w-xl">
                <img
                  src={lesson.originalMaterial.content}
                  alt="Raw uploaded diagram"
                  className="w-full h-auto object-contain max-h-96"
                />
              </div>
            )}

            {/* Raw Text display */}
            <div className="p-4 rounded-xl bg-[#090a0d] border border-[#1b1c22] font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {lesson.originalMaterial?.content || 'No text content available'}
            </div>
          </div>
        )}
      </div>

      {/* AI Tutor Slide-Over Drawer */}
      {showTutor && (
        <aside className="fixed bottom-0 right-0 sm:top-14 sm:bottom-0 w-full sm:w-96 bg-[#131418] border-t sm:border-t-0 sm:border-l border-[#272932] shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-200 h-[75vh] sm:h-auto">
          {/* Tutor Header */}
          <div className="p-4 border-b border-[#20222a] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Lesson Tutor</h3>
                <p className="text-[10px] text-zinc-400">Grounded strictly in this lesson's material</p>
              </div>
            </div>
            <button
              onClick={() => setShowTutor(false)}
              className="p-1 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Question Prompts */}
          <div className="p-3 bg-[#0c0d10] border-b border-[#1e2026] flex gap-1.5 overflow-x-auto">
            <button
              onClick={() => handleAskTutor('Explain this in simpler language with an analogy')}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded bg-[#181920] hover:bg-[#20222a] text-zinc-300 border border-[#272935] cursor-pointer"
            >
              Simpler explanation
            </button>
            <button
              onClick={() => handleAskTutor('What are the most common mistakes beginners make here?')}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded bg-[#181920] hover:bg-[#20222a] text-zinc-300 border border-[#272935] cursor-pointer"
            >
              Common mistakes
            </button>
            <button
              onClick={() => handleAskTutor('Give me another practical scenario')}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded bg-[#181920] hover:bg-[#20222a] text-zinc-300 border border-[#272935] cursor-pointer"
            >
              Extra example
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {tutorMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}
              >
                {msg.sender === 'tutor' && msg.groundedInSource !== undefined && (
                  <div className="flex items-center gap-1.5 px-1">
                    {msg.groundedInSource ? (
                      <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        From Your Material
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-indigo-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        AI Explanation
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-[#1a1b22] border border-[#282a35] text-zinc-200 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isTutorThinking && (
              <div className="flex items-center gap-2 text-xs text-indigo-400 p-2 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Thinking using your lesson material...</span>
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="p-3 border-t border-[#20222a] bg-[#111216]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskTutor();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about this lesson..."
                value={tutorQuery}
                onChange={(e) => setTutorQuery(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0a0b0e] border border-[#252732] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!tutorQuery.trim() || isTutorThinking}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </aside>
      )}

      {/* Concept Reference Drawer */}
      {selectedDrawerTerm && (
        <ConceptReferenceDrawer
          isOpen={!!selectedDrawerTerm}
          onClose={() => setSelectedDrawerTerm(null)}
          term={selectedDrawerTerm}
          lessonTitle={lesson.title}
          courseTitle={course.title}
        />
      )}

      {/* Formative Lesson Quiz Modal */}
      {showQuizModal && (
        <QuizModal
          isOpen={showQuizModal}
          onClose={() => setShowQuizModal(false)}
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          questions={lesson.structuredContent?.reviewQuestions || []}
          onQuizCompleted={(score, total) => {
            const updated = { ...lesson, quizScore: Math.round((score / total) * 100) };
            onLessonUpdated(updated);
          }}
        />
      )}

      {/* End-of-Day Milestone Gate Check-in Quiz Modal */}
      {showDayCheckinModal && (
        <QuizModal
          isOpen={showDayCheckinModal}
          onClose={() => setShowDayCheckinModal(false)}
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          title={`Day ${currentDayNumber} Milestone Check-in Quiz`}
          subtitle={`Day ${currentDayNumber} of ${totalDays} Milestone Gate`}
          questions={getDayCheckinQuestions()}
          onRetakeQuiz={handleRetakeDayCheckin}
          onJumpToSection={handleJumpToSection}
          onProceedNextDay={handleProceedNextDay}
          passingScorePercent={60}
          onQuizCompleted={(score, total) => {
            handleCompleteDayCheckin(score, total);
          }}
        />
      )}

      {/* Floating Bottom-Right Active Study Session Timer */}
      <aside
        aria-label="Active Study Session Timer"
        className="fixed bottom-6 right-5 md:bottom-8 md:right-8 z-40 select-none pointer-events-auto"
      >
        <div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B1F44]/80 hover:bg-[#0B1F44]/95 border border-[#00B4FF]/40 text-white font-mono text-xs shadow-2xl backdrop-blur-md transition-all group"
          title="Active study session timer"
        >
          <div className="relative flex items-center justify-center w-2 h-2">
            <span className="absolute w-full h-full rounded-full bg-[#00B4FF] animate-ping opacity-75" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-[#00B4FF]" />
          </div>
          <Clock className="w-3.5 h-3.5 text-[#00B4FF] shrink-0" />
          <span className="font-semibold text-white tracking-wide">
            {Math.floor(sessionSeconds / 60)}m {String(sessionSeconds % 60).padStart(2, '0')}s
          </span>
        </div>
      </aside>

      {/* Visual Indicator: Resumed from last position */}
      {resumedPositionNotice && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#0B1F44]/95 border border-[#00B4FF]/50 text-[#00B4FF] text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 select-none">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00B4FF] animate-ping" />
            <span className="text-white">Resumed from last position</span>
          </span>
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              const mainEl = document.querySelector('main');
              if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
              setScrollY(0);
              setResumedPositionNotice(false);
            }}
            className="text-[11px] underline text-[#9bb1d6] hover:text-[#00B4FF] cursor-pointer ml-1"
          >
            Jump to Top
          </button>
          <button
            type="button"
            onClick={() => setResumedPositionNotice(false)}
            className="p-1 rounded-full text-[#9bb1d6] hover:text-white cursor-pointer ml-1"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
