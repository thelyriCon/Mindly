import React, { useState } from 'react';
import { Plus, BookOpen, Search, Sparkles, Folder, CheckCircle2, Trash2 } from 'lucide-react';
import { Course } from '../types';
import { api } from '../lib/api';

interface CoursesViewProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onCourseCreated: (course: Course) => void;
  onCourseDeleted: (courseId: string) => void;
  onOpenAddMaterial: () => void;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  courses,
  onSelectCourse,
  onCourseCreated,
  onCourseDeleted,
  onOpenAddMaterial,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Course Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('Personal Learning');
  const [newCourseType, setNewCourseType] = useState('self-created');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract unique categories
  const categories = ['all', ...Array.from(new Set(courses.map((c) => c.category || 'General')))];

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'all' || (c.category || 'General') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.createCourse({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory.trim(),
        courseType: newCourseType,
      });
      onCourseCreated(res.course);
      setNewTitle('');
      setNewDescription('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Create course error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this course and all its lessons?')) return;
    try {
      await api.deleteCourse(courseId);
      onCourseDeleted(courseId);
    } catch (err) {
      console.error('Delete course error:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Your Courses</h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Organized knowledge modules, self-paced curriculum, and AI-structured lessons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddMaterial}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1a1b22] hover:bg-[#23242e] text-zinc-200 border border-[#2b2d38] text-xs font-medium transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>+ Add Material</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Course</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111216] p-3 rounded-xl border border-[#20222a]">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter courses by name or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[#0c0d10] border border-[#262831] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#121316] border border-dashed border-[#262831] space-y-3">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No courses found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {searchQuery
              ? 'Try adjusting your search filter or clear the query.'
              : 'Create your first course or dump raw material to begin building your knowledge base.'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Course</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              onClick={() => onSelectCourse(course)}
              className="group p-5 rounded-2xl bg-[#131418] hover:bg-[#16171d] border border-[#23252e] hover:border-indigo-500/50 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {course.category || 'General'}
                  </span>
                  <div className="flex items-center gap-2">
                    {course.isDemo && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/40">
                        Demo
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteCourse(e, course.id)}
                      className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Course"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                    {course.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Progress & Stats Footer */}
              <div className="pt-5 mt-4 border-t border-[#1e2027] space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{course.lessonCount || 0} Lessons</span>
                  <span className="text-indigo-400 font-medium">{course.progressPercent || 0}% Complete</span>
                </div>
                <div className="w-full h-1 bg-[#20222a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${course.progressPercent || 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create New Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-[#131418] border border-[#272932] shadow-2xl p-6 text-zinc-100">
            <h3 className="text-base font-semibold text-white mb-1">Create New Course</h3>
            <p className="text-xs text-zinc-400 mb-5">
              Build a container for your lessons, materials, notes, and glossary.
            </p>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Course Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Market Structure, Physics II, Aerodynamics"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="What will you learn or master in this course?"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Trading, Science"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Course Type</label>
                  <select
                    value={newCourseType}
                    onChange={(e) => setNewCourseType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="self-created">Self-Created</option>
                    <option value="ai-assisted">AI-Assisted</option>
                    <option value="imported">Imported Material</option>
                    <option value="manually-built">Manually Built</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1f2128]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
