import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isAllowedUniversityHost } from '../functions/_lib/source-policy.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = dirname(dirname(fileURLToPath(import.meta.url)));

function browserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : ''
  ].filter(Boolean);
  return candidates.find(existsSync);
}

async function readPrefix(response, maxBytes = 256_000) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    if (total >= maxBytes) await reader.cancel('audit prefix complete').catch(() => {});
    return text;
  } finally {
    reader.releaseLock();
  }
}

async function auditSource(university) {
  const started = Date.now();
  try {
    const response = await fetch(university.url, {
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.2',
        'user-agent': 'Path-Source-Audit/1.0 (reachability only; no admissions verification)'
      },
      signal: AbortSignal.timeout(15_000)
    });
    const contentType = response.headers.get('content-type') || '';
    const prefix = /text\/html|application\/xhtml\+xml/i.test(contentType) ? await readPrefix(response) : '';
    const title = (prefix.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    const finalUrl = response.url || university.url;
    const finalHostAllowed = isAllowedUniversityHost(new URL(finalUrl).hostname);
    return {
      university: university.name,
      requestedUrl: university.url,
      status: response.status,
      ok: response.ok,
      contentType,
      finalUrl,
      finalHostAllowed,
      title,
      elapsedMs: Date.now() - started,
      scope: 'reachability-only'
    };
  } catch (error) {
    return {
      university: university.name,
      requestedUrl: university.url,
      ok: false,
      error: error?.name || 'Error',
      message: String(error?.message || error),
      elapsedMs: Date.now() - started,
      scope: 'reachability-only'
    };
  }
}

const executablePath = browserExecutable();
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
let universities;
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(`${root}/public/index.html`).href, { waitUntil: 'load' });
  universities = await page.evaluate(() => DATA.universities.map(({ name, url }) => ({ name, url })));
} finally {
  await browser.close();
}

const results = [];
for (let index = 0; index < universities.length; index += 4) {
  results.push(...await Promise.all(universities.slice(index, index + 4).map(auditSource)));
}
for (const result of results) console.log(JSON.stringify(result));
const summary = {
  checkedAt: new Date().toISOString(),
  total: results.length,
  reachableHtml: results.filter(result => result.ok && /text\/html|application\/xhtml\+xml/i.test(result.contentType || '')).length,
  httpOrNetworkFailures: results.filter(result => !result.ok).length,
  redirectsOutsideAllowlist: results.filter(result => result.finalUrl && result.finalHostAllowed === false).length,
  scope: 'HTTP reachability/content-type/final-host only; programme names, admissions requirements, dates, scores, and review claims were not verified'
};
console.log('SUMMARY ' + JSON.stringify(summary));
if (summary.httpOrNetworkFailures || summary.redirectsOutsideAllowlist) process.exitCode = 2;
