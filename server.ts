/**
 * Mindly Backend Server — V1.5 Production Foundation
 *
 * Implements:
 * 1. Authentication & Sessions with bcrypt hashing and crypto tokens
 * 2. Real PDF & DOCX document ingestion via DocumentService
 * 3. Persistent AI Grounding & Tutor behavior (Strict vs Balanced)
 * 4. Password reset infrastructure with EmailService
 * 5. Repository abstraction layer with safe migration & zero-data-loss
 * 6. StorageService for uploads & avatar pictures
 * 7. Multi-entity Search & Export capabilities
 * 8. User scoping preventing ID spoofing
 */

import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import {
  userRepository,
  courseRepository,
  lessonRepository,
  noteRepository,
  keyTermRepository,
  quizRepository,
  studySessionRepository,
  materialRepository,
  activityRepository,
  sessionRepository,
  certificateRepository,
  combinedCertificateRepository,
  circleRepository,
  discussionRepository,
  studyRoomRepository,
  sharedCourseRepository,
  exportUserData,
  flushDatabaseSync
} from './server/repositories/jsonRepository';

import { sanitizeUser } from './server/services/authService';
import { emailService } from './server/services/emailService';
import { documentService } from './server/services/documentService';
import { storageService } from './server/services/storageService';
import { aiService } from './server/services/aiService';
import { searchService } from './server/services/searchService';
import { transcriptionService } from './server/services/transcriptionService';
import { searchWikimediaImages } from './server/services/mediaService';
import { microArticleService } from './server/services/microArticleService';
import { firestoreAdminService } from './server/services/firestoreAdminService';
import { authenticate, requireAuth } from './server/middleware/authMiddleware';

dotenv.config();

const app = express();
const PORT = 3000;

// In-memory concurrency lock to prevent duplicate background authoring requests
export const currentlyAuthoringLessonIds = new Set<string>();

// Body parser limits for large transcripts, books, and base64 files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global Authentication Session Reader
app.use(authenticate);

// ==========================================
// 1. AUTHENTICATION & SESSION ENDPOINTS
// ==========================================

// ==========================================
// 1. AUTHENTICATION & IDENTITY (FIREBASE ONLY)
// ==========================================
// Legacy Express session & custom authentication endpoints (/api/auth/*) have been completely
// retired. Authentication is strictly handled via Firebase Authentication SDK on the client
// and cryptographically verified on the backend via Firebase Admin SDK in authMiddleware.

// ==========================================
// 2. USER PROFILE & SETTINGS ENDPOINTS
// ==========================================

// Update Profile & Grounding Preferences
app.put('/api/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, email, interests, dailyStudyGoalMinutes, settings, profileImage } = req.body;

    const updates: any = {};
    if (name) updates.name = name.trim();
    if (email) updates.email = email.trim().toLowerCase();
    if (interests && Array.isArray(interests)) updates.interests = interests;
    if (typeof dailyStudyGoalMinutes === 'number') updates.dailyStudyGoalMinutes = dailyStudyGoalMinutes;
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (settings) updates.settings = settings;

    const updated = await userRepository.update(userId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'User not found.' });
    }

    flushDatabaseSync();
    return res.json({ user: sanitizeUser(updated) });
  } catch (err: any) {
    console.error('[API UPDATE PROFILE ERROR]', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Explicit Write/Commit for User Profile (strictly requires verified Firebase authentication)
app.post('/api/user/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { realName, name, username, interests, dailyStudyGoalMinutes, settings, profileImage } = req.body;
    // req.user is guaranteed to be present and strictly tied to the verified Firebase UID
    const user = req.user!;

    const updates: any = {};
    if (realName || name) updates.realName = (realName || name).trim();
    if (name) updates.name = name.trim();
    if (username) updates.username = username.trim();
    if (interests && Array.isArray(interests)) updates.interests = interests;
    if (typeof dailyStudyGoalMinutes === 'number') updates.dailyStudyGoalMinutes = dailyStudyGoalMinutes;
    if (profileImage !== undefined) updates.profileImage = profileImage;
    if (settings) updates.settings = settings;

    const updated = await userRepository.update(user.id, updates);
    flushDatabaseSync();
    return res.json({ user: sanitizeUser(updated || user) });
  } catch (err: any) {
    console.error('[API USER PROFILE PERSIST ERROR]', err);
    return res.status(500).json({ error: 'Failed to save persistent user profile.' });
  }
});

// Import Full Progress Data & Knowledge Vault
app.post('/api/user/import-data', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { courses, lessons, notes, terms } = req.body;

    let coursesCount = 0;
    let lessonsCount = 0;
    let notesCount = 0;
    let termsCount = 0;

    if (Array.isArray(courses)) {
      for (const c of courses) {
        if (c.title) {
          await courseRepository.create({
            ...c,
            userId,
          });
          coursesCount++;
        }
      }
    }

    if (Array.isArray(lessons)) {
      for (const l of lessons) {
        if (l.title && l.courseId) {
          await lessonRepository.create({
            ...l,
            userId,
          });
          lessonsCount++;
        }
      }
    }

    if (Array.isArray(notes)) {
      for (const n of notes) {
        if (n.title || n.content) {
          await noteRepository.create({
            ...n,
            userId,
          });
          notesCount++;
        }
      }
    }

    if (Array.isArray(terms)) {
      for (const t of terms) {
        if (t.term) {
          await keyTermRepository.create({
            ...t,
            userId,
          });
          termsCount++;
        }
      }
    }

    flushDatabaseSync();
    return res.json({
      success: true,
      imported: { coursesCount, lessonsCount, notesCount, termsCount },
    });
  } catch (err: any) {
    console.error('[API IMPORT DATA ERROR]', err);
    return res.status(500).json({ error: 'Failed to import user data.' });
  }
});

// Upload Profile Avatar
app.post('/api/profile/avatar', requireAuth, async (req: Request, res: Response) => {
  try {
    const { imageBase64, fileName = 'avatar.png' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = await storageService.saveFile(buffer, fileName, 'image/png', 'avatars');
    await userRepository.update(req.user!.id, { profileImage: result.url });

    return res.json({ profileImage: result.url });
  } catch (err: any) {
    console.error('[API AVATAR UPLOAD ERROR]', err);
    return res.status(500).json({ error: 'Failed to save profile picture.' });
  }
});

// Remove Profile Avatar
app.delete('/api/profile/avatar', requireAuth, async (req: Request, res: Response) => {
  try {
    await userRepository.update(req.user!.id, { profileImage: '' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to remove avatar.' });
  }
});

// Complete Onboarding
app.post('/api/profile/onboarding', requireAuth, async (req: Request, res: Response) => {
  try {
    const { interests } = req.body;
    const updated = await userRepository.update(req.user!.id, {
      hasCompletedOnboarding: true,
      onboardingCompleted: true,
      interests: Array.isArray(interests) ? interests : req.user!.interests,
    });
    return res.json({ user: updated ? sanitizeUser(updated) : req.user });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to complete onboarding.' });
  }
});

// ==========================================
// 3. BACKUP & DATA EXPORT (Objective 15)
// ==========================================

app.get('/api/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const exportData = await exportUserData(req.user!.id);
    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="mindly-vault-export-${dateStr}.json"`);
    return res.send(JSON.stringify(exportData, null, 2));
  } catch (err: any) {
    console.error('[API EXPORT ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate personal knowledge export.' });
  }
});

// ==========================================
// 4. DOCUMENT INGESTION (PDF, DOCX, TXT)
// ==========================================

app.post('/api/documents/extract', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileBase64, fileName, mimeType } = req.body;
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'File data and file name are required.' });
    }

    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'File exceeds maximum upload size of 25MB.' });
    }

    const extracted = await documentService.extractText(buffer, fileName, mimeType);
    return res.json({ extracted });
  } catch (err: any) {
    console.error('[API DOCUMENT EXTRACT ERROR]', err);
    return res.status(422).json({ error: err.message || 'Failed to extract text from document.' });
  }
});

// Serve Local Uploads
app.get('/api/uploads/:fileKey', async (req: Request, res: Response) => {
  try {
    const { fileKey } = req.params;
    const { buffer, mimeType } = await storageService.getFile(fileKey);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(404).json({ error: 'File not found.' });
  }
});

// ==========================================
// 5. COURSES ENDPOINTS
// ==========================================

app.get('/api/courses', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const courses = await courseRepository.findByUserId(userId);
  const lessons = await lessonRepository.findByUserId(userId);

  // Compute live lesson counts & progress for each course
  const augmented = courses.map((c) => {
    const courseLessons = lessons.filter((l) => l.courseId === c.id);
    const completed = courseLessons.filter((l) => l.isCompleted).length;
    const count = courseLessons.length;
    const progressPercent = count > 0 ? Math.round((completed / count) * 100) : 0;
    return {
      ...c,
      lessonCount: count,
      lessonsCount: count,
      completedLessonsCount: completed,
      progressPercent,
      progress: progressPercent,
    };
  });

  return res.json({ courses: augmented });
});

app.post('/api/courses', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id, title, description, category, coverIcon, coverImage, courseType } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Course title is required.' });
    }

    const newCourse = await courseRepository.create({
      id: id || undefined,
      userId: req.user!.id,
      title: title.trim(),
      description: description?.trim() || '',
      category: category || 'General',
      coverIcon: coverIcon || 'BookOpen',
      coverImage: coverImage || undefined,
      courseType: courseType || 'self-created',
    });

    await activityRepository.create({
      userId: req.user!.id,
      type: 'course_created',
      title: `Created course "${newCourse.title}"`,
      courseId: newCourse.id,
    });

    return res.status(201).json({ course: newCourse });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create course.' });
  }
});

app.get('/api/courses/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const course = await courseRepository.findById(req.params.id, userId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found or access denied.' });
  }
  const lessons = await lessonRepository.findByCourseId(req.params.id, userId);
  return res.json({ course, lessons: lessons || [] });
});

app.put('/api/courses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const updated = await courseRepository.update(req.params.id, req.user!.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }
    return res.json({ course: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update course.' });
  }
});

app.delete('/api/courses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await courseRepository.delete(req.params.id, req.user!.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }
    return res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete course.' });
  }
});

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Course Sharing: Generate or update persistent shareable snapshot
app.post('/api/courses/:id/share', requireAuth, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const userId = req.user!.id;
    const { creatorName } = req.body;

    const course = await courseRepository.findById(courseId, userId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }

    const lessons = await lessonRepository.findByCourseId(courseId, userId);
    const now = new Date().toISOString();
    const shareId = course.shareId || `sh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

    const sanitizedLessons = lessons.map((l, idx) => ({
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
      structuredContent: l.structuredContent,
      diagrams: l.diagrams || l.structuredContent?.diagrams || [],
      images: l.images || l.structuredContent?.images || [],
      quizzes: l.quizzes || l.structuredContent?.reviewQuestions || [],
    }));

    const sharedCourse = {
      id: shareId,
      courseId: course.id,
      creatorId: userId,
      creatorName: creatorName || req.user?.name || 'Mindly Learner',
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
    };

    await sharedCourseRepository.create(sharedCourse as any);
    firestoreAdminService.saveSharedCourse(sharedCourse as any).catch(() => {});

    await courseRepository.update(courseId, userId, { shareId } as any);

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const shareUrl = `${protocol}://${host}/share/course/${shareId}`;

    return res.json({ shareId, shareUrl, sharedCourse });
  } catch (err: any) {
    console.error('[API SHARE COURSE ERROR]', err);
    return res.status(500).json({ error: 'Failed to share course.' });
  }
});

// Course Sharing: Get public preview
app.get('/api/courses/shared/:shareId', async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    let sharedCourse = await sharedCourseRepository.findById(shareId);
    if (!sharedCourse) {
      sharedCourse = await firestoreAdminService.getSharedCourse(shareId);
    }
    if (!sharedCourse) {
      return res.status(404).json({ error: 'Shared course not found.' });
    }
    return res.json({ sharedCourse });
  } catch (err: any) {
    console.error('[API GET SHARED COURSE ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch shared course.' });
  }
});

