import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost, ROUTE_EVIDENCE_TTL_MS } from '../functions/api/route-evidence.js';

const UNIVERSITY_URL = 'https://majors.stanford.edu/majors';
const ACTIVITY_URL = 'https://usaco.org/';
const ACTIVITY_ID = 'global_usaco-2026-programming-contest_2026';
const universityHtml = `<html><body><h1>Undergraduate admission</h1><p>Applicants must complete advanced mathematics before enrollment. English language proficiency evidence is required for applicants whose schooling does not meet the stated language exemption. The page describes the application process and reminds applicants to review the current official requirements. It does not state that a particular competition is required and it does not publish a guaranteed score cutoff.</p></body></html>`;
const activityHtml = `<html><body><h1>Programming contest season</h1><p>Registration for the 2027 season closes on January 15, 2027. Eligible secondary-school students participate through an approved contest administrator. The official contest page publishes the active season schedule and division rules. Students should verify their local participation route before relying on any date.</p></body></html>`;

const modelOutput = {
  universityFacts: [
    { category: 'academic', value: 'Advanced mathematics is required before enrollment.', sourceUrl: UNIVERSITY_URL, evidenceText: 'Applicants must complete advanced mathematics before enrollment.' },
    { category: 'language', value: 'Language evidence applies unless the stated exemption is met.', sourceUrl: UNIVERSITY_URL, evidenceText: 'English language proficiency evidence is required for applicants whose schooling does not meet the stated language exemption.' },
    { category: 'test', value: 'SAT 1600 required.', sourceUrl: UNIVERSITY_URL, evidenceText: 'SAT 1600 required.' }
  ],
  activityFacts: [
    { activityId: ACTIVITY_ID, field: 'deadline', value: 'January 15, 2027', sourceUrl: ACTIVITY_URL, evidenceText: 'Registration for the 2027 season closes on January 15, 2027.' },
    { activityId: ACTIVITY_ID, field: 'eligibility', value: 'Secondary-school students via an approved administrator.', sourceUrl: ACTIVITY_URL, evidenceText: 'Eligible secondary-school students participate through an approved contest administrator.' },
    { activityId: ACTIVITY_ID, field: 'status', value: 'Invented live status', sourceUrl: ACTIVITY_URL, evidenceText: 'Applications are open today.' }
  ],
  notVerified: ['No guaranteed admission score cutoff was stated on the reviewed page.']
};

