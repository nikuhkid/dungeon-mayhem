// @ts-nocheck
import { CARDS, SYM, shuffle, buildDeck, buildRemixDecks, getEffectiveCardSymbols } from '../data/cards';
import { updateRoom } from '../firebase/firebase';

// --- Internal helpers ---

function cardOwnerId(players, cardId) {
  const heroId = CARDS[cardId]?.heroId;
  if (!heroId) return null;
  return Object.entries(players).find(([, p]) => p.heroId === heroId)?.[0] ?? null;
}

function shieldUid() {
  return `sc_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function drawCards(deck, discard, count) {
  deck = [...deck];
  discard = [...discard];
  const drawn = [];
  let reshuffled = false;
  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
      reshuffled = true;
    }
    drawn.push(deck.shift());
  }
  return { deck, discard, drawn, reshuffled };
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

function shieldCardsEqual(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

function getAttackTargets(targetType, playerId, players) {
  switch (targetType) {
    case 'all_opponents':
      return Object.keys(players).filter(
        pid => pid !== playerId && !players[pid].eliminated && !players[pid].immune
      );
    case 'all':
      return Object.keys(players).filter(pid => !players[pid].eliminated && !players[pid].immune);
    default:
      return [];
  }
}

function grantBonusPlay(result, count = 1) {
  result.bonusPlays += count;
}

function healPlayer(players, playerId, amount) {
  players[playerId].hp = Math.min(10, players[playerId].hp + amount);
}

function addShield(players, playerId, cardId, amount) {
  players[playerId].shieldCards = [
    ...(players[playerId].shieldCards || []),
    { id: shieldUid(), cardId: cardId || 'unknown', remaining: amount },
  ];
}

function drawToHand(players, decks, discardPiles, playerId, count) {
  const { deck, discard, drawn } = drawCards(
    decks[playerId] || [],
    discardPiles[playerId] || [],
    count
  );
  decks[playerId] = deck;
  discardPiles[playerId] = discard;
  players[playerId].hand = [...(players[playerId].hand || []), ...drawn];
  return drawn;
}

function replaceHandWithDraw(players, decks, discardPiles, playerId, count) {
  const { deck, discard, drawn } = drawCards(
    decks[playerId] || [],
    discardPiles[playerId] || [],
    count
  );
  decks[playerId] = deck;
  discardPiles[playerId] = discard;
  players[playerId].hand = drawn;
  return drawn;
}

function discardHandAndDraw(players, decks, discardPiles, playerId, count) {
  discardPiles[playerId] = [
    ...(discardPiles[playerId] || []),
    ...(players[playerId].hand || []),
  ];
  players[playerId].hand = [];
  return replaceHandWithDraw(players, decks, discardPiles, playerId, count);
}

function damagePlayer(players, discardPiles, playerId, amount, brokenShields) {
  const { newHp, newShieldCards, newDiscard, brokenShieldCardIds } = applyDamage(
    players[playerId],
    amount,
    discardPiles[playerId] || []
  );
  players[playerId].hp = newHp;
  players[playerId].shieldCards = newShieldCards;
  discardPiles[playerId] = newDiscard;
  brokenShields.push(...brokenShieldCardIds);
  if (newHp <= 0) players[playerId].eliminated = true;
}

function transferRandomHandCard(players, fromPlayerId, toPlayerId) {
  const sourceHand = players[fromPlayerId]?.hand || [];
  if (sourceHand.length === 0) return null;
  const index = Math.floor(Math.random() * sourceHand.length);
  const stolen = sourceHand[index];
  players[fromPlayerId].hand = sourceHand.filter((_, i) => i !== index);
  players[toPlayerId].hand = [...(players[toPlayerId].hand || []), stolen];
  return stolen;
}

function stealTopDeckCard(players, decks, discardPiles, fromPlayerId, toPlayerId) {
  let sourceDeck = decks[fromPlayerId] || [];
  if (sourceDeck.length === 0) {
    const sourceDiscard = discardPiles[fromPlayerId] || [];
    if (sourceDiscard.length === 0) return null;
    sourceDeck = shuffle(sourceDiscard);
    discardPiles[fromPlayerId] = [];
  }
  const stolenId = sourceDeck[0];
  decks[fromPlayerId] = sourceDeck.slice(1);
  if (toPlayerId) {
    players[toPlayerId].hand = [...(players[toPlayerId].hand || []), stolenId];
  }
  return stolenId;
}

const JAHEIRA_FORM_CARD_IDS = ['jaheira_wolf_form', 'jaheira_bear_form'];

// --- Turn management ---

export async function startRollingPhase(roomCode, roomState) {
  const playerIds = Object.keys(roomState.players);
  const rolls = {};
  for (const pid of playerIds) {
    rolls[pid] = Math.floor(Math.random() * 20) + 1;
  }
  const turnOrder = [...playerIds].sort((a, b) => {
    const diff = rolls[b] - rolls[a];
    return diff !== 0 ? diff : (Math.random() < 0.5 ? -1 : 1);
  });
  await updateRoom(roomCode, { status: 'rolling', rolls, turnOrder });
}

export async function startGame(roomCode, roomState) {
  const playerIds = Object.keys(roomState.players);
  const turnOrder = (roomState.turnOrder?.length ?? 0) > 0
    ? roomState.turnOrder
    : shuffle(playerIds);

  const updates = {
    status: 'playing',
    turnOrder,
    currentTurn: turnOrder[0],
    turnPhase: 'drawing',
    winner: null,
    cardsPlayedThisTurn: 0,
    extraPlaysThisTurn: 0,
    extraPlayCardIds: null,
    pendingReclaim: null,
    pendingShieldPick: null,
    pendingPickpocket: null,
  };

  const decks = {};
  const discardPiles = {};

  const remixDecks = roomState.gameMode === 'remix'
    ? buildRemixDecks(roomState.players)
    : null;
  updates.remixPowerAssignments = remixDecks?.remixPowerAssignments ?? null;

  for (const pid of playerIds) {
    const heroId   = roomState.players[pid].heroId;
    const fullDeck = remixDecks ? remixDecks.decks[pid] : buildDeck(heroId);
    const { deck, drawn } = drawCards(fullDeck, [], 3);
    decks[pid] = deck;
    discardPiles[pid] = [];
    updates[`players.${pid}.hand`]            = drawn;
    updates[`players.${pid}.eliminated`]      = false;
    updates[`players.${pid}.shieldCards`]     = [];
    updates[`players.${pid}.hp`]              = 10;
    updates[`players.${pid}.immune`]          = false;
    updates[`players.${pid}.frienemiesBonus`] = 0;
  }

  updates.decks = decks;
  updates.discardPiles = discardPiles;
  updates.playedThisTurn = {};

  updates.eliminationOrder = [];

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

  // Set draw result first so the flush loop layers on top correctly
  const updates = {
    [`decks.${playerId}`]:        deck,
    [`discardPiles.${playerId}`]: discard,
  };

  // Build set of all active shield card IDs — these stay in playedThisTurn until broken
  const activeShieldIds = new Set();
  for (const p of Object.values(roomState.players)) {
    for (const sc of (p.shieldCards || [])) {
      activeShieldIds.add(sc.cardId);
    }
  }

  // Flush played cards to owner's discard, skipping cards still active as shields
  for (const [pid, played] of Object.entries(roomState.playedThisTurn || {})) {
    if (!played || played.length === 0) continue;
    const toKeep = [];
    for (const cid of played) {
      if (activeShieldIds.has(cid)) {
        toKeep.push(cid);
        continue;
      }
      const ownerId = cardOwnerId(roomState.players, cid) ?? pid;
      const key = `discardPiles.${ownerId}`;
      const base = updates[key] ?? roomState.discardPiles?.[ownerId] ?? [];
      updates[key] = [...base, cid];
    }
    updates[`playedThisTurn.${pid}`] = toKeep;
  }

  updates[`players.${playerId}.hand`]      = newHand;
  updates[`playedThisTurn.${playerId}`]    = updates[`playedThisTurn.${playerId}`] ?? [];
  updates.turnPhase           = 'playing';
  updates.cardsPlayedThisTurn = 0;
  updates.extraPlaysThisTurn  = 0;
  updates.extraPlayCardIds    = null;
  updates.pendingReclaim      = null;
  updates.pendingShieldPick   = null;
  updates.pendingPickpocket   = null;
  updates.lastAction          = entry;
  updates.actionLog           = actionLog;

  if (roomState.players[playerId]?.immune) {
    updates[`players.${playerId}.immune`] = false;
  }

  await updateRoom(roomCode, updates);
}

export async function endTurn(roomCode, roomState, playerId) {
  const updates = {
    cardsPlayedThisTurn: 0,
    extraPlaysThisTurn:  0,
    extraPlayCardIds:    null,
    pendingReclaim:      null,
    pendingShieldPick:   null,
    pendingPickpocket:   null,
  };

  updates[`players.${playerId}.frienemiesBonus`] = 0;

  const activeShieldCardIds = new Set(
    (roomState.players[playerId]?.shieldCards || []).map(sc => sc.cardId)
  );
  if (activeShieldCardIds.size > 0) {
    const played = roomState.playedThisTurn?.[playerId] || [];
    const withoutActiveShields = played.filter(cid => !activeShieldCardIds.has(cid));
    if (withoutActiveShields.length !== played.length) {
      updates[`playedThisTurn.${playerId}`] = withoutActiveShields;
    }
  }

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
  const played = [...(roomState.playedThisTurn?.[playerId] || []), cardId];
  const card = CARDS[cardId];
  const restrictedExtraCardIds = roomState.extraPlayCardIds || null;
  const isRestrictedExtraPlay =
    restrictedExtraCardIds?.length &&
    (roomState.cardsPlayedThisTurn || 0) > 0 &&
    (roomState.cardsPlayedThisTurn || 0) <= (roomState.extraPlaysThisTurn || 0);

  if (isRestrictedExtraPlay && !restrictedExtraCardIds.includes(cardId)) return;

  const targetName = targetId ? roomState.players[targetId]?.name : null;
  const entry = logEntry(
    `${player.name} played ${card?.name ?? cardId}${targetName ? ` → ${targetName}` : ''}`,
    { playerId, cardId, targetId }
  );

  const updates = {
    [`players.${playerId}.hand`]:       hand,
    [`playedThisTurn.${playerId}`]:     played,
    lastAction:          entry,
    actionLog:           pushLog(roomState.actionLog, entry),
    cardsPlayedThisTurn: (roomState.cardsPlayedThisTurn || 0) + 1,
  };

  if (isRestrictedExtraPlay) {
    updates.extraPlayCardIds = null;
  }

  const symbolsToResolve = getEffectiveCardSymbols(card, roomState, playerId);

  if (symbolsToResolve?.length) {
    const stateForEffect = {
      ...roomState,
      players:          { ...roomState.players, [playerId]: { ...player, hand } },
      playedThisTurn:   { ...roomState.playedThisTurn, [playerId]: played },
    };
    const effectUpdates = resolveSymbols(symbolsToResolve, { playerId, targetId, cardId }, stateForEffect);
    Object.assign(updates, effectUpdates);
  }

  // Win check
  const finalPlayers = {};
  for (const [pid, p] of Object.entries(roomState.players)) {
    finalPlayers[pid] = {
      ...p,
      hp:         updates[`players.${pid}.hp`]         ?? p.hp,
      shieldCards: updates[`players.${pid}.shieldCards`] ?? p.shieldCards,
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

// --- Shield pick resolution ---

export async function resolveShieldPick(roomCode, roomState, playerId, shieldInstanceId) {
  const pick = roomState.pendingShieldPick;
  if (!pick || pick.pickerId !== playerId) return;

  const { effect, targetId } = pick;
  const targetShields = [...(roomState.players[targetId]?.shieldCards || [])];
  const scIdx = targetShields.findIndex(sc => sc.id === shieldInstanceId);
  if (scIdx === -1) return;

  const sc = targetShields[scIdx];
  const updates = { pendingShieldPick: null };

  if (effect === 'steal_shield') {
    const myShields = [...(roomState.players[playerId].shieldCards || [])];
    updates[`players.${targetId}.shieldCards`]  = targetShields.filter((_, i) => i !== scIdx);
    updates[`players.${playerId}.shieldCards`]  = [...myShields, sc];
  } else if (effect === 'destroy_one_shield') {
    const oid = cardOwnerId(roomState.players, sc.cardId) ?? targetId;
    updates[`players.${targetId}.shieldCards`]  = targetShields.filter((_, i) => i !== scIdx);
    updates[`discardPiles.${oid}`]              = [...(roomState.discardPiles[oid] || []), sc.cardId];
    // Remove from playedThisTurn wherever it lives
    for (const [pid, played] of Object.entries(roomState.playedThisTurn || {})) {
      const filtered = (played || []).filter(cid => cid !== sc.cardId);
      if (filtered.length !== (played || []).length) {
        updates[`playedThisTurn.${pid}`] = filtered;
      }
    }
  }

  const verb = effect === 'steal_shield' ? 'stole' : 'destroyed';
  const entry = logEntry(
    `${roomState.players[playerId].name} ${verb} ${CARDS[sc.cardId]?.name ?? sc.cardId}`,
    { playerId }
  );
  updates.lastAction = entry;
  updates.actionLog  = pushLog(roomState.actionLog, entry);

  await updateRoom(roomCode, updates);
}

// --- Pickpocket resolution ---

export async function resolvePickpocket(roomCode, roomState, pickerId, attackTargetId = null) {
  const pick = roomState.pendingPickpocket;
  if (!pick || pick.pickerId !== pickerId) return;

  const { stolenCardId, ownerId } = pick;
  const stolenCard = CARDS[stolenCardId];
  const updates = { pendingPickpocket: null };

  if (stolenCard?.symbols?.length) {
    const effectUpdates = resolveSymbols(
      getEffectiveCardSymbols(stolenCard, roomState, pickerId),
      { playerId: pickerId, targetId: attackTargetId, cardId: stolenCardId },
      roomState
    );
    Object.assign(updates, effectUpdates);
  }

  // Stage card in picker's playedThisTurn — startTurn will route to owner's discard
  // unless a shield was gained (activeShieldIds keeps it in play until broken)
  const basePlayed = updates[`playedThisTurn.${pickerId}`] ?? [...(roomState.playedThisTurn?.[pickerId] || [])];
  updates[`playedThisTurn.${pickerId}`] = [...basePlayed, stolenCardId];

  const entry = logEntry(
    `${roomState.players[pickerId].name} used ${stolenCard?.name ?? stolenCardId} (from ${roomState.players[ownerId]?.name ?? ownerId}'s deck)`,
    { playerId: pickerId, cardId: stolenCardId }
  );
  updates.lastAction = entry;
  updates.actionLog  = pushLog(roomState.actionLog, entry);

  // Win check
  const finalPlayers = {};
  for (const [pid, p] of Object.entries(roomState.players)) {
    finalPlayers[pid] = {
      ...p,
      hp:          updates[`players.${pid}.hp`]          ?? p.hp,
      shieldCards: updates[`players.${pid}.shieldCards`] ?? p.shieldCards,
      eliminated:  updates[`players.${pid}.eliminated`]  ?? p.eliminated,
    };
  }
  const winner = checkWinCondition(finalPlayers);
  if (winner) {
    updates.winner = winner === 'draw' ? pickerId : winner;
    updates.status = 'finished';
  }

  await updateRoom(roomCode, updates);
}