// Course Importing: Clone shared course into recipient account
app.post('/api/courses/shared/:shareId/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const userId = req.user!.id;
    const force = req.query.force === 'true';

    let shared = await sharedCourseRepository.findById(shareId);
    if (!shared) {
      shared = await firestoreAdminService.getSharedCourse(shareId);
    }
    if (!shared) {
      return res.status(404).json({ error: 'Shared course could not be found or has expired.' });
    }

    // Check duplicate import
    if (!force) {
      const userCourses = await courseRepository.findByUserId(userId);
      const existing = userCourses.find((c) => (c as any).originalShareId === shareId);
      if (existing) {
        return res.status(200).json({
          alreadyImported: true,
          course: existing,
          message: `"${existing.title}" is already in your courses.`,
        });
      }
    }

    const now = new Date().toISOString();
    const newCourseId = `crs_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const totalLessons = Array.isArray(shared.lessons) ? shared.lessons.length : 0;

    const newCourse = await courseRepository.create({
      id: newCourseId,
      userId,
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
      lessonsCount: totalLessons,
      completedLessonsCount: 0,
      progressPercent: 0,
      isDemo: false,
    } as any);

    // Save originalShareId
    await courseRepository.update(newCourseId, userId, { originalShareId: shareId } as any);

    const createdLessons = [];
    if (Array.isArray(shared.lessons)) {
      for (let idx = 0; idx < shared.lessons.length; idx++) {
        const l = shared.lessons[idx];
        const lesson = await lessonRepository.create({
          id: `lsn_imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          courseId: newCourseId,
          userId,
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
          originalMaterial: l.originalMaterial || { type: 'text', content: '', uploadedAt: now },
          structuredContent: l.structuredContent,
          diagrams: l.diagrams || l.structuredContent?.diagrams || [],
          images: l.images || l.structuredContent?.images || [],
          quizzes: l.quizzes || l.structuredContent?.reviewQuestions || [],
        });
        createdLessons.push(lesson);
      }
    }

    await activityRepository.create({
      userId,
      type: 'course_imported',
      title: `Imported course "${shared.title}"`,
      courseId: newCourseId,
    });

    return res.status(201).json({ course: newCourse, lessons: createdLessons });
  } catch (err: any) {
    console.error('[API IMPORT SHARED COURSE ERROR]', err);
    return res.status(500).json({ error: 'Failed to import shared course.' });
  }
});

// Course Archival: Archive course
app.put('/api/courses/:id/archive', requireAuth, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const userId = req.user!.id;
    const updated = await courseRepository.archive(courseId, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }
    return res.json({ course: updated });
  } catch (err: any) {
    console.error('[API ARCHIVE COURSE ERROR]', err);
    return res.status(500).json({ error: 'Failed to archive course.' });
  }
});

// Course Archival: Unarchive course
app.put('/api/courses/:id/unarchive', requireAuth, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const userId = req.user!.id;
    const updated = await courseRepository.unarchive(courseId, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }
    return res.json({ course: updated });
  } catch (err: any) {
    console.error('[API UNARCHIVE COURSE ERROR]', err);
    return res.status(500).json({ error: 'Failed to unarchive course.' });
  }
});

// Course Progress: Reset course progress back to Day 1
app.post('/api/courses/:id/reset-progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const userId = req.user!.id;
    const course = await courseRepository.findById(courseId, userId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }

    const resetStudyDays = Array.isArray(course.studyDays)
      ? course.studyDays.map((sd) => ({
          ...sd,
          isPassed: false,
          quizScore: null,
        }))
      : [];

    const updated = await courseRepository.update(courseId, userId, {
      completedLessonsCount: 0,
      progressPercent: 0,
      progress: 0,
      isCompleted: false,
      finalExamPassed: false,
      finalExamScore: null,
      studyDays: resetStudyDays,
    });

    return res.json({ course: updated, success: true });
  } catch (err: any) {
    console.error('[API RESET COURSE PROGRESS ERROR]', err);
    return res.status(500).json({ error: 'Failed to reset course progress.' });
  }
});

// ==========================================
// 6. LESSONS ENDPOINTS
// ==========================================

app.get('/api/courses/:courseId/lessons', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const course = await courseRepository.findById(req.params.courseId, userId);
  if (!course) {
    return res.status(404).json({ error: 'Course not found or access denied.' });
  }
  const lessons = await lessonRepository.findByCourseId(req.params.courseId, userId);
  return res.json({ lessons });
});

app.post('/api/courses/:courseId/lessons', requireAuth, async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { id, title, structuredContent, originalMaterial } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Lesson title is required.' });
    }

    const existingLessons = await lessonRepository.findByCourseId(courseId);
    const newLesson = await lessonRepository.create({
      id: id || undefined,
      courseId,
      userId: req.user!.id,
      title: title.trim(),
      order: existingLessons.length + 1,
      isCompleted: false,
      isBookmarked: false,
      originalMaterial: originalMaterial || {
        type: 'text',
        content: '',
        uploadedAt: new Date().toISOString(),
      },
      structuredContent: structuredContent || {
        title: title.trim(),
        overview: 'Manual study lesson notes.',
        learningObjectives: ['Master fundamental principles.'],
        mainConcepts: [],
        examples: [],
        importantDistinctions: [],
        keyTerms: [],
        keyTakeaways: [],
        reviewQuestions: [],
      },
    });

    // Auto-sync extracted key terms into glossary repository
    if (structuredContent?.keyTerms && Array.isArray(structuredContent.keyTerms)) {
      for (const t of structuredContent.keyTerms) {
        if (t.term && t.definition) {
          await keyTermRepository.create({
            userId: req.user!.id,
            term: t.term,
            definition: t.definition,
            context: `${title} Glossary`,
            courseId,
            lessonId: newLesson.id,
            lessonTitle: newLesson.title,
          });
        }
      }
    }

    await activityRepository.create({
      userId: req.user!.id,
      type: 'lesson_created',
      title: `Added lesson "${newLesson.title}"`,
      courseId,
      lessonId: newLesson.id,
    });

    return res.status(201).json({ lesson: newLesson });
  } catch (err: any) {
    console.error('[API LESSON CREATE ERROR]', err);
    return res.status(500).json({ error: 'Failed to create lesson.' });
  }
});

app.get('/api/lessons/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const lesson = await lessonRepository.findById(req.params.id, userId);
  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found or access denied.' });
  }
  const course = await courseRepository.findById(lesson.courseId, userId);

  // If this lesson is a topic-based lesson that hasn't finished authoring, author it on-demand
  const hasSubstantiveContent =
    lesson.structuredContent &&
    Array.isArray(lesson.structuredContent.mainConcepts) &&
    lesson.structuredContent.mainConcepts.length > 0 &&
    Boolean(lesson.structuredContent.mainConcepts[0]?.explanation) &&
    lesson.structuredContent.mainConcepts[0].explanation.length > 40;

  if (!hasSubstantiveContent && !(lesson as any).isAuthoringInProgress) {
    try {
      console.log(`[ON-DEMAND AUTHORING] Authoring lesson "${lesson.title}" for course "${course?.title || ''}"...`);
      const allLessons = await lessonRepository.findByCourseId(lesson.courseId, userId);
      const priorTitles = allLessons.filter((l) => l.order < lesson.order).map((l) => l.title);

      const authored = await aiService.authorLesson({
        subject: course?.title || lesson.title,
        courseTitle: course?.title || lesson.title,
        courseDescription: course?.description || '',
        courseObjectives: course?.learningObjectives || [],
        lessonOrder: lesson.order,
        totalLessons: allLessons.length,
        lessonTitle: lesson.title,
        lessonOverview: lesson.structuredContent?.overview || '',
        keyConcepts: lesson.structuredContent?.mainConcepts?.map((c: any) => c.title) || [lesson.title],
        depth: (course?.depth as any) || 'standard',
        estimatedMinutes: 35,
        priorLessonTitles: priorTitles,
      });

      const updated = await lessonRepository.update(lesson.id, userId, {
        structuredContent: authored,
      });

      // Sync glossary terms
      if (authored.keyTerms && Array.isArray(authored.keyTerms)) {
        for (const kt of authored.keyTerms) {
          if (kt.term && kt.definition) {
            await keyTermRepository.create({
              userId: lesson.userId,
              term: kt.term,
              definition: kt.definition,
              context: `${course?.title || 'Course'} — ${lesson.title}`,
              courseId: lesson.courseId,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
            });
          }
        }
      }

      return res.json({ lesson: updated || lesson, course: course || null });
    } catch (err: any) {
      console.error('[ON-DEMAND AUTHORING ERROR]', err);
    }
  }

  return res.json({ lesson, course: course || null });
});

app.put('/api/lessons/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const updated = await lessonRepository.update(req.params.id, req.user!.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Lesson not found or access denied.' });
    }

    if (req.body.isCompleted !== undefined) {
      if (req.body.isCompleted && !updated.spacedRepetition) {
        const initialSR = {
          stage: 1,
          nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          reviewCount: 0,
          easeFactor: 2.5,
          intervalDays: 1,
          retentionEstimate: 95,
        };
        const withSR = await lessonRepository.update(req.params.id, req.user!.id, { spacedRepetition: initialSR });
        if (withSR) updated.spacedRepetition = withSR.spacedRepetition;
      }

      await activityRepository.create({
        userId: req.user!.id,
        type: req.body.isCompleted ? 'lesson_completed' : 'lesson_uncompleted',
        title: req.body.isCompleted ? `Completed "${updated.title}"` : `Marked "${updated.title}" for review`,
        courseId: updated.courseId,
        lessonId: updated.id,
      });
    }

    flushDatabaseSync();
    return res.json({ lesson: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update lesson.' });
  }
});

