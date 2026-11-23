import { getStore } from '@netlify/blobs';

const STORE_NAME = 'path-live-evidence-v1';

export function createEvidenceCache({ optional = false } = {}) {
  let store;
  try { store = getStore({ name: STORE_NAME, consistency: 'strong' }); }
  catch (error) {
    if (optional) return null;
    throw error;
  }
  return {
    async get(key) {
      return store.get(key, { type: 'json', consistency: 'strong' });
    },
    async set(key, record) {
      return store.setJSON(key, record, {
        metadata: {
          schemaVersion: Number(record?.payload?.schemaVersion || 1),
          expiresAt: String(record?.payload?.freshness?.expiresAt || ''),
          routeUniversity: String(record?.descriptor?.route?.university || '').slice(0, 220),
          routeMajor: String(record?.descriptor?.route?.major || '').slice(0, 180),
          activityId: String(record?.descriptor?.activityId || '').slice(0, 160)
        }
      });
    },
    async listRouteRecords() {
      const listed = await store.list({ prefix: 'route/', paginate: true });
      const rows = await Promise.all((listed.blobs || []).map(async blob => {
        try { return await store.get(blob.key, { type: 'json', consistency: 'strong' }); }
        catch { return null; }
      }));
      return rows.filter(Boolean);
    },
    async listActivityRecords() {
      const listed = await store.list({ prefix: 'activity/', paginate: true });
      const rows = await Promise.all((listed.blobs || []).map(async blob => {
        try { return await store.get(blob.key, { type: 'json', consistency: 'strong' }); }
        catch { return null; }
      }));
      return rows.filter(Boolean);
    }
  };
}

export { STORE_NAME };
