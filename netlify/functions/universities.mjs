import { onRequestGet, onRequestPost } from '../../functions/api/universities.js';
import { adaptCloudflarePagesHandlers } from '../shared-adapter.mjs';

export default adaptCloudflarePagesHandlers({ GET: onRequestGet, POST: onRequestPost });

export const config = { path: '/api/universities' };