// Explicit Lesson Progress & Reading Position Write Operation
app.put('/api/lessons/:id/progress', requireAuth, async (req: Request, res: Response) => {
  try {
    const lessonId = req.params.id;
    const userId = req.user!.id;
    const { isCompleted, quizScore, scrollY, sectionId, userNotes, dayNumber } = req.body;

    const updates: any = {};
    if (typeof isCompleted === 'boolean') updates.isCompleted = isCompleted;
    if (typeof quizScore === 'number') updates.quizScore = quizScore;
    if (typeof userNotes === 'string') updates.userNotes = userNotes;

    if (scrollY !== undefined || sectionId !== undefined) {
      updates.readingPosition = {
        scrollY: Math.max(0, Math.round(Number(scrollY) || 0)),
        sectionId: typeof sectionId === 'string' ? sectionId : undefined,
        dayNumber: Number(dayNumber) || 1,
        updatedAt: new Date().toISOString(),
      };
    }

    const updated = await lessonRepository.update(lessonId, userId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Lesson not found or access denied.' });
    }

    if (isCompleted) {
      await activityRepository.create({
        userId,
        type: 'lesson_completed',
        title: `Completed "${updated.title}"`,
        courseId: updated.courseId,
        lessonId: updated.id,
      });
    }

    if (updated.courseId) {
      await courseRepository.update(updated.courseId, userId, {
        lastReadLessonId: lessonId,
      }).catch(() => {});
    }

    // Explicit write/commit to persistent store immediately
    flushDatabaseSync();
    return res.json({ success: true, lesson: updated });
  } catch (err: any) {
    console.error('[API LESSON PROGRESS ERROR]', err);
    return res.status(500).json({ error: 'Failed to update lesson progress.' });
  }
});

// Save Lesson Reading Position & Course Progress State
app.post('/api/lessons/:id/reading-position', requireAuth, async (req: Request, res: Response) => {
  try {
    const lessonId = req.params.id;
    const userId = req.user!.id;
    const { scrollY, sectionId, dayNumber } = req.body;

    const lesson = await lessonRepository.findById(lessonId, userId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    const readingPosition = {
      scrollY: Math.max(0, Math.round(Number(scrollY) || 0)),
      sectionId: typeof sectionId === 'string' ? sectionId : undefined,
      dayNumber: Number(dayNumber) || lesson.dayNumber || 1,
      updatedAt: new Date().toISOString(),
    };

    const updated = await lessonRepository.update(lessonId, userId, {
      readingPosition,
    });

    // Also update parent course's lastReadLessonId
    if (lesson.courseId) {
      await courseRepository
        .update(lesson.courseId, userId, {
          lastReadLessonId: lessonId,
        })
        .catch(() => {});
    }

    flushDatabaseSync();
    return res.json({ success: true, readingPosition, lesson: updated });
  } catch (err: any) {
    console.error('[API SAVE READING POSITION ERROR]', err);
    return res.status(500).json({ error: 'Failed to save reading position.' });
  }
});

app.delete('/api/lessons/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await lessonRepository.delete(req.params.id, req.user!.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Lesson not found or access denied.' });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete lesson.' });
  }
});

app.post('/api/lessons/:id/toggle-complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const lesson = await lessonRepository.findById(req.params.id, userId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found or access denied.' });
    }
    const nextCompleted = !lesson.isCompleted;
    const updated = await lessonRepository.update(lesson.id, userId, {
      isCompleted: nextCompleted,
    });
    return res.json({ success: true, lesson: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to toggle lesson completion.' });
  }
});

app.post('/api/lessons/:id/toggle-bookmark', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const lesson = await lessonRepository.findById(req.params.id, userId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found or access denied.' });
    }
    const updated = await lessonRepository.update(lesson.id, userId, {
      isBookmarked: !lesson.isBookmarked,
    });
    return res.json({ success: true, lesson: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to toggle lesson bookmark.' });
  }
});

// ==========================================
// 7. NOTES ENDPOINTS
// ==========================================

app.get('/api/notes', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const courseId = req.query.courseId as string | undefined;
  const lessonId = req.query.lessonId as string | undefined;

  const notes = await noteRepository.findByUserId(userId, { courseId, lessonId });
  return res.json({ notes });
});

app.post('/api/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, content, courseId, lessonId, tags, type } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Note title is required.' });
    }

    let courseTitle: string | undefined;
    let lessonTitle: string | undefined;

    if (courseId) {
      const c = await courseRepository.findById(courseId, req.user!.id);
      courseTitle = c?.title;
    }
    if (lessonId) {
      const l = await lessonRepository.findById(lessonId, req.user!.id);
      lessonTitle = l?.title;
    }

    const note = await noteRepository.create({
      userId: req.user!.id,
      title: title.trim(),
      content: content || '',
      courseId: courseId || null,
      lessonId: lessonId || null,
      courseTitle,
      lessonTitle,
      tags: Array.isArray(tags) ? tags : [],
      type: type || (lessonId ? 'lesson' : courseId ? 'course' : 'general'),
    });

    await activityRepository.create({
      userId: req.user!.id,
      type: 'note_created',
      title: `Created note "${note.title}"`,
      courseId: note.courseId || undefined,
      lessonId: note.lessonId || undefined,
    });

    return res.status(201).json({ note });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create note.' });
  }
});

app.put('/api/notes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const updated = await noteRepository.update(req.params.id, req.user!.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Note not found or access denied.' });
    }
    return res.json({ note: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update note.' });
  }
});

app.delete('/api/notes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await noteRepository.delete(req.params.id, req.user!.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Note not found or access denied.' });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete note.' });
  }
});

// ==========================================
// 8. KEY TERMS & GLOSSARY ENDPOINTS
// ==========================================

app.get('/api/terms', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const courseId = req.query.courseId as string | undefined;
  const terms = await keyTermRepository.findByUserId(userId, courseId);
  return res.json({ terms });
});

app.post('/api/terms', requireAuth, async (req: Request, res: Response) => {
  try {
    const { term, definition, context, relatedConcepts, courseId, lessonId, lessonTitle } = req.body;
    if (!term || !definition) {
      return res.status(400).json({ error: 'Term and definition are both required.' });
    }

    const created = await keyTermRepository.create({
      userId: req.user!.id,
      term: term.trim(),
      definition: definition.trim(),
      context: context || 'User defined',
      relatedConcepts: Array.isArray(relatedConcepts) ? relatedConcepts : [],
      courseId,
      lessonId,
      lessonTitle,
    });

    return res.status(201).json({ term: created });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create key term.' });
  }
});

app.delete('/api/terms/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await keyTermRepository.delete(req.params.id, req.user!.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Term not found or access denied.' });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete key term.' });
  }
});

// ==========================================
// 9. STUDY TIME TRACKING & GOAL ENDPOINTS
// ==========================================

app.post('/api/study-time/log', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lessonId, lessonTitle, seconds } = req.body;
    const secNum = parseInt(seconds, 10);

    if (isNaN(secNum) || secNum <= 0 || secNum > 3600) {
      return res.status(400).json({ error: 'Invalid study seconds. Must be between 1 and 3600 seconds.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    await studySessionRepository.logTime({
      userId: req.user!.id,
      lessonId,
      lessonTitle,
      seconds: secNum,
      date: todayStr,
    });

    const progress = await studySessionRepository.getProgress(req.user!.id, req.user!.dailyStudyGoalMinutes);
    return res.json({ success: true, progress });
  } catch (err: any) {
    console.error('[API STUDY LOG ERROR]', err);
    return res.status(500).json({ error: 'Failed to log study session.' });
  }
});

app.get('/api/study-time/progress', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const progress = await studySessionRepository.getProgress(userId, req.user?.dailyStudyGoalMinutes);
  return res.json({ progress });
});

// Route aliases for backward-compatibility
app.post('/api/study/log', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lessonId, lessonTitle, seconds } = req.body;
    const secNum = parseInt(seconds, 10);
    if (isNaN(secNum) || secNum <= 0) {
      return res.status(400).json({ error: 'Invalid study seconds.' });
    }
    const todayStr = new Date().toISOString().split('T')[0];
    await studySessionRepository.logTime({
      userId: req.user!.id,
      lessonId,
      lessonTitle,
      seconds: secNum,
      date: todayStr,
    });
    const progress = await studySessionRepository.getProgress(req.user!.id, req.user!.dailyStudyGoalMinutes);
    return res.json({ success: true, progress, todaySeconds: progress.todaySeconds });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to log study session.' });
  }
});

app.get('/api/study/progress', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const progress = await studySessionRepository.getProgress(userId, req.user?.dailyStudyGoalMinutes);
  return res.json({ progress });
});

app.post('/api/user/study-time', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lessonId, lessonTitle, seconds } = req.body;
    const secNum = parseInt(seconds, 10);
    if (isNaN(secNum) || secNum <= 0) {
      return res.status(400).json({ error: 'Invalid study seconds.' });
    }
    const todayStr = new Date().toISOString().split('T')[0];
    await studySessionRepository.logTime({
      userId: req.user!.id,
      lessonId,
      lessonTitle,
      seconds: secNum,
      date: todayStr,
    });
    const progress = await studySessionRepository.getProgress(req.user!.id, req.user!.dailyStudyGoalMinutes);
    return res.json({ success: true, progress, todaySeconds: progress.todaySeconds });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to log study session.' });
  }
});

// ==========================================
// 9.5 MICRO-ARTICLE DISCOVERY STREAM
// ==========================================

app.get('/api/micro-articles', authenticate, async (req: Request, res: Response) => {
  try {
    let interests: string[] = [];
    if (typeof req.query.interests === 'string' && req.query.interests.trim()) {
      interests = req.query.interests.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (req.user?.interests && Array.isArray(req.user.interests)) {
      interests = req.user.interests;
    }

    const articles = await microArticleService.getArticlesForInterests(interests);
    return res.json({ articles });
  } catch (err: any) {
    console.error('[MICRO-ARTICLES API ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve discovery micro-articles.' });
  }
});

// ==========================================
// 10. QUIZZES & ASSESSMENTS
// ==========================================

