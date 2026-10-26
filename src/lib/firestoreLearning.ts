/**
 * Mindly Firestore Learning Data Services — Phase 2B
 * Direct Cloud Firestore persistence for Notes, Key Terms, Materials, Study Sessions,
 * Study Activity, and Quiz Attempts.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  Note,
  KeyTermItem,
  MaterialHistoryItem,
  StudyProgress,
  ActivityItem,
  QuizAttempt,
} from '../types';
import { persistenceEngine } from './persistence';

/**
 * Strips undefined properties recursively so Firestore does not reject payloads.
 */
function cleanPayload<T>(val: T): T {
  if (val === undefined) return undefined as any;
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof Date) return val as any;
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => cleanPayload(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      cleaned[k] = cleanPayload(v);
    }
  }
  return cleaned as any;
}

// ==========================================
// 1. NOTES SERVICE
// ==========================================

export async function getNotesFromFirestore(
  userId: string,
  filters?: { courseId?: string; lessonId?: string }
): Promise<Note[]> {
  if (!userId) return [];

  try {
    const notesRef = collection(db, 'notes');
    let q = query(notesRef, where('userId', '==', userId));

    const snap = await getDocs(q);
    let notes: Note[] = [];

    snap.forEach((d) => {
      notes.push({ ...d.data(), id: d.id } as Note);
    });

    if (filters?.courseId) {
      notes = notes.filter((n) => n.courseId === filters.courseId);
    }
    if (filters?.lessonId) {
      notes = notes.filter((n) => n.lessonId === filters.lessonId);
    }

    notes.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    // Sync to persistenceEngine
    for (const note of notes) {
      await persistenceEngine.saveNote(note).catch(() => {});
    }

    return notes;
  } catch (err) {
    console.error('[Firestore] getNotesFromFirestore error:', err);
    throw err;
  }
}

export async function createNoteInFirestore(noteData: Partial<Note>): Promise<Note> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create note.');
  }

  const now = new Date().toISOString();
  const noteId = noteData.id || `not_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newNote: Note = cleanPayload({
    id: noteId,
    userId: currentUid,
    title: noteData.title?.trim() || 'Untitled Note',
    content: noteData.content || '',
    courseId: noteData.courseId || null,
    lessonId: noteData.lessonId || null,
    courseTitle: noteData.courseTitle,
    lessonTitle: noteData.lessonTitle,
    tags: Array.isArray(noteData.tags) ? noteData.tags : [],
    type: noteData.type || (noteData.lessonId ? 'lesson' : noteData.courseId ? 'course' : 'general'),
    createdAt: noteData.createdAt || now,
    updatedAt: now,
  });

  const noteDocRef = doc(db, 'notes', noteId);
  await setDoc(noteDocRef, newNote);

  await persistenceEngine.saveNote(newNote).catch(() => {});
  return newNote;
}

export async function updateNoteInFirestore(noteId: string, updates: Partial<Note>): Promise<Note> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to update note.');
  }

  const noteDocRef = doc(db, 'notes', noteId);
  const now = new Date().toISOString();

  const cleanedUpdates = cleanPayload({
    ...updates,
    updatedAt: now,
  });
  delete (cleanedUpdates as any).userId;
  delete (cleanedUpdates as any).id;

  await updateDoc(noteDocRef, cleanedUpdates);

  const snap = await getDoc(noteDocRef);
  const updated = { ...snap.data(), id: noteId } as Note;

  await persistenceEngine.saveNote(updated).catch(() => {});
  return updated;
}

export async function deleteNoteInFirestore(noteId: string): Promise<boolean> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to delete note.');
  }

  const noteDocRef = doc(db, 'notes', noteId);
  await deleteDoc(noteDocRef);

  await persistenceEngine.deleteNote(noteId).catch(() => {});
  return true;
}

// ==========================================
// 2. KEY TERMS SERVICE
// ==========================================

export async function getTermsFromFirestore(userId: string, courseId?: string): Promise<KeyTermItem[]> {
  if (!userId) return [];

  try {
    const termsRef = collection(db, 'terms');
    const q = query(termsRef, where('userId', '==', userId));
    const snap = await getDocs(q);

    let terms: KeyTermItem[] = [];
    snap.forEach((d) => {
      terms.push({ ...d.data(), id: d.id } as KeyTermItem);
    });

    if (courseId) {
      terms = terms.filter((t) => t.courseId === courseId);
    }

    terms.sort((a, b) => a.term.localeCompare(b.term));

    // Cache in IDB
    for (const term of terms) {
      await persistenceEngine.saveTerm(term).catch(() => {});
    }

    return terms;
  } catch (err) {
    console.error('[Firestore] getTermsFromFirestore error:', err);
    throw err;
  }
}

export async function createTermInFirestore(termData: Partial<KeyTermItem>): Promise<KeyTermItem> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create term.');
  }

  const termId = termData.id || `trm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newTerm: KeyTermItem & { userId: string; createdAt: string; updatedAt: string } = cleanPayload({
    id: termId,
    userId: currentUid,
    term: termData.term?.trim() || 'Untitled Term',
    definition: termData.definition?.trim() || '',
    context: termData.context || 'User defined',
    relatedConcepts: Array.isArray(termData.relatedConcepts) ? termData.relatedConcepts : [],
    courseId: termData.courseId,
    lessonId: termData.lessonId,
    lessonTitle: termData.lessonTitle,
    createdAt: now,
    updatedAt: now,
  });

  const termDocRef = doc(db, 'terms', termId);
  await setDoc(termDocRef, newTerm);

  await persistenceEngine.saveTerm(newTerm).catch(() => {});
  return newTerm;
}

