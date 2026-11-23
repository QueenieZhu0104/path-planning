import { onRequestGet, onRequestPost } from '../../functions/api/path-intelligence.js';
import { adaptCloudflarePagesHandlers } from '../shared-adapter.mjs';

export default adaptCloudflarePagesHandlers({ GET: onRequestGet, POST: onRequestPost });

export const config = { path: '/api/path-intelligence' };
