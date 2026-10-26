import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  Edit3,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  Trash2,
  BookOpen,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Check,
  Bookmark,
  StickyNote,
  Radio,
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, StructuredContent, OriginalMaterial, Note } from '../types';

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  initialCourseId?: string;
  onLessonSaved: (courseId: string, lessonId: string) => void;
  onCourseCreated?: (newCourse: Course) => void;
  onNoteCreated?: (note: Note) => void;
}

type MaterialInputType = 'paste' | 'document' | 'image' | 'audio';
type CaptureDestination = 'existing_course' | 'new_course' | 'standalone_note';
type AudioMode = 'capture_lesson' | 'voice_note';

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
  isOpen,
  onClose,
  courses,
  initialCourseId,
  onLessonSaved,
  onCourseCreated,
  onNoteCreated,
}) => {
  // Destination
  const [destination, setDestination] = useState<CaptureDestination>(
    courses.length > 0 ? 'existing_course' : 'new_course'
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourseId || (courses.length > 0 ? courses[0].id : '')
  );
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [noteTags, setNoteTags] = useState('raw-capture, voice');

  // Input Type
  const [inputType, setInputType] = useState<MaterialInputType>('paste');

  // Text & Document
  const [rawText, setRawText] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');

  // AI & Workflow states
  const [isStructuring, setIsStructuring] = useState(false);
  const [structuringStage, setStructuringStage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'structured' | 'original'>('structured');
  const [structuredOutput, setStructuredOutput] = useState<StructuredContent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Document ingestion state (PDF, DOCX, TXT)
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [extractedDocMeta, setExtractedDocMeta] = useState<{
    fileName: string;
    pageCount?: number;
    wordCount?: number;
    fileSize?: number;
    isScanned?: boolean;
  } | null>(null);

  // Audio Recording & Transcription
  const [audioMode, setAudioMode] = useState<AudioMode>('capture_lesson');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionDone, setTranscriptionDone] = useState(false);
  const [transcribedWordCount, setTranscribedWordCount] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  if (!isOpen) return null;

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start recording
  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudioBlob(blob);
        setRecordedAudioUrl(URL.createObjectURL(blob));
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(500); // 500ms slices
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      setRecordSeconds(0);
      setTranscriptionDone(false);

      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Audio capture error:', err);
      setErrorMessage(
        'Could not access microphone. Please ensure microphone permissions are granted in your browser.'
      );
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleTranscribeAudio = async () => {
    if (!recordedAudioBlob) return;
    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const mimeType = recordedAudioBlob.type || 'audio/webm';
          const result = await api.transcribeAudio({
            audioBase64: base64Data,
            mimeType,
            mode: audioMode,
            promptHint: sourceTitle || 'Educational lesson audio recording',
          });

          setRawText(result.transcript);
          setTranscribedWordCount(result.wordCount);
          setTranscriptionDone(true);
          if (!sourceTitle) {
            setSourceTitle(
              audioMode === 'voice_note'
                ? `Voice Note (${new Date().toLocaleDateString()})`
                : `Lecture Capture (${new Date().toLocaleDateString()})`
            );
          }

          // If audioMode is capture_lesson, automatically jump to structuring
          if (audioMode === 'capture_lesson') {
            handleStructure(result.transcript);
          }
        } catch (err: any) {
          setErrorMessage(err.message || 'Audio transcription failed.');
        } finally {
          setIsTranscribing(false);
        }
      };
      reader.readAsDataURL(recordedAudioBlob);
    } catch (err: any) {
      setIsTranscribing(false);
      setErrorMessage('Failed to read recorded audio file.');
    }
  };

  // Handle Image Upload
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFileName(file.name);
    if (!sourceTitle) {
      setSourceTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle Document Upload (PDF, DOCX, TXT, MD)
  const handleDocFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!sourceTitle) {
      setSourceTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    setErrorMessage(null);

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
            pageCount: res.extracted.pageCount,
            wordCount: res.extracted.wordCount,
            fileSize: res.extracted.fileSize,
            isScanned: res.extracted.isScanned,
          });
        } catch (err: any) {
          setErrorMessage(err.message || 'Failed to extract text from document.');
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
          fileSize: file.size,
        });
      };
      reader.readAsText(file);
    }
  };

  // Handle AI Structuring Execution
  const handleStructure = async (textOverride?: string) => {
    setErrorMessage(null);
    const contentToUse = textOverride || rawText;

    if (inputType !== 'image' && (!contentToUse || !contentToUse.trim())) {
      setErrorMessage('Please provide text or capture material first.');
      return;
    }

    if (inputType === 'image' && !imageBase64) {
      setErrorMessage('Please upload a diagram or image.');
      return;
    }

    setIsStructuring(true);
    setStructuringStage('Reading raw learning input...');

    try {
      const currentCourse = courses.find((c) => c.id === selectedCourseId);
      const courseTitle = currentCourse ? currentCourse.title : (newCourseTitle || 'General Knowledge');

      setTimeout(() => setStructuringStage('Extracting core concepts and subtopics...'), 600);
      setTimeout(() => setStructuringStage('Separating original quotes from pedagogical explanations...'), 1200);

      const mimeType = imageBase64 ? imageBase64.substring(5, imageBase64.indexOf(';')) : undefined;

      const res = await api.structureMaterial({
        rawContent: contentToUse,
        contentType: inputType === 'image' ? 'image' : inputType === 'audio' ? 'audio' : 'text',
        courseTitle,
        customInstructions,
        imageBase64: imageBase64 || undefined,
        mimeType,
      });

      setStructuredOutput(res.structured);
      if (!sourceTitle && res.structured.title) {
        setSourceTitle(res.structured.title);
      }
    } catch (err: any) {
      console.error('Structuring failed:', err);
      setErrorMessage(err.message || 'Could not structure your learning material. Raw text is safe.');
    } finally {
      setIsStructuring(false);
      setStructuringStage('');
    }
  };

  // Handle Standalone Note Save
  const handleSaveStandaloneNote = async () => {
    if (!rawText.trim()) {
      setErrorMessage('Note content cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const cleanTags = noteTags.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await api.createNote({
        title: sourceTitle.trim() || 'Quick Capture Note',
        content: rawText,
        tags: cleanTags,
        type: 'general',
      });

      if (onNoteCreated) onNoteCreated(res.note);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Lesson Save into Course
  const handleSaveLesson = async () => {
    if (!structuredOutput) return;
    setIsSaving(true);
    setErrorMessage(null);

    let targetCourseId = selectedCourseId;

    try {
      if (destination === 'new_course' || !targetCourseId) {
        if (!newCourseTitle.trim()) {
          setErrorMessage('Please provide a course title.');
          setIsSaving(false);
          return;
        }
        const created = await api.createCourse({
          title: newCourseTitle.trim(),
          category: 'Personal Knowledge',
          courseType: 'ai-assisted',
          depth: 'standard',
        });
        targetCourseId = created.course.id;
        if (onCourseCreated) onCourseCreated(created.course);
      }

      const originalMaterialData: OriginalMaterial = {
        type: inputType === 'image' ? 'image' : inputType === 'document' ? 'document' : 'text',
        content: imageBase64 || rawText,
        sourceTitle: sourceTitle || 'Captured Knowledge',
        uploadedAt: new Date().toISOString(),
        fileName: extractedDocMeta?.fileName || imageFileName || undefined,
        fileType: extractedDocMeta ? extractedDocMeta.fileName.split('.').pop() || 'document' : inputType === 'image' ? 'image' : 'text',
        pageCount: extractedDocMeta?.pageCount,
        wordCount: extractedDocMeta?.wordCount || (rawText ? rawText.split(/\s+/).filter(Boolean).length : 0),
      };

      const res = await api.createLesson(targetCourseId, {
        title: structuredOutput.title || sourceTitle || 'New Lesson',
        originalMaterial: originalMaterialData,
        structuredContent: structuredOutput,
      });

      onLessonSaved(targetCourseId, res.lesson.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save lesson.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#07132b]/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl text-white overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a366f] bg-[#081734]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Capture Hub</h2>
              <p className="text-xs text-[#9bb1d6]">
                Transform raw material into structured lessons, key terms, or permanent notes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#9bb1d6] hover:text-white rounded-lg hover:bg-[#1a366f]/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Destination Selector Bar */}
        <div className="px-6 py-3 bg-[#07132b] border-b border-[#1a366f] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#9bb1d6] font-medium">Destination:</span>
            <div className="inline-flex rounded-lg bg-[#0B1F44] p-0.5 border border-[#1a366f]">
              {courses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDestination('existing_course')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    destination === 'existing_course'
                      ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                      : 'text-[#9bb1d6] hover:text-white'
                  }`}
                >
                  Existing Course
                </button>
              )}
              <button
                type="button"
                onClick={() => setDestination('new_course')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  destination === 'new_course'
                    ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                    : 'text-[#9bb1d6] hover:text-white'
                }`}
              >
                + Create New Course
              </button>
              <button
                type="button"
                onClick={() => setDestination('standalone_note')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  destination === 'standalone_note'
                    ? 'bg-[#00B4FF] text-[#0B1F44] font-bold'
                    : 'text-[#9bb1d6] hover:text-white'
                }`}
              >
                Standalone Note
              </button>
            </div>
          </div>

          {/* Conditional Destination Inputs */}
          {destination === 'existing_course' && (
            <div className="flex items-center gap-2">
              <span className="text-[#9bb1d6]">Select:</span>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-[#0B1F44] border border-[#1a366f] text-xs text-white focus:outline-none focus:border-[#00B4FF]"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {destination === 'new_course' && (
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="New Course Title (e.g. Cognitive Psychology)..."
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                className="flex-1 px-3 py-1 rounded-lg bg-[#0B1F44] border border-[#1a366f] text-xs text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
              />
            </div>
          )}

          {destination === 'standalone_note' && (
            <div className="flex items-center gap-2">
              <span className="text-[#9bb1d6]">Tags:</span>
              <input
                type="text"
                value={noteTags}
                onChange={(e) => setNoteTags(e.target.value)}
                placeholder="comma, separated, tags"
                className="px-2.5 py-1 rounded-lg bg-[#0B1F44] border border-[#1a366f] text-xs text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
              />
            </div>
          )}
        </div>

        {/* Input Format Tabs */}
        <div className="flex border-b border-[#1a366f] bg-[#0B1F44] px-6">
          <button
            type="button"
            onClick={() => setInputType('paste')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              inputType === 'paste'
                ? 'border-[#00B4FF] text-[#00B4FF]'
                : 'border-transparent text-[#9bb1d6] hover:text-white'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Type / Paste</span>
          </button>

          <button
            type="button"
            onClick={() => setInputType('document')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              inputType === 'document'
                ? 'border-[#00B4FF] text-[#00B4FF]'
                : 'border-transparent text-[#9bb1d6] hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload File (PDF / DOCX / TXT)</span>
          </button>

          <button
            type="button"
            onClick={() => setInputType('image')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              inputType === 'image'
                ? 'border-[#00B4FF] text-[#00B4FF]'
                : 'border-transparent text-[#9bb1d6] hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Image / Diagram</span>
          </button>

          <button
            type="button"
            onClick={() => setInputType('audio')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              inputType === 'audio'
                ? 'border-[#00B4FF] text-[#00B4FF]'
                : 'border-transparent text-[#9bb1d6] hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Record Audio</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode 1: TYPE / PASTE */}
          {inputType === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white uppercase tracking-wider mb-1.5">
                  Source Title or Lesson Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Chapter 3: Market Liquidity Principles"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#07132b] border border-[#1a366f] text-xs text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-white uppercase tracking-wider">
                    Raw Material / Transcript / Book Excerpt
                  </label>
                  <span className="text-[11px] text-[#627ca8]">
                    {rawText ? `${rawText.split(/\s+/).filter(Boolean).length} words` : 'Zero data loss'}
                  </span>
                </div>
                <textarea
                  rows={9}
                  placeholder="Paste lecture transcript, video notes, article text, textbook chapter, or messy thoughts..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-[#07132b] border border-[#1a366f] text-xs text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF] leading-relaxed font-mono"
                />
              </div>
            </div>
          )}

          {/* Mode 2: UPLOAD FILE */}
          {inputType === 'document' && (
            <div className="space-y-4">
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleDocFile}
                className="hidden"
              />

              <div
                onClick={() => docInputRef.current?.click()}
                className="p-8 rounded-2xl border-2 border-dashed border-[#1a366f] hover:border-[#00B4FF] bg-[#07132b] text-center cursor-pointer transition-colors space-y-3"
              >
                <UploadCloud className="w-10 h-10 text-[#00B4FF] mx-auto opacity-80" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {extractedDocMeta ? extractedDocMeta.fileName : 'Click to upload learning document'}
                  </p>
                  <p className="text-xs text-[#9bb1d6] mt-1">
                    Supports PDF, DOCX, TXT, and Markdown files.
                  </p>
                </div>
                {isExtractingDoc && (
                  <div className="flex items-center justify-center gap-2 text-xs text-[#00B4FF]">
                    <div className="w-3.5 h-3.5 border-2 border-[#00B4FF] border-t-transparent rounded-full animate-spin" />
                    <span>Extracting document text and metadata...</span>
                  </div>
                )}
              </div>

              {rawText && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#9bb1d6]">
                    <span>Extracted Preview</span>
                    <span>{rawText.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-[#07132b] border border-[#1a366f] text-xs text-white font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* Mode 3: IMAGE / DIAGRAM */}
          {inputType === 'image' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                className="hidden"
              />

              {!imageBase64 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 rounded-2xl border-2 border-dashed border-[#1a366f] hover:border-[#00B4FF] bg-[#07132b] text-center cursor-pointer transition-colors space-y-3"
                >
                  <ImageIcon className="w-10 h-10 text-[#00B4FF] mx-auto opacity-80" />
                  <div>
                    <p className="text-sm font-semibold text-white">Upload Screenshot, Diagram, or Whiteboard Photo</p>
                    <p className="text-xs text-[#9bb1d6] mt-1">
                      Gemini analyzes charts, diagrams, formulas, and handwritten text.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-[#1a366f] bg-[#07132b] max-h-64 flex items-center justify-center">
                    <img src={imageBase64} alt="Upload preview" className="max-h-64 object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setImageBase64(null);
                        setImageFileName('');
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Diagram title / subject..."
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#07132b] border border-[#1a366f] text-xs text-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* Mode 4: RECORD AUDIO */}
          {inputType === 'audio' && (
            <div className="space-y-5">
              {/* Audio Mode Selection */}
              <div className="p-3.5 rounded-xl bg-[#07132b] border border-[#1a366f] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white">Audio Capture Mode</span>
                  <p className="text-[11px] text-[#9bb1d6]">
                    Choose between a short personal voice note or a full lecture transcription.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAudioMode('voice_note')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      audioMode === 'voice_note'
                        ? 'bg-[#00B4FF] text-[#0B1F44]'
                        : 'bg-[#0f2756] text-[#9bb1d6]'
                    }`}
                  >
                    Quick Voice Note
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioMode('capture_lesson')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      audioMode === 'capture_lesson'
                        ? 'bg-[#00B4FF] text-[#0B1F44]'
                        : 'bg-[#0f2756] text-[#9bb1d6]'
                    }`}
                  >
                    Capture Lesson
                  </button>
                </div>
              </div>

              {/* Legal Notice Required by Specification */}
              <div className="p-3 rounded-xl bg-[#0f2756]/50 border border-[#1a366f] text-[11px] text-[#9bb1d6] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#00B4FF] shrink-0" />
                <span>
                  <strong>Legal Notice:</strong> Recording others may require consent depending on applicable laws in your jurisdiction.
                </span>
              </div>

              {/* Recording Controls */}
              <div className="p-6 rounded-2xl bg-[#07132b] border border-[#1a366f] text-center space-y-4">
                <div className="text-3xl font-mono font-bold text-white tracking-widest">
                  {formatTime(recordSeconds)}
                </div>

                {/* Waveform indicator */}
                {isRecording && !isPaused && (
                  <div className="flex items-center justify-center gap-1 h-8">
                    {[16, 28, 12, 32, 20, 10, 24, 30, 18, 22].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-[#00B4FF] animate-pulse"
                        style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-center gap-3">
                  {!isRecording && !recordedAudioBlob && (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer shadow-lg shadow-[#00B4FF]/20"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Start Recording</span>
                    </button>
                  )}

                  {isRecording && (
                    <>
                      {!isPaused ? (
                        <button
                          type="button"
                          onClick={pauseRecording}
                          className="p-2.5 rounded-xl bg-[#0f2756] text-white hover:bg-[#1a366f] transition-colors cursor-pointer"
                          title="Pause"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={resumeRecording}
                          className="p-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] hover:bg-[#009de0] transition-colors cursor-pointer"
                          title="Resume"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-colors cursor-pointer"
                      >
                        <MicOff className="w-4 h-4" />
                        <span>Finish Recording</span>
                      </button>
                    </>
                  )}

                  {recordedAudioBlob && !isRecording && (
                    <div className="flex items-center gap-3">
                      <audio controls src={recordedAudioUrl || undefined} className="h-9" />
                      <button
                        type="button"
                        onClick={() => {
                          setRecordedAudioBlob(null);
                          setRecordedAudioUrl(null);
                          setRecordSeconds(0);
                        }}
                        className="p-2 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#1a366f]"
                        title="Re-record"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleTranscribeAudio}
                        disabled={isTranscribing}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isTranscribing ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-[#0B1F44] border-t-transparent rounded-full animate-spin" />
                            <span>Transcribing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Transcribe Audio</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Transcribed Text Display */}
              {rawText && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#9bb1d6]">
                    <span>Audio Transcript</span>
                    <span>{transcribedWordCount || rawText.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                  <textarea
                    rows={5}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-[#07132b] border border-[#1a366f] text-xs text-white font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* Structured Output Preview (If available) */}
          {structuredOutput && (
            <div className="p-4 rounded-xl bg-[#07132b] border border-[#00B4FF]/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00B4FF]" />
                  <span className="text-xs font-bold text-white">Lesson Structure Ready</span>
                </div>
                <span className="text-[11px] font-mono text-[#00B4FF]">
                  {structuredOutput.mainConcepts?.length || 0} Concepts &bull; {structuredOutput.keyTerms?.length || 0} Terms
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">{structuredOutput.title}</h3>
              <p className="text-xs text-[#9bb1d6]">{structuredOutput.overview}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1a366f] bg-[#081734]">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[#9bb1d6] hover:text-white cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {destination === 'standalone_note' ? (
              <button
                type="button"
                onClick={handleSaveStandaloneNote}
                disabled={isSaving || !rawText.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer disabled:opacity-50"
              >
                <StickyNote className="w-4 h-4" />
                <span>Save Note</span>
              </button>
            ) : !structuredOutput ? (
              <button
                type="button"
                onClick={() => handleStructure()}
                disabled={isStructuring || (!rawText.trim() && !imageBase64)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer disabled:opacity-50"
              >
                {isStructuring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#0B1F44] border-t-transparent rounded-full animate-spin" />
                    <span>{structuringStage || 'Structuring Material...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Structure into Lesson</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveLesson}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00B4FF] text-[#0B1F44] font-bold text-xs hover:bg-[#009de0] transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#0B1F44] border-t-transparent rounded-full animate-spin" />
                    <span>Saving to Course...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Lesson to Course</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
