// @ts-nocheck
import { CARDS, SYM, getEffectiveCardSymbols } from '../data/cards';
import { startTurn, endTurn, playCard, reclaimCard, resolveShieldPick, resolvePickpocket } from '../engine/game';

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

function shieldTargetEffect(card) {
  return card?.symbols?.find(
    s => s.type === SYM.MIGHTY && (s.effect === 'steal_shield' || s.effect === 'destroy_one_shield')
  )?.effect ?? null;
}

const TARGETED_DAMAGE_MIGHTY_EFFECTS = new Set(['mighty_strike']);

function hasTargetedDamage(card, state, botId) {
  return getEffectiveCardSymbols(card, state, botId).some(sym =>
    (sym.type === SYM.ATTACK && sym.target === 'opponent') ||
    (sym.type === SYM.MIGHTY && sym.target === 'opponent' && TARGETED_DAMAGE_MIGHTY_EFFECTS.has(sym.effect))
  );
}

function hasShieldCards(player) {
  return (player?.shieldCards || []).length > 0;
}

function targetCandidatesForCard(state, botId, card) {
  const effect = shieldTargetEffect(card);
  const aliveCount = Object.values(state.players).filter(p => !p.eliminated).length;

  if (effect === 'steal_shield') {
    return Object.entries(state.players)
      .filter(([pid, p]) => pid !== botId && !p.eliminated && !p.immune && hasShieldCards(p))
      .map(([pid]) => pid);
  }

  if (effect === 'destroy_one_shield') {
    return Object.entries(state.players)
      .filter(([pid, p]) => !p.eliminated && hasShieldCards(p) && (pid === botId || !p.immune || aliveCount <= 2))
      .map(([pid]) => pid);
  }

  if (hasTargetedDamage(card, state, botId) && state.attackTargetThisTurn) {
    return [];
  }

  const needsOpponent = getEffectiveCardSymbols(card, state, botId).some(s => s.target === 'opponent');
  if (!needsOpponent) return [];
  return Object.entries(state.players)
    .filter(([pid, p]) => pid !== botId && !p.eliminated && (!p.immune || aliveCount <= 2))
    .map(([pid]) => pid);
}

function cardNeedsTargetForState(state, botId, card) {
  return targetCandidatesForCard(state, botId, card).length > 0;
}

function isRestrictedExtraPlayBlocked(cardId, state) {
  const allowed = state.extraPlayCardIds;
  if (!allowed?.length) return false;
  const played = state.cardsPlayedThisTurn || 0;
  const extra = state.extraPlaysThisTurn || 0;
  return played > 0 && played <= extra && !allowed.includes(cardId);
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
    const candidates = targetCandidatesForCard(state, botId, stolen);
    const targetId = cardNeedsTargetForState(state, botId, stolen) && candidates.length > 0
      ? randomFrom(candidates)
      : null;
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
      await delay(5000);
      await endTurn(roomCode, state, botId);
      return;
    }

    const isFollowUpPlay = played > 0 && played <= extra;
    await delay(isFollowUpPlay ? 1400 : 900);

    const hand = state.players[botId]?.hand || [];
    if (hand.length === 0) {
      await endTurn(roomCode, state, botId);
      return;
    }

    // Skip form-locked cards (bot doesn't manage forms)
    const playable = hand.filter(cid => {
      const card = CARDS[cid];
      return card && !card.requiresForm && !isRestrictedExtraPlayBlocked(cid, state);
    });

    if (playable.length === 0) {
      await endTurn(roomCode, state, botId);
      return;
    }

    const cid  = randomFrom(playable);
    const card = CARDS[cid];

    let targetId = null;
    if (cardNeedsTargetForState(state, botId, card)) {
      const candidates = targetCandidatesForCard(state, botId, card);
      targetId = candidates.length > 0 ? randomFrom(candidates) : null;
      if (!targetId) {
        await endTurn(roomCode, state, botId);
        return;
      }
    }

    await playCard(roomCode, state, botId, cid, targetId);
  }
}
