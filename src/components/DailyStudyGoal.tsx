import React, { useState, useEffect } from 'react';
import { Target, Flame, CheckCircle2, Sliders, ArrowRight, Clock, Plus, Minus, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { StudyProgress } from '../types';
import { api } from '../lib/api';

export interface DailyStudyGoalProps {
  currentMinutes?: number;
  dailyGoalMinutes?: number;
  progress?: StudyProgress;
  onUpdateGoal?: (newGoalMinutes: number) => Promise<void> | void;
  onStartStudying?: () => void;
  primaryCourseTitle?: string;
}

export const DailyStudyGoal: React.FC<DailyStudyGoalProps> = ({
  currentMinutes: propCurrentMinutes,
  dailyGoalMinutes: propDailyGoalMinutes,
  progress: propProgress,
  onUpdateGoal,
  onStartStudying,
  primaryCourseTitle,
}) => {
  // Self-contained study progress state if not passed from parent
  const [internalProgress, setInternalProgress] = useState<StudyProgress>(
    propProgress || {
      dailyGoalMinutes: propDailyGoalMinutes || 30,
      todaySeconds: (propCurrentMinutes || 12) * 60,
      todayMinutes: propCurrentMinutes !== undefined ? propCurrentMinutes : 12,
      progressPercent: Math.min(
        100,
        Math.round(
          ((propCurrentMinutes !== undefined ? propCurrentMinutes : 12) /
            (propDailyGoalMinutes || 30)) *
            100
        )
      ),
      streakDays: 3,
      remainingMinutes: Math.max(0, (propDailyGoalMinutes || 30) - (propCurrentMinutes || 12)),
      isGoalReached: (propCurrentMinutes || 12) >= (propDailyGoalMinutes || 30),
    }
  );

  // Sync with propProgress when it changes
  useEffect(() => {
    if (propProgress) {
      setInternalProgress(propProgress);
    }
  }, [propProgress]);

  // If no progress was provided, fetch from API on mount
  useEffect(() => {
    if (!propProgress && propCurrentMinutes === undefined) {
      let isMounted = true;
      api
        .getStudyProgress()
        .then((res) => {
          if (isMounted) setInternalProgress(res.progress);
        })
        .catch(() => {
          // Keep internal defaults
        });
      return () => {
        isMounted = false;
      };
    }
  }, [propProgress, propCurrentMinutes]);

  const progress = propProgress || internalProgress;
  const currentMinutes = propCurrentMinutes !== undefined ? propCurrentMinutes : progress.todayMinutes;
  const goalMinutes = propDailyGoalMinutes !== undefined ? propDailyGoalMinutes : progress.dailyGoalMinutes;

  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [targetInput, setTargetInput] = useState<number>(goalMinutes);
  const [isSaving, setIsSaving] = useState(false);

  // Keep targetInput in sync when goal changes externally
  useEffect(() => {
    setTargetInput(goalMinutes);
  }, [goalMinutes]);

  // Circular SVG Progress Ring geometry
  const radius = 44;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const calculatedPercent = Math.min(100, Math.max(0, Math.round((currentMinutes / goalMinutes) * 100)));
  const strokeDashoffset = circumference - (circumference * calculatedPercent) / 100;
  const isGoalReached = currentMinutes >= goalMinutes;
  const remainingMinutes = Math.max(0, Number((goalMinutes - currentMinutes).toFixed(1)));

  const handleSaveGoal = async () => {
    if (targetInput < 5 || targetInput > 480) return;
    setIsSaving(true);
    try {
      if (onUpdateGoal) {
        await onUpdateGoal(targetInput);
      } else {
        const res = await api.updateStudyGoal(targetInput);
        setInternalProgress(res.progress);
      }
      setIsEditingGoal(false);
    } catch (err) {
      console.error('Failed to update daily study goal:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const presetGoals = [15, 20, 30, 45, 60];

  const getMotivationalMessage = () => {
    if (isGoalReached) {
      return 'Daily goal achieved! Excellent discipline and focus today.';
    }
    if (currentMinutes === 0) {
      return 'No study time recorded yet today. Jump into a lesson to begin your ring!';
    }
    if (calculatedPercent < 50) {
      return `${remainingMinutes} minutes left to reach today's target. Keep momentum!`;
    }
    return `Over halfway there! Just ${remainingMinutes} minutes remaining to finish strong.`;
  };

  return (
    <section
      id="daily-study-goal-component"
      aria-label="Daily Study Goal"
      className="p-5 sm:p-6 rounded-2xl bg-[#131418] border border-[#23252e] hover:border-[#2f323e] transition-all space-y-4 shadow-sm"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Daily Study Goal
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Streak Indicator */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
            <span>{progress.streakDays || 1} Day Streak</span>
          </div>

          {/* Configure Target Goal Button */}
          <button
            id="configure-study-goal-btn"
            onClick={() => {
              setTargetInput(goalMinutes);
              setIsEditingGoal(!isEditingGoal);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            title="Configure target study minutes"
          >
            <Sliders className="w-3 h-3 text-zinc-400" />
            <span className="hidden sm:inline">Set Goal</span>
          </button>
        </div>
      </div>

      {/* Main Content: Progress Ring & Metrics */}
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 pt-1">
        {/* Circular Progress Ring with subtle ambient backlight */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full blur-xl pointer-events-none transition-opacity duration-1000 ${
              isGoalReached ? 'bg-emerald-500/10' : 'bg-indigo-500/10'
            }`}
          />

          <svg
            className="w-28 h-28 transform -rotate-90 relative z-10"
            viewBox="0 0 100 100"
            role="progressbar"
            aria-valuenow={calculatedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {/* Background Track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-[#20222a]"
              strokeWidth={strokeWidth}
              stroke="currentColor"
              fill="transparent"
            />
            {/* Animated Progress Arc with subtle ease transition */}
            <motion.circle
              cx="50"
              cy="50"
              r={radius}
              stroke={isGoalReached ? '#10b981' : '#6366f1'}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{
                duration: 1.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Center Info in Ring with subtle fade transition */}
          <motion.div
            key={isGoalReached ? 'goal-done' : 'goal-progress'}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none z-10"
          >
            {isGoalReached ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-0.5" />
                <span className="text-xs font-bold text-white tracking-tight">DONE</span>
              </>
            ) : (
              <>
                <span className="text-lg font-bold text-white tracking-tight">
                  {calculatedPercent}%
                </span>
                <span className="text-[10px] text-zinc-400 font-medium -mt-0.5">OF GOAL</span>
              </>
            )}
          </motion.div>
        </div>

        {/* Textual Metrics & Context */}
        <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
          <div className="flex flex-wrap items-baseline justify-center sm:justify-start gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {currentMinutes}
            </span>
            <span className="text-sm font-medium text-zinc-400">
              / {goalMinutes} mins studied today
            </span>

            {isGoalReached ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                Target Reached
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {remainingMinutes} min to go
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
            {getMotivationalMessage()}
          </p>

          {onStartStudying && (
            <div className="pt-1 flex items-center justify-center sm:justify-start gap-3">
              <button
                id="resume-study-btn"
                onClick={onStartStudying}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {primaryCourseTitle ? `Study "${primaryCourseTitle}"` : 'Jump into Lesson'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Goal Settings Drawer */}
      {isEditingGoal && (
        <div
          id="study-goal-editor-panel"
          className="pt-3 border-t border-[#22242c] space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200">
              Set Daily Target Study Time
            </span>
            <span className="text-xs font-mono text-indigo-400">{targetInput} minutes / day</span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            {presetGoals.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetInput(preset)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  targetInput === preset
                    ? 'bg-indigo-600 text-white border border-indigo-500'
                    : 'bg-[#181920] text-zinc-400 hover:text-zinc-200 border border-[#262833]'
                }`}
              >
                {preset} min
              </button>
            ))}
          </div>

          {/* Stepper & Slider */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#101115] border border-[#262833] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setTargetInput(Math.max(5, targetInput - 5))}
                className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Decrease 5 minutes"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={5}
                max={480}
                value={targetInput}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setTargetInput(val);
                }}
                className="w-14 text-center bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setTargetInput(Math.min(480, targetInput + 5))}
                className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Increase 5 minutes"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={targetInput}
              onChange={(e) => setTargetInput(Number(e.target.value))}
              className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-[#20222a] rounded-lg"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveGoal}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Goal'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditingGoal(false)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export const DailyStudyGoalWidget = DailyStudyGoal;
export default DailyStudyGoal;
