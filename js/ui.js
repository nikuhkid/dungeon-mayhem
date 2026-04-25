import { getOrCreatePlayerId, handleCreateRoom, handleJoinRoom, selectHero, setReady, startGameIfReady, isHost } from './room.js';
import { subscribeToRoom } from './firebase.js';
import { HEROES, CARDS, SYM, symbolsToIcons, cardNeedsTarget } from './cards.js';
import { startGame, startTurn, endTurn, playCard, reclaimCard, resolveShieldPick } from './game.js';

// --- Module state ---
let playerId       = getOrCreatePlayerId();
let roomCode       = null;
let roomState      = null;

// Game-screen local state
let lastTurnPlayer    = null;
let drawingInProgress = false;
let playingCard       = false;
let pendingCard       = null;
let selectingTarget   = false;
let currentScreen     = null;

// --- Screen routing ---

function showScreen(id) {
  if (currentScreen === id) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  currentScreen = id;
}

// --- Home screen ---

function showHomeError(msg) {
  document.getElementById('home-error').textContent = msg;
}

function initHome() {
  const nameInput = document.getElementById('player-name-input');
  const codeInput = document.getElementById('room-code-input');

  document.getElementById('btn-create-room').addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { showHomeError('Enter a name first.'); return; }
    showHomeError('');
    try {
      const code = await handleCreateRoom(name);
      sessionStorage.setItem('playerName', name);
      enterLobby(code);
    } catch (e) { showHomeError(e.message); }
  });

  document.getElementById('btn-join-room').addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();
    if (!name)             { showHomeError('Enter a name first.'); return; }
    if (code.length !== 4) { showHomeError('Enter a 4-letter room code.'); return; }
    showHomeError('');
    try {
      const resolved = await handleJoinRoom(code, name);
      sessionStorage.setItem('playerName', name);
      enterLobby(resolved);
    } catch (e) { showHomeError(e.message); }
  });

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '');
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    sessionStorage.removeItem('roomCode');
    roomCode  = null;
    roomState = null;
    showScreen('screen-home');
  });
}

function enterLobby(code) {
  roomCode = code;
  sessionStorage.setItem('roomCode', code);
  document.getElementById('lobby-code').textContent = code;
  showScreen('screen-lobby');
  subscribeAndRoute(code);
}

// --- Lobby screen ---

function initLobby() {
  document.getElementById('btn-ready').addEventListener('click', async () => {
    if (!roomState || !roomCode) return;
    const me = roomState.players[playerId];
    if (!me?.heroId || me?.ready) return;
    await setReady(roomCode, playerId);
  });

  document.getElementById('btn-start-game').addEventListener('click', async () => {
    if (!roomState || !roomCode) return;
    try {
      await startGameIfReady(roomCode, roomState);
      await startGame(roomCode, roomState);
    } catch (e) {
      document.getElementById('lobby-status').textContent = e.message;
      setTimeout(() => { document.getElementById('lobby-status').textContent = ''; }, 3000);
    }
  });

  document.getElementById('hero-list').addEventListener('click', async (e) => {
    const card = e.target.closest('.hero-card');
    if (!card || card.disabled || card.classList.contains('taken')) return;
    if (!roomCode) return;
    if (roomState?.players[playerId]?.ready) return;
    await selectHero(roomCode, playerId, card.dataset.hero);
  });
}

