/**
 * Mindly Hybrid Offline-First Persistence Engine
 * Coordinates IndexedDB (structured heavy application data) and LocalStorage (lightweight configuration).
 * Guarantees zero data loss on browser refresh, tab close, or offline execution.
 */
import { openDB, IDBPDatabase } from 'idb';
import { User, Course, Lesson, Note, KeyTermItem, ActivityItem, Certificate, CombinedCertificate } from '../types';

const DB_NAME = 'mindly_offline_db';
const DB_VERSION = 3;

// LocalStorage Keys
export const LS_PREFERENCES_KEY = 'mindly_user_preferences';
export const LS_ACTIVE_USER_ID_KEY = 'currentUserProfileId';
export const LS_TOKEN_KEY = 'mindly_firebase_id_token';
export const LS_LAST_ACTIVE_SESSION_KEY = 'mindly_last_course_session';

export type SyncOperationType =
  | 'create_note'
  | 'update_note'
  | 'delete_note'
  | 'course_create'
  | 'lesson_create'
  | 'progress_update'
  | 'reading_position'
  | 'study_log'
  | 'update_profile';

export interface PendingSyncItem {
  id: string;
  type: SyncOperationType;
  payload: any;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  grounding: 'strict' | 'balanced';
  textSize: 'A' | 'A+' | 'A++';
}

export interface LastActiveCourseSession {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  dayNumber: number;
  scrollY?: number;
  updatedAt: number;
}

export interface MindlyFullExport {
  version: string;
  exportedAt: string;
  preferences: UserPreferences;
  activeUserId: string | null;
  userProfile?: User | null;
  courses: Course[];
  lessons: Lesson[];
  notes: Note[];
  terms: KeyTermItem[];
  activities: ActivityItem[];
  certificates: Certificate[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  grounding: 'balanced',
  textSize: 'A',
};

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. userProfiles: { id, name, studyStreak, lastActiveDate, totalStudyTimeMinutes, createdDate }
        if (!db.objectStoreNames.contains('userProfiles')) {
          db.createObjectStore('userProfiles', { keyPath: 'id' });
        }

        // 2. courses: { id, title, category, description, totalDays, currentDay, progressPercentage, modules, createdAt }
        if (!db.objectStoreNames.contains('courses')) {
          db.createObjectStore('courses', { keyPath: 'id' });
        }

        // 3. lessons: { id, courseId, dayNumber, title, content, diagrams, images, quizzes, userNotes, scrollOffsetPosition, isCompleted }
        if (!db.objectStoreNames.contains('lessons')) {
          const lessonStore = db.createObjectStore('lessons', { keyPath: 'id' });
          lessonStore.createIndex('by_courseId', 'courseId', { unique: false });
        }

        // 4. studyActivity: { id, lessonId, timestamp, durationSeconds, quizScores }
        if (!db.objectStoreNames.contains('studyActivity')) {
          const actStore = db.createObjectStore('studyActivity', { keyPath: 'id' });
          actStore.createIndex('by_lessonId', 'lessonId', { unique: false });
        }