app.post('/api/quizzes/attempt', requireAuth, async (req: Request, res: Response) => {
  try {
    const { lessonId, score, totalQuestions, answers } = req.body;
    if (!lessonId || typeof score !== 'number' || typeof totalQuestions !== 'number') {
      return res.status(400).json({ error: 'Invalid quiz attempt data.' });
    }

    const attempt = await quizRepository.createAttempt({
      userId: req.user!.id,
      lessonId,
      score,
      totalQuestions,
      answers: answers || {},
      date: new Date().toISOString(),
    });

    const lesson = await lessonRepository.findById(lessonId, req.user!.id);
    if (lesson) {
      const percentage = Math.round((score / totalQuestions) * 100);
      await lessonRepository.update(lessonId, req.user!.id, { quizScore: percentage });

      await activityRepository.create({
        userId: req.user!.id,
        type: 'quiz_taken',
        title: `Scored ${score}/${totalQuestions} on quiz for "${lesson.title}"`,
        courseId: lesson.courseId,
        lessonId: lesson.id,
      });
    }

    return res.status(201).json({ attempt });
  } catch (err: any) {
    console.error('[API QUIZ ATTEMPT ERROR]', err);
    return res.status(500).json({ error: 'Failed to record quiz attempt.' });
  }
});

// ==========================================
// 11. RAW MATERIALS & ACTIVITY HISTORY
// ==========================================

app.get('/api/materials', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const materials = await materialRepository.findByUserId(userId);
  return res.json({ materials });
});

app.post('/api/materials', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, rawSnippet, type, courseId, courseTitle, lessonId, lessonTitle, status } = req.body;
    const item = await materialRepository.create({
      userId: req.user!.id,
      title: title || 'Learning Dump',
      rawSnippet: rawSnippet || '',
      type: type || 'notes',
      courseId,
      courseTitle,
      lessonId,
      lessonTitle,
      status: status || 'raw',
    });
    return res.status(201).json({ material: item });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record material dump.' });
  }
});

app.get('/api/activities', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const activities = await activityRepository.findByUserId(userId, 20);
  return res.json({ activities });
});

// ==========================================
// 12. GLOBAL SEARCH (Objective 12)
// ==========================================

app.get('/api/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const userId = req.user!.id;
    const results = await searchService.search(query, userId);
    return res.json({ results });
  } catch (err: any) {
    console.error('[API SEARCH ERROR]', err);
    return res.status(500).json({ error: 'Search failed.' });
  }
});

// ==========================================
// 13. AI SERVICES (Gemini 3.8 Flash)
// ==========================================

// Pedagogical Structuring
app.post('/api/ai/structure', async (req: Request, res: Response) => {
  try {
    const { rawContent, contentType, courseTitle, imageBase64, mimeType, customInstructions } = req.body;
    const aiStrictness = req.user?.settings?.aiStrictness || 'balanced';

    const structured = await aiService.structureMaterial({
      rawContent,
      contentType,
      courseTitle,
      imageBase64,
      mimeType,
      customInstructions,
      aiStrictness,
    });

    return res.json({ structured });
  } catch (err: any) {
    console.error('[API AI STRUCTURE ERROR]', err);
    return res.status(500).json({
      error: 'Could not structure your learning material. Your raw input remains safe.',
      details: err.message,
    });
  }
});

// Contextual AI Tutor
app.post('/api/ai/tutor', async (req: Request, res: Response) => {
  try {
    const { question, lessonContext, courseContext, originalMaterial } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question cannot be empty.' });
    }

    const aiStrictness = req.user?.settings?.aiStrictness || 'balanced';
    const answer = await aiService.askTutor({
      question: question.trim(),
      lessonContext,
      courseContext,
      originalMaterial,
      aiStrictness,
    });

    return res.json({ answer });
  } catch (err: any) {
    console.error('[API AI TUTOR ERROR]', err);
    return res.status(500).json({ error: 'Study tutor is temporarily unavailable. Please try again.' });
  }
});

// Floating AI Study Assistant with Note & Glossary Search
app.post('/api/ai/assistant-chat', async (req: Request, res: Response) => {
  try {
    const { messages, activeLesson, activeCourse, notes, terms } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    const result = await aiService.assistantChat({
      messages,
      activeLesson,
      activeCourse,
      notes: Array.isArray(notes) ? notes : [],
      terms: Array.isArray(terms) ? terms : [],
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[API AI ASSISTANT CHAT ERROR]', err);
    return res.status(500).json({
      error: 'AI Study Assistant is temporarily unavailable. Please try again.',
      details: err?.message,
    });
  }
});

// Quiz Generation
app.post('/api/ai/generate-quiz', async (req: Request, res: Response) => {
  try {
    const { lessonTitle, overview, mainConcepts, keyTerms } = req.body;
    if (!lessonTitle) {
      return res.status(400).json({ error: 'Lesson title is required.' });
    }

    const questions = await aiService.generateQuiz({
      lessonTitle,
      overview: overview || '',
      mainConcepts: mainConcepts || [],
      keyTerms,
    });

    return res.json({ questions });
  } catch (err: any) {
    console.error('[API AI GENERATE QUIZ ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate review quiz.' });
  }
});

// Audio Transcription (Gemini-3.5-Transcribe)
app.post('/api/audio/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, mode, promptHint } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required for transcription.' });
    }

    const result = await transcriptionService.transcribe({
      audioBase64,
      mimeType: mimeType || 'audio/webm',
      mode: mode || 'capture_lesson',
      promptHint,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[API AUDIO TRANSCRIBE ERROR]', err);
    return res.status(500).json({
      error: 'Audio transcription failed. Please verify microphone audio clarity and try again.',
      details: err.message,
    });
  }
});

// Dynamic Semantic Topic Discovery ("Instant Course Suggestions")
app.post('/api/topics/suggest', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await aiService.suggestTopics(query.trim());
    return res.json({ suggestions });
  } catch (err: any) {
    console.error('[API TOPICS SUGGEST ERROR]', err);
    return res.status(500).json({ error: 'Failed to suggest topics.', suggestions: [] });
  }
});

// AI Subtopics Discovery for any topic
app.post('/api/ai/subtopics', async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required.' });
    }

    const subtopics = await aiService.discoverSubtopics(topic.trim());
    return res.json({ subtopics });
  } catch (err: any) {
    console.error('[API AI SUBTOPICS ERROR]', err);
    return res.status(500).json({ error: 'Failed to discover subtopics.' });
  }
});

// AI Course Curriculum Plan & Duration Engine
app.post('/api/ai/course-plan', async (req: Request, res: Response) => {
  try {
    const { topic, subtopics, depth, dailyMinutes, dailyMinutesRange } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required.' });
    }

    const plan = await aiService.generateCoursePlan({
      topic: topic.trim(),
      subtopics: Array.isArray(subtopics) ? subtopics : [],
      depth: depth || 'standard',
      dailyMinutes: Number(dailyMinutes) || 30,
      dailyMinutesRange: dailyMinutesRange || '30–60 minutes/day',
    });

    return res.json({ plan });
  } catch (err: any) {
    console.error('[API AI COURSE PLAN ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate course curriculum plan.' });
  }
});

