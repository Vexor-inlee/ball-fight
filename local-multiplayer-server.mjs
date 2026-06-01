import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] || process.env.PORT || 4180);
const root = process.cwd();
const rooms = new Map();
const eventClients = new Set();
const webSocketClients = new Set();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
};

function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

function sortedRooms() {
  return [...rooms.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function broadcastRooms() {
  const roomsPayload = sortedRooms();
  const payload = `data: ${JSON.stringify(roomsPayload)}\n\n`;
  for (const client of eventClients) {
    client.write(payload);
  }
  for (const socket of webSocketClients) {
    sendWebSocketMessage(socket, { type: 'rooms', rooms: roomsPayload });
  }
}

function sendWebSocketMessage(socket, value) {
  if (socket.destroyed) return;
  const payload = Buffer.from(JSON.stringify(value));
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65_536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function decodeWebSocketFrame(buffer) {
  if (buffer.length < 6) return null;
  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x8) return { type: 'close', bytes: 2 };
  if (opcode !== 0x1) return null;

  const masked = (buffer[1] & 0x80) === 0x80;
  let payloadLength = buffer[1] & 0x7f;
  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 8) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < 14) return null;
    payloadLength = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }
  if (!masked || buffer.length < offset + 4 + payloadLength) return null;

  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const frameEnd = offset + payloadLength;
  const payload = Buffer.alloc(payloadLength);
  for (let index = 0; index < payloadLength; index += 1) {
    payload[index] = buffer[offset + index] ^ mask[index % 4];
  }
  return { type: 'message', text: payload.toString('utf8'), bytes: frameEnd };
}

function handleWebSocketMessage(socket, text) {
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return;
  }

  if (message.type === 'upsert-room' && message.room?.id) {
    rooms.set(message.room.id, message.room);
    broadcastRooms();
    return;
  }

  if (message.type === 'delete-room' && message.roomId) {
    rooms.delete(message.roomId);
    broadcastRooms();
    return;
  }

  if (message.type === 'player-state' && message.roomId && message.role && message.ballState) {
    const room = rooms.get(message.roomId);
    if (!room || room.status !== 'playing') return;
    room.gameState = {
      ...(room.gameState || {}),
      ...(message.gameState || {}),
      [message.role]: message.ballState,
    };
    rooms.set(room.id, room);
    broadcastRooms();
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function handleApi(request, response, url) {
  if (url.pathname === '/api/rooms' && request.method === 'GET') {
    sendJson(response, 200, sortedRooms());
    return;
  }

  if (url.pathname === '/api/rooms/events' && request.method === 'GET') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    response.write(`data: ${JSON.stringify(sortedRooms())}\n\n`);
    eventClients.add(response);
    request.on('close', () => eventClients.delete(response));
    return;
  }

  if (url.pathname === '/api/rooms' && request.method === 'POST') {
    const room = JSON.parse(await readBody(request));
    rooms.set(room.id, room);
    broadcastRooms();
    sendJson(response, 201, room);
    return;
  }

  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (match && request.method === 'PUT') {
    const roomId = decodeURIComponent(match[1]);
    const room = JSON.parse(await readBody(request));
    rooms.set(roomId, room);
    broadcastRooms();
    sendJson(response, 200, room);
    return;
  }

  if (match && request.method === 'DELETE') {
    const roomId = decodeURIComponent(match[1]);
    rooms.delete(roomId);
    broadcastRooms();
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

async function serveStatic(request, response, url) {
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = normalize(join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
    } else {
      await serveStatic(request, response, url);
    }
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.on('upgrade', (request, socket) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const key = request.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '',
    '',
  ].join('\r\n'));

  webSocketClients.add(socket);
  socket.frameBuffer = Buffer.alloc(0);
  sendWebSocketMessage(socket, { type: 'rooms', rooms: sortedRooms() });

  socket.on('data', (buffer) => {
    socket.frameBuffer = Buffer.concat([socket.frameBuffer, buffer]);
    while (socket.frameBuffer.length > 0) {
      const frame = decodeWebSocketFrame(socket.frameBuffer);
      if (!frame) return;
      socket.frameBuffer = socket.frameBuffer.subarray(frame.bytes);
      if (frame.type === 'close') {
        socket.end();
        return;
      }
      handleWebSocketMessage(socket, frame.text);
    }
  });
  socket.on('close', () => webSocketClients.delete(socket));
  socket.on('error', () => webSocketClients.delete(socket));
});

server.listen(port, () => {
  console.log(`TAGRUSH local multiplayer server running at http://127.0.0.1:${port}/index.html`);
});
