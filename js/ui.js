import { getOrCreatePlayerId, handleCreateRoom, handleJoinRoom, selectHero, setReady, startGameIfReady, isHost, addBot } from './room.js';
import { subscribeToRoom } from './firebase.js';
import { HEROES, CARDS, SYM, cardNeedsTarget } from './cards.js';
import { startGame, startTurn, endTurn, playCard, reclaimCard, resolveShieldPick, resolvePickpocket, resetRoom } from './game.js';
import { isBot, driveBotTurn } from './bot.js';

// --- Module state ---
let playerId       = getOrCreatePlayerId();
let roomCode       = null;
let roomState      = null;

// Game-screen local state
let lastTurnPlayer          = null;
let drawingInProgress       = false;
let playingCard             = false;
let pendingCard             = null;
let selectingTarget         = false;
let currentScreen           = null;
let endTurnTimer            = null;
let endTurnTick             = 0;
let pickpocketTargetMode    = false;
let pickpocketAutoResolving = false;

// --- Image path helpers ---

function cardSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function cardImg(cardId) {
  const card = CARDS[cardId];
  if (!card) return '';
  return `assets/cards/${cardSlug(card.name)}.png`;
}

function heroBackImg(heroId) {
  return `assets/backs/${heroId}.png`;
}

function heroInfoImg(heroId) {
  return `assets/heroes/${heroId}_info.png`;
}

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

  document.getElementById('btn-play-again').addEventListener('click', async () => {
    if (!roomCode || !roomState) return;
    await resetRoom(roomCode, roomState);
  });

  document.getElementById('btn-leave-room').addEventListener('click', () => {
    sessionStorage.removeItem('roomCode');
    roomCode  = null;
    roomState = null;
    showScreen('screen-home');
  });

  // Hero info modal
  document.getElementById('hero-info-backdrop').addEventListener('click', closeHeroInfoModal);
  document.getElementById('btn-close-hero-info').addEventListener('click', closeHeroInfoModal);
}

function enterLobby(code) {
  roomCode = code;
  sessionStorage.setItem('roomCode', code);
  document.getElementById('lobby-code').textContent = code;
  showScreen('screen-lobby');
  subscribeAndRoute(code);
}

// --- Hero info modal ---

function openHeroInfoModal(heroId) {
  const img = document.getElementById('hero-info-img');
  const hero = HEROES[heroId];
  img.src = heroInfoImg(heroId);
  img.alt = hero?.name ?? heroId;
  document.getElementById('hero-info-modal').classList.remove('hidden');
}

function closeHeroInfoModal() {
  document.getElementById('hero-info-modal').classList.add('hidden');
}

// Global delegation for hero info buttons (works from both lobby and game screen)
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-hero-info]');
  if (!btn) return;
  openHeroInfoModal(btn.dataset.heroInfo);
});

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
    // Info button handled by body delegation — skip here
    if (e.target.closest('.hero-info-btn')) return;
    const card = e.target.closest('.hero-card');
    if (!card || card.classList.contains('taken')) return;
    if (!roomCode) return;
    if (roomState?.players[playerId]?.ready) return;
    await selectHero(roomCode, playerId, card.dataset.hero);
  });

  document.getElementById('btn-add-bot').addEventListener('click', async () => {
    if (!roomCode || !roomState) return;
    if (!isHost(roomState, playerId)) return;
    try {
      await addBot(roomCode, roomState);
    } catch (e) {
      document.getElementById('lobby-status').textContent = e.message;
      setTimeout(() => { document.getElementById('lobby-status').textContent = ''; }, 3000);
    }
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
      ${hero
        ? `<span class="hero-pick" style="color:${hero.color}">${hero.name}</span>`
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
      return `<div class="hero-card${selected ? ' selected' : ''}${taken ? ' taken' : ''}"
                      data-hero="${h.id}"
                      style="--hero-color:${h.color}">
        <img class="hero-card-back" src="${heroBackImg(h.id)}" alt="${escHtml(h.name)}" draggable="false">
        <div class="hero-card-info">
          <span class="hero-name">${escHtml(h.name)}</span>
          <span class="hero-class">${escHtml(h.class)}</span>
        </div>
        ${taken ? '<span class="taken-label">Taken</span>' : ''}
        <div class="hero-info-btn" data-hero-info="${h.id}">?</div>
      </div>`;
    }).join('');
  }

  const btnReady = document.getElementById('btn-ready');
  btnReady.disabled    = !me?.heroId || !!me?.ready;
  btnReady.textContent = me?.ready ? 'Locked In' : 'Lock In';

  const btnStart  = document.getElementById('btn-start-game');
  const btnAddBot = document.getElementById('btn-add-bot');
  if (isHost(state, playerId)) {
    btnStart.classList.remove('hidden');
    const allReady = playerEntries.every(([, p]) => p.heroId && p.ready);
    btnStart.disabled = !(allReady && playerEntries.length >= 2);

    const takenHeroes  = new Set(playerEntries.map(([, p]) => p.heroId).filter(Boolean));
    const heroesLeft   = Object.keys(HEROES).filter(h => !takenHeroes.has(h)).length;
    const canAddBot    = playerEntries.length < 6 && heroesLeft > 0;
    btnAddBot.classList.toggle('hidden', !canAddBot);
  } else {
    btnStart.classList.add('hidden');
    btnAddBot.classList.add('hidden');
  }

  const total = playerEntries.length;
  const ready = playerEntries.filter(([, p]) => p.ready).length;
  document.getElementById('lobby-status').textContent =
    total < 2 ? 'Waiting for more players...' : `${ready} / ${total} locked in`;
}