export async function deleteTermInFirestore(termId: string): Promise<boolean> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to delete term.');
  }

  const termDocRef = doc(db, 'terms', termId);
  await deleteDoc(termDocRef);

  await persistenceEngine.deleteTerm(termId).catch(() => {});
  return true;
}

// ==========================================
// 3. MATERIALS SERVICE
// ==========================================

export async function getMaterialsFromFirestore(userId: string): Promise<MaterialHistoryItem[]> {
  if (!userId) return [];

  try {
    const matRef = collection(db, 'materials');
    const q = query(matRef, where('userId', '==', userId));
    const snap = await getDocs(q);

    const materials: MaterialHistoryItem[] = [];
    snap.forEach((d) => {
      materials.push({ ...d.data(), id: d.id } as MaterialHistoryItem);
    });

    materials.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return materials;
  } catch (err) {
    console.error('[Firestore] getMaterialsFromFirestore error:', err);
    throw err;
  }
}

export async function createMaterialInFirestore(
  matData: Partial<MaterialHistoryItem>
): Promise<MaterialHistoryItem> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to save material.');
  }

  const matId = matData.id || `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newMaterial: MaterialHistoryItem = cleanPayload({
    id: matId,
    userId: currentUid,
    title: matData.title?.trim() || 'Learning Dump',
    rawSnippet: matData.rawSnippet || '',
    type: matData.type || 'notes',
    courseId: matData.courseId,
    courseTitle: matData.courseTitle,
    lessonId: matData.lessonId,
    lessonTitle: matData.lessonTitle,
    status: matData.status || 'raw',
    createdAt: matData.createdAt || now,
  });

  const matDocRef = doc(db, 'materials', matId);
  await setDoc(matDocRef, newMaterial);

  return newMaterial;
}

// ==========================================
// 4. STUDY SESSIONS & PROGRESS SERVICE
// ==========================================

export interface StudySessionRecord {
  id: string;
  userId: string;
  lessonId?: string;
  lessonTitle?: string;
  seconds: number;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO
}

export async function logStudySessionInFirestore(sessionData: {
  seconds: number;
  lessonId?: string;
  lessonTitle?: string;
}): Promise<{ session: StudySessionRecord; progress: StudyProgress }> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to log study session.');
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const sessionId = `ss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newSession: StudySessionRecord = cleanPayload({
    id: sessionId,
    userId: currentUid,
    lessonId: sessionData.lessonId,
    lessonTitle: sessionData.lessonTitle,
    seconds: sessionData.seconds,
    date: todayStr,
    timestamp: now.toISOString(),
  });

  const sessionDocRef = doc(db, 'studySessions', sessionId);
  await setDoc(sessionDocRef, newSession);

  // Update user's aggregate todayStudySeconds on profile
  try {
    const userDocRef = doc(db, 'users', currentUid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const currentSeconds = uData.todayStudySeconds || 0;
      await updateDoc(userDocRef, {
        todayStudySeconds: currentSeconds + sessionData.seconds,
        updatedAt: now.toISOString(),
      });
    }
  } catch (uErr) {
    console.warn('[Firestore] Profile study seconds update warning:', uErr);
  }

  // Calculate live progress
  const progress = await getStudyProgressFromFirestore(currentUid);
  return { session: newSession, progress };
}

export async function updateStudyGoalInFirestore(userId: string, goalMinutes: number): Promise<void> {
  if (!userId) return;
  const userDocRef = doc(db, 'users', userId);
  await updateDoc(userDocRef, {
    dailyStudyGoalMinutes: goalMinutes,
    updatedAt: new Date().toISOString(),
  });
}

export async function getStudySessionsFromFirestore(userId: string): Promise<StudySessionRecord[]> {
  if (!userId) return [];

  try {
    const sessionsRef = collection(db, 'studySessions');
    const q = query(sessionsRef, where('userId', '==', userId));
    const snap = await getDocs(q);

    const sessions: StudySessionRecord[] = [];
    snap.forEach((d) => {
      sessions.push({ ...d.data(), id: d.id } as StudySessionRecord);
    });

    sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return sessions;
  } catch (err) {
    console.error('[Firestore] getStudySessionsFromFirestore error:', err);
    throw err;
  }
}

