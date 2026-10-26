import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, ArrowRight, X, Loader2, BookOpen } from 'lucide-react';
import { api } from '../lib/api';

interface TopicDiscoveryInputProps {
  placeholder?: string;
  initialValue?: string;
  onSelectTopic?: (topic: string) => void;
  onDirectGenerateCourse?: (topic: string) => Promise<void> | void;
  isGenerating?: boolean;
  generatingTopic?: string | null;
  className?: string;
  autoFocus?: boolean;
  showTrendingWhenEmpty?: boolean;
}

const DEFAULT_TRENDING = [
  'Internal Combustion Engine Mechanics',
  'Songwriting & Vocal Performance',
  'Behavioral Economics',
  'Quantum Computing & Qubits',
  'Neurobiology & Brain Plasticity',
  'Classical Mechanics & Thermodynamics',
];

export const TopicDiscoveryInput: React.FC<TopicDiscoveryInputProps> = ({
  placeholder = 'Search or enter any topic (e.g., "singing", "crankshaft", "game theory")...',
  initialValue = '',
  onSelectTopic,
  onDirectGenerateCourse,
  isGenerating = false,
  generatingTopic = null,
  className = '',
  autoFocus = false,
  showTrendingWhenEmpty = true,
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    if (initialValue && initialValue !== query) {
      setQuery(initialValue);
    }
  }, [initialValue]);

  // Debounced 300ms intelligent semantic topic lookup
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.suggestTopics(trimmed);
        if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
          setSuggestions(res.suggestions);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.warn('[TOPIC DISCOVERY LOOKUP ERROR]', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleChipClick = (topic: string) => {
    if (isGenerating) return;
    if (onDirectGenerateCourse) {
      onDirectGenerateCourse(topic);
    } else if (onSelectTopic) {
      onSelectTopic(topic);
    }
  };

  const displayedChips =
    suggestions.length > 0
      ? suggestions
      : query.trim().length === 0 && showTrendingWhenEmpty
      ? DEFAULT_TRENDING
      : [];

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute left-3.5 top-3 text-[#627ca8] flex items-center justify-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-[#00B4FF] animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <input
          type="text"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (onSelectTopic && e.target.value.trim()) {
              onSelectTopic(e.target.value.trim());
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#081734] border border-[#1a366f] hover:border-[#00B4FF]/60 focus:border-[#00B4FF] text-white placeholder-[#627ca8] text-xs sm:text-sm font-medium transition-all shadow-inner focus:outline-none"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
            }}
            className="absolute right-3.5 top-3 text-[#627ca8] hover:text-white transition-colors cursor-pointer p-0.5"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Generating Feedback Banner */}
      {isGenerating && generatingTopic && (
        <div className="p-3.5 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/40 text-[#00B4FF] flex items-center gap-3 animate-in fade-in">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Generating Full Multi-Day Curriculum</span> for{' '}
            <span className="underline decoration-dotted font-semibold text-white">
              "{generatingTopic}"
            </span>
            ... Authoring Lesson 1 with deep pedagogical grounding.
          </div>
        </div>
      )}

      {/* Suggested Semantic Topic Chips */}
      {displayedChips.length > 0 && !isGenerating && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#9bb1d6]">
            <span className="flex items-center gap-1.5 uppercase font-bold tracking-wider text-[#00B4FF]">
              <Sparkles className="w-3 h-3 text-[#00B4FF]" />
              {suggestions.length > 0
                ? 'Semantic Topic Suggestions (1-Tap Generate)'
                : 'Suggested Topic Pathways'}
            </span>
            <span className="text-[10px] text-[#627ca8]">Click chip to start course</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-0.5">
            {displayedChips.map((topic, idx) => (
              <button
                key={`${topic}-${idx}`}
                type="button"
                onClick={() => handleChipClick(topic)}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#07132b] hover:bg-[#00B4FF] border border-[#1a366f] hover:border-[#00B4FF] text-[#9bb1d6] hover:text-[#0B1F44] text-xs font-semibold transition-all shadow-sm hover:shadow-md hover:shadow-[#00B4FF]/25 cursor-pointer active:scale-95"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#00B4FF] group-hover:text-[#0B1F44] transition-colors shrink-0" />
                <span>{topic}</span>
                <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#0B1F44] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