// --- Game screen ---

function initGame() {
  document.getElementById('btn-cancel-target').addEventListener('click', async () => {
    if (pickpocketTargetMode) {
      pickpocketTargetMode    = false;
      selectingTarget         = false;
      pickpocketAutoResolving = false;
      hidePickpocketReveal();
      if (roomState?.pendingPickpocket?.pickerId === playerId) {
        await resolvePickpocket(roomCode, roomState, playerId, null);
      }
      return;
    }
    pendingCard     = null;
    selectingTarget = false;
    if (roomState) renderGame(roomState);
  });

  document.getElementById('opponents-area').addEventListener('click', async (e) => {
    if (!selectingTarget || playingCard) return;
    const panel = e.target.closest('.opponent-panel');
    if (!panel) return;
    const tid = panel.dataset.pid;
    if (!tid) return;
    const target = roomState?.players[tid];
    if (!target || target.eliminated) return;
    const aliveCount = Object.values(roomState.players).filter(p => !p.eliminated).length;
    if (target.immune && aliveCount > 2) return;

    if (pickpocketTargetMode) {
      pickpocketTargetMode    = false;
      selectingTarget         = false;
      pickpocketAutoResolving = false;
      hidePickpocketReveal();
      playingCard = true;
      try {
        await resolvePickpocket(roomCode, roomState, playerId, tid);
      } finally {
        playingCard = false;
      }
      return;
    }

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

  document.getElementById('hand-area').addEventListener('click', async (e) => {
    if (selectingTarget || playingCard) return;
    if (!roomState || roomState.currentTurn !== playerId) return;
    if (roomState.turnPhase !== 'playing') return;
    if (roomState.pendingReclaim || roomState.pendingShieldPick || roomState.pendingPickpocket) return;

    const played = roomState.cardsPlayedThisTurn || 0;
    const extra  = roomState.extraPlaysThisTurn  || 0;
    if (played > 0 && played > extra) return;

    const cardEl = e.target.closest('.hand-card');
    if (!cardEl) return;
    const cid  = cardEl.dataset.cid;
    const card = CARDS[cid];
    const me   = roomState.players[playerId];

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
      cardEl.classList.add('card-exit');
      playingCard = true;
      try {
        await playCard(roomCode, roomState, playerId, cid, null);
      } finally {
        playingCard = false;
      }
    }
  });

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

  if (state.pendingReclaim === playerId) {
    showReclaimModal(state.discardPiles[playerId] || []);
    return;
  }
  hideReclaimModal();

  if (state.pendingShieldPick?.pickerId === playerId) {
    const pick = state.pendingShieldPick;
    showShieldPickModal(state.players[pick.targetId]?.shieldCards || [], pick.effect);
    return;
  }
  hideShieldPickModal();

  if (state.currentTurn !== lastTurnPlayer) {
    lastTurnPlayer = state.currentTurn;
    if (state.currentTurn !== playerId) {
      selectingTarget         = false;
      pendingCard             = null;
      pickpocketTargetMode    = false;
      pickpocketAutoResolving = false;
    } else {
      playTurnSound();
    }
  }

  if (state.pendingPickpocket?.pickerId === playerId) {
    const pick     = state.pendingPickpocket;
    const card     = CARDS[pick.stolenCardId];
    const hasAttack = card?.symbols?.some(s => s.type === SYM.ATTACK && s.target === 'opponent');
    showPickpocketReveal(pick.stolenCardId, hasAttack);
    if (hasAttack && !pickpocketTargetMode) {
      pickpocketTargetMode = true;
      selectingTarget      = true;
    }
    if (!hasAttack && !pickpocketAutoResolving) {
      pickpocketAutoResolving = true;
      setTimeout(async () => {
        pickpocketAutoResolving = false;
        if (roomState?.pendingPickpocket?.pickerId === playerId) {
          await resolvePickpocket(roomCode, roomState, playerId, null);
        }
      }, 1500);
    }
    renderTurnIndicator(state);
    renderTargetPrompt();
    renderOpponents(state);
    renderSelf(state);
    renderHand(state);
    renderActionLog(state);
    updateGameButtons(state);
    return;
  }
  hidePickpocketReveal();
  if (!pickpocketTargetMode) {
    pickpocketAutoResolving = false;
  }

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
        const name = card?.name ?? cid;
        const src  = cardImg(cid);
        return `<div class="reclaim-card" data-cid="${cid}">
          <img src="${src}" alt="${escHtml(name)}" draggable="false">
          <div class="card-tooltip">${escHtml(name)}</div>
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
    ? 'Choose a shield card to steal'
    : 'Choose a shield card to destroy';

  cardsEl.innerHTML = shieldCards.length === 0
    ? '<p class="muted-msg">No shield cards in play</p>'
    : shieldCards.map(sc => {
        const card = CARDS[sc.cardId];
        const name = card?.name ?? sc.cardId;
        const src  = cardImg(sc.cardId);
        return `<div class="shield-pick-card" data-sid="${sc.id}">
          <img src="${src}" alt="${escHtml(name)}" draggable="false">
          <div class="card-tooltip">${escHtml(name)}</div>
          <div class="shield-remaining">shield: ${sc.remaining}</div>
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
    el.textContent = '>> Your Turn!';
    el.className   = 'my-turn';
  } else {
    const who  = state.players[state.currentTurn];
    el.textContent = `${escHtml(who?.name ?? '?')}'s Turn`;
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
  const label = form === 'bear' ? 'Bear Form' : 'Wolf Form';
  const cls   = form === 'bear' ? 'form-bear' : 'form-wolf';
  return `<span class="form-badge ${cls}">${label}</span>`;
}

function immuneBadge(player) {
  return player.immune ? '<span class="immune-badge">Hidden</span>' : '';
}

function renderOpponents(state) {
  const ordered = (state.turnOrder || Object.keys(state.players))
    .filter(pid => pid !== playerId)
    .map(pid => [pid, state.players[pid]])
    .filter(([, p]) => p);
  const aliveCount = Object.values(state.players).filter(p => !p.eliminated).length;

  document.getElementById('opponents-area').innerHTML = ordered.map(([pid, p]) => {
    const hero         = p.heroId ? HEROES[p.heroId] : null;
    const hpPct        = Math.max(0, Math.min(100, (p.hp / 10) * 100));
    const isTargetable = selectingTarget && !p.eliminated && (!p.immune || aliveCount <= 2);
    const isActive     = state.currentTurn === pid;
    const selClass     = isTargetable ? ' selectable' : '';
    const elimClass    = p.eliminated ? ' eliminated' : '';
    const actClass     = isActive ? ' active-turn' : '';

    return `<div class="opponent-panel${selClass}${elimClass}${actClass}" data-pid="${pid}">
      <div class="opp-hero-name">
        ${escHtml(p.name)}
        ${hero ? `<span class="opp-hero-class" style="color:${hero.color}">${escHtml(hero.name)}</span>` : ''}
        ${formBadge(p)} ${immuneBadge(p)}
      </div>
      <div class="hp-bar-wrap"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>
      <div class="opp-stats">
        <span class="stat-hp">HP: ${p.hp}/10</span>
        ${(p.shieldCards || []).map(sc => `<span class="stat-shield shield-card-badge" title="${escHtml(CARDS[sc.cardId]?.name ?? sc.cardId)}">shld:${sc.remaining}</span>`).join('')}
        ${p.eliminated ? '<span class="elim-badge">Eliminated</span>' : ''}
      </div>
      <div class="opp-card-count">${(p.hand || []).length} card${(p.hand || []).length !== 1 ? 's' : ''} in hand</div>
      ${isTargetable ? '<div class="target-hint">[ click to target ]</div>' : ''}
    </div>`;
  }).join('');
}

function renderSelf(state) {
  const me = state.players[playerId];
  if (!me) return;

  document.getElementById('self-panel').classList.toggle('active-turn', state.currentTurn === playerId);

  if (me.eliminated) {
    document.getElementById('self-info').innerHTML =
      '<div class="eliminated-self">You have been eliminated — spectating</div>';
    document.getElementById('hand-area').innerHTML = '';
    document.getElementById('draw-pile').innerHTML  = '';
    document.getElementById('discard-pile').innerHTML = '';
    return;
  }

  const hero  = me.heroId ? HEROES[me.heroId] : null;
  const hpPct = Math.max(0, Math.min(100, (me.hp / 10) * 100));

  document.getElementById('self-info').innerHTML = `
    <div class="self-hero-name">
      ${escHtml(me.name)}
      <span class="hero-class-label">${escHtml(hero?.class ?? '')}</span>
      ${formBadge(me)}
      ${immuneBadge(me)}
      ${hero ? `<span class="hero-info-link" data-hero-info="${me.heroId}">?</span>` : ''}
    </div>
    <div class="hp-bar-wrap large"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>
    <div class="self-stats">
      <span class="stat-hp">HP: ${me.hp} / 10</span>
      ${(me.shieldCards || []).map(sc => `<span class="stat-shield shield-card-badge" title="${escHtml(CARDS[sc.cardId]?.name ?? sc.cardId)}">shld:${sc.remaining}</span>`).join('')}
    </div>`;

  renderPiles(state);
}

function renderPiles(state) {
  const me = state.players[playerId];
  if (!me?.heroId) return;

  const deckCards = state.decks?.[playerId] || [];
  const discard   = state.discardPiles?.[playerId] || [];
  const backSrc   = heroBackImg(me.heroId);
  const deckCount = deckCards.length;

  // Draw pile
  const drawEl = document.getElementById('draw-pile');
  if (deckCount === 0) {
    drawEl.innerHTML = '<div class="pile-empty">—</div>';
  } else {
    const layers = Math.min(3, deckCount);
    const backs  = Array.from({ length: layers }, () =>
      `<img class="pile-card-back" src="${backSrc}" alt="" draggable="false">`
    ).join('');
    drawEl.innerHTML = `${backs}<div class="pile-count-badge">${deckCount}</div>`;
  }

  // Discard pile
  const discardEl = document.getElementById('discard-pile');
  if (discard.length === 0) {
    discardEl.innerHTML = '<div class="pile-empty">—</div>';
  } else {
    const topCid = discard[discard.length - 1];
    const src    = cardImg(topCid);
    const name   = CARDS[topCid]?.name ?? topCid;
    discardEl.innerHTML = `<img src="${src}" alt="${escHtml(name)}" draggable="false">`;
  }
}

function isFormBlocked(card, me) {
  if (card?.requiresForm) return (me.jaheiraForm ?? 'none') !== card.requiresForm;
  return false;
}

function cardDesc(card, me) {
  if (card?.formBonus) {
    const form = me?.jaheiraForm ?? 'none';
    if (form !== 'none') {
      const tag = form === 'bear' ? 'Bear bonus active' : 'Wolf bonus active';
      return `${card.description ?? ''} (${tag})`;
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
  const canPlay  = isMyTurn && !selectingTarget && !state.pendingReclaim && !state.pendingShieldPick && !state.pendingPickpocket && (played === 0 || played <= extra);

  document.getElementById('hand-area').innerHTML = (me.hand || []).map(cid => {
    const card      = CARDS[cid];
    const isPending = cid === pendingCard;
    const blocked   = isFormBlocked(card, me);
    const classes   = [
      canPlay && !blocked ? 'playable' : '',
      isPending           ? 'pending'  : '',
      blocked             ? 'form-locked' : '',
    ].filter(Boolean).join(' ');

    const src     = cardImg(cid);
    const tooltip = card
      ? `${card.name}${card.description ? ' — ' + cardDesc(card, me) : ''}`
      : cid;

    const lockOverlay = blocked && card?.requiresForm
      ? `<div class="form-lock-overlay"><span>${card.requiresForm} form only</span></div>`
      : '';

    return `<div class="hand-card${classes ? ' ' + classes : ''}" data-cid="${cid}">
      <img src="${src}" alt="${escHtml(card?.name ?? cid)}" draggable="false">
      <div class="card-tooltip">${escHtml(tooltip)}</div>
      ${lockOverlay}
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
  const canEnd   = isMyTurn && played >= 1 && played > extra && !state.pendingReclaim && !state.pendingShieldPick && !state.pendingPickpocket;

  const countdownEl = document.getElementById('end-turn-countdown');

  if (canEnd && !endTurnTimer) {
    endTurnTick = 3;
    countdownEl.textContent = `Ending turn in ${endTurnTick}s`;
    countdownEl.classList.remove('hidden');
    const tick = () => {
      endTurnTick--;
      if (endTurnTick <= 0) {
        endTurnTimer = null;
        countdownEl.classList.add('hidden');
        if (roomState?.status === 'playing' && roomState?.currentTurn === playerId) {
          endTurn(roomCode, roomState, playerId);
        }
      } else {
        countdownEl.textContent = `Ending turn in ${endTurnTick}s`;
        endTurnTimer = setTimeout(tick, 1000);
      }
    };
    endTurnTimer = setTimeout(tick, 1000);
  } else if (!canEnd && endTurnTimer) {
    clearTimeout(endTurnTimer);
    endTurnTimer = null;
    endTurnTick  = 0;
    countdownEl.classList.add('hidden');
  }

  const hint = document.getElementById('turn-hint');
  if (me?.eliminated || !isMyTurn) {
    hint.textContent = '';
  } else if (state.pendingReclaim === playerId) {
    hint.textContent = 'Choose a card to reclaim';
  } else if (state.pendingShieldPick?.pickerId === playerId) {
    hint.textContent = 'Choose a shield card';
  } else if (played === 0) {
    hint.textContent = 'Play a card to end your turn';
  } else if (played <= extra) {
    const left = extra - played + 1;
    hint.textContent = `${left} extra play${left !== 1 ? 's' : ''} remaining`;
  } else {
    hint.textContent = '';
  }
}

// --- Audio ---

function playTurnSound() {
  try {
    const ac   = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ac.createGain();
    gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);

    const o1 = ac.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(523, ac.currentTime);
    o1.connect(gain);
    o1.start(ac.currentTime);
    o1.stop(ac.currentTime + 0.18);

    const o2 = ac.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(784, ac.currentTime + 0.15);
    o2.connect(gain);
    o2.start(ac.currentTime + 0.15);
    o2.stop(ac.currentTime + 0.45);
  } catch (_) {}
}

// --- Pickpocket reveal ---

function showPickpocketReveal(cardId, hasAttack) {
  const el   = document.getElementById('pickpocket-reveal');
  const card = CARDS[cardId];
  document.getElementById('pickpocket-card-name').textContent = card?.name ?? cardId;
  document.getElementById('pickpocket-hint').textContent = hasAttack
    ? 'Attack card — choose a target'
    : 'Resolving automatically...';
  el.classList.remove('hidden');
}

function hidePickpocketReveal() {
  document.getElementById('pickpocket-reveal').classList.add('hidden');
}

// --- Win screen ---

function renderWin(state) {
  showScreen('screen-win');
  if (!state.winner) return;

  const winner = state.players[state.winner];
  const hero   = winner?.heroId ? HEROES[winner.heroId] : null;

  document.getElementById('win-hero').innerHTML =
    hero ? `<span style="color:${hero.color}">${escHtml(hero.name)}</span>` : '';
  document.getElementById('win-player').textContent =
    winner ? `${escHtml(winner.name)} wins!` : '';

  const elimOrder    = state.eliminationOrder || [];
  const playerEntries = Object.entries(state.players).sort(([aId], [bId]) => {
    if (aId === state.winner) return -1;
    if (bId === state.winner) return 1;
    const aIdx = elimOrder.indexOf(aId);
    const bIdx = elimOrder.indexOf(bId);
    return bIdx - aIdx;
  });

  document.getElementById('final-standings').innerHTML = playerEntries.map(([pid, p], i) => {
    const h     = p.heroId ? HEROES[p.heroId] : null;
    const isWin = pid === state.winner;
    const hpBar = Math.max(0, Math.min(100, (p.hp / 10) * 100));
    const rank  = isWin ? '★' : `#${i + 1}`;
    return `<div class="standing-row${isWin ? ' standing-winner' : ''}">
      <span class="standing-rank">${rank}</span>
      <span class="standing-name">${escHtml(p.name)}</span>
      <span class="standing-hero-name">${escHtml(h?.name ?? '')}</span>
      <div class="hp-bar-wrap"><div class="hp-bar-fill" style="width:${hpBar}%"></div></div>
      <span class="stat-hp">HP:${p.hp}</span>
      ${(p.shieldCards || []).map(sc => `<span class="stat-shield shield-card-badge" title="${escHtml(CARDS[sc.cardId]?.name ?? sc.cardId)}">shld:${sc.remaining}</span>`).join('')}
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
    if (state.status === 'playing')  { renderGame(state); driveBotTurn(roomCode, state); }
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