function renderLobby(state) {
  if (document.getElementById('screen-lobby').classList.contains('hidden')) {
    showScreen('screen-lobby');
  }

  const me = state.players[playerId];
  const playerEntries = Object.entries(state.players);

  document.getElementById('lobby-players').innerHTML = playerEntries.map(([pid, p]) => {
    const hero = p.heroId ? HEROES[p.heroId] : null;
    const hostBadge  = pid === state.hostId ? '<span class="badge badge-host">Host</span>' : '';
    const readyBadge = p.ready
      ? '<span class="badge badge-ready">Locked In</span>'
      : '<span class="badge badge-waiting">Picking...</span>';
    return `<div class="lobby-player${pid === playerId ? ' is-me' : ''}">
      <span class="player-name">${escHtml(p.name)}</span>
      ${hostBadge}
      ${hero ? `<span class="hero-pick" style="color:${hero.color}">${hero.emoji} ${hero.name}</span>`
             : '<span class="hero-pick muted">No hero selected</span>'}
      ${readyBadge}
    </div>`;
  }).join('');

  const takenByOthers = new Set(
    playerEntries.filter(([pid]) => pid !== playerId).map(([, p]) => p.heroId).filter(Boolean)
  );

  const heroListEl = document.getElementById('hero-list');
  if (me?.ready) {
    heroListEl.innerHTML = '<p class="muted-msg">Locked in — waiting for others.</p>';
  } else {
    heroListEl.innerHTML = Object.values(HEROES).map(h => {
      const taken    = takenByOthers.has(h.id);
      const selected = me?.heroId === h.id;
      return `<button class="hero-card${selected ? ' selected' : ''}${taken ? ' taken' : ''}"
                      data-hero="${h.id}" ${taken ? 'disabled' : ''}
                      style="--hero-color:${h.color}">
        <span class="hero-emoji">${h.emoji}</span>
        <span class="hero-name">${h.name}</span>
        <span class="hero-class">${h.class}</span>
        ${taken ? '<span class="taken-label">Taken</span>' : ''}
      </button>`;
    }).join('');
  }

  const btnReady = document.getElementById('btn-ready');
  btnReady.disabled    = !me?.heroId || !!me?.ready;
  btnReady.textContent = me?.ready ? 'Locked In ✓' : 'Lock In';

  const btnStart = document.getElementById('btn-start-game');
  if (isHost(state, playerId)) {
    btnStart.classList.remove('hidden');
    const allReady = playerEntries.every(([, p]) => p.heroId && p.ready);
    btnStart.disabled = !(allReady && playerEntries.length >= 2);
  } else {
    btnStart.classList.add('hidden');
  }

  const total = playerEntries.length;
  const ready = playerEntries.filter(([, p]) => p.ready).length;
  document.getElementById('lobby-status').textContent =
    total < 2 ? 'Waiting for more players...' : `${ready} / ${total} locked in`;
}

// --- Game screen ---

