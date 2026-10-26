import React, { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  FileText,
  Bookmark,
  Sparkles,
  ArrowRight,
  Layers,
  Compass,
  Plus,
  Brain,
} from 'lucide-react';
import { SearchResultItem, User, Note, MicroArticle } from '../types';
import { api } from '../lib/api';
import { MicroArticleDiscoveryFeed } from './MicroArticleDiscoveryFeed';
import { TopicDiscoveryInput } from './TopicDiscoveryInput';

interface SearchViewProps {
  onSelectResult: (result: SearchResultItem) => void;
  currentUser?: User | null;
  onOpenAuth?: () => void;
  initialTab?: 'search' | 'discover' | 'vault';
  initialQuery?: string;
  onTabChange?: (tab: 'search' | 'community') => void;
  onOpenNewCourse?: (topic?: string, articleSnippet?: string) => void;
  onOpenAddMaterial?: () => void;
  onNoteCreated?: (note: Note) => void;
  onNoteDeleted?: (noteId: string) => void;
  discoveryArticles?: MicroArticle[];
  isDiscoveryLoading?: boolean;
  isDiscoveryRefreshing?: boolean;
  discoveryError?: string | null;
  onRefreshDiscovery?: () => Promise<void> | void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onSelectResult,
  currentUser = null,
  initialQuery = '',
  onOpenNewCourse,
  onOpenAddMaterial,
  onNoteCreated,
  onNoteDeleted,
  discoveryArticles,
  isDiscoveryLoading,
  isDiscoveryRefreshing,
  discoveryError,
  onRefreshDiscovery,
}) => {
  // Discovery is the primary orientation; Vault search is available for existing personal content
  const [activeMode, setActiveMode] = useState<'discover' | 'vault'>('discover');

  // Vault Search Query & State
  const [vaultQuery, setVaultQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [vaultResults, setVaultResults] = useState<SearchResultItem[]>([]);
  const [isSearchingVault, setIsSearchingVault] = useState(false);

  // If initialQuery arrives and has text, switch to vault search or pre-fill
  useEffect(() => {
    if (initialQuery) {
      setVaultQuery(initialQuery);
      setActiveMode('vault');
    }
  }, [initialQuery]);

  // Debounced Vault Search
  useEffect(() => {
    if (!vaultQuery.trim()) {
      setVaultResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingVault(true);
      try {
        const res = await api.search(vaultQuery);
        setVaultResults(res.results || []);
      } catch (err) {
        console.error('Vault search error:', err);
      } finally {
        setIsSearchingVault(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [vaultQuery]);

  const filteredVaultResults = vaultResults.filter((r) => {
    if (activeFilter === 'all') return true;
    return r.type === activeFilter;
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case 'course':
        return BookOpen;
      case 'lesson':
        return Sparkles;
      case 'note':
        return FileText;
      case 'term':
        return Bookmark;
      default:
        return Layers;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Switcher: Discover New Subjects vs Search Vault */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#081734] border border-[#1a366f] select-none shadow-sm">
          <button
            onClick={() => setActiveMode('discover')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex-1 cursor-pointer ${
              activeMode === 'discover'
                ? 'bg-[#00B4FF] text-[#0B1F44] shadow-md font-bold'
                : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${activeMode === 'discover' ? 'text-[#0B1F44]' : 'text-[#9bb1d6]'}`} />
            <span>Discover New Subjects</span>
          </button>
          <button
            onClick={() => setActiveMode('vault')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex-1 cursor-pointer ${
              activeMode === 'vault'
                ? 'bg-[#00B4FF] text-[#0B1F44] shadow-md font-bold'
                : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
            }`}
          >
            <Search className={`w-3.5 h-3.5 ${activeMode === 'vault' ? 'text-[#0B1F44]' : 'text-[#9bb1d6]'}`} />
            <span>Search My Vault</span>
          </button>
        </div>
      </div>

      {activeMode === 'discover' ? (
        /* ========================================================= */
        /* PRIMARY DISCOVER VIEW: EXPLORING NEW TOPICS & STARTING COURSES */
        /* ========================================================= */
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          {/* Header Title */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Discover & Learn
            </h1>
            <p className="text-xs sm:text-sm text-[#9bb1d6] mt-0.5">
              Explore curated learning topics, search any subject, and start a personalized curriculum.
            </p>
          </div>

          {/* Primary Create Course / Start Learning Action Banner */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[#0c234b] via-[#0B1F44] to-[#081836] border border-[#00B4FF]/40 shadow-xl">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-2 max-w-lg">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00B4FF]/15 border border-[#00B4FF]/30 text-[#00B4FF] text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Curriculum Builder</span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Start learning something new today
                </h2>
                <p className="text-xs sm:text-sm text-[#9bb1d6] leading-relaxed">
                  Transform any subject, field, or personal interest into a structured multi-day course with bite-sized daily modules and quizzes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onOpenNewCourse?.()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs sm:text-sm font-extrabold tracking-wide transition-all shadow-lg shadow-[#00B4FF]/25 shrink-0 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Start New Course</span>
              </button>
            </div>
            
            {/* Background decorative glow */}
            <div className="absolute -top-16 -right-16 w-52 h-52 bg-[#00B4FF]/10 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* Topic Exploration & Live Suggestion Search */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0B1F44] border border-[#1a366f] space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#00B4FF]" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Explore Any Subject
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#00B4FF]">AI Topic Discovery</span>
            </div>
            <p className="text-xs text-[#9bb1d6]">
              Type any topic (e.g., "singing", "crankshaft", "game theory") to reveal live educational subject chips. Click any chip to launch a course.
            </p>
            <TopicDiscoveryInput
              placeholder='Search a topic to learn (e.g., "quantum", "music theory", "robotics")...'
              onSelectTopic={(topic) => onOpenNewCourse?.(topic)}
              onDirectGenerateCourse={(topic) => onOpenNewCourse?.(topic)}
            />
          </div>

          {/* Curated Educational Discoveries Feed */}
          <div className="pt-2">
            <MicroArticleDiscoveryFeed
              userInterests={currentUser?.interests}
              onExpandIntoCourse={(topic, snippet) => {
                onOpenNewCourse?.(topic, snippet);
              }}
              onOpenAddMaterial={onOpenAddMaterial}
              onNoteCreated={onNoteCreated}
              onNoteDeleted={onNoteDeleted}
              articles={discoveryArticles}
              isLoading={isDiscoveryLoading}
              isRefreshing={isDiscoveryRefreshing}
              error={discoveryError}
              onRefresh={onRefreshDiscovery}
            />
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* VAULT SEARCH: SEARCHING PERSONAL COURSES, NOTES & GLOSSARY */
        /* ========================================================= */
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Search My Vault
            </h1>
            <p className="text-xs sm:text-sm text-[#9bb1d6] mt-0.5">
              Find anything across your personal courses, lessons, notes, glossary terms, and raw imported transcripts.
            </p>
          </div>

          {/* Main Vault Search Input */}
          <div className="relative">
            <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-3.5" />
            <input
              type="text"
              autoFocus
              placeholder="Search by topic, definition, keyword, or note text..."
              value={vaultQuery}
              onChange={(e) => setVaultQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-sm rounded-2xl bg-[#081734] border border-[#1a366f] text-white placeholder-zinc-500 focus:outline-none focus:border-[#00B4FF] shadow-lg shadow-black/40"
            />
            {isSearchingVault && (
              <span className="absolute right-4 top-3.5 text-xs text-[#00B4FF] animate-pulse">
                Searching...
              </span>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
            {['all', 'course', 'lesson', 'note', 'term', 'raw_material'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  activeFilter === f
                    ? 'bg-[#00B4FF] text-[#0B1F44] font-bold shadow-sm'
                    : 'bg-[#081734] text-[#9bb1d6] hover:text-white border border-[#1a366f]'
                }`}
              >
                {f === 'raw_material' ? 'Raw Materials' : f}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="space-y-3">
            {vaultQuery && filteredVaultResults.length === 0 && !isSearchingVault && (
              <div className="p-12 text-center rounded-2xl bg-[#081734] border border-[#1a366f] text-xs text-[#9bb1d6]">
                No matching items found in your vault for "{vaultQuery}".
              </div>
            )}

            {!vaultQuery && (
              <div className="p-12 text-center rounded-2xl bg-[#081734] border border-[#1a366f] text-xs text-[#9bb1d6]">
                Type keywords above to search across your saved courses, notes, and glossary terms.
              </div>
            )}

            {filteredVaultResults.map((result) => {
              const Icon = getIconForType(result.type);

              return (
                <div
                  key={`${result.type}-${result.id}`}
                  onClick={() => onSelectResult(result)}
                  className="group p-4 rounded-xl bg-[#081734] hover:bg-[#0c234b] border border-[#1a366f] hover:border-[#00B4FF]/60 transition-all cursor-pointer flex items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#0B1F44] border border-[#1a366f] flex items-center justify-center text-[#00B4FF] shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#00B4FF]/10 text-[#00B4FF] uppercase font-semibold">
                          {result.type}
                        </span>
                        {result.courseTitle && (
                          <span className="text-xs text-[#9bb1d6] truncate">
                            {result.courseTitle}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-white group-hover:text-[#00B4FF] transition-colors truncate">
                        {result.title}
                      </h3>

                      <p className="text-xs text-[#9bb1d6] line-clamp-2 leading-relaxed">
                        {result.snippet}
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#9bb1d6] group-hover:text-[#00B4FF] transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
