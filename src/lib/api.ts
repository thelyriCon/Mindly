/**
 * Mindly API Client with Seamless Offline/Static-Host Resilience
 */
import {
  User,
  Course,
  Lesson,
  Note,
  KeyTermItem,
  ActivityItem,
  MaterialHistoryItem,
  SearchResultItem,
  StructuredContent,
  StudyProgress,
  ExtractedDocument,
  Certificate,
  CombinedCertificate,
  Circle,
  Discussion,
  DiscussionReply,
  StudyRoom,
  LearnerProfile,
  PrivacySettings,
  SpacedRepetitionSummary,
  DueReviewItem,
  LessonSpacedRepetition,
  SpacedRepetitionRating,
  MicroArticle,
  SharedCourse,
} from '../types';
import { getDemoDatabase } from './demoData';
import {
  persistenceEngine,
  getActiveUserProfileId,
  setActiveUserProfileId,
  LS_TOKEN_KEY,
  LS_ACTIVE_USER_ID_KEY,
  setLastActiveCourseSession,
} from './persistence';
import { syncEngine } from './syncEngine';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  auth,
  googleProvider,
  normalizeUsername,
  checkUsernameAvailable,
  getUserProfileFromFirestore,
  createUserProfileInFirestore,
  updateUserProfileInFirestore,
  uploadAvatarToStorage,
  db,
} from './firebase';
import { optimizeAvatarImage } from './imageOptimization';
import {
  cleanPayload,
  getCoursesFromFirestore,
  getCourseFromFirestore,
  createCourseInFirestore,
  createCourseWithLessonsInFirestore,
  updateCourseInFirestore,
  deleteCourseInFirestore,
  getLessonFromFirestore,
  findLessonByIdInFirestore,
  createLessonInFirestore,
  updateLessonInFirestore,
  deleteLessonInFirestore,
  shareCourseInFirestore,
  getSharedCourseFromFirestore,
  importSharedCourseInFirestore,
  toggleArchiveCourseInFirestore,
  resetCourseProgressInFirestore,
} from './firestoreCourses';
import {
  getNotesFromFirestore,
  createNoteInFirestore,
  updateNoteInFirestore,
  deleteNoteInFirestore,
  getTermsFromFirestore,
  createTermInFirestore,
  deleteTermInFirestore,
  getMaterialsFromFirestore,
  createMaterialInFirestore,
  logStudySessionInFirestore,
  getStudyProgressFromFirestore,
  getActivitiesFromFirestore,
  createActivityInFirestore,
  recordQuizAttemptInFirestore,
  updateStudyGoalInFirestore,
  migratePhase2BLearningData,
} from './firestoreLearning';
import {
  getCertificatesFromFirestore,
  getCombinedCertificatesFromFirestore,
  createCertificateInFirestore,
  createCombinedCertificateInFirestore,
  migrateCertificatesToFirestore,
} from './firestoreCertificates';
import {
  getCirclesFromFirestore,
  createCircleInFirestore,
  joinCircleInFirestore,
  leaveCircleInFirestore,
  getDiscussionsFromFirestore,
  createDiscussionInFirestore,
  deleteDiscussionInFirestore,
  addDiscussionReplyInFirestore,
  getStudyRoomsFromFirestore,
  createStudyRoomInFirestore,
  joinStudyRoomInFirestore,
  leaveStudyRoomInFirestore,
  migrateCommunityToFirestore,
} from './firestoreCommunity';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  updateProfile,
} from 'firebase/auth';

const STORAGE_KEY = 'mindly_local_db';
const TOKEN_KEY = LS_TOKEN_KEY;

// Synchronously cached verified Firebase ID token for fetch headers
let cachedFirebaseIdToken: string | null = null;

// Reactively keep ID token refreshed as Firebase rotates it
auth.onIdTokenChanged(async (user) => {
  if (user) {
    try {
      cachedFirebaseIdToken = await user.getIdToken();
      localStorage.setItem(TOKEN_KEY, cachedFirebaseIdToken);
    } catch {
      cachedFirebaseIdToken = null;
    }
  } else {
    cachedFirebaseIdToken = null;
    localStorage.removeItem(TOKEN_KEY);
  }
});

