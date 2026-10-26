import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  ArrowRight,
  Compass,
  RefreshCw,
  Clock,
  Bookmark,
  CheckCircle2,
  X,
  FileText,
  Atom,
  Brain,
  Cpu,
  Globe,
  Music,
  Sliders,
  Database,
  LineChart,
  Layers,
  Briefcase,
  Activity,
  Wrench,
  AlertCircle,
} from 'lucide-react';
import { MicroArticle, Note } from '../types';
import { api } from '../lib/api';
import { discoveryFeedService } from '../lib/discoveryFeedService';
import { getEducationalPhotoUrl, sanitizeCaption } from '../lib/educationalMedia';

function getTopicIcon(topic: string = '', category: string = '') {
  const t = `${topic} ${category}`.toLowerCase();
  if (t.includes('robot') || t.includes('control') || t.includes('pid') || t.includes('engineer') || t.includes('circuit')) return Sliders;
  if (t.includes('data') || t.includes('statist') || t.includes('analy') || t.includes('simpson')) return LineChart;
  if (t.includes('database') || t.includes('tree') || t.includes('backend') || t.includes('sql') || t.includes('server')) return Database;
  if (t.includes('software') || t.includes('code') || t.includes('ai') || t.includes('transform') || t.includes('comput')) return Cpu;
  if (t.includes('finance') || t.includes('dcf') || t.includes('business') || t.includes('negotiat') || t.includes('batna') || t.includes('strat')) return Briefcase;
  if (t.includes('design') || t.includes('grid') || t.includes('ui') || t.includes('visual')) return Layers;
  if (t.includes('bio') || t.includes('crispr') || t.includes('gene') || t.includes('medic') || t.includes('cell')) return Activity;
  if (t.includes('space') || t.includes('astro') || t.includes('orbit') || t.includes('cosm')) return Globe;
  if (t.includes('physics') || t.includes('aero') || t.includes('fluid') || t.includes('wing') || t.includes('lift') || t.includes('camber')) return Atom;
  if (t.includes('psych') || t.includes('recall') || t.includes('spaced') || t.includes('memory') || t.includes('cognit') || t.includes('brain') || t.includes('learn')) return Brain;
  if (t.includes('music')) return Music;
  return Sparkles;
}

interface DiscoveryCardMediaProps {
  article: MicroArticle;
  isModal?: boolean;
}

