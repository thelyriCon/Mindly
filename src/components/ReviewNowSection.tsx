import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Brain,
  Sparkles,
  ChevronRight,
  Clock,
  Layers,
  Award,
  Zap,
} from 'lucide-react';
import { DueReviewItem, SpacedRepetitionRating, SpacedRepetitionSummary } from '../types';
import { api } from '../lib/api';
import { ReviewSessionModal } from './ReviewSessionModal';

interface ReviewNowSectionProps {
  onOpenLesson: (courseId: string, lessonId: string) => void;
  onRefreshStats?: () => void;
}

export const ReviewNowSection: React.FC<ReviewNowSectionProps> = ({
  onOpenLesson,
  onRefreshStats,
}) => {
  const [summary, setSummary] = useState<SpacedRepetitionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false);

  const fetchDueReviews = async () => {
    try {
      const data = await api.getDueReviews();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load spaced reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDueReviews();
  }, []);

  const handleQuickRate = async (
    lessonId: string,
    rating: SpacedRepetitionRating,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (actionInProgress) return;
    setActionInProgress(lessonId);

    try {
      await api.recordLessonReview(lessonId, rating);
      await fetchDueReviews();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('Failed to record review:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleModalReviewRecorded = () => {
    fetchDueReviews();
    if (onRefreshStats) onRefreshStats();
  };

  if (loading && !summary) {
    return (
      <div className="p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] animate-pulse flex items-center justify-between">
        <div className="h-4 bg-[#1a366f] rounded w-1/3"></div>
        <div className="h-8 bg-[#1a366f] rounded w-24"></div>
      </div>
    );
  }

  const dueItems = summary?.dueReviews || [];
  const upcomingItems = summary?.upcomingReviews || [];
  const stats = summary?.stats || {
    dueCount: 0,
    masteredCount: 0,
    inProgressCount: 0,
    totalTracked: 0,
    retentionRate: 100,
  };

  // If there are no tracked lessons at all (user hasn't finished any lesson yet), return null or introductory encouragement
  if (stats.totalTracked === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Container Card */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-lg relative overflow-hidden">
        {/* Subtle accent border line on top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4FF] via-[#00B4FF]/40 to-transparent" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1a366f]/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#00B4FF]" />
              <h2 className="text-xs font-semibold text-[#9bb1d6] uppercase tracking-wider">
                Spaced Repetition & Retention
              </h2>
              {dueItems.length > 0 ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 font-bold">
                  {dueItems.length} {dueItems.length === 1 ? 'Lesson' : 'Lessons'} Due
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                  Optimal Retention
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Review Now</h3>
            <p className="text-xs text-[#9bb1d6]">
              Review lessons right before memory decays to lock them permanently into long-term recall.
            </p>
          </div>

          {/* Header Action & Stats */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-mono text-[#00B4FF] font-bold block">
                {stats.retentionRate}% Retention
              </span>
              <span className="text-[11px] text-[#627ca8]">
                {stats.masteredCount} Mastered · {stats.inProgressCount} In Intervals
              </span>
            </div>

            {dueItems.length > 0 && (
              <button
                onClick={() => setIsSessionOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors shadow-md shadow-[#00B4FF]/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>Start Review Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Section: Due Items or Caught Up State */}
        {dueItems.length > 0 ? (
          <div className="pt-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dueItems.map((item) => (
                <div
                  key={item.lessonId}
                  className="p-5 rounded-xl bg-[#081734] border border-[#1a366f] hover:border-[#00B4FF]/50 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Top Status & Course */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#9bb1d6] truncate max-w-[200px]">
                        {item.courseTitle}
                      </span>
                      {item.dueStatus === 'overdue' ? (
                        <span className="text-[10px] font-mono text-amber-400 font-semibold uppercase">
                          Overdue ({item.daysOverdue}d)
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-[#00B4FF] font-semibold uppercase">
                          Due Today
                        </span>
                      )}
                    </div>

                    {/* Lesson Title */}
                    <h4 className="text-base font-bold text-white group-hover:text-[#00B4FF] transition-colors line-clamp-1">
                      {item.lessonTitle}
                    </h4>

                    {item.overview && (
                      <p className="text-xs text-[#9bb1d6] line-clamp-2 leading-relaxed">
                        {item.overview}
                      </p>
                    )}

                    {/* Stage Progress Bar (5 stages) */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#627ca8]">Retention Stage</span>
                        <span className="font-mono text-white text-[11px] font-medium">
                          Stage {item.stage}/5 ({item.intervalDays}d interval)
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <div
                            key={lvl}
                            className={`h-full rounded-sm transition-colors ${
                              lvl <= item.stage ? 'bg-[#00B4FF]' : 'bg-[#1a366f]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="pt-4 mt-3 border-t border-[#1a366f]/60 space-y-3">
                    {/* Quick Recall Buttons */}
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#627ca8] block mb-1.5">
                        Log Recall Outcome:
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          disabled={actionInProgress === item.lessonId}
                          onClick={(e) => handleQuickRate(item.lessonId, 'again', e)}
                          title="Forgot / Reset interval to 1d"
                          className="px-2 py-1.5 rounded-lg bg-[#0B1F44] border border-[#1a366f] hover:border-red-400 hover:text-red-400 text-center text-[11px] font-semibold text-[#9bb1d6] transition-all cursor-pointer disabled:opacity-50"
                        >
                          Again
                        </button>
                        <button
                          disabled={actionInProgress === item.lessonId}
                          onClick={(e) => handleQuickRate(item.lessonId, 'hard', e)}
                          title="Remembered with difficulty (~2d)"
                          className="px-2 py-1.5 rounded-lg bg-[#0B1F44] border border-[#1a366f] hover:border-amber-400 hover:text-amber-400 text-center text-[11px] font-semibold text-[#9bb1d6] transition-all cursor-pointer disabled:opacity-50"
                        >
                          Hard
                        </button>
                        <button
                          disabled={actionInProgress === item.lessonId}
                          onClick={(e) => handleQuickRate(item.lessonId, 'good', e)}
                          title="Recalled properly (~4-7d)"
                          className="px-2 py-1.5 rounded-lg bg-[#0B1F44] border border-[#1a366f] hover:border-[#00B4FF] hover:text-[#00B4FF] text-center text-[11px] font-semibold text-[#9bb1d6] transition-all cursor-pointer disabled:opacity-50"
                        >
                          Good
                        </button>
                        <button
                          disabled={actionInProgress === item.lessonId}
                          onClick={(e) => handleQuickRate(item.lessonId, 'easy', e)}
                          title="Instant recall (~10-14d)"
                          className="px-2 py-1.5 rounded-lg bg-[#0B1F44] border border-[#1a366f] hover:border-emerald-400 hover:text-emerald-400 text-center text-[11px] font-semibold text-[#9bb1d6] transition-all cursor-pointer disabled:opacity-50"
                        >
                          Easy
                        </button>
                      </div>
                    </div>

                    {/* Open Full Lesson Action */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#627ca8]">
                        {item.reviewCount} previous {item.reviewCount === 1 ? 'review' : 'reviews'}
                      </span>
                      <button
                        onClick={() => onOpenLesson(item.courseId, item.lessonId)}
                        className="text-xs text-[#00B4FF] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <span>Study Lesson</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* CAUGHT UP / ALL REVIEWS COMPLETE STATE */
          <div className="pt-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#081734] border border-[#1a366f]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#00B4FF]/10 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF] shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white tracking-tight">
                    All reviews caught up for today!
                  </h4>
                  <p className="text-xs text-[#9bb1d6] mt-0.5 leading-relaxed">
                    {upcomingItems.length > 0
                      ? `Your memory retention is optimal. Next review: "${upcomingItems[0].lessonTitle}" on ${new Date(upcomingItems[0].nextReviewDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`
                      : 'All completed lessons are locked in memory. Complete more lessons to expand your retention pipeline.'}
                  </p>
                </div>
              </div>

              {upcomingItems.length > 0 && (
                <button
                  onClick={() => setShowUpcoming(!showUpcoming)}
                  className="px-4 py-2 rounded-xl bg-[#0B1F44] border border-[#1a366f] hover:border-[#00B4FF] text-white text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  {showUpcoming ? 'Hide Upcoming Schedule' : `View Upcoming Schedule (${upcomingItems.length})`}
                </button>
              )}
            </div>

            {/* Upcoming Schedule Drawer */}
            {showUpcoming && upcomingItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#1a366f] space-y-2 animate-in fade-in duration-150">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#9bb1d6] mb-2">
                  Upcoming Spaced Review Pipeline
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {upcomingItems.map((u) => (
                    <div
                      key={u.lessonId}
                      onClick={() => onOpenLesson(u.courseId, u.lessonId)}
                      className="p-3.5 rounded-xl bg-[#081734] border border-[#1a366f]/70 hover:border-[#00B4FF] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#627ca8]">
                        <span className="truncate max-w-[140px]">{u.courseTitle}</span>
                        <span className="font-mono text-[#00B4FF]">
                          {new Date(u.nextReviewDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-white group-hover:text-[#00B4FF] transition-colors mt-1 truncate">
                        {u.lessonTitle}
                      </h5>
                      <div className="flex items-center justify-between text-[10px] text-[#9bb1d6] mt-2">
                        <span>Stage {u.stage}/5</span>
                        <span>{u.intervalDays}d interval</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Modal Session */}
      <ReviewSessionModal
        isOpen={isSessionOpen}
        onClose={() => setIsSessionOpen(false)}
        items={dueItems}
        onReviewRecorded={handleModalReviewRecorded}
        onOpenLessonDetail={onOpenLesson}
      />
    </div>
  );
};
