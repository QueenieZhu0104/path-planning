import assert from 'node:assert/strict';
import { onRequestPost, onRequestGet } from '../functions/api/university-info.js';

const OFFICIAL_URL = 'https://admissions.hku.hk/';
const html = '<html><body><h1>Undergraduate admissions</h1><p>Applicants must consult the current official programme page for application requirements. The university publishes admissions information and academic programme descriptions on this official page. This text is long enough for the reader to test source extraction without claiming a specific score, fee, deadline or requirement that is not in the evidence. Applicants should check the relevant official page for the current cycle before making application decisions.</p></body></html>';
const model = {
  overview: '已读取学校官方页面；具体申请要求只列出页面明确支持的事实。',
  verifiedFacts: [{ label: '页面主题', value: '本科招生信息', sourceUrl: OFFICIAL_URL, quoteOrEvidence: '页面标题为本科招生。' }],
  notVerified: ['当前申请截止日期未从提供的页面文本中核实。'],
  nextSteps: ['打开官方专业页面确认最新申请周期。'],
  overallStatus: 'partial-source'
};
const oldFetch = globalThis.fetch;
let calls = [];
function mock(handler) {
  calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    return handler(url, init);
  };
}
const req = body => new Request('https://path.test/api/university-info', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
});
const ctx = (request, env = {}) => ({ request, env });
const sourceResponse = body => new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });
const modelResponse = value => new Response(JSON.stringify({ output_text: typeof value === 'string' ? value : JSON.stringify(value) }), { status: 200, headers: { 'content-type': 'application/json' } });

try {
  mock(() => { throw Error('should not fetch without AI'); });
  let response = await onRequestPost(ctx(req({ university: 'HKU', sourceUrls: [OFFICIAL_URL] }), {}));
  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
  console.log('PASS: missing provider returns 503 without a network call');

  mock(() => { throw Error('blocked URL must not fetch'); });
  response = await onRequestPost(ctx(req({ university: 'X', sourceUrls: ['https://evil.example/'] }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
  console.log('PASS: arbitrary domains are blocked before fetch');

  mock((url, init) => {
    if (url === OFFICIAL_URL) return sourceResponse(html);
    if (url === 'https://api.openai.com/v1/responses') {
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'gpt-6-luna');
      assert.match(body.input, /Applicants must consult/);
      assert.match(body.input, /Return JSON only/i);
      return modelResponse(model);
    }
    throw Error('unexpected ' + url);
  });
  response = await onRequestPost(ctx(req({ university: 'HKU', question: 'Current undergraduate admissions', lang: 'zh', sourceUrls: [OFFICIAL_URL] }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.info.verifiedFacts.length, 1);
  assert.equal(payload.sources[0].url, OFFICIAL_URL);
  assert.equal(payload.sources[0].retrievedAt, payload.retrievedAt);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(payload.notice, /model-generated, source-limited/i);
  assert.equal(calls[0].init.headers.accept, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.2');
  assert.equal(calls.length, 2);
  console.log('PASS: official source → AI JSON → traceable metadata with no shared POST cache');

  mock(url => url === OFFICIAL_URL
    ? new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/html' } })
    : Promise.reject(Error('AI must not be called for unavailable source')));
  response = await onRequestPost(ctx(req({ university: 'HKU', sourceUrls: [OFFICIAL_URL] }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'official_page_unavailable');
  assert.equal(calls.length, 1);
  console.log('PASS: unavailable official source has a stable source-stage error code');

  mock(url => {
    if (url === OFFICIAL_URL) return sourceResponse(html);
    if (url === 'https://api.openai.com/v1/responses') return new Response('upstream failed', { status: 503 });
    throw Error('unexpected ' + url);
  });
  response = await onRequestPost(ctx(req({ university: 'HKU', sourceUrls: [OFFICIAL_URL] }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'ai_provider_error');
  assert.equal(calls.length, 2);
  console.log('PASS: AI upstream failure has a stable provider-stage error code');

  mock(() => { throw Error('oversized request must not fetch'); });
  response = await onRequestPost(ctx(new Request('https://path.test/api/university-info', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(10_100) })
  }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, 'request_too_large');
  assert.equal(calls.length, 0);
  console.log('PASS: actual request bytes are capped without trusting Content-Length');

  mock(url => {
    if (url === OFFICIAL_URL) return sourceResponse('x'.repeat(1_800_001));
    throw Error('AI must not be called for oversized source');
  });
  response = await onRequestPost(ctx(req({ university: 'HKU', sourceUrls: [OFFICIAL_URL] }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, 'source_too_large');
  assert.equal(calls.length, 1);
  console.log('PASS: oversized official-source bodies are stopped and rejected');

  mock(url => {
    if (url === OFFICIAL_URL) return sourceResponse(html);
    if (url === 'https://api.openai.com/v1/responses') return modelResponse('{bad-json');
    throw Error('unexpected ' + url);
  });
  response = await onRequestPost(ctx(req({ university: 'HKU', sourceUrls: [OFFICIAL_URL] }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'invalid_ai_output');
  console.log('PASS: malformed model output has a stable error code');

  mock(url => {
    if (url === OFFICIAL_URL) return sourceResponse(html);
    if (url === 'https://api.openai.com/v1/responses') return modelResponse({ ...model, verifiedFacts: [{ label: 'Unsupported', value: 'No evidence locator', sourceUrl: OFFICIAL_URL }] });
    throw Error('unexpected ' + url);
  });
  response = await onRequestPost(ctx(req({ university: 'HKU', sourceUrls: [OFFICIAL_URL] }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).info.verifiedFacts.length, 0);
  console.log('PASS: facts without an evidence locator are not returned as source-linked facts');

  mock(url => url === OFFICIAL_URL
    ? new Response('', { status: 302, headers: { location: 'https://evil.example/redirect' } })
    : Promise.reject(Error('redirect target requested')));
  response = await onRequestPost(ctx(req({ university: 'HKU', sourceUrls: [OFFICIAL_URL] }), { OPENAI_API_KEY: 'test' }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 1);
  console.log('PASS: redirects to unapproved domains are blocked');

  assert.equal(onRequestGet().status, 405);
  console.log('PASS: unsupported GET method returns 405');
  console.log('All university-info contract tests passed (mocked; no live provider calls).');
} finally {
  globalThis.fetch = oldFetch;
}
