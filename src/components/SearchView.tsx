import React, { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, Bookmark, Sparkles, ArrowRight, Layers } from 'lucide-react';
import { SearchResultItem } from '../types';
import { api } from '../lib/api';

interface SearchViewProps {
  onSelectResult: (result: SearchResultItem) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onSelectResult }) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Perform search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.search(query);
        setResults(res.results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredResults = results.filter((r) => {
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Global Search</h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
          Find anything across your courses, lessons, notes, glossary terms, and raw imported transcripts.
        </p>
      </div>

      {/* Main Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-3.5" />
        <input
          type="text"
          autoFocus
          placeholder="Search by topic, definition, keyword, or note text..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 text-sm rounded-2xl bg-[#111216] border border-[#262833] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 shadow-lg shadow-black/40"
        />
        {loading && (
          <span className="absolute right-4 top-3.5 text-xs text-indigo-400 animate-pulse">
            Searching...
          </span>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs">
        {['all', 'course', 'lesson', 'note', 'term', 'raw_material'].map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === f
                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                : 'bg-[#14151a] text-zinc-400 hover:text-zinc-200 border border-[#22242c]'
            }`}
          >
            {f === 'raw_material' ? 'Raw Materials' : f}
          </button>
        ))}
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {query && filteredResults.length === 0 && !loading && (
          <div className="p-12 text-center rounded-2xl bg-[#121316] border border-[#23252e] text-xs text-zinc-500">
            No matching results found for "{query}".
          </div>
        )}

        {!query && (
          <div className="p-8 text-center text-xs text-zinc-500">
            Type a query above to search through your entire knowledge base.
          </div>
        )}

        {filteredResults.map((result) => {
          const Icon = getIconForType(result.type);

          return (
            <div
              key={`${result.type}-${result.id}`}
              onClick={() => onSelectResult(result)}
              className="group p-4 rounded-xl bg-[#131418] hover:bg-[#17181f] border border-[#23252e] hover:border-indigo-500/50 transition-all cursor-pointer flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 uppercase">
                      {result.type}
                    </span>
                    {result.courseTitle && (
                      <span className="text-xs text-zinc-500 truncate">
                        {result.courseTitle}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                    {result.title}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {result.snippet}
                  </p>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
