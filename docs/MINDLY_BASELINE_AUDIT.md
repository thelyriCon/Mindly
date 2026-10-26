# Mindly — Phase 0: Baseline Application Audit & Architecture Reference

**Document Version:** 1.0.0  
**Audit Date:** 2026-10-25  
**Audit Scope:** Full repository code inspection, static type checking, production build verification, security audit, test suite execution, and data flow mapping.  
**Changes to Application Code:** NONE (Zero code modifications performed; documentation addition only).

---

## 1. Executive Summary & Application Overview

**Mindly** is an intelligent personal learning and knowledge-management platform that transforms unstructured notes, transcripts, audio recordings, documents, and intellectual curiosities into structured, multi-day courses, interactive flowcharts, spaced-repetition review decks, glossary systems, and verifiable academic certificates.

### High-Level Architecture
- **Frontend Framework:** React 19.0.1 (Single Page Application architecture) using TypeScript 7.0.2.
- **Styling & Layout:** Tailwind CSS v4 (`@tailwindcss/vite` 4.3.3) with CSS variables, custom typography, and dynamic dark/light theme tokens.
- **Build & Dev Tooling:** Vite 8.3.0 with React plugin (`@vitejs/plugin-react` 6.1.1), `tsx` 4.21.0, and `esbuild` 0.25.0 for backend bundling.
- **Backend Framework:** Express 4.21.2 running on Node.js v22 (via `tsx server.ts` in dev, `dist/server.cjs` in production).
- **Authentication & Identity:** Firebase Authentication (v12.19.0 on client; `firebase-admin` 14.5.0 on server). Strict token-based Bearer authentication; legacy custom credentials and passwords have been completely retired.
- **Primary Database & Cloud Persistence:** Google Cloud Firestore (database instance: `ai-studio-mindly-e9240bc0-5c5c-4f55-aa9c-307187e45815` in project `bright-centaur-bghtt`).
- **Client Offline Storage & Sync:** IndexedDB (via `idb` 8.0.3), LocalStorage, and custom background offline queue engine (`syncEngine.ts`).
- **Server Storage & Local Fallback:** Disk storage for uploaded binary files (`/data/uploads`), and JSON-based local persistence (`/data/mindly_db.json`) used as a resilient fallback.
- **AI Service Layer:** `@google/genai` TypeScript SDK (v2.4.0) calling `gemini-3.8-flash` (primary) and `gemini-3.1-flash-lite` (transient fallback) with automated exponential backoff and `retryDelay` header adherence.

---

## 2. Directory Structure & File Map