// --- Symbol resolution ---

function applySymbols(symbols, context, players, decks, discardPiles) {
  const { playerId, targetId } = context;
  const result = { bonusPlays: 0 };
  const brokenShields = [];

  const ordered = [
    ...symbols.filter(s => s.type !== SYM.MIGHTY),
    ...symbols.filter(s => s.type === SYM.MIGHTY),
  ];

  for (const sym of ordered) {
    switch (sym.type) {

      case SYM.ATTACK: {
        const bonus = players[playerId].frienemiesBonus || 0;
        let targets;
        if (sym.target === 'opponent') {
          targets = targetId && players[targetId] && !players[targetId].eliminated && !players[targetId].immune
            ? [targetId] : [];
        } else {
          targets = getAttackTargets(sym.target, playerId, players);
        }
        for (const tid of targets) {
          damagePlayer(players, discardPiles, tid, sym.value + bonus, brokenShields);
        }
        break;
      }

      case SYM.SHIELD:
        addShield(players, playerId, context.cardId, sym.value);
        break;

      case SYM.HEAL:
        healPlayer(players, playerId, sym.value);
        break;

      case SYM.DRAW:
        drawToHand(players, decks, discardPiles, playerId, sym.value);
        break;

      case SYM.PLAY_AGAIN:
        grantBonusPlay(result);
        break;

      case SYM.MIGHTY: {
        const { bonusPlays, brokenShields: bs } = resolveMighty(sym, context, players, decks, discardPiles);
        result.bonusPlays += bonusPlays;
        brokenShields.push(...bs);
        break;
      }
    }
  }

  return { bonusPlays: result.bonusPlays, brokenShields };
}

