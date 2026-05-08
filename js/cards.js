// cards.js — full card definitions for all 6 heroes (real Dungeon Mayhem card names)

export const SYM = {
  ATTACK:     'attack',
  SHIELD:     'shield',
  HEAL:       'heal',
  DRAW:       'draw',
  PLAY_AGAIN: 'play_again',
  MIGHTY:     'mighty',
  RECLAIM:    'reclaim',
};

export const HERO_IDS = ['sutha', 'azzan', 'lia', 'oriax', 'minsc', 'jaheira'];

export const HEROES = {
  sutha:   { id: 'sutha',   name: 'Sutha the Skullcrusher', class: 'Barbarian', color: '#c0392b', emoji: '🪓' },
  azzan:   { id: 'azzan',   name: 'Azzan the Mystic',       class: 'Wizard',    color: '#8e44ad', emoji: '🔮' },
  lia:     { id: 'lia',     name: 'Lia the Radiant',         class: 'Paladin',   color: '#f39c12', emoji: '⚔️' },
  oriax:   { id: 'oriax',   name: 'Oriax the Clever',        class: 'Rogue',     color: '#27ae60', emoji: '🗡️' },
  minsc:   { id: 'minsc',   name: 'Minsc & Boo',             class: 'Ranger',    color: '#2980b9', emoji: '🐹' },
  jaheira: { id: 'jaheira', name: 'Jaheira',                  class: 'Druid',     color: '#16a085', emoji: '🌿' },
};

// --- Symbol builders ---
const atk  = (n, tgt = 'opponent')  => ({ type: SYM.ATTACK,     value: n, target: tgt });
const sld  = (n)                     => ({ type: SYM.SHIELD,     value: n, target: 'self' });
const heal = (n)                     => ({ type: SYM.HEAL,       value: n, target: 'self' });
const drw  = (n)                     => ({ type: SYM.DRAW,       value: n, target: 'self' });
const again = ()                     => ({ type: SYM.PLAY_AGAIN, value: 1, target: 'self' });
const mty  = (effect, opts = {})     => ({ type: SYM.MIGHTY, effect, ...opts });
const drm  = ()                      => ({ type: SYM.RECLAIM,    value: 1, target: 'self' });

