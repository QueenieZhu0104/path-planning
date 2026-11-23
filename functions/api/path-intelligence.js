import { readJsonRequest, RequestBodyError } from '../_lib/bounded-body.js';
import { responsesProvider } from '../_lib/openai-endpoint.js';
import { findUniversitiesByNames } from '../_lib/university-store.js';

const MAX_REQUEST_BYTES = 20_000;
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const clean = (value, max = 800) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function extractOutput(body) {
  if (typeof body?.output_text === 'string') return body.output_text;
  return (body?.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text' || item.type === 'text').map(item => item.text || '').join('\n');
}

function parseResult(text, allowedIds) {
  let value;
  try { value = JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { throw new Error('invalid_ai_output'); }
  const summary = clean(value?.summary, 1200);
  if (!summary) throw new Error('invalid_ai_output');
  const selectedActivityIds = Array.isArray(value?.selectedActivityIds)
    ? [...new Set(value.selectedActivityIds.map(String).filter(id => allowedIds.has(id)))].slice(0, 3)
    : [];
  return { summary, selectedActivityIds };
}

const INSTRUCTIONS = `Return JSON only: {"summary":"...","selectedActivityIds":["..."]}.
Use only the supplied route facts, catalogue record and candidate activities. Select at most three IDs, and only IDs supplied in candidateActivities. Never invent requirements, deadlines, scores, admission chances or activities. Clearly distinguish university-run opportunities from independent direction evidence. If evidence is sparse, say so. Use the student's language and keep the summary concise.`;

export async function onRequestPost({ request, env = {} }) {
  const provider = responsesProvider(env, { consultant: true });
  if (!provider && !env.AI) return json({ error: 'ai_not_configured' }, 503);
  let body;
  try { body = await readJsonRequest(request, MAX_REQUEST_BYTES); }
  catch (error) {
    if (error instanceof RequestBodyError) return json({ error: error.code }, error.status);
    return json({ error: 'invalid_json' }, 400);
  }
  const university = clean(body?.route?.university, 220);
  const major = clean(body?.route?.major, 180);
  if (!university || !major) return json({ error: 'missing_route' }, 400);
  const candidates = Array.isArray(body?.candidateActivities) ? body.candidateActivities.slice(0, 12).map(item => ({
    id: clean(String(item?.id || ''), 100),
    name: clean(item?.name, 220),
    type: clean(item?.type, 120),
    sourceLabel: clean(item?.sourceLabel, 220),
    eligibility: clean(item?.eligibility, 500),
    url: clean(item?.url, 1000)
  })).filter(item => item.id && item.name) : [];
  const allowedIds = new Set(candidates.map(item => item.id));
  const universityRecord = (await findUniversitiesByNames(env, [university]))[0] || null;
  const prompt = JSON.stringify({
    route: { university, major },
    profile: body?.profile || {},
    discovery: body?.user || {},
    facts: body?.facts || {},
    universityRecord,
    candidateActivities: candidates
  });
  try {
    let output;
    if (provider) {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${provider.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: provider.model,
          instructions: INSTRUCTIONS,
          input: prompt,
          text: { format: { type: 'json_object' } },
          store: false,
          max_output_tokens: 700
        }),
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) throw new Error('ai_provider_error');
      output = extractOutput(await response.json());
    } else {
      const result = await env.AI.run(env.WORKERS_AI_CONSULTANT_MODEL || env.WORKERS_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'system', content: INSTRUCTIONS }, { role: 'user', content: prompt }],
        max_tokens: 700
      });
      output = result?.response || result?.output_text || result?.result?.response || '';
    }
    return json({ ...parseResult(output, allowedIds), provider: provider?.name || 'cloudflare-workers-ai' });
  } catch (error) {
    if (/TimeoutError|AbortError/.test(String(error?.message))) return json({ error: 'request_timeout' }, 504);
    if (error?.message === 'invalid_ai_output') return json({ error: 'invalid_ai_output' }, 502);
    return json({ error: 'path_intelligence_failed' }, 502);
  }
}

export function onRequestGet() {
  return json({ error: 'method_not_allowed' }, 405);
}
