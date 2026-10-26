import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  BookOpen,
  FileText,
  Bookmark,
  Copy,
  Check,
  Minimize2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Lightbulb,
  Search,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { Course, Lesson, Note, KeyTermItem } from '../types';
import { api } from '../lib/api';

export interface FloatingAIAssistantProps {
  activeLesson?: Lesson | null;
  activeCourse?: Course | null;
  notes: Note[];
  terms: KeyTermItem[];
  onOpenNote?: (noteId: string) => void;
  onOpenTerm?: (termId: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideDefaultTrigger?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  matchedNotes?: Array<{ id: string; title: string }>;
  matchedTerms?: Array<{ id: string; term: string }>;
}

export const FloatingAIAssistant: React.FC<FloatingAIAssistantProps> = ({
  activeLesson,
  activeCourse,
  notes,
  terms,
  onOpenNote,
  onOpenTerm,
  isOpen: controlledIsOpen,
  onOpenChange,
  hideDefaultTrigger = false,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(isOpen) : next;
    if (onOpenChange) onOpenChange(resolved);
    setInternalIsOpen(resolved);
  };
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('mindly_assistant_chat_history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Save chat history
  useEffect(() => {
    try {
      localStorage.setItem('mindly_assistant_chat_history', JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // Scroll to bottom when messages update or open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Dynamic quick prompt suggestions based on current context
  const getQuickPrompts = () => {
    if (activeLesson) {
      return [
        {
          label: 'Core Takeaway',
          prompt: `What are the core takeaways and key concepts of the lesson "${activeLesson.title}"?`,
          icon: Lightbulb,
        },
        {
          label: 'Search My Notes',
          prompt: `Search my stored notes and tell me what I have recorded relevant to "${activeLesson.title}".`,
          icon: FileText,
        },
        {
          label: 'Glossary Check',
          prompt: `Are there any key glossary terms related to "${activeLesson.title}" in my collection?`,
          icon: Bookmark,
        },
        {
          label: 'Quiz Me',
          prompt: `Quiz me with a scenario-based question to test my understanding of "${activeLesson.title}".`,
          icon: HelpCircle,
        },
      ];
    }

    if (activeCourse) {
      return [
        {
          label: 'Course Synthesis',
          prompt: `Summarize the learning goals and main concepts of the course "${activeCourse.title}".`,
          icon: GraduationCap,
        },
        {
          label: 'Notes Overview',
          prompt: `What notes have I written for the course "${activeCourse.title}"?`,
          icon: FileText,
        },
        {
          label: 'Key Terms',
          prompt: `List the most critical glossary terms and definitions I have stored for "${activeCourse.title}".`,
          icon: Bookmark,
        },
      ];
    }

    return [
      {
        label: 'Search Notes',
        prompt: 'Search all my stored notes and give me an executive summary of my primary topics.',
        icon: FileText,
      },
      {
        label: 'Glossary Definitions',
        prompt: 'What key terms and definitions do I have stored in my glossary?',
        icon: Bookmark,
      },
      {
        label: 'Study Suggestions',
        prompt: 'Based on my courses, notes, and terms, what should I focus on reviewing today?',
        icon: Lightbulb,
      },
    ];
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      // Prepare active lesson data
      const lessonPayload = activeLesson
        ? {
            id: activeLesson.id,
            title: activeLesson.title,
            dayTitle: activeLesson.dayTitle,
            dayNumber: activeLesson.dayNumber,
            structuredContent: activeLesson.structuredContent,
            originalMaterial: activeLesson.originalMaterial,
            userNotes: activeLesson.userNotes,
          }
        : undefined;

      // Prepare active course data
      const coursePayload = activeCourse
        ? {
            id: activeCourse.id,
            title: activeCourse.title,
            description: activeCourse.description,
            category: activeCourse.category,
            learningObjectives: activeCourse.learningObjectives,
          }
        : undefined;

      // Prepare notes payload (filter relevant ones or pass recent)
      const relevantNotes = notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        courseTitle: n.courseTitle,
        lessonTitle: n.lessonTitle,
        tags: n.tags,
      }));

      // Prepare terms payload
      const relevantTerms = terms.map((t) => ({
        id: t.id,
        term: t.term,
        definition: t.definition,
        context: t.context,
        relatedConcepts: t.relatedConcepts,
        lessonTitle: t.lessonTitle,
      }));

      const response = await api.askAssistantChat({
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        activeLesson: lessonPayload,
        activeCourse: coursePayload,
        notes: relevantNotes,
        terms: relevantTerms,
      });

      const assistantMessage: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        matchedNotes: response.matchedNotes,
        matchedTerms: response.matchedTerms,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `I ran into a temporary issue retrieving your answer: ${err.message || 'Please try again.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear your AI Assistant conversation history?')) {
      setMessages([]);
      try {
        localStorage.removeItem('mindly_assistant_chat_history');
      } catch {}
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to render rich markdown and highlight citation tags
  const renderMessageContent = (content: string) => {
    // Regex for citations: [Note: "Title"], [Glossary: "Term"], [Lesson: "Title"]
    const lines = content.split('\n');

    return (
      <div className="space-y-2 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          // Headers
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-semibold text-base text-[var(--mindly-sky)] pt-1">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h3 key={idx} className="font-bold text-lg text-[var(--text-primary)] pt-1">
                {line.replace('## ', '')}
              </h3>
            );
          }

          // Bullet points
          const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
          const cleanLine = isBullet ? line.trim().substring(2) : line;

          // Parse citations and bold text in line
          const formattedParts = parseFormattedText(cleanLine);

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-[var(--mindly-sky)] select-none mt-1.5 text-xs">•</span>
                <div className="flex-1">{formattedParts}</div>
              </div>
            );
          }

          return <p key={idx}>{formattedParts}</p>;
        })}
      </div>
    );
  };

  const parseFormattedText = (text: string) => {
    // Split on citations: [Note: "..."], [Glossary: "..."], [Lesson: "..."]
    const citationRegex = /(\[(?:Note|Glossary|Lesson):\s*"?[^"\]]+"?\])/g;
    const parts = text.split(citationRegex);

    return parts.map((part, pIdx) => {
      // Check if it is a citation
      const noteMatch = part.match(/\[Note:\s*"?(.*?)"?\]/i);
      if (noteMatch) {
        const title = noteMatch[1];
        const matchedNote = notes.find(
          (n) => n.title.toLowerCase() === title.toLowerCase()
        );
        return (
          <span
            key={pIdx}
            onClick={() => {
              if (matchedNote?.id) {
                onOpenNote?.(matchedNote.id);
              }
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-xs font-medium border transition-colors ${
              matchedNote?.id
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 cursor-pointer'
                : 'bg-amber-500/10 text-amber-300/80 border-amber-500/20'
            }`}
            title={matchedNote ? `View Note: ${title}` : `Referenced Note: ${title}`}
          >
            <FileText className="w-3 h-3 text-amber-400" />
            <span>Note: {title}</span>
          </span>
        );
      }

      const termMatch = part.match(/\[Glossary:\s*"?(.*?)"?\]/i);
      if (termMatch) {
        const termName = termMatch[1];
        const matchedTerm = terms.find(
          (t) => t.term.toLowerCase() === termName.toLowerCase()
        );
        return (
          <span
            key={pIdx}
            onClick={() => {
              if (matchedTerm?.id) {
                onOpenTerm?.(matchedTerm.id);
              }
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-xs font-medium border transition-colors ${
              matchedTerm?.id
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25 cursor-pointer'
                : 'bg-sky-500/10 text-sky-300/80 border-sky-500/20'
            }`}
            title={matchedTerm ? `View Glossary Term: ${termName}` : `Referenced Term: ${termName}`}
          >
            <Bookmark className="w-3 h-3 text-sky-400" />
            <span>Glossary: {termName}</span>
          </span>
        );
      }

      const lessonMatch = part.match(/\[Lesson:\s*"?(.*?)"?\]/i);
      if (lessonMatch) {
        const lessonTitle = lessonMatch[1];
        return (
          <span
            key={pIdx}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
          >
            <BookOpen className="w-3 h-3 text-emerald-400" />
            <span>Lesson: {lessonTitle}</span>
          </span>
        );
      }

      // Handle bold text **bold**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={pIdx}>
          {boldParts.map((bPart, bIdx) => {
            if (bPart.startsWith('**') && bPart.endsWith('**')) {
              return (
                <strong key={bIdx} className="font-semibold text-[var(--text-primary)]">
                  {bPart.slice(2, -2)}
                </strong>
              );
            }
            return bPart;
          })}
        </span>
      );
    });
  };

  // Scope description
  const activeScopeLabel = activeLesson
    ? `Lesson: ${activeLesson.title}`
    : activeCourse
    ? `Course: ${activeCourse.title}`
    : 'All Notes & Glossaries';

  return (
    <>
      {/* ========================================== */}
      {/* 1. FLOATING ACTION BUTTON (COLLAPSED)       */}
      {/* ========================================== */}
      {!isOpen && !hideDefaultTrigger && (
        <div className="fixed bottom-6 right-6 z-40 group">
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open Mindly AI Study Assistant"
            className="relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-sky-500 via-indigo-600 to-blue-600 text-white shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-sky-400/30 backdrop-blur-md"
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 animate-pulse text-amber-200" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-main)]" />
            </div>

            <span className="font-semibold text-sm tracking-wide hidden sm:inline">
              Ask AI Assistant
            </span>

            {/* Active context badge pill on hover or mobile */}
            {activeLesson && (
              <span className="hidden md:inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/95 max-w-[140px] truncate">
                {activeLesson.title}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. EXPANDED FLOATING CHAT PANEL            */}
      {/* ========================================== */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[420px] md:w-[460px] h-[590px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border border-sky-500/30 bg-[var(--bg-card)]/95 backdrop-blur-2xl overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-4">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 shrink-0">
                <Sparkles className="w-4 h-4 text-amber-200" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">
                    Mindly Study Assistant
                  </h3>
                  <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
                    Gemini 3.8
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">{activeScopeLabel}</span>
                </p>
              </div>
            </div>

            {/* Header controls */}
            <div className="flex items-center gap-1 text-[var(--text-muted)] shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  title="Clear conversation"
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize assistant"
                className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Context Scope & Index Accordion Banner */}
          <div className="bg-[var(--bg-main)]/60 px-3 py-1.5 border-b border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
              <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="truncate">
                Active Index: <strong className="text-[var(--text-primary)]">{notes.length}</strong> notes • <strong className="text-[var(--text-primary)]">{terms.length}</strong> glossary terms
              </span>
            </div>
            <button
              onClick={() => setShowContextDetails(!showContextDetails)}
              className="text-[var(--mindly-sky)] hover:underline shrink-0 text-[11px] flex items-center gap-0.5 ml-2 cursor-pointer"
            >
              <span>{showContextDetails ? 'Hide' : 'Details'}</span>
              {showContextDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Expanded Context Details */}
          {showContextDetails && (
            <div className="px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] text-xs space-y-2 animate-in fade-in">
              <div>
                <span className="font-semibold text-[var(--text-primary)]">Grounded Scope:</span>{' '}
                <span className="text-[var(--text-secondary)]">
                  {activeLesson
                    ? `Lesson "${activeLesson.title}" inside course "${activeCourse?.title || 'Active Course'}"`
                    : activeCourse
                    ? `Course "${activeCourse.title}"`
                    : 'Global knowledge base across all your courses'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {notes.length} Stored Notes
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[11px] flex items-center gap-1">
                  <Bookmark className="w-3 h-3" /> {terms.length} Stored Terms
                </span>
                {activeLesson?.structuredContent?.mainConcepts?.length ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] flex items-center gap-1">
                    <Layers className="w-3 h-3" /> {activeLesson.structuredContent.mainConcepts.length} Core Concepts
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center px-4 py-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
                  <Sparkles className="w-6 h-6 text-amber-200" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-[var(--text-primary)]">
                    Ask About Your Study Material
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] max-w-xs mt-1">
                    I can explain concepts from your active lesson, find connections in your stored notes, and lookup terms in your glossary.
                  </p>
                </div>

                {/* Quick Prompts */}
                <div className="w-full space-y-2 pt-2">
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider text-left pl-1">
                    Suggested Questions
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {getQuickPrompts().map((qp, i) => {
                      const Icon = qp.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(qp.prompt)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left bg-[var(--bg-elevated)]/80 hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-sky-500/40 text-xs transition-all duration-150 cursor-pointer group"
                        >
                          <Icon className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
                          <span className="truncate flex-1">{qp.prompt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${
                        isUser
                          ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-tr-xs'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-tl-xs'
                      }`}
                    >
                      {isUser ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        renderMessageContent(msg.content)
                      )}

                      {/* Referenced Citations Badges Footer (if assistant matched specific notes/terms) */}
                      {!isUser && (msg.matchedNotes?.length || msg.matchedTerms?.length) ? (
                        <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Referenced:
                          </span>
                          {msg.matchedNotes?.map((mn) => (
                            <button
                              key={mn.id}
                              onClick={() => onOpenNote?.(mn.id)}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{mn.title}</span>
                            </button>
                          ))}
                          {msg.matchedTerms?.map((mt) => (
                            <button
                              key={mt.id}
                              onClick={() => onOpenTerm?.(mt.id)}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 transition-colors cursor-pointer"
                            >
                              <Bookmark className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{mt.term}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* Copy action on assistant response */}
                    {!isUser && (
                      <div className="flex items-center gap-1 pl-1 text-[11px] text-[var(--text-muted)]">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors p-1"
                          title="Copy explanation"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" />
                  </div>
                  <span>Searching notes, glossaries & curriculum...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
            <div className="relative flex items-end gap-2 bg-[var(--bg-input)] border border-[var(--border-subtle)] focus-within:border-sky-500 rounded-xl px-3 py-2 transition-colors">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeLesson
                    ? `Ask about "${activeLesson.title}" or your notes...`
                    : 'Ask about courses, stored notes, or terms...'
                }
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent resize-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] max-h-24 min-h-[22px] py-0.5 leading-relaxed"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                aria-label="Send message"
                className="p-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer shadow-sm shadow-sky-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between pt-1.5 px-1 text-[10px] text-[var(--text-muted)]">
              <span>Press ↵ Enter to send, Shift+↵ for new line</span>
              <span className="truncate max-w-[180px]">Grounded in user notes & glossaries</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