// =========================================================================
// PHASE 1 ISOLATED TEST HARNESS: LESSON AUTHORING & VALIDATION
// Does NOT touch database records, course creation, or existing pipelines.
// =========================================================================
app.post('/api/dev/test-author-lesson', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const options = req.body;
    if (!options.subject || !options.lessonTitle) {
      return res.status(400).json({ error: 'subject and lessonTitle are required.' });
    }

    const lesson = await aiService.authorLesson({
      subject: options.subject,
      courseTitle: options.courseTitle || `${options.subject} Foundations`,
      courseDescription: options.courseDescription || 'Comprehensive curriculum.',
      courseObjectives: Array.isArray(options.courseObjectives) ? options.courseObjectives : ['Master core principles.'],
      lessonOrder: Number(options.lessonOrder) || 1,
      totalLessons: Number(options.totalLessons) || 7,
      lessonTitle: options.lessonTitle,
      lessonOverview: options.lessonOverview || '',
      keyConcepts: Array.isArray(options.keyConcepts) ? options.keyConcepts : ['Foundations'],
      depth: options.depth || 'standard',
      estimatedMinutes: Number(options.estimatedMinutes) || 35,
      priorLessonTitles: Array.isArray(options.priorLessonTitles) ? options.priorLessonTitles : [],
    });

    const latencyMs = Date.now() - startTime;
    const validation = aiService.validateLessonContent(lesson, options);

    return res.json({
      success: true,
      latencyMs,
      validation,
      lesson,
    });
  } catch (err: any) {
    console.error('[DEV TEST AUTHOR LESSON ERROR]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Lesson authoring failed.',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Create Full Course from Curriculum Plan
app.post('/api/courses/create-from-plan', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      category,
      depth,
      dailyMinutesRange,
      dailyMinutes,
      estimatedDays,
      modules,
      days,
      finalExam,
    } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Course title is required.' });
    }

    const userId = req.user!.id;

    // Process Study Days & End-of-Day Milestone Gates
    const studyDays = Array.isArray(days) && days.length > 0
      ? days.map((d: any, dIdx: number) => ({
          dayNumber: Number(d.dayNumber) || dIdx + 1,
          title: d.title || `Day ${dIdx + 1}: Core Principles`,
          overview: d.overview || '',
          estimatedMinutes: Number(d.estimatedMinutes) || 35,
          checkInQuiz: Array.isArray(d.checkInQuiz) ? d.checkInQuiz : [],
          isPassed: false,
          score: null,
        }))
      : [];

    // Create course with Day-by-Day structure
    const course = await courseRepository.create({
      userId,
      title: title.trim(),
      description: description || 'Curated personalized learning journey.',
      category: category || 'General Knowledge',
      coverIcon: req.body.coverIcon || 'BookOpen',
      coverImage: req.body.coverImage || undefined,
      depth: depth || 'standard',
      dailyMinutesRange: dailyMinutesRange || '30–60 minutes/day',
      dailyStudyGoalMinutes: Number(dailyMinutes) || 35,
      estimatedDays: Number(estimatedDays) || (studyDays.length || 7),
      studyDays,
      finalExam: Array.isArray(finalExam) ? finalExam : [],
      finalExamPassed: false,
      finalExamScore: null,
      lessonsCount: Array.isArray(modules) ? modules.length : 0,
      completedLessonsCount: 0,
      progressPercent: 0,
      isDemo: false,
    });

    // Create planned lessons
    const createdLessons = [];
    if (Array.isArray(modules) && modules.length > 0) {
      const subject = req.body.subject || req.body.topic || title;

      // 1. Author the first lesson immediately with substantive educational content
      const firstMod = modules[0];
      const firstDayNum = firstMod.dayNumber || 1;
      const firstDayTitle = firstMod.dayTitle || (studyDays[0]?.title || `Day 1: Foundations`);

      console.log(`[CREATE-FROM-PLAN] Authoring Lesson 1: "${firstMod.title}" for subject "${subject}"...`);

      let firstLessonContent: any;
      try {
        firstLessonContent = await aiService.authorLesson({
          subject,
          courseTitle: course.title,
          courseDescription: course.description,
          courseObjectives: course.learningObjectives || [],
          lessonOrder: 1,
          totalLessons: modules.length,
          lessonTitle: firstMod.title,
          lessonOverview: firstMod.overview || '',
          keyConcepts: Array.isArray(firstMod.keyTopics) && firstMod.keyTopics.length > 0 ? firstMod.keyTopics : [firstMod.title],
          depth: depth || 'standard',
          estimatedMinutes: Number(firstMod.estimatedMinutes) || 35,
          priorLessonTitles: [],
        });
      } catch (authorErr: any) {
        console.error('[CREATE-FROM-PLAN FIRST LESSON AUTHORING ERROR]', authorErr);
        throw new Error(`Failed to author initial lesson: ${authorErr.message}`);
      }

      const firstLesson = await lessonRepository.create({
        courseId: course.id,
        userId,
        title: firstMod.title || 'Lesson 1',
        order: 1,
        dayNumber: firstDayNum,
        dayTitle: firstDayTitle,
        isLocked: false, // First day's initial lesson is always accessible
        isCompleted: false,
        isBookmarked: false,
        originalMaterial: {
          type: 'text',
          content: `Curriculum module: ${firstMod.title}\n\nOverview:\n${firstMod.overview || ''}\n\nKey Concepts:\n${(firstMod.keyTopics || []).join(', ')}`,
          uploadedAt: new Date().toISOString(),
        },
        structuredContent: firstLessonContent,
      });

      // Sync glossary terms for Lesson 1
      if (firstLessonContent?.keyTerms && Array.isArray(firstLessonContent.keyTerms)) {
        for (const kt of firstLessonContent.keyTerms) {
          if (kt.term && kt.definition) {
            await keyTermRepository.create({
              userId,
              term: kt.term,
              definition: kt.definition,
              context: `${course.title} — ${firstLesson.title}`,
              courseId: course.id,
              lessonId: firstLesson.id,
              lessonTitle: firstLesson.title,
            });
          }
        }
      }

      createdLessons.push(firstLesson);

      // 2. Create shell entries for subsequent lessons
      for (let i = 1; i < modules.length; i++) {
        const mod = modules[i];
        const dayNum = mod.dayNumber || Math.floor(i / 2) + 1;
        const matchingDay = studyDays.find((d) => d.dayNumber === dayNum);
        const dayTitle = mod.dayTitle || matchingDay?.title || `Day ${dayNum}: Core Study`;
        // Subsequent days are locked until previous day's milestone gate is passed!
        const isLocked = dayNum > 1;

        const newLesson = await lessonRepository.create({
          courseId: course.id,
          userId,
          title: mod.title || `Lesson ${i + 1}`,
          order: i + 1,
          dayNumber: dayNum,
          dayTitle,
          isLocked,
          isCompleted: false,
          isBookmarked: false,
          originalMaterial: {
            type: 'text',
            content: `Curriculum module: ${mod.title}\n\nOverview:\n${mod.overview || ''}\n\nKey Concepts:\n${(mod.keyTopics || []).join(', ')}`,
            uploadedAt: new Date().toISOString(),
          },
          structuredContent: {
            title: mod.title || `Lesson ${i + 1}`,
            overview: mod.overview || `Essential concepts and principles for ${mod.title}.`,
            learningObjectives: Array.isArray(mod.learningObjectives) ? mod.learningObjectives : [`Understand core principles of ${mod.title}`],
            mainConcepts: (mod.keyTopics || [mod.title]).map((topicName: string, idx: number) => ({
              id: `c_${idx + 1}`,
              title: topicName,
              explanation: '',
              subtopics: [],
            })),
            diagrams: [],
            images: [],
            examples: [],
            importantDistinctions: [],
            keyTerms: [],
            keyTakeaways: [],
            reviewQuestions: [],
          },
        });

        createdLessons.push(newLesson);
      }

      // 3. Initiate asynchronous background authoring with intelligent throttle to avoid rate limits
      (async () => {
        for (let i = 1; i < modules.length; i++) {
          const mod = modules[i];
          const lessonRec = createdLessons[i];
          if (!lessonRec) continue;
          if (currentlyAuthoringLessonIds.has(lessonRec.id)) {
            console.log(`[BACKGROUND AUTHORING] Lesson ${lessonRec.id} is already queued/authoring. Skipping duplicate.`);
            continue;
          }
          currentlyAuthoringLessonIds.add(lessonRec.id);

          const priorLessonTitles = modules.slice(0, i).map((m: any) => m.title);
          try {
            // Respectful throttle between calls
            await new Promise((res) => setTimeout(res, 2000));
            console.log(`[BACKGROUND AUTHORING] Authoring Lesson ${i + 1}: "${mod.title}"...`);
            const authored = await aiService.authorLesson({
              subject,
              courseTitle: course.title,
              courseDescription: course.description,
              courseObjectives: course.learningObjectives || [],
              lessonOrder: i + 1,
              totalLessons: modules.length,
              lessonTitle: mod.title,
              lessonOverview: mod.overview || '',
              keyConcepts: Array.isArray(mod.keyTopics) && mod.keyTopics.length > 0 ? mod.keyTopics : [mod.title],
              depth: depth || 'standard',
              estimatedMinutes: Number(mod.estimatedMinutes) || 35,
              priorLessonTitles,
            });

            await lessonRepository.update(lessonRec.id, userId, {
              structuredContent: authored,
            });

            if (authored.keyTerms && Array.isArray(authored.keyTerms)) {
              for (const kt of authored.keyTerms) {
                if (kt.term && kt.definition) {
                  await keyTermRepository.create({
                    userId,
                    term: kt.term,
                    definition: kt.definition,
                    context: `${course.title} — ${mod.title}`,
                    courseId: course.id,
                    lessonId: lessonRec.id,
                    lessonTitle: mod.title,
                  });
                }
              }
            }
            console.log(`[BACKGROUND AUTHORING] Finished Lesson ${i + 1}: "${mod.title}"`);
          } catch (bgErr) {
            console.error(`[BACKGROUND AUTHORING ERROR Lesson ${i + 1}]`, bgErr);
          } finally {
            currentlyAuthoringLessonIds.delete(lessonRec.id);
          }
        }
      })();
    }

    // Mark user onboarding complete and update study goal
    await userRepository.update(userId, {
      hasCompletedOnboarding: true,
      dailyStudyGoalMinutes: Number(dailyMinutes) || 35,
    });

    await activityRepository.create({
      userId,
      type: 'course_created',
      title: `Created course "${course.title}" (${depth} depth, ${studyDays.length || 7} Study Days)`,
      courseId: course.id,
    });

    // Execute explicit write/commit operation to persistent store immediately
    flushDatabaseSync();

    return res.status(201).json({
      course,
      lessons: createdLessons,
      firstLessonId: createdLessons[0]?.id || null,
    });
  } catch (err: any) {
    console.error('[API CREATE FROM PLAN ERROR]', err);
    return res.status(500).json({ error: 'Failed to create course from plan.' });
  }
});

// Pass End-of-Day Milestone Gate (Daily Check-in Quiz)
app.post('/api/courses/:id/pass-day-checkin', requireAuth, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const userId = req.user!.id;
    const { dayNumber, score, totalQuestions } = req.body;

    const course = await courseRepository.findById(courseId, userId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const dayNum = Number(dayNumber);
    const studyDays = course.studyDays || [];
    const dayTarget = studyDays.find((d) => d.dayNumber === dayNum);

    if (dayTarget) {
      dayTarget.isPassed = true;
      dayTarget.score = Number(score) || 100;
      dayTarget.passedAt = new Date().toISOString();
    }

    // Unlock lessons for the next study day (dayNum + 1)
    const nextDayNum = dayNum + 1;
    const allCourseLessons = await lessonRepository.findByCourseId(courseId, userId);
    let unlockedCount = 0;

    for (const l of allCourseLessons) {
      if (l.dayNumber === nextDayNum && l.isLocked) {
        await lessonRepository.update(l.id, userId, { isLocked: false });
        unlockedCount++;
      }
    }

    const updatedCourse = await courseRepository.update(courseId, userId, {
      studyDays,
    });

    await activityRepository.create({
      userId,
      type: 'quiz_completed',
      title: `Completed Day ${dayNum} Milestone Check-in (${score}/${totalQuestions || 3}) for "${course.title}"`,
      courseId,
    });

    flushDatabaseSync();
    const refreshedLessons = await lessonRepository.findByCourseId(courseId, userId);

    return res.json({
      success: true,
      course: updatedCourse,
      lessons: refreshedLessons,
      unlockedDay: nextDayNum,
      unlockedCount,
    });
  } catch (err: any) {
    console.error('[PASS DAY CHECKIN ERROR]', err);
    return res.status(500).json({ error: 'Failed to record day milestone check-in.' });
  }
});

// Pass Comprehensive Final Exam
app.post('/api/courses/:id/pass-final-exam', requireAuth, async (req: Request, res: Response) => {
  try {
    const courseId = req.params.id;
    const userId = req.user!.id;
    const { score, totalQuestions } = req.body;

    const course = await courseRepository.findById(courseId, userId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const updatedCourse = await courseRepository.update(courseId, userId, {
      finalExamPassed: true,
      finalExamScore: Number(score) || 100,
      finalExamPassedAt: new Date().toISOString(),
      isCompleted: true,
      progressPercent: 100,
    });

    // Auto-award graduation certificate
    const existingCerts = await certificateRepository.findByUserId(userId);
    let cert = existingCerts.find((c) => c.courseId === courseId);
    if (!cert) {
      cert = await certificateRepository.create({
        userId,
        courseId,
        certificateId: '',
        realName: req.user!.realName || req.user!.name || 'Learner',
        courseTitle: course.title,
        completionDate: new Date().toISOString(),
        verificationCode: '',
        grade: 'Distinction',
        totalLessons: course.lessonsCount || 7,
      });
    }

    await activityRepository.create({
      userId,
      type: 'course_completed',
      title: `Graduated "${course.title}" by passing Comprehensive Final Exam!`,
      courseId,
    });

    return res.json({
      success: true,
      course: updatedCourse,
      certificate: cert,
    });
  } catch (err: any) {
    console.error('[PASS FINAL EXAM ERROR]', err);
    return res.status(500).json({ error: 'Failed to record final exam graduation.' });
  }
});

// Real-world Royalty-free Image Search API (Wikimedia Commons)
app.get('/api/media/search-images', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || req.query.query || '').trim();
    if (!q) {
      return res.json({ images: [] });
    }
    const images = await searchWikimediaImages(q, 4);
    return res.json({ images });
  } catch (err: any) {
    console.error('[MEDIA SEARCH ERROR]', err);
    return res.status(500).json({ error: 'Failed to search Wikimedia Commons images.', images: [] });
  }
});

