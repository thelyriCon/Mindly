import React, { useState } from 'react';
import { Bookmark, Search, Plus, Trash2, BookOpen, ExternalLink } from 'lucide-react';
import { KeyTermItem, Course } from '../types';
import { api } from '../lib/api';

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Key Terms & Glossary
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Subject-specific vocabulary, precise definitions, and contextual origins across your learning.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Term</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111216] p-3 rounded-xl border border-[#20222a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search glossary terms or definitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[#0c0d10] border border-[#262831] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Course Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Filter by Course:</span>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-[#0c0d10] border border-[#262831] text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
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
        <div className="p-12 text-center rounded-2xl bg-[#121316] border border-dashed border-[#262831] space-y-3">
          <Bookmark className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No glossary terms found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            When you import transcripts or notes, Mindly extracts terms automatically, or you can add custom terms manually.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
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
                className="group p-5 rounded-2xl bg-[#131418] hover:bg-[#16171d] border border-[#23252e] hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                      {term.term}
                    </h3>
                    <button
                      onClick={() => term.id && handleDelete(term.id)}
                      className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Term"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {term.definition}
                  </p>

                  {term.context && (
                    <div className="p-2.5 rounded-lg bg-[#0e0f12] text-xs text-zinc-400">
                      <span className="text-[10px] font-mono text-zinc-500 block uppercase mb-0.5">
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
                          className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
                        >
                          {rel}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Origin / Where it appeared */}
                <div className="pt-4 mt-4 border-t border-[#1e2027] flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="truncate max-w-[180px]">
                    {course ? course.title : 'Global Term'}
                  </span>
                  {term.lessonId && onNavigateToCourseLesson && (
                    <button
                      onClick={() =>
                        onNavigateToCourseLesson(term.courseId || '', term.lessonId)
                      }
                      className="text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Go to lesson</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Custom Term Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-[#131418] border border-[#272932] shadow-2xl p-6 text-zinc-100">
            <h3 className="text-base font-semibold text-white mb-1">Add Key Term</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Add a specialized word, formula, or concept to your glossary.
            </p>

            <form onSubmit={handleCreateTerm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Term</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Change of Character (CHoCH)"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Definition</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Clear, authoritative explanation..."
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Context / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. First sign of an impending trend reversal"
                  value={newContext}
                  onChange={(e) => setNewContext(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Course Association
                </label>
                <select
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Global / No Course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1f2128]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Add to Glossary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
