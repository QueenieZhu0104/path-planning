import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'public', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());

assert.ok(scripts.length > 0, 'public/index.html must contain at least one inline script');

const scratch = mkdtempSync(join(tmpdir(), 'path-inline-syntax-'));
try {
  scripts.forEach((source, index) => {
    const target = join(scratch, `inline-${index + 1}.mjs`);
    writeFileSync(target, source);
    const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
    assert.equal(result.status, 0, `inline script ${index + 1} failed node --check:\n${result.stderr}`);
  });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`PASS: ${scripts.length} inline scripts in public/index.html pass node --check`);