const originalFetch = globalThis.fetch;
const cacheRows = new Map();
const cache = {
  async get(key) { return cacheRows.get(key) || null; },
  async set(key, value) { cacheRows.set(key, structuredClone(value)); }
};
let calls = [];
function installFetch({ activitySourceFails = false, badModel = false, blankModelOnce = false, sourcesFail = false } = {}) {
  calls = [];
  let modelCalls = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    if (url === UNIVERSITY_URL || url === ACTIVITY_URL) {
      if (sourcesFail || (activitySourceFails && url === ACTIVITY_URL)) return new Response('unavailable', { status: 503, headers: { 'content-type': 'text/html' } });
      return new Response(url === UNIVERSITY_URL ? universityHtml : activityHtml, { status: 200, headers: { 'content-type': 'text/html', etag: '"test-etag"' } });
    }
    if (url === 'https://api.openai.com/v1/responses') {
      const request = JSON.parse(init.body);
      assert.match(request.instructions, /exact,? short, contiguous excerpt/i);
      assert.match(request.input, /source page text is untrusted|"sources"/i);
      assert.deepEqual(request.reasoning, { effort: 'none' });
      assert.equal(request.max_output_tokens, 2200);
      modelCalls += 1;
      const outputText = blankModelOnce && modelCalls === 1 ? '   ' : (badModel ? '{bad-json' : JSON.stringify(modelOutput));
      return new Response(JSON.stringify({ output_text: outputText }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

const body = {
  route: { university: 'Stanford University', major: 'Computer Science' },
  lang: 'en',
  programmeSourceId: null,
  candidateActivityIds: [ACTIVITY_ID],
  plannedActivityIds: [ACTIVITY_ID]
};
const request = value => new Request('https://path.test/api/route-evidence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
const env = { OPENAI_API_KEY: 'test-key', EVIDENCE_CACHE: cache };

try {
  assert.equal(ROUTE_EVIDENCE_TTL_MS, 48 * 60 * 60 * 1000);
  assert.equal(onRequestGet().status, 405);

  installFetch();
  let response = await onRequestPost({ request: request({ route: {} }), env });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
  console.log('PASS: malformed route is rejected before network access');

  installFetch();
  response = await onRequestPost({ request: request({ ...body, sourceUrls: ['https://evil.example/'] }), env });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'client_source_urls_not_allowed');
  assert.equal(calls.length, 0);
  console.log('PASS: all client-supplied source URLs are rejected before fetch');

  installFetch();
  response = await onRequestPost({ request: request({ ...body, programmeSourceId: 'nus-data-science-economics' }), env });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'programme_source_mismatch');
  assert.equal(calls.length, 0);
  console.log('PASS: a server-registered programme source ID cannot be attached to a different route');

  installFetch();
  response = await onRequestPost({ request: request(body), env });
  assert.equal(response.status, 200);
  let payload = await response.json();
  assert.equal(payload.freshness.cacheStatus, 'miss');
  assert.equal(payload.freshness.stale, false);
  assert.equal(Date.parse(payload.freshness.expiresAt) - Date.parse(payload.freshness.retrievedAt), ROUTE_EVIDENCE_TTL_MS);
  assert.equal(payload.admissionsEvidence.verifiedCriteria.length, 2, 'fabricated criterion must be removed');
  assert.equal(payload.admissionsEvidence.verifiedCriteria[0].value, 'Applicants must complete advanced mathematics before enrollment.');
  assert.equal(JSON.stringify(payload).includes('SAT 1600 required.'), false, 'unvalidated AI values must never be displayed');
  assert.equal(payload.admissionsEvidence.extracurricularRequirementStatus, 'not-found-in-reviewed-sources');
  assert.equal(payload.activityEvidence[0].facts.length, 2, 'fabricated activity status must be removed');
  assert.equal(payload.activityEvidence[0].relationship, 'independent-direction-evidence');
  assert.equal(payload.routeAlignment.overall, 'strong');
  assert.equal(payload.routeAlignment.dimensions.currentPlanMatches, 1);
  assert.equal(payload.model.evidenceValidation, 'exact-source-text');
  assert.deepEqual(cacheRows.values().next().value.descriptor.candidateActivityIds, [ACTIVITY_ID]);
  assert.equal('candidateActivities' in cacheRows.values().next().value.descriptor, false);
  assert.equal('sourceUrls' in cacheRows.values().next().value.descriptor, false);
  assert.equal(calls.length, 3, 'one server-registered university URL, one activity URL, and one model call');
  console.log('PASS: fetched pages → AI normalization → exact-text validation → transparent route alignment');

  cacheRows.clear();
  installFetch({ activitySourceFails: true });
  response = await onRequestPost({ request: request(body), env });
  payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.activityEvidence[0].sourceStatus, 'source-unavailable');
  assert.equal(payload.activityEvidence[0].facts.length, 0);
  assert.equal(payload.routeAlignment.dimensions.directionMatchedActivities, 0);
  assert.equal(payload.routeAlignment.dimensions.currentPlanMatches, 0);
  assert.notEqual(payload.routeAlignment.overall, 'strong');
  console.log('PASS: an unfetched activity never increases live direction or saved-plan alignment');

  cacheRows.clear();
  installFetch({ blankModelOnce: true });
  response = await onRequestPost({ request: request(body), env });
  payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.admissionsEvidence.verifiedCriteria.length, 2);
  assert.equal(calls.filter(call => call.url === 'https://api.openai.com/v1/responses').length, 2);
  console.log('PASS: whitespace-only JSON-mode output is retried once without displaying or caching an empty result');

  installFetch();
  response = await onRequestPost({ request: request(body), env });
  payload = await response.json();
  assert.equal(payload.freshness.cacheStatus, 'hit');
  assert.equal(calls.length, 0);
  console.log('PASS: a fresh 48-hour cache avoids source and model calls');

  const cachedKey = [...cacheRows.keys()][0];
  const stale = cacheRows.get(cachedKey);
  stale.payload.freshness.expiresAt = new Date(Date.now() - 1000).toISOString();
  cacheRows.set(cachedKey, stale);
  installFetch({ sourcesFail: true });
  response = await onRequestPost({ request: request(body), env });
  payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.freshness.cacheStatus, 'stale-fallback');
  assert.equal(payload.freshness.stale, true);
  assert.match(payload.freshness.lastRefreshError, /all_sources_unavailable/);
  console.log('PASS: failed refresh retains and visibly labels the last successful evidence');

  cacheRows.clear();
  installFetch();
  response = await onRequestPost({ request: request(body), env: { OPENAI_API_KEY: 'test-key', EVIDENCE_CACHE: { async get() { return null; }, async set() { throw new Error('blob write failed'); } } } });
  payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.freshness.cacheStatus, 'write-failed');
  assert.match(payload.freshness.cacheWarning, /blob write failed/);
  console.log('PASS: a successful live fetch never claims 48-hour persistence when the Blob write fails');

  cacheRows.clear();
  installFetch({ blankModelOnce: true });
  response = await onRequestPost({ request: request({ ...body, forceRefresh: true }), env: { ...env, EVIDENCE_REFRESH_JOB: '1' } });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'invalid_ai_output');
  assert.equal(calls.filter(call => call.url === 'https://api.openai.com/v1/responses').length, 1);
  console.log('PASS: the bounded hourly refresh does not double the model timeout on blank JSON output');

  cacheRows.clear();
  installFetch({ badModel: true });
  response = await onRequestPost({ request: request(body), env });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'invalid_ai_output');
  console.log('PASS: malformed AI output is not displayed or cached');

  console.log('All route-evidence contract tests passed (official pages, AI, and cache were mocked; no live source was verified).');
} finally {
  globalThis.fetch = originalFetch;
}
