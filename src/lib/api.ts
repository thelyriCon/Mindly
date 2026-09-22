/**
 * Mindly API Client
 */
import { User, Course, Lesson, Note, KeyTermItem, ActivityItem, MaterialHistoryItem, SearchResultItem, StructuredContent, StudyProgress } from '../types';

export const api = {
  // Auth & Profile
  async getMe(): Promise<{ user: User }> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Failed to fetch user profile');
    return res.json();
  },

  // Daily Study Goal & Tracking
  async getStudyProgress(): Promise<{ progress: StudyProgress }> {
    const res = await fetch('/api/study-time/progress');
    if (!res.ok) throw new Error('Failed to fetch study progress');
    return res.json();
  },

  async updateStudyGoal(targetMinutes: number): Promise<{ progress: StudyProgress; user: User }> {
    const res = await fetch('/api/study-time/goal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetMinutes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update study goal');
    }
    return res.json();
  },

  async logStudyTime(seconds: number, lessonId?: string): Promise<{ progress: StudyProgress }> {
    const res = await fetch('/api/study-time/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seconds, lessonId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to log study time');
    }
    return res.json();
  },

  async login(email: string, password?: string): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async register(name: string, email: string, password?: string): Promise<{ user: User; token: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  async resetPassword(email: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  async updateProfile(updates: Partial<User>): Promise<{ user: User }> {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  // Courses
  async getCourses(): Promise<{ courses: Course[] }> {
    const res = await fetch('/api/courses');
    if (!res.ok) throw new Error('Failed to fetch courses');
    return res.json();
  },

  async getCourse(id: string): Promise<{ course: Course; lessons: Lesson[] }> {
    const res = await fetch(`/api/courses/${id}`);
    if (!res.ok) throw new Error('Failed to fetch course details');
    return res.json();
  },

  async createCourse(data: {
    title: string;
    description?: string;
    category?: string;
    coverIcon?: string;
    courseType?: string;
  }): Promise<{ course: Course }> {
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create course');
    }
    return res.json();
  },

  async updateCourse(id: string, data: Partial<Course>): Promise<{ course: Course }> {
    const res = await fetch(`/api/courses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update course');
    return res.json();
  },

  async deleteCourse(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete course');
    return res.json();
  },

  // Lessons
  async getLesson(id: string): Promise<{ lesson: Lesson; course: Course }> {
    const res = await fetch(`/api/lessons/${id}`);
    if (!res.ok) throw new Error('Failed to fetch lesson');
    return res.json();
  },

  async createLesson(courseId: string, data: {
    title: string;
    originalMaterial?: any;
    structuredContent?: StructuredContent;
  }): Promise<{ lesson: Lesson }> {
    const res = await fetch(`/api/courses/${courseId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create lesson');
    return res.json();
  },

  async updateLesson(id: string, data: {
    title?: string;
    structuredContent?: StructuredContent;
    originalMaterial?: any;
  }): Promise<{ lesson: Lesson }> {
    const res = await fetch(`/api/lessons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update lesson');
    return res.json();
  },

  async toggleComplete(lessonId: string): Promise<{ lesson: Lesson }> {
    const res = await fetch(`/api/lessons/${lessonId}/toggle-complete`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to toggle completion');
    return res.json();
  },

  async toggleBookmark(lessonId: string): Promise<{ lesson: Lesson }> {
    const res = await fetch(`/api/lessons/${lessonId}/toggle-bookmark`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to toggle bookmark');
    return res.json();
  },

  async deleteLesson(lessonId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete lesson');
    return res.json();
  },

  // Notes
  async getNotes(courseId?: string, lessonId?: string): Promise<{ notes: Note[] }> {
    const params = new URLSearchParams();
    if (courseId) params.append('courseId', courseId);
    if (lessonId) params.append('lessonId', lessonId);
    const res = await fetch(`/api/notes?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch notes');
    return res.json();
  },

  async createNote(data: {
    title: string;
    content: string;
    courseId?: string | null;
    lessonId?: string | null;
    tags?: string[];
    type?: 'general' | 'course' | 'lesson';
  }): Promise<{ note: Note }> {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create note');
    return res.json();
  },

  async updateNote(id: string, data: Partial<Note>): Promise<{ note: Note }> {
    const res = await fetch(`/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update note');
    return res.json();
  },

  async deleteNote(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete note');
    return res.json();
  },

  // Key Terms
  async getTerms(courseId?: string): Promise<{ terms: KeyTermItem[] }> {
    const url = courseId ? `/api/terms?courseId=${courseId}` : '/api/terms';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch terms');
    return res.json();
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
    const res = await fetch('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create term');
    return res.json();
  },

  async deleteTerm(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/terms/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete term');
    return res.json();
  },

  // Quizzes & Activities
  async submitQuizAttempt(data: {
    lessonId: string;
    score: number;
    totalQuestions: number;
    answers: Record<string, string>;
  }): Promise<{ attempt: any }> {
    const res = await fetch('/api/quizzes/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to submit quiz attempt');
    return res.json();
  },

  async getActivities(): Promise<{ activities: ActivityItem[] }> {
    const res = await fetch('/api/activities');
    if (!res.ok) return { activities: [] };
    return res.json();
  },

  async getMaterials(): Promise<{ materials: MaterialHistoryItem[] }> {
    const res = await fetch('/api/materials');
    if (!res.ok) return { materials: [] };
    return res.json();
  },

  // Global Search
  async search(query: string): Promise<{ results: SearchResultItem[] }> {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { results: [] };
    return res.json();
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
    const res = await fetch('/api/ai/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to structure material with AI');
    }
    return res.json();
  },

  async askTutor(data: {
    question: string;
    lessonContext: any;
    courseContext?: string;
    originalMaterial?: string;
  }): Promise<{ answer: string }> {
    const res = await fetch('/api/ai/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to get answer from tutor');
    }
    return res.json();
  },

  async generateQuiz(data: {
    lessonTitle: string;
    overview: string;
    mainConcepts: any[];
  }): Promise<{ questions: any[] }> {
    const res = await fetch('/api/ai/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate quiz');
    }
    return res.json();
  },
};
