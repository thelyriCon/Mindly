import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  PlusCircle,
  FileText,
  Bookmark,
  CheckCircle2,
  ArrowRight,
  Clock,
  Layers,
  Award,
} from 'lucide-react';
import { User, Course, Lesson, ActivityItem, StudyProgress } from '../types';
import { DailyStudyGoal } from './DailyStudyGoal';
import { api } from '../lib/api';

interface HomeDashboardProps {
  user: User;
  courses: Course[];
  recentActivities: ActivityItem[];
  studyProgress?: StudyProgress;
  onUpdateStudyGoal?: (newGoalMinutes: number) => Promise<void>;
  onOpenAddMaterial: () => void;
  onSelectCourse: (course: Course) => void;
  onOpenNewCourse: () => void;
  onOpenNewNote: () => void;
  onNavigateTab: (tab: any) => void;
  onSelectLessonDirect?: (courseId: string, lessonId: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  user,
  courses,
  recentActivities,
  studyProgress: initialProgress,
  onUpdateStudyGoal,
  onOpenAddMaterial,
  onSelectCourse,
  onOpenNewCourse,
  onOpenNewNote,
  onNavigateTab,
  onSelectLessonDirect,
}) => {
  // Determine dynamic time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const primaryCourse = courses[0];

  // Daily Study Progress State
  const [currentProgress, setCurrentProgress] = useState<StudyProgress>(
    initialProgress || {
      dailyGoalMinutes: user.dailyStudyGoalMinutes || 30,
      todaySeconds: 12 * 60,
      todayMinutes: 12,
      progressPercent: 40,
      streakDays: 3,
      remainingMinutes: 18,
      isGoalReached: false,
    }
  );

  useEffect(() => {
    let isMounted = true;
    api
      .getStudyProgress()
      .then((res) => {
        if (isMounted) setCurrentProgress(res.progress);
      })
      .catch((err) => {
        console.error('Failed to load study progress:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateGoal = async (newGoal: number) => {
    try {
      const res = await api.updateStudyGoal(newGoal);
      setCurrentProgress(res.progress);
      if (onUpdateStudyGoal) {
        await onUpdateStudyGoal(newGoal);
      }
    } catch (err) {
      console.error('Failed to update study goal:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {getGreeting()}, {user.name}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Capture raw material, structure complex concepts, and build lasting knowledge.
          </p>
        </div>

        {/* Quick Dump Button */}
        <button
          onClick={onOpenAddMaterial}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 cursor-pointer self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>+ Add Material (Dump)</span>
        </button>
      </div>

      {/* Daily Study Goal Widget */}
      <DailyStudyGoal
        progress={currentProgress}
        onUpdateGoal={handleUpdateGoal}
        onStartStudying={primaryCourse ? () => onSelectCourse(primaryCourse) : undefined}
        primaryCourseTitle={primaryCourse?.title}
      />

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={onOpenAddMaterial}
          className="p-4 rounded-xl bg-[#131418] hover:bg-[#181920] border border-[#23252e] hover:border-indigo-500/50 text-left transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-white block">Add Material</span>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">Import text, image, notes</span>
        </button>

        <button
          onClick={onOpenNewCourse}
          className="p-4 rounded-xl bg-[#131418] hover:bg-[#181920] border border-[#23252e] hover:border-zinc-700 text-left transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-white block">New Course</span>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">Create learning subject</span>
        </button>

        <button
          onClick={onOpenNewNote}
          className="p-4 rounded-xl bg-[#131418] hover:bg-[#181920] border border-[#23252e] hover:border-zinc-700 text-left transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-white block">New Note</span>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">Personal reflection / rule</span>
        </button>

        <button
          onClick={() => onNavigateTab('terms')}
          className="p-4 rounded-xl bg-[#131418] hover:bg-[#181920] border border-[#23252e] hover:border-zinc-700 text-left transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
            <Bookmark className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-white block">Glossary</span>
          <span className="text-[11px] text-zinc-400 mt-0.5 block">Review extracted terms</span>
        </button>
      </div>

      {/* Continue Learning Section */}
      {primaryCourse && (
        <div className="p-6 sm:p-7 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Continue Learning
              </h2>
            </div>
            <button
              onClick={() => onSelectCourse(primaryCourse)}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Course</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                  {primaryCourse.category || 'Trading'}
                </span>
                {primaryCourse.isDemo && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    Seeded Demo
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-white">{primaryCourse.title}</h3>
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                {primaryCourse.description}
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="text-xs font-semibold text-indigo-400 block">
                  {primaryCourse.progressPercent || 0}% Complete
                </span>
                <span className="text-[11px] text-zinc-500">
                  {primaryCourse.lessonCount || 0} Lessons
                </span>
              </div>
              <button
                onClick={() => onSelectCourse(primaryCourse)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 cursor-pointer"
              >
                Resume
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-[#20222a] rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${primaryCourse.progressPercent || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* My Courses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              My Courses ({courses.length})
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab('courses')}
            className="text-xs text-indigo-400 hover:underline cursor-pointer"
          >
            See All Courses →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.slice(0, 6).map((course) => (
            <div
              key={course.id}
              onClick={() => onSelectCourse(course)}
              className="group p-5 rounded-2xl bg-[#131418] hover:bg-[#16171d] border border-[#23252e] hover:border-indigo-500/50 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {course.category || 'General'}
                  </span>
                  <span className="text-[11px] text-zinc-400">{course.lessonCount || 0} lessons</span>
                </div>
                <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  {course.title}
                </h3>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {course.description || 'No description.'}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-[#1e2027]">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                  <span>Progress</span>
                  <span className="text-indigo-400 font-medium">
                    {course.progressPercent || 0}%
                  </span>
                </div>
                <div className="w-full h-1 bg-[#20222a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${course.progressPercent || 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Learning Activity Timeline */}
      <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Recent Activity
        </h2>

        {recentActivities.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No recent activity recorded yet. Start by dumping raw material or creating a lesson.
          </p>
        ) : (
          <div className="space-y-3">
            {recentActivities.slice(0, 5).map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#0e0f12] text-xs text-zinc-300"
              >
                <div className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  {act.type === 'lesson_created' && <Sparkles className="w-3.5 h-3.5" />}
                  {act.type === 'lesson_completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {act.type === 'note_created' && <FileText className="w-3.5 h-3.5" />}
                  {act.type === 'quiz_completed' && <Award className="w-3.5 h-3.5 text-amber-400" />}
                  {act.type === 'course_created' && <BookOpen className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{act.title}</p>
                  <p className="text-zinc-400 text-[11px] truncate">{act.details}</p>
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {new Date(act.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
