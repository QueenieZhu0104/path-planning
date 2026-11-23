import catalogue from '../../data/universities.json' with { type: 'json' };

const SCORECARD_ENDPOINT = 'https://api.data.gov/ed/collegescorecard/v1/schools.json';

function clean(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanPrograms(value) {
  const list = Array.isArray(value) ? value : (() => {
    try { return JSON.parse(value || '[]'); } catch { return []; }
  })();
  return list.filter(item => typeof item === 'string').map(item => item.trim().slice(0, 180)).filter(Boolean).slice(0, 120);
}

function cleanOfficialUrl(value) {
  let text = clean(value, 1000);
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text.replace(/^\/+/, '')}`;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRecord(row, provider = 'path-bundled') {
  return {
    id: clean(String(row?.id ?? ''), 80),
    name: clean(row?.name ?? row?.['school.name'], 220),
    country: clean(row?.country, 100),
    city: clean(row?.city ?? row?.['school.city'], 120) || null,
    region: clean(row?.region ?? row?.['school.state'], 80) || null,
    officialUrl: cleanOfficialUrl(row?.officialUrl ?? row?.official_url ?? row?.['school.school_url']),
    programs: cleanPrograms(row?.programs ?? row?.programs_json),
    sourceLabel: clean(row?.sourceLabel ?? row?.source_label, 240) || (provider === 'college-scorecard' ? 'U.S. Department of Education College Scorecard' : 'Path university catalogue'),
    recordStatus: clean(row?.recordStatus ?? row?.record_status, 80) || 'catalogue-record',
    storedReviewDate: clean(row?.storedReviewDate ?? row?.stored_review_date, 40) || null,
    undergraduateSize: numberOrNull(row?.undergraduateSize ?? row?.['latest.student.size']),
    admissionRate: numberOrNull(row?.admissionRate ?? row?.['latest.admissions.admission_rate.overall']),
    satAverage: numberOrNull(row?.satAverage ?? row?.['latest.admissions.sat_scores.average.overall']),
    actMidpoint: numberOrNull(row?.actMidpoint ?? row?.['latest.admissions.act_scores.midpoint.cumulative']),
    provider
  };
}

function matches(record, query, country) {
  const q = query.toLowerCase();
  const c = country.toLowerCase();
  const haystack = `${record.name} ${record.country} ${record.city || ''} ${record.region || ''} ${record.programs.join(' ')}`.toLowerCase();
  return (!q || haystack.includes(q)) && (!c || record.country.toLowerCase() === c);
}

function bundledSearch({ query = '', country = '', limit = 20 } = {}) {
  return catalogue.records
    .map(row => normalizeRecord(row))
    .filter(row => row.name && matches(row, query, country))
    .slice(0, limit);
}

async function d1Search(database, { query = '', country = '', limit = 20 } = {}) {
  const like = `%${query.toLowerCase()}%`;
  const statement = database.prepare(`
    SELECT id, name, country, city, region, official_url, programs_json,
           source_label, record_status, stored_review_date
      FROM universities
     WHERE (?1 = '' OR lower(name) LIKE ?2 OR lower(country) LIKE ?2
            OR lower(coalesce(city, '')) LIKE ?2 OR lower(programs_json) LIKE ?2)
       AND (?3 = '' OR lower(country) = ?3)
     ORDER BY name
     LIMIT ?4
  `).bind(query, like, country.toLowerCase(), limit);
  const result = await statement.all();
  return (result?.results || []).map(row => normalizeRecord(row, 'cloudflare-d1')).filter(row => row.name);
}

async function scorecardSearch(apiKey, { query = '', limit = 10 } = {}) {
  if (!query || query.length < 2) return [];
  const url = new URL(SCORECARD_ENDPOINT);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('school.name', query);
  url.searchParams.set('fields', 'id,school.name,school.city,school.state,school.school_url,latest.student.size,latest.admissions.admission_rate.overall,latest.admissions.sat_scores.average.overall,latest.admissions.act_scores.midpoint.cumulative');
  url.searchParams.set('page', '0');
  url.searchParams.set('per_page', String(Math.min(limit, 20)));
  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json', 'user-agent': 'Path-University-Catalogue/1.0' },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`college_scorecard_${response.status}`);
  const payload = await response.json();
  return (Array.isArray(payload?.results) ? payload.results : []).map(row => normalizeRecord({
    ...row,
    id: `scorecard-${row.id}`,
    country: 'United States',
    recordStatus: 'live-provider-metadata'
  }, 'college-scorecard')).filter(row => row.name);
}

function mergeRecords(primary, secondary, limit) {
  const seen = new Set();
  const merged = [];
  for (const row of [...primary, ...secondary]) {
    const key = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= limit) break;
  }
  return merged;
}

export async function searchUniversities(env = {}, options = {}) {
  const query = clean(options.query, 120);
  const country = clean(options.country, 100);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
  const warnings = [];
  let records;
  let catalogueProvider;

  if (env.UNIVERSITY_DB?.prepare) {
    try {
      records = await d1Search(env.UNIVERSITY_DB, { query, country, limit });
      catalogueProvider = 'cloudflare-d1';
    } catch {
      warnings.push('university_database_unavailable_using_bundled_catalogue');
    }
  }
  if (!records) {
    records = bundledSearch({ query, country, limit });
    catalogueProvider = 'path-bundled';
  }

  let liveProvider = 'not-requested';
  if (options.includeScorecard) {
    if (!env.COLLEGE_SCORECARD_API_KEY) {
      liveProvider = 'not-configured';
      warnings.push('college_scorecard_not_configured');
    } else if (country && country.toLowerCase() !== 'united states') {
      liveProvider = 'not-applicable';
    } else {
      try {
        const scorecard = await scorecardSearch(env.COLLEGE_SCORECARD_API_KEY, { query, limit });
        records = mergeRecords(scorecard, records, limit);
        liveProvider = 'college-scorecard';
      } catch (error) {
        liveProvider = 'unavailable';
        warnings.push(String(error?.message || 'college_scorecard_unavailable'));
      }
    }
  }

  return {
    records,
    metadata: {
      query,
      country: country || null,
      count: records.length,
      catalogueProvider,
      liveProvider,
      fetchedAt: new Date().toISOString(),
      warnings,
      scope: 'University identity, official-link and programme-label discovery. Not current admissions verification.'
    }
  };
}

export async function findUniversitiesByNames(env = {}, names = []) {
  const wanted = [...new Set(names.filter(name => typeof name === 'string').map(name => name.trim()).filter(Boolean))].slice(0, 8);
  if (!wanted.length) return [];
  if (env.UNIVERSITY_DB?.prepare) {
    try {
      const rows = [];
      for (const name of wanted) {
        const result = await env.UNIVERSITY_DB.prepare(`
          SELECT id, name, country, city, region, official_url, programs_json,
                 source_label, record_status, stored_review_date
            FROM universities
           WHERE lower(name) = ?1
           LIMIT 1
        `).bind(name.toLowerCase()).first();
        if (result) rows.push(normalizeRecord(result, 'cloudflare-d1'));
      }
      if (rows.length) return rows;
    } catch {
      // Fall through to the complete bundled catalogue rather than a 50-row window.
    }
  }
  const map = new Map(catalogue.records.map(row => normalizeRecord(row)).filter(row => row.name).map(row => [row.name.toLowerCase(), row]));
  return wanted.map(name => map.get(name.toLowerCase())).filter(Boolean);
}

export { SCORECARD_ENDPOINT };
