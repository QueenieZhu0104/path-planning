import { searchUniversities } from '../_lib/university-store.js';

const json = (body, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cache,
    'x-content-type-options': 'nosniff'
  }
});

export async function onRequestGet({ request, env = {} }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const country = (url.searchParams.get('country') || '').trim();
  const limit = Number(url.searchParams.get('limit') || 20);
  const includeScorecard = url.searchParams.get('live') === '1';
  try {
    const result = await searchUniversities(env, { query, country, limit, includeScorecard });
    return json(result, 200, includeScorecard ? 'no-store' : 'public, max-age=60');
  } catch {
    return json({ error: 'university_catalogue_failed', message: 'The university catalogue could not be queried.' }, 502);
  }
}

export function onRequestPost() {
  return json({ error: 'method_not_allowed', message: 'Use GET with optional q, country, limit, and live parameters.' }, 405);
}
