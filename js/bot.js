import { CARDS, SYM, cardNeedsTarget } from './cards.js';
import { startTurn, endTurn, playCard, reclaimCard, resolveShieldPick, resolvePickpocket } from './game.js';

export function isBot(playerId) {
  return typeof playerId === 'string' && playerId.startsWith('bot_');
}

let botActing = false;

export async function driveBotTurn(roomCode, state, getState) {
  if (botActing) return;
  if (!isBot(state.currentTurn)) return;
  botActing = true;
  try {
    let s = state;
    while (s && s.status === 'playing') {
      const botId = s.currentTurn;
      if (!isBot(botId)) break;
      const bot = s.players[botId];
      if (!bot || bot.eliminated) break;
      await _act(roomCode, s, botId);
      // Brief pause for Firestore subscription to update roomState
      await new Promise(r => setTimeout(r, 120));
      s = getState ? getState() : null;
      if (!s) break;
    }
  } catch (_) {
    // swallow — state is live; next subscription will re-trigger if needed
  } finally {
    botActing = false;
  }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTarget(state, botId) {
  const aliveCount = Object.values(state.players).filter(p => !p.eliminated).length;
  const candidates = Object.entries(state.players).filter(
    ([pid, p]) => pid !== botId && !p.eliminated && (!p.immune || aliveCount <= 2)
  );
  if (candidates.length === 0) return null;
  return randomFrom(candidates)[0];
}

async function _act(roomCode, state, botId) {
  // Pending: shield pick
  if (state.pendingShieldPick?.pickerId === botId) {
    await delay(700);
    const { targetId } = state.pendingShieldPick;
    const shields = state.players[targetId]?.shieldCards || [];
    if (shields.length > 0) {
      await resolveShieldPick(roomCode, state, botId, shields[0].id);
    }
    return;
  }

  // Pending: reclaim
  if (state.pendingReclaim === botId) {
    await delay(700);
    const discard = state.discardPiles?.[botId] || [];
    if (discard.length > 0) {
      await reclaimCard(roomCode, state, botId, discard[discard.length - 1]);
    }
    return;
  }

  // Pending: pickpocket
  if (state.pendingPickpocket?.pickerId === botId) {
    await delay(700);
    const { stolenCardId } = state.pendingPickpocket;
    const stolen = CARDS[stolenCardId];
    const hasAttack = stolen?.symbols?.some(
      s => s.type === SYM.ATTACK && s.target === 'opponent'
    );
    const targetId = hasAttack ? pickTarget(state, botId) : null;
    await resolvePickpocket(roomCode, state, botId, targetId);
    return;
  }

  // Drawing phase
  if (state.turnPhase === 'drawing') {
    await delay(600);
    await startTurn(roomCode, botId, state);
    return;
  }

  // Playing phase
  if (state.turnPhase === 'playing') {
    const played = state.cardsPlayedThisTurn || 0;
    const extra  = state.extraPlaysThisTurn  || 0;

    if (played > 0 && played > extra) {
      await delay(500);
      await endTurn(roomCode, state, botId);
      return;
    }

    await delay(900);

    const hand = state.players[botId]?.hand || [];
    if (hand.length === 0) {
      await endTurn(roomCode, state, botId);
      return;
    }

    // Skip form-locked cards (bot doesn't manage forms)
    const playable = hand.filter(cid => {
      const card = CARDS[cid];
      return card && !card.requiresForm;
    });

    if (playable.length === 0) {
      await endTurn(roomCode, state, botId);
      return;
    }

    const cid  = randomFrom(playable);
    const card = CARDS[cid];

    let targetId = null;
    if (cardNeedsTarget(card)) {
      targetId = pickTarget(state, botId);
      if (!targetId) {
        await endTurn(roomCode, state, botId);
        return;
      }
    }

    await playCard(roomCode, state, botId, cid, targetId);
  }
}