// ==========================================
// 12. CERTIFICATES & COMPLETIONS ENDPOINTS
// ==========================================

// Get all certificates for current user
app.get('/api/certificates', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const certificates = await certificateRepository.findByUserId(userId);
    const combinedCertificates = await combinedCertificateRepository.findByUserId(userId);
    return res.json({ certificates, combinedCertificates });
  } catch (err: any) {
    console.error('[API GET CERTIFICATES ERROR]', err);
    return res.status(500).json({ error: 'Failed to fetch certificates.' });
  }
});

// Generate certificate for a completed course
app.post('/api/certificates/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required.' });
    }

    const course = await courseRepository.findById(courseId, userId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }

    // Check if certificate already exists
    const existing = await certificateRepository.findByCourseId(courseId, userId);
    if (existing) {
      return res.json({ certificate: existing, isExisting: true });
    }

    const lessons = await lessonRepository.findByCourseId(courseId, userId);
    const completedCount = lessons.filter((l) => l.isCompleted).length;
    const totalLessons = lessons.length || 1;

    // Strict validation: course MUST be legitimately completed
    const isCompleted =
      course.isCompleted ||
      (lessons.length > 0 && completedCount >= lessons.length) ||
      Boolean(course.finalExamPassed);

    if (!isCompleted) {
      return res.status(400).json({
        error: 'Cannot issue certificate: Course curriculum is not completed yet.',
      });
    }

    // Strict Real Name rule: certificates strictly use the user's LEGAL REAL NAME, NOT username or placeholder
    const realName = (req.user!.realName || req.user!.name || '').trim();
    if (!realName || realName.toLowerCase() === 'mindly learner' || realName.startsWith('@')) {
      return res.status(400).json({
        error: 'A valid real name is required on your profile to issue certificates.',
      });
    }

    const certificate = await certificateRepository.create({
      userId,
      courseId,
      certificateId: '', // Auto-generated with MND- prefix
      realName,
      courseTitle: course.title,
      completionDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      verificationCode: '',
      totalLessons,
      hoursInvested: Number(
        (((totalLessons * (course.depth === 'deep' ? 45 : course.depth === 'quick' ? 15 : 25)) / 60)).toFixed(1)
      ),
    });

    // Mark course complete in course repo
    await courseRepository.update(courseId, userId, {
      isCompleted: true,
      completedLessonsCount: totalLessons,
      certificateId: certificate.certificateId,
    });

    // Authoritative Server-side persistence to Firestore
    try {
      await firestoreAdminService.saveCertificateToFirestore(certificate);
    } catch (fsErr: any) {
      console.warn('[SERVER FIREBASE] Direct Firestore write note:', firestoreAdminService.getFirestoreBlockerMessage(fsErr));
    }

    // Record activity
    await activityRepository.create({
      userId,
      type: 'certificate_earned',
      title: `Earned Certificate of Completion for "${course.title}" (${certificate.certificateId})`,
      courseId,
    });

    return res.status(201).json({ certificate, isExisting: false });
  } catch (err: any) {
    console.error('[API GENERATE CERTIFICATE ERROR]', err);
    return res.status(500).json({ error: 'Failed to generate certificate.' });
  }
});

// Generate combined certificate for multiple completed courses
app.post('/api/certificates/combined', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { certificateIds } = req.body;
    if (!certificateIds || !Array.isArray(certificateIds) || certificateIds.length < 2) {
      return res.status(400).json({ error: 'Select at least two completed course certificates to combine.' });
    }

    // Check for duplicate references
    const uniqueIds = new Set(certificateIds.map((id: any) => String(id).trim()));
    if (uniqueIds.size !== certificateIds.length) {
      return res.status(400).json({ error: 'Duplicate certificates cannot be included in a combined certificate.' });
    }

    // Fetch all certificates belonging to the authenticated user
    const userCerts = await certificateRepository.findByUserId(userId);
    const selectedCerts = userCerts.filter(
      (c) => certificateIds.includes(c.id) || certificateIds.includes(c.certificateId)
    );

    // Verify ownership of every component certificate:
    // Every ID in certificateIds must match a distinct certificate belonging to this authenticated user
    if (selectedCerts.length !== certificateIds.length || selectedCerts.length < 2) {
      return res.status(400).json({
        error: 'All component certificates must be valid and belong to your verified profile.',
      });
    }

    const realName = (req.user!.realName || req.user!.name || '').trim();
    if (!realName || realName.toLowerCase() === 'mindly learner' || realName.startsWith('@')) {
      return res.status(400).json({
        error: 'A valid real name is required on your profile to issue certificates.',
      });
    }

    const courseTitles = selectedCerts.map((c) => c.courseTitle);
    const validCertIds = selectedCerts.map((c) => c.certificateId);

    const combinedCert = await combinedCertificateRepository.create({
      userId,
      certificateId: '', // Auto-generated MND-COMB-
      realName,
      courseTitles,
      certificateIds: validCertIds,
      completionDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      verificationCode: '',
    });

    // Authoritative Server-side persistence to Firestore
    try {
      await firestoreAdminService.saveCombinedCertificateToFirestore(combinedCert);
    } catch (fsErr: any) {
      console.warn('[SERVER FIREBASE] Direct Firestore combined write note:', firestoreAdminService.getFirestoreBlockerMessage(fsErr));
    }

    await activityRepository.create({
      userId,
      type: 'certificate_earned',
      title: `Issued Combined Master Certificate (${combinedCert.certificateId}) covering ${courseTitles.length} courses`,
    });

    return res.status(201).json({ combinedCertificate: combinedCert });
  } catch (err: any) {
    console.error('[API CREATE COMBINED CERTIFICATE ERROR]', err);
    return res.status(500).json({ error: 'Failed to create combined certificate.' });
  }
});

// Verify certificate (Publicly accessible — authoritative Firestore check with legacy fallback and blocker reporting)
app.get('/api/certificates/verify/:certId', async (req: Request, res: Response) => {
  try {
    const rawCertId = String(req.params.certId || '').trim();
    if (!rawCertId || rawCertId.length > 50 || !/^[A-Za-z0-9_-]+$/.test(rawCertId)) {
      return res.status(400).json({ verified: false, error: 'Invalid certificate ID format.' });
    }

    const isCombined = rawCertId.toUpperCase().startsWith('MND-COMB-');

    // 1. Authoritative Cloud Firestore lookup via trusted server-side client
    let firestoreRecord: any = null;
    let firestoreBlocker: string | null = null;

    try {
      if (isCombined) {
        firestoreRecord = await firestoreAdminService.getCombinedCertificateFromFirestore(rawCertId);
      } else {
        firestoreRecord = await firestoreAdminService.getCertificateFromFirestore(rawCertId);
      }
    } catch (fsErr: any) {
      firestoreBlocker = firestoreAdminService.getFirestoreBlockerMessage(fsErr);
      console.warn('[VERIFY] Authoritative Firestore access blocked:', firestoreBlocker);
    }

    // If verified in authoritative Firestore, return approved public verification fields
    if (firestoreRecord) {
      if (isCombined) {
        return res.json({
          verified: true,
          source: 'firestore',
          type: 'combined',
          certificateId: firestoreRecord.certificateId,
          realName: firestoreRecord.realName,
          courseTitles: firestoreRecord.courseTitles,
          completionDate: firestoreRecord.completionDate,
          verificationCode: firestoreRecord.verificationCode,
        });
      } else {
        return res.json({
          verified: true,
          source: 'firestore',
          type: 'individual',
          certificateId: firestoreRecord.certificateId,
          realName: firestoreRecord.realName,
          courseTitle: firestoreRecord.courseTitle,
          completionDate: firestoreRecord.completionDate,
          verificationCode: firestoreRecord.verificationCode,
          totalLessons: firestoreRecord.totalLessons,
          hoursInvested: firestoreRecord.hoursInvested,
        });
      }
    }

    // 2. Legacy repository verification (preserves verification for existing legacy credentials)
    let legacyRecord: any = null;
    if (isCombined) {
      legacyRecord = await combinedCertificateRepository.findByCertificateId(rawCertId);
    } else {
      legacyRecord = await certificateRepository.findByCertificateId(rawCertId);
    }

    if (legacyRecord) {
      const responsePayload: any = {
        verified: true,
        source: 'legacy_store',
        type: isCombined ? 'combined' : 'individual',
        certificateId: legacyRecord.certificateId,
        realName: legacyRecord.realName,
        completionDate: legacyRecord.completionDate,
        verificationCode: legacyRecord.verificationCode,
      };

      if (isCombined) {
        responsePayload.courseTitles = legacyRecord.courseTitles;
      } else {
        responsePayload.courseTitle = legacyRecord.courseTitle;
        responsePayload.totalLessons = legacyRecord.totalLessons;
        responsePayload.hoursInvested = legacyRecord.hoursInvested;
      }

      // Explicitly report Firestore blocker when server-side Firestore access is unprovisioned
      if (firestoreBlocker) {
        responsePayload.firestoreBlocker = firestoreBlocker;
      }

      return res.json(responsePayload);
    }

    // 3. Certificate not found
    const notFoundPayload: any = {
      verified: false,
      error: 'Certificate record not found.',
    };
    if (firestoreBlocker) {
      notFoundPayload.firestoreBlocker = firestoreBlocker;
    }

    return res.status(404).json(notFoundPayload);
  } catch (err: any) {
    return res.status(500).json({ verified: false, error: 'Verification check failed.' });
  }
});

// Idempotent Certificate Migration Endpoint
app.post('/api/certificates/migrate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { certificates = [], combinedCertificates = [] } = req.body;

    let migratedCerts = 0;
    let migratedCombined = 0;

    const existingUserCerts = await certificateRepository.findByUserId(userId);
    const existingCertIds = new Set(existingUserCerts.map((c) => c.certificateId.toUpperCase()));

    for (const cert of certificates) {
      if (cert.certificateId && !existingCertIds.has(cert.certificateId.toUpperCase())) {
        await certificateRepository.create({
          ...cert,
          userId,
        });
        existingCertIds.add(cert.certificateId.toUpperCase());
        migratedCerts++;
      }
    }

    const existingUserComb = await combinedCertificateRepository.findByUserId(userId);
    const existingCombIds = new Set(existingUserComb.map((c) => c.certificateId.toUpperCase()));

    for (const comb of combinedCertificates) {
      if (comb.certificateId && !existingCombIds.has(comb.certificateId.toUpperCase())) {
        await combinedCertificateRepository.create({
          ...comb,
          userId,
        });
        existingCombIds.add(comb.certificateId.toUpperCase());
        migratedCombined++;
      }
    }

    const allCerts = await certificateRepository.findByUserId(userId);
    const allCombined = await combinedCertificateRepository.findByUserId(userId);

    return res.json({
      success: true,
      migratedCerts,
      migratedCombined,
      certificates: allCerts,
      combinedCertificates: allCombined,
    });
  } catch (err: any) {
    console.error('[API MIGRATE CERTIFICATES ERROR]', err);
    return res.status(500).json({ error: 'Failed to process certificate migration.' });
  }
});

