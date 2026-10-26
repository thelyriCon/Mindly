/**
 * Mindly Firestore Courses & Lessons Service — Phase 2A / Cloud Persistence Fix
 * Direct, authoritative Cloud Firestore persistence for Courses and Lessons.
 */
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Course, Lesson, SharedCourse, SharedCourseLesson } from '../types';
import { persistenceEngine } from './persistence';
import { getDemoDatabase } from './demoData';
import { getEducationalPhotoUrl } from './educationalMedia';

/**
 * Strips undefined values recursively so Firestore does not reject payloads.
 */
export function cleanPayload<T>(val: T): T {
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

/**
 * Fetch all courses owned by the authenticated user from Cloud Firestore.
 * /courses/{courseId}
 */
export async function getCoursesFromFirestore(userId: string): Promise<Course[]> {
  if (!userId) return [];

  try {
    const coursesRef = collection(db, 'courses');
    const q = query(coursesRef, where('userId', '==', userId));
    const snap = await getDocs(q);

    // Parallelize loading subcollections to prevent waterfall latency
    const coursePromises = snap.docs.map(async (courseDoc) => {
      const data = courseDoc.data() as Course;
      const courseId = courseDoc.id;

      // Fetch lessons subcollection to compute accurate counts & progress
      const lessonsRef = collection(db, 'courses', courseId, 'lessons');
      const lessonsList: Lesson[] = [];

      try {
        const lessonsQuery = query(lessonsRef, where('userId', '==', userId));
        const lessonsSnap = await getDocs(lessonsQuery);
        lessonsSnap.forEach((lDoc) => {
          lessonsList.push({ ...lDoc.data(), id: lDoc.id, courseId } as Lesson);
        });
      } catch (lErr) {
        console.warn(`[Firestore] Lessons subcollection load note for ${courseId}:`, lErr);
      }

      // Sort lessons by order ascending in memory (no composite index required)
      lessonsList.sort((a, b) => (a.order || 0) - (b.order || 0));

      const totalCount = lessonsList.length > 0
        ? lessonsList.length
        : (data.lessonsCount || data.lessonCount || 0);
      const completedCount = lessonsList.length > 0
        ? lessonsList.filter((l) => l.isCompleted).length
        : (data.completedLessonsCount || 0);
      const progressPercent = totalCount > 0
        ? Math.round((completedCount / totalCount) * 100)
        : (data.progressPercent || 0);

      const courseObj: Course = {
        ...data,
        id: courseId,
        userId: data.userId || userId,
        lessonsCount: totalCount,
        lessonCount: totalCount,
        completedLessonsCount: completedCount,
        progressPercent,
        progress: progressPercent,
      };

      // Cache lessons in IDB
      if (lessonsList.length > 0) {
        await persistenceEngine.saveLessons(lessonsList).catch(() => {});
      }

      return courseObj;
    });

    const courses: Course[] = await Promise.all(coursePromises);

    // Sort by updatedAt descending
    courses.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    // Sync authoritative courses to persistenceEngine
    await persistenceEngine.saveCourses(courses).catch(() => {});

    return courses;
  } catch (err) {
    console.error('[Firestore] getCoursesFromFirestore error:', err);
    throw err;
  }
}

/**
 * Fetch a single course and its lessons from Cloud Firestore.
 * /courses/{courseId}
 * /courses/{courseId}/lessons/{lessonId}
 */
export async function getCourseFromFirestore(
  courseId: string,
  userId?: string
): Promise<{ course: Course | null; lessons: Lesson[] }> {
  if (!courseId) return { course: null, lessons: [] };

  try {
    const courseRef = doc(db, 'courses', courseId);
    const snap = await getDoc(courseRef);

    if (!snap.exists()) {
      return { course: null, lessons: [] };
    }

    const courseData = snap.data() as Course;
    const course: Course = {
      ...courseData,
      id: courseId,
    };

    const currentUid = userId || auth.currentUser?.uid || course.userId;
    const lessonsRef = collection(db, 'courses', courseId, 'lessons');
    let lessonsSnap: any = null;

    try {
      if (currentUid) {
        // Query WITHOUT orderBy to avoid composite index requirement; sort in memory
        const q = query(lessonsRef, where('userId', '==', currentUid));
        lessonsSnap = await getDocs(q);
      } else {
        lessonsSnap = await getDocs(lessonsRef);
      }
    } catch (lErr) {
      console.warn(`[Firestore] Lessons load note for ${courseId}:`, lErr);
    }

    const lessons: Lesson[] = [];
    if (lessonsSnap && !lessonsSnap.empty) {
      lessonsSnap.forEach((lDoc: any) => {
        lessons.push({
          ...lDoc.data(),
          id: lDoc.id,
          courseId,
        } as Lesson);
      });
    }

    // In-memory sort by order ascending
    lessons.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Update computed metrics on course
    const totalCount = lessons.length > 0 ? lessons.length : (course.lessonsCount || course.lessonCount || 0);
    const completedCount = lessons.length > 0 ? lessons.filter((l) => l.isCompleted).length : (course.completedLessonsCount || 0);
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : (course.progressPercent || 0);

    course.lessonsCount = totalCount;
    course.lessonCount = totalCount;
    course.completedLessonsCount = completedCount;
    course.progressPercent = progressPercent;
    course.progress = progressPercent;

    // Cache locally in persistenceEngine
    await persistenceEngine.saveCourse(course).catch(() => {});
    if (lessons.length > 0) {
      await persistenceEngine.saveLessons(lessons).catch(() => {});
    }

    return { course, lessons };
  } catch (err) {
    console.error(`[Firestore] getCourseFromFirestore error for ${courseId}:`, err);
    throw err;
  }
}

/**
 * Fetch a single lesson from /courses/{courseId}/lessons/{lessonId}.
 */
export async function getLessonFromFirestore(
  courseId: string,
  lessonId: string
): Promise<{ lesson: Lesson | null; course: Course | null }> {
  if (!courseId || !lessonId) return { lesson: null, course: null };

  try {
    const lessonDocRef = doc(db, 'courses', courseId, 'lessons', lessonId);
    const snap = await getDoc(lessonDocRef);

    let lesson: Lesson | null = null;
    if (snap.exists()) {
      lesson = { ...snap.data(), id: lessonId, courseId } as Lesson;
      await persistenceEngine.saveLesson(lesson).catch(() => {});
    }

    const { course } = await getCourseFromFirestore(courseId);
    return { lesson, course };
  } catch (err) {
    console.error(`[Firestore] getLessonFromFirestore error for ${courseId}/${lessonId}:`, err);
    throw err;
  }
}

/**
 * Cross-device lesson lookup without prior local cache knowledge.
 * Uses direct course lookup first, then local cache, then checks cached user courses.
 */
export async function findLessonByIdInFirestore(
  lessonId: string,
  courseIdHint?: string
): Promise<{ lesson: Lesson | null; course: Course | null }> {
  const currentUid = auth.currentUser?.uid;
  if (!lessonId) return { lesson: null, course: null };

  try {
    // 1. If courseIdHint provided, fetch directly (no index required!)
    if (courseIdHint) {
      return await getLessonFromFirestore(courseIdHint, lessonId);
    }

    // 2. Check local IDB cache first for courseId
    const cached = await persistenceEngine.getLesson(lessonId);
    if (cached?.courseId) {
      return await getLessonFromFirestore(cached.courseId, lessonId);
    }

    // 3. Check known courses in IDB to locate parent course
    const idbCourses = await persistenceEngine.getCourses();
    for (const c of idbCourses) {
      try {
        const directDoc = await getDoc(doc(db, 'courses', c.id, 'lessons', lessonId));
        if (directDoc.exists()) {
          const lesson: Lesson = { ...directDoc.data(), id: lessonId, courseId: c.id } as Lesson;
          await persistenceEngine.saveLesson(lesson).catch(() => {});
          const { course } = await getCourseFromFirestore(c.id);
          return { lesson, course };
        }
      } catch {}
    }

    // 4. Try collectionGroup as fallback with single filter (safe for default indexes)
    if (currentUid) {
      try {
        const lessonsGroup = collectionGroup(db, 'lessons');
        const q = query(lessonsGroup, where('userId', '==', currentUid));
        const snap = await getDocs(q);
        const match = snap.docs.find((d) => d.id === lessonId);
        if (match) {
          const lessonData = match.data() as Lesson;
          const parentCourseId = lessonData.courseId || match.ref.parent.parent?.id;
          if (parentCourseId) {
            const lesson: Lesson = { ...lessonData, id: lessonId, courseId: parentCourseId };
            await persistenceEngine.saveLesson(lesson).catch(() => {});
            const { course } = await getCourseFromFirestore(parentCourseId);
            return { lesson, course };
          }
        }
      } catch (cgErr) {
        console.warn(`[Firestore] Collection group search note for ${lessonId}:`, cgErr);
      }
    }
  } catch (err) {
    console.warn(`[Firestore] findLessonByIdInFirestore error for ${lessonId}:`, err);
  }

  return { lesson: null, course: null };
}

/**
 * Creates a new course in Cloud Firestore /courses/{courseId}.
 * Enforces ownership by authenticated Firebase UID.
 */
export async function createCourseInFirestore(courseData: Partial<Course>): Promise<Course> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create a course.');
  }

  const now = new Date().toISOString();
  const courseId = courseData.id || `crs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newCourse: Course = cleanPayload({
    ...courseData,
    id: courseId,
    userId: currentUid,
    title: courseData.title?.trim() || 'Untitled Course',
    description: courseData.description?.trim() || '',
    category: courseData.category || 'General',
    coverIcon: courseData.coverIcon || 'BookOpen',
    coverImage: courseData.coverImage || getEducationalPhotoUrl(courseData.title, courseData.category),
    courseType: courseData.courseType || 'self-created',
    depth: courseData.depth || 'standard',
    dailyMinutesRange: courseData.dailyMinutesRange || '30–45 minutes/day',
    dailyStudyGoalMinutes: courseData.dailyStudyGoalMinutes || 35,
    estimatedDays: courseData.estimatedDays || 7,
    learningObjectives: courseData.learningObjectives || [],
    studyDays: courseData.studyDays || [],
    finalExam: courseData.finalExam || [],
    finalExamPassed: courseData.finalExamPassed ?? false,
    finalExamScore: courseData.finalExamScore ?? null,
    isCompleted: courseData.isCompleted ?? false,
    isDemo: false,
    lessonsCount: courseData.lessonsCount || courseData.lessonCount || 0,
    lessonCount: courseData.lessonCount || courseData.lessonsCount || 0,
    completedLessonsCount: courseData.completedLessonsCount ?? 0,
    progressPercent: courseData.progressPercent ?? 0,
    progress: courseData.progress ?? 0,
    createdAt: courseData.createdAt || now,
    updatedAt: now,
  });

  const courseDocRef = doc(db, 'courses', courseId);
  await setDoc(courseDocRef, newCourse);

  await persistenceEngine.saveCourse(newCourse).catch(() => {});
  return newCourse;
}

/**
 * Atomically creates a course and all its planned lessons in Cloud Firestore.
 * Guarantees that the course and its lessons are committed together.
 */
export async function createCourseWithLessonsInFirestore(
  courseData: Partial<Course>,
  lessonsData: Partial<Lesson>[]
): Promise<{ course: Course; lessons: Lesson[] }> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create a course.');
  }

  const now = new Date().toISOString();
  const courseId = courseData.id || `crs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const totalLessons = Array.isArray(lessonsData) ? lessonsData.length : 0;

  const newCourse: Course = cleanPayload({
    ...courseData,
    id: courseId,
    userId: currentUid,
    title: courseData.title?.trim() || 'Untitled Course',
    description: courseData.description?.trim() || '',
    category: courseData.category || 'General',
    coverIcon: courseData.coverIcon || 'BookOpen',
    coverImage: courseData.coverImage || getEducationalPhotoUrl(courseData.title, courseData.category),
    courseType: courseData.courseType || 'self-created',
    depth: courseData.depth || 'standard',
    dailyMinutesRange: courseData.dailyMinutesRange || '30–45 minutes/day',
    dailyStudyGoalMinutes: courseData.dailyStudyGoalMinutes || 35,
    estimatedDays: courseData.estimatedDays || (courseData.studyDays?.length || 7),
    learningObjectives: courseData.learningObjectives || [],
    studyDays: courseData.studyDays || [],
    finalExam: courseData.finalExam || [],
    finalExamPassed: courseData.finalExamPassed ?? false,
    finalExamScore: courseData.finalExamScore ?? null,
    isCompleted: courseData.isCompleted ?? false,
    isDemo: false,
    lessonsCount: totalLessons || courseData.lessonsCount || 0,
    lessonCount: totalLessons || courseData.lessonCount || 0,
    completedLessonsCount: courseData.completedLessonsCount ?? 0,
    progressPercent: courseData.progressPercent ?? 0,
    progress: courseData.progress ?? 0,
    createdAt: courseData.createdAt || now,
    updatedAt: now,
  });

  const createdLessons: Lesson[] = [];
  const batch = writeBatch(db);

  const courseDocRef = doc(db, 'courses', courseId);
  batch.set(courseDocRef, newCourse);

  if (Array.isArray(lessonsData)) {
    lessonsData.forEach((l, idx) => {
      const lessonId = l.id || `lsn_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      const newLesson: Lesson = cleanPayload({
        ...l,
        id: lessonId,
        courseId,
        userId: currentUid,
        title: l.title?.trim() || `Lesson ${idx + 1}`,
        order: l.order || idx + 1,
        dayNumber: l.dayNumber || 1,
        dayTitle: l.dayTitle || 'Day 1: Core Study',
        isLocked: l.isLocked ?? (idx > 0 && (l.dayNumber || 1) > 1),
        isCompleted: l.isCompleted ?? false,
        isBookmarked: l.isBookmarked ?? false,
        quizScore: l.quizScore ?? null,
        spacedRepetition: l.spacedRepetition,
        scrollOffsetPosition: l.scrollOffsetPosition || 0,
        userNotes: l.userNotes || '',
        originalMaterial: l.originalMaterial || {
          type: 'text',
          content: '',
          uploadedAt: now,
        },
        structuredContent: l.structuredContent || {
          title: l.title?.trim() || `Lesson ${idx + 1}`,
          overview: 'Study notes and key concepts.',
          learningObjectives: ['Master fundamental principles.'],
          mainConcepts: [],
          examples: [],
          importantDistinctions: [],
          keyTerms: [],
          keyTakeaways: [],
          reviewQuestions: [],
        },
        createdAt: l.createdAt || now,
        updatedAt: now,
      });

      const lessonDocRef = doc(db, 'courses', courseId, 'lessons', lessonId);
      batch.set(lessonDocRef, newLesson);
      createdLessons.push(newLesson);
    });
  }

  // Atomically commit all records into Cloud Firestore
  await batch.commit();

  // Cache locally in persistenceEngine
  await persistenceEngine.saveCourse(newCourse).catch(() => {});
  if (createdLessons.length > 0) {
    await persistenceEngine.saveLessons(createdLessons).catch(() => {});
  }

  return { course: newCourse, lessons: createdLessons };
}

/**
 * Updates a course in Cloud Firestore /courses/{courseId}.
 */
export async function updateCourseInFirestore(courseId: string, updates: Partial<Course>): Promise<Course> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to update course.');
  }

  const courseDocRef = doc(db, 'courses', courseId);
  const now = new Date().toISOString();

  const cleanedUpdates = cleanPayload({
    ...updates,
    updatedAt: now,
  });
  // Prevent changing ownership
  delete (cleanedUpdates as any).userId;
  delete (cleanedUpdates as any).id;

  await updateDoc(courseDocRef, cleanedUpdates);

  const updatedSnap = await getDoc(courseDocRef);
  const updatedCourse = { ...updatedSnap.data(), id: courseId } as Course;

  await persistenceEngine.saveCourse(updatedCourse).catch(() => {});
  return updatedCourse;
}

/**
 * Deletes a course and all its subcollection lessons in Cloud Firestore.
 */
export async function deleteCourseInFirestore(courseId: string): Promise<boolean> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to delete course.');
  }

  // 1. Delete all subcollection lessons owned by user
  const lessonsRef = collection(db, 'courses', courseId, 'lessons');
  const lessonsQuery = query(lessonsRef, where('userId', '==', currentUid));
  const lessonsSnap = await getDocs(lessonsQuery);
  const batch = writeBatch(db);

  lessonsSnap.forEach((lDoc) => {
    batch.delete(lDoc.ref);
  });

  // 2. Delete parent course document
  const courseDocRef = doc(db, 'courses', courseId);
  batch.delete(courseDocRef);

  await batch.commit();

  // 3. Remove from persistenceEngine
  await persistenceEngine.deleteCourse(courseId).catch(() => {});

  return true;
}

/**
 * Creates a lesson in /courses/{courseId}/lessons/{lessonId}.
 */
export async function createLessonInFirestore(courseId: string, lessonData: Partial<Lesson>): Promise<Lesson> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create a lesson.');
  }

  const now = new Date().toISOString();
  const lessonId = lessonData.id || `lsn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newLesson: Lesson = cleanPayload({
    id: lessonId,
    courseId,
    userId: currentUid,
    title: lessonData.title?.trim() || 'Untitled Lesson',
    order: lessonData.order || 1,
    dayNumber: lessonData.dayNumber || 1,
    dayTitle: lessonData.dayTitle || 'Day 1: Core Study',
    isLocked: lessonData.isLocked ?? false,
    isCompleted: lessonData.isCompleted ?? false,
    isBookmarked: lessonData.isBookmarked ?? false,
    quizScore: lessonData.quizScore ?? null,
    spacedRepetition: lessonData.spacedRepetition,
    scrollOffsetPosition: lessonData.scrollOffsetPosition || 0,
    userNotes: lessonData.userNotes || '',
    originalMaterial: lessonData.originalMaterial || {
      type: 'text',
      content: '',
      uploadedAt: now,
    },
    structuredContent: lessonData.structuredContent || {
      title: lessonData.title?.trim() || 'Untitled Lesson',
      overview: 'Study notes and key concepts.',
      learningObjectives: ['Master fundamental principles.'],
      mainConcepts: [],
      examples: [],
      importantDistinctions: [],
      keyTerms: [],
      keyTakeaways: [],
      reviewQuestions: [],
    },
    createdAt: lessonData.createdAt || now,
    updatedAt: now,
  });

  const lessonDocRef = doc(db, 'courses', courseId, 'lessons', lessonId);
  await setDoc(lessonDocRef, newLesson);

  // Sync extracted key terms to /terms in background
  if (Array.isArray(newLesson.structuredContent?.keyTerms)) {
    for (const kt of newLesson.structuredContent.keyTerms) {
      if (kt.term && kt.definition) {
        const termId = `trm_${lessonId}_${Math.random().toString(36).substring(2, 6)}`;
        const termDocRef = doc(db, 'terms', termId);
        setDoc(
          termDocRef,
          cleanPayload({
            id: termId,
            userId: currentUid,
            term: kt.term.trim(),
            definition: kt.definition.trim(),
            context: `${newLesson.title} Glossary`,
            courseId,
            lessonId,
            lessonTitle: newLesson.title,
            createdAt: now,
            updatedAt: now,
          })
        ).catch(() => {});
      }
    }
  }

  // Record activity in /studyActivity in background
  const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  setDoc(
    doc(db, 'studyActivity', actId),
    cleanPayload({
      id: actId,
      userId: currentUid,
      type: 'lesson_created',
      title: `Added lesson "${newLesson.title}"`,
      courseId,
      lessonId,
      timestamp: now,
    })
  ).catch(() => {});

  // Update course lessons count
  const courseDocRef = doc(db, 'courses', courseId);
  try {
    const cSnap = await getDoc(courseDocRef);
    if (cSnap.exists()) {
      const cData = cSnap.data();
      const newCount = (cData.lessonsCount || 0) + 1;
      await updateDoc(courseDocRef, {
        lessonsCount: newCount,
        lessonCount: newCount,
        updatedAt: now,
      });
    }
  } catch (cErr) {
    console.warn('[Firestore] Could not update course lesson count:', cErr);
  }

  await persistenceEngine.saveLesson(newLesson).catch(() => {});
  return newLesson;
}

/**
 * Updates a lesson in /courses/{courseId}/lessons/{lessonId}.
 */
export async function updateLessonInFirestore(
  courseId: string,
  lessonId: string,
  updates: Partial<Lesson>
): Promise<Lesson> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to update lesson.');
  }

  const lessonDocRef = doc(db, 'courses', courseId, 'lessons', lessonId);
  const now = new Date().toISOString();

  const cleanedUpdates = cleanPayload({
    ...updates,
    updatedAt: now,
  });
  delete (cleanedUpdates as any).userId;
  delete (cleanedUpdates as any).id;
  delete (cleanedUpdates as any).courseId;

  await updateDoc(lessonDocRef, cleanedUpdates);

  const updatedSnap = await getDoc(lessonDocRef);
  const updatedLesson = { ...updatedSnap.data(), id: lessonId, courseId } as Lesson;

  await persistenceEngine.saveLesson(updatedLesson).catch(() => {});
  return updatedLesson;
}

