/**
 * Test Cross-User Isolation and Legitimate Authenticated Operations
 */
import { courseRepository, lessonRepository, noteRepository, keyTermRepository } from '../server/repositories/jsonRepository';
import { SearchService } from '../server/services/searchService';

async function testCrossUserIsolation() {
  console.log('--- STARTING CROSS-USER ISOLATION & AUTHENTICATED TESTS ---');
  const results: { name: string; passed: boolean; details: string }[] = [];

  const uidAlpha = `user_alpha_${Date.now()}`;
  const uidBeta = `user_beta_${Date.now()}`;

  // 1. Alpha creates private course
  const alphaCourse = await courseRepository.create({
    userId: uidAlpha,
    title: 'Alpha Quantum Secrets',
    description: 'Extremely confidential quantum notes for Alpha',
    category: 'Physics',
    coverIcon: 'Atom',
    courseType: 'custom',
  });

  // 2. Alpha creates private lesson
  const alphaLesson = await lessonRepository.create({
    courseId: alphaCourse.id,
    userId: uidAlpha,
    title: 'Secret Alpha Lesson',
    order: 1,
    isCompleted: false,
    isBookmarked: false,
    originalMaterial: { type: 'text', content: 'Secret alpha material', uploadedAt: new Date().toISOString() },
    structuredContent: {
      title: 'Secret Alpha Lesson',
      overview: 'Confidential alpha overview',
      learningObjectives: [],
      mainConcepts: [],
      keyTerms: [],
      examples: [],
      importantDistinctions: [],
      keyTakeaways: [],
      reviewQuestions: [],
    },
  });

  // 3. Alpha creates private note
  const alphaNote = await noteRepository.create({
    userId: uidAlpha,
    title: 'Top Secret Alpha Note',
    content: 'Top secret alpha content',
    courseId: alphaCourse.id,
    lessonId: alphaLesson.id,
    tags: ['secret'],
    type: 'lesson',
  });

  // Test 1: Alpha can read their course
  const alphaRead = await courseRepository.findById(alphaCourse.id, uidAlpha);
  results.push({
    name: 'Owner (Alpha) can read own course',
    passed: alphaRead !== null && alphaRead.id === alphaCourse.id,
    details: `Result: ${alphaRead ? 'Found' : 'Not found'}`,
  });

  // Test 2: Beta CANNOT read Alpha course (Cross-user access blocked)
  const betaReadCourse = await courseRepository.findById(alphaCourse.id, uidBeta);
  results.push({
    name: 'Cross-user blocked: Beta reading Alpha course',
    passed: betaReadCourse === null,
    details: `Result: ${betaReadCourse === null ? 'Blocked (null)' : 'Leaked!'}`,
  });

  // Test 3: Beta course list DOES NOT contain Alpha course
  const betaCourseList = await courseRepository.findByUserId(uidBeta);
  const leakedInList = betaCourseList.some((c) => c.id === alphaCourse.id);
  results.push({
    name: 'Cross-user list isolation: Beta cannot see Alpha course in list',
    passed: !leakedInList,
    details: `Leaked in list: ${leakedInList}`,
  });

  // Test 4: Beta CANNOT read Alpha lesson
  const betaReadLesson = await lessonRepository.findById(alphaLesson.id, uidBeta);
  results.push({
    name: 'Cross-user blocked: Beta reading Alpha lesson',
    passed: betaReadLesson === null,
    details: `Result: ${betaReadLesson === null ? 'Blocked (null)' : 'Leaked!'}`,
  });

  // Test 5: Beta CANNOT update Alpha course
  const betaUpdateCourse = await courseRepository.update(alphaCourse.id, uidBeta, { title: 'Hacked Title' });
  results.push({
    name: 'Cross-user mutation blocked: Beta updating Alpha course',
    passed: betaUpdateCourse === null,
    details: `Result: ${betaUpdateCourse === null ? 'Mutation rejected' : 'Hacked!'}`,
  });

  // Test 6: Beta CANNOT delete Alpha course
  const betaDeleteCourse = await courseRepository.delete(alphaCourse.id, uidBeta);
  results.push({
    name: 'Cross-user deletion blocked: Beta deleting Alpha course',
    passed: betaDeleteCourse === false,
    details: `Result: ${!betaDeleteCourse ? 'Deletion rejected' : 'Deleted!'}`,
  });

  // Test 7: Beta CANNOT read Alpha note
  const betaNotes = await noteRepository.findByUserId(uidBeta);
  const betaSawNote = betaNotes.some((n) => n.id === alphaNote.id);
  results.push({
    name: 'Cross-user isolation: Beta cannot see Alpha note',
    passed: !betaSawNote,
    details: `Saw note: ${betaSawNote}`,
  });

  // Test 8: Search Service isolation: Beta searching for Alpha keywords
  const searchService = new SearchService();
  const betaSearchResults = await searchService.search('Quantum Secrets', uidBeta);
  const alphaFoundInBeta = betaSearchResults.some((r) => r.id === alphaCourse.id || r.courseId === alphaCourse.id);
  results.push({
    name: 'Search Isolation: Beta search cannot discover Alpha records',
    passed: !alphaFoundInBeta,
    details: `Found records count: ${betaSearchResults.length}`,
  });

  // Test 9: Search Service for Alpha: Alpha finds their own record
  const alphaSearchResults = await searchService.search('Quantum Secrets', uidAlpha);
  const alphaFoundInAlpha = alphaSearchResults.some((r) => r.id === alphaCourse.id);
  results.push({
    name: 'Search Functionality: Alpha search finds own records',
    passed: alphaFoundInAlpha,
    details: `Found own records: ${alphaFoundInAlpha}`,
  });

  // Cleanup test artifacts
  await courseRepository.delete(alphaCourse.id, uidAlpha);
  await noteRepository.delete(alphaNote.id, uidAlpha);

  console.log('\n========================================');
  console.log('CROSS-USER ISOLATION RESULTS');
  console.log('========================================');
  let passCount = 0;
  let failCount = 0;
  for (const r of results) {
    const symbol = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${symbol}: ${r.name} — ${r.details}`);
    if (r.passed) passCount++;
    else failCount++;
  }
  console.log('========================================');
  console.log(`TOTAL: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('========================================');

  if (failCount > 0) process.exit(1);
  else process.exit(0);
}

testCrossUserIsolation().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
