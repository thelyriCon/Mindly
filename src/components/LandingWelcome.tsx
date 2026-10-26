import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Award,
  Layers,
  Volume2,
  Network,
  ShieldCheck,
  Clock,
  User as UserIcon,
  ChevronRight,
  Loader2,
  Eye,
  EyeOff,
  Flame,
  Check,
  Plus,
} from 'lucide-react';
import { MindlyLogo } from './MindlyLogo';
import { ThemeToggle } from './ThemeToggle';
import { api } from '../lib/api';
import { persistenceEngine, LS_ACTIVE_USER_ID_KEY } from '../lib/persistence';
import { User } from '../types';

interface LandingWelcomeProps {
  onComplete: (user: User) => void;
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
}

export const LandingWelcome: React.FC<LandingWelcomeProps> = ({
  onComplete,
  onOpenSignIn,
  onOpenSignUp,
}) => {
  // Screens 1, 2, 3: Carousel | Screen 4: Auth & Profile Setup | Screen 5: Interests Harvester
  const [currentSlide, setCurrentSlide] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isPaused, setIsPaused] = useState(false);
  const autoPlayTimerRef = useRef<any>(null);

  // Screen 4 Form State
  const [authMethod, setAuthMethod] = useState<'social' | 'email'>('social');
  const [socialProvider, setSocialProvider] = useState<'google' | 'apple' | null>(null);
  const [realName, setRealName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(35);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Screen 5 Interests Harvester State
  const [stagedUser, setStagedUser] = useState<User | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Technology',
    'Space',
    'Aerodynamics',
    'Psychology',
  ]);
  const [availableInterests, setAvailableInterests] = useState<string[]>([
    'Technology',
    'Space',
    'Aerodynamics',
    'Modern History',
    'Psychology',
    'Visual Design',
    'Computer Science',
    'Finance & Trading',
    'Literature',
    'Music Theory',
    'Physics',
    'Neuroscience',
    'Molecular Biology',
    'Robotics & Automation',
    'Data Science',
    'Environmental Science',
  ]);
  const [customInterestInput, setCustomInterestInput] = useState('');

  // Auto-scrolling carousel for Screens 1, 2, 3 (every 6 seconds unless paused or on Screen 4)
  useEffect(() => {
    if (currentSlide >= 4 || isPaused) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setCurrentSlide((prev) => {
        if (prev === 1) return 2;
        if (prev === 2) return 3;
        return 1;
      });
    }, 6000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [currentSlide, isPaused]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentSlide < 4) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleNextSlide();
        } else if (e.key === 'ArrowLeft' && currentSlide > 1) {
          e.preventDefault();
          setCurrentSlide((prev) => (prev - 1) as 1 | 2 | 3);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          goToScreen4();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const handleNextSlide = () => {
    if (currentSlide === 1) setCurrentSlide(2);
    else if (currentSlide === 2) setCurrentSlide(3);
    else if (currentSlide === 3) goToScreen4();
  };

  const goToScreen4 = () => {
    setCurrentSlide(4);
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
  };

  // Helper to auto-extract name from email
  const extractNameFromEmail = (em: string): string => {
    if (!em || !em.includes('@')) return '';
    const prefix = em.split('@')[0];
    return prefix
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\d+/g, '')
      .trim();
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.googleLogin();
      if (!res.isNewUser && res.user) {
        onComplete(res.user);
        return;
      }
      // New user from Google
      setSocialProvider('google');
      setAuthMethod('social');
      if (res.email) setEmail(res.email);
      if (res.suggestedName) {
        setRealName(res.suggestedName);
        setUsername(`@${res.suggestedName.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
      }
      setSuccessNotice('Google account linked! Please verify your name for certificates and your unique @handle.');
    } catch (err: any) {
      console.error('[Google Sign In Error]', err);
      setErrorMsg(err?.message || 'Failed to sign in with Google');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Email input change: auto-suggest name if empty
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!realName && val.includes('@')) {
      const suggested = extractNameFromEmail(val);
      if (suggested) {
        setRealName(suggested);
        if (!username) {
          setUsername(`@${suggested.toLowerCase().replace(/\s+/g, '')}`);
        }
      }
    }
  };

  // Username input change: enforce @ prefix and alphanumeric
  const handleUsernameChange = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith('@')) {
      clean = `@${clean.replace(/^@+/, '')}`;
    }
    // Allow letters, numbers, underscores
    clean = clean.replace(/[^@a-zA-Z0-9_]/g, '');
    setUsername(clean);
  };

  // Form submission: "Start Your Learning Journey"
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const finalRealName = realName.trim();
    const cleanUsername = username.trim().replace(/^@+/, '');

    if (!finalRealName) {
      setErrorMsg('Please enter your full name (for your certificates).');
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Please enter a valid username (at least 3 characters).');
      return;
    }

    setIsSubmitting(true);

    try {
      let registeredUser: User | null = null;

      if (socialProvider === 'google') {
        const setupRes = await api.setupProfile(finalRealName, cleanUsername);
        registeredUser = setupRes.user;
      } else {
        if (!email.trim() || !email.includes('@')) {
          setErrorMsg('Please enter a valid email address.');
          setIsSubmitting(false);
          return;
        }
        if (!password || password.length < 6) {
          setErrorMsg('Password must be at least 6 characters long.');
          setIsSubmitting(false);
          return;
        }
        const regRes = await api.register(finalRealName, cleanUsername, email.trim(), password);
        registeredUser = regRes.user;
      }

      if (registeredUser) {
        setStagedUser(registeredUser);
        setCurrentSlide(5);
      }
    } catch (err: any) {
      console.error('[Onboarding Setup Error]', err);
      setErrorMsg(err?.message || 'Failed to complete profile setup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Screen 5 Interests Harvester Handlers
  const handleToggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleAddCustomInterest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customInterestInput.trim();
    if (!clean) return;

    if (!availableInterests.some((i) => i.toLowerCase() === clean.toLowerCase())) {
      setAvailableInterests((prev) => [clean, ...prev]);
    }
    if (!selectedInterests.some((i) => i.toLowerCase() === clean.toLowerCase())) {
      setSelectedInterests((prev) => [...prev, clean]);
    }
    setCustomInterestInput('');
  };

  const handleFinalizeInterests = async () => {
    if (!stagedUser) return;
    setIsSubmitting(true);
    try {
      const finalInterests = selectedInterests.length > 0 ? selectedInterests : ['General Knowledge'];
      const finalizedUser: User = {
        ...stagedUser,
        interests: finalInterests,
        hasCompletedOnboarding: true,
      };

      // Save finalized interests to IndexedDB and localStorage
      await persistenceEngine.saveUserProfile(finalizedUser);
      localStorage.setItem(LS_ACTIVE_USER_ID_KEY, finalizedUser.id);
      localStorage.setItem('mindly_user_interests', JSON.stringify(finalInterests));

      // Persist to backend API
      try {
        await api.updateProfile({ interests: finalInterests });
      } catch (e) {
        console.warn('[Interests sync notice]', e);
      }

      // Complete onboarding and navigate to Home Feed
      onComplete(finalizedUser);
    } catch (err: any) {
      console.error('[Finalize Interests Error]', err);
      setErrorMsg(err?.message || 'Failed to save interests. Proceeding to Home...');
      if (stagedUser) onComplete(stagedUser);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // SCREENS 1, 2, 3: INTRODUCTORY CAROUSEL (HOOK, VISUALS & AUDIO, PROOF)
  // =========================================================================
  if (currentSlide <= 3) {
    return (
      <div
        className="min-h-screen h-screen w-full bg-[#07132b] text-white flex flex-col justify-between items-center px-6 py-6 sm:py-10 select-none relative overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Header Bar: Logo & Skip Intro Button */}
        <header className="w-full max-w-4xl flex items-center justify-between z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center">
              <MindlyLogo size={20} color="#00B4FF" />
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">Mindly</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle variant="header" />
            <button
              type="button"
              onClick={goToScreen4}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#9bb1d6] hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-[#1a366f]"
            >
              <span>Skip Intro</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Central Carousel Slides */}
        <main className="flex-1 flex flex-col justify-center items-center max-w-2xl w-full text-center px-2 sm:px-4 my-auto">
          {/* ============================================================== */}
          {/* SCREEN 1 (HOOK): Master Any Subject Effortlessly */}
          {/* ============================================================== */}
          {currentSlide === 1 && (
            <div key="slide-1" className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
              {/* Visual Graphic: Learning Path & Concept Nodes */}
              <div className="relative mb-8 sm:mb-10 flex items-center justify-center">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-gradient-to-br from-[#0B1F44] to-[#081734] border border-[#00B4FF]/40 flex items-center justify-center shadow-2xl shadow-[#00B4FF]/20 relative">
                  {/* Visual Node Diagram */}
                  <svg className="w-24 h-24 sm:w-28 sm:h-28 text-[#00B4FF]" viewBox="0 0 80 80" fill="none">
                    <circle cx="20" cy="40" r="10" stroke="#00B4FF" strokeWidth="2.5" fill="#0B1F44" />
                    <circle cx="60" cy="24" r="8" stroke="#38bdf8" strokeWidth="2" fill="#07132b" />
                    <circle cx="58" cy="56" r="8" stroke="#38bdf8" strokeWidth="2" fill="#07132b" />
                    <path d="M29 36 L52 27" stroke="#00B4FF" strokeWidth="2" strokeDasharray="3 3" />
                    <path d="M29 44 L50 53" stroke="#00B4FF" strokeWidth="2" strokeDasharray="3 3" />
                    <path d="M16 40 L19 43 L25 36" stroke="#00B4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M57 24 L59 26 L63 21" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M55 56 L57 58 L61 53" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="absolute -bottom-3 px-3 py-1 rounded-full bg-[#00B4FF] text-[#0B1F44] text-[10px] font-mono font-bold tracking-wider shadow-lg shadow-[#00B4FF]/30 select-none">
                  ZERO FLUFF &bull; 100% RETENTION
                </div>
              </div>

              {/* Title & Description */}
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-widest font-semibold mb-2">
                PERSONALIZED STUDY ARCHITECTURE
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3 sm:mb-4 max-w-lg leading-tight">
                Master Any Subject Effortlessly
              </h1>
              <p className="text-sm sm:text-base text-[#9bb1d6] max-w-md leading-relaxed mb-6 font-normal">
                Personalized study paths, zero fluff, and simple bite-sized explanations tailored to your exact daily study capacity.
              </p>

              {/* Feature Chips */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#00B4FF]" /> Tailored Curriculums
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#00B4FF]" /> Bite-Sized Modules
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#00B4FF]" /> Multi-Day Pacing
                </span>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 2 (VISUALS & AUDIO): Visuals, Diagrams & Audio Summaries */}
          {/* ============================================================== */}
          {currentSlide === 2 && (
            <div key="slide-2" className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
              {/* Visual Graphic: Interactive Diagram + Audio Waveform */}
              <div className="relative mb-8 sm:mb-10 flex items-center justify-center">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-gradient-to-br from-[#0B1F44] to-[#081734] border border-[#00B4FF]/40 flex flex-col items-center justify-center shadow-2xl shadow-[#00B4FF]/20 relative p-4 gap-2">
                  <Network className="w-10 h-10 text-[#00B4FF]" />
                  {/* Waveform Equalizer Pulse */}
                  <div className="flex items-center gap-1 h-6">
                    <span className="w-1 h-3 bg-[#00B4FF] rounded-full animate-pulse" />
                    <span className="w-1 h-5 bg-[#00B4FF] rounded-full animate-pulse delay-75" />
                    <span className="w-1 h-6 bg-sky-300 rounded-full animate-pulse delay-150" />
                    <span className="w-1 h-4 bg-[#00B4FF] rounded-full animate-pulse delay-100" />
                    <span className="w-1 h-2 bg-[#00B4FF] rounded-full animate-pulse delay-200" />
                  </div>
                </div>
                <div className="absolute -bottom-3 px-3 py-1 rounded-full bg-sky-500 text-[#0B1F44] text-[10px] font-mono font-bold tracking-wider shadow-lg shadow-sky-500/30 select-none flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> MULTI-MODAL LEARNING
                </div>
              </div>

              {/* Title & Description */}
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-widest font-semibold mb-2">
                IMMERSIVE COMPREHENSION
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3 sm:mb-4 max-w-lg leading-tight">
                Visuals, Diagrams & Audio Summaries
              </h1>
              <p className="text-sm sm:text-base text-[#9bb1d6] max-w-md leading-relaxed mb-6 font-normal">
                Grasp complex mechanisms instantly with automatic interactive flowcharts, real royalty-free imagery, and audio lessons.
              </p>

              {/* Feature Chips */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-[#00B4FF]" /> Mermaid Flowcharts
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#00B4FF]" /> Instant Audio
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#00B4FF]" /> CC Images
                </span>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 3 (PROOF & ACHIEVEMENT): Track Growth & Earn Achievements */}
          {/* ============================================================== */}
          {currentSlide === 3 && (
            <div key="slide-3" className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
              {/* Visual Graphic: Verified Certificate & Achievement Badge */}
              <div className="relative mb-8 sm:mb-10 flex items-center justify-center">
                <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-gradient-to-br from-[#0B1F44] to-[#081734] border border-[#00B4FF]/40 flex items-center justify-center shadow-2xl shadow-[#00B4FF]/20 relative">
                  <svg className="w-20 h-20 sm:w-24 sm:h-24 text-[#00B4FF]" viewBox="0 0 64 64" fill="none">
                    <rect x="12" y="8" width="40" height="48" rx="4" stroke="#00B4FF" strokeWidth="2.5" fill="#07132b" />
                    <path d="M20 18h24M20 25h24M20 32h14" stroke="#9bb1d6" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="42" cy="42" r="7.5" stroke="#00B4FF" strokeWidth="2" fill="#0B1F44" />
                    <path d="M39 42l2 2 4-4" stroke="#00B4FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="absolute -bottom-3 px-3 py-1 rounded-full bg-amber-400 text-[#0B1F44] text-[10px] font-mono font-bold tracking-wider shadow-lg shadow-amber-400/30 select-none flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-[#0B1F44]" /> VERIFIED CREDENTIALS
                </div>
              </div>

              {/* Title & Description */}
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-widest font-semibold mb-2">
                MEASURABLE MASTERY
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3 sm:mb-4 max-w-lg leading-tight">
                Track Growth & Earn Achievements
              </h1>
              <p className="text-sm sm:text-base text-[#9bb1d6] max-w-md leading-relaxed mb-6 font-normal">
                Skill mastery tracking, real progress badges, and officially verifiable certificates issued in your real name upon course graduation.
              </p>

              {/* Feature Chips */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> Daily Streaks
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Mastery Milestone Gates
                </span>
                <span className="px-3 py-1 rounded-full bg-[#0B1F44] border border-[#1a366f] text-xs text-[#9bb1d6] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" /> Real-Name Certificates
                </span>
              </div>
            </div>
          )}
        </main>

        {/* Carousel Bottom Controls: Slide Indicators + Next Button */}
        <footer className="w-full max-w-md flex flex-col items-center gap-5 z-20">
          {/* Slide Indicator Dots */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((slideNum) => (
              <button
                key={slideNum}
                type="button"
                onClick={() => setCurrentSlide(slideNum as 1 | 2 | 3)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentSlide === slideNum
                    ? 'w-8 bg-[#00B4FF] shadow-sm shadow-[#00B4FF]/50'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to slide ${slideNum}`}
              />
            ))}
          </div>

          {/* Primary Action Button for Carousel */}
          <div className="w-full flex items-center gap-3">
            <button
              type="button"
              onClick={handleNextSlide}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-sm font-bold transition-all shadow-lg shadow-[#00B4FF]/25 cursor-pointer"
            >
              <span>{currentSlide === 3 ? 'Get Started' : 'Next'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 5: INTERESTS HARVESTER SCREEN
  // =========================================================================
  if (currentSlide === 5) {
    return (
      <div className="min-h-screen w-full bg-[#07132b] text-white flex flex-col items-center justify-center px-4 sm:px-6 py-10 selection:bg-[#00B4FF] selection:text-[#0B1F44] relative">
        {/* Top right Theme Toggle for Screen 5 */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-8 z-20">
          <ThemeToggle variant="header" />
        </div>

        <div className="w-full max-w-xl rounded-3xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center mx-auto shadow-inner text-[#00B4FF] mb-2">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#00B4FF]/15 border border-[#00B4FF]/30 text-[#00B4FF] text-[10px] font-mono font-bold tracking-wider uppercase mb-1">
              <span>Step 2 of 2: Intellectual Interests</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              What do you want to master?
            </h2>
            <p className="text-xs sm:text-sm text-[#9bb1d6] max-w-md mx-auto leading-relaxed">
              Select your intellectual curiosities. Mindly will use them to curate your daily discovery feed and tailor deep learning paths.
            </p>
          </div>

          {/* Search / Custom Interest Input Bar */}
          <form onSubmit={handleAddCustomInterest} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={customInterestInput}
                onChange={(e) => setCustomInterestInput(e.target.value)}
                placeholder="Don't see your interest? Type it here to add it..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
              />
            </div>
            <button
              type="submit"
              disabled={!customInterestInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </form>

          {/* Category Chip Grid (Scrollable with clean layout) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#9bb1d6]">
              <span>Tap topics to toggle ({selectedInterests.length} selected)</span>
              {selectedInterests.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedInterests([])}
                  className="text-[11px] text-[#627ca8] hover:text-[#00B4FF] transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="max-h-60 sm:max-h-68 overflow-y-auto p-1.5 flex flex-wrap gap-2 rounded-2xl bg-[#07132b]/60 border border-[#1a366f]/60">
              {availableInterests.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => handleToggleInterest(interest)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#00B4FF]/20 border-[#00B4FF] text-white shadow-sm ring-1 ring-[#00B4FF]/50'
                        : 'bg-[#081734] border-[#1a366f] text-[#9bb1d6] hover:text-white hover:border-[#627ca8]'
                    }`}
                  >
                    <span>{interest}</span>
                    {isSelected ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00B4FF] shrink-0" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-[#627ca8] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action CTA Button: "Continue to Home" */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleFinalizeInterests}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-sm font-bold uppercase tracking-wider transition-all shadow-xl shadow-[#00B4FF]/25 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Entering Mindly...</span>
                </>
              ) : (
                <>
                  <span>Continue to Home</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 4: AUTHENTICATION & PROFILE SETUP SCREEN
  // =========================================================================
  return (
    <div className="min-h-screen w-full bg-[#07132b] text-white flex flex-col items-center justify-center px-4 sm:px-6 py-10 selection:bg-[#00B4FF] selection:text-[#0B1F44] relative">
      {/* Top right Theme Toggle for Screen 4 */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8 z-20">
        <ThemeToggle variant="header" />
      </div>

      <div className="w-full max-w-lg rounded-3xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center mx-auto shadow-inner text-[#00B4FF] mb-2">
            <MindlyLogo size={24} color="#00B4FF" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Set Up Your Learning Profile
          </h2>
          <p className="text-xs sm:text-sm text-[#9bb1d6] max-w-sm mx-auto">
            Where information becomes knowledge. Create your profile to start your personalized learning journey.
          </p>
        </div>

        {/* Google Authentication */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 ${
              socialProvider === 'google'
                ? 'bg-white text-zinc-900 border-white shadow-lg'
                : 'bg-[#081734] hover:bg-[#0e244d] border-[#1a366f] text-white'
            }`}
          >
            {/* Google 'G' Icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
            {socialProvider === 'google' && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />}
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#1a366f] w-full" />
          <span className="bg-[#0B1F44] px-3 text-[11px] font-mono text-[#9bb1d6] uppercase tracking-wider">
            or setup with email
          </span>
        </div>

        {/* Feedback Notices */}
        {successNotice && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Profile Setup Form */}
        <form onSubmit={handleSubmitProfile} className="space-y-4">
          {/* Email & Password (Visible if Email method or to set credentials) */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] text-sm focus:outline-none focus:border-[#00B4FF] transition-colors"
              />
            </div>

            {!socialProvider && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] text-sm focus:outline-none focus:border-[#00B4FF] transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 1. Full Name (Auto-extracted & Fully Editable) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-200">
                Full Name <span className="text-[#00B4FF]">*</span>
              </label>
              <span className="text-[10px] text-[#9bb1d6] font-mono">Editable</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] text-sm focus:outline-none focus:border-[#00B4FF] transition-colors"
              />
            </div>
            <p className="text-[11px] text-[#9bb1d6] mt-1 flex items-center gap-1">
              <Award className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Will appear on your official completion certificates</span>
            </p>
          </div>

          {/* 2. Custom Username Input Field (@...) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-200">
                Username Handle <span className="text-[#00B4FF]">*</span>
              </label>
              {username.length >= 3 && (
                <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Available
                </span>
              )}
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="@iCon"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] text-sm font-mono focus:outline-none focus:border-[#00B4FF] transition-colors"
            />
            <p className="text-[11px] text-[#9bb1d6] mt-1 font-mono">
              Your unique learner handle across Mindly study rooms and circles
            </p>
          </div>

          {/* 3. Daily Study Goal Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-200 mb-2">
              Daily Study Goal
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { min: 15, label: '15 mins', sub: 'Casual' },
                { min: 35, label: '35 mins', sub: 'Standard' },
                { min: 60, label: '60 mins', sub: 'Intensive' },
              ].map((opt) => (
                <button
                  key={opt.min}
                  type="button"
                  onClick={() => setDailyGoal(opt.min)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    dailyGoal === opt.min
                      ? 'bg-[#00B4FF]/20 border-[#00B4FF] text-white shadow-md'
                      : 'bg-[#081734] border-[#1a366f] text-[#9bb1d6] hover:border-zinc-500'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{opt.label}</div>
                  <div className="text-[10px] text-[#9bb1d6]">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Action Button: "Start Your Learning Journey" */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-sm font-bold uppercase tracking-wider transition-all shadow-xl shadow-[#00B4FF]/25 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Preparing Your Workspace...</span>
              </>
            ) : (
              <>
                <span>Start Your Learning Journey</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
