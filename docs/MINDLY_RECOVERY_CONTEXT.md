# Mindly — AI Recovery & Handover Context

> **How to use this file:** If a future conversation or compaction occurs, or if an AI modification breaks functionality, copy the contents of this document into your system prompt or initial turn. It contains the exact technical baseline, non-negotiable invariants, verified features, and Phase 1 constraints needed to resume work without rebuilding the application from scratch.

---

## 1. What Mindly Is & Current Architecture

**Mindly** is an AI-powered personal learning and knowledge-management web application. It transforms raw materials (documents, transcripts, images, audio, voice notes) and intellectual topics into structured courses, interactive Mermaid.js diagrams, spaced-repetition flashcards, glossary terms, and verifiable academic certificates.

### Stack & Architecture
- **Frontend:** React 19 SPA, TypeScript, Vite 8, Tailwind CSS v4.
- **Backend:** Express 4 on Node.js running via `tsx server.ts` (dev) on port 3000, compiled to `dist/server.cjs` via `esbuild` for production.
- **Authentication:** Firebase Authentication (v12 client SDK; `firebase-admin` v14 server SDK). Legacy passwords and sessions have been retired. All authenticated API calls send `Authorization: Bearer <idToken>`.
- **Database & Cloud Storage:**
  - Google Cloud Firestore (`bright-centaur-bghtt`, database ID: `ai-studio-mindly-e9240bc0-5c5c-4f55-aa9c-307187e45815`).
  - IndexedDB (via `idb`) for offline course/lesson storage and sync outbox.
  - Server fallback: `/data/mindly_db.json` and `/data/uploads`.
- **AI Service:** `@google/genai` TypeScript SDK (v2.4.0) with `gemini-3.8-flash` (primary) and `gemini-3.1-flash-lite` (fallback), wrapped in `callGeminiWithRetry` with exponential backoff and `retryDelay` header parsing.

---

## 2. Launch Flow & Introductory Screens

### Deterministic State Machine (`src/App.tsx`)
1. **Boot:** `splashState` starts at `'bootstrapping'`, calling `api.getMe()`. A 10-second watchdog timer prevents hangs if Firebase or network is unresponsive.
2. **If `auth.currentUser` is null (Unauthenticated Visitor):**
   - Renders `LandingWelcome.tsx`.
   - The user is currently shown the **three forced introductory screens** in a carousel before reaching auth:
     - **Slide 1:** "Master Any Subject Effortlessly" (Personalized study architecture, bite-sized modules, multi-day pacing).
     - **Slide 2:** "Visuals, Diagrams & Audio Summaries" (Flowcharts, instant audio, CC images).
     - **Slide 3:** "Track Growth & Earn Achievements" (Daily streaks, mastery gates, real-name certificates).
     - **Slide 4:** Sign In / Register (Google OAuth or email/password). Enforces legal `realName` and unique `@username`.
     - **Slide 5:** Intellectual Interests Harvester (16+ subjects).
3. **If `auth.currentUser` exists (Authenticated Learner):**
   - Hydrates user profile from Firestore/IndexedDB, loads courses, notes, terms, activities, study progress.
   - Renders `Navigation.tsx` and the active tab:
     - `'home'` -> `HomeDashboard.tsx`
     - `'library'` (with sub-tabs `'courses'`, `'notes'`, `'terms'`, `'certificates'`)
     - `'search'` -> `SearchView.tsx` (Toggle between "Discover New Subjects" and "Search My Vault")
     - `'community'` -> `CommunityView.tsx` (Circles, Discussions, Rooms, Daily Question)
     - `'profile'` -> `ProfileView.tsx`
   - If user has not completed onboarding and has 0 courses: triggers `OnboardingModal.tsx`.

---

## 3. Core Workflows & Invariants (DO NOT BREAK)

### A. AI Course Creation Pipeline (`OnboardingModal.tsx` + `aiService.ts`)
- **DO NOT** replace `OnboardingModal.tsx` with manual blank course creation forms.
- The pipeline consists of:
  1. Topic entry or selection from `STARTER_TOPIC_LIBRARY` (27 topics).
  2. Course depth selection:
     - `quick` (3–5 lessons)
     - `standard` (6–8 lessons)
     - `deep` (10–14 lessons)
  3. Daily study time: 15m, 20m, 30m, 60m.
  4. Optional materials ingestion (text, PDF, DOCX, image, audio).
  5. AI curriculum generation via `POST /api/courses/plan-curriculum`.
  6. Plan review & confirmation via `POST /api/courses/create-from-plan`.
  7. Automatic generation of Lesson 1 with interactive Mermaid flowchart diagram, CC image from Wikimedia Commons, key terms, and immediate navigation into Lesson 1.

### B. Course Options Menu (`CourseOptionsMenu.tsx`)
- Every course card displays a vertical three-dot menu (⋮).
- Menu items: Open Course, Rename Course, View Course Details, Reset Progress, and Archive / Delete.
- Archive / Delete triggers an explicit confirmation dialog with separate "Archive Course" and "Permanently Delete" buttons (with Cancel). It never deletes on click.