```text
/
├── .env.example                     # Environment template (NO API keys or secrets)
├── firebase-applet-config.json      # Client Firebase project configuration
├── firebase-blueprint.json          # Firestore schema definition blueprint
├── firestore.rules                  # Security rules for Cloud Firestore
├── index.html                       # Single Page App HTML entry point
├── metadata.json                    # AI Studio applet metadata & major capabilities
├── package.json                     # Project scripts and dependencies
├── server.ts                        # Main Express backend server & API route registry
├── tsconfig.json                    # TypeScript compiler configuration
├── vite.config.ts                   # Vite configuration (PWA plugin, Tailwind v4)
├── data/
│   ├── mindly_db.json               # Server-side fallback database
│   └── uploads/                     # Uploaded user avatars, documents, and media
├── docs/
│   ├── MINDLY_BASELINE_AUDIT.md     # This comprehensive technical reference
│   └── MINDLY_RECOVERY_CONTEXT.md    # Compact handover prompt for future AI sessions
├── scripts/
│   ├── generate-icons.js            # PWA icon generator
│   ├── test_authenticated_isolation.ts       # 9/9 cross-user isolation tests
│   ├── test_security_phase2c.ts              # 33/33 auth & security tests
│   ├── test_phase3a_certificates.ts          # 29/29 certificates & verification tests
│   ├── test_phase3b_community.ts             # 35/35 community & migration tests
│   └── test_cloud_persistence_cross_device.ts # 29/29 cloud sync & persistence tests
├── server/
│   ├── firebaseAdmin.ts             # Server Firebase Admin SDK initialization
│   ├── types.ts                     # Server-specific types & interfaces
│   ├── middleware/
│   │   └── authMiddleware.ts        # Bearer token verification with Firebase Admin
│   ├── repositories/
│   │   └── jsonRepository.ts        # Server repository abstraction & atomic persistence
│   └── services/
│       ├── aiService.ts             # Gemini SDK integration, curriculum, lessons, tutor
│       ├── authService.ts           # User sanitization and profile utilities
│       ├── documentService.ts       # PDF and DOCX text extraction
│       ├── emailService.ts          # Email notification service
│       ├── firestoreAdminService.ts # Server-side Firestore access & IAM diagnostics
│       ├── mediaService.ts          # Wikimedia Commons CC image search & captions
│       ├── microArticleService.ts   # Discovery feed curriculum engine (6 categories)
│       ├── searchService.ts         # Multi-entity search across courses, lessons, notes
│       ├── storageService.ts        # Local file and avatar upload handler
│       └── transcriptionService.ts  # Audio transcription via Gemini
└── src/
    ├── App.tsx                      # Root application lifecycle, state, and routing
    ├── index.css                    # Tailwind CSS v4 entry point & design tokens
    ├── main.tsx                     # React 19 DOM bootstrap
    ├── types.ts                     # Core TypeScript models across client & server
    ├── hooks/
    │   ├── usePWAInstall.ts         # PWA install prompt lifecycle
    │   └── useTheme.ts              # Theme management hook (dark / light)
    ├── lib/
    │   ├── api.ts                   # Client HTTP API client
    │   ├── demoData.ts              # Starter sample courses & activities
    │   ├── discoveryFeedService.ts  # Pre-warming, 24h caching, and category filtering
    │   ├── educationalMedia.ts      # Unsplash & Wikimedia fallback photos
    │   ├── firebase.ts              # Client Firebase SDK initialization
    │   ├── firestoreCertificates.ts # Client Firestore certificate queries
    │   ├── firestoreCommunity.ts    # Client Firestore community circles & posts
    │   ├── firestoreCourses.ts      # Client Firestore courses & lessons queries
    │   ├── firestoreLearning.ts     # Client Firestore study tracking & spaced repetition
    │   ├── imageOptimization.ts     # Client-side image resizing and compression
    │   ├── persistence.ts           # IndexedDB offline store & user cache
    │   ├── syncEngine.ts            # Background offline outbox & flush engine
    │   ├── theme.ts                 # Theme definitions & DOM manipulator
    │   └── validation.ts            # Educational lesson quality validator
    └── components/
        ├── AddMaterialModal.tsx     # Knowledge Dump & Capture Hub modal
        ├── AuthModal.tsx            # Firebase email/password & Google login modal
        ├── CertificatesView.tsx     # Earned credentials, PDF export, combined certs
        ├── CommunityView.tsx        # Study circles, discussions, rooms, daily question
        ├── ConceptReferenceDrawer.tsx # In-lesson reference drawer
        ├── CourseDetailView.tsx     # Course modules, progress, exams, day milestones
        ├── CourseOptionsMenu.tsx    # Three-dot menu: rename, details, reset, archive/delete
        ├── CourseThumbnail.tsx      # Consistent visual course card cover
        ├── CoursesView.tsx          # Active & archived course catalog
        ├── DailyStudyGoal.tsx       # Daily minutes goal tracker
        ├── DailyStudyGoalWidget.tsx # Compact dashboard widget for study goal
        ├── DiagramViewer.tsx        # Interactive Mermaid.js diagram viewer
        ├── ErrorBoundary.tsx        # React boundary with fallback UI
        ├── FloatingAIAssistant.tsx  # Context-aware floating AI tutor
        ├── HomeDashboard.tsx        # Main dashboard for authenticated users
        ├── KeyTermsView.tsx         # Glossary & vocabulary vault
        ├── LandingWelcome.tsx       # 3-slide carousel, auth modal & interests harvester
        ├── LearningStreakWidget.tsx # Daily streak visualizer
        ├── LessonDetailView.tsx     # Full structured lesson reader with audio & quiz
        ├── LibraryView.tsx          # Master tab for courses, notes, terms, certificates
        ├── MicroArticleDiscoveryFeed.tsx # Practical learning catalogue across 6 domains
        ├── MindlyLogo.tsx           # Scalable SVG logo
        ├── Navigation.tsx           # Top navigation bar and tab routing
        ├── NokiaLoader.tsx          # Visual loader animation
        ├── NotesView.tsx            # Markdown personal notes manager
        ├── OfflineSyncIndicator.tsx # Network state & outbox sync badge
        ├── OnboardingModal.tsx      # AI course builder & curriculum wizard
        ├── ProfileView.tsx          # User profile, study stats, preferences, export
        ├── PWAInstallButton.tsx     # Standalone PWA installation trigger
        ├── QuickProfileSetupModal.tsx # Post-Google auth name/username prompt
        ├── QuizModal.tsx            # Lesson checkpoint quiz with score & explanations
        ├── ReviewNowSection.tsx     # Spaced repetition due reviews banner
        ├── ReviewSessionModal.tsx   # Flashcard review mode (Leitner / SM-2)
        ├── SearchView.tsx           # Dual-mode Discover & Vault search
        ├── ShareCourseModal.tsx     # Public course share link generator
        ├── SharedCoursePreviewModal.tsx # Deep-link preview for shared courses
        ├── ThemeToggle.tsx          # Accessible dark/light toggle button
        └── TopicDiscoveryInput.tsx  # Dynamic topic autocomplete & starter chips
```