export function resolveSymbols(symbols, context, roomState) {
  const { playerId } = context;
  const ctx = { ...context, turnOrder: roomState.turnOrder || [] };

  const players      = structuredClone(roomState.players);
  const decks        = structuredClone(roomState.decks || {});
  const discardPiles = structuredClone(roomState.discardPiles || {});

  const reclaimSyms = symbols.filter(s => s.type === SYM.RECLAIM);
  const otherSyms   = symbols.filter(s => s.type !== SYM.RECLAIM);

  const { bonusPlays, brokenShields } = applySymbols(otherSyms, ctx, players, decks, discardPiles);
  let pendingReclaim = false;

  // Route broken shield cards to their original card owner's discard
  for (const cid of brokenShields) {
    const oid = cardOwnerId(players, cid) ?? playerId;
    discardPiles[oid] = [...(discardPiles[oid] || []), cid];
  }

  for (const _sym of reclaimSyms) {
    const disc = discardPiles[playerId] || [];
    if (disc.length > 0) {
      pendingReclaim = true;
    }
  }

  // Mid-turn refill: any player with 0 cards draws 2
  if (!pendingReclaim && !ctx.shieldPickRequest) {
    for (const pid of Object.keys(players)) {
      if (!players[pid].eliminated && (players[pid].hand || []).length === 0) {
        replaceHandWithDraw(players, decks, discardPiles, pid, 2);
      }
    }
  }

  // Diff
  const updates = {};

  for (const pid of Object.keys(roomState.players)) {
    const orig = roomState.players[pid];
    const curr = players[pid];
    if (curr.hp !== orig.hp)                                             updates[`players.${pid}.hp`]              = curr.hp;
    if (!shieldCardsEqual(curr.shieldCards, orig.shieldCards))           updates[`players.${pid}.shieldCards`]     = curr.shieldCards;
    if (curr.eliminated !== orig.eliminated)                             updates[`players.${pid}.eliminated`]      = curr.eliminated;
    if ((curr.jaheiraForm ?? null) !== (orig.jaheiraForm ?? null))       updates[`players.${pid}.jaheiraForm`]     = curr.jaheiraForm;
    if ((curr.immune ?? false) !== (orig.immune ?? false))               updates[`players.${pid}.immune`]          = curr.immune;
    if ((curr.frienemiesBonus || 0) !== (orig.frienemiesBonus || 0))     updates[`players.${pid}.frienemiesBonus`] = curr.frienemiesBonus || 0;
    if (!arraysEqual(curr.hand, orig.hand))                              updates[`players.${pid}.hand`]            = curr.hand;
  }

  for (const pid of Object.keys(decks)) {
    if (!arraysEqual(decks[pid], roomState.decks?.[pid] ?? []))
      updates[`decks.${pid}`] = decks[pid];
  }
  for (const pid of Object.keys(discardPiles)) {
    if (!arraysEqual(discardPiles[pid], roomState.discardPiles?.[pid] ?? []))
      updates[`discardPiles.${pid}`] = discardPiles[pid];
  }

  const newlyEliminated = Object.keys(roomState.players).filter(
    pid => !roomState.players[pid].eliminated && players[pid]?.eliminated
  );
  if (newlyEliminated.length > 0) {
    updates.eliminationOrder = [...(roomState.eliminationOrder || []), ...newlyEliminated];
  }

  if (bonusPlays > 0)
    updates.extraPlaysThisTurn = (roomState.extraPlaysThisTurn || 0) + bonusPlays;
  if (ctx.extraPlayCardIds)
    updates.extraPlayCardIds = ctx.extraPlayCardIds;
  if (pendingReclaim)
    updates.pendingReclaim = playerId;
  if (ctx.shieldPickRequest)
    updates.pendingShieldPick = { ...ctx.shieldPickRequest, pickerId: playerId };
  if (ctx.pickpocketRequest)
    updates.pendingPickpocket = { ...ctx.pickpocketRequest, pickerId: playerId };

  // Remove broken shield cards from all playedThisTurn entries
  if (brokenShields.length > 0) {
    const brokenSet = new Set(brokenShields);
    for (const [pid, played] of Object.entries(roomState.playedThisTurn || {})) {
      const filtered = (played || []).filter(cid => !brokenSet.has(cid));
      if (filtered.length !== (played || []).length) {
        updates[`playedThisTurn.${pid}`] = filtered;
      }
    }
  }

  return updates;
}

