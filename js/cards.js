// cards.js — full card definitions for all 6 heroes

export const SYM = {
  ATTACK:     'attack',
  SHIELD:     'shield',
  HEAL:       'heal',
  DRAW:       'draw',
  PLAY_AGAIN: 'play_again',
  MIGHTY:     'mighty',
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

// --- Symbol builders (internal shorthand) ---

const atk  = (n, tgt = 'opponent')   => ({ type: SYM.ATTACK,     value: n, target: tgt });
const sld  = (n)                      => ({ type: SYM.SHIELD,     value: n, target: 'self' });
const heal = (n)                      => ({ type: SYM.HEAL,       value: n, target: 'self' });
const drw  = (n)                      => ({ type: SYM.DRAW,       value: n, target: 'self' });
const again = ()                      => ({ type: SYM.PLAY_AGAIN, value: 1, target: 'self' });
const mty  = (effect, opts = {})      => ({ type: SYM.MIGHTY, effect, ...opts });

// --- Card definitions ---
// Each card: { id, heroId, name, count, symbols, description }
// target values: 'self' | 'opponent' (choose 1) | 'all_opponents' | 'all' (incl. self)

export const CARDS = {

  // =============================================
  // SUTHA THE SKULLCRUSHER — Barbarian (28 cards)
  // 1+4+3+3+3+4+3+3+2+2 = 28
  // =============================================

  sutha_whirling_axes: {
    id: 'sutha_whirling_axes', heroId: 'sutha', name: 'Whirling Axes', count: 1,
    symbols: [heal(2), atk(1, 'all_opponents')],
    description: 'Heal 2, then deal 1 to all opponents',
  },
  sutha_power_attack: {
    id: 'sutha_power_attack', heroId: 'sutha', name: 'Power Attack', count: 4,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  sutha_wild_swing: {
    id: 'sutha_wild_swing', heroId: 'sutha', name: 'Wild Swing', count: 3,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  sutha_battle_cry: {
    id: 'sutha_battle_cry', heroId: 'sutha', name: 'Battle Cry', count: 3,
    symbols: [atk(1), again()],
    description: 'Deal 1 damage, then play again',
  },
  sutha_tough: {
    id: 'sutha_tough', heroId: 'sutha', name: 'Tough as Nails', count: 3,
    symbols: [sld(2)],
    description: 'Gain a 2-point shield',
  },
  sutha_healing_word: {
    id: 'sutha_healing_word', heroId: 'sutha', name: 'Healing Word', count: 4,
    symbols: [heal(2)],
    description: 'Heal 2 HP',
  },
  sutha_war_cry: {
    id: 'sutha_war_cry', heroId: 'sutha', name: 'War Cry', count: 3,
    symbols: [atk(1), drw(1)],
    description: 'Deal 1 damage, draw 1 card',
  },
  sutha_charge: {
    id: 'sutha_charge', heroId: 'sutha', name: 'Charge', count: 3,
    symbols: [atk(2), again()],
    description: 'Deal 2 damage, then play again',
  },
  sutha_defend: {
    id: 'sutha_defend', heroId: 'sutha', name: 'Stand Firm', count: 2,
    symbols: [sld(3)],
    description: 'Gain a 3-point shield',
  },
  sutha_frenzy: {
    id: 'sutha_frenzy', heroId: 'sutha', name: 'Frenzy', count: 2,
    symbols: [atk(1), heal(1)],
    description: 'Deal 1 damage, heal 1 HP',
  },

  // =============================================
  // AZZAN THE MYSTIC — Wizard (28 cards)
  // 1+2+2+5+3+3+3+3+3+3 = 28
  // =============================================

  azzan_vampiric_touch: {
    id: 'azzan_vampiric_touch', heroId: 'azzan', name: 'Vampiric Touch', count: 1,
    symbols: [mty('swap_hp', { target: 'opponent' })],
    description: 'Swap your HP total with a chosen opponent',
  },
  azzan_charm: {
    id: 'azzan_charm', heroId: 'azzan', name: 'Charm', count: 2,
    symbols: [mty('steal_shield', { target: 'opponent' })],
    description: "Steal one shield card from an opponent",
  },
  azzan_fireball: {
    id: 'azzan_fireball', heroId: 'azzan', name: 'Fireball', count: 2,
    symbols: [atk(3, 'all')],
    description: 'Deal 3 damage to ALL players (including yourself)',
  },
  azzan_magic_missile: {
    id: 'azzan_magic_missile', heroId: 'azzan', name: 'Magic Missile', count: 5,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  azzan_shield: {
    id: 'azzan_shield', heroId: 'azzan', name: 'Arcane Shield', count: 3,
    symbols: [sld(2)],
    description: 'Gain a 2-point shield',
  },
  azzan_arcane_surge: {
    id: 'azzan_arcane_surge', heroId: 'azzan', name: 'Arcane Surge', count: 3,
    symbols: [atk(1), drw(1)],
    description: 'Deal 1 damage, draw 1 card',
  },
  azzan_blink: {
    id: 'azzan_blink', heroId: 'azzan', name: 'Blink', count: 3,
    symbols: [drw(2), again()],
    description: 'Draw 2 cards, then play again',
  },
  azzan_counterspell: {
    id: 'azzan_counterspell', heroId: 'azzan', name: 'Counterspell', count: 3,
    symbols: [sld(3)],
    description: 'Gain a 3-point shield',
  },
  azzan_cantrip: {
    id: 'azzan_cantrip', heroId: 'azzan', name: 'Cantrip', count: 3,
    symbols: [drw(1), atk(1)],
    description: 'Draw 1 card, deal 1 damage to one opponent',
  },
  azzan_minor_illusion: {
    id: 'azzan_minor_illusion', heroId: 'azzan', name: 'Minor Illusion', count: 3,
    symbols: [again(), drw(1)],
    description: 'Play again, then draw 1 card',
  },

  // =============================================
  // LIA THE RADIANT — Paladin (28 cards)
  // 1+4+4+3+3+3+3+3+2+2 = 28
  // =============================================

  lia_divine_strike: {
    id: 'lia_divine_strike', heroId: 'lia', name: 'Divine Strike', count: 1,
    symbols: [atk(3), heal(3)],
    description: 'Deal 3 damage to one opponent, heal 3 HP',
  },
  lia_smite: {
    id: 'lia_smite', heroId: 'lia', name: 'Smite', count: 4,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  lia_holy_light: {
    id: 'lia_holy_light', heroId: 'lia', name: 'Holy Light', count: 4,
    symbols: [heal(2)],
    description: 'Heal 2 HP',
  },
  lia_crusader: {
    id: 'lia_crusader', heroId: 'lia', name: "Crusader's Charge", count: 3,
    symbols: [atk(1), heal(1)],
    description: 'Deal 1 damage, heal 1 HP',
  },
  lia_divine_shield: {
    id: 'lia_divine_shield', heroId: 'lia', name: 'Divine Shield', count: 3,
    symbols: [sld(3)],
    description: 'Gain a 3-point shield',
  },
  lia_lay_on_hands: {
    id: 'lia_lay_on_hands', heroId: 'lia', name: 'Lay on Hands', count: 3,
    symbols: [heal(3)],
    description: 'Heal 3 HP',
  },
  lia_zeal: {
    id: 'lia_zeal', heroId: 'lia', name: 'Zeal', count: 3,
    symbols: [atk(2), again()],
    description: 'Deal 2 damage, then play again',
  },
  lia_aura: {
    id: 'lia_aura', heroId: 'lia', name: 'Aura of Courage', count: 3,
    symbols: [sld(2), heal(1)],
    description: 'Gain a 2-point shield, heal 1 HP',
  },
  lia_righteous: {
    id: 'lia_righteous', heroId: 'lia', name: 'Righteous Fury', count: 2,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  lia_shield_bash: {
    id: 'lia_shield_bash', heroId: 'lia', name: 'Shield Bash', count: 2,
    symbols: [atk(1), sld(1)],
    description: 'Deal 1 damage, gain a 1-point shield',
  },

  // =============================================
  // ORIAX THE CLEVER — Rogue (28 cards)
  // 1+4+3+3+4+3+3+3+2+2 = 28
  // =============================================

  oriax_dagger_storm: {
    id: 'oriax_dagger_storm', heroId: 'oriax', name: 'Dagger Storm', count: 1,
    symbols: [atk(1, 'all_opponents'), drw(2)],
    description: 'Deal 1 damage to all opponents, draw 2 cards',
  },
  oriax_backstab: {
    id: 'oriax_backstab', heroId: 'oriax', name: 'Backstab', count: 4,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  oriax_smoke_bomb: {
    id: 'oriax_smoke_bomb', heroId: 'oriax', name: 'Smoke Bomb', count: 3,
    symbols: [sld(2), again()],
    description: 'Gain a 2-point shield, then play again',
  },
  oriax_steal_card: {
    id: 'oriax_steal_card', heroId: 'oriax', name: 'Nimble Fingers', count: 3,
    symbols: [mty('steal_and_play', { target: 'opponent' })],
    description: "Steal a card from opponent's hand and play it immediately",
  },
  oriax_quick_stab: {
    id: 'oriax_quick_stab', heroId: 'oriax', name: 'Quick Stab', count: 4,
    symbols: [atk(1), again()],
    description: 'Deal 1 damage, then play again',
  },
  oriax_evasion: {
    id: 'oriax_evasion', heroId: 'oriax', name: 'Evasion', count: 3,
    symbols: [sld(3)],
    description: 'Gain a 3-point shield',
  },
  oriax_cunning: {
    id: 'oriax_cunning', heroId: 'oriax', name: 'Cunning Action', count: 3,
    symbols: [drw(2)],
    description: 'Draw 2 cards',
  },
  oriax_poison: {
    id: 'oriax_poison', heroId: 'oriax', name: 'Poison Blade', count: 3,
    symbols: [atk(2), drw(1)],
    description: 'Deal 2 damage, draw 1 card',
  },
  oriax_ambush: {
    id: 'oriax_ambush', heroId: 'oriax', name: 'Ambush', count: 2,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  oriax_vanish: {
    id: 'oriax_vanish', heroId: 'oriax', name: 'Vanish', count: 2,
    symbols: [again(), drw(2)],
    description: 'Play again, then draw 2 cards',
  },

  // =============================================
  // MINSC & BOO — Ranger (28 cards)
  // 1+2+2+4+3+3+3+3+3+2+2 = 28
  // =============================================

  minsc_go_for_eyes: {
    id: 'minsc_go_for_eyes', heroId: 'minsc', name: 'Go for the Eyes, Boo!', count: 1,
    symbols: [atk(3, 'all_opponents')],
    description: 'Deal 3 damage to all opponents',
  },
  minsc_hp_swap: {
    id: 'minsc_hp_swap', heroId: 'minsc', name: 'Life Drain', count: 2,
    symbols: [mty('swap_hp', { target: 'opponent' })],
    description: 'Swap your HP total with a chosen opponent',
  },
  minsc_steal_hand: {
    id: 'minsc_steal_hand', heroId: 'minsc', name: 'Pickpocket', count: 2,
    symbols: [mty('steal_card', { target: 'opponent' })],
    description: "Steal a random card from an opponent's hand into yours",
  },
  minsc_ranger_shot: {
    id: 'minsc_ranger_shot', heroId: 'minsc', name: 'Ranger Shot', count: 4,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  minsc_wild_surge: {
    id: 'minsc_wild_surge', heroId: 'minsc', name: 'Wild Surge', count: 3,
    symbols: [atk(3)],
    description: 'Deal 3 damage to one opponent',
  },
  minsc_natures_grace: {
    id: 'minsc_natures_grace', heroId: 'minsc', name: "Nature's Grace", count: 3,
    symbols: [heal(2)],
    description: 'Heal 2 HP',
  },
  minsc_favored_enemy: {
    id: 'minsc_favored_enemy', heroId: 'minsc', name: 'Favored Enemy', count: 3,
    symbols: [atk(2), drw(1)],
    description: 'Deal 2 damage, draw 1 card',
  },
  minsc_boon: {
    id: 'minsc_boon', heroId: 'minsc', name: "Boo's Blessing", count: 3,
    symbols: [drw(2), again()],
    description: 'Draw 2 cards, then play again',
  },
  minsc_battle_cry: {
    id: 'minsc_battle_cry', heroId: 'minsc', name: 'Battle Cry', count: 3,
    symbols: [atk(1), heal(1), again()],
    description: 'Deal 1 damage, heal 1 HP, then play again',
  },
  minsc_divine_favor: {
    id: 'minsc_divine_favor', heroId: 'minsc', name: 'Divine Favor', count: 2,
    symbols: [sld(2)],
    description: 'Gain a 2-point shield',
  },
  minsc_ambush: {
    id: 'minsc_ambush', heroId: 'minsc', name: 'Ambush Shot', count: 2,
    symbols: [atk(2), again()],
    description: 'Deal 2 damage, then play again',
  },

  // =============================================
  // JAHEIRA — Druid (28 cards)
  // 1+1+2+2+3+3+4+4+3+3+2 = 28
  // =============================================

  jaheira_bear_form: {
    id: 'jaheira_bear_form', heroId: 'jaheira', name: 'Bear Form', count: 1,
    symbols: [mty('set_form', { value: 'bear', target: 'self' })],
    description: 'Transform into Bear Form — your Mighty Power becomes defensive',
  },
  jaheira_wolf_form: {
    id: 'jaheira_wolf_form', heroId: 'jaheira', name: 'Wolf Form', count: 1,
    symbols: [mty('set_form', { value: 'wolf', target: 'self' })],
    description: 'Transform into Wolf Form — your Mighty Power becomes aggressive',
  },
  jaheira_mighty_bear: {
    id: 'jaheira_mighty_bear', heroId: 'jaheira', name: 'Rend and Tear', count: 2,
    requiresForm: 'bear',
    symbols: [sld(3), heal(2), mty('destroy_shields', { target: 'all_opponents' })],
    description: 'Gain 3-shield + 2 heal, destroy all opponent shields (Bear Form)',
  },
  jaheira_mighty_wolf: {
    id: 'jaheira_mighty_wolf', heroId: 'jaheira', name: 'Pack Tactics', count: 2,
    requiresForm: 'wolf',
    symbols: [atk(2, 'all_opponents')],
    description: 'Deal 2 damage to all opponents (Wolf Form)',
  },
  jaheira_entangle: {
    id: 'jaheira_entangle', heroId: 'jaheira', name: 'Entangle', count: 3,
    symbols: [sld(2), atk(1)],
    description: 'Gain a 2-point shield, deal 1 damage to one opponent',
  },
  jaheira_thorns: {
    id: 'jaheira_thorns', heroId: 'jaheira', name: 'Thorns', count: 3,
    symbols: [sld(2), atk(1)],
    description: 'Gain a 2-point shield, deal 1 damage to one opponent',
  },
  jaheira_wild_growth: {
    id: 'jaheira_wild_growth', heroId: 'jaheira', name: 'Wild Growth', count: 4,
    symbols: [heal(2)],
    description: 'Heal 2 HP',
  },
  jaheira_shillelagh: {
    id: 'jaheira_shillelagh', heroId: 'jaheira', name: 'Shillelagh', count: 4,
    symbols: [atk(2)],
    description: 'Deal 2 damage to one opponent',
  },
  jaheira_barkskin: {
    id: 'jaheira_barkskin', heroId: 'jaheira', name: 'Barkskin', count: 3,
    symbols: [sld(3)],
    description: 'Gain a 3-point shield',
  },
  jaheira_natures_wrath: {
    id: 'jaheira_natures_wrath', heroId: 'jaheira', name: "Nature's Wrath", count: 3,
    symbols: [atk(1), drw(1)],
    description: 'Deal 1 damage, draw 1 card',
  },
  jaheira_druid_call: {
    id: 'jaheira_druid_call', heroId: 'jaheira', name: 'Druid Call', count: 2,
    symbols: [drw(2), heal(1)],
    description: 'Draw 2 cards, heal 1 HP',
  },
};

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
      case SYM.ATTACK:     return s.target === 'all'           ? `💥${'⚔️'.repeat(s.value)}`
                               : s.target === 'all_opponents'  ? `🌪️${'⚔️'.repeat(s.value)}`
                                                                : '⚔️'.repeat(s.value);
      case SYM.SHIELD:     return '🛡️'.repeat(s.value);
      case SYM.HEAL:       return '❤️'.repeat(s.value);
      case SYM.DRAW:       return '🃏'.repeat(s.value);
      case SYM.PLAY_AGAIN: return '⚡';
      case SYM.MIGHTY:     return '✨';
      default:             return '';
    }
  }).join(' ');
}

export function cardNeedsTarget(card) {
  if (!card?.symbols) return false;
  return card.symbols.some(s => s.target === 'opponent');
}
