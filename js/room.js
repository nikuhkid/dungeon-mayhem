import { roomExists, createRoom, joinRoom, updateRoom, updatePlayer, subscribeToRoom } from './firebase.js';
import { HEROES } from './cards.js';

export async function addBot(roomCode, roomState) {
  const players     = roomState.players || {};
  const existingBots = Object.keys(players).filter(id => id.startsWith('bot_'));
  const botId       = `bot_${existingBots.length + 1}`;

  const takenHeroes = new Set(Object.values(players).map(p => p.heroId).filter(Boolean));
  const available   = Object.keys(HEROES).filter(h => !takenHeroes.has(h));
  if (available.length === 0) throw new Error('No heroes available for bot');

  const heroId = available[Math.floor(Math.random() * available.length)];
  const hero   = HEROES[heroId];

  await updateRoom(roomCode, {
    [`players.${botId}`]: {
      name:            `Bot (${hero.name})`,
      heroId,
      hp:              10,
      hand:            [],
      ready:           true,
      eliminated:      false,
      shieldCards:     [],
      immune:          false,
      frienemiesBonus: 0,
    },
  });
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function getOrCreatePlayerId() {
  let id = sessionStorage.getItem('playerId');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('playerId', id);
  }
  return id;
}

export async function handleCreateRoom(playerName) {
  const id = getOrCreatePlayerId();
  let code;
  for (let i = 0; i < 5; i++) {
    code = generateRoomCode();
    if (!(await roomExists(code))) break;
  }
  await createRoom(code, id, playerName);
  return code;
}

export async function handleJoinRoom(roomCode, playerName) {
  const code = roomCode.toUpperCase().trim();
  if (!(await roomExists(code))) throw new Error(`Room "${code}" not found`);
  const id = getOrCreatePlayerId();
  await joinRoom(code, id, playerName);
  return code;
}

// --- Lobby operations ---

export async function selectHero(roomCode, playerId, heroId) {
  await updatePlayer(roomCode, playerId, { heroId, ready: false });
}

export async function setReady(roomCode, playerId) {
  await updatePlayer(roomCode, playerId, { ready: true });
}

export async function startGameIfReady(roomCode, roomState) {
  const players = Object.values(roomState.players);
  if (players.length < 2) throw new Error('Need at least 2 players to start');
  if (!players.every(p => p.heroId && p.ready)) throw new Error('All players must lock in a hero first');
}

export function isHost(roomState, playerId) {
  return roomState?.hostId === playerId;
}

export { updateRoom, updatePlayer, subscribeToRoom };
