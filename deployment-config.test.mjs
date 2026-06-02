import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile('index.html', 'utf8');
const serverSource = await readFile('local-multiplayer-server.mjs', 'utf8');

assert.match(indexHtml, /const REALTIME_SERVER_URL = 'https:\/\/tagrush-realtime\.onrender\.com';/);
assert.match(indexHtml, /function realtimeHttpUrl/);
assert.match(indexHtml, /function realtimeWebSocketUrl/);
assert.match(serverSource, /Access-Control-Allow-Origin/);
assert.match(serverSource, /request\.method === 'OPTIONS'/);

console.log('deployment config tests passed');
