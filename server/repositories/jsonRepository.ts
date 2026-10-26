/**
 * JSON-backed Repository Implementation with Migration & Atomic Persistence — V2.1
 * Implements:
 * - User-scoped persistence (no fake user data injection)
 * - Real Name & Unique Username queries
 * - Certificate & Combined Certificate repositories
 * - Community Circles, Discussions, Replies, and Study Rooms
 */
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  UserRecord,
  StudySessionRecord,
  IUserRepository,
  ICourseRepository,
  ILessonRepository,
  INoteRepository,
  IKeyTermRepository,
  IQuizRepository,
  IStudySessionRepository,
  IMaterialRepository,
  IActivityRepository,
  ISessionRepository,
  IPasswordResetRepository,
  ICertificateRepository,
  ICombinedCertificateRepository,
  ICircleRepository,
  IDiscussionRepository,
  IStudyRoomRepository,
  ISharedCourseRepository
} from '../types';
import {
  Course,
  Lesson,
  Note,
  KeyTermItem,
  QuizAttempt,
  ActivityItem,
  MaterialHistoryItem,
  StudyProgress,
  Session,
  PasswordResetToken,
  UserExportData,
  Certificate,
  CombinedCertificate,
  Circle,
  Discussion,
  DiscussionReply,
  StudyRoom,
  SharedCourse
} from '../../src/types';
import { getDemoDatabase } from '../../src/lib/demoData';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'mindly_db.json');

interface DatabaseSchema {
  users: UserRecord[];
  courses: Course[];
  lessons: Lesson[];
  notes: Note[];
  terms: (KeyTermItem & { userId?: string })[];
  studySessions: StudySessionRecord[];
  quizAttempts: QuizAttempt[];
  activities: (ActivityItem & { userId?: string })[];
  materials: MaterialHistoryItem[];
  sessions: Session[];
  passwordResetTokens: PasswordResetToken[];
  certificates: Certificate[];
  combinedCertificates: CombinedCertificate[];
  circles: Circle[];
  circleMemberships: { userId: string; circleId: string; joinedAt: string }[];
  discussions: Discussion[];
  discussionReplies: DiscussionReply[];
  studyRooms: StudyRoom[];
  studyRoomMembers: { roomId: string; userId: string; joinedAt: string }[];
  sharedCourses: SharedCourse[];
}

let dbInstance: DatabaseSchema | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

let lastMtime = 0;

