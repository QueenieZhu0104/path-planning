import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import activityDetails, { config as activityDetailsConfig } from '../netlify/functions/activity-details.mjs';
import universities, { config as universitiesConfig } from '../netlify/functions/universities.mjs';
import pathIntelligence, { config as intelligenceConfig } from '../netlify/functions/path-intelligence.mjs';
import routeEvidence, { config as routeEvidenceConfig } from '../netlify/functions/route-evidence.mjs';
import syllabus, { config as syllabusConfig } from '../netlify/functions/syllabus.mjs';
import universityInfo, { config as universityInfoConfig } from '../netlify/functions/university-info.mjs';

const savedEnv = Object.fromEntries([
  'OPENAI_API_KEY',
  'COLLEGE_SCORECARD_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_CONSULTANT_MODEL'
  ,'DEEPSEEK_API_KEY'
  ,'DEEPSEEK_MODEL'
  ,'DEEPSEEK_CONSULTANT_MODEL'
].map(key => [key, process.env[key]]));

for (const key of Object.keys(savedEnv)) delete process.env[key];

try {
  const netlifyConfig = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  const pnpmConfig = readFileSync(new URL('../.npmrc', import.meta.url), 'utf8');
  assert.match(netlifyConfig, /node_bundler\s*=\s*"esbuild"/);
  assert.doesNotMatch(netlifyConfig, /external_node_modules[\s\S]*@netlify\/blobs/);
  assert.match(pnpmConfig, /^node-linker=hoisted\s*$/m);
  console.log('PASS: Netlify uses a hoisted physical Blobs package instead of a pnpm junction');

  const evidenceCacheSource = readFileSync(new URL('../netlify/evidence-cache.mjs', import.meta.url), 'utf8');
  assert.match(evidenceCacheSource, /store\.list\(\{\s*prefix:\s*'route\/'\s*,\s*paginate:\s*true\s*\}\)/);
  console.log('PASS: the hourly stale scan paginates the complete route-evidence key set');

  assert.deepEqual([
    activityDetailsConfig.path,
    universitiesConfig.path,
    intelligenceConfig.path,
    routeEvidenceConfig.path,
    syllabusConfig.path,
    universityInfoConfig.path
  ], [
    '/api/activity-details',
    '/api/universities',
    '/api/path-intelligence',
    '/api/route-evidence',
    '/api/syllabus',
    '/api/university-info'
  ]);
  console.log('PASS: all six Netlify Functions keep the existing /api paths');

  assert.deepEqual(routeEvidenceConfig.rateLimit, {
    windowLimit: 6,
    windowSize: 60,
    aggregateBy: ['ip', 'domain']
  });
  console.log('PASS: the public live-evidence route has a code-level per-IP/domain rate limit');
  assert.deepEqual(activityDetailsConfig.rateLimit, {
    windowLimit: 12,
    windowSize: 60,
    aggregateBy: ['ip', 'domain']
  });
  console.log('PASS: the registered activity-details route has a code-level per-IP/domain rate limit');

  let response = await universities(new Request('https://path.netlify.test/api/universities?q=Stanford'));
  assert.equal(response.status, 200);
  let payload = await response.json();
  assert.equal(payload.records[0].name, 'Stanford University');
  assert.equal(payload.metadata.catalogueProvider, 'path-bundled');
  console.log('PASS: Netlify university adapter uses the bundled catalogue without Cloudflare D1');

  for (const [name, handler, url] of [
    ['path-intelligence', pathIntelligence, '/api/path-intelligence'],
    ['syllabus', syllabus, '/api/syllabus'],
    ['university-info', universityInfo, '/api/university-info']
  ]) {
    response = await handler(new Request(`https://path.netlify.test${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    }));
    assert.equal(response.status, 503, `${name} should require a server-side AI provider`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  console.log('PASS: retained Netlify AI adapters expose explicit no-provider 503/no-store states');

  response = await activityDetails(new Request('https://path.netlify.test/api/activity-details?id=not-registered'));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'unknown_activity');
  console.log('PASS: Netlify activity-details adapter rejects unregistered IDs before network or AI access');

  response = await routeEvidence(new Request('https://path.netlify.test/api/route-evidence', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'missing_route');
  console.log('PASS: Netlify route-evidence adapter validates the route before source or AI access');

  response = await universities(new Request('https://path.netlify.test/api/universities', { method: 'PUT' }));
  assert.equal(response.status, 405);
  console.log('PASS: Netlify adapter rejects unmapped HTTP methods');
} finally {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log('All Netlify adapter checks passed. No account, deployment, live AI, competition page, or live College Scorecard call was used.');
