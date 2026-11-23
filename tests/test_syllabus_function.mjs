import assert from 'node:assert/strict';
import { onRequestPost, onRequestGet } from '../functions/api/syllabus.js';

const OFFICIAL_URL = 'https://chs.nus.edu.sg/programmes/dse/';
const sample = {
  overview: 'This field combines economic questions with statistics and computing to interpret data and test explanations.',
  learningAreas: [
    { title: 'Math and statistics', description: 'Use probability and statistical reasoning to evaluate evidence.' },
    { title: 'Programming and data', description: 'Clean, analyse and visualise datasets.' },
    { title: 'Economics', description: 'Study incentives, markets, policy and economic models.' },
    { title: 'Applied analysis', description: 'Connect models with real-world economic questions.' }
  ],
  projectIdeas: ['Analyse a public dataset and note its limitations.', 'Compare possible effects of two policy choices.', 'Write a reproducible analysis report.'],
  careerDirections: ['Data analyst', 'Economic research assistant', 'Policy or market analysis support'],
  suitableFor: 'Students who enjoy maths, social questions and evidence-based reasoning.',
  challenges: 'Models and results depend on assumptions and data quality.',
  comparison: 'This combines economic interpretation with more data and computational work.',
  sourceEvidence: ['The official page identifies the Data Science and Economics programme.'],
  sourceLimitations: 'The source page is a programme overview and does not verify every module.'
};
const sourceHtml = `<!doctype html><html><head><title>Data Science and Economics</title><style>.hide{display:none}</style></head><body>
<h1>Data Science and Economics</h1><p>This official programme overview describes data science and economics as an interdisciplinary field. Students can learn about quantitative methods, economic questions, data, research and applications. The curriculum structure, detailed course information, academic requirements and programme options may be revised from time to time. Read the relevant official university pages for current details. This paragraph deliberately provides enough public text for the server-side source reader to test the programme summary flow.</p>
<p>Students explore how data and quantitative reasoning can be used to better understand markets, policy, people, and institutions in changing economic contexts. They should consult the official academic handbook before making any course decisions.</p></body></html>`;
const originalFetch = globalThis.fetch;
let calls = [];
function mockFetch(handler) {
  calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    return handler(url, init);
  };
}
function request(body = { university: 'National University of Singapore', major: 'Data Science and Economics', lang: 'zh', sourceUrl: OFFICIAL_URL }) {
  return new Request('https://path.test/api/syllabus', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
}
function context(req, env = {}) { return { request: req, env }; }
function htmlResponse(html = sourceHtml, status = 200) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
function openaiResponse(output) {
  return new Response(JSON.stringify({ output_text: typeof output === 'string' ? output : JSON.stringify(output) }), {
    status: 200, headers: { 'content-type': 'application/json' }
  });
}

try {
  // No secret/binding should return a clear configuration response, not pretend to generate.
  mockFetch(() => { throw new Error('fetch should not run without provider'); });
  const notConfigured = await onRequestPost(context(request(), {}));
  assert.equal(notConfigured.status, 503);
  assert.equal((await notConfigured.json()).error, 'ai_not_configured');
  assert.equal(calls.length, 0);
  console.log('PASS: unconfigured AI returns explicit 503 fallback state');

  // Block arbitrary external hosts before any network request.
  mockFetch(() => { throw new Error('fetch should not run for blocked host'); });
  const blocked = await onRequestPost(context(request({ university: 'X', major: 'X', lang: 'zh', sourceUrl: 'https://evil.example.test/x' }), { OPENAI_API_KEY: 'test-key' }));
  assert.equal(blocked.status, 400);
  assert.equal((await blocked.json()).error, 'source_not_allowed');
  assert.equal(calls.length, 0);
  console.log('PASS: unapproved source domains are blocked');

  // Official-page fetch and OpenAI structured response flow.
  mockFetch((url, init) => {
    if (url === OFFICIAL_URL) return Promise.resolve(htmlResponse());
    if (url === 'https://api.openai.com/v1/responses') {
      const reqBody = JSON.parse(init.body);
      assert.equal(reqBody.model, 'gpt-6-luna');
      assert.match(reqBody.input, /BEGIN SOURCE TEXT/);
      assert.match(reqBody.instructions, /Do not copy source phrasing/);
      return Promise.resolve(openaiResponse(sample));
    }
    throw new Error('unexpected URL ' + url);
  });
  const openai = await onRequestPost(context(request(), { OPENAI_API_KEY: 'test-key' }));
  assert.equal(openai.status, 200);
  const openaiPayload = await openai.json();
  assert.equal(openaiPayload.provider, 'openai');
  assert.equal(openaiPayload.syllabus.overview, sample.overview);
  assert.equal(openaiPayload.syllabus.learningAreas.length, 4);
  assert.ok(['programme-mentioned-on-source-page', 'university-catalogue-or-general-source'].includes(openaiPayload.sourceCoverage));
  assert.equal(openaiPayload.sourceUrl, OFFICIAL_URL);
  assert.equal(calls.length, 2);
  console.log('PASS: official-source fetch → prompt → structured OpenAI answer');

  // Enforce the real request bytes even when Content-Length is absent.
  mockFetch(() => { throw new Error('oversized request must not fetch'); });
  const oversizedRequest = new Request('https://path.test/api/syllabus', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(18_100) })
  });
  const oversized = await onRequestPost(context(oversizedRequest, { OPENAI_API_KEY: 'test-key' }));
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error, 'request_too_large');
  assert.equal(calls.length, 0);
  console.log('PASS: actual request bytes are capped without trusting Content-Length');

  // Stop reading an official page once it exceeds the source limit.
  mockFetch((url) => {
    if (url === OFFICIAL_URL) return Promise.resolve(htmlResponse('x'.repeat(2_500_001)));
    throw new Error('AI must not be called for oversized source');
  });
  const sourceTooLarge = await onRequestPost(context(request(), { OPENAI_API_KEY: 'test-key' }));
  assert.equal(sourceTooLarge.status, 413);
  assert.equal((await sourceTooLarge.json()).error, 'source_too_large');
  assert.equal(calls.length, 1);
  console.log('PASS: oversized official-source bodies are stopped and rejected');

  // A redirect to an unapproved host must not be followed.
  mockFetch((url) => {
    if (url === OFFICIAL_URL) return Promise.resolve(new Response('', { status: 302, headers: { location: 'https://evil.example.test/steal' } }));
    throw new Error('redirect target must never be requested');
  });
  const redirect = await onRequestPost(context(request(), { OPENAI_API_KEY: 'test-key' }));
  assert.equal(redirect.status, 400);
  assert.equal((await redirect.json()).error, 'source_not_allowed');
  assert.equal(calls.length, 1);
  console.log('PASS: redirects outside official university domains are blocked');

  // Cloudflare Workers AI binding flow.
  mockFetch((url) => {
    if (url === OFFICIAL_URL) return Promise.resolve(htmlResponse());
    throw new Error('Workers AI binding should not call external OpenAI');
  });
  let cfPrompt = '';
  const cf = await onRequestPost(context(request(), { AI: { run: async (model, body) => {
    assert.match(model, /llama-3\.1-8b-instruct/);
    cfPrompt = body.messages.map(x => x.content).join('\n');
    return { response: JSON.stringify(sample) };
  } } }));
  assert.equal(cf.status, 200);
  const cfPayload = await cf.json();
  assert.equal(cfPayload.provider, 'cloudflare-workers-ai');
  assert.match(cfPrompt, /BEGIN SOURCE TEXT/);
  console.log('PASS: Cloudflare Workers AI binding flow');

  // Invalid model output should return a clear structured error.
  mockFetch((url) => {
    if (url === OFFICIAL_URL) return Promise.resolve(htmlResponse());
    if (url === 'https://api.openai.com/v1/responses') return Promise.resolve(openaiResponse('{ not-json '));
    throw new Error('unexpected URL ' + url);
  });
  const invalid = await onRequestPost(context(request(), { OPENAI_API_KEY: 'test-key' }));
  assert.equal(invalid.status, 502);
  assert.equal((await invalid.json()).error, 'invalid_ai_output');
  console.log('PASS: malformed AI JSON is rejected');

  const get = onRequestGet();
  assert.equal(get.status, 405);
  console.log('PASS: unsupported GET method returns 405');
  console.log('\nAll mocked backend tests passed. No live AI provider was called.');
} finally {
  globalThis.fetch = originalFetch;
}
