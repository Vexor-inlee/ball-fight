import assert from 'node:assert/strict';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  sanitizeNickname,
  sanitizeRoomTitle,
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

const lockedRoom = createRoom({ title: 'Locked', password: '1234', host });
assert.equal(lockedRoom.hasPassword, true);
assert.throws(() => joinRoom(lockedRoom, guest, 'wrong'), /비밀번호/);
assert.equal(joinRoom(lockedRoom, guest, '1234').players.length, 2);

assert.throws(() => joinRoom(joinedOpenRoom, { ...guest, id: 'guest-2' }, ''), /가득/);

assert.equal(leaveRoom(openRoom, host.id), null);

const guestLeftRoom = leaveRoom(joinedOpenRoom, guest.id);
assert.equal(guestLeftRoom.players.length, 1);
assert.equal(guestLeftRoom.players[0].id, host.id);

console.log('lobby model tests passed');