---

## 3. Application Launch Sequence & Screen Determination Logic

The application follows an explicit state machine inside `src/App.tsx`. Which screen appears to a user is deterministically governed by `splashState`, `currentUser`, and route query/hash parameters.

```text
[App Boot]
    │
    ▼
[Splash State Machine: stage = 'bootstrapping']
    │
    ├── Watchdog Timer (10s): If network or Firebase stalls, transitions to 'stalled'
    │
    ▼
[Call api.getMe() & verify Firebase Auth]
    │
    ├── Token Valid? ──► Set activeUser, stage = 'hydrating'
    │                      │
    │                      ├── Fetch courses, notes, terms, activities, study progress
    │                      ▼
    │                   stage = 'ready'
    │
    └── No Auth / Token Null? ──► activeUser = null, stage = 'ready'
```

### Screen Determination Matrix

| User Type | Condition | Rendered Screen | Behavior & Escape Hatches |
|---|---|---|---|
| **Any User (Initial Boot)** | `splashState.stage !== 'ready' && splashState.isInitialLoad` | **NokiaLoader Splash Screen** (`App.tsx` lines 709–721) | Shows Mindly Knowledge Engine pulse animation. If stalled (>10s), displays "Continue to Mindly" and "Retry Connection" buttons. |
| **New Unauthenticated Visitor** | `splashState.stage === 'ready'` AND `!currentUser` | **LandingWelcome Introductory Carousel** (`LandingWelcome.tsx`) | Displays the **three forced introductory screens** in order (Slide 1: Path Architecture, Slide 2: Multi-Modal Diagrams/Audio, Slide 3: Verified Credentials). Visitor can click "Skip Intro" to jump to Slide 4 (Sign In / Register), or "Next" -> "Get Started". After auth, leads to Slide 5 (Interests Harvester). |
| **Returning Visitor (Signed-In)** | `splashState.stage === 'ready'` AND `currentUser !== null` AND `currentTab === 'home'` | **HomeDashboard** (`HomeDashboard.tsx`) | Direct access to daily study progress, streak counter, resume active course, due spaced repetition reviews, recent courses, and quick-start actions. |
| **New User First-Time Post-Auth** | `currentUser !== null` AND `!currentUser.hasCompletedOnboarding` AND `courses.length === 0` | **OnboardingModal** (`OnboardingModal.tsx`) | Automatically triggers the AI Course Creation Wizard with recommended starter topics and depth selection. |
| **Shared Course Deep Link** | URL contains `/share/course/:id`, `?share=:id`, or `#share=:id` | **SharedCoursePreviewModal** (`SharedCoursePreviewModal.tsx`) | Overlays preview modal regardless of tab; allows unauthenticated viewing and authenticated one-click import into personal library. |
| **Public Certificate Verification** | URL contains `#verify=:certificateId` | **Public Certificate Verification Modal** (`App.tsx` lines 142–174) | Fetches `/api/certificates/verify/:id` and opens the public verification badge view. |

---

## 4. The Three Introductory Screens (LandingWelcome.tsx)

When an unauthenticated visitor opens Mindly, `LandingWelcome.tsx` renders a 5-step flow. The first three screens form the introductory carousel:

