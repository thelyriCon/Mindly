import { User, Course, Lesson, Note, KeyTermItem, ActivityItem, StudyProgress } from '../types';

export function getDemoDatabase() {
  const defaultUserId = "usr_demo_icon";
  const defaultCourseId = "crs_market_structure";
  const now = new Date().toISOString();

  const demoCourse: Course = {
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

  const demoLessons: Lesson[] = [
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
        ],
        keyTakeaways: [
          "Do not chase the Higher High; wait patiently for the Higher Low.",
          "A Higher Low is only legally confirmed when the previous high is broken.",
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

  const demoNotes: Note[] = [
    {
      id: "nt_demo_1",
      userId: defaultUserId,
      courseId: defaultCourseId,
      lessonId: "lsn_intro_ms",
      title: "Core Rule: Never Trade Against Macro BOS",
      content: `# Golden Rule for Market Structure\n- Always check the 4-Hour and Daily charts first to mark major swing points.\n- 15-minute chops will mislead you into false BOS signals.\n- If 4H is Bullish (making HH and HL), only look for long setups on 15m discount retracements.\n- Checklist before entry:\n  - [x] Major trend identified\n  - [x] Protected low intact\n  - [ ] Retracement entered discount zone\n  - [ ] Confirmed lower timeframe reaction`,
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
      title: "General Study Philosophy: The Knowledge Dump",
      content: `# Mindly Core Principle\nBring messy notes, YouTube transcripts, and screenshot dumps here first.\nLet AI structure the concepts into teachable lessons, then review and edit.\nAlways preserve the original raw material so you can cross-check definitions.`,
      tags: ["meta", "study-habits"],
      type: "general",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const demoTerms: KeyTermItem[] = [
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

  const demoActivities: ActivityItem[] = [
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

  const defaultUser: User = {
    id: defaultUserId,
    name: "iCon",
    email: "icon@mindly.app",
    interests: ["Trading", "Programming", "Cognitive Science"],
    createdAt: now,
    hasCompletedOnboarding: true,
    dailyStudyGoalMinutes: 30,
    settings: {
      theme: "dark",
      fontSize: "normal",
      aiStrictness: "strict_material_only",
      dailyStudyGoalMinutes: 30,
    },
  };

  const demoProgress: StudyProgress = {
    dailyGoalMinutes: 30,
    todaySeconds: 12 * 60,
    todayMinutes: 12,
    progressPercent: 40,
    streakDays: 3,
    remainingMinutes: 18,
    isGoalReached: false,
  };

  return {
    user: defaultUser,
    courses: [demoCourse],
    lessons: demoLessons,
    notes: demoNotes,
    terms: demoTerms,
    activities: demoActivities,
    progress: demoProgress,
  };
}