### C. Discovery Feed & Caching (`MicroArticleDiscoveryFeed.tsx` + `discoveryFeedService.ts`)
- Recommendations pre-warm in background on boot without blocking Home.
- Suggestions persist across tab switches in `App.tsx` state and in `localStorage` under `mindly_discovery_cache_${userId || 'guest'}` with a 24-hour TTL.
- Navigating away from Discover and returning must **NEVER** re-trigger loading or wipe visible suggestions.
- Manual refresh is controlled exclusively by the **Refresh Suggestions** button. If refresh fails, existing suggestions are kept and a retry banner appears.
- Filter chips match 6 practical competency categories:
  1. AI & Automation
  2. Data & Analytics
  3. Cybersecurity & IT
  4. Software & Tech
  5. Design & UX
  6. Content & Media

### D. Certificates & Verification (`CertificatesView.tsx` + `firestoreCertificates.ts`)
- Individual certificates have `MND-` prefix; combined certificates have `MND-COMB-` prefix.
- Requires 100% course completion and passing the final exam.
- Legal real name must be validated (cannot be empty, whitespace, `@username`, or default placeholder "Mindly Learner").
- Public verification endpoint `GET /api/certificates/verify/:id` and hash `#verify=:id` allow non-authenticated proof while stripping PII.

### E. Security & Dual Persistence
- 20 sensitive endpoints strictly require Firebase Auth Bearer tokens (HTTP 401 on missing/spoofed tokens).
- Cloud Run service account `ais-sandbox@ais-europe-west2-ffce16b15c594.iam.gserviceaccount.com` currently lacks `roles/datastore.user` on project `bright-centaur-bghtt`.
- Therefore, the client web app writes directly to Cloud Firestore using the learner's Firebase token, and the backend server uses `/data/mindly_db.json` as an atomic local fallback.

---

## 4. Current Feature Implementation Status

| Feature | Status | Key Verification Note |
|---|---|---|
| Splash & Watchdog Boot | Verified working | 10s watchdog avoids hanging on offline/stall |
| 3 Introductory Screens (Carousel) | Verified working | Slides 1–3 in `LandingWelcome.tsx` |
| Firebase Auth & Profile Setup | Verified working | Real name and @username enforced |
| Home Dashboard | Verified working | Reactive streak, study goal, continue learning |
| Practical Discovery Feed | Verified working | 17 articles across 6 domains; 24h cache |
| Vault Search | Verified working | 0 cross-user leakage in automated tests |
| AI Course Creation Wizard | Verified working | Multi-step depth & plan flow -> Lesson 1 |
| Course Options Three-Dot Menu | Verified working | Archive, Delete, Reset, Rename |
| Lesson Reader & Flowcharts | Verified working | Mermaid.js rendering + KaTeX math + audio |
| Lesson Quizzes & Exams | Verified working | Checkpoint quiz grading & explanations |
| Individual & Combined Certs | Verified working | 29/29 tests passed in `test_phase3a_certificates.ts` |
| Community Circles & Discussions | Verified working | 35/35 tests passed in `test_phase3b_community.ts` |
| Cross-Device Sync | Verified working | 29/29 tests passed in `test_cloud_persistence_cross_device.ts` |
| Knowledge Dump (PDF/Text) | Verified working | Document text extraction via `pdf-parse`/`mammoth` |
| Offline Outbox Queue | Verified working | Queues mutations and flushes on `online` event |

---

## 5. Available Verification Commands

Run these commands to verify the system baseline:

```bash
# 1. Type-check (Zero errors expected)
npm run lint

# 2. Production build (Vite + esbuild bundle)
npm run build

# 3. Security & authentication isolation tests (33 tests)
npx tsx scripts/test_security_phase2c.ts

# 4. Cross-user isolation tests (9 tests)
npx tsx scripts/test_authenticated_isolation.ts

# 5. Certificates & public verification tests (29 tests)
npx tsx scripts/test_phase3a_certificates.ts

# 6. Community & discussion permissions tests (35 tests)
npx tsx scripts/test_phase3b_community.ts

# 7. Cloud persistence & cross-device sync tests (29 tests)
npx tsx scripts/test_cloud_persistence_cross_device.ts
```

*Baseline Test Pass Rate: 135 / 135 automated tests passing (100%).*

---

## 6. Controlled Development Roadmap & Phase 1 Scope

- **Phase 0:** Audit, documentation and source-code recovery point. *(Completed)*
- **Phase 1 (Next Step):** Remove the three forced introductory screens and implement the public Home page.
- **Phase 2:** Implement or refine authentication and personalized onboarding.
- **Phase 3:** Personalize Home and Discover while preserving recommendation caching.
- **Phase 4:** Audit and repair the existing learning experience.
- **Phase 5:** Address remaining community, persistence, synchronization and integration gaps.

### Strict Rules for Phase 1
1. **DO NOT** rebuild Mindly from scratch or alter unrelated application files.
2. Decouple the public landing/Home page from the 3-slide introductory carousel in `LandingWelcome.tsx`.
3. Allow unauthenticated visitors to immediately see the value of Mindly, browse discovery topics, and understand what courses look like without being forced through a multi-step carousel.
4. Preserve the existing authentication modal, course creation wizard, and all 135 passing test baselines.
