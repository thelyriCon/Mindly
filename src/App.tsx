import React, { useState, useEffect } from 'react';
import { Navigation, NavTab } from './components/Navigation';
import { HomeDashboard } from './components/HomeDashboard';
import { LibraryView, LibrarySubTab } from './components/LibraryView';
import { CourseDetailView } from './components/CourseDetailView';
import { LessonDetailView } from './components/LessonDetailView';
import { AddMaterialModal } from './components/AddMaterialModal';
import { NotesView } from './components/NotesView';
import { KeyTermsView } from './components/KeyTermsView';
import { CertificatesView } from './components/CertificatesView';
import { CommunityView } from './components/CommunityView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthModal } from './components/AuthModal';
import { LandingWelcome } from './components/LandingWelcome';
import { QuickProfileSetupModal } from './components/QuickProfileSetupModal';
import { OfflineSyncIndicator } from './components/OfflineSyncIndicator';
import { NokiaLoader } from './components/NokiaLoader';
import { MindlyLogo } from './components/MindlyLogo';
import { FloatingAIAssistant } from './components/FloatingAIAssistant';
import { SharedCoursePreviewModal } from './components/SharedCoursePreviewModal';
import { ShieldCheck, Award, CheckCircle2, X } from 'lucide-react';
import { api } from './lib/api';
import { persistenceEngine } from './lib/persistence';
import { auth } from './lib/firebase';
import { discoveryFeedService } from './lib/discoveryFeedService';
import {
  User,
  Course,
  Lesson,
  Note,
  KeyTermItem,
  ActivityItem,
  SearchResultItem,
  StudyProgress,
  MicroArticle,
} from './types';

export type SplashStage =
  | 'bootstrapping'
  | 'authenticating'
  | 'hydrating'
  | 'ready'
  | 'stalled'
  | 'error';

interface SplashState {
  stage: SplashStage;
  message: string;
  isInitialLoad: boolean;
  error?: string;
  attempt: number;
}

