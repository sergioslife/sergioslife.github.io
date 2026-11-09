(function () {
  'use strict';
  var qs = new URLSearchParams(location.search);
  var S = { sessionId: (qs.get('sesion')||qs.get('session')||'').toUpperCase().trim(), tableId: (function(v){ v=String(v||'').trim(); if(!v) return ''; if(/^\d+$/.test(v)) return 'mesa-' + v; return v; })(qs.get('mesa')||qs.get('table')||qs.get('id')||''), session: null, table: null, unsubs: [], tick: null, localView: {}, lossModal: null, autoSubmitted: false, playerModal: null, animatingPick: false, joining: false, modalPauseCount: 0, autoPausedByModal: false, modalPauseNotice: "" };
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  var fmt = function(sec){ sec=Math.floor(Number(sec)||0); var neg=sec<0; sec=Math.abs(sec); var m=Math.floor(sec/60),s=sec%60; return (neg?'-':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); };
  var SVG = {
    skull:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M12 2a8 8 0 0 0-8 8v3.2A3.8 3.8 0 0 0 6.5 17H7v3h3v-2h4v2h3v-3h.5A3.8 3.8 0 0 0 20 13.2V10a8 8 0 0 0-8-8Zm-3 9.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm6 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z"/></svg>',
    bolt:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M13 2 4 14h6l-1 8 11-14h-6l-1-6Z"/></svg>',
    star:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="m12 2.7 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 8.9l5.9-.9L12 2.7Z"/></svg>',
    storm:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M7.5 18.5a4.5 4.5 0 0 1-.7-8.9A6 6 0 0 1 18.4 10a3.8 3.8 0 0 1-.4 7.5h-2.2l-1.3 3.8h-2l1-3.8h-2l-1.2 3.8h-2l1-3.8H7.5Z"/></svg>',
    mana:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M12 2.5S6 9.2 6 13.5A6 6 0 0 0 18 13.5C18 9.2 12 2.5 12 2.5Z"/></svg>',
    coins:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M12 3C7 3 3 4.8 3 7s4 4 9 4 9-1.8 9-4-4-4-9-4Zm9 6.2c-1.8 1.7-5.2 2.8-9 2.8s-7.2-1.1-9-2.8V12c0 2.2 4 4 9 4s9-1.8 9-4V9.2Zm0 5c-1.8 1.7-5.2 2.8-9 2.8s-7.2-1.1-9-2.8V17c0 2.2 4 4 9 4s9-1.8 9-4v-2.8Z"/></svg>',
    crown:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M3 7.5 7.5 11 12 4.5 16.5 11 21 7.5V18H3V7.5Zm2 8.5h14v-5.1l-2.8 2.2L12 8.3l-4.2 4.8L5 10.9V16Z"/></svg>',
    dungeon:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M5 21V10.5L12 4l7 6.5V21h-4v-6h-6v6H5Zm6-12.5V11h2V8.5h-2Z"/></svg>',
    cmdr:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M5 20v-2l2-2v-4.2l-2.2-1.3V8l3.2 1.8L9 7.2V5l3 2 3-2v2.2l1 2.6L19.2 8v2.5L17 11.8V16l2 2v2H5Z"/></svg>',
    sliders:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M4 7h7a2 2 0 0 0 3.7 0H20v2h-5.3A2 2 0 0 0 11 9H4V7Zm0 8h3a2 2 0 0 0 3.7 0H20v2h-9.3A2 2 0 0 0 7 17H4v-2Zm8-13a2 2 0 0 0-1.7 1H4v2h6.3A2 2 0 1 0 12 2Z"/></svg>',
    flag:'<svg viewBox="0 0 24 24" class="m-svg" aria-hidden="true"><path fill="currentColor" d="M6 3h2v18H6V3Zm3 2h10l-2 3 2 3H9V5Z"/></svg>'
  };
  function iconSvg(key, fallback){ return SVG[key] || SVG[fallback||'sliders'] || ''; }
  function normTableId(v){ v=String(v||'').trim(); if(!v) return ''; if(/^\d+$/.test(v)) return 'mesa-' + v; return v; }
  function badge(){ var b=$('m-sync'); if(!b||!window.TorneoSync) return; var m=TorneoSync.mode||'local'; b.className='sync-mode sync-mode-'+m; b.textContent=m==='firestore'?'tiempo real':'local'; }
  function persistTable(patch, delay){ if(!S.sessionId||!S.tableId||!window.TorneoSync) return Promise.resolve(); return TorneoSync.patchTable(S.sessionId,S.tableId,patch,delay); }
  function flushTable(){ if(!S.sessionId||!S.tableId||!window.TorneoSync||!TorneoSync.flushTable) return; TorneoSync.flushTable(S.sessionId,S.tableId); }
  function ensureTableState() { if (!S.table) return; S.table.live = S.table.live || {}; S.table.turn = S.table.turn || {}; (S.table.players || []).forEach(function(p){ CompanionModel.ensureLive(S.table, p.id, 40); }); if (S.table.turn.index == null) { var ps=S.table.players||[]; var idx = ps.findIndex(function(p){ return p.id === S.table.turn.activePlayerId; }); S.table.turn.index = idx >= 0 ? idx : null; } if (S.table.turn.started && !S.table.turn.activePlayerId) { var ps2=S.table.players||[]; if (ps2[0]) { S.table.turn.index = 0; S.table.turn.activePlayerId = ps2[0].id; S.table.turn.turnStartedAt = Date.now(); } } }
  function placeLabel(live, total) { if (!live || !live.eliminated || !live.eliminationOrder) return ''; var place = total - Number(live.eliminationOrder) + 1; return place + 'º puesto'; }
  function aliveCount(){ return S.table ? CompanionModel.alivePlayers(S.table).length : 0; }
  function openModal(id){ var m=$(id); if(!m) return; m.classList.add("is-open"); m.style.display='flex'; m.style.visibility='visible'; m.setAttribute('aria-hidden','false'); }
  function closeModal(id){ var m=$(id); if(!m) return; m.classList.remove("is-open"); m.style.display='none'; m.setAttribute('aria-hidden','true'); }

  function isPaused(){ return !!(S.session && S.session.roundPausedAt) || !!(S.table && S.table.turn && S.table.turn.pausedAt); }
  function pauseNotice(msg){ S.modalPauseNotice = msg || ''; renderTop(); }
  function canAutoPause(){ return !!(S.session && S.session.roundStartedAt && S.table && S.table.turn && (S.table.turn.started||S.table.turn.startedAt)); }
  function autoPauseForModal(reason){
    if(!canAutoPause()) return false;
    S.modalPauseCount = (S.modalPauseCount||0) + 1;
    if(S.modalPauseCount > 1) { pauseNotice(reason || 'Partida en pausa por menú'); return true; }
    if(isPaused()) { S.autoPausedByModal = false; pauseNotice(reason || 'Partida en pausa por menú'); return false; } // already manually/externally paused
    var now=Date.now();
    ensureTableState();
    S.table.turn.pausedAt = now;
    S.session.roundPausedAt = now;
    S.autoPausedByModal = true;
    if(window.TorneoSync && TorneoSync.patchSession) { try{ TorneoSync.patchSession(S.sessionId, {roundPausedAt: now}); }catch(e){} }
    persistTable({turn:JSON.parse(JSON.stringify(S.table.turn))},0).then(function(){ try{flushTable();}catch(e){} }).catch(function(){});
    pauseNotice(reason || 'Partida en pausa por menú');
    try{updateCenterIsland();}catch(e){}
    return true;
  }
  function autoResumeFromModal(){
    S.modalPauseCount = Math.max(0, (S.modalPauseCount||0) - 1);
    if(S.modalPauseCount > 0) return false;
    var wasAuto = !!S.autoPausedByModal;
    S.autoPausedByModal = false; S.modalPauseNotice = '';
    if(!wasAuto) { renderTop(); try{updateCenterIsland();}catch(e){} return false; }
    if(!S.table || !S.table.turn || !S.table.turn.pausedAt) { renderTop(); try{updateCenterIsland();}catch(e){} return false; }
    var now=Date.now();
    var pAt = S.table.turn.pausedAt || S.session.roundPausedAt || now;
    var add = Math.max(0, now - pAt);
    S.table.turn.pausedAt = null; S.table.turn.pausedMs = (Number(S.table.turn.pausedMs)||0) + add;
    var sessPatch={};
    if(S.session && S.session.roundPausedAt){ sessPatch.roundPausedDurationMs = (Number(S.session.roundPausedDurationMs)||0) + Math.max(0, now - S.session.roundPausedAt); sessPatch.roundPausedAt = null; S.session.roundPausedDurationMs=sessPatch.roundPausedDurationMs; S.session.roundPausedAt=null; }
    if(window.TorneoSync && TorneoSync.patchSession && Object.keys(sessPatch).length) { try{ TorneoSync.patchSession(S.sessionId, sessPatch); }catch(e){} }
    persistTable({turn:JSON.parse(JSON.stringify(S.table.turn))},0).then(function(){ try{flushTable();}catch(e){} renderTop(); try{updateCenterIsland();}catch(e){} try{renderGrid();}catch(e){} }).catch(function(){});
    renderTop(); try{updateCenterIsland();}catch(e){} try{renderGrid();}catch(e){}
    return true;
  }
  function forceCloseInteractiveModals(){
    var had = !!S.playerModal || !!S.lossModal;
    if(S.playerModal){ S.playerModal=null; closeModal('m-player-modal'); }
    if(S.lossModal){ S.lossModal=null; closeModal('m-loss-modal'); }
    if(had){ S.modalPauseCount = 0; S.autoPausedByModal = false; S.modalPauseNotice=''; }
  }

  function updateCenterIsland(){
    var btn=$('m-global-pause'), icon=$('m-global-pause-icon'), hint=$('m-center-hint'); if(!btn||!icon) return;
    var paused=isPaused(); var started=!!(S.table && S.table.turn && (S.table.turn.started||S.table.turn.startedAt));
    if(!S.session || !S.session.roundStartedAt){ icon.className='fas fa-play'; btn.className='m-island-btn play'; if(hint) hint.textContent='esperando ronda'; btn.disabled=true; return; }
    btn.disabled=false;
    if(!started){ icon.className='fas fa-play'; btn.className='m-island-btn play'; if(hint) hint.textContent='iniciar turno'; return; }
    if(paused){ icon.className='fas fa-play'; btn.className='m-island-btn play'; if(hint) hint.textContent='pausado'; }
    else { icon.className='fas fa-pause'; btn.className='m-island-btn'; if(hint) hint.textContent='en juego'; }
  }
  function toggleGlobalPause(){
    if(!S.session || !S.table) return;
    S.autoPausedByModal = false; S.modalPauseNotice = S.modalPauseCount>0 ? S.modalPauseNotice : "";
    var now=Date.now();
    if(!S.session.roundStartedAt){ alert('El anfitrión aún no inicia la ronda global.'); return; }
    var started=!!(S.table.turn && (S.table.turn.started||S.table.turn.startedAt));
    if(!started){ startLocalTime(); updateCenterIsland(); return; }
    ensureTableState();
    if(isPaused()){
      // resume: add paused duration
      var pAt = S.table.turn.pausedAt || S.session.roundPausedAt || now;
      var add = Math.max(0, now - pAt);
      S.table.turn.pausedAt = null; S.table.turn.pausedMs = (Number(S.table.turn.pausedMs)||0) + add;
      // session-level pause resume (best effort shared)
      var sessPatch={};
      if(S.session.roundPausedAt){ sessPatch.roundPausedDurationMs = (Number(S.session.roundPausedDurationMs)||0) + Math.max(0, now - S.session.roundPausedAt); sessPatch.roundPausedAt = null; S.session.roundPausedDurationMs=sessPatch.roundPausedDurationMs; S.session.roundPausedAt=null; }
      if(TorneoSync && TorneoSync.patchSession && Object.keys(sessPatch).length) { try{ TorneoSync.patchSession(S.sessionId, sessPatch); }catch(e){} }
    } else {
      // pause turn; also mark session paused for shared timer freeze
      S.table.turn.pausedAt = now;
      var sessPatch2={ roundPausedAt: now };
      S.session.roundPausedAt = now;
      if(TorneoSync && TorneoSync.patchSession) { try{ TorneoSync.patchSession(S.sessionId, sessPatch2); }catch(e){} }
    }
    persistTable({turn:JSON.parse(JSON.stringify(S.table.turn))},0).then(function(){ try{flushTable();}catch(e){} });
    renderTop(); renderGrid(); updateCenterIsland();
  }

  function renderTop() {
    if (!S.session || !S.table) return;
    ensureTableState();
    var el, ps = S.table.players || [];
    if ((el=$('m-title'))) el.textContent = (S.session.tournamentName || 'Mesa') + ' · ' + (S.table.tableIndex ? ('Mesa ' + S.table.tableIndex) : S.tableId);
    if ((el=$('m-sub'))) el.textContent = S.sessionId + ' · R' + (S.session.roundNumber||'-') + ' · ' + aliveCount() + '/' + ps.length + ' vivos';
    var rem = CompanionModel.roundRemainingSec(S.session);
    var rt = $('m-round-timer'); if (rt) { rt.textContent = fmt(rem); rt.className = (rem<=60?'danger':rem<=300?'warn':''); }
    if ((el=$('m-round-meta'))) el.textContent = !S.session.roundStartedAt ? 'esperando anfitrión' : (S.session.roundPausedAt ? 'pausada' : (rem===0 ? 'agotado' : 'en curso'));
    var started = !!(S.table.turn && (S.table.turn.started || S.table.turn.startedAt));
    var ap = ps.find(function(p){return p.id===CompanionModel.activePlayerId(S.table);});
    if ((el=$('m-active-name'))) el.textContent = (started && !isPaused()) ? (ap ? ap.name : '-') : (started && isPaused() ? ((ap ? ap.name : '-') + ' · pausa') : ((ap ? ap.name : '-') + ' · listo'));
    if ((el=$('m-active-time'))) el.textContent = started ? fmt(CompanionModel.turnElapsedSec(S.table)) : '00:00';
    var paused=isPaused(); var pass = $('m-pass-turn'); if (pass) { pass.disabled = !started || !!paused; pass.style.display = started ? '' : 'none'; }
    var fab = $('m-pass-fab'); if (fab) { fab.disabled = !started || !!(typeof isPaused==='function'&&isPaused()); }
    var tog = $('m-toggle-official'); if (tog) tog.style.display = '';
    var startModal = $('m-start-modal');
    if (!started && ps.length && !S.playerModal && !S.lossModal) { if (startModal && startModal.style.display === 'none') openModal('m-start-modal'); } else if (started && startModal) closeModal('m-start-modal');
    var startBtn = $('m-start-time'); if (startBtn) startBtn.disabled = !(S.table.turn && S.table.turn.activePlayerId) || !!S.animatingPick;
    renderOfficialPreview(); checkPendingLossModal(); try{updateCenterIsland();}catch(e){} updateCenterIsland();
  }
  function quadrant(p, idx, n) {
    var live = CompanionModel.ensureLive(S.table, p.id, 40), aid = CompanionModel.activePlayerId(S.table);
    var active = aid === p.id && !live.eliminated && S.table.turn && (S.table.turn.started || S.table.turn.startedAt) && !S.table.turn.pausedAt;
    var conditions = CompanionModel.detectLossConditions(S.table, p.id, S.session), warn = conditions.length ? conditions[0] : null;
    var budget = CompanionModel.playerBudgetSec(S.session, (S.table.players||[]).length || 4), used = CompanionModel.effectiveTimeUsed(S.table, p.id), left = budget - used;
    var timeClass = left < 0 ? 'danger' : (left <= 120 ? 'warn' : '');
    var status = live.eliminated ? ('Has muerto · ' + placeLabel(live, (S.table.players||[]).length)) : (warn ? ('Condición: ' + esc(warn.label)) : (active ? 'Turno activo' : ((aid===p.id && !(S.table.turn&&S.table.turn.started)) ? 'Listo para iniciar' : 'En juego')));
    var lifeNum = Number(live.life); if (!isFinite(lifeNum)) lifeNum = (typeof live.life === 'number' ? live.life : 40); // preserve 0/negative; never reset to 40
    var dead = !!live.eliminated;
    var lifeZone = dead
      ? '<div class="m-life-zone is-dead" aria-disabled="true"><div class="m-life-core is-dead"><div class="m-life-val danger">Has muerto</div><div class="m-life-sub">Eliminado · cuadrante bloqueado</div></div></div>'
      : '<div class="m-life-zone"><div class="m-life-col"><button class="m-life-btn" data-pid="'+esc(p.id)+'" data-action="life" data-delta="-5" type="button">−5</button><button class="m-life-btn" data-pid="'+esc(p.id)+'" data-action="life" data-delta="-1" type="button">−</button></div>'
        + '<div class="m-life-core"><div class="m-life-val'+(lifeNum<=0?' danger':'')+'">'+lifeNum+'</div><div class="m-life-sub">vida</div></div>'
        + '<div class="m-life-col"><button class="m-life-btn plus" data-pid="'+esc(p.id)+'" data-action="life" data-delta="1" type="button">+</button><button class="m-life-btn plus" data-pid="'+esc(p.id)+'" data-action="life" data-delta="5" type="button">+5</button></div></div>';
    var dis = dead ? ' disabled aria-disabled="true"' : '';
    return '<article class="m-seat'+(active?' is-active':'')+(dead?' is-elim':(warn?' is-warn':''))+' pos-'+idx+' seats-'+n+'" data-seat="'+esc(p.id)+'"'+(dead?' data-dead="1"':'')+'>'
      + '<header class="m-seat-head"><div class="m-seat-name" title="'+esc(p.name)+'">'+esc(p.name)+'</div><div class="m-seat-meta"><span class="m-seat-status">'+status+'</span><span class="m-time-pill '+timeClass+'">'+fmt(left)+'</span></div></header>'
      + lifeZone
      + '<div class="m-quickbar'+(dead?' is-dead':'')+'">'
      + '<button class="m-ico-btn"'+(dead?dis:' data-open-player-modal="commander" data-pid="'+esc(p.id)+'"')+' type="button" title="Daño de comandante">'+iconSvg('cmdr')+'</button>'
      + '<button class="m-ico-btn"'+(dead?dis:' data-open-player-modal="counters" data-pid="'+esc(p.id)+'"')+' type="button" title="Contadores">'+iconSvg('sliders')+'</button>'
      + '<button class="m-ico-btn"'+(dead?dis:' data-open-player-modal="tax" data-pid="'+esc(p.id)+'"')+' type="button" title="Impuesto comandante">'+iconSvg('coins')+'<span>'+((Number(live.commanderTax)||0))+'</span></button>'
      + (!dead ? '<button class="m-ico-btn danger" data-surrender="'+esc(p.id)+'" type="button" title="Rendirse">'+iconSvg('flag')+'</button>' : '<button class="m-ico-btn danger" disabled aria-disabled="true" type="button" title="Eliminado">'+iconSvg('flag')+'</button>')
      + '</div></article>';
  }
  function renderGrid() { if (!S.table) return; ensureTableState(); var ps = S.table.players || [], grid = $('m-grid'); if (!grid) return; var n = ps.length || 4; grid.className = 'm-grid seats-' + n + (n > 6 ? ' seats-many' : ''); grid.innerHTML = ps.map(function(p,i){ return quadrant(p,i,n); }).join(''); renderStartControls(); }
  function renderStartControls() { if (!S.table) return; var sel = $('m-start-player'); if (!sel) return; var started = !!(S.table.turn && (S.table.turn.started || S.table.turn.startedAt)), ps = S.table.players || []; var prev = sel.value || (S.table.turn && S.table.turn.activePlayerId) || ''; sel.innerHTML = '<option value="">Seleccionar jugador...</option>' + ps.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>'; }).join(''); if (prev && ps.some(function(p){return p.id===prev;})) sel.value = prev; sel.disabled = started || !!S.animatingPick; var pick = $('m-pick-random'); if (pick) pick.disabled = started || !!S.animatingPick || !ps.length; if (!started && !S.table.turn.activePlayerId && ps[0]) sel.value = ps[0].id; }
  function selectStartPlayer(pid, silent) { if (!S.table || !pid || (S.table.turn && S.table.turn.started)) return Promise.resolve(); ensureTableState(); var idx = (S.table.players||[]).findIndex(function(p){ return p.id===pid; }); if (idx < 0) return Promise.resolve(); S.table.turn.activePlayerId = pid; S.table.turn.index = idx; S.table.turn.started = false; S.table.turn.turnStartedAt = null; renderStartControls(); renderTop(); renderGrid(); return persistTable({ turn: JSON.parse(JSON.stringify(S.table.turn)) }, 120).then(function(){ if(!silent){ var st=$('m-pick-status'); if(st) st.textContent='Inicial: ' + ((S.table.players[idx]||{}).name||pid) + '. Presiona \"▶ Iniciar Tiempo de Turno\".'; } }); }
  function highlightSeat(pid){ var grid=$('m-grid'); if(!grid) return; var seats=grid.querySelectorAll('[data-seat]'); for(var i=0;i<seats.length;i++) seats[i].classList.toggle('is-picking', seats[i].getAttribute('data-seat')===pid); }
  function animateRandomPick(){ if(!S.table||S.animatingPick||(S.table.turn&&S.table.turn.started)) return; var ps=(S.table.players||[]).filter(function(p){ var l=S.table.live&&S.table.live[p.id]; return !(l&&l.eliminated); }); if(!ps.length) return; S.animatingPick=true; var sel=$('m-start-player'), st=$('m-pick-status'), i=0, steps=14+Math.floor(Math.random()*8), delay=55; renderStartControls(); (function tick(){ var p=ps[i%ps.length]; i++; if(sel) sel.value=p.id; if(st) st.textContent='Seleccionando: '+p.name+'...'; highlightSeat(p.id); if(i<steps){ delay=Math.min(260,Math.floor(delay*1.12)); setTimeout(tick,delay); } else { var chosen=ps[Math.floor(Math.random()*ps.length)]; if(sel) sel.value=chosen.id; if(st) st.textContent='Seleccionado: '+chosen.name+'.'; S.animatingPick=false; selectStartPlayer(chosen.id,true).then(function(){ renderGrid(); renderStartControls(); renderTop(); }); } })(); }
  function startLocalTime(){ if(!S.table||S.animatingPick) return; ensureTableState(); var pid=(S.table.turn&&S.table.turn.activePlayerId)||(($('m-start-player')||{}).value); if(!pid) return alert('Selecciona quién inicia y luego presiona \"▶ Iniciar Tiempo de Turno\".'); var idx=(S.table.players||[]).findIndex(function(p){return p.id===pid;}); if(idx<0) return alert('Jugador inicial inválido.'); S.table.turn.activePlayerId=pid; S.table.turn.index=idx; S.table.turn.started=true; S.table.turn.startedAt=Date.now(); S.table.turn.turnStartedAt=Date.now(); S.table.turn.pausedAt=null; S.table.turn.pausedMs=0; if(!S.table.turn.activePlayerId && S.table.players&&S.table.players[S.table.turn.index||0]) S.table.turn.activePlayerId=S.table.players[S.table.turn.index||0].id; var st=$('m-pick-status'); if(st) st.textContent='Tiempo de turno iniciado.'; renderTop(); renderGrid(); persistTable({turn:JSON.parse(JSON.stringify(S.table.turn))},0).then(function(){ try{flushTable();}catch(e){} }); setTimeout(function(){ try{renderTop();}catch(e){} },250); }
  function renderOfficialPreview(){ var box=$('m-official-preview'); if(!box||!S.table) return; var statusEl=$('m-official-status'); if(S.table.officialReport&&S.table.officialReport.status==='submitted'){ var r=S.table.officialReport; var pl=(r.placements||[]).map(function(x){ var p=(S.table.players||[]).find(function(z){return z.id===x.playerId;}); return (x.placement)+'º '+(p?p.name:x.playerId); }).join(' · '); box.innerHTML='<span class="sync-mode sync-mode-firestore">enviado</span> '+esc(pl||'Resultado enviado'); if(statusEl) statusEl.textContent='Resultado oficial enviado al anfitrión.'; return; } var alive=aliveCount(), total=(S.table.players||[]).length; if(alive<=1&&total>1) box.innerHTML='<span class="sync-mode sync-mode-local">listo</span> Mesa decidida. Envía el resultado oficial.'; else if(CompanionModel.roundRemainingSec(S.session)===0&&S.session&&S.session.roundStartedAt) box.innerHTML='<span class="sync-mode sync-mode-local">tiempo agotado</span> Envía el resultado oficial.'; else box.textContent='En juego: '+alive+'/'+total+' con vida.'; }
  function modalStepper(pid,field,label,val,opts){ opts=opts||{}; var n=Number(val)||0; var danger=opts.dangerAt!=null&&n>=opts.dangerAt?' danger':''; var ico=opts.svg?iconSvg(opts.svg):''; return '<div class="m-modal-row"><div class="m-modal-row-label">'+ico+'<span>'+esc(label)+'</span></div><div class="m-modal-step"><button data-modal-action="'+esc(field)+'" data-pid="'+esc(pid)+'" data-delta="-1">−</button><strong class="'+danger+'">'+n+'</strong><button data-modal-action="'+esc(field)+'" data-pid="'+esc(pid)+'" data-delta="1">+</button></div></div>'; }
  function toggleRow(pid,field,label,on,svg){ return '<button class="m-toggle-row'+(on?' on':'')+'" data-toggle-field="'+field+'" data-pid="'+esc(pid)+'"><span>'+iconSvg(svg,'crown')+'<span>'+esc(label)+'</span></span><strong>'+(on?'Activo':'Inactivo')+'</strong></button>'; }
  function tabBtn(pid,tab,svg,label,active){ return '<button class="m-tab'+(active===tab?' active':'')+'" data-player-tab="'+tab+'" data-pid="'+esc(pid)+'">'+iconSvg(svg)+'<span>'+esc(label)+'</span></button>'; }
  function renderCmdrModal(p,live){ var others=(S.table.players||[]).filter(function(o){return o.id!==p.id;}); if(!others.length) return '<div class="c-counter-hint">Sin oponentes.</div>'; return others.map(function(o){ var e=(live.commanderDamage||{})[o.id]||{commanderName:'Comandante de '+o.name,damage:0}; var dmg=Number(e.damage)||0; var lethal=dmg>=21?' lethal':''; return '<div class="m-cmdr"><label>De '+esc(o.name)+'<input class="m-cmdr-name" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" value="'+esc(e.commanderName||'')+'" placeholder="Nombre comandante"></label><div class="m-cmdr-row"><button data-cmdr-dmg="1" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" data-delta="-1">−</button><strong class="'+lethal+'">'+dmg+'</strong><button data-cmdr-dmg="1" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" data-delta="1">+</button></div></div>'; }).join(''); }
  function openPlayerModal(pid,tab){ if(!S.table||!pid){ console.warn("openPlayerModal missing table/pid",!!S.table,pid); return; } try{ if(S.table.turn&&(S.table.turn.started||S.table.turn.startedAt)) autoPauseForModal("Partida en pausa por menú"); }catch(e){console.warn("autoPause",e);} ensureTableState(); var p=(S.table.players||[]).find(function(x){return x.id===pid;}); if(!p) return; var live=CompanionModel.ensureLive(S.table,pid,40); S.playerModal={pid:pid,tab:tab||'counters'}; var title=$('m-player-modal-title'); if(title) title.textContent=p.name; var body=$('m-player-modal-body'); if(!body){ console.warn('m-player-modal-body missing'); return; } var t=S.playerModal.tab; body.innerHTML='<div class="m-modal-tabs">'+tabBtn(pid,'commander','cmdr','Cmdr',t)+tabBtn(pid,'counters','sliders','Contadores',t)+tabBtn(pid,'tax','coins','Impuesto',t)+'</div>'+(t==='commander'?('<div class="m-cmdr-wrap m-cmdr-wrap-modal">'+renderCmdrModal(p,live)+'</div>'):'')+(t==='counters'?('<div class="m-modal-list">'+modalStepper(pid,'poison','Veneno',live.poison,{dangerAt:10,svg:'skull'})+modalStepper(pid,'energy','Energía',live.energy,{svg:'bolt'})+modalStepper(pid,'experience','Experiencia',live.experience,{svg:'star'})+modalStepper(pid,'storm','Tormenta',live.storm,{svg:'storm'})+modalStepper(pid,'manaPool','Maná flotante',live.manaPool,{svg:'mana'})+toggleRow(pid,'monarch','Monarca',!!live.monarch,'crown')+toggleRow(pid,'initiative','Iniciativa',!!live.initiative,'dungeon')+'</div>'):'')+(t==='tax'?('<div class="m-modal-list">'+modalStepper(pid,'commanderTax','Impuesto de comandante',live.commanderTax,{svg:'coins'})+'<div class="c-counter-hint">Costo adicional: +'+(2*(Number(live.commanderTax)||0))+' maná genérico (usualmente).</div></div>'):'')+(!live.eliminated?'<div class="m-modal-actions" style="margin-top:12px"><button class="btn-secondary m-surrender" data-surrender="'+esc(pid)+'">Rendición / pérdida forzada</button></div>':''); openModal('m-player-modal'); try{ var pm=$('m-player-modal'); if(pm){ pm.style.display='flex'; pm.style.zIndex='130'; } }catch(e){} }
  function closePlayerModal(){ var had=!!S.playerModal; S.playerModal=null; closeModal('m-player-modal'); if(had) autoResumeFromModal(); }
  function refreshPlayerModal(){ if(S.playerModal) openPlayerModal(S.playerModal.pid,S.playerModal.tab); }
  function patchLive(pid, mutator, opts){ if(!S.table) return Promise.resolve(); ensureTableState(); var live=CompanionModel.ensureLive(S.table,pid,40); mutator(live,S.table); var patch={live:{},turn:S.table.turn}; patch.live[pid]=JSON.parse(JSON.stringify(live)); if(S.table.turn&&S.table.turn.activePlayerId) patch.turn=JSON.parse(JSON.stringify(S.table.turn)); renderGrid(); renderTop(); return persistTable(patch, opts&&opts.delay!=null?opts.delay:160); }
  function persistAllLive(){ if(!S.table) return; var patch={live:{},turn:S.table.turn?JSON.parse(JSON.stringify(S.table.turn)):null}; (S.table.players||[]).forEach(function(p){ if(S.table.live[p.id]) patch.live[p.id]=JSON.parse(JSON.stringify(S.table.live[p.id])); }); persistTable(patch,80); }
  function passTurn(){ if(!S.table) return; ensureTableState(); if(!(S.table.turn&&(S.table.turn.started||S.table.turn.startedAt))){ var st=$('m-pick-status'); if(st) st.textContent='Selecciona jugador inicial e Inicia Tiempo.'; return; } if(isPaused()){ var st2=$('m-pick-status'); if(st2) st2.textContent='Tiempo en pausa. Reanuda para pasar turno.'; return; } CompanionModel.passTurn(S.table); if(S.table.turn){ S.table.turn.started=true; if(!S.table.turn.startedAt) S.table.turn.startedAt=Date.now(); S.table.turn.pausedAt=null; S.table.turn.pausedMs=S.table.turn.pausedMs||0; } renderGrid(); renderTop(); persistAllLive(); }

  function lossPlayer(pid){ return (S.table && S.table.players || []).find(function(x){ return x.id===pid; }) || {id:pid,name:pid}; }
  function closeLossModal(opts){ opts=opts||{}; var had=!!S.lossModal; S.lossModal=null; closeModal('m-loss-modal'); if(had && !opts.keepPause) autoResumeFromModal(); }
  function renderLossModal(){
    if(!S.lossModal || !S.table) return;
    var m=S.lossModal, body=$('m-loss-body'), acts=$('m-loss-actions'); if(!body||!acts) return;
    var p=lossPlayer(m.pid), name=esc(p.name||m.pid);
    if(m.step===1){
      body.innerHTML='<p class="m-loss-msg"><strong>'+name+'</strong></p><p class="m-loss-hint">¿Confirmas que has sido eliminado / te rindes?</p>'+(m.condition?'<p class="c-counter-hint">'+esc(m.condition.label||'')+(m.condition.detail?(' · '+esc(m.condition.detail)):'')+'</p>':'');
      acts.innerHTML='<button id="m-loss-cancel" class="btn-secondary" type="button">Cancelar</button><button id="m-loss-step1-yes" class="btn-primary" type="button">Sí, fui eliminado</button>';
    } else if(m.step===2){
      body.innerHTML='<p class="m-loss-msg"><strong>'+name+'</strong></p><p class="m-loss-hint">¿Algún jugador de la mesa provocó tu eliminación?</p>';
      acts.innerHTML='<button id="m-loss-step2-no" class="btn-secondary" type="button">NO</button><button id="m-loss-step2-yes" class="btn-primary" type="button">SÍ</button>';
    } else if(m.step===3){
      var killers=(S.table.players||[]).filter(function(x){
        if(x.id===m.pid) return false;
        var l=S.table.live && S.table.live[x.id];
        return !(l&&l.eliminated);
      });
      body.innerHTML='<p class="m-loss-msg"><strong>'+name+'</strong></p><p class="m-loss-hint">¿Quién te eliminó?</p>'+(!killers.length?'<p class="c-counter-hint">No hay jugadores activos para asignar bounty.</p>':'');
      acts.innerHTML=(killers.map(function(k){ return '<button class="btn-primary m-bounty-killer" data-killer-id="'+esc(k.id)+'" type="button">'+esc(k.name)+'</button>'; }).join(''))+'<button id="m-loss-step3-back" class="btn-secondary" type="button">Volver</button>';
    }
    openModal('m-loss-modal'); try{ var lm=$('m-loss-modal'); if(lm){ lm.style.display='flex'; lm.style.zIndex='130'; } }catch(e){}
  }
  function openLossFlow(pid, condition, mode){
    if(!S.table || !pid) return;
    try{autoPauseForModal("Partida en pausa por menú");}catch(e){console.warn("autoPause",e);}
    var live=CompanionModel.ensureLive(S.table,pid,40); if(live.eliminated) return;
    S.lossModal={ pid:pid, condition:condition||{type:mode||'manual',label: mode==='surrender'?'Rendición':'Derrota confirmada',detail:''}, mode:mode||'condition', step: condition ? 0 : 1 };
    // For auto-detected game-loss conditions, step 0 asks "¿Has perdido el juego?" with protection note; surrender starts at step 1
    if(S.lossModal.step===0){
      var body=$('m-loss-body'), acts=$('m-loss-actions'), p=lossPlayer(pid);
      if(body) body.innerHTML='<p class="m-loss-msg"><strong>'+esc(p.name)+'</strong>: '+esc(S.lossModal.condition.label)+'.</p><p class="c-counter-hint">'+esc(S.lossModal.condition.detail||'')+'</p><p class="m-loss-hint">Si tienes protección (p. ej. <em>Ángel de Platino</em>), elige <strong>No, continuar</strong>: se registrarán valores acumulados/negativos.</p>';
      if(acts) acts.innerHTML='<button id="m-loss-no" class="btn-secondary" type="button">No, continuar</button><button id="m-loss-step0-yes" class="btn-primary" type="button">Sí, confirmar derrota</button>';
      openModal('m-loss-modal'); try{ var lm=$('m-loss-modal'); if(lm){ lm.style.display='flex'; lm.style.zIndex='130'; } }catch(e){} return;
    }
    renderLossModal();
  }
  function openLossModal(pid,condition){ openLossFlow(pid,condition,'condition'); }
  function checkPendingLossModal(){ if(!S.table||S.lossModal) return; var lm=$('m-loss-modal'); if(lm&&lm.style.display!=='none') return; var ps=S.table.players||[]; for(var i=0;i<ps.length;i++){ var live=CompanionModel.ensureLive(S.table,ps[i].id); if(live.eliminated) continue; var conds=CompanionModel.detectLossConditions(S.table,ps[i].id,S.session); if(conds.length){ openLossFlow(ps[i].id,conds[0],'condition'); return; } } }
  function showBountyToast(msg){ var t=$('m-bounty-toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(S._bountyToastTimer); S._bountyToastTimer=setTimeout(function(){ try{t.classList.remove('show');}catch(e){} },2200); }
  function finalizeLoss(killerId){
    if(!S.lossModal||!S.table) return;
    var pid=S.lossModal.pid, cond=S.lossModal.condition||{type:'manual',label:'Derrota confirmada'};
    var ts=Date.now();
    var killer= killerId ? lossPlayer(killerId) : null;
    closeLossModal({keepPause:true});
    var livePatch={};
    patchLive(pid,function(l,t){
      CompanionModel.confirmElimination(t,pid,Object.assign({},cond,{eliminatedBy:killerId||null}),ts,S.session,{eliminatedBy:killerId||null});
      Object.assign(l,t.live[pid]);
      livePatch[pid]=JSON.parse(JSON.stringify(l));
      if(killerId){
        var kl=CompanionModel.ensureLive(t,killerId,40);
        if(CompanionModel.addBounty) CompanionModel.addBounty(t,killerId); else kl.bounties=(Number(kl.bounties)||0)+1;
        livePatch[killerId]=JSON.parse(JSON.stringify(kl));
      }
    },{delay:0}).then(function(){
      // ensure killer bounty persisted explicitly (patchLive only sends victim live by default path)
      if(killerId && S.table && S.table.live && S.table.live[killerId]){
        persistTable({ live: (function(o){ o[killerId]=JSON.parse(JSON.stringify(S.table.live[killerId])); return o; })({}) }, 0);
      }
      try{flushTable();}catch(e){}
      renderGrid(); renderTop(); if(killer) showBountyToast('¡+1 Bounty para '+killer.name+'!');
      setTimeout(function(){ autoResumeFromModal(); maybeAutoSubmit(); },120);
    }).catch(function(){ autoResumeFromModal(); });
  }
  function confirmLossYes(){ finalizeLoss(null); } // legacy/unused by new UI; kept safe
  function confirmLossNo(){ if(!S.lossModal) return; var pid=S.lossModal.pid, cond=S.lossModal.condition; closeLossModal(); patchLive(pid,function(l){ CompanionModel.ignoreCondition(l,cond); },{delay:0}).then(function(){ renderGrid(); renderTop(); setTimeout(checkPendingLossModal,50); }); }
  function surrender(pid){ if(!S.table) return; closePlayerModal(); openLossFlow(pid,{type:'surrender',label:'Rendición',detail:'El jugador confirmó su rendición.'},'surrender'); }
  function maybeAutoSubmit(){ if(!S.table||S.autoSubmitted) return; if(S.table.officialReport&&S.table.officialReport.status==='submitted'){ S.autoSubmitted=true; return; } var ps=S.table.players||[], alive=aliveCount(); if(ps.length>1&&alive<=1){ var st=$('m-official-status'); if(st) st.textContent='Mesa decidida. Enviando resultado oficial automáticamente...'; setTimeout(function(){ submitOfficial(true,true); },450); } }
  function submitOfficial(force,auto){ if(!S.table||!S.session) return; if(S.table.officialReport&&S.table.officialReport.status==='submitted'&&!force){ alert('El resultado oficial ya fue enviado.'); return; } ensureTableState(); CompanionModel.accrueActive(S.table); var alive=aliveCount(), rem=CompanionModel.roundRemainingSec(S.session), ps=S.table.players||[]; var reason=(alive<=1&&ps.length>1)?'eliminations':(rem===0?'global-timeout':'manual'); if(!auto&&!force&&alive>1&&rem>0){ if(!confirm('La mesa aún no termina. ¿Enviar resultado oficial actual?')) return; } var report=CompanionModel.computeOfficialReport(S.table,S.session,reason); S.table.officialReport=Object.assign({status:'submitted'},report); var livePatch={}; ps.forEach(function(p){ var l=S.table.live[p.id]; livePatch[p.id]={timeUsedSec:CompanionModel.effectiveTimeUsed(S.table,p.id),eliminated:!!(l&&l.eliminated),elimination:l&&l.elimination||null,eliminationOrder:l&&l.eliminationOrder||null}; }); S.autoSubmitted=true; persistTable({officialReport:S.table.officialReport,live:livePatch,turn:S.table.turn},0).then(function(){ flushTable(); renderGrid(); renderTop(); if(!auto) alert('Resultado oficial enviado al anfitrión.'); }).catch(function(e){ alert('No se pudo enviar: '+(e&&e.message||e)); S.autoSubmitted=false; }); }
  function bind(){ document.body.addEventListener('click', function(e){ var closePm=e.target.closest('[data-close-player-modal]'); if(closePm) return closePlayerModal(); var closeOm=e.target.closest('[data-close-official-modal]'); if(closeOm) return closeModal('m-official-modal'); var closeLoss=e.target.closest('[data-loss-close]'); if(closeLoss){ return closeLossModal(); } var tab=e.target.closest('[data-player-tab]'); if(tab){ if(S.playerModal) openPlayerModal(tab.getAttribute('data-pid'),tab.getAttribute('data-player-tab')); return; } var openPm=e.target.closest('[data-open-player-modal]'); if(openPm){ e.preventDefault(); e.stopPropagation(); return openPlayerModal(openPm.getAttribute('data-pid'),openPm.getAttribute('data-open-player-modal')); } var togf=e.target.closest('[data-toggle-field]'); if(togf){ var fpid=togf.getAttribute('data-pid'), field=togf.getAttribute('data-toggle-field'); return patchLive(fpid,function(l){l[field]=!l[field];}).then(refreshPlayerModal); } var ma=e.target.closest('[data-modal-action]'); if(ma){ var mpid=ma.getAttribute('data-pid'), mf=ma.getAttribute('data-modal-action'), md=parseInt(ma.getAttribute('data-delta'),10)||0; return patchLive(mpid,function(l){l[mf]=(Number(l[mf])||0)+md;}).then(refreshPlayerModal); } var pass=e.target.closest('[data-pass-turn]'); if(pass) return passTurn(); var surrenderBtn=e.target.closest('[data-surrender]'); if(surrenderBtn){ e.preventDefault(); e.stopPropagation(); return surrender(surrenderBtn.getAttribute('data-surrender')); }       var life=e.target.closest('[data-action][data-pid]'); if(life){
        e.preventDefault(); e.stopPropagation();
        var pid=life.getAttribute('data-pid'), action=life.getAttribute('data-action'), delta=parseInt(life.getAttribute('data-delta'),10)||0;
        if(life.disabled) return;
        return patchLive(pid,function(l,t){
          if(l && l.eliminated) return; // eliminated quadrant: fully locked
          if(action==='life'){
            var cur = Number(l.life); if(!isFinite(cur)) cur = (typeof l.life==='number' ? l.life : 40);
            l.life = cur + delta; // allow 0 and negatives; NEVER auto-reset to 40
          } else {
            l[action] = (Number(l[action])||0) + delta;
          }
        }).then(function(){ setTimeout(checkPendingLossModal,30); });
      } var cmd=e.target.closest('[data-cmdr-dmg]'); if(cmd){ var tpid=cmd.getAttribute('data-target'), op=cmd.getAttribute('data-op'), d=parseInt(cmd.getAttribute('data-delta'),10)||0; return patchLive(tpid,function(l){ l.commanderDamage=l.commanderDamage||{}; var en=l.commanderDamage[op]||(l.commanderDamage[op]={commanderName:'Comandante',damage:0}); en.damage=(Number(en.damage)||0)+d; }).then(function(){ refreshPlayerModal(); setTimeout(checkPendingLossModal,30); }); } if(e.target&&e.target.id==='m-loss-yes') return confirmLossYes(); if(e.target&&e.target.id==='m-loss-no') return confirmLossNo();
      if(e.target&&e.target.id==='m-loss-cancel') return closeLossModal();
      if(e.target&&e.target.id==='m-loss-step0-yes'){ if(S.lossModal) S.lossModal.step=2; return renderLossModal(); }
      if(e.target&&e.target.id==='m-loss-step1-yes'){ if(S.lossModal) S.lossModal.step=2; return renderLossModal(); }
      if(e.target&&e.target.id==='m-loss-step2-no') return finalizeLoss(null);
      if(e.target&&e.target.id==='m-loss-step2-yes'){ if(S.lossModal) S.lossModal.step=3; return renderLossModal(); }
      if(e.target&&e.target.id==='m-loss-step3-back'){ if(S.lossModal) S.lossModal.step=2; return renderLossModal(); }
      var killerBtn=e.target.closest('.m-bounty-killer'); if(killerBtn) return finalizeLoss(killerBtn.getAttribute('data-killer-id')); });
    document.body.addEventListener('change', function(e){ var nm=e.target.closest('.m-cmdr-name'); if(nm) return patchLive(nm.getAttribute('data-target'), function(l){ l.commanderDamage=l.commanderDamage||{}; var en=l.commanderDamage[nm.getAttribute('data-op')]||(l.commanderDamage[nm.getAttribute('data-op')]={commanderName:'',damage:0}); en.commanderName=nm.value; }).then(refreshPlayerModal); if(e.target&&e.target.id==='m-start-player') selectStartPlayer(e.target.value); });
    var b; if((b=$('m-pass-turn'))) b.addEventListener('click', passTurn); if((b=$('m-pass-fab'))) b.addEventListener('click', passTurn);
    if((b=$('m-submit-official'))) b.addEventListener('click', function(){ submitOfficial(false,false); });
    if((b=$('m-toggle-official'))) b.addEventListener('click', function(){ renderOfficialPreview(); openModal('m-official-modal'); });
    if((b=$('m-pick-random'))) b.addEventListener('click', animateRandomPick); if((b=$('m-start-time'))) b.addEventListener('click', startLocalTime);
    if((b=$('m-global-pause'))) b.addEventListener('click', toggleGlobalPause);
    if((b=$('m-open-join'))) b.addEventListener('click', function(){ if($('m-board')) $('m-board').style.display='none'; if($('m-join')) $('m-join').style.display='block'; });
    if((b=$('m-join-btn'))) b.addEventListener('click', onJoinClick);
    var jf=$('m-join'); if(jf) jf.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); onJoinClick(ev); } });
  }
  function applySession(s){ S.session=s; renderTop(); if(S.table&&S.session&&S.session.roundStartedAt&&S.table.turn&&S.table.turn.activePlayerId&&!S.table.turn.started){ var st=$('m-pick-status'); if(st) st.textContent='Ronda lista. Cronómetros en pausa: selecciona quién inicia y presiona ▶ Iniciar Tiempo de Turno (o el botón central).'; renderTop(); renderGrid(); } }
  function applyTable(t){ S.table=t||S.table; if(S.table){ S.table.live=S.table.live||{}; S.table.turn=S.table.turn||{}; if(S.table.officialReport&&S.table.officialReport.status==='submitted') S.autoSubmitted=true; } renderTop(); renderGrid(); checkPendingLossModal(); maybeAutoSubmit(); }

  function tickTimers(){
    if(!S.table || !S.session) return;
    var started = !!(S.table.turn && (S.table.turn.started || S.table.turn.startedAt));
    if(!started) return;
    var paused = isPaused();
    var aid = CompanionModel.activePlayerId(S.table);
    var cards = (document.getElementById('m-grid')||document).querySelectorAll ? (document.getElementById('m-grid')||document).querySelectorAll('.m-q[data-pid], .m-seat[data-seat], .m-seat[data-pid]') : [];
    var budget = CompanionModel.turnBudget(S.table);
    for(var i=0;i<cards.length;i++){
      var q=cards[i], pid=q.getAttribute('data-pid')||q.getAttribute('data-seat'); if(!pid) continue;
      var live=(S.table.live&&S.table.live[pid])||{};
      if(live.eliminated){ q.classList.remove('m-turn','is-active'); var eb=q.querySelector('.m-q-turnbadge'); if(eb) eb.remove(); continue; }
      var used=CompanionModel.effectiveTimeUsed(S.table,pid); var left=Math.max(0,budget-used);
      var pill=q.querySelector('.m-time-pill'); if(pill) pill.textContent=fmt(left);
      var active = (aid===pid) && !paused && !!(S.table.turn && (S.table.turn.started||S.table.turn.startedAt));
      q.classList.toggle('m-turn', active); q.classList.toggle('is-active', active);
      var badge=q.querySelector('.m-q-turnbadge');
      if(active || (aid===pid && paused && started)){
        if(!badge){ badge=document.createElement('span'); badge.className='m-q-turnbadge'; q.appendChild(badge); }
        badge.textContent = paused ? 'PAUSA' : 'TURNO';
        badge.style.display='';
      } else if(badge){ badge.remove(); }
      q.setAttribute('onclick', active ? 'passTurn()' : "openPlayerModal('"+pid+"')");
    }
    var pass=$('m-island-pass'); if(pass) pass.disabled = paused || !started || !aid;
  }
  function subscribe(){ S.unsubs.forEach(function(u){try{u();}catch(e){}}); S.unsubs=[]; if(!window.TorneoSync||!TorneoSync.ready()) return; S.unsubs.push(TorneoSync.subscribeSession(S.sessionId, applySession)); S.unsubs.push(TorneoSync.subscribeTable(S.sessionId, S.tableId, applyTable)); }
  function enter(){ var j=$('m-join'),b=$('m-board'),st=$('m-official-status'); if(S.joining) return; S.tableId=normTableId(S.tableId); if(!S.sessionId||!S.tableId){ if(st) st.textContent='Faltan código de sesión o mesa.'; if(j) j.style.display='block'; if(b) b.style.display='none'; return; } S.joining=true; if(st) st.textContent='Conectando a '+S.sessionId+' / '+S.tableId+'...'; try{ if(j) j.style.display='none'; if(b) b.style.display='block'; subscribe(); renderTop(); renderGrid(); if(S.tick) clearInterval(S.tick); S.tick=setInterval(function(){ try{
          if(!S.table || !S.session) { renderTop(); return; }
          renderTop();
          var started = !!(S.table.turn && (S.table.turn.started || S.table.turn.startedAt));
          if(started) tickTimers(); else renderGrid();
          checkPendingLossModal();
        }catch(e){ console.warn('tick',e); } },1000); } catch(e){ console.error('enter',e); if(st) st.textContent='No se pudo cargar la mesa: '+(e&&e.message||e); if(j) j.style.display='block'; if(b) b.style.display='none'; } S.joining=false; }
  function onJoinClick(ev){ if(ev&&ev.preventDefault) ev.preventDefault(); S.sessionId=(($('m-session')&&$('m-session').value)||'').trim().toUpperCase(); S.tableId=normTableId(($('m-table')&&$('m-table').value)||''); if(!S.sessionId||!S.tableId){ alert('Ingresa sesión y mesa (ej. mesa-1).'); return false; } try{ var url=new URL(location.href); url.searchParams.set('sesion',S.sessionId); url.searchParams.set('mesa',S.tableId); url.searchParams.delete('session'); url.searchParams.delete('table'); history.replaceState({},'',url); }catch(e){} enter(); return false; }
  S.tableId = normTableId(S.tableId);
  function boot(){ try{ badge(); if($('m-session')) $('m-session').value=S.sessionId; if($('m-table')) $('m-table').value=S.tableId; bind(); if(S.sessionId&&S.tableId) enter(); else { if($('m-join')) $('m-join').style.display='block'; if($('m-board')) $('m-board').style.display='none'; } } catch(e){ console.error('mesa boot',e); var st=$('m-official-status'); if(st) st.textContent='Error al iniciar mesa: '+(e&&e.message||e); } }
  window.abrirModalContadores=function(pid){ return openPlayerModal(pid,'counters'); }; window.abrirModalDerrota=function(pid){ return surrender(pid); }; window.openPlayerModal=openPlayerModal; window.surrender=surrender;
  try{ TorneoSync.init().then(boot).catch(function(e){ console.warn('TorneoSync init',e); boot(); }); } catch(e){ console.error(e); boot(); }
})();