/**
 * Returns clean Authorization Bearer headers with the verified Firebase ID token.
 * X-User-Id is NEVER sent as an identity mechanism.
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = cachedFirebaseIdToken || localStorage.getItem(TOKEN_KEY);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function ensureFreshAuthToken(): Promise<string | null> {
  if (auth.currentUser) {
    try {
      cachedFirebaseIdToken = await auth.currentUser.getIdToken(true);
      if (cachedFirebaseIdToken) {
        localStorage.setItem(TOKEN_KEY, cachedFirebaseIdToken);
      }
      return cachedFirebaseIdToken;
    } catch {
      return null;
    }
  }
  return null;
}

function getLocalDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user) return parsed;
    }
  } catch (e) {
    console.warn('LocalStorage access warning:', e);
  }
  const initial = {
    user: {
      id: 'usr_default_01',
      name: 'Learner',
      username: 'learner',
      email: 'learner@mindly.local',
      studyStreak: 1,
      todayStudySeconds: 0,
      dailyStudyGoalMinutes: 35,
      totalStudyTimeMinutes: 0,
      hasCompletedOnboarding: false,
    },
    courses: [],
    lessons: [],
    notes: [],
    terms: [],
    activities: [],
    materials: [],
    certificates: [],
    combinedCertificates: [],
  };
  saveLocalDb(initial);
  return initial;
}

function saveLocalDb(data: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage write warning:', e);
  }
}

export const api = {
  // Auth & Profile
  async getMe(): Promise<{ user: User | null }> {
    try {
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      }
    } catch {
      // Ignore if offline
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return { user: null };
    }

    try {
      const profile = await getUserProfileFromFirestore(firebaseUser.uid);
      if (profile) {
        // Protect saved avatar: if Firestore has no profileImage or blank, check cached profile or Firebase Auth photoURL
        if (!profile.profileImage) {
          const cached = await persistenceEngine.getUserProfile(firebaseUser.uid);
          if (cached?.profileImage) {
            profile.profileImage = cached.profileImage;
            updateUserProfileInFirestore(firebaseUser.uid, { profileImage: cached.profileImage }).catch(() => {});
          } else if (firebaseUser.photoURL) {
            profile.profileImage = firebaseUser.photoURL;
            updateUserProfileInFirestore(firebaseUser.uid, { profileImage: firebaseUser.photoURL }).catch(() => {});
          }
        }
        await persistenceEngine.saveUserProfile(profile);
        return { user: profile };
      }
    } catch (err) {
      console.warn('[Firebase] Failed to fetch current profile:', err);
    }

    // Synthesize canonical User record from authenticated Firebase credentials
    // Guarantees authenticated sessions are NEVER dropped to unauthenticated state!
    const cached = await persistenceEngine.getUserProfile(firebaseUser.uid).catch(() => null);
    const existingAvatar = cached?.profileImage || firebaseUser.photoURL || undefined;

    const realName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Mindly Learner';
    const fallbackUser: User = {
      id: firebaseUser.uid,
      name: realName,
      realName,
      username: `@learner_${firebaseUser.uid.slice(0, 5)}`,
      email: firebaseUser.email || '',
      profileImage: existingAvatar,
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

    await persistenceEngine.saveUserProfile(fallbackUser).catch(() => {});
    setDoc(doc(db, 'users', firebaseUser.uid), cleanPayload({ ...fallbackUser, uid: firebaseUser.uid })).catch(() => {});

    return { user: fallbackUser };
  },

  async createOrUpdateProfile(payload: {
    realName?: string;
    name?: string;
    username?: string;
    email?: string;
    interests?: string[];
    dailyStudyGoalMinutes?: number;
    settings?: any;
    profileImage?: string;
  }): Promise<{ user: User; token?: string }> {
    if (!auth.currentUser) {
      throw new Error('Authentication required.');
    }

    const uid = auth.currentUser.uid;
    const finalRealName = (payload.realName || payload.name || auth.currentUser.displayName || 'Mindly Learner').trim();
    const finalUsername = normalizeUsername(payload.username || auth.currentUser.displayName || `learner_${uid.slice(0, 5)}`);

    const updatedUser = await createUserProfileInFirestore(uid, {
      email: payload.email || auth.currentUser.email || '',
      realName: finalRealName,
      username: finalUsername,
      interests: payload.interests,
      dailyStudyGoalMinutes: payload.dailyStudyGoalMinutes,
      profileImage: payload.profileImage,
    });

    await persistenceEngine.saveUserProfile(updatedUser);
    return { user: updatedUser };
  },

  async login(email: string, password?: string): Promise<{ user: User }> {
    if (!password) throw new Error('Password is required.');
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const user = await getUserProfileFromFirestore(cred.user.uid);
    if (!user) {
      throw new Error('User profile record not found. Please complete profile setup.');
    }
    await persistenceEngine.saveUserProfile(user);
    return { user };
  },

  async register(realName: string, username: string, email: string, password?: string): Promise<{ user: User }> {
    if (!realName || !realName.trim()) {
      throw new Error('Real name is required for formal certificates.');
    }
    const cleanUser = normalizeUsername(username);
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const isAvailable = await checkUsernameAvailable(cleanUser);
    if (!isAvailable) {
      throw new Error(`The username "@${cleanUser}" is already taken. Please choose another.`);
    }

    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const uid = cred.user.uid;

    try {
      const user = await createUserProfileInFirestore(uid, {
        email: email.trim(),
        realName: realName.trim(),
        username: cleanUser,
      });

      await updateProfile(cred.user, { displayName: realName.trim() });
      await persistenceEngine.saveUserProfile(user);
      return { user };
    } catch (err: any) {
      // Rollback newly created Auth user if Firestore reservation fails
      try {
        await cred.user.delete();
      } catch {}
      throw err;
    }
  },

  async checkUsername(username: string): Promise<{ available: boolean; error?: string }> {
    const clean = normalizeUsername(username);
    if (!clean || clean.length < 3) {
      return { available: false, error: 'Username must be at least 3 characters long' };
    }
    const isAvail = await checkUsernameAvailable(clean, auth.currentUser?.uid);
    return { available: isAvail, error: isAvail ? undefined : 'Username is already taken' };
  },

  async googleLogin(): Promise<{
    user: User | null;
    isNewUser: boolean;
    suggestedName?: string;
    email?: string;
  }> {
    const cred = await signInWithPopup(auth, googleProvider);
    const uid = cred.user.uid;
    const existing = await getUserProfileFromFirestore(uid);

    if (existing) {
      await persistenceEngine.saveUserProfile(existing);
      return { user: existing, isNewUser: false };
    }

    return {
      user: null,
      isNewUser: true,
      suggestedName: cred.user.displayName || '',
      email: cred.user.email || '',
    };
  },

  async setupProfile(realName: string, username: string): Promise<{ user: User }> {
    if (!auth.currentUser) {
      throw new Error('Not authenticated with Firebase.');
    }
    const uid = auth.currentUser.uid;
    const cleanUser = normalizeUsername(username);

    const user = await createUserProfileInFirestore(uid, {
      email: auth.currentUser.email || '',
      realName: realName.trim(),
      username: cleanUser,
      profileImage: auth.currentUser.photoURL || undefined,
    });

    await updateProfile(auth.currentUser, { displayName: realName.trim() });
    await persistenceEngine.saveUserProfile(user);
    return { user };
  },

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[Firebase] SignOut error:', err);
    }
    await persistenceEngine.clearActiveUser();
  },

  async resetPassword(email: string): Promise<{ message: string }> {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    await sendPasswordResetEmail(auth, email.trim());
    return { message: 'Password reset email sent to ' + email.trim() + '. Please check your inbox.' };
  },

  async confirmPasswordReset(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    await firebaseConfirmPasswordReset(auth, token, newPassword);
    return { success: true, message: 'Password has been successfully updated. You may now sign in.' };
  },

  async updateProfile(updates: Partial<User>): Promise<{ user: User }> {
    let updatedUser: User | null = null;
    if (auth.currentUser) {
      try {
        updatedUser = await updateUserProfileInFirestore(auth.currentUser.uid, updates);
      } catch (err) {
        console.warn('[Firebase] Firestore profile update warning:', err);
      }
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          updatedUser = data.user;
        }
      }
    } catch {
      // Fallback
    }

    const cached = auth.currentUser ? await persistenceEngine.getUserProfile(auth.currentUser.uid) : null;
    const finalUser = updatedUser || { ...(cached || getLocalDb().user), ...updates };
    await persistenceEngine.saveUserProfile(finalUser).catch(() => {});
    return { user: finalUser };
  },

  async uploadAvatar(
    fileOrBase64: File | string,
    fileName?: string
  ): Promise<{ profileImage: string; user?: User }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentication required to upload profile picture.');
    }
    const uid = currentUser.uid;

    // 1. Optimize image locally to lightweight, high-fidelity square WebP (<=256x256)
    const optimizedDataUrl = await optimizeAvatarImage(fileOrBase64, 256, 0.85);

    // 2. Attempt cloud upload to Firebase Storage if bucket is provisioned
    let durableImageUrl = optimizedDataUrl;
    try {
      const storageUrl = await uploadAvatarToStorage(uid, optimizedDataUrl);
      if (storageUrl) {
        durableImageUrl = storageUrl;
      }
    } catch (err) {
      console.warn('[Storage] Falling back to direct durable Firestore profile storage:', err);
    }

    // 3. Authoritatively save durable image URL to Cloud Firestore /users/{uid}
    const updatedUser = await updateUserProfileInFirestore(uid, {
      profileImage: durableImageUrl,
    });

    // 4. Synchronize with Firebase Auth photoURL if size fits
    if (durableImageUrl.length < 2048) {
      try {
        await updateProfile(currentUser, { photoURL: durableImageUrl });
      } catch (authErr) {
        console.warn('[Firebase Auth] photoURL sync warning:', authErr);
      }
    }

    // 5. Cache locally in persistenceEngine
    const cached = await persistenceEngine.getUserProfile(uid);
    const finalUser: User = updatedUser || {
      ...(cached || (getLocalDb().user as User)),
      id: uid,
      profileImage: durableImageUrl,
    };
    await persistenceEngine.saveUserProfile(finalUser).catch(() => {});

    // 6. Notify Express backend so local caches stay in sync
    try {
      await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ imageBase64: durableImageUrl, fileName }),
      });
    } catch {
      // Express notification is non-blocking
    }

    return { profileImage: durableImageUrl, user: finalUser };
  },

  async removeAvatar(): Promise<{ success: boolean }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentication required to remove profile picture.');
    }
    const uid = currentUser.uid;

    // 1. Authoritatively clear from Cloud Firestore
    await updateUserProfileInFirestore(uid, { profileImage: '' });

    // 2. Clear Firebase Auth photoURL
    try {
      await updateProfile(currentUser, { photoURL: '' });
    } catch {}

    // 3. Clear in persistenceEngine
    const cached = await persistenceEngine.getUserProfile(uid);
    if (cached) {
      cached.profileImage = undefined;
      await persistenceEngine.saveUserProfile(cached).catch(() => {});
    }

    // 4. Notify Express backend
    try {
      await fetch('/api/profile/avatar', {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch {}

    return { success: true };
  },

  async extractDocument(fileBase64: string, fileName: string, mimeType?: string): Promise<{ extracted: ExtractedDocument }> {
    const res = await fetch('/api/documents/extract', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fileBase64, fileName, mimeType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Document extraction failed');
    return data;
  },

  async exportVault(): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/export', { headers });
    if (!res.ok) throw new Error('Knowledge export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindly-vault-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Courses
  async getCourses(): Promise<{ courses: Course[] }> {
    if (auth.currentUser) {
      try {
        const firestoreCourses = await getCoursesFromFirestore(auth.currentUser.uid);
        if (Array.isArray(firestoreCourses)) {
          return { courses: firestoreCourses };
        }
      } catch (err) {
        console.warn('[API getCourses] Firestore read failed, falling back to cache:', err);
      }
    }
    const idbCourses = await persistenceEngine.getCourses();
    return { courses: idbCourses || [] };
  },

  async getCourse(id: string): Promise<{ course: Course | null; lessons: Lesson[] }> {
    if (auth.currentUser) {
      try {
        const result = await getCourseFromFirestore(id, auth.currentUser.uid);
        if (result.course) {
          return result;
        }
      } catch (err) {
        console.warn(`[API getCourse] Firestore read failed for ${id}, falling back:`, err);
      }
    }
    const idbCourse = await persistenceEngine.getCourse(id);
    const idbLessons = await persistenceEngine.getLessons(id);
    if (idbCourse) {
      return { course: idbCourse, lessons: idbLessons };
    }
    return { course: null, lessons: [] };
  },

  async createCourse(data: {
    title: string;
    description?: string;
    category?: string;
    coverIcon?: string;
    courseType?: string;
    depth?: string;
    dailyMinutesRange?: string;
    dailyStudyGoalMinutes?: number;
    estimatedDays?: number;
  }): Promise<{ course: Course }> {
    if (auth.currentUser) {
      // Authoritatively persist to Cloud Firestore
      const newCourse = await createCourseInFirestore(data as any);
      // Synchronize to backend in background with exact same ID
      fetch('/api/courses', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...data, id: newCourse.id }),
      }).catch(() => {});
      return { course: newCourse };
    }

    // Offline mode with explicit queue
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineCourse: Course = {
        id: 'crs_' + Date.now(),
        userId: 'offline_user',
        title: data.title,
        description: data.description || '',
        category: data.category || 'General',
        coverIcon: data.coverIcon || 'BookOpen',
        courseType: data.courseType || 'custom',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await persistenceEngine.saveCourse(offlineCourse);
      await syncEngine.enqueue('course_create', data);
      return { course: offlineCourse };
    }

    throw new Error('Authentication required to create a course.');
  },

  // Study Progress and Goal Tracking
  async getStudyProgress(): Promise<{ progress: StudyProgress }> {
    if (auth.currentUser) {
      try {
        const profile = await getUserProfileFromFirestore(auth.currentUser.uid);
        const goal = profile?.dailyStudyGoalMinutes || 30;
        const progress = await getStudyProgressFromFirestore(auth.currentUser.uid, goal);
        return { progress };
      } catch (err) {
        console.warn('[API getStudyProgress] Firestore read failed, falling back:', err);
      }
    }
    const db = getLocalDb();
    const goal = db.user?.dailyStudyGoalMinutes || 30;
    const todaySec = db.user?.todayStudySeconds || 0;
    const todayMin = Math.round(todaySec / 60);
    const progressPercent = Math.min(100, Math.round((todayMin / goal) * 100));
    return {
      progress: {
        dailyGoalMinutes: goal,
        todaySeconds: todaySec,
        todayMinutes: todayMin,
        progressPercent,
        streakDays: 3,
        remainingMinutes: Math.max(0, goal - todayMin),
        isGoalReached: todayMin >= goal,
      },
    };
  },

  async updateStudyGoal(goalMinutes: number): Promise<{ success: boolean; goalMinutes: number }> {
    if (auth.currentUser) {
      try {
        await updateStudyGoalInFirestore(auth.currentUser.uid, goalMinutes);
      } catch (err) {
        console.warn('[API updateStudyGoal] Firestore update error:', err);
      }
    }
    try {
      fetch('/api/study/goal', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ dailyStudyGoalMinutes: goalMinutes }),
      }).catch(() => {});
    } catch {}
    const db = getLocalDb();
    if (db.user) {
      db.user.dailyStudyGoalMinutes = goalMinutes;
      saveLocalDb(db);
    }
    return { success: true, goalMinutes };
  },

  async logStudyTime(seconds: number, lessonId?: string): Promise<{ success: boolean; todaySeconds: number }> {
    if (auth.currentUser) {
      try {
        let lessonTitle: string | undefined;
        if (lessonId) {
          const cached = await persistenceEngine.getLesson(lessonId);
          lessonTitle = cached?.title;
        }
        const { progress } = await logStudySessionInFirestore({ seconds, lessonId, lessonTitle });
        // Background sync to server
        fetch('/api/study-time/log', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ seconds, lessonId, lessonTitle }),
        }).catch(() => {});
        return { success: true, todaySeconds: progress.todaySeconds };
      } catch (err) {
        console.warn('[API logStudyTime] Firestore session logging note:', err);
      }
    }
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Device is offline');
      }
      const res = await fetch('/api/study-time/log', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ seconds, lessonId }),
      });
      if (res.ok) return await res.json();
    } catch {
      await syncEngine.enqueue('study_log', { seconds, lessonId });
    }
    const db = getLocalDb();
    if (db.user) {
      db.user.todayStudySeconds = (db.user.todayStudySeconds || 0) + seconds;
      saveLocalDb(db);
    }
    return { success: true, todaySeconds: db.user?.todayStudySeconds || 0 };
  },

  // AI-Powered Micro-Article Discovery Stream
  async getMicroArticles(interests?: string[]): Promise<{ articles: MicroArticle[] }> {
    try {
      const q = interests && interests.length > 0 ? `?interests=${encodeURIComponent(interests.join(','))}` : '';
      const res = await fetch(`/api/micro-articles${q}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[API] Could not fetch micro-articles online, serving fallback:', err);
    }

    return {
      articles: [
        {
          id: 'ma-ai-01',
          topic: 'Prompt Engineering & AI Tools',
          category: 'Artificial Intelligence & Automation',
          headline: 'Context Structuring & Few-Shot Prompting: Driving Deterministic AI Workflows',
          snippet:
            'Vague, single-sentence prompts generate generic, unreliable AI outputs that require extensive manual editing. Structuring prompts with explicit role framing, few-shot demonstration pairs, and negative constraints converts probabilistic language models into reliable professional automation tools.',
          fullContent: `Real-World Challenge & Context:
When professionals adopt AI tools like ChatGPT or Gemini for complex tasks—such as extracting data from contracts, synthesizing market reports, or generating code—they often encounter inconsistent formatting, hallucinations, or conversational fluff. Treating an LLM like an omniscient chat partner leads to unpredictable variations that cannot be integrated into serious business pipelines.

Core Principle & Mechanism:
Large language models operate by predicting the most statistically probable next token given the prompt's context window. Without clear structural boundaries, the model samples across broad, generic training data. Implementing Few-Shot Prompting provides explicit input-output demonstration pairs that establish the target pattern in in-context memory. When combined with Role Framing, delimiters (e.g. XML tags or Markdown headers), and output schema enforcement (JSON/Markdown tables), the model's probability distribution concentrates tightly on the desired format.

Step-by-Step Practical Application:
To build production-grade prompt templates: Step 1: Assign a specific professional identity (e.g., "Act as a Senior Financial Analyst"). Step 2: Separate source materials from instructions using distinct tags like <source_text>...</source_text>. Step 3: Provide 2 to 3 pristine examples demonstrating the exact desired input-to-output mapping. Step 4: Include negative constraints (e.g., "Never guess missing figures; output null if unverified"). Step 5: Specify deterministic output structure such as JSON keys or bulleted takeaways.

Actionable Competency & Next Steps:
Mastering prompt engineering enables you to automate document triage, extract structured metrics from unstructured emails, and author standardized reports in seconds. Expanding this foundation into a full course teaches agentic chaining, retrieval-augmented generation (RAG), and API-driven automation.`,
          keyInsight: 'Providing explicit few-shot input-output examples conditions the language model to produce consistent, structured business outputs.',
          imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=800&q=80',
          imageCaption: 'Structured prompt conditioning and token probability distribution in modern LLMs',
          suggestedCourseTitle: 'Practical Prompt Engineering & AI Workflows',
          tags: ['AI Tools', 'Automation', 'Productivity'],
          readTime: '2 min',
        },
        {
          id: 'ma-data-01',
          topic: 'SQL & Database Queries',
          category: 'Data Analysis & Digital Literacy',
          headline: 'Mastering SQL Window Functions: Computing Running Aggregates Without Complex Joins',
          snippet:
            'Standard GROUP BY aggregations collapse individual data rows into a single summary line, destroying granular transaction context. SQL Window Functions enable analysts to calculate running cumulative totals, moving averages, and period-over-period growth rates while retaining every row in the dataset.',
          fullContent: `Real-World Challenge & Context:
Operations managers and finance analysts frequently need to evaluate business trajectory over time: calculating month-to-date revenue pacing, ranking salesperson performance across distinct territories, or monitoring moving 7-day server error averages. Traditional SQL queries rely on self-joins or nested subqueries, which are slow, error-prone, and difficult to maintain.

Core Principle & Mechanism:
SQL Window Functions execute calculations across a set of table rows that are related to the current row, defined by an OVER() clause containing PARTITION BY and ORDER BY statements. Unlike standard aggregate functions that collapse multiple rows into one, window functions compute aggregate values while preserving individual row identity.

Step-by-Step Practical Application:
1. Define the metric: SELECT transaction_date, revenue, SUM(revenue) OVER (...).
2. Segment the calculations: Add PARTITION BY region to isolate metrics by branch or department without separate queries.
3. Establish order: Use ORDER BY transaction_date to ensure running totals accumulate chronologically.
4. Bound the window frame: Specify ROWS BETWEEN 6 PRECEDING AND CURRENT ROW to generate rolling 7-day moving averages.

Actionable Competency & Next Steps:
Mastering window functions like ROW_NUMBER(), RANK(), and moving SUM() elevates your analytical capability, allowing you to build production-grade dashboards, financial reconciliations, and retention cohort analyses.`,
          keyInsight: 'The OVER (PARTITION BY ... ORDER BY ...) clause computes cumulative running metrics while preserving row-level details.',
          imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
          imageCaption: 'Data aggregation pipelines and analytical dashboard architectures',
          suggestedCourseTitle: 'Applied SQL & Business Analytics',
          tags: ['SQL', 'Data Analysis', 'Reporting'],
          readTime: '3 min',
        },
        {
          id: 'ma-sec-01',
          topic: 'Zero Trust & Access Security',
          category: 'Cybersecurity & IT',
          headline: 'Zero Trust Architecture: Eliminating the Perimeter Illusion in Modern Networks',
          snippet:
            'Traditional network security relied on the castle-and-moat perimeter model—assuming anyone inside the corporate VPN is trustworthy. Zero Trust replaces implicit trust with the principle of "Never Trust, Always Verify", authenticating identity and device posture for every single resource access request.',
          fullContent: `Real-World Challenge & Context:
With distributed remote teams and cloud software usage, the physical corporate network perimeter no longer exists. Attackers who compromise a single employee laptop or VPN credential can freely move laterally across internal networks to extract proprietary databases and intellectual property.

Core Principle & Mechanism:
Zero Trust operates under three architectural tenets: Verify explicitly, Use least-privilege access, and Assume breach. Access requests are evaluated contextually based on user identity, multi-factor authentication (MFA) state, device health compliance, geographic location, and resource sensitivity before granting short-lived, encrypted session tokens.

Step-by-Step Practical Application:
1. Mandate phishing-resistant Multi-Factor Authentication (FIDO2/WebAuthn hardware keys or authenticator apps) across all identity providers.
2. Enforce Least-Privilege Role-Based Access Control (RBAC): restrict permissions so employees only access the specific repositories and tools required for their daily roles.
3. Segment networks micro-perimetrically using modern identity-aware proxies (e.g., Cloudflare Access, Tailscale, or Google BeyondCorp).
4. Continuous Device Health Auditing: Verify disk encryption, active OS patching, and antivirus status before authorizing cloud access.

Actionable Competency & Next Steps:
Understanding Zero Trust allows IT and systems practitioners to safeguard organizational assets against credential theft, ransomware spread, and insider threats in remote-first environments.`,
          keyInsight: 'Zero Trust replaces perimeter trust with continuous, context-aware identity and device verification.',
          imageUrl: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=800&q=80',
          imageCaption: 'Zero Trust identity verification and micro-segmented cloud access protocols',
          suggestedCourseTitle: 'Cybersecurity Fundamentals & Zero Trust Defense',
          tags: ['Cybersecurity', 'IT Security', 'Identity & Access'],
          readTime: '3 min',
        },
        {
          id: 'ma-soft-01',
          topic: 'Git & Version Control',
          category: 'Software Development & Technology',
          headline: 'Clean Git Workflows: Interactive Rebase, Feature Branches, and Conflict Resolution',
          snippet:
            'Messy commit histories filled with "fix typo" and "try again" messages make tracking bugs and reviewing pull requests painful. Mastering branch hygiene and interactive rebase creates clear, atomic histories that simplify team collaboration and code reviews.',
          fullContent: `Real-World Challenge & Context:
Engineering teams lose dozens of hours every week untangling convoluted Git merge conflicts, diagnosing regressions across hundreds of unformatted commits, and reverting broken deployments. When commit messages lack structure, pinpointing when a bug was introduced requires tedious line-by-line archaeology.

Core Principle & Mechanism:
Git tracks code changes as a directed acyclic graph (DAG) of cryptographically signed snapshots. Using feature branches keeps ongoing experiments isolated from production. Interactive rebasing (git rebase -i) allows developers to edit, reword, squash, and reorder local commits into clean, atomic milestones before opening a pull request, ensuring main branch history remains linear and legible.

Step-by-Step Practical Application:
1. Branch Isolation: Always branch off the latest main branch using descriptive conventions (e.g., feat/user-auth or fix/payment-webhook).
2. Atomic Commits: Commit each logical change independently with a descriptive imperative message (e.g., "Add timeout handling to stripe checkout").
3. Local Cleanup: Before publishing, run git rebase -i origin/main to squash exploratory commits into a unified, clean changeset.
4. Systematic Conflict Resolution: When conflicts arise, inspect both sides deliberately, run test suites locally, and finish the rebase with git rebase --continue.

Actionable Competency & Next Steps:
Proficiency with Git version control is the essential prerequisite for professional software development, DevOps CI/CD deployment automation, and open-source contributions.`,
          keyInsight: 'Using interactive rebasing to produce atomic commits makes code review and regression debugging straightforward.',
          imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
          imageCaption: 'Version control branch trees, atomic commits, and team collaboration workflows',
          suggestedCourseTitle: 'Professional Git & Team Development Workflows',
          tags: ['Git', 'Software Development', 'DevOps'],
          readTime: '3 min',
        },
        {
          id: 'ma-des-01',
          topic: 'Design Systems & UI Tokens',
          category: 'Design, UX & Creativity',
          headline: 'Design Tokens: Bridging the Gap Between Figma Systems and Production Code',
          snippet:
            'Hardcoding colors, spacings, and typography directly into CSS leads to visual drift, broken themes, and painful redesigns. Design Tokens store atomic visual values in centralized JSON schemas that synchronize seamlessly across design files and web codebases.',
          fullContent: `Real-World Challenge & Context:
When designers update a brand color palette, border radius standard, or typographic scale in Figma, engineers often spend days manually hunting down hardcoded hex values and pixel units across thousands of frontend component files. Inevitably, discrepancies arise between design mockups and production apps.

Core Principle & Mechanism:
Design Tokens are platform-agnostic key-value pairs representing atomic design decisions: color roles (e.g., color.surface.primary), spacing steps (spacing.4: 16px), and elevation shadows. Stored in structured JSON or YAML, tokens serve as the single source of truth. Build tools compile these tokens into CSS custom properties, Tailwind theme configs, and iOS/Android assets simultaneously.

Step-by-Step Practical Application:
1. Audit visual primitives: Catalog all active colors, font scales, and spacings to eliminate arbitrary one-off values.
2. Establish a 3-tier token hierarchy: Global Tokens (e.g., blue-500: #3b82f6), Semantic Tokens (primary-action: {blue-500}), and Component Tokens (btn-bg: {primary-action}).
3. Integrate with Figma Tokens Studio to export changes automatically to GitHub via pull request.
4. Map CSS variables into your frontend framework (e.g. Tailwind CSS or modern CSS custom properties) so UI changes propagate across all components instantly.

Actionable Competency & Next Steps:
Building and managing design token pipelines makes you an invaluable bridge between product design and engineering teams, enabling rapid multi-brand theming and rock-solid design consistency.`,
          keyInsight: 'Centralizing visual decisions into semantic design tokens synchronizes design files with production code automatically.',
          imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
          imageCaption: 'Design token architecture, semantic design variables, and UI component libraries',
          suggestedCourseTitle: 'Design Systems Architecture & Design Tokens',
          tags: ['Design Systems', 'UI/UX', 'Frontend Design'],
          readTime: '3 min',
        },
        {
          id: 'ma-media-01',
          topic: 'Short-Form Video Production & Hook Crafting',
          category: 'Content Creation & Digital Media',
          headline: 'The 3-Second Retention Engine: Audio-Visual Hook Architecture for Digital Video',
          snippet:
            'Over 70% of viewers scroll past short-form videos in the first three seconds if the value proposition is unclear. Structuring your opening with a curiosity gap, visual pattern interruption, and immediate narrative tension maximizes watch-time algorithms across YouTube Shorts and TikTok.',
          fullContent: `Real-World Challenge & Context:
Educators, entrepreneurs, and content creators frequently spend dozens of hours scripting and editing high-value educational videos, only to have them receive negligible impressions. On algorithmic feeds, platforms aggressively demote videos that suffer high drop-off rates in the opening 2 to 4 seconds.

Core Principle & Mechanism:
Short-form distribution algorithms prioritize completion rate and replay ratio above all other metrics. A successful video opening must execute three synchronized tasks within the first 120 frames: Pattern Interruption (unusual visual angle or dynamic movement), Curiosity Gap (stating an intriguing, unresolved question or counter-intuitive premise), and Stakes Framing (why the viewer needs this solution right now).

Step-by-Step Practical Application:
1. Script the Hook First: Eliminate throat-clearing greetings (e.g., "Hey guys, welcome back"). Start mid-action or directly with the counter-intuitive revelation.
2. Audio-Visual Pacing: Place dynamic B-roll, on-screen kinetic captions, and sound effects within the first 1.5 seconds.
3. Rapid Payoff Structure: Deliver micro-payoffs every 10 seconds to sustain cognitive engagement rather than delaying all value until the final seconds.
4. Seamless Looping: Script the final sentence so it connects grammatically to the opening word of the video to prompt natural repeated viewing.

Actionable Competency & Next Steps:
Mastering hook architecture and dynamic pacing enables creators and marketers to turn complex educational concepts into engaging, viral short-form assets that build loyal audiences and drive business growth.`,
          keyInsight: 'Hooking viewers within 3 seconds using pattern interrupts and curiosity gaps drives algorithmic watch time.',
          imageUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80',
          imageCaption: 'Short-form video editing, visual pacing, and timeline retention markers',
          suggestedCourseTitle: 'Short-Form Video Production & Visual Storytelling',
          tags: ['Content Creation', 'Video Production', 'Digital Media'],
          readTime: '3 min',
        },
      ],
    };
  },

  // Spaced Repetition Study Engine
  async getDueReviews(): Promise<SpacedRepetitionSummary> {
    try {
      const res = await fetch('/api/study/spaced-repetition/due', {
        headers: getAuthHeaders(),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }

    // Local DB fallback calculation
    const db = getLocalDb();
    const now = Date.now();
    const dueReviews: DueReviewItem[] = [];
    const upcomingReviews: DueReviewItem[] = [];
    let masteredCount = 0;
    let inProgressCount = 0;

    const lessons = db.lessons || [];
    for (const l of lessons) {
      let sr = l.spacedRepetition;
      if (!sr && l.isCompleted) {
        sr = {
          stage: 1,
          nextReviewDate: new Date(now - 3600 * 1000 * 2).toISOString(),
          reviewCount: 0,
          easeFactor: 2.5,
          intervalDays: 1,
          retentionEstimate: 85,
        };
        l.spacedRepetition = sr;
      }
      if (!sr) continue;

      const course = db.courses?.find((c: any) => c.id === l.courseId);
      const reviewTime = new Date(sr.nextReviewDate).getTime();
      const diffDays = Math.floor((now - reviewTime) / (1000 * 60 * 60 * 24));

      if (sr.stage >= 5) masteredCount++;
      else inProgressCount++;

      const item: DueReviewItem = {
        lessonId: l.id,
        lessonTitle: l.title,
        courseId: l.courseId,
        courseTitle: course?.title || 'Course',
        stage: sr.stage,
        intervalDays: sr.intervalDays || 1,
        dueStatus: reviewTime <= now ? (diffDays > 0 ? 'overdue' : 'due_today') : 'upcoming',
        daysOverdue: Math.max(0, diffDays),
        nextReviewDate: sr.nextReviewDate,
        lastReviewedAt: sr.lastReviewedAt,
        reviewCount: sr.reviewCount || 0,
        quizScore: l.quizScore ?? null,
        overview: l.structuredContent?.overview || '',
        keyTermsCount: l.structuredContent?.keyTerms?.length || 0,
        mainConceptsCount: l.structuredContent?.mainConcepts?.length || 0,
      };

      if (reviewTime <= now) dueReviews.push(item);
      else upcomingReviews.push(item);
    }

    dueReviews.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
    upcomingReviews.sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());

    const totalTracked = dueReviews.length + upcomingReviews.length;
    return {
      dueReviews,
      upcomingReviews,
      stats: {
        dueCount: dueReviews.length,
        masteredCount,
        inProgressCount,
        totalTracked,
        retentionRate: totalTracked > 0 ? 88 : 100,
      },
    };
  },

  async recordLessonReview(
    lessonId: string,
    rating: SpacedRepetitionRating
  ): Promise<{
    success: boolean;
    lesson: Lesson;
    spacedRepetition: LessonSpacedRepetition;
    nextReviewInDays: number;
  }> {
    try {
      const res = await fetch('/api/study/spaced-repetition/review', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ lessonId, rating }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }

    const db = getLocalDb();
    const lIdx = db.lessons?.findIndex((l: any) => l.id === lessonId);
    if (lIdx === -1 || lIdx === undefined) throw new Error('Lesson not found');

    const l = db.lessons[lIdx];
    const currentSR = l.spacedRepetition || {
      stage: 1,
      nextReviewDate: new Date().toISOString(),
      reviewCount: 0,
      easeFactor: 2.5,
      intervalDays: 1,
    };

    let nextStage = currentSR.stage || 1;
    let nextIntervalDays = 1;
    let ease = currentSR.easeFactor || 2.5;

    const stageIntervals = [1, 1, 3, 7, 14, 30, 60];
    switch (rating) {
      case 'again':
        nextStage = 1;
        nextIntervalDays = 1;
        ease = Math.max(1.3, ease - 0.2);
        break;
      case 'hard':
        nextStage = Math.max(1, currentSR.stage);
        nextIntervalDays = Math.max(1, Math.round((currentSR.intervalDays || 1) * 1.2));
        ease = Math.max(1.3, ease - 0.15);
        break;
      case 'good':
        nextStage = Math.min(5, currentSR.stage + 1);
        nextIntervalDays = stageIntervals[nextStage] || 30;
        break;
      case 'easy':
        nextStage = Math.min(5, currentSR.stage + 1);
        nextIntervalDays = Math.round((stageIntervals[nextStage] || 30) * 1.5);
        ease = Math.min(3.0, ease + 0.15);
        break;
    }

    const nextReviewDate = new Date(Date.now() + nextIntervalDays * 24 * 3600 * 1000).toISOString();
    const updatedSR: LessonSpacedRepetition = {
      stage: nextStage,
      nextReviewDate,
      lastReviewedAt: new Date().toISOString(),
      reviewCount: (currentSR.reviewCount || 0) + 1,
      easeFactor: Math.round(ease * 100) / 100,
      intervalDays: nextIntervalDays,
      lastRating: rating,
      retentionEstimate: rating === 'again' ? 60 : rating === 'hard' ? 78 : rating === 'good' ? 95 : 100,
    };

    db.lessons[lIdx].spacedRepetition = updatedSR;
    db.lessons[lIdx].isCompleted = true;
    saveLocalDb(db);

    return {
      success: true,
      lesson: db.lessons[lIdx],
      spacedRepetition: updatedSR,
      nextReviewInDays: nextIntervalDays,
    };
  },

  async initLessonReview(lessonId: string): Promise<{ success: boolean; lesson: Lesson }> {
    try {
      const res = await fetch('/api/study/spaced-repetition/init', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ lessonId }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }

    const db = getLocalDb();
    const lIdx = db.lessons?.findIndex((l: any) => l.id === lessonId);
    if (lIdx === -1 || lIdx === undefined) throw new Error('Lesson not found');

    const initialSR: LessonSpacedRepetition = {
      stage: 1,
      nextReviewDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      reviewCount: 0,
      easeFactor: 2.5,
      intervalDays: 1,
      retentionEstimate: 85,
    };

    db.lessons[lIdx].spacedRepetition = initialSR;
    db.lessons[lIdx].isCompleted = true;
    saveLocalDb(db);
    return { success: true, lesson: db.lessons[lIdx] };
  },

  async updateCourse(id: string, data: Partial<Course>): Promise<{ course: Course }> {
    if (auth.currentUser) {
      try {
        const updated = await updateCourseInFirestore(id, data);
        fetch(`/api/courses/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }).catch(() => {});
        return { course: updated };
      } catch (err) {
        console.error('[API updateCourse] Firestore update error:', err);
      }
    }
    const cached = await persistenceEngine.getCourse(id);
    if (cached) {
      const merged = { ...cached, ...data, updatedAt: new Date().toISOString() };
      await persistenceEngine.saveCourse(merged).catch(() => {});
      return { course: merged };
    }
    throw new Error('Course not found');
  },

  async deleteCourse(id: string): Promise<{ success: boolean }> {
    if (auth.currentUser) {
      await deleteCourseInFirestore(id);
      fetch(`/api/courses/${id}`, { method: 'DELETE', headers: getAuthHeaders() }).catch(() => {});
      return { success: true };
    }
    await persistenceEngine.deleteCourse(id).catch(() => {});
    return { success: true };
  },

  async shareCourse(courseId: string, creatorName?: string): Promise<{ shareId: string; shareUrl: string; sharedCourse: SharedCourse }> {
    if (auth.currentUser) {
      try {
        const res = await shareCourseInFirestore(courseId, creatorName);
        fetch(`/api/courses/${courseId}/share`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ creatorName }),
        }).catch(() => {});
        return res;
      } catch (err) {
        console.warn('[API shareCourse] Firestore share warning, trying backend API:', err);
      }
    }
    const res = await fetch(`/api/courses/${courseId}/share`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ creatorName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate course share link');
    }
    return await res.json();
  },

  async getSharedCourse(shareId: string): Promise<{ sharedCourse: SharedCourse | null }> {
    try {
      const shared = await getSharedCourseFromFirestore(shareId);
      if (shared) return { sharedCourse: shared };
    } catch {}
    const res = await fetch(`/api/courses/shared/${encodeURIComponent(shareId)}`);
    if (res.ok) {
      return await res.json();
    }
    return { sharedCourse: null };
  },

  async importSharedCourse(shareId: string): Promise<{ course: Course; lessons: Lesson[] }> {
    if (auth.currentUser) {
      try {
        const result = await importSharedCourseInFirestore(shareId);
        fetch(`/api/courses/shared/${encodeURIComponent(shareId)}/import`, {
          method: 'POST',
          headers: getAuthHeaders(),
        }).catch(() => {});
        return result;
      } catch (err: any) {
        console.warn('[API importSharedCourse] Firestore import warning, trying backend API:', err);
        if (err.message && err.message.includes('Please sign in')) throw err;
      }
    }
    const res = await fetch(`/api/courses/shared/${encodeURIComponent(shareId)}/import`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to import course');
    if (data.course) {
      await persistenceEngine.saveCourse(data.course).catch(() => {});
    }
    if (Array.isArray(data.lessons)) {
      await persistenceEngine.saveLessons(data.lessons).catch(() => {});
    }
    return data;
  },

  async archiveCourse(courseId: string, isArchived: boolean = true): Promise<{ course: Course }> {
    if (auth.currentUser) {
      try {
        const updated = await toggleArchiveCourseInFirestore(courseId, isArchived);
        fetch(`/api/courses/${courseId}/${isArchived ? 'archive' : 'unarchive'}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
        }).catch(() => {});
        return { course: updated };
      } catch (err) {
        console.warn('[API archiveCourse] Firestore update error:', err);
      }
    }
    const res = await fetch(`/api/courses/${courseId}/${isArchived ? 'archive' : 'unarchive'}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
    const cached = await persistenceEngine.getCourse(courseId);
    if (cached) {
      const updated: Course = {
        ...cached,
        isArchived,
        archivedAt: isArchived ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      };
      await persistenceEngine.saveCourse(updated).catch(() => {});
      return { course: updated };
    }
    throw new Error('Course not found');
  },

  async resetCourseProgress(courseId: string): Promise<{ course: Course; lessons?: Lesson[] }> {
    if (auth.currentUser) {
      try {
        const res = await resetCourseProgressInFirestore(courseId);
        fetch(`/api/courses/${courseId}/reset-progress`, {
          method: 'POST',
          headers: getAuthHeaders(),
        }).catch(() => {});
        return res;
      } catch (err) {
        console.warn('[API resetCourseProgress] Firestore reset error:', err);
      }
    }
    const res = await fetch(`/api/courses/${courseId}/reset-progress`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.course) {
        await persistenceEngine.saveCourse(data.course).catch(() => {});
      }
      return data;
    }
    const cached = await persistenceEngine.getCourse(courseId);
    if (cached) {
      const resetStudyDays = Array.isArray(cached.studyDays)
        ? cached.studyDays.map((sd) => ({ ...sd, isPassed: false, quizScore: null }))
        : [];
      const updated: Course = {
        ...cached,
        completedLessonsCount: 0,
        progressPercent: 0,
        progress: 0,
        isCompleted: false,
        finalExamPassed: false,
        finalExamScore: null,
        studyDays: resetStudyDays,
        updatedAt: new Date().toISOString(),
      };
      await persistenceEngine.saveCourse(updated).catch(() => {});
      const cachedLessons = await persistenceEngine.getLessons(courseId);
      const updatedLessons = cachedLessons.map((l) => ({
        ...l,
        isCompleted: false,
        isLocked: (l.dayNumber || 1) > 1,
        quizScore: null,
        scrollOffsetPosition: 0,
        updatedAt: new Date().toISOString(),
      }));
      if (updatedLessons.length > 0) {
        await persistenceEngine.saveLessons(updatedLessons).catch(() => {});
      }
      return { course: updated, lessons: updatedLessons };
    }
    throw new Error('Course not found');
  },

  // Lessons
  async getLesson(id: string, courseId?: string): Promise<{ lesson: Lesson; course: Course }> {
    if (auth.currentUser) {
      try {
        let res: { lesson: Lesson | null; course: Course | null } | null = null;
        if (courseId) {
          res = await getLessonFromFirestore(courseId, id);
        } else {
          const cached = await persistenceEngine.getLesson(id);
          if (cached?.courseId) {
            res = await getLessonFromFirestore(cached.courseId, id);
          } else {
            res = await findLessonByIdInFirestore(id);
          }
        }

        if (res?.lesson && res?.course) {
          // If this lesson is an unauthored shell, trigger on-demand authoring from server
          const hasSubstantiveContent =
            res.lesson.structuredContent &&
            Array.isArray(res.lesson.structuredContent.mainConcepts) &&
            res.lesson.structuredContent.mainConcepts.length > 0 &&
            Boolean(res.lesson.structuredContent.mainConcepts[0]?.explanation) &&
            res.lesson.structuredContent.mainConcepts[0].explanation.length > 40;

          if (!hasSubstantiveContent) {
            try {
              const fetchRes = await fetch(`/api/lessons/${id}`, { headers: getAuthHeaders() });
              if (fetchRes.ok) {
                const data = await fetchRes.json();
                if (data.lesson?.structuredContent) {
                  // Persist authored content to Firestore
                  await updateLessonInFirestore(res.lesson.courseId, id, {
                    structuredContent: data.lesson.structuredContent,
                  }).catch(() => {});
                  res.lesson = { ...res.lesson, structuredContent: data.lesson.structuredContent };
                }
              }
            } catch {}
          }

          return { lesson: res.lesson, course: res.course };
        }
      } catch (err) {
        console.warn(`[API getLesson] Firestore read failed for ${id}:`, err);
      }
    }

    try {
      const res = await fetch(`/api/lessons/${id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.lesson) {
          await persistenceEngine.saveLesson(data.lesson).catch(() => {});
          if (data.course) await persistenceEngine.saveCourse(data.course).catch(() => {});
        }
        return data;
      }
    } catch {
      // Fallback
    }

    const cachedLesson = await persistenceEngine.getLesson(id);
    if (cachedLesson) {
      const cachedCourse = await persistenceEngine.getCourse(cachedLesson.courseId);
      if (cachedCourse) {
        return { lesson: cachedLesson, course: cachedCourse };
      }
    }

    throw new Error(`Lesson ${id} could not be found or loaded.`);
  },

  async createLesson(
    courseId: string,
    data: {
      title: string;
      originalMaterial?: any;
      structuredContent?: StructuredContent;
    }
  ): Promise<{ lesson: Lesson }> {
    if (auth.currentUser) {
      const newLesson = await createLessonInFirestore(courseId, data as any);
      fetch(`/api/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...data, id: newLesson.id }),
      }).catch(() => {});
      return { lesson: newLesson };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineLesson: Lesson = {
        id: 'lsn_' + Date.now(),
        courseId,
        userId: 'offline_user',
        title: data.title,
        order: 1,
        isCompleted: false,
        isBookmarked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        originalMaterial: data.originalMaterial,
        structuredContent: data.structuredContent || {
          title: data.title,
          overview: 'Imported study material.',
          learningObjectives: ['Review concepts in depth.'],
          mainConcepts: [],
          examples: [],
          importantDistinctions: [],
          keyTerms: [],
          keyTakeaways: [],
          reviewQuestions: [],
        },
      };
      await persistenceEngine.saveLesson(offlineLesson);
      await syncEngine.enqueue('lesson_create', { courseId, ...data });
      return { lesson: offlineLesson };
    }

    throw new Error('Authentication required to create a lesson.');
  },

  async updateLesson(
    id: string,
    data: {
      title?: string;
      structuredContent?: StructuredContent;
      originalMaterial?: any;
    }
  ): Promise<{ lesson: Lesson }> {
    if (auth.currentUser) {
      const cached = await persistenceEngine.getLesson(id);
      let targetCourseId = cached?.courseId;
      if (!targetCourseId) {
        const found = await findLessonByIdInFirestore(id);
        targetCourseId = found.lesson?.courseId;
      }
      if (targetCourseId) {
        const updated = await updateLessonInFirestore(targetCourseId, id, data);
        fetch(`/api/lessons/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }).catch(() => {});
        return { lesson: updated };
      }
    }

    const cached = await persistenceEngine.getLesson(id);
    if (cached) {
      const merged = { ...cached, ...data, updatedAt: new Date().toISOString() };
      await persistenceEngine.saveLesson(merged).catch(() => {});
      return { lesson: merged };
    }
    throw new Error('Lesson not found');
  },

  async toggleComplete(lessonId: string): Promise<{ lesson: Lesson }> {
    const cached = await persistenceEngine.getLesson(lessonId);
    if (cached) {
      const nextCompleted = !cached.isCompleted;
      const updated: Lesson = { ...cached, isCompleted: nextCompleted, updatedAt: new Date().toISOString() };
      await persistenceEngine.saveLesson(updated);
      if (auth.currentUser && cached.courseId) {
        updateLessonInFirestore(cached.courseId, lessonId, { isCompleted: nextCompleted }).catch(() => {});
        if (nextCompleted) {
          createActivityInFirestore({
            type: 'lesson_completed',
            title: `Completed lesson "${cached.title}"`,
            courseId: cached.courseId,
            lessonId,
          }).catch(() => {});
        }
      }
      fetch(`/api/lessons/${lessonId}/toggle-complete`, { method: 'POST', headers: getAuthHeaders() }).catch(() => {});
      return { lesson: updated };
    }
    try {
      const res = await fetch(`/api/lessons/${lessonId}/toggle-complete`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const lesson = db.lessons.find((l: any) => l.id === lessonId);
    if (lesson) {
      lesson.isCompleted = !lesson.isCompleted;
      lesson.updatedAt = new Date().toISOString();
      saveLocalDb(db);
      return { lesson };
    }
    throw new Error('Lesson not found');
  },

  async toggleBookmark(lessonId: string): Promise<{ lesson: Lesson }> {
    const cached = await persistenceEngine.getLesson(lessonId);
    if (cached) {
      const updated = { ...cached, isBookmarked: !cached.isBookmarked, updatedAt: new Date().toISOString() };
      await persistenceEngine.saveLesson(updated);
      if (auth.currentUser && cached.courseId) {
        updateLessonInFirestore(cached.courseId, lessonId, { isBookmarked: updated.isBookmarked }).catch(() => {});
      }
      fetch(`/api/lessons/${lessonId}/toggle-bookmark`, { method: 'POST', headers: getAuthHeaders() }).catch(() => {});
      return { lesson: updated };
    }
    try {
      const res = await fetch(`/api/lessons/${lessonId}/toggle-bookmark`, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    throw new Error('Lesson not found');
  },

  async deleteLesson(lessonId: string): Promise<{ success: boolean }> {
    const cached = await persistenceEngine.getLesson(lessonId);
    if (auth.currentUser && cached?.courseId) {
      try {
        await deleteLessonInFirestore(cached.courseId, lessonId);
      } catch (err) {
        console.warn('[API deleteLesson] Firestore delete error:', err);
      }
    }
    await persistenceEngine.deleteLesson(lessonId).catch(() => {});
    fetch(`/api/lessons/${lessonId}`, { method: 'DELETE', headers: getAuthHeaders() }).catch(() => {});
    return { success: true };
  },

  // Notes
  async getNotes(courseId?: string, lessonId?: string): Promise<{ notes: Note[] }> {
    if (auth.currentUser) {
      try {
        const notes = await getNotesFromFirestore(auth.currentUser.uid, { courseId, lessonId });
        return { notes };
      } catch (err) {
        console.warn('[API getNotes] Firestore read failed, falling back:', err);
      }
    }
    const idbNotes = await persistenceEngine.getNotes(courseId);
    if (idbNotes.length > 0) {
      let filtered = idbNotes;
      if (lessonId) filtered = filtered.filter((n) => n.lessonId === lessonId);
      return { notes: filtered };
    }
    const db = getLocalDb();
    let notes = db.notes || [];
    if (courseId) notes = notes.filter((n: any) => n.courseId === courseId);
    if (lessonId) notes = notes.filter((n: any) => n.lessonId === lessonId);
    return { notes };
  },

  async createNote(data: {
    title: string;
    content: string;
    courseId?: string | null;
    lessonId?: string | null;
    tags?: string[];
    type?: 'general' | 'course' | 'lesson';
  }): Promise<{ note: Note }> {
    if (auth.currentUser) {
      try {
        let courseTitle: string | undefined;
        let lessonTitle: string | undefined;
        if (data.courseId) {
          const c = await persistenceEngine.getCourse(data.courseId);
          courseTitle = c?.title;
        }
        if (data.lessonId) {
          const l = await persistenceEngine.getLesson(data.lessonId);
          lessonTitle = l?.title;
        }

        const note = await createNoteInFirestore({ ...data, courseTitle, lessonTitle });
        createActivityInFirestore({
          type: 'note_created',
          title: `Created note "${note.title}"`,
          courseId: data.courseId || undefined,
          lessonId: data.lessonId || undefined,
        }).catch(() => {});
        fetch('/api/notes', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }).catch(() => {});
        return { note };
      } catch (err) {
        console.error('[API createNote] Firestore creation error:', err);
      }
    }

    const activeUid = getActiveUserProfileId() || 'local_user';
    const newNote: Note = {
      id: 'nt_' + Date.now(),
      userId: activeUid,
      title: data.title,
      content: data.content,
      courseId: data.courseId,
      lessonId: data.lessonId,
      tags: data.tags || [],
      type: data.type || (data.lessonId ? 'lesson' : data.courseId ? 'course' : 'general'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await persistenceEngine.saveNote(newNote);
    return { note: newNote };
  },

  async updateNote(id: string, data: Partial<Note>): Promise<{ note: Note }> {
    if (auth.currentUser) {
      try {
        const note = await updateNoteInFirestore(id, data);
        fetch(`/api/notes/${id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }).catch(() => {});
        return { note };
      } catch (err) {
        console.error('[API updateNote] Firestore update error:', err);
      }
    }

    const existing = (await persistenceEngine.getNotes()).find((n) => n.id === id);
    const updatedNote: Note = {
      ...(existing || {
        id,
        userId: getActiveUserProfileId() || 'local_user',
        title: '',
        content: '',
        tags: [],
        type: 'general',
        createdAt: new Date().toISOString(),
      }),
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await persistenceEngine.saveNote(updatedNote);
    return { note: updatedNote };
  },

  async deleteNote(id: string): Promise<{ success: boolean }> {
    if (auth.currentUser) {
      try {
        await deleteNoteInFirestore(id);
        fetch(`/api/notes/${id}`, { method: 'DELETE', headers: getAuthHeaders() }).catch(() => {});
        return { success: true };
      } catch (err) {
        console.error('[API deleteNote] Firestore deletion error:', err);
      }
    }
    await persistenceEngine.deleteNote(id);
    return { success: true };
  },

  // Key Terms
  async getTerms(courseId?: string): Promise<{ terms: KeyTermItem[] }> {
    if (auth.currentUser) {
      try {
        const terms = await getTermsFromFirestore(auth.currentUser.uid, courseId);
        return { terms };
      } catch (err) {
        console.warn('[API getTerms] Firestore read failed, falling back:', err);
      }
    }
    const idbTerms = await persistenceEngine.getTerms();
    if (idbTerms.length > 0) {
      return { terms: courseId ? idbTerms.filter((t) => t.courseId === courseId) : idbTerms };
    }
    const db = getLocalDb();
    let terms = db.terms || [];
    if (courseId) terms = terms.filter((t: any) => t.courseId === courseId);
    return { terms };
  },

  async createTerm(data: {
    term: string;
    definition: string;
    context?: string;
    relatedConcepts?: string[];
    courseId?: string;
    lessonId?: string;
    lessonTitle?: string;
  }): Promise<{ term: KeyTermItem }> {
    if (auth.currentUser) {
      try {
        const newTerm = await createTermInFirestore(data);
        fetch('/api/terms', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }).catch(() => {});
        return { term: newTerm };
      } catch (err) {
        console.error('[API createTerm] Firestore creation error:', err);
      }
    }
    const db = getLocalDb();
    const newTerm: KeyTermItem = {
      id: 'trm_' + Date.now(),
      term: data.term,
      definition: data.definition,
      context: data.context,
      relatedConcepts: data.relatedConcepts,
      courseId: data.courseId,
      lessonId: data.lessonId,
      lessonTitle: data.lessonTitle,
    };
    db.terms = [newTerm, ...(db.terms || [])];
    saveLocalDb(db);
    return { term: newTerm };
  },

  async deleteTerm(id: string): Promise<{ success: boolean }> {
    if (auth.currentUser) {
      try {
        await deleteTermInFirestore(id);
        fetch(`/api/terms/${id}`, { method: 'DELETE', headers: getAuthHeaders() }).catch(() => {});
        return { success: true };
      } catch (err) {
        console.error('[API deleteTerm] Firestore deletion error:', err);
      }
    }
    const db = getLocalDb();
    db.terms = (db.terms || []).filter((t: any) => t.id !== id);
    saveLocalDb(db);
    return { success: true };
  },

  // Quizzes & Activities
  async submitQuizAttempt(data: {
    lessonId: string;
    score: number;
    totalQuestions: number;
    answers: Record<string, string>;
  }): Promise<{ attempt: any }> {
    if (auth.currentUser) {
      try {
        const attempt = await recordQuizAttemptInFirestore(data);
        const cached = await persistenceEngine.getLesson(data.lessonId);
        if (cached?.courseId) {
          const pct = Math.round((data.score / (data.totalQuestions || 1)) * 100);
          await updateLessonInFirestore(cached.courseId, data.lessonId, { quizScore: pct });
          await createActivityInFirestore({
            type: 'quiz_taken',
            title: `Scored ${data.score}/${data.totalQuestions} on quiz for "${cached.title}"`,
            courseId: cached.courseId,
            lessonId: data.lessonId,
          });
        }
        fetch('/api/quizzes/attempt', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }).catch(() => {});
        return { attempt };
      } catch (err) {
        console.error('[API submitQuizAttempt] Firestore submission error:', err);
      }
    }

    try {
      const res = await fetch('/api/quizzes/attempt', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return {
      attempt: {
        id: 'att_' + Date.now(),
        ...data,
        timestamp: new Date().toISOString(),
      },
    };
  },

  async getActivities(): Promise<{ activities: ActivityItem[] }> {
    if (auth.currentUser) {
      try {
        const activities = await getActivitiesFromFirestore(auth.currentUser.uid, 20);
        return { activities };
      } catch (err) {
        console.warn('[API getActivities] Firestore read failed, falling back:', err);
      }
    }
    const idbActs = await persistenceEngine.getStudyActivities();
    if (idbActs.length > 0) return { activities: idbActs };
    const db = getLocalDb();
    return { activities: db.activities || [] };
  },

  async getMaterials(): Promise<{ materials: MaterialHistoryItem[] }> {
    if (auth.currentUser) {
      try {
        const materials = await getMaterialsFromFirestore(auth.currentUser.uid);
        return { materials };
      } catch (err) {
        console.warn('[API getMaterials] Firestore read failed, falling back:', err);
      }
    }
    try {
      const res = await fetch('/api/materials', { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return { materials: [] };
  },

  async createMaterial(data: {
    title: string;
    rawSnippet: string;
    type?: 'transcript' | 'article' | 'screenshot' | 'notes' | 'document';
    courseId?: string;
    courseTitle?: string;
    lessonId?: string;
    lessonTitle?: string;
    status?: 'raw' | 'structured';
  }): Promise<{ material: MaterialHistoryItem }> {
    if (auth.currentUser) {
      try {
        const material = await createMaterialInFirestore(data);
        fetch('/api/materials', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        }).catch(() => {});
        return { material };
      } catch (err) {
        console.error('[API createMaterial] Firestore creation error:', err);
      }
    }
    const item: MaterialHistoryItem = {
      id: 'mat_' + Date.now(),
      userId: auth.currentUser?.uid || 'offline_user',
      title: data.title,
      rawSnippet: data.rawSnippet,
      type: data.type || 'notes',
      courseId: data.courseId,
      courseTitle: data.courseTitle,
      lessonId: data.lessonId,
      lessonTitle: data.lessonTitle,
      status: data.status || 'raw',
      createdAt: new Date().toISOString(),
    };
    return { material: item };
  },

  // Run Idempotent Phase 2B Migration
  async runPhase2BMigration(): Promise<any> {
    if (!auth.currentUser) throw new Error('Authentication required for Phase 2B migration.');
    const res = await fetch('/api/migrate/phase2b-data', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to retrieve migration data from server.');
    const dbJson = await res.json();
    return await migratePhase2BLearningData(dbJson, auth.currentUser.uid);
  },

  // Global Search
  async search(query: string): Promise<{ results: SearchResultItem[] }> {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const q = query.toLowerCase().trim();
    if (!q) return { results: [] };
    const results: SearchResultItem[] = [];

    // Search courses
    db.courses?.forEach((c: any) => {
      if (c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) {
        results.push({
          id: c.id,
          type: 'course',
          title: c.title,
          snippet: c.description || 'Course',
          courseId: c.id,
        });
      }
    });

    // Search lessons
    db.lessons?.forEach((l: any) => {
      if (l.title?.toLowerCase().includes(q) || l.structuredContent?.overview?.toLowerCase().includes(q)) {
        results.push({
          id: l.id,
          type: 'lesson',
          title: l.title,
          snippet: l.structuredContent?.overview || 'Lesson',
          courseId: l.courseId,
          lessonId: l.id,
        });
      }
    });

    // Search terms
    db.terms?.forEach((t: any) => {
      if (t.term?.toLowerCase().includes(q) || t.definition?.toLowerCase().includes(q)) {
        results.push({
          id: t.id,
          type: 'term',
          title: t.term,
          snippet: t.definition,
          courseId: t.courseId,
        });
      }
    });

    // Search notes
    const idbNotes = await persistenceEngine.getNotes();
    idbNotes.forEach((n) => {
      if (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
        results.push({
          id: n.id,
          type: 'note',
          title: n.title,
          snippet: n.content.slice(0, 100),
          courseId: n.courseId || undefined,
          lessonId: n.lessonId || undefined,
        });
      }
    });

    return { results };
  },

  // AI Services
  async structureMaterial(data: {
    rawContent?: string;
    contentType?: string;
    courseTitle?: string;
    customInstructions?: string;
    imageBase64?: string;
    mimeType?: string;
  }): Promise<{ structured: StructuredContent }> {
    try {
      const res = await fetch('/api/ai/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    // Local client fallback parser for offline/static deployment
    const raw = data.rawContent || 'Imported study material';
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    return {
      structured: {
        title: lines[0]?.slice(0, 60) || 'Study Notes',
        overview: raw.slice(0, 240) + '...',
        learningObjectives: [
          'Understand core concepts from uploaded material',
          'Review extracted key points and applications',
        ],
        mainConcepts: [
          {
            id: 'mc_1',
            title: 'Key Concepts & Findings',
            explanation: raw.slice(0, 500),
            subtopics: [],
          },
        ],
        examples: [],
        importantDistinctions: [],
        keyTerms: [
          {
            term: lines[0]?.slice(0, 30) || 'Core Subject',
            definition: 'Key concept identified in raw study material.',
          },
        ],
        keyTakeaways: [
          'Material structured and added to personal knowledge base.',
          'Ready for lesson review, notes, and retention practice.',
        ],
        reviewQuestions: [],
      },
    };
  },

  async askTutor(data: {
    question: string;
    lessonId?: string;
    lessonContext: any;
    courseContext?: string;
    originalMaterial?: string;
  }): Promise<{ answer: string; groundedInSource?: boolean }> {
    try {
      const url = data.lessonId ? `/api/lessons/${data.lessonId}/tutor` : '/api/ai/tutor';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return {
      answer: `Regarding "${data.question}": Based on the study material for ${data.lessonContext?.title || 'this lesson'}, focus on the primary definition and underlying structural principles. (Note: Full live Gemini generation requires the backend server with GEMINI_API_KEY).`,
      groundedInSource: true,
    };
  },

  async askAssistantChat(data: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    activeLesson?: any;
    activeCourse?: any;
    notes?: any[];
    terms?: any[];
  }): Promise<{
    answer: string;
    matchedNotes?: Array<{ id: string; title: string }>;
    matchedTerms?: Array<{ id: string; term: string }>;
  }> {
    try {
      const res = await fetch('/api/ai/assistant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to get answer from AI Assistant.');
    } catch (err: any) {
      console.warn('[API askAssistantChat error]', err);
      // Client-side fallback if server is unreachable
      const lastQ = data.messages[data.messages.length - 1]?.content || '';
      const matchingNotes = (data.notes || []).filter((n) =>
        n.title.toLowerCase().includes(lastQ.toLowerCase()) ||
        n.content.toLowerCase().includes(lastQ.toLowerCase())
      );
      const matchingTerms = (data.terms || []).filter((t) =>
        t.term.toLowerCase().includes(lastQ.toLowerCase()) ||
        t.definition.toLowerCase().includes(lastQ.toLowerCase())
      );

      let fallbackText = `I reviewed your query about **"${lastQ}"**.\n\n`;
      if (data.activeLesson) {
        fallbackText += `*Active Lesson:* **${data.activeLesson.title}**\n\n`;
      }
      if (matchingTerms.length > 0) {
        fallbackText += `📚 **Matching Glossary Terms found in your collection:**\n` +
          matchingTerms.map((t) => `- **${t.term}**: ${t.definition}`).join('\n') + '\n\n';
      }
      if (matchingNotes.length > 0) {
        fallbackText += `📝 **Matching Stored Notes found in your collection:**\n` +
          matchingNotes.map((n) => `- **${n.title}**: ${n.content.slice(0, 150)}...`).join('\n') + '\n\n';
      }
      if (matchingTerms.length === 0 && matchingNotes.length === 0) {
        fallbackText += `I searched your saved notes and glossaries, but no direct keyword match was found. You can add new notes or glossary terms to help me answer more deeply.`;
      }
      return {
        answer: fallbackText,
        matchedNotes: matchingNotes.map((n) => ({ id: n.id, title: n.title })),
        matchedTerms: matchingTerms.map((t) => ({ id: t.id, term: t.term })),
      };
    }
  },

  async generateQuiz(data: {
    lessonTitle: string;
    overview: string;
    mainConcepts: any[];
    keyTerms?: any[];
  }): Promise<{ questions: any[] }> {
    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return {
      questions: [
        {
          id: 'q_gen_1',
          question: `What is the primary focus of "${data.lessonTitle}"?`,
          type: 'multiple_choice',
          options: [
            data.overview?.slice(0, 80) || 'Understanding the primary core concepts',
            'Random speculation without structural rules',
            'Ignoring macro trend direction',
            'None of the above',
          ],
          answer: data.overview?.slice(0, 80) || 'Understanding the primary core concepts',
          explanation: 'The overview defines the fundamental goal of this lesson.',
        },
      ],
    };
  },

  async discoverSubtopics(topic: string): Promise<{ subtopics: any[] }> {
    const res = await fetch('/api/ai/subtopics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to discover subtopics');
    return data;
  },

  async generateCoursePlan(data: {
    topic: string;
    subtopics: string[];
    depth: 'quick' | 'standard' | 'deep';
    dailyMinutes: number;
    dailyMinutesRange: string;
  }): Promise<{ plan: any }> {
    const res = await fetch('/api/ai/course-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to generate course plan');
    return result;
  },

  async createCourseFromPlan(payload: any): Promise<{ course: any; lessons: any[]; firstLessonId?: string }> {
    const res = await fetch('/api/courses/create-from-plan', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create course from plan');

    if (auth.currentUser && data.course) {
      // Authoritatively persist full course and all planned lessons to Cloud Firestore
      const fsResult = await createCourseWithLessonsInFirestore(data.course, data.lessons || []);
      return {
        course: fsResult.course,
        lessons: fsResult.lessons,
        firstLessonId: fsResult.lessons[0]?.id || data.firstLessonId,
      };
    }

    if (data.course) {
      await persistenceEngine.saveCourse(data.course);
    }
    if (Array.isArray(data.lessons) && data.lessons.length > 0) {
      await persistenceEngine.saveLessons(data.lessons);
    }
    return data;
  },

  async updateLessonProgress(
    lessonId: string,
    data: {
      isCompleted?: boolean;
      quizScore?: number;
      scrollY?: number;
      sectionId?: string;
      userNotes?: string;
      dayNumber?: number;
    }
  ): Promise<{ success: boolean; lesson: any }> {
    if (auth.currentUser) {
      try {
        const cached = await persistenceEngine.getLesson(lessonId);
        if (cached?.courseId) {
          await updateLessonInFirestore(cached.courseId, lessonId, data);
        }
      } catch (fsErr) {
        console.warn('[API updateLessonProgress] Firestore update note:', fsErr);
      }
    }

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Device is offline');
      }
      const res = await fetch(`/api/lessons/${lessonId}/progress`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok && result.lesson) {
        await persistenceEngine.saveLesson(result.lesson);
        return result;
      }
    } catch (err) {
      console.warn('[UPDATE LESSON PROGRESS OFFLINE QUEUE]', err);
      await syncEngine.enqueue('progress_update', { lessonId, ...data });
    }
    const cached = await persistenceEngine.getLesson(lessonId);
    if (cached) {
      const merged = { ...cached, ...data };
      await persistenceEngine.saveLesson(merged);
      return { success: true, lesson: merged };
    }
    return { success: false, lesson: null };
  },

  async importUserData(payload: any): Promise<{ success: boolean; imported?: any }> {
    try {
      const res = await fetch('/api/user/import-data', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const result = await res.json();
        await persistenceEngine.importAllData(payload);
        return result;
      }
    } catch {}
    return await persistenceEngine.importAllData(payload);
  },

  async passDayCheckin(
    courseId: string,
    dayNumber: number,
    score: number,
    totalQuestions: number
  ): Promise<{ success: boolean; course: any; lessons: any[]; unlockedDay: number; unlockedCount: number }> {
    const res = await fetch(`/api/courses/${courseId}/pass-day-checkin`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ dayNumber, score, totalQuestions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to pass day milestone check-in');

    if (auth.currentUser && data.course) {
      try {
        await updateCourseInFirestore(courseId, data.course);
        if (Array.isArray(data.lessons)) {
          for (const l of data.lessons) {
            await updateLessonInFirestore(courseId, l.id, l);
          }
        }
      } catch (fsErr) {
        console.warn('[API passDayCheckin] Firestore sync note:', fsErr);
      }
    }

    return data;
  },

  async passFinalExam(
    courseId: string,
    score: number,
    totalQuestions: number
  ): Promise<{ success: boolean; course: any; certificate: any }> {
    const res = await fetch(`/api/courses/${courseId}/pass-final-exam`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ score, totalQuestions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to record final exam completion');

    if (auth.currentUser && data.course) {
      try {
        await updateCourseInFirestore(courseId, data.course);
      } catch (fsErr) {
        console.warn('[API passFinalExam] Firestore sync note:', fsErr);
      }
    }

    if (data.certificate) {
      await persistenceEngine.saveCertificates([data.certificate]).catch(() => {});
    }

    return data;
  },

  async suggestTopics(query: string): Promise<{ suggestions: string[] }> {
    try {
      const res = await fetch('/api/topics/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) return { suggestions: [] };
      return data;
    } catch {
      return { suggestions: [] };
    }
  },

  async saveReadingPosition(
    lessonId: string,
    data: { scrollY: number; sectionId?: string; dayNumber?: number }
  ): Promise<{ success: boolean; readingPosition: any }> {
    // 1. Instant local IndexedDB commit
    try {
      const cached = await persistenceEngine.getLesson(lessonId);
      if (cached) {
        const readingPos = {
          scrollY: data.scrollY,
          sectionId: data.sectionId,
          dayNumber: data.dayNumber || cached.dayNumber || 1,
          updatedAt: new Date().toISOString(),
        };
        await persistenceEngine.saveLesson({
          ...cached,
          scrollOffsetPosition: data.scrollY,
          readingPosition: readingPos,
        });

        if (auth.currentUser && cached.courseId) {
          updateLessonInFirestore(cached.courseId, lessonId, {
            scrollOffsetPosition: data.scrollY,
            readingPosition: readingPos,
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[Persistence] Local reading position save warning:', e);
    }

    try {
      const res = await fetch(`/api/lessons/${lessonId}/reading-position`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok && result.lesson) {
        await persistenceEngine.saveLesson(result.lesson);
      }
      return result;
    } catch (err: any) {
      console.warn('[SAVE READING POSITION OFFLINE QUEUE]', err);
      await syncEngine.enqueue('reading_position', { lessonId, ...data });
      return { success: true, readingPosition: { scrollY: data.scrollY } };
    }
  },

  async searchEducationalImages(query: string): Promise<{ images: any[] }> {
    const res = await fetch(`/api/media/search-images?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) return { images: [] };
    return data;
  },

  async transcribeAudio(data: {
    audioBase64: string;
    mimeType?: string;
    mode?: 'voice_note' | 'capture_lesson';
    promptHint?: string;
  }): Promise<{ transcript: string; wordCount: number; durationSecondsEstimate?: number; provider: string }> {
    const res = await fetch('/api/audio/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Audio transcription failed');
    return result;
  },

  // Certificates & Completions
  async getCertificates(): Promise<{ certificates: Certificate[]; combinedCertificates: CombinedCertificate[] }> {
    const currentUid = auth.currentUser?.uid;
    if (currentUid) {
      try {
        const [firestoreCerts, firestoreCombined] = await Promise.all([
          getCertificatesFromFirestore(currentUid).catch(() => [] as Certificate[]),
          getCombinedCertificatesFromFirestore(currentUid).catch(() => [] as CombinedCertificate[]),
        ]);

        if (firestoreCerts.length > 0 || firestoreCombined.length > 0) {
          return {
            certificates: firestoreCerts,
            combinedCertificates: firestoreCombined,
          };
        }

        // If Firestore is empty, check server and run idempotent migration
        const res = await fetch('/api/certificates', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const serverCerts = Array.isArray(data.certificates) ? data.certificates : [];
          const serverCombined = Array.isArray(data.combinedCertificates) ? data.combinedCertificates : [];

          if (serverCerts.length > 0 || serverCombined.length > 0) {
            await migrateCertificatesToFirestore(currentUid, serverCerts, serverCombined).catch(() => {});
            const [syncedCerts, syncedCombined] = await Promise.all([
              getCertificatesFromFirestore(currentUid).catch(() => serverCerts),
              getCombinedCertificatesFromFirestore(currentUid).catch(() => serverCombined),
            ]);
            return {
              certificates: syncedCerts,
              combinedCertificates: syncedCombined,
            };
          }
          return { certificates: [], combinedCertificates: [] };
        }
      } catch (err) {
        console.warn('[API getCertificates] Firestore read failed, checking offline cache:', err);
      }
    }

    // Offline / fallback to IndexedDB
    const [idbCerts, idbCombined] = await Promise.all([
      persistenceEngine.getCertificates().catch(() => []),
      persistenceEngine.getCombinedCertificates().catch(() => []),
    ]);
    return { certificates: idbCerts, combinedCertificates: idbCombined };
  },

  async generateCertificate(courseId: string): Promise<{ certificate: Certificate; isExisting: boolean }> {
    const res = await fetch('/api/certificates/generate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ courseId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate certificate');

    if (data.certificate) {
      await persistenceEngine.saveCertificates([data.certificate]).catch(() => {});
    }

    return data;
  },

  async generateCombinedCertificate(certificateIds: string[]): Promise<{ combinedCertificate: CombinedCertificate }> {
    const res = await fetch('/api/certificates/combined', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ certificateIds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate combined certificate');

    if (data.combinedCertificate) {
      await persistenceEngine.saveCombinedCertificates([data.combinedCertificate]).catch(() => {});
    }

    return data;
  },

  async verifyCertificate(certId: string): Promise<any> {
    const res = await fetch(`/api/certificates/verify/${encodeURIComponent(certId)}`);
    return await res.json();
  },

  // Community & Learning Circles (Authoritative Cloud Firestore)
  async getCircles(): Promise<{ circles: Circle[] }> {
    try {
      const circles = await getCirclesFromFirestore(auth.currentUser?.uid);
      if (Array.isArray(circles) && circles.length > 0) {
        return { circles };
      }
    } catch (err) {
      console.warn('[API getCircles] Firestore read failed:', err);
    }
    // Auto-migrate if circles are empty and user is authenticated
    if (auth.currentUser) {
      try {
        await api.runCommunityMigration();
        const postMigrate = await getCirclesFromFirestore(auth.currentUser.uid);
        if (postMigrate && postMigrate.length > 0) return { circles: postMigrate };
      } catch {}
    }
    try {
      const res = await fetch('/api/community/circles', { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return { circles: [] };
  },

  async createCircle(data: { name: string; description: string; topic: string }): Promise<{ circle: Circle }> {
    if (auth.currentUser) {
      const circle = await createCircleInFirestore(data);
      fetch('/api/community/circles', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).catch(() => {});
      return { circle };
    }
    const res = await fetch('/api/community/circles', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create circle');
    return result;
  },

  async joinCircle(id: string): Promise<void> {
    if (auth.currentUser) {
      await joinCircleInFirestore(id, auth.currentUser.uid);
      fetch(`/api/community/circles/${id}/join`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
      return;
    }
    await fetch(`/api/community/circles/${id}/join`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  async leaveCircle(id: string): Promise<void> {
    if (auth.currentUser) {
      await leaveCircleInFirestore(id, auth.currentUser.uid);
      fetch(`/api/community/circles/${id}/leave`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
      return;
    }
    await fetch(`/api/community/circles/${id}/leave`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  async getDiscussions(circleId?: string): Promise<{ discussions: Discussion[] }> {
    try {
      const discussions = await getDiscussionsFromFirestore(circleId);
      if (Array.isArray(discussions) && (discussions.length > 0 || circleId)) {
        return { discussions };
      }
    } catch (err) {
      console.warn('[API getDiscussions] Firestore read failed:', err);
    }
    if (auth.currentUser && !circleId) {
      try {
        await api.runCommunityMigration();
        const postMigrate = await getDiscussionsFromFirestore();
        if (postMigrate && postMigrate.length > 0) return { discussions: postMigrate };
      } catch {}
    }
    try {
      const url = circleId ? `/api/community/discussions?circleId=${encodeURIComponent(circleId)}` : '/api/community/discussions';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return { discussions: [] };
  },

  async createDiscussion(data: {
    title: string;
    content: string;
    type: 'question' | 'discussion' | 'insight';
    circleId?: string;
    circleName?: string;
  }): Promise<{ discussion: Discussion }> {
    if (auth.currentUser) {
      const discussion = await createDiscussionInFirestore(data);
      fetch('/api/community/discussions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).catch(() => {});
      return { discussion };
    }
    const res = await fetch('/api/community/discussions', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create discussion');
    return result;
  },

  async addDiscussionReply(discussionId: string, content: string): Promise<{ reply: DiscussionReply }> {
    if (auth.currentUser) {
      const reply = await addDiscussionReplyInFirestore({
        discussionId,
        content,
      });
      fetch(`/api/community/discussions/${discussionId}/replies`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content }),
      }).catch(() => {});
      return { reply };
    }
    const res = await fetch(`/api/community/discussions/${discussionId}/replies`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to post reply');
    return result;
  },

  async deleteDiscussion(id: string): Promise<void> {
    if (auth.currentUser) {
      await deleteDiscussionInFirestore(id, auth.currentUser.uid);
      fetch(`/api/community/discussions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }).catch(() => {});
      return;
    }
    const res = await fetch(`/api/community/discussions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete discussion');
    }
  },

  async getStudyRooms(): Promise<{ rooms: StudyRoom[] }> {
    try {
      const rooms = await getStudyRoomsFromFirestore(auth.currentUser?.uid);
      if (Array.isArray(rooms) && rooms.length > 0) {
        return { rooms };
      }
    } catch (err) {
      console.warn('[API getStudyRooms] Firestore read failed:', err);
    }
    try {
      const res = await fetch('/api/community/rooms', { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return { rooms: [] };
  },

  async createStudyRoom(data: {
    name: string;
    topic: string;
    description?: string;
    studyGoal?: string;
    sessionTime?: string;
  }): Promise<{ room: StudyRoom }> {
    if (auth.currentUser) {
      const room = await createStudyRoomInFirestore(data);
      fetch('/api/community/rooms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).catch(() => {});
      return { room };
    }
    const res = await fetch('/api/community/rooms', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create study room');
    return result;
  },

  async joinStudyRoom(roomId: string): Promise<void> {
    if (auth.currentUser) {
      await joinStudyRoomInFirestore(roomId, auth.currentUser.uid);
      fetch(`/api/community/rooms/${roomId}/join`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
      return;
    }
    await fetch(`/api/community/rooms/${roomId}/join`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  async leaveStudyRoom(roomId: string): Promise<void> {
    if (auth.currentUser) {
      await leaveStudyRoomInFirestore(roomId, auth.currentUser.uid);
      fetch(`/api/community/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: getAuthHeaders(),
      }).catch(() => {});
      return;
    }
    await fetch(`/api/community/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  async runCommunityMigration(): Promise<any> {
    if (!auth.currentUser) return { status: 'unauthenticated' };
    const res = await fetch('/api/migrate/community-data', { headers: getAuthHeaders() });
    if (!res.ok) return { status: 'failed_fetch' };
    const legacy = await res.json();
    return await migrateCommunityToFirestore(legacy);
  },

  async runCoursesMigration(): Promise<Course[]> {
    if (!auth.currentUser) return [];
    try {
      const res = await fetch('/api/migrate/courses-data', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      const legacyCourses: Course[] = data.courses || [];
      const legacyLessons: Lesson[] = data.lessons || [];

      if (legacyCourses.length === 0) return [];

      const currentUid = auth.currentUser.uid;
      const migrated: Course[] = [];

      for (const crs of legacyCourses) {
        try {
          const courseRef = doc(db, 'courses', crs.id);
          const cSnap = await getDoc(courseRef);
          if (!cSnap.exists()) {
            const courseLessons = legacyLessons.filter((l) => l.courseId === crs.id);
            const result = await createCourseWithLessonsInFirestore(
              { ...crs, userId: currentUid },
              courseLessons.map((l) => ({ ...l, userId: currentUid }))
            );
            migrated.push(result.course);
          } else {
            const courseLessons = legacyLessons.filter((l) => l.courseId === crs.id);
            for (const l of courseLessons) {
              const lRef = doc(db, 'courses', crs.id, 'lessons', l.id);
              const lSnap = await getDoc(lRef);
              if (!lSnap.exists()) {
                await createLessonInFirestore(crs.id, { ...l, userId: currentUid }).catch(() => {});
              }
            }
          }
        } catch (mErr) {
          console.warn(`[Courses Migration] Note for course ${crs.id}:`, mErr);
        }
      }

      return migrated;
    } catch (err) {
      console.warn('[Courses Migration] Error during legacy courses migration:', err);
      return [];
    }
  },

  async getTodaysQuestion(): Promise<{ question: any }> {
    try {
      const res = await fetch('/api/community/todays-question');
      if (res.ok) return await res.json();
    } catch {}
    return {
      question: {
        id: 'tq_default',
        question: 'What is one concept you struggled to grasp initially, and what was the mental model that finally unlocked it for you?',
        topic: 'Cognitive Models',
        author: 'Mindly Editorial',
        responsesCount: 38,
      },
    };
  },

  async getLearnerProfile(username: string): Promise<{ profile: LearnerProfile }> {
    const res = await fetch(`/api/community/profile/${encodeURIComponent(username)}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Learner profile not found');
    return data;
  },

  async updateCommunityProfile(data: {
    bio?: string;
    interests?: string[];
    privacySettings?: PrivacySettings;
  }): Promise<{ user: User }> {
    const res = await fetch('/api/community/profile', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update profile');
    return result;
  },
};
