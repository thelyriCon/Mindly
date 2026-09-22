import React, { useState } from 'react';
import { Plus, Search, Tag, FileText, Trash2, Edit2, CheckCircle2, Bookmark, BookOpen } from 'lucide-react';
import { Note, Course } from '../types';
import { api } from '../lib/api';

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

  const handleDelete = async (noteId: string) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api.deleteNote(noteId);
      onNoteDeleted(noteId);
    } catch (err) {
      console.error('Delete note error:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Personal Notes
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Your personal takeaways, reminders, research insights, and study summaries.
          </p>
        </div>

        <button
          onClick={openNewNoteModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111216] p-3 rounded-xl border border-[#20222a] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search notes by title, keywords, or #tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[#0c0d10] border border-[#262831] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Course Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400">Course:</span>
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

        {/* Filter Pills */}
        <div className="flex items-center gap-2 border-t border-[#1d1f27] pt-2 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Notes ({notes.length})
          </button>
          <button
            onClick={() => setActiveFilter('course')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              activeFilter === 'course'
                ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Course Notes
          </button>
          <button
            onClick={() => setActiveFilter('lesson')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              activeFilter === 'lesson'
                ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Lesson Notes
          </button>
          <button
            onClick={() => setActiveFilter('general')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              activeFilter === 'general'
                ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            General Notes
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#121316] border border-dashed border-[#262831] space-y-3">
          <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No notes found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Jot down your observations, formulas, chart summaries, or question lists.
          </p>
          <button
            onClick={openNewNoteModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
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
                className="group p-5 rounded-2xl bg-[#131418] hover:bg-[#16171d] border border-[#23252e] hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {course ? course.title : 'General Note'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditNote(note)}
                        className="p-1 text-zinc-500 hover:text-zinc-200 rounded"
                        title="Edit Note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1 text-zinc-500 hover:text-red-400 rounded"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                      {note.title}
                    </h3>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap line-clamp-4 mt-2 leading-relaxed font-sans">
                      {note.content}
                    </p>
                  </div>
                </div>

                {/* Tags and Date Footer */}
                <div className="pt-4 mt-4 border-t border-[#1e2027] flex items-center justify-between text-[11px] text-zinc-400">
                  <div className="flex flex-wrap gap-1">
                    {note.tags?.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#131418] border border-[#272932] shadow-2xl p-6 text-zinc-100">
            <h3 className="text-base font-semibold text-white mb-1">
              {editingNoteId ? 'Edit Note' : 'Create New Note'}
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Write personal observations, checklists, or key rules.
            </p>

            <form onSubmit={handleSaveNote} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Key BOS confirmation rules for 15m chart"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Content</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Type your notes here..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full p-3 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Associate with Course
                  </label>
                  <select
                    value={noteCourseId}
                    onChange={(e) => setNoteCourseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">None (General Note)</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="trading, setup, rules"
                    value={noteTags}
                    onChange={(e) => setNoteTags(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1f2128]">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
