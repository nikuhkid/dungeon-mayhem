import { CARDS, SYM, shuffle, buildDeck } from './cards.js';
import { updateRoom } from './firebase.js';

// --- Internal helpers ---

function drawCards(deck, discard, count) {
  deck = [...deck];
  discard = [...discard];
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
    }
    drawn.push(deck.shift());
  }
  return { deck, discard, drawn };
}

function logEntry(description, extra = {}) {
  return { description, timestamp: Date.now(), ...extra };
}

function pushLog(existing, entry) {
  return [entry, ...(existing || [])].slice(0, 10);
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function getAttackTargets(targetType, playerId, players) {
  switch (targetType) {
    case 'all_opponents':
      return Object.keys(players).filter(
        pid => pid !== playerId && !players[pid].eliminated && !players[pid].immune
      );
    case 'all':
      // AoE — hits everyone including self, bypasses immune
      return Object.keys(players).filter(pid => !players[pid].eliminated);
    default:
      return [];
  }
}

// --- Turn management ---

export async function startGame(roomCode, roomState) {
  const playerIds = Object.keys(roomState.players);
  const turnOrder = shuffle(playerIds);

  const updates = {
    status: 'playing',
    turnOrder,
    currentTurn: turnOrder[0],
    turnPhase: 'drawing',
    winner: null,
    cardsPlayedThisTurn: 0,
    extraPlaysThisTurn: 0,
    pendingReclaim: null,
  };

  const decks = {};
  const discardPiles = {};

  for (const pid of playerIds) {
    const heroId = roomState.players[pid].heroId;
    const { deck, drawn } = drawCards(buildDeck(heroId), [], 3);
    decks[pid] = deck;
    discardPiles[pid] = [];
    updates[`players.${pid}.hand`]      = drawn;
    updates[`players.${pid}.eliminated`] = false;
    updates[`players.${pid}.shields`]    = 0;
    updates[`players.${pid}.hp`]         = 10;
    updates[`players.${pid}.immune`]     = false;
  }

  updates.decks = decks;
  updates.discardPiles = discardPiles;

  const entry = logEntry('Game started!');
  updates.lastAction = entry;
  updates.actionLog  = [entry];

  await updateRoom(roomCode, updates);
}

export async function startTurn(roomCode, playerId, roomState) {
  const { deck, discard, drawn } = drawCards(
    roomState.decks[playerId] || [],
    roomState.discardPiles[playerId] || [],
    1
  );

  const newHand = [...(roomState.players[playerId].hand || []), ...drawn];
  const entry = logEntry(`${roomState.players[playerId].name}'s turn`, { playerId });
  const actionLog = pushLog(roomState.actionLog, entry);

  const updates = {
    [`decks.${playerId}`]:           deck,
    [`discardPiles.${playerId}`]:    discard,
    [`players.${playerId}.hand`]:    newHand,
    turnPhase:            'playing',
    cardsPlayedThisTurn:  0,
    extraPlaysThisTurn:   0,
    pendingReclaim:       null,
    lastAction:           entry,
    actionLog,
  };

  // Clear immune at start of this player's turn
  if (roomState.players[playerId]?.immune) {
    updates[`players.${playerId}.immune`] = false;
  }

  await updateRoom(roomCode, updates);
}

export async function endTurn(roomCode, roomState, playerId) {
  const updates = {
    cardsPlayedThisTurn: 0,
    extraPlaysThisTurn:  0,
    pendingReclaim:      null,
  };

  const nextId = getNextTurn(roomState.turnOrder, playerId, roomState.players);
  const entry  = logEntry(`${roomState.players[playerId].name} ended their turn`, { playerId });

  updates.currentTurn = nextId;
  updates.turnPhase   = 'drawing';
  updates.lastAction  = entry;
  updates.actionLog   = pushLog(roomState.actionLog, entry);

  await updateRoom(roomCode, updates);
}

export function getNextTurn(turnOrder, currentTurn, players) {
  const idx = turnOrder.indexOf(currentTurn);
  for (let i = 1; i <= turnOrder.length; i++) {
    const nextId = turnOrder[(idx + i) % turnOrder.length];
    if (!players[nextId]?.eliminated) return nextId;
  }
  return null;
}

// --- Card play ---

export async function playCard(roomCode, roomState, playerId, cardId, targetId = null) {
  const player = roomState.players[playerId];
  const hand = [...(player.hand || [])];
  const idx  = hand.indexOf(cardId);
  if (idx === -1) return;

  hand.splice(idx, 1);
  const discard = [...(roomState.discardPiles[playerId] || []), cardId];
  const card = CARDS[cardId];

  const targetName = targetId ? roomState.players[targetId]?.name : null;
  const entry = logEntry(
    `${player.name} played ${card?.name ?? cardId}${targetName ? ` → ${targetName}` : ''}`,
    { playerId, cardId, targetId }
  );

  const updates = {
    [`players.${playerId}.hand`]: hand,
    [`discardPiles.${playerId}`]: discard,
    lastAction:          entry,
    actionLog:           pushLog(roomState.actionLog, entry),
    cardsPlayedThisTurn: (roomState.cardsPlayedThisTurn || 0) + 1,
  };

  // Form gate — wrong-form cards fizzle (discard with no effect)
  if (card?.requiresForm) {
    const currentForm = roomState.players[playerId].jaheiraForm ?? 'none';
    if (currentForm !== card.requiresForm) {
      const fizzleEntry = logEntry(
        `${player.name} played ${card.name} — wrong form, no effect!`,
        { playerId, cardId }
      );
      await updateRoom(roomCode, {
        [`players.${playerId}.hand`]: hand,
        [`discardPiles.${playerId}`]: discard,
        lastAction:          fizzleEntry,
        actionLog:           pushLog(roomState.actionLog, fizzleEntry),
        cardsPlayedThisTurn: (roomState.cardsPlayedThisTurn || 0) + 1,
      });
      return;
    }
  }

  // Form-dependent card (Gift of Silvanus) — select symbols by current form
  let symbolsToResolve = card?.symbols;
  if (card?.formDependent) {
    const form = roomState.players[playerId].jaheiraForm ?? 'none';
    if (form === 'bear')      symbolsToResolve = card.bearSymbols;
    else if (form === 'wolf') symbolsToResolve = card.wolfSymbols;
    else {
      const fizzleEntry = logEntry(
        `${player.name} played ${card.name} — no form active, fizzled!`,
        { playerId, cardId }
      );
      await updateRoom(roomCode, {
        [`players.${playerId}.hand`]: hand,
        [`discardPiles.${playerId}`]: discard,
        lastAction:          fizzleEntry,
        actionLog:           pushLog(roomState.actionLog, fizzleEntry),
        cardsPlayedThisTurn: (roomState.cardsPlayedThisTurn || 0) + 1,
      });
      return;
    }
  }

  // Resolve symbols against state with card already removed from hand/discard
  if (symbolsToResolve?.length) {
    const stateForEffect = {
      ...roomState,
      players:      { ...roomState.players,      [playerId]: { ...player, hand } },
      discardPiles: { ...roomState.discardPiles, [playerId]: discard },
    };
    const effectUpdates = resolveSymbols(symbolsToResolve, { playerId, targetId }, stateForEffect);
    Object.assign(updates, effectUpdates);
  }

  // Win check: build merged player state after all effects
  const finalPlayers = {};
  for (const [pid, p] of Object.entries(roomState.players)) {
    finalPlayers[pid] = {
      ...p,
      hp:         updates[`players.${pid}.hp`]         ?? p.hp,
      shields:    updates[`players.${pid}.shields`]    ?? p.shields,
      eliminated: updates[`players.${pid}.eliminated`] ?? p.eliminated,
    };
  }
  const winner = checkWinCondition(finalPlayers);
  if (winner) {
    updates.winner = winner === 'draw' ? playerId : winner;
    updates.status = 'finished';
  }

  await updateRoom(roomCode, updates);
}

// --- Reclaim (Divine Inspiration) ---

export async function reclaimCard(roomCode, roomState, playerId, cardId) {
  const discard = [...(roomState.discardPiles[playerId] || [])];
  const idx = discard.indexOf(cardId);
  if (idx === -1) return;
  discard.splice(idx, 1);
  const hand = [...(roomState.players[playerId].hand || []), cardId];

  const entry = logEntry(
    `${roomState.players[playerId].name} reclaimed ${CARDS[cardId]?.name ?? cardId} from discard`,
    { playerId, cardId }
  );

  await updateRoom(roomCode, {
    [`players.${playerId}.hand`]: hand,
    [`discardPiles.${playerId}`]: discard,
    pendingReclaim: null,
    lastAction:     entry,
    actionLog:      pushLog(roomState.actionLog, entry),
  });
}

// --- Symbol resolution ---

// Applies symbol effects directly to mutable clones of players/decks/discardPiles.
// Returns extraPlays count. Does NOT handle RECLAIM (handled in resolveSymbols).
function applySymbols(symbols, context, players, decks, discardPiles) {
  const { playerId, targetId } = context;
  let extraPlays = 0;

  const ordered = [
    ...symbols.filter(s => s.type !== SYM.MIGHTY),
    ...symbols.filter(s => s.type === SYM.MIGHTY),
  ];

  for (const sym of ordered) {
    switch (sym.type) {

      case SYM.ATTACK: {
        let targets;
        if (sym.target === 'opponent') {
          targets = targetId && players[targetId] && !players[targetId].eliminated && !players[targetId].immune
            ? [targetId] : [];
        } else {
          targets = getAttackTargets(sym.target, playerId, players);
        }
        for (const tid of targets) {
          const { newHp, newShields } = applyDamage(players[tid], sym.value);
          players[tid].hp      = newHp;
          players[tid].shields = newShields;
          if (newHp <= 0) players[tid].eliminated = true;
        }
        break;
      }

      case SYM.SHIELD:
        players[playerId].shields = (players[playerId].shields || 0) + sym.value;
        break;

      case SYM.HEAL:
        players[playerId].hp = Math.min(10, players[playerId].hp + sym.value);
        break;

      case SYM.DRAW: {
        const { deck, discard, drawn } = drawCards(
          decks[playerId] || [], discardPiles[playerId] || [], sym.value
        );
        decks[playerId]        = deck;
        discardPiles[playerId] = discard;
        players[playerId].hand = [...(players[playerId].hand || []), ...drawn];
        break;
      }

      case SYM.PLAY_AGAIN:
        extraPlays++;
        break;

      case SYM.MIGHTY:
        extraPlays += resolveMighty(sym, context, players, decks, discardPiles);
        break;
    }
  }

  return extraPlays;
}

export function resolveSymbols(symbols, context, roomState) {
  const { playerId } = context;

  const players      = structuredClone(roomState.players);
  const decks        = structuredClone(roomState.decks || {});
  const discardPiles = structuredClone(roomState.discardPiles || {});

  // Separate RECLAIM from other symbols
  const reclaimSyms = symbols.filter(s => s.type === SYM.RECLAIM);
  const otherSyms   = symbols.filter(s => s.type !== SYM.RECLAIM);

  let extraPlays   = applySymbols(otherSyms, context, players, decks, discardPiles);
  let pendingReclaim = false;

  // Handle RECLAIM (Divine Inspiration)
  for (const _sym of reclaimSyms) {
    const disc = discardPiles[playerId] || [];
    if (disc.length === 0) {
      // Empty discard → draw 1 from deck instead
      const { deck, discard: newDiscard, drawn } = drawCards(decks[playerId] || [], [], 1);
      decks[playerId]        = deck;
      discardPiles[playerId] = newDiscard;
      players[playerId].hand = [...(players[playerId].hand || []), ...drawn];
    } else {
      pendingReclaim = true;
    }
  }

  // Mid-turn refill: any player with 0 cards draws 2 immediately
  if (!pendingReclaim) {
    for (const pid of Object.keys(players)) {
      if (!players[pid].eliminated && (players[pid].hand || []).length === 0) {
        const { deck, discard: newDiscard, drawn } = drawCards(
          decks[pid] || [], discardPiles[pid] || [], 2
        );
        decks[pid]        = deck;
        discardPiles[pid] = newDiscard;
        players[pid].hand = drawn;
      }
    }
  }

  // Diff against original state → only emit changed fields
  const updates = {};

  for (const pid of Object.keys(roomState.players)) {
    const orig = roomState.players[pid];
    const curr = players[pid];
    if (curr.hp !== orig.hp)                                             updates[`players.${pid}.hp`]         = curr.hp;
    if (curr.shields !== orig.shields)                                   updates[`players.${pid}.shields`]    = curr.shields;
    if (curr.eliminated !== orig.eliminated)                             updates[`players.${pid}.eliminated`] = curr.eliminated;
    if ((curr.jaheiraForm ?? null) !== (orig.jaheiraForm ?? null))       updates[`players.${pid}.jaheiraForm`] = curr.jaheiraForm;
    if ((curr.immune ?? false) !== (orig.immune ?? false))               updates[`players.${pid}.immune`]     = curr.immune;
    if (!arraysEqual(curr.hand, orig.hand))                              updates[`players.${pid}.hand`]       = curr.hand;
  }

  for (const pid of Object.keys(decks)) {
    if (!arraysEqual(decks[pid], roomState.decks?.[pid] ?? []))
      updates[`decks.${pid}`] = decks[pid];
  }
  for (const pid of Object.keys(discardPiles)) {
    if (!arraysEqual(discardPiles[pid], roomState.discardPiles?.[pid] ?? []))
      updates[`discardPiles.${pid}`] = discardPiles[pid];
  }

  if (extraPlays > 0)
    updates.extraPlaysThisTurn = (roomState.extraPlaysThisTurn || 0) + extraPlays;
  if (pendingReclaim)
    updates.pendingReclaim = playerId;

  return updates;
}

function resolveMighty(sym, context, players, decks, discardPiles) {
  const { playerId, targetId } = context;
  let extraPlays = 0;

  switch (sym.effect) {

    case 'mighty_strike': {
      // Targeted heavy attack
      if (!targetId || !players[targetId] || players[targetId].eliminated || players[targetId].immune) break;
      const { newHp, newShields } = applyDamage(players[targetId], sym.value);
      players[targetId].hp      = newHp;
      players[targetId].shields = newShields;
      if (newHp <= 0) players[targetId].eliminated = true;
      break;
    }

    case 'swap_hp': {
      if (!targetId || !players[targetId] || players[targetId].eliminated || players[targetId].immune) break;
      const myHp    = players[playerId].hp;
      const theirHp = players[targetId].hp;
      players[playerId].hp  = theirHp;
      players[targetId].hp  = myHp;
      if (players[targetId].hp <= 0) players[targetId].eliminated = true;
      if (players[playerId].hp  <= 0) players[playerId].eliminated  = true;
      break;
    }

    case 'steal_shield': {
      if (!targetId || !players[targetId] || players[targetId].immune) break;
      const stolen = players[targetId].shields || 0;
      if (stolen > 0) {
        players[playerId].shields  = (players[playerId].shields || 0) + stolen;
        players[targetId].shields  = 0;
      }
      break;
    }

    case 'steal_and_play': {
      // Steal random card from opponent's hand, add to mine + grant extra play
      if (!targetId || !players[targetId] || players[targetId].immune) break;
      const targetHand = players[targetId].hand || [];
      if (targetHand.length === 0) break;
      const i = Math.floor(Math.random() * targetHand.length);
      const stolen = targetHand[i];
      players[targetId].hand = targetHand.filter((_, j) => j !== i);
      players[playerId].hand  = [...(players[playerId].hand || []), stolen];
      extraPlays++;
      break;
    }

    case 'steal_card': {
      // Steal random card from target's hand into mine (no bonus play)
      if (!targetId || !players[targetId] || players[targetId].immune) break;
      const targetHand = players[targetId].hand || [];
      if (targetHand.length === 0) break;
      const i = Math.floor(Math.random() * targetHand.length);
      const stolen = targetHand[i];
      players[targetId].hand = targetHand.filter((_, j) => j !== i);
      players[playerId].hand  = [...(players[playerId].hand || []), stolen];
      break;
    }

    case 'pickpocket': {
      // Steal top card of opponent's deck, resolve its effects, return to their discard
      if (!targetId || !players[targetId] || players[targetId].eliminated || players[targetId].immune) break;
      let targetDeck = decks[targetId] || [];
      if (targetDeck.length === 0) {
        // Reshuffle their discard if deck is empty
        const targetDiscard = discardPiles[targetId] || [];
        if (targetDiscard.length === 0) break;
        targetDeck = shuffle(targetDiscard);
        discardPiles[targetId] = [];
      }
      const stolenCardId = targetDeck[0];
      decks[targetId] = targetDeck.slice(1);

      const stolenCard = CARDS[stolenCardId];
      if (stolenCard?.symbols) {
        // Resolve non-mighty effects of stolen card as playerId
        const nonMighty = stolenCard.symbols.filter(
          s => s.type !== SYM.MIGHTY && s.type !== SYM.RECLAIM
        );
        applySymbols(nonMighty, context, players, decks, discardPiles);
      }

      // Return stolen card to original owner's discard
      discardPiles[targetId] = [...(discardPiles[targetId] || []), stolenCardId];
      break;
    }

    case 'set_form': {
      players[playerId].jaheiraForm = sym.value;
      break;
    }

    case 'set_immune': {
      players[playerId].immune = true;
      break;
    }

    case 'destroy_shields': {
      const targets = sym.target === 'all_opponents'
        ? Object.keys(players).filter(pid => pid !== playerId && !players[pid].eliminated && !players[pid].immune)
        : Object.keys(players).filter(pid => !players[pid].eliminated);
      for (const tid of targets) players[tid].shields = 0;
      break;
    }
  }

  return extraPlays;
}

// --- Shield/damage resolution ---

export function applyDamage(player, amount) {
  let shields = player.shields || 0;
  let hp      = player.hp;
  const absorbed = Math.min(amount, shields);
  shields -= absorbed;
  hp      -= (amount - absorbed);
  return { newHp: Math.max(0, hp), newShields: shields };
}

export function applyShield(player, amount) {
  return { newShields: (player.shields || 0) + amount };
}

// --- Jaheira form ---

export function getJaheiraForm(player) {
  return player.jaheiraForm || 'none';
}

// --- Win condition ---

export function checkWinCondition(players) {
  const alive = Object.entries(players).filter(([, p]) => !p.eliminated);
  if (alive.length === 0) return 'draw';
  if (alive.length === 1) return alive[0][0];
  return null;
}