        // Auxiliary persistent stores
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('by_courseId', 'courseId', { unique: false });
        }

        if (!db.objectStoreNames.contains('terms')) {
          const termsStore = db.createObjectStore('terms', { keyPath: 'id' });
          termsStore.createIndex('by_courseId', 'courseId', { unique: false });
        }

        if (!db.objectStoreNames.contains('certificates')) {
          db.createObjectStore('certificates', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('combinedCertificates')) {
          db.createObjectStore('combinedCertificates', { keyPath: 'id' });
        }

        // 5. Offline Outbox / Background Sync Queue
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('by_type', 'type', { unique: false });
          syncStore.createIndex('by_createdAt', 'createdAt', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// ================================================================
// A. LOCAL STORAGE CONTROLLERS (Lightweight Global Configuration)
// ================================================================

export function getUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(LS_PREFERENCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch {
    // fallback
  }
  return DEFAULT_PREFERENCES;
}

export function setUserPreferences(updates: Partial<UserPreferences>): UserPreferences {
  const current = getUserPreferences();
  const merged = { ...current, ...updates };
  try {
    localStorage.setItem(LS_PREFERENCES_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn('[Persistence] Failed to write preferences:', err);
  }
  return merged;
}

export function getActiveUserProfileId(): string | null {
  try {
    return localStorage.getItem(LS_ACTIVE_USER_ID_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveUserProfileId(userId: string | null): void {
  try {
    if (userId) {
      localStorage.setItem(LS_ACTIVE_USER_ID_KEY, userId);
    } else {
      localStorage.removeItem(LS_ACTIVE_USER_ID_KEY);
    }
  } catch (err) {
    console.warn('[Persistence] Failed to set active user ID:', err);
  }
}

export function getLastActiveCourseSession(): LastActiveCourseSession | null {
  try {
    const raw = localStorage.getItem(LS_LAST_ACTIVE_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

export function setLastActiveCourseSession(session: LastActiveCourseSession): void {
  try {
    localStorage.setItem(LS_LAST_ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

// ================================================================
// B. INDEXEDDB CONTROLLERS (Structured Heavy Application Data)
// ================================================================

// Normalizers to guarantee strict schema shapes for the 4 core IndexedDB stores
export function normalizeUserProfile(user: any): User {
  const now = new Date().toISOString();
  return {
    ...user,
    id: user.id || `usr_${Date.now()}`,
    name: user.name || user.realName || 'Mindly Learner',
    realName: user.realName || user.name || 'Mindly Learner',
    username: user.username || `learner_${Date.now().toString(36).slice(-4)}`,
    email: user.email || 'learner@mindly.local',
    studyStreak: typeof user.studyStreak === 'number' ? user.studyStreak : 1,
    lastActiveDate: user.lastActiveDate || user.updatedAt || now,
    totalStudyTimeMinutes: typeof user.totalStudyTimeMinutes === 'number' ? user.totalStudyTimeMinutes : 0,
    createdDate: user.createdDate || user.createdAt || now,
    createdAt: user.createdAt || user.createdDate || now,
    updatedAt: user.updatedAt || user.lastActiveDate || now,
  };
}

export function normalizeCourse(course: any): Course {
  const now = new Date().toISOString();
  const totalDays = course.totalDays || course.estimatedDays || (Array.isArray(course.studyDays) ? course.studyDays.length : 7);
  const currentDay = course.currentDay || 1;
  const progressPercentage = typeof course.progressPercentage === 'number'
    ? course.progressPercentage
    : (typeof course.progressPercent === 'number' ? course.progressPercent : 0);
  const modules = Array.isArray(course.modules)
    ? course.modules
    : (Array.isArray(course.studyDays) ? course.studyDays : []);

  return {
    ...course,
    id: course.id,
    title: course.title || 'Untitled Course',
    category: course.category || 'General Knowledge',
    description: course.description || '',
    totalDays,
    estimatedDays: totalDays,
    currentDay,
    progressPercentage,
    progressPercent: progressPercentage,
    modules,
    studyDays: Array.isArray(course.studyDays) ? course.studyDays : modules,
    createdAt: course.createdAt || now,
    updatedAt: course.updatedAt || now,
  };
}

export function normalizeLesson(lesson: any): Lesson {
  const scrollOffset = typeof lesson.scrollOffsetPosition === 'number'
    ? lesson.scrollOffsetPosition
    : (lesson.readingPosition?.scrollY || 0);

  const content = typeof lesson.content === 'string'
    ? lesson.content
    : (lesson.structuredContent?.overview || lesson.originalMaterial?.content || '');

  const diagrams = Array.isArray(lesson.diagrams)
    ? lesson.diagrams
    : (lesson.structuredContent?.diagrams || []);

  const images = Array.isArray(lesson.images)
    ? lesson.images
    : (lesson.structuredContent?.images || []);

  const quizzes = Array.isArray(lesson.quizzes)
    ? lesson.quizzes
    : (lesson.structuredContent?.reviewQuestions || []);

  const userNotes = typeof lesson.userNotes === 'string'
    ? lesson.userNotes
    : '';

  return {
    ...lesson,
    id: lesson.id,
    courseId: lesson.courseId,
    dayNumber: lesson.dayNumber || 1,
    title: lesson.title || 'Untitled Lesson',
    content,
    diagrams,
    images,
    quizzes,
    userNotes,
    scrollOffsetPosition: scrollOffset,
    readingPosition: lesson.readingPosition || {
      scrollY: scrollOffset,
      dayNumber: lesson.dayNumber || 1,
      updatedAt: new Date().toISOString(),
    },
    isCompleted: !!lesson.isCompleted,
  };
}

export function normalizeActivity(activity: any): ActivityItem {
  const now = new Date().toISOString();
  return {
    ...activity,
    id: activity.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    lessonId: activity.lessonId || '',
    timestamp: activity.timestamp || activity.createdAt || now,
    durationSeconds: typeof activity.durationSeconds === 'number'
      ? activity.durationSeconds
      : (activity.studyDurationMinutes ? activity.studyDurationMinutes * 60 : 0),
    quizScores: Array.isArray(activity.quizScores)
      ? activity.quizScores
      : (typeof activity.score === 'number' ? [activity.score] : []),
  };
}

export const persistenceEngine = {
  // --- 1. USER PROFILES ---
  async saveUserProfile(user: User): Promise<void> {
    const db = await getDB();
    const normalized = normalizeUserProfile(user);
    await db.put('userProfiles', normalized);
    setActiveUserProfileId(normalized.id);
    try {
      localStorage.setItem('mindly_user_interests', JSON.stringify(normalized.interests || []));
      localStorage.setItem('mindly_user_profile', JSON.stringify(normalized));
    } catch {
      // ignore
    }
  },

  async getUserProfile(id?: string): Promise<User | null> {
    const db = await getDB();
    const targetId = id || getActiveUserProfileId();
    if (targetId) {
      const user = await db.get('userProfiles', targetId);
      if (user) return normalizeUserProfile(user);
    }
    // No target ID or matching profile: return null rather than resurrecting another user
    return null;
  },

  async clearActiveUser(): Promise<void> {
    try {
      localStorage.removeItem(LS_ACTIVE_USER_ID_KEY);
      localStorage.removeItem(LS_TOKEN_KEY);
      localStorage.removeItem('mindly_session_token'); // Clean legacy token key if present
      localStorage.removeItem('mindly_user_profile');
      localStorage.removeItem('mindly_user_interests');
      localStorage.removeItem('mindly_bookmarked_discovery');
      localStorage.removeItem(LS_LAST_ACTIVE_SESSION_KEY);
      const db = await getDB();
      await db.clear('userProfiles');
    } catch (err) {
      console.warn('[Persistence] Clear active user notice:', err);
    }
  },

  // --- 2. COURSES ---
  async saveCourses(courses: Course[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('courses', 'readwrite');
    for (const c of courses) {
      await tx.store.put(normalizeCourse(c));
    }
    await tx.done;
  },

  async saveCourse(course: Course): Promise<void> {
    const db = await getDB();
    await db.put('courses', normalizeCourse(course));
  },

  async getCourses(): Promise<Course[]> {
    const db = await getDB();
    const raw = await db.getAll('courses');
    return raw.map(normalizeCourse);
  },

  async getCourse(id: string): Promise<Course | undefined> {
    const db = await getDB();
    const course = await db.get('courses', id);
    return course ? normalizeCourse(course) : undefined;
  },

  async deleteCourse(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('courses', id);
  },

  // --- 3. LESSONS ---
  async saveLessons(lessons: Lesson[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('lessons', 'readwrite');
    for (const l of lessons) {
      await tx.store.put(normalizeLesson(l));
    }
    await tx.done;
  },

  async saveLesson(lesson: Lesson): Promise<void> {
    const db = await getDB();
    await db.put('lessons', normalizeLesson(lesson));
  },

  async getLessons(courseId?: string): Promise<Lesson[]> {
    const db = await getDB();
    let raw: Lesson[] = [];
    if (courseId) {
      raw = await db.getAllFromIndex('lessons', 'by_courseId', courseId);
    } else {
      raw = await db.getAll('lessons');
    }
    return raw.map(normalizeLesson);
  },

  async getLesson(id: string): Promise<Lesson | undefined> {
    const db = await getDB();
    const lesson = await db.get('lessons', id);
    return lesson ? normalizeLesson(lesson) : undefined;
  },

  async deleteLesson(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('lessons', id);
  },

  // --- 4. STUDY ACTIVITIES ---
  async saveStudyActivity(activity: ActivityItem): Promise<void> {
    const db = await getDB();
    await db.put('studyActivity', normalizeActivity(activity));
  },

  async saveStudyActivities(activities: ActivityItem[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('studyActivity', 'readwrite');
    for (const a of activities) {
      await tx.store.put(normalizeActivity(a));
    }
    await tx.done;
  },

  async getStudyActivities(): Promise<ActivityItem[]> {
    const db = await getDB();
    const raw = await db.getAll('studyActivity');
    return raw.map(normalizeActivity);
  },

  // --- NOTES ---
  async saveNotes(notes: Note[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('notes', 'readwrite');
    for (const n of notes) {
      await tx.store.put(n);
    }
    await tx.done;
  },

  async saveNote(note: Note): Promise<void> {
    const db = await getDB();
    await db.put('notes', note);
  },

  async getNotes(courseId?: string): Promise<Note[]> {
    const db = await getDB();
    if (courseId) {
      return db.getAllFromIndex('notes', 'by_courseId', courseId);
    }
    return db.getAll('notes');
  },

  async deleteNote(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('notes', id);
  },

  // --- KEY TERMS ---
  async saveTerms(terms: KeyTermItem[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('terms', 'readwrite');
    for (const t of terms) {
      await tx.store.put(t);
    }
    await tx.done;
  },

  async saveTerm(term: KeyTermItem): Promise<void> {
    const db = await getDB();
    await db.put('terms', term);
  },

  async getTerms(): Promise<KeyTermItem[]> {
    const db = await getDB();
    return db.getAll('terms');
  },

  async deleteTerm(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('terms', id);
  },

  // --- CERTIFICATES ---
  async saveCertificates(certs: Certificate[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('certificates', 'readwrite');
    for (const c of certs) {
      await tx.store.put(c);
    }
    await tx.done;
  },

  async getCertificates(): Promise<Certificate[]> {
    const db = await getDB();
    return db.getAll('certificates');
  },

  async saveCombinedCertificates(certs: CombinedCertificate[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('combinedCertificates', 'readwrite');
    for (const c of certs) {
      await tx.store.put(c);
    }
    await tx.done;
  },

  async getCombinedCertificates(): Promise<CombinedCertificate[]> {
    const db = await getDB();
    return db.getAll('combinedCertificates');
  },

  // --- 5. OFFLINE SYNC QUEUE (BACKGROUND SYNC) ---
  async addPendingSync(type: SyncOperationType, payload: any): Promise<PendingSyncItem> {
    const db = await getDB();
    const item: PendingSyncItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };
    await db.put('syncQueue', item);
    return item;
  },

  async getPendingSyncItems(): Promise<PendingSyncItem[]> {
    const db = await getDB();
    const items = (await db.getAll('syncQueue')) as PendingSyncItem[];
    return items.sort((a, b) => a.createdAt - b.createdAt);
  },

  async removePendingSyncItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('syncQueue', id);
  },

  async updatePendingSyncItem(item: PendingSyncItem): Promise<void> {
    const db = await getDB();
    await db.put('syncQueue', item);
  },

  async getPendingSyncCount(): Promise<number> {
    const db = await getDB();
    return db.count('syncQueue');
  },

  async clearPendingSyncQueue(): Promise<void> {
    const db = await getDB();
    await db.clear('syncQueue');
  },

  // --- FULL DATA BACKUP & EXPORT ---
  async exportAllData(): Promise<MindlyFullExport> {
    const [user, courses, lessons, notes, terms, activities, certificates] = await Promise.all([
      this.getUserProfile(),
      this.getCourses(),
      this.getLessons(),
      this.getNotes(),
      this.getTerms(),
      this.getStudyActivities(),
      this.getCertificates(),
    ]);

    return {
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      preferences: getUserPreferences(),
      activeUserId: getActiveUserProfileId(),
      userProfile: user,
      courses,
      lessons,
      notes,
      terms,
      activities,
      certificates,
    };
  },

  // --- FULL DATA IMPORT ---
  async importAllData(data: Partial<MindlyFullExport>): Promise<{ success: boolean; counts: any }> {
    const db = await getDB();

    if (data.preferences) {
      setUserPreferences(data.preferences);
    }

    if (data.userProfile) {
      await this.saveUserProfile(data.userProfile);
    }

    if (Array.isArray(data.courses) && data.courses.length > 0) {
      await this.saveCourses(data.courses);
    }

    if (Array.isArray(data.lessons) && data.lessons.length > 0) {
      await this.saveLessons(data.lessons);
    }

    if (Array.isArray(data.notes) && data.notes.length > 0) {
      await this.saveNotes(data.notes);
    }

    if (Array.isArray(data.terms) && data.terms.length > 0) {
      await this.saveTerms(data.terms);
    }

    if (Array.isArray(data.activities) && data.activities.length > 0) {
      await this.saveStudyActivities(data.activities);
    }

    if (Array.isArray(data.certificates) && data.certificates.length > 0) {
      await this.saveCertificates(data.certificates);
    }

    return {
      success: true,
      counts: {
        courses: data.courses?.length || 0,
        lessons: data.lessons?.length || 0,
        notes: data.notes?.length || 0,
        terms: data.terms?.length || 0,
        certificates: data.certificates?.length || 0,
      },
    };
  },

  // --- HARD RESET LOCAL CACHE ---
  async clearAllLocalData(): Promise<void> {
    const db = await getDB();
    const stores = ['userProfiles', 'courses', 'lessons', 'studyActivity', 'notes', 'terms', 'certificates', 'combinedCertificates'] as const;
    const tx = db.transaction(stores, 'readwrite');
    for (const store of stores) {
      await tx.objectStore(store).clear();
    }
    await tx.done;

    // Clear local storage keys
    try {
      localStorage.removeItem(LS_ACTIVE_USER_ID_KEY);
      localStorage.removeItem(LS_LAST_ACTIVE_SESSION_KEY);
      localStorage.removeItem(LS_TOKEN_KEY);
      localStorage.removeItem('mindly_session_token');
      localStorage.removeItem('mindly_local_db');
      // Clear lesson reading positions
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('mindly_reading_') || key.startsWith('mindly_course_last_read_'))) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  },
};
