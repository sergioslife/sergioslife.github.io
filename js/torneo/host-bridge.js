(function (global) {
  'use strict';
  function shortCode(id) { return String(id || '').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() || 'LOCAL'; }
  function normPlayers(t, table) {
    var ids = table.players || [];
    return ids.map(function (pid) {
      var p = (t.players || []).find(function (x) { return x.id === pid; }) || { id: pid, name: pid };
      return { id: p.id, name: p.name };
    });
  }
  function publishCurrent(app) {
    if (!global.TorneoSync || !global.TorneoSync.ready()) return Promise.resolve();
    var t = app && app.getCurrentTournament ? app.getCurrentTournament() : null;
    if (!t) return Promise.resolve();
    var sessionId = t.syncSessionId || shortCode(t.id);
    t.syncSessionId = sessionId;
    var round = (t.rounds || [])[ (t.rounds || []).length - 1 ] || null;
    var session = {
      sessionId: sessionId,
      tournamentId: t.id,
      tournamentName: t.name,
      format: t.format,
      status: t.status,
      roundNumber: round ? round.roundNumber : 0,
      roundDurationSec: Math.max(0, (t.roundDuration || 0) * 60),
      roundStartedAt: round ? (round.startedAt || null) : null,
      roundPausedDurationMs: round ? (round.pausedDuration || 0) : 0,
      roundPausedAt: round ? (round.pausedAt || null) : null,
      hostUpdatedAt: Date.now(),
      privacyNote: 'Host admin local; companion data compartido por sesión. Configure Firebase Auth/Rules para privacidad fuerte.'
    };
    var tasks = [global.TorneoSync.publishSession(sessionId, session)];
    if (round && round.tables) {
      round.tables.forEach(function (table, idx) {
        if (table.bye) return;
        var tid = table.id || ('t' + (idx + 1));
        tasks.push(global.TorneoSync.publishTable(sessionId, tid, {
          sessionId: sessionId,
          tableId: tid,
          tableIndex: idx + 1,
          roundNumber: round.roundNumber,
          players: normPlayers(t, table),
          completed: !!table.completed,
          updatedAt: Date.now()
        }));
      });
    }
    try { localStorage.setItem('commander-tournaments', JSON.stringify(app.tournaments)); } catch (e) {}
    return Promise.all(tasks).catch(function (e) { console.warn('sync publish', e); });
  }

  global.TorneoHostBridge = {
    init: function (app) {
      var self = this;
      this.app = app;
      return global.TorneoSync.init().then(function () {
        self.wrapSave(app);
        self.injectUI();
        publishCurrent(app);
      }).catch(function (e) {
        console.warn('TorneoSync init', e);
        self.injectUI(true);
      });
    },
    wrapSave: function (app) {
      if (!app || app._syncWrapped) return;
      var orig = app.saveTournaments.bind(app);
      app.saveTournaments = function () {
        orig();
        publishCurrent(app);
      };
      app._syncWrapped = true;
    },
    joinUrl: function (sessionId, tableId, playerId) {
      var base = location.origin + location.pathname.replace(/torneo\.html.*$/i, 'companion.html');
      var q = '?session=' + encodeURIComponent(sessionId || '') + '&table=' + encodeURIComponent(tableId || '');
      if (playerId) q += '&player=' + encodeURIComponent(playerId);
      return base + q;
    },
    injectUI: function (localOnly) {
      var box = document.getElementById('companion-share-box');
      if (!box) {
        var info = document.getElementById('tournament-info');
        if (!info) return;
        box = document.createElement('div');
        box.id = 'companion-share-box';
        box.className = 'companion-share-box';
        info.insertAdjacentElement('afterend', box);
      }
      var app = this.app || global.app;
      var t = app && app.getCurrentTournament ? app.getCurrentTournament() : null;
      if (!t || t.status === 'setup') { box.style.display = 'none'; box.innerHTML = ''; return; }
      var sessionId = t.syncSessionId || shortCode(t.id);
      var mode = (global.TorneoSync && global.TorneoSync.mode) || 'local';
      var url = this.joinUrl(sessionId, '');
      box.style.display = 'block';
      box.innerHTML = '<div class="companion-share-title"><i class="fas fa-mobile-screen-button"></i> Companion invitado'
        + ' <span class="sync-mode sync-mode-' + mode + '">' + (mode === 'firestore' ? 'Tiempo real (Firebase)' : 'Modo local/demo') + '</span></div>'
        + '<div class="companion-share-meta">Código sesión: <strong>' + escapeHtml(sessionId) + '</strong></div>'
        + '<div class="companion-share-actions">'
        + '<input id="companion-share-url" class="companion-share-input" readonly value="' + escapeAttr(url) + '">'
        + '<button type="button" class="btn-secondary btn-sm" id="btn-copy-companion"><i class="fas fa-copy"></i> Copiar</button>'
        + '<a class="btn-primary btn-sm" href="' + escapeAttr(url) + '" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> Abrir</a>'
        + '</div>'
        + (mode !== 'firestore' ? '<p class="companion-share-note">Para sincronizar entre celulares, configura Firebase en <code>js/torneo/firebase-config.js</code>. En GitHub Pages sin backend compartido, el modo local solo funciona en el mismo navegador/dispositivo.</p>' : '<p class="companion-share-note">Comparte el enlace; cada jugador elige su mesa y su nombre en el companion.</p>');
      var btn = document.getElementById('btn-copy-companion');
      if (btn) btn.onclick = function () {
        var input = document.getElementById('companion-share-url');
        if (!input) return;
        input.select();
        try { document.execCommand('copy'); btn.innerHTML = '<i class="fas fa-check"></i> Copiado'; } catch (e) {}
        setTimeout(function () { btn.innerHTML = '<i class="fas fa-copy"></i> Copiar'; }, 1400);
      };
      function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
      function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var app = global.app || (typeof window !== 'undefined' && window.app);
      if (!app) return;
      global.TorneoHostBridge.init(app).then(function () {
        var origShow = app.showTournament.bind(app);
        app.showTournament = function (id) { origShow(id); setTimeout(function(){ global.TorneoHostBridge.injectUI(); publishCurrent(app); }, 0); };
        var origRender = app.renderTournamentDetail.bind(app);
        app.renderTournamentDetail = function () { origRender(); setTimeout(function(){ global.TorneoHostBridge.injectUI(); }, 0); };
      });
    }, 0);
  });
})(window);
