import React, { useState } from 'react';
import {
  ArrowLeft,
  Plus,
  BookOpen,
  CheckCircle2,
  Bookmark,
  FileText,
  Trash2,
  Sparkles,
  HelpCircle,
  Clock,
  MoreVertical,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, Lesson } from '../types';

interface CourseDetailViewProps {
  course: Course;
  lessons: Lesson[];
  onBack: () => void;
  onSelectLesson: (lesson: Lesson) => void;
  onOpenAddMaterial: (courseId: string) => void;
  onCourseUpdated: (updatedCourse: Course, updatedLessons: Lesson[]) => void;
  onOpenNotesForCourse: (courseId: string) => void;
  onOpenTermsForCourse: (courseId: string) => void;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  course,
  lessons,
  onBack,
  onSelectLesson,
  onOpenAddMaterial,
  onCourseUpdated,
  onOpenNotesForCourse,
  onOpenTermsForCourse,
}) => {
  const [showNewLessonModal, setShowNewLessonModal] = useState(false);
  const [blankTitle, setBlankTitle] = useState('');
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);

  // Toggle lesson complete directly from list
  const handleToggleComplete = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    try {
      const res = await api.toggleComplete(lessonId);
      const updatedLessons = lessons.map((l) => (l.id === lessonId ? res.lesson : l));
      const completedCount = updatedLessons.filter((l) => l.isCompleted).length;
      const progressPercent = Math.round((completedCount / updatedLessons.length) * 100);
      onCourseUpdated({ ...course, progressPercent }, updatedLessons);
    } catch (err) {
      console.error('Error toggling complete:', err);
    }
  };

  // Toggle lesson bookmark directly from list
  const handleToggleBookmark = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    try {
      const res = await api.toggleBookmark(lessonId);
      const updatedLessons = lessons.map((l) => (l.id === lessonId ? res.lesson : l));
      onCourseUpdated(course, updatedLessons);
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  // Delete a lesson
  const handleDeleteLesson = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this lesson? This action cannot be undone.')) return;
    try {
      await api.deleteLesson(lessonId);
      const updatedLessons = lessons.filter((l) => l.id !== lessonId);
      const completedCount = updatedLessons.filter((l) => l.isCompleted).length;
      const progressPercent = updatedLessons.length
        ? Math.round((completedCount / updatedLessons.length) * 100)
        : 0;
      onCourseUpdated({ ...course, progressPercent }, updatedLessons);
    } catch (err) {
      console.error('Error deleting lesson:', err);
    }
  };

  // Create quick manual lesson
  const handleCreateBlankLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blankTitle.trim()) return;
    setIsCreatingBlank(true);
    try {
      const res = await api.createLesson(course.id, {
        title: blankTitle.trim(),
        structuredContent: {
          title: blankTitle.trim(),
          overview: 'New self-authored lesson.',
          learningObjectives: [],
          mainConcepts: [],
          examples: [],
          importantDistinctions: [],
          keyTerms: [],
          keyTakeaways: [],
          reviewQuestions: [],
        },
      });
      const updatedLessons = [...lessons, res.lesson];
      onCourseUpdated(course, updatedLessons);
      setBlankTitle('');
      setShowNewLessonModal(false);
      onSelectLesson(res.lesson);
    } catch (err) {
      console.error('Create lesson error:', err);
    } finally {
      setIsCreatingBlank(false);
    }
  };

  const completedCount = lessons.filter((l) => l.isCompleted).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Breadcrumb navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Courses</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenNotesForCourse(course.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16171d] border border-[#272935] hover:bg-[#1e2029] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>Course Notes</span>
          </button>
          <button
            onClick={() => onOpenTermsForCourse(course.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16171d] border border-[#272935] hover:bg-[#1e2029] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
            <span>Glossary</span>
          </button>
        </div>
      </div>

      {/* Course Banner Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#131418] border border-[#23252e] relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                {course.category || 'General'}
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                {course.courseType || 'Personal Learning'}
              </span>
              {course.isDemo && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/40">
                  Demo Course
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {course.title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {course.description || 'Structured knowledge base and lessons.'}
            </p>

            <div className="flex items-center gap-4 pt-2 text-xs text-zinc-400">
              <span>{lessons.length} Lesson{lessons.length === 1 ? '' : 's'}</span>
              <span>•</span>
              <span>{completedCount} Completed</span>
              <span>•</span>
              <span className="text-indigo-400 font-medium">{progressPercent}% Progress</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-[#20222a] rounded-full overflow-hidden mt-3 max-w-md">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => onOpenAddMaterial(course.id)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>+ Add Material (Dump)</span>
            </button>
            <button
              onClick={() => setShowNewLessonModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1d24] hover:bg-[#252631] text-zinc-200 text-xs font-medium border border-[#2c2e3c] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Blank Lesson</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lesson List Header */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
          Curriculum & Lessons
        </h2>
        <span className="text-xs text-zinc-400">
          Click any lesson to read, edit, or test yourself
        </span>
      </div>

      {/* Lesson List */}
      {lessons.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#121316] border border-dashed border-[#262831] space-y-3">
          <BookOpen className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No lessons yet in this course</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Drop in YouTube transcripts, lecture notes, or screenshots to generate your first structured lesson with AI.
          </p>
          <button
            onClick={() => onOpenAddMaterial(course.id)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Add First Material</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson, index) => {
            const lessonIndexStr = String(index + 1).padStart(2, '0');
            const hasQuiz = lesson.structuredContent?.reviewQuestions?.length > 0;

            return (
              <div
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                className="group p-4 sm:p-5 rounded-xl bg-[#131418] hover:bg-[#17181d] border border-[#23252e] hover:border-indigo-500/40 transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Lesson index marker */}
                  <span className="text-xs font-mono font-medium text-zinc-500 group-hover:text-indigo-400 transition-colors w-6">
                    {lessonIndexStr}
                  </span>

                  {/* Completion Toggle */}
                  <button
                    onClick={(e) => handleToggleComplete(e, lesson.id)}
                    className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors"
                    title={lesson.isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 ${lesson.isCompleted ? 'text-emerald-400' : 'text-zinc-600'}`}
                    />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-zinc-100 group-hover:text-white transition-colors truncate">
                        {lesson.title}
                      </h3>
                      {lesson.isDemo && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                          Demo
                        </span>
                      )}
                    </div>
                    {lesson.structuredContent?.overview && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5 max-w-xl">
                        {lesson.structuredContent.overview}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right badges & controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {hasQuiz && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      <HelpCircle className="w-3 h-3 text-indigo-400" />
                      <span>{lesson.quizScore !== undefined ? `${lesson.quizScore}%` : 'Quiz'}</span>
                    </span>
                  )}

                  <button
                    onClick={(e) => handleToggleBookmark(e, lesson.id)}
                    className={`p-1.5 rounded hover:bg-zinc-800 transition-colors ${
                      lesson.isBookmarked ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-300'
                    }`}
                    title="Bookmark"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleDeleteLesson(e, lesson.id)}
                    className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Lesson"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Blank Lesson Creation Modal */}
      {showNewLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-[#131418] border border-[#272932] shadow-2xl p-6 text-zinc-100">
            <h3 className="text-sm font-semibold text-white mb-1">Create Blank Lesson</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Add a manual lesson to "{course.title}". You can write your own notes and structure.
            </p>

            <form onSubmit={handleCreateBlankLesson} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Lesson Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Higher Highs & Higher Lows Definition"
                  value={blankTitle}
                  onChange={(e) => setBlankTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewLessonModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBlank}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isCreatingBlank ? 'Creating...' : 'Create Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