function loadDatabase(): DatabaseSchema {
  let currentMtime = 0;
  if (fs.existsSync(DB_FILE)) {
    try {
      currentMtime = fs.statSync(DB_FILE).mtimeMs;
    } catch {}
  }

  if (dbInstance && lastMtime && currentMtime === lastMtime) {
    return dbInstance;
  }
  lastMtime = currentMtime;
  ensureDirExists(DB_DIR);

  let rawData: Partial<DatabaseSchema> = {};
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      rawData = JSON.parse(content);
    } catch (err) {
      console.error('[DB] Error parsing existing database, initializing fallback:', err);
    }
  }

  // Safe schema migration: ensure all collections exist without losing existing data
  const migrated: DatabaseSchema = {
    users: rawData.users || [],
    courses: rawData.courses || [],
    lessons: rawData.lessons || [],
    notes: rawData.notes || [],
    terms: rawData.terms || [],
    studySessions: rawData.studySessions || [],
    quizAttempts: rawData.quizAttempts || [],
    activities: rawData.activities || [],
    materials: rawData.materials || [],
    sessions: rawData.sessions || [],
    passwordResetTokens: rawData.passwordResetTokens || [],
    certificates: rawData.certificates || [],
    combinedCertificates: rawData.combinedCertificates || [],
    circles: rawData.circles || [],
    circleMemberships: rawData.circleMemberships || [],
    discussions: rawData.discussions || [],
    discussionReplies: rawData.discussionReplies || [],
    studyRooms: rawData.studyRooms || [],
    studyRoomMembers: rawData.studyRoomMembers || [],
    sharedCourses: rawData.sharedCourses || [],
  };

  // Seed baseline public circles if none exist so learners can immediately discover communities
  if (migrated.circles.length === 0) {
    migrated.circles = [
      {
        id: 'circle_market_structure',
        name: 'Market Structure & Trading',
        description: 'Analyzing price action, order flow, liquidity dynamics, and high-probability setups across global assets.',
        topic: 'Trading',
        membersCount: 142,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'circle_aerodynamics',
        name: 'Aerodynamics & Flight Dynamics',
        description: 'Fluid mechanics, lift-to-drag optimization, boundary layer control, and supersonic airflow principles.',
        topic: 'Aerodynamics',
        membersCount: 88,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'circle_cs_systems',
        name: 'Computer Science & Distributed Systems',
        description: 'Concurrency, distributed consensus, data modeling, algorithms, and systems programming.',
        topic: 'Programming',
        membersCount: 230,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'circle_cognitive_psych',
        name: 'Cognitive Science & Memory Retention',
        description: 'Spaced repetition, neural plasticity, pedagogical structuring, and mental model synthesis.',
        topic: 'Cognitive Science',
        membersCount: 175,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'circle_macroeconomics',
        name: 'Macroeconomics & Monetary Policy',
        description: 'Central banking, liquidity cycles, fiscal policy transmission, and international trade dynamics.',
        topic: 'Economics',
        membersCount: 119,
        createdAt: new Date().toISOString(),
      },
    ];

    // Seed initial discussions
    migrated.discussions = [
      {
        id: 'disc_ms_01',
        userId: 'usr_community_seed',
        authorName: 'Marcus Vance',
        authorUsername: '@marcus_v',
        circleId: 'circle_market_structure',
        circleName: 'Market Structure & Trading',
        title: 'What is the exact distinction between a Break of Structure (BOS) and a Change of Character (CHoCH)?',
        content: 'When price pierces the previous swing point by a mere wick versus a full candle body close on the 4H timeframe, do you count that as confirmed structural continuation or liquidity grab?',
        type: 'question',
        replyCount: 3,
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: 'disc_aero_01',
        userId: 'usr_community_seed_2',
        authorName: 'Elena Rostova',
        authorUsername: '@elena_flight',
        circleId: 'circle_aerodynamics',
        circleName: 'Aerodynamics & Flight Dynamics',
        title: 'How do you intuitively understand circulation in the Kutta-Joukowski theorem?',
        content: 'I finally had a breakthrough understanding how boundary layer viscosity actually generates the starting vortex shed at the trailing edge, which establishes net circulation around the airfoil.',
        type: 'insight',
        replyCount: 2,
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
    ];

    migrated.discussionReplies = [
      {
        id: 'reply_ms_01',
        discussionId: 'disc_ms_01',
        userId: 'usr_community_seed_3',
        authorName: 'Sarah Jenkins',
        authorUsername: '@sjenkins',
        content: 'A Break of Structure (BOS) represents trend continuation in the direction of the dominant order flow. A Change of Character (CHoCH) is the first structural failure against the trend, signaling an early potential transition.',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
    ];
  }

  // Seed baseline curriculum if none exist so learners can immediately begin learning & reviewing
  if (migrated.courses.length === 0) {
    try {
      const demo = getDemoDatabase();
      migrated.courses = demo.courses;
      migrated.lessons = demo.lessons;
      migrated.notes = demo.notes;
      migrated.terms = demo.terms;
    } catch (e) {
      console.error('[DB] Failed to seed initial demo curriculum:', e);
    }
  }

  dbInstance = migrated;

  if (!fs.existsSync(DB_FILE)) {
    saveDatabaseSync();
  }

  return dbInstance;
}

export function flushDatabaseSync() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveDatabaseSync();
}

function saveDatabaseSync() {
  if (!dbInstance) return;
  try {
    ensureDirExists(DB_DIR);
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(dbInstance, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
    try {
      lastMtime = fs.statSync(DB_FILE).mtimeMs;
    } catch {}
  } catch (err) {
    console.error('[DB] Atomic write failed:', err);
  }
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDatabaseSync();
    saveTimeout = null;
  }, 100);
}

// ==========================================
// USER REPOSITORY
// ==========================================

export class JsonUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserRecord | null> {
    const db = loadDatabase();
    return db.users.find((u) => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const db = loadDatabase();
    const normalized = email.trim().toLowerCase();
    return db.users.find((u) => u.email.toLowerCase() === normalized) || null;
  }

  async findByUsername(raw: string): Promise<UserRecord | null> {
    const db = loadDatabase();
    const clean = raw.trim().replace(/^@+/, '').toLowerCase();
    return db.users.find((u) => {
      const uClean = (u.username || '').trim().replace(/^@+/, '').toLowerCase();
      return uClean === clean;
    }) || null;
  }