export default function App() {
  // Navigation & View state
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [librarySubTab, setLibrarySubTab] = useState<LibrarySubTab>('courses');
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activeCourseLessons, setActiveCourseLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState<boolean>(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState<string>('');

  const handleSelectTab = (tab: NavTab) => {
    if (tab === 'courses') {
      setCurrentTab('library');
      setLibrarySubTab('courses');
    } else if (tab === 'notes') {
      setCurrentTab('library');
      setLibrarySubTab('notes');
      api.getNotes().then((res) => { if (res?.notes) setNotes(res.notes); }).catch(() => {});
    } else if (tab === 'terms') {
      setCurrentTab('library');
      setLibrarySubTab('terms');
    } else if (tab === 'certificates') {
      setCurrentTab('library');
      setLibrarySubTab('certificates');
    } else if (tab === 'community') {
      setCurrentTab('community');
    } else {
      if (tab === 'library') {
        api.getNotes().then((res) => { if (res?.notes) setNotes(res.notes); }).catch(() => {});
      }
      setCurrentTab(tab);
    }

    if (tab !== 'courses' && tab !== 'library') {
      setActiveCourse(null);
      setActiveLesson(null);
    }
  };

  // Data states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [terms, setTerms] = useState<KeyTermItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [studyProgress, setStudyProgress] = useState<StudyProgress | undefined>(undefined);

  // Splash Screen State Machine
  const [splashState, setSplashState] = useState<SplashState>({
    stage: 'bootstrapping',
    message: 'Connecting to Mindly Knowledge Engine...',
    isInitialLoad: true,
    attempt: 1,
  });

  // Concurrency and race-condition guards
  const initializationIdRef = React.useRef(0);
  const timeoutTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [materialTargetCourseId, setMaterialTargetCourseId] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [courseCreationInitialTopic, setCourseCreationInitialTopic] = useState<string | undefined>(undefined);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');

  // Filters for cross-linking
  const [notesCourseFilter, setNotesCourseFilter] = useState<string | undefined>(undefined);
  const [termsCourseFilter, setTermsCourseFilter] = useState<string | undefined>(undefined);

  // Public Certificate Verification Modal State
  const [publicVerifyResult, setPublicVerifyResult] = useState<{
    open: boolean;
    loading: boolean;
    data: any | null;
    error: string | null;
  }>({
    open: false,
    loading: false,
    data: null,
    error: null,
  });

  // Discovery Suggestions State (Preserves suggestions across navigation and pre-warms on startup)
  const [discoveryArticles, setDiscoveryArticles] = useState<MicroArticle[]>(() => {
    const cached = discoveryFeedService.getCachedSuggestions();
    return cached ? cached.articles : [];
  });
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState<boolean>(() => {
    const cached = discoveryFeedService.getCachedSuggestions();
    return !cached || cached.articles.length === 0;
  });
  const [isDiscoveryRefreshing, setIsDiscoveryRefreshing] = useState<boolean>(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Background pre-warming for discovery feed on startup or user profile change
  useEffect(() => {
    let isCancelled = false;
    const cached = discoveryFeedService.getCachedSuggestions(currentUser?.id);

    if (cached && cached.articles.length > 0) {
      setDiscoveryArticles(cached.articles);
      setIsDiscoveryLoading(false);

      // If cache is expired, pre-warm in background without wiping active view
      if (cached.isExpired) {
        discoveryFeedService.prewarm(currentUser?.id, currentUser?.interests).then((fresh) => {
          if (!isCancelled && fresh && fresh.length > 0) {
            setDiscoveryArticles(fresh);
          }
        }).catch(() => {});
      }
    } else {
      setIsDiscoveryLoading(true);
      discoveryFeedService.getOrFetchSuggestions({
        userId: currentUser?.id,
        interests: currentUser?.interests,
      }).then((result) => {
        if (!isCancelled && result.articles && result.articles.length > 0) {
          setDiscoveryArticles(result.articles);
        }
      }).catch((err) => {
        console.warn('[Discovery] Background fetch notice:', err);
      }).finally(() => {
        if (!isCancelled) setIsDiscoveryLoading(false);
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.id]);

  const handleRefreshDiscovery = async () => {
    if (isDiscoveryRefreshing) return;
    setIsDiscoveryRefreshing(true);
    setDiscoveryError(null);
    try {
      const res = await discoveryFeedService.getOrFetchSuggestions({
        userId: currentUser?.id,
        interests: currentUser?.interests,
        forceRefresh: true,
      });
      if (res && res.articles && res.articles.length > 0) {
        setDiscoveryArticles(res.articles);
      }
    } catch (err: any) {
      console.warn('[Discovery] Refresh error:', err);
      setDiscoveryError('Could not refresh suggestions. Your current recommendations have been preserved.');
    } finally {
      setIsDiscoveryRefreshing(false);
    }
  };

  useEffect(() => {
    const checkVerifyHash = async () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#verify=')) {
        const certId = hash.replace('#verify=', '').trim();
        if (certId) {
          setPublicVerifyResult({ open: true, loading: true, data: null, error: null });
          try {
            const res = await api.verifyCertificate(certId);
            if (res.verified) {
              setPublicVerifyResult({ open: true, loading: false, data: res, error: null });
            } else {
              setPublicVerifyResult({
                open: true,
                loading: false,
                data: null,
                error: res.error || 'Certificate not found.',
              });
            }
          } catch (err: any) {
            setPublicVerifyResult({
              open: true,
              loading: false,
              data: null,
              error: err.message || 'Verification check failed.',
            });
          }
        }
      }
    };

    checkVerifyHash();
    window.addEventListener('hashchange', checkVerifyHash);
    return () => window.removeEventListener('hashchange', checkVerifyHash);
  }, []);

  // Shared Course Preview State & Deep Linking Handler
  const [previewShareId, setPreviewShareId] = useState<string | null>(null);
  const [pendingShareId, setPendingShareId] = useState<string | null>(null);

  useEffect(() => {
    const checkShareRoute = () => {
      // 1. Pathname: /share/course/:id or /shared/:id
      const pathname = window.location.pathname;
      const shareMatch = pathname.match(/\/(?:share\/course|shared)\/([a-zA-Z0-9_-]+)/);
      if (shareMatch && shareMatch[1]) {
        setPreviewShareId(shareMatch[1]);
        return;
      }

      // 2. Query parameter: ?share=:id
      try {
        const params = new URLSearchParams(window.location.search);
        const queryShare = params.get('share');
        if (queryShare) {
          setPreviewShareId(queryShare);
          return;
        }
      } catch {}

      // 3. Hash: #share=:id
      const hash = window.location.hash;
      if (hash && hash.startsWith('#share=')) {
        const id = hash.replace('#share=', '').trim();
        if (id) {
          setPreviewShareId(id);
          return;
        }
      }

      // 4. Stored pending shared course in localStorage
      try {
        const pending = localStorage.getItem('mindly_pending_shared_course');
        if (pending) {
          setPreviewShareId(pending);
        }
      } catch {}
    };

    checkShareRoute();
    window.addEventListener('popstate', checkShareRoute);
    window.addEventListener('hashchange', checkShareRoute);
    return () => {
      window.removeEventListener('popstate', checkShareRoute);
      window.removeEventListener('hashchange', checkShareRoute);
    };
  }, []);

  // Robust Initialization State Machine
  const runInitialization = async (isInitial = false) => {
    const currentInitId = ++initializationIdRef.current;

    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }

    if (isInitial) {
      setSplashState((prev) => ({
        ...prev,
        stage: 'bootstrapping',
        message: 'Connecting to Mindly Knowledge Engine...',
        isInitialLoad: true,
        error: undefined,
      }));

      // Watchdog timer: prevents endless spinner if network is unresponsive
      timeoutTimerRef.current = setTimeout(() => {
        if (initializationIdRef.current === currentInitId) {
          setSplashState((prev) => {
            if (prev.stage !== 'ready') {
              return {
                ...prev,
                stage: 'stalled',
                message: 'Connection taking longer than expected.',
              };
            }
            return prev;
          });
        }
      }, 6500);
    }

    try {
      try {
        if (typeof auth.authStateReady === 'function') {
          await auth.authStateReady();
        }
      } catch {}

      if (isInitial) {
        setSplashState((prev) => ({
          ...prev,
          stage: 'authenticating',
          message: 'Validating knowledge credentials...',
        }));
      }

      // 1. Profile Hydration: Firebase Authentication is the sole source of truth
      let activeUser: User | null = null;
      try {
        const userRes = await api.getMe();
        if (userRes && userRes.user) {
          activeUser = userRes.user;
          await persistenceEngine.saveUserProfile(activeUser);
        }
      } catch (e) {
        console.warn('[Mindly Boot] Firebase profile check warning:', e);
      }

      // If Firebase has an authenticated user but fetching from Firestore was offline,
      // allow fallback to local IndexedDB ONLY for the matching Firebase UID:
      if (!activeUser && auth.currentUser) {
        const cached = await persistenceEngine.getUserProfile(auth.currentUser.uid);
        if (cached && cached.id === auth.currentUser.uid) {
          activeUser = cached;
        } else {
          // Construct canonical User record from authenticated Firebase credentials
          const fbUser = auth.currentUser;
          const realName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Mindly Learner';
          activeUser = {
            id: fbUser.uid,
            name: realName,
            realName,
            username: `@learner_${fbUser.uid.slice(0, 5)}`,
            email: fbUser.email || '',
            profileImage: cached?.profileImage || fbUser.photoURL || undefined,
            interests: ['General Knowledge'],
            createdAt: new Date().toISOString(),
            hasCompletedOnboarding: true,
            dailyStudyGoalMinutes: 30,
            todayStudySeconds: 0,
            privacySettings: {
              profileVisibility: 'public',
              showCompletedCourses: true,
              showCertificates: true,
              showStudyActivity: true,
            },
            settings: {
              theme: 'dark',
              fontSize: 'normal',
              aiStrictness: 'balanced',
              dailyStudyGoalMinutes: 30,
            },
          };
          await persistenceEngine.saveUserProfile(activeUser).catch(() => {});
        }
      }

      // If Firebase has NO authenticated user (auth.currentUser is null):
      // The application MUST enter the unauthenticated state.
      // Cached profile in IndexedDB is NEVER allowed to establish authentication without Firebase.
      if (!auth.currentUser) {
        activeUser = null;
      }

      if (initializationIdRef.current !== currentInitId) return;

      if (isInitial) {
        setSplashState((prev) => ({
          ...prev,
          stage: 'hydrating',
          message: 'Restoring knowledge workspaces...',
        }));
      }

      // 2. Library Hydration: Load courses, notes, terms, activities only if user is authenticated
      const [coursesRes, notesRes, termsRes, actRes, studyRes] = activeUser
        ? await Promise.all([
            api.getCourses().catch(() => ({ courses: [] })),
            api.getNotes().catch(() => ({ notes: [] })),
            api.getTerms().catch(() => ({ terms: [] })),
            api.getActivities().catch(() => ({ activities: [] })),
            api.getStudyProgress().catch(() => ({ progress: undefined })),
          ])
        : [{ courses: [] }, { notes: [] }, { terms: [] }, { activities: [] }, { progress: undefined }];

      if (initializationIdRef.current !== currentInitId) return;

      // Atomically batch state updates to prevent multi-frame re-render cascade
      React.startTransition(() => {
        if (activeUser) {
          setCurrentUser(activeUser);
        } else {
          setCurrentUser(null);
          setShowQuickSetup(false);
          setActiveCourse(null);
          setActiveLesson(null);
        }

        setCourses(coursesRes.courses || []);
        setNotes(notesRes.notes || []);
        setTerms(termsRes.terms || []);
        setActivities(actRes.activities || []);
        if (studyRes?.progress) {
          setStudyProgress(studyRes.progress);
        }

        if (activeUser && !activeUser.hasCompletedOnboarding && (!coursesRes.courses || coursesRes.courses.length === 0)) {
          setShowOnboarding(true);
        }

        if (activeUser) {
          const crsMigKey = `mindly_courses_migrated_${activeUser.id}`;
          if (!localStorage.getItem(crsMigKey)) {
            api.runCoursesMigration().then((migratedCourses) => {
              localStorage.setItem(crsMigKey, 'true');
              if (Array.isArray(migratedCourses) && migratedCourses.length > 0) {
                setCourses((prev) => {
                  const existingIds = new Set(prev.map((c) => c.id));
                  const newOnes = migratedCourses.filter((c) => !existingIds.has(c.id));
                  return [...prev, ...newOnes];
                });
              }
            }).catch((err) => {
              console.warn('[Mindly Migration] Courses migration note:', err);
            });
          }

          const migKey = `mindly_phase2b_migrated_${activeUser.id}`;
          if (!localStorage.getItem(migKey)) {
            api.runPhase2BMigration().then(() => {
              localStorage.setItem(migKey, 'true');
            }).catch((err) => {
              console.warn('[Mindly Migration] Phase 2B background sync note:', err);
            });
          }

          const commMigKey = `mindly_phase3b_community_migrated_${activeUser.id}`;
          if (!localStorage.getItem(commMigKey)) {
            api.runCommunityMigration().then(() => {
              localStorage.setItem(commMigKey, 'true');
            }).catch((err) => {
              console.warn('[Mindly Migration] Phase 3B community background sync note:', err);
            });
          }
        }
      });

      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }

      setSplashState({
        stage: 'ready',
        message: 'Ready',
        isInitialLoad: false,
        attempt: 1,
      });
    } catch (err: any) {
      if (initializationIdRef.current !== currentInitId) return;
      console.warn('[Mindly Lifecycle] Initialization notice:', err);

      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }

      if (isInitial) {
        setSplashState((prev) => ({
          ...prev,
          stage: 'stalled',
          message: 'Could not connect to Mindly server.',
          error: err?.message || 'Network unreachable',
        }));
      }
    }
  };

  useEffect(() => {
    // Reactively monitor Firebase Auth state changes
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (!firebaseUser) {
        // Firebase user signed out or session revoked: force unauthenticated state
        setCurrentUser(null);
        setCourses([]);
        setNotes([]);
        setTerms([]);
        setActivities([]);
        setActiveCourse(null);
        setActiveLesson(null);
      } else {
        // Firebase user authenticated or session refreshed: hydrate state
        runInitialization(false);
      }
    });

    runInitialization(true);

    return () => {
      unsubscribe();
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
      }
    };
  }, []);

  // Handle Authentication Success without full splash unmount
  const handleAuthSuccess = async (user: User) => {
    setShowAuthModal(false);
    React.startTransition(() => {
      setCurrentUser(user);
    });
    // Seamless background refresh
    await runInitialization(false);

    // If there was a pending shared course to import, trigger preview/import now!
    try {
      const pendingShare =
        pendingShareId || localStorage.getItem('mindly_pending_shared_course');
      if (pendingShare) {
        setPreviewShareId(pendingShare);
      }
    } catch {}
  };

  // Refresh study progress when returning to home dashboard
  useEffect(() => {
    if (currentTab === 'home' && currentUser) {
      api.getStudyProgress().then((r) => setStudyProgress(r.progress)).catch(() => {});
    }
  }, [currentTab, currentUser]);

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
      const res = await api.getLesson(lesson.id, lesson.courseId);
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
        const lRes = await api.getLesson(lessonId, courseId);
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
      if (targetCourse) {
        handleSelectCourse(targetCourse);
        setCurrentTab('courses');
      }
    } else if (result.type === 'lesson' && result.courseId) {
      handleNavigateToCourseLesson(result.courseId, result.id);
    } else if (result.type === 'note') {
      setCurrentTab('notes');
    } else if (result.type === 'term') {
      setCurrentTab('terms');
    }
  };

  // Trigger Add Material Modal
  const handleOpenAddMaterial = (targetCourseId?: string) => {
    setMaterialTargetCourseId(targetCourseId);
    setShowAddMaterial(true);
  };

  // Add Note from lesson
  const handleOpenAddNoteForCourse = (courseId: string, lessonId: string, initialTitle: string) => {
    setNotesCourseFilter(courseId);
    setCurrentTab('notes');
  };

  // Refresh data when a lesson is added from Knowledge Dump
  const handleLessonSaved = async (courseId: string, lessonId: string) => {
    const [cRes, actRes] = await Promise.all([api.getCourses(), api.getActivities()]);
    setCourses(cRes.courses);
    setActivities(actRes.activities);

    if (activeCourse && activeCourse.id === courseId) {
      try {
        const lRes = await api.getLesson(lessonId, courseId);
        setActiveCourseLessons((prev) => [...prev.filter((l) => l.id !== lessonId), lRes.lesson]);
      } catch {
        // Fallback
      }
    }
  };

  if (splashState.stage !== 'ready' && splashState.isInitialLoad) {
    if (splashState.stage === 'stalled' || splashState.stage === 'error') {
      return (
        <div className="min-h-screen bg-[#07132b] flex flex-col items-center justify-center p-6 text-white text-center selection:bg-[#00B4FF] selection:text-[#0B1F44]">
          <div className="w-16 h-16 rounded-2xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center shadow-lg shadow-[#00B4FF]/20 mb-6">
            <MindlyLogo size={36} color="#00B4FF" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-2">
            Mindly Knowledge Engine
          </h2>
          <p className="text-sm text-[#9bb1d6] max-w-sm mb-6 leading-relaxed">
            {splashState.message}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
            <button
              onClick={() => {
                setSplashState({
                  stage: 'ready',
                  message: 'Ready',
                  isInitialLoad: false,
                  attempt: 1,
                });
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
            >
              Continue to Mindly
            </button>
            <button
              onClick={() => {
                setSplashState((p) => ({ ...p, attempt: p.attempt + 1 }));
                runInitialization(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] border border-[#1a366f] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#07132b] flex flex-col items-center justify-center p-6 text-white text-center selection:bg-[#00B4FF] selection:text-[#0B1F44]">
        <div className="w-16 h-16 rounded-2xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center shadow-lg shadow-[#00B4FF]/20 mb-6 animate-pulse">
          <MindlyLogo size={36} color="#00B4FF" />
        </div>
        <NokiaLoader label={splashState.message} size="lg" />
        <div className="mt-8 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00B4FF]/60 animate-ping" />
          <span className="text-[11px] font-mono tracking-wider text-[#627ca8] uppercase">
            Mindly &bull; Active Node
          </span>
        </div>
      </div>
    );
  }

  // Unauthenticated Visitor Experience (4-Screen Onboarding & Auth)
  if (!currentUser) {
    return (
      <>
        <LandingWelcome
          onComplete={(newUser) => {
            setCurrentUser(newUser);
            setCourses([]);
            setNotes([]);
            setTerms([]);
            setActivities([]);
            setActiveCourse(null);
            setActiveLesson(null);
            setCurrentTab('home');
            runInitialization(false);
          }}
          onOpenSignUp={() => {
            setAuthInitialMode('signup');
            setShowAuthModal(true);
          }}
          onOpenSignIn={() => {
            setAuthInitialMode('signin');
            setShowAuthModal(true);
          }}
        />

        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            initialMode={authInitialMode}
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleAuthSuccess}
          />
        )}

        {/* Public Shared Course Preview for Visitors */}
        {previewShareId && (
          <SharedCoursePreviewModal
            shareId={previewShareId}
            isOpen={!!previewShareId}
            isAuthenticated={false}
            onClose={() => {
              setPreviewShareId(null);
              try {
                localStorage.removeItem('mindly_pending_shared_course');
              } catch {}
            }}
            onRequireAuth={(sId) => {
              setPendingShareId(sId);
              setAuthInitialMode('signup');
              setShowAuthModal(true);
            }}
            onCourseImported={(importedCourse) => {
              handleSelectCourse(importedCourse);
            }}
          />
        )}

        <OfflineSyncIndicator />
      </>
    );
  }

  // Configurable header title for targeted pages (Discovery, Library, Rooms)
  const getHeaderPageTitle = (): string | null => {
    if (activeCourse) return null;
    if (currentTab === 'search') return 'Discovery';
    if (
      currentTab === 'library' ||
      currentTab === 'courses' ||
      currentTab === 'notes' ||
      currentTab === 'terms' ||
      currentTab === 'certificates'
    ) {
      return 'Library';
    }
    if (currentTab === 'community') return 'Rooms';
    return null;
  };
  const headerPageTitle = getHeaderPageTitle();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#07132b] text-white selection:bg-[#00B4FF] selection:text-[#0B1F44]">
      {/* Navigation Sidebar & Floating Navigation Bar (Hidden in Focus Mode) */}
      {(!isFocusMode || !activeLesson) && (
        <Navigation
          currentTab={currentTab}
          onSelectTab={(tab) => handleSelectTab(tab)}
          onOpenAddMaterial={() => handleOpenAddMaterial()}
          currentUser={currentUser}
          onOpenAssistant={() => setIsAIAssistantOpen((prev) => !prev)}
        />
      )}

      {/* Main View Area */}
      <main
        className={`flex-1 overflow-y-auto max-h-screen transition-all ${
          isFocusMode && activeLesson
            ? 'p-0 pb-0 w-full max-w-full'
            : currentTab === 'home'
            ? 'p-0 pb-0'
            : 'pb-28 sm:pb-32'
        }`}
      >
        {/* Upper Navigation Bar: Profile Avatar & Section Info */}
        {(!isFocusMode || !activeLesson) && currentTab !== 'home' && (
          <header className="sticky top-0 z-20 w-full bg-[#07132b]/90 backdrop-blur-md border-b border-[#1a366f]/70 px-4 sm:px-6 py-2.5 flex items-center justify-between">
            {/* Left: Page Title or Mobile Brand & View Title */}
            <div className="flex items-center gap-3">
              {headerPageTitle ? (
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  {headerPageTitle}
                </span>
              ) : (
                <>
                  <div className="md:hidden flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center">
                      <MindlyLogo size={16} color="#00B4FF" />
                    </div>
                    <span className="font-extrabold text-sm tracking-tight text-white">Mindly</span>
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#9bb1d6]">
                    <span className="text-[#00B4FF]">&bull;</span>
                    <span className="capitalize font-bold text-white">
                      {activeCourse ? activeCourse.title : currentTab}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Right: Interactive Profile Avatar */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectTab('profile')}
                className={`flex items-center gap-2 p-1 pl-2.5 rounded-full border transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'bg-[#00B4FF]/20 border-[#00B4FF] text-white shadow-sm'
                    : 'bg-[#0B1F44] hover:bg-[#0f2756] border-[#1a366f] text-[#9bb1d6] hover:text-white'
                }`}
                title="Open Profile & Settings"
                aria-label="Open Profile & Settings"
              >
                <div className="hidden sm:flex flex-col text-right leading-tight">
                  <span className="text-xs font-bold text-white truncate max-w-[130px]">
                    {currentUser?.realName || currentUser?.name || 'My Profile'}
                  </span>
                  <span className="text-[10px] text-[#00B4FF] font-mono truncate max-w-[130px]">
                    {currentUser?.username || '@learner'}
                  </span>
                </div>
                <div className="relative">
                  {currentUser?.profileImage ? (
                    <img
                      src={currentUser.profileImage}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full object-cover border border-[#00B4FF]/50"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0B1F44] to-[#081734] border border-[#00B4FF]/50 flex items-center justify-center text-xs font-bold text-[#00B4FF]">
                      {(currentUser?.realName || currentUser?.name || 'ME').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#07132b]" />
                </div>
              </button>
            </div>
          </header>
        )}

        {/* If user is studying a lesson */}
        {activeLesson && activeCourse ? (
          <LessonDetailView
            lesson={activeLesson}
            course={activeCourse}
            allLessons={activeCourseLessons}
            isFocusMode={isFocusMode}
            onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
            onBack={() => {
              setActiveLesson(null);
              setIsFocusMode(false);
              api.getStudyProgress().then((r) => setStudyProgress(r.progress)).catch(() => {});
            }}
            onLessonUpdated={(updatedLesson) => {
              setActiveLesson(updatedLesson);
              setActiveCourseLessons(
                activeCourseLessons.map((l) => (l.id === updatedLesson.id ? updatedLesson : l))
              );
            }}
            onCourseUpdated={(updatedCourse, updatedLessons) => {
              setActiveCourse(updatedCourse);
              setActiveCourseLessons(updatedLessons);
              setCourses(courses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
            }}
            onNavigateLesson={(nextLesson) => {
              setActiveLesson(nextLesson);
            }}
            onOpenAddNote={(cId, lId, title) => handleOpenAddNoteForCourse(cId, lId, title)}
            onSelectTerm={() => {
              setLibrarySubTab('terms');
              setCurrentTab('library');
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
              setLibrarySubTab('notes');
              setCurrentTab('library');
            }}
            onOpenTermsForCourse={(cId) => {
              setTermsCourseFilter(cId);
              setLibrarySubTab('terms');
              setCurrentTab('library');
            }}
          />
        ) : (
          /* Primary Tab Routing */
          <>
            {currentTab === 'home' && (
              <HomeDashboard
                user={currentUser}
                courses={courses}
                recentActivities={activities}
                studyProgress={studyProgress}
                onUpdateStudyGoal={async (newGoal) => {
                  setCurrentUser({ ...currentUser, dailyStudyGoalMinutes: newGoal });
                  const res = await api.getStudyProgress();
                  setStudyProgress(res.progress);
                }}
                onOpenAddMaterial={() => handleOpenAddMaterial()}
                onSelectCourse={handleSelectCourse}
                onCourseUpdated={(updatedCourse) => {
                  setCourses(courses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
                }}
                onCourseDeleted={(courseId) => {
                  setCourses(courses.filter((c) => c.id !== courseId));
                }}
                onOpenNewCourse={(topic) => {
                  setCourseCreationInitialTopic(topic);
                  setShowOnboarding(true);
                }}
                onOpenNewNote={() => {
                  setLibrarySubTab('notes');
                  setCurrentTab('library');
                }}
                onNavigateTab={(tab) => handleSelectTab(tab)}
                onSelectLessonDirect={handleNavigateToCourseLesson}
                onNoteCreated={(newNote) => setNotes((prev) => [newNote, ...prev])}
                onNoteDeleted={(noteId) => setNotes((prev) => prev.filter((n) => n.id !== noteId))}
                onSearch={(query) => {
                  setSearchInitialQuery(query);
                  handleSelectTab('search');
                }}
              />
            )}

            {(currentTab === 'library' ||
              currentTab === 'courses' ||
              currentTab === 'notes' ||
              currentTab === 'terms' ||
              currentTab === 'certificates') && (
              <LibraryView
                initialSubTab={librarySubTab}
                courses={courses}
                notes={notes}
                terms={terms}
                currentUser={currentUser}
                onSelectCourse={handleSelectCourse}
                onCourseCreated={(newCourse) => {
                  setCourses([newCourse, ...courses]);
                  handleSelectCourse(newCourse);
                }}
                onCourseUpdated={(updatedCourse) => {
                  setCourses(courses.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
                }}
                onCourseDeleted={(courseId) => {
                  setCourses(courses.filter((c) => c.id !== courseId));
                }}
                onOpenAddMaterial={() => handleOpenAddMaterial()}
                onNoteCreated={(newNote) => setNotes([newNote, ...notes])}
                onNoteUpdated={(updatedNote) =>
                  setNotes(notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)))
                }
                onNoteDeleted={(noteId) => setNotes(notes.filter((n) => n.id !== noteId))}
                onTermCreated={(newTerm) => setTerms([newTerm, ...terms])}
                onTermDeleted={(termId) => setTerms(terms.filter((t) => t.id !== termId))}
                onNavigateToCourseLesson={handleNavigateToCourseLesson}
                notesCourseFilter={notesCourseFilter}
                termsCourseFilter={termsCourseFilter}
                onNavigateTab={(tab) => handleSelectTab(tab)}
                onOpenNewCourse={(initialTopic) => {
                  if (!currentUser) {
                    setAuthInitialMode('signup');
                    setShowAuthModal(true);
                    return;
                  }
                  setCourseCreationInitialTopic(initialTopic);
                  setShowOnboarding(true);
                }}
              />
            )}

            {currentTab === 'search' && (
              <SearchView
                onSelectResult={handleSelectSearchResult}
                currentUser={currentUser}
                onOpenAuth={() => {
                  setAuthInitialMode('signin');
                  setShowAuthModal(true);
                }}
                initialQuery={searchInitialQuery}
                onOpenNewCourse={(topic, snippet) => {
                  setCourseCreationInitialTopic(topic);
                  setShowOnboarding(true);
                }}
                onOpenAddMaterial={() => handleOpenAddMaterial()}
                onNoteCreated={(newNote) => setNotes((prev) => [newNote, ...prev])}
                onNoteDeleted={(noteId) => setNotes((prev) => prev.filter((n) => n.id !== noteId))}
                discoveryArticles={discoveryArticles}
                isDiscoveryLoading={isDiscoveryLoading}
                isDiscoveryRefreshing={isDiscoveryRefreshing}
                discoveryError={discoveryError}
                onRefreshDiscovery={handleRefreshDiscovery}
              />
            )}

            {currentTab === 'community' && (
              <CommunityView
                currentUser={currentUser}
                onOpenAuth={() => {
                  setAuthInitialMode('signin');
                  setShowAuthModal(true);
                }}
                initialTab="rooms"
              />
            )}

            {currentTab === 'profile' && (
              <ProfileView
                user={currentUser}
                courses={courses}
                notes={notes}
                terms={terms}
                onOpenAuth={() => {
                  setAuthInitialMode('signin');
                  setShowAuthModal(true);
                }}
                onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
                onNavigateToCertificates={() => {
                  setLibrarySubTab('certificates');
                  setCurrentTab('library');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Knowledge Dump & Capture Hub Modal */}
      {showAddMaterial && (
        <AddMaterialModal
          isOpen={showAddMaterial}
          onClose={() => setShowAddMaterial(false)}
          courses={courses}
          initialCourseId={materialTargetCourseId}
          onLessonSaved={handleLessonSaved}
          onCourseCreated={(newCourse) => setCourses([newCourse, ...courses])}
          onNoteCreated={(newNote) => setNotes([newNote, ...notes])}
        />
      )}

      {/* Onboarding & Guided Course Builder */}
      {showOnboarding && currentUser && (
        <OnboardingModal
          userName={currentUser.realName || currentUser.name}
          initialTopic={courseCreationInitialTopic}
          onCompleteCourse={async (newCourse, firstLessonId) => {
            setShowOnboarding(false);
            setCourseCreationInitialTopic(undefined);
            const [cRes, actRes, termsRes, userRes] = await Promise.all([
              api.getCourses(),
              api.getActivities(),
              api.getTerms(),
              api.getMe(),
            ]);
            setCourses(cRes.courses);
            setActivities(actRes.activities);
            setTerms(termsRes.terms);
            if (userRes && userRes.user) setCurrentUser(userRes.user);

            if (firstLessonId) {
              await handleNavigateToCourseLesson(newCourse.id, firstLessonId);
            } else {
              await handleSelectCourse(newCourse);
            }
          }}
          onDismiss={() => {
            setShowOnboarding(false);
            setCourseCreationInitialTopic(undefined);
          }}
        />
      )}

      {/* Quick Profile Setup Modal */}
      {showQuickSetup && (
        <QuickProfileSetupModal
          isOpen={showQuickSetup}
          onClose={() => setShowQuickSetup(false)}
          onComplete={(newUser) => {
            setShowQuickSetup(false);
            setCurrentUser(newUser);
            runInitialization(false);
          }}
        />
      )}

      {/* Authentication Dialog */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          initialMode={authInitialMode}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* Floating AI Study Assistant */}
      <FloatingAIAssistant
        isOpen={isAIAssistantOpen}
        onOpenChange={setIsAIAssistantOpen}
        hideDefaultTrigger={!isFocusMode || !activeLesson}
        activeLesson={activeLesson}
        activeCourse={activeCourse}
        notes={notes}
        terms={terms}
        onOpenNote={(noteId) => {
          setCurrentTab('library');
          setLibrarySubTab('notes');
        }}
        onOpenTerm={(termId) => {
          setCurrentTab('library');
          setLibrarySubTab('terms');
        }}
      />

      {/* Public Certificate Verification Modal */}
      {publicVerifyResult.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-8 text-white">
            <button
              onClick={() => {
                setPublicVerifyResult((prev) => ({ ...prev, open: false }));
                window.location.hash = '';
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#0f2756] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {publicVerifyResult.loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <NokiaLoader label="Verifying credential authenticity..." />
              </div>
            ) : publicVerifyResult.error ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-3">
                  <X className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">Verification Failed</h3>
                <p className="text-xs text-red-300 mb-6">{publicVerifyResult.error}</p>
                <button
                  onClick={() => {
                    setPublicVerifyResult((prev) => ({ ...prev, open: false }));
                    window.location.hash = '';
                  }}
                  className="px-4 py-2 rounded-xl bg-[#1a366f] hover:bg-[#25468d] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            ) : publicVerifyResult.data ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/40 flex items-center justify-center text-[#00B4FF]">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/30">
                      {publicVerifyResult.data.certificateId}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">Official Mindly Credential Verified</h3>
                  </div>
                </div>

                <div className="space-y-4 p-5 rounded-xl bg-[#081734] border border-[#1a366f] text-left">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#627ca8]">Verified Recipient</p>
                    <p className="text-sm font-extrabold text-white">{publicVerifyResult.data.realName}</p>
                  </div>

                  {publicVerifyResult.data.type === 'combined' ? (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#627ca8] mb-1">Completed Courses</p>
                      <ul className="space-y-1">
                        {publicVerifyResult.data.courseTitles?.map((title: string, idx: number) => (
                          <li key={idx} className="text-xs text-[#9bb1d6] flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#00B4FF] shrink-0" />
                            <span>{title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#627ca8]">Completed Course</p>
                      <p className="text-xs font-bold text-[#00B4FF]">{publicVerifyResult.data.courseTitle}</p>
                      {publicVerifyResult.data.totalLessons && (
                        <p className="text-[11px] text-[#627ca8] mt-0.5">
                          {publicVerifyResult.data.totalLessons} lessons &bull; {publicVerifyResult.data.hoursInvested || 0} study hours
                        </p>
                      )}
                    </div>
                  )}

                  <div className="pt-3 border-t border-[#1a366f] flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#627ca8]">Date Issued</p>
                      <p className="text-xs text-white font-medium">{publicVerifyResult.data.completionDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#627ca8]">Verification Seal</p>
                      <p className="text-xs font-mono text-[#00B4FF] font-bold">{publicVerifyResult.data.verificationCode}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setPublicVerifyResult((prev) => ({ ...prev, open: false }));
                      window.location.hash = '';
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
                  >
                    Close Verification
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Shared Course Preview Modal (Authenticated) */}
      {previewShareId && (
        <SharedCoursePreviewModal
          shareId={previewShareId}
          isOpen={!!previewShareId}
          isAuthenticated={true}
          onClose={() => {
            setPreviewShareId(null);
            try {
              localStorage.removeItem('mindly_pending_shared_course');
            } catch {}
          }}
          onRequireAuth={() => {}}
          onCourseImported={(importedCourse) => {
            setCourses((prev) => {
              const exists = prev.some((c) => c.id === importedCourse.id);
              return exists ? prev : [importedCourse, ...prev];
            });
            handleSelectCourse(importedCourse);
            setPreviewShareId(null);
            try {
              localStorage.removeItem('mindly_pending_shared_course');
            } catch {}
          }}
        />
      )}

      {/* Background Sync & Offline Network Status Toast / Pill */}
      <OfflineSyncIndicator />
    </div>
  );
};
