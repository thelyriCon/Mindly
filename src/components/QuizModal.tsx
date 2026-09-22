import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, ArrowRight, RotateCcw, Award } from 'lucide-react';
import { api } from '../lib/api';
import { ReviewQuestion } from '../types';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
  questions: ReviewQuestion[];
  onQuizCompleted?: (score: number, total: number) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  lessonId,
  lessonTitle,
  questions,
  onQuizCompleted,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);

  if (!isOpen || !questions || questions.length === 0) return null;

  const currentQ = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

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
          totalQuestions: questions.length,
          answers: userAnswers,
        });
        if (onQuizCompleted) onQuizCompleted(score, questions.length);
      } catch (e) {
        console.error('Quiz attempt save failed:', e);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption('');
      setIsSubmitted(false);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setUserAnswers({});
    setSelectedOption('');
    setIsSubmitted(false);
    setIsFinished(false);
    setScore(0);
  };

  const isCurrentCorrect =
    isSubmitted && selectedOption.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#131418] border border-[#272932] shadow-2xl p-6 sm:p-7 text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#21232b] mb-5">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400">
              Test Yourself
            </div>
            <h2 className="text-sm font-semibold text-white truncate max-w-md">{lessonTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isFinished ? (
          <div>
            {/* Progress indicator */}
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span>
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span>Score: {score}</span>
            </div>
            <div className="w-full h-1.5 bg-[#20222a] rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* Question Text */}
            <h3 className="text-sm sm:text-base font-medium text-white mb-5 leading-relaxed">
              {currentQ.question}
            </h3>

            {/* Answer Options */}
            <div className="space-y-2.5 mb-6">
              {currentQ.options && currentQ.options.length > 0 ? (
                currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === opt;
                  const isCorrectAnswer = isSubmitted && opt.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
                  const isChosenWrong = isSubmitted && isSelected && !isCorrectAnswer;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => handleSelectOption(opt)}
                      className={`w-full text-left p-3.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        isCorrectAnswer
                          ? 'bg-emerald-950/40 border border-emerald-500/70 text-emerald-200'
                          : isChosenWrong
                          ? 'bg-red-950/40 border border-red-500/70 text-red-200'
                          : isSelected
                          ? 'bg-indigo-600/30 border border-indigo-500/60 text-white'
                          : 'bg-[#181920] border border-[#272935] text-zinc-300 hover:bg-[#20222c] hover:border-zinc-600'
                      }`}
                    >
                      <span className="leading-relaxed">{opt}</span>
                      {isCorrectAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                      {isChosenWrong && <XCircle className="w-4 h-4 text-red-400 shrink-0 ml-2" />}
                    </button>
                  );
                })
              ) : (
                /* Short answer fallback input */
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  disabled={isSubmitted}
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-[#0e0f12] border border-[#272932] text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>

            {/* Feedback & Explanation */}
            {isSubmitted && (
              <div
                className={`p-3.5 rounded-xl border text-xs mb-5 animate-in fade-in duration-200 ${
                  isCurrentCorrect
                    ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                    : 'bg-red-950/30 border-red-800/50 text-red-200'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold mb-1">
                  {isCurrentCorrect ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Correct!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span>Not quite. Correct Answer: {currentQ.answer}</span>
                    </>
                  )}
                </div>
                <p className="text-zinc-300 mt-1 leading-relaxed">{currentQ.explanation}</p>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#21232b]">
              {!isSubmitted ? (
                <button
                  type="button"
                  onClick={handleCheckAnswer}
                  disabled={!selectedOption}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold tracking-wide transition-all shadow-md cursor-pointer"
                >
                  Check Answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md cursor-pointer"
                >
                  <span>{isLastQuestion ? 'View Results' : 'Next Question'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Quiz Results View */
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mx-auto mb-4">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Quiz Completed!</h3>
            <p className="text-xs text-zinc-400 mb-6">
              You scored <span className="font-semibold text-white">{score}</span> out of{' '}
              <span className="font-semibold text-white">{questions.length}</span> (
              {Math.round((score / questions.length) * 100)}%)
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRestart}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md cursor-pointer"
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
