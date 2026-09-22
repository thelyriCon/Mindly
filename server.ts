import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase limit to 35MB for raw YouTube transcripts, large notes, and base64 screenshots/images
app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ extended: true, limit: "35mb" }));

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY || "";
let aiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Data Directory and Persistent Storage
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "mindly_db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DatabaseSchema {
  users: any[];
  courses: any[];
  lessons: any[];
  notes: any[];
  keyTerms: any[];
  quizAttempts: any[];
  materials: any[];
  activities: any[];
  studySessions: any[];
}

function getInitialDatabase(): DatabaseSchema {
  const defaultUserId = "usr_demo_icon";
  const defaultCourseId = "crs_market_structure";
  const now = new Date().toISOString();

  const demoCourse = {
    id: defaultCourseId,
    userId: defaultUserId,
    title: "Market Structure",
    description: "Understanding how price moves through highs, lows, trends, liquidity, and structural breaks.",
    category: "Trading",
    coverIcon: "TrendingUp",
    courseType: "ai-assisted",
    createdAt: now,
    updatedAt: now,
    isDemo: true,
  };

  const demoLessons = [
    {
      id: "lsn_intro_ms",
      courseId: defaultCourseId,
      userId: defaultUserId,
      title: "01 — Introduction to Market Structure",
      order: 1,
      isCompleted: true,
      isBookmarked: false,
      createdAt: now,
      updatedAt: now,
      isDemo: true,
      originalMaterial: {
        type: "text",
        sourceTitle: "Market Structure 101 Lecture Transcript",
        uploadedAt: now,
        content: `Welcome traders. Today we are breaking down pure market structure. Everything in technical trading begins with understanding whether the market is making Higher Highs and Higher Lows, or Lower Lows and Lower Highs. When price moves above a previous swing high, that is your Break of Structure (BOS). In an uptrend, demand is in control. Price expands upward, pulls back to test discount zones, creates a Higher Low, and then bursts upward again to create a Higher High. Never trade against the macro structure unless you have high-timeframe confirmation of a change of character.`,
      },
      structuredContent: {
        title: "Introduction to Market Structure",
        overview: "Foundational breakdown of price behavior, directional bias, and structural shifts in financial markets.",
        learningObjectives: [
          "Define the fundamental phases of market direction: uptrend, downtrend, and consolidation.",
          "Identify Higher Highs (HH) and Higher Lows (HL) in bullish flow.",
          "Recognize Break of Structure (BOS) signals and identify shifts in market control.",
        ],
        mainConcepts: [
          {
            id: "mc_1",
            title: "1. The Anatomy of Market Structure",
            explanation: "Market structure is the visual representation of buyer and seller aggression over time on a price chart.",
            subtopics: [
              {
                title: "1.1 Bullish Structure (Uptrend)",
                explanation: "Characterized by successive Higher Highs (HH) and Higher Lows (HL). Demand repeatedly overpowers supply at pullback levels.",
              },
              {
                title: "1.2 Bearish Structure (Downtrend)",
                explanation: "Characterized by successive Lower Lows (LL) and Lower Highs (LH). Supply aggressively drives price downward, violating previous lows.",
              },
            ],
          },
          {
            id: "mc_2",
            title: "2. Structural Transitions & Continuity",
            explanation: "Markets alternate between impulse phases (directional expansion) and corrective phases (re-pricing or consolidation).",
            subtopics: [
              {
                title: "2.1 Break of Structure (BOS)",
                explanation: "A confirmed close beyond a significant prior swing high (in an uptrend) or swing low (in a downtrend), signaling trend continuation.",
              },
            ],
          },
        ],
        examples: [
          {
            title: "Bullish Impulse & Retracement",
            description: "Asset price rallies from $100 to $120 (creating a swing high), retraces smoothly to $108 (forming a higher low), and pushes through $120 to hit $135 (confirming BOS).",
            fromMaterial: true,
          },
        ],
        importantDistinctions: [
          {
            conceptA: "Continuation (BOS)",
            conceptB: "Reversal (CHoCH / Change of Character)",
            distinction: "A BOS occurs in the direction of the dominant trend, confirming strength. A Change of Character breaks the opposite structural point, alerting to a potential macro reversal.",
          },
        ],
        keyTerms: [
          {
            term: "BOS",
            definition: "Break of Structure: A clear candle body close violating a prior swing high or swing low in trend direction.",
            context: "Market Structure — Lesson 1",
          },
          {
            term: "Higher Low (HL)",
            definition: "A trough that sits above the preceding trough in a bullish trending market.",
            context: "Market Structure — Lesson 1",
          },
        ],
        keyTakeaways: [
          "Structure is the primary filter before entering any trade.",
          "An uptrend remains valid until the most recent Higher Low is broken.",
          "Avoid counter-trend trades unless verified by multi-timeframe structural alignment.",
        ],
        reviewQuestions: [
          {
            id: "rq_1",
            question: "What structural event confirms continuation in an existing bullish trend?",
            type: "multiple_choice",
            options: [
              "A break and candle close above the prior swing high (BOS)",
              "Price dipping below the previous swing low",
              "A long period of narrow consolidation",
              "An RSI reading above 70",
            ],
            answer: "A break and candle close above the prior swing high (BOS)",
            explanation: "In an uptrend, a verified candle body close above the prior swing high confirms a Break of Structure, showing demand remains authoritative.",
          },
          {
            id: "rq_2",
            question: "True or False: An uptrend is invalidated as soon as price pauses at resistance.",
            type: "true_false",
            options: ["True", "False"],
            answer: "False",
            explanation: "An uptrend is only invalidated when the protecting Higher Low is violated, not when price pauses or pulls back.",
          },
        ],
        fromMaterialNotes: "Extracted directly from raw lecture transcript notes detailing price movements and buyer/seller dynamics.",
        aiExplanations: "Standardized Smart Money Concepts (SMC) terminology and definitions applied for clear learning progression.",
        suggestedFurtherLearning: ["Order Block identification", "Multi-timeframe fractal structure", "Fair Value Gap analysis"],
      },
    },
    {
      id: "lsn_swing_points",
      courseId: defaultCourseId,
      userId: defaultUserId,
      title: "02 — Swing Highs and Swing Lows",
      order: 2,
      isCompleted: true,
      isBookmarked: true,
      createdAt: now,
      updatedAt: now,
      isDemo: true,
      originalMaterial: {
        type: "text",
        sourceTitle: "Swing Identification Field Notes",
        uploadedAt: now,
        content: `How do you properly define a swing point? A swing high is not merely any candle tip; it is a 3-candle or 5-candle fractal formation where the center candle has the highest high with lower highs on either side. A swing low is the inverse: the lowest candle with higher lows flanking it. Distinguish between minor internal swings and major structural swings. Trading minor swings leads to overtrading and false breakouts. Major swings protect your stop loss.`,
      },
      structuredContent: {
        title: "Swing Highs and Swing Lows",
        overview: "Precise mathematical and visual criteria to isolate true turning points from market noise.",
        learningObjectives: [
          "Distinguish valid fractal swing highs and swing lows from random intraday wick noise.",
          "Differentiate major swing points from internal minor pullbacks.",
          "Anchor stop loss and invalidation levels to validated structural extremes.",
        ],
        mainConcepts: [
          {
            id: "mc_swing_1",
            title: "1. Fractal Definition of Swings",
            explanation: "A swing high requires at least one candle with lower highs to its left and right (typically 3 or 5 candle rule).",
            subtopics: [
              {
                title: "1.1 The 3-Candle Confirmation",
                explanation: "Candle 1 rises, Candle 2 creates the peak vertex, Candle 3 fails to exceed Candle 2's high and closes lower.",
              },
            ],
          },
          {
            id: "mc_swing_2",
            title: "2. Major vs Minor Structural Anchors",
            explanation: "Major swings represent multi-session directional turning points. Minor swings occur inside the leg as sub-fractal retracements.",
            subtopics: [
              {
                title: "2.1 Dealing Range",
                explanation: "The span between the absolute lowest swing low and highest swing high of the current macro expansion leg.",
              },
            ],
          },
        ],
        examples: [
          {
            title: "The 3-Candle Peak",
            description: "Candle A reaches $150. Candle B wicks to $155. Candle C peaks at $152 and closes at $148. Candle B is confirmed as a validated Swing High.",
            fromMaterial: true,
          },
        ],
        importantDistinctions: [
          {
            conceptA: "Internal Liquidity / Minor Swings",
            conceptB: "External Liquidity / Major Swings",
            distinction: "Minor swings provide short-term inducement, whereas major swings define the overall invalidation point of the trend.",
          },
        ],
        keyTerms: [
          {
            term: "Swing High",
            definition: "A price peak surrounded by lower highs on both preceding and subsequent periods.",
            context: "Market Structure — Lesson 2",
          },
          {
            term: "Swing Low",
            definition: "A price trough surrounded by higher lows on both preceding and subsequent periods.",
            context: "Market Structure — Lesson 2",
          },
        ],
        keyTakeaways: [
          "Do not mark every candle wick as a structural pivot.",
          "Wait for flanking candle confirmation to avoid premature structural labels.",
          "Major swings are the only reliable areas to set structural invalidation.",
        ],
        reviewQuestions: [
          {
            id: "rq_swing_1",
            question: "What minimum condition confirms a basic fractal swing high?",
            type: "multiple_choice",
            options: [
              "A central candle with a higher high than the candles directly flanking it",
              "A single red candle appearing after five green candles",
              "Price crossing below the 200 EMA",
              "High trading volume on any single bar",
            ],
            answer: "A central candle with a higher high than the candles directly flanking it",
            explanation: "A valid swing high requires the center candle to reach a higher high than both its preceding and subsequent flanking candles.",
          },
        ],
        fromMaterialNotes: "Synthesized from raw trading journal notes on fractal peaks and stop placement rules.",
        aiExplanations: "Added structured classification of internal vs external structural liquidity for clearer execution boundaries.",
        suggestedFurtherLearning: ["Fractal mathematics in chart analysis", "Multi-timeframe swing alignment"],
      },
    },
    {
      id: "lsn_hh_hl",
      courseId: defaultCourseId,
      userId: defaultUserId,
      title: "03 — Higher Highs & Higher Lows",
      order: 3,
      isCompleted: false,
      isBookmarked: false,
      createdAt: now,
      updatedAt: now,
      isDemo: true,
      originalMaterial: {
        type: "text",
        sourceTitle: "Trend Mechanics Article Clipping",
        uploadedAt: now,
        content: `When a market creates a Higher High, novice traders rush to buy at the peak out of FOMO. Professional traders wait for the pullback that forms the next Higher Low. What makes a Higher Low valid? It must hold above the origin of the previous impulsive wave and successfully generate enough buying pressure to test or break the prior high. If price pierces the Higher Low and closes below it, the uptrend has lost integrity and you must switch to neutral or short.`,
      },
      structuredContent: {
        title: "Higher Highs & Higher Lows",
        overview: "Executing trend continuity: timing entries at discount pullbacks instead of chasing extended impulse highs.",
        learningObjectives: [
          "Understand why buying the Higher High leads to poor risk-reward ratios.",
          "Identify high-probability Higher Low formation zones.",
          "Define exact invalidation criteria when a Higher Low fails.",
        ],
        mainConcepts: [
          {
            id: "mc_hh_1",
            title: "1. The Rhythm of Price Expansion",
            explanation: "Sustainable uptrends rely on periodic pauses that allow market participants to accumulate liquidity at cheaper prices.",
            subtopics: [
              {
                title: "1.1 The Discount Retracement",
                explanation: "The pullback from a Higher High towards the equilibrium or discount half of the impulse range.",
              },
            ],
          },
          {
            id: "mc_hh_2",
            title: "2. Confirming the Higher Low",
            explanation: "A swing low is only a 'confirmed' Higher Low once price rallies from it and successfully breaks through the prior Higher High.",
            subtopics: [
              {
                title: "2.1 Potential vs Confirmed HL",
                explanation: "Until the prior high is breached, the low is merely 'potential'. Once broken, it becomes 'protected structure'.",
              },
            ],
          },
        ],
        examples: [
          {
            title: "Premature HL Labeling",
            description: "Price pulls back from $200 to $170 and bounces to $185. If it rolls over and drops to $160, $170 was never a valid Higher Low.",
            fromMaterial: true,
          },
        ],
        importantDistinctions: [
          {
            conceptA: "Potential Higher Low",
            conceptB: "Confirmed (Protected) Higher Low",
            distinction: "A potential HL is forming during the pullback; it is only officially confirmed once price takes out the previous swing high.",
          },
        ],
        keyTerms: [
          {
            term: "Higher High (HH)",
            definition: "A peak price level that exceeds the previous swing high in an established uptrend.",
            context: "Market Structure — Lesson 3",
          },
          {
            term: "Discount Zone",
            definition: "The lower 50% region of a price impulse leg, representing statistically advantageous long entry pricing.",
            context: "Market Structure — Lesson 3",
          },
        ],
        keyTakeaways: [
          "Do not chase the Higher High; wait patiently for the Higher Low.",
          "A Higher Low is only legally confirmed when the previous high is broken.",
          "Risk is minimized when entering close to the structural invalidation point.",
        ],
        reviewQuestions: [
          {
            id: "rq_hh_1",
            question: "When is a swing low officially confirmed as a protected Higher Low?",
            type: "multiple_choice",
            options: [
              "When price rallies and breaks above the prior Higher High",
              "As soon as a single green candle prints at the bottom",
              "When RSI reaches 50",
              "After exactly 3 hours of consolidation",
            ],
            answer: "When price rallies and breaks above the prior Higher High",
            explanation: "Until price breaches the previous swing high, the low remains a potential turning point that could still be violated.",
          },
        ],
        fromMaterialNotes: "Synthesized from trend mechanics article clipping regarding impulsive buying errors.",
        aiExplanations: "Structured into chronological phases: impulse, retracement, testing, confirmation.",
        suggestedFurtherLearning: ["Fibonacci retracement zones (0.618 - 0.786)", "Volume profile at discount levels"],
      },
    },
  ];

  const demoNotes = [
    {
      id: "nt_demo_1",
      userId: defaultUserId,
      courseId: defaultCourseId,
      lessonId: "lsn_intro_ms",
      title: "Core Rule: Never Trade Against Macro BOS",
      content: `# Golden Rule for Market Structure
- Always check the 4-Hour and Daily charts first to mark major swing points.
- 15-minute chops will mislead you into false BOS signals.
- If 4H is Bullish (making HH and HL), only look for long setups on 15m discount retracements.
- Checklist before entry:
  - [x] Major trend identified
  - [x] Protected low intact
  - [ ] Retracement entered discount zone
  - [ ] Confirmed lower timeframe reaction`,
      tags: ["trading", "rules", "checklist"],
      type: "course",
      createdAt: now,
      updatedAt: now,
      courseTitle: "Market Structure",
      lessonTitle: "01 — Introduction to Market Structure",
    },
    {
      id: "nt_demo_2",
      userId: defaultUserId,
      courseId: null,
      lessonId: null,
      title: "General Study Philosophy: The Knowledge Dump",
      content: `# Mindly Core Principle
Bring messy notes, YouTube transcripts, and screenshot dumps here first.
Let AI structure the concepts into teachable lessons, then review and edit.
Always preserve the original raw material so you can cross-check definitions.`,
      tags: ["meta", "study-habits"],
      type: "general",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const demoTerms = [
    {
      id: "trm_bos",
      term: "BOS",
      definition: "Break of Structure: A verified candle close beyond a significant prior swing high or swing low in the trend direction.",
      context: "Market Structure — Lesson 1",
      relatedConcepts: ["CHoCH", "Higher High", "Swing Point"],
      courseId: defaultCourseId,
      lessonId: "lsn_intro_ms",
      lessonTitle: "01 — Introduction to Market Structure",
    },
    {
      id: "trm_hl",
      term: "Higher Low (HL)",
      definition: "A swing low trough that forms at a higher price than the preceding trough in a bullish trending market.",
      context: "Market Structure — Lesson 1",
      relatedConcepts: ["Higher High", "Discount Zone", "BOS"],
      courseId: defaultCourseId,
      lessonId: "lsn_intro_ms",
      lessonTitle: "01 — Introduction to Market Structure",
    },
    {
      id: "trm_swing_high",
      term: "Swing High",
      definition: "A fractal peak candle surrounded by lower highs on both preceding and subsequent candles.",
      context: "Market Structure — Lesson 2",
      relatedConcepts: ["Swing Low", "Fractal", "External Liquidity"],
      courseId: defaultCourseId,
      lessonId: "lsn_swing_points",
      lessonTitle: "02 — Swing Highs and Swing Lows",
    },
  ];

  const demoMaterials = [
    {
      id: "mat_demo_1",
      userId: defaultUserId,
      courseId: defaultCourseId,
      courseTitle: "Market Structure",
      lessonId: "lsn_intro_ms",
      lessonTitle: "01 — Introduction to Market Structure",
      type: "transcript",
      title: "Market Structure 101 Lecture Transcript",
      rawSnippet: "Welcome traders. Today we are breaking down pure market structure. Everything in technical trading begins with understanding whether the market is making Higher Highs...",
      createdAt: now,
      status: "structured",
    },
  ];

  const demoActivities = [
    {
      id: "act_1",
      type: "lesson_completed",
      title: "Completed lesson '01 — Introduction to Market Structure'",
      timestamp: now,
      courseId: defaultCourseId,
      lessonId: "lsn_intro_ms",
    },
    {
      id: "act_2",
      type: "material_imported",
      title: "Imported lecture transcript to 'Market Structure'",
      timestamp: now,
      courseId: defaultCourseId,
    },
  ];

  const defaultUser = {
    id: defaultUserId,
    name: "iCon",
    email: "icon@mindly.app",
    interests: ["Trading", "Programming", "Cognitive Science"],
    createdAt: now,
    onboardingCompleted: true,
    dailyStudyGoalMinutes: 30,
    settings: {
      theme: "dark",
      fontSize: "normal",
      aiStrictness: "strict_material_only",
      dailyStudyGoalMinutes: 30,
    },
  };

  const demoStudySessions = [
    {
      id: "sess_demo_1",
      userId: defaultUserId,
      lessonId: "lsn_intro_ms",
      lessonTitle: "01 — Introduction to Market Structure",
      seconds: 12 * 60, // 12 minutes pre-logged today
      date: now.slice(0, 10),
      timestamp: now,
    },
  ];

  return {
    users: [defaultUser],
    courses: [demoCourse],
    lessons: demoLessons,
    notes: demoNotes,
    keyTerms: demoTerms,
    quizAttempts: [],
    materials: demoMaterials,
    activities: demoActivities,
    studySessions: demoStudySessions,
  };
}

// Database helper functions with atomic write
function readDB(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialDatabase();
      writeDB(initial);
      return initial;
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const db: DatabaseSchema = JSON.parse(data);
    if (!db.studySessions) {
      db.studySessions = [];
    }
    if (db.users && db.users.length > 0 && (db.users[0].dailyStudyGoalMinutes === undefined || db.users[0].dailyStudyGoalMinutes === null)) {
      db.users[0].dailyStudyGoalMinutes = 30;
    }
    return db;
  } catch (err) {
    console.error("Error reading database, creating fresh seed:", err);
    const initial = getInitialDatabase();
    writeDB(initial);
    return initial;
  }
}

function writeDB(data: DatabaseSchema): void {
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempFile, DB_FILE);
}

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "Mindly", time: new Date().toISOString() });
});

