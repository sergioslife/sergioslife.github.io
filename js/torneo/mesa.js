(function () {
  'use strict';
  var qs = new URLSearchParams(location.search);
  var S = { sessionId: (qs.get('session')||'').toUpperCase(), tableId: qs.get('table') || qs.get('id') || '', session: null, table: null, unsubs: [], tick: null, localView: {}, lossModal: null, autoSubmitted: false };
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  var fmt = function(sec){ sec=Math.floor(Number(sec)||0); var neg=sec<0; sec=Math.abs(sec); var m=Math.floor(sec/60),s=sec%60; return (neg?'-':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); };
  function badge(){ var b=$('m-sync'); if(!b||!window.TorneoSync) return; var m=TorneoSync.mode||'local'; b.className='sync-mode sync-mode-'+m; b.textContent=m==='firestore'?'tiempo real':'local'; }
  function persistTable(patch, delay){ if(!S.sessionId||!S.tableId||!window.TorneoSync) return Promise.resolve(); return TorneoSync.patchTable(S.sessionId,S.tableId,patch,delay); }
  function flushTable(){ if(!S.sessionId||!S.tableId||!window.TorneoSync||!TorneoSync.flushTable) return; TorneoSync.flushTable(S.sessionId,S.tableId); }

  function ensureTableState() {
    if (!S.table) return;
    S.table.live = S.table.live || {}; S.table.turn = S.table.turn || {};
    (S.table.players || []).forEach(function(p){ CompanionModel.ensureLive(S.table, p.id, 40); });
    // No auto-seleccionar turno hasta que la mesa elija jugador inicial e inicie tiempo local.
    if (S.table.turn.index == null) { var ps=S.table.players||[]; var idx = ps.findIndex(function(p){ return p.id === S.table.turn.activePlayerId; }); S.table.turn.index = idx >= 0 ? idx : null; }
    if (S.table.turn.started && !S.table.turn.activePlayerId) {
      var ps2=S.table.players||[]; if (ps2[0]) { S.table.turn.index = 0; S.table.turn.activePlayerId = ps2[0].id; S.table.turn.turnStartedAt = Date.now(); }
    }
  }

  function placeLabel(live, total) {
    if (!live || !live.eliminated || !live.eliminationOrder) return '';
    var place = total - Number(live.eliminationOrder) + 1;
    return place + 'º puesto';
  }

  function renderTop() {
    if (!S.session || !S.table) return;
    ensureTableState();
    var el;
    if ((el=$('m-title'))) el.textContent = (S.session.tournamentName || 'Mesa') + ' · Mesa ' + (S.table.tableIndex || '');
    if ((el=$('m-sub'))) el.textContent = 'Sesión ' + S.sessionId + ' · Ronda ' + (S.session.roundNumber||'-');
    var rem = CompanionModel.roundRemainingSec(S.session);
    var rt = $('m-round-timer'); if (rt) { rt.textContent = fmt(rem); rt.className = (rem<=60?'danger':rem<=300?'warn':''); }
    var hostRunning = !!(S.session && S.session.roundStartedAt && !S.session.roundPausedAt);
    if ((el=$('m-round-meta'))) el.textContent = !S.session.roundStartedAt ? 'esperando inicio del anfitrión' : (S.session.roundPausedAt ? 'pausada por anfitrión' : (rem===0 ? 'tiempo global agotado' : 'tiempo global en curso'));
    var started = !!(S.table.turn && S.table.turn.started);
    var aid = CompanionModel.activePlayerId(S.table);
    var ap = (S.table.players||[]).find(function(p){return p.id===aid;});
    if ((el=$('m-active-name'))) el.textContent = started ? (ap ? ap.name : '-') : 'Sin iniciar';
    if ((el=$('m-active-time'))) el.textContent = started ? fmt(CompanionModel.turnElapsedSec(S.table)) : '00:00';
    var pass = $('m-pass-turn'); if (pass) pass.disabled = !started;
    var startWrap = $('m-start-wrap'); if (startWrap) startWrap.style.display = started ? 'none' : 'block';
    var startBtn = $('m-start-time'); if (startBtn) { startBtn.disabled = !(S.table.turn && S.table.turn.activePlayerId) || !!S.animatingPick; startBtn.title = hostRunning ? 'El anfitrión ya inició el tiempo global' : 'Inicia el conteo de turnos en esta mesa'; }
    renderOfficialPreview();
    checkPendingLossModal();
  }

  function quadrant(p, idx, n) {
    var live = CompanionModel.ensureLive(S.table, p.id, 40);
    var aid = CompanionModel.activePlayerId(S.table);
    var active = aid === p.id && !live.eliminated;
    var conditions = CompanionModel.detectLossConditions(S.table, p.id, S.session);
    var warn = conditions.length ? conditions[0] : null;
    var elimClass = live.eliminated ? ' is-elim' : (warn ? ' is-warn' : '');
    var turnClass = active ? ' is-active' : '';
    var budget = CompanionModel.playerBudgetSec(S.session, (S.table.players||[]).length || 4);
    var used = CompanionModel.effectiveTimeUsed(S.table, p.id);
    var left = budget - used;
    var timeClass = left < 0 ? 'danger' : (left <= 120 ? 'warn' : '');
    var status;
    if (live.eliminated) status = 'Eliminado · ' + placeLabel(live, (S.table.players||[]).length) + ' · ' + esc((live.elimination&&live.elimination.label)||'derrota');
    else if (warn) status = 'Condición: ' + esc(warn.label) + ' (confirmación pendiente)';
    else if (active) status = 'Turno activo';
    else status = 'En juego';
    return '<article class="m-seat'+turnClass+elimClass+' pos-'+idx+'" data-seat="'+esc(p.id)+'">'
      + '<div class="m-seat-head"><div class="m-seat-name">'+esc(p.name)+'</div><div class="m-seat-status">'+status+'</div></div>'
      + '<div class="m-life-row"><button class="m-life-btn" data-pid="'+esc(p.id)+'" data-action="life" data-delta="-5">-5</button>'
      + '<button class="m-life-btn" data-pid="'+esc(p.id)+'" data-action="life" data-delta="-1">-</button>'
      + '<div class="m-life-val'+((Number(live.life)||0)<=0?' danger':'')+'">'+(live.life!=null?live.life:40)+'</div>'
      + '<button class="m-life-btn plus" data-pid="'+esc(p.id)+'" data-action="life" data-delta="1">+</button>'
      + '<button class="m-life-btn plus" data-pid="'+esc(p.id)+'" data-action="life" data-delta="5">+5</button></div>'
      + '<div class="m-subgrid">'
      + counter(p.id,'poison','Veneno',live.poison,10)
      + counter(p.id,'experience','Exp.',live.experience)
      + counter(p.id,'commanderTax','Imp. cmdr',live.commanderTax)
      + counter(p.id,'energy','Energía',live.energy)
      + '</div>'
      + '<details class="m-details"'+(S.localView[p.id]&&S.localView[p.id].cmdr?' open':'')+'><summary data-toggle-cmdr="'+esc(p.id)+'"><i class="fas fa-chess-king"></i> Daño de comandante</summary><div class="m-cmdr-wrap">'+renderCmdr(p, live)+'</div></details>'
      + '<div class="m-seat-foot">'
      +   '<span class="m-time-used '+timeClass+'">Tiempo: '+fmt(left)+(left<0?' (excedido)':'')+'</span>'
      +   '<span class="m-seat-actions">'
      +     (active?'<button class="btn-primary btn-sm m-pass-inline" data-pass-turn="1"><i class="fas fa-forward"></i> Pasar</button>':'')
      +     (!live.eliminated?'<button class="btn-secondary btn-sm m-surrender" data-surrender="'+esc(p.id)+'" title="Rendición manual / pérdida forzada">Rendirse</button>':'')
      +   '</span>'
      + '</div>'
      + '</article>';
  }
  function counter(pid, field, label, val, dangerAt){
    var n = Number(val)||0; var d = (dangerAt && n>=dangerAt) ? ' danger' : (n<0?' danger':'');
    return '<div class="m-ctr"><span class="m-ctr-l">'+esc(label)+'</span><div class="m-ctr-r"><button data-pid="'+esc(pid)+'" data-action="'+field+'" data-delta="-1">−</button><b class="'+d+'">'+n+'</b><button data-pid="'+esc(pid)+'" data-action="'+field+'" data-delta="1">+</button></div></div>';
  }
  function renderCmdr(p, live){
    var others = (S.table.players||[]).filter(function(o){return o.id!==p.id;});
    if(!others.length) return '<div class="c-counter-hint">Sin oponentes.</div>';
    return others.map(function(o){
      var e = (live.commanderDamage||{})[o.id] || { commanderName:'Comandante de '+o.name, damage:0 };
      var dmg = Number(e.damage)||0; var lethal = dmg>=21 ? ' lethal':'';
      return '<div class="m-cmdr" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'">'
        + '<label>De '+esc(o.name)+'<input class="m-cmdr-name" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" value="'+esc(e.commanderName||'')+'" placeholder="Nombre comandante"></label>'
        + '<div class="m-cmdr-row"><button data-cmdr-dmg="1" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" data-delta="-1">−</button><strong class="'+lethal+'">'+dmg+'</strong><button data-cmdr-dmg="1" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" data-delta="1">+</button></div>'
        + '</div>';
    }).join('');
  }
  function renderGrid() {
    if (!S.table) return;
    ensureTableState();
    var ps = S.table.players || [];
    var grid = $('m-grid');
    if (!grid) return;
    var n = ps.length || 4;
    grid.className = 'm-grid seats-' + n + (n > 4 ? ' seats-many' : '');
    grid.innerHTML = ps.map(function(p,i){ return quadrant(p,i,ps.length); }).join('');
    renderStartControls();
  }
  function renderStartControls() {
    if (!S.table) return;
    var sel = $('m-start-player'); if (!sel) return;
    var started = !!(S.table.turn && S.table.turn.started);
    var ps = S.table.players || [];
    var prev = sel.value || (S.table.turn && S.table.turn.activePlayerId) || '';
    sel.innerHTML = '<option value="">Seleccionar jugador...</option>' + ps.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>'; }).join('');
    if (prev && ps.some(function(p){return p.id===prev;})) sel.value = prev;
    sel.disabled = started || !!S.animatingPick;
    var pick = $('m-pick-random'); if (pick) pick.disabled = started || !!S.animatingPick || !ps.length;
    if (!started && !S.table.turn.activePlayerId && ps[0]) sel.value = ps[0].id;
  }
  function selectStartPlayer(pid, silent) {
    if (!S.table || !pid || (S.table.turn && S.table.turn.started)) return Promise.resolve();
    ensureTableState();
    var idx = (S.table.players||[]).findIndex(function(p){ return p.id===pid; });
    if (idx < 0) return Promise.resolve();
    S.table.turn.activePlayerId = pid; S.table.turn.index = idx; S.table.turn.started = false; S.table.turn.turnStartedAt = null;
    renderStartControls(); renderTop(); renderGrid();
    return persistTable({ turn: JSON.parse(JSON.stringify(S.table.turn)) }, 120).then(function(){ if(!silent){ var st=$('m-pick-status'); if(st) st.textContent='Jugador inicial seleccionado: ' + ((S.table.players[idx]||{}).name||pid) + '. Presiona Iniciar Tiempo.'; } });
  }
  function animateRandomPick() {
    if (!S.table || S.animatingPick || (S.table.turn && S.table.turn.started)) return;
    var ps = (S.table.players || []).filter(function(p){ var l=S.table.live&&S.table.live[p.id]; return !(l&&l.eliminated); });
    if (!ps.length) return;
    S.animatingPick = true;
    var sel = $('m-start-player'); var st = $('m-pick-status'); var i = 0, steps = 14 + Math.floor(Math.random()*8), delay = 55;
    renderStartControls();
    function tick() {
      var p = ps[i % ps.length]; i++;
      if (sel) sel.value = p.id;
      if (st) st.textContent = 'Seleccionando al azar: ' + p.name + '...';
      highlightSeat(p.id);
      if (i < steps) { delay = Math.min(260, Math.floor(delay * 1.12)); setTimeout(tick, delay); }
      else {
        var chosen = ps[Math.floor(Math.random()*ps.length)];
        if (sel) sel.value = chosen.id;
        if (st) st.textContent = 'Seleccionado: ' + chosen.name + '. Presiona Iniciar Tiempo.';
        S.animatingPick = false;
        selectStartPlayer(chosen.id, true).then(function(){ renderGrid(); renderStartControls(); renderTop(); });
      }
    }
    tick();
  }
  function highlightSeat(pid) {
    var grid = $('m-grid'); if (!grid) return;
    var seats = grid.querySelectorAll('[data-seat]');
    for (var i=0;i<seats.length;i++) seats[i].classList.toggle('is-picking', seats[i].getAttribute('data-seat')===pid);
  }
  function startLocalTime() {
    if (!S.table || S.animatingPick) return;
    ensureTableState();
    var pid = (S.table.turn && S.table.turn.activePlayerId) || (($('m-start-player')||{}).value);
    if (!pid) return alert('Selecciona quién inicia la partida.');
    var idx = (S.table.players||[]).findIndex(function(p){ return p.id===pid; });
    if (idx < 0) return alert('Jugador inicial inválido.');
    S.table.turn.activePlayerId = pid; S.table.turn.index = idx; S.table.turn.started = true; S.table.turn.turnStartedAt = Date.now();
    var st = $('m-pick-status'); if (st) st.textContent = 'Tiempo iniciado. Turno activo: ' + ((S.table.players[idx]||{}).name||pid) + '.';
    renderTop(); renderGrid();
    persistTable({ turn: JSON.parse(JSON.stringify(S.table.turn)) }, 0).then(function(){ try{ flushTable(); }catch(e){} });
  }
  function renderOfficialPreview() {
    var box = $('m-official-preview'); if(!box||!S.table) return;
    var statusEl = $('m-official-status');
    if (S.table.officialReport && S.table.officialReport.status==='submitted') {
      var r = S.table.officialReport; var pl=(r.placements||[]).map(function(x){ var p=(S.table.players||[]).find(function(z){return z.id===x.playerId;}); return (x.placement)+'º '+(p?p.name:x.playerId); }).join(' · ');
      box.innerHTML = '<span class="sync-mode sync-mode-firestore">enviado</span> '+esc(pl||'Resultado enviado'); if(statusEl) statusEl.textContent = 'Resultado oficial enviado al anfitrión.'; return;
    }
    var ps = S.table.players||[]; var alive = CompanionModel.alivePlayers(S.table).length; var total=ps.length;
    if (alive <= 1 && total > 1) box.innerHTML = '<span class="sync-mode sync-mode-local">listo</span> Mesa decidida. Asignación automática por orden de salida: 1er eliminado=4º, 2º=3º, 3º=2º, restante=1º. Envía el resultado oficial.';
    else if (CompanionModel.roundRemainingSec(S.session)===0 && S.session && S.session.roundStartedAt) box.innerHTML = '<span class="sync-mode sync-mode-local">tiempo global agotado</span> Envía el resultado oficial con el orden actual.';
    else box.textContent = 'En juego: '+alive+'/'+total+' con vida. Derrotas requieren confirmación (excepción por cartas como Ángel de Platino).';
  }

  function patchLive(pid, mutator, opts) {
    if(!S.table) return Promise.resolve();
    ensureTableState();
    var live = CompanionModel.ensureLive(S.table, pid, 40);
    mutator(live, S.table);
    var patch = { live: {}, turn: S.table.turn };
    patch.live[pid] = JSON.parse(JSON.stringify(live));
    // keep turn active id coherent
    if (S.table.turn && S.table.turn.activePlayerId) patch.turn = JSON.parse(JSON.stringify(S.table.turn));
    renderGrid(); renderTop();
    return persistTable(patch, opts && opts.delay != null ? opts.delay : 160);
  }

  function persistAllLive() {
    if(!S.table) return;
    var patch = { live: {}, turn: S.table.turn ? JSON.parse(JSON.stringify(S.table.turn)) : null };
    (S.table.players||[]).forEach(function(p){ if(S.table.live[p.id]) patch.live[p.id]=JSON.parse(JSON.stringify(S.table.live[p.id])); });
    persistTable(patch, 80);
  }

  function passTurn() {
    if(!S.table) return;
    ensureTableState();
    if (!(S.table.turn && S.table.turn.started)) { var st=$('m-pick-status'); if(st) st.textContent='Selecciona jugador inicial e Inicia Tiempo antes de pasar turnos.'; return; }
    CompanionModel.passTurn(S.table); renderGrid(); renderTop(); persistAllLive();
  }

  function openLossModal(pid, condition) {
    if (S.lossModal || !condition) return;
    S.lossModal = { pid: pid, condition: condition };
    var p = (S.table.players||[]).find(function(x){return x.id===pid;});
    $('m-loss-msg').innerHTML = '<strong>' + esc(p?p.name:pid) + '</strong>: ' + esc(condition.label) + '.<br><span class="c-counter-hint">' + esc(condition.detail||'') + '</span><br><br>¿Has perdido el juego?';
    var m = $('m-loss-modal'); m.style.display = 'flex'; m.setAttribute('aria-hidden','false');
  }
  function closeLossModal() { S.lossModal = null; var m=$('m-loss-modal'); if(m){ m.style.display='none'; m.setAttribute('aria-hidden','true'); } }
  function checkPendingLossModal() {
    if (!S.table || S.lossModal) return;
    if ($('m-loss-modal') && $('m-loss-modal').style.display !== 'none') return;
    var ps = S.table.players || [];
    for (var i=0;i<ps.length;i++) {
      var live = CompanionModel.ensureLive(S.table, ps[i].id);
      if (live.eliminated) continue;
      var conds = CompanionModel.detectLossConditions(S.table, ps[i].id, S.session);
      if (conds.length) { openLossModal(ps[i].id, conds[0]); return; }
    }
  }
  function confirmLossYes() {
    if (!S.lossModal) return;
    var pid = S.lossModal.pid, cond = S.lossModal.condition;
    closeLossModal();
    patchLive(pid, function(l,t){ CompanionModel.confirmElimination(t, pid, cond, Date.now()); Object.assign(l, t.live[pid]); }, {delay:0}).then(function(){
      flushTable(); renderGrid(); renderTop(); maybeAutoSubmit();
    });
  }
  function confirmLossNo() {
    if (!S.lossModal) return;
    var pid = S.lossModal.pid, cond = S.lossModal.condition;
    closeLossModal();
    patchLive(pid, function(l){ CompanionModel.ignoreCondition(l, cond); }, {delay:0}).then(function(){ renderGrid(); renderTop(); setTimeout(checkPendingLossModal, 50); });
  }
  function surrender(pid) {
    if (!S.table) return;
    var p = (S.table.players||[]).find(function(x){return x.id===pid;});
    if (!confirm('¿Confirmar rendición/pérdida forzada para ' + (p?p.name:pid) + '? Se asignará su puesto según el orden de salida.')) return;
    patchLive(pid, function(l,t){ CompanionModel.confirmElimination(t, pid, { type:'surrender', label:'Rendición / pérdida forzada', detail:'Confirmada manualmente (útil si se perdió una protección como Ángel de Platino).' }, Date.now()); Object.assign(l, t.live[pid]); }, {delay:0}).then(function(){ flushTable(); renderGrid(); renderTop(); maybeAutoSubmit(); });
  }
  function maybeAutoSubmit() {
    if (!S.table || S.autoSubmitted) return;
    if (S.table.officialReport && S.table.officialReport.status==='submitted') { S.autoSubmitted=true; return; }
    var ps=S.table.players||[]; var alive=CompanionModel.alivePlayers(S.table).length;
    if (ps.length>1 && alive<=1) {
      $('m-official-status').textContent = 'Mesa decidida por eliminaciones. Enviando resultado oficial automáticamente...';
      setTimeout(function(){ submitOfficial(true, true); }, 450);
    }
  }
  function submitOfficial(force, auto) {
    if(!S.table || !S.session) return;
    if (S.table.officialReport && S.table.officialReport.status==='submitted' && !force) { alert('El resultado oficial ya fue enviado.'); return; }
    ensureTableState(); CompanionModel.accrueActive(S.table);
    var alive = CompanionModel.alivePlayers(S.table).length; var rem = CompanionModel.roundRemainingSec(S.session);
    var reason = (alive<=1 && (S.table.players||[]).length>1) ? 'eliminations' : (rem===0 ? 'global-timeout' : 'manual');
    if (!auto && !force && alive>1 && rem>0) {
      if (!confirm('La mesa aún no termina por eliminaciones ni por tiempo global. ¿Enviar resultado oficial actual al anfitrión?')) return;
    }
    var report = CompanionModel.computeOfficialReport(S.table, S.session, reason);
    S.table.officialReport = Object.assign({ status: 'submitted' }, report);
    var livePatch = {}; (S.table.players||[]).forEach(function(p){ var l=S.table.live[p.id]; livePatch[p.id]={ timeUsedSec: CompanionModel.effectiveTimeUsed(S.table,p.id), eliminated: !!(l&&l.eliminated), elimination: l&&l.elimination||null, eliminationOrder: l&&l.eliminationOrder||null }; });
    S.autoSubmitted = true;
    persistTable({ officialReport: S.table.officialReport, live: livePatch, turn: S.table.turn }, 0).then(function(){ flushTable(); renderGrid(); renderTop(); if(!auto) alert('Resultado oficial enviado al anfitrión.'); }).catch(function(e){ alert('No se pudo enviar: '+(e&&e.message||e)); S.autoSubmitted=false; });
  }

  function bind() {
    document.body.addEventListener('click', function(e){
      var pass = e.target.closest('[data-pass-turn]'); if (pass) return passTurn();
      var surrenderBtn = e.target.closest('[data-surrender]'); if (surrenderBtn) return surrender(surrenderBtn.getAttribute('data-surrender'));
      var life = e.target.closest('[data-action][data-pid]'); if (life) {
        var pid = life.getAttribute('data-pid'), action = life.getAttribute('data-action'), delta = parseInt(life.getAttribute('data-delta'),10)||0;
        return patchLive(pid, function(l){
          if (action==='life') l.life = (Number(l.life)||0) + delta; // allow negative
          else if (action==='poison' || action==='experience' || action==='commanderTax' || action==='energy') l[action] = (Number(l[action])||0) + delta;
        }).then(function(){ setTimeout(checkPendingLossModal, 30); });
      }
      var cmd = e.target.closest('[data-cmdr-dmg]'); if (cmd) {
        var tpid = cmd.getAttribute('data-target'), op = cmd.getAttribute('data-op'), d = parseInt(cmd.getAttribute('data-delta'),10)||0;
        return patchLive(tpid, function(l){ l.commanderDamage=l.commanderDamage||{}; var en=l.commanderDamage[op]||(l.commanderDamage[op]={commanderName:'Comandante',damage:0}); en.damage=(Number(en.damage)||0)+d; }).then(function(){ setTimeout(checkPendingLossModal, 30); });
      }
      if (e.target && e.target.id === 'm-loss-yes') return confirmLossYes();
      if (e.target && e.target.id === 'm-loss-no') return confirmLossNo();
    });
    document.body.addEventListener('change', function(e){
      var nm = e.target.closest('.m-cmdr-name'); if(!nm) return;
      patchLive(nm.getAttribute('data-target'), function(l){ l.commanderDamage=l.commanderDamage||{}; var en=l.commanderDamage[nm.getAttribute('data-op')]||(l.commanderDamage[nm.getAttribute('data-op')]={commanderName:'',damage:0}); en.commanderName=nm.value; });
      if (e.target && e.target.id === 'm-start-player') selectStartPlayer(e.target.value);
    });
    var b; if ((b=$('m-pass-turn'))) b.addEventListener('click', passTurn);
    if ((b=$('m-submit-official'))) b.addEventListener('click', function(){ submitOfficial(false,false); });
    if ((b=$('m-pick-random'))) b.addEventListener('click', animateRandomPick);
    if ((b=$('m-start-time'))) b.addEventListener('click', startLocalTime);
    if ((b=$('m-open-join'))) b.addEventListener('click', function(){ if($('m-board')) $('m-board').style.display='none'; if($('m-join')) $('m-join').style.display='block'; });
    if ((b=$('m-join-btn'))) b.addEventListener('click', function(){
      S.sessionId = (($('m-session')&&$('m-session').value)||'').trim().toUpperCase(); S.tableId=(($('m-table')&&$('m-table').value)||'').trim();
      if(!S.sessionId||!S.tableId) return alert('Ingresa código de sesión e ID de mesa.');
      var url=new URL(location.href); url.searchParams.set('session',S.sessionId); url.searchParams.set('table',S.tableId); history.replaceState({},'',url);
      enter();
    });
  }

  function applySession(s){
    var prevStarted = !!(S.session && S.session.roundStartedAt);
    S.session=s; renderTop();
    // Si el anfitrión inicia tiempo global y la mesa ya eligió jugador inicial pero no inició conteo local, iniciar localmente.
    if (S.table && S.session && S.session.roundStartedAt && !prevStarted && S.table.turn && S.table.turn.activePlayerId && !S.table.turn.started) {
      S.table.turn.started = true; S.table.turn.turnStartedAt = Date.now();
      persistTable({ turn: JSON.parse(JSON.stringify(S.table.turn)) }, 0);
      var st=$('m-pick-status'); if(st) st.textContent='Tiempo global iniciado por el anfitrión. Turnos iniciados en la mesa.';
      renderTop(); renderGrid();
    }
  }
  function applyTable(t){
    S.table = t || S.table;
    if (S.table) { S.table.live=S.table.live||{}; S.table.turn=S.table.turn||{}; if (S.table.officialReport && S.table.officialReport.status==='submitted') S.autoSubmitted=true; }
    renderTop(); renderGrid(); checkPendingLossModal(); maybeAutoSubmit();
  }
  function subscribe(){
    S.unsubs.forEach(function(u){try{u();}catch(e){}}); S.unsubs=[];
    S.unsubs.push(TorneoSync.subscribeSession(S.sessionId, applySession));
    S.unsubs.push(TorneoSync.subscribeTable(S.sessionId, S.tableId, applyTable));
  }
  function enter(){ $('m-join').style.display='none'; $('m-board').style.display='block'; subscribe(); if(S.tick) clearInterval(S.tick); S.tick=setInterval(function(){ renderTop(); checkPendingLossModal(); },1000); }

  try {
    TorneoSync.init().then(function(){ badge(); if($('m-session')) $('m-session').value=S.sessionId; if($('m-table')) $('m-table').value=S.tableId; bind(); if(S.sessionId&&S.tableId) enter(); else { if($('m-join')) $('m-join').style.display='block'; if($('m-board')) $('m-board').style.display='none'; } }).catch(function(e){ console.warn('TorneoSync init', e); badge(); try{ bind(); }catch(be){ console.error(be); } var st=$('m-official-status'); if(st) st.textContent='Error de sincronización. Revisa conexión/Firebase config.'; var j=$('m-join'); if(j) j.style.display='block'; });
  } catch (e) { console.error('Mesa init error', e); try { var j2=$('m-join'); if(j2) j2.style.display='block'; } catch(_){} }
})();
