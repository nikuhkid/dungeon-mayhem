import { CARDS, SYM, shuffle } from './cards';

const atk = (n, tgt = 'opponent') => ({ type: SYM.ATTACK, value: n, target: tgt });
const heal = (n) => ({ type: SYM.HEAL, value: n, target: 'self' });
const drw = (n) => ({ type: SYM.DRAW, value: n, target: 'self' });
const again = () => ({ type: SYM.PLAY_AGAIN, value: 1, target: 'self' });

// Jaheira's form cards + commune must travel as a unit.
export const JAHEIRA_TRIO = ['jaheira_wolf_form', 'jaheira_bear_form', 'jaheira_commune'];
const JAHEIRA_FORM_BONUS_CARD_IDS = ['jaheira_gift_silvanus', 'jaheira_wild_rush', 'jaheira_bearnard'];

export const REMIX_POWER_ITEMS = [
  { key: 'jaheira_forms', ids: JAHEIRA_TRIO, slots: 2, sourceHeroId: 'jaheira' },
  { key: 'lia_banishing_smite', ids: ['lia_banishing_smite'], slots: 2, sourceHeroId: 'lia' },
  { key: 'azzan_vampiric_touch', ids: ['azzan_vampiric_touch'], slots: 1, sourceHeroId: 'azzan' },
  { key: 'azzan_charm', ids: ['azzan_charm'], slots: 1, sourceHeroId: 'azzan' },
  { key: 'lia_divine_inspiration', ids: ['lia_divine_inspiration'], slots: 1, sourceHeroId: 'lia' },
  { key: 'oriax_clever_disguise', ids: ['oriax_clever_disguise'], slots: 1, sourceHeroId: 'oriax' },
  { key: 'oriax_sneak_attack', ids: ['oriax_sneak_attack'], slots: 1, sourceHeroId: 'oriax' },
  { key: 'oriax_pick_pocket', ids: ['oriax_pick_pocket'], slots: 1, sourceHeroId: 'oriax' },
  { key: 'sutha_mighty_toss', ids: ['sutha_mighty_toss'], slots: 1, sourceHeroId: 'sutha' },
  { key: 'sutha_battle_roar', ids: ['sutha_battle_roar'], slots: 1, sourceHeroId: 'sutha' },
  { key: 'sutha_whirling_axes', ids: ['sutha_whirling_axes'], slots: 1, sourceHeroId: 'sutha' },
  { key: 'jaheira_primal_strike', ids: ['jaheira_primal_strike'], slots: 1, sourceHeroId: 'jaheira' },
  { key: 'minsc_swapportunity', ids: ['minsc_swapportunity'], slots: 1, sourceHeroId: 'minsc' },
  { key: 'minsc_favored_frienemies', ids: ['minsc_favored_frienemies'], slots: 1, sourceHeroId: 'minsc' },
  { key: 'minsc_scouting', ids: ['minsc_scouting'], slots: 1, sourceHeroId: 'minsc' },
];

const REMIX_POWER_IDS = new Set(REMIX_POWER_ITEMS.flatMap(item => item.ids));

function ownsAllOwnPowerItems(players, playerId, assignedItems) {
  const heroId = players[playerId]?.heroId;
  const ownItems = REMIX_POWER_ITEMS.filter(item => item.sourceHeroId === heroId);
  if (ownItems.length === 0) return false;
  const assignedKeys = new Set(assignedItems[playerId].map(item => item.key));
  return ownItems.every(item => assignedKeys.has(item.key));
}

