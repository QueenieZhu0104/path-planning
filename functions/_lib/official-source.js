import { readBoundedText } from './bounded-body.js';
import { parseAllowedActivityUrl, parseAllowedUniversityUrl } from './source-policy.js';

const MAX_SOURCE_BYTES = 1_800_000;

export function htmlToEvidenceText(html) {
  return String(html || '')
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?\s*>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code >= 32 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/[\t\r ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

export function normalizeEvidenceText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function readOfficialSource(rawUrl, { kind = 'university', activityId = '' } = {}) {
  const parse = kind === 'activity' ? parseAllowedActivityUrl : parseAllowedUniversityUrl;
  let url = parse(rawUrl);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.2',
        'user-agent': 'Path-Evidence-Research/1.0 (source-limited educational summary)'
      },
      signal: AbortSignal.timeout(7_000)
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirectCount === 3) throw new Error('too_many_redirects');
      const location = response.headers.get('location');
      if (!location) throw new Error('redirect_without_location');
      try { url = parse(new URL(location, url).toString()); }
      catch { throw new Error('redirect_not_allowed'); }
      continue;
    }
    if (!response.ok) throw new Error('official_page_unavailable');
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
      throw new Error('unsupported_source_type');
    }
    const html = await readBoundedText(response, MAX_SOURCE_BYTES, 'source_too_large');
    const text = htmlToEvidenceText(html).slice(0, 9_000);
    if (text.length < 180) throw new Error('source_has_insufficient_text');
    return {
      url: url.toString(),
      kind,
      activityId: String(activityId || ''),
      text,
      textLength: text.length,
      contentHash: await sha256(text),
      etag: response.headers.get('etag') || null,
      lastModified: response.headers.get('last-modified') || null,
      retrievedAt: new Date().toISOString()
    };
  }
  throw new Error('source_fetch_failed');
}