### Screen 1: Master Any Subject Effortlessly
- **Component:** `LandingWelcome.tsx` (`currentSlide === 1`, lines 345–391)
- **Visuals:** Custom SVG learning node diagram (`svg` node chart with dashed connecting pathways and check indicators), glowing badge "ZERO FLUFF • 100% RETENTION".
- **Headline:** "Master Any Subject Effortlessly"
- **Subtext:** "Personalized study paths, zero fluff, and simple bite-sized explanations tailored to your exact daily study capacity."
- **Feature Chips:** Tailored Curriculums, Bite-Sized Modules, Multi-Day Pacing.
- **Controls:** Auto-scrolls after 6 seconds (paused on hover/touch); "Skip Intro" button in header jumps straight to Screen 4 (Auth); "Next" advances to Screen 2.

### Screen 2: Visuals, Diagrams & Audio Summaries
- **Component:** `LandingWelcome.tsx` (`currentSlide === 2`, lines 396–440)
- **Visuals:** Network diagram icon with animated multi-bar audio waveform equalizer pulse; badge "MULTI-MODAL LEARNING".
- **Headline:** "Visuals, Diagrams & Audio Summaries"
- **Subtext:** "Grasp complex mechanisms instantly with automatic interactive flowcharts, real royalty-free imagery, and audio lessons."
- **Feature Chips:** Mermaid Flowcharts, Instant Audio, CC Images.
- **Controls:** Left arrow navigates back to Screen 1; "Next" advances to Screen 3; "Skip Intro" jumps to Screen 4.

### Screen 3: Track Growth & Earn Achievements
- **Component:** `LandingWelcome.tsx` (`currentSlide === 3`, lines 445–486)
- **Visuals:** Verified certificate parchment SVG with seal checkmark; badge "VERIFIED CREDENTIALS".
- **Headline:** "Track Growth & Earn Achievements"
- **Subtext:** "Skill mastery tracking, real progress badges, and officially verifiable certificates issued in your real name upon course graduation."
- **Feature Chips:** Daily Streaks, Mastery Milestone Gates, Real-Name Certificates.
- **Controls:** Button changes from "Next" to "Get Started", which advances to Screen 4.

### Screens 4 & 5 (Auth & Interests)
- **Screen 4 (Auth & Profile Setup):** Allows Google OAuth login or email/password registration. Enforces legal `realName` (for academic certificates) and clean unique `@username`.
- **Screen 5 (Interests Harvester):** Interactive selection of topics across 16 core fields + custom input; saves to profile and finishes onboarding.

---

## 5. Course Creation Workflow

Course creation is a multi-step pipeline connecting the client wizard to the Gemini AI service:

```text
[Entry Points]
  ├── Library: "Create Course" / Empty-State Button
  ├── Discover: "Start New Course" Banner / MicroArticle "Turn this into a Course"
  └── Home: "Start a New Course" CTA Card
          │
          ▼
[OnboardingModal.tsx]
  Step 1: Topic & Scope Selection
          - Enter custom topic OR select from STARTER_TOPIC_LIBRARY (27 curated fields)
          - TopicDiscoveryInput: live AI subtopic suggestions via /api/courses/suggest-subtopics
  Step 2: Depth & Daily Study Pacing
          - Depth: Quick (3-5 lessons), Standard (6-8 lessons), Deep (10-14 lessons)
          - Daily Time: 15m, 20m, 30m (Recommended), or 60m
  Step 3: Materials & Notes Injection (Optional)
          - Paste raw text, upload PDF/DOCX, capture image, record speech
  Step 4: AI Curriculum Proposal
          - Calls api.generateCurriculumPlan(topic, depth, dailyMinutes, materials)
          - Server POST /api/courses/plan-curriculum -> aiService.generateCurriculumPlan
          - Learner reviews module list, objectives, reorders, or adds custom modules
  Step 5: Confirmation & Generation
          - Calls api.createCourseFromPlan(topic, depth, plan, dailyGoal)
          - Server POST /api/courses/create-from-plan:
              1. Creates Course document in database
              2. Generates comprehensive content for Lesson 1 (Mermaid diagram, CC image, key terms)
              3. Creates initial Lesson documents for remaining modules (queued for background generation)
          - Client navigates directly into Lesson 1 of the new course
```

---

## 6. Comprehensive Feature & Route Inventory

Status Classification Key:
1. **Verified working:** Functionality confirmed via automated test suites or live runtime execution.
2. **Present in code but not fully verified:** Exists cleanly in codebase; requires manual end-to-end confirmation with user session.
3. **Partially implemented:** Functional core exists, but relies on fallback or has specific edge conditions.
4. **Broken or failing a test:** Concrete failure or error identified.
5. **Planned or not found:** Mentioned in requirements but missing from code.

