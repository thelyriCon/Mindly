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
} from '../types';
import { getDemoDatabase } from './demoData';

const STORAGE_KEY = 'mindly_local_db';

function getLocalDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user && parsed.courses) return parsed;
    }
  } catch (e) {
    console.warn('LocalStorage access warning:', e);
  }
  const initial = getDemoDatabase();
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
  async getMe(): Promise<{ user: User }> {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) return data;
      }
    } catch {
      // Offline/Static fallback
    }
    const db = getLocalDb();
    return { user: db.user };
  },

  // Daily Study Goal & Tracking
  async getStudyProgress(): Promise<{ progress: StudyProgress }> {
    try {
      const res = await fetch('/api/study-time/progress');
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    return { progress: db.progress };
  },

  async updateStudyGoal(targetMinutes: number): Promise<{ progress: StudyProgress; user: User }> {
    try {
      const res = await fetch('/api/study-time/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMinutes }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    db.user.dailyStudyGoalMinutes = targetMinutes;
    db.progress.dailyGoalMinutes = targetMinutes;
    db.progress.progressPercent = Math.min(
      100,
      Math.round((db.progress.todayMinutes / targetMinutes) * 100)
    );
    db.progress.remainingMinutes = Math.max(0, targetMinutes - db.progress.todayMinutes);
    db.progress.isGoalReached = db.progress.todayMinutes >= targetMinutes;
    saveLocalDb(db);
    return { progress: db.progress, user: db.user };
  },

  async logStudyTime(seconds: number, lessonId?: string): Promise<{ progress: StudyProgress }> {
    try {
      const res = await fetch('/api/study-time/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds, lessonId }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const addMins = Math.round(seconds / 60);
    db.progress.todaySeconds = (db.progress.todaySeconds || 0) + seconds;
    db.progress.todayMinutes = Math.round(db.progress.todaySeconds / 60);
    const target = db.progress.dailyGoalMinutes || 30;
    db.progress.progressPercent = Math.min(100, Math.round((db.progress.todayMinutes / target) * 100));
    db.progress.remainingMinutes = Math.max(0, target - db.progress.todayMinutes);
    db.progress.isGoalReached = db.progress.todayMinutes >= target;
    saveLocalDb(db);
    return { progress: db.progress };
  },

  async login(email: string, password?: string): Promise<{ user: User; token: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    db.user.email = email;
    saveLocalDb(db);
    return { user: db.user, token: 'demo-local-token' };
  },

  async register(name: string, email: string, password?: string): Promise<{ user: User; token: string }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    db.user.name = name;
    db.user.email = email;
    saveLocalDb(db);
    return { user: db.user, token: 'demo-local-token' };
  },

  async resetPassword(email: string): Promise<{ message: string }> {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return { message: 'Password reset link sent to ' + email };
  },

  async updateProfile(updates: Partial<User>): Promise<{ user: User }> {
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    db.user = { ...db.user, ...updates };
    saveLocalDb(db);
    return { user: db.user };
  },

  // Courses
  async getCourses(): Promise<{ courses: Course[] }> {
    try {
      const res = await fetch('/api/courses');
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    return { courses: db.courses || [] };
  },

  async getCourse(id: string): Promise<{ course: Course; lessons: Lesson[] }> {
    try {
      const res = await fetch(`/api/courses/${id}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const course = db.courses?.find((c: any) => c.id === id) || db.courses?.[0];
    const lessons = db.lessons?.filter((l: any) => l.courseId === course?.id) || [];
    return { course, lessons };
  },

  async createCourse(data: {
    title: string;
    description?: string;
    category?: string;
    coverIcon?: string;
    courseType?: string;
  }): Promise<{ course: Course }> {
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const newCourse: Course = {
      id: 'crs_' + Date.now(),
      userId: db.user.id,
      title: data.title,
      description: data.description || '',
      category: data.category || 'General',
      coverIcon: data.coverIcon || 'BookOpen',
      courseType: data.courseType || 'custom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.courses = [newCourse, ...(db.courses || [])];
    saveLocalDb(db);
    return { course: newCourse };
  },

  async updateCourse(id: string, data: Partial<Course>): Promise<{ course: Course }> {
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const idx = db.courses.findIndex((c: any) => c.id === id);
    if (idx !== -1) {
      db.courses[idx] = { ...db.courses[idx], ...data, updatedAt: new Date().toISOString() };
      saveLocalDb(db);
      return { course: db.courses[idx] };
    }
    throw new Error('Course not found');
  },

  async deleteCourse(id: string): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    db.courses = (db.courses || []).filter((c: any) => c.id !== id);
    saveLocalDb(db);
    return { success: true };
  },

  // Lessons
  async getLesson(id: string): Promise<{ lesson: Lesson; course: Course }> {
    try {
      const res = await fetch(`/api/lessons/${id}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const lesson = db.lessons?.find((l: any) => l.id === id) || db.lessons?.[0];
    const course = db.courses?.find((c: any) => c.id === lesson?.courseId) || db.courses?.[0];
    return { lesson, course };
  },

  async createLesson(
    courseId: string,
    data: {
      title: string;
      originalMaterial?: any;
      structuredContent?: StructuredContent;
    }
  ): Promise<{ lesson: Lesson }> {
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const newLesson: Lesson = {
      id: 'lsn_' + Date.now(),
      courseId,
      userId: db.user.id,
      title: data.title,
      order: (db.lessons?.filter((l: any) => l.courseId === courseId).length || 0) + 1,
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
    db.lessons = [...(db.lessons || []), newLesson];
    saveLocalDb(db);
    return { lesson: newLesson };
  },

  async updateLesson(
    id: string,
    data: {
      title?: string;
      structuredContent?: StructuredContent;
      originalMaterial?: any;
    }
  ): Promise<{ lesson: Lesson }> {
    try {
      const res = await fetch(`/api/lessons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const idx = db.lessons.findIndex((l: any) => l.id === id);
    if (idx !== -1) {
      db.lessons[idx] = { ...db.lessons[idx], ...data, updatedAt: new Date().toISOString() };
      saveLocalDb(db);
      return { lesson: db.lessons[idx] };
    }
    throw new Error('Lesson not found');
  },

  async toggleComplete(lessonId: string): Promise<{ lesson: Lesson }> {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/toggle-complete`, { method: 'POST' });
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
    try {
      const res = await fetch(`/api/lessons/${lessonId}/toggle-bookmark`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const lesson = db.lessons.find((l: any) => l.id === lessonId);
    if (lesson) {
      lesson.isBookmarked = !lesson.isBookmarked;
      lesson.updatedAt = new Date().toISOString();
      saveLocalDb(db);
      return { lesson };
    }
    throw new Error('Lesson not found');
  },

  async deleteLesson(lessonId: string): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    db.lessons = (db.lessons || []).filter((l: any) => l.id !== lessonId);
    saveLocalDb(db);
    return { success: true };
  },

  // Notes
  async getNotes(courseId?: string, lessonId?: string): Promise<{ notes: Note[] }> {
    try {
      const params = new URLSearchParams();
      if (courseId) params.append('courseId', courseId);
      if (lessonId) params.append('lessonId', lessonId);
      const res = await fetch(`/api/notes?${params.toString()}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
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
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const newNote: Note = {
      id: 'nt_' + Date.now(),
      userId: db.user.id,
      title: data.title,
      content: data.content,
      courseId: data.courseId,
      lessonId: data.lessonId,
      tags: data.tags || [],
      type: data.type || (data.lessonId ? 'lesson' : data.courseId ? 'course' : 'general'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.notes = [newNote, ...(db.notes || [])];
    saveLocalDb(db);
    return { note: newNote };
  },

  async updateNote(id: string, data: Partial<Note>): Promise<{ note: Note }> {
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    const idx = db.notes.findIndex((n: any) => n.id === id);
    if (idx !== -1) {
      db.notes[idx] = { ...db.notes[idx], ...data, updatedAt: new Date().toISOString() };
      saveLocalDb(db);
      return { note: db.notes[idx] };
    }
    throw new Error('Note not found');
  },

  async deleteNote(id: string): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    db.notes = (db.notes || []).filter((n: any) => n.id !== id);
    saveLocalDb(db);
    return { success: true };
  },

  // Key Terms
  async getTerms(courseId?: string): Promise<{ terms: KeyTermItem[] }> {
    try {
      const url = courseId ? `/api/terms?courseId=${courseId}` : '/api/terms';
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
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
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
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
    try {
      const res = await fetch(`/api/terms/${id}`, { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
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
    try {
      const res = await fetch('/api/quizzes/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    try {
      const res = await fetch('/api/activities');
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const db = getLocalDb();
    return { activities: db.activities || [] };
  },

  async getMaterials(): Promise<{ materials: MaterialHistoryItem[] }> {
    try {
      const res = await fetch('/api/materials');
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return { materials: [] };
  },

  // Global Search
  async search(query: string): Promise<{ results: SearchResultItem[] }> {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
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
    lessonContext: any;
    courseContext?: string;
    originalMaterial?: string;
  }): Promise<{ answer: string }> {
    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return {
      answer: `Regarding "${data.question}": Based on the study material for ${data.lessonContext?.title || 'this lesson'}, focus on the primary definition and underlying structural principles. (Note: Full live Gemini generation requires the backend server with GEMINI_API_KEY).`,
    };
  },

  async generateQuiz(data: {
    lessonTitle: string;
    overview: string;
    mainConcepts: any[];
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
};
