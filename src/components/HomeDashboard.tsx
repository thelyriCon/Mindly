import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Check,
  BookOpen,
  Plus,
  Compass,
} from 'lucide-react';
import { User, Course, ActivityItem, StudyProgress } from '../types';
import { api } from '../lib/api';
import { getEducationalPhotoUrl } from '../lib/educationalMedia';
import { CourseThumbnail } from './CourseThumbnail';
import { CourseOptionsMenu } from './CourseOptionsMenu';

interface HomeDashboardProps {
  user: User;
  courses: Course[];
  recentActivities: ActivityItem[];
  studyProgress?: StudyProgress;
  onUpdateStudyGoal?: (newGoalMinutes: number) => Promise<void>;
  onOpenAddMaterial: () => void;
  onSelectCourse: (course: Course) => void;
  onCourseUpdated?: (course: Course) => void;
  onCourseDeleted?: (courseId: string) => void;
  onOpenNewCourse: (initialTopic?: string) => void;
  onOpenNewNote?: () => void;
  onNavigateTab: (tab: any) => void;
  onSelectLessonDirect?: (courseId: string, lessonId: string) => void;
  onNoteCreated?: (note: any) => void;
  onNoteDeleted?: (noteId: string) => void;
  onSearch?: (query: string) => void;
}

/**
 * Extracts student initials for the top-left circular avatar.
 * For example: "Wangota Jimmy Marvin" -> "WJM", "Jimmy Marvin" -> "JM"
 */
function getStudentInitials(user: User): string {
  const fullName = (user.realName || user.name || '').trim();
  if (!fullName) return 'WJM';
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase();
  }
  if (parts.length === 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return 'WJM';
}