function resolveMighty(sym, context, players, decks, discardPiles) {
  const { playerId, targetId } = context;
  const result = { bonusPlays: 0 };
  const brokenShields = [];

  switch (sym.effect) {

    case 'mighty_strike': {
      if (!targetId || !players[targetId] || players[targetId].eliminated || players[targetId].immune) break;
      damagePlayer(players, discardPiles, targetId, sym.value, brokenShields);
      break;
    }

    case 'swap_hp': {
      if (!targetId || !players[targetId] || players[targetId].eliminated || players[targetId].immune) break;
      const myHp    = players[playerId].hp;
      const theirHp = players[targetId].hp;
      players[playerId].hp  = theirHp;
      players[targetId].hp  = myHp;
      if (players[targetId].hp <= 0) players[targetId].eliminated = true;
      if (players[playerId].hp  <= 0) players[playerId].eliminated = true;
      break;
    }

    case 'steal_shield': {
      if (!targetId || !players[targetId] || players[targetId].immune) break;
      const targetShields = players[targetId].shieldCards || [];
      if (targetShields.length === 0) break;
      context.shieldPickRequest = { effect: 'steal_shield', targetId };
      break;
    }

    case 'steal_and_play': {
      if (!targetId || !players[targetId]) break;
      if (transferRandomHandCard(players, targetId, playerId)) {
        grantBonusPlay(result);
      }
      break;
    }

    case 'steal_card': {
      if (!targetId || !players[targetId]) break;
      transferRandomHandCard(players, targetId, playerId);
      break;
    }

    case 'pickpocket': {
      if (!targetId || !players[targetId] || players[targetId].eliminated) break;
      const stolenId = stealTopDeckCard(players, decks, discardPiles, targetId, null);
      if (stolenId) context.pickpocketRequest = { stolenCardId: stolenId, ownerId: targetId };
      break;
    }

    case 'set_form':
      if (players[playerId].heroId === 'jaheira') {
        players[playerId].jaheiraForm = sym.value;
      }
      break;

    case 'set_immune':
      players[playerId].immune = true;
      break;

    case 'destroy_shields': {
      const targets = sym.target === 'all_opponents'
        ? Object.keys(players).filter(pid => pid !== playerId && !players[pid].eliminated && !players[pid].immune)
        : Object.keys(players).filter(pid => !players[pid].eliminated && !players[pid].immune);
      for (const tid of targets) {
        const sc = players[tid].shieldCards || [];
        brokenShields.push(...sc.map(c => c.cardId));
        players[tid].shieldCards = [];
      }
      break;
    }

    case 'destroy_one_shield': {
      if (!targetId || !players[targetId] || (targetId !== playerId && players[targetId].immune)) break;
      const ts = players[targetId].shieldCards || [];
      if (ts.length === 0) break;
      if (ts.length === 1) {
        brokenShields.push(ts[0].cardId);
        players[targetId].shieldCards = [];
      } else {
        context.shieldPickRequest = { effect: 'destroy_one_shield', targetId };
      }
      break;
    }

    case 'battle_roar': {
      for (const pid of Object.keys(players)) {
        if (!players[pid].eliminated) {
          discardHandAndDraw(players, decks, discardPiles, pid, 3);
        }
      }
      break;
    }

    case 'whirling_axes': {
      const allOpps = Object.keys(players).filter(
        pid => pid !== playerId && !players[pid].eliminated
      );
      healPlayer(players, playerId, allOpps.length);
      const dmgOpps = allOpps.filter(pid => !players[pid].immune);
      for (const tid of dmgOpps) {
        damagePlayer(players, discardPiles, tid, 1, brokenShields);
      }
      break;
    }

    case 'swapportunity_all': {
      const turnOrder = context.turnOrder || [];
      const alive = turnOrder.filter(pid => !players[pid]?.eliminated && !players[pid]?.immune);
      if (alive.length < 2) break;
      const hpSnap = alive.map(pid => players[pid].hp);
      const rotated = [hpSnap[hpSnap.length - 1], ...hpSnap.slice(0, -1)];
      alive.forEach((pid, i) => {
        players[pid].hp = Math.max(0, rotated[i]);
        if (players[pid].hp <= 0) players[pid].eliminated = true;
      });
      break;
    }

    case 'favored_frienemies': {
      players[playerId].frienemiesBonus = (players[playerId].frienemiesBonus || 0) + 1;
      grantBonusPlay(result);
      break;
    }

    case 'scouting_outing': {
      const opps = Object.keys(players).filter(pid => pid !== playerId && !players[pid].eliminated);
      for (const oid of opps) {
        stealTopDeckCard(players, decks, discardPiles, oid, playerId);
      }
      break;
    }

    case 'commune_with_nature': {
      drawToHand(players, decks, discardPiles, playerId, 2);
      const formSet = new Set(JAHEIRA_FORM_CARD_IDS);
      if ((players[playerId].hand || []).some(cid => formSet.has(cid))) {
        grantBonusPlay(result);
        context.extraPlayCardIds = JAHEIRA_FORM_CARD_IDS;
      }
      break;
    }
  }

  return { bonusPlays: result.bonusPlays, brokenShields };
}

