import React, { useRef, useState, useEffect } from 'react';
import {
  House,
  Search,
  BookOpen,
  UsersRound,
  Sparkles,
} from 'lucide-react';
import { User } from '../types';
import { MindlyLogo } from './MindlyLogo';
import { PWAInstallButton } from './PWAInstallButton';

export type NavTab =
  | 'home'
  | 'library'
  | 'search'
  | 'profile'
  | 'courses'
  | 'notes'
  | 'terms'
  | 'certificates'
  | 'community';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAddMaterial: () => void;
  currentUser: User | null;
  onOpenAssistant?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddMaterial,
  currentUser,
  onOpenAssistant,
}) => {
  // Four primary navigation destinations in the reference's required order:
  // 1. Home — house icon
  // 2. Discover — magnifying-glass icon
  // 3. Library — open-book icon
  // 4. Rooms — group-of-people icon
  const primaryNavItems = [
    {
      id: 'home' as const,
      label: 'Home',
      icon: House,
      match: ['home'],
    },
    {
      id: 'search' as const,
      label: 'Discover',
      icon: Search,
      match: ['search'],
    },
    {
      id: 'library' as const,
      label: 'Library',
      icon: BookOpen,
      match: ['library', 'courses', 'notes', 'terms', 'certificates'],
    },
    {
      id: 'community' as const,
      label: 'Rooms',
      icon: UsersRound,
      match: ['community'],
    },
  ];

  // Determine active index among the 4 destinations
  const resolvedActiveIndex = primaryNavItems.findIndex((item) =>
    item.match.includes(currentTab)
  );

  // Fallback to last known index or 0 if user is on profile/subview
  const lastActiveIndexRef = useRef<number>(0);
  if (resolvedActiveIndex >= 0) {
    lastActiveIndexRef.current = resolvedActiveIndex;
  }
  const activeIndex = resolvedActiveIndex >= 0 ? resolvedActiveIndex : lastActiveIndexRef.current;

  // Refs for capsule geometry calculations
  const pillContainerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [capsuleStyle, setCapsuleStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  // Calculate and update the moving capsule position behind the active icon
  const updateCapsulePosition = () => {
    const container = pillContainerRef.current;
    if (!container) return;

    const targetIdx = Math.max(0, Math.min(activeIndex, primaryNavItems.length - 1));
    const targetButton = buttonRefs.current[targetIdx];
    if (!targetButton) return;

    const btnRect = targetButton.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Capsule dimensions: clamped between ~58px and ~74px wide, ~54px and ~64px high
    const targetWidth = Math.min(Math.max(btnRect.width - 6, 56), 74);
    const targetHeight = Math.min(Math.max(containerRect.height - 18, 52), 64);

    const left = btnRect.left - containerRect.left + (btnRect.width - targetWidth) / 2;
    const top = (containerRect.height - targetHeight) / 2;

    setCapsuleStyle({
      left,
      top,
      width: targetWidth,
      height: targetHeight,
      opacity: 1,
    });
  };

  useEffect(() => {
    updateCapsulePosition();

    // Use multiple triggers to ensure rock-solid geometry after initial render and fonts
    const rafId = requestAnimationFrame(updateCapsulePosition);
    const timeoutId = setTimeout(updateCapsulePosition, 50);

    const container = pillContainerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateCapsulePosition();
      });
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', updateCapsulePosition);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateCapsulePosition);
    };
  }, [activeIndex]);

  return (
    <>
      {/* Desktop Sidebar: Complete 4 destinations with Brand Header & Capture Material */}
      <aside className="main-navigation hidden md:flex flex-col w-64 border-r border-[#1a366f] bg-[#0B1F44] h-screen sticky top-0 select-none z-30 shrink-0">
        {/* Brand Header with Official Mindly Logo */}
        <div className="p-4 border-b border-[#1a366f] bg-[#081734]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center shrink-0">
                <MindlyLogo size={20} color="#00B4FF" />
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-white text-base">Mindly</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#9bb1d6] mt-2 font-normal leading-relaxed">
            Where information becomes knowledge
          </p>
        </div>

        {/* Primary Action Button: Capture Material */}
        <div className="p-3">
          <button
            id="desktop-add-material-btn"
            onClick={onOpenAddMaterial}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Capture Material</span>
          </button>
        </div>

        {/* Navigation Items in Sidebar */}
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto pt-1">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match.includes(currentTab);

            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#00B4FF]/15 text-white font-bold border border-[#00B4FF]/40 shadow-sm'
                    : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#00B4FF]' : 'text-[#9bb1d6]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* PWA Install Button Module */}
        <div className="p-3 border-t border-[#1a366f]/60">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* User Mini Profile Footer */}
        <div className="p-3 border-t border-[#1a366f] bg-[#081734]">
          <button
            onClick={() => onSelectTab('profile')}
            className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#0f2756] transition-colors text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#07132b] border border-[#1a366f] flex items-center justify-center text-xs font-bold text-[#00B4FF] shrink-0 overflow-hidden">
              {currentUser?.profileImage ? (
                <img
                  src={currentUser.profileImage}
                  alt={currentUser.realName || currentUser.name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : currentUser?.realName ? (
                currentUser.realName.slice(0, 2).toUpperCase()
              ) : currentUser?.name ? (
                currentUser.name.slice(0, 2).toUpperCase()
              ) : (
                'ME'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.realName || currentUser?.name || 'Mindly Learner'}
              </p>
              <p className="text-[11px] text-[#00B4FF] truncate font-mono">
                {currentUser?.username || '@learner'}
              </p>
            </div>
          </button>
        </div>
      </aside>

      {/* Floating Bottom Navigation Bar (Signature Reference Redesign) */}
      {/*
        Composition:
        - Long, horizontally oriented, pill-shaped navigation container (#111C35, border #2C3854)
        - Moving vivid cyan-blue capsule indicator (#00B8F4) behind active icon
        - Separate, circular AI assistant button with vibrant blue gradient and 4-point sparkle icon
        - Visible 12–20 px gap between pill and AI button
        - Fixed floating wrapper respecting iOS safe-area bottom insets and screen boundaries
      */}
      <div
        className="fixed z-40 bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 md:left-[calc(50%+8rem)] md:-translate-x-1/2 w-[calc(100%-24px)] max-w-[450px] sm:max-w-[490px] md:max-w-[530px] flex items-center justify-between gap-3 sm:gap-4 select-none pointer-events-none"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Navigation Container: Deep Navy Pill */}
        <nav
          aria-label="Main Navigation"
          className="flex-1 pointer-events-auto h-[74px] sm:h-[78px] md:h-[82px] bg-[#111C35] border-[2.5px] border-[#2C3854] rounded-full shadow-[0_12px_36px_rgba(3,8,25,0.7)] flex items-center px-1.5 sm:px-2 relative overflow-hidden"
        >
          {/* Inner relative container for precise capsule positioning */}
          <div
            ref={pillContainerRef}
            className="relative w-full h-full flex items-center justify-between"
          >
            {/* The Moving Cyan-Blue Capsule Indicator (#00B8F4) */}
            <div
              className="absolute rounded-full bg-[#00B8F4] pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{
                left: `${capsuleStyle.left}px`,
                top: `${capsuleStyle.top}px`,
                width: `${capsuleStyle.width}px`,
                height: `${capsuleStyle.height}px`,
                opacity: capsuleStyle.opacity,
              }}
              aria-hidden="true"
            />

            {/* Four Primary Navigation Destinations */}
            {primaryNavItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = activeIndex === index;

              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    buttonRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-label={item.label}
                  aria-current={isSelected ? 'page' : undefined}
                  className="relative z-10 flex-1 h-full flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B8F4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111C35] rounded-full"
                >
                  <Icon
                    className={`w-[29px] h-[29px] sm:w-[32px] sm:h-[32px] transition-colors duration-200 ${
                      isSelected ? 'text-white' : 'text-white/90 hover:text-white'
                    }`}
                    strokeWidth={2}
                  />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Separate AI Assistant Button (Distinct Circular Button on the Right) */}
        <button
          type="button"
          onClick={onOpenAssistant}
          aria-label="Open AI assistant"
          title="Open Mindly AI Assistant"
          className="pointer-events-auto w-[74px] h-[74px] sm:w-[78px] sm:h-[78px] md:h-[82px] md:w-[82px] rounded-full shrink-0 aspect-square flex items-center justify-center transition-all duration-200 hover:scale-[1.04] hover:brightness-110 active:scale-95 cursor-pointer border border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B8F4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111C35]"
          style={{
            background: 'linear-gradient(135deg, #078FFF 0%, #285BFF 100%)',
            boxShadow: '0 10px 28px rgba(7, 143, 255, 0.42)',
          }}
        >
          {/* Centered four-point AI sparkle symbol with pale blue / white stroke */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-7 h-7 sm:w-8 sm:h-8 text-[#E0F2FE]"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path
              d="M12 2.5C12 7.8 7.8 12 2.5 12C7.8 12 12 16.2 12 21.5C12 16.2 16.2 12 21.5 12C16.2 12 12 7.8 12 2.5Z"
              fill="rgba(224, 242, 254, 0.2)"
            />
          </svg>
        </button>
      </div>
    </>
  );
};
