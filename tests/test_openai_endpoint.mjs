import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openAIResponsesUrl, responsesProvider } from '../functions/_lib/openai-endpoint.js';

assert.equal(
  openAIResponsesUrl({}),
  'https://api.openai.com/v1/responses'
);
console.log('PASS: direct OpenAI calls retain the official default endpoint');

assert.equal(
  openAIResponsesUrl({ OPENAI_BASE_URL: 'https://gateway.netlify.example/openai/' }),
  'https://gateway.netlify.example/openai/v1/responses'
);
console.log('PASS: configured OpenAI base URLs route Responses API calls through Netlify AI Gateway');

assert.deepEqual(
  responsesProvider({ DEEPSEEK_API_KEY: 'server-secret' }),
  { name: 'deepseek', apiKey: 'server-secret', url: 'https://api.deepseek.com/responses', model: 'deepseek-flash' }
);
assert.equal(
  responsesProvider({ DEEPSEEK_API_KEY: '  server-secret  ', DEEPSEEK_BASE_URL: 'https://gateway.example/deepseek/' }).url,
  'https://gateway.example/deepseek/responses'
);
assert.equal(responsesProvider({ DEEPSEEK_API_KEY: '  server-secret  ' }).apiKey, 'server-secret');
assert.equal(
  responsesProvider({ DEEPSEEK_API_KEY: 'deepseek-secret', OPENAI_API_KEY: 'openai-secret' }).name,
  'deepseek'
);
assert.equal(
  responsesProvider({ DEEPSEEK_API_KEY: 'secret', DEEPSEEK_CONSULTANT_MODEL: 'deepseek-v4-pro' }, { consultant: true }).model,
  'deepseek-v4-pro'
);
console.log('PASS: DeepSeek is the preferred server-side Responses provider with an overridable model');

for (const file of [
  'activity-details.js',
  'path-intelligence.js',
  'route-evidence.js',
  'syllabus.js',
  'university-info.js'
]) {
  const source = readFileSync(new URL(`../functions/api/${file}`, import.meta.url), 'utf8');
  assert.match(source, /responsesProvider\(env/, `${file} should use the shared provider resolver`);
  assert.doesNotMatch(source, /https:\/\/api\.openai\.com/, `${file} must not bypass OPENAI_BASE_URL`);
}
console.log('PASS: all five AI routes use the shared DeepSeek/OpenAI provider resolver');