// --- Shield/damage resolution ---

export function applyDamage(player, amount, discardPile = []) {
  let shieldCards = [...(player.shieldCards || [])];
  let hp = player.hp;
  let newDiscard = [...discardPile];
  const brokenShieldCardIds = [];
  let dmg = amount;

  for (let i = 0; i < shieldCards.length && dmg > 0; ) {
    const sc = { ...shieldCards[i] };
    const absorbed = Math.min(dmg, sc.remaining);
    sc.remaining -= absorbed;
    dmg -= absorbed;
    if (sc.remaining <= 0) {
      brokenShieldCardIds.push(sc.cardId);
      shieldCards.splice(i, 1);
    } else {
      shieldCards[i] = sc;
      i++;
    }
  }

  hp = Math.max(0, hp - dmg);
  return { newHp: hp, newShieldCards: shieldCards, newDiscard, brokenShieldCardIds };
}

// --- Room reset (Play Again) ---

export async function resetRoom(roomCode, roomState) {
  const updates = {
    status:              'lobby',
    decks:               {},
    discardPiles:        {},
    currentTurn:         null,
    turnOrder:           [],
    turnPhase:           null,
    winner:              null,
    lastAction:          null,
    actionLog:           [],
    cardsPlayedThisTurn: 0,
    extraPlaysThisTurn:  0,
    extraPlayCardIds:    null,
    remixPowerAssignments: null,
    pendingReclaim:      null,
    pendingShieldPick:   null,
    pendingPickpocket:   null,
    eliminationOrder:    [],
    rolls:               {},
    playedThisTurn:      {},
  };

  for (const pid of Object.keys(roomState.players)) {
    const isBot = pid.startsWith('bot_');
    if (!isBot) {
      updates[`players.${pid}.heroId`]        = null;
      updates[`players.${pid}.ready`]         = false;
    } else {
      updates[`players.${pid}.ready`]         = true;
    }
    updates[`players.${pid}.hp`]              = 10;
    updates[`players.${pid}.hand`]            = [];
    updates[`players.${pid}.shieldCards`]     = [];
    updates[`players.${pid}.eliminated`]      = false;
    updates[`players.${pid}.immune`]          = false;
    updates[`players.${pid}.jaheiraForm`]     = null;
    updates[`players.${pid}.frienemiesBonus`] = 0;
  }

  await updateRoom(roomCode, updates);
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