/**
 * Deletes a lesson from /courses/{courseId}/lessons/{lessonId}.
 */
export async function deleteLessonInFirestore(courseId: string, lessonId: string): Promise<boolean> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to delete lesson.');
  }

  const lessonDocRef = doc(db, 'courses', courseId, 'lessons', lessonId);
  await deleteDoc(lessonDocRef);

  // Decrement course lessons count
  const courseDocRef = doc(db, 'courses', courseId);
  try {
    const cSnap = await getDoc(courseDocRef);
    if (cSnap.exists()) {
      const cData = cSnap.data();
      const newCount = Math.max(0, (cData.lessonsCount || 1) - 1);
      await updateDoc(courseDocRef, {
        lessonsCount: newCount,
        lessonCount: newCount,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {}

  await persistenceEngine.deleteLesson(lessonId).catch(() => {});
  return true;
}

/**
 * Seeds initial demo starter course in Cloud Firestore for a brand new learner.
 */
export async function seedDemoCourseInFirestore(userId: string): Promise<Course | null> {
  try {
    const demo = getDemoDatabase();
    const demoCourse = demo.courses[0];
    const demoLessons = demo.lessons.filter((l) => l.courseId === demoCourse.id);

    if (!demoCourse) return null;

    const courseId = `crs_starter_${userId.slice(0, 8)}`;
    const now = new Date().toISOString();

    const coursePayload: Course = cleanPayload({
      ...demoCourse,
      id: courseId,
      userId,
      isDemo: true,
      lessonsCount: demoLessons.length,
      lessonCount: demoLessons.length,
      completedLessonsCount: demoLessons.filter((l) => l.isCompleted).length,
      progressPercent: 33,
      progress: 33,
      createdAt: now,
      updatedAt: now,
    });

    const courseDocRef = doc(db, 'courses', courseId);
    await setDoc(courseDocRef, coursePayload);

    // Seed lessons in subcollection
    const batch = writeBatch(db);
    for (const dLesson of demoLessons) {
      const lessonDocRef = doc(db, 'courses', courseId, 'lessons', dLesson.id);
      const lessonPayload: Lesson = cleanPayload({
        ...dLesson,
        courseId,
        userId,
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      });
      batch.set(lessonDocRef, lessonPayload);
    }
    await batch.commit();

    return coursePayload;
  } catch (err) {
    console.warn('[Firestore] Failed to seed demo course:', err);
    return null;
  }
}

/**
 * Creates or updates a standalone, secure, public shareable record of a course.
 * Strips all personal user progress, notes, bookmarks, and quiz scores.
 */
export async function shareCourseInFirestore(
  courseId: string,
  creatorName?: string
): Promise<{ shareId: string; shareUrl: string; sharedCourse: SharedCourse }> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to share a course.');
  }

  // 1. Fetch source course and lessons
  const { course, lessons } = await getCourseFromFirestore(courseId);
  if (!course) {
    throw new Error('Course not found.');
  }

  const now = new Date().toISOString();
  // Reuse existing shareId if already shared, or generate a deterministic friendly shareId
  const shareId = course.shareId || `sh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

  // 2. Sanitize lessons into clean educational learning content without personal data
  const sanitizedLessons: SharedCourseLesson[] = lessons.map((l, idx) => ({
    id: `slsn_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
    title: l.title || `Lesson ${idx + 1}`,
    order: l.order || idx + 1,
    dayNumber: l.dayNumber || 1,
    dayTitle: l.dayTitle || 'Day 1: Core Study',
    originalMaterial: l.originalMaterial ? {
      type: l.originalMaterial.type || 'text',
      content: l.originalMaterial.content || '',
      sourceTitle: l.originalMaterial.sourceTitle,
      uploadedAt: l.originalMaterial.uploadedAt || now,
      fileName: l.originalMaterial.fileName,
      fileType: l.originalMaterial.fileType,
      pageCount: l.originalMaterial.pageCount,
      wordCount: l.originalMaterial.wordCount,
    } : undefined,
    structuredContent: l.structuredContent || {
      title: l.title,
      overview: 'Lesson notes and structured concepts.',
      learningObjectives: [],
      mainConcepts: [],
      examples: [],
      importantDistinctions: [],
      keyTerms: [],
      keyTakeaways: [],
      reviewQuestions: [],
    },
    diagrams: Array.isArray(l.diagrams) ? l.diagrams : (l.structuredContent?.diagrams || []),
    images: Array.isArray(l.images) ? l.images : (l.structuredContent?.images || []),
    quizzes: Array.isArray(l.quizzes) ? l.quizzes : (l.structuredContent?.reviewQuestions || []),
  }));

  const sharedCoursePayload: SharedCourse = cleanPayload({
    id: shareId,
    courseId: course.id,
    creatorId: currentUid,
    creatorName: creatorName || auth.currentUser?.displayName || 'Mindly Learner',
    title: course.title,
    description: course.description || '',
    category: course.category || 'General',
    coverIcon: course.coverIcon || 'BookOpen',
    coverImage: course.coverImage,
    depth: course.depth || 'standard',
    dailyMinutesRange: course.dailyMinutesRange || '30–45 min/day',
    estimatedDays: course.estimatedDays || (course.studyDays?.length || 7),
    learningObjectives: course.learningObjectives || [],
    studyDays: course.studyDays || [],
    finalExam: course.finalExam || [],
    lessonCount: sanitizedLessons.length,
    lessons: sanitizedLessons,
    createdAt: course.shareId ? (course.createdAt || now) : now,
    updatedAt: now,
  });

  // 3. Write shareable course to public /sharedCourses/{shareId} collection
  const sharedDocRef = doc(db, 'sharedCourses', shareId);
  await setDoc(sharedDocRef, sharedCoursePayload);

  // 4. Update the author's course document to keep reference to the shareId
  try {
    const courseDocRef = doc(db, 'courses', courseId);
    await updateDoc(courseDocRef, {
      shareId,
      updatedAt: now,
    });
    course.shareId = shareId;
    await persistenceEngine.saveCourse(course).catch(() => {});
  } catch (err) {
    console.warn('[Firestore] Note updating course with shareId:', err);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/share/course/${shareId}`;

  return {
    shareId,
    shareUrl,
    sharedCourse: sharedCoursePayload,
  };
}

/**
 * Fetches a shared course snapshot from /sharedCourses/{shareId}.
 * Completely accessible without authentication (for preview & guest landing).
 */
export async function getSharedCourseFromFirestore(shareId: string): Promise<SharedCourse | null> {
  if (!shareId) return null;

  try {
    const sharedDocRef = doc(db, 'sharedCourses', shareId);
    const snap = await getDoc(sharedDocRef);
    if (snap.exists()) {
      return { ...snap.data(), id: shareId } as SharedCourse;
    }
  } catch (err) {
    console.warn(`[Firestore] getSharedCourseFromFirestore note for ${shareId}:`, err);
  }

  // Fallback: Query backend API proxy if direct Firestore read fails
  try {
    const res = await fetch(`/api/courses/shared/${encodeURIComponent(shareId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.sharedCourse) {
        return data.sharedCourse as SharedCourse;
      }
    }
  } catch {}

  return null;
}

