import React, { useState } from 'react';
import { Plus, Search, Tag, FileText, Trash2, Edit2, BookOpen } from 'lucide-react';
import { Note, Course } from '../types';
import { api } from '../lib/api';
import { NokiaLoader } from './NokiaLoader';

interface NotesViewProps {
  notes: Note[];
  courses: Course[];
  onNoteCreated: (note: Note) => void;
  onNoteUpdated: (note: Note) => void;
  onNoteDeleted: (noteId: string) => void;
  initialCourseFilter?: string;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  courses,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
  initialCourseFilter,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'general' | 'course' | 'lesson'>('all');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(
    initialCourseFilter || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Note editor modal
  const [showEditor, setShowEditor] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCourseId, setNoteCourseId] = useState<string>('');
  const [noteTags, setNoteTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      activeFilter === 'all' ||
      (activeFilter === 'general' && n.type === 'general') ||
      (activeFilter === 'course' && n.type === 'course') ||
      (activeFilter === 'lesson' && n.type === 'lesson');

    const matchesCourse =
      selectedCourseFilter === 'all' || n.courseId === selectedCourseFilter;

    return matchesSearch && matchesType && matchesCourse;
  });

  const openNewNoteModal = () => {
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteCourseId(courses.length > 0 ? courses[0].id : '');
    setNoteTags('');
    setShowEditor(true);
  };

  const openEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteCourseId(note.courseId || '');
    setNoteTags(note.tags?.join(', ') || '');
    setShowEditor(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    setIsSaving(true);
    const tagsArray = noteTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingNoteId) {
        const res = await api.updateNote(editingNoteId, {
          title: noteTitle.trim(),
          content: noteContent.trim(),
          courseId: noteCourseId || null,
          tags: tagsArray,
        });
        onNoteUpdated(res.note);
      } else {
        const res = await api.createNote({
          title: noteTitle.trim(),
          content: noteContent.trim(),
          courseId: noteCourseId || null,
          tags: tagsArray,
          type: noteCourseId ? 'course' : 'general',
        });
        onNoteCreated(res.note);
      }
      setShowEditor(false);
    } catch (err) {
      console.error('Save note error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this note permanently?')) return;
    try {
      await api.deleteNote(noteId);
      onNoteDeleted(noteId);
    } catch (err) {
      console.error('Delete note error:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <FileText className="w-5 h-5 text-[#00B4FF]" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Study Notes & Insights
            </h1>
          </div>
          <p className="text-xs text-[#9bb1d6]">
            Personal takeaways, synthetic summaries, and research references.
          </p>
        </div>

        <button
          onClick={openNewNoteModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0B1F44] p-3 rounded-2xl border border-[#1a366f] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#627ca8] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search notes by title, keywords, or #tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
            />
          </div>

          {/* Course Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#9bb1d6]">Course:</span>
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

        {/* Filter Pills */}
        <div className="flex items-center gap-2 border-t border-[#1a366f]/60 pt-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-xl transition-colors cursor-pointer font-semibold ${
              activeFilter === 'all'
                ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
            }`}
          >
            All Notes ({notes.length})
          </button>
          <button
            onClick={() => setActiveFilter('course')}
            className={`px-3 py-1 rounded-xl transition-colors cursor-pointer font-semibold ${
              activeFilter === 'course'
                ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
            }`}
          >
            Course Notes
          </button>
          <button
            onClick={() => setActiveFilter('lesson')}
            className={`px-3 py-1 rounded-xl transition-colors cursor-pointer font-semibold ${
              activeFilter === 'lesson'
                ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
            }`}
          >
            Lesson Notes
          </button>
          <button
            onClick={() => setActiveFilter('general')}
            className={`px-3 py-1 rounded-xl transition-colors cursor-pointer font-semibold ${
              activeFilter === 'general'
                ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
            }`}
          >
            General Notes
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#00B4FF]/10 text-[#00B4FF] flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No notes found</h3>
          <p className="text-xs text-[#9bb1d6] max-w-sm mx-auto leading-relaxed">
            Jot down your observations, formulas, chart summaries, or question lists.
          </p>
          <button
            onClick={openNewNoteModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Note</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const course = courses.find((c) => c.id === note.courseId);

            return (
              <div
                key={note.id}
                onClick={() => openEditNote(note)}
                className="group p-5 rounded-2xl bg-[#0B1F44] hover:bg-[#0d244f] border border-[#1a366f] hover:border-[#00B4FF]/60 transition-all flex flex-col justify-between cursor-pointer shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#081734] text-[#00B4FF] border border-[#1a366f]">
                      {note.type === 'course' ? 'Course Note' : note.type === 'lesson' ? 'Lesson Note' : 'General'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditNote(note);
                        }}
                        className="p-1 text-[#627ca8] hover:text-[#00B4FF] opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit Note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteNote(e, note.id)}
                        className="p-1 text-[#627ca8] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#00B4FF] transition-colors">
                      {note.title}
                    </h3>
                    <p className="text-xs text-[#9bb1d6] line-clamp-3 mt-1.5 leading-relaxed whitespace-pre-line">
                      {note.content}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#1a366f] flex items-center justify-between text-[11px] text-[#627ca8]">
                  <span className="truncate">{course ? course.title : 'Independent Note'}</span>
                  <span>{new Date(note.updatedAt || note.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 text-white">
            <h3 className="text-base font-bold text-white mb-1">
              {editingNoteId ? 'Edit Study Note' : 'Create New Note'}
            </h3>
            <p className="text-xs text-[#9bb1d6] mb-4">
              Write down your takeaways, mental models, or quick reminders.
            </p>

            <form onSubmit={handleSaveNote} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">Note Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Key distinction between supply and demand zones"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Related Course (Optional)</label>
                <select
                  value={noteCourseId}
                  onChange={(e) => setNoteCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF]"
                >
                  <option value="">No Course (General Note)</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Note Content</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Explain the concept in your own words, formulate analogies..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. trading, liquidity, psychology"
                  value={noteTags}
                  onChange={(e) => setNoteTags(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1a366f]">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
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
                  ) : editingNoteId ? (
                    'Save Changes'
                  ) : (
                    'Save Note'
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
