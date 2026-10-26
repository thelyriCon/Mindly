import React from 'react';
import {
  Flame,
  Trophy,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { StudyProgress, ActivityDay } from '../types';

interface LearningStreakWidgetProps {
  progress: StudyProgress;
  onStartStudying?: () => void;
  primaryCourseTitle?: string;
  className?: string;
}

export const LearningStreakWidget: React.FC<LearningStreakWidgetProps> = ({
  progress,
  onStartStudying,
  primaryCourseTitle,
  className = '',
}) => {
  const streak = progress.streakDays || 0;
  const longestStreak = Math.max(progress.longestStreakDays || streak, streak);
  const hasActivityToday = Boolean(progress.hasActivityToday || progress.todayMinutes > 0);
  const totalActiveDays = progress.totalActiveDays || Math.max(streak, 0);
  const milestoneTitle = progress.milestoneTitle || (streak >= 7 ? 'Dedicated Scholar' : streak >= 3 ? 'Consistent Learner' : 'Learning Spark');
  const nextMilestone = progress.nextMilestoneDays || (streak < 3 ? 3 : streak < 7 ? 7 : streak < 14 ? 14 : streak + 15);
  const daysToNext = Math.max(1, nextMilestone - streak);
  const milestoneProgressPercent = Math.min(100, Math.round((streak / nextMilestone) * 100));

  // Activity days
  const activityDays: ActivityDay[] = progress.recentActivityDays && progress.recentActivityDays.length > 0
    ? progress.recentActivityDays
    : Array.from({ length: 7 }).map((_, idx) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - idx));
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const isToday = idx === 6;
        const hasAct = isToday ? hasActivityToday : false;
        return {
          date: d.toISOString().split('T')[0],
          dayName: dayNames[d.getDay()],
          dayNumber: d.getDate(),
          hasActivity: hasAct,
          minutesStudied: hasAct ? progress.todayMinutes : 0,
          activityCount: hasAct ? 1 : 0,
          isToday,
        };
      });

  return (
    <section
      aria-label="Learning Streak Tracker"
      className={`p-5 sm:p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] hover:border-[#00B4FF]/40 transition-all space-y-5 shadow-lg relative overflow-hidden ${className}`}
    >
      {/* Ambient Glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#00B4FF]/10 blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 text-[#00B4FF] flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-[#9bb1d6] uppercase tracking-wider">
              Learning Momentum
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-white">{milestoneTitle}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#07132b] text-[#00B4FF] border border-[#1a366f]">
                Level {streak > 0 ? Math.floor(streak / 3) + 1 : 1}
              </span>
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#07132b] border border-[#1a366f]">
          {hasActivityToday ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00B4FF]" />
              <span className="text-white text-[11px] font-semibold">Active Today</span>
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5 text-[#627ca8]" />
              <span className="text-[#9bb1d6] text-[11px]">Ready for study</span>
            </>
          )}
        </div>
      </div>

      {/* Hero Counter & Core Metric Display */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1 relative z-10">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-white">
              {streak}
            </span>
            <span className="text-base sm:text-lg font-bold text-[#00B4FF]">
              {streak === 1 ? 'Day Streak' : 'Days Streak'}
            </span>
          </div>
          <p className="text-xs text-[#9bb1d6] leading-relaxed max-w-sm">
            {hasActivityToday
              ? `Great job! Your consecutive study streak is preserved for today.`
              : streak > 0
              ? `Study any lesson today to extend your ${streak}-day streak!`
              : `Complete a lesson today to ignite your learning streak.`}
          </p>
        </div>

        {/* Milestone Badge Pill */}
        <div className="p-3 rounded-xl bg-[#07132b] border border-[#1a366f] space-y-1 sm:text-right shrink-0">
          <span className="text-[10px] text-[#627ca8] uppercase tracking-wider block">
            Next Milestone
          </span>
          <div className="flex items-center sm:justify-end gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-[#00B4FF]" />
            <span className="text-xs font-bold text-white font-mono">{nextMilestone} Days</span>
          </div>
          <span className="text-[10px] text-[#9bb1d6] block">
            {daysToNext === 1 ? '1 day to go' : `${daysToNext} days to go`}
          </span>
        </div>
      </div>

      {/* 7-Day Visual Activity Matrix */}
      <div className="space-y-2 pt-1 relative z-10">
        <div className="flex items-center justify-between text-[11px] text-[#9bb1d6]">
          <span className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3 h-3 text-[#00B4FF]" />
            <span>Past 7 Days History</span>
          </span>
          <span className="font-mono text-[10px] text-[#627ca8]">
            {totalActiveDays} Total Active Days
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {activityDays.map((day, idx) => {
            const isCompleted = day.hasActivity;
            return (
              <div
                key={day.date || idx}
                className={`flex flex-col items-center justify-between py-2 sm:py-2.5 px-1 rounded-xl border transition-all text-center ${
                  day.isToday
                    ? isCompleted
                      ? 'bg-[#00B4FF]/20 border-[#00B4FF] text-white shadow-sm shadow-[#00B4FF]/20'
                      : 'bg-[#07132b] border-[#00B4FF]/40 text-white'
                    : isCompleted
                    ? 'bg-[#00B4FF]/10 border-[#00B4FF]/40 text-white'
                    : 'bg-[#07132b] border-[#1a366f] text-[#627ca8]'
                }`}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                  {day.dayName}
                </span>

                <div className="my-1 flex items-center justify-center">
                  {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-[#00B4FF] flex items-center justify-center text-[#0B1F44]">
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div
                      className={`w-2 h-2 rounded-full ${
                        day.isToday ? 'bg-[#00B4FF] animate-ping' : 'bg-[#1a366f]'
                      }`}
                    />
                  )}
                </div>

                <span className="text-[10px] font-mono">
                  {day.minutesStudied > 0 ? `${day.minutesStudied}m` : day.isToday ? 'Today' : '-'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Milestone Progress Track & Best Streak Record */}
      <div className="pt-2 border-t border-[#1a366f] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#9bb1d6] relative z-10">
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <div className="flex-1 h-1.5 rounded-full bg-[#07132b] overflow-hidden border border-[#1a366f]">
            <div
              className="h-full bg-[#00B4FF] rounded-full transition-all duration-500"
              style={{ width: `${milestoneProgressPercent}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-white shrink-0">
            {milestoneProgressPercent}%
          </span>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto text-[11px]">
          <span className="text-[#627ca8]">
            Best Record: <strong className="text-white font-mono">{longestStreak} days</strong>
          </span>
          {onStartStudying && !hasActivityToday && (
            <button
              onClick={onStartStudying}
              className="inline-flex items-center gap-1 text-[#00B4FF] hover:underline font-semibold cursor-pointer"
            >
              <span>Study Now</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
