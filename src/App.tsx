import React, { useState, useEffect } from 'react';
import { Navigation, NavTab } from './components/Navigation';
import { HomeDashboard } from './components/HomeDashboard';
import { CoursesView } from './components/CoursesView';
import { CourseDetailView } from './components/CourseDetailView';
import { LessonDetailView } from './components/LessonDetailView';
import { AddMaterialModal } from './components/AddMaterialModal';
import { NotesView } from './components/NotesView';
import { KeyTermsView } from './components/KeyTermsView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthModal } from './components/AuthModal';
import { api } from './lib/api';
import { getDemoDatabase } from './lib/demoData';
import { User, Course, Lesson, Note, KeyTermItem, ActivityItem, SearchResultItem, StudyProgress } from './types';
import { Sparkles, Brain } from 'lucide-react';

export default function App() {
  // Navigation & View state
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activeCourseLessons, setActiveCourseLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  // Data states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [terms, setTerms] = useState<KeyTermItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [studyProgress, setStudyProgress] = useState<StudyProgress | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [materialTargetCourseId, setMaterialTargetCourseId] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Filters for cross-linking
  const [notesCourseFilter, setNotesCourseFilter] = useState<string | undefined>(undefined);
  const [termsCourseFilter, setTermsCourseFilter] = useState<string | undefined>(undefined);

  // Initial Data Fetch
  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [userRes, coursesRes, notesRes, termsRes, actRes, studyRes] = await Promise.all([
        api.getMe(),
        api.getCourses(),
        api.getNotes(),
        api.getTerms(),
        api.getActivities(),
        api.getStudyProgress().catch(() => ({ progress: undefined })),
      ]);

      setCurrentUser(userRes.user);
      setCourses(coursesRes.courses);
      setNotes(notesRes.notes);
      setTerms(termsRes.terms);
      setActivities(actRes.activities);
      if (studyRes?.progress) {
        setStudyProgress(studyRes.progress);
      }

      if (!userRes.user.hasCompletedOnboarding) {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.warn('Initialization notice - running in resilient mode:', err);
      const demo = getDemoDatabase();
      if (!currentUser) setCurrentUser(demo.user);
      if (courses.length === 0) setCourses(demo.courses);
      if (notes.length === 0) setNotes(demo.notes);
      if (terms.length === 0) setTerms(demo.terms);
      if (activities.length === 0) setActivities(demo.activities);
      if (!studyProgress) setStudyProgress(demo.progress);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Refresh study progress when returning to home dashboard
  useEffect(() => {
    if (currentTab === 'home') {
      api.getStudyProgress().then((r) => setStudyProgress(r.progress)).catch(() => {});
    }
  }, [currentTab]);

  // Handle selecting a course
  const handleSelectCourse = async (course: Course) => {
    try {
      const res = await api.getCourse(course.id);
      setActiveCourse(res.course);
      setActiveCourseLessons(res.lessons);
      setActiveLesson(null);
    } catch (err) {
      console.error('Error fetching course:', err);
    }
  };

  // Handle selecting a lesson
  const handleSelectLesson = async (lesson: Lesson) => {
    try {
      const res = await api.getLesson(lesson.id);
      setActiveLesson(res.lesson);
      if (!activeCourse || activeCourse.id !== res.course.id) {
        setActiveCourse(res.course);
      }
    } catch (err) {
      console.error('Error fetching lesson:', err);
    }
  };

  // Handle cross-navigation from search or glossary
  const handleNavigateToCourseLesson = async (courseId: string, lessonId?: string) => {
    try {
      const res = await api.getCourse(courseId);
      setActiveCourse(res.course);
      setActiveCourseLessons(res.lessons);

      if (lessonId) {
        const lRes = await api.getLesson(lessonId);
        setActiveLesson(lRes.lesson);
      } else {
        setActiveLesson(null);
      }
      setCurrentTab('courses');
    } catch (err) {
      console.error('Navigation error:', err);
    }
  };

  // Handle Search Result click
  const handleSelectSearchResult = (result: SearchResultItem) => {
    if (result.type === 'course') {
      const targetCourse = courses.find((c) => c.id === result.id);
      if (targetCourse) handleSelectCourse(targetCourse);
      setCurrentTab('courses');
    } else if (result.type === 'lesson') {
      if (result.courseId) {
        handleNavigateToCourseLesson(result.courseId, result.id);
      }
    } else if (result.type === 'note') {
      setCurrentTab('notes');
    } else if (result.type === 'term') {
      setCurrentTab('terms');
    }
  };

  // Handle Onboarding Completion
  const handleOnboardingComplete = async (interests: string[]) => {
    try {
      const res = await api.updateProfile({
        interests,
        hasCompletedOnboarding: true,
      });
      setCurrentUser(res.user);
      setShowOnboarding(false);
    } catch (err) {
      console.error('Onboarding save failed:', err);
      setShowOnboarding(false);
    }
  };

  // Open Knowledge Dump modal
  const handleOpenAddMaterial = (courseId?: string) => {
    setMaterialTargetCourseId(courseId);
    setShowAddMaterial(true);
  };

  // Lesson saved callback
  const handleLessonSaved = async (courseId: string, lessonId: string) => {
    // Refresh courses and activities
    const [cRes, actRes, termsRes] = await Promise.all([
      api.getCourses(),
      api.getActivities(),
      api.getTerms(),
    ]);
    setCourses(cRes.courses);
    setActivities(actRes.activities);
    setTerms(termsRes.terms);

    // Open the newly created lesson directly
    await handleNavigateToCourseLesson(courseId, lessonId);
  };

  // Quick note open helper
  const handleOpenAddNoteForCourse = (courseId: string, lessonId?: string, initialTitle?: string) => {
    setNotesCourseFilter(courseId);
    setCurrentTab('notes');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0d10] flex flex-col items-center justify-center text-zinc-300 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 animate-pulse">
          <Brain className="w-5 h-5" />
        </div>
        <div className="text-xs font-medium tracking-wide">Starting Mindly Workspace...</div>
      </div>
    );
  }

  const activeUser = currentUser || getDemoDatabase().user;

  return (
    <div className="min-h-screen bg-[#0c0d10] text-zinc-100 flex flex-col md:flex-row font-sans selection:bg-indigo-600/40 selection:text-white">
      {/* Sidebar Navigation (Desktop) & Bottom Bar (Mobile) */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          // If leaving courses view, reset active course drill-down
          if (tab !== 'courses') {
            setActiveCourse(null);
            setActiveLesson(null);
          }
        }}
        onOpenAddMaterial={() => handleOpenAddMaterial()}
        currentUser={activeUser}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-20 md:pb-6 overflow-y-auto max-h-screen">
        {/* If user is deep into a lesson */}
        {activeLesson && activeCourse ? (
          <LessonDetailView
            lesson={activeLesson}
            course={activeCourse}
            onBack={() => {
              setActiveLesson(null);
              api.getStudyProgress().then((r) => setStudyProgress(r.progress)).catch(() => {});
            }}
            onLessonUpdated={(updatedLesson) => {
              setActiveLesson(updatedLesson);
              setActiveCourseLessons(
                activeCourseLessons.map((l) => (l.id === updatedLesson.id ? updatedLesson : l))
              );
            }}
            onOpenAddNote={(cId, lId, title) => handleOpenAddNoteForCourse(cId, lId, title)}
            onSelectTerm={(term) => {
              setCurrentTab('terms');
            }}
          />
        ) : activeCourse ? (
          /* If user clicked a course to view lessons list */
          <CourseDetailView
            course={activeCourse}
            lessons={activeCourseLessons}
            onBack={() => setActiveCourse(null)}
            onSelectLesson={handleSelectLesson}
            onOpenAddMaterial={(cId) => handleOpenAddMaterial(cId)}
            onCourseUpdated={(updatedCourse, updatedLessons) => {
              setActiveCourse(updatedCourse);
              setActiveCourseLessons(updatedLessons);
              setCourses(courses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
            }}
            onOpenNotesForCourse={(cId) => {
              setNotesCourseFilter(cId);
              setCurrentTab('notes');
            }}
            onOpenTermsForCourse={(cId) => {
              setTermsCourseFilter(cId);
              setCurrentTab('terms');
            }}
          />
        ) : (
          /* Primary Tab Routing */
          <>
            {currentTab === 'home' && (
              <HomeDashboard
                user={activeUser}
                courses={courses}
                recentActivities={activities}
                studyProgress={studyProgress}
                onUpdateStudyGoal={async (newGoal) => {
                  setCurrentUser({ ...activeUser, dailyStudyGoalMinutes: newGoal });
                  const res = await api.getStudyProgress();
                  setStudyProgress(res.progress);
                }}
                onOpenAddMaterial={() => handleOpenAddMaterial()}
                onSelectCourse={handleSelectCourse}
                onOpenNewCourse={() => setCurrentTab('courses')}
                onOpenNewNote={() => setCurrentTab('notes')}
                onNavigateTab={(tab) => setCurrentTab(tab)}
              />
            )}

            {currentTab === 'courses' && (
              <CoursesView
                courses={courses}
                onSelectCourse={handleSelectCourse}
                onCourseCreated={(newCourse) => {
                  setCourses([newCourse, ...courses]);
                  handleSelectCourse(newCourse);
                }}
                onCourseDeleted={(courseId) => {
                  setCourses(courses.filter((c) => c.id !== courseId));
                }}
                onOpenAddMaterial={() => handleOpenAddMaterial()}
              />
            )}

            {currentTab === 'notes' && (
              <NotesView
                notes={notes}
                courses={courses}
                onNoteCreated={(newNote) => setNotes([newNote, ...notes])}
                onNoteUpdated={(updatedNote) =>
                  setNotes(notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)))
                }
                onNoteDeleted={(noteId) => setNotes(notes.filter((n) => n.id !== noteId))}
                initialCourseFilter={notesCourseFilter}
              />
            )}

            {currentTab === 'terms' && (
              <KeyTermsView
                terms={terms}
                courses={courses}
                onTermCreated={(newTerm) => setTerms([newTerm, ...terms])}
                onTermDeleted={(termId) => setTerms(terms.filter((t) => t.id !== termId))}
                onNavigateToCourseLesson={handleNavigateToCourseLesson}
                initialCourseFilter={termsCourseFilter}
              />
            )}

            {currentTab === 'search' && (
              <SearchView onSelectResult={handleSelectSearchResult} />
            )}

            {currentTab === 'profile' && (
              <ProfileView
                user={activeUser}
                courses={courses}
                notes={notes}
                terms={terms}
                onOpenAuth={() => setShowAuthModal(true)}
                onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
              />
            )}
          </>
        )}
      </main>

      {/* Knowledge Dump Workspace Modal */}
      {showAddMaterial && (
        <AddMaterialModal
          isOpen={showAddMaterial}
          onClose={() => setShowAddMaterial(false)}
          courses={courses}
          initialCourseId={materialTargetCourseId}
          onLessonSaved={handleLessonSaved}
          onCourseCreated={(newCourse) => setCourses([newCourse, ...courses])}
        />
      )}

      {/* Onboarding Dialog */}
      {showOnboarding && currentUser && (
        <OnboardingModal
          userName={currentUser.name}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Authentication Dialog */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(user) => {
            setCurrentUser(user);
            loadInitialData();
          }}
        />
      )}
    </div>
  );
}
