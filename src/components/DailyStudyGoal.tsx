import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, Sliders, ArrowRight, Clock, Plus, Minus, Check } from 'lucide-react';
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
  const [internalProgress, setInternalProgress] = useState<StudyProgress>(
    propProgress || {
      dailyGoalMinutes: propDailyGoalMinutes || 30,
      todaySeconds: (propCurrentMinutes || 0) * 60,
      todayMinutes: propCurrentMinutes !== undefined ? propCurrentMinutes : 0,
      progressPercent: 0,
      streakDays: 0,
      remainingMinutes: propDailyGoalMinutes || 30,
      isGoalReached: false,
    }
  );

  useEffect(() => {
    if (propProgress) {
      setInternalProgress(propProgress);
    }
  }, [propProgress]);

  useEffect(() => {
    if (!propProgress && propCurrentMinutes === undefined) {
      let isMounted = true;
      api
        .getStudyProgress()
        .then((res) => {
          if (isMounted) setInternalProgress(res.progress);
        })
        .catch(() => {});
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

  useEffect(() => {
    setTargetInput(goalMinutes);
  }, [goalMinutes]);

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
        await api.updateStudyGoal(targetInput);
        const pRes = await api.getStudyProgress();
        setInternalProgress(pRes.progress);
      }
      setIsEditingGoal(false);
    } catch (err) {
      console.error('Failed to save study goal:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const presetGoals = [15, 30, 45, 60, 90];

  const getMotivationalMessage = () => {
    if (isGoalReached) {
      return `Target accomplished! You've achieved your daily ${goalMinutes} minutes of focused learning.`;
    }
    if (calculatedPercent >= 75) {
      return `Almost there! Just ${remainingMinutes} more minutes to complete your daily target.`;
    }
    if (calculatedPercent >= 50) {
      return `Halfway through your daily commitment. Keep the momentum going!`;
    }
    if (calculatedPercent > 0) {
      return `Solid start today with ${currentMinutes} minutes logged. Finish strong!`;
    }
    return `Open any lesson or capture new material to kick off today's study.`;
  };

  return (
    <section
      aria-label="Daily Study Goal Widget"
      className="p-5 sm:p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] hover:border-[#00B4FF]/40 transition-all space-y-5 shadow-lg relative overflow-hidden flex flex-col justify-between"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-[#9bb1d6] uppercase tracking-wider">
              Daily Study Target
            </h2>
          </div>
        </div>

        <button
          id="configure-study-goal-btn"
          onClick={() => {
            setTargetInput(goalMinutes);
            setIsEditingGoal(!isEditingGoal);
          }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#07132b] hover:bg-[#0f2756] border border-[#1a366f] text-[#9bb1d6] hover:text-white text-xs font-medium transition-colors cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-[#00B4FF]" />
          <span>Adjust Target</span>
        </button>
      </div>

      {/* Main Content: Progress Ring & Metrics */}
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 pt-1">
        <div className="relative shrink-0 flex items-center justify-center">
          <svg className="w-28 h-28 transform -rotate-90 relative z-10" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#07132b"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#00B4FF"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none z-10">
            {isGoalReached ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-[#00B4FF] mb-0.5" />
                <span className="text-xs font-bold text-white tracking-tight">DONE</span>
              </>
            ) : (
              <>
                <span className="text-lg font-bold text-white tracking-tight font-mono">
                  {calculatedPercent}%
                </span>
                <span className="text-[10px] text-[#627ca8] font-medium -mt-0.5">OF GOAL</span>
              </>
            )}
          </div>
        </div>

        {/* Textual Metrics & Context */}
        <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
          <div className="flex flex-wrap items-baseline justify-center sm:justify-start gap-2">
            <span className="text-2xl font-bold text-white tracking-tight font-mono">
              {currentMinutes}
            </span>
            <span className="text-sm font-medium text-[#9bb1d6]">
              / {goalMinutes} mins studied today
            </span>

            {isGoalReached ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30">
                Target Reached
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#07132b] text-[#9bb1d6] border border-[#1a366f]">
                {remainingMinutes} min to go
              </span>
            )}
          </div>

          <p className="text-xs text-[#9bb1d6] leading-relaxed max-w-lg">
            {getMotivationalMessage()}
          </p>

          {onStartStudying && (
            <div className="pt-1 flex items-center justify-center sm:justify-start gap-3">
              <button
                id="resume-study-btn"
                onClick={onStartStudying}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-sm cursor-pointer"
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
          className="pt-3 border-t border-[#1a366f] space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Set Daily Target Study Time
            </span>
            <span className="text-xs font-mono text-[#00B4FF] font-bold">{targetInput} minutes / day</span>
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
                    ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                    : 'bg-[#07132b] text-[#9bb1d6] hover:text-white border border-[#1a366f]'
                }`}
              >
                {preset} min
              </button>
            ))}
          </div>

          {/* Stepper & Slider */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#07132b] border border-[#1a366f] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setTargetInput(Math.max(5, targetInput - 5))}
                className="p-1.5 text-[#9bb1d6] hover:text-white rounded hover:bg-[#0f2756] transition-colors cursor-pointer"
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
                className="p-1.5 text-[#9bb1d6] hover:text-white rounded hover:bg-[#0f2756] transition-colors cursor-pointer"
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
              className="flex-1 accent-[#00B4FF] cursor-pointer h-1.5 bg-[#07132b] rounded-lg"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveGoal}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Goal'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditingGoal(false)}
                className="px-2.5 py-1.5 rounded-lg bg-[#07132b] hover:bg-[#0f2756] text-[#9bb1d6] hover:text-white text-xs transition-colors cursor-pointer"
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
