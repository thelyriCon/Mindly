import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Bookmark,
  Sparkles,
  HelpCircle,
  FileText,
  Edit,
  Save,
  Send,
  Eye,
  Type,
  Plus,
  Trash2,
  BookOpen,
  MessageSquare,
  X,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { api } from '../lib/api';
import { Lesson, Course, StructuredContent, KeyTermItem } from '../types';
import { QuizModal } from './QuizModal';

interface LessonDetailViewProps {
  lesson: Lesson;
  course: Course;
  onBack: () => void;
  onLessonUpdated: (updatedLesson: Lesson) => void;
  onOpenAddNote: (courseId: string, lessonId: string, initialTitle: string) => void;
  onSelectTerm?: (term: KeyTermItem) => void;
}

export const LessonDetailView: React.FC<LessonDetailViewProps> = ({
  lesson,
  course,
  onBack,
  onLessonUpdated,
  onOpenAddNote,
  onSelectTerm,
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'original'>('structured');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<StructuredContent>(lesson.structuredContent);
  const [editedTitle, setEditedTitle] = useState(lesson.title);
  const [isSaving, setIsSaving] = useState(false);

  // Active Study Time Tracking for Daily Goal
  const [sessionSeconds, setSessionSeconds] = useState(0);

  React.useEffect(() => {
    let unloggedSeconds = 0;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setSessionSeconds((prev) => prev + 1);
        unloggedSeconds += 1;

        // Auto-flush every 15 seconds
        if (unloggedSeconds >= 15) {
          api.logStudyTime(unloggedSeconds, lesson.id).catch((err) => {
            console.error('Study log failed:', err);
          });
          unloggedSeconds = 0;
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (unloggedSeconds > 0) {
        api.logStudyTime(unloggedSeconds, lesson.id).catch(() => {});
      }
    };
  }, [lesson.id]);

  // Quiz Modal state
  const [showQuizModal, setShowQuizModal] = useState(false);

  // AI Tutor Drawer state
  const [showTutor, setShowTutor] = useState(false);
  const [tutorQuery, setTutorQuery] = useState('');
  const [tutorMessages, setTutorMessages] = useState<Array<{ sender: 'user' | 'tutor'; text: string }>>([
    {
      sender: 'tutor',
      text: `Hello! I'm your Mindly study assistant for "${lesson.title}". What would you like clarified from this lesson?`,
    },
  ]);
  const [isTutorThinking, setIsTutorThinking] = useState(false);

  // Bookmark and Complete actions
  const handleToggleBookmark = async () => {
    try {
      const res = await api.toggleBookmark(lesson.id);
      onLessonUpdated(res.lesson);
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  };

  const handleToggleComplete = async () => {
    try {
      const res = await api.toggleComplete(lesson.id);
      onLessonUpdated(res.lesson);
    } catch (err) {
      console.error('Complete error:', err);
    }
  };

  // Save manual lesson edits
  const handleSaveEdits = async () => {
    setIsSaving(true);
    try {
      const res = await api.updateLesson(lesson.id, {
        title: editedTitle,
        structuredContent: editedContent,
      });
      onLessonUpdated(res.lesson);
      setIsEditing(false);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Send question to AI Tutor
  const handleAskTutor = async (questionText?: string) => {
    const q = questionText || tutorQuery;
    if (!q.trim() || isTutorThinking) return;

    const newMessages = [...tutorMessages, { sender: 'user' as const, text: q }];
    setTutorMessages(newMessages);
    setTutorQuery('');
    setIsTutorThinking(true);

    try {
      const res = await api.askTutor({
        question: q,
        lessonContext: lesson.structuredContent,
        courseContext: course.title,
        originalMaterial: lesson.originalMaterial?.content,
      });
      setTutorMessages([...newMessages, { sender: 'tutor', text: res.answer }]);
    } catch (err) {
      setTutorMessages([
        ...newMessages,
        {
          sender: 'tutor',
          text: 'Sorry, I encountered an issue connecting to the tutoring engine. Please try again.',
        },
      ]);
    } finally {
      setIsTutorThinking(false);
    }
  };

  // Font size class mapping
  const textSizeClass =
    fontSize === 'xlarge'
      ? 'text-lg leading-relaxed'
      : fontSize === 'large'
      ? 'text-base leading-relaxed'
      : 'text-sm leading-relaxed';

  return (
    <div className="min-h-screen bg-[#0c0d10] text-zinc-100 flex flex-col">
      {/* Top Header & Distraction-Free Controls */}
      <header className="sticky top-0 z-20 bg-[#111216]/95 backdrop-blur-md border-b border-[#20222a] px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title="Back to Course"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-zinc-400 truncate block">
                {course.title}
              </span>
              <h1 className="text-sm font-semibold text-white truncate max-w-sm sm:max-w-md">
                {lesson.title}
              </h1>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Active Study Time Pill */}
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono select-none"
              title="Time logged to today's Daily Study Goal"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="hidden sm:inline text-zinc-400">Study:</span>
              <span>
                {Math.floor(sessionSeconds / 60)}m {String(sessionSeconds % 60).padStart(2, '0')}s
              </span>
            </div>

            {/* Font Size Selector */}
            <div className="hidden sm:flex items-center rounded-lg bg-[#181920] border border-[#262833] p-0.5 text-xs text-zinc-400">
              <button
                onClick={() => setFontSize('normal')}
                className={`px-2 py-1 rounded cursor-pointer ${fontSize === 'normal' ? 'bg-zinc-700 text-white font-medium' : 'hover:text-zinc-200'}`}
              >
                A
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`px-2 py-1 rounded cursor-pointer ${fontSize === 'large' ? 'bg-zinc-700 text-white font-medium' : 'hover:text-zinc-200'}`}
              >
                A+
              </button>
              <button
                onClick={() => setFontSize('xlarge')}
                className={`px-2 py-1 rounded cursor-pointer ${fontSize === 'xlarge' ? 'bg-zinc-700 text-white font-medium' : 'hover:text-zinc-200'}`}
              >
                A++
              </button>
            </div>

            {/* Bookmark Toggle */}
            <button
              onClick={handleToggleBookmark}
              className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                lesson.isBookmarked
                  ? 'bg-amber-950/40 border-amber-600/50 text-amber-300'
                  : 'bg-[#181920] border-[#262833] text-zinc-400 hover:text-zinc-200'
              }`}
              title={lesson.isBookmarked ? 'Bookmarked' : 'Add Bookmark'}
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>

            {/* Complete Toggle */}
            <button
              onClick={handleToggleComplete}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                lesson.isCompleted
                  ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                  : 'bg-[#181920] border-[#262833] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lesson.isCompleted ? 'Completed' : 'Mark Complete'}</span>
            </button>

            {/* Test Yourself (Quiz) Button */}
            {lesson.structuredContent?.reviewQuestions?.length > 0 && (
              <button
                onClick={() => setShowQuizModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Test Yourself</span>
              </button>
            )}

            {/* AI Tutor Toggle */}
            <button
              onClick={() => setShowTutor(!showTutor)}
              className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                showTutor
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-[#181920] border-[#262833] text-zinc-300 hover:text-white'
              }`}
              title="Open AI Tutor"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Workspace Mode Tabs: Structured Lesson vs Original Material */}
        <div className="flex items-center justify-between border-b border-[#22242c] pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('structured')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'structured'
                  ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Structured Lesson</span>
            </button>
            <button
              onClick={() => setActiveTab('original')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'original'
                  ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Original Material (Preserved)</span>
            </button>
          </div>

          {activeTab === 'structured' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onOpenAddNote(course.id, lesson.id, `Notes on ${lesson.title}`)
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>+ Add Note</span>
              </button>

              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Lesson</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Edits'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab 1: STRUCTURED LESSON */}
        {activeTab === 'structured' ? (
          <article className="space-y-8 animate-in fade-in duration-150">
            {/* Demo marker notice */}
            {lesson.isDemo && (
              <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-[11px] text-indigo-300 flex items-center justify-between">
                <span>[Demo Content] Seeded example for Market Structure course.</span>
                <span className="text-zinc-400">Untouched original transcript preserved in tab</span>
              </div>
            )}

            {/* Title & Overview Card */}
            <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-3">
              {!isEditing ? (
                <>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {lesson.structuredContent?.title || lesson.title}
                  </h1>
                  <p className={`text-zinc-300 ${textSizeClass}`}>
                    {lesson.structuredContent?.overview}
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full text-xl font-bold p-2.5 rounded-lg bg-[#0e0f12] border border-[#272932] text-white"
                  />
                  <textarea
                    rows={3}
                    value={editedContent.overview}
                    onChange={(e) =>
                      setEditedContent({ ...editedContent, overview: e.target.value })
                    }
                    className="w-full text-xs p-2.5 rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-200"
                  />
                </div>
              )}
            </div>

            {/* Learning Objectives */}
            {lesson.structuredContent?.learningObjectives?.length > 0 && (
              <div className="p-5 rounded-2xl bg-[#131418] border border-[#23252e]">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Learning Objectives
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {lesson.structuredContent.learningObjectives.map((obj, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-[#0e0f12] border border-[#1f2027] flex items-start gap-2.5 text-xs text-zinc-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Concepts & Subtopics */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Core Conceptual Framework
              </h2>
              {lesson.structuredContent?.mainConcepts?.map((concept, idx) => (
                <div
                  key={concept.id || idx}
                  className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4"
                >
                  <h3 className="text-base sm:text-lg font-semibold text-white">
                    {concept.title}
                  </h3>
                  <p className={`text-zinc-300 ${textSizeClass}`}>{concept.explanation}</p>

                  {/* Subtopics */}
                  {concept.subtopics && concept.subtopics.length > 0 && (
                    <div className="space-y-3 pt-2 pl-3 sm:pl-4 border-l-2 border-indigo-500/40">
                      {concept.subtopics.map((sub, sIdx) => (
                        <div key={sIdx} className="space-y-1">
                          <h4 className="text-xs font-semibold text-indigo-300">{sub.title}</h4>
                          <p className={`text-zinc-400 ${textSizeClass}`}>{sub.explanation}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Important Distinctions */}
            {lesson.structuredContent?.importantDistinctions?.length > 0 && (
              <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e]">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Important Distinctions (Avoid Confusion)
                </h2>
                <div className="space-y-3">
                  {lesson.structuredContent.importantDistinctions.map((dist, dIdx) => (
                    <div
                      key={dIdx}
                      className="p-4 rounded-xl bg-[#0e0f12] border border-[#1f2027] space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 font-semibold border border-indigo-800/40">
                          {dist.conceptA}
                        </span>
                        <span className="text-zinc-500 font-mono">VS</span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700">
                          {dist.conceptB}
                        </span>
                      </div>
                      <p className={`text-zinc-300 ${textSizeClass}`}>{dist.distinction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Practical Examples */}
            {lesson.structuredContent?.examples?.length > 0 && (
              <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e]">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Practical Scenarios & Examples
                </h2>
                <div className="space-y-3">
                  {lesson.structuredContent.examples.map((ex, exIdx) => (
                    <div
                      key={exIdx}
                      className="p-4 rounded-xl bg-[#0e0f12] border border-[#1f2027] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-white">{ex.title}</h4>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            ex.fromMaterial
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {ex.fromMaterial ? 'From Your Material' : 'Pedagogical Model'}
                        </span>
                      </div>
                      <p className={`text-zinc-300 ${textSizeClass}`}>{ex.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extracted Key Terms Glossary */}
            {lesson.structuredContent?.keyTerms?.length > 0 && (
              <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e]">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Extracted Terminology (Glossary)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lesson.structuredContent.keyTerms.map((t, tIdx) => (
                    <div
                      key={tIdx}
                      onClick={() => onSelectTerm && onSelectTerm(t)}
                      className="p-3.5 rounded-xl bg-[#0e0f12] border border-[#1f2027] hover:border-indigo-500/50 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-indigo-300 block mb-1">
                        {t.term}
                      </span>
                      <p className="text-xs text-zinc-300 leading-relaxed">{t.definition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Takeaways */}
            {lesson.structuredContent?.keyTakeaways?.length > 0 && (
              <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e]">
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Key Takeaways
                </h2>
                <ul className="space-y-2">
                  {lesson.structuredContent.keyTakeaways.map((takeaway, tkIdx) => (
                    <li
                      key={tkIdx}
                      className="flex items-start gap-2.5 text-xs text-zinc-200 leading-relaxed"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Transparent Pedagogical Origin Badges */}
            <div className="p-4 rounded-xl bg-[#0e0f12] border border-[#1f2027] text-xs space-y-2">
              <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Source Attribution & Grounding
              </div>
              {lesson.structuredContent?.fromMaterialNotes && (
                <div className="flex items-start gap-2 text-zinc-300">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 shrink-0">
                    From Material
                  </span>
                  <span>{lesson.structuredContent.fromMaterialNotes}</span>
                </div>
              )}
              {lesson.structuredContent?.aiExplanations && (
                <div className="flex items-start gap-2 text-zinc-300">
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40 shrink-0">
                    AI Clarification
                  </span>
                  <span>{lesson.structuredContent.aiExplanations}</span>
                </div>
              )}
            </div>
          </article>
        ) : (
          /* Tab 2: UNTOUCHED ORIGINAL MATERIAL */
          <div className="p-6 rounded-2xl bg-[#131418] border border-[#23252e] space-y-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#20222a]">
              <div>
                <h3 className="text-sm font-semibold text-white">Original Raw Material</h3>
                <p className="text-xs text-zinc-400">
                  Imported on{' '}
                  {new Date(lesson.originalMaterial?.uploadedAt || lesson.createdAt).toLocaleDateString()}{' '}
                  • Source: {lesson.originalMaterial?.sourceTitle || 'Knowledge Dump'}
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 uppercase">
                {lesson.originalMaterial?.type || 'Text'}
              </span>
            </div>

            {/* If image material was uploaded */}
            {lesson.originalMaterial?.type === 'image' && (
              <div className="rounded-xl overflow-hidden border border-[#262833] max-w-xl">
                <img
                  src={lesson.originalMaterial.content}
                  alt="Raw uploaded diagram"
                  className="w-full h-auto object-contain max-h-96"
                />
              </div>
            )}

            {/* Raw Text display */}
            <div className="p-4 rounded-xl bg-[#090a0d] border border-[#1b1c22] font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {lesson.originalMaterial?.content || 'No text content available'}
            </div>
          </div>
        )}
      </div>

      {/* AI Tutor Slide-Over Drawer */}
      {showTutor && (
        <aside className="fixed bottom-0 right-0 sm:top-14 sm:bottom-0 w-full sm:w-96 bg-[#131418] border-t sm:border-t-0 sm:border-l border-[#272932] shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-200 h-[75vh] sm:h-auto">
          {/* Tutor Header */}
          <div className="p-4 border-b border-[#20222a] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">Lesson Tutor</h3>
                <p className="text-[10px] text-zinc-400">Grounded strictly in this lesson's material</p>
              </div>
            </div>
            <button
              onClick={() => setShowTutor(false)}
              className="p-1 text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Question Prompts */}
          <div className="p-3 bg-[#0c0d10] border-b border-[#1e2026] flex gap-1.5 overflow-x-auto">
            <button
              onClick={() => handleAskTutor('Explain this in simpler language with an analogy')}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded bg-[#181920] hover:bg-[#20222a] text-zinc-300 border border-[#272935] cursor-pointer"
            >
              Simpler explanation
            </button>
            <button
              onClick={() => handleAskTutor('What are the most common mistakes beginners make here?')}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded bg-[#181920] hover:bg-[#20222a] text-zinc-300 border border-[#272935] cursor-pointer"
            >
              Common mistakes
            </button>
            <button
              onClick={() => handleAskTutor('Give me another practical scenario')}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded bg-[#181920] hover:bg-[#20222a] text-zinc-300 border border-[#272935] cursor-pointer"
            >
              Extra example
            </button>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {tutorMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-[#1a1b22] border border-[#282a35] text-zinc-200 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isTutorThinking && (
              <div className="flex items-center gap-2 text-xs text-indigo-400 p-2 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Thinking using your lesson material...</span>
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="p-3 border-t border-[#20222a] bg-[#111216]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskTutor();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about this lesson..."
                value={tutorQuery}
                onChange={(e) => setTutorQuery(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0a0b0e] border border-[#252732] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!tutorQuery.trim() || isTutorThinking}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </aside>
      )}

      {/* Quiz Modal */}
      {showQuizModal && (
        <QuizModal
          isOpen={showQuizModal}
          onClose={() => setShowQuizModal(false)}
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          questions={lesson.structuredContent?.reviewQuestions || []}
          onQuizCompleted={(score, total) => {
            const updated = { ...lesson, quizScore: Math.round((score / total) * 100) };
            onLessonUpdated(updated);
          }}
        />
      )}
    </div>
  );
};
