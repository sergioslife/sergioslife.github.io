(function () {
  'use strict';
  var qs = new URLSearchParams(location.search);
  var state = { sessionId: qs.get('session') || '', tableId: qs.get('table') || '', playerId: qs.get('player') || '', session: null, table: null, my: null, unsubs: [] };
  var playerTimer = { running: false, usedSec: 0, startedAt: 0, tick: null };

  function $(id) { return document.getElementById(id); }
  function setSyncBadge() { var b = $('c-sync-badge'); if (!b) return; var m = TorneoSync.mode || 'local'; b.className = 'sync-mode sync-mode-' + m; b.textContent = m === 'firestore' ? 'tiempo real' : 'modo local'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fmt(sec) { sec = Math.max(0, Math.floor(sec||0)); var m = Math.floor(sec/60), s = sec%60; return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0'); }

  function persistMy() {
    if (!state.sessionId || !state.tableId || !state.playerId || !state.my) return;
    TorneoSync.updatePlayerState(state.sessionId, state.tableId, state.playerId, state.my).catch(function () {});
  }

  function renderCounters() {
    if (!state.my) return;
    $('c-life').textContent = state.my.life;
    $('c-poison').textContent = state.my.poison;
    $('c-energy').textContent = state.my.energy;
    $('c-experience').textContent = state.my.experience;
    $('c-storm').textContent = state.my.storm;
    $('c-player-name').textContent = state.my.name || 'Jugador';
  }

  function renderCommander() {
    var box = $('c-commander-list');
    if (!box || !state.table || !state.my) return;
    var others = (state.table.players || []).filter(function (p) { return p.id !== state.playerId; });
    if (!others.length) { box.innerHTML = '<div class="c-counter-hint">Sin oponentes en esta mesa.</div>'; return; }
    box.innerHTML = others.map(function (op) {
      var entry = (state.my.commanderDamage || {})[op.id] || { commanderName: 'Comandante de ' + op.name, damage: 0 };
      var lethal = entry.damage >= 21 ? ' lethal' : '';
      return '<div class="c-cmdr" data-op="' + esc(op.id) + '">'
        + '<div class="c-cmdr-top"><span class="c-cmdr-vs">De ' + esc(op.name) + '</span><span class="c-counter-hint">recibido</span></div>'
        + '<input class="c-cmdr-name" data-op="' + esc(op.id) + '" value="' + esc(entry.commanderName || ('Comandante de ' + op.name)) + '" aria-label="Nombre del comandante de ' + esc(op.name) + '">'
        + '<div class="c-cmdr-row"><button class="c-mini" data-cmdr="' + esc(op.id) + '" data-delta="-1">−</button><span class="c-cmdr-val' + lethal + '" id="cmdr-val-' + esc(op.id) + '">' + (entry.damage||0) + '</span><button class="c-mini" data-cmdr="' + esc(op.id) + '" data-delta="1">+</button></div>'
        + '</div>';
    }).join('');
  }

  function renderTimers() {
    var rem = CompanionModel.roundRemainingSec(state.session);
    var el = $('c-round-timer');
    if (el) { el.textContent = fmt(rem); el.className = 'c-timer-value' + (rem <= 60 ? ' danger' : rem <= 300 ? ' warn' : ''); }
    var meta = $('c-round-meta');
    if (meta && state.session) meta.textContent = 'Ronda ' + (state.session.roundNumber || '-') + (state.session.roundPausedAt ? ' · pausada' : '');
    var budget = CompanionModel.playerBudgetSec(state.session, (state.table && state.table.players || []).length || 4);
    var used = playerTimer.usedSec + (playerTimer.running ? Math.floor((Date.now()-playerTimer.startedAt)/1000) : 0);
    var left = Math.max(0, budget - used);
    var pel = $('c-player-timer');
    if (pel) { pel.textContent = fmt(left); pel.className = 'c-timer-value' + (left <= 30 ? ' danger' : left <= 120 ? ' warn' : ''); }
  }

  function applyTable(table) {
    state.table = table;
    var sel = $('c-player');
    var players = table.players || [];
    var cur = state.playerId;
    sel.innerHTML = '<option value="">Seleccionar jugador…</option>' + players.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id===cur?' selected':'') + '>' + esc(p.name) + '</option>'; }).join('');
    if (state.playerId) {
      var remote = players.find(function (p) { return p.id === state.playerId; });
      if (remote) {
        if (!state.my) state.my = CompanionModel.defaultPlayer(remote);
        state.my.name = remote.name;
        ['life','poison','energy','experience','storm','commanderDamage','eliminatedBy'].forEach(function (k) { if (remote[k] != null && state.my[k] == null) state.my[k] = remote[k]; });
        renderCounters();
        renderCommander();
      }
    }
  }

  function subscribe() {
    state.unsubs.forEach(function (u) { try { u(); } catch(e) {} });
    state.unsubs = [];
    if (!state.sessionId) return;
    state.unsubs.push(TorneoSync.subscribeSession(state.sessionId, function (s) { state.session = s; $('c-tournament-name').textContent = s.tournamentName || 'Companion'; $('c-subtitle').textContent = (s.format||'') + (s.roundNumber ? ' · Ronda ' + s.roundNumber : ''); renderTimers(); }));
    if (state.tableId) state.unsubs.push(TorneoSync.subscribeTable(state.sessionId, state.tableId, applyTable));
  }

  function enterBoard() {
    $('c-join').style.display = 'none';
    $('c-board').style.display = 'block';
    subscribe();
    renderTimers();
    if (state.tick) clearInterval(state.tick);
    state.tick = setInterval(renderTimers, 1000);
  }

  function bind() {
    $('c-join-btn').addEventListener('click', function () {
      state.sessionId = ($('c-session').value || '').trim().toUpperCase();
      state.tableId = ($('c-table').value || '').trim();
      state.playerId = $('c-player').value || '';
      if (!state.sessionId || !state.tableId) { $('c-status').textContent = 'Ingresa código de sesión e ID de mesa.'; return; }
      if (state.playerId) state.my = CompanionModel.defaultPlayer({ id: state.playerId, name: '' });
      var url = new URL(location.href);
      url.searchParams.set('session', state.sessionId); url.searchParams.set('table', state.tableId);
      if (state.playerId) url.searchParams.set('player', state.playerId); else url.searchParams.delete('player');
      history.replaceState({}, '', url);
      enterBoard();
    });
    $('c-change-player').addEventListener('click', function () { $('c-board').style.display = 'none'; $('c-join').style.display = 'block'; });
    document.addEventListener('click', function (e) {
      var lifeBtn = e.target.closest('[data-field][data-delta]');
      if (lifeBtn && state.my) {
        CompanionModel.adjust(state.my, lifeBtn.getAttribute('data-field'), parseInt(lifeBtn.getAttribute('data-delta'),10));
        renderCounters(); persistMy();
        if (state.my.eliminatedBy) $('c-status').textContent = 'Aviso: condición de derrota detectada (' + state.my.eliminatedBy + ').';
      }
      var cmdr = e.target.closest('[data-cmdr][data-delta]');
      if (cmdr && state.my) {
        var op = cmdr.getAttribute('data-cmdr');
        var nameInput = document.querySelector('.c-cmdr-name[data-op="' + op + '"]');
        CompanionModel.adjustCommanderDamage(state.my, op, parseInt(cmdr.getAttribute('data-delta'),10), nameInput ? nameInput.value : null);
        renderCommander(); persistMy();
      }
    });
    document.addEventListener('change', function (e) {
      if (e.target.id === 'c-player') { state.playerId = e.target.value; if (state.playerId && state.table) applyTable(state.table); }
      var nm = e.target.closest('.c-cmdr-name');
      if (nm && state.my) { CompanionModel.ensureCommander(state.my, nm.getAttribute('data-op'), nm.value); persistMy(); }
    });
    $('c-player-timer-toggle').addEventListener('click', function () {
      if (!playerTimer.running) { playerTimer.running = true; playerTimer.startedAt = Date.now(); this.innerHTML = '<i class="fas fa-pause"></i> Pausar'; }
      else { playerTimer.usedSec += Math.floor((Date.now()-playerTimer.startedAt)/1000); playerTimer.running = false; this.innerHTML = '<i class="fas fa-play"></i> Iniciar'; }
    });
    $('c-player-timer-reset').addEventListener('click', function () { playerTimer = { running:false, usedSec:0, startedAt:0, tick:null }; $('c-player-timer-toggle').innerHTML = '<i class="fas fa-play"></i> Iniciar'; renderTimers(); });
  }

  TorneoSync.init().then(function () {
    setSyncBadge();
    $('c-session').value = state.sessionId;
    $('c-table').value = state.tableId;
    bind();
    if (state.sessionId && state.tableId) enterBoard();
  }).catch(function (err) {
    $('c-status').textContent = 'Error de sincronización: ' + (err && err.message || err);
    bind();
  });
})();
