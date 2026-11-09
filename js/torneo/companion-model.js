(function (global) {
  'use strict';
  function clamp(n, min, max) { n = Number(n); if (isNaN(n)) n = min; return Math.min(max, Math.max(min, n)); }
  function defaultLive(startingLife) {
    return {
      life: typeof startingLife === 'number' ? startingLife : 40,
      poison: 0, energy: 0, experience: 0, commanderTax: 0,
      storm: 0, manaPool: 0, monarch: false, initiative: false, extra: {},
      commanderDamage: {}, eliminated: false, elimination: null, eliminationOrder: null,
      timeUsedSec: 0, lossExceptions: {}, bounties: 0
    };
  }
  function ensureLive(table, playerId, startingLife) {
    table.live = table.live || {};
    var cur = table.live[playerId] || {};
    var d = defaultLive(startingLife);
    Object.keys(d).forEach(function (k) { if (cur[k] === undefined) cur[k] = d[k]; });
    cur.commanderDamage = cur.commanderDamage || {};
    cur.lossExceptions = cur.lossExceptions || {};
    cur.extra = cur.extra || {};
    table.live[playerId] = cur;
    return cur;
  }
  function conditionKey(c) {
    if (!c) return '';
    return [c.type, c.source || '', c.playerId || ''].join(':');
  }
  function interactionElapsedSec(table, playerId) {
    var l = ensureLive(table, playerId);
    if (!l || l.eliminated || !l.interactionActiveAt) return 0;
    // pausa global/turno congela interacción fuera de turno
    if (table && table.turn && table.turn.pausedAt) return 0;
    if (table && table.turn && !(table.turn.started || table.turn.startedAt)) return 0;
    var pausedMs = Number(l.interactionPausedMs) || 0;
    return Math.max(0, Math.floor((Date.now() - Number(l.interactionActiveAt) - pausedMs) / 1000));
  }
  function effectiveTimeUsed(table, playerId) {
    var l = ensureLive(table, playerId);
    var used = Number(l.timeUsedSec) || 0;
    if (activePlayerId(table) === playerId && !(l.eliminated)) used += turnElapsedSec(table);
    // tiempo de interacción fuera de turno (independiente del turno activo); evita doble conteo si es el jugador activo
    if (!(activePlayerId(table) === playerId && !(l.eliminated))) used += interactionElapsedSec(table, playerId);
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
  function fmtRoundClock(session, at) {
    if (!session || !session.roundStartedAt) return null;
    var paused = session.roundPausedDurationMs || 0;
    var ts = at || Date.now();
    if (session.roundPausedAt && ts > session.roundPausedAt) paused += (ts - session.roundPausedAt);
    var sec = Math.max(0, Math.floor((ts - session.roundStartedAt - paused) / 1000));
    var m = Math.floor(sec / 60), s = sec % 60;
    return { sec: sec, label: String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') };
  }
  function nextEliminationOrder(table) {
    var max = 0;
    ((table && table.players) || []).forEach(function(p){ var l = table.live && table.live[p.id]; if (l && Number(l.eliminationOrder) > max) max = Number(l.eliminationOrder); });
    return max + 1;
  }
  function motivoEliminacionFrom(condition){
    var c = condition || {}; var t = String(c.type||'').toLowerCase(); var label = String(c.label||'').toLowerCase();
    if (t==='surrender' || t==='rendicion' || label.indexOf('rendici')>=0) return 'rendicion';
    if (t==='time' || t==='tiempo' || t==='timeout' || t==='tiempo_agotado' || label.indexOf('tiempo')>=0) return 'tiempo_agotado';
    if (t==='life' || t==='commander' || t==='poison' || t==='dano_letal' || label.indexOf('vida')>=0 || label.indexOf('comandante')>=0 || label.indexOf('veneno')>=0 || label.indexOf('letal')>=0) return 'dano_letal';
    return 'dano_letal';
  }
  function motivoEliminacionLabel(code){ if(code==='rendicion') return 'Rendición'; if(code==='tiempo_agotado') return 'Tiempo agotado'; return 'Daño letal'; }
  function confirmElimination(table, playerId, condition, at, session, extra) {
    var live = ensureLive(table, playerId);
    if (live.eliminated) return live;
    accrueIfActive(table, playerId);
    var ts = at || Date.now();
    var clock = fmtRoundClock(session, ts);
    live.eliminated = true;
    live.eliminationOrder = nextEliminationOrder(table);
    live.timeUsedSec = effectiveTimeUsed(table, playerId); // snapshot at elimination
    var elimBy = (extra && extra.eliminatedBy) || (condition && condition.eliminatedBy) || null;
    var motivo = motivoEliminacionFrom(condition);
    live.motivoEliminacion = motivo;
    live.motivoEliminacionLabel = motivoEliminacionLabel(motivo);
    live.elimination = {
      type: condition && condition.type || 'manual',
      label: (condition && condition.label) || 'Derrota confirmada',
      source: condition && condition.source || null, commanderName: condition && condition.commanderName || null,
      detail: condition && condition.detail || null,
      eliminatedBy: elimBy,
      motivoEliminacion: motivo,
      cause: motivo,
      motivoEliminacionLabel: motivoEliminacionLabel(motivo),
      at: ts,
      timeOfElimination: clock ? clock.label : null,
      timeOfEliminationSec: clock ? clock.sec : null,
      playerTurnTimeSec: Math.max(0, Math.floor(Number(live.timeUsedSec) || 0)),
      playerTurnTime: (function(sec){ var m=Math.floor(sec/60),s=sec%60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); })(Math.max(0, Math.floor(Number(live.timeUsedSec) || 0)))
    };
    // if active player eliminated, pass turn state to next alive without accruing again
    if (activePlayerId(table) === playerId) moveTurnToNextAlive(table, playerId);
    return live;
  }
  function addBounty(table, killerId) {
    if (!table || !killerId) return 0;
    var live = ensureLive(table, killerId);
    live.bounties = (Number(live.bounties) || 0) + 1;
    return live.bounties;
  }
  function ignoreCondition(live, condition) {
    live.lossExceptions = live.lossExceptions || {};
    live.lossExceptions[conditionKey(condition)] = { at: Date.now(), label: condition.label || condition.type };
    return live;
  }
  function activeIndex(table) {
    var ps = (table && table.players) || [];
    // Prefer activePlayerId: it matches the visible active seat; turn.index may be stale after sync/edits.
    if (table && table.turn && table.turn.activePlayerId && ps.length) {
      var byId = ps.findIndex(function(p){ return p && p.id === table.turn.activePlayerId; });
      if (byId >= 0) return byId;
    }
    if (table && table.turn && typeof table.turn.index === 'number' && table.turn.index >= 0 && table.turn.index < ps.length) return table.turn.index;
    return 0;
  }
  function activePlayerId(table) {
    var ps = (table && table.players) || [];
    if (table && table.turn && table.turn.activePlayerId) return table.turn.activePlayerId;
    var i = (table && table.turn && typeof table.turn.index === 'number') ? table.turn.index : 0;
    return ps[i] ? ps[i].id : (ps[0] ? ps[0].id : null);
  }
  function turnElapsedSec(table) {
    if (!table || !table.turn) return 0;
    var turn = table.turn;
    if (turn.started === false && !turn.startedAt) return 0;
    if (!turn.startedAt) return 0;
    if (turn.pausedAt) return Math.max(0, Math.floor(((turn.pausedAt - turn.startedAt) - (turn.pausedMs||0)) / 1000));
    return Math.max(0, Math.floor(((Date.now() - turn.startedAt) - (turn.pausedMs||0)) / 1000));
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
  function turnOrderIndices(table){
    var ps=(table&&table.players)||[], n=ps.length;
    // Allow explicit override from host/session if present.
    var explicit = (table&&table.turn&&table.turn.orderIndices) || (table&&table.turnOrderIndices);
    if(Array.isArray(explicit) && explicit.length===n){
      var ok=true; for(var e=0;e<explicit.length;e++) if(explicit.indexOf(e)<0){ ok=false; break; }
      if(ok) return explicit.slice();
    }
    // Physical antihorario (counter-clockwise) for Mesa Táctil 4 seats per requested mapping:
    // 1) A Arriba-Derecha -> 2) B Abajo-Derecha -> 3) C Abajo-Izquierda -> 4) D Arriba-Izquierda -> 1)
    // Default .m-grid.seats-4 auto-flow (no explicit grid-area): row1=[pos-0 top-left, pos-1 top-right], row2=[pos-2 bottom-left, pos-3 bottom-right].
    // Antihorario physical: top-right(1) -> bottom-right(3) -> bottom-left(2) -> top-left(0) => [1,3,2,0].
    if(n===4) return [1,3,2,0];
    // Generic fallback: circular by rendered seat index.
    var out=[]; for(var i=0;i<n;i++) out.push(i); return out;
  }
  function nextAliveIndex(table, from) {
    var ps = (table && table.players) || [];
    if (!ps.length) return 0;
    var n = ps.length;
    var base = (typeof from === 'number' && isFinite(from)) ? ((from % n) + n) % n : activeIndex(table);
    var order = turnOrderIndices(table);
    var pos = order.indexOf(base);
    if(pos < 0) pos = 0;
    for (var step = 1; step <= order.length; step++) {
      var i = order[(pos + step) % order.length];
      var live = table.live && table.live[ps[i].id];
      if (!live || !live.eliminated) return i;
    }
    return base;
  }
  function moveTurnToNextAlive(table, fromPlayerId) {
    var ps = (table && table.players) || []; if (!ps.length) return table;
    accrueActive(table);
    var from = ps.findIndex(function(p){return p.id===fromPlayerId;});
    if (from < 0) from = activeIndex(table);
    var next = nextAliveIndex(table, from);
    table.turn = Object.assign({}, table.turn, { index: next, activePlayerId: ps[next].id, started: true, startedAt: Date.now(), turnStartedAt: Date.now(), pausedAt: null, pausedMs: 0 });
    return table;
  }
  function passTurn(table) {
    if (!table || !table.players || !table.players.length) return table;
    var aid = activePlayerId(table);
    accrueActive(table);
    var cur = activeIndex(table); // resolved from activePlayerId first
    var next = nextAliveIndex(table, cur);
    table.turn = table.turn || {};
    table.turn.totalTurnos = Math.max(0, Number(table.turn.totalTurnos) || 0) + 1; // turnos completados de la mesa
    if (aid) {
      table.live = table.live || {};
      var al = ensureLive(table, aid);
      al.turnosEjecutados = Math.max(0, Number(al.turnosEjecutados) || 0) + 1;
      al.turnosTotalesParticipacion = al.turnosEjecutados;
    }
    table.turn = Object.assign({}, table.turn, { index: next, activePlayerId: table.players[next].id, started: true, startedAt: Date.now(), turnStartedAt: Date.now(), pausedAt: null, pausedMs: 0 });
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
      var elim = l.elimination || null;
      var motivo = (elim && (elim.motivoEliminacion||elim.cause)) || l.motivoEliminacion || (l.eliminated ? motivoEliminacionFrom(elim||{type:'manual',label:'Derrota confirmada'}) : null);
      // commander damage dealt by this player (sum of damage dealt to others as source in live maps is tracked per victim; compute dealt from all victims)
      var cmdrDealt = 0; ((table && table.players) || []).forEach(function(v){ var vl=(table.live&&table.live[v.id])||{}; var cd=vl.commanderDamage||{}; if(cd[p.id] && cd[p.id].damage!=null) cmdrDealt += Math.max(0, Number(cd[p.id].damage)||0); });
      return { playerId: p.id, playerName: p.name||p.playerName||p.id, nombreJugador: p.name||p.playerName||p.id, name: p.name||p.playerName||p.id, puestoFinal: place, placement: place, elimination: elim, eliminationOrder: l.eliminationOrder || null, motivoEliminacion: motivo, motivoEliminacionLabel: motivo ? motivoEliminacionLabel(motivo) : null, cause: motivo,
        timeOfElimination: elim && (elim.timeOfElimination || null), timeOfEliminationSec: elim && (elim.timeOfEliminationSec != null ? elim.timeOfEliminationSec : null),
        playerTurnTimeSec: Math.max(0, Math.floor(Number(l.timeUsedSec) || effectiveTimeUsed(table,p.id) || 0)),
        playerTurnTime: elim && elim.playerTurnTime ? elim.playerTurnTime : (function(sec){ var m=Math.floor(sec/60),s=sec%60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); })(Math.max(0, Math.floor(Number(l.timeUsedSec) || effectiveTimeUsed(table,p.id) || 0))),
        bounties: Math.max(0, Number(l.bounties) || 0), bountiesObtenidos: Math.max(0, Number(l.bounties) || 0),
        commanderDamageDealt: cmdrDealt, danoComandanteInfligido: cmdrDealt,
        tiempoConsumido: (function(sec){ var m=Math.floor(sec/60),s=sec%60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); })(Math.max(0, Math.floor(Number(l.timeUsedSec) || effectiveTimeUsed(table,p.id) || 0)))
      };
    });
    var alive = placements.filter(function(p){ return p.placement == null; });
    alive.sort(function(a,b){
      var la = ensureLive(table,a.playerId), lb = ensureLive(table,b.playerId);
      if ((lb.life||0)!==(la.life||0)) return (lb.life||0)-(la.life||0);
      if ((la.poison||0)!==(lb.poison||0)) return (la.poison||0)-(lb.poison||0);
      // stable: keep table order if indistinguishable
      var ai = ps.findIndex(function(x){return x.id===a.playerId;}), bi = ps.findIndex(function(x){return x.id===b.playerId;});
      return ai-bi;
    });
    // Empate técnico: posiciones en disputa (1..N vivos o bloque empatado) se promedian y asignan a todos.
    function setTieBlock(list, startPlace){
      var count=list.length; if(!count) return;
      var sum=0; for(var k=0;k<count;k++) sum += (n - (startPlace + k) + 1);
      var avg = count ? (sum / count) : 0;
      avg = Math.round(avg * 100) / 100;
      for(var j=0;j<count;j++){ list[j].placement = startPlace; list[j].puestoFinal = startPlace; list[j].tied = count>1; list[j].tieCount = count; list[j].points = avg; list[j].puntos = avg; list[j].puntosEmpate = avg; }
    }
    var nextPlace = 1;
    var i=0;
    while(i < alive.length){
      var j=i+1;
      var la0 = ensureLive(table, alive[i].playerId);
      while(j < alive.length){
        var lb0 = ensureLive(table, alive[j].playerId);
        var same = ((Number(lb0.life)||0) === (Number(la0.life)||0)) && ((Number(la0.poison)||0) === (Number(lb0.poison)||0));
        if(!same) break;
        j++;
      }
      setTieBlock(alive.slice(i,j), nextPlace);
      nextPlace += (j-i);
      i=j;
    }
    // Eliminados conservan su puesto por orden de eliminación (no reciben puntos recalculados aquí; host usa placement).
    placements.forEach(function(p){ if(p.points==null && p.placement!=null){ var pts = n - Number(p.placement) + 1; p.points=pts; p.puntos=pts; } p.puestoFinal = p.placement; });
    placements.sort(function(a,b){ return Number(a.placement)-Number(b.placement) || (a.tieCount?0:1)-(b.tieCount?0:1) || (a.playerName||'').localeCompare(b.playerName||''); });
    var started = session && session.roundStartedAt ? session.roundStartedAt : (table.startedAt || Date.now());
    var paused = (session && session.roundPausedDurationMs) || 0;
    if (session && session.roundPausedAt) paused += Math.max(0, Date.now() - session.roundPausedAt);
    var totalDurationSec = Math.max(1, Math.floor((Date.now() - started - paused)/1000));
    var totalTurnos = Math.max(0, Number((table.turn && table.turn.totalTurnos) || table.totalTurnos) || 0);
    var winner = placements.find(function(p){ return Number(p.placement)===1; }) || null;
    var timeConsumedSec = {};
    ps.forEach(function(p){
      var l = ensureLive(table,p.id);
      timeConsumedSec[p.id] = effectiveTimeUsed(table,p.id);
      var pl = placements.find(function(x){ return x.playerId===p.id; });
      if(pl){
        pl.turnosEjecutados = Math.max(0, Number(l.turnosEjecutados) || 0);
        pl.turnosTotales = totalTurnos; // turnos totales que duró la partida
        pl.totalTurnos = totalTurnos;
        pl.tiempoConsumidoTurnos = pl.playerTurnTime || pl.playerTurnTimeSec;
        if(pl.placement===1 && !pl.motivoEliminacion){
          pl.resultado = 'victoria';
          pl.victoryAt = (l.victoryAt || (table.turn && table.turn.victoryAt) || Date.now());
          pl.tiempoVictoriaSec = Math.max(0, Math.floor((pl.victoryAt - started - paused)/1000)) || totalDurationSec;
          pl.tiempoVictoria = (function(sec){ var m=Math.floor(sec/60),s=sec%60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); })(pl.tiempoVictoriaSec);
          pl.tiempoTotalSec = pl.tiempoVictoriaSec;
          pl.tiempoTotal = pl.tiempoVictoria;
        } else {
          pl.tiempoTotalSec = Math.max(0, Math.floor(Number(l.timeUsedSec) || effectiveTimeUsed(table,p.id) || 0));
          pl.tiempoTotal = pl.playerTurnTime || (function(sec){ var m=Math.floor(sec/60),s=sec%60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); })(pl.tiempoTotalSec);
        }
      }
    });
    var bracket = (session && (session.bracket || session.bracketLevel)) || (table && (table.bracket || table.bracketLevel)) || null;
    return { status: 'final', reason: reason || 'completed', placements: placements, totalDurationSec: totalDurationSec, tiempoTotalSec: totalDurationSec, tiempoTotal: (function(sec){ var m=Math.floor(sec/60),s=sec%60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); })(totalDurationSec), turnosTotales: totalTurnos, totalTurnos: totalTurnos, winnerId: winner ? winner.playerId : null, winnerVictoryAt: winner ? (winner.victoryAt || null) : null, bracket: bracket, timeConsumedSec: timeConsumedSec, submittedAt: Date.now(), version: 3 };
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
    clamp: clamp, defaultLive: defaultLive, ensureLive: ensureLive, conditionKey: conditionKey, fmtRoundClock: fmtRoundClock,
    detectLossConditions: detectLossConditions, eliminationFor: eliminationFor,
    confirmElimination: confirmElimination, ignoreCondition: ignoreCondition, nextEliminationOrder: nextEliminationOrder,
    activePlayerId: activePlayerId, activeIndex: activeIndex, turnElapsedSec: turnElapsedSec, effectiveTimeUsed: effectiveTimeUsed,
    accrueActive: accrueActive, accrueIfActive: accrueIfActive, passTurn: passTurn, moveTurnToNextAlive: moveTurnToNextAlive,
    alivePlayers: alivePlayers, computeOfficialReport: computeOfficialReport, roundRemainingSec: roundRemainingSec, playerBudgetSec: playerBudgetSec, addBounty: addBounty
  };
})(window);
