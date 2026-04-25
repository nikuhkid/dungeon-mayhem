import { CARDS, SYM, shuffle, buildDeck } from './cards.js';
import { updateRoom } from './firebase.js';

// --- Internal helpers ---

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
    pendingShieldPick: null,
  };

  const decks = {};
  const discardPiles = {};

  for (const pid of playerIds) {
    const heroId = roomState.players[pid].heroId;
    const { deck, drawn } = drawCards(buildDeck(heroId), [], 3);
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

  const entry = logEntry('Game started!');
  updates.lastAction = entry;
  updates.actionLog  = [entry];

  await updateRoom(roomCode, updates);
}

export async function startTurn(roomCode, playerId, roomState) {
  const { deck, discard, drawn, reshuffled } = drawCards(
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
    turnPhase:           'playing',
    cardsPlayedThisTurn: 0,
    extraPlaysThisTurn:  0,
    pendingReclaim:      null,
    pendingShieldPick:   null,
    lastAction:          entry,
    actionLog,
  };

  if (roomState.players[playerId]?.immune) {
    updates[`players.${playerId}.immune`] = false;
  }

  updates[`players.${playerId}.frienemiesBonus`] = 0;

  await updateRoom(roomCode, updates);
}

export async function endTurn(roomCode, roomState, playerId) {
  const updates = {
    cardsPlayedThisTurn: 0,
    extraPlaysThisTurn:  0,
    pendingReclaim:      null,
    pendingShieldPick:   null,
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

  // Build symbols: base always active, formBonus appended if matching form
  let symbolsToResolve = card?.symbols || [];
  if (card?.formBonus) {
    const form = roomState.players[playerId].jaheiraForm ?? 'none';
    const bonus = card.formBonus[form];
    if (bonus?.length) symbolsToResolve = [...symbolsToResolve, ...bonus];
  }

  if (symbolsToResolve?.length) {
    const stateForEffect = {
      ...roomState,
      players:      { ...roomState.players,      [playerId]: { ...player, hand } },
      discardPiles: { ...roomState.discardPiles, [playerId]: discard },
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
    const targetDiscard = [...(roomState.discardPiles[targetId] || []), sc.cardId];
    updates[`players.${targetId}.shieldCards`]  = targetShields.filter((_, i) => i !== scIdx);
    updates[`discardPiles.${targetId}`]         = targetDiscard;
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

// --- Symbol resolution ---

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
        const bonus = players[playerId].frienemiesBonus || 0;
        let targets;
        if (sym.target === 'opponent') {
          targets = targetId && players[targetId] && !players[targetId].eliminated && !players[targetId].immune
            ? [targetId] : [];
        } else {
          targets = getAttackTargets(sym.target, playerId, players);
        }
        for (const tid of targets) {
          const { newHp, newShieldCards, newDiscard } = applyDamage(
            players[tid], sym.value + bonus, discardPiles[tid] || []
          );
          players[tid].hp          = newHp;
          players[tid].shieldCards = newShieldCards;
          discardPiles[tid]         = newDiscard;
          if (newHp <= 0) players[tid].eliminated = true;
        }
        break;
      }

      case SYM.SHIELD:
        players[playerId].shieldCards = [
          ...(players[playerId].shieldCards || []),
          { id: shieldUid(), cardId: context.cardId || 'unknown', remaining: sym.value },
        ];
        break;

      case SYM.HEAL:
        players[playerId].hp = Math.min(10, players[playerId].hp + sym.value);
        break;

      case SYM.DRAW: {
        const { deck, discard, drawn, reshuffled } = drawCards(
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
  const ctx = { ...context, turnOrder: roomState.turnOrder || [] };

  const players      = structuredClone(roomState.players);
  const decks        = structuredClone(roomState.decks || {});
  const discardPiles = structuredClone(roomState.discardPiles || {});

  const reclaimSyms = symbols.filter(s => s.type === SYM.RECLAIM);
  const otherSyms   = symbols.filter(s => s.type !== SYM.RECLAIM);

  let extraPlays    = applySymbols(otherSyms, ctx, players, decks, discardPiles);
  let pendingReclaim = false;

  for (const _sym of reclaimSyms) {
    const disc = discardPiles[playerId] || [];
    if (disc.length === 0) {
      const { deck, discard: nd, drawn, reshuffled } = drawCards(decks[playerId] || [], [], 1);
      decks[playerId]        = deck;
      discardPiles[playerId] = nd;
      players[playerId].hand = [...(players[playerId].hand || []), ...drawn];
    } else {
      pendingReclaim = true;
    }
  }

  // Mid-turn refill: any player with 0 cards draws 2
  if (!pendingReclaim && !ctx.shieldPickRequest) {
    for (const pid of Object.keys(players)) {
      if (!players[pid].eliminated && (players[pid].hand || []).length === 0) {
        const { deck, discard: nd, drawn, reshuffled } = drawCards(
          decks[pid] || [], discardPiles[pid] || [], 2
        );
        decks[pid]        = deck;
        discardPiles[pid] = nd;
        players[pid].hand = drawn;
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

  if (extraPlays > 0)
    updates.extraPlaysThisTurn = (roomState.extraPlaysThisTurn || 0) + extraPlays;
  if (pendingReclaim)
    updates.pendingReclaim = playerId;
  if (ctx.shieldPickRequest)
    updates.pendingShieldPick = { ...ctx.shieldPickRequest, pickerId: playerId };

  return updates;
}

function resolveMighty(sym, context, players, decks, discardPiles) {
  const { playerId, targetId } = context;
  let extraPlays = 0;

  switch (sym.effect) {

    case 'mighty_strike': {
      if (!targetId || !players[targetId] || players[targetId].eliminated || players[targetId].immune) break;
      const { newHp, newShieldCards, newDiscard } = applyDamage(
        players[targetId], sym.value, discardPiles[targetId] || []
      );
      players[targetId].hp          = newHp;
      players[targetId].shieldCards = newShieldCards;
      discardPiles[targetId]         = newDiscard;
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
      if (players[playerId].hp  <= 0) players[playerId].eliminated = true;
      break;
    }

    case 'steal_shield': {
      if (!targetId || !players[targetId] || players[targetId].immune) break;
      const targetShields = players[targetId].shieldCards || [];
      if (targetShields.length === 0) break;
      if (targetShields.length === 1) {
        players[playerId].shieldCards = [...(players[playerId].shieldCards || []), targetShields[0]];
        players[targetId].shieldCards = [];
      } else {
        context.shieldPickRequest = { effect: 'steal_shield', targetId };
      }
      break;
    }

    case 'steal_and_play': {
      if (!targetId || !players[targetId]) break;
      const th = players[targetId].hand || [];
      if (th.length === 0) break;
      const i = Math.floor(Math.random() * th.length);
      const stolen = th[i];
      players[targetId].hand = th.filter((_, j) => j !== i);
      players[playerId].hand = [...(players[playerId].hand || []), stolen];
      extraPlays++;
      break;
    }

    case 'steal_card': {
      if (!targetId || !players[targetId]) break;
      const th = players[targetId].hand || [];
      if (th.length === 0) break;
      const i = Math.floor(Math.random() * th.length);
      const stolen = th[i];
      players[targetId].hand = th.filter((_, j) => j !== i);
      players[playerId].hand = [...(players[playerId].hand || []), stolen];
      break;
    }

    case 'pickpocket': {
      if (!targetId || !players[targetId] || players[targetId].eliminated) break;
      let tDeck = decks[targetId] || [];
      if (tDeck.length === 0) {
        const tDiscard = discardPiles[targetId] || [];
        if (tDiscard.length === 0) break;
        tDeck = shuffle(tDiscard);
        discardPiles[targetId] = [];
      }
      const stolenId = tDeck[0];
      decks[targetId] = tDeck.slice(1);

      const stolenCard = CARDS[stolenId];
      if (stolenCard?.symbols) {
        const nonMighty = stolenCard.symbols.filter(
          s => s.type !== SYM.MIGHTY && s.type !== SYM.RECLAIM
        );
        applySymbols(nonMighty, { ...context, cardId: stolenId }, players, decks, discardPiles);
      }
      discardPiles[targetId] = [...(discardPiles[targetId] || []), stolenId];
      break;
    }

    case 'set_form':
      players[playerId].jaheiraForm = sym.value;
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
        discardPiles[tid] = [...(discardPiles[tid] || []), ...sc.map(c => c.cardId)];
        players[tid].shieldCards = [];
      }
      break;
    }

    case 'destroy_one_shield': {
      if (!targetId || !players[targetId] || players[targetId].immune) break;
      const ts = players[targetId].shieldCards || [];
      if (ts.length === 0) break;
      if (ts.length === 1) {
        discardPiles[targetId] = [...(discardPiles[targetId] || []), ts[0].cardId];
        players[targetId].shieldCards = [];
      } else {
        context.shieldPickRequest = { effect: 'destroy_one_shield', targetId };
      }
      break;
    }

    case 'battle_roar': {
      for (const pid of Object.keys(players)) {
        if (!players[pid].eliminated) {
          discardPiles[pid] = [...(discardPiles[pid] || []), ...(players[pid].hand || [])];
          players[pid].hand = [];
          const { deck, discard: nd, drawn, reshuffled } = drawCards(decks[pid] || [], discardPiles[pid] || [], 3);
          decks[pid] = deck;
          discardPiles[pid] = nd;
          players[pid].hand = drawn;
        }
      }
      extraPlays++;
      break;
    }

    case 'whirling_axes': {
      // Heal for ALL alive opponents (immune still count for heal)
      const allOpps = Object.keys(players).filter(
        pid => pid !== playerId && !players[pid].eliminated
      );
      players[playerId].hp = Math.min(10, players[playerId].hp + allOpps.length);
      // Damage only non-immune opponents
      const dmgOpps = allOpps.filter(pid => !players[pid].immune);
      for (const tid of dmgOpps) {
        const { newHp, newShieldCards, newDiscard } = applyDamage(players[tid], 1, discardPiles[tid] || []);
        players[tid].hp          = newHp;
        players[tid].shieldCards = newShieldCards;
        discardPiles[tid]         = newDiscard;
        if (newHp <= 0) players[tid].eliminated = true;
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
      extraPlays++;
      break;
    }

    case 'scouting_outing': {
      // Like Pickpocket but for each opponent: steal top, use non-mighty effects, return to owner's discard
      const opps = Object.keys(players).filter(pid => pid !== playerId && !players[pid].eliminated);
      for (const oid of opps) {
        let oDeck = decks[oid] || [];
        if (oDeck.length === 0) {
          const oDiscard = discardPiles[oid] || [];
          if (oDiscard.length === 0) continue;
          oDeck = shuffle(oDiscard);
          discardPiles[oid] = [];
        }
        const stolenId = oDeck[0];
        decks[oid] = oDeck.slice(1);

        const stolenCard = CARDS[stolenId];
        if (stolenCard?.symbols) {
          const nonMighty = stolenCard.symbols.filter(
            s => s.type !== SYM.MIGHTY && s.type !== SYM.RECLAIM
          );
          applySymbols(nonMighty, { ...context, cardId: stolenId }, players, decks, discardPiles);
        }
        discardPiles[oid] = [...(discardPiles[oid] || []), stolenId];
      }
      break;
    }

    case 'commune_with_nature': {
      const { deck, discard: nd, drawn, reshuffled } = drawCards(decks[playerId] || [], discardPiles[playerId] || [], 2);
      decks[playerId]        = deck;
      discardPiles[playerId] = nd;
      players[playerId].hand = [...(players[playerId].hand || []), ...drawn];
      const formSet = new Set(['jaheira_wolf_form', 'jaheira_bear_form']);
      if ((players[playerId].hand || []).some(cid => formSet.has(cid))) extraPlays++;
      break;
    }
  }

  return extraPlays;
}

// --- Shield/damage resolution ---

export function applyDamage(player, amount, discardPile = []) {
  let shieldCards = [...(player.shieldCards || [])];
  let hp = player.hp;
  let newDiscard = [...discardPile];
  let dmg = amount;

  for (let i = 0; i < shieldCards.length && dmg > 0; ) {
    const sc = { ...shieldCards[i] };
    const absorbed = Math.min(dmg, sc.remaining);
    sc.remaining -= absorbed;
    dmg -= absorbed;
    if (sc.remaining <= 0) {
      newDiscard.push(sc.cardId);
      shieldCards.splice(i, 1);
    } else {
      shieldCards[i] = sc;
      i++;
    }
  }

  hp = Math.max(0, hp - dmg);
  return { newHp: hp, newShieldCards: shieldCards, newDiscard };
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
