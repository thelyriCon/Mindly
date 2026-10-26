import React, { useState } from 'react';
import { Bookmark, Search, Plus, Trash2, BookOpen, ExternalLink } from 'lucide-react';
import { KeyTermItem, Course } from '../types';
import { api } from '../lib/api';
import { NokiaLoader } from './NokiaLoader';

interface KeyTermsViewProps {
  terms: KeyTermItem[];
  courses: Course[];
  onTermCreated: (term: KeyTermItem) => void;
  onTermDeleted: (termId: string) => void;
  onNavigateToCourseLesson?: (courseId: string, lessonId?: string) => void;
  initialCourseFilter?: string;
}

export const KeyTermsView: React.FC<KeyTermsViewProps> = ({
  terms,
  courses,
  onTermCreated,
  onTermDeleted,
  onNavigateToCourseLesson,
  initialCourseFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(
    initialCourseFilter || 'all'
  );
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [newTerm, setNewTerm] = useState('');
  const [newDefinition, setNewDefinition] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newRelated, setNewRelated] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredTerms = terms.filter((t) => {
    const matchesSearch =
      t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.definition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.context && t.context.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCourse =
      selectedCourseFilter === 'all' || t.courseId === selectedCourseFilter;

    return matchesSearch && matchesCourse;
  });

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim() || !newDefinition.trim()) return;

    setIsSaving(true);
    const relatedList = newRelated
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    try {
      const res = await api.createTerm({
        term: newTerm.trim(),
        definition: newDefinition.trim(),
        context: newContext.trim() || undefined,
        relatedConcepts: relatedList,
        courseId: newCourseId || undefined,
      });
      onTermCreated(res.term);
      setNewTerm('');
      setNewDefinition('');
      setNewContext('');
      setNewRelated('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Create term error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (termId: string) => {
    if (!window.confirm('Delete this term from the glossary?')) return;
    try {
      await api.deleteTerm(termId);
      onTermDeleted(termId);
    } catch (err) {
      console.error('Delete term error:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Bookmark className="w-5 h-5 text-[#00B4FF]" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Key Terms & Glossary
            </h1>
          </div>
          <p className="text-xs text-[#9bb1d6]">
            Subject-specific vocabulary, precise definitions, and contextual origins across your learning.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Term</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0B1F44] p-3 rounded-2xl border border-[#1a366f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#627ca8] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search glossary terms or definitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
          />
        </div>

        {/* Course Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#9bb1d6]">Filter by Course:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF] cursor-pointer"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Terms Grid */}
      {filteredTerms.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#00B4FF]/10 text-[#00B4FF] flex items-center justify-center mx-auto">
            <Bookmark className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No glossary terms found</h3>
          <p className="text-xs text-[#9bb1d6] max-w-sm mx-auto leading-relaxed">
            When you import transcripts or notes, Mindly extracts terms automatically, or you can add custom terms manually.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Term</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTerms.map((term) => {
            const course = courses.find((c) => c.id === term.courseId);

            return (
              <div
                key={term.id}
                className="group p-5 rounded-2xl bg-[#0B1F44] hover:bg-[#0d244f] border border-[#1a366f] hover:border-[#00B4FF]/60 transition-all flex flex-col justify-between shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-[#00B4FF] transition-colors">
                      {term.term}
                    </h3>
                    <button
                      onClick={() => term.id && handleDelete(term.id)}
                      className="p-1 text-[#627ca8] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Delete Term"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-[#9bb1d6] leading-relaxed">
                    {term.definition}
                  </p>

                  {term.context && (
                    <div className="p-2.5 rounded-xl bg-[#081734] border border-[#1a366f] text-xs text-[#9bb1d6]">
                      <span className="text-[10px] font-mono text-[#00B4FF] block uppercase mb-0.5 font-bold">
                        Context
                      </span>
                      {term.context}
                    </div>
                  )}

                  {term.relatedConcepts && term.relatedConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {term.relatedConcepts.map((rel, rIdx) => (
                        <span
                          key={rIdx}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/20 font-medium"
                        >
                          {rel}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-[#1a366f] flex items-center justify-between text-[11px] text-[#627ca8]">
                  <span className="truncate">{course ? course.title : 'Global Glossary'}</span>
                  {term.courseId && onNavigateToCourseLesson && (
                    <button
                      onClick={() => onNavigateToCourseLesson(term.courseId!, term.lessonId)}
                      className="text-[#00B4FF] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Study Lesson</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Term Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 text-white">
            <h3 className="text-base font-bold text-white mb-1">Add Term to Glossary</h3>
            <p className="text-xs text-[#9bb1d6] mb-4">
              Add technical vocabulary, definitions, and mental models to your study index.
            </p>

            <form onSubmit={handleCreateTerm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">Term or Concept</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liquidity Sweep, Bernouilli's Principle"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Precise Definition</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Clear conceptual meaning without extraneous fluff..."
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Contextual Origin (Optional)</label>
                <input
                  type="text"
                  placeholder="Where or when this concept applies in practice..."
                  value={newContext}
                  onChange={(e) => setNewContext(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Related Concepts (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Order Blocks, Fair Value Gaps"
                  value={newRelated}
                  onChange={(e) => setNewRelated(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Attach to Course (Optional)</label>
                <select
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF]"
                >
                  <option value="">Global Glossary (All Courses)</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1a366f]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs text-[#9bb1d6] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <NokiaLoader label="Saving..." color="#0B1F44" dotSize="w-1 h-1" />
                  ) : (
                    'Add Term'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
