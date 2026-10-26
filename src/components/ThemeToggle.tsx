import React from 'react';
import { Sun, Moon, Sparkles, Eye } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { ThemeMode } from '../lib/theme';

interface ThemeToggleProps {
  variant?: 'header' | 'pill' | 'sidebar' | 'inline';
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'header',
  className = '',
  showLabel = false,
}) => {
  const { theme, isLight, toggleTheme, setTheme } = useTheme();

  // Header Icon Variant
  if (variant === 'header') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-label={
          isLight
            ? 'Current theme: High-Contrast Light Mode. Click to switch to Deep Space'
            : 'Current theme: Deep Space. Click to switch to High-Contrast Light Mode'
        }
        title={
          isLight
            ? 'Switch to Deep Space theme'
            : 'Switch to High-Contrast Light Mode (Accessibility)'
        }
        onClick={toggleTheme}
        className={`group relative flex items-center gap-1.5 p-2 rounded-xl transition-all duration-200 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          isLight
            ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 shadow-sm'
            : 'bg-[#0B1F44] hover:bg-[#0f2756] border-[#1a366f] text-[#9bb1d6] hover:text-white'
        } ${className}`}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          {isLight ? (
            <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300 rotate-0 scale-100 group-hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-[#00B4FF] transition-transform duration-300 -rotate-12 scale-100 group-hover:rotate-0" />
          )}
        </div>

        {showLabel && (
          <span className="text-xs font-semibold hidden lg:inline">
            {isLight ? 'Light Mode' : 'Deep Space'}
          </span>
        )}

        {/* Accessibility tag badge */}
        <span
          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded tracking-wide border hidden sm:inline-block ${
            isLight
              ? 'bg-sky-50 text-sky-800 border-sky-300 font-bold'
              : 'bg-[#00B4FF]/10 text-[#00B4FF] border-[#00B4FF]/30'
          }`}
        >
          {isLight ? 'High Contrast' : 'Cosmic'}
        </span>
      </button>
    );
  }

  // Sidebar compact item
  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-label="Toggle High-Contrast Theme"
        onClick={toggleTheme}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer border ${
          isLight
            ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            : 'bg-[#081734] hover:bg-[#0f2756] border-[#1a366f] text-[#9bb1d6] hover:text-white'
        } ${className}`}
      >
        <div className="flex items-center gap-2">
          {isLight ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-[#00B4FF]" />
          )}
          <span>{isLight ? 'High-Contrast Light' : 'Deep Space Theme'}</span>
        </div>

        <div
          className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
            isLight ? 'bg-sky-600 justify-end' : 'bg-[#1a366f] justify-start'
          }`}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
        </div>
      </button>
    );
  }

  // Pill / Segmented Selector for Profile / Settings View
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Theme & Contrast Engine
          </span>
        </div>
        <span className="text-[11px] text-[var(--text-muted)] font-mono">
          WCAG AAA Compliant
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Deep Space Option */}
        <button
          type="button"
          onClick={() => setTheme('deep-space')}
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
            !isLight
              ? 'bg-[#00B4FF]/10 border-[#00B4FF] text-white shadow-sm ring-1 ring-[#00B4FF]'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className="p-2 rounded-lg bg-[#07132b] border border-[#1a366f] text-[#00B4FF] shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                🌌 Deep Space
              </span>
              {!isLight && (
                <span className="text-[10px] font-bold text-[#00B4FF] bg-[#00B4FF]/15 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Default dark cosmic palette with deep navy backgrounds, glowing accents, and low eye fatigue.
            </p>
          </div>
        </button>

        {/* High-Contrast Light Mode Option */}
        <button
          type="button"
          onClick={() => setTheme('light-mode')}
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
            isLight
              ? 'bg-sky-50 border-sky-500 text-slate-900 shadow-sm ring-1 ring-sky-500'
              : 'bg-[#081734] border-[#1a366f] hover:border-[#627ca8] text-[#9bb1d6]'
          }`}
        >
          <div className="p-2 rounded-lg bg-white border border-slate-300 text-amber-500 shrink-0 mt-0.5 shadow-xs">
            <Sun className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                ☀️ High-Contrast Light
              </span>
              {isLight && (
                <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Paper-white backgrounds with crisp slate delineation and &gt;12:1 contrast ratio for bright environments and accessibility.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