// ==========================================
// 13. COMMUNITY (Circles, Discussions, Rooms, Profiles)
// ==========================================

// Get all circles
app.get('/api/community/circles', async (req: Request, res: Response) => {
  try {
    const circles = await circleRepository.findAll(req.user?.id);
    return res.json({ circles });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch learning circles.' });
  }
});

// Create circle
app.post('/api/community/circles', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, description, topic } = req.body;
    if (!name || !topic) {
      return res.status(400).json({ error: 'Name and topic are required.' });
    }

    const circle = await circleRepository.create({
      name: name.trim(),
      description: (description || '').trim(),
      topic: topic.trim(),
    });

    await circleRepository.join(circle.id, req.user!.id);
    return res.status(201).json({ circle: { ...circle, isJoined: true } });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create circle.' });
  }
});

// Join circle
app.post('/api/community/circles/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const circleId = req.params.id;
    await circleRepository.join(circleId, req.user!.id);
    await activityRepository.create({
      userId: req.user!.id,
      type: 'circle_joined',
      title: `Joined the "${circleId}" study circle`,
    });
    return res.json({ success: true, message: 'Joined circle.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to join circle.' });
  }
});

// Leave circle
app.post('/api/community/circles/:id/leave', requireAuth, async (req: Request, res: Response) => {
  try {
    const circleId = req.params.id;
    await circleRepository.leave(circleId, req.user!.id);
    return res.json({ success: true, message: 'Left circle.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to leave circle.' });
  }
});

// Get discussions
app.get('/api/community/discussions', async (req: Request, res: Response) => {
  try {
    const circleId = req.query.circleId ? String(req.query.circleId) : undefined;
    const discussions = await discussionRepository.findAll(circleId);
    return res.json({ discussions });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch discussions.' });
  }
});

// Create discussion
app.post('/api/community/discussions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, content, type, circleId, circleName } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const discussion = await discussionRepository.create({
      userId: req.user!.id,
      authorName: req.user!.realName || req.user!.name || 'Mindly Learner',
      authorUsername: req.user!.username || '@learner',
      authorAvatar: req.user!.profileImage,
      circleId,
      circleName,
      title: title.trim(),
      content: content.trim(),
      type: type || 'discussion',
    });

    await activityRepository.create({
      userId: req.user!.id,
      type: 'discussion_created',
      title: `Started discussion: "${discussion.title}"`,
    });

    return res.status(201).json({ discussion });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create discussion post.' });
  }
});

// Add reply to discussion
app.post('/api/community/discussions/:id/replies', requireAuth, async (req: Request, res: Response) => {
  try {
    const discussionId = req.params.id;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Reply content cannot be empty.' });
    }

    const reply = await discussionRepository.addReply({
      discussionId,
      userId: req.user!.id,
      authorName: req.user!.realName || req.user!.name || 'Mindly Learner',
      authorUsername: req.user!.username || '@learner',
      authorAvatar: req.user!.profileImage,
      content: content.trim(),
    });

    return res.status(201).json({ reply });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to post reply.' });
  }
});

// Delete own discussion
app.delete('/api/community/discussions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const discussionId = req.params.id;
    const existing = await discussionRepository.findById(discussionId);
    if (!existing) {
      return res.status(404).json({ error: 'Discussion post not found.' });
    }
    if (existing.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this discussion.' });
    }
    const success = await discussionRepository.delete(discussionId, req.user!.id);
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete discussion.' });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete discussion.' });
  }
});

// Study Rooms
app.get('/api/community/rooms', async (req: Request, res: Response) => {
  try {
    const rooms = await studyRoomRepository.findAll(req.user?.id);
    return res.json({ rooms });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch study rooms.' });
  }
});

app.post('/api/community/rooms', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, topic, description, studyGoal, sessionTime } = req.body;
    if (!name || !topic) {
      return res.status(400).json({ error: 'Name and topic are required.' });
    }

    const room = await studyRoomRepository.create({
      creatorId: req.user!.id,
      creatorName: req.user!.realName || req.user!.name,
      creatorUsername: req.user!.username || '@learner',
      name: name.trim(),
      topic: topic.trim(),
      description: (description || '').trim(),
      studyGoal: (studyGoal || '').trim(),
      sessionTime: (sessionTime || '').trim(),
    });

    return res.status(201).json({ room: { ...room, isMember: true } });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create study room.' });
  }
});

app.post('/api/community/rooms/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    await studyRoomRepository.join(req.params.id, req.user!.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to join study room.' });
  }
});

app.post('/api/community/rooms/:id/leave', requireAuth, async (req: Request, res: Response) => {
  try {
    await studyRoomRepository.leave(req.params.id, req.user!.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to leave study room.' });
  }
});

// Today's Question
app.get('/api/community/todays-question', (req: Request, res: Response) => {
  const dailyQuestions = [
    {
      id: 'tq_1',
      question: 'What is one concept you struggled to grasp initially, and what was the mental model that finally unlocked it for you?',
      topic: 'Learning & Cognitive Models',
      author: 'Mindly Editorial',
      responsesCount: 38,
    },
    {
      id: 'tq_2',
      question: 'When structuring complex domain knowledge, how do you decide where to draw the boundary between foundational principles and edge-case exceptions?',
      topic: 'Knowledge Synthesis',
      author: 'Mindly Editorial',
      responsesCount: 24,
    },
    {
      id: 'tq_3',
      question: 'What is the most actionable distinction you have learned recently between two terms that people frequently conflate?',
      topic: 'Conceptual Clarity',
      author: 'Mindly Editorial',
      responsesCount: 45,
    },
  ];

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const q = dailyQuestions[dayOfYear % dailyQuestions.length];
  return res.json({ question: q });
});

// Public Learner Profile
app.get('/api/community/profile/:username', async (req: Request, res: Response) => {
  try {
    const rawUsername = req.params.username;
    const targetUser = await userRepository.findByUsername(rawUsername);
    if (!targetUser) {
      return res.status(404).json({ error: 'Learner profile not found.' });
    }

    const privacy = targetUser.privacySettings || {
      profileVisibility: 'public',
      showCompletedCourses: true,
      showCertificates: true,
      showStudyActivity: true,
    };

    const userCourses = await courseRepository.findByUserId(targetUser.id);
    const userCerts = await certificateRepository.findByUserId(targetUser.id);
    const completedCoursesCount = userCourses.filter((c) => c.isCompleted).length;

    const profile = {
      userId: targetUser.id,
      realName: targetUser.realName || targetUser.name,
      username: targetUser.username,
      bio: targetUser.bio || 'Curious learner on Mindly.',
      profileImage: targetUser.profileImage,
      interests: targetUser.interests || [],
      completedCoursesCount: privacy.showCompletedCourses ? completedCoursesCount : 0,
      certificatesCount: privacy.showCertificates ? userCerts.length : 0,
      joinedCirclesCount: 3,
      visibilitySettings: privacy,
      createdAt: targetUser.createdAt,
    };

    return res.json({ profile });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch learner profile.' });
  }
});

// Update Profile & Privacy Settings
app.put('/api/community/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bio, interests, privacySettings } = req.body;
    const updated = await userRepository.update(req.user!.id, {
      bio: typeof bio === 'string' ? bio.trim() : undefined,
      interests: Array.isArray(interests) ? interests : undefined,
      privacySettings: privacySettings || undefined,
    });
    return res.json({ user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update profile settings.' });
  }
});

// ==========================================
// 14. SPACED REPETITION & RETENTION ENGINE
// ==========================================

// Get lessons due for optimal spaced-repetition review
app.get('/api/study/spaced-repetition/due', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Fetch user courses for title mapping
    const courses = await courseRepository.findByUserId(userId);
    const courseMap = new Map<string, string>();
    courses.forEach((c) => courseMap.set(c.id, c.title));

    // Fetch user lessons
    const lessons = await lessonRepository.findByUserId(userId);
    const now = Date.now();

    const dueReviews: any[] = [];
    const upcomingReviews: any[] = [];
    let masteredCount = 0;
    let inProgressCount = 0;

    for (const lesson of lessons) {
      let sr = lesson.spacedRepetition;

      // If lesson is marked complete or has reviews but lacks SR object, initialize
      if (!sr && lesson.isCompleted) {
        sr = {
          stage: 1,
          nextReviewDate: new Date(new Date(lesson.updatedAt || lesson.createdAt).getTime() + 24 * 3600 * 1000).toISOString(),
          reviewCount: 0,
          easeFactor: 2.5,
          intervalDays: 1,
          retentionEstimate: 85,
        };
        await lessonRepository.update(lesson.id, userId, { spacedRepetition: sr });
      }

      if (!sr) continue;

      const courseTitle = courseMap.get(lesson.courseId) || 'Course';
      const reviewTime = new Date(sr.nextReviewDate).getTime();
      const diffMs = now - reviewTime;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (sr.stage >= 5) {
        masteredCount++;
      } else {
        inProgressCount++;
      }

      const item = {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        courseId: lesson.courseId,
        courseTitle,
        stage: sr.stage,
        intervalDays: sr.intervalDays || 1,
        dueStatus: reviewTime <= now ? (diffDays > 0 ? 'overdue' : 'due_today') : 'upcoming',
        daysOverdue: Math.max(0, diffDays),
        nextReviewDate: sr.nextReviewDate,
        lastReviewedAt: sr.lastReviewedAt,
        reviewCount: sr.reviewCount || 0,
        quizScore: lesson.quizScore ?? null,
        overview: lesson.structuredContent?.overview || '',
        keyTermsCount: lesson.structuredContent?.keyTerms?.length || 0,
        mainConceptsCount: lesson.structuredContent?.mainConcepts?.length || 0,
      };

      if (reviewTime <= now) {
        dueReviews.push(item);
      } else {
        upcomingReviews.push(item);
      }
    }

    // Sort dueReviews: Overdue first (descending daysOverdue), then lower stages first
    dueReviews.sort((a, b) => {
      if (a.dueStatus === 'overdue' && b.dueStatus !== 'overdue') return -1;
      if (b.dueStatus === 'overdue' && a.dueStatus !== 'overdue') return 1;
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return a.stage - b.stage;
    });

    // Sort upcomingReviews: closest nextReviewDate first
    upcomingReviews.sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());

    const totalTracked = dueReviews.length + upcomingReviews.length;
    const overdueCount = dueReviews.filter((d) => d.dueStatus === 'overdue').length;
    const retentionRate = totalTracked > 0 ? Math.max(50, Math.round(((totalTracked - overdueCount * 0.4) / totalTracked) * 100)) : 100;

    return res.json({
      dueReviews,
      upcomingReviews,
      stats: {
        dueCount: dueReviews.length,
        masteredCount,
        inProgressCount,
        totalTracked,
        retentionRate,
      },
    });
  } catch (err: any) {
    console.error('[API SPACED REPETITION DUE ERROR]', err);
    return res.status(500).json({ error: 'Failed to retrieve spaced repetition reviews.' });
  }
});