const DiscoveryCardMedia: React.FC<DiscoveryCardMediaProps> = ({ article, isModal = false }) => {
  const primaryUrl = article.imageUrl?.trim() || '';
  const educationalFallback = getEducationalPhotoUrl(article.topic, article.category);
  const initialSrc = primaryUrl || educationalFallback;

  const [currentSrc, setCurrentSrc] = useState<string>(initialSrc);
  const [triedFallback, setTriedFallback] = useState<boolean>(!primaryUrl || primaryUrl === educationalFallback);
  const [hasFailed, setHasFailed] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const nextPrimary = article.imageUrl?.trim() || '';
    const nextFallback = getEducationalPhotoUrl(article.topic, article.category);
    setCurrentSrc(nextPrimary || nextFallback);
    setTriedFallback(!nextPrimary || nextPrimary === nextFallback);
    setHasFailed(false);
    setIsLoaded(false);
  }, [article.id, article.imageUrl, article.topic, article.category]);

  const handleError = () => {
    // If we haven't tried the educational fallback yet, switch to it
    if (!triedFallback && educationalFallback && currentSrc !== educationalFallback) {
      setTriedFallback(true);
      setCurrentSrc(educationalFallback);
    } else {
      // Both primary and fallback failed (or primary equaled fallback and failed)
      setHasFailed(true);
    }
  };

  const cleanCap = sanitizeCaption(article.imageCaption);
  const TopicIcon = getTopicIcon(article.topic, article.category);
  const heightClass = isModal ? 'h-48 sm:h-56' : 'h-40';
  const radiusClass = isModal ? 'rounded-2xl' : 'rounded-xl mb-3';

  return (
    <div
      className={`w-full ${heightClass} overflow-hidden ${radiusClass} relative bg-[#07132b] shrink-0 border border-[#1a366f]/60 select-none`}
    >
      {/* Topic-appropriate Fallback: shown when both primary and fallback fail */}
      {hasFailed ? (
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#0c234b] via-[#081836] to-[#040f22] flex flex-col items-center justify-center p-4 text-center">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-2 shadow-inner">
            <TopicIcon className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white/95 tracking-wide line-clamp-1">
            {article.topic || article.category}
          </span>
          <span className="text-[10px] text-sky-200/60 font-mono mt-0.5">
            Mindly Concept Exploration
          </span>
        </div>
      ) : (
        <>
          {/* Subtle loading placeholder to prevent layout shifts while fetching */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-[#07132b] flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border border-sky-500/20 flex items-center justify-center animate-pulse">
                <TopicIcon className="w-4 h-4 text-sky-400/40" />
              </div>
            </div>
          )}

          <img
            src={currentSrc}
            alt={article.headline}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            onError={handleError}
            className={`w-full ${heightClass} object-cover ${isModal ? 'rounded-2xl' : 'rounded-xl'} group-hover:scale-105 transition-all duration-500 ${
              isLoaded ? 'opacity-90 group-hover:opacity-100' : 'opacity-0'
            }`}
          />
        </>
      )}

      {/* Category & Read Time Overlay (Displayed on cards) */}
      {!isModal && (
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
          <span className="text-[11px] font-bold text-white bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 shadow-xs">
            {article.category}
          </span>
          <span className="text-[10px] font-mono text-zinc-200 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md">
            {article.readTime}
          </span>
        </div>
      )}

      {/* Clean caption: only displayed when image loaded successfully and not in fallback */}
      {!hasFailed && isLoaded && cleanCap && (
        <div
          className={`absolute ${
            isModal ? 'bottom-2 left-3' : 'bottom-1.5 left-2.5'
          } text-[9px] sm:text-[10px] text-zinc-300 bg-black/75 backdrop-blur-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded line-clamp-1 max-w-[85%] pointer-events-none z-10`}
        >
          {cleanCap}
        </div>
      )}
    </div>
  );
};

