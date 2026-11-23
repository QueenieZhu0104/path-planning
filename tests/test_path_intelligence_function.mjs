import assert from 'node:assert/strict';
import { onRequestPost as intelligencePost } from '../functions/api/path-intelligence.js';

async function run(name, test) {
  await test();
  console.log(`PASS: ${name}`);
}

await run('existing path-intelligence client has a bounded backend route', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    output_text: JSON.stringify({
      summary: 'Use the supplied activity evidence only.',
      selectedActivityIds: ['allowed', 'invented']
    })
  }), { headers: { 'content-type': 'application/json' } });
  try {
    const response = await intelligencePost({
      request: new Request('https://path.test/api/path-intelligence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          route: { university: 'Stanford University', major: 'Computer Science' },
          candidateActivities: [{ id: 'allowed', name: 'Real activity', url: 'https://example.org' }]
        })
      }),
      env: { OPENAI_API_KEY: 'test-key' }
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(payload.selectedActivityIds, ['allowed']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log('All path-intelligence tests passed. AI and external data calls were mocked.');
