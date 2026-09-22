import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { api } from '../lib/api';
import { Course, StructuredContent, OriginalMaterial } from '../types';

interface AddMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  initialCourseId?: string;
  onLessonSaved: (courseId: string, lessonId: string) => void;
  onCourseCreated?: (newCourse: Course) => void;
}

type MaterialInputType = 'paste' | 'image' | 'document' | 'notes';

export const AddMaterialModal: React.FC<AddMaterialModalProps> = ({
  isOpen,
  onClose,
  courses,
  initialCourseId,
  onLessonSaved,
  onCourseCreated,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourseId || (courses.length > 0 ? courses[0].id : '')
  );
  const [showNewCourseInput, setShowNewCourseInput] = useState(courses.length === 0);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [inputType, setInputType] = useState<MaterialInputType>('paste');

  // Input states
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  // Handle Document Upload (TXT, MD, etc.)
  const handleDocFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!sourceTitle) {
      setSourceTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawText(reader.result as string);
    };
    reader.readAsText(file);
  };

  // Handle AI Structuring Execution
  const handleStructure = async () => {
    setErrorMessage(null);
    if (!rawText.trim() && !imageBase64) {
      setErrorMessage('Please paste text or upload an image/document before structuring.');
      return;
    }

    const activeCourse = courses.find((c) => c.id === selectedCourseId);
    const courseTitle = activeCourse ? activeCourse.title : newCourseTitle;

    setIsStructuring(true);
    setStructuringStage('Analyzing raw material & identifying core concepts...');

    try {
      const stageTimer1 = setTimeout(() => {
        setStructuringStage('Organizing subtopics, extracting examples & distinctions...');
      }, 1500);

      const stageTimer2 = setTimeout(() => {
        setStructuringStage('Building pedagogical review questions & key terms glossary...');
      }, 3000);

      const res = await api.structureMaterial({
        rawContent: rawText,
        contentType: inputType,
        courseTitle,
        customInstructions,
        imageBase64: imageBase64 || undefined,
        mimeType: imageBase64?.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      setStructuredOutput(res.structured);
      setPreviewTab('structured');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Something went wrong while structuring your material. Your original material is safe.'
      );
    } finally {
      setIsStructuring(false);
    }
  };

  // Save the structured lesson to the course
  const handleSaveLesson = async () => {
    if (!structuredOutput) return;

    let targetCourseId = selectedCourseId;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      // If user selected to create a new course inline
      if (showNewCourseInput || !targetCourseId) {
        if (!newCourseTitle.trim()) {
          setErrorMessage('Please provide a course name.');
          setIsSaving(false);
          return;
        }
        const created = await api.createCourse({
          title: newCourseTitle.trim(),
          category: 'Personal Learning',
          courseType: 'ai-assisted',
        });
        targetCourseId = created.course.id;
        if (onCourseCreated) onCourseCreated(created.course);
      }

      const originalMaterialData: OriginalMaterial = {
        type: inputType === 'image' ? 'image' : inputType === 'document' ? 'document' : 'text',
        content: imageBase64 || rawText,
        sourceTitle: sourceTitle || 'Imported Knowledge Dump',
        uploadedAt: new Date().toISOString(),
        fileName: imageFileName || undefined,
      };

      const res = await api.createLesson(targetCourseId, {
        title: structuredOutput.title || 'New Lesson',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#121316] border border-[#262831] shadow-2xl text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#21232b] bg-[#141519]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Knowledge Dump & Material Import</h2>
              <p className="text-xs text-zinc-400">
                Bring raw information into Mindly. AI turns it into structured, teachable lessons.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Course Target Selector */}
        <div className="px-6 py-3 bg-[#0d0e11] border-b border-[#1e2027] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-zinc-300 font-medium">Assign to Course:</span>
            {!showNewCourseInput ? (
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setShowNewCourseInput(true);
                  } else {
                    setSelectedCourseId(e.target.value);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-[#18191f] border border-[#2b2d38] text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                <option value="__new__">+ Create New Course</option>
              </select>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  placeholder="New Course Title (e.g. Aerodynamics)..."
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#18191f] border border-[#2b2d38] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                {courses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowNewCourseInput(false)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Body: Input Mode or Structured Review */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Notice</p>
                <p className="mt-0.5 text-zinc-300">{errorMessage}</p>
              </div>
            </div>
          )}

          {!structuredOutput ? (
            /* STEP 1: RAW INPUT WORKSPACE */
            <div className="space-y-4">
              {/* Input Type Selector */}
              <div className="flex gap-2 border-b border-[#22242c] pb-3 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setInputType('paste')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    inputType === 'paste'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Paste Text / Transcript</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputType('image')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    inputType === 'image'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Upload Screenshot / Diagram</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputType('document')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    inputType === 'document'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload Document (.txt, .md)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputType('notes')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    inputType === 'notes'
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Manual Notes</span>
                </button>
              </div>

              {/* Source Title & Optional Focus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Source Title / Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. YouTube Video: Market Structure 101, or Textbook Ch. 3"
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Learner Focus / Special Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Focus on practical chart setups, explain simply"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Specific Mode Inputs */}
              {inputType === 'paste' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Raw Material Content (Paste messy text, video transcripts, paragraphs)
                  </label>
                  <textarea
                    rows={10}
                    placeholder="Paste your raw learning content here. Don't worry about formatting, repetition, or structure—Mindly's AI will organize and clean it..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full p-3 text-xs font-mono leading-relaxed rounded-xl bg-[#0b0c0e] border border-[#262831] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {inputType === 'image' && (
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2d303b] hover:border-indigo-500/60 bg-[#0e0f12] rounded-xl p-8 text-center cursor-pointer transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageFile}
                      className="hidden"
                    />
                    <ImageIcon className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-medium text-zinc-200">
                      Click to upload a screenshot, diagram, or photo of handwritten notes
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">PNG, JPG, WEBP up to 25MB</p>
                  </div>

                  {imageBase64 && (
                    <div className="p-3 rounded-xl bg-[#16171d] border border-[#282a35] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={imageBase64}
                          alt="Uploaded preview"
                          className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
                        />
                        <div>
                          <p className="text-xs font-medium text-zinc-200">{imageFileName || 'Selected image'}</p>
                          <p className="text-[10px] text-zinc-400">Ready for visual concept extraction</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImageBase64(null);
                          setImageFileName('');
                        }}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-zinc-800"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Accompanying Notes (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Add any context or questions about this diagram..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-lg bg-[#0e0f12] border border-[#262831] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {inputType === 'document' && (
                <div className="space-y-3">
                  <div
                    onClick={() => docInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2d303b] hover:border-indigo-500/60 bg-[#0e0f12] rounded-xl p-8 text-center cursor-pointer transition-colors"
                  >
                    <input
                      ref={docInputRef}
                      type="file"
                      accept=".txt,.md,.text"
                      onChange={handleDocFile}
                      className="hidden"
                    />
                    <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-medium text-zinc-200">
                      Click to upload text document (.txt, .md)
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">Full content will be loaded into the workspace</p>
                  </div>

                  {rawText && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Loaded Document Preview ({rawText.length} characters)
                      </label>
                      <textarea
                        rows={6}
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        className="w-full p-3 text-xs font-mono rounded-xl bg-[#0b0c0e] border border-[#262831] text-zinc-200"
                      />
                    </div>
                  )}
                </div>
              )}

              {inputType === 'notes' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Direct Notes & Thoughts
                  </label>
                  <textarea
                    rows={8}
                    placeholder="Type your notes freely. Mindly will detect key definitions, create hierarchical concept headings, and extract glossary terms..."
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl bg-[#0b0c0e] border border-[#262831] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: STRUCTURED LESSON REVIEW & EDITING */
            <div className="space-y-5">
              {/* Mode Switch: Structured Lesson vs Original Material */}
              <div className="flex items-center justify-between border-b border-[#242630] pb-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('structured')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      previewTab === 'structured'
                        ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>AI Structured Lesson</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('original')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      previewTab === 'original'
                        ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Original Material (Preserved)</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setStructuredOutput(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 cursor-pointer"
                >
                  ← Re-structure or edit input
                </button>
              </div>

              {previewTab === 'original' ? (
                <div className="p-4 rounded-xl bg-[#0b0c0e] border border-[#22242c] font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {imageBase64 && (
                    <img
                      src={imageBase64}
                      alt="Original upload"
                      className="max-h-72 rounded-lg border border-zinc-800 mb-4"
                    />
                  )}
                  {rawText || 'No text provided'}
                </div>
              ) : (
                /* Structured Lesson Details & Inline Edits */
                <div className="space-y-4">
                  {/* Title & Overview */}
                  <div className="p-4 rounded-xl bg-[#16171d] border border-[#262833] space-y-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-indigo-400 mb-1">
                        Lesson Title
                      </label>
                      <input
                        type="text"
                        value={structuredOutput.title}
                        onChange={(e) =>
                          setStructuredOutput({ ...structuredOutput, title: e.target.value })
                        }
                        className="w-full text-base font-semibold px-3 py-1.5 rounded-lg bg-[#0e0f12] border border-[#272932] text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-indigo-400 mb-1">
                        Overview
                      </label>
                      <textarea
                        rows={2}
                        value={structuredOutput.overview}
                        onChange={(e) =>
                          setStructuredOutput({ ...structuredOutput, overview: e.target.value })
                        }
                        className="w-full text-xs px-3 py-2 rounded-lg bg-[#0e0f12] border border-[#272932] text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Learning Objectives */}
                  <div className="p-4 rounded-xl bg-[#16171d] border border-[#262833]">
                    <h3 className="text-xs font-semibold text-zinc-200 mb-2">Learning Objectives</h3>
                    <ul className="space-y-1.5">
                      {structuredOutput.learningObjectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Main Concepts */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-zinc-200">Main Concepts & Explanations</h3>
                    {structuredOutput.mainConcepts.map((concept, idx) => (
                      <div key={concept.id || idx} className="p-4 rounded-xl bg-[#15161c] border border-[#242630]">
                        <h4 className="text-xs font-semibold text-white mb-1.5">{concept.title}</h4>
                        <p className="text-xs text-zinc-300 leading-relaxed mb-3">{concept.explanation}</p>
                        {concept.subtopics && concept.subtopics.length > 0 && (
                          <div className="space-y-2 pl-3 border-l-2 border-indigo-500/40">
                            {concept.subtopics.map((sub, sIdx) => (
                              <div key={sIdx}>
                                <h5 className="text-[11px] font-medium text-indigo-300">{sub.title}</h5>
                                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{sub.explanation}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Distinctions & Key Terms */}
                  {structuredOutput.importantDistinctions?.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#15161c] border border-[#242630]">
                      <h3 className="text-xs font-semibold text-zinc-200 mb-2">Important Distinctions</h3>
                      <div className="space-y-2">
                        {structuredOutput.importantDistinctions.map((d, dIdx) => (
                          <div key={dIdx} className="p-3 rounded-lg bg-[#0e0f12] text-xs">
                            <span className="font-semibold text-indigo-300">{d.conceptA}</span>
                            <span className="text-zinc-500 mx-2">vs</span>
                            <span className="font-semibold text-indigo-300">{d.conceptB}</span>
                            <p className="text-zinc-400 mt-1">{d.distinction}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Terms */}
                  {structuredOutput.keyTerms?.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#15161c] border border-[#242630]">
                      <h3 className="text-xs font-semibold text-zinc-200 mb-2">Extracted Key Terms (Glossary)</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {structuredOutput.keyTerms.map((t, tIdx) => (
                          <div key={tIdx} className="p-2.5 rounded-lg bg-[#0e0f12] text-xs">
                            <span className="font-semibold text-white">{t.term}</span>
                            <p className="text-zinc-400 mt-0.5 text-[11px]">{t.definition}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pedagogical Origin Markers */}
                  <div className="p-3.5 rounded-xl bg-[#0d0e11] border border-[#1f2027] text-[11px] space-y-1.5">
                    {structuredOutput.fromMaterialNotes && (
                      <p className="text-zinc-400">
                        <span className="text-emerald-400 font-medium">[From Your Material]</span>{' '}
                        {structuredOutput.fromMaterialNotes}
                      </p>
                    )}
                    {structuredOutput.aiExplanations && (
                      <p className="text-zinc-400">
                        <span className="text-indigo-400 font-medium">[AI Clarification]</span>{' '}
                        {structuredOutput.aiExplanations}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[#21232b] bg-[#141519] flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {isStructuring && <span className="text-indigo-400 animate-pulse">{structuringStage}</span>}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {!structuredOutput ? (
              <button
                type="button"
                id="structure-with-ai-btn"
                onClick={handleStructure}
                disabled={isStructuring || (!rawText.trim() && !imageBase64)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-indigo-950/40 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isStructuring ? 'Structuring Material...' : 'Structure with AI'}</span>
              </button>
            ) : (
              <button
                type="button"
                id="save-lesson-btn"
                onClick={handleSaveLesson}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Saving Lesson...' : 'Save Lesson to Course'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