// ==========================================
// AUTHENTICATION & PROFILE ROUTES
// ==========================================

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Name and email are required." });
  }

  const db = readDB();
  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "An account with this email already exists." });
  }

  const newUser = {
    id: `usr_${Date.now()}`,
    name,
    email: email.toLowerCase(),
    interests: [],
    createdAt: new Date().toISOString(),
    onboardingCompleted: false,
    settings: {
      theme: "dark",
      fontSize: "normal",
      aiStrictness: "strict_material_only",
    },
  };

  db.users.push(newUser);
  writeDB(db);

  return res.json({ user: newUser, token: `token_${newUser.id}` });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());

  if (!user) {
    // If not found, allow quick demo login or return error
    if (email === "icon@mindly.app" || email === "demo@mindly.app") {
      const demoUser = db.users[0];
      return res.json({ user: demoUser, token: `token_${demoUser.id}` });
    }
    return res.status(401).json({ error: "Invalid email or password." });
  }

  return res.json({ user, token: `token_${user.id}` });
});

app.get("/api/auth/me", (req, res) => {
  const db = readDB();
  // Return the first user or create default
  const user = db.users[0] || getInitialDatabase().users[0];
  return res.json({ user });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { email } = req.body;
  return res.json({
    message: `Password reset instructions have been sent to ${email || "your email"}. Please check your inbox.`,
  });
});