export async function getStudyProgressFromFirestore(
  userId: string,
  customDailyGoal?: number
): Promise<StudyProgress> {
  const goalMinutes = customDailyGoal || 30;

  try {
    const userSessions = await getStudySessionsFromFirestore(userId);
    const todayStr = new Date().toISOString().split('T')[0];

    const todaySessions = userSessions.filter((s) => s.date === todayStr);
    const todaySeconds = todaySessions.reduce((sum, s) => sum + (s.seconds || 0), 0);
    const todayMinutes = Number((todaySeconds / 60).toFixed(1));

    // Calculate daily streak
    const uniqueDates = Array.from(new Set(userSessions.map((s) => s.date))).sort().reverse();
    let streakDays = 0;
    let checkDate = new Date();

    const hasToday = uniqueDates.includes(todayStr);
    if (hasToday) {
      streakDays = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    for (let i = hasToday ? 1 : 0; i < 365; i++) {
      const dStr = checkDate.toISOString().split('T')[0];
      if (uniqueDates.includes(dStr)) {
        streakDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    const progressPercent = Math.min(100, Math.round((todayMinutes / goalMinutes) * 100));

    return {
      dailyGoalMinutes: goalMinutes,
      todaySeconds,
      todayMinutes,
      progressPercent,
      streakDays,
      longestStreakDays: Math.max(streakDays, uniqueDates.length > 0 ? streakDays : 0),
      hasActivityToday: hasToday,
      totalActiveDays: uniqueDates.length,
      remainingMinutes: Math.max(0, Number((goalMinutes - todayMinutes).toFixed(1))),
      isGoalReached: todayMinutes >= goalMinutes,
    };
  } catch (err) {
    console.error('[Firestore] getStudyProgressFromFirestore error:', err);
    return {
      dailyGoalMinutes: goalMinutes,
      todaySeconds: 0,
      todayMinutes: 0,
      progressPercent: 0,
      streakDays: 0,
      remainingMinutes: goalMinutes,
      isGoalReached: false,
    };
  }
}

// ==========================================
// 5. STUDY ACTIVITY SERVICE
// ==========================================

export async function getActivitiesFromFirestore(
  userId: string,
  limitCount = 20
): Promise<ActivityItem[]> {
  if (!userId) return [];

  try {
    const actRef = collection(db, 'studyActivity');
    let q;
    try {
      q = query(actRef, where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(limitCount));
    } catch {
      q = query(actRef, where('userId', '==', userId));
    }

    const snap = await getDocs(q);
    const activities: ActivityItem[] = [];

    snap.forEach((d) => {
      activities.push({ ...d.data(), id: d.id } as ActivityItem);
    });

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Cache in IDB
    await persistenceEngine.saveStudyActivities(activities).catch(() => {});

    return activities.slice(0, limitCount);
  } catch (err) {
    console.error('[Firestore] getActivitiesFromFirestore error:', err);
    throw err;
  }
}

export async function createActivityInFirestore(
  actData: Partial<ActivityItem>
): Promise<ActivityItem> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create activity.');
  }

  const actId = actData.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newActivity: ActivityItem & { userId: string } = cleanPayload({
    id: actId,
    userId: currentUid,
    type: actData.type || 'lesson_created',
    title: actData.title?.trim() || 'Study Action',
    details: actData.details,
    courseId: actData.courseId,
    lessonId: actData.lessonId,
    timestamp: actData.timestamp || now,
  });

  const actDocRef = doc(db, 'studyActivity', actId);
  await setDoc(actDocRef, newActivity);

  await persistenceEngine.saveStudyActivity(newActivity).catch(() => {});
  return newActivity;
}

// ==========================================
// 6. QUIZ ATTEMPTS SERVICE
// ==========================================

export async function recordQuizAttemptInFirestore(data: {
  lessonId: string;
  score: number;
  totalQuestions: number;
  answers?: Record<string, string>;
}): Promise<QuizAttempt> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to record quiz attempt.');
  }

  const attemptId = `qza_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const attempt: QuizAttempt = cleanPayload({
    id: attemptId,
    userId: currentUid,
    lessonId: data.lessonId,
    score: data.score,
    totalQuestions: data.totalQuestions,
    answers: data.answers || {},
    date: now,
  });

  const qDocRef = doc(db, 'quizAttempts', attemptId);
  await setDoc(qDocRef, attempt);

  return attempt;
}

export async function getQuizAttemptsFromFirestore(
  userId: string,
  lessonId?: string
): Promise<QuizAttempt[]> {
  if (!userId) return [];

  try {
    const qRef = collection(db, 'quizAttempts');
    const q = query(qRef, where('userId', '==', userId));
    const snap = await getDocs(q);

    let attempts: QuizAttempt[] = [];
    snap.forEach((d) => {
      attempts.push({ ...d.data(), id: d.id } as QuizAttempt);
    });

    if (lessonId) {
      attempts = attempts.filter((a) => a.lessonId === lessonId);
    }

    attempts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return attempts;
  } catch (err) {
    console.error('[Firestore] getQuizAttemptsFromFirestore error:', err);
    throw err;
  }
}

// ==========================================
// 7. IDEMPOTENT JSON DB MIGRATION
// ==========================================

export interface MigrationSummary {
  domain: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export async function migratePhase2BLearningData(
  jsonDb: {
    notes?: Note[];
    terms?: KeyTermItem[];
    materials?: MaterialHistoryItem[];
    studySessions?: StudySessionRecord[];
    activities?: ActivityItem[];
  },
  overrideUid?: string
): Promise<Record<string, MigrationSummary>> {
  const targetUid = overrideUid || auth.currentUser?.uid;
  if (!targetUid) {
    throw new Error('No authenticated user available for Phase 2B migration.');
  }

  const results: Record<string, MigrationSummary> = {
    notes: { domain: 'notes', created: 0, updated: 0, skipped: 0, failed: 0 },
    terms: { domain: 'terms', created: 0, updated: 0, skipped: 0, failed: 0 },
    materials: { domain: 'materials', created: 0, updated: 0, skipped: 0, failed: 0 },
    studySessions: { domain: 'studySessions', created: 0, updated: 0, skipped: 0, failed: 0 },
    activities: { domain: 'studyActivity', created: 0, updated: 0, skipped: 0, failed: 0 },
  };

  // 1. Notes
  if (Array.isArray(jsonDb.notes)) {
    for (const note of jsonDb.notes) {
      try {
        const noteRef = doc(db, 'notes', note.id);
        const existing = await getDoc(noteRef);
        if (existing.exists()) {
          results.notes.skipped++;
        } else {
          await setDoc(noteRef, cleanPayload({ ...note, userId: targetUid }));
          results.notes.created++;
        }
      } catch (err) {
        console.error('[Migration] Note migration failed for', note.id, err);
        results.notes.failed++;
      }
    }
  }

  // 2. Terms
  if (Array.isArray(jsonDb.terms)) {
    for (const term of jsonDb.terms) {
      try {
        const termId = term.id || `trm_${term.term.replace(/\s+/g, '_').toLowerCase()}`;
        const termRef = doc(db, 'terms', termId);
        const existing = await getDoc(termRef);
        if (existing.exists()) {
          results.terms.skipped++;
        } else {
          await setDoc(termRef, cleanPayload({ ...term, id: termId, userId: targetUid }));
          results.terms.created++;
        }
      } catch (err) {
        console.error('[Migration] Term migration failed for', term.id, err);
        results.terms.failed++;
      }
    }
  }

  // 3. Materials
  if (Array.isArray(jsonDb.materials)) {
    for (const mat of jsonDb.materials) {
      try {
        const matRef = doc(db, 'materials', mat.id);
        const existing = await getDoc(matRef);
        if (existing.exists()) {
          results.materials.skipped++;
        } else {
          await setDoc(matRef, cleanPayload({ ...mat, userId: targetUid }));
          results.materials.created++;
        }
      } catch (err) {
        console.error('[Migration] Material migration failed for', mat.id, err);
        results.materials.failed++;
      }
    }
  }

  // 4. Study Sessions
  if (Array.isArray(jsonDb.studySessions)) {
    for (const sess of jsonDb.studySessions) {
      try {
        const sessRef = doc(db, 'studySessions', sess.id);
        const existing = await getDoc(sessRef);
        if (existing.exists()) {
          results.studySessions.skipped++;
        } else {
          await setDoc(sessRef, cleanPayload({ ...sess, userId: targetUid }));
          results.studySessions.created++;
        }
      } catch (err) {
        console.error('[Migration] Study session migration failed for', sess.id, err);
        results.studySessions.failed++;
      }
    }
  }

  // 5. Activities
  if (Array.isArray(jsonDb.activities)) {
    for (const act of jsonDb.activities) {
      try {
        const actRef = doc(db, 'studyActivity', act.id);
        const existing = await getDoc(actRef);
        if (existing.exists()) {
          results.activities.skipped++;
        } else {
          await setDoc(actRef, cleanPayload({ ...act, userId: targetUid }));
          results.activities.created++;
        }
      } catch (err) {
        console.error('[Migration] Activity migration failed for', act.id, err);
        results.activities.failed++;
      }
    }
  }

  return results;
}