function initGame() {
  document.getElementById('btn-end-turn').addEventListener('click', async () => {
    if (!roomState || roomState.currentTurn !== playerId) return;
    const played = roomState.cardsPlayedThisTurn || 0;
    const extra  = roomState.extraPlaysThisTurn  || 0;
    if (played < 1 || played <= extra) return;
    document.getElementById('btn-end-turn').disabled = true;
    await endTurn(roomCode, roomState, playerId);
  });

  document.getElementById('btn-cancel-target').addEventListener('click', () => {
    pendingCard     = null;
    selectingTarget = false;
    if (roomState) renderGame(roomState);
  });

  // Target click on opponent panel
  document.getElementById('opponents-area').addEventListener('click', async (e) => {
    if (!selectingTarget || playingCard) return;
    const panel = e.target.closest('.opponent-panel');
    if (!panel) return;
    const tid = panel.dataset.pid;
    if (!tid) return;
    const target = roomState?.players[tid];
    if (!target || target.eliminated || target.immune) return;

    const cid       = pendingCard;
    pendingCard     = null;
    selectingTarget = false;
    playingCard     = true;
    try {
      await playCard(roomCode, roomState, playerId, cid, tid);
    } finally {
      playingCard = false;
    }
  });

  // Play card from hand
  document.getElementById('hand-area').addEventListener('click', async (e) => {
    if (selectingTarget || playingCard) return;
    if (!roomState || roomState.currentTurn !== playerId) return;
    if (roomState.turnPhase !== 'playing') return;
    if (roomState.pendingReclaim || roomState.pendingShieldPick) return;

    const played = roomState.cardsPlayedThisTurn || 0;
    const extra  = roomState.extraPlaysThisTurn  || 0;
    if (played > 0 && played > extra) return;

    const cardEl = e.target.closest('.hand-card');
    if (!cardEl) return;
    const cid  = cardEl.dataset.cid;
    const card = CARDS[cid];
    const me   = roomState.players[playerId];

    // Determine if this card needs a target (base symbols + active formBonus)
    let needsTarget = cardNeedsTarget(card);
    if (!needsTarget && card?.formBonus) {
      const form = me?.jaheiraForm ?? 'none';
      const bonus = card.formBonus[form];
      if (bonus?.some(s => s.target === 'opponent')) needsTarget = true;
    }

    if (needsTarget) {
      pendingCard     = cid;
      selectingTarget = true;
      renderGame(roomState);
    } else {
      playingCard = true;
      try {
        await playCard(roomCode, roomState, playerId, cid, null);
      } finally {
        playingCard = false;
      }
    }
  });

  // Shield pick modal: pick which shield card to steal/destroy
  document.getElementById('shield-pick-cards').addEventListener('click', async (e) => {
    if (playingCard) return;
    const cardEl = e.target.closest('.shield-pick-card');
    if (!cardEl) return;
    const shieldInstanceId = cardEl.dataset.sid;
    playingCard = true;
    try {
      await resolveShieldPick(roomCode, roomState, playerId, shieldInstanceId);
    } finally {
      playingCard = false;
    }
  });

  // Reclaim modal: pick a card from discard
  document.getElementById('reclaim-cards').addEventListener('click', async (e) => {
    if (playingCard) return;
    const cardEl = e.target.closest('.reclaim-card');
    if (!cardEl) return;
    const cid = cardEl.dataset.cid;
    playingCard = true;
    try {
      await reclaimCard(roomCode, roomState, playerId, cid);
    } finally {
      playingCard = false;
    }
  });
}

function renderGame(state) {
  if (document.getElementById('screen-game').classList.contains('hidden')) {
    showScreen('screen-game');
  }

  // Reclaim modal
  if (state.pendingReclaim === playerId) {
    showReclaimModal(state.discardPiles[playerId] || []);
    return;
  }
  hideReclaimModal();

  // Shield pick modal
  if (state.pendingShieldPick?.pickerId === playerId) {
    const pick = state.pendingShieldPick;
    showShieldPickModal(state.players[pick.targetId]?.shieldCards || [], pick.effect);
    return;
  }
  hideShieldPickModal();

  // Reset target selection when turn changes away from us
  if (state.currentTurn !== lastTurnPlayer) {
    lastTurnPlayer = state.currentTurn;
    if (state.currentTurn !== playerId) {
      selectingTarget = false;
      pendingCard     = null;
    }
  }

  // Auto-draw when it's our turn, not eliminated, and phase is 'drawing'
  const meEliminated = state.players[playerId]?.eliminated;
  if (state.currentTurn === playerId && state.turnPhase === 'drawing' && !drawingInProgress && !meEliminated) {
    drawingInProgress = true;
    startTurn(roomCode, playerId, state).finally(() => { drawingInProgress = false; });
    return;
  }

  renderTurnIndicator(state);
  renderTargetPrompt();
  renderOpponents(state);
  renderSelf(state);
  renderHand(state);
  renderActionLog(state);
  updateGameButtons(state);
}

// --- Reclaim modal ---

function showReclaimModal(discardPile) {
  const modal   = document.getElementById('reclaim-modal');
  const cardsEl = document.getElementById('reclaim-cards');

  cardsEl.innerHTML = discardPile.length === 0
    ? '<p class="muted-msg">Discard pile is empty</p>'
    : discardPile.map(cid => {
        const card = CARDS[cid];
        return `<div class="reclaim-card" data-cid="${cid}">
          <div class="card-name">${card?.name ?? cid}</div>
          <div class="card-symbols">${symbolsToIcons(card?.symbols || [])}</div>
        </div>`;
      }).join('');

  modal.classList.remove('hidden');
}

