import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check, BookOpen, Layers, Brain } from 'lucide-react';

interface OnboardingModalProps {
  onComplete: (interests: string[]) => void;
  userName: string;
}

const DEFAULT_TOPICS = [
  'Trading',
  'Graphic Design',
  'Physics',
  'Aerodynamics',
  'Music Theory',
  'Programming',
  'Cognitive Science',
  'Neuroscience',
  'Philosophy',
  'History',
  'Mathematics',
  'Medicine',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete, userName }) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(['Trading', 'Programming']);
  const [customTopic, setCustomTopic] = useState('');

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTopic.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics([...selectedTopics, trimmed]);
      setCustomTopic('');
    }
  };

  const handleSubmit = () => {
    onComplete(selectedTopics);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#131418] border border-[#272932] shadow-2xl p-6 sm:p-8 text-zinc-100 overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Welcome to Mindly, {userName}</h2>
            <p className="text-xs text-zinc-400">Your intelligent personal learning and knowledge workspace</p>
          </div>
        </div>

        {/* 3-Step Core Concept */}
        <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-[#0c0d10] border border-[#20222a] mb-6">
          <div className="text-center px-1">
            <div className="text-[11px] font-mono text-indigo-400 mb-1">01 / CAPTURE</div>
            <p className="text-xs font-medium text-zinc-200">Bring raw material</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Transcripts, notes, screenshots</p>
          </div>
          <div className="text-center px-1 border-x border-[#1e2027]">
            <div className="text-[11px] font-mono text-indigo-400 mb-1">02 / STRUCTURE</div>
            <p className="text-xs font-medium text-zinc-200">Mindly organizes it</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">AI extracts concepts & terms</p>
          </div>
          <div className="text-center px-1">
            <div className="text-[11px] font-mono text-indigo-400 mb-1">03 / MASTER</div>
            <p className="text-xs font-medium text-zinc-200">Learn & remember</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Quizzes, notes & personal tutor</p>
          </div>
        </div>

        {/* Interests Question */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-200 mb-1.5">
            What do you want to learn right now?
          </label>
          <p className="text-xs text-zinc-400 mb-3.5">
            Select any initial interests. You can add or change subjects at any time.
          </p>

          <div className="flex flex-wrap gap-2 mb-3 max-h-44 overflow-y-auto pr-1">
            {DEFAULT_TOPICS.map((topic) => {
              const isSelected = selectedTopics.includes(topic);
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                      : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-indigo-400" />}
                  <span>{topic}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Interest Input */}
          <form onSubmit={handleAddCustom} className="flex gap-2">
            <input
              type="text"
              placeholder="Add another topic (e.g. Organic Chemistry)..."
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!customTopic.trim()}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              + Add
            </button>
          </form>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-4 border-t border-[#20222a]">
          <span className="text-xs text-zinc-400">
            {selectedTopics.length} topic{selectedTopics.length === 1 ? '' : 's'} selected
          </span>
          <button
            id="onboarding-continue-btn"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 cursor-pointer"
          >
            <span>Start Learning</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
