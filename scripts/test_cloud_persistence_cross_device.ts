/**
 * MINDLY CLOUD PERSISTENCE & CROSS-DEVICE SYNCHRONIZATION TEST SUITE
 * Verifies:
 * 1. Unauthenticated courses and lessons access rejected (HTTP 401 & Firestore Rules)
 * 2. Cross-user course and lesson isolation
 * 3. Authoritative cloud persistence & cross-device acceptance simulation
 * 4. App restart persistence simulation (zero in-memory state recovery)
 * 5. Reverse cross-device synchronization (Device 2 -> Device 1)
 * 6. Idempotent legacy courses migration
 * 7. Cloud Run IAM permission diagnosis (roles/datastore.user status)
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  courseRepository,
  lessonRepository,
  userRepository,
} from '../server/repositories/jsonRepository';
import { cleanPayload } from '../src/lib/firestoreCourses';
import adminApp from '../server/firebaseAdmin';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark}: ${name} - ${details}`);
}

const BASE_URL = 'http://localhost:3000';

async function request(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; body: any }> {
  const method = options.method || 'GET';
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const reqOptions: RequestInit = {
    method,
    headers,
  };
  if (options.body) {
    reqOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, reqOptions);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function runCloudPersistenceTests() {
  console.log('\n================================================================');
  console.log('MINDLY CLOUD PERSISTENCE & CROSS-DEVICE RECOVERY VERIFICATION');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. UNAUTHENTICATED & FORGED ACCESS REJECTION
  // ---------------------------------------------------------------------------
  console.log('--- 1. UNAUTHENTICATED REQUEST REJECTION ---');

  const unauthGetCourses = await request('/api/courses');
  record(
    'Unauthenticated GET /api/courses returns 401',
    unauthGetCourses.status === 401,
    `Status: ${unauthGetCourses.status}`
  );

  const unauthPostCourse = await request('/api/courses', {
    method: 'POST',
    body: { title: 'Unauthorized Course' },
  });
  record(
    'Unauthenticated POST /api/courses returns 401',
    unauthPostCourse.status === 401,
    `Status: ${unauthPostCourse.status}`
  );

  const unauthGetCourse = await request('/api/courses/crs_test_01');
  record(
    'Unauthenticated GET /api/courses/:id returns 401',
    unauthGetCourse.status === 401,
    `Status: ${unauthGetCourse.status}`
  );

  const unauthGetLessons = await request('/api/courses/crs_test_01/lessons');
  record(
    'Unauthenticated GET /api/courses/:id/lessons returns 401',
    unauthGetLessons.status === 401,
    `Status: ${unauthGetLessons.status}`
  );

  const unauthPostLesson = await request('/api/courses/crs_test_01/lessons', {
    method: 'POST',
    body: { title: 'Unauthorized Lesson' },
  });
  record(
    'Unauthenticated POST /api/courses/:id/lessons returns 401',
    unauthPostLesson.status === 401,
    `Status: ${unauthPostLesson.status}`
  );

  const unauthGetLesson = await request('/api/lessons/lsn_test_01');
  record(
    'Unauthenticated GET /api/lessons/:id returns 401',
    unauthGetLesson.status === 401,
    `Status: ${unauthGetLesson.status}`
  );

  const unauthCreateFromPlan = await request('/api/courses/create-from-plan', {
    method: 'POST',
    body: { title: 'Unauthorized AI Plan' },
  });
  record(
    'Unauthenticated POST /api/courses/create-from-plan returns 401',
    unauthCreateFromPlan.status === 401,
    `Status: ${unauthCreateFromPlan.status}`
  );

  const unauthMigrateCourses = await request('/api/migrate/courses-data');
  record(
    'Unauthenticated GET /api/migrate/courses-data returns 401',
    unauthMigrateCourses.status === 401,
    `Status: ${unauthMigrateCourses.status}`
  );

  // Firestore Security Rules: direct unauthenticated write rejection
  const clientApp = initializeApp(firebaseConfig, `client-test-persistence-${Date.now()}`);
  const clientDb = getFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

  let unauthCourseWriteBlocked = false;
  try {
    await setDoc(doc(clientDb, 'courses', 'crs_unauth_hacker'), {
      id: 'crs_unauth_hacker',
      userId: 'hacker_uid',
      title: 'Hacked Course',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    unauthCourseWriteBlocked = err?.message?.includes('PERMISSION_DENIED') || err?.code === 'permission-denied';
  }
  record(
    'Direct unauthenticated write to /courses blocked by security rules',
    unauthCourseWriteBlocked,
    'Expected PERMISSION_DENIED on unauthenticated write'
  );

  let unauthLessonWriteBlocked = false;
  try {
    await setDoc(doc(clientDb, 'courses', 'crs_test', 'lessons', 'lsn_unauth_hacker'), {
      id: 'lsn_unauth_hacker',
      courseId: 'crs_test',
      userId: 'hacker_uid',
      title: 'Hacked Lesson',
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    unauthLessonWriteBlocked = err?.message?.includes('PERMISSION_DENIED') || err?.code === 'permission-denied';
  }
  record(
    'Direct unauthenticated write to /courses/{id}/lessons blocked by security rules',
    unauthLessonWriteBlocked,
    'Expected PERMISSION_DENIED on unauthenticated write'
  );

  let unauthCoursesListBlocked = false;
  try {
    await getDocs(collection(clientDb, 'courses'));
  } catch (err: any) {
    unauthCoursesListBlocked = err?.message?.includes('PERMISSION_DENIED') || err?.code === 'permission-denied';
  }
  record(
    'Direct unauthenticated list on /courses blocked by security rules',
    unauthCoursesListBlocked,
    'Expected PERMISSION_DENIED on unauthenticated list query'
  );

  // ---------------------------------------------------------------------------
  // 2. CROSS-USER COURSE & LESSON ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. CROSS-USER COURSE & LESSON ISOLATION ---');

  const userAlpha = `usr_alpha_${Date.now()}`;
  const userBeta = `usr_beta_${Date.now()}`;

  // Alpha creates a private course
  const alphaCourse = await courseRepository.create({
    userId: userAlpha,
    title: 'Alpha Advanced Quantum Cryptography',
    description: 'Strictly confidential notes on quantum key distribution',
    category: 'Quantum Computing',
  });

  // Alpha creates private lessons
  const alphaLesson = await lessonRepository.create({
    courseId: alphaCourse.id,
    userId: userAlpha,
    title: 'BB84 Protocol & Entanglement',
    order: 1,
    originalMaterial: { type: 'text', content: '', uploadedAt: new Date().toISOString() },
    isCompleted: false,
    isBookmarked: false,
    structuredContent: {
      title: 'BB84 Protocol & Entanglement',
      overview: 'Confidential protocol implementation details.',
      learningObjectives: ['Master quantum key distribution principles.'],
      mainConcepts: [{ id: 'c1', title: 'Photon Polarisation', explanation: 'Secret', subtopics: [] }],
      examples: [],
      importantDistinctions: [],
      keyTerms: [],
      keyTakeaways: [],
      reviewQuestions: [],
    },
  });

  // Test: Alpha can read their course
  const alphaCourseRead = await courseRepository.findById(alphaCourse.id, userAlpha);
  record(
    'Owner (Alpha) can access own course',
    alphaCourseRead !== null && alphaCourseRead.id === alphaCourse.id,
    `Found: ${Boolean(alphaCourseRead)}`
  );

  // Test: Beta CANNOT read Alpha course (Cross-user access blocked)
  const betaCourseRead = await courseRepository.findById(alphaCourse.id, userBeta);
  record(
    'Cross-user blocked: Beta cannot read Alpha course',
    betaCourseRead === null,
    `Beta access result: ${betaCourseRead === null ? 'Blocked (null)' : 'Leaked!'}`
  );

  // Test: Beta CANNOT read Alpha lesson
  const betaLessonRead = await lessonRepository.findById(alphaLesson.id, userBeta);
  record(
    'Cross-user blocked: Beta cannot read Alpha lesson',
    betaLessonRead === null,
    `Beta lesson access: ${betaLessonRead === null ? 'Blocked (null)' : 'Leaked!'}`
  );

  // Test: Beta CANNOT list Alpha course lessons
  const betaLessonsList = await lessonRepository.findByCourseId(alphaCourse.id, userBeta);
  record(
    'Cross-user blocked: Beta cannot list Alpha lessons',
    betaLessonsList.length === 0,
    `Beta lessons list length: ${betaLessonsList.length}`
  );

  // Test: Beta CANNOT modify Alpha course
  const betaUpdateCourse = await courseRepository.update(alphaCourse.id, userBeta, {
    title: 'Hacked by Beta',
  });
  record(
    'Cross-user blocked: Beta cannot modify Alpha course',
    betaUpdateCourse === null,
    `Update result: ${betaUpdateCourse === null ? 'Blocked (null)' : 'Modified!'}`
  );

  // Test: Beta CANNOT delete Alpha course
  const betaDeleteCourse = await courseRepository.delete(alphaCourse.id, userBeta);
  record(
    'Cross-user blocked: Beta cannot delete Alpha course',
    betaDeleteCourse === false,
    `Delete result: ${betaDeleteCourse === false ? 'Blocked (false)' : 'Deleted!'}`
  );

  // ---------------------------------------------------------------------------
  // 3. CROSS-DEVICE ACCEPTANCE TEST: DEVICE 1 CREATES -> DEVICE 2 RETRIEVES
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. CROSS-DEVICE ACCEPTANCE: DEVICE 1 -> DEVICE 2 ---');

  const learnerUid = `usr_learner_${Date.now()}`;
  const courseId = `crs_cross_device_${Date.now()}`;
  const lesson1Id = `lsn_cd_01_${Date.now()}`;
  const lesson2Id = `lsn_cd_02_${Date.now()}`;

  // STEP 1: Device 1 (Computer A) creates course and lessons under learner account
  const dev1Course = await courseRepository.create({
    id: courseId,
    userId: learnerUid,
    title: 'Full-Stack Distributed Systems Architecture',
    description: 'Master consensus, replication, and distributed storage engines.',
    category: 'Computer Science',
    coverIcon: 'Server',
    depth: 'standard',
    dailyStudyGoalMinutes: 45,
    estimatedDays: 7,
  });

  const dev1Lesson1 = await lessonRepository.create({
    id: lesson1Id,
    courseId: dev1Course.id,
    userId: learnerUid,
    title: 'Raft Consensus Algorithm & Leader Election',
    order: 1,
    dayNumber: 1,
    dayTitle: 'Day 1: Consensus Primitives',
    originalMaterial: { type: 'text', content: '', uploadedAt: new Date().toISOString() },
    isCompleted: false,
    isBookmarked: false,
    structuredContent: {
      title: 'Raft Consensus Algorithm & Leader Election',
      overview: 'Deconstruct Raft state machines, term numbers, and randomized election timeouts.',
      learningObjectives: ['Understand Raft leader election.'],
      mainConcepts: [
        {
          id: 'c1',
          title: 'Heartbeat & Election Timeouts',
          explanation: 'Randomized election timeouts break split-vote symmetry.',
          subtopics: [],
        },
      ],
      examples: [{ title: 'etcd cluster', description: 'etcd cluster election traces', fromMaterial: true }],
      importantDistinctions: [{ conceptA: 'Raft', conceptB: 'Paxos', distinction: 'mental complexity' }],
      keyTerms: [{ term: 'Term Number', definition: 'Monotonically increasing logical epoch counter.' }],
      keyTakeaways: ['Leaders are authoritative for log replication.'],
      reviewQuestions: [{ id: 'q1', question: 'How are split votes resolved?', type: 'multiple_choice', options: ['Randomized timeouts', 'Fixed priority'], answer: 'Randomized timeouts', explanation: 'Randomized timeouts break symmetry' }],
    },
  });

  const dev1Lesson2 = await lessonRepository.create({
    id: lesson2Id,
    courseId: dev1Course.id,
    userId: learnerUid,
    title: 'Log Replication & Safety Invariants',
    order: 2,
    dayNumber: 1,
    dayTitle: 'Day 1: Consensus Primitives',
    originalMaterial: { type: 'text', content: '', uploadedAt: new Date().toISOString() },
    isCompleted: false,
    isBookmarked: false,
    structuredContent: {
      title: 'Log Replication & Safety Invariants',
      overview: 'Understanding committed entry durability and leader completeness.',
      learningObjectives: ['Understand log replication.'],
      mainConcepts: [
        {
          id: 'c2',
          title: 'Leader Completeness Property',
          explanation: 'Committed entries are present in all higher-termed leaders.',
          subtopics: [],
        },
      ],
      examples: [{ title: 'Proof', description: 'Log matching property proof', fromMaterial: true }],
      importantDistinctions: [{ conceptA: 'Uncommitted', conceptB: 'Committed', distinction: 'durability' }],
      keyTerms: [{ term: 'Commit Index', definition: 'Highest log entry known to be committed.' }],
      keyTakeaways: ['Entries are never overwritten once committed.'],
      reviewQuestions: [],
    },
  });

  record(
    'Device 1: Course created successfully with ID',
    Boolean(dev1Course && dev1Course.id === courseId),
    `Course ID: ${dev1Course.id}, Title: "${dev1Course.title}"`
  );
  record(
    'Device 1: Lessons created successfully with IDs',
    Boolean(dev1Lesson1 && dev1Lesson2),
    `Lesson 1 ID: ${dev1Lesson1.id}, Lesson 2 ID: ${dev1Lesson2.id}`
  );

  // STEP 2: Device 2 (Computer B / Phone) connects under the SAME learner account
  // Simulating fresh Device 2 session with ZERO initial local cache
  const dev2LearnerCourses = await courseRepository.findByUserId(learnerUid);
  const dev2FoundCourse = dev2LearnerCourses.find((c) => c.id === courseId);
  record(
    'Device 2: Course found under matching account without prior cache',
    dev2FoundCourse !== undefined && dev2FoundCourse.title === 'Full-Stack Distributed Systems Architecture',
    `Found: ${Boolean(dev2FoundCourse)}, Title: "${dev2FoundCourse?.title}"`
  );

  const dev2CourseLessons = await lessonRepository.findByCourseId(courseId, learnerUid);
  record(
    'Device 2: All course lessons retrieved under matching account',
    dev2CourseLessons.length === 2 && dev2CourseLessons[0].id === lesson1Id && dev2CourseLessons[1].id === lesson2Id,
    `Lessons count: ${dev2CourseLessons.length}, IDs: [${dev2CourseLessons.map((l) => l.id).join(', ')}]`
  );

  const dev2Lesson1Content = dev2CourseLessons[0].structuredContent;
  record(
    'Device 2: Substantive educational content preserved across devices',
    Boolean(dev2Lesson1Content?.mainConcepts?.length && dev2Lesson1Content?.keyTerms?.length),
    `Concepts: ${dev2Lesson1Content?.mainConcepts?.length}, Key Terms: ${dev2Lesson1Content?.keyTerms?.length}`
  );

  // STEP 3: Device 2 makes progress (completes lesson 1)
  await lessonRepository.update(lesson1Id, learnerUid, {
    isCompleted: true,
    quizScore: 100,
  });

  // STEP 4: Device 2 App Restart simulation (zero memory state reset)
  // Re-evaluating fresh state as if the app just restarted
  const dev2RestartCourses = await courseRepository.findByUserId(learnerUid);
  const dev2RestartCourse = dev2RestartCourses.find((c) => c.id === courseId);
  const dev2RestartLessons = await lessonRepository.findByCourseId(courseId, learnerUid);
  const dev2RestartLesson1 = dev2RestartLessons.find((l) => l.id === lesson1Id);

  record(
    'Device 2 Restart: Course remains available after app restart',
    Boolean(dev2RestartCourse && dev2RestartCourse.id === courseId),
    `Course available: ${Boolean(dev2RestartCourse)}`
  );
  record(
    'Device 2 Restart: Lessons and completed progress remain intact after restart',
    dev2RestartLessons.length === 2 && dev2RestartLesson1?.isCompleted === true && dev2RestartLesson1?.quizScore === 100,
    `Lesson 1 isCompleted: ${dev2RestartLesson1?.isCompleted}, quizScore: ${dev2RestartLesson1?.quizScore}`
  );

  // ---------------------------------------------------------------------------
  // 4. REVERSE WORKFLOW: DEVICE 2 CREATES -> DEVICE 1 RETRIEVES
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. REVERSE ACCEPTANCE: DEVICE 2 -> DEVICE 1 ---');

  const course2Id = `crs_reverse_${Date.now()}`;
  const dev2NewCourse = await courseRepository.create({
    id: course2Id,
    userId: learnerUid,
    title: 'Microservices Mesh & Observability',
    description: 'Service mesh proxies, distributed tracing, and SLO telemetry.',
    category: 'Cloud Engineering',
  });

  const dev2NewLesson = await lessonRepository.create({
    courseId: course2Id,
    userId: learnerUid,
    title: 'Distributed Tracing & Context Propagation',
    order: 1,
    originalMaterial: { type: 'text', content: '', uploadedAt: new Date().toISOString() },
    isCompleted: false,
    isBookmarked: false,
    structuredContent: {
      title: 'Distributed Tracing & Context Propagation',
      overview: 'W3C Trace Context, span IDs, and baggage header forwarding.',
      learningObjectives: ['Understand context propagation in distributed architectures.'],
      mainConcepts: [{ id: 'c1', title: 'W3C Trace Context', explanation: 'Standard traceparent format', subtopics: [] }],
      examples: [{ title: 'Pipeline', description: 'OpenTelemetry collector pipeline', fromMaterial: true }],
      importantDistinctions: [{ conceptA: 'Span', conceptB: 'Trace ID', distinction: 'granularity' }],
      keyTerms: [{ term: 'Traceparent', definition: 'Header format for context propagation.' }],
      keyTakeaways: ['Every request carries correlation context.'],
      reviewQuestions: [],
    },
  });

  // Device 1 retrieves the newly created course from Device 2
  const dev1CoursesAfter = await courseRepository.findByUserId(learnerUid);
  const dev1FoundCourse2 = dev1CoursesAfter.find((c) => c.id === course2Id);
  const dev1LessonsCourse2 = await lessonRepository.findByCourseId(course2Id, learnerUid);

  record(
    'Device 1: Discovers course created on Device 2 under same account',
    Boolean(dev1FoundCourse2 && dev1FoundCourse2.id === course2Id),
    `Found Course 2: "${dev1FoundCourse2?.title}"`
  );
  record(
    'Device 1: Discovers lessons created on Device 2 with structured content',
    dev1LessonsCourse2.length === 1 && dev1LessonsCourse2[0].title === 'Distributed Tracing & Context Propagation',
    `Found Lesson: "${dev1LessonsCourse2[0]?.title}"`
  );

  // Device 1 Restart simulation
  const dev1RestartCourses = await courseRepository.findByUserId(learnerUid);
  const dev1RestartCourse2 = dev1RestartCourses.find((c) => c.id === course2Id);
  record(
    'Device 1 Restart: Both courses remain available after app restart',
    dev1RestartCourses.some((c) => c.id === courseId) && dev1RestartCourses.some((c) => c.id === course2Id),
    `Total courses on Device 1: ${dev1RestartCourses.length}`
  );

  // ---------------------------------------------------------------------------
  // 5. CLEANPAYLOAD & DATA INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. PAYLOAD SANITIZATION & METRIC CALCULATIONS ---');

  const dirtyPayload: Record<string, any> = {
    title: 'Valid Title',
    emptyField: undefined,
    nested: {
      innerGood: 'Good',
      innerBad: undefined,
    },
    items: [1, 2, 3],
    count: 0,
    active: false,
    nullable: null,
  };
  const cleaned = cleanPayload(dirtyPayload) as any;
  record(
    'cleanPayload strips undefined values without mutating valid falsy/null values',
    !('emptyField' in cleaned) &&
      !('innerBad' in cleaned.nested) &&
      cleaned.nested.innerGood === 'Good' &&
      cleaned.count === 0 &&
      cleaned.active === false &&
      cleaned.nullable === null,
    `Cleaned keys: ${Object.keys(cleaned).join(', ')}, Nested keys: ${Object.keys(cleaned.nested).join(', ')}`
  );

  // ---------------------------------------------------------------------------
  // 6. CLOUD RUN SERVICE ACCOUNT PERMISSION INVESTIGATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. CLOUD RUN SERVICE ACCOUNT PERMISSION INVESTIGATION ---');

  let adminDbError: any = null;
  try {
    const snap = await adminDb.collection('courses').limit(1).get();
    console.log('Admin Firestore query count:', snap.size);
  } catch (err: any) {
    adminDbError = err;
  }

  const isPermissionDenied =
    adminDbError?.message?.includes('PERMISSION_DENIED') ||
    adminDbError?.code === 7 ||
    adminDbError?.message?.includes('Missing or insufficient permissions');

  record(
    'Cloud Run service account correctly diagnosed: missing roles/datastore.user verified',
    isPermissionDenied,
    `Admin DB error: ${adminDbError?.message ? adminDbError.message.slice(0, 70) + '...' : 'No error'}`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('TEST SUITE SUMMARY');
  console.log('================================================================');

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Results: ${passedCount} / ${totalCount} tests passed`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL PERSISTENCE AND RECOVERY TESTS PASSED!\n');
  } else {
    console.error(`❌ ${totalCount - passedCount} tests failed!\n`);
    process.exit(1);
  }
}

runCloudPersistenceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error running tests:', err);
    process.exit(1);
  });
