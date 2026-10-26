import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  CheckCircle2,
  Brain,
  ArrowRight,
  Eye,
  EyeOff,
  BookOpen,
  Sparkles,
  Award,
} from 'lucide-react';
import { DueReviewItem, SpacedRepetitionRating, Lesson } from '../types';
import { api } from '../lib/api';
import { NokiaLoader } from './NokiaLoader';

interface ReviewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DueReviewItem[];
  onReviewRecorded: (lessonId: string, rating: SpacedRepetitionRating, nextIntervalDays: number) => void;
  onOpenLessonDetail?: (courseId: string, lessonId: string) => void;
}

export const ReviewSessionModal: React.FC<ReviewSessionModalProps> = ({
  isOpen,
  onClose,
  items,
  onReviewRecorded,
  onOpenLessonDetail,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex];

  // Fetch full lesson content for the active review item
  React.useEffect(() => {
    if (!currentItem) return;
    let isMounted = true;
    setLoadingLesson(true);
    setShowAnswer(false);

    api.getLesson(currentItem.lessonId)
      .then((res) => {
        if (isMounted) {
          setActiveLesson(res.lesson);
          setLoadingLesson(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingLesson(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentItem?.lessonId]);

  const handleRate = async (rating: SpacedRepetitionRating) => {
    if (isSubmitting || !currentItem) return;
    setIsSubmitting(true);

    try {
      const res = await api.recordLessonReview(currentItem.lessonId, rating);
      onReviewRecorded(currentItem.lessonId, rating, res.nextReviewInDays);
      setReviewedCount((prev) => prev + 1);

      if (currentIndex + 1 < items.length) {
        setCurrentIndex((prev) => prev + 1);
        setShowAnswer(false);
      } else {
        setSessionCompleted(true);
      }
    } catch (err) {
      console.error('Failed to record review:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStageLabel = (stage: number) => {
    switch (stage) {
      case 0:
      case 1:
        return 'Stage 1 · 1 Day Interval';
      case 2:
        return 'Stage 2 · 3 Day Interval';
      case 3:
        return 'Stage 3 · 7 Day Interval';
      case 4:
        return 'Stage 4 · 14 Day Interval';
      case 5:
      default:
        return 'Stage 5 · Mastered (30+ Days)';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-7 text-white flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1a366f] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF]">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#00B4FF] font-semibold">
                Spaced Repetition Review
              </div>
              <h2 className="text-sm font-bold text-white">
                {sessionCompleted
                  ? 'Review Session Complete'
                  : `Reviewing ${currentIndex + 1} of ${items.length}`}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#9bb1d6] hover:text-white rounded-lg hover:bg-[#0f2756] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {sessionCompleted ? (
          <div className="py-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center mx-auto text-[#00B4FF]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Optimal Retention Reached!</h3>
            <p className="text-xs text-[#9bb1d6] max-w-md mx-auto leading-relaxed">
              You reviewed {reviewedCount} {reviewedCount === 1 ? 'lesson' : 'lessons'}. Your optimal review schedule has been updated based on your recall accuracy.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Meta & Stage pill */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9bb1d6] font-medium truncate max-w-[280px]">
                {currentItem.courseTitle}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 font-semibold">
                {getStageLabel(currentItem.stage)}
              </span>
            </div>

            {/* Lesson Title */}
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">{currentItem.lessonTitle}</h3>
              {currentItem.overview && (
                <p className="text-xs text-[#9bb1d6] mt-1 leading-relaxed">{currentItem.overview}</p>
              )}
            </div>

            {loadingLesson ? (
              <div className="py-8 flex justify-center">
                <NokiaLoader label="Retrieving memory anchors..." dotSize="w-1.5 h-1.5" />
              </div>
            ) : activeLesson?.structuredContent ? (
              <div className="space-y-4">
                {/* Active Recall Prompt */}
                <div className="p-4 rounded-xl bg-[#081734] border border-[#1a366f] space-y-3">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#9bb1d6]">
                    Recall Challenge
                  </div>

                  {activeLesson.structuredContent.reviewQuestions &&
                  activeLesson.structuredContent.reviewQuestions.length > 0 ? (
                    <div>
                      <p className="text-sm text-white font-medium">
                        {activeLesson.structuredContent.reviewQuestions[0].question}
                      </p>
                      {activeLesson.structuredContent.reviewQuestions[0].options && !showAnswer && (
                        <div className="grid grid-cols-1 gap-1.5 mt-2.5">
                          {activeLesson.structuredContent.reviewQuestions[0].options.map((opt, i) => (
                            <div
                              key={i}
                              className="text-xs px-3 py-1.5 rounded-lg bg-[#0B1F44] border border-[#1a366f]/70 text-[#9bb1d6]"
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-white">
                        Can you mentally recall the core concepts and definitions of this lesson before revealing the summary?
                      </p>
                    </div>
                  )}

                  {/* Toggle reveal */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAnswer(!showAnswer)}
                      className="flex items-center gap-1.5 text-xs text-[#00B4FF] hover:underline cursor-pointer font-medium"
                    >
                      {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showAnswer ? 'Hide Knowledge Anchors' : 'Show Answer & Key Takeaways'}</span>
                    </button>
                  </div>

                  {/* Answer / Anchors Area */}
                  {showAnswer && (
                    <div className="pt-3 border-t border-[#1a366f]/60 space-y-3 animate-in fade-in duration-150">
                      {activeLesson.structuredContent.reviewQuestions?.[0]?.answer && (
                        <div>
                          <div className="text-[10px] font-mono text-[#00B4FF] uppercase">Verified Answer</div>
                          <p className="text-xs text-white font-semibold mt-0.5">
                            {activeLesson.structuredContent.reviewQuestions[0].answer}
                          </p>
                          {activeLesson.structuredContent.reviewQuestions[0].explanation && (
                            <p className="text-[11px] text-[#9bb1d6] mt-0.5">
                              {activeLesson.structuredContent.reviewQuestions[0].explanation}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Key Terms */}
                      {activeLesson.structuredContent.keyTerms && activeLesson.structuredContent.keyTerms.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-mono text-[#9bb1d6] uppercase">Core Terms</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeLesson.structuredContent.keyTerms.slice(0, 4).map((kt, i) => (
                              <div key={i} className="p-2 rounded-lg bg-[#0B1F44] border border-[#1a366f]/50">
                                <span className="text-xs font-bold text-white block">{kt.term}</span>
                                <span className="text-[11px] text-[#9bb1d6] block mt-0.5 leading-snug">
                                  {kt.definition}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Deep Dive Action */}
                {onOpenLessonDetail && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenLessonDetail(currentItem.courseId, currentItem.lessonId);
                      }}
                      className="text-[11px] text-[#9bb1d6] hover:text-[#00B4FF] flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Open Complete Structured Lesson</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Retention Rating Bar */}
            <div className="pt-3 border-t border-[#1a366f] space-y-2">
              <div className="text-[11px] font-mono text-[#9bb1d6] uppercase tracking-wider">
                Rate Your Recall (SuperMemo Optimal Intervals):
              </div>
              <div className="grid grid-cols-4 gap-2">
                <button
                  disabled={isSubmitting}
                  onClick={() => handleRate('again')}
                  className="p-2.5 rounded-xl bg-[#081734] border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-center transition-all cursor-pointer group disabled:opacity-50"
                >
                  <span className="text-xs font-bold text-red-400 block group-hover:text-red-300">Again</span>
                  <span className="text-[10px] text-[#9bb1d6] block mt-0.5">1 day</span>
                </button>

                <button
                  disabled={isSubmitting}
                  onClick={() => handleRate('hard')}
                  className="p-2.5 rounded-xl bg-[#081734] border border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10 text-center transition-all cursor-pointer group disabled:opacity-50"
                >
                  <span className="text-xs font-bold text-amber-400 block group-hover:text-amber-300">Hard</span>
                  <span className="text-[10px] text-[#9bb1d6] block mt-0.5">~2 days</span>
                </button>

                <button
                  disabled={isSubmitting}
                  onClick={() => handleRate('good')}
                  className="p-2.5 rounded-xl bg-[#081734] border border-[#00B4FF]/40 hover:border-[#00B4FF] hover:bg-[#00B4FF]/10 text-center transition-all cursor-pointer group disabled:opacity-50"
                >
                  <span className="text-xs font-bold text-[#00B4FF] block group-hover:text-white">Good</span>
                  <span className="text-[10px] text-[#9bb1d6] block mt-0.5">~4-7 days</span>
                </button>

                <button
                  disabled={isSubmitting}
                  onClick={() => handleRate('easy')}
                  className="p-2.5 rounded-xl bg-[#081734] border border-emerald-500/40 hover:border-emerald-500 hover:bg-emerald-500/10 text-center transition-all cursor-pointer group disabled:opacity-50"
                >
                  <span className="text-xs font-bold text-emerald-400 block group-hover:text-emerald-300">Easy</span>
                  <span className="text-[10px] text-[#9bb1d6] block mt-0.5">~10-14 days</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