/**
 * Determines dynamic time-appropriate greeting based on local time.
 */
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  courses,
  recentActivities,
  studyProgress: initialProgress,
  onSelectCourse,
  onCourseUpdated,
  onCourseDeleted,
  onOpenNewCourse,
  onNavigateTab,
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user.profileImage]);

  // Live Study Progress state
  const [currentProgress, setCurrentProgress] = useState<StudyProgress>(
    initialProgress || {
      dailyGoalMinutes: user.dailyStudyGoalMinutes || 30,
      todaySeconds: 0,
      todayMinutes: 0,
      progressPercent: 0,
      streakDays: 0,
      remainingMinutes: user.dailyStudyGoalMinutes || 30,
      isGoalReached: false,
    }
  );

  useEffect(() => {
    let isMounted = true;
    api
      .getStudyProgress()
      .then((res) => {
        if (isMounted && res?.progress) {
          setCurrentProgress(res.progress);
        }
      })
      .catch((err) => {
        console.warn('[HomeDashboard] Failed to fetch live study progress:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Determine if student has studied today
  const isStudiedToday = Boolean(
    currentProgress.hasActivityToday ||
      (currentProgress.todayMinutes && currentProgress.todayMinutes > 0) ||
      (currentProgress.todaySeconds && currentProgress.todaySeconds > 0)
  );

  // Calculate 7-day activity indicators for the current week (Sunday through Saturday)
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    // Build set of recorded active date strings (YYYY-MM-DD)
    const activeDates = new Set<string>();

    if (recentActivities && recentActivities.length > 0) {
      recentActivities.forEach((act) => {
        if (act.timestamp) {
          const dStr = act.timestamp.split('T')[0];
          activeDates.add(dStr);
        }
      });
    }

    if (currentProgress.recentActivityDays && currentProgress.recentActivityDays.length > 0) {
      currentProgress.recentActivityDays.forEach((d) => {
        if (d.hasActivity) {
          activeDates.add(d.date);
        }
      });
    }

    // If active today, mark today's date
    if (isStudiedToday) {
      const todayStr = today.toISOString().split('T')[0];
      activeDates.add(todayStr);
    }

    // 7 days of the week: Su, Mo, Tu, We, Th, Fr, Sa
    const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return labels.map((label, index) => {
      const dayDate = new Date(sunday);
      dayDate.setDate(sunday.getDate() + index);
      const dateStr = dayDate.toISOString().split('T')[0];
      const isToday = index === currentDayOfWeek;
      const isPast = index < currentDayOfWeek;

      let isCompleted = activeDates.has(dateStr);

      // If user has streak days > 0 and no explicit activity logs for earlier days in current week,
      // reflect streak coverage accurately up to today
      if (!isCompleted && (isPast || (isToday && isStudiedToday))) {
        const diffFromToday = currentDayOfWeek - index;
        if (diffFromToday >= 0 && diffFromToday < (currentProgress.streakDays || 0)) {
          isCompleted = true;
        }
      }

      return {
        label,
        dateStr,
        isToday,
        isCompleted,
      };
    });
  }, [recentActivities, currentProgress, isStudiedToday]);

  // Maximum 3 relevant active course cards for Home view
  const displayCourses = useMemo(() => {
    return courses.filter((c) => !c.isArchived).slice(0, 3);
  }, [courses]);

  // Handle Search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      if (onSearch) {
        onSearch(trimmed);
      } else {
        onNavigateTab('search');
      }
    }
  };

  const studentInitials = getStudentInitials(user);
  const studentName = user.realName || user.name || 'Wangota Jimmy Marvin';
  const greeting = getTimeGreeting();

  return (
    <div className="min-h-full bg-[#06132D] text-white selection:bg-[#00B8F4] selection:text-[#06132D]">
      <div className="max-w-md sm:max-w-xl md:max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-28 sm:pb-32 space-y-5 sm:space-y-6">
        {/* ========================================================= */}
        {/* 1. HEADER: PROFILE ON LEFT, MINDLY WORDMARK ON RIGHT       */}
        {/* ========================================================= */}
        <header className="flex items-center justify-between pt-1 select-none">
          {/* Upper-left: Circular Profile Button with Profile Picture or Initials */}
          <button
            type="button"
            onClick={() => onNavigateTab('profile')}
            aria-label="View Student Profile"
            className="w-12 h-12 rounded-full border-[1.5px] border-[#00B8F4] bg-[#071b3b]/60 flex items-center justify-center text-white font-semibold text-sm sm:text-base tracking-wide hover:brightness-110 active:scale-95 transition-all cursor-pointer shadow-sm overflow-hidden"
          >
            {user.profileImage && !avatarError ? (
              <img
                src={user.profileImage}
                alt={studentName}
                className="w-full h-full object-cover rounded-full"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span>{studentInitials}</span>
            )}
          </button>

          {/* Upper-right: Mindly Wordmark */}
          <div className="text-right">
            <span className="text-3xl font-extrabold tracking-tight text-white font-sans">
              Mindly
            </span>
          </div>
        </header>

        {/* Thin Horizontal Blue/Cyan Divider */}
        <div className="h-[1px] w-full bg-gradient-to-r from-[#1a3a70]/60 via-[#00B8F4]/50 to-[#1a3a70]/60" />

        {/* ========================================================= */}
        {/* 2. GREETING: EXACTLY TWO LINES                            */}
        {/* ========================================================= */}
        <div className="space-y-0.5">
          <p className="text-2xl sm:text-3xl font-normal text-white/95 leading-tight tracking-tight">
            {greeting},
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {studentName}
          </h1>
        </div>

        {/* ========================================================= */}
        {/* 3. SEARCH BAR: WHITE PILL SHAPE                           */}
        {/* ========================================================= */}
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <div className="relative flex items-center w-full rounded-full bg-white px-4 py-3 sm:py-3.5 shadow-sm">
            <Search className="w-5 h-5 text-zinc-400 shrink-0 mr-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search new course or topic..."
              className="w-full bg-transparent text-sm sm:text-base text-zinc-800 placeholder-zinc-400 focus:outline-none"
            />
          </div>
        </form>

        {/* ========================================================= */}
        {/* 4. DAILY STREAK CARD: ROYAL BLUE TO CYAN GRADIENT         */}
        {/* ========================================================= */}
        <section
          aria-label="Daily Streak Progress"
          className="rounded-3xl p-5 sm:p-6 text-white shadow-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1E60FF 0%, #00B8F4 100%)',
          }}
        >
          {/* Top row: Heading & Status Pill */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Your daily streak!
            </h2>

            {/* Active Today Pill */}
            <div className="shrink-0 bg-white text-[#0B1F44] rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              <span className="text-xs font-bold text-[#0B1F44] whitespace-nowrap">
                {isStudiedToday ? 'Active Today' : 'Study Today'}
              </span>
            </div>
          </div>

          {/* Seven-Day Indicators: Su Mo Tu We Th Fr Sa */}
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {weekDays.map((day) => (
              <div key={day.label} className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                    day.isCompleted
                      ? 'bg-[#0048FF] shadow-sm'
                      : 'bg-white shadow-xs'
                  }`}
                >
                  {day.isCompleted && (
                    <Check className="w-5 h-5 text-white stroke-[3]" />
                  )}
                </div>
                <span className="text-xs font-semibold text-white mt-1.5 select-none">
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. MY COURSES SECTION: HEADER & CARDS                     */}
        {/* ========================================================= */}
        <div className="space-y-3.5 sm:space-y-4 pt-1">
          {/* Section Heading Row */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              My Courses
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('courses')}
              className="text-sm sm:text-base font-normal text-white/90 hover:text-white cursor-pointer transition-colors"
            >
              See all
            </button>
          </div>

          {/* Course Cards: Maximum 3 stacked horizontally */}
          {displayCourses.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#082747] border border-[#00B8F4]/30 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00B8F4]/10 text-[#00B8F4] flex items-center justify-center mx-auto">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">No courses enrolled yet</h3>
              <p className="text-xs text-[#9bb1d6] max-w-xs mx-auto">
                Explore discovery topics or create your first personalized curriculum to start learning.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenNewCourse()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00B8F4] text-[#06132D] text-xs font-bold hover:bg-[#00a3d9] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Create Course</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('search')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#082747] text-[#9bb1d6] hover:text-white border border-[#00B8F4]/30 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-[#00B8F4]" />
                  <span>Explore Discover</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-3.5">
              {displayCourses.map((course) => {
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
                    : 0;

                // Accurate singular/plural labels & helpful empty course state
                let lessonStatusText = '';
                if (totalLessons === 0) {
                  lessonStatusText = '0 Lessons · Curriculum Setup';
                } else if (totalLessons === 1) {
                  lessonStatusText = `${completedLessons}/1 Lesson - ${percent}%`;
                } else {
                  lessonStatusText = `${completedLessons}/${totalLessons} Lessons - ${percent}%`;
                }

                return (
                  <div
                    key={course.id}
                    onClick={() => onSelectCourse(course)}
                    className="flex h-[112px] sm:h-[120px] rounded-2xl border border-[#00B8F4]/40 hover:border-[#00B8F4] bg-[#082747] overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.01] shadow-lg group"
                  >
                    {/* Left Thumbnail (28-30% of card width, full height, object-cover) */}
                    <div className="w-[30%] min-w-[95px] sm:min-w-[120px] max-w-[145px] shrink-0 h-full relative overflow-hidden rounded-l-2xl">
                      <CourseThumbnail
                        title={course.title}
                        category={course.category}
                        coverImage={course.coverImage}
                        coverIcon={course.coverIcon}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {/* Right Course Information Panel */}
                    <div className="flex-1 p-3 sm:p-3.5 flex flex-col justify-between min-w-0 bg-[#082747] rounded-r-2xl">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-bold text-white truncate leading-tight">
                            {course.title}
                          </h3>
                          {course.description && (
                            <p className="text-xs text-[#9bb1d6] truncate mt-0.5 font-normal leading-tight">
                              {course.description}
                            </p>
                          )}
                        </div>
                        <CourseOptionsMenu
                          course={course}
                          onSelectCourse={onSelectCourse}
                          onCourseUpdated={onCourseUpdated}
                          onCourseDeleted={onCourseDeleted}
                          triggerButtonClassName="shrink-0 -mr-1 -mt-1"
                        />
                      </div>

                      <div className="mt-2 space-y-1.5">
                        <div className="text-xs text-white/90 font-medium truncate">
                          {lessonStatusText}
                        </div>
                        {/* Progress Bar: Pale Lavender Track & Blue-to-Cyan Fill */}
                        <div className="w-full h-1.5 sm:h-2 bg-[#D6DCED] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#285BFF] to-[#00B8F4] rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