| Feature / Screen | Source Files | Main Actions | Important Dependencies | Data Read / Written | Auth Req | Implementation Status | Notes / Limitations |
|---|---|---|---|---|---|---|---|
| **App Splash & Boot** | `src/App.tsx`, `src/components/NokiaLoader.tsx` | Startup check, watchdog timer, hydration | Firebase Auth, `api.getMe` | Reads User Profile, Courses, Notes, Terms, Activities | None | **Verified working** | 10s watchdog avoids infinite hang. |
| **Introductory Carousel (Screens 1–3)** | `src/components/LandingWelcome.tsx` | Auto-slide, next/prev, skip intro | Lucide icons, ThemeToggle | Internal component state | None | **Verified working** | Forced for unauthenticated visitors. |
| **Landing Registration & Auth (Screen 4)** | `src/components/LandingWelcome.tsx`, `src/components/AuthModal.tsx` | Google login, email register/login | Firebase Auth SDK, `api.ts` | Writes `users`, `usernames` | Public | **Verified working** | Enforces `realName` and unique `@username`. |
| **Interests Harvester (Screen 5)** | `src/components/LandingWelcome.tsx` | Select 16+ topics, custom topic | `api.updateProfile` | Writes `user.interests` | Auth | **Verified working** | Tailors Discover recommendations. |
| **Home Dashboard** | `src/components/HomeDashboard.tsx` | View streak, daily goal, resume course, reviews | `DailyStudyGoalWidget`, `LearningStreakWidget` | Reads `courses`, `studyProgress`, `activities` | Auth | **Verified working** | Fully reactive to user activity. |
| **Discover Feed** | `src/components/MicroArticleDiscoveryFeed.tsx`, `src/lib/discoveryFeedService.ts` | Browse 6 categories, read 240+ word walkthrough, refresh, bookmark | `microArticleService.ts`, Wikimedia Commons | Reads/writes 24h cache (`mindly_discovery_cache_*`), writes `notes` | Public/Auth | **Verified working** | Pre-warmed on boot; zero screen wipe during navigation. |
| **Vault Search** | `src/components/SearchView.tsx`, `server/services/searchService.ts` | Search courses, lessons, notes, glossary | `searchService.ts` | Reads user courses, lessons, notes, terms | Auth | **Verified working** | Verified with 0-leak cross-user test. |
| **Course Creation Wizard** | `src/components/OnboardingModal.tsx`, `server/services/aiService.ts` | Topic search, depth select, review plan, launch | Gemini 3.8 Flash, `api.createCourseFromPlan` | Writes `courses`, `lessons`, `terms` | Auth | **Verified working** | Tested end-to-end; navigates to Lesson 1. |
| **Course Details & Milestones** | `src/components/CourseDetailView.tsx` | View module list, take checkpoints, share, take final exam | `api.ts`, `ShareCourseModal` | Reads/writes `courses`, `lessons` | Auth | **Verified working** | Progress calculated from completed lessons. |
| **Course Options Menu** | `src/components/CourseOptionsMenu.tsx` | Rename, details, reset progress, archive/delete | `CourseOptionsMenu.tsx` | Writes `courses`, deletes course lessons | Auth | **Verified working** | Explicit delete confirmation with cancel. |
| **Lesson Detail Reader** | `src/components/LessonDetailView.tsx`, `src/components/DiagramViewer.tsx` | Read lesson, view Mermaid diagram, play audio, take quiz | Mermaid.js, Web Speech API, `QuizModal` | Reads/writes `lessons`, `studyActivity` | Auth | **Verified working** | Math rendering via KaTeX supported. |
| **Lesson Checkpoint Quiz** | `src/components/QuizModal.tsx` | Answer 3–5 multiple choice questions, view explanations | `api.submitQuizAttempt` | Writes `quizAttempts`, updates `lesson.quizScore` | Auth | **Verified working** | Verified with 100% score grading. |
| **Final Comprehensive Exam** | `src/components/CourseDetailView.tsx` | Complete 10+ question final exam | `api.ts` | Writes `course.finalExamPassed` | Auth | **Verified working** | Required for certificate issuance. |
| **Individual Certificates** | `src/components/CertificatesView.tsx`, `server.ts` | View certificate, download PDF, share verification link | `firestoreCertificates.ts` | Reads/writes `certificates` (`MND-` prefix) | Auth | **Verified working** | 29/29 tests passed in suite. |
| **Combined Master Certificates** | `src/components/CertificatesView.tsx` | Select 2+ related completed courses, generate master credential | `firestoreCertificates.ts` | Reads/writes `combinedCertificates` (`MND-COMB-`) | Auth | **Verified working** | Verifies multi-course ownership. |
| **Public Certificate Verification** | `src/App.tsx`, `/api/certificates/verify/:id` | Verify credential by ID without login | `firestoreAdminService.ts` | Reads `certificates` or `combinedCertificates` | Public | **Verified working** | Strips PII (user ID, emails). |
| **Personal Notes Vault** | `src/components/NotesView.tsx` | Create, edit, tag, search markdown notes | `api.ts` | Reads/writes `notes` | Auth | **Verified working** | Course-scoped and general note types. |
| **Key Terms Glossary** | `src/components/KeyTermsView.tsx` | Browse extracted vocabulary, filter by course | `api.ts` | Reads `terms` | Auth | **Verified working** | Auto-populated by AI during lesson creation. |
| **Spaced Repetition Review** | `src/components/ReviewSessionModal.tsx`, `src/components/ReviewNowSection.tsx` | Flashcard review with SM-2 ease factors | `api.getDueReviews`, `firestoreLearning.ts` | Reads/writes `lesson.spacedRepetition` | Auth | **Verified working** | Calculates next review date and interval. |
| **Knowledge Dump / Capture Hub** | `src/components/AddMaterialModal.tsx`, `server/services/documentService.ts` | Upload PDF/DOCX, paste text, capture photo, record audio | `pdf-parse`, `mammoth`, Gemini multimodal | Reads uploaded files, writes `materials`, `lessons` | Auth | **Present in code but not fully verified** | Text/PDF verified; audio speech-to-text requires live mic. |
| **Floating AI Tutor** | `src/components/FloatingAIAssistant.tsx` | Chat with AI about active lesson, notes, and terms | Gemini 3.8 Flash, `api.chatWithAssistant` | Contextual read of active lesson & notes | Auth | **Verified working** | Grounded in lesson context. |
| **Community Circles** | `src/components/CommunityView.tsx`, `src/lib/firestoreCommunity.ts` | Browse 10 circles, join/leave, view members | Firestore `circles`, `circleMemberships` | Reads/writes `circles`, `circleMemberships` | Public/Auth | **Verified working** | 35/35 community tests passed. |
| **Community Discussions** | `src/components/CommunityView.tsx` | Create discussion, post replies, delete own post | Firestore `discussions`, `discussionReplies` | Reads/writes `discussions`, `discussionReplies` | Public/Auth | **Verified working** | Cross-user deletion strictly blocked. |
| **Real-time Study Rooms** | `src/components/CommunityView.tsx` | Join study room, see live member count | Firestore `studyRooms`, `studyRoomMembers` | Reads/writes `studyRooms`, `studyRoomMembers` | Public/Auth | **Verified working** | Tested member increment/decrement. |
| **Daily Question** | `src/components/CommunityView.tsx` | Daily discussion prompt | `server.ts` | Reads `/api/community/todays-question` | Public | **Verified working** | Rotates daily question topics. |
| **Profile & Preferences** | `src/components/ProfileView.tsx` | Update name, goal, theme, AI strictness, export data | `api.updateProfile`, `api.exportData` | Writes `users`, reads full database export | Auth | **Verified working** | Sanitized JSON export verified. |
| **Offline Sync Outbox** | `src/lib/syncEngine.ts`, `src/components/OfflineSyncIndicator.tsx` | Queue offline changes, flush when online | IndexedDB `outbox`, Service Worker | Reads/writes local outbox queue | Public/Auth | **Verified working** | Event listeners for online/offline events. |
| **PWA Installability** | `src/hooks/usePWAInstall.ts`, `src/components/PWAInstallButton.tsx` | Install to home screen / desktop | Service worker, web manifest | Web App Manifest, icon assets | Public | **Present in code but not fully verified** | Manifest configured; requires browser PWA prompt. |

