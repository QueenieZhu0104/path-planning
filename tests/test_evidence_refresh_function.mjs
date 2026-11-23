import assert from 'node:assert/strict';
import { config, refreshDueActivities, refreshDueEvidence } from '../netlify/functions/evidence-refresh.mjs';

assert.equal(config.schedule, '0 * * * *');

const now = Date.parse('2026-11-04T10:00:00.000Z');
const record = (key, expiresAt) => ({ key, descriptor: { route: { university: key, major: 'Test' } }, payload: { freshness: { expiresAt } } });
const records = [
  record('fresh', '2026-11-04T12:00:00.000Z'),
  record('due-3', '2026-11-04T09:30:00.000Z'),
  record('due-1', '2026-11-04T08:00:00.000Z'),
  record('due-2', '2026-11-04T09:00:00.000Z')
];
const cache = { async listRouteRecords() { return records; } };
const called = [];
let result = await refreshDueEvidence({
  cache,
  now,
  limit: 2,
  refreshRecord: async row => { called.push(row.key); return new Response(null, { status: row.key === 'due-2' ? 502 : 200 }); }
});
assert.deepEqual(called, ['due-1', 'due-2']);
assert.equal(result.scanned, 4);
assert.equal(result.due, 3);
assert.equal(result.refreshed.length, 2);
assert.equal(result.ok, false);
console.log('PASS: hourly refresh scans due records oldest-first, honors the batch limit, and reports partial failure');

called.length = 0;
result = await refreshDueEvidence({
  cache: { async listRouteRecords() { return [records[0]]; } },
  now,
  refreshRecord: async row => { called.push(row.key); return new Response(null, { status: 200 }); }
});
assert.equal(result.due, 0);
assert.deepEqual(called, []);
assert.equal(result.ok, true);
console.log('PASS: a scheduled scan with no expired evidence performs no refresh calls');

const activityRegistry = [{ id: 'activity-a' }, { id: 'activity-b' }, { id: 'activity-c' }, { id: 'activity-d' }];
const activityRecords = [
  { key: 'activity/activity-a', descriptor: { activityId: 'activity-a' }, payload: { freshness: { expiresAt: '2026-11-04T12:00:00.000Z' } } },
  { key: 'activity/activity-b', descriptor: { activityId: 'activity-b' }, payload: { freshness: { expiresAt: '2026-11-04T08:30:00.000Z' } } },
  { key: 'activity/activity-c', descriptor: { activityId: 'activity-c' }, payload: { freshness: { expiresAt: '2026-11-04T09:30:00.000Z' } } }
];
const activityCalls = [];
result = await refreshDueActivities({
  cache: { async listActivityRecords() { return activityRecords; } },
  registry: activityRegistry,
  now,
  limit: 2,
  refreshRecord: async item => {
    activityCalls.push(item.activityId);
    return new Response(null, { status: 200 });
  }
});
assert.deepEqual(activityCalls, ['activity-d', 'activity-b'], 'missing records are initialized before the oldest expired record');
assert.equal(result.registered, 4);
assert.equal(result.stored, 3);
assert.equal(result.due, 3);
assert.equal(result.refreshed.length, 2);
assert.equal(result.ok, true);
console.log('PASS: the hourly job initializes missing registered activities, then refreshes expired activity records oldest-first within its batch limit');

activityCalls.length = 0;
result = await refreshDueActivities({
  cache: { async listActivityRecords() { return [activityRecords[0]]; } },
  registry: [{ id: 'activity-a' }],
  now,
  refreshRecord: async item => { activityCalls.push(item.activityId); return new Response(null, { status: 200 }); }
});
assert.equal(result.due, 0);
assert.deepEqual(activityCalls, []);
console.log('PASS: fresh centralized activity records are not fetched again before 48 hours');

console.log('All scheduled evidence refresh tests passed (memory records only; Netlify scheduling and Blobs were not contacted).');
