import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Brain,
  Clock,
  RotateCcw,
  Trash2,
  Shuffle,
  FileText,
  UploadCloud,
  Image as ImageIcon,
  Mic,
  MicOff,
  Pause,
  Play,
  Bookmark,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { NokiaLoader } from './NokiaLoader';
import { TopicDiscoveryInput } from './TopicDiscoveryInput';
import { Course, SubtopicItem, DepthOption, PlannedModule, GeneratedCoursePlan, OriginalMaterial } from '../types';

interface OnboardingModalProps {
  userName?: string;
  onCompleteCourse: (course: Course, firstLessonId?: string) => void;
  onDismiss: () => void;
  initialTopic?: string;
}

interface StarterTopic {
  id: string;
  name: string;
  category: 'Creative' | 'Practical' | 'Academic' | 'Everyday' | 'Professional' | 'Technical' | 'Advanced';
}

const STARTER_TOPIC_LIBRARY: StarterTopic[] = [
  // Creative
  { id: 'graphic-design', name: 'Graphic Design', category: 'Creative' },
  { id: 'photography', name: 'Photography', category: 'Creative' },
  { id: 'creative-writing', name: 'Creative Writing', category: 'Creative' },
  { id: 'music-theory', name: 'Music Theory', category: 'Creative' },
  { id: 'architecture', name: 'Architecture', category: 'Creative' },

  // Practical & Everyday
  { id: 'cooking', name: 'Cooking & Culinary Arts', category: 'Everyday' },
  { id: 'personal-finance', name: 'Personal Finance', category: 'Practical' },
  { id: 'public-speaking', name: 'Public Speaking', category: 'Practical' },
  { id: 'communication', name: 'Interpersonal Communication', category: 'Practical' },
  { id: 'languages', name: 'Language Acquisition', category: 'Everyday' },

  // Professional
  { id: 'entrepreneurship', name: 'Entrepreneurship', category: 'Professional' },
  { id: 'economics', name: 'Economics', category: 'Professional' },
  { id: 'market-structure', name: 'Market Structure & Trading', category: 'Professional' },

  // Academic
  { id: 'psychology', name: 'Psychology', category: 'Academic' },
  { id: 'world-history', name: 'World History', category: 'Academic' },
  { id: 'geography', name: 'Human Geography', category: 'Academic' },
  { id: 'biology', name: 'Cell Biology', category: 'Academic' },
  { id: 'physics', name: 'Classical Physics', category: 'Academic' },
  { id: 'mathematics', name: 'Mathematics & Calculus', category: 'Academic' },
  { id: 'astronomy', name: 'Astronomy & Cosmology', category: 'Academic' },

  // Technical & Advanced
  { id: 'programming', name: 'Programming Fundamentals', category: 'Technical' },
  { id: 'web-dev', name: 'Web Development', category: 'Technical' },
  { id: 'cognitive-science', name: 'Cognitive Science', category: 'Advanced' },
  { id: 'aerodynamics', name: 'Aerodynamics', category: 'Advanced' },
  { id: 'quantum-computing', name: 'Quantum Computing', category: 'Advanced' },
  { id: 'robotics', name: 'Robotics & Control Systems', category: 'Advanced' },
];

interface DepthConfigItem {
  id: DepthOption;
  label: string;
  badge: string;
  description: string;
  features: string[];
}

const DEPTH_CONFIGS: DepthConfigItem[] = [
  {
    id: 'quick',
    label: 'Quick Course',
    badge: 'Fast & High-Yield',
    description: 'Essential principles, core terminology, basic illustrative examples, and key takeaways.',
    features: ['3–5 core lessons', 'Fundamental vocabulary', 'Primary mental models', 'Quick review quizzes'],
  },
  {
    id: 'standard',
    label: 'Standard Course',
    badge: 'Balanced & Practical',
    description: 'Complete exploration with subtopics, practical examples, important distinctions, and practice quizzes.',
    features: ['6–8 structured lessons', 'Clear conceptual distinctions', 'Practical real-world scenarios', 'Targeted recall quizzes'],
  },
  {
    id: 'deep',
    label: 'Deep Study',
    badge: 'Comprehensive Mastery',
    description: 'Deeper concepts, nuanced relationships, real-world case studies, review quizzes, and high retention.',
    features: ['10–14 in-depth lessons', 'Complex interplay & edge cases', 'End-to-end practical frameworks', 'Rigorous retention assessments'],
  },
];

const DAILY_TIME_OPTIONS = [
  { label: '15m daily', minutes: 15, desc: 'Bite-sized daily consistency (15 minutes/day)' },
  { label: '20m daily', minutes: 20, desc: 'Quick focused session (20 minutes/day)' },
  { label: '30m daily', minutes: 30, desc: 'Balanced, steady progress (30 minutes/day - Recommended)' },
  { label: '60m daily', minutes: 60, desc: 'Deep immersion & accelerated pace (60 minutes/day)' },
];