function hideReclaimModal() {
  document.getElementById('reclaim-modal').classList.add('hidden');
}

// --- Shield pick modal ---

function showShieldPickModal(shieldCards, effect) {
  const modal   = document.getElementById('shield-pick-modal');
  const title   = document.getElementById('shield-pick-title');
  const cardsEl = document.getElementById('shield-pick-cards');

  title.textContent = effect === 'steal_shield'
    ? '🛡️ Choose a shield card to steal'
    : '💥 Choose a shield card to destroy';

  cardsEl.innerHTML = shieldCards.length === 0
    ? '<p class="muted-msg">No shield cards in play</p>'
    : shieldCards.map(sc => {
        const card = CARDS[sc.cardId];
        return `<div class="shield-pick-card" data-sid="${sc.id}">
          <div class="card-name">${card?.name ?? sc.cardId}</div>
          <div class="shield-remaining">🛡️ ${sc.remaining} remaining</div>
        </div>`;
      }).join('');

  modal.classList.remove('hidden');
}

function hideShieldPickModal() {
  document.getElementById('shield-pick-modal').classList.add('hidden');
}

// --- Game render helpers ---

function renderTurnIndicator(state) {
  const el = document.getElementById('turn-indicator');
  const isMyTurn = state.currentTurn === playerId;
  if (isMyTurn) {
    el.textContent = '⚡ Your Turn!';
    el.className   = 'my-turn';
  } else {
    const who  = state.players[state.currentTurn];
    const hero = who?.heroId ? HEROES[who.heroId] : null;
    el.textContent = `${hero?.emoji ?? ''} ${who?.name ?? '?'}'s Turn`;
    el.className   = '';
  }
}

function renderTargetPrompt() {
  document.getElementById('target-prompt')
    .classList.toggle('hidden', !selectingTarget);
}

function formBadge(player) {
  if (player.heroId !== 'jaheira') return '';
  const form = player.jaheiraForm;
  if (!form || form === 'none') return '';
  const label = form === 'bear' ? '🐻 Bear Form' : '🐺 Wolf Form';
  const cls   = form === 'bear' ? 'form-bear' : 'form-wolf';
  return `<span class="form-badge ${cls}">${label}</span>`;
}

function immuneBadge(player) {
  return player.immune ? '<span class="immune-badge">🥷 Hidden</span>' : '';
}

function renderOpponents(state) {
  const opponents = Object.entries(state.players).filter(([pid]) => pid !== playerId);

  document.getElementById('opponents-area').innerHTML = opponents.map(([pid, p]) => {
    const hero      = p.heroId ? HEROES[p.heroId] : null;
    const hpPct     = Math.max(0, Math.min(100, (p.hp / 10) * 100));
    // Immune players can't be targeted
    const isTargetable = selectingTarget && !p.eliminated && !p.immune;
    const selClass  = isTargetable ? ' selectable' : '';
    const elimClass = p.eliminated ? ' eliminated' : '';

    return `<div class="opponent-panel${selClass}${elimClass}" data-pid="${pid}">
      <div class="opp-hero-name">${hero?.emoji ?? '?'} ${escHtml(p.name)} ${formBadge(p)} ${immuneBadge(p)}</div>
      <div class="hp-bar-wrap"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>
      <div class="opp-stats">
        <span class="stat-hp">❤️ ${p.hp}/10</span>
        ${(p.shieldCards || []).map(sc => `<span class="stat-shield shield-card-badge" title="${CARDS[sc.cardId]?.name ?? sc.cardId}">🛡️${sc.remaining}</span>`).join('')}
        ${p.eliminated ? '<span class="elim-badge">Eliminated</span>' : ''}
      </div>
      <div class="opp-card-count">🃏 ${(p.hand || []).length} card${(p.hand || []).length !== 1 ? 's' : ''}</div>
      ${isTargetable ? '<div class="target-hint">Click to target</div>' : ''}
    </div>`;
  }).join('');
}

