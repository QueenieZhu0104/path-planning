import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

assert.doesNotMatch(index, /<title>[^<]*V[0-9]+/i, 'the browser title must not expose a release number');
const routeEvidence = readFileSync(new URL('../functions/api/route-evidence.js', import.meta.url), 'utf8');
const activityDetails = readFileSync(new URL('../functions/api/activity-details.js', import.meta.url), 'utf8');
const refresh = readFileSync(new URL('../netlify/functions/evidence-refresh.mjs', import.meta.url), 'utf8');

assert.doesNotMatch(index, /CollegeSeek|path-consultant|\/api\/college-consultant/);
assert.equal(existsSync(new URL('../functions/api/college-consultant.js', import.meta.url)), false);
assert.equal(existsSync(new URL('../netlify/functions/college-consultant.mjs', import.meta.url)), false);
console.log('PASS: CollegeSeek UI, endpoint, adapter, and assets are removed');

assert.doesNotMatch(index, /nav\('compare'\)|S\.page==='compare'|data-live-compare|path-live-compare-card/);
assert.doesNotMatch(index, /比较这些方向|比較這些方向|Compare these directions|开始对比|開始比較|Compare now/);
assert.match(index, /if\(p==='compare'\|\|p==='consultant'\)p='plan'/);
console.log('PASS: Compare has no UI entry or render route and legacy navigation falls back to Plan');

assert.match(routeEvidence, /ROUTE_EVIDENCE_TTL_MS\s*=\s*48\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
assert.match(activityDetails, /ACTIVITY_DETAILS_TTL_MS\s*=\s*48\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
assert.match(refresh, /schedule:\s*'0 \* \* \* \*'/);
assert.match(refresh, /refreshDueActivities/);
assert.match(index, /PATH_LIVE_ACTIVITY_V79=\{version:'V79',ttlHours:48,endpoint:'\/api\/activity-details',registryOnly:true,autoDiscovery:false\}/);
console.log('PASS: registered route and activity records use a 48-hour TTL while the hourly job only checks due work');

console.log('All removed-feature and 48-hour policy checks passed.');