// Record a spaced-repetition review outcome
app.post('/api/study/spaced-repetition/review', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { lessonId, rating } = req.body; // 'again' | 'hard' | 'good' | 'easy'

    if (!lessonId || !rating) {
      return res.status(400).json({ error: 'lessonId and rating are required.' });
    }

    const validRatings = ['again', 'hard', 'good', 'easy'];
    if (!validRatings.includes(rating)) {
      return res.status(400).json({ error: `Invalid rating. Must be one of: ${validRatings.join(', ')}` });
    }

    const lesson = await lessonRepository.findById(lessonId, userId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    const currentSR = lesson.spacedRepetition || {
      stage: 1,
      nextReviewDate: new Date().toISOString(),
      reviewCount: 0,
      easeFactor: 2.5,
      intervalDays: 1,
    };

    let nextStage = currentSR.stage || 1;
    let nextIntervalDays = 1;
    let ease = currentSR.easeFactor || 2.5;
    let retentionEstimate = 90;

    // SuperMemo-2 / Leitner progressive intervals:
    // Stage 1: 1 day -> Stage 2: 3 days -> Stage 3: 7 days -> Stage 4: 14 days -> Stage 5: 30 days -> Stage 6+: 60 days
    const stageIntervals = [1, 1, 3, 7, 14, 30, 60];

    switch (rating) {
      case 'again': // Forgot / failed retrieval -> reset to Stage 1
        nextStage = 1;
        nextIntervalDays = 1;
        ease = Math.max(1.3, ease - 0.2);
        retentionEstimate = 60;
        break;
      case 'hard': // Struggled, remembered with high difficulty -> advance or maintain small interval
        nextStage = Math.max(1, currentSR.stage);
        nextIntervalDays = Math.max(1, Math.round((currentSR.intervalDays || 1) * 1.2));
        ease = Math.max(1.3, ease - 0.15);
        retentionEstimate = 78;
        break;
      case 'good': // Recalled normally -> standard progression
        nextStage = Math.min(5, currentSR.stage + 1);
        nextIntervalDays = stageIntervals[nextStage] || 30;
        retentionEstimate = 95;
        break;
      case 'easy': // Recalled instantly with zero friction -> accelerated interval
        nextStage = Math.min(5, currentSR.stage + 1);
        nextIntervalDays = Math.round((stageIntervals[nextStage] || 30) * 1.5);
        ease = Math.min(3.0, ease + 0.15);
        retentionEstimate = 100;
        break;
    }

    const now = new Date();
    const nextReviewDate = new Date(now.getTime() + nextIntervalDays * 24 * 60 * 60 * 1000).toISOString();

    const updatedSR = {
      stage: nextStage,
      nextReviewDate,
      lastReviewedAt: now.toISOString(),
      reviewCount: (currentSR.reviewCount || 0) + 1,
      easeFactor: Math.round(ease * 100) / 100,
      intervalDays: nextIntervalDays,
      lastRating: rating,
      retentionEstimate,
    };

    const updatedLesson = await lessonRepository.update(lesson.id, userId, {
      spacedRepetition: updatedSR,
      isCompleted: true,
    });

    // Log study session (2 minutes review session)
    await studySessionRepository.logTime({
      userId,
      lessonId: lesson.id,
      seconds: 120,
      date: new Date().toISOString().split('T')[0],
    });

    // Create activity
    const ratingLabels: Record<string, string> = {
      again: 'Repeat Needed',
      hard: 'Challenging Recall',
      good: 'Successful Recall',
      easy: 'Mastered Recall',
    };

    await activityRepository.create({
      userId,
      type: 'lesson_completed',
      title: `Spaced Review: "${lesson.title}" (${ratingLabels[rating]} · Stage ${nextStage})`,
      courseId: lesson.courseId,
      lessonId: lesson.id,
    });

    return res.json({
      success: true,
      lesson: updatedLesson,
      spacedRepetition: updatedSR,
      nextReviewInDays: nextIntervalDays,
    });
  } catch (err: any) {
    console.error('[API SPACED REPETITION REVIEW ERROR]', err);
    return res.status(500).json({ error: 'Failed to record spaced repetition review.' });
  }
});

// Enlist any lesson into the spaced repetition pipeline
app.post('/api/study/spaced-repetition/init', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { lessonId } = req.body;

    if (!lessonId) {
      return res.status(400).json({ error: 'lessonId is required.' });
    }

    const lesson = await lessonRepository.findById(lessonId, userId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    const initialSR = {
      stage: 1,
      nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      reviewCount: 0,
      easeFactor: 2.5,
      intervalDays: 1,
      retentionEstimate: 85,
    };

    const updated = await lessonRepository.update(lesson.id, userId, {
      spacedRepetition: initialSR,
      isCompleted: true,
    });

    return res.json({ success: true, lesson: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to initialize spaced repetition schedule.' });
  }
});

// ==========================================
// PHASE 2B MIGRATION DATA SOURCE (Read-only)
// ==========================================
app.get('/api/migrate/phase2b-data', requireAuth, async (req: Request, res: Response) => {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'mindly_db.json');
    if (!fs.existsSync(dbPath)) {
      return res.json({ notes: [], terms: [], materials: [], studySessions: [], activities: [], quizAttempts: [] });
    }
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const json = JSON.parse(raw);
    return res.json({
      notes: json.notes || [],
      terms: json.terms || [],
      materials: json.materials || [],
      studySessions: json.studySessions || [],
      activities: json.activities || [],
      quizAttempts: json.quizAttempts || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to read migration data' });
  }
});

// ==========================================
// PHASE 3B COMMUNITY MIGRATION DATA SOURCE (Read-only)
// ==========================================
app.get('/api/migrate/community-data', requireAuth, async (req: Request, res: Response) => {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'mindly_db.json');
    if (!fs.existsSync(dbPath)) {
      return res.json({
        circles: [],
        circleMemberships: [],
        discussions: [],
        discussionReplies: [],
        studyRooms: [],
        studyRoomMembers: [],
      });
    }
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const json = JSON.parse(raw);
    return res.json({
      circles: json.circles || [],
      circleMemberships: json.circleMemberships || [],
      discussions: json.discussions || [],
      discussionReplies: json.discussionReplies || [],
      studyRooms: json.studyRooms || [],
      studyRoomMembers: json.studyRoomMembers || [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to read community migration data' });
  }
});

// ==========================================
// PHASE 2A COURSES & LESSONS MIGRATION DATA SOURCE (Read-only)
// ==========================================
app.get('/api/migrate/courses-data', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const dbPath = path.join(process.cwd(), 'data', 'mindly_db.json');
    if (!fs.existsSync(dbPath)) {
      return res.json({ courses: [], lessons: [] });
    }
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const json = JSON.parse(raw);
    const allCourses: any[] = json.courses || [];
    const allLessons: any[] = json.lessons || [];

    const userCourses = allCourses.filter((c) => c.userId === userId || c.isDemo || c.userId === 'usr_demo_icon');
    const courseIds = new Set(userCourses.map((c) => c.id));
    const userLessons = allLessons.filter((l) => courseIds.has(l.courseId) || l.userId === userId);

    return res.json({ courses: userCourses, lessons: userLessons });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to read courses migration data' });
  }
});

// ==========================================
// VITE MIDDLEWARE, CACHE-CONTROL & SERVER STARTUP
// ==========================================

// Global Cache-Control middleware to prevent browser and CDN proxy stale bundle caching
app.use((req: Request, res: Response, next: NextFunction) => {
  const urlPath = req.path;

  // 1. Service Worker: Absolutely never cache sw.js
  if (urlPath === '/sw.js' || urlPath === '/service-worker.js') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    return next();
  }

  // 2. HTML entrypoint & SPA navigation: Never cache index.html so newer asset hashes are immediately resolved
  if (
    req.method === 'GET' &&
    (urlPath === '/' || urlPath.endsWith('.html') || (req.headers.accept && req.headers.accept.includes('text/html')))
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  // 3. API requests: Dynamic JSON, never cache
  if (urlPath.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
});

// Dynamic OpenGraph & Meta Tags SSR for Shared Course Links
app.get(['/share/course/:shareId', '/shared/:shareId', '/c/:shareId', '/course/share/:shareId'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shareId } = req.params;
    let sharedCourse = await sharedCourseRepository.findById(shareId);
    if (!sharedCourse) {
      try {
        sharedCourse = await firestoreAdminService.getSharedCourse(shareId);
      } catch {}
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const currentUrl = `${protocol}://${host}${req.originalUrl}`;

    let html = '';
    const indexPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'dist', 'index.html')
      : path.join(process.cwd(), 'index.html');

    if (fs.existsSync(indexPath)) {
      html = fs.readFileSync(indexPath, 'utf-8');
    }

    if (sharedCourse && html) {
      const title = `${sharedCourse.title} — Mindly Course`;
      const description = sharedCourse.description || `Master "${sharedCourse.title}" on Mindly with structured lessons and active recall.`;
      const rawImage = sharedCourse.coverImage || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80';
      const imageUrl = rawImage.startsWith('http') ? rawImage : `${protocol}://${host}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;

      const metaTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escapeHtml(currentUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Mindly" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
`;

      if (process.env.NODE_ENV !== 'production' && (global as any).__viteDevServer) {
        html = await (global as any).__viteDevServer.transformIndexHtml(req.originalUrl, html);
      }

      html = html.replace(/<title>.*?<\/title>/i, '');
      html = html.replace(/<meta property="og:[^>]*>/gi, '');
      html = html.replace(/<meta name="twitter:[^>]*>/gi, '');
      html = html.replace(/<meta name="description"[^>]*>/gi, '');
      html = html.replace('</head>', `${metaTags}\n  </head>`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      return res.send(html);
    }
  } catch (err) {
    console.warn('[ShareSSR] Note serving OpenGraph tags:', err);
  }
  next();
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    (global as any).__viteDevServer = vite;
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res: Response, filePath: string) => {
          // Content-hashed Vite output in /assets/ is immutable and safe to cache for 1 year
          if (filePath.includes(path.sep + 'assets' + path.sep)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (filePath.endsWith('sw.js') || filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else {
            // Unhashed root assets (manifest, favicons)
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
          }
        },
      })
    );
    app.get('*', (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MINDLY] Backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