/**
 * Clones a shared course into the authenticated user's private library with fresh IDs
 * and 0% starting progress.
 */
export async function importSharedCourseInFirestore(
  shareId: string
): Promise<{ course: Course; lessons: Lesson[] }> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Please sign in or create an account to import this course.');
  }

  const shared = await getSharedCourseFromFirestore(shareId);
  if (!shared) {
    throw new Error('The shared course could not be found or has expired.');
  }

  const now = new Date().toISOString();
  const newCourseId = `crs_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const totalLessons = Array.isArray(shared.lessons) ? shared.lessons.length : 0;

  const newCourse: Course = cleanPayload({
    id: newCourseId,
    userId: currentUid,
    title: shared.title,
    description: shared.description || '',
    category: shared.category || 'General',
    coverIcon: shared.coverIcon || 'BookOpen',
    coverImage: shared.coverImage,
    courseType: 'imported',
    depth: shared.depth || 'standard',
    dailyMinutesRange: shared.dailyMinutesRange || '30–45 min/day',
    dailyStudyGoalMinutes: 35,
    estimatedDays: shared.estimatedDays || (shared.studyDays?.length || 7),
    learningObjectives: shared.learningObjectives || [],
    studyDays: shared.studyDays || [],
    finalExam: shared.finalExam || [],
    finalExamPassed: false,
    finalExamScore: null,
    isCompleted: false,
    isArchived: false,
    originalShareId: shareId,
    lessonsCount: totalLessons,
    lessonCount: totalLessons,
    completedLessonsCount: 0,
    progressPercent: 0,
    progress: 0,
    createdAt: now,
    updatedAt: now,
  });

  const createdLessons: Lesson[] = [];
  const batch = writeBatch(db);

  const courseDocRef = doc(db, 'courses', newCourseId);
  batch.set(courseDocRef, newCourse);

  if (Array.isArray(shared.lessons)) {
    shared.lessons.forEach((l, idx) => {
      const lessonId = `lsn_imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      const newLesson: Lesson = cleanPayload({
        id: lessonId,
        courseId: newCourseId,
        userId: currentUid,
        title: l.title || `Lesson ${idx + 1}`,
        order: l.order || idx + 1,
        dayNumber: l.dayNumber || 1,
        dayTitle: l.dayTitle || 'Day 1: Core Study',
        isLocked: idx > 0 && (l.dayNumber || 1) > 1,
        isCompleted: false,
        isBookmarked: false,
        quizScore: null,
        scrollOffsetPosition: 0,
        userNotes: '',
        originalMaterial: l.originalMaterial || {
          type: 'text',
          content: '',
          uploadedAt: now,
        },
        structuredContent: l.structuredContent,
        diagrams: l.diagrams || l.structuredContent?.diagrams || [],
        images: l.images || l.structuredContent?.images || [],
        quizzes: l.quizzes || l.structuredContent?.reviewQuestions || [],
        createdAt: now,
        updatedAt: now,
      });

      const lessonDocRef = doc(db, 'courses', newCourseId, 'lessons', lessonId);
      batch.set(lessonDocRef, newLesson);
      createdLessons.push(newLesson);
    });
  }

  await batch.commit();

  // Cache locally in persistenceEngine
  await persistenceEngine.saveCourse(newCourse).catch(() => {});
  if (createdLessons.length > 0) {
    await persistenceEngine.saveLessons(createdLessons).catch(() => {});
  }

  return { course: newCourse, lessons: createdLessons };
}

