/**
 * Mindly Core TypeScript Types & Data Schemas
 */

export interface User {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  interests: string[];
  createdAt: string;
  onboardingCompleted?: boolean;
  hasCompletedOnboarding?: boolean;
  dailyStudyGoalMinutes?: number;
  todayStudySeconds?: number;
  settings?: {
    theme: 'dark' | 'light';
    fontSize: 'normal' | 'large' | 'xlarge';
    aiStrictness: 'strict_material_only' | 'balanced_explanation';
    dailyStudyGoalMinutes?: number;
  };
}

export interface StudyProgress {
  dailyGoalMinutes: number;
  todaySeconds: number;
  todayMinutes: number;
  progressPercent: number;
  streakDays: number;
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
}

export interface StructuredContent {
  title: string;
  overview: string;
  learningObjectives: string[];
  mainConcepts: LessonConcept[];
  examples: LessonExample[];
  importantDistinctions: ImportantDistinction[];
  keyTerms: KeyTermItem[];
  keyTakeaways: string[];
  reviewQuestions: ReviewQuestion[];
  // Distinguishing sections
  fromMaterialNotes?: string;
  aiExplanations?: string;
  suggestedFurtherLearning?: string[];
}

export interface OriginalMaterial {
  type: 'text' | 'image' | 'document' | 'notes';
  content: string; // raw text, markdown or base64 image data url
  sourceTitle?: string;
  uploadedAt: string;
  fileName?: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  userId: string;
  title: string;
  order: number;
  originalMaterial: OriginalMaterial;
  structuredContent: StructuredContent;
  isCompleted: boolean;
  isBookmarked: boolean;
  quizScore?: number | null;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export interface Course {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  coverIcon: string;
  coverImage?: string;
  courseType: 'self-created' | 'ai-assisted' | 'imported' | 'manually-built' | string;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
  lessonsCount?: number;
  lessonCount?: number;
  completedLessonsCount?: number;
  progress?: number;
  progressPercent?: number;
}

export interface Note {
  id: string;
  userId: string;
  courseId?: string | null;
  lessonId?: string | null;
  title: string;
  content: string; // Markdown / structured note text
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
  answers: Record<string, string>; // questionId -> userAnswer
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
  type: 'course' | 'lesson' | 'note' | 'term' | 'material' | 'raw_material' | string;
  title: string;
  snippet: string;
  location?: string;
  courseId?: string;
  courseTitle?: string;
  lessonId?: string;
  noteId?: string;
}

export interface ActivityItem {
  id: string;
  type: 'lesson_created' | 'material_imported' | 'note_edited' | 'lesson_completed' | 'quiz_taken' | 'note_created' | 'quiz_completed' | 'course_created' | string;
  title: string;
  timestamp: string;
  details?: string;
  courseId?: string;
  lessonId?: string;
}