app.put("/api/profile", (req, res) => {
  const { name, interests, onboardingCompleted, settings } = req.body;
  const db = readDB();
  if (db.users.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = db.users[0];
  if (name !== undefined) user.name = name;
  if (interests !== undefined) user.interests = interests;
  if (onboardingCompleted !== undefined) user.onboardingCompleted = onboardingCompleted;
  if (settings !== undefined) user.settings = { ...user.settings, ...settings };

  writeDB(db);
  return res.json({ user });
});

// ==========================================
// STUDY GOAL & DAILY PROGRESS ROUTES
// ==========================================

function calculateStudyProgress(db: DatabaseSchema, userId?: string) {
  const user = db.users.find((u) => u.id === userId) || db.users[0];
  const dailyGoalMinutes = user?.dailyStudyGoalMinutes || 30;
  const todayStr = new Date().toISOString().slice(0, 10);

  const todaySessions = (db.studySessions || []).filter(
    (s: any) =>
      (!userId || s.userId === user?.id) &&
      (s.date === todayStr || (s.timestamp && s.timestamp.slice(0, 10) === todayStr))
  );

  const todaySeconds = todaySessions.reduce((acc: number, s: any) => acc + (s.seconds || 0), 0);
  const todayMinutes = Number((todaySeconds / 60).toFixed(1));
  const progressPercent = Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100));
  const remainingMinutes = Math.max(0, Number((dailyGoalMinutes - todayMinutes).toFixed(1)));
  const isGoalReached = todayMinutes >= dailyGoalMinutes;

  // Streak calculation
  const sessionDates = Array.from(
    new Set(
      (db.studySessions || [])
        .filter((s: any) => (!userId || s.userId === user?.id) && s.seconds > 0)
        .map((s: any) => s.date || s.timestamp.slice(0, 10))
    )
  ).sort() as string[];

  let streak = 0;
  let checkDate = new Date();
  for (let i = 0; i < 30; i++) {
    const dStr = checkDate.toISOString().slice(0, 10);
    if (sessionDates.includes(dStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      if (dStr === todayStr && streak === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        const yStr = checkDate.toISOString().slice(0, 10);
        if (sessionDates.includes(yStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  return {
    dailyGoalMinutes,
    todaySeconds,
    todayMinutes,
    progressPercent,
    streakDays: Math.max(1, streak),
    remainingMinutes,
    isGoalReached,
  };
}

app.get("/api/study-time/progress", (req, res) => {
  const db = readDB();
  const user = db.users[0];
  const progress = calculateStudyProgress(db, user?.id);
  return res.json({ progress });
});

app.put("/api/study-time/goal", (req, res) => {
  const { targetMinutes } = req.body;
  if (!targetMinutes || typeof targetMinutes !== "number" || targetMinutes <= 0) {
    return res.status(400).json({ error: "Invalid target minutes" });
  }

  const db = readDB();
  const user = db.users[0];
  if (user) {
    user.dailyStudyGoalMinutes = Math.min(480, Math.max(5, Math.round(targetMinutes)));
    if (user.settings) {
      user.settings.dailyStudyGoalMinutes = user.dailyStudyGoalMinutes;
    }
    writeDB(db);
  }

  const progress = calculateStudyProgress(db, user?.id);
  return res.json({ progress, user });
});

app.post("/api/study-time/log", (req, res) => {
  const { seconds, lessonId } = req.body;
  if (!seconds || typeof seconds !== "number" || seconds <= 0) {
    return res.status(400).json({ error: "Invalid study seconds" });
  }

  const db = readDB();
  const user = db.users[0];
  const lesson = db.lessons.find((l) => l.id === lessonId);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (!db.studySessions) {
    db.studySessions = [];
  }

  db.studySessions.push({
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: user?.id,
    lessonId: lessonId || null,
    lessonTitle: lesson ? lesson.title : "Lesson Study",
    seconds: Math.round(seconds),
    date: todayStr,
    timestamp: now.toISOString(),
  });

  writeDB(db);
  const progress = calculateStudyProgress(db, user?.id);
  return res.json({ progress });
});

// ==========================================
// COURSE MANAGEMENT ROUTES
// ==========================================

app.get("/api/courses", (req, res) => {
  const db = readDB();
  // Augment courses with lesson counts & completion stats
  const coursesWithStats = db.courses.map((course) => {
    const courseLessons = db.lessons.filter((l) => l.courseId === course.id);
    const completedCount = courseLessons.filter((l) => l.isCompleted).length;
    const progress = courseLessons.length > 0 ? Math.round((completedCount / courseLessons.length) * 100) : 0;
    return {
      ...course,
      lessonsCount: courseLessons.length,
      completedLessonsCount: completedCount,
      progress,
    };
  });

  return res.json({ courses: coursesWithStats });
});

app.get("/api/courses/:id", (req, res) => {
  const db = readDB();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }

  const courseLessons = db.lessons
    .filter((l) => l.courseId === course.id)
    .sort((a, b) => a.order - b.order);

  const completedCount = courseLessons.filter((l) => l.isCompleted).length;
  const progress = courseLessons.length > 0 ? Math.round((completedCount / courseLessons.length) * 100) : 0;

  return res.json({
    course: {
      ...course,
      lessonsCount: courseLessons.length,
      completedLessonsCount: completedCount,
      progress,
    },
    lessons: courseLessons,
  });
});

app.post("/api/courses", (req, res) => {
  const { title, description, category, coverIcon, coverImage, courseType } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Course name is required." });
  }

  const db = readDB();
  const user = db.users[0];
  const now = new Date().toISOString();

  const newCourse = {
    id: `crs_${Date.now()}`,
    userId: user ? user.id : "usr_default",
    title: title.trim(),
    description: description ? description.trim() : "",
    category: category ? category.trim() : "General",
    coverIcon: coverIcon || "BookOpen",
    coverImage: coverImage || null,
    courseType: courseType || "self-created",
    createdAt: now,
    updatedAt: now,
    isDemo: false,
  };

  db.courses.unshift(newCourse);
  db.activities.unshift({
    id: `act_${Date.now()}`,
    type: "material_imported",
    title: `Created new course: "${newCourse.title}"`,
    timestamp: now,
    courseId: newCourse.id,
  });

  writeDB(db);
  return res.status(201).json({ course: newCourse });
});

app.put("/api/courses/:id", (req, res) => {
  const { title, description, category, coverIcon, coverImage } = req.body;
  const db = readDB();
  const courseIndex = db.courses.findIndex((c) => c.id === req.params.id);
  if (courseIndex === -1) {
    return res.status(404).json({ error: "Course not found" });
  }

  const current = db.courses[courseIndex];
  db.courses[courseIndex] = {
    ...current,
    title: title !== undefined ? title : current.title,
    description: description !== undefined ? description : current.description,
    category: category !== undefined ? category : current.category,
    coverIcon: coverIcon !== undefined ? coverIcon : current.coverIcon,
    coverImage: coverImage !== undefined ? coverImage : current.coverImage,
    updatedAt: new Date().toISOString(),
  };

  writeDB(db);
  return res.json({ course: db.courses[courseIndex] });
});

app.delete("/api/courses/:id", (req, res) => {
  const db = readDB();
  const courseId = req.params.id;
  db.courses = db.courses.filter((c) => c.id !== courseId);
  db.lessons = db.lessons.filter((l) => l.courseId !== courseId);
  db.notes = db.notes.filter((n) => n.courseId !== courseId);
  db.keyTerms = db.keyTerms.filter((t) => t.courseId !== courseId);
  db.materials = db.materials.filter((m) => m.courseId !== courseId);
  writeDB(db);
  return res.json({ success: true, message: "Course and related records removed." });
});

// ==========================================
// LESSON MANAGEMENT ROUTES
// ==========================================

app.get("/api/lessons/:id", (req, res) => {
  const db = readDB();
  const lesson = db.lessons.find((l) => l.id === req.params.id);
  if (!lesson) {
    return res.status(404).json({ error: "Lesson not found" });
  }

  const course = db.courses.find((c) => c.id === lesson.courseId);
  return res.json({ lesson, course });
});

app.post("/api/courses/:id/lessons", (req, res) => {
  const { title, originalMaterial, structuredContent } = req.body;
  const db = readDB();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }

  const existingLessons = db.lessons.filter((l) => l.courseId === course.id);
  const now = new Date().toISOString();
  const lessonOrder = existingLessons.length + 1;

  const newLesson = {
    id: `lsn_${Date.now()}`,
    courseId: course.id,
    userId: course.userId,
    title: title || `0${lessonOrder} — New Lesson`,
    order: lessonOrder,
    isCompleted: false,
    isBookmarked: false,
    createdAt: now,
    updatedAt: now,
    originalMaterial: originalMaterial || {
      type: "notes",
      content: "",
      uploadedAt: now,
    },
    structuredContent: structuredContent || {
      title: title || `New Lesson`,
      overview: "Empty lesson awaiting structured concepts.",
      learningObjectives: [],
      mainConcepts: [],
      examples: [],
      importantDistinctions: [],
      keyTerms: [],
      keyTakeaways: [],
      reviewQuestions: [],
    },
  };

  db.lessons.push(newLesson);

  // Auto-sync extracted key terms into course key terms glossary
  if (newLesson.structuredContent.keyTerms && newLesson.structuredContent.keyTerms.length > 0) {
    for (const termItem of newLesson.structuredContent.keyTerms) {
      db.keyTerms.push({
        id: `trm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        term: termItem.term,
        definition: termItem.definition,
        context: `${course.title} — ${newLesson.title}`,
        courseId: course.id,
        lessonId: newLesson.id,
        lessonTitle: newLesson.title,
        relatedConcepts: termItem.relatedConcepts || [],
        createdAt: now,
      });
    }
  }

  // Also log to material history if original material was provided
  if (originalMaterial && originalMaterial.content) {
    db.materials.unshift({
      id: `mat_${Date.now()}`,
      userId: course.userId,
      courseId: course.id,
      courseTitle: course.title,
      lessonId: newLesson.id,
      lessonTitle: newLesson.title,
      type: originalMaterial.type || "transcript",
      title: originalMaterial.sourceTitle || `${newLesson.title} Source`,
      rawSnippet: originalMaterial.content.slice(0, 200) + (originalMaterial.content.length > 200 ? "..." : ""),
      createdAt: now,
      status: "structured",
    });
  }

  db.activities.unshift({
    id: `act_${Date.now()}`,
    type: "lesson_created",
    title: `Created lesson "${newLesson.title}" in ${course.title}`,
    timestamp: now,
    courseId: course.id,
    lessonId: newLesson.id,
  });

  writeDB(db);
  return res.status(201).json({ lesson: newLesson });
});

app.put("/api/lessons/:id", (req, res) => {
  const { title, structuredContent, originalMaterial } = req.body;
  const db = readDB();
  const lessonIndex = db.lessons.findIndex((l) => l.id === req.params.id);
  if (lessonIndex === -1) {
    return res.status(404).json({ error: "Lesson not found" });
  }

  const current = db.lessons[lessonIndex];
  db.lessons[lessonIndex] = {
    ...current,
    title: title !== undefined ? title : current.title,
    structuredContent: structuredContent !== undefined ? structuredContent : current.structuredContent,
    originalMaterial: originalMaterial !== undefined ? originalMaterial : current.originalMaterial,
    updatedAt: new Date().toISOString(),
  };

  writeDB(db);
  return res.json({ lesson: db.lessons[lessonIndex] });
});

app.post("/api/lessons/:id/toggle-complete", (req, res) => {
  const db = readDB();
  const lesson = db.lessons.find((l) => l.id === req.params.id);
  if (!lesson) {
    return res.status(404).json({ error: "Lesson not found" });
  }

  lesson.isCompleted = !lesson.isCompleted;
  lesson.updatedAt = new Date().toISOString();

  if (lesson.isCompleted) {
    db.activities.unshift({
      id: `act_${Date.now()}`,
      type: "lesson_completed",
      title: `Completed lesson "${lesson.title}"`,
      timestamp: new Date().toISOString(),
      courseId: lesson.courseId,
      lessonId: lesson.id,
    });
  }

  writeDB(db);
  return res.json({ lesson });
});

app.post("/api/lessons/:id/toggle-bookmark", (req, res) => {
  const db = readDB();
  const lesson = db.lessons.find((l) => l.id === req.params.id);
  if (!lesson) {
    return res.status(404).json({ error: "Lesson not found" });
  }

  lesson.isBookmarked = !lesson.isBookmarked;
  lesson.updatedAt = new Date().toISOString();
  writeDB(db);
  return res.json({ lesson });
});

app.delete("/api/lessons/:id", (req, res) => {
  const db = readDB();
  const lessonId = req.params.id;
  db.lessons = db.lessons.filter((l) => l.id !== lessonId);
  db.notes = db.notes.filter((n) => n.lessonId !== lessonId);
  db.keyTerms = db.keyTerms.filter((t) => t.lessonId !== lessonId);
  writeDB(db);
  return res.json({ success: true, message: "Lesson removed." });
});

// ==========================================
// PERSONAL NOTES ROUTES
// ==========================================

app.get("/api/notes", (req, res) => {
  const db = readDB();
  const courseId = req.query.courseId as string | undefined;
  const lessonId = req.query.lessonId as string | undefined;

  let notes = db.notes;
  if (courseId) {
    notes = notes.filter((n) => n.courseId === courseId);
  }
  if (lessonId) {
    notes = notes.filter((n) => n.lessonId === lessonId);
  }

  // Augment notes with course and lesson titles if missing
  const augmented = notes.map((note) => {
    let cTitle = note.courseTitle;
    let lTitle = note.lessonTitle;
    if (note.courseId && !cTitle) {
      const c = db.courses.find((x) => x.id === note.courseId);
      if (c) cTitle = c.title;
    }
    if (note.lessonId && !lTitle) {
      const l = db.lessons.find((x) => x.id === note.lessonId);
      if (l) lTitle = l.title;
    }
    return { ...note, courseTitle: cTitle, lessonTitle: lTitle };
  });

  return res.json({ notes: augmented.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) });
});

app.post("/api/notes", (req, res) => {
  const { title, content, courseId, lessonId, tags, type } = req.body;
  const db = readDB();
  const now = new Date().toISOString();
  const user = db.users[0];

  let courseTitle: string | undefined;
  let lessonTitle: string | undefined;

  if (courseId) {
    const c = db.courses.find((x) => x.id === courseId);
    if (c) courseTitle = c.title;
  }
  if (lessonId) {
    const l = db.lessons.find((x) => x.id === lessonId);
    if (l) lessonTitle = l.title;
  }

  const newNote = {
    id: `nt_${Date.now()}`,
    userId: user ? user.id : "usr_default",
    courseId: courseId || null,
    lessonId: lessonId || null,
    title: title ? title.trim() : "Untitled Note",
    content: content || "",
    tags: Array.isArray(tags) ? tags : [],
    type: type || (lessonId ? "lesson" : courseId ? "course" : "general"),
    createdAt: now,
    updatedAt: now,
    courseTitle,
    lessonTitle,
  };

  db.notes.unshift(newNote);
  db.activities.unshift({
    id: `act_${Date.now()}`,
    type: "note_edited",
    title: `Created note: "${newNote.title}"`,
    timestamp: now,
    courseId: newNote.courseId,
    lessonId: newNote.lessonId,
  });

  writeDB(db);
  return res.status(201).json({ note: newNote });
});

app.put("/api/notes/:id", (req, res) => {
  const { title, content, tags, courseId, lessonId, type } = req.body;
  const db = readDB();
  const noteIndex = db.notes.findIndex((n) => n.id === req.params.id);
  if (noteIndex === -1) {
    return res.status(404).json({ error: "Note not found" });
  }

  const current = db.notes[noteIndex];
  db.notes[noteIndex] = {
    ...current,
    title: title !== undefined ? title : current.title,
    content: content !== undefined ? content : current.content,
    tags: tags !== undefined ? tags : current.tags,
    courseId: courseId !== undefined ? courseId : current.courseId,
    lessonId: lessonId !== undefined ? lessonId : current.lessonId,
    type: type !== undefined ? type : current.type,
    updatedAt: new Date().toISOString(),
  };

  writeDB(db);
  return res.json({ note: db.notes[noteIndex] });
});

app.delete("/api/notes/:id", (req, res) => {
  const db = readDB();
  db.notes = db.notes.filter((n) => n.id !== req.params.id);
  writeDB(db);
  return res.json({ success: true });
});

// ==========================================
// KEY TERMS & GLOSSARY ROUTES
// ==========================================

app.get("/api/terms", (req, res) => {
  const db = readDB();
  const courseId = req.query.courseId as string | undefined;

  let terms = db.keyTerms;
  if (courseId) {
    terms = terms.filter((t) => t.courseId === courseId);
  }

  return res.json({
    terms: terms.sort((a, b) => a.term.localeCompare(b.term)),
  });
});

app.post("/api/terms", (req, res) => {
  const { term, definition, context, relatedConcepts, courseId, lessonId, lessonTitle } = req.body;
  if (!term || !definition) {
    return res.status(400).json({ error: "Term and definition are required." });
  }

  const db = readDB();
  const newTerm = {
    id: `trm_${Date.now()}`,
    term: term.trim(),
    definition: definition.trim(),
    context: context || "",
    relatedConcepts: Array.isArray(relatedConcepts) ? relatedConcepts : [],
    courseId: courseId || null,
    lessonId: lessonId || null,
    lessonTitle: lessonTitle || "",
    createdAt: new Date().toISOString(),
  };

  db.keyTerms.push(newTerm);
  writeDB(db);
  return res.status(201).json({ term: newTerm });
});

app.delete("/api/terms/:id", (req, res) => {
  const db = readDB();
  db.keyTerms = db.keyTerms.filter((t) => t.id !== req.params.id);
  writeDB(db);
  return res.json({ success: true });
});

// ==========================================
// QUIZ ATTEMPTS & MATERIAL HISTORY
// ==========================================

app.post("/api/quizzes/attempt", (req, res) => {
  const { lessonId, score, totalQuestions, answers } = req.body;
  const db = readDB();
  const user = db.users[0];
  const now = new Date().toISOString();

  const attempt = {
    id: `qza_${Date.now()}`,
    lessonId,
    userId: user ? user.id : "usr_default",
    score,
    totalQuestions,
    date: now,
    answers: answers || {},
  };

  db.quizAttempts.unshift(attempt);

  // Update lesson score
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (lesson) {
    lesson.quizScore = Math.round((score / totalQuestions) * 100);
    db.activities.unshift({
      id: `act_${Date.now()}`,
      type: "quiz_taken",
      title: `Scored ${score}/${totalQuestions} on quiz for "${lesson.title}"`,
      timestamp: now,
      courseId: lesson.courseId,
      lessonId: lesson.id,
    });
  }

  writeDB(db);
  return res.status(201).json({ attempt });
});

app.get("/api/materials", (req, res) => {
  const db = readDB();
  return res.json({ materials: db.materials });
});

app.get("/api/activities", (req, res) => {
  const db = readDB();
  return res.json({ activities: db.activities.slice(0, 15) });
});

// ==========================================
// GLOBAL SEARCH ROUTE
// ==========================================

app.get("/api/search", (req, res) => {
  const query = ((req.query.q as string) || "").trim().toLowerCase();
  if (!query) {
    return res.json({ results: [] });
  }

  const db = readDB();
  const results: any[] = [];

  // 1. Search Courses
  for (const c of db.courses) {
    if (c.title.toLowerCase().includes(query) || c.description.toLowerCase().includes(query)) {
      results.push({
        id: c.id,
        type: "course",
        title: c.title,
        snippet: c.description || "Course",
        location: `Courses → ${c.category || "General"}`,
        courseId: c.id,
      });
    }
  }

  // 2. Search Lessons
  for (const l of db.lessons) {
    const course = db.courses.find((c) => c.id === l.courseId);
    const inTitle = l.title.toLowerCase().includes(query);
    const inOverview = l.structuredContent?.overview?.toLowerCase().includes(query);
    const inRaw = l.originalMaterial?.content?.toLowerCase().includes(query);

    if (inTitle || inOverview || inRaw) {
      results.push({
        id: l.id,
        type: "lesson",
        title: l.title,
        snippet: l.structuredContent?.overview || l.originalMaterial?.content?.slice(0, 120) || "Lesson",
        location: `${course ? course.title : "Course"} → ${l.title}`,
        courseId: l.courseId,
        lessonId: l.id,
      });
    }
  }

  // 3. Search Key Terms
  for (const t of db.keyTerms) {
    if (t.term.toLowerCase().includes(query) || t.definition.toLowerCase().includes(query)) {
      results.push({
        id: t.id,
        type: "term",
        title: t.term,
        snippet: t.definition,
        location: t.context || "Glossary",
        courseId: t.courseId,
        lessonId: t.lessonId,
      });
    }
  }

  // 4. Search Notes
  for (const n of db.notes) {
    if (n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)) {
      results.push({
        id: n.id,
        type: "note",
        title: n.title,
        snippet: n.content.slice(0, 120),
        location: n.courseTitle ? `${n.courseTitle} → Note` : "General Notes",
        noteId: n.id,
        courseId: n.courseId,
      });
    }
  }

  // 5. Search Raw Materials
  for (const m of db.materials) {
    if (m.title.toLowerCase().includes(query) || m.rawSnippet.toLowerCase().includes(query)) {
      results.push({
        id: m.id,
        type: "material",
        title: m.title,
        snippet: m.rawSnippet,
        location: `${m.courseTitle || "Knowledge Dump"} (${m.type})`,
        courseId: m.courseId,
        lessonId: m.lessonId,
      });
    }
  }

  return res.json({ results: results.slice(0, 30) });
});

// ==========================================
// AI ENGINE: GEMINI-3.8-FLASH INTEGRATION
// ==========================================

app.post("/api/ai/structure", async (req, res) => {
  const { rawContent, contentType, courseTitle, imageBase64, mimeType, customInstructions } = req.body;

  if (!rawContent && !imageBase64) {
    return res.status(400).json({ error: "Please provide either text content or an image to structure." });
  }

  if (!aiClient) {
    return res.status(503).json({
      error: "Gemini AI is not configured. Please ensure GEMINI_API_KEY is configured in the environment.",
      rawPreserved: true,
    });
  }

  try {
    const prompt = `You are Mindly's intelligent pedagogical structuring engine.
Transform the provided raw learning material into a structured, teachable, and digestible lesson.
Target Course Context: ${courseTitle || "General Knowledge"}
Content Type: ${contentType || "Knowledge Dump"}
${customInstructions ? `Specific Learner Focus: ${customInstructions}` : ""}

CRITICAL PRODUCT RULES:
1. "Transform raw information into teachable material" - Do NOT simply summarize.
2. Clearly distinguish what is derived directly from the user's material ("fromMaterialNotes") vs additional AI pedagogical clarifications ("aiExplanations").
3. DO NOT invent false information and attribute it to the user's source material.
4. Extract accurate key terms, meaningful examples, and subtle distinctions between easily confused concepts.
5. Provide 2-3 targeted review questions with multiple choice or true/false types, clear answers, and explanations.

Return the response strictly adhering to the JSON schema.`;

    let contentsPayload: any;

    if (imageBase64) {
      contentsPayload = {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "image/png",
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
            },
          },
          {
            text: `${prompt}\n\nAdditional transcribed/accompanying text:\n${rawContent || "No text provided, extract and structure visually from this image."}`,
          },
        ],
      };
    } else {
      contentsPayload = `${prompt}\n\nRAW LEARNING MATERIAL:\n${rawContent}`;
    }

    const response = await aiClient.models.generateContent({
      model: "gemini-3.8-flash",
      contents: contentsPayload,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Descriptive title for this lesson" },
            overview: { type: Type.STRING, description: "Concise overview explaining what this lesson teaches" },
            learningObjectives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3-4 crisp learning objectives",
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
                      required: ["title", "explanation"],
                    },
                  },
                },
                required: ["id", "title", "explanation", "subtopics"],
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
                required: ["title", "description", "fromMaterial"],
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
                required: ["conceptA", "conceptB", "distinction"],
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
                required: ["term", "definition"],
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
                required: ["id", "question", "type", "answer", "explanation"],
              },
            },
            fromMaterialNotes: {
              type: Type.STRING,
              description: "Explicit note detailing what parts were taken directly from the user's provided input",
            },
            aiExplanations: {
              type: Type.STRING,
              description: "Clarification of supplementary context provided by AI",
            },
            suggestedFurtherLearning: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            "title",
            "overview",
            "learningObjectives",
            "mainConcepts",
            "examples",
            "importantDistinctions",
            "keyTerms",
            "keyTakeaways",
            "reviewQuestions",
          ],
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No structured response generated from model.");
    }

    const structuredData = JSON.parse(textOutput);
    return res.json({ structured: structuredData });
  } catch (error: any) {
    console.error("AI Structuring Error:", error);
    return res.status(500).json({
      error: "Something went wrong while structuring your material. Your original material is safe. Please try again.",
      details: error.message,
      rawPreserved: true,
    });
  }
});

app.post("/api/ai/tutor", async (req, res) => {
  const { question, lessonContext, courseContext, originalMaterial } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Question cannot be empty." });
  }

  if (!aiClient) {
    return res.status(503).json({
      error: "Gemini AI is not configured. Please ensure GEMINI_API_KEY is available.",
    });
  }

  try {
    const prompt = `You are Mindly's personal study tutor.
The user is studying a lesson and asking a question.

RULES:
1. Prioritize the user's supplied material and lesson structure first.
2. If the user asks for a simpler explanation, provide an intuitive breakdown with a real-world analogy.
3. Be concise, clear, and encouraging. Never invent citations that do not exist in their material.
4. If something is NOT covered in their material, state: "Your current notes do not specify this directly, but in general..."

Lesson Context:
Course: ${courseContext || "Unknown"}
Lesson Title: ${lessonContext?.title || "Untitled"}
Overview: ${lessonContext?.overview || ""}
Key Concepts: ${JSON.stringify(lessonContext?.mainConcepts || [])}
Raw Material Snippet: ${originalMaterial ? originalMaterial.slice(0, 1500) : "None"}

User Question: ${question}`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    return res.json({ answer: response.text });
  } catch (err: any) {
    console.error("AI Tutor Error:", err);
    return res.status(500).json({
      error: "Could not get an answer from the tutor right now. Please try again.",
    });
  }
});

app.post("/api/ai/generate-quiz", async (req, res) => {
  const { lessonTitle, overview, mainConcepts } = req.body;

  if (!aiClient) {
    return res.status(503).json({ error: "Gemini AI is not configured." });
  }

  try {
    const prompt = `Generate 4 high-quality review questions strictly based on the following lesson material.
Include a mix of multiple_choice and true_false questions with options, the correct answer, and an educational explanation.

Lesson Title: ${lessonTitle}
Overview: ${overview}
Concepts: ${JSON.stringify(mainConcepts)}`;

    const response = await aiClient.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
            required: ["id", "question", "type", "answer", "explanation"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    return res.json({ questions: parsed });
  } catch (err: any) {
    console.error("Quiz Gen Error:", err);
    return res.status(500).json({ error: "Failed to generate review quiz." });
  }
});

// ==========================================
// VITE MIDDLEWARE & STATIC SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mindly backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