export const CARDS = {

  // =============================================
  // AZZAN THE MYSTIC — Wizard (28 cards)
  // 4+3+1+3+3+2+2+3+1+2+2+2 = 28
  // =============================================

  azzan_lightning_bolt: {
    id: 'azzan_lightning_bolt', heroId: 'azzan', name: 'Lightning Bolt', count: 4,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  azzan_knowledge: {
    id: 'azzan_knowledge', heroId: 'azzan', name: 'Knowledge is Power', count: 3,
    symbols: [drw(3)],
    description: 'Draw 3 cards',
  },
  azzan_stoneskin: {
    id: 'azzan_stoneskin', heroId: 'azzan', name: 'Stoneskin', count: 1,
    symbols: [sld(3)],
    description: 'Gain 3 shields',
  },
  azzan_burning_hands: {
    id: 'azzan_burning_hands', heroId: 'azzan', name: 'Burning Hands', count: 3,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  azzan_magic_missile: {
    id: 'azzan_magic_missile', heroId: 'azzan', name: 'Magic Missile', count: 3,
    symbols: [atk(1), again()],
    description: 'Deal 1 damage and play again',
  },
  azzan_evil_sneer: {
    id: 'azzan_evil_sneer', heroId: 'azzan', name: 'Evil Sneer', count: 2,
    symbols: [heal(1), again()],
    description: 'Heal 1 HP and play again',
  },
  azzan_vampiric_touch: {
    id: 'azzan_vampiric_touch', heroId: 'azzan', name: 'Vampiric Touch', count: 2,
    symbols: [mty('swap_hp', { target: 'opponent' })],
    description: 'Swap your HP total with a chosen opponent',
  },
  azzan_speed_of_thought: {
    id: 'azzan_speed_of_thought', heroId: 'azzan', name: 'Speed of Thought', count: 3,
    symbols: [again(), again()],
    description: 'Play again twice (2 Stamina)',
  },
  azzan_mirror_image: {
    id: 'azzan_mirror_image', heroId: 'azzan', name: 'Mirror Image', count: 1,
    symbols: [sld(3)],
    description: 'Gain 3 shields',
  },
  azzan_fireball: {
    id: 'azzan_fireball', heroId: 'azzan', name: 'Fireball', count: 2,
    symbols: [atk(3, 'all')],
    description: 'Deal 3 damage to ALL players — including yourself',
  },
  azzan_charm: {
    id: 'azzan_charm', heroId: 'azzan', name: 'Charm', count: 2,
    symbols: [mty('steal_shield', { target: 'opponent' })],
    description: "Steal an opponent's shields — they now protect you",
  },
  azzan_shield: {
    id: 'azzan_shield', heroId: 'azzan', name: 'Shield', count: 2,
    symbols: [sld(1), drw(1)],
    description: 'Gain 1 shield and draw 1 card',
  },

  // =============================================
  // LIA THE RADIANT — Paladin (28 cards)
  // 3+2+1+2+1+3+4+3+2+2+2+2+1 = 28
  // =============================================

  lia_fighting_words: {
    id: 'lia_fighting_words', heroId: 'lia', name: 'Fighting Words', count: 3,
    symbols: [atk(2), heal(1)],
    description: 'Deal 2 damage and heal 1 HP',
  },
  lia_divine_shield: {
    id: 'lia_divine_shield', heroId: 'lia', name: 'Divine Shield', count: 2,
    symbols: [sld(3)],
    description: 'Gain 3 shields',
  },
  lia_fluffy: {
    id: 'lia_fluffy', heroId: 'lia', name: 'Fluffy', count: 1,
    symbols: [sld(2)],
    description: 'Fluffy protects you: gain 2 shields',
  },
  lia_spinning_parry: {
    id: 'lia_spinning_parry', heroId: 'lia', name: 'Spinning Parry', count: 2,
    symbols: [sld(1), drw(1)],
    description: 'Gain 1 shield and draw 1 card',
  },
  lia_cure_wounds: {
    id: 'lia_cure_wounds', heroId: 'lia', name: 'Cure Wounds', count: 1,
    symbols: [drw(2), heal(1)],
    description: 'Draw 2 cards and heal 1 HP',
  },
  lia_divine_smite: {
    id: 'lia_divine_smite', heroId: 'lia', name: 'Divine Smite', count: 3,
    symbols: [atk(3), heal(1)],
    description: 'Deal 3 damage and heal 1 HP',
  },
  lia_for_even_more_justice: {
    id: 'lia_for_even_more_justice', heroId: 'lia', name: 'For Even More Justice!', count: 4,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  lia_for_justice: {
    id: 'lia_for_justice', heroId: 'lia', name: 'For Justice!', count: 3,
    symbols: [atk(1), again()],
    description: 'Deal 1 damage and play again',
  },
  lia_divine_inspiration: {
    id: 'lia_divine_inspiration', heroId: 'lia', name: 'Divine Inspiration', count: 2,
    symbols: [drm(), heal(2)],
    description: 'Reclaim a card from your discard pile and heal 2 HP',
  },
  lia_for_most_justice: {
    id: 'lia_for_most_justice', heroId: 'lia', name: 'For the Most Justice!', count: 2,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  lia_high_charisma: {
    id: 'lia_high_charisma', heroId: 'lia', name: 'High Charisma', count: 2,
    symbols: [drw(2)],
    description: 'Draw 2 cards',
  },
  lia_finger_wag: {
    id: 'lia_finger_wag', heroId: 'lia', name: 'Finger-wag of Judgment', count: 2,
    symbols: [again(), again()],
    description: 'Play again twice (2 Stamina)',
  },
  lia_banishing_smite: {
    id: 'lia_banishing_smite', heroId: 'lia', name: 'Banishing Smite', count: 1,
    symbols: [mty('destroy_shields', { target: 'all' }), again()],
    description: 'Destroy ALL shields (including your own) and play again',
  },

  // =============================================
  // ORIAX THE CLEVER — Rogue (28 cards)
  // 2+1+2+4+5+2+2+1+2+2+3+2 = 28
  // =============================================

  oriax_winged_serpent: {
    id: 'oriax_winged_serpent', heroId: 'oriax', name: 'Winged Serpent', count: 2,
    symbols: [sld(1), drw(1)],
    description: 'Gain 1 shield and draw 1 card',
  },
  oriax_my_little_friend: {
    id: 'oriax_my_little_friend', heroId: 'oriax', name: 'My Little Friend', count: 1,
    symbols: [sld(3)],
    description: 'My Little Friend protects you: gain 3 shields',
  },
  oriax_clever_disguise: {
    id: 'oriax_clever_disguise', heroId: 'oriax', name: 'Clever Disguise', count: 2,
    symbols: [mty('set_immune')],
    description: 'You cannot be targeted by any cards until the start of your next turn',
  },
  oriax_two_daggers: {
    id: 'oriax_two_daggers', heroId: 'oriax', name: 'Two Thrown Daggers', count: 4,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  oriax_one_dagger: {
    id: 'oriax_one_dagger', heroId: 'oriax', name: 'One Thrown Dagger', count: 5,
    symbols: [atk(1), again()],
    description: 'Deal 1 damage and play again',
  },
  oriax_goon_squad: {
    id: 'oriax_goon_squad', heroId: 'oriax', name: 'The Goon Squad', count: 2,
    symbols: [sld(2)],
    description: 'The goons protect you: gain 2 shields',
  },
  oriax_sneak_attack: {
    id: 'oriax_sneak_attack', heroId: 'oriax', name: 'Sneak Attack!', count: 2,
    symbols: [mty('destroy_one_shield', { target: 'opponent' }), again()],
    description: 'Destroy all shields of one chosen opponent and play again',
  },
  oriax_even_more_daggers: {
    id: 'oriax_even_more_daggers', heroId: 'oriax', name: 'Even More Daggers', count: 1,
    symbols: [drw(2), heal(1)],
    description: 'Draw 2 cards and heal 1 HP',
  },
  oriax_stolen_potion: {
    id: 'oriax_stolen_potion', heroId: 'oriax', name: 'Stolen Potion', count: 2,
    symbols: [heal(1), again()],
    description: 'Heal 1 HP and play again',
  },
  oriax_cunning_action: {
    id: 'oriax_cunning_action', heroId: 'oriax', name: 'Cunning Action', count: 2,
    symbols: [again(), again()],
    description: 'Play again twice (2 Stamina)',
  },
  oriax_all_daggers: {
    id: 'oriax_all_daggers', heroId: 'oriax', name: 'All the Thrown Daggers', count: 3,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  oriax_pick_pocket: {
    id: 'oriax_pick_pocket', heroId: 'oriax', name: 'Pick Pocket', count: 2,
    symbols: [mty('pickpocket', { target: 'opponent' })],
    description: "Steal the top card of an opponent's deck into your hand",
  },

  // =============================================
  // SUTHA THE SKULLCRUSHER — Barbarian (28 cards)
  // 2+2+2+2+1+2+2+1+1+1+1+2+5+2+2 = 28
  // =============================================

  sutha_mighty_toss: {
    id: 'sutha_mighty_toss', heroId: 'sutha', name: 'Mighty Toss', count: 2,
    symbols: [mty('destroy_one_shield', { target: 'opponent' }), drw(1)],
    description: 'Destroy all shields of one chosen opponent and draw 1 card',
  },
  sutha_battle_roar: {
    id: 'sutha_battle_roar', heroId: 'sutha', name: 'Battle Roar', count: 2,
    symbols: [mty('battle_roar'), again()],
    description: 'Everyone discards hand and draws 3 cards, then play again',
  },
  sutha_whirling_axes: {
    id: 'sutha_whirling_axes', heroId: 'sutha', name: 'Whirling Axes', count: 2,
    symbols: [mty('whirling_axes')],
    description: 'Heal 1 HP per alive opponent, then deal 1 damage to each opponent',
  },
  sutha_flex: {
    id: 'sutha_flex', heroId: 'sutha', name: 'Flex', count: 2,
    symbols: [heal(1), drw(1)],
    description: 'Heal 1 HP and draw 1 card',
  },
  sutha_snack_time: {
    id: 'sutha_snack_time', heroId: 'sutha', name: 'Snack Time', count: 1,
    symbols: [drw(2), heal(1)],
    description: 'Draw 2 cards and heal 1 HP',
  },
  sutha_open_armory: {
    id: 'sutha_open_armory', heroId: 'sutha', name: 'Open the Armory', count: 2,
    symbols: [drw(2)],
    description: 'Draw 2 cards',
  },
  sutha_two_axes: {
    id: 'sutha_two_axes', heroId: 'sutha', name: 'Two Axes are Better Than One', count: 2,
    symbols: [again(), again()],
    description: 'Play again twice (2 Stamina)',
  },
  sutha_raff: {
    id: 'sutha_raff', heroId: 'sutha', name: 'Raff', count: 1,
    symbols: [sld(3)],
    description: 'Raff defends you: gain 3 shields',
  },
  sutha_riff: {
    id: 'sutha_riff', heroId: 'sutha', name: 'Riff', count: 1,
    symbols: [sld(3)],
    description: 'Riff defends you: gain 3 shields',
  },
  sutha_spiked_shield: {
    id: 'sutha_spiked_shield', heroId: 'sutha', name: 'Spiked Shield', count: 1,
    symbols: [sld(2)],
    description: 'Gain 2 shields',
  },
  sutha_bag_of_rats: {
    id: 'sutha_bag_of_rats', heroId: 'sutha', name: 'Bag of Rats', count: 1,
    symbols: [sld(1), drw(1)],
    description: 'Gain 1 shield and draw 1 card',
  },
  sutha_rage: {
    id: 'sutha_rage', heroId: 'sutha', name: 'Rage!', count: 2,
    symbols: [atk(4)],
    description: 'Deal 4 damage to one opponent',
  },
  sutha_big_axe: {
    id: 'sutha_big_axe', heroId: 'sutha', name: 'Big Axe is Best Axe', count: 5,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  sutha_brutal_punch: {
    id: 'sutha_brutal_punch', heroId: 'sutha', name: 'Brutal Punch', count: 2,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  sutha_head_butt: {
    id: 'sutha_head_butt', heroId: 'sutha', name: 'Head Butt', count: 2,
    symbols: [atk(1), again()],
    description: 'Deal 1 damage and play again',
  },

  // =============================================
  // JAHEIRA — Druid Shapeshifter (28 cards)
  // 2+2+3+3+2+2+1+2+2+2+2+3+2 = 28
  // =============================================

  jaheira_gift_silvanus: {
    id: 'jaheira_gift_silvanus', heroId: 'jaheira', name: 'Gift of Silvanus', count: 2,
    symbols: [atk(2)],
    formBonus: { bear: [heal(1)], wolf: [atk(1)] },
    description: 'Deal 2 damage. Bear Form: also heal 1. Wolf Form: also deal 1 more damage.',
  },
  jaheira_druidic_balance: {
    id: 'jaheira_druidic_balance', heroId: 'jaheira', name: 'Druidic Balance', count: 2,
    symbols: [heal(1), drw(1), atk(1)],
    description: 'Heal 1 HP, draw 1 card, and deal 1 damage',
  },
  jaheira_call_lightning: {
    id: 'jaheira_call_lightning', heroId: 'jaheira', name: 'Call Lightning', count: 3,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  jaheira_thorn_whip: {
    id: 'jaheira_thorn_whip', heroId: 'jaheira', name: 'Thorn Whip', count: 3,
    symbols: [atk(1), again()],
    description: 'Deal 1 damage and play again',
  },
  jaheira_quick_fox: {
    id: 'jaheira_quick_fox', heroId: 'jaheira', name: 'Quick as a Fox', count: 2,
    symbols: [again(), again()],
    description: 'Play again twice (2 Stamina)',
  },
  jaheira_wild_rush: {
    id: 'jaheira_wild_rush', heroId: 'jaheira', name: 'Wild Rush', count: 2,
    symbols: [atk(2)],
    formBonus: { bear: [heal(1)], wolf: [atk(1)] },
    description: 'Deal 2 damage. Bear Form: also heal 1. Wolf Form: also deal 1 more damage.',
  },
  jaheira_eldest_elk: {
    id: 'jaheira_eldest_elk', heroId: 'jaheira', name: 'The Eldest Elk', count: 1,
    symbols: [sld(3)],
    description: 'The ancient elk protects you: gain 3 shields',
  },
  jaheira_poochie: {
    id: 'jaheira_poochie', heroId: 'jaheira', name: 'Poochie', count: 2,
    symbols: [sld(1), atk(1)],
    description: 'Gain 1 shield and deal 1 damage',
  },
  jaheira_bearnard: {
    id: 'jaheira_bearnard', heroId: 'jaheira', name: 'Bearnard', count: 2,
    symbols: [sld(2)],
    formBonus: { bear: [heal(1)], wolf: [atk(1)] },
    description: 'Gain 2 shields. Bear Form: also heal 1. Wolf Form: also deal 1 damage.',
  },
  jaheira_primal_strike: {
    id: 'jaheira_primal_strike', heroId: 'jaheira', name: 'Primal Strike', count: 2,
    symbols: [atk(1, 'all_opponents'), again()],
    description: 'Make an animal sound, deal 1 damage to each opponent, and play again',
  },
  jaheira_commune: {
    id: 'jaheira_commune', heroId: 'jaheira', name: 'Commune with Nature', count: 2,
    symbols: [mty('commune_with_nature')],
    description: 'Draw 2 cards. If a form card is in hand after drawing, play it for free.',
  },
  jaheira_wolf_form: {
    id: 'jaheira_wolf_form', heroId: 'jaheira', name: 'Shapeshift: Wolf Form', count: 3,
    symbols: [atk(2), mty('set_form', { value: 'wolf', target: 'self' })],
    description: 'Deal 2 damage to one opponent and transform into Wolf Form',
  },
  jaheira_bear_form: {
    id: 'jaheira_bear_form', heroId: 'jaheira', name: 'Shapeshift: Bear Form', count: 2,
    symbols: [heal(2), mty('set_form', { value: 'bear', target: 'self' })],
    description: 'Heal 2 HP and transform into Bear Form',
  },

  // =============================================
  // MINSC & BOO — Ranger (28 cards)
  // 2+3+2+3+2+3+1+2+1+2+2+2+1+2 = 28
  // =============================================

  minsc_boo_what: {
    id: 'minsc_boo_what', heroId: 'minsc', name: 'Boo What Do We Do?', count: 2,
    symbols: [drw(2)],
    description: 'Ask Boo: draw 2 cards',
  },
  minsc_twice_smiting: {
    id: 'minsc_twice_smiting', heroId: 'minsc', name: 'Twice the Smiting!', count: 3,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  minsc_swapportunity: {
    id: 'minsc_swapportunity', heroId: 'minsc', name: 'Swapportunity', count: 2,
    symbols: [mty('swapportunity_all')],
    description: 'Each player receives the HP of the previous player in turn order (circular)',
  },
  minsc_squeaky_wheel: {
    id: 'minsc_squeaky_wheel', heroId: 'minsc', name: 'Squeaky Wheel Gets the Kick', count: 3,
    symbols: [atk(1), again()],
    description: 'Deal 1 damage and play again',
  },
  minsc_favored_frienemies: {
    id: 'minsc_favored_frienemies', heroId: 'minsc', name: 'Favored Frienemies', count: 2,
    symbols: [mty('favored_frienemies')],
    description: '+1 damage to all attack cards this turn and play again',
  },
  minsc_go_for_eyes: {
    id: 'minsc_go_for_eyes', heroId: 'minsc', name: 'Go for the Eyes Boo!!!', count: 3,
    symbols: [atk(3)],
    description: 'Boo attacks: deal 3 damage to one opponent',
  },
  minsc_krydle: {
    id: 'minsc_krydle', heroId: 'minsc', name: 'Krydle and Shandie', count: 1,
    symbols: [sld(3)],
    description: 'Companions provide cover: gain 3 shields',
  },
  minsc_mighty_mount: {
    id: 'minsc_mighty_mount', heroId: 'minsc', name: "Minsc's Mighty Mount", count: 2,
    symbols: [sld(2)],
    description: 'Riding high: gain 2 shields',
  },
  minsc_wrap_it_up: {
    id: 'minsc_wrap_it_up', heroId: 'minsc', name: 'Wrap It Up', count: 1,
    symbols: [heal(1), drw(1)],
    description: 'Heal 1 HP and draw 1 card',
  },
  minsc_justice: {
    id: 'minsc_justice', heroId: 'minsc', name: 'Justice Waits for No One', count: 2,
    symbols: [again(), again()],
    description: 'Play again twice (2 Stamina)',
  },
  minsc_scouting: {
    id: 'minsc_scouting', heroId: 'minsc', name: 'Scouting Outing', count: 2,
    symbols: [mty('scouting_outing')],
    description: "Steal the top card from each opponent's deck into your hand",
  },
  minsc_nerys: {
    id: 'minsc_nerys', heroId: 'minsc', name: 'Pale Priestess Nerys', count: 2,
    symbols: [sld(1), heal(1)],
    description: 'Nerys aids you: gain 1 shield and heal 1 HP',
  },
  minsc_time_to_punch: {
    id: 'minsc_time_to_punch', heroId: 'minsc', name: 'Time to Punch Evil!', count: 1,
    symbols: [atk(2), again()],
    description: 'Deal 2 damage to one opponent and play again',
  },
  minsc_hold_rodent: {
    id: 'minsc_hold_rodent', heroId: 'minsc', name: 'Someone Hold My Rodent', count: 2,
    symbols: [atk(2), heal(1)],
    description: 'Deal 2 damage and heal 1 HP',
  },
};

// --- Remix helpers ---

// Jaheira's form cards + commune must travel as a unit
export const JAHEIRA_TRIO = ['jaheira_wolf_form', 'jaheira_bear_form', 'jaheira_commune'];

export function buildRemixDecks(players) {
  const playerIds = Object.keys(players);
  const MAX_SLOTS = 3;

  const allMightyIds = Object.values(CARDS)
    .filter(c => c.symbols.some(s => s.type === SYM.MIGHTY))
    .map(c => c.id);

  const jaheiraTrio  = JAHEIRA_TRIO;
  const banishSmite  = 'lia_banishing_smite';
  const singles      = allMightyIds.filter(id => !jaheiraTrio.includes(id) && id !== banishSmite);

  // Banishing Smite takes 2 slots (leaves room for only 1 other mighty — enforces the rule)
  const dealItems = shuffle([
    { ids: jaheiraTrio, slots: 3 },
    { ids: [banishSmite], slots: 2 },
    ...singles.map(id => ({ ids: [id], slots: 1 })),
  ]);

  const assignments = {};
  const slotsUsed  = {};
  for (const pid of playerIds) { assignments[pid] = []; slotsUsed[pid] = 0; }

  const pids   = shuffle([...playerIds]);
  let cursor   = 0;

  for (const item of dealItems) {
    for (let i = 0; i < pids.length; i++) {
      const pid = pids[(cursor + i) % pids.length];
      if (slotsUsed[pid] + item.slots <= MAX_SLOTS) {
        assignments[pid].push(...item.ids);
        slotsUsed[pid] += item.slots;
        cursor = (cursor + i + 1) % pids.length;
        break;
      }
    }
    // No player can fit this item — it's excluded this game
  }

  const result = {};
  for (const pid of playerIds) {
    const hero        = players[pid].heroId;
    const assignedSet = new Set(assignments[pid]);
    const deck        = [];

    for (const card of Object.values(CARDS)) {
      const isMighty = card.symbols.some(s => s.type === SYM.MIGHTY);
      if (isMighty) {
        if (assignedSet.has(card.id)) {
          for (let i = 0; i < card.count; i++) deck.push(card.id);
        }
      } else {
        if (card.heroId === hero) {
          for (let i = 0; i < card.count; i++) deck.push(card.id);
        }
      }
    }

    result[pid] = shuffle(deck);
  }

  return result;
}

// --- Helpers ---

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDeck(heroId) {
  const deck = [];
  for (const card of Object.values(CARDS)) {
    if (card.heroId === heroId) {
      for (let i = 0; i < card.count; i++) deck.push(card.id);
    }
  }
  return shuffle(deck);
}

export function symbolsToIcons(symbols) {
  if (!symbols) return '';
  return symbols.map(s => {
    switch (s.type) {
      case SYM.ATTACK:
        if (s.target === 'all')           return `💥${'⚔️'.repeat(s.value)}`;
        if (s.target === 'all_opponents') return `🌪️${'⚔️'.repeat(s.value)}`;
        return '⚔️'.repeat(s.value);
      case SYM.SHIELD:     return '🛡️'.repeat(s.value);
      case SYM.HEAL:       return '❤️'.repeat(s.value);
      case SYM.DRAW:       return '🃏'.repeat(s.value);
      case SYM.PLAY_AGAIN: return '⚡';
      case SYM.MIGHTY:     return '✨';
      case SYM.RECLAIM:    return '📜';
      default:             return '';
    }
  }).join(' ');
}

export function cardNeedsTarget(card) {
  if (!card) return false;
  const syms = card.symbols || [];
  if (syms.some(s => s.target === 'opponent')) return true;
  if (syms.some(s => s.type === SYM.MIGHTY && s.target === 'opponent')) return true;
  return false;
}
