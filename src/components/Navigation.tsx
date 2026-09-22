import React from 'react';
import { Home, BookOpen, FileText, Bookmark, Search, User as UserIcon, PlusCircle, Sparkles, Brain } from 'lucide-react';
import { User } from '../types';

export type NavTab = 'home' | 'courses' | 'notes' | 'terms' | 'search' | 'profile';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAddMaterial: () => void;
  currentUser: User | null;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddMaterial,
  currentUser,
}) => {
  const navItems = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'courses' as NavTab, label: 'Courses', icon: BookOpen },
    { id: 'notes' as NavTab, label: 'Notes', icon: FileText },
    { id: 'terms' as NavTab, label: 'Key Terms', icon: Bookmark },
    { id: 'search' as NavTab, label: 'Search', icon: Search },
    { id: 'profile' as NavTab, label: 'Profile', icon: UserIcon },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#22242a] bg-[#0e0f12] h-screen sticky top-0 select-none z-30">
        {/* Brand Header */}
        <div className="p-5 border-b border-[#1f2026]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold tracking-tight text-white text-base">Mindly</span>
                <span className="ml-2 text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">v1.0</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2 font-normal leading-relaxed">
            Capture → Understand → Structure → Learn
          </p>
        </div>

        {/* Primary Action Button: Knowledge Dump */}
        <div className="p-3.5">
          <button
            id="desktop-add-material-btn"
            onClick={onOpenAddMaterial}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-sm shadow-indigo-950/40 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Material</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800/90 text-white font-medium border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Mini Profile Footer */}
        <div className="p-3.5 border-t border-[#1f2026]">
          <button
            onClick={() => onSelectTab('profile')}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/60 transition-colors text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center text-xs font-semibold text-indigo-300">
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'ME'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-200 truncate">{currentUser?.name || 'My Mindly'}</p>
              <p className="text-[11px] text-zinc-400 truncate">{currentUser?.email || 'Learner'}</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0f1013]/95 backdrop-blur-md border-t border-[#23252c] z-40 px-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors cursor-pointer ${
                isActive ? 'text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
            </button>
          );
        })}
        {/* Floating Quick Dump for Mobile */}
        <button
          onClick={onOpenAddMaterial}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white shadow-md cursor-pointer hover:bg-indigo-500"
          title="Add Learning Material"
        >
          <PlusCircle className="w-5 h-5" />
        </button>
      </div>
    </>
  );
};
