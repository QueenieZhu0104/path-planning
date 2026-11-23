import assert from 'node:assert/strict';
import {
  ACTIVITY_DETAILS_TTL_MS,
  ACTIVITY_REGISTRY,
  activityCacheKey,
  onRequestGet,
  onRequestPost
} from '../functions/api/activity-details.js';

const ACTIVITY_ID = 'global_usaco-2026-programming-contest_2026';
const ACTIVITY_URL = 'https://usaco.org/';
const sourceHtml = `<html><body><h1>Programming contest season</h1><p>Registration for the 2027 season closes on January 15, 2027. Eligible secondary-school students participate through an approved contest administrator. The official contest page publishes the active season schedule and division rules. Students should verify their local participation route before relying on any date or eligibility statement.</p></body></html>`;
const modelOutput = {
  facts: [
    { field: 'deadline', value: 'January 15, 2027', evidenceText: 'Registration for the 2027 season closes on January 15, 2027.' },
    { field: 'eligibility', value: 'Secondary-school students.', evidenceText: 'Eligible secondary-school students participate through an approved contest administrator.' },
    { field: 'status', value: 'Open now', evidenceText: 'Applications are open today.' }
  ],
  notVerified: ['The page does not state whether registration is open today.']
};

const originalFetch = globalThis.fetch;
const rows = new Map();
const cache = {
  async get(key) { return rows.get(key) || null; },
  async set(key, value) { rows.set(key, structuredClone(value)); }
};
let calls = [];

function installFetch({ sourceFails = false, malformedModel = false } = {}) {
  calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    if (url === ACTIVITY_URL) {
      if (sourceFails) return new Response('unavailable', { status: 503, headers: { 'content-type': 'text/html' } });
      return new Response(sourceHtml, { status: 200, headers: { 'content-type': 'text/html', etag: '"activity-test"' } });
    }
    if (url === 'https://api.openai.com/v1/responses') {
      const body = JSON.parse(init.body);
      assert.match(body.instructions, /exact,? short, contiguous excerpt/i);
      assert.deepEqual(body.reasoning, { effort: 'none' });
      assert.equal(body.max_output_tokens, 1100);
      return new Response(JSON.stringify({ output_text: malformedModel ? '{bad-json' : JSON.stringify(modelOutput) }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

const request = (id = ACTIVITY_ID, extra = '') => new Request(`https://path.test/api/activity-details?id=${encodeURIComponent(id)}${extra}`);
const env = { OPENAI_API_KEY: 'test-key', EVIDENCE_CACHE: cache };

try {
  assert.equal(ACTIVITY_DETAILS_TTL_MS, 48 * 60 * 60 * 1000);
  assert.equal(ACTIVITY_REGISTRY.length, 48);
  assert.equal(onRequestPost().status, 405);
  assert.equal(activityCacheKey(ACTIVITY_ID), `activity/${ACTIVITY_ID}`);

  installFetch();
  let response = await onRequestGet({ request: request('not-a-registered-activity'), env });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'unknown_activity');
  assert.equal(calls.length, 0);
  console.log('PASS: unknown activity IDs are rejected before source or model access');

  rows.clear();
  installFetch();
  response = await onRequestGet({ request: request(), env });
  assert.equal(response.status, 200);
  let payload = await response.json();
  assert.equal(payload.activity.id, ACTIVITY_ID);
  assert.equal(payload.freshness.cacheStatus, 'miss');
  assert.equal(payload.freshness.stale, false);
  assert.equal(Date.parse(payload.freshness.expiresAt) - Date.parse(payload.freshness.retrievedAt), ACTIVITY_DETAILS_TTL_MS);
  assert.equal(payload.facts.length, 2, 'fabricated status must fail exact-source validation');
  assert.equal(payload.facts[0].value, 'Registration for the 2027 season closes on January 15, 2027.');
  assert.equal(JSON.stringify(payload).includes('Applications are open today.'), false);
  assert.equal(payload.model.evidenceValidation, 'exact-source-text');
  assert.equal(rows.get(activityCacheKey(ACTIVITY_ID)).descriptor.activityId, ACTIVITY_ID);
  assert.equal(calls.length, 2, 'one registered organiser page and one model call');
  console.log('PASS: a registered organiser page is normalized and only exact source excerpts survive');

  installFetch();
  response = await onRequestGet({ request: request(), env });
  payload = await response.json();
  assert.equal(payload.freshness.cacheStatus, 'hit');
  assert.equal(calls.length, 0);
  console.log('PASS: a fresh activity record is reused for the full 48-hour TTL');

  const stale = rows.get(activityCacheKey(ACTIVITY_ID));
  stale.payload.freshness.expiresAt = new Date(Date.now() - 1000).toISOString();
  rows.set(stale.key, stale);
  installFetch({ sourceFails: true });
  response = await onRequestGet({ request: request(), env });
  payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.freshness.cacheStatus, 'stale-fallback');
  assert.equal(payload.freshness.stale, true);
  assert.match(payload.freshness.lastRefreshError, /official_page_unavailable/);
  console.log('PASS: a failed refresh preserves and visibly marks the last successful activity record');

  rows.clear();
  installFetch({ malformedModel: true });
  response = await onRequestGet({ request: request(), env });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'invalid_ai_output');
  assert.equal(rows.get(activityCacheKey(ACTIVITY_ID)).payload, null);
  assert.match(rows.get(activityCacheKey(ACTIVITY_ID)).lastError, /invalid_ai_output/);
  console.log('PASS: malformed model output is not displayed; only a non-content retry ledger is cached');

  rows.clear();
  installFetch();
  response = await onRequestGet({ request: request(), env: { OPENAI_API_KEY: 'test-key', EVIDENCE_CACHE: { async get() { return null; }, async set() { throw new Error('blob unavailable'); } } } });
  payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.freshness.cacheStatus, 'write-failed');
  assert.match(payload.freshness.cacheWarning, /blob unavailable/);
  console.log('PASS: a Blob write failure never claims that the live result is persisted');

  console.log('All activity-details tests passed (source, AI and cache were mocked; no live organiser page or model was used).');
} finally {
  globalThis.fetch = originalFetch;
}
