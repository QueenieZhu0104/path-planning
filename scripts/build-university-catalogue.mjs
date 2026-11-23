import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({
  headless: true,
  ...(fs.existsSync(edge) ? { executablePath: edge } : {})
});

try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(root, 'public', 'index.html')).href, { waitUntil: 'load' });
  const records = await page.evaluate(() => DATA.universities.map((university, index) => ({
    id: `path-${String(index + 1).padStart(3, '0')}`,
    name: String(university.name || ''),
    country: String(university.country || ''),
    officialUrl: String(university.url || university.web_pages?.[0] || ''),
    programs: Array.isArray(university.programs) ? university.programs.map(String) : [],
    sourceLabel: String(university.source || 'Path V78 catalogue'),
    recordStatus: 'stored-v78-not-reverified',
    storedReviewDate: university.verified ? String(university.verified) : null
  })));

  const output = path.join(root, 'data', 'universities.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({
    schemaVersion: 1,
    generatedFrom: 'Path V78 DATA.universities',
    records
  }, null, 2)}\n`);
  console.log(`Wrote ${records.length} university records and ${records.reduce((total, row) => total + row.programs.length, 0)} programme labels to ${output}`);
} finally {
  await browser.close();
}