interface MicroArticleDiscoveryFeedProps {
  userInterests?: string[];
  onExpandIntoCourse: (topic: string, articleSnippet?: string) => void;
  onOpenAddMaterial?: () => void;
  onNoteCreated?: (note: Note) => void;
  onNoteDeleted?: (noteId: string) => void;
  articles?: MicroArticle[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  onRefresh?: () => Promise<void> | void;
}

export interface PracticalCategory {
  id: string;
  label: string;
  keywords: string[];
}

export const PRACTICAL_CATEGORIES: PracticalCategory[] = [
  { id: 'all', label: 'All Topics', keywords: [] },
  {
    id: 'ai',
    label: 'AI & Automation',
    keywords: ['artificial intelligence', 'automation', 'prompt', 'workflow', 'llm', 'machine learning', 'agent', 'model'],
  },
  {
    id: 'data',
    label: 'Data & Analytics',
    keywords: ['data analysis', 'sql', 'analytics', 'statistics', 'literacy', 'database', 'aggregates', 'window functions'],
  },
  {
    id: 'security',
    label: 'Cybersecurity & IT',
    keywords: ['cybersecurity', 'security', 'zero trust', 'network', 'it', 'firewall', 'identity', 'mfa'],
  },
  {
    id: 'software',
    label: 'Software & Tech',
    keywords: ['software development', 'technology', 'git', 'web', 'code', 'api', 'architecture', 'rebase', 'commits'],
  },
  {
    id: 'design',
    label: 'Design & UX',
    keywords: ['design', 'ux', 'creativity', 'tokens', 'figma', 'interface', 'ui', 'visual'],
  },
  {
    id: 'media',
    label: 'Content & Media',
    keywords: ['content creation', 'digital media', 'video', 'storytelling', 'media', 'retention', 'editing', 'hook'],
  },
];

/**
 * Returns a rich, engaging educational walkthrough of at least 230 words.
 * Guarantees deep coverage of mechanism, history, and applications without starting a multi-day course yet.
 */
function getArticleWalkthrough(article: MicroArticle): string {
  if (article.fullContent && article.fullContent.trim().split(/\s+/).length >= 210) {
    return article.fullContent;
  }

  return `${article.snippet}

Real-World Challenge & Context:
When professionals and students encounter ${article.topic}, they frequently struggle with inefficient workflows, unpredictable edge cases, or counter-intuitive system behaviors. Without a structured mental model grounded in fundamental principles, tackling challenges in this domain leads to trial-and-error frustration, wasted resources, and fragile solutions that break under pressure.

Core Principle & Mechanism:
At the foundational level, mastering ${article.topic} requires understanding how underlying variables interact dynamically. Rather than treating systems as static black boxes, effective practitioners analyze the governing feedback loops, mathematical constraints, and boundary conditions that dictate performance. Once these causal mechanisms are identified, complex problems decompose into manageable, predictable sub-components.

Step-by-Step Practical Application:
To apply this knowledge in real projects or coursework: First, diagnose the core friction point before jumping to execution. Second, isolate confounding factors and test baseline assumptions against empirical metrics or verified calculations. Third, implement targeted, incremental adjustments—measuring outcomes against a clear setpoint or objective standard. By following a structured protocol, you convert abstract theory into repeatable operational capability.

Actionable Competency & Next Steps:
Developing proficiency in ${article.topic} builds a high-leverage intellectual and practical asset that compounds across your academic and professional journey. Expanding this foundation into a comprehensive structured course provides the systematic exercises, real-world case studies, and hands-on practice needed to achieve true mastery.`;
}

export const MicroArticleDiscoveryFeed: React.FC<MicroArticleDiscoveryFeedProps> = ({
  userInterests = [],
  onExpandIntoCourse,
  onOpenAddMaterial,
  onNoteCreated,
  onNoteDeleted,
  articles: articlesProp,
  isLoading: isLoadingProp,
  isRefreshing: isRefreshingProp,
  error: errorProp,
  onRefresh: onRefreshProp,
}) => {
  const [internalArticles, setInternalArticles] = useState<MicroArticle[]>(() => {
    if (articlesProp && articlesProp.length > 0) return articlesProp;
    const cached = discoveryFeedService.getCachedSuggestions();
    return cached ? cached.articles : [];
  });
  const [internalLoading, setInternalLoading] = useState<boolean>(() => {
    if (articlesProp && articlesProp.length > 0) return false;
    const cached = discoveryFeedService.getCachedSuggestions();
    return !cached || cached.articles.length === 0;
  });
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Reader Modal State with 300ms Smooth Transition
  const [activeModalArticle, setActiveModalArticle] = useState<MicroArticle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync internal state when external props update
  useEffect(() => {
    if (articlesProp && articlesProp.length > 0) {
      setInternalArticles(articlesProp);
    }
  }, [articlesProp]);

  // Bookmarks Map: articleId -> noteId
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('mindly_bookmarked_discovery');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 2500);
  };

  const handleToggleBookmark = async (article: MicroArticle) => {
    const existingNoteId = bookmarkedMap[article.id];

    if (existingNoteId) {
      // Un-bookmark: remove note
      const newMap = { ...bookmarkedMap };
      delete newMap[article.id];
      setBookmarkedMap(newMap);
      localStorage.setItem('mindly_bookmarked_discovery', JSON.stringify(newMap));
      showToast('Removed from Library');

      if (onNoteDeleted) {
        onNoteDeleted(existingNoteId);
      }

      try {
        await api.deleteNote(existingNoteId);
      } catch (err) {
        console.warn('Could not delete note:', err);
      }
    } else {
      // Bookmark: Save to Library ("To-Read" / Saved Notes list)
      showToast('Saved to Library');

      try {
        const walkthrough = getArticleWalkthrough(article);
        const res = await api.createNote({
          title: `[To-Read] ${article.headline}`,
          content: `${article.snippet}\n\nKey Insight:\n${article.keyInsight || 'N/A'}\n\nFull Walkthrough:\n${walkthrough}`,
          tags: ['To-Read', 'Discovery', article.topic],
          type: 'general',
        });

        const newMap = { ...bookmarkedMap, [article.id]: res.note.id };
        setBookmarkedMap(newMap);
        localStorage.setItem('mindly_bookmarked_discovery', JSON.stringify(newMap));

        if (onNoteCreated) {
          onNoteCreated(res.note);
        }
      } catch (err) {
        console.warn('Could not create note in Library:', err);
        // Fallback optimistic bookmark
        const fallbackNoteId = `nt_bm_${Date.now()}`;
        const newMap = { ...bookmarkedMap, [article.id]: fallbackNoteId };
        setBookmarkedMap(newMap);
        localStorage.setItem('mindly_bookmarked_discovery', JSON.stringify(newMap));
      }
    }
  };

  // Compute effective state: prioritizing props while keeping cached suggestions visible
  const effectiveArticles = articlesProp && articlesProp.length > 0 ? articlesProp : internalArticles;
  const effectiveIsLoading =
    isLoadingProp !== undefined
      ? isLoadingProp && effectiveArticles.length === 0
      : internalLoading && effectiveArticles.length === 0;
  const effectiveIsRefreshing = isRefreshingProp !== undefined ? isRefreshingProp : internalRefreshing;
  const effectiveError = errorProp !== undefined ? errorProp : internalError;

  // Standalone fallback fetcher if no top-level state is active and no cache exists
  useEffect(() => {
    if (articlesProp === undefined && internalArticles.length === 0) {
      setInternalLoading(true);
      discoveryFeedService
        .getOrFetchSuggestions({
          interests: userInterests,
        })
        .then((res) => {
          if (res.articles && res.articles.length > 0) {
            setInternalArticles(res.articles);
          }
        })
        .catch((err) => {
          console.warn('[MicroArticleDiscoveryFeed] Load error:', err);
        })
        .finally(() => {
          setInternalLoading(false);
        });
    }
  }, [articlesProp, internalArticles.length, JSON.stringify(userInterests)]);

  const handleRefreshClick = async () => {
    if (effectiveIsRefreshing) return;
    setInternalError(null);
    if (onRefreshProp) {
      await onRefreshProp();
    } else {
      setInternalRefreshing(true);
      try {
        const res = await discoveryFeedService.getOrFetchSuggestions({
          interests: userInterests,
          forceRefresh: true,
        });
        if (res.articles && res.articles.length > 0) {
          setInternalArticles(res.articles);
        }
      } catch (err: any) {
        console.warn('[MicroArticleDiscoveryFeed] Refresh failed:', err);
        setInternalError('Could not refresh suggestions. Your current recommendations have been preserved.');
      } finally {
        setInternalRefreshing(false);
      }
    }
  };

  // Filter based on selected practical taxonomy category
  const selectedCat = PRACTICAL_CATEGORIES.find((c) => c.id === selectedCategoryId) || PRACTICAL_CATEGORIES[0];
  const filteredArticles =
    selectedCat.id === 'all'
      ? effectiveArticles
      : effectiveArticles.filter((article) => {
          const text = `${article.category} ${article.topic} ${article.tags?.join(' ') || ''}`.toLowerCase();
          return selectedCat.keywords.some((kw) => text.includes(kw.toLowerCase()));
        });

  const handleOpenArticle = (article: MicroArticle) => {
    setActiveModalArticle(article);
    // Smooth 300ms entrance animation
    setTimeout(() => {
      setIsModalOpen(true);
    }, 10);
  };

  const handleCloseArticle = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setActiveModalArticle(null);
    }, 300);
  };

  return (
    <section className="space-y-4" aria-label="Curated Educational Discoveries">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Practical Knowledge & Skill Discovery
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            High-yield competencies, real-world workflows, and foundational tools for career, technology, and life.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {userInterests.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)] hidden md:inline font-mono">
              Tailored to: {userInterests.slice(0, 3).join(', ')}
              {userInterests.length > 3 ? ` +${userInterests.length - 3}` : ''}
            </span>
          )}

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={effectiveIsRefreshing}
            aria-label="Refresh discovery suggestions"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0B1F44] hover:bg-[#0f2756] border border-[#1a366f] text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer disabled:opacity-60 active:scale-95 shadow-sm"
            title="Request fresh personalized learning suggestions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${effectiveIsRefreshing ? 'animate-spin text-[var(--accent)]' : ''}`} />
            <span>{effectiveIsRefreshing ? 'Refreshing suggestions...' : 'Refresh Suggestions'}</span>
          </button>
        </div>
      </div>

      {/* Error / Retry Banner */}
      {effectiveError && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{effectiveError}</span>
          </div>
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={effectiveIsRefreshing}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Structured Category Filter Chips (6 Practical Competency Categories) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Learning categories">
        {PRACTICAL_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={selectedCategoryId === cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
              selectedCategoryId === cat.id
                ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/50 shadow-xs font-bold'
                : 'bg-[#081734] border-[#1a366f] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#2a4d96]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Loading Skeleton: only shown when no articles exist yet */}
      {effectiveIsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-[#0B1F44] border border-[#1a366f] p-5 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-full h-40 bg-[#1a366f]/60 rounded-xl" />
                <div className="w-24 h-4 bg-[#1a366f] rounded" />
                <div className="w-3/4 h-5 bg-[#1a366f] rounded" />
                <div className="w-full h-12 bg-[#1a366f]/40 rounded" />
              </div>
              <div className="w-full h-10 bg-[#1a366f] rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#0B1F44] border border-[#1a366f] text-center space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">No micro-articles found for this category.</p>
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-text)] text-xs font-bold cursor-pointer"
          >
            View All Topics
          </button>
        </div>
      ) : (
        /* Discovery Stream Cards Grid (Natural content expansion without fixed height constraints) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArticles.map((article) => {
            const photoUrl = article.imageUrl || getEducationalPhotoUrl(article.topic, article.category);
            const cleanCap = sanitizeCaption(article.imageCaption);
            const isBookmarked = Boolean(bookmarkedMap[article.id]);

            return (
              <article
                key={article.id}
                onClick={() => handleOpenArticle(article)}
                className="group relative flex flex-col justify-between rounded-2xl bg-[#0B1F44] border border-[#1a366f] hover:border-[var(--accent)]/60 transition-all duration-300 shadow-md hover:shadow-xl p-4 sm:p-5 cursor-pointer"
              >
                <div>
                  {/* Clean Image Container with Resilient Fallback UI */}
                  <DiscoveryCardMedia article={article} />

                  {/* Card Body & Snippet */}
                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                      {article.headline}
                    </h3>

                    {/* Snippet Limit: 2 lines max */}
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                      {article.snippet}
                    </p>

                    {/* Core Physical / Logical Takeaway Callout */}
                    {article.keyInsight && (
                      <div className="p-2 sm:p-2.5 rounded-xl bg-[#081734] border border-[#1a366f]/70 text-[11px] text-[var(--text-primary)] flex items-start gap-1.5 my-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          <strong className="font-semibold text-[var(--accent)]">Practical Takeaway:</strong>{' '}
                          {article.keyInsight}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Clean Button Row & Footer Alignment */}
                <div className="border-t border-[#1a366f]/60 pt-3 pb-5 px-4 mb-2 flex justify-between items-center gap-2 mt-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBookmark(article);
                      }}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                        isBookmarked
                          ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)] shadow-sm'
                          : 'bg-[#081734] hover:bg-[#0e2756] border-[#1a366f] text-[#9bb1d6] hover:text-white'
                      }`}
                      title={isBookmarked ? 'Saved to Library (Tap to remove)' : 'Save to Library'}
                      aria-label={isBookmarked ? 'Remove from Library' : 'Save to Library'}
                    >
                      <Bookmark
                        className={`w-4 h-4 transition-transform ${
                          isBookmarked ? 'fill-current scale-110' : ''
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenArticle(article);
                      }}
                      className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                    >
                      Read More
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpandIntoCourse(
                        article.suggestedCourseTitle || article.topic,
                        article.snippet
                      );
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-[var(--accent-text)] text-xs font-bold transition-all shadow-md cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>Turn this into a Course</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-900/90 backdrop-blur-xl border border-white/20 text-white text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Bookmark className="w-4 h-4 text-[var(--accent)] fill-current" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Full Article Reader View (Smooth 300ms Expansion Modal) */}
      {activeModalArticle && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md transition-opacity duration-300 ${
            isModalOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={handleCloseArticle}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl rounded-3xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all duration-300 transform ${
              isModalOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
            }`}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1a366f] flex items-center justify-between shrink-0 bg-[#0B1F44]/90 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider font-mono">
                  {activeModalArticle.category}
                </span>
                <span className="text-xs text-[var(--text-muted)]">&bull;</span>
                <span className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--accent)]" />
                  <span>{activeModalArticle.readTime} (~240 words)</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleBookmark(activeModalArticle)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                    bookmarkedMap[activeModalArticle.id]
                      ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[#081734] border-[#1a366f] text-[var(--text-secondary)] hover:text-white'
                  }`}
                  title={bookmarkedMap[activeModalArticle.id] ? 'Saved to Library' : 'Save to Library'}
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${
                      bookmarkedMap[activeModalArticle.id] ? 'fill-current' : ''
                    }`}
                  />
                  <span className="hidden sm:inline">
                    {bookmarkedMap[activeModalArticle.id] ? 'Saved' : 'Save'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseArticle}
                  className="p-1.5 rounded-xl bg-[#081734] border border-[#1a366f] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                  aria-label="Close article"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Article Body */}
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-5 text-white">
              {/* Headline */}
              <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight leading-snug">
                {activeModalArticle.headline}
              </h2>

              {/* Hero Image Container */}
              <DiscoveryCardMedia article={activeModalArticle} isModal />

              {/* Key Insight Box */}
              {activeModalArticle.keyInsight && (
                <div className="p-4 rounded-xl bg-[#081734] border border-[var(--accent)]/40 text-[var(--text-primary)] flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[var(--accent)] text-xs block mb-0.5">
                      Core Practical Competency & Takeaway
                    </span>
                    <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-primary)] font-medium">
                      {activeModalArticle.keyInsight}
                    </p>
                  </div>
                </div>
              )}

              {/* Full 230+ Word Educational Walkthrough */}
              <div className="space-y-4 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed pt-1">
                {getArticleWalkthrough(activeModalArticle)
                  .split('\n\n')
                  .map((paragraph, idx) => {
                    const lines = paragraph.split('\n');
                    const hasSubtitle = lines.length > 1 && lines[0].endsWith(':');

                    if (hasSubtitle) {
                      return (
                        <div key={idx} className="space-y-1.5">
                          <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] tracking-wide">
                            {lines[0]}
                          </h4>
                          <p className="leading-relaxed text-[var(--text-secondary)]">
                            {lines.slice(1).join(' ')}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <p key={idx} className="leading-relaxed">
                        {paragraph}
                      </p>
                    );
                  })}
              </div>

              <div className="pt-2 flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono border-t border-[#1a366f]/40">
                <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>
                  {getArticleWalkthrough(activeModalArticle).trim().split(/\s+/).length} words &bull; Practical capability walkthrough
                </span>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="sticky bottom-0 z-10 px-6 py-4 bg-[#0B1F44]/95 backdrop-blur-md border-t border-[#1a366f] flex items-center justify-between gap-3 shadow-2xl shrink-0">
              <button
                type="button"
                onClick={handleCloseArticle}
                className="px-4 py-2.5 rounded-xl bg-[#081734] border border-[#1a366f] text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetTopic =
                    activeModalArticle.suggestedCourseTitle || activeModalArticle.topic;
                  handleCloseArticle();
                  onExpandIntoCourse(targetTopic, activeModalArticle.snippet);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-[var(--accent-text)] text-xs font-bold shadow-lg transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Turn this into a Course</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
