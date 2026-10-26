/**
 * Mindly Background Sync & Offline Asset Cache Engine
 * Automatically queues local changes (notes, progress updates, reading positions)
 * and flushes them to the server when connectivity is restored.
 */
import { persistenceEngine, PendingSyncItem, SyncOperationType } from './persistence';
import { Course, Lesson } from '../types';
import { auth } from './firebase';
import { logStudySessionInFirestore } from './firestoreLearning';

export interface SyncEngineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

type SyncListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private lastSyncAt: number | null = null;
  private lastError: string | null = null;
  private pollInterval: any = null;
  private isInitialized = false;

  constructor() {
    // Lazy initialize when in browser environment
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen to network status changes
    window.addEventListener('online', () => {
      console.log('[SyncEngine] Network connectivity restored. Draining offline outbox...');
      this.notifyListeners();
      this.drainQueue();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncEngine] Device went offline. Local changes will be queued.');
      this.notifyListeners();
    });

    // Listen to Service Worker BackgroundSync trigger messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'MINDLY_TRIGGER_BACKGROUND_SYNC') {
          console.log('[SyncEngine] Service Worker requested sync flush.');
          this.drainQueue();
        }
      });
    }

    // Periodic check every 30 seconds when online
    this.pollInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.getPendingCount().then((count) => {
          if (count > 0) {
            this.drainQueue();
          }
        });
      }
    }, 30000);

    // Initial check on boot
    setTimeout(() => {
      if (navigator.onLine) {
        this.drainQueue();
      }
    }, 1500);
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Initial emit
    this.getStatus().then((status) => listener(status));

    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getStatus(): Promise<SyncEngineStatus> {
    const pendingCount = await this.getPendingCount();
    return {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
    };
  }

  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('[SyncEngine] Listener notice:', err);
      }
    });
  }

  public async getPendingCount(): Promise<number> {
    try {
      return await persistenceEngine.getPendingSyncCount();
    } catch {
      return 0;
    }
  }

  /**
   * Enqueues an operation to the persistent offline outbox
   */
  public async enqueue(type: SyncOperationType, payload: any): Promise<PendingSyncItem> {
    console.log(`[SyncEngine] Queuing offline action: [${type}]`, payload);
    const item = await persistenceEngine.addPendingSync(type, payload);
    this.notifyListeners();

    // Register Background Sync with Service Worker if supported
    this.requestBackgroundSync();

    // If online right now, schedule an immediate drain
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setTimeout(() => this.drainQueue(), 200);
    }

    return item;
  }

  /**
   * Register with browser's native BackgroundSync API
   */
  public async requestBackgroundSync(): Promise<void> {
    try {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const reg = (await navigator.serviceWorker.ready) as any;
        if (reg?.sync?.register) {
          await reg.sync.register('mindly-sync-pending');
        }
      }
    } catch (e) {
      // BackgroundSync not supported or permission denied; handled gracefully by online event
    }
  }

  /**
   * Processes all pending items sequentially and syncs to server
   */
  public async drainQueue(): Promise<{ synced: number; remaining: number }> {
    if (this.isSyncing) {
      return { synced: 0, remaining: await this.getPendingCount() };
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, remaining: await this.getPendingCount() };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifyListeners();

    let synced = 0;
    try {
      const items = await persistenceEngine.getPendingSyncItems();
      if (items.length === 0) {
        this.isSyncing = false;
        this.notifyListeners();
        return { synced: 0, remaining: 0 };
      }

      // If there is no authenticated Firebase user, do not attempt authenticated synchronization
      const currentUser = auth.currentUser;
      if (!currentUser) {
        this.isSyncing = false;
        this.notifyListeners();
        return { synced: 0, remaining: items.length };
      }

      // Obtain fresh Firebase ID token
      const idToken = await currentUser.getIdToken();
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      };

      console.log(`[SyncEngine] Processing ${items.length} pending offline actions...`);

      for (const item of items) {
        if (!navigator.onLine) break;

        try {
          let res: Response | null = null;

          if (item.type === 'create_note') {
            res = await fetch('/api/notes', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'update_note') {
            const noteId = item.payload.id || item.payload.noteId;
            res = await fetch(`/api/notes/${noteId}`, {
              method: 'PUT',
              headers: authHeaders,
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'delete_note') {
            const noteId = item.payload.id || item.payload.noteId;
            res = await fetch(`/api/notes/${noteId}`, {
              method: 'DELETE',
              headers: authHeaders,
            });
          } else if (item.type === 'reading_position') {
            const lessonId = item.payload.lessonId;
            res = await fetch(`/api/lessons/${lessonId}/reading-position`, {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                scrollY: item.payload.scrollY,
                sectionId: item.payload.sectionId,
                dayNumber: item.payload.dayNumber,
              }),
            });
          } else if (item.type === 'progress_update') {
            const lessonId = item.payload.lessonId;
            res = await fetch(`/api/lessons/${lessonId}/progress`, {
              method: 'PUT',
              headers: authHeaders,
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'study_log') {
            try {
              if (currentUser && item.payload.seconds) {
                await logStudySessionInFirestore({
                  seconds: item.payload.seconds,
                  lessonId: item.payload.lessonId,
                  lessonTitle: item.payload.lessonTitle,
                });
              }
            } catch (fsErr) {
              console.warn('[SyncEngine] Firestore study session sync note:', fsErr);
            }
            res = await fetch('/api/study-time/log', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'update_profile') {
            res = await fetch('/api/user/profile', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'course_create') {
            res = await fetch('/api/courses', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === 'lesson_create') {
            const courseId = item.payload.courseId;
            res = await fetch(`/api/courses/${courseId}/lessons`, {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(item.payload),
            });
          }

          if (res && (res.ok || res.status === 404 || res.status === 400)) {
            // Remove from queue upon success or unrecoverable client errors
            await persistenceEngine.removePendingSyncItem(item.id);
            synced++;
          } else {
            // Server error (5xx or temporary failure), increment attempt count
            item.attempts = (item.attempts || 0) + 1;
            item.lastAttemptAt = Date.now();
            await persistenceEngine.updatePendingSyncItem(item);
          }
        } catch (fetchErr: any) {
          console.warn(`[SyncEngine] Network pause while syncing item ${item.id}:`, fetchErr?.message);
          this.lastError = fetchErr?.message || 'Network error';
          break; // Stop loop and retry next time online event fires
        }
      }

      this.lastSyncAt = Date.now();
    } catch (err: any) {
      console.error('[SyncEngine] Error draining sync queue:', err);
      this.lastError = err?.message || 'Sync failed';
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }

    const remaining = await this.getPendingCount();
    if (synced > 0) {
      console.log(`[SyncEngine] Successfully synced ${synced} changes to cloud. ${remaining} remaining.`);
    }
    return { synced, remaining };
  }

  /**
   * Pre-caches all course assets (lessons, diagrams, images, and API endpoints)
   * into Service Worker cache and IndexedDB for complete offline availability.
   */
  public async cacheCourseAssetsForOffline(course: Course, lessons: Lesson[]): Promise<boolean> {
    try {
      // 1. Ensure course & lessons are saved to local IndexedDB
      await persistenceEngine.saveCourse(course);
      if (lessons.length > 0) {
        await persistenceEngine.saveLessons(lessons);
      }

      // 2. Collect image and diagram URLs to precache
      const assetUrls: string[] = [];

      // API course and lesson JSON URLs
      assetUrls.push(`/api/courses/${course.id}`);

      lessons.forEach((l) => {
        assetUrls.push(`/api/lessons/${l.id}`);

        if (Array.isArray(l.structuredContent?.images)) {
          l.structuredContent.images.forEach((img) => {
            if (img.url && !assetUrls.includes(img.url)) {
              assetUrls.push(img.url);
            }
          });
        }
      });

      // 3. Command Service Worker to cache these assets
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_COURSE_ASSETS',
          courseId: course.id,
          urls: assetUrls,
        });
      } else {
        // Fallback: Cache directly via Window caches API
        if ('caches' in window) {
          const cache = await caches.open('mindly-course-assets-v1');
          await Promise.allSettled(
            assetUrls.map((url) =>
              fetch(url, { mode: 'cors' })
                .then((res) => {
                  if (res.ok) cache.put(url, res);
                })
                .catch(() => {})
            )
          );
        }
      }

      console.log(`[SyncEngine] Precached ${assetUrls.length} assets for course "${course.title}".`);
      return true;
    } catch (err) {
      console.warn('[SyncEngine] Failed to cache course assets:', err);
      return false;
    }
  }
}

export const syncEngine = new SyncEngine();
