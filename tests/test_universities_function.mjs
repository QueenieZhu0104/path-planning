import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/universities.js';

async function body(response) { return response.json(); }
async function run(name, test) {
  await test();
  console.log(`PASS: ${name}`);
}

await run('bundled global catalogue searches the 31-record Path dataset', async () => {
  const response = await onRequestGet({ request: new Request('https://path.test/api/universities?q=National%20University&limit=5'), env: {} });
  const payload = await body(response);
  assert.equal(response.status, 200);
  assert.equal(payload.metadata.catalogueProvider, 'path-bundled');
  assert.equal(payload.records[0].name, 'National University of Singapore');
  assert.equal(payload.records[0].recordStatus, 'stored-v78-not-reverified');
});

await run('D1 binding is used when configured', async () => {
  let bound;
  const database = {
    prepare(sql) {
      assert.match(sql, /FROM universities/);
      return {
        bind(...values) {
          bound = values;
          return { all: async () => ({ results: [{ id: 'd1-1', name: 'Example University', country: 'Canada', official_url: 'https://example.edu', programs_json: '["Physics"]', source_label: 'D1 seed', record_status: 'catalogue-record' }] }) };
        }
      };
    }
  };
  const response = await onRequestGet({ request: new Request('https://path.test/api/universities?q=Example'), env: { UNIVERSITY_DB: database } });
  const payload = await body(response);
  assert.deepEqual(bound.slice(0, 3), ['Example', '%example%', '']);
  assert.equal(payload.metadata.catalogueProvider, 'cloudflare-d1');
  assert.equal(payload.records[0].programs[0], 'Physics');
});

await run('live provider request is explicit when College Scorecard is not configured', async () => {
  const response = await onRequestGet({ request: new Request('https://path.test/api/universities?q=Stanford&live=1'), env: {} });
  const payload = await body(response);
  assert.equal(payload.metadata.liveProvider, 'not-configured');
  assert.ok(payload.metadata.warnings.includes('college_scorecard_not_configured'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

await run('College Scorecard response is normalized without exposing its key', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    assert.equal(parsed.hostname, 'api.data.gov');
    assert.equal(parsed.searchParams.get('api_key'), 'secret-test-key');
    return new Response(JSON.stringify({ results: [{
      id: 243744,
      'school.name': 'Stanford University',
      'school.city': 'Stanford',
      'school.state': 'CA',
      'school.school_url': 'www.stanford.edu',
      'latest.student.size': 7800,
      'latest.admissions.admission_rate.overall': 0.037,
      'latest.admissions.sat_scores.average.overall': 1540,
      'latest.admissions.act_scores.midpoint.cumulative': 35
    }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = await onRequestGet({ request: new Request('https://path.test/api/universities?q=Stanford&live=1'), env: { COLLEGE_SCORECARD_API_KEY: 'secret-test-key' } });
    const text = await response.text();
    const payload = JSON.parse(text);
    assert.equal(payload.metadata.liveProvider, 'college-scorecard');
    assert.equal(payload.records[0].provider, 'college-scorecard');
    assert.equal(payload.records[0].officialUrl, 'https://www.stanford.edu/');
    assert.equal(payload.records[0].admissionRate, 0.037);
    assert.equal(payload.records[0].satAverage, 1540);
    assert.equal(payload.records[0].actMidpoint, 35);
    assert.equal(text.includes('secret-test-key'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await run('POST is rejected', async () => {
  const response = onRequestPost();
  assert.equal(response.status, 405);
});

console.log('All university catalogue tests passed. College Scorecard HTTP was mocked; no live key was used.');
