import { onRequestGet, onRequestPost } from '../../functions/api/university-info.js';
import { adaptCloudflarePagesHandlers } from '../shared-adapter.mjs';

export default adaptCloudflarePagesHandlers({ GET: onRequestGet, POST: onRequestPost });

export const config = { path: '/api/university-info' };
