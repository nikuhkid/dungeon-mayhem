// @ts-nocheck
import { CARDS, SYM } from '../data/cards';

let initialized = false;
const seenActions = new Set();

function actionKey(action) {
  if (!action) return null;
  return [
    action.timestamp ?? '',
    action.description ?? '',
    action.playerId ?? '',
    action.cardId ?? '',
    action.targetId ?? '',
  ].join('|');
}

function cssId(value) {
  return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

function cardSlug(name) {
  return name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function cardImg(cardId) {
  const card = CARDS[cardId];
  if (!card) return '';
  return `assets/cards/${cardSlug(card.name)}.png`;
}

function addFxClass(el, className, duration = 850) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  window.setTimeout(() => el.classList.remove(className), duration);
}

function playerPanel(playerId, localPlayerId) {
  if (!playerId) return null;
  if (playerId === localPlayerId) return document.getElementById('self-panel');
  return document.querySelector(`.opponent-panel[data-pid="${cssId(playerId)}"]`);
}

function playedCardEl(playerId, cardId) {
  const cards = document.querySelectorAll(
    `.table-card[data-pid="${cssId(playerId)}"][data-cid="${cssId(cardId)}"]`
  );
  return cards[cards.length - 1] ?? null;
}

function floatingText(anchor, text, className) {
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `fx-float ${className}`;
  el.textContent = text;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}

function showMightyScene(card, variant = 'generic', html = '', duration = 1350) {
  const existing = document.querySelector('.fx-mighty-overlay');
  existing?.remove();

  const overlay = document.createElement('div');
  overlay.className = `fx-mighty-overlay fx-mighty-${variant}`;
  overlay.innerHTML = `
    <div class="fx-power-scene fx-${variant}">
      <div class="fx-power-art">${html}</div>
      <div class="fx-power-title">MIGHTY POWER</div>
      <div class="fx-power-name">${card.name}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  window.setTimeout(() => overlay.remove(), duration);
}

function shieldHtml(count = 1) {
  return Array.from({ length: count }, (_, i) => `
    <div class="fx-symbol-shield s${i + 1}">
      <span class="crack c1"></span>
      <span class="crack c2"></span>
      <span class="crack c3"></span>
    </div>
  `).join('');
}

function showPickpocketFx(actor, target, card) {
  addFxClass(actor, 'fx-rogue-quick', 900);
  addFxClass(target, 'fx-pickpocket-target', 900);
  showMightyScene(card, 'pickpocket-scene', `
    <div class="fx-pocket"></div>
    <div class="fx-pocket-card"></div>
    <div class="fx-rogue-hand"></div>
  `);
}

function showSmokeDisguiseFx(actor, card) {
  addFxClass(actor, 'fx-vanish-panel', 1000);
  showMightyScene(card, 'smoke-bomb', `
    <span class="fx-smoke-puff p1"></span>
    <span class="fx-smoke-puff p2"></span>
    <span class="fx-smoke-puff p3"></span>
    <span class="fx-smoke-puff p4"></span>
    <span class="fx-smoke-puff p5"></span>
    <span class="fx-smoke-puff p6"></span>
  `);
}

function showShieldBreakFx(target, card) {
  addFxClass(target, 'fx-shield-break-panel', 900);
  showMightyScene(card, 'shield-break-scene', `
    <div class="fx-club"></div>
    ${shieldHtml(1)}
  `);
}

function showFireballFx(card) {
  showMightyScene(card, 'fireball', `
    <div class="fx-fireball-core"></div>
    <div class="fx-fireball-trail t1"></div>
    <div class="fx-fireball-trail t2"></div>
    <div class="fx-explosion-ring r1"></div>
    <div class="fx-explosion-ring r2"></div>
  `);
}

function showVampiricFx(card) {
  showMightyScene(card, 'vampiric', `
    <div class="fx-bat"><span></span></div>
    <div class="fx-blood-stream b1"></div>
    <div class="fx-blood-stream b2"></div>
    <div class="fx-dark-pulse"></div>
  `);
}

function showCharmFx(card) {
  showMightyScene(card, 'charm', `
    ${shieldHtml(1)}
    <div class="fx-charm-spiral"></div>
    <div class="fx-charm-spark c1"></div>
    <div class="fx-charm-spark c2"></div>
    <div class="fx-charm-spark c3"></div>
  `);
}

function showDivineInspirationFx(card) {
  showMightyScene(card, 'divine-inspiration', `
    <div class="fx-divine-card"></div>
    <div class="fx-divine-beam"></div>
    <div class="fx-divine-rays"></div>
  `);
}

function showBanishingSmiteFx(card) {
  showMightyScene(card, 'banishing-smite', `
    <div class="fx-light-wave"></div>
    ${shieldHtml(3)}
  `);
}

function showMightyTossFx(card) {
  showMightyScene(card, 'mighty-toss', `
    <div class="fx-boulder"></div>
    ${shieldHtml(1)}
    <div class="fx-impact-burst"></div>
  `);
}

function showBattleRoarFx(card) {
  showMightyScene(card, 'battle-roar', `
    <div class="fx-roar-mouth"></div>
    <div class="fx-roar-cone"></div>
    <div class="fx-roar-line l1"></div>
    <div class="fx-roar-line l2"></div>
    <div class="fx-roar-line l3"></div>
    <div class="fx-roar-line l4"></div>
  `);
}

function showWhirlingAxesFx(card) {
  showMightyScene(card, 'whirling-axes', `
    <div class="fx-axe a1"></div>
    <div class="fx-axe a2"></div>
    <div class="fx-axe-ring"></div>
  `);
}

function showCommuneFx(card) {
  showMightyScene(card, 'commune', `
    <div class="fx-leaf l1"></div>
    <div class="fx-leaf l2"></div>
    <div class="fx-leaf l3"></div>
    <div class="fx-sprout"><span></span></div>
    <div class="fx-tree"></div>
  `);
}

function showWolfFormFx(card) {
  showMightyScene(card, 'wolf-form', `
    <div class="fx-moon"></div>
    <div class="fx-wolf"></div>
    <div class="fx-howl-ring"></div>
  `);
}

function showBearFormFx(card) {
  showMightyScene(card, 'bear-form', `
    <div class="fx-bear"></div>
    <div class="fx-paw"></div>
    <div class="fx-ground-crack"></div>
  `);
}

function showPrimalStrikeFx(card) {
  showMightyScene(card, 'primal-strike', `
    <div class="fx-claw c1"></div>
    <div class="fx-claw c2"></div>
    <div class="fx-claw c3"></div>
    <div class="fx-nature-burst"></div>
  `);
}

function showSwapportunityFx(card) {
  showMightyScene(card, 'swapportunity', `
    <div class="fx-swap-orbit"></div>
    <div class="fx-swap-arrow a1"></div>
    <div class="fx-swap-arrow a2"></div>
    <div class="fx-hp-token left">HP</div>
    <div class="fx-hp-token right">HP</div>
  `);
}

function showFavoredFrienemiesFx(card) {
  showMightyScene(card, 'favored-frienemies', `
    <div class="fx-target-mark m1"></div>
    <div class="fx-target-mark m2"></div>
    <div class="fx-target-mark m3"></div>
    <div class="fx-bonus-spark"></div>
  `);
}

function showScoutingFx(card) {
  showMightyScene(card, 'scouting', `
    <div class="fx-spyglass"></div>
    <div class="fx-scan-eye"></div>
    <div class="fx-scan-line"></div>
    <div class="fx-scout-card c1"></div>
    <div class="fx-scout-card c2"></div>
  `);
}

function showMightyCardFx(action, card, localPlayerId) {
  const actor = playerPanel(action.playerId, localPlayerId);
  const target = playerPanel(action.targetId, localPlayerId);

  switch (card.id) {
    case 'azzan_fireball':
      showFireballFx(card);
      return true;
    case 'azzan_vampiric_touch':
      showVampiricFx(card);
      return true;
    case 'azzan_charm':
      showCharmFx(card);
      return true;
    case 'lia_divine_inspiration':
      showDivineInspirationFx(card);
      return true;
    case 'lia_banishing_smite':
      showBanishingSmiteFx(card);
      return true;
    case 'oriax_pick_pocket':
      showPickpocketFx(actor, target, card);
      return true;
    case 'oriax_clever_disguise':
      showSmokeDisguiseFx(actor, card);
      return true;
    case 'oriax_sneak_attack':
      showShieldBreakFx(target, card);
      return true;
    case 'sutha_mighty_toss':
      showMightyTossFx(card);
      return true;
    case 'sutha_battle_roar':
      showBattleRoarFx(card);
      return true;
    case 'sutha_whirling_axes':
      showWhirlingAxesFx(card);
      return true;
    case 'jaheira_commune':
      showCommuneFx(card);
      return true;
    case 'jaheira_wolf_form':
      showWolfFormFx(card);
      return true;
    case 'jaheira_bear_form':
      showBearFormFx(card);
      return true;
    case 'jaheira_primal_strike':
      showPrimalStrikeFx(card);
      return true;
    case 'minsc_swapportunity':
      showSwapportunityFx(card);
      return true;
    case 'minsc_favored_frienemies':
      showFavoredFrienemiesFx(card);
      return true;
    case 'minsc_scouting':
      showScoutingFx(card);
      return true;
    default:
      return false;
  }
}

function targetPanelsForAttack(state, action, localPlayerId, card) {
  if (action.targetId) return [playerPanel(action.targetId, localPlayerId)].filter(Boolean);
  const attacks = card.symbols?.filter(sym => sym.type === SYM.ATTACK) || [];
  if (attacks.some(sym => sym.target === 'all')) {
    return Object.keys(state.players).map(pid => playerPanel(pid, localPlayerId)).filter(Boolean);
  }
  if (attacks.some(sym => sym.target === 'all_opponents')) {
    return Object.keys(state.players)
      .filter(pid => pid !== action.playerId)
      .map(pid => playerPanel(pid, localPlayerId))
      .filter(Boolean);
  }
  return [];
}

export function playActionAnimations(state, localPlayerId) {
  const action = state?.lastAction;
  const key = actionKey(action);
  if (!key) return;

  if (!initialized) {
    initialized = true;
    seenActions.add(key);
    return;
  }
  if (seenActions.has(key)) return;
  seenActions.add(key);
  if (seenActions.size > 120) seenActions.delete(seenActions.values().next().value);

  if (!action.cardId) return;
  const card = CARDS[action.cardId];
  if (!card) return;

  const played = playedCardEl(action.playerId, action.cardId);
  addFxClass(played, 'fx-card-played', 900);

  const symbols = card.symbols || [];
  const hasMighty = symbols.some(sym => sym.type === SYM.MIGHTY);
  const hasShield = symbols.some(sym => sym.type === SYM.SHIELD);
  const hasAttack = symbols.some(sym => sym.type === SYM.ATTACK || (sym.type === SYM.MIGHTY && sym.target === 'opponent'));
  const hasHeal = symbols.some(sym => sym.type === SYM.HEAL);
  const hasDraw = symbols.some(sym => sym.type === SYM.DRAW);

  const showedCardFx = showMightyCardFx(action, card, localPlayerId);
  if (hasMighty && !showedCardFx) {
    showMightyScene(card);
  }

  if (hasShield) {
    const actor = playerPanel(action.playerId, localPlayerId);
    addFxClass(actor, 'fx-shield-gain');
    floatingText(actor, 'SHIELD', 'fx-float-shield');
  }

  if (hasAttack) {
    for (const target of targetPanelsForAttack(state, action, localPlayerId, card)) {
      addFxClass(target, 'fx-hit');
      floatingText(target, 'HIT', 'fx-float-hit');
    }
  }

  if (hasHeal) {
    const actor = playerPanel(action.playerId, localPlayerId);
    addFxClass(actor, 'fx-heal');
    floatingText(actor, 'HEAL', 'fx-float-heal');
  }

  if (hasDraw) {
    const actor = playerPanel(action.playerId, localPlayerId);
    addFxClass(actor, 'fx-draw');
  }
}
