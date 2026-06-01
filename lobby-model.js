export function sanitizeNickname(value) {
  const nickname = (value || '').trim();
  return nickname ? nickname.slice(0, 18) : 'Player';
}

export function sanitizeRoomTitle(value) {
  const title = (value || '').trim();
  return title ? title.slice(0, 28) : '새 게임방';
}

export function createRoom({ title, password, host }) {
  const normalizedPassword = (password || '').trim();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    id: crypto.randomUUID(),
    code,
    title: sanitizeRoomTitle(title),
    password: normalizedPassword,
    hasPassword: normalizedPassword.length > 0,
    status: 'waiting',
    hostId: host.id,
    createdAt: Date.now(),
    players: [{ ...host, role: 'blue', ready: true }],
    gameState: null,
  };
}

export function joinRoom(room, player, password) {
  if (room.players.length >= 2 && !room.players.some(existing => existing.id === player.id)) {
    throw new Error('방이 가득 찼습니다.');
  }
  if (room.hasPassword && room.password !== (password || '').trim()) {
    throw new Error('비밀번호가 일치하지 않습니다.');
  }
  if (room.players.some(existing => existing.id === player.id)) {
    return room;
  }
  return {
    ...room,
    players: [...room.players, { ...player, role: 'red', ready: player.ready ?? false }],
  };
}

export function leaveRoom(room, playerId) {
  if (room.hostId === playerId) return null;
  const players = room.players.filter(player => player.id !== playerId);
  if (!players.length) return null;
  return { ...room, players };
}

export function setPlayerReady(room, playerId, ready) {
  return {
    ...room,
    players: room.players.map(player => (
      player.id === playerId ? { ...player, ready } : player
    )),
  };
}

export function startRoom(room, gameState) {
  return {
    ...room,
    status: 'playing',
    gameState,
  };
}

export function updatePlayerGameState(room, role, ballState) {
  return {
    ...room,
    gameState: {
      ...(room.gameState || {}),
      [role]: {
        ...((room.gameState || {})[role] || {}),
        ...ballState,
      },
    },
  };
}

export function roomToRow(room) {
  return {
    id: room.id,
    code: room.code,
    title: room.title,
    password: room.password,
    has_password: room.hasPassword,
    status: room.status,
    host_id: room.hostId,
    created_at: room.createdAt,
    players: room.players,
    game_state: room.gameState,
  };
}

export function roomFromRow(row) {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    password: row.password,
    hasPassword: row.has_password,
    status: row.status,
    hostId: row.host_id,
    createdAt: row.created_at,
    players: row.players || [],
    gameState: row.game_state || null,
  };
}
