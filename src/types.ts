/**
 * Mindly Core TypeScript Types & Data Schemas — V2.1
 */

export interface PrivacySettings {
  profileVisibility: 'public' | 'members' | 'private';
  showCompletedCourses: boolean;
  showCertificates: boolean;
  showStudyActivity: boolean;
}

export interface User {
  id: string;
  name: string; // Real Name (for certificates & formal records)
  realName?: string; // Explicit Real Name
  username?: string; // Unique handle e.g. @iCon
  email: string;
  profileImage?: string;
  bio?: string;
  interests: string[];
  createdAt: string;
  onboardingCompleted?: boolean;
  hasCompletedOnboarding?: boolean;
  dailyStudyGoalMinutes?: number;
  todayStudySeconds?: number;
  privacySettings?: PrivacySettings;
  settings?: {
    theme: 'dark' | 'light';
    fontSize: 'normal' | 'large' | 'xlarge';
    aiStrictness: 'strict' | 'balanced' | 'strict_material_only' | 'balanced_explanation';
    dailyStudyGoalMinutes?: number;
  };
}

export interface MicroArticle {
  id: string;
  topic: string;
  category: string;
  headline: string;
  snippet: string; // 3 to 4 sentences explaining the principle
  fullContent?: string; // Comprehensive walkthrough (at least 230 words)
  keyInsight?: string;
  imageUrl?: string;
  imageCaption?: string;
  suggestedCourseTitle: string;
  tags: string[];
  readTime: string;
}

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  certificateId: string; // e.g. MND-7X9K2P
  realName: string; // Learner's REAL NAME (strictly not @username)
  courseTitle: string;
  completionDate: string;
  verificationCode: string;
  grade?: string;
  totalLessons?: number;
  hoursInvested?: number;
  createdAt: string;
}

export interface CombinedCertificate {
  id: string;
  userId: string;
  certificateId: string; // e.g. MND-COMB-4921
  realName: string;
  courseTitles: string[];
  certificateIds: string[];
  completionDate: string;
  verificationCode: string;
  createdAt: string;
}

export interface Circle {
  id: string;
  name: string;
  description: string;
  topic: string;
  membersCount: number;
  isJoined?: boolean;
  createdAt: string;
}

export interface CircleMembership {
  userId: string;
  circleId: string;
  joinedAt: string;
}

