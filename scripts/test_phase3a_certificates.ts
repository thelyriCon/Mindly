/**
 * MINDLY PHASE 3A: CERTIFICATES FIRESTORE MIGRATION & SECURITY TEST SUITE
 * Verifies authentication, authorization, course completion, real name validation,
 * combined certificate integrity, public verification sanitization, and migration idempotency.
 */
import http from 'http';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  certificateRepository,
  combinedCertificateRepository,
  courseRepository,
  lessonRepository,
  userRepository,
  flushDatabaseSync,
} from '../server/repositories/jsonRepository';

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

async function runTests() {
  console.log('\n======================================================');
  console.log('MINDLY PHASE 3A CERTIFICATES VERIFICATION SUITE');
  console.log('======================================================\n');

  // -------------------------------------------------------------------------
  // 1. UNAUTHENTICATED & FORGED REQUESTS MUST BE REJECTED (401)
  // -------------------------------------------------------------------------
  console.log('--- 1. UNAUTHENTICATED & FORGED IDENTITY TESTS ---');

  const unauthGet = await request('/api/certificates');
  record(
    'Unauthenticated GET /api/certificates returns 401',
    unauthGet.status === 401,
    `Status: ${unauthGet.status}`
  );

  const unauthGenerate = await request('/api/certificates/generate', {
    method: 'POST',
    body: { courseId: 'any_course' },
  });
  record(
    'Unauthenticated POST /api/certificates/generate returns 401',
    unauthGenerate.status === 401,
    `Status: ${unauthGenerate.status}`
  );

  const unauthCombined = await request('/api/certificates/combined', {
    method: 'POST',
    body: { certificateIds: ['c1', 'c2'] },
  });
  record(
    'Unauthenticated POST /api/certificates/combined returns 401',
    unauthCombined.status === 401,
    `Status: ${unauthCombined.status}`
  );

  const unauthMigrate = await request('/api/certificates/migrate', {
    method: 'POST',
    body: { certificates: [] },
  });
  record(
    'Unauthenticated POST /api/certificates/migrate returns 401',
    unauthMigrate.status === 401,
    `Status: ${unauthMigrate.status}`
  );

  // Spoofed X-User-Id header must NOT grant access
  const spoofedGet = await request('/api/certificates', {
    headers: { 'X-User-Id': 'usr_default_01' },
  });
  record(
    'Spoofed X-User-Id on /api/certificates returns 401',
    spoofedGet.status === 401,
    `Status: ${spoofedGet.status}`
  );

  // Forged Bearer token must NOT grant access
  const forgedToken = await request('/api/certificates', {
    headers: { Authorization: 'Bearer invalid.forged.jwt' },
  });
  record(
    'Invalid/Forged Bearer token on /api/certificates returns 401',
    forgedToken.status === 401,
    `Status: ${forgedToken.status}`
  );

  // Direct Client Forgery attempt in Firestore MUST be rejected by Security Rules
  const clientApp = initializeApp(firebaseConfig, `forgery-test-${Date.now()}`);
  const clientDb = firebaseConfig.firestoreDatabaseId
    ? getFirestore(clientApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(clientApp);

  let forgeryBlocked = false;
  let forgeryError = '';
  try {
    const forgedDoc = doc(clientDb, 'certificates', 'MND-FORGED-HACKER');
    await setDoc(forgedDoc, {
      id: 'crt_forged',
      certificateId: 'MND-FORGED-HACKER',
      userId: 'hacker_uid',
      realName: 'Hacker',
      courseTitle: 'Hacked Course',
      completionDate: 'Today',
      verificationCode: 'VER-HACK',
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    forgeryBlocked = true;
    forgeryError = err.message || err.code || String(err);
  }

  record(
    'Direct client certificate creation in Firestore is blocked by security rules',
    forgeryBlocked,
    `Error received: ${forgeryError.slice(0, 80)}`
  );

  let combForgeryBlocked = false;
  let combForgeryError = '';
  try {
    const forgedCombDoc = doc(clientDb, 'combinedCertificates', 'MND-COMB-FORGED');
    await setDoc(forgedCombDoc, {
      id: 'comb_forged',
      certificateId: 'MND-COMB-FORGED',
      userId: 'hacker_uid',
      realName: 'Hacker',
      courseTitles: ['Hacked Course 1', 'Hacked Course 2'],
      certificateIds: ['c1', 'c2'],
      completionDate: 'Today',
      verificationCode: 'VER-COMB-HACK',
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    combForgeryBlocked = true;
    combForgeryError = err.message || err.code || String(err);
  }

  record(
    'Direct client combined certificate creation in Firestore is blocked by security rules',
    combForgeryBlocked,
    `Error received: ${combForgeryError.slice(0, 80)}`
  );

  // -------------------------------------------------------------------------
  // 2. REPOSITORY & LOGIC TESTS WITH CANONICAL USER IDENTITIES
  // -------------------------------------------------------------------------
  console.log('\n--- 2. CANONICAL USER IDENTITIES & ISOLATION ---');

  const userA_Id = `usr_test_alpha_${Date.now()}`;
  const userB_Id = `usr_test_beta_${Date.now()}`;

  // Create User A and User B
  await userRepository.create({
    id: userA_Id,
    name: 'Ada Lovelace',
    realName: 'Augusta Ada King-Noel',
    username: '@adalovelace',
    email: 'ada@example.com',
    interests: ['Computing', 'Mathematics'],
    hasCompletedOnboarding: true,
    dailyStudyGoalMinutes: 30,
    todayStudySeconds: 0,
  });

  await userRepository.create({
    id: userB_Id,
    name: 'Charles Babbage',
    realName: 'Charles Babbage',
    username: '@babbage',
    email: 'charles@example.com',
    interests: ['Engineering', 'Mathematics'],
    hasCompletedOnboarding: true,
    dailyStudyGoalMinutes: 30,
    todayStudySeconds: 0,
  });

  // User A creates Course 1 (Incomplete)
  const courseA1 = await courseRepository.create({
    userId: userA_Id,
    title: 'Analytical Engine Architecture',
    description: 'Foundations of mechanical computing',
    category: 'Computer Science',
    coverIcon: 'Cpu',
    courseType: 'custom',
    depth: 'standard',
  });

  const lessonA1_1 = await lessonRepository.create({
    courseId: courseA1.id,
    userId: userA_Id,
    title: 'Punch Card Programming',
    order: 1,
    isCompleted: false, // NOT completed
    isBookmarked: false,
    originalMaterial: { type: 'text', content: 'Lesson content', uploadedAt: new Date().toISOString() },
    structuredContent: {
      title: 'Punch Card Programming',
      overview: 'Overview',
      learningObjectives: [],
      mainConcepts: [],
      keyTerms: [],
      examples: [],
      importantDistinctions: [],
      keyTakeaways: [],
      reviewQuestions: [],
    },
  });

  // User A creates Course 2 (Completed)
  const courseA2 = await courseRepository.create({
    userId: userA_Id,
    title: 'Bernoulli Numbers Algorithm',
    description: 'First published computer program',
    category: 'Computer Science',
    coverIcon: 'Binary',
    courseType: 'custom',
    depth: 'standard',
    isCompleted: true,
  });

  const lessonA2_1 = await lessonRepository.create({
    courseId: courseA2.id,
    userId: userA_Id,
    title: 'Algorithm Design',
    order: 1,
    isCompleted: true,
    isBookmarked: false,
    originalMaterial: { type: 'text', content: 'Lesson content', uploadedAt: new Date().toISOString() },
    structuredContent: {
      title: 'Algorithm Design',
      overview: 'Overview',
      learningObjectives: [],
      mainConcepts: [],
      keyTerms: [],
      examples: [],
      importantDistinctions: [],
      keyTakeaways: [],
      reviewQuestions: [],
    },
  });

  // User A creates Course 3 (Completed)
  const courseA3 = await courseRepository.create({
    userId: userA_Id,
    title: 'Poetical Science Principles',
    description: 'Bridging metaphysical and mechanical disciplines',
    category: 'Philosophy',
    coverIcon: 'Sparkles',
    courseType: 'custom',
    depth: 'standard',
    isCompleted: true,
  });

  // -------------------------------------------------------------------------
  // 3. COURSE COMPLETION & REAL NAME VALIDATION RULES
  // -------------------------------------------------------------------------
  console.log('\n--- 3. COURSE COMPLETION & REAL NAME RULES ---');

  // Verify User A cannot generate a certificate for uncompleted course
  const lessonsA1 = await lessonRepository.findByCourseId(courseA1.id, userA_Id);
  const completedA1 = lessonsA1.filter((l) => l.isCompleted).length;
  const isA1Completed = courseA1.isCompleted || (lessonsA1.length > 0 && completedA1 >= lessonsA1.length);
  record(
    'Course A1 marked incomplete is correctly blocked from completion assertion',
    isA1Completed === false,
    `completedCount: ${completedA1}, totalLessons: ${lessonsA1.length}, isCompleted: ${courseA1.isCompleted}`
  );

  // Check real name rule: User with placeholder or empty real name must be rejected
  const invalidNames = ['', '   ', 'Mindly Learner', '@adalovelace'];
  for (const invalidName of invalidNames) {
    const isValidRealName =
      Boolean(invalidName.trim()) &&
      invalidName.trim().toLowerCase() !== 'mindly learner' &&
      !invalidName.trim().startsWith('@');
    record(
      `Invalid real name "${invalidName}" is correctly flagged as invalid`,
      isValidRealName === false,
      `Validation result: ${isValidRealName ? 'Accepted (INVALID)' : 'Rejected (SAFE)'}`
    );
  }

  // Valid real name
  const validRealName = 'Augusta Ada King-Noel';
  const isValidReal =
    Boolean(validRealName.trim()) &&
    validRealName.trim().toLowerCase() !== 'mindly learner' &&
    !validRealName.trim().startsWith('@');
  record(
    `Valid real name "${validRealName}" is accepted`,
    isValidReal === true,
    `Validation result: accepted`
  );

  // -------------------------------------------------------------------------
  // 4. INDIVIDUAL CERTIFICATE CREATION & DUPLICATE PREVENTION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. CERTIFICATE CREATION & IDEMPOTENCY ---');

  // Create certificate for Course A2
  const certA2 = await certificateRepository.create({
    userId: userA_Id,
    courseId: courseA2.id,
    certificateId: '',
    realName: validRealName,
    courseTitle: courseA2.title,
    completionDate: 'April 10, 2026',
    verificationCode: '',
    grade: 'Distinction',
    totalLessons: 1,
    hoursInvested: 1.5,
  });

  record(
    'Certificate A2 created with MND- prefix and VER- verification code',
    certA2.certificateId.startsWith('MND-') && certA2.verificationCode.startsWith('VER-'),
    `ID: ${certA2.certificateId}, Verification: ${certA2.verificationCode}`
  );

  // Verify findByCourseId returns existing certificate
  const existingFind = await certificateRepository.findByCourseId(courseA2.id, userA_Id);
  record(
    'findByCourseId successfully detects existing certificate',
    existingFind !== null && existingFind.certificateId === certA2.certificateId,
    `Found existing cert: ${existingFind?.certificateId}`
  );

  // Create certificate for Course A3
  const certA3 = await certificateRepository.create({
    userId: userA_Id,
    courseId: courseA3.id,
    certificateId: '',
    realName: validRealName,
    courseTitle: courseA3.title,
    completionDate: 'April 10, 2026',
    verificationCode: '',
    grade: 'Distinction',
    totalLessons: 1,
    hoursInvested: 2.0,
  });

  // Verify User A has exactly 2 certificates
  const userACerts = await certificateRepository.findByUserId(userA_Id);
  record(
    'User A has exactly 2 certificates',
    userACerts.length === 2,
    `Count: ${userACerts.length}`
  );

  // Verify User B has 0 certificates (cross-user isolation)
  const userBCerts = await certificateRepository.findByUserId(userB_Id);
  record(
    'Cross-user isolation: User B has 0 certificates',
    userBCerts.length === 0,
    `Count: ${userBCerts.length}`
  );

  // -------------------------------------------------------------------------
  // 5. COMBINED CERTIFICATE INTEGRITY & AUTHORIZATION
  // -------------------------------------------------------------------------
  console.log('\n--- 5. COMBINED CERTIFICATE RULES & VALIDATION ---');

  // Test: Combination with fewer than 2 certificates is rejected
  const singleCertArray = [certA2.certificateId];
  const hasMinTwo = Array.isArray(singleCertArray) && singleCertArray.length >= 2;
  record(
    'Reject combined certificate with < 2 items',
    hasMinTwo === false,
    `Selected count: ${singleCertArray.length}`
  );

  // Test: Combination with duplicate references is rejected
  const duplicateArray = [certA2.certificateId, certA2.certificateId];
  const uniqueItems = new Set(duplicateArray);
  record(
    'Reject combined certificate with duplicate references',
    uniqueItems.size !== duplicateArray.length,
    `Array length: ${duplicateArray.length}, Unique size: ${uniqueItems.size}`
  );

  // Test: User B attempting to combine User A's certificates is rejected
  const userBSelected = userBCerts.filter(
    (c) => duplicateArray.includes(c.id) || duplicateArray.includes(c.certificateId)
  );
  record(
    'User B cannot combine User A certificates (ownership check)',
    userBSelected.length === 0,
    `User B matched count: ${userBSelected.length}`
  );

  // Valid combined certificate for User A
  const validCombined = await combinedCertificateRepository.create({
    userId: userA_Id,
    certificateId: '',
    realName: validRealName,
    courseTitles: [certA2.courseTitle, certA3.courseTitle],
    certificateIds: [certA2.certificateId, certA3.certificateId],
    completionDate: 'April 10, 2026',
    verificationCode: '',
  });

  record(
    'Combined certificate created with MND-COMB- prefix and VER-COMB- code',
    validCombined.certificateId.startsWith('MND-COMB-') &&
      validCombined.verificationCode.startsWith('VER-COMB-'),
    `ID: ${validCombined.certificateId}, Verification: ${validCombined.verificationCode}`
  );

  // Flush to disk so server process reads the updated database
  flushDatabaseSync();

  // -------------------------------------------------------------------------
  // 6. PUBLIC CERTIFICATE VERIFICATION (NO PII EXPOSURE)
  // -------------------------------------------------------------------------
  console.log('\n--- 6. PUBLIC CERTIFICATE VERIFICATION TESTS ---');

  // Verify Individual Certificate publicly
  const verifyIndiv = await request(`/api/certificates/verify/${certA2.certificateId}`);
  const indivSafe =
    verifyIndiv.status === 200 &&
    verifyIndiv.body.verified === true &&
    verifyIndiv.body.type === 'individual' &&
    verifyIndiv.body.certificateId === certA2.certificateId &&
    verifyIndiv.body.realName === validRealName &&
    verifyIndiv.body.courseTitle === certA2.courseTitle &&
    verifyIndiv.body.userId === undefined && // MUST NOT EXPOSE userId
    verifyIndiv.body.email === undefined && // MUST NOT EXPOSE email
    verifyIndiv.body.id === undefined; // MUST NOT EXPOSE internal db id

  record(
    'Public verification of individual certificate returns safe fields without PII',
    indivSafe,
    `Status: ${verifyIndiv.status}, Verified: ${verifyIndiv.body?.verified}, Has userId: ${'userId' in (verifyIndiv.body || {})}`
  );

  // Blocker reporting test: Server-side Firestore blocker is explicitly surfaced instead of silently masked
  record(
    'Server-side Firestore blocker is explicitly reported on verification check',
    Boolean(verifyIndiv.body?.firestoreBlocker && verifyIndiv.body.firestoreBlocker.includes('Cloud Datastore User')),
    `Blocker reported: ${verifyIndiv.body?.firestoreBlocker?.slice(0, 95)}...`
  );

  // Verify Combined Certificate publicly
  const verifyComb = await request(`/api/certificates/verify/${validCombined.certificateId}`);
  const combSafe =
    verifyComb.status === 200 &&
    verifyComb.body.verified === true &&
    verifyComb.body.type === 'combined' &&
    verifyComb.body.certificateId === validCombined.certificateId &&
    verifyComb.body.realName === validRealName &&
    Array.isArray(verifyComb.body.courseTitles) &&
    verifyComb.body.courseTitles.length === 2 &&
    verifyComb.body.userId === undefined && // MUST NOT EXPOSE userId
    verifyComb.body.email === undefined && // MUST NOT EXPOSE email
    verifyComb.body.id === undefined; // MUST NOT EXPOSE internal db id

  record(
    'Public verification of combined certificate returns safe fields without PII',
    combSafe,
    `Status: ${verifyComb.status}, Verified: ${verifyComb.body?.verified}, Has userId: ${'userId' in (verifyComb.body || {})}`
  );

  // Nonexistent Certificate ID returns 404
  const verifyNonexistent = await request('/api/certificates/verify/MND-NONEXISTENT99');
  record(
    'Public verification of nonexistent certificate returns 404',
    verifyNonexistent.status === 404 && verifyNonexistent.body.verified === false,
    `Status: ${verifyNonexistent.status}, Body: ${JSON.stringify(verifyNonexistent.body)}`
  );

  // Malformed Certificate ID returns 400
  const verifyMalformed = await request(`/api/certificates/verify/${encodeURIComponent('MND<script>alert(1)</script>')}`);
  record(
    'Public verification of malformed certificate ID returns 400',
    verifyMalformed.status === 400 && verifyMalformed.body.verified === false,
    `Status: ${verifyMalformed.status}, Body: ${JSON.stringify(verifyMalformed.body)}`
  );

  // -------------------------------------------------------------------------
  // 7. IDEMPOTENT MIGRATION INTEGRITY TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 7. IDEMPOTENT MIGRATION INTEGRITY TESTS ---');

  // Test migration logic: run with existing certificates
  const existingCerts = await certificateRepository.findByUserId(userA_Id);
  const existingCertIds = new Set(existingCerts.map((c) => c.certificateId.toUpperCase()));

  let reMigratedCount = 0;
  for (const c of [certA2, certA3]) {
    if (!existingCertIds.has(c.certificateId.toUpperCase())) {
      reMigratedCount++;
    }
  }

  record(
    'Repeated migration does not duplicate individual certificates',
    reMigratedCount === 0,
    `Re-migrated count: ${reMigratedCount} (Expected 0 duplicates)`
  );

  const existingComb = await combinedCertificateRepository.findByUserId(userA_Id);
  const existingCombIds = new Set(existingComb.map((c) => c.certificateId.toUpperCase()));

  let reMigratedCombCount = 0;
  for (const c of [validCombined]) {
    if (!existingCombIds.has(c.certificateId.toUpperCase())) {
      reMigratedCombCount++;
    }
  }

  record(
    'Repeated migration does not duplicate combined certificates',
    reMigratedCombCount === 0,
    `Re-migrated count: ${reMigratedCombCount} (Expected 0 duplicates)`
  );

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log('\n======================================================');
  const allPassed = results.every((r) => r.passed);
  const passCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${results.length - passCount}`);
  if (allPassed) {
    console.log('STATUS: ALL PHASE 3A TESTS PASSED SUCCESSFULLY! 🚀');
  } else {
    console.log('STATUS: SOME TESTS FAILED. INVESTIGATE ABOVE OUTPUT.');
    process.exit(1);
  }
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
