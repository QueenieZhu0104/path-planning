import * as handlers from '../../functions/api/activity-details.js';
import { createEvidenceCache } from '../evidence-cache.mjs';
import { adaptCloudflarePagesHandlers } from '../shared-adapter.mjs';

export default adaptCloudflarePagesHandlers({
  GET: handlers.onRequestGet,
  POST: handlers.onRequestPost
}, {
  createEnv: ({ processEnv }) => {
    const cache = createEvidenceCache({ optional: true });
    return cache ? { ...processEnv, EVIDENCE_CACHE: cache } : { ...processEnv };
  }
});

export const config = {
  path: '/api/activity-details',
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