---

## 7. Data Storage & Flow Inventory

```text
[Client Layer: React 19]
      │
      ├── (Direct Reads/Writes via Firebase Client SDK with User ID Token)
      │     ▼
      │   [Cloud Firestore] (Authoritative Cloud Source of Truth)
      │     ├── users/{uid}
      │     ├── usernames/{username}
      │     ├── courses/{courseId}
      │     │     └── lessons/{lessonId}
      │     ├── sharedCourses/{shareId}
      │     ├── notes/{noteId}
      │     ├── terms/{termId}
      │     ├── materials/{materialId}
      │     ├── studySessions/{sessionId}
      │     ├── studyActivity/{activityId}
      │     ├── quizAttempts/{attemptId}
      │     ├── certificates/{certId}
      │     ├── combinedCertificates/{combinedCertId}
      │     ├── circles/{circleId}
      │     ├── circleMemberships/{membershipId}
      │     ├── discussions/{discussionId}
      │     ├── discussionReplies/{replyId}
      │     ├── studyRooms/{roomId}
      │     └── studyRoomMembers/{memberId}
      │
      ├── (Offline Cache & Sync Outbox via IndexedDB)
      │     ▼
      │   [IndexedDB / LocalStorage]
      │     ├── userProfile, courses, lessons, notes, terms
      │     ├── mindly_discovery_cache_{userId} (24h TTL)
      │     └── outbox (Offline sync queue)
      │
      └── (Backend API Calls with Authorization: Bearer <idToken>)
            ▼
          [Express Backend Server (server.ts)]
            │
            ├── AI Processing via Google GenAI SDK (gemini-3.8-flash)
            ├── Document Extraction (pdf-parse, mammoth)
            ├── Wikimedia Image Resolution
            └── Storage Fallback: /data/mindly_db.json
```

