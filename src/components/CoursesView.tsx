import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Trash2,
  ArrowRight,
  Share2,
  Archive,
  ArchiveRestore,
  Compass,
  Plus,
} from 'lucide-react';
import { Course } from '../types';
import { api } from '../lib/api';
import { ShareCourseModal } from './ShareCourseModal';
import { CourseThumbnail } from './CourseThumbnail';
import { CourseOptionsMenu } from './CourseOptionsMenu';

interface CoursesViewProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onCourseCreated?: (course: Course) => void;
  onCourseUpdated?: (course: Course) => void;
  onCourseDeleted: (courseId: string) => void;
  onOpenAddMaterial: () => void;
  onNavigateTab?: (tab: any) => void;
  onOpenNewCourse?: (initialTopic?: string) => void;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  courses,
  onSelectCourse,
  onCourseCreated,
  onCourseUpdated,
  onCourseDeleted,
  onOpenAddMaterial,
  onNavigateTab,
  onOpenNewCourse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [sharingCourse, setSharingCourse] = useState<Course | null>(null);

  const activeCourses = courses.filter((c) => !c.isArchived);
  const archivedCourses = courses.filter((c) => !!c.isArchived);
  const currentPool = viewTab === 'active' ? activeCourses : archivedCourses;

  // Extract unique categories
  const categories = ['all', ...Array.from(new Set(currentPool.map((c) => c.category || 'General')))];

  const filteredCourses = currentPool.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'all' || (c.category || 'General') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <BookOpen className="w-5 h-5 text-[#00B4FF]" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Curriculum Courses
            </h1>
          </div>
          <p className="text-xs text-[#9bb1d6]">
            Structured knowledge modules, bite-sized lessons, and verified source grounding.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenAddMaterial}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#00B4FF]" />
            <span>Capture Material</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenNewCourse?.()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Course</span>
          </button>
        </div>
      </div>

      {/* Active vs Archived Navigation */}
      <div className="flex items-center justify-between border-b border-[#1a366f] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewTab('active')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              viewTab === 'active'
                ? 'bg-[#00B4FF] text-[#0B1F44] font-bold shadow'
                : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Active Curriculum</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono font-bold">
              {activeCourses.length}
            </span>
          </button>
          <button
            onClick={() => setViewTab('archived')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              viewTab === 'archived'
                ? 'bg-amber-400 text-amber-950 font-bold shadow'
                : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archived</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono font-bold">
              {archivedCourses.length}
            </span>
          </button>
        </div>
        {viewTab === 'archived' && (
          <span className="text-[11px] text-[#9bb1d6] hidden sm:inline">
            Archived courses are hidden from your daily dashboard
          </span>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0B1F44] p-3 rounded-2xl border border-[#1a366f]">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#627ca8] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={viewTab === 'active' ? "Filter active courses..." : "Filter archived courses..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
          />
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                  : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#00B4FF]/10 text-[#00B4FF] flex items-center justify-center mx-auto">
            {viewTab === 'active' ? <BookOpen className="w-6 h-6" /> : <Archive className="w-6 h-6 text-amber-400" />}
          </div>
          <h3 className="text-sm font-bold text-white">
            {viewTab === 'active' ? 'No active courses found' : 'No archived courses'}
          </h3>
          <p className="text-xs text-[#9bb1d6] max-w-sm mx-auto leading-relaxed">
            {viewTab === 'active'
              ? (searchQuery
                  ? 'Try adjusting your search filter or clear the query.'
                  : 'You do not have any active courses in your collection yet. Visit Discover to explore new subjects and start learning, or capture notes into your library.')
              : 'When you complete a course or wish to declutter your active study space, click Archive on any course card to tuck it safely here.'}
          </p>
          {viewTab === 'active' && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenNewCourse?.()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] text-xs font-bold hover:bg-[#009de0] transition-colors cursor-pointer shadow-md shadow-[#00B4FF]/20"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Course</span>
              </button>
              <button
                type="button"
                onClick={onOpenAddMaterial}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#081734] hover:bg-[#0f2756] text-white border border-[#1a366f] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#00B4FF]" />
                <span>Capture Material</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => {
            const lessonCount =
              course.lessonCount ??
              course.lessonsCount ??
              (Array.isArray(course.studyDays) ? course.studyDays.length : 0);

            let lessonText = '';
            if (lessonCount === 0) {
              lessonText = '0 Lessons · Setup';
            } else if (lessonCount === 1) {
              lessonText = '1 Lesson';
            } else {
              lessonText = `${lessonCount} Lessons`;
            }

            return (
              <div
                key={course.id}
                onClick={() => onSelectCourse(course)}
                className="group p-5 rounded-2xl bg-[#0B1F44] hover:bg-[#0d244f] border border-[#1a366f] hover:border-[#00B4FF]/60 transition-all cursor-pointer flex flex-col justify-between shadow-sm relative overflow-hidden"
              >
                <div className="space-y-3">
                  {/* Top Thumbnail Banner */}
                  <div className="h-28 w-full rounded-xl overflow-hidden border border-[#1a366f]/70 relative">
                    <CourseThumbnail
                      title={course.title}
                      category={course.category}
                      coverImage={course.coverImage}
                      coverIcon={course.coverIcon}
                      alt={course.title}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/30 font-semibold">
                      {course.category || 'General'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {course.isDemo && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Demo
                        </span>
                      )}
                      {course.isArchived && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                          Archived
                        </span>
                      )}
                      <CourseOptionsMenu
                        course={course}
                        onSelectCourse={onSelectCourse}
                        onCourseUpdated={onCourseUpdated}
                        onCourseDeleted={onCourseDeleted}
                        onShareCourse={(c) => setSharingCourse(c)}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-[#00B4FF] transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-[#9bb1d6] line-clamp-2 mt-1 leading-relaxed">
                      {course.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* Progress & Stats Footer */}
                <div className="pt-4 mt-4 border-t border-[#1a366f] space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#627ca8]">
                    <span>{lessonText}</span>
                    <span className="text-[#00B4FF] font-semibold">{course.progressPercent || 0}% Complete</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#081734] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00B4FF] rounded-full transition-all"
                      style={{ width: `${course.progressPercent || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share Course Modal */}
      {sharingCourse && (
        <ShareCourseModal
          course={sharingCourse}
          isOpen={true}
          onClose={() => setSharingCourse(null)}
        />
      )}
    </div>
  );
};