/**
 * Toggles archival status of a course.
 * Preserves all underlying lessons, bookmarks, and quiz scores.
 */
export async function toggleArchiveCourseInFirestore(
  courseId: string,
  isArchived: boolean
): Promise<Course> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required.');
  }

  const now = new Date().toISOString();
  const updates: Partial<Course> = {
    isArchived,
    archivedAt: isArchived ? now : undefined,
    updatedAt: now,
  };

  const courseDocRef = doc(db, 'courses', courseId);
  await updateDoc(courseDocRef, cleanPayload(updates));

  const snap = await getDoc(courseDocRef);
  const updated = { ...snap.data(), id: courseId } as Course;
  await persistenceEngine.saveCourse(updated).catch(() => {});

  return updated;
}

/**
 * Resets a course's learning progress back to Day 1.
 * Resets lesson completion status, quiz scores, scroll positions, and locks day 2+ lessons.
 * Preserves all underlying lessons, personal notes, and learning materials.
 */
export async function resetCourseProgressInFirestore(
  courseId: string
): Promise<{ course: Course; lessons: Lesson[] }> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required.');
  }

  // 1. Fetch current lessons for this course
  const lessonsRef = collection(db, 'courses', courseId, 'lessons');
  const lessonsSnap = await getDocs(lessonsRef);
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const updatedLessons: Lesson[] = [];

  lessonsSnap.forEach((lDoc) => {
    const lData = lDoc.data() as Lesson;
    const isLocked = (lData.dayNumber || 1) > 1;
    batch.update(lDoc.ref, {
      isCompleted: false,
      isLocked,
      quizScore: null,
      scrollOffsetPosition: 0,
      updatedAt: now,
    });
    updatedLessons.push({
      ...lData,
      id: lDoc.id,
      courseId,
      isCompleted: false,
      isLocked,
      quizScore: null,
      scrollOffsetPosition: 0,
      updatedAt: now,
    });
  });

  // 2. Fetch parent course and reset progress metrics
  const courseDocRef = doc(db, 'courses', courseId);
  const cSnap = await getDoc(courseDocRef);
  const cData = cSnap.exists() ? (cSnap.data() as Course) : ({} as Course);

  const resetStudyDays = Array.isArray(cData.studyDays)
    ? cData.studyDays.map((sd) => ({
        ...sd,
        isPassed: false,
        quizScore: null,
      }))
    : [];

  const courseUpdates: Partial<Course> = {
    completedLessonsCount: 0,
    progressPercent: 0,
    progress: 0,
    isCompleted: false,
    finalExamPassed: false,
    finalExamScore: null,
    studyDays: resetStudyDays,
    updatedAt: now,
  };

  batch.update(courseDocRef, cleanPayload(courseUpdates));
  await batch.commit();

  const finalCourseSnap = await getDoc(courseDocRef);
  const updatedCourse: Course = {
    ...finalCourseSnap.data(),
    id: courseId,
  } as Course;

  await persistenceEngine.saveCourse(updatedCourse).catch(() => {});
  if (updatedLessons.length > 0) {
    await persistenceEngine.saveLessons(updatedLessons).catch(() => {});
  }

  return { course: updatedCourse, lessons: updatedLessons };
}

