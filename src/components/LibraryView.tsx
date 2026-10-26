import React, { useState, useEffect } from 'react';
import { BookOpen, FileText, Bookmark, Award } from 'lucide-react';
import { CoursesView } from './CoursesView';
import { NotesView } from './NotesView';
import { KeyTermsView } from './KeyTermsView';
import { CertificatesView } from './CertificatesView';
import { Course, Note, KeyTermItem, User } from '../types';

export type LibrarySubTab = 'courses' | 'notes' | 'terms' | 'certificates';

interface LibraryViewProps {
  initialSubTab?: LibrarySubTab;
  courses: Course[];
  notes: Note[];
  terms: KeyTermItem[];
  currentUser: User | null;
  onSelectCourse: (course: Course) => void;
  onCourseCreated: (course: Course) => void;
  onCourseUpdated?: (course: Course) => void;
  onCourseDeleted: (courseId: string) => void;
  onOpenAddMaterial: () => void;
  onNoteCreated: (newNote: Note) => void;
  onNoteUpdated: (updatedNote: Note) => void;
  onNoteDeleted: (noteId: string) => void;
  onTermCreated: (newTerm: KeyTermItem) => void;
  onTermDeleted: (termId: string) => void;
  onNavigateToCourseLesson: (courseId: string, lessonId?: string) => void;
  notesCourseFilter?: string;
  termsCourseFilter?: string;
  onNavigateTab?: (tab: any) => void;
  onOpenNewCourse?: (initialTopic?: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  initialSubTab = 'courses',
  courses,
  notes,
  terms,
  currentUser,
  onSelectCourse,
  onCourseCreated,
  onCourseUpdated,
  onCourseDeleted,
  onOpenAddMaterial,
  onNoteCreated,
  onNoteUpdated,
  onNoteDeleted,
  onTermCreated,
  onTermDeleted,
  onNavigateToCourseLesson,
  notesCourseFilter,
  termsCourseFilter,
  onNavigateTab,
  onOpenNewCourse,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<LibrarySubTab>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const subTabs = [
    { id: 'courses' as const, label: 'Courses', icon: BookOpen, count: courses.length },
    { id: 'notes' as const, label: 'Notes', icon: FileText, count: notes.length },
    { id: 'terms' as const, label: 'Key Terms', icon: Bookmark, count: terms.length },
    { id: 'certificates' as const, label: 'Certificates', icon: Award },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-1">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#081734] border border-[#1a366f] overflow-x-auto select-none shadow-sm">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex-1 justify-center ${
                  isActive
                    ? 'bg-[#00B4FF] text-[#0B1F44] shadow-md font-bold'
                    : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0B1F44]' : 'text-[#9bb1d6]'}`} />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive
                        ? 'bg-[#0B1F44]/20 text-[#0B1F44]'
                        : 'bg-[#1a366f]/60 text-[#9bb1d6]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Sub-tab View */}
      <div>
        {activeSubTab === 'courses' && (
          <CoursesView
            courses={courses}
            onSelectCourse={onSelectCourse}
            onCourseCreated={onCourseCreated}
            onCourseUpdated={onCourseUpdated}
            onCourseDeleted={onCourseDeleted}
            onOpenAddMaterial={onOpenAddMaterial}
            onNavigateTab={onNavigateTab}
            onOpenNewCourse={onOpenNewCourse}
          />
        )}

        {activeSubTab === 'notes' && (
          <NotesView
            notes={notes}
            courses={courses}
            onNoteCreated={onNoteCreated}
            onNoteUpdated={onNoteUpdated}
            onNoteDeleted={onNoteDeleted}
            initialCourseFilter={notesCourseFilter}
          />
        )}

        {activeSubTab === 'terms' && (
          <KeyTermsView
            terms={terms}
            courses={courses}
            onTermCreated={onTermCreated}
            onTermDeleted={onTermDeleted}
            onNavigateToCourseLesson={onNavigateToCourseLesson}
            initialCourseFilter={termsCourseFilter}
          />
        )}

        {activeSubTab === 'certificates' && (
          <CertificatesView
            currentUser={currentUser}
            courses={courses}
            onStartCourse={(cId) => onNavigateToCourseLesson(cId)}
            onExploreCourses={() => setActiveSubTab('courses')}
          />
        )}
      </div>
    </div>
  );
};