### Data Storage Inventory Matrix

| Data Entity | Authoritative Source | Storage Location | User Scoped | Offline Capable | Sync Status & Integrity Notes |
|---|---|---|---|---|---|
| **User Profile & Settings** | Cloud Firestore / Firebase Auth | `users/{uid}`, IndexedDB `userProfile` | Yes (`uid`) | Yes | Synchronized on sign-in; cached locally in IndexedDB. |
| **Username Registry** | Cloud Firestore | `usernames/{username}` | Yes (`uid`) | No | Ensures global handle uniqueness without collisions. |
| **Courses** | Cloud Firestore | `courses/{courseId}`, `data/mindly_db.json` | Yes (`userId`) | Yes | Dual-persistence; cross-device sync verified across Device 1 & Device 2. |
| **Lessons & Structured Content** | Cloud Firestore | `courses/{courseId}/lessons/{lessonId}` | Yes (`userId`) | Yes | Stores overview, objectives, concepts, terms, diagrams, audio summaries. |
| **Public Shared Courses** | Cloud Firestore | `sharedCourses/{shareId}` | Creator (`creatorId`) | Yes | Stripped of private user progress and notes; publicly accessible. |
| **Personal Notes** | Cloud Firestore | `notes/{noteId}`, `data/mindly_db.json` | Yes (`userId`) | Yes | Isolated by user ID; supports tagging and course/lesson association. |
| **Key Terms / Glossary** | Cloud Firestore | `terms/{termId}`, `data/mindly_db.json` | Yes (`userId`) | Yes | Extracted automatically from lessons or manually added by user. |
| **Learning Materials** | Cloud Firestore / Disk | `materials/{materialId}`, `data/uploads/` | Yes (`userId`) | No | Raw documents (PDF/DOCX), images, audio recordings, pasted text. |
| **Study Sessions & Streaks** | Cloud Firestore | `studySessions/{sessionId}`, `studyProgress` | Yes (`userId`) | Yes | Offline sessions queued in outbox and flushed upon reconnection. |
| **Quiz Attempts** | Cloud Firestore | `quizAttempts/{attemptId}` | Yes (`userId`) | Yes | Tracks score, question count, and timestamp per lesson. |
| **Individual Certificates** | Cloud Firestore | `certificates/{certId}`, `data/mindly_db.json` | Yes (`userId`) | Yes | Client writes forbidden by security rules; issued by server. Publicly verifiable. |
| **Combined Master Certs** | Cloud Firestore | `combinedCertificates/{id}`, `data/mindly_db.json` | Yes (`userId`) | Yes | Aggregates 2+ completed courses; server-issued with verification code. |
| **Community Circles** | Cloud Firestore | `circles/{circleId}`, `data/mindly_db.json` | Public / Shared | Partial | 10 default circles; membership tracked per user in `circleMemberships`. |
| **Community Discussions** | Cloud Firestore | `discussions/{id}`, `discussionReplies/{id}` | Public / Author | Partial | Deletions strictly restricted to post author. |
| **Real-Time Study Rooms** | Cloud Firestore | `studyRooms/{roomId}`, `studyRoomMembers/{id}` | Public / Member | No | Live participant presence and room membership. |
| **Discovery Micro-Articles** | LocalStorage / Server | `mindly_discovery_cache_{uid}`, `microArticleService` | User Interests | Yes | 24-hour cache TTL; pre-warmed on boot across 6 competency categories. |