function renderSelf(state) {
  const me = state.players[playerId];
  if (!me) return;

  if (me.eliminated) {
    document.getElementById('self-info').innerHTML =
      '<div class="eliminated-self">💀 You have been eliminated — spectating</div>';
    document.getElementById('hand-area').innerHTML = '';
    return;
  }

  const hero  = me.heroId ? HEROES[me.heroId] : null;
  const hpPct = Math.max(0, Math.min(100, (me.hp / 10) * 100));

  document.getElementById('self-info').innerHTML = `
    <div class="self-hero-name">
      ${hero?.emoji ?? '?'} ${escHtml(me.name)}
      <span class="hero-class-label">${hero?.class ?? ''}</span>
      ${formBadge(me)}
      ${immuneBadge(me)}
    </div>
    <div class="hp-bar-wrap large"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>
    <div class="self-stats">
      <span class="stat-hp">❤️ ${me.hp} / 10</span>
      ${(me.shieldCards || []).map(sc => `<span class="stat-shield shield-card-badge" title="${CARDS[sc.cardId]?.name ?? sc.cardId}">🛡️${sc.remaining}</span>`).join('')}
    </div>`;
}

function isFormBlocked(card, me) {
  if (card?.requiresForm) return (me.jaheiraForm ?? 'none') !== card.requiresForm;
  return false;
}

function cardIcons(card, me) {
  if (card?.formBonus) {
    const form = me?.jaheiraForm ?? 'none';
    const bonus = card.formBonus[form];
    const allSyms = bonus?.length ? [...(card.symbols || []), ...bonus] : (card.symbols || []);
    return symbolsToIcons(allSyms);
  }
  return symbolsToIcons(card?.symbols);
}

function cardDesc(card, me) {
  if (card?.formBonus) {
    const form = me?.jaheiraForm ?? 'none';
    if (form !== 'none') {
      const tag = form === 'bear' ? '🐻 Bear bonus' : '🐺 Wolf bonus';
      return `${card.description ?? ''} (${tag} active)`;
    }
  }
  return card?.description ?? '';
}

function renderHand(state) {
  const me = state.players[playerId];
  if (!me || me.eliminated) return;

  const isMyTurn = state.currentTurn === playerId && state.turnPhase === 'playing';
  const played   = state.cardsPlayedThisTurn || 0;
  const extra    = state.extraPlaysThisTurn  || 0;
  const canPlay  = isMyTurn && !selectingTarget && !state.pendingReclaim && !state.pendingShieldPick && (played === 0 || played <= extra);

  document.getElementById('hand-area').innerHTML = (me.hand || []).map(cid => {
    const card      = CARDS[cid];
    const isPending = cid === pendingCard;
    const blocked   = isFormBlocked(card, me);
    const classes   = [
      canPlay && !blocked ? 'playable' : '',
      isPending           ? 'pending'  : '',
      blocked             ? 'form-locked' : '',
    ].filter(Boolean).join(' ');

    let formLabel = '';
    if (blocked && card?.requiresForm) {
      formLabel = `<div class="form-lock-label">${card.requiresForm === 'bear' ? '🐻' : '🐺'} ${card.requiresForm} form only</div>`;
    }

    return `<div class="hand-card${classes ? ' ' + classes : ''}" data-cid="${cid}">
      <div class="card-name">${card?.name ?? cid}</div>
      <div class="card-symbols">${cardIcons(card, me)}</div>
      <div class="card-desc">${cardDesc(card, me)}</div>
      ${formLabel}
    </div>`;
  }).join('') || '<div class="empty-hand">No cards in hand</div>';
}

