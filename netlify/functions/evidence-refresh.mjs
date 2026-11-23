import { onRequestPost } from '../../functions/api/route-evidence.js';
import { ACTIVITY_REGISTRY, onRequestGet as getActivityDetails } from '../../functions/api/activity-details.js';
import { createEvidenceCache } from '../evidence-cache.mjs';

export const config = { schedule: '0 * * * *' };

export async function refreshDueEvidence({ cache, origin, env = {}, now = Date.now(), limit = 4, refreshRecord } = {}) {
  const records = await cache.listRouteRecords();
  const stale = records
    .filter(record => Date.parse(record?.payload?.freshness?.expiresAt || 0) <= now)
    .sort((a, b) => Date.parse(a?.payload?.freshness?.expiresAt || 0) - Date.parse(b?.payload?.freshness?.expiresAt || 0))
    .slice(0, limit);
  const refreshed = await Promise.all(stale.map(async record => {
    const response = refreshRecord
      ? await refreshRecord(record)
      : await onRequestPost({
        request: new Request(`${origin}/api/route-evidence`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...(record.descriptor || {}), forceRefresh: true })
        }),
        env: { ...env, EVIDENCE_CACHE: cache, EVIDENCE_REFRESH_JOB: '1' }
      });
    return { key: record.key, status: response.status, ok: response.ok };
  }));
  return { ok: refreshed.every(item => item.ok), scanned: records.length, due: records.filter(record => Date.parse(record?.payload?.freshness?.expiresAt || 0) <= now).length, refreshed };
}

export async function refreshDueActivities({ cache, origin, env = {}, now = Date.now(), limit = 2, registry = ACTIVITY_REGISTRY, refreshRecord } = {}) {
  const stored = await cache.listActivityRecords();
  const storedById = new Map(stored.map(record => [String(record?.descriptor?.activityId || record?.payload?.activity?.id || ''), record]));
  const due = registry.map(item => {
    const activityId = String(item?.id || '');
    const record = storedById.get(activityId) || null;
    return { activityId, record, expiresAt: record?.payload?.freshness?.expiresAt || '', lastAttemptAt: record?.lastAttemptAt || '' };
  }).filter(item => item.activityId && (!item.record || Date.parse(item.expiresAt || 0) <= now))
    .sort((a, b) => {
      const aAttempt = Date.parse(a.lastAttemptAt || 0) || 0;
      const bAttempt = Date.parse(b.lastAttemptAt || 0) || 0;
      if (aAttempt !== bAttempt) return aAttempt - bAttempt;
      if (!a.record?.payload && b.record?.payload) return -1;
      if (a.record?.payload && !b.record?.payload) return 1;
      return Date.parse(a.expiresAt || 0) - Date.parse(b.expiresAt || 0) || a.activityId.localeCompare(b.activityId);
    });
  const selected = due.slice(0, limit);
  const refreshed = await Promise.all(selected.map(async item => {
    const response = refreshRecord
      ? await refreshRecord(item)
      : await getActivityDetails({
        request: new Request(`${origin}/api/activity-details?id=${encodeURIComponent(item.activityId)}&force=1`),
        env: { ...env, EVIDENCE_CACHE: cache, EVIDENCE_REFRESH_JOB: '1' }
      });
    return { activityId: item.activityId, status: response.status, ok: response.ok };
  }));
  return { ok: refreshed.every(item => item.ok), registered: registry.length, stored: stored.length, due: due.length, refreshed };
}

export default async function evidenceRefresh(request) {
  try {
    const cache = createEvidenceCache();
    const origin = new URL(request.url).origin;
    const [routes, activities] = await Promise.all([
      refreshDueEvidence({ cache, origin, env: process.env }),
      refreshDueActivities({ cache, origin, env: process.env })
    ]);
    return Response.json({ ok: routes.ok && activities.ok, routes, activities });
  } catch (error) {
    return Response.json({ ok: false, error: 'evidence_cache_unavailable', detail: String(error?.message || '').slice(0, 160) }, { status: 502 });
  }
}
