(function (global) {
  'use strict';
  function shortCode(id) { return String(id || '').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() || 'LOCAL'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function normPlayers(t, table) {
    var ids = table.players || [];
    return ids.map(function (pid) {
      var p = (t.players || []).find(function (x) { return x.id === pid; }) || { id: pid, name: pid };
      return { id: p.id, name: p.name };
    });
  }
  function getBaseMesaUrl() { return location.origin + location.pathname.replace(/torneo\.html.*$/i, 'mesa.html'); }
  function publishCurrent(app) {
    if (!global.TorneoSync || !global.TorneoSync.ready()) return Promise.resolve();
    var t = app && app.getCurrentTournament ? app.getCurrentTournament() : null;
    if (!t) return Promise.resolve();
    var sessionId = t.syncSessionId || shortCode(t.id);
    t.syncSessionId = sessionId;
    var round = (t.rounds || [])[ (t.rounds || []).length - 1 ] || null;
    var session = {
      sessionId: sessionId, tournamentId: t.id, tournamentName: t.name, format: t.format, status: t.status,
      roundNumber: round ? round.roundNumber : 0,
      roundDurationSec: Math.max(0, (t.roundDuration || 0) * 60),
      roundStartedAt: round ? (round.startedAt || null) : null,
      roundPausedDurationMs: round ? (round.pausedDuration || 0) : 0,
      roundPausedAt: round ? (round.pausedAt || null) : null,
      hostUpdatedAt: Date.now(),
      scoring: t.scoring || null
    };
    var tasks = [global.TorneoSync.publishSession(sessionId, session)];
    if (round && round.tables) {
      round.tables.forEach(function (table, idx) {
        if (table.bye) return;
        var tid = table.id || ('t' + (idx + 1));
    var patch = {
          sessionId: sessionId, tableId: tid, tableIndex: idx + 1, roundNumber: round.roundNumber,
          players: normPlayers(t, table), completed: !!table.completed,
          hostPublishedAt: Date.now()
        };
        if (global.TorneoSync.patchTable) tasks.push(global.TorneoSync.patchTable(sessionId, tid, patch, 0));
        else tasks.push(global.TorneoSync.publishTable(sessionId, tid, patch));
      });
    }
    try { localStorage.setItem('commander-tournaments', JSON.stringify(app.tournaments)); } catch (e) {}
    return Promise.all(tasks).catch(function (e) { console.warn('sync publish', e); });
  }

  global.TorneoHostBridge = {
    _tableSubs: {},
    init: function (app) {
      var self = this;
      this.app = app;
      return global.TorneoSync.init().then(function () {
        self.wrapSave(app);
        self.injectUI();
        self.subscribeOfficialReports(app);
        publishCurrent(app);
      }).catch(function (e) { console.warn('TorneoSync init', e); self.injectUI(true); });
    },
    wrapSave: function (app) {
      if (!app || app._syncWrapped) return;
      var self = this;
      var orig = app.saveTournaments.bind(app);
      app.saveTournaments = function () { orig(); publishCurrent(app); try { self.subscribeOfficialReports(app); } catch (e) {} };
      app._syncWrapped = true;
    },
    subscribeOfficialReports: function (app) {
      var t = app && app.getCurrentTournament ? app.getCurrentTournament() : null;
      if (!t || !global.TorneoSync || !global.TorneoSync.ready()) return;
      var sessionId = t.syncSessionId || shortCode(t.id);
      var round = (t.rounds || [])[ (t.rounds || []).length - 1 ];
      if (!round) return;
      var self = this;
      (round.tables || []).forEach(function (table) {
        if (table.bye) return;
        var key = sessionId + '::' + table.id;
        if (self._tableSubs[key]) return;
        self._tableSubs[key] = global.TorneoSync.subscribeTable(sessionId, table.id, function (data) {
          if (!data) return;
          if (data.officialReport && data.officialReport.status === 'submitted' && app.applyOfficialTableReport) {
            app.applyOfficialTableReport(sessionId, table.id, data.officialReport);
          } else if (app.applyLiveTableState) {
            app.applyLiveTableState(sessionId, table.id, data);
          }
        });
      });
    },
    joinUrl: function (sessionId, tableId) {
      return getBaseMesaUrl() + '?session=' + encodeURIComponent(sessionId || '') + (tableId ? '&table=' + encodeURIComponent(tableId) : '');
    },
    injectUI: function () {
      var box = document.getElementById('companion-share-box');
      if (!box) {
        var info = document.getElementById('tournament-info');
        if (!info) return;
        box = document.createElement('div');
        box.id = 'companion-share-box'; box.className = 'companion-share-box';
        info.insertAdjacentElement('afterend', box);
      }
      var app = this.app || global.app;
      var t = app && app.getCurrentTournament ? app.getCurrentTournament() : null;
      if (!t || t.status === 'setup') { box.style.display = 'none'; box.innerHTML = ''; return; }
      var sessionId = t.syncSessionId || shortCode(t.id);
      var mode = (global.TorneoSync && global.TorneoSync.mode) || 'local';
      var round = (t.rounds || [])[ (t.rounds || []).length - 1 ];
      var mesaLinks = (round && round.tables ? round.tables.filter(function(tb){return !tb.bye;}) : []).map(function(tb, i){
        var url = getBaseMesaUrl() + '?session=' + encodeURIComponent(sessionId) + '&table=' + encodeURIComponent(tb.id);
        return '<a class="btn-secondary btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener">Mesa ' + (i+1) + ' (táctil)</a>';
      }).join(' ');
      box.style.display = 'block';
      box.innerHTML = '<div class="companion-share-title"><i class="fas fa-table-cells-large"></i> Mesas táctiles (invitados) <span class="sync-mode sync-mode-' + mode + '">' + (mode === 'firestore' ? 'Tiempo real (Firebase)' : 'Modo local/demo') + '</span></div>'
        + '<div class="companion-share-meta">Código sesión: <strong>' + esc(sessionId) + '</strong>. Vista 2x2 sincronizada: vida/comandante/turno/tiempos. Solo el resultado oficial se guarda en el anfitrión.</div>'
        + '<div class="companion-share-actions">' + (mesaLinks || '<span class="c-counter-hint">Genera una ronda para obtener enlaces por mesa.</span>') + '</div>'
        + (mode !== 'firestore' ? '<p class="companion-share-note">Para celulares distintos configura Firebase + Firestore Rules en <code>js/torneo/firebase-config.js</code>.</p>' : '<p class="companion-share-note">Cada mesa tiene su enlace/ID. Al finalizar, la mesa envía puestos, puntos, duración y tiempos consumidos al panel.</p>');
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      var app = global.app || (typeof window !== 'undefined' && window.app);
      if (!app) return;
      global.TorneoHostBridge.init(app).then(function () {
        var origShow = app.showTournament.bind(app);
        app.showTournament = function (id) { origShow(id); setTimeout(function(){ global.TorneoHostBridge.injectUI(); global.TorneoHostBridge.subscribeOfficialReports(app); publishCurrent(app); }, 0); };
        var origRender = app.renderTournamentDetail.bind(app);
        app.renderTournamentDetail = function () { origRender(); setTimeout(function(){ global.TorneoHostBridge.injectUI(); global.TorneoHostBridge.subscribeOfficialReports(app); }, 0); };
      });
    }, 0);
  });
})(window);
