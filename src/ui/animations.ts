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

function showMightyOverlay(card) {
  const existing = document.querySelector('.fx-mighty-overlay');
  existing?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'fx-mighty-overlay';
  overlay.innerHTML = `
    <div class="fx-mighty-panel">
      <div class="fx-mighty-title">MIGHTY POWER</div>
      <img src="${cardImg(card.id)}" alt="${card.name}" draggable="false">
      <div class="fx-mighty-name">${card.name}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  window.setTimeout(() => overlay.remove(), 1250);
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

  if (hasMighty) showMightyOverlay(card);

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