  async create(user: Omit<UserRecord, 'id' | 'createdAt'> & { id?: string }): Promise<UserRecord> {
    const db = loadDatabase();
    const cleanUsername = (user.username || '').trim().replace(/^@+/, '');
    const realName = (user.realName || user.name || '').trim();

    const newUser: UserRecord = {
      ...user,
      id: user.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: realName,
      realName,
      username: `@${cleanUsername}`,
      createdAt: new Date().toISOString(),
      interests: user.interests || [],
      hasCompletedOnboarding: user.hasCompletedOnboarding ?? false,
      dailyStudyGoalMinutes: user.dailyStudyGoalMinutes || 30,
      todayStudySeconds: user.todayStudySeconds || 0,
      privacySettings: user.privacySettings || {
        profileVisibility: 'public',
        showCompletedCourses: true,
        showCertificates: true,
        showStudyActivity: true,
      },
      settings: user.settings || {
        theme: 'dark',
        fontSize: 'normal',
        aiStrictness: 'balanced',
        dailyStudyGoalMinutes: user.dailyStudyGoalMinutes || 30,
      },
    };
    db.users.push(newUser);
    scheduleSave();
    return newUser;
  }

  async update(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    const db = loadDatabase();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;

    db.users[idx] = {
      ...db.users[idx],
      ...updates,
      settings: updates.settings ? { ...db.users[idx].settings, ...updates.settings } : db.users[idx].settings,
      privacySettings: updates.privacySettings ? { ...db.users[idx].privacySettings, ...updates.privacySettings } : db.users[idx].privacySettings,
    };
    scheduleSave();
    return db.users[idx];
  }

  async delete(id: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.users.length;
    db.users = db.users.filter((u) => u.id !== id);
    if (db.users.length !== initial) {
      scheduleSave();
      return true;
    }
    return false;
  }
}

// ==========================================
// COURSE REPOSITORY (Strict User-Scoped)
// ==========================================

export class JsonCourseRepository implements ICourseRepository {
  async findByUserId(userId: string): Promise<Course[]> {
    const db = loadDatabase();
    return db.courses.filter((c) => c.userId === userId);
  }

  async findById(id: string, userId?: string): Promise<Course | null> {
    const db = loadDatabase();
    return db.courses.find((c) => c.id === id && (!userId || c.userId === userId || c.isDemo)) || null;
  }