export function buildRemixDecks(players, attempt = 0) {
  const playerIds = Object.keys(players);
  const MAX_SLOTS = 3;
  const dealItems = shuffle(REMIX_POWER_ITEMS);
  const assignedItems = {};
  const assignments = {};
  const slotsUsed = {};
  for (const pid of playerIds) { assignedItems[pid] = []; assignments[pid] = []; slotsUsed[pid] = 0; }

  const pids = shuffle([...playerIds]);
  let cursor = 0;

  for (const item of dealItems) {
    for (let i = 0; i < pids.length; i++) {
      const pid = pids[(cursor + i) % pids.length];
      if (slotsUsed[pid] + item.slots <= MAX_SLOTS) {
        assignedItems[pid].push(item);
        assignments[pid].push(...item.ids);
        slotsUsed[pid] += item.slots;
        cursor = (cursor + i + 1) % pids.length;
        break;
      }
    }
  }

  const invalidOwner = playerIds.find(pid => ownsAllOwnPowerItems(players, pid, assignedItems));
  if (invalidOwner && attempt < 100) {
    return buildRemixDecks(players, attempt + 1);
  }
  if (invalidOwner) {
    const heroId = players[invalidOwner]?.heroId;
    const ownItemIndex = assignedItems[invalidOwner].findIndex(item => item.sourceHeroId === heroId);
    if (ownItemIndex !== -1) {
      const [removed] = assignedItems[invalidOwner].splice(ownItemIndex, 1);
      assignments[invalidOwner] = assignments[invalidOwner].filter(id => !removed.ids.includes(id));
      slotsUsed[invalidOwner] -= removed.slots;
    }
  }

  const decks = {};
  for (const pid of playerIds) {
    const hero = players[pid].heroId;
    const assignedSet = new Set(assignments[pid]);
    const deck = [];

    for (const card of Object.values(CARDS)) {
      if (REMIX_POWER_IDS.has(card.id)) {
        if (assignedSet.has(card.id)) {
          for (let i = 0; i < card.count; i++) deck.push(card.id);
        }
      } else if (card.heroId === hero) {
        for (let i = 0; i < card.count; i++) deck.push(card.id);
      }
    }

    decks[pid] = shuffle(deck);
  }

  const remixPowerAssignments = {};
  for (const pid of playerIds) {
    remixPowerAssignments[pid] = {
      ids: assignments[pid],
      itemKeys: assignedItems[pid].map(item => item.key),
      sourceHeroIds: assignedItems[pid].map(item => item.sourceHeroId),
      slotsUsed: slotsUsed[pid],
    };
  }

  return { decks, remixPowerAssignments };
}

function jaheiraAssignmentHasFormBundle(assignment) {
  const ids = new Set(assignment?.ids || []);
  return JAHEIRA_TRIO.every(id => ids.has(id));
}

function symbolsForJaheiraRemixBonus(type) {
  switch (type) {
    case 'draw':    return [drw(1)];
    case 'stamina': return [again()];
    case 'heal':    return [heal(1)];
    case 'damage':  return [atk(1)];
    default:        return [];
  }
}

export function getJaheiraRemixBonusType(state, playerId) {
  if (state?.gameMode !== 'remix') return null;
  const player = state.players?.[playerId];
  if (player?.heroId !== 'jaheira') return null;
  const assignment = state.remixPowerAssignments?.[playerId];
  if (!assignment || jaheiraAssignmentHasFormBundle(assignment)) return null;

  const keys = new Set(assignment.itemKeys || []);
  const sources = new Set(assignment.sourceHeroIds || []);
  const hasAzzan = sources.has('azzan');
  const hasSutha = sources.has('sutha');
  const hasOriax = sources.has('oriax');
  const hasMinsc = sources.has('minsc');
  const hasDivine = keys.has('lia_divine_inspiration');
  const hasPrimal = keys.has('jaheira_primal_strike');

  if (keys.has('lia_banishing_smite')) return 'heal';
  if (hasSutha && (hasMinsc || hasPrimal)) return 'damage';
  if (hasMinsc && hasPrimal) return 'damage';
  if (hasDivine && hasAzzan) return 'heal';
  if (hasDivine && hasOriax) return 'stamina';

  const weights = {
    draw: (hasSutha ? 1 : 0) + (hasAzzan ? 1 : 0),
    stamina: (hasOriax ? 1 : 0) + (hasMinsc ? 1 : 0),
    heal: (hasDivine ? 1 : 0) + (hasPrimal ? 1 : 0),
  };
  const max = Math.max(weights.draw, weights.stamina, weights.heal);
  if (max <= 0) return null;
  const winners = Object.entries(weights).filter(([, weight]) => weight === max).map(([type]) => type);
  if (winners.length === 1) return winners[0];

  for (const fallback of ['heal', 'draw', 'stamina']) {
    if (winners.includes(fallback)) return fallback;
  }
  return winners[0];
}

export function getEffectiveCardSymbols(card, state, playerId) {
  let symbols = card?.symbols || [];
  if (!card?.formBonus) return symbols;

  let bonus = [];
  if (JAHEIRA_FORM_BONUS_CARD_IDS.includes(card.id)) {
    bonus = symbolsForJaheiraRemixBonus(getJaheiraRemixBonusType(state, playerId));
  }
  if (bonus.length === 0) {
    const form = state?.players?.[playerId]?.jaheiraForm ?? 'none';
    bonus = card.formBonus[form] || [];
  }

  return bonus.length ? [...symbols, ...bonus] : symbols;
}