export interface Discussion {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  circleId?: string;
  circleName?: string;
  title: string;
  content: string;
  type: 'question' | 'discussion' | 'insight';
  replyCount: number;
  replies?: DiscussionReply[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionReply {
  id: string;
  discussionId: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyRoom {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  name: string;
  topic: string;
  description: string;
  membersCount: number;
  studyGoal?: string;
  sessionTime?: string;
  isMember?: boolean;
  createdAt: string;
}

export interface LearnerProfile {
  userId: string;
  realName: string;
  username: string;
  bio?: string;
  profileImage?: string;
  interests: string[];
  completedCoursesCount: number;
  certificatesCount: number;
  joinedCirclesCount: number;
  visibilitySettings: PrivacySettings;
}

export interface ExtractedDocument {
  text: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount?: number;
  wordCount?: number;
  isScanned?: boolean;
  metadata?: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface UserExportData {
  version: string;
  exportDate: string;
  user: Partial<User>;
  courses: Course[];
  lessons: Lesson[];
  notes: Note[];
  terms: KeyTermItem[];
  quizzes: QuizAttempt[];
  activities: ActivityItem[];
  certificates: Certificate[];
  combinedCertificates: CombinedCertificate[];
  studySessions: any[];
}

export interface ActivityDay {
  date: string;
  dayName: string;
  dayNumber: number;
  hasActivity: boolean;
  minutesStudied: number;
  activityCount: number;
  isToday: boolean;
}

export interface StudyProgress {
  dailyGoalMinutes: number;
  todaySeconds: number;
  todayMinutes: number;
  progressPercent: number;
  streakDays: number;
  longestStreakDays?: number;
  hasActivityToday?: boolean;
  recentActivityDays?: ActivityDay[];
  milestoneTitle?: string;
  nextMilestoneDays?: number;
  totalActiveDays?: number;
  remainingMinutes: number;
  isGoalReached: boolean;
}

export interface ConceptSubtopic {
  title: string;
  explanation: string;
}

export interface LessonConcept {
  id: string;
  title: string;
  explanation: string;
  subtopics: ConceptSubtopic[];
}

export interface LessonExample {
  title: string;
  description: string;
  fromMaterial: boolean; // Distinguishes material-sourced examples from AI-generated
}

export interface ImportantDistinction {
  conceptA: string;
  conceptB: string;
  distinction: string;
}

export interface KeyTermItem {
  id?: string;
  term: string;
  definition: string;
  context?: string;
  relatedConcepts?: string[];
  courseId?: string;
  lessonId?: string;
  lessonTitle?: string;
}

export interface ReviewQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[]; // for multiple_choice
  answer: string;
  explanation: string;
  sectionId?: string;
  sectionTitle?: string;
  context?: string;
}

export interface LessonDiagram {
  title: string;
  caption: string;
  mermaidCode: string; // Valid Mermaid.js diagram definition (graph TD, sequenceDiagram, stateDiagram-v2, etc.)
}

export interface LessonImage {
  url: string;
  caption: string;
  source: string;
  author?: string;
  license?: string;
}

export interface StructuredContent {
  title: string;
  overview: string;
  learningObjectives: string[];
  mainConcepts: LessonConcept[];
  diagrams?: LessonDiagram[];
  images?: LessonImage[];
  examples: LessonExample[];
  importantDistinctions: ImportantDistinction[];
  keyTerms: KeyTermItem[];
  keyTakeaways: string[];
  reviewQuestions: ReviewQuestion[];
  // Clear visual and structural distinctions
  fromMaterialNotes?: string;
  aiExplanations?: string;
  suggestedFurtherLearning?: string[];
}

export type StructuredLessonContent = StructuredContent;

export interface OriginalMaterial {
  type: 'text' | 'image' | 'document' | 'notes';
  content: string; // raw text, markdown or base64 image data url
  sourceTitle?: string;
  uploadedAt: string;
  fileName?: string;
  fileType?: string;
  pageCount?: number;
  wordCount?: number;
}

export type SpacedRepetitionRating = 'again' | 'hard' | 'good' | 'easy';

export interface LessonSpacedRepetition {
  stage: number; // 0: unreviewed, 1: 1d, 2: 3d, 3: 7d, 4: 14d, 5: 30d (mastered)
  nextReviewDate: string; // ISO date string
  lastReviewedAt?: string;
  reviewCount: number;
  easeFactor: number; // default 2.5
  intervalDays: number;
  lastRating?: SpacedRepetitionRating;
  retentionEstimate?: number; // 0 - 100%
}

export interface DueReviewItem {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  stage: number;
  intervalDays: number;
  dueStatus: 'overdue' | 'due_today' | 'upcoming';
  daysOverdue?: number;
  nextReviewDate: string;
  lastReviewedAt?: string;
  reviewCount: number;
  quizScore?: number | null;
  overview?: string;
  keyTermsCount?: number;
  mainConceptsCount?: number;
}

export interface SpacedRepetitionSummary {
  dueReviews: DueReviewItem[];
  upcomingReviews: DueReviewItem[];
  stats: {
    dueCount: number;
    masteredCount: number;
    inProgressCount: number;
    totalTracked: number;
    retentionRate: number;
  };
}

export interface Lesson {
  id: string;
  courseId: string;
  userId: string;
  title: string;
  order: number;
  dayNumber?: number; // e.g. Day 1, Day 2
  dayTitle?: string;  // e.g. "Day 1: Foundations"
  isLocked?: boolean; // Locked until previous day's milestone check-in is passed
  originalMaterial: OriginalMaterial;
  structuredContent: StructuredContent;
  isCompleted: boolean;
  isBookmarked: boolean;
  quizScore?: number | null;
  spacedRepetition?: LessonSpacedRepetition;
  scrollOffsetPosition?: number;
  userNotes?: string;
  content?: string;
  diagrams?: LessonDiagram[];
  images?: LessonImage[];
  quizzes?: ReviewQuestion[];
  readingPosition?: {
    scrollY: number;
    sectionId?: string;
    dayNumber?: number;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export type DepthOption = 'quick' | 'standard' | 'deep';

export interface StudyDayMilestone {
  dayNumber: number;
  title: string;
  overview?: string;
  estimatedMinutes?: number;
  checkInQuiz: ReviewQuestion[];
  isPassed: boolean;
  score?: number | null;
  passedAt?: string;
}

export interface Course {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  coverIcon?: string;
  coverImage?: string;
  courseType?: 'self-created' | 'ai-assisted' | 'imported' | 'manually-built' | string;
  depth?: DepthOption;
  dailyMinutesRange?: string;
  dailyStudyGoalMinutes?: number;
  estimatedDays?: number;
  learningObjectives?: string[];
  studyDays?: StudyDayMilestone[]; // Grouped study days with milestone gates
  finalExam?: ReviewQuestion[]; // Comprehensive Final Exam exclusively at end of final day
  finalExamPassed?: boolean;
  finalExamScore?: number | null;
  finalExamPassedAt?: string;
  lastReadLessonId?: string;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
  isCompleted?: boolean;
  lessonsCount?: number;
  lessonCount?: number;
  totalLessonsCount?: number;
  completedLessonsCount?: number;
  progress?: number;
  progressPercent?: number;
  certificateId?: string;
  isArchived?: boolean;
  archivedAt?: string;
  shareId?: string;
  originalShareId?: string;
}

export interface SharedCourseLesson {
  id: string;
  title: string;
  order: number;
  dayNumber?: number;
  dayTitle?: string;
  originalMaterial?: OriginalMaterial;
  structuredContent: StructuredContent;
  diagrams?: LessonDiagram[];
  images?: LessonImage[];
  quizzes?: ReviewQuestion[];
}

export interface SharedCourse {
  id: string; // shareId
  courseId: string;
  creatorId: string;
  creatorName?: string;
  title: string;
  description: string;
  category: string;
  coverIcon?: string;
  coverImage?: string;
  depth?: DepthOption;
  estimatedDays?: number;
  dailyMinutesRange?: string;
  learningObjectives?: string[];
  studyDays?: StudyDayMilestone[];
  finalExam?: ReviewQuestion[];
  lessonCount: number;
  lessons: SharedCourseLesson[];
  createdAt: string;
  updatedAt: string;
}

export interface SubtopicItem {
  id: string;
  title: string;
  description: string;
}

export interface PlannedModule {
  id: string;
  title: string;
  overview: string;
  learningObjectives: string[];
  keyTopics: string[];
  estimatedMinutes: number;
  dayNumber?: number;
  dayTitle?: string;
}

export interface PlannedDay {
  dayNumber: number;
  title: string;
  overview?: string;
  estimatedMinutes: number;
  modules: PlannedModule[];
  checkInQuiz?: ReviewQuestion[];
}

export interface GeneratedCoursePlan {
  title: string;
  description: string;
  category: string;
  depth: 'quick' | 'standard' | 'deep';
  dailyMinutesRange: string;
  dailyMinutes: number;
  estimatedDays: number;
  durationLabel: string;
  learningObjectives: string[];
  days?: PlannedDay[];
  modules: PlannedModule[];
  finalExam?: ReviewQuestion[];
  phaseNotice?: string;
}

export interface AudioTranscriptionResult {
  transcript: string;
  provider: string;
  wordCount: number;
  durationSecondsEstimate?: number;
}

export interface Note {
  id: string;
  userId: string;
  courseId?: string | null;
  lessonId?: string | null;
  title: string;
  content: string;
  tags: string[];
  type: 'general' | 'course' | 'lesson';
  createdAt: string;
  updatedAt: string;
  courseTitle?: string;
  lessonTitle?: string;
}

export interface QuizAttempt {
  id: string;
  lessonId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  date: string;
  answers: Record<string, string>;
}

export interface MaterialHistoryItem {
  id: string;
  userId: string;
  courseId?: string;
  courseTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  type: 'transcript' | 'article' | 'screenshot' | 'notes' | 'document';
  title: string;
  rawSnippet: string;
  createdAt: string;
  status: 'raw' | 'structured';
}

export interface SearchResultItem {
  id: string;
  type: 'course' | 'lesson' | 'note' | 'term' | 'material' | 'circle' | 'discussion' | string;
  title: string;
  snippet: string;
  location?: string;
  courseId?: string;
  courseTitle?: string;
  lessonId?: string;
  noteId?: string;
  discussionId?: string;
  circleId?: string;
}

export interface ActivityItem {
  id: string;
  type:
    | 'lesson_created'
    | 'material_imported'
    | 'note_edited'
    | 'lesson_completed'
    | 'quiz_taken'
    | 'note_created'
    | 'quiz_completed'
    | 'course_created'
    | 'course_completed'
    | 'certificate_earned'
    | 'discussion_created'
    | 'circle_joined'
    | string;
  title: string;
  timestamp: string;
  details?: string;
  courseId?: string;
  lessonId?: string;
}