  async create(course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Course> {
    const db = loadDatabase();
    const now = new Date().toISOString();
    const newCourse: Course = {
      ...course,
      id: course.id || `crs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      isCompleted: false,
    };
    db.courses.unshift(newCourse);
    scheduleSave();
    return newCourse;
  }

  async update(id: string, userId: string, updates: Partial<Course>): Promise<Course | null> {
    const db = loadDatabase();
    const idx = db.courses.findIndex((c) => c.id === id && (c.userId === userId || c.isDemo));
    if (idx === -1) return null;

    db.courses[idx] = {
      ...db.courses[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    scheduleSave();
    return db.courses[idx];
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.courses.length;
    db.courses = db.courses.filter((c) => !(c.id === id && (c.userId === userId || c.isDemo)));
    if (db.courses.length !== initial) {
      db.lessons = db.lessons.filter((l) => l.courseId !== id);
      db.notes = db.notes.filter((n) => n.courseId !== id);
      db.terms = db.terms.filter((t) => t.courseId !== id);
      scheduleSave();
      return true;
    }
    return false;
  }

  async archive(id: string, userId: string): Promise<Course | null> {
    return this.update(id, userId, { isArchived: true, archivedAt: new Date().toISOString() });
  }

  async unarchive(id: string, userId: string): Promise<Course | null> {
    return this.update(id, userId, { isArchived: false, archivedAt: undefined });
  }
}

// ==========================================
// LESSON REPOSITORY
// ==========================================

export class JsonLessonRepository implements ILessonRepository {
  async findByCourseId(courseId: string, userId?: string): Promise<Lesson[]> {
    const db = loadDatabase();
    return db.lessons
      .filter((l) => l.courseId === courseId && (!userId || l.userId === userId || l.isDemo))
      .sort((a, b) => a.order - b.order);
  }

  async findByUserId(userId: string): Promise<Lesson[]> {
    const db = loadDatabase();
    return db.lessons.filter((l) => l.userId === userId);
  }

  async findById(id: string, userId?: string): Promise<Lesson | null> {
    const db = loadDatabase();
    return db.lessons.find((l) => l.id === id && (!userId || l.userId === userId || l.isDemo)) || null;
  }

  async create(lesson: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Lesson> {
    const db = loadDatabase();
    const now = new Date().toISOString();
    const newLesson: Lesson = {
      ...lesson,
      id: lesson.id || `lsn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    db.lessons.push(newLesson);
    scheduleSave();
    return newLesson;
  }

  async update(id: string, userId: string, updates: Partial<Lesson>): Promise<Lesson | null> {
    const db = loadDatabase();
    const idx = db.lessons.findIndex((l) => l.id === id && (l.userId === userId || l.isDemo));
    if (idx === -1) return null;

    db.lessons[idx] = {
      ...db.lessons[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    scheduleSave();
    return db.lessons[idx];
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.lessons.length;
    db.lessons = db.lessons.filter((l) => !(l.id === id && (l.userId === userId || l.isDemo)));
    if (db.lessons.length !== initial) {
      db.notes = db.notes.filter((n) => n.lessonId !== id);
      db.terms = db.terms.filter((t) => t.lessonId !== id);
      scheduleSave();
      return true;
    }
    return false;
  }
}

// ==========================================
// NOTE REPOSITORY
// ==========================================

export class JsonNoteRepository implements INoteRepository {
  async findByUserId(userId: string, filters?: { courseId?: string; lessonId?: string }): Promise<Note[]> {
    const db = loadDatabase();
    return db.notes.filter((n) => {
      if (n.userId !== userId) return false;
      if (filters?.courseId && n.courseId !== filters.courseId) return false;
      if (filters?.lessonId && n.lessonId !== filters.lessonId) return false;
      return true;
    });
  }

  async findById(id: string, userId?: string): Promise<Note | null> {
    const db = loadDatabase();
    return db.notes.find((n) => n.id === id && (!userId || n.userId === userId)) || null;
  }

  async create(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Note> {
    const db = loadDatabase();
    const now = new Date().toISOString();
    const newNote: Note = {
      ...note,
      id: note.id || `not_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    db.notes.unshift(newNote);
    scheduleSave();
    return newNote;
  }

  async update(id: string, userId: string, updates: Partial<Note>): Promise<Note | null> {
    const db = loadDatabase();
    const idx = db.notes.findIndex((n) => n.id === id && n.userId === userId);
    if (idx === -1) return null;

    db.notes[idx] = {
      ...db.notes[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    scheduleSave();
    return db.notes[idx];
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.notes.length;
    db.notes = db.notes.filter((n) => !(n.id === id && n.userId === userId));
    if (db.notes.length !== initial) {
      scheduleSave();
      return true;
    }
    return false;
  }
}

// ==========================================
// KEY TERM REPOSITORY
// ==========================================

export class JsonKeyTermRepository implements IKeyTermRepository {
  async findByUserId(userId: string, courseId?: string): Promise<KeyTermItem[]> {
    const db = loadDatabase();
    return db.terms.filter((t) => {
      if (t.userId && t.userId !== userId) return false;
      if (courseId && t.courseId !== courseId) return false;
      return true;
    });
  }

  async findById(id: string): Promise<KeyTermItem | null> {
    const db = loadDatabase();
    return db.terms.find((t) => t.id === id) || null;
  }

  async create(term: Omit<KeyTermItem, 'id'> & { id?: string; userId?: string }): Promise<KeyTermItem> {
    const db = loadDatabase();
    const newTerm: KeyTermItem & { userId?: string } = {
      ...term,
      id: term.id || `trm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    db.terms.unshift(newTerm);
    scheduleSave();
    return newTerm;
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.terms.length;
    db.terms = db.terms.filter((t) => !(t.id === id && (!userId || !t.userId || t.userId === userId)));
    if (db.terms.length !== initial) {
      scheduleSave();
      return true;
    }
    return false;
  }
}

// ==========================================
// QUIZ ATTEMPT REPOSITORY
// ==========================================

export class JsonQuizRepository implements IQuizRepository {
  async createAttempt(attempt: Omit<QuizAttempt, 'id'> & { id?: string }): Promise<QuizAttempt> {
    const db = loadDatabase();
    const newAttempt: QuizAttempt = {
      ...attempt,
      id: attempt.id || `qza_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    db.quizAttempts.unshift(newAttempt);
    scheduleSave();
    return newAttempt;
  }

  async findByLessonId(lessonId: string, userId: string): Promise<QuizAttempt[]> {
    const db = loadDatabase();
    return db.quizAttempts.filter((q) => q.lessonId === lessonId && q.userId === userId);
  }

  async findByUserId(userId: string): Promise<QuizAttempt[]> {
    const db = loadDatabase();
    return db.quizAttempts.filter((q) => q.userId === userId);
  }
}

// ==========================================
// STUDY SESSION & PROGRESS TRACKING REPOSITORY
// ==========================================

export class JsonStudySessionRepository implements IStudySessionRepository {
  async logTime(session: Omit<StudySessionRecord, 'id' | 'timestamp'>): Promise<StudySessionRecord> {
    const db = loadDatabase();
    const newSession: StudySessionRecord = {
      ...session,
      id: `ss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    db.studySessions.push(newSession);

    // Update user's aggregate today seconds
    const user = db.users.find((u) => u.id === session.userId);
    if (user) {
      user.todayStudySeconds = (user.todayStudySeconds || 0) + session.seconds;
    }

    scheduleSave();
    return newSession;
  }

  async findByUserId(userId: string): Promise<StudySessionRecord[]> {
    const db = loadDatabase();
    return db.studySessions.filter((s) => s.userId === userId);
  }

  async getProgress(userId: string, customDailyGoal?: number): Promise<StudyProgress> {
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === userId);
    const goalMinutes = customDailyGoal || user?.dailyStudyGoalMinutes || 30;

    const userSessions = db.studySessions.filter((s) => s.userId === userId);
    const todayStr = new Date().toISOString().split('T')[0];

    const todaySessions = userSessions.filter((s) => s.date === todayStr);
    const todaySeconds = todaySessions.reduce((sum, s) => sum + s.seconds, 0);
    const todayMinutes = Number((todaySeconds / 60).toFixed(1));

    // Calculate genuine streak without fake days
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
  }
}

// ==========================================
// MATERIAL REPOSITORY
// ==========================================

export class JsonMaterialRepository implements IMaterialRepository {
  async findByUserId(userId: string): Promise<MaterialHistoryItem[]> {
    const db = loadDatabase();
    return db.materials.filter((m) => m.userId === userId);
  }

  async create(item: Omit<MaterialHistoryItem, 'id' | 'createdAt'> & { id?: string }): Promise<MaterialHistoryItem> {
    const db = loadDatabase();
    const newItem: MaterialHistoryItem = {
      ...item,
      id: item.id || `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    db.materials.unshift(newItem);
    scheduleSave();
    return newItem;
  }
}

// ==========================================
// ACTIVITY REPOSITORY
// ==========================================

export class JsonActivityRepository implements IActivityRepository {
  async findByUserId(userId: string, limit = 20): Promise<ActivityItem[]> {
    const db = loadDatabase();
    return db.activities
      .filter((a) => a.userId === userId)
      .slice(0, limit);
  }

  async create(item: Omit<ActivityItem, 'id' | 'timestamp'> & { id?: string; userId: string }): Promise<ActivityItem> {
    const db = loadDatabase();
    const newActivity: ActivityItem & { userId: string } = {
      ...item,
      id: item.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    db.activities.unshift(newActivity);
    scheduleSave();
    return newActivity;
  }
}

// ==========================================
// SESSION REPOSITORY
// ==========================================

export class JsonSessionRepository implements ISessionRepository {
  async create(session: Omit<Session, 'id' | 'createdAt' | 'lastUsedAt'>): Promise<Session> {
    const db = loadDatabase();
    const now = new Date().toISOString();
    const newSession: Session = {
      ...session,
      id: `ses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      lastUsedAt: now,
    };
    db.sessions.push(newSession);
    scheduleSave();
    return newSession;
  }

  async findByToken(token: string): Promise<Session | null> {
    const db = loadDatabase();
    const s = db.sessions.find((sess) => sess.token === token);
    if (!s) return null;
    if (new Date(s.expiresAt).getTime() < Date.now()) {
      await this.deleteByToken(token);
      return null;
    }
    return s;
  }

  async touch(token: string): Promise<void> {
    const db = loadDatabase();
    const s = db.sessions.find((sess) => sess.token === token);
    if (s) {
      s.lastUsedAt = new Date().toISOString();
      scheduleSave();
    }
  }

  async deleteByToken(token: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.token !== token);
    if (db.sessions.length !== initial) {
      scheduleSave();
      return true;
    }
    return false;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const db = loadDatabase();
    const initial = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.userId !== userId);
    const count = initial - db.sessions.length;
    if (count > 0) scheduleSave();
    return count;
  }
}

// ==========================================
// PASSWORD RESET REPOSITORY
// ==========================================

export class JsonPasswordResetRepository implements IPasswordResetRepository {
  async create(record: Omit<PasswordResetToken, 'id' | 'createdAt' | 'used'>): Promise<PasswordResetToken> {
    const db = loadDatabase();
    const newReset: PasswordResetToken = {
      id: `prt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      used: false,
      ...record,
    };
    db.passwordResetTokens.push(newReset);
    scheduleSave();
    return newReset;
  }

  async findByToken(token: string): Promise<PasswordResetToken | null> {
    const db = loadDatabase();
    const record = db.passwordResetTokens.find((r) => r.token === token);
    if (!record) return null;
    if (record.used) return null;
    if (new Date(record.expiresAt).getTime() < Date.now()) return null;
    return record;
  }

  async markUsed(token: string): Promise<boolean> {
    const db = loadDatabase();
    const record = db.passwordResetTokens.find((r) => r.token === token);
    if (!record) return false;
    record.used = true;
    scheduleSave();
    return true;
  }

  async deleteExpired(): Promise<number> {
    const db = loadDatabase();
    const now = Date.now();
    const initial = db.passwordResetTokens.length;
    db.passwordResetTokens = db.passwordResetTokens.filter(
      (r) => !r.used && new Date(r.expiresAt).getTime() > now
    );
    const count = initial - db.passwordResetTokens.length;
    if (count > 0) scheduleSave();
    return count;
  }
}

// ==========================================
// CERTIFICATE REPOSITORIES
// ==========================================

export class JsonCertificateRepository implements ICertificateRepository {
  async findByUserId(userId: string): Promise<Certificate[]> {
    const db = loadDatabase();
    return db.certificates.filter((c) => c.userId === userId);
  }

  async findById(id: string, userId?: string): Promise<Certificate | null> {
    const db = loadDatabase();
    return db.certificates.find((c) => c.id === id && (!userId || c.userId === userId)) || null;
  }

  async findByCertificateId(certificateId: string): Promise<Certificate | null> {
    const db = loadDatabase();
    return db.certificates.find((c) => c.certificateId.toUpperCase() === certificateId.toUpperCase()) || null;
  }

  async findByCourseId(courseId: string, userId: string): Promise<Certificate | null> {
    const db = loadDatabase();
    return db.certificates.find((c) => c.courseId === courseId && c.userId === userId) || null;
  }

  async create(cert: Omit<Certificate, 'id' | 'createdAt'>): Promise<Certificate> {
    const db = loadDatabase();
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const certId = cert.certificateId || `MND-${randomCode}`;
    const newCert: Certificate = {
      ...cert,
      id: `crt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      certificateId: certId,
      verificationCode: cert.verificationCode || `VER-${randomCode}`,
      createdAt: new Date().toISOString(),
    };
    db.certificates.unshift(newCert);

    // Also mark course completed
    const course = db.courses.find((c) => c.id === cert.courseId);
    if (course) {
      course.isCompleted = true;
      course.certificateId = newCert.certificateId;
    }

    scheduleSave();
    return newCert;
  }
}

export class JsonCombinedCertificateRepository implements ICombinedCertificateRepository {
  async findByUserId(userId: string): Promise<CombinedCertificate[]> {
    const db = loadDatabase();
    return db.combinedCertificates.filter((c) => c.userId === userId);
  }

  async findById(id: string, userId?: string): Promise<CombinedCertificate | null> {
    const db = loadDatabase();
    return db.combinedCertificates.find((c) => c.id === id && (!userId || c.userId === userId)) || null;
  }

  async findByCertificateId(certificateId: string): Promise<CombinedCertificate | null> {
    const db = loadDatabase();
    return db.combinedCertificates.find((c) => c.certificateId.toUpperCase() === certificateId.toUpperCase()) || null;
  }

  async create(cert: Omit<CombinedCertificate, 'id' | 'createdAt'>): Promise<CombinedCertificate> {
    const db = loadDatabase();
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const certId = cert.certificateId || `MND-COMB-${randomCode}`;
    const newCert: CombinedCertificate = {
      ...cert,
      id: `comb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      certificateId: certId,
      verificationCode: cert.verificationCode || `VER-COMB-${randomCode}`,
      createdAt: new Date().toISOString(),
    };
    db.combinedCertificates.unshift(newCert);
    scheduleSave();
    return newCert;
  }
}

// ==========================================
// COMMUNITY REPOSITORIES (Circles, Discussions, Study Rooms)
// ==========================================

export class JsonCircleRepository implements ICircleRepository {
  async findAll(userId?: string): Promise<Circle[]> {
    const db = loadDatabase();
    return db.circles.map((c) => {
      const isJoined = userId ? db.circleMemberships.some((m) => m.circleId === c.id && m.userId === userId) : false;
      return { ...c, isJoined };
    });
  }

  async findById(id: string, userId?: string): Promise<Circle | null> {
    const db = loadDatabase();
    const circle = db.circles.find((c) => c.id === id);
    if (!circle) return null;
    const isJoined = userId ? db.circleMemberships.some((m) => m.circleId === circle.id && m.userId === userId) : false;
    return { ...circle, isJoined };
  }

  async create(circle: Omit<Circle, 'id' | 'createdAt' | 'membersCount'>): Promise<Circle> {
    const db = loadDatabase();
    const newCircle: Circle = {
      ...circle,
      id: `cir_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      membersCount: 1,
      createdAt: new Date().toISOString(),
    };
    db.circles.unshift(newCircle);
    scheduleSave();
    return newCircle;
  }

  async join(circleId: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    const exists = db.circleMemberships.some((m) => m.circleId === circleId && m.userId === userId);
    if (exists) return true;

    db.circleMemberships.push({
      circleId,
      userId,
      joinedAt: new Date().toISOString(),
    });

    const circle = db.circles.find((c) => c.id === circleId);
    if (circle) circle.membersCount = (circle.membersCount || 0) + 1;

    scheduleSave();
    return true;
  }

  async leave(circleId: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.circleMemberships.length;
    db.circleMemberships = db.circleMemberships.filter((m) => !(m.circleId === circleId && m.userId === userId));
    if (db.circleMemberships.length !== initial) {
      const circle = db.circles.find((c) => c.id === circleId);
      if (circle && circle.membersCount > 0) circle.membersCount -= 1;
      scheduleSave();
      return true;
    }
    return false;
  }

  async isMember(circleId: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    return db.circleMemberships.some((m) => m.circleId === circleId && m.userId === userId);
  }
}

export class JsonDiscussionRepository implements IDiscussionRepository {
  async findAll(circleId?: string): Promise<Discussion[]> {
    const db = loadDatabase();
    let list = circleId ? db.discussions.filter((d) => d.circleId === circleId) : db.discussions;
    return list.map((d) => {
      const replies = db.discussionReplies.filter((r) => r.discussionId === d.id);
      return {
        ...d,
        replyCount: replies.length,
        replies,
      };
    });
  }

  async findById(id: string): Promise<Discussion | null> {
    const db = loadDatabase();
    const d = db.discussions.find((disc) => disc.id === id);
    if (!d) return null;
    const replies = db.discussionReplies.filter((r) => r.discussionId === d.id);
    return {
      ...d,
      replyCount: replies.length,
      replies,
    };
  }

  async create(discussion: Omit<Discussion, 'id' | 'createdAt' | 'updatedAt' | 'replyCount'>): Promise<Discussion> {
    const db = loadDatabase();
    const now = new Date().toISOString();
    const newDiscussion: Discussion = {
      ...discussion,
      id: `disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      replyCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.discussions.unshift(newDiscussion);
    scheduleSave();
    return newDiscussion;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.discussions.length;
    db.discussions = db.discussions.filter((d) => !(d.id === id && d.userId === userId));
    if (db.discussions.length !== initial) {
      db.discussionReplies = db.discussionReplies.filter((r) => r.discussionId !== id);
      scheduleSave();
      return true;
    }
    return false;
  }

  async addReply(reply: Omit<DiscussionReply, 'id' | 'createdAt' | 'updatedAt'>): Promise<DiscussionReply> {
    const db = loadDatabase();
    const now = new Date().toISOString();
    const newReply: DiscussionReply = {
      ...reply,
      id: `drep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    db.discussionReplies.push(newReply);

    const discussion = db.discussions.find((d) => d.id === reply.discussionId);
    if (discussion) {
      discussion.replyCount = (discussion.replyCount || 0) + 1;
      discussion.updatedAt = now;
    }

    scheduleSave();
    return newReply;
  }

  async getReplies(discussionId: string): Promise<DiscussionReply[]> {
    const db = loadDatabase();
    return db.discussionReplies.filter((r) => r.discussionId === discussionId);
  }
}

export class JsonStudyRoomRepository implements IStudyRoomRepository {
  async findAll(userId?: string): Promise<StudyRoom[]> {
    const db = loadDatabase();
    return db.studyRooms.map((r) => {
      const isMember = userId ? db.studyRoomMembers.some((m) => m.roomId === r.id && m.userId === userId) : false;
      return { ...r, isMember };
    });
  }

  async findById(id: string, userId?: string): Promise<StudyRoom | null> {
    const db = loadDatabase();
    const room = db.studyRooms.find((r) => r.id === id);
    if (!room) return null;
    const isMember = userId ? db.studyRoomMembers.some((m) => m.roomId === room.id && m.userId === userId) : false;
    return { ...room, isMember };
  }

  async create(room: Omit<StudyRoom, 'id' | 'createdAt' | 'membersCount'>): Promise<StudyRoom> {
    const db = loadDatabase();
    const newRoom: StudyRoom = {
      ...room,
      id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      membersCount: 1,
      createdAt: new Date().toISOString(),
    };
    db.studyRooms.unshift(newRoom);
    db.studyRoomMembers.push({
      roomId: newRoom.id,
      userId: room.creatorId,
      joinedAt: new Date().toISOString(),
    });
    scheduleSave();
    return newRoom;
  }

  async join(roomId: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    const exists = db.studyRoomMembers.some((m) => m.roomId === roomId && m.userId === userId);
    if (exists) return true;

    db.studyRoomMembers.push({
      roomId,
      userId,
      joinedAt: new Date().toISOString(),
    });

    const room = db.studyRooms.find((r) => r.id === roomId);
    if (room) room.membersCount = (room.membersCount || 0) + 1;

    scheduleSave();
    return true;
  }

  async leave(roomId: string, userId: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.studyRoomMembers.length;
    db.studyRoomMembers = db.studyRoomMembers.filter((m) => !(m.roomId === roomId && m.userId === userId));
    if (db.studyRoomMembers.length !== initial) {
      const room = db.studyRooms.find((r) => r.id === roomId);
      if (room && room.membersCount > 0) room.membersCount -= 1;
      scheduleSave();
      return true;
    }
    return false;
  }
}

// User Data Export Helper
export async function exportUserData(userId: string): Promise<UserExportData> {
  const db = loadDatabase();
  const user = db.users.find((u) => u.id === userId);
  const safeUser: Record<string, any> = user ? { ...user } : {};
  delete safeUser.password;
  delete safeUser.passwordHash;

  return {
    version: '2.1.0',
    exportDate: new Date().toISOString(),
    user: safeUser,
    courses: db.courses.filter((c) => c.userId === userId),
    lessons: db.lessons.filter((l) => l.userId === userId),
    notes: db.notes.filter((n) => n.userId === userId),
    terms: db.terms.filter((t) => t.userId === userId),
    quizzes: db.quizAttempts.filter((q) => q.userId === userId),
    activities: db.activities.filter((a) => a.userId === userId),
    certificates: db.certificates.filter((c) => c.userId === userId),
    combinedCertificates: db.combinedCertificates.filter((c) => c.userId === userId),
    studySessions: db.studySessions.filter((s) => s.userId === userId),
  };
}

export class JsonSharedCourseRepository implements ISharedCourseRepository {
  async findById(id: string): Promise<SharedCourse | null> {
    const db = loadDatabase();
    return db.sharedCourses.find((s) => s.id === id) || null;
  }

  async findByCourseId(courseId: string): Promise<SharedCourse | null> {
    const db = loadDatabase();
    return db.sharedCourses.find((s) => s.courseId === courseId) || null;
  }

  async create(sharedCourse: SharedCourse): Promise<SharedCourse> {
    const db = loadDatabase();
    const existingIndex = db.sharedCourses.findIndex((s) => s.id === sharedCourse.id);
    if (existingIndex >= 0) {
      db.sharedCourses[existingIndex] = { ...sharedCourse, updatedAt: new Date().toISOString() };
    } else {
      db.sharedCourses.unshift(sharedCourse);
    }
    scheduleSave();
    return sharedCourse;
  }

  async update(id: string, updates: Partial<SharedCourse>): Promise<SharedCourse | null> {
    const db = loadDatabase();
    const idx = db.sharedCourses.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    db.sharedCourses[idx] = {
      ...db.sharedCourses[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    scheduleSave();
    return db.sharedCourses[idx];
  }

  async delete(id: string, creatorId: string): Promise<boolean> {
    const db = loadDatabase();
    const initial = db.sharedCourses.length;
    db.sharedCourses = db.sharedCourses.filter((s) => !(s.id === id && s.creatorId === creatorId));
    if (db.sharedCourses.length !== initial) {
      scheduleSave();
      return true;
    }
    return false;
  }
}

// Repositories Singleton Instances
export const userRepository = new JsonUserRepository();
export const courseRepository = new JsonCourseRepository();
export const lessonRepository = new JsonLessonRepository();
export const noteRepository = new JsonNoteRepository();
export const keyTermRepository = new JsonKeyTermRepository();
export const quizRepository = new JsonQuizRepository();
export const studySessionRepository = new JsonStudySessionRepository();
export const materialRepository = new JsonMaterialRepository();
export const activityRepository = new JsonActivityRepository();
export const sessionRepository = new JsonSessionRepository();
export const passwordResetRepository = new JsonPasswordResetRepository();
export const certificateRepository = new JsonCertificateRepository();
export const combinedCertificateRepository = new JsonCombinedCertificateRepository();
export const circleRepository = new JsonCircleRepository();
export const discussionRepository = new JsonDiscussionRepository();
export const studyRoomRepository = new JsonStudyRoomRepository();
export const sharedCourseRepository = new JsonSharedCourseRepository();
