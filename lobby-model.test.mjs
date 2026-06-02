import assert from 'node:assert/strict';
import {
  createRoom,
  endRoomGame,
  joinRoom,
  leaveRoom,
  roomFromRow,
  roomToRow,
  sanitizeNickname,
  sanitizeRoomTitle,
  setPlayerReady,
  startRoom,
  resetRoomGame,
  updatePlayerGameState,
} from './lobby-model.js';

const host = { id: 'host-1', nickname: 'Host', controlScheme: 'wasd' };
const guest = { id: 'guest-1', nickname: 'Guest', controlScheme: 'arrows' };

assert.equal(sanitizeNickname('  VeryLongNickname12345  '), 'VeryLongNickname12');
assert.equal(sanitizeNickname(''), 'Player');
assert.equal(sanitizeRoomTitle(''), '새 게임방');

const openRoom = createRoom({ title: '  Test Room  ', password: '', host });
assert.equal(openRoom.title, 'Test Room');
assert.equal(openRoom.hasPassword, false);
assert.equal(openRoom.players.length, 1);
assert.equal(openRoom.players[0].role, 'blue');

const joinedOpenRoom = joinRoom(openRoom, guest, '');
assert.equal(joinedOpenRoom.players.length, 2);
assert.equal(joinedOpenRoom.players[1].role, 'red');

const readyRoom = setPlayerReady(joinedOpenRoom, guest.id, true);
assert.equal(readyRoom.players[1].ready, true);
assert.equal(readyRoom.players[0].ready, true);

const initialGameState = {
  startedAt: 123,
  firstTagger: 'blue',
  currentTagger: 'blue',
  blue: { x: 120, y: 100, vx: 0, vy: 0 },
  red: { x: 620, y: 100, vx: 0, vy: 0 },
};
const startedRoom = startRoom(joinedOpenRoom, initialGameState);
assert.equal(startedRoom.status, 'playing');
assert.deepEqual(startedRoom.gameState, { ...initialGameState, phase: 'countdown' });

const blueMovedRoom = updatePlayerGameState(startedRoom, 'blue', { x: 140, y: 110, vx: 1, vy: 2 });
assert.equal(blueMovedRoom.gameState.blue.x, 140);
assert.equal(blueMovedRoom.gameState.red.x, 620);

const pausedRoom = updatePlayerGameState(startedRoom, 'blue', { x: 150 }, { phase: 'paused', pausedBy: 'Host' });
assert.equal(pausedRoom.gameState.phase, 'paused');
assert.equal(pausedRoom.gameState.pausedBy, 'Host');

const resetRoom = resetRoomGame(startedRoom);
assert.equal(resetRoom.status, 'waiting');
assert.equal(resetRoom.gameState.phase, 'reset');
assert.equal(resetRoom.players.every(player => !player.ready), true);

const endedRoom = endRoomGame(startedRoom, '상대가 방에서 나갔습니다.');
assert.equal(endedRoom.status, 'ended');
assert.equal(endedRoom.gameState.phase, 'ended');
assert.equal(endedRoom.gameState.endedReason, '상대가 방에서 나갔습니다.');

const lockedRoom = createRoom({ title: 'Locked', password: '1234', host });
assert.equal(lockedRoom.hasPassword, true);
assert.throws(() => joinRoom(lockedRoom, guest, 'wrong'), /비밀번호/);
assert.equal(joinRoom(lockedRoom, guest, '1234').players.length, 2);

assert.throws(() => joinRoom(joinedOpenRoom, { ...guest, id: 'guest-2' }, ''), /가득/);

assert.equal(leaveRoom(openRoom, host.id), null);

const guestLeftRoom = leaveRoom(joinedOpenRoom, guest.id);
assert.equal(guestLeftRoom.players.length, 1);
assert.equal(guestLeftRoom.players[0].id, host.id);

const guestLeftPlayingRoom = leaveRoom(startedRoom, guest.id);
assert.equal(guestLeftPlayingRoom.status, 'ended');
assert.equal(guestLeftPlayingRoom.players.length, 1);
assert.equal(guestLeftPlayingRoom.gameState.phase, 'ended');

const row = roomToRow(openRoom);
assert.equal(row.has_password, false);
assert.equal(row.host_id, host.id);
assert.deepEqual(roomFromRow(row), openRoom);

console.log('lobby model tests passed');