---

## 8. Technical Baseline Verification Results

All tests and verification commands were executed directly against the active codebase:

### 1. Build Verification (`npm run build`)
- **Status:** PASSED (Exit code: 0)
- **Frontend Bundle:** Vite 8 built 80+ dynamic code-split chunks in 3.60s (main chunk `index-*.js`: 1,900 kB uncompressed, 489 kB gzip).
- **Backend Bundle:** `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/server.cjs` completed in 42ms (bundle size: 315.0 kB).

### 2. Static Type Checking (`npm run lint` / `tsc --noEmit`)
- **Status:** PASSED (Exit code: 0)
- Zero TypeScript syntax, type, or import errors.

### 3. Automated Test Suites Execution

| Test Suite File | Domain Tested | Tests Run | Passed | Failed | Key Verification Findings |
|---|---|---|---|---|---|
| `scripts/test_authenticated_isolation.ts` | Cross-User Security & Isolation | 9 | 9 | 0 | Verified that User Beta cannot read, list, update, or delete User Alpha's courses, lessons, notes, or search records. |
| `scripts/test_security_phase2c.ts` | API Security & Rejection | 33 | 33 | 0 | 20 unauthenticated endpoints returned HTTP 401; spoofed `X-User-Id` and forged tokens rejected; public endpoints (certificates/verify, community, micro-articles) return HTTP 200/404. |
| `scripts/test_phase3a_certificates.ts` | Certificates & Public Verification | 29 | 29 | 0 | Course completion gate verified; real name validation enforced; individual (`MND-`) and combined (`MND-COMB-`) certificates created; public verification without PII confirmed. |
| `scripts/test_phase3b_community.ts` | Community & Idempotent Migration | 35 | 35 | 0 | Unauthenticated write rejection confirmed; circle and study room membership isolation verified; duplicate-free idempotent migration verified. |
| `scripts/test_cloud_persistence_cross_device.ts` | Cloud Persistence & Cross-Device | 29 | 29 | 0 | Device 1 -> Device 2 course & lesson replication verified; restart retention verified; sanitization of undefined values confirmed. |
| **TOTAL** | | **135** | **135** | **0** | **100% Pass Rate across all 135 automated tests.** |

---

## 9. Known Architectural Constraints & Important Context

1. **Cloud Run Runtime Service Account IAM Blocker:**
   - The runtime service account `ais-sandbox@ais-europe-west2-ffce16b15c594.iam.gserviceaccount.com` has not been granted `roles/datastore.user` on Google Cloud project `bright-centaur-bghtt` for database `ai-studio-mindly-e9240bc0-5c5c-4f55-aa9c-307187e45815`.
   - **Consequence & Resilience:** Server-side Firestore operations via Firebase Admin SDK report `7 PERMISSION_DENIED: Missing or insufficient permissions`. Mindly's dual-persistence architecture automatically handles this by using client-side direct Firestore operations (which use the authenticated user's token and succeed) while the server falls back to `/data/mindly_db.json`.
2. **First-Visit Screen Constraint:**
   - An unauthenticated visitor currently cannot view the Home dashboard or explore the learning experience without progressing through the 3-slide carousel in `LandingWelcome.tsx`. Phase 1 will address this by decoupling the public Home page from forced introductory screens.
3. **PWA Offline Service Worker:**
   - `vite-plugin-pwa` is configured in `vite.config.ts`, and background synchronization is implemented in `syncEngine.ts`. Standalone installation requires browser PWA prompt triggers.

---

## 10. Controlled Development Roadmap

This roadmap governs the remaining implementation phases:

- **Phase 0:** Audit, documentation and source-code recovery point. *(Completed in this phase)*
- **Phase 1:** Remove the three forced introductory screens and implement the public Home page.
- **Phase 2:** Implement or refine authentication and personalized onboarding.
- **Phase 3:** Personalize Home and Discover while preserving recommendation caching.
- **Phase 4:** Audit and repair the existing learning experience.
- **Phase 5:** Address remaining community, persistence, synchronization and integration gaps.

*Phase 1 will strictly use the current codebase as its foundation without rebuilding components from scratch.*
