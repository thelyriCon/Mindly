/**
 * Search Service Layer
 * Supports keyword search across Courses, Lessons, Notes, Key Terms, and Raw Materials.
 * Prepared for future vector embeddings & semanticSearch without redesigning the UI.
 */
import {
  courseRepository,
  lessonRepository,
  noteRepository,
  keyTermRepository,
  materialRepository
} from '../repositories/jsonRepository';
import { SearchResultItem } from '../../src/types';

export class SearchService {
  /**
   * Fast lexical multi-entity search scoped to authenticated user
   */
  async search(query: string, userId: string): Promise<SearchResultItem[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const [courses, lessons, notes, terms, materials] = await Promise.all([
      courseRepository.findByUserId(userId),
      lessonRepository.findByUserId(userId),
      noteRepository.findByUserId(userId),
      keyTermRepository.findByUserId(userId),
      materialRepository.findByUserId(userId),
    ]);

    const results: SearchResultItem[] = [];

    // 1. Courses
    for (const c of courses) {
      if (c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) {
        results.push({
          id: c.id,
          type: 'course',
          title: c.title,
          snippet: c.description || 'Course',
          location: `Courses → ${c.category || 'General'}`,
          courseId: c.id,
          courseTitle: c.title,
        });
      }
    }

    // 2. Lessons
    for (const l of lessons) {
      const parentCourse = courses.find((c) => c.id === l.courseId);
      const inTitle = l.title.toLowerCase().includes(q);
      const inOverview = l.structuredContent?.overview?.toLowerCase().includes(q);
      const inRaw = l.originalMaterial?.content?.toLowerCase().includes(q);

      if (inTitle || inOverview || inRaw) {
        results.push({
          id: l.id,
          type: 'lesson',
          title: l.title,
          snippet: l.structuredContent?.overview || l.originalMaterial?.content?.slice(0, 140) || 'Lesson',
          location: `${parentCourse ? parentCourse.title : 'Course'} → ${l.title}`,
          courseId: l.courseId,
          courseTitle: parentCourse?.title,
          lessonId: l.id,
        });
      }
    }

    // 3. Key Terms
    for (const t of terms) {
      if (t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)) {
        results.push({
          id: t.id || `term_${t.term}`,
          type: 'term',
          title: t.term,
          snippet: t.definition,
          location: t.context || 'Glossary',
          courseId: t.courseId,
          lessonId: t.lessonId,
        });
      }
    }

    // 4. Notes
    for (const n of notes) {
      if (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
        results.push({
          id: n.id,
          type: 'note',
          title: n.title,
          snippet: n.content.slice(0, 140),
          location: n.courseTitle ? `${n.courseTitle} → Note` : 'Personal Notes',
          noteId: n.id,
          courseId: n.courseId || undefined,
          lessonId: n.lessonId || undefined,
        });
      }
    }

    // 5. Raw Materials
    for (const m of materials) {
      if (m.title.toLowerCase().includes(q) || m.rawSnippet.toLowerCase().includes(q)) {
        results.push({
          id: m.id,
          type: 'material',
          title: m.title,
          snippet: m.rawSnippet,
          location: `${m.courseTitle || 'Raw Dump'} (${m.type})`,
          courseId: m.courseId,
          lessonId: m.lessonId,
        });
      }
    }

    return results.slice(0, 35);
  }

  /**
   * Architectural hook for future vector semantic search
   */
  async semanticSearch(query: string, userId: string): Promise<SearchResultItem[]> {
    // Currently falls back to clean lexical search; ready to plug in Gemini text embeddings
    return this.search(query, userId);
  }
}

export const searchService = new SearchService();
