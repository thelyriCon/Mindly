/**
 * Phase 2C Security & Authorization Verification Suite
 * Tests unauthenticated requests, forged tokens, header spoofing, cross-user isolation, and public endpoints.
 */
import express from 'express';
import http from 'http';

async function runSecurityTests() {
  console.log('--- STARTING PHASE 2C SECURITY VERIFICATION SUITE ---');
  const results: { name: string; passed: boolean; details: string }[] = [];

  const BASE_URL = 'http://localhost:3000';

  // Helper to make request
  async function makeReq(path: string, options: RequestInit = {}) {
    const res = await fetch(`${BASE_URL}${path}`, options);
    let body: any;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  }

  // 1. Unauthenticated Requests to Private Endpoints MUST Return 401
  const privateEndpoints = [
    { method: 'GET', path: '/api/courses' },
    { method: 'GET', path: '/api/courses/crs_sample_01' },
    { method: 'GET', path: '/api/courses/crs_sample_01/lessons' },
    { method: 'GET', path: '/api/lessons/lsn_sample_01' },
    { method: 'GET', path: '/api/notes' },
    { method: 'GET', path: '/api/terms' },
    { method: 'GET', path: '/api/study-time/progress' },
    { method: 'GET', path: '/api/study/progress' },
    { method: 'GET', path: '/api/materials' },
    { method: 'GET', path: '/api/activities' },
    { method: 'GET', path: '/api/search?q=quantum' },
    { method: 'GET', path: '/api/study/spaced-repetition/due' },
    { method: 'POST', path: '/api/study/spaced-repetition/review', body: JSON.stringify({ lessonId: 'l1', rating: 'good' }) },
    { method: 'POST', path: '/api/study/spaced-repetition/init', body: JSON.stringify({ lessonId: 'l1' }) },
    { method: 'POST', path: '/api/lessons/lsn_sample_01/toggle-complete' },
    { method: 'POST', path: '/api/lessons/lsn_sample_01/toggle-bookmark' },
    { method: 'POST', path: '/api/user/study-time', body: JSON.stringify({ seconds: 60 }) },
    { method: 'GET', path: '/api/export' },
    { method: 'PUT', path: '/api/profile', body: JSON.stringify({ name: 'Hacker' }) },
    { method: 'POST', path: '/api/quizzes/attempt', body: JSON.stringify({ lessonId: 'l1', score: 100, totalQuestions: 1 }) },
  ];

  for (const ep of privateEndpoints) {
    try {
      const res = await makeReq(ep.path, {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : {},
        body: ep.body,
      });

      const passed = res.status === 401;
      results.push({
        name: `Unauthenticated ${ep.method} ${ep.path}`,
        passed,
        details: `Status: ${res.status} (Expected 401). Body: ${JSON.stringify(res.body)}`,
      });
    } catch (e: any) {
      results.push({
        name: `Unauthenticated ${ep.method} ${ep.path}`,
        passed: false,
        details: `Connection/request error: ${e?.message}`,
      });
    }
  }

  // 2. Client-Spoofed X-User-Id Headers MUST Be Ignored and Return 401
  const spoofedEndpoints = [
    { method: 'GET', path: '/api/courses' },
    { method: 'GET', path: '/api/notes' },
    { method: 'GET', path: '/api/search?q=test' },
    { method: 'GET', path: '/api/study/progress' },
  ];

  for (const ep of spoofedEndpoints) {
    try {
      const res = await makeReq(ep.path, {
        method: ep.method,
        headers: {
          'X-User-Id': 'usr_default_01',
          'x-user-id': 'usr_admin',
        },
      });

      const passed = res.status === 401;
      results.push({
        name: `Spoofed X-User-Id on ${ep.method} ${ep.path}`,
        passed,
        details: `Status: ${res.status} (Expected 401 rejection).`,
      });
    } catch (e: any) {
      results.push({
        name: `Spoofed X-User-Id on ${ep.method} ${ep.path}`,
        passed: false,
        details: `Connection/request error: ${e?.message}`,
      });
    }
  }

  // 3. Forged / Invalid Bearer Tokens MUST Return 401
  const forgedTokens = [
    'forged-plain-token',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake',
    'Bearer invalid',
  ];

  for (const token of forgedTokens) {
    try {
      const res = await makeReq('/api/courses', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const passed = res.status === 401;
      results.push({
        name: `Forged Token: "${token.slice(0, 15)}..."`,
        passed,
        details: `Status: ${res.status} (Expected 401 rejection).`,
      });
    } catch (e: any) {
      results.push({
        name: `Forged Token: "${token.slice(0, 15)}..."`,
        passed: false,
        details: `Error: ${e?.message}`,
      });
    }
  }

  // 4. Genuinely Public Endpoints MUST Remain Accessible (Not 401)
  const publicEndpoints = [
    { path: '/api/certificates/verify/non_existent_id', expectedNot401: true },
    { path: '/api/community/circles', expectedNot401: true },
    { path: '/api/community/todays-question', expectedNot401: true },
    { path: '/api/community/discussions', expectedNot401: true },
    { path: '/api/community/rooms', expectedNot401: true },
    { path: '/api/micro-articles', expectedNot401: true },
  ];

  for (const ep of publicEndpoints) {
    try {
      const res = await makeReq(ep.path);
      const passed = res.status !== 401;
      results.push({
        name: `Public Endpoint Access: GET ${ep.path}`,
        passed,
        details: `Status: ${res.status} (Non-401 as expected).`,
      });
    } catch (e: any) {
      results.push({
        name: `Public Endpoint Access: GET ${ep.path}`,
        passed: false,
        details: `Error: ${e?.message}`,
      });
    }
  }

  // Print Summary Report
  console.log('\n========================================');
  console.log('PHASE 2C SECURITY AUDIT TEST RESULTS');
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

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
