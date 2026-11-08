(function (global) {
  'use strict';
  function clamp(n, min, max) { n = Number(n); if (isNaN(n)) n = min; return Math.min(max, Math.max(min, n)); }
  function defaultLive(startingLife) {
    return {
      life: typeof startingLife === 'number' ? startingLife : 40,
      poison: 0, energy: 0, experience: 0, commanderTax: 0,
      commanderDamage: {}, eliminated: false, elimination: null, timeUsedSec: 0
    };
  }
  function ensureLive(table, playerId, startingLife) {
    table.live = table.live || {};
    var cur = table.live[playerId] || {};
    var d = defaultLive(startingLife);
    Object.keys(d).forEach(function (k) { if (cur[k] == null) cur[k] = d[k]; });
    cur.commanderDamage = cur.commanderDamage || {};
    table.live[playerId] = cur;
    return cur;
  }
  function eliminationFor(live, startingLife) {
    if (!live || live.eliminated) return live && live.elimination ? live.elimination : null;
    if ((Number(live.life) || 0) <= 0) return { type: 'life', label: 'Vida en 0' };
    if ((Number(live.poison) || 0) >= 10) return { type: 'poison', label: '10 venenos' };
    var cd = live.commanderDamage || {};
    for (var op in cd) {
      if ((Number(cd[op] && cd[op].damage) || 0) >= 21) return { type: 'commander', source: op, commanderName: (cd[op] && cd[op].commanderName) || 'Comandante', label: '21 de daño de comandante' };
    }
    return null;
  }
  function applyElimination(live, elim, at) {
    if (!elim) return live;
    live.eliminated = true;
    if (!live.elimination) live.elimination = { type: elim.type, label: elim.label, source: elim.source || null, commanderName: elim.commanderName || null, at: at || Date.now() };
    return live;
  }
  function activeIndex(table) {
    if (table && table.turn && typeof table.turn.index === 'number') return table.turn.index;
    return 0;
  }
  function activePlayerId(table) {
    if (table && table.turn && table.turn.activePlayerId) return table.turn.activePlayerId;
    var ps = (table && table.players) || [];
    return ps[activeIndex(table)] ? ps[activeIndex(table)].id : null;
  }
  function turnElapsedSec(table) {
    if (!table || !table.turn || !table.turn.startedAt) return 0;
    if (table.turn.pausedAt) return Math.max(0, Math.floor(((table.turn.pausedAt - table.turn.startedAt) - (table.turn.pausedMs||0)) / 1000));
    return Math.max(0, Math.floor(((Date.now() - table.turn.startedAt) - (table.turn.pausedMs||0)) / 1000));
  }
  function accrueActive(table) {
    if (!table) return table;
    var aid = activePlayerId(table);
    if (!aid) return table;
    var live = ensureLive(table, aid);
    var elapsed = turnElapsedSec(table);
    if (elapsed > 0) live.timeUsedSec = (Number(live.timeUsedSec)||0) + elapsed;
    table.turn = table.turn || {};
    table.turn.startedAt = Date.now();
    table.turn.pausedAt = null;
    table.turn.pausedMs = 0;
    return table;
  }
  function nextAliveIndex(table, from) {
    var ps = (table && table.players) || [];
    if (!ps.length) return 0;
    for (var step = 1; step <= ps.length; step++) {
      var i = (from + step + ps.length) % ps.length;
      var live = table.live && table.live[ps[i].id];
      if (!live || !live.eliminated) return i;
    }
    return from;
  }
  function passTurn(table) {
    if (!table || !table.players || !table.players.length) return table;
    accrueActive(table);
    var cur = activeIndex(table);
    var next = nextAliveIndex(table, cur);
    table.turn = Object.assign({}, table.turn, { index: next, activePlayerId: table.players[next].id, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
    return table;
  }
  function alivePlayers(table) {
    return ((table && table.players) || []).filter(function (p) { var l = table.live && table.live[p.id]; return !(l && l.eliminated); });
  }
  function eliminatedPlayers(table) {
    return ((table && table.players) || []).filter(function (p) { var l = table.live && table.live[p.id]; return l && l.eliminated; }).map(function (p) {
      var l = table.live[p.id]; return { playerId: p.id, name: p.name, at: (l.elimination && l.elimination.at) || 0, elimination: l.elimination };
    }).sort(function (a,b){ return (a.at||0)-(b.at||0); });
  }
  function computeOfficialReport(table, session, reason) {
    if (!table || !table.players || !table.players.length) return null;
    var ps = table.players;
    var eliminated = eliminatedPlayers(table); // earliest first
    var alive = alivePlayers(table);
    // last eliminated = worse among eliminated? elimination order: first eliminated gets last place.
    // placements: winner first. If ended by timeout with multiple alive, rank alive by life desc, poison asc, cmd dmg max asc, then stable.
    var order = [];
    var aliveRank = alive.slice().sort(function (a,b) {
      var la = ensureLive(table, a.id), lb = ensureLive(table, b.id);
      if ((lb.life||0)!==(la.life||0)) return (lb.life||0)-(la.life||0);
      if ((la.poison||0)!==(lb.poison||0)) return (la.poison||0)-(lb.poison||0);
      var ma = 0, mb = 0, ca = la.commanderDamage||{}, cb = lb.commanderDamage||{};
      Object.keys(ca).forEach(function(k){ ma = Math.max(ma, Number(ca[k]&&ca[k].damage)||0); });
      Object.keys(cb).forEach(function(k){ mb = Math.max(mb, Number(cb[k]&&cb[k].damage)||0); });
      return ma-mb;
    });
    order = aliveRank.map(function(p){return p.id;}).concat(eliminated.slice().reverse().map(function(e){return e.playerId;}));
    // ensure all present
    ps.forEach(function(p){ if (order.indexOf(p.id)<0) order.push(p.id); });
    var placements = order.map(function(pid, i){ var l = table.live && table.live[pid]; return { playerId: pid, placement: i+1, elimination: l && l.elimination ? l.elimination : null }; });
    var started = session && session.roundStartedAt ? session.roundStartedAt : (table.startedAt || Date.now());
    var paused = (session && session.roundPausedDurationMs) || 0;
    if (session && session.roundPausedAt) paused += Math.max(0, Date.now() - session.roundPausedAt);
    var totalDurationSec = Math.max(1, Math.floor((Date.now() - started - paused)/1000));
    var timeConsumedSec = {};
    ps.forEach(function(p){ var l = ensureLive(table,p.id); timeConsumedSec[p.id] = Number(l.timeUsedSec)||0; });
    // include active turn accrual snapshot? use stored timeUsedSec; companion should accrue before submit.
    return { status: 'final', reason: reason || 'completed', placements: placements, totalDurationSec: totalDurationSec, timeConsumedSec: timeConsumedSec, submittedAt: Date.now(), version: 1 };
  }
  function roundRemainingSec(session) {
    if (!session || !session.roundDurationSec) return 0;
    if (!session.roundStartedAt) return session.roundDurationSec;
    var paused = session.roundPausedDurationMs || 0;
    if (session.roundPausedAt) paused += Math.max(0, Date.now() - session.roundPausedAt);
    var elapsed = Math.floor((Date.now() - session.roundStartedAt - paused) / 1000);
    return Math.max(0, session.roundDurationSec - elapsed);
  }
  function playerBudgetSec(session, playerCount) {
    var n = Math.max(1, playerCount || 4);
    return Math.floor(((session && session.roundDurationSec) || 3000) / n);
  }
  global.CompanionModel = {
    clamp: clamp, defaultLive: defaultLive, ensureLive: ensureLive,
    eliminationFor: eliminationFor, applyElimination: applyElimination,
    activePlayerId: activePlayerId, activeIndex: activeIndex, turnElapsedSec: turnElapsedSec,
    accrueActive: accrueActive, passTurn: passTurn, alivePlayers: alivePlayers,
    computeOfficialReport: computeOfficialReport, roundRemainingSec: roundRemainingSec, playerBudgetSec: playerBudgetSec
  };
})(window);