type MaterialInputTab = 'paste' | 'document' | 'image' | 'audio';

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  userName,
  onCompleteCourse,
  onDismiss,
  initialTopic,
}) => {
  // Wizard steps:
  // 1: Welcome (optional intro)
  // 2: Choose Topic (26+ compact chips)
  // 'custom_material': Create your own topic with immediate material capture
  // 3: Subtopics (AI Discovery)
  // 4: Depth Selection
  // 5: Daily Target
  // 6: Plan Review & Confirmation
  const [step, setStep] = useState<number | 'custom_material'>(initialTopic ? 4 : 2);

  // Dynamic Starter Topics presentation
  const [starterTopics, setStarterTopics] = useState<StarterTopic[]>(() => {
    // Light initial dynamic ordering
    return [...STARTER_TOPIC_LIBRARY].sort(() => Math.random() - 0.5);
  });
  const [topicFilter, setTopicFilter] = useState<string>('All');
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic || 'Psychology');

  // Custom Topic & Material Capture State
  const [customTopicTitle, setCustomTopicTitle] = useState<string>('');
  const [customTopicDesc, setCustomTopicDesc] = useState<string>('');
  const [materialTab, setMaterialTab] = useState<MaterialInputTab>('paste');
  const [rawText, setRawText] = useState<string>('');
  const [extractedDocMeta, setExtractedDocMeta] = useState<{ fileName: string; wordCount?: number } | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');

  // Audio Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Refs for file uploads
  const docInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Loading & Execution States
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [isProcessingMaterial, setIsProcessingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);

  // Subtopics state (Preserved Wizard)
  const [isLoadingSubtopics, setIsLoadingSubtopics] = useState<boolean>(false);
  const [subtopics, setSubtopics] = useState<SubtopicItem[]>([]);
  const [selectedSubtopicTitles, setSelectedSubtopicTitles] = useState<string[]>([]);
  const [newSubtopicInput, setNewSubtopicInput] = useState<string>('');

  // Depth & Time
  const [selectedDepth, setSelectedDepth] = useState<DepthOption>('standard');
  const [selectedTimeOption, setSelectedTimeOption] = useState(DAILY_TIME_OPTIONS[1]);

  // Course Plan state (Preserved Wizard)
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [coursePlan, setCoursePlan] = useState<GeneratedCoursePlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState<boolean>(false);

  // Plan Edit States
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedPlanTitle, setEditedPlanTitle] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [showAddLesson, setShowAddLesson] = useState(false);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Pre-fill target topic and guide through depth & daily time check if initialTopic is passed
  useEffect(() => {
    if (initialTopic) {
      setSelectedTopic(initialTopic);
      setStep(4);
      // Pre-fetch subtopics in background so they are ready if user navigates back or generates plan
      api.discoverSubtopics(initialTopic).then((res) => {
        if (res?.subtopics) {
          setSubtopics(res.subtopics);
          setSelectedSubtopicTitles(res.subtopics.map((s: any) => s.title));
        }
      }).catch(() => {});
    }
  }, [initialTopic]);

  // Shuffle dynamic topics
  const handleShuffleTopics = () => {
    setStarterTopics([...STARTER_TOPIC_LIBRARY].sort(() => Math.random() - 0.5));
  };

  // Filtered topics
  const displayedTopics = starterTopics.filter((t) => {
    if (topicFilter === 'All') return true;
    if (topicFilter === 'Creative') return t.category === 'Creative';
    if (topicFilter === 'Practical') return t.category === 'Practical' || t.category === 'Everyday';
    if (topicFilter === 'Academic') return t.category === 'Academic';
    if (topicFilter === 'Technical') return t.category === 'Technical' || t.category === 'Advanced';
    return true;
  });

  // Handle Preset Topic Selection
  const handleSelectTopic = (topicName: string) => {
    setSelectedTopic(topicName);
  };

  const [isGeneratingDirect, setIsGeneratingDirect] = useState(false);
  const [directTopicName, setDirectTopicName] = useState<string | null>(null);

  // Direct One-Tap Course Generation from semantic topic chip
  const handleOneTapGenerateCourse = async (topicTitle: string) => {
    setSelectedTopic(topicTitle);
    setIsGeneratingDirect(true);
    setDirectTopicName(topicTitle);

    try {
      // 1. Generate multi-day plan
      const planRes = await api.generateCoursePlan({
        topic: topicTitle,
        subtopics: [],
        depth: selectedDepth,
        dailyMinutes: selectedTimeOption.minutes,
        dailyMinutesRange: selectedTimeOption.label,
      });

      // 2. Author Lesson 1 and create course
      const createRes = await api.createCourseFromPlan({
        title: planRes.plan.title,
        description: planRes.plan.description,
        category: planRes.plan.category,
        depth: planRes.plan.depth,
        dailyMinutesRange: planRes.plan.dailyMinutesRange,
        dailyMinutes: planRes.plan.dailyMinutes,
        estimatedDays: planRes.plan.estimatedDays,
        days: planRes.plan.days,
        modules: planRes.plan.modules,
        finalExam: planRes.plan.finalExam,
      });

      onCompleteCourse(createRes.course, createRes.firstLessonId);
    } catch (err: any) {
      console.error('One-tap course generation error:', err);
      // Fallback: Proceed into standard discovery
      setSelectedTopic(topicTitle);
      handleProceedToSubtopics(topicTitle);
    } finally {
      setIsGeneratingDirect(false);
      setDirectTopicName(null);
    }
  };

  // Proceed with Wizard from Preset Topic
  const handleProceedToSubtopics = async (overrideTopic?: string) => {
    const topicToUse = overrideTopic || selectedTopic;
    setSelectedTopic(topicToUse);
    setStep(3);
    setIsLoadingSubtopics(true);
    try {
      const res = await api.discoverSubtopics(topicToUse);
      setSubtopics(res.subtopics || []);
      setSelectedSubtopicTitles((res.subtopics || []).map((s: any) => s.title));
    } catch (err) {
      console.error('Subtopic discovery failed:', err);
    } finally {
      setIsLoadingSubtopics(false);
    }
  };

  // Subtopic toggle handlers
  const toggleSubtopic = (title: string) => {
    if (selectedSubtopicTitles.includes(title)) {
      if (selectedSubtopicTitles.length === 1) return;
      setSelectedSubtopicTitles(selectedSubtopicTitles.filter((t) => t !== title));
    } else {
      setSelectedSubtopicTitles([...selectedSubtopicTitles, title]);
    }
  };

  const handleAddCustomSubtopic = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSubtopicInput.trim();
    if (clean && !selectedSubtopicTitles.includes(clean)) {
      const newSub: SubtopicItem = {
        id: `custom_${Date.now()}`,
        title: clean,
        description: 'Learner-specified focus topic.',
      };
      setSubtopics([...subtopics, newSub]);
      setSelectedSubtopicTitles([...selectedSubtopicTitles, clean]);
      setNewSubtopicInput('');
    }
  };

  const handleRemoveSubtopic = (id: string, title: string) => {
    setSubtopics(subtopics.filter((s) => s.id !== id));
    setSelectedSubtopicTitles(selectedSubtopicTitles.filter((t) => t !== title));
  };

  // Generate Plan (Wizard Step 6)
  const handleGeneratePlan = async () => {
    setStep(6);
    setIsLoadingPlan(true);
    setPlanError(null);

    try {
      const res = await api.generateCoursePlan({
        topic: selectedTopic,
        subtopics: selectedSubtopicTitles,
        depth: selectedDepth,
        dailyMinutes: selectedTimeOption.minutes,
        dailyMinutesRange: selectedTimeOption.label,
      });

      setCoursePlan(res.plan);
      setEditedPlanTitle(res.plan.title);
    } catch (err: any) {
      console.error('Plan generation failed:', err);
      setPlanError('Could not generate plan automatically. We created a solid baseline for you.');
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // Confirm and Start Course from Wizard Plan
  const handleConfirmAndStart = async () => {
    if (!coursePlan) return;
    setIsCreatingCourse(true);

    try {
      const res = await api.createCourseFromPlan({
        title: editedPlanTitle || coursePlan.title,
        description: coursePlan.description,
        category: coursePlan.category,
        depth: coursePlan.depth,
        dailyMinutesRange: coursePlan.dailyMinutesRange,
        dailyMinutes: coursePlan.dailyMinutes,
        estimatedDays: coursePlan.estimatedDays,
        days: coursePlan.days,
        modules: coursePlan.modules,
        finalExam: coursePlan.finalExam,
      });

      onCompleteCourse(res.course, res.firstLessonId);
    } catch (err: any) {
      console.error('Failed to create course:', err);
      setIsCreatingCourse(false);
    }
  };

  // Document File Extraction Handler
  const handleDocFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!customTopicTitle) {
      setCustomTopicTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    setMaterialError(null);

    if (ext === 'pdf' || ext === 'docx') {
      setIsExtractingDoc(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await api.extractDocument(base64, file.name, file.type);
          setRawText(res.extracted.text);
          setExtractedDocMeta({
            fileName: file.name,
            wordCount: res.extracted.wordCount,
          });
        } catch (err: any) {
          setMaterialError(err.message || 'Failed to extract text from document.');
        } finally {
          setIsExtractingDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string) || '';
        setRawText(text);
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        setExtractedDocMeta({
          fileName: file.name,
          wordCount,
        });
      };
      reader.readAsText(file);
    }
  };

  // Image Upload Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFileName(file.name);
    if (!customTopicTitle) {
      setCustomTopicTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Generate placeholder transcript note
        if (!rawText.trim()) {
          setRawText(`[Voice Recording Audio Note: ${Math.round(recordSeconds)} seconds of captured material]`);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(500);
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      setMaterialError('Microphone permission denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  // Direct Material Structuring & Course Creation
  const handleProcessMaterialAndStart = async () => {
    const cleanTopic = customTopicTitle.trim();
    if (!cleanTopic) {
      setMaterialError('Please enter a topic title for your course.');
      return;
    }

    const contentToUse = rawText.trim();
    if (materialTab !== 'image' && !contentToUse) {
      setMaterialError('Please provide learning material, paste text, or upload a document.');
      return;
    }

    if (materialTab === 'image' && !imageBase64) {
      setMaterialError('Please upload an image or diagram.');
      return;
    }

    setIsProcessingMaterial(true);
    setMaterialError(null);

    try {
      // 1. Structure the provided material
      const mimeType = imageBase64 ? imageBase64.substring(5, imageBase64.indexOf(';')) : undefined;
      const structRes = await api.structureMaterial({
        rawContent: contentToUse,
        contentType: materialTab === 'image' ? 'image' : materialTab === 'audio' ? 'audio' : 'text',
        courseTitle: cleanTopic,
        customInstructions: customTopicDesc.trim() || undefined,
        imageBase64: imageBase64 || undefined,
        mimeType,
      });

      // 2. Create the course immediately
      const createdCourseRes = await api.createCourse({
        title: cleanTopic,
        description: customTopicDesc.trim() || structRes.structured.overview || `A structured personal course on ${cleanTopic}.`,
        category: 'Personal Knowledge',
        courseType: 'ai-assisted',
        depth: 'standard',
      });

      const newCourse = createdCourseRes.course;

      // 3. Add the structured lesson
      const originalMaterialData: OriginalMaterial = {
        type: materialTab === 'image' ? 'image' : materialTab === 'document' ? 'document' : 'text',
        content: imageBase64 || contentToUse,
        sourceTitle: extractedDocMeta?.fileName || imageFileName || `${cleanTopic} Source Material`,
        uploadedAt: new Date().toISOString(),
      };

      const addedLessonRes = await api.createLesson(newCourse.id, {
        title: structRes.structured.title || `Lesson 1: Foundations of ${cleanTopic}`,
        originalMaterial: originalMaterialData,
        structuredContent: structRes.structured,
      });

      // 4. Launch immediately into course
      onCompleteCourse(newCourse, addedLessonRes.lesson.id);
    } catch (err: any) {
      console.error('Material course creation failed:', err);
      setMaterialError(err.message || 'Failed to process material into a course. Please check your text.');
      setIsProcessingMaterial(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#07132b]/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-8 text-white my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-xl text-[#9bb1d6] hover:text-white hover:bg-[#1a366f]/50 transition-colors z-20 cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Subtle Brand Watermark */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#00B4FF]/10 rounded-full blur-3xl pointer-events-none" />

        {/* ============================================================ */}
        {/* STEP 1: WELCOME SCREEN (Optional Intro) */}
        {/* ============================================================ */}
        {step === 1 && (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF] shadow-inner">
              <Brain className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-mono tracking-widest text-[#00B4FF] uppercase font-semibold">
                Mindly
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Welcome to Mindly
              </h1>
              <p className="text-sm sm:text-base text-[#9bb1d6] max-w-md mx-auto leading-relaxed">
                Turn the things you discover into knowledge you can actually understand and remember.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-sm hover:bg-[#009de0] transition-colors shadow-lg shadow-[#00B4FF]/20 cursor-pointer"
              >
                <span>Start Learning</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: CHOOSE TOPIC — COMPACT CHIPS & DYNAMIC SELECTION */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-wider font-semibold">
                Topic Discovery &bull; 26+ Subjects
              </span>
              <button
                type="button"
                onClick={handleShuffleTopics}
                className="inline-flex items-center gap-1.5 text-xs text-[#9bb1d6] hover:text-[#00B4FF] transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle</span>
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                What do you want to learn?
              </h2>
              <p className="text-xs text-[#9bb1d6]">
                Type any topic for instant AI suggestions, or select a subject chip below.
              </p>
            </div>

            {/* Dynamic Semantic Topic Discovery Input ("Instant Course Suggestions") */}
            <TopicDiscoveryInput
              placeholder='Search or type any topic (e.g. "singing", "crankshaft", "game theory")...'
              onSelectTopic={(top) => setSelectedTopic(top)}
              onDirectGenerateCourse={(top) => handleOneTapGenerateCourse(top)}
              isGenerating={isGeneratingDirect}
              generatingTopic={directTopicName}
            />

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {['All', 'Creative', 'Practical', 'Academic', 'Technical'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTopicFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    topicFilter === cat
                      ? 'bg-[#00B4FF]/20 text-[#00B4FF] border border-[#00B4FF]/40'
                      : 'bg-[#07132b] text-[#9bb1d6] hover:text-white border border-[#1a366f]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Compact Topic Chips Container (Horizontally Scrollable on Mobile) */}
            <div className="p-3 rounded-2xl bg-[#07132b] border border-[#1a366f] space-y-2">
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto sm:overflow-y-visible pr-1 sm:pr-0">
                {displayedTopics.map((topic) => {
                  const isSelected = selectedTopic === topic.name;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => handleSelectTopic(topic.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#00B4FF] text-[#0B1F44] font-bold shadow-md shadow-[#00B4FF]/20 scale-102'
                          : 'bg-[#0B1F44] border border-[#1a366f] text-[#9bb1d6] hover:border-[#00B4FF]/50 hover:text-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{topic.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Topic Confirmation Badge */}
              <div className="pt-2 border-t border-[#1a366f]/60 flex items-center justify-between text-xs">
                <span className="text-[#9bb1d6]">
                  Selected: <strong className="text-white">{selectedTopic}</strong>
                </span>
                <span className="text-[11px] font-mono text-[#00B4FF]">AI Plan Ready</span>
              </div>
            </div>

            {/* "Create Your Own Topic" Action (Switches to Direct Material Capture) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setCustomTopicTitle(selectedTopic || '');
                  setStep('custom_material');
                }}
                className="w-full p-3.5 rounded-xl border border-dashed border-[#00B4FF]/40 bg-[#00B4FF]/5 hover:bg-[#009de0]/10 text-left transition-colors flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#00B4FF]/20 text-[#00B4FF] flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-[#00B4FF] transition-colors">
                      + Create your own topic with custom material
                    </p>
                    <p className="text-[11px] text-[#9bb1d6]">
                      Paste text, upload notes, PDF, or audio to start immediately
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#00B4FF] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1a366f]">
              <button
                type="button"
                onClick={onDismiss}
                className="text-xs text-[#9bb1d6] hover:text-white cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleProceedToSubtopics()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors shadow-lg shadow-[#00B4FF]/20 cursor-pointer"
              >
                <span>Continue: Subtopic Discovery</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP: 'custom_material' — DIRECT MATERIAL CAPTURE FLOW */}
        {/* ============================================================ */}
        {step === 'custom_material' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-wider font-semibold">
                Direct Capture &bull; Instant Course
              </span>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 text-xs text-[#9bb1d6] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to Topics</span>
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Create Your Own Topic
              </h2>
              <p className="text-xs text-[#9bb1d6]">
                Provide your learning material below. Mindly will immediately extract core mental models and launch your course.
              </p>
            </div>

            {/* Error Message */}
            {materialError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {materialError}
              </div>
            )}

            {/* Topic Name & Optional Description */}
            <div className="space-y-3 p-3.5 rounded-xl bg-[#07132b] border border-[#1a366f]">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">
                  Topic Name <span className="text-[#00B4FF]">*</span>
                </label>
                <input
                  type="text"
                  value={customTopicTitle}
                  onChange={(e) => setCustomTopicTitle(e.target.value)}
                  placeholder="e.g. Behavioral Economics, Quantum Mechanics, Photography Lighting..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0B1F44] border border-[#1a366f] text-xs text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9bb1d6] mb-1">
                  Learning Goal / Description <span className="text-[10px] text-[#627ca8]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={customTopicDesc}
                  onChange={(e) => setCustomTopicDesc(e.target.value)}
                  placeholder="e.g. Master core principles and pass upcoming technical exam"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0B1F44] border border-[#1a366f] text-xs text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>
            </div>

            {/* Material Capture Tabs */}
            <div className="space-y-3">
              <div className="flex border-b border-[#1a366f]">
                <button
                  type="button"
                  onClick={() => setMaterialTab('paste')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                    materialTab === 'paste'
                      ? 'border-[#00B4FF] text-[#00B4FF]'
                      : 'border-transparent text-[#9bb1d6] hover:text-white'
                  }`}
                >
                  Paste Text
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialTab('document')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                    materialTab === 'document'
                      ? 'border-[#00B4FF] text-[#00B4FF]'
                      : 'border-transparent text-[#9bb1d6] hover:text-white'
                  }`}
                >
                  Document (PDF, DOCX, TXT)
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialTab('image')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                    materialTab === 'image'
                      ? 'border-[#00B4FF] text-[#00B4FF]'
                      : 'border-transparent text-[#9bb1d6] hover:text-white'
                  }`}
                >
                  Image / Diagram
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialTab('audio')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                    materialTab === 'audio'
                      ? 'border-[#00B4FF] text-[#00B4FF]'
                      : 'border-transparent text-[#9bb1d6] hover:text-white'
                  }`}
                >
                  Voice / Audio
                </button>
              </div>

              {/* TAB 1: PASTE TEXT */}
              {materialTab === 'paste' && (
                <div className="space-y-1.5">
                  <textarea
                    rows={5}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste notes, article excerpts, chapter summaries, or bullet points here..."
                    className="w-full p-3 rounded-xl bg-[#07132b] border border-[#1a366f] text-xs text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF] leading-relaxed resize-none"
                  />
                  <div className="flex justify-between text-[11px] text-[#627ca8] px-1">
                    <span>Mindly extracts core thesis & distinctions</span>
                    <span>{rawText.trim().split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </div>
              )}

              {/* TAB 2: DOCUMENT UPLOAD */}
              {materialTab === 'document' && (
                <div className="space-y-3">
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className="hidden"
                    onChange={handleDocFileUpload}
                  />
                  <div
                    onClick={() => docInputRef.current?.click()}
                    className="p-6 rounded-xl border-2 border-dashed border-[#1a366f] hover:border-[#00B4FF] bg-[#07132b] text-center cursor-pointer transition-colors space-y-2"
                  >
                    <UploadCloud className="w-8 h-8 text-[#00B4FF] mx-auto" />
                    <p className="text-xs font-semibold text-white">
                      Click to upload PDF, DOCX, TXT, or Markdown
                    </p>
                    <p className="text-[11px] text-[#9bb1d6]">
                      Mindly extracts clean text while discarding formatting noise
                    </p>
                  </div>

                  {isExtractingDoc && (
                    <div className="py-2 flex justify-center">
                      <NokiaLoader label="Extracting text from document with Gemini..." size="sm" />
                    </div>
                  )}

                  {extractedDocMeta && !isExtractingDoc && (
                    <div className="p-3 rounded-xl bg-[#0B1F44] border border-[#00B4FF]/40 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#00B4FF]" />
                        <span className="font-semibold text-white">{extractedDocMeta.fileName}</span>
                      </div>
                      <span className="text-[11px] text-[#9bb1d6]">
                        {extractedDocMeta.wordCount} words extracted
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: IMAGE / DIAGRAM */}
              {materialTab === 'image' && (
                <div className="space-y-3">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className="p-6 rounded-xl border-2 border-dashed border-[#1a366f] hover:border-[#00B4FF] bg-[#07132b] text-center cursor-pointer transition-colors space-y-2"
                  >
                    <ImageIcon className="w-8 h-8 text-[#00B4FF] mx-auto" />
                    <p className="text-xs font-semibold text-white">Upload diagram, slide, or chalkboard image</p>
                    <p className="text-[11px] text-[#9bb1d6]">Supports PNG, JPG, WebP</p>
                  </div>

                  {imageBase64 && (
                    <div className="p-3 rounded-xl bg-[#07132b] border border-[#00B4FF]/40 flex items-center gap-3">
                      <img src={imageBase64} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-[#1a366f]" />
                      <div className="text-xs">
                        <p className="font-semibold text-white">{imageFileName || 'Uploaded Image'}</p>
                        <p className="text-[11px] text-[#9bb1d6]">Ready for multimodal analysis</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: AUDIO / VOICE */}
              {materialTab === 'audio' && (
                <div className="space-y-3 p-4 rounded-xl bg-[#07132b] border border-[#1a366f] text-center">
                  {!isRecording ? (
                    <div className="space-y-3 py-2">
                      <button
                        type="button"
                        onClick={startRecording}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Record Voice Note</span>
                      </button>
                      <p className="text-[11px] text-[#9bb1d6]">
                        Speak your thoughts, lecture summary, or key takeaways
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 py-2">
                      <div className="inline-flex items-center gap-2 text-rose-400 font-mono text-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        <span>Recording: {recordSeconds}s</span>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Stop & Ingest
                        </button>
                      </div>
                    </div>
                  )}

                  {rawText && (
                    <p className="text-[11px] text-emerald-400 text-left pt-2 border-t border-[#1a366f]">
                      Captured note ready for course generation.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Option to let AI plan if user has no materials */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  if (customTopicTitle.trim()) {
                    handleProceedToSubtopics(customTopicTitle.trim());
                  } else {
                    handleProceedToSubtopics('General Knowledge');
                  }
                }}
                className="text-xs text-[#00B4FF] hover:underline cursor-pointer"
              >
                Don&apos;t have learning material yet? Plan with AI instead &rarr;
              </button>
            </div>

            {/* Processing State */}
            {isProcessingMaterial && (
              <div className="py-4 flex justify-center border-t border-[#1a366f]">
                <NokiaLoader label="Structuring material, extracting key concepts, and architecting course..." />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1a366f]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-[#9bb1d6] hover:text-white cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProcessMaterialAndStart}
                disabled={isProcessingMaterial}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors shadow-lg shadow-[#00B4FF]/25 cursor-pointer disabled:opacity-50"
              >
                <span>Structure Material & Start Learning</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: SUBTOPIC DISCOVERY (Preserved Wizard) */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-wider font-semibold">
                Step 2 of 5 &bull; Subtopics
              </span>
              <span className="text-xs text-[#9bb1d6]">Topic: {selectedTopic}</span>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Discovering Subtopics for &ldquo;{selectedTopic}&rdquo;
              </h2>
              <p className="text-xs text-[#9bb1d6]">
                AI generated these high-yield domains. Choose what you want included, remove what you don&apos;t, or add custom subtopics.
              </p>
            </div>

            {isLoadingSubtopics ? (
              <div className="py-12 flex justify-center">
                <NokiaLoader label="Architecting logical subtopics with Gemini..." />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {subtopics.map((sub) => {
                    const isChecked = selectedSubtopicTitles.includes(sub.title);
                    return (
                      <div
                        key={sub.id}
                        onClick={() => toggleSubtopic(sub.title)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          isChecked
                            ? 'bg-[#00B4FF]/10 border-[#00B4FF] text-white'
                            : 'bg-[#07132b] border-[#1a366f] text-[#9bb1d6] hover:border-[#00B4FF]/40'
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-[#00B4FF] border-[#00B4FF] text-[#0B1F44]' : 'border-[#627ca8]'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold leading-tight">{sub.title}</p>
                          <p className="text-[11px] text-[#9bb1d6] line-clamp-2 leading-relaxed">
                            {sub.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Custom Subtopic Form */}
                <form onSubmit={handleAddCustomSubtopic} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newSubtopicInput}
                    onChange={(e) => setNewSubtopicInput(e.target.value)}
                    placeholder="Add a specific custom subtopic..."
                    className="flex-1 px-3 py-2 rounded-xl bg-[#07132b] border border-[#1a366f] text-xs text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#07132b] border border-[#00B4FF] text-[#00B4FF] hover:bg-[#00B4FF] hover:text-[#0B1F44] transition-colors font-semibold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1a366f]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 text-xs text-[#9bb1d6] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={isLoadingSubtopics || selectedSubtopicTitles.length === 0}
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer disabled:opacity-40"
              >
                <span>Continue: Course Depth</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: COURSE DEPTH (Preserved Wizard) */}
        {/* ============================================================ */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-wider font-semibold">
                Step 3 of 5 &bull; Depth
              </span>
              <span className="text-xs text-[#9bb1d6]">Calibrated Scope</span>
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00B4FF]/15 border border-[#00B4FF]/30 text-[#00B4FF] text-xs font-mono font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Topic: {selectedTopic}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                How deep do you want to study?
              </h2>
              <p className="text-xs text-[#9bb1d6]">
                Choose how rigorous and granular you want this course to be.
              </p>
            </div>

            <div className="space-y-3">
              {DEPTH_CONFIGS.map((cfg) => {
                const isSelected = selectedDepth === cfg.id;
                return (
                  <div
                    key={cfg.id}
                    onClick={() => setSelectedDepth(cfg.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-[#00B4FF]/10 border-[#00B4FF] text-white shadow-sm'
                        : 'bg-[#07132b] border-[#1a366f] text-[#9bb1d6] hover:border-[#00B4FF]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{cfg.label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30">
                          {cfg.badge}
                        </span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-[#00B4FF] bg-[#00B4FF]' : 'border-[#627ca8]'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#0B1F44]" />}
                      </div>
                    </div>

                    <p className="text-xs text-[#9bb1d6] leading-relaxed">
                      {cfg.description}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {cfg.features.map((feat) => (
                        <span key={feat} className="text-[10px] text-[#9bb1d6] bg-[#0B1F44] px-2 py-0.5 rounded border border-[#1a366f]">
                          &bull; {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1a366f]">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 text-xs text-[#9bb1d6] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(5)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer"
              >
                <span>Continue: Daily Capacity</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 5: DAILY STUDY CAPACITY (Preserved Wizard) */}
        {/* ============================================================ */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-wider font-semibold">
                Step 4 of 5 &bull; Daily Target
              </span>
              <span className="text-xs text-[#9bb1d6]">Realistic Duration Calibrator</span>
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00B4FF]/15 border border-[#00B4FF]/30 text-[#00B4FF] text-xs font-mono font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Topic: {selectedTopic} &bull; {selectedDepth.toUpperCase()}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                How much time do you want to spend in a day?
              </h2>
              <p className="text-xs text-[#9bb1d6]">
                Mindly’s Course Duration Engine computes how many days your course will require based on your daily capacity.
              </p>
            </div>

            <div className="space-y-2.5">
              {DAILY_TIME_OPTIONS.map((opt) => {
                const isSelected = selectedTimeOption.label === opt.label;
                return (
                  <div
                    key={opt.label}
                    onClick={() => setSelectedTimeOption(opt)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#00B4FF]/10 border-[#00B4FF] text-white shadow-sm'
                        : 'bg-[#07132b] border-[#1a366f] text-[#9bb1d6] hover:border-[#00B4FF]/50'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${isSelected ? 'text-[#00B4FF]' : 'text-[#627ca8]'}`} />
                        <span className="text-xs font-bold text-white">{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-[#9bb1d6] pl-6">{opt.desc}</p>
                    </div>

                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-[#00B4FF] bg-[#00B4FF]' : 'border-[#627ca8]'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#0B1F44]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1a366f]">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-1.5 text-xs text-[#9bb1d6] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleGeneratePlan}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer"
              >
                <span>Generate Course Plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 6: COURSE PLAN REVIEW & CONFIRM (Preserved Wizard) */}
        {/* ============================================================ */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00B4FF] uppercase tracking-wider font-semibold">
                Step 5 of 5 &bull; Curriculum Review
              </span>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={isLoadingPlan}
                className="inline-flex items-center gap-1 text-xs text-[#00B4FF] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            </div>

            {isLoadingPlan ? (
              <div className="py-16 flex justify-center">
                <NokiaLoader label={`Calibrating modules, learning objectives, and duration math for "${selectedTopic}"...`} />
              </div>
            ) : coursePlan ? (
              <div className="space-y-5">
                {/* Course Metadata Header */}
                <div className="p-4 rounded-xl bg-[#07132b] border border-[#1a366f] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {!isEditingTitle ? (
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-white tracking-tight">
                            {editedPlanTitle || coursePlan.title}
                          </h2>
                          <button
                            type="button"
                            onClick={() => setIsEditingTitle(true)}
                            className="text-[10px] text-[#00B4FF] hover:underline cursor-pointer"
                          >
                            Rename
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editedPlanTitle}
                            onChange={(e) => setEditedPlanTitle(e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded bg-[#0B1F44] border border-[#00B4FF] text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setIsEditingTitle(false)}
                            className="px-2 py-1 rounded bg-[#00B4FF] text-[#0B1F44] text-[10px] font-bold cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-[#9bb1d6] mt-1 leading-relaxed">
                        {coursePlan.description}
                      </p>
                    </div>
                  </div>

                  {/* Badges Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#1a366f]/50">
                    <span className="text-[11px] px-2.5 py-0.5 rounded font-mono bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 font-semibold uppercase">
                      {coursePlan.depth} course
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded bg-[#0f2756] text-white font-medium">
                      {coursePlan.dailyMinutesRange}
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded bg-[#0f2756] text-[#00B4FF] font-bold">
                      {coursePlan.durationLabel}
                    </span>
                    <span className="text-[11px] text-[#9bb1d6]">
                      &bull; {coursePlan.modules.length} Lessons
                    </span>
                  </div>

                  {coursePlan.phaseNotice && (
                    <div className="p-2.5 rounded-lg bg-[#0f2756] border border-[#00B4FF]/40 text-[11px] text-[#9bb1d6]">
                      <strong className="text-white">Notice: </strong>
                      {coursePlan.phaseNotice}
                    </div>
                  )}
                </div>

                {/* Modules & Lessons List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white uppercase tracking-wider text-[11px]">
                      Curriculum Modules ({coursePlan.modules.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddLesson(true)}
                      className="text-xs text-[#00B4FF] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Lesson</span>
                    </button>
                  </div>

                  {showAddLesson && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!coursePlan || !newLessonTitle.trim()) return;
                        const newMod: PlannedModule = {
                          id: `mod_${Date.now()}`,
                          title: newLessonTitle.trim(),
                          overview: `Custom module on ${newLessonTitle.trim()} within ${selectedTopic}.`,
                          learningObjectives: [
                            `Understand key terms and core mechanics for ${newLessonTitle.trim()}`,
                            `Apply concepts to practical scenarios`,
                          ],
                          keyTopics: [newLessonTitle.trim(), 'Practical Mechanics', 'Key Review'],
                          estimatedMinutes: selectedDepth === 'quick' ? 20 : selectedDepth === 'standard' ? 35 : 50,
                        };
                        setCoursePlan({
                          ...coursePlan,
                          modules: [...coursePlan.modules, newMod],
                        });
                        setNewLessonTitle('');
                        setShowAddLesson(false);
                      }}
                      className="flex gap-2 p-3 rounded-xl bg-[#07132b] border border-[#00B4FF]"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={newLessonTitle}
                        onChange={(e) => setNewLessonTitle(e.target.value)}
                        placeholder="Enter new lesson title..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#0B1F44] border border-[#1a366f] text-xs text-white focus:outline-none focus:border-[#00B4FF]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-[#00B4FF] text-[#0B1F44] text-xs font-bold cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddLesson(false)}
                        className="px-2 py-1.5 text-xs text-[#9bb1d6] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </form>
                  )}

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {coursePlan.days && coursePlan.days.length > 0 ? (
                      coursePlan.days.map((day, dIdx) => (
                        <div
                          key={day.dayNumber || dIdx}
                          className="rounded-xl bg-[#07132b] border border-[#1a366f] overflow-hidden"
                        >
                          <div className="p-3 bg-[#0B1F44] border-b border-[#1a366f] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/15 text-[#00B4FF] font-bold">
                                Day {day.dayNumber}
                              </span>
                              <span className="text-xs font-bold text-white">{day.title}</span>
                            </div>
                            <span className="text-[10px] text-[#9bb1d6] font-mono">
                              ~{day.estimatedMinutes} min &bull; {day.modules.length} lessons
                            </span>
                          </div>

                          <div className="p-2 space-y-1.5">
                            {day.modules.map((mod, mIdx) => (
                              <div
                                key={mod.id || mIdx}
                                className="p-2.5 rounded-lg bg-[#081734] border border-[#142954] flex items-start justify-between gap-3 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-zinc-100">{mod.title}</span>
                                    <span className="text-[10px] text-[#627ca8]">~{mod.estimatedMinutes} min</span>
                                  </div>
                                  <p className="text-[11px] text-[#9bb1d6] leading-relaxed line-clamp-1">
                                    {mod.overview}
                                  </p>
                                </div>
                              </div>
                            ))}

                            {/* End of Day Milestone Gate */}
                            <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-between text-[11px] text-indigo-300">
                              <span className="font-medium">
                                🏁 End-of-Day Milestone Gate: Daily Check-in Quiz
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-200">
                                {day.checkInQuiz?.length || 3} Questions
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      coursePlan.modules.map((mod, idx) => (
                        <div
                          key={mod.id || idx}
                          className="p-3 rounded-xl bg-[#07132b] border border-[#1a366f] flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-[#00B4FF]">
                                L{idx + 1}
                              </span>
                              <span className="font-semibold text-white">{mod.title}</span>
                              <span className="text-[10px] text-[#627ca8]">
                                ~{mod.estimatedMinutes} min
                              </span>
                            </div>
                            <p className="text-[11px] text-[#9bb1d6] leading-relaxed">
                              {mod.overview}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (!coursePlan || coursePlan.modules.length <= 1) return;
                              setCoursePlan({
                                ...coursePlan,
                                modules: coursePlan.modules.filter((m) => m.id !== mod.id),
                              });
                            }}
                            className="text-[#627ca8] hover:text-rose-400 p-1 shrink-0 transition-colors cursor-pointer"
                            title="Remove lesson"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}

                    {/* Comprehensive Final Exam notice */}
                    {coursePlan.finalExam && coursePlan.finalExam.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/40 flex items-center justify-between text-xs text-amber-200">
                        <span className="font-semibold">
                          🎓 Graduation Gate: Comprehensive Final Exam (Exclusively at End of Final Day)
                        </span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-900/50 text-amber-300">
                          {coursePlan.finalExam.length} Questions
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Final CTA */}
                <div className="flex items-center justify-between pt-4 border-t border-[#1a366f]">
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#9bb1d6] hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmAndStart}
                    disabled={isCreatingCourse}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors shadow-lg shadow-[#00B4FF]/25 cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingCourse ? (
                      <NokiaLoader label="Initializing Course & Lesson 1..." size="sm" color="#0B1F44" />
                    ) : (
                      <>
                        <span>Start Learning</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-rose-300">
                {planError || 'Could not load course plan.'}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
