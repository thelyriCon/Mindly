/**
 * AI Service Layer (Gemini-3.8-Flash Integration)
 * Meets V1.5 specifications: modular service, lazy initialization, strict source attribution,
 * persistent grounding preferences (Strict vs Balanced), and quiz generation.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { StructuredContent, ReviewQuestion, LessonDiagram, LessonImage, PlannedDay } from '../../src/types';
import {
  validateLessonContent as validateLessonContentFn,
  LessonValidationResult,
  LessonValidationChecklist,
} from '../../src/lib/validation';
import { fetchLessonImages } from './mediaService';

export type { LessonValidationResult, LessonValidationChecklist, LessonDiagram };
export const validateLessonContent = validateLessonContentFn;

let genAIClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Wraps Gemini API calls with automated exponential backoff retry and automatic model switching
 * for transient errors (HTTP 503, 429, UNAVAILABLE, high demand, or timeouts).
 */
export async function callGeminiWithRetry<T>(
  fn: (model: string) => Promise<T>,
  models: string[] = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
  maxRetries = 4,
  baseDelayMs = 2500
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const modelToUse = attempt === 1 ? models[0] : (models[1] || models[0]);
    try {
      return await fn(modelToUse);
    } catch (err: any) {
      lastError = err;
      const isTransient =
        err?.status === 503 ||
        err?.code === 503 ||
        err?.status === 429 ||
        err?.code === 429 ||
        err?.message?.includes('503') ||
        err?.message?.includes('429') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('overloaded') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('resource exhausted') ||
        err?.message?.includes('ECONNRESET') ||
        err?.message?.includes('ETIMEDOUT') ||
        err?.message?.includes('fetch failed');

      if (isTransient && attempt < maxRetries) {
        const nextModel = models[Math.min(attempt, models.length - 1)];
        let delay = baseDelayMs * Math.pow(2, attempt - 1);

        // Inspect error message, details, and headers for Gemini's recommended retryDelay
        const errMsg = String(err?.message || '');
        const retryMatch = errMsg.match(/retry(?: after| in)?\s*[:\s]?\s*(\d+(?:\.\d+)?)\s*s/i);
        if (retryMatch && retryMatch[1]) {
          const parsedSec = parseFloat(retryMatch[1]);
          if (!isNaN(parsedSec) && parsedSec > 0) {
            delay = Math.max(delay, Math.ceil(parsedSec * 1000) + 500);
          }
        }

        if (Array.isArray(err?.errorDetails)) {
          for (const detail of err.errorDetails) {
            if (detail?.retryDelay) {
              const seconds = parseFloat(detail.retryDelay);
              if (!isNaN(seconds) && seconds > 0) {
                delay = Math.max(delay, Math.ceil(seconds * 1000) + 500);
              }
            }
          }
        }

        if (err?.response?.headers) {
          const retryHeader =
            typeof err.response.headers.get === 'function'
              ? err.response.headers.get('retry-after')
              : err.response.headers['retry-after'];
          if (retryHeader) {
            const parsedSec = parseFloat(retryHeader);
            if (!isNaN(parsedSec) && parsedSec > 0) {
              delay = Math.max(delay, Math.ceil(parsedSec * 1000) + 500);
            }
          }
        }

        console.warn(
          `[Gemini API] Transient error on ${modelToUse} (${err?.status || err?.code || '503/429/UNAVAILABLE'}). Waiting quota reset window (${delay}ms) and switching to ${nextModel} (attempt ${attempt}/${maxRetries})...`
        );
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('Gemini API call failed after max retries.');
}

export interface StructureMaterialOptions {
  rawContent?: string;
  contentType?: string;
  courseTitle?: string;
  imageBase64?: string;
  mimeType?: string;
  customInstructions?: string;
  aiStrictness?: 'strict' | 'balanced' | string;
}

export interface AskTutorOptions {
  question: string;
  lessonContext: any;
  courseContext?: string;
  originalMaterial?: string;
  aiStrictness?: 'strict' | 'balanced' | string;
}

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantChatOptions {
  messages: AssistantChatMessage[];
  activeLesson?: {
    id?: string;
    title?: string;
    dayTitle?: string;
    dayNumber?: number;
    structuredContent?: any;
    originalMaterial?: any;
    userNotes?: string;
    readingPosition?: any;
  };
  activeCourse?: {
    id?: string;
    title?: string;
    description?: string;
    category?: string;
    learningObjectives?: string[];
  };
  notes?: Array<{
    id: string;
    title: string;
    content: string;
    courseTitle?: string;
    lessonTitle?: string;
    tags?: string[];
  }>;
  terms?: Array<{
    id: string;
    term: string;
    definition: string;
    context?: string;
    relatedConcepts?: string[];
    lessonTitle?: string;
  }>;
}

export interface AssistantChatResult {
  answer: string;
  matchedNotes: Array<{ id: string; title: string }>;
  matchedTerms: Array<{ id: string; term: string }>;
}

export interface GenerateQuizOptions {
  lessonTitle: string;
  overview: string;
  mainConcepts: any[];
  keyTerms?: any[];
}

export interface SubtopicSuggestion {
  id: string;
  title: string;
  description: string;
  relevance?: string;
}

export interface CoursePlanModule {
  id: string;
  title: string;
  overview: string;
  learningObjectives: string[];
  keyTopics: string[];
  estimatedMinutes: number;
  dayNumber?: number;
  dayTitle?: string;
}

export interface CoursePlanDay {
  dayNumber: number;
  title: string;
  overview: string;
  estimatedMinutes: number;
  modules: CoursePlanModule[];
  checkInQuiz?: ReviewQuestion[];
}

export interface CoursePlanResult {
  title: string;
  description: string;
  category: string;
  depth: 'quick' | 'standard' | 'deep';
  dailyMinutesRange: string;
  dailyMinutes: number;
  estimatedDays: number;
  durationLabel: string;
  learningObjectives: string[];
  days: CoursePlanDay[];
  modules: CoursePlanModule[];
  finalExam?: ReviewQuestion[];
  phaseNotice?: string;
}

export interface AuthorLessonOptions {
  subject: string;
  courseTitle: string;
  courseDescription: string;
  courseObjectives: string[];
  lessonOrder: number;
  totalLessons: number;
  lessonTitle: string;
  lessonOverview: string;
  keyConcepts: string[];
  depth: 'quick' | 'standard' | 'deep';
  estimatedMinutes: number;
  priorLessonTitles?: string[];
}

export class AIService {
  /**
   * Discovers 6-8 structured subtopics for any given subject or field
   */
  async discoverSubtopics(topic: string): Promise<SubtopicSuggestion[]> {
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      throw new Error('Topic cannot be empty.');
    }

    const ai = getAIClient();

    const prompt = `You are Mindly's curriculum architect.
The user wants to learn about: "${cleanTopic}".
Generate 6 to 8 intelligent, high-yield, logical subtopics/domains that form a coherent learning pathway for this subject.
Whether the topic is Trading, Physics, Graphic Design, Programming, Business, History, Aerodynamics, or a niche custom topic, provide professional, accurate, non-trivial subtopics.

Rules:
1. Provide 6 to 8 subtopics.
2. For each subtopic, provide a clear, concise title and 1 sentence explaining what it covers.
3. Order them logically from fundamental principles to applied mastery.
4. Output strictly adhering to the JSON schema.`;

    const response = await callGeminiWithRetry((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ['id', 'title', 'description'],
            },
          },
        },
      })
    );

    const text = response.text?.trim();
    if (!text) {
      throw new Error(`Gemini returned an empty response for subtopic discovery on "${cleanTopic}".`);
    }
    const parsed = JSON.parse(text) as SubtopicSuggestion[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`Failed to parse valid subtopics array for "${cleanTopic}".`);
    }
    return parsed;
  }

  /**
   * Generates 5-8 closely related, compelling semantic topic suggestions for any keyword or partial query
   */
  async suggestTopics(query: string): Promise<string[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const ai = getAIClient();
    const prompt = `You are Mindly's dynamic topic discovery engine.
The user is looking for or typing a course subject: "${cleanQuery}".
Generate 5 to 8 closely related, compelling, and relevant educational course topic titles.
The suggestions must be specific, academic or practical subject titles that directly relate to or expand upon the keyword.

Examples:
- If input is 'singing' -> ["Songwriting & Lyricism", "Vocal Warmups & Technique", "Music Theory Fundamentals", "Audio Performance & Projection", "Vocal Anatomy & Breath Support", "Stage Presence & Vocal Styling"]
- If input is 'crankshaft' -> ["Internal Combustion Engine Mechanics", "Torque & Powertrain Systems", "Automotive Maintenance & Diagnostics", "Rotational Kinematics & Balancing", "Piston & Valvetrain Dynamics", "Transmission & Drivetrain Engineering"]
- If input is 'quantum' -> ["Quantum Mechanics Foundations", "Quantum Computing & Qubits", "Wave-Particle Duality", "Quantum Entanglement & Teleportation", "Superconductivity & Condensed Matter", "Quantum Cryptography"]

Output strictly a JSON array of 5 to 8 string titles.`;

    try {
      const response = await callGeminiWithRetry(
        (model) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          }),
        ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
        3,
        1500
      );

      const text = response.text?.trim();
      if (!text) return [];
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 8);
      }
    } catch (err) {
      console.warn('[AI TOPIC SUGGEST NOTICE]', err);
    }
    return [];
  }

  /**
   * Generates a tailored course curriculum plan based on depth and daily study capacity
   */
  async generateCoursePlan(options: {
    topic: string;
    subtopics: string[];
    depth: 'quick' | 'standard' | 'deep';
    dailyMinutes: number;
    dailyMinutesRange: string;
  }): Promise<CoursePlanResult> {
    const { topic, subtopics, depth, dailyMinutes, dailyMinutesRange } = options;
    const ai = getAIClient();

    const depthConfig = {
      quick: {
        targetDays: '3 to 5',
        focus: 'essential core principles, rapid foundational understanding, practical intuition, and key milestones',
        dailyMinutesDefault: 30,
      },
      standard: {
        targetDays: '5 to 7',
        focus: 'balanced mastery, deep mechanistic explanations, interactive concept diagrams, daily check-in quizzes, and worked scenarios',
        dailyMinutesDefault: 35,
      },
      deep: {
        targetDays: '7 to 14',
        focus: 'exhaustive mastery, nuanced theoretical frameworks, edge cases, multifaceted scenarios, and rigorous retention gates',
        dailyMinutesDefault: 45,
      },
    }[depth];

    const prompt = `You are Mindly's Master Curriculum Architect.
Generate a structured, high-retention, day-by-day course curriculum for: "${topic}".
User-Selected Subtopics: ${subtopics.length > 0 ? subtopics.join(', ') : 'Comprehensive overview'}
Course Depth: ${depth.toUpperCase()} COURSE (Target: ${depthConfig.targetDays} Study Days focusing on ${depthConfig.focus}).
User's Daily Study Capacity: ${dailyMinutes} minutes/day (${dailyMinutesRange}).

CRITICAL DAY-BY-DAY PROGRESSION & PACING ARCHITECTURE:
1. STUDY DAYS GROUPING & MANAGEABLE BLOCKS:
   - Group the curriculum explicitly by Study Days (e.g. "Day 1: Foundations & Core Architecture", "Day 2: Operational Mechanics & Transformations", etc.).
   - Calculate manageable daily study blocks (e.g. 30–45 minutes of reading per day).
   - Each Study Day must contain 2 to 3 granular, focused sub-lessons (modules) that logically build upon each other.
   - For each lesson module: provide id, title, overview, 3 learning objectives, 3-4 key topics, and estimated reading minutes (15 to 20 mins).
2. END-OF-DAY MILESTONE GATES (DAILY CHECK-IN QUIZ):
   - At the end of EACH Study Day, place a 3-to-5 question "Daily Check-in Quiz".
   - Learners must pass this milestone gate before unlocking the next day's material.
   - Questions must be multiple choice with 4 distinct options, an exact answer matching one of the options, and an educational explanation.
3. COMPREHENSIVE FINAL EXAM:
   - Provide 8 to 10 comprehensive review questions testing synthesis across all study days.
   - This exam is placed exclusively at the end of the final day as the ultimate graduation milestone.
4. Output strictly adhering to the JSON schema.`;

    const response = await callGeminiWithRetry((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING },
              learningObjectives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING, description: 'e.g. "Day 1: Foundational Principles"' },
                    overview: { type: Type.STRING, description: 'Summary of what the learner tackles today' },
                    estimatedMinutes: { type: Type.INTEGER, description: '30 to 45 minutes total daily block' },
                    modules: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          title: { type: Type.STRING },
                          overview: { type: Type.STRING },
                          learningObjectives: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          keyTopics: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          estimatedMinutes: { type: Type.INTEGER },
                        },
                        required: ['id', 'title', 'overview', 'learningObjectives', 'keyTopics', 'estimatedMinutes'],
                      },
                    },
                    checkInQuiz: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          question: { type: Type.STRING },
                          type: { type: Type.STRING },
                          options: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          answer: { type: Type.STRING },
                          explanation: { type: Type.STRING },
                        },
                        required: ['id', 'question', 'type', 'options', 'answer', 'explanation'],
                      },
                    },
                  },
                  required: ['dayNumber', 'title', 'overview', 'estimatedMinutes', 'modules', 'checkInQuiz'],
                },
              },
              finalExam: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    type: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    answer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['id', 'question', 'type', 'options', 'answer', 'explanation'],
                },
              },
            },
            required: ['title', 'description', 'category', 'learningObjectives', 'days'],
          },
        },
      })
    );

    const text = response.text?.trim();
    if (!text) {
      throw new Error(`Gemini returned an empty response for course plan on "${topic}".`);
    }

    const planData = JSON.parse(text);
    if (!planData || (!Array.isArray(planData.days) && !Array.isArray(planData.modules))) {
      throw new Error(`Gemini returned an invalid course plan for "${topic}".`);
    }

    // Process structured days and flatten modules for seamless backward compatibility
    let structuredDays: CoursePlanDay[] = [];
    const flattenedModules: CoursePlanModule[] = [];

    if (Array.isArray(planData.days) && planData.days.length > 0) {
      structuredDays = planData.days.map((d: any, dIdx: number) => {
        const dayNum = Number(d.dayNumber) || dIdx + 1;
        const dayTitle = d.title || `Day ${dayNum}: Core Study`;
        const dayModules = Array.isArray(d.modules)
          ? d.modules.map((m: any, mIdx: number) => {
              const modWithDay: CoursePlanModule = {
                id: m.id || `mod_d${dayNum}_${mIdx + 1}`,
                title: m.title || `Lesson ${mIdx + 1}`,
                overview: m.overview || '',
                learningObjectives: Array.isArray(m.learningObjectives) ? m.learningObjectives : [],
                keyTopics: Array.isArray(m.keyTopics) ? m.keyTopics : [],
                estimatedMinutes: Number(m.estimatedMinutes) || 20,
                dayNumber: dayNum,
                dayTitle,
              };
              flattenedModules.push(modWithDay);
              return modWithDay;
            })
          : [];

        return {
          dayNumber: dayNum,
          title: dayTitle,
          overview: d.overview || `Essential concepts for Day ${dayNum}.`,
          estimatedMinutes:
            Number(d.estimatedMinutes) ||
            dayModules.reduce((s: number, m: CoursePlanModule) => s + (m.estimatedMinutes || 20), 0) ||
            35,
          modules: dayModules,
          checkInQuiz: Array.isArray(d.checkInQuiz) ? d.checkInQuiz : [],
        };
      });
    } else if (Array.isArray(planData.modules)) {
      // Fallback: Group existing raw modules into 35-minute study days
      let currentDayNum = 1;
      let currentDayMinutes = 0;
      let currentDayModules: CoursePlanModule[] = [];

      planData.modules.forEach((m: any, idx: number) => {
        const estMin = Number(m.estimatedMinutes) || 20;
        if (currentDayMinutes + estMin > 45 && currentDayModules.length > 0) {
          structuredDays.push({
            dayNumber: currentDayNum,
            title: `Day ${currentDayNum}: Study Block`,
            overview: `Core foundations for Day ${currentDayNum}`,
            estimatedMinutes: currentDayMinutes,
            modules: [...currentDayModules],
            checkInQuiz: [],
          });
          currentDayNum += 1;
          currentDayMinutes = 0;
          currentDayModules = [];
        }

        const modItem: CoursePlanModule = {
          ...m,
          dayNumber: currentDayNum,
          dayTitle: `Day ${currentDayNum}: Study Block`,
        };
        currentDayModules.push(modItem);
        flattenedModules.push(modItem);
        currentDayMinutes += estMin;
      });

      if (currentDayModules.length > 0) {
        structuredDays.push({
          dayNumber: currentDayNum,
          title: `Day ${currentDayNum}: Study Block`,
          overview: `Core foundations for Day ${currentDayNum}`,
          estimatedMinutes: currentDayMinutes,
          modules: currentDayModules,
          checkInQuiz: [],
        });
      }
    }

    const calculatedDays = structuredDays.length || 7;
    const effectiveDailyMinutes = Math.max(15, dailyMinutes || 35);

    let phaseNotice: string | undefined;
    if (calculatedDays > 30) {
      phaseNotice = `This subject is broad. We have calibrated Phase 1 to cover core foundations within approximately 30 days. You can proceed to Phase 2 upon completion.`;
    }

    return {
      title: planData.title,
      description: planData.description,
      category: planData.category || 'General',
      depth,
      dailyMinutesRange,
      dailyMinutes: effectiveDailyMinutes,
      estimatedDays: calculatedDays,
      durationLabel: `Estimated ${calculatedDays} days`,
      learningObjectives: planData.learningObjectives || [],
      days: structuredDays,
      modules: flattenedModules,
      finalExam: Array.isArray(planData.finalExam) ? planData.finalExam : [],
      phaseNotice,
    };
  }

  /**
   * Transforms raw dumped learning material into a structured, teachable lesson
   */
  async structureMaterial(options: StructureMaterialOptions): Promise<StructuredContent> {
    const {
      rawContent,
      contentType,
      courseTitle,
      imageBase64,
      mimeType,
      customInstructions,
      aiStrictness = 'balanced',
    } = options;

    if (!rawContent && !imageBase64) {
      throw new Error('Please provide either text content or an image to structure.');
    }

    const ai = getAIClient();

    const isStrict = aiStrictness === 'strict' || aiStrictness === 'strict_material_only';

    const prompt = `You are Mindly's intelligent pedagogical structuring engine.
Transform the provided raw learning material into a structured, teachable, and digestible lesson.
Target Course Context: ${courseTitle || 'General Knowledge'}
Content Type: ${contentType || 'Knowledge Dump'}
${customInstructions ? `Specific Learner Focus: ${customInstructions}` : ''}
Grounding Mode: ${isStrict ? 'STRICT MATERIAL GROUNDING' : 'BALANCED PEDAGOGY'}

CRITICAL SOURCE ATTRIBUTION RULES:
1. "From Your Material": Extract information directly supported by the user's provided input.
2. "AI Explanation": Clearly isolate and label any additional pedagogical clarifications, definitions, or analogies generated by AI.
3. "Suggested Further Learning": Reserve for related concepts not covered in the original input.
4. DO NOT invent false information and attribute it to the user's source material.
${
  isStrict
    ? '5. STRICT RULE: Prioritize content explicitly present in the input. Minimize extraneous speculation.'
    : '5. BALANCED RULE: Provide helpful analogies, distinctions, and clear bridges to facilitate deep comprehension while keeping original source attribution explicit.'
}

Return the response strictly adhering to the JSON schema.`;

    let contentsPayload: any;

    if (imageBase64) {
      contentsPayload = {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
          {
            text: `${prompt}\n\nAdditional transcribed/accompanying text:\n${rawContent || 'No text provided, extract and structure visually from this image.'}`,
          },
        ],
      };
    } else {
      contentsPayload = `${prompt}\n\nRAW LEARNING MATERIAL:\n${rawContent}`;
    }

    const response = await callGeminiWithRetry((model) =>
      ai.models.generateContent({
        model,
        contents: contentsPayload,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Descriptive title for this lesson' },
            overview: { type: Type.STRING, description: 'Concise overview explaining what this lesson teaches' },
            learningObjectives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-4 crisp learning objectives',
            },
            mainConcepts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  subtopics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                      },
                      required: ['title', 'explanation'],
                    },
                  },
                },
                required: ['id', 'title', 'explanation', 'subtopics'],
              },
            },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  fromMaterial: { type: Type.BOOLEAN },
                },
                required: ['title', 'description', 'fromMaterial'],
              },
            },
            importantDistinctions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  conceptA: { type: Type.STRING },
                  conceptB: { type: Type.STRING },
                  distinction: { type: Type.STRING },
                },
                required: ['conceptA', 'conceptB', 'distinction'],
              },
            },
            keyTerms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  context: { type: Type.STRING },
                },
                required: ['term', 'definition'],
              },
            },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            reviewQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  type: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  answer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['id', 'question', 'type', 'answer', 'explanation'],
              },
            },
            diagrams: {
              type: Type.ARRAY,
              description: '1 to 2 clean, valid Mermaid.js diagrams illustrating structural relationships or workflows.',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  caption: { type: Type.STRING },
                  mermaidCode: {
                    type: Type.STRING,
                    description: 'Strictly valid Mermaid v10+ syntax. Node text with spaces or parentheses MUST be in double quotes inside brackets, e.g. A["Input Data (Raw)"] --> B["Processing Engine"].',
                  },
                },
                required: ['title', 'caption', 'mermaidCode'],
              },
            },
            imageSearchTerms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '1 to 2 specific search queries for free public-domain / CC images on Wikimedia Commons.',
            },
            fromMaterialNotes: {
              type: Type.STRING,
              description: 'Explicit note detailing what parts were taken directly from the users provided input',
            },
            aiExplanations: {
              type: Type.STRING,
              description: 'Clarification of supplementary context provided by AI',
            },
            suggestedFurtherLearning: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'title',
            'overview',
            'learningObjectives',
            'mainConcepts',
            'examples',
            'importantDistinctions',
            'keyTerms',
            'keyTakeaways',
            'reviewQuestions',
          ],
        },
      },
    })
  );

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('No structured response generated from model.');
    }

    const structured = JSON.parse(textOutput) as StructuredContent;

    // Auto-sanitize Mermaid diagram syntax to prevent syntax crashes
    if (Array.isArray(structured.diagrams)) {
      structured.diagrams.forEach((diag) => {
        if (diag && diag.mermaidCode) {
          let code = diag.mermaidCode.replace(/^```(?:mermaid)?\n?/, '').replace(/\n?```$/, '').trim();
          code = code.replace(/\[([^[\]"\n]*\([^[\]"\n]*\)[^[\]"\n]*)\]/g, '["$1"]');
          diag.mermaidCode = code;
        }
      });
    }

    // Retrieve real verified Wikimedia Commons images
    const searchTerms =
      Array.isArray((structured as any).imageSearchTerms) && (structured as any).imageSearchTerms.length > 0
        ? (structured as any).imageSearchTerms
        : [structured.title, courseTitle || ''];
    try {
      structured.images = await fetchLessonImages(searchTerms);
    } catch {
      structured.images = [];
    }

    return structured;
  }

  /**
   * Context-grounded AI Study Tutor respecting user strictness preference
   */
  async askTutor(options: AskTutorOptions): Promise<string> {
    const { question, lessonContext, courseContext, originalMaterial, aiStrictness = 'balanced' } = options;

    const isStrict = aiStrictness === 'strict' || aiStrictness === 'strict_material_only';
    const ai = getAIClient();

    const prompt = `You are Mindly's personal study tutor.
The user is studying a lesson and asking a question.

GROUNDING SETTING: ${isStrict ? 'STRICT MATERIAL GROUNDING' : 'BALANCED PEDAGOGY'}

STRICT GROUNDING RULES:
1. Always consult the user's supplied material first.
2. ${
      isStrict
        ? 'STRICT MODE: Rely solely on the user material. If the question asks about facts not present in their notes, you must state: "This information is not directly present in your source material." You may then provide a brief contextual explanation explicitly titled [AI Contextual Clarification].'
        : 'BALANCED MODE: Anchor to user material first, but feel free to provide helpful analogies, conceptual background, and practical intuition. Distinguish outside knowledge with clear phrasing.'
    }
3. Be concise, clear, and encouraging. Never invent citations that do not exist in their material.

Lesson Context:
Course: ${courseContext || 'Unknown'}
Lesson Title: ${lessonContext?.title || 'Untitled'}
Overview: ${lessonContext?.overview || ''}
Key Concepts: ${JSON.stringify(lessonContext?.mainConcepts || [])}
Raw Material Snippet: ${originalMaterial ? originalMaterial.slice(0, 2000) : 'None'}

User Question: ${question}`;

    const response = await callGeminiWithRetry((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
      })
    );

    return response.text || 'I could not generate an explanation at this time. Please try asking again.';
  }

  /**
   * Floating AI Study Assistant that answers queries grounded in active lesson,
   * course, user stored notes, and user glossaries.
   */
  async assistantChat(options: AssistantChatOptions): Promise<AssistantChatResult> {
    const { messages, activeLesson, activeCourse, notes = [], terms = [] } = options;
    const ai = getAIClient();

    // 1. Build Grounding Context
    const contextParts: string[] = [];

    if (activeCourse) {
      contextParts.push(
        `=== ACTIVE COURSE ===\nTitle: ${activeCourse.title || 'Untitled'}\nCategory: ${activeCourse.category || 'General'}\nDescription: ${activeCourse.description || 'N/A'}\nObjectives: ${JSON.stringify(activeCourse.learningObjectives || [])}`
      );
    }

    if (activeLesson) {
      const sc = activeLesson.structuredContent;
      contextParts.push(
        `=== ACTIVE LESSON ===\nTitle: ${activeLesson.title}\nDay: ${activeLesson.dayTitle || `Day ${activeLesson.dayNumber || 1}`}\nOverview: ${sc?.overview || 'N/A'}\nMain Concepts: ${JSON.stringify(sc?.mainConcepts || [])}\nKey Takeaways: ${JSON.stringify(sc?.keyTakeaways || [])}\nLesson Key Terms: ${JSON.stringify(sc?.keyTerms || [])}\nMargin Notes: ${activeLesson.userNotes || 'None'}\nRaw Snippet: ${activeLesson.originalMaterial?.content ? String(activeLesson.originalMaterial.content).slice(0, 1500) : 'None'}`
      );
    }

    // Include stored user notes (up to 25 most recent or relevant)
    if (notes.length > 0) {
      const notesSummary = notes
        .slice(0, 25)
        .map(
          (n) =>
            `- [Note ID: ${n.id}] "${n.title}" (${n.courseTitle ? `Course: ${n.courseTitle}` : 'General'}${n.lessonTitle ? ` / Lesson: ${n.lessonTitle}` : ''})\n  Content: ${n.content.slice(0, 600)}${n.content.length > 600 ? '...' : ''}\n  Tags: ${(n.tags || []).join(', ')}`
        )
        .join('\n\n');
      contextParts.push(`=== USER STORED NOTES (${notes.length} total saved) ===\n${notesSummary}`);
    } else {
      contextParts.push('=== USER STORED NOTES ===\nNo notes stored yet by the user.');
    }

    // Include stored glossary / key terms (up to 45)
    if (terms.length > 0) {
      const termsSummary = terms
        .slice(0, 45)
        .map(
          (t) =>
            `- [Term ID: ${t.id}] "${t.term}": ${t.definition}\n  Context: ${t.context || 'General'}${t.relatedConcepts?.length ? ` | Related: ${t.relatedConcepts.join(', ')}` : ''}`
        )
        .join('\n');
      contextParts.push(`=== USER STORED GLOSSARY / KEY TERMS (${terms.length} total saved) ===\n${termsSummary}`);
    } else {
      contextParts.push('=== USER STORED GLOSSARY / KEY TERMS ===\nNo glossary terms saved yet.');
    }

    const systemInstruction = `You are Mindly's intelligent floating study assistant, an expert personal tutor.
Your job is to answer questions, explain concepts, quiz the learner, and guide their learning.

GROUNDING DATA PROVIDED:
${contextParts.join('\n\n')}

STRICT RULES FOR SEARCHING AND ANSWERING:
1. Grounding & Synthesis: Prioritize the active lesson, active course, and the user's stored notes and glossary items. When the learner asks a question, always search their notes and glossaries for relevant entries.
2. Direct Citations:
   - When citing or drawing from a user's stored note, explicitly format the citation as: [Note: "Note Title"]
   - When defining or referencing a stored glossary term, cite it as: [Glossary: "Term"]
   - When referencing a key concept from the active lesson, cite: [Lesson: "Lesson Title"]
3. Note/Glossary Search Requests: If the user asks questions like "What notes do I have about X?", "Search my glossary for Y", or "Summarize my notes on this course", search the provided list and give an organized, comprehensive breakdown citing matching entries.
4. Active Lesson Support: If the user asks questions like "Can you explain this lesson?", "Quiz me on this", or "Give an example", tailor your explanation to the active lesson's main concepts and connect them to their stored terms.
5. Outside Concepts: If the user asks about a subject not covered in their notes or lesson, answer helpfully and accurately with pedagogical clarity, but add a brief note: "*(Note: This concept extends beyond your saved notes and glossaries.)*"
6. Format: Format responses clearly using Markdown (bolding concepts, bullet points, numbered steps for walkthroughs). Keep tone encouraging, rigorous, and concise.`;

    // Format chat turns for contents
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Take up to 10 recent messages for conversation continuity
    const history = messages.slice(-10);
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // If contents is empty, fallback to a starter prompt
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello, what can you help me with?' }],
      });
    }

    const response = await callGeminiWithRetry((model) =>
      ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
        },
      })
    );

    const answer = response.text || 'I am ready to help you explore your notes and lessons. What would you like to know?';

    // Identify which notes and terms were referenced or matched
    const matchedNotes: Array<{ id: string; title: string }> = [];
    const matchedTerms: Array<{ id: string; term: string }> = [];
    const lowerAnswer = answer.toLowerCase();
    const lastUserQuery = (messages[messages.length - 1]?.content || '').toLowerCase();

    for (const note of notes) {
      const titleLower = note.title.toLowerCase();
      if (
        lowerAnswer.includes(`[note: "${titleLower}"]`) ||
        lowerAnswer.includes(titleLower) ||
        lastUserQuery.includes(titleLower)
      ) {
        if (!matchedNotes.some((m) => m.id === note.id)) {
          matchedNotes.push({ id: note.id, title: note.title });
        }
      }
    }

    for (const term of terms) {
      const termLower = term.term.toLowerCase();
      if (
        lowerAnswer.includes(`[glossary: "${termLower}"]`) ||
        lowerAnswer.includes(termLower) ||
        lastUserQuery.includes(termLower)
      ) {
        if (!matchedTerms.some((m) => m.id === term.id)) {
          matchedTerms.push({ id: term.id, term: term.term });
        }
      }
    }

    return {
      answer,
      matchedNotes: matchedNotes.slice(0, 8),
      matchedTerms: matchedTerms.slice(0, 10),
    };
  }

  /**
   * Generates targeted review questions strictly grounded in lesson concepts
   */
  async generateQuiz(options: GenerateQuizOptions): Promise<ReviewQuestion[]> {
    const { lessonTitle, overview, mainConcepts, keyTerms } = options;
    const ai = getAIClient();

    const prompt = `You are Mindly's assessment designer. Generate 4 high-yield review questions based solely on this lesson.
Lesson Title: ${lessonTitle}
Overview: ${overview}
Concepts: ${JSON.stringify(mainConcepts)}
Key Terms: ${JSON.stringify(keyTerms || [])}

RULES:
1. Generate 3 multiple choice questions and 1 true/false question.
2. Every question must test fundamental understanding, not trivial recall.
3. Provide a clear explanation explaining WHY the correct answer is right according to the lesson material.
4. Return strictly adhering to the JSON schema.`;

    const response = await callGeminiWithRetry((model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                type: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                answer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['id', 'question', 'type', 'answer', 'explanation'],
            },
          },
        },
      })
    );

    const textOutput = response.text;
    if (!textOutput) return [];
    return JSON.parse(textOutput) as ReviewQuestion[];
  }

  /**
   * Deterministically validates an educational lesson's completeness, substance, and absence of placeholders.
   * Does NOT call Gemini or external services.
   */
  validateLessonContent(
    content: StructuredContent,
    options?: any
  ): LessonValidationResult {
    return validateLessonContentFn(content, options);
  }

  /**
   * Authors a complete, academically substantive educational lesson for any subject.
   * Includes deterministic quality validation and up to 2 attempts with corrective feedback.
   */
  async authorLesson(options: AuthorLessonOptions): Promise<StructuredContent> {
    const {
      subject,
      courseTitle,
      courseDescription,
      courseObjectives,
      lessonOrder,
      totalLessons,
      lessonTitle,
      lessonOverview,
      keyConcepts,
      depth,
      estimatedMinutes,
      priorLessonTitles = [],
    } = options;

    const ai = getAIClient();

    // Subject-specific pedagogical calibration
    const subjectLower = subject.toLowerCase();
    let pedagogicalGuidance = '';
    if (subjectLower.includes('econ') || subjectLower.includes('business') || subjectLower.includes('finance')) {
      pedagogicalGuidance = 'Focus on economic mechanisms, incentives, tradeoffs, variables, resource allocation, and realistic empirical scenarios.';
    } else if (subjectLower.includes('physic') || subjectLower.includes('math') || subjectLower.includes('chem') || subjectLower.includes('science')) {
      pedagogicalGuidance = 'Focus on foundational axioms, physical laws, equations, assumptions, step-by-step worked calculations, and physical interpretation.';
    } else if (subjectLower.includes('program') || subjectLower.includes('code') || subjectLower.includes('software') || subjectLower.includes('web')) {
      pedagogicalGuidance = 'Focus on mental models, syntax, code examples, execution flow, edge cases, and common debugging pitfalls.';
    } else if (subjectLower.includes('design') || subjectLower.includes('art')) {
      pedagogicalGuidance = 'Focus on visual hierarchy, aesthetic principles, workflows, critique frameworks, and practical design decisions.';
    } else if (subjectLower.includes('trad') || subjectLower.includes('market')) {
      pedagogicalGuidance = 'Focus on market dynamics, order flow, liquidity, risk management math, and disciplined decision rules.';
    } else {
      pedagogicalGuidance = 'Focus on first-principles definitions, underlying causal mechanisms, concrete real-world examples, and conceptual frameworks.';
    }

    // Depth target guidance (elevated word count targets)
    const depthWordTargets = {
      quick: 'approximately 1,000 words. Deep mechanistic explanations, first-principles logic, and thorough step-by-step worked examples.',
      standard: '1,500 to 2,000 words. Deep mechanistic explanations, first-principles logic, multi-paragraph conceptual depth, step-by-step worked examples, and nuanced distinctions.',
      deep: '2,500+ words. Comprehensive, masterclass-level teaching, complete derivations/proofs, multifaceted real-world scenarios, and exhaustive analysis.',
    }[depth] || '1,500 to 2,000 words.';

    const buildPrompt = (correctiveReason?: string) => `You are Mindly's Master Pedagogical Instructor and Subject-Matter Expert.

Your mission is to write a complete, academically rigorous, and deeply engaging educational lesson for a student studying "${subject}".

=========================
CURRICULUM CONTEXT
=========================
Course Title: "${courseTitle}"
Course Description: "${courseDescription}"
Overarching Course Goals:
${courseObjectives.map((obj, i) => `  ${i + 1}. ${obj}`).join('\n')}

=========================
CURRENT LESSON CONTEXT
=========================
Lesson Position: Lesson ${lessonOrder} of ${totalLessons}
Lesson Title: "${lessonTitle}"
Lesson Overview: "${lessonOverview}"
Key Concepts to Teach: ${keyConcepts.join(', ')}
${priorLessonTitles.length > 0 ? `Prerequisite Lessons Completed: ${priorLessonTitles.join(', ')}` : 'This is the foundational first lesson of the course.'}
Target Depth: ${depth.toUpperCase()} (${depthWordTargets})
Target Study Time: ${estimatedMinutes} minutes of focused learning

=========================
SUBJECT-SPECIFIC PEDAGOGICAL DIRECTIVE
=========================
${pedagogicalGuidance}

=========================
CORE AUTHORING REQUIREMENTS
=========================
1. YOU ARE NOT AN OUTLINE GENERATOR. You are authoring the ACTUAL, COMPLETE TEACHING MATERIAL.
2. The student has no prior notes. Teach every concept from first principles with clarity, depth, and precision.
3. IN-DEPTH CONCEPTUAL EXPLANATION:
   - Write comprehensive, multi-paragraph conceptual explanations for each concept.
   - For each subtopic, detail the mechanical causality: how the concept functions, why it occurs, and what happens when conditions change.
   - Employ vivid, clarifying analogies only when they genuinely improve understanding.
4. WORKED SCENARIOS & REAL-WORLD EXAMPLES:
   - Walk through realistic, grounded scenarios step by step. Detail the inputs, decision processes, and consequences.
5. CONCEPTUAL DISTINCTIONS (MENTAL CLARITY):
   - Explicitly contrast concepts that beginners frequently conflate.
   - Identify common misconceptions, explain why intuition errs, and articulate the true operational boundary.
6. TERMINOLOGY (GLOSSARY):
   - Formulate rigorous, formal definitions for all specialized terms introduced. Do not give circular or tautological definitions.
7. ACTIVE RECALL / FORMATIVE QUIZ:
   - Write 3 to 4 high-yield multiple-choice questions testing applied comprehension (not superficial trivia).
   - Provide an educational explanation for each question explaining WHY the correct option is right and diagnosing why each distractor is wrong.
8. VISUAL INTERACTIVE CONCEPT DIAGRAMS:
   - Include at least 1 clean, valid Mermaid.js diagram illustrating key processes, relationships, component breakdowns, or chronological flows relevant to the lesson.
   - CRITICAL MERMAID V10+ SYNTAX RULES:
     * Valid directives: flowchart TD, flowchart LR, graph TD, sequenceDiagram, or stateDiagram-v2.
     * ALL node labels with spaces, punctuation, commas, or parentheses MUST be strictly wrapped in double quotes inside brackets:
       CORRECT: A["Sensory Input (Visual & Auditory)"] --> B["Thalamic Processor (Relay)"]
       INCORRECT: A[Sensory Input (Visual & Auditory)] (Syntax error: Unquoted parentheses break Mermaid v10!)
     * Node identifiers must be simple alphanumeric strings without spaces or special symbols (e.g. nodeA, step1, proc2).
     * NEVER use unescaped brackets or unquoted special characters inside node texts.
     * NEVER enclose the mermaidCode string in markdown code fences or backticks (do NOT write markdown code blocks). Output raw syntax lines only.
     * Provide a clear title and an educational caption explaining how to read the diagram.
9. REAL-WORLD ROYALTY-FREE SCIENTIFIC & HISTORICAL IMAGES:
   - Provide 1 to 2 specific search terms in 'imageSearchTerms' to retrieve verified public-domain or Creative Commons photos or diagrams from Wikimedia Commons (e.g. ["neural synapse electron microscope", "action potential diagram"]).

=========================
STRICT PROHIBITION OF BOILERPLATE
=========================
- NEVER generate placeholder text such as:
  * "Foundational explanation of [Topic] within [Lesson]..."
  * "Key theoretical and practical mechanics that govern [Topic]..."
  * "A concrete illustrative application demonstrating how [Topic] operates..."
  * "Solid understanding of [Topic] mechanics."
  * "Primary concept in [Topic]."
- NEVER define a term by repeating its name.
- Every paragraph must deliver genuine educational substance.

${correctiveReason ? `
=========================
CRITICAL CORRECTION REQUIRED (Attempt 1 Failed Quality Validation)
=========================
Your previous generation was rejected by the deterministic quality validator for the following reason:
"${correctiveReason}"

You MUST fix this specific deficiency in this attempt. Do not repeat the rejected pattern. Produce complete, substantive educational teaching.
` : ''}

Return the complete lesson strictly formatted in JSON adhering to the provided schema.`;

    const authorLessonSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        overview: {
          type: Type.STRING,
          description: 'Comprehensive 2 to 3 paragraph introduction framing the core problem, why it matters, and the conceptual roadmap.',
        },
        learningObjectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '3 to 4 actionable, measurable learning objectives.',
        },
        mainConcepts: {
          type: Type.ARRAY,
          description: '2 to 4 major conceptual sections delivering deep first-principles teaching.',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              explanation: {
                type: Type.STRING,
                description: 'Comprehensive, multi-paragraph teaching text explaining underlying mechanisms, causal links, and practical intuition.',
              },
              subtopics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    explanation: {
                      type: Type.STRING,
                      description: 'Detailed explanation of specific rules, formulas, components, or operational techniques.',
                    },
                  },
                  required: ['title', 'explanation'],
                },
              },
            },
            required: ['id', 'title', 'explanation', 'subtopics'],
          },
        },
        diagrams: {
          type: Type.ARRAY,
          description: '1 to 2 clean, valid Mermaid.js diagrams illustrating key processes, relationships, component breakdowns, or chronological flows.',
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Descriptive title of the diagram' },
              caption: {
                type: Type.STRING,
                description: 'Educational caption explaining how to read the diagram and the core concept it illustrates',
              },
              mermaidCode: {
                type: Type.STRING,
                description: 'Strictly valid Mermaid v10+ syntax. Node text with spaces or parentheses MUST be in double quotes inside brackets, e.g. A["Input Data (Raw)"] --> B["Processing Engine"]. Do NOT enclose in markdown backticks.',
              },
            },
            required: ['title', 'caption', 'mermaidCode'],
          },
        },
        imageSearchTerms: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '1 to 2 specific search queries for free public-domain / Creative Commons images on Wikimedia Commons (e.g. "human brain neural network diagram", "supply demand curve graph").',
        },
        examples: {
          type: Type.ARRAY,
          description: 'Concrete, worked scenarios illustrating the theory in action.',
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: {
                type: Type.STRING,
                description: 'Detailed walkthrough of a practical scenario, step-by-step problem, or real-world application.',
              },
              fromMaterial: { type: Type.BOOLEAN },
            },
            required: ['title', 'description', 'fromMaterial'],
          },
        },
        importantDistinctions: {
          type: Type.ARRAY,
          description: 'Explicit contrasts clarifying commonly confused concepts and cognitive traps.',
          items: {
            type: Type.OBJECT,
            properties: {
              conceptA: { type: Type.STRING },
              conceptB: { type: Type.STRING },
              distinction: {
                type: Type.STRING,
                description: 'Precise analysis explaining the critical boundary between Concept A and Concept B.',
              },
            },
            required: ['conceptA', 'conceptB', 'distinction'],
          },
        },
        keyTerms: {
          type: Type.ARRAY,
          description: 'Academic glossary providing non-tautological definitions for all technical terms.',
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING },
              context: { type: Type.STRING, description: 'Contextual sentence showing how the term is used in practice.' },
            },
            required: ['term', 'definition', 'context'],
          },
        },
        keyTakeaways: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '3 to 5 permanent principles the learner should remember.',
        },
        reviewQuestions: {
          type: Type.ARRAY,
          description: '3 to 4 high-yield multiple-choice questions testing application and conceptual grasp.',
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              type: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '4 plausible options.',
              },
              answer: { type: Type.STRING, description: 'Exact string matching the correct option.' },
              explanation: {
                type: Type.STRING,
                description: 'Comprehensive pedagogical explanation detailing why the answer is correct and why other choices are flawed.',
              },
            },
            required: ['id', 'question', 'type', 'options', 'answer', 'explanation'],
          },
        },
        aiExplanations: {
          type: Type.STRING,
          description: 'Attribution note: "Synthesized from canonical principles of [Subject] by Mindly Knowledge Engine."',
        },
        suggestedFurtherLearning: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        'title',
        'overview',
        'learningObjectives',
        'mainConcepts',
        'diagrams',
        'examples',
        'importantDistinctions',
        'keyTerms',
        'keyTakeaways',
        'reviewQuestions',
      ],
    };

    // Max 2 generation attempts
    let lastError: string | null = null;
    let modelName = 'gemini-3.8-flash';
    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = buildPrompt(attempt === 2 && lastError ? lastError : undefined);

      try {
        const response = await callGeminiWithRetry(
          (model) =>
            ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: authorLessonSchema,
              },
            }),
          ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
          4,
          2500
        );

        const textOutput = response.text?.trim();
        if (!textOutput) {
          lastError = 'Gemini returned an empty response body.';
          continue;
        }

        let parsed: StructuredContent;
        try {
          parsed = JSON.parse(textOutput);
        } catch (err: any) {
          lastError = `Gemini returned invalid JSON: ${err.message}`;
          continue;
        }

        // Normalize Mode B metadata
        parsed.aiExplanations = `Authored from canonical principles of ${subject} by Mindly Knowledge Engine.`;
        if (Array.isArray(parsed.examples)) {
          parsed.examples.forEach((ex) => {
            ex.fromMaterial = false;
          });
        }

        // Auto-sanitize Mermaid diagram syntax to prevent syntax crashes
        if (Array.isArray(parsed.diagrams)) {
          parsed.diagrams.forEach((diag) => {
            if (diag && diag.mermaidCode) {
              let code = diag.mermaidCode.replace(/^```(?:mermaid)?\n?/, '').replace(/\n?```$/, '').trim();
              // Auto-quote unquoted labels containing parentheses: [Foo (Bar)] -> ["Foo (Bar)"]
              code = code.replace(/\[([^[\]"\n]*\([^[\]"\n]*\)[^[\]"\n]*)\]/g, '["$1"]');
              diag.mermaidCode = code;
            }
          });
        }

        // Retrieve real verified Wikimedia Commons images
        const searchTerms =
          Array.isArray((parsed as any).imageSearchTerms) && (parsed as any).imageSearchTerms.length > 0
            ? (parsed as any).imageSearchTerms
            : [lessonTitle, subject];
        try {
          parsed.images = await fetchLessonImages(searchTerms);
        } catch (imgErr) {
          console.warn('[LESSON IMAGE FETCH NOTICE]', imgErr);
          parsed.images = [];
        }

        // Deterministic validation
        const validation = this.validateLessonContent(parsed, options);
        if (validation.valid) {
          return parsed;
        }

        console.warn(`[LESSON AUTHORING ATTEMPT ${attempt} FAILED VALIDATION]:`, validation.reason);
        lastError = validation.reason || 'Content failed quality validation.';
      } catch (err: any) {
        console.error(`[LESSON AUTHORING ATTEMPT ${attempt} ERROR]:`, err);
        lastError = err.message || 'API request failed.';
        if (err.message && (err.message.includes('503') || err.message.includes('high demand') || err.message.includes('UNAVAILABLE'))) {
          modelName = 'gemini-3.1-flash-lite';
        }
      }

      // If attempt 1 failed and we have an attempt remaining, wait 2.5s before retry
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }

    throw new Error(`Failed to author a valid educational lesson after 2 attempts. Last error: ${lastError}`);
  }
}

export const aiService = new AIService();
