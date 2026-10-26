/**
 * Mindly Server Types & Repository Interfaces — V2.1
 */
import {
  User,
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
  StructuredContent,
  OriginalMaterial,
  Certificate,
  CombinedCertificate,
  Circle,
  CircleMembership,
  Discussion,
  DiscussionReply,
  StudyRoom,
  LearnerProfile,
  SharedCourse,
} from '../src/types';

export interface StudySessionRecord {
  id: string;
  userId: string;
  lessonId?: string;
  lessonTitle?: string;
  seconds: number;
  date: string; // YYYY-MM-DD
  timestamp: string;
}

export interface UserRecord extends User {
  passwordHash?: string;
  // Legacy plaintext password field for migration
  password?: string;
}

export interface IUserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByUsername(username: string): Promise<UserRecord | null>;
  create(user: Omit<UserRecord, 'id' | 'createdAt'> & { id?: string }): Promise<UserRecord>;
  update(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null>;
  delete(id: string): Promise<boolean>;
}

export interface ICourseRepository {
  findByUserId(userId: string): Promise<Course[]>;
  findById(id: string, userId?: string): Promise<Course | null>;
  create(course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Course>;
  update(id: string, userId: string, updates: Partial<Course>): Promise<Course | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface ILessonRepository {
  findByCourseId(courseId: string, userId?: string): Promise<Lesson[]>;
  findByUserId(userId: string): Promise<Lesson[]>;
  findById(id: string, userId?: string): Promise<Lesson | null>;
  create(lesson: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Lesson>;
  update(id: string, userId: string, updates: Partial<Lesson>): Promise<Lesson | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface INoteRepository {
  findByUserId(userId: string, filters?: { courseId?: string; lessonId?: string }): Promise<Note[]>;
  findById(id: string, userId?: string): Promise<Note | null>;
  create(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Note>;
  update(id: string, userId: string, updates: Partial<Note>): Promise<Note | null>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface IKeyTermRepository {
  findByUserId(userId: string, courseId?: string): Promise<KeyTermItem[]>;
  findById(id: string): Promise<KeyTermItem | null>;
  create(term: Omit<KeyTermItem, 'id'> & { id?: string; userId?: string }): Promise<KeyTermItem>;
  delete(id: string, userId?: string): Promise<boolean>;
}

export interface IQuizRepository {
  createAttempt(attempt: Omit<QuizAttempt, 'id'> & { id?: string }): Promise<QuizAttempt>;
  findByLessonId(lessonId: string, userId: string): Promise<QuizAttempt[]>;
  findByUserId(userId: string): Promise<QuizAttempt[]>;
}

export interface IStudySessionRepository {
  logTime(session: Omit<StudySessionRecord, 'id' | 'timestamp'>): Promise<StudySessionRecord>;
  getProgress(userId: string, dailyGoalMinutes?: number): Promise<StudyProgress>;
  findByUserId(userId: string): Promise<StudySessionRecord[]>;
}

export interface IMaterialRepository {
  findByUserId(userId: string): Promise<MaterialHistoryItem[]>;
  create(item: Omit<MaterialHistoryItem, 'id' | 'createdAt'> & { id?: string }): Promise<MaterialHistoryItem>;
}

export interface IActivityRepository {
  findByUserId(userId: string, limit?: number): Promise<ActivityItem[]>;
  create(item: Omit<ActivityItem, 'id' | 'timestamp'> & { id?: string; userId: string }): Promise<ActivityItem>;
}

export interface ISessionRepository {
  create(session: Omit<Session, 'id' | 'createdAt' | 'lastUsedAt'>): Promise<Session>;
  findByToken(token: string): Promise<Session | null>;
  touch(token: string): Promise<void>;
  deleteByToken(token: string): Promise<boolean>;
  deleteByUserId(userId: string): Promise<number>;
}

export interface IPasswordResetRepository {
  create(record: Omit<PasswordResetToken, 'id' | 'createdAt' | 'used'>): Promise<PasswordResetToken>;
  findByToken(token: string): Promise<PasswordResetToken | null>;
  markUsed(token: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
}

export interface ICertificateRepository {
  findByUserId(userId: string): Promise<Certificate[]>;
  findById(id: string, userId?: string): Promise<Certificate | null>;
  findByCertificateId(certificateId: string): Promise<Certificate | null>;
  findByCourseId(courseId: string, userId: string): Promise<Certificate | null>;
  create(certificate: Omit<Certificate, 'id' | 'createdAt'>): Promise<Certificate>;
}

export interface ICombinedCertificateRepository {
  findByUserId(userId: string): Promise<CombinedCertificate[]>;
  findById(id: string, userId?: string): Promise<CombinedCertificate | null>;
  findByCertificateId(certificateId: string): Promise<CombinedCertificate | null>;
  create(cert: Omit<CombinedCertificate, 'id' | 'createdAt'>): Promise<CombinedCertificate>;
}

export interface ICircleRepository {
  findAll(userId?: string): Promise<Circle[]>;
  findById(id: string, userId?: string): Promise<Circle | null>;
  create(circle: Omit<Circle, 'id' | 'createdAt' | 'membersCount'>): Promise<Circle>;
  join(circleId: string, userId: string): Promise<boolean>;
  leave(circleId: string, userId: string): Promise<boolean>;
  isMember(circleId: string, userId: string): Promise<boolean>;
}

export interface IDiscussionRepository {
  findAll(circleId?: string): Promise<Discussion[]>;
  findById(id: string): Promise<Discussion | null>;
  create(discussion: Omit<Discussion, 'id' | 'createdAt' | 'updatedAt' | 'replyCount'>): Promise<Discussion>;
  delete(id: string, userId: string): Promise<boolean>;
  addReply(reply: Omit<DiscussionReply, 'id' | 'createdAt' | 'updatedAt'>): Promise<DiscussionReply>;
  getReplies(discussionId: string): Promise<DiscussionReply[]>;
}

export interface IStudyRoomRepository {
  findAll(userId?: string): Promise<StudyRoom[]>;
  findById(id: string, userId?: string): Promise<StudyRoom | null>;
  create(room: Omit<StudyRoom, 'id' | 'createdAt' | 'membersCount'>): Promise<StudyRoom>;
  join(roomId: string, userId: string): Promise<boolean>;
  leave(roomId: string, userId: string): Promise<boolean>;
}

export interface ISharedCourseRepository {
  findById(id: string): Promise<SharedCourse | null>;
  findByCourseId(courseId: string): Promise<SharedCourse | null>;
  create(sharedCourse: SharedCourse): Promise<SharedCourse>;
  update(id: string, updates: Partial<SharedCourse>): Promise<SharedCourse | null>;
  delete(id: string, creatorId: string): Promise<boolean>;
}