function renderActionLog(state) {
  const entries = state.actionLog || [];
  document.getElementById('log-entries').innerHTML = entries.map(e =>
    `<div class="log-entry">${escHtml(e.description)}</div>`
  ).join('') || '<div class="log-entry muted">No actions yet</div>';
}

function updateGameButtons(state) {
  const me       = state.players[playerId];
  const isMyTurn = state.currentTurn === playerId && state.turnPhase === 'playing' && !me?.eliminated;
  const played   = state.cardsPlayedThisTurn || 0;
  const extra    = state.extraPlaysThisTurn  || 0;
  const canEnd   = isMyTurn && played >= 1 && played > extra && !state.pendingReclaim && !state.pendingShieldPick;

  document.getElementById('btn-end-turn').disabled = !canEnd;

  const hint = document.getElementById('turn-hint');
  if (me?.eliminated) {
    hint.textContent = '';
  } else if (!isMyTurn) {
    hint.textContent = '';
  } else if (state.pendingReclaim === playerId) {
    hint.textContent = '📜 Choose a card to reclaim from your discard';
  } else if (played === 0) {
    hint.textContent = 'Play a card to end your turn';
  } else if (played <= extra) {
    const left = extra - played + 1;
    hint.textContent = `⚡ ${left} extra play${left !== 1 ? 's' : ''} remaining`;
  } else {
    hint.textContent = '';
  }
}

// --- Win screen ---

function renderWin(state) {
  showScreen('screen-win');
  if (!state.winner) return;

  const winner = state.players[state.winner];
  const hero   = winner?.heroId ? HEROES[winner.heroId] : null;

  document.getElementById('win-hero').innerHTML =
    hero ? `<span style="color:${hero.color}">${hero.emoji} ${hero.name}</span>` : '';
  document.getElementById('win-player').textContent =
    winner ? `${escHtml(winner.name)} wins!` : '';

  const playerEntries = Object.entries(state.players).sort(([aId, a], [bId, b]) => {
    if (aId === state.winner) return -1;
    if (bId === state.winner) return 1;
    return (b.hp || 0) - (a.hp || 0);
  });

  document.getElementById('final-standings').innerHTML = playerEntries.map(([pid, p], i) => {
    const h      = p.heroId ? HEROES[p.heroId] : null;
    const isWin  = pid === state.winner;
    const hpBar  = Math.max(0, Math.min(100, (p.hp / 10) * 100));
    return `<div class="standing-row${isWin ? ' standing-winner' : ''}">
      <span class="standing-rank">${isWin ? '🏆' : `#${i + 1}`}</span>
      <span class="standing-hero">${h?.emoji ?? '?'}</span>
      <span class="standing-name">${escHtml(p.name)}</span>
      <span class="standing-hero-name">${h?.name ?? ''}</span>
      <div class="hp-bar-wrap"><div class="hp-bar-fill" style="width:${hpBar}%"></div></div>
      <span class="stat-hp">❤️ ${p.hp}/10</span>
      ${(p.shieldCards || []).map(sc => `<span class="stat-shield shield-card-badge" title="${CARDS[sc.cardId]?.name ?? sc.cardId}">🛡️${sc.remaining}</span>`).join('')}
    </div>`;
  }).join('');
}

// --- Subscription & routing ---

function subscribeAndRoute(code) {
  subscribeToRoom(code, (state) => {
    if (!state) return;
    roomState = state;

    if (!state.players[playerId]) {
      sessionStorage.removeItem('roomCode');
      showScreen('screen-home');
      return;
    }

    if (state.status === 'lobby')    renderLobby(state);
    if (state.status === 'playing')  renderGame(state);
    if (state.status === 'finished') renderWin(state);
  });
}

// --- Helpers ---

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
  initHome();
  initLobby();
  initGame();

  const savedCode = sessionStorage.getItem('roomCode');
  if (savedCode) {
    enterLobby(savedCode);
  } else {
    showScreen('screen-home');
  }
});
