import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Award,
  BookOpen,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { ReviewQuestion } from '../types';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
  title?: string;
  subtitle?: string;
  questions: ReviewQuestion[];
  onQuizCompleted?: (score: number, total: number) => void;
  onRetakeQuiz?: () => ReviewQuestion[];
  onJumpToSection?: (sectionTitleOrId: string) => void;
  onProceedNextDay?: () => void;
  passingScorePercent?: number;
}

// Utility: Fisher-Yates shuffle array
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  lessonId,
  lessonTitle,
  title,
  subtitle,
  questions: initialQuestions,
  onQuizCompleted,
  onRetakeQuiz,
  onJumpToSection,
  onProceedNextDay,
  passingScorePercent = 60,
}) => {
  // Local list of active questions (allows dynamic reshuffling on retake)
  const [activeQuestions, setActiveQuestions] = useState<ReviewQuestion[]>(() => {
    return initialQuestions.map((q) => ({
      ...q,
      options: q.options ? shuffleArray(q.options) : q.options,
    }));
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [retakeCount, setRetakeCount] = useState(0);

  // Sync when initialQuestions changes
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setActiveQuestions(
        initialQuestions.map((q) => ({
          ...q,
          options: q.options ? shuffleArray(q.options) : q.options,
        }))
      );
      setCurrentIndex(0);
      setUserAnswers({});
      setSelectedOption('');
      setIsSubmitted(false);
      setIsFinished(false);
      setScore(0);
    }
  }, [initialQuestions]);

  if (!isOpen || !activeQuestions || activeQuestions.length === 0) return null;

  const currentQ = activeQuestions[currentIndex];
  const isLastQuestion = currentIndex === activeQuestions.length - 1;
  const passingScoreCount = Math.ceil((activeQuestions.length * passingScorePercent) / 100);
  const isPassed = isFinished && score >= passingScoreCount;

  const handleSelectOption = (option: string) => {
    if (isSubmitted) return;
    setSelectedOption(option);
  };

  const handleCheckAnswer = () => {
    if (!selectedOption) return;
    setIsSubmitted(true);

    const isCorrect = selectedOption.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
    const newAnswers = { ...userAnswers, [currentQ.id || String(currentIndex)]: selectedOption };
    setUserAnswers(newAnswers);

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = async () => {
    if (isLastQuestion) {
      setIsFinished(true);
      // Submit result to backend
      try {
        await api.submitQuizAttempt({
          lessonId,
          score,
          totalQuestions: activeQuestions.length,
          answers: userAnswers,
        });
        if (onQuizCompleted) onQuizCompleted(score, activeQuestions.length);
      } catch (e) {
        console.error('Quiz attempt save failed:', e);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption('');
      setIsSubmitted(false);
    }
  };

  // Reshuffled "Retake Quiz" System:
  // Dynamically pulls fresh questions or reshuffles question order + answer options
  const handleRetakeQuiz = () => {
    let freshQuestions: ReviewQuestion[] = [];
    if (onRetakeQuiz) {
      freshQuestions = onRetakeQuiz();
    }
    if (!freshQuestions || freshQuestions.length === 0) {
      freshQuestions = shuffleArray(activeQuestions);
    }

    // Reshuffle each question's answer options as well
    const reshuffled = freshQuestions.map((q) => ({
      ...q,
      options: q.options ? shuffleArray(q.options) : q.options,
    }));

    setActiveQuestions(reshuffled);
    setCurrentIndex(0);
    setUserAnswers({});
    setSelectedOption('');
    setIsSubmitted(false);
    setIsFinished(false);
    setScore(0);
    setRetakeCount((prev) => prev + 1);
  };

  const isCurrentCorrect =
    isSubmitted && selectedOption.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-7 text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1a366f] mb-5">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#00B4FF] flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{subtitle || 'End-of-Day Check-in Quiz'}</span>
              {retakeCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                  Reshuffled Variant #{retakeCount + 1}
                </span>
              )}
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-md mt-0.5">
              {title || lessonTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Quiz"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isFinished ? (
          <div>
            {/* Progress indicator */}
            <div className="flex items-center justify-between text-xs text-[#9bb1d6] mb-2 font-mono">
              <span>
                Question {currentIndex + 1} of {activeQuestions.length}
              </span>
              <span>Score: {score}</span>
            </div>
            <div className="w-full h-1.5 bg-[#081734] rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-[#00B4FF] transition-all duration-300 rounded-full"
                style={{ width: `${((currentIndex + 1) / activeQuestions.length) * 100}%` }}
              />
            </div>

            {/* Question Text */}
            <h3 className="text-sm sm:text-base font-semibold text-white mb-5 leading-relaxed">
              {currentQ.question}
            </h3>

            {/* Answer Options */}
            <div className="space-y-2.5 mb-6">
              {currentQ.options && currentQ.options.length > 0 ? (
                currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === opt;
                  const isCorrectAnswer =
                    isSubmitted && opt.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
                  const isChosenWrong = isSubmitted && isSelected && !isCorrectAnswer;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => handleSelectOption(opt)}
                      className={`w-full text-left p-3.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        isCorrectAnswer
                          ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-200 shadow-sm'
                          : isChosenWrong
                          ? 'bg-rose-500/20 border border-rose-500 text-rose-200 shadow-sm'
                          : isSelected
                          ? 'bg-[#00B4FF]/25 border border-[#00B4FF] text-white font-bold'
                          : 'bg-[#081734] border border-[#1a366f] text-zinc-200 hover:bg-[#0f2756] hover:border-[#00B4FF]/50'
                      }`}
                    >
                      <span className="leading-relaxed">{opt}</span>
                      {isCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                      {isChosenWrong && <XCircle className="w-4 h-4 text-rose-400 shrink-0 ml-2" />}
                    </button>
                  );
                })
              ) : (
                /* Short answer fallback */
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  disabled={isSubmitted}
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF]"
                />
              )}
            </div>

            {/* Actionable Feedback on Missed & Correct Questions */}
            {isSubmitted && (
              <div
                className={`p-4 rounded-xl border text-xs mb-5 animate-in fade-in duration-200 ${
                  isCurrentCorrect
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  {isCurrentCorrect ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Correct Answer!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Missed. Correct Answer: {currentQ.answer}</span>
                    </>
                  )}
                </div>

                <p className="text-zinc-200 mt-1 leading-relaxed">
                  {currentQ.explanation || 'Review the core mechanism in the study notes to consolidate recall.'}
                </p>

                {/* Direct Link/Reference back to specific section of study notes */}
                {!isCurrentCorrect && (
                  <div className="mt-3 pt-2.5 border-t border-rose-500/30 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-300 font-mono flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-rose-400" />
                      <span>
                        Relevant concept:{' '}
                        <strong className="text-white">
                          {currentQ.sectionTitle || currentQ.context || 'Core Notes'}
                        </strong>
                      </span>
                    </span>
                    {onJumpToSection && (
                      <button
                        type="button"
                        onClick={() => {
                          onJumpToSection(currentQ.sectionTitle || currentQ.context || currentQ.question);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Review Section
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1a366f]">
              {!isSubmitted ? (
                <button
                  type="button"
                  onClick={handleCheckAnswer}
                  disabled={!selectedOption}
                  className="px-5 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] disabled:opacity-40 text-[#0B1F44] text-xs font-bold tracking-wide transition-all shadow-md cursor-pointer"
                >
                  Check Answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold tracking-wide transition-all shadow-md cursor-pointer"
                >
                  <span>{isLastQuestion ? 'View Results & Unlock' : 'Next Question'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Quiz Results View with Day Progression Unlock or Reshuffled Retake */
          <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-200">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
                isPassed
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
              }`}
            >
              {isPassed ? <Award className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                {isPassed ? 'Day Milestone Cleared!' : 'Review & Retake Required'}
              </h3>
              <p className="text-xs text-[#9bb1d6] max-w-sm mx-auto leading-relaxed">
                You scored <span className="font-bold text-white">{score}</span> out of{' '}
                <span className="font-bold text-white">{activeQuestions.length}</span> (
                {Math.round((score / activeQuestions.length) * 100)}%).{' '}
                {isPassed
                  ? 'You have successfully unlocked the subsequent study day!'
                  : `A score of ${passingScorePercent}% is required to unlock the next day. Review your missed concepts and retake with reshuffled questions.`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {/* Prominent Reshuffled "Retake Quiz" Button */}
              <button
                type="button"
                onClick={handleRetakeQuiz}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#081734] hover:bg-[#0f2756] border border-[#1a366f] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#00B4FF]" />
                <span>Retake Quiz (Fresh Questions)</span>
              </button>

              {/* Day Progression Unlock button upon passing */}
              {isPassed && onProceedNextDay && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onProceedNextDay();
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-lg shadow-[#00B4FF]/30 cursor-pointer"
                >
                  <span>Proceed to Next Day</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#081734] text-[#9bb1d6] hover:text-white text-xs font-medium cursor-pointer"
              >
                Back to Lesson
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
