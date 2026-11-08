(function (global) {
  'use strict';
  function clamp(n, min, max) { n = Number(n); if (isNaN(n)) n = min; return Math.min(max, Math.max(min, n)); }
  function defaultLive(startingLife) {
    return {
      life: typeof startingLife === 'number' ? startingLife : 40,
      poison: 0, energy: 0, experience: 0, commanderTax: 0,
      commanderDamage: {}, eliminated: false, elimination: null, eliminationOrder: null,
      timeUsedSec: 0, lossExceptions: {}
    };
  }
  function ensureLive(table, playerId, startingLife) {
    table.live = table.live || {};
    var cur = table.live[playerId] || {};
    var d = defaultLive(startingLife);
    Object.keys(d).forEach(function (k) { if (cur[k] === undefined) cur[k] = d[k]; });
    cur.commanderDamage = cur.commanderDamage || {};
    cur.lossExceptions = cur.lossExceptions || {};
    table.live[playerId] = cur;
    return cur;
  }
  function conditionKey(c) {
    if (!c) return '';
    return [c.type, c.source || '', c.playerId || ''].join(':');
  }
  function effectiveTimeUsed(table, playerId) {
    var l = ensureLive(table, playerId);
    var used = Number(l.timeUsedSec) || 0;
    if (activePlayerId(table) === playerId && !(l.eliminated)) used += turnElapsedSec(table);
    return used;
  }
  function detectLossConditions(table, playerId, session) {
    var live = ensureLive(table, playerId);
    if (live.eliminated) return [];
    var out = [];
    if ((Number(live.life) || 0) <= 0) out.push({ type: 'life', label: 'Vida en ' + (Number(live.life)||0), detail: 'Tu vida llegó a 0 o menos.' });
    if ((Number(live.poison) || 0) >= 10) out.push({ type: 'poison', label: 'Veneno (' + live.poison + '/10)', detail: 'Acumulaste 10 o más contadores de veneno.' });
    var cd = live.commanderDamage || {};
    for (var op in cd) {
      if ((Number(cd[op] && cd[op].damage) || 0) >= 21) out.push({ type: 'commander', source: op, commanderName: (cd[op] && cd[op].commanderName) || 'Comandante', label: 'Daño de comandante 21+ (' + ((cd[op] && cd[op].commanderName) || op) + ')', detail: 'Recibiste 21 o más de daño del mismo comandante.' });
    }
    if (session && session.roundDurationSec) {
      var budget = playerBudgetSec(session, (table.players||[]).length || 4);
      var used = effectiveTimeUsed(table, playerId);
      if (used >= budget && budget > 0) out.push({ type: 'time', label: 'Tiempo agotado', detail: 'Se agotó tu tiempo asignado (' + Math.floor(budget/60) + ' min).', overSec: used - budget });
    }
    var ex = live.lossExceptions || {};
    return out.filter(function(c){ return !ex[conditionKey(c)]; });
  }
  function eliminationFor(live) { // kept for compatibility; returns first raw condition (ignores exceptions)
    if (!live) return null;
    if ((Number(live.life) || 0) <= 0) return { type: 'life', label: 'Vida en 0' };
    if ((Number(live.poison) || 0) >= 10) return { type: 'poison', label: '10 venenos' };
    var cd = live.commanderDamage || {};
    for (var op in cd) if ((Number(cd[op] && cd[op].damage) || 0) >= 21) return { type: 'commander', source: op, commanderName: (cd[op] && cd[op].commanderName) || 'Comandante', label: '21 de daño de comandante' };
    return null;
  }
  function nextEliminationOrder(table) {
    var max = 0;
    ((table && table.players) || []).forEach(function(p){ var l = table.live && table.live[p.id]; if (l && Number(l.eliminationOrder) > max) max = Number(l.eliminationOrder); });
    return max + 1;
  }
  function confirmElimination(table, playerId, condition, at) {
    var live = ensureLive(table, playerId);
    if (live.eliminated) return live;
    accrueIfActive(table, playerId);
    live.eliminated = true;
    live.eliminationOrder = nextEliminationOrder(table);
    live.elimination = { type: condition && condition.type || 'manual', label: (condition && condition.label) || 'Derrota confirmada', source: condition && condition.source || null, commanderName: condition && condition.commanderName || null, detail: condition && condition.detail || null, at: at || Date.now() };
    // if active player eliminated, pass turn state to next alive without accruing again
    if (activePlayerId(table) === playerId) moveTurnToNextAlive(table, playerId);
    return live;
  }
  function ignoreCondition(live, condition) {
    live.lossExceptions = live.lossExceptions || {};
    live.lossExceptions[conditionKey(condition)] = { at: Date.now(), label: condition.label || condition.type };
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
  function accrueIfActive(table, playerId) {
    if (!table || activePlayerId(table) !== playerId) return;
    var live = ensureLive(table, playerId);
    var elapsed = turnElapsedSec(table);
    if (elapsed > 0) live.timeUsedSec = (Number(live.timeUsedSec)||0) + elapsed;
    table.turn = table.turn || {};
    table.turn.startedAt = Date.now(); table.turn.pausedAt = null; table.turn.pausedMs = 0;
  }
  function accrueActive(table) {
    if (!table) return table;
    var aid = activePlayerId(table); if (!aid) return table;
    accrueIfActive(table, aid); return table;
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
  function moveTurnToNextAlive(table, fromPlayerId) {
    var ps = (table && table.players) || []; if (!ps.length) return table;
    var from = ps.findIndex(function(p){return p.id===fromPlayerId;}); if (from < 0) from = activeIndex(table);
    var next = nextAliveIndex(table, from);
    table.turn = Object.assign({}, table.turn, { index: next, activePlayerId: ps[next].id, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
    return table;
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
  function computeOfficialReport(table, session, reason) {
    if (!table || !table.players || !table.players.length) return null;
    var ps = table.players;
    var n = ps.length;
    var placements = ps.map(function(p, idx){
      var l = ensureLive(table, p.id);
      var place = null;
      if (l.eliminated && Number(l.eliminationOrder) > 0) {
        // 1st out => 4th place for 4 players: place = n - eliminationOrder + 1
        place = n - Number(l.eliminationOrder) + 1;
      }
      return { playerId: p.id, placement: place, elimination: l.elimination || null, eliminationOrder: l.eliminationOrder || null };
    });
    var alive = placements.filter(function(p){ return p.placement == null; });
    alive.sort(function(a,b){
      var la = ensureLive(table,a.playerId), lb = ensureLive(table,b.playerId);
      if ((lb.life||0)!==(la.life||0)) return (lb.life||0)-(la.life||0);
      if ((la.poison||0)!==(lb.poison||0)) return (la.poison||0)-(lb.poison||0);
      return 0;
    });
    var nextPlace = 1;
    alive.forEach(function(p){ p.placement = nextPlace++; });
    placements.filter(function(p){ return !alive.find(function(a){return a.playerId===p.playerId;}) && p.placement==null; }).forEach(function(p){ p.placement = nextPlace++; });
    placements.sort(function(a,b){ return a.placement-b.placement; });
    var started = session && session.roundStartedAt ? session.roundStartedAt : (table.startedAt || Date.now());
    var paused = (session && session.roundPausedDurationMs) || 0;
    if (session && session.roundPausedAt) paused += Math.max(0, Date.now() - session.roundPausedAt);
    var totalDurationSec = Math.max(1, Math.floor((Date.now() - started - paused)/1000));
    var timeConsumedSec = {};
    ps.forEach(function(p){ var l = ensureLive(table,p.id); timeConsumedSec[p.id] = effectiveTimeUsed(table,p.id); });
    return { status: 'final', reason: reason || 'completed', placements: placements, totalDurationSec: totalDurationSec, timeConsumedSec: timeConsumedSec, submittedAt: Date.now(), version: 2 };
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
    clamp: clamp, defaultLive: defaultLive, ensureLive: ensureLive, conditionKey: conditionKey,
    detectLossConditions: detectLossConditions, eliminationFor: eliminationFor,
    confirmElimination: confirmElimination, ignoreCondition: ignoreCondition, nextEliminationOrder: nextEliminationOrder,
    activePlayerId: activePlayerId, activeIndex: activeIndex, turnElapsedSec: turnElapsedSec, effectiveTimeUsed: effectiveTimeUsed,
    accrueActive: accrueActive, accrueIfActive: accrueIfActive, passTurn: passTurn, moveTurnToNextAlive: moveTurnToNextAlive,
    alivePlayers: alivePlayers, computeOfficialReport: computeOfficialReport, roundRemainingSec: roundRemainingSec, playerBudgetSec: playerBudgetSec
  };
})(window);
