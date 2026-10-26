import React from 'react';
import { X, ExternalLink, BookOpen, Layers, Sparkles, Search, Compass } from 'lucide-react';
import { KeyTermItem } from '../types';

interface ConceptReferenceDrawerProps {
  term: KeyTermItem | null;
  isOpen: boolean;
  onClose: () => void;
  lessonTitle?: string;
  courseTitle?: string;
}

export const ConceptReferenceDrawer: React.FC<ConceptReferenceDrawerProps> = ({
  term,
  isOpen,
  onClose,
  lessonTitle,
  courseTitle,
}) => {
  if (!isOpen || !term) return null;

  const handleSearchWeb = () => {
    const query = encodeURIComponent(`${term.term} ${courseTitle || ''}`.trim());
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
  };

  const relatedList = term.relatedConcepts && term.relatedConcepts.length > 0
    ? term.relatedConcepts
    : ['Foundational Principles', 'Practical Application', 'Core Terminology'];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#07132b]/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        {/* Desktop Side Drawer & Mobile Responsive Container */}
        <aside
          role="dialog"
          aria-modal="true"
          className="w-screen max-w-md bg-[#0B1F44] border-l border-[#1a366f] text-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 z-10"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-[#1a366f] flex items-start justify-between gap-4 bg-[#081734]">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 uppercase font-semibold">
                <BookOpen className="w-3 h-3" />
                Concept Reference
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
                {term.term}
              </h2>
              {(lessonTitle || courseTitle) && (
                <p className="text-xs text-[#9bb1d6] truncate">
                  {lessonTitle ? `In "${lessonTitle}"` : courseTitle}
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#1a366f]/50 transition-colors shrink-0"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Quick Definition Card */}
            <div className="p-4 rounded-xl bg-[#07132b] border border-[#1a366f] space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#00B4FF] font-medium">
                Quick Definition
              </span>
              <p className="text-sm text-white leading-relaxed font-medium">
                {term.definition}
              </p>
            </div>

            {/* Context From Lesson */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9bb1d6] uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-[#00B4FF]" />
                Curriculum Context
              </div>
              <div className="p-3.5 rounded-xl bg-[#0f2756]/60 border border-[#1a366f] text-xs text-[#9bb1d6] leading-relaxed">
                {term.context || `Introduced during "${lessonTitle || 'the lesson'}" to establish structural comprehension.`}
              </div>
            </div>

            {/* Related Concepts */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9bb1d6] uppercase tracking-wider">
                <Compass className="w-3.5 h-3.5 text-[#00B4FF]" />
                Connected Concepts
              </div>
              <div className="flex flex-wrap gap-2">
                {relatedList.map((rel, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-[#07132b] text-[#9bb1d6] border border-[#1a366f]"
                  >
                    {rel}
                  </span>
                ))}
              </div>
            </div>

            {/* Learn More & Deeper Context */}
            <div className="p-4 rounded-xl bg-[#07132b]/70 border border-[#1a366f] space-y-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00B4FF]" />
                <h4 className="text-xs font-semibold text-white">Pedagogical Memory Anchor</h4>
              </div>
              <p className="text-xs text-[#9bb1d6] leading-relaxed">
                When reviewing <strong className="text-white font-medium">{term.term}</strong>, recall how it interacts with the surrounding concepts in this lesson. Consistent retention comes from understanding operational boundaries, not isolated rote memorization.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-[#1a366f] bg-[#081734] space-y-2">
            <button
              onClick={handleSearchWeb}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-semibold text-xs hover:bg-[#009de0] transition-colors shadow-sm cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search the Web for &ldquo;{term.term}&rdquo;</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
            </button>
            <p className="text-[11px] text-center text-[#627ca8]">
              Opens in a new tab without interrupting your lesson.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
