(function () {
  'use strict';
  var qs = new URLSearchParams(location.search);
  var S = { sessionId: (qs.get('session')||'').toUpperCase(), tableId: qs.get('table') || qs.get('id') || '', session: null, table: null, unsubs: [], tick: null, localView: {} };
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  var fmt = function(sec){ sec=Math.max(0,Math.floor(sec||0)); var m=Math.floor(sec/60),s=sec%60; return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); };
  function badge(){ var b=$('m-sync'); if(!b||!window.TorneoSync) return; var m=TorneoSync.mode||'local'; b.className='sync-mode sync-mode-'+m; b.textContent=m==='firestore'?'tiempo real':'local'; }
  function persistTable(patch, delay){ if(!S.sessionId||!S.tableId||!window.TorneoSync) return Promise.resolve(); return TorneoSync.patchTable(S.sessionId,S.tableId,patch,delay); }
  function flushTable(){ if(!S.sessionId||!S.tableId||!window.TorneoSync||!TorneoSync.flushTable) return; TorneoSync.flushTable(S.sessionId,S.tableId); }

  function ensureTableState() {
    if (!S.table) return;
    S.table.live = S.table.live || {};
    S.table.turn = S.table.turn || {};
    var ps = S.table.players || [];
    ps.forEach(function(p){ CompanionModel.ensureLive(S.table, p.id, 40); });
    if (!S.table.turn.activePlayerId && ps[0]) { S.table.turn.index = 0; S.table.turn.activePlayerId = ps[0].id; S.table.turn.startedAt = Date.now(); }
    if (S.table.turn.index == null) {
      var idx = ps.findIndex(function(p){ return p.id === S.table.turn.activePlayerId; });
      S.table.turn.index = idx >= 0 ? idx : 0;
    }
  }

  function renderTop() {
    if (!S.session || !S.table) return;
    $('m-title').textContent = (S.session.tournamentName || 'Mesa') + ' · Mesa ' + (S.table.tableIndex || '');
    $('m-sub').textContent = 'Sesión ' + S.sessionId + ' · Ronda ' + (S.session.roundNumber||'-');
    var rem = CompanionModel.roundRemainingSec(S.session);
    var rt = $('m-round-timer'); rt.textContent = fmt(rem); rt.className = (rem<=60?'danger':rem<=300?'warn':'');
    $('m-round-meta').textContent = S.session.roundPausedAt ? 'pausada' : (rem===0 && S.session.roundStartedAt ? 'tiempo agotado' : 'tiempo global');
    ensureTableState();
    var aid = CompanionModel.activePlayerId(S.table);
    var ap = (S.table.players||[]).find(function(p){return p.id===aid;});
    $('m-active-name').textContent = ap ? ap.name : '-';
    $('m-active-time').textContent = fmt(CompanionModel.turnElapsedSec(S.table));
    renderOfficialPreview();
  }

  function quadrant(p, idx, n) {
    var live = CompanionModel.ensureLive(S.table, p.id, 40);
    var aid = CompanionModel.activePlayerId(S.table);
    var active = aid === p.id;
    var elim = live.eliminated ? (live.elimination||{}) : CompanionModel.eliminationFor(live);
    var elimClass = (live.eliminated || elim) ? ' is-elim' : '';
    var turnClass = active ? ' is-active' : '';
    var posClass = ' pos-' + idx;
    var cmdr = renderCmdr(p, live);
    var status = live.eliminated ? ('Eliminado: ' + esc((live.elimination&&live.elimination.label)||'derrota')) : (elim ? ('Condición: ' + esc(elim.label)) : (active ? 'Turno activo' : 'En juego'));
    return '<article class="m-seat'+turnClass+elimClass+posClass+'" data-seat="'+esc(p.id)+'">'
      + '<div class="m-seat-head"><div class="m-seat-name">'+esc(p.name)+'</div><div class="m-seat-status">'+status+'</div></div>'
      + '<div class="m-life-row"><button class="m-life-btn" data-pid="'+esc(p.id)+'" data-action="life" data-delta="-5">-5</button>'
      + '<button class="m-life-btn" data-pid="'+esc(p.id)+'" data-action="life" data-delta="-1">-</button>'
      + '<div class="m-life-val">'+(live.life!=null?live.life:40)+'</div>'
      + '<button class="m-life-btn plus" data-pid="'+esc(p.id)+'" data-action="life" data-delta="1">+</button>'
      + '<button class="m-life-btn plus" data-pid="'+esc(p.id)+'" data-action="life" data-delta="5">+5</button></div>'
      + '<div class="m-subgrid">'
      + counter(p.id,'poison','Veneno',live.poison,10)
      + counter(p.id,'experience','Exp.',live.experience)
      + counter(p.id,'commanderTax','Imp. cmdr',live.commanderTax)
      + counter(p.id,'energy','Energía',live.energy)
      + '</div>'
      + '<details class="m-details"'+(S.localView[p.id]&&S.localView[p.id].cmdr?' open':'')+'><summary data-toggle-cmdr="'+esc(p.id)+'"><i class="fas fa-chess-king"></i> Daño de comandante</summary><div class="m-cmdr-wrap">'+cmdr+'</div></details>'
      + '<div class="m-seat-foot"><span class="m-time-used">Tiempo usado: '+fmt(live.timeUsedSec||0)+'</span>'+(active?'<button class="btn-primary btn-sm m-pass-inline" data-pass-turn="1"><i class="fas fa-forward"></i> Pasar</button>':'')+'</div>'
      + '</article>';
  }
  function counter(pid, field, label, val, dangerAt){
    var d = (dangerAt && Number(val)>=dangerAt) ? ' danger' : '';
    return '<div class="m-ctr"><span class="m-ctr-l">'+esc(label)+'</span><div class="m-ctr-r"><button data-pid="'+esc(pid)+'" data-action="'+field+'" data-delta="-1">−</button><b class="'+d+'">'+(Number(val)||0)+'</b><button data-pid="'+esc(pid)+'" data-action="'+field+'" data-delta="1">+</button></div></div>';
  }
  function renderCmdr(p, live){
    var others = (S.table.players||[]).filter(function(o){return o.id!==p.id;});
    if(!others.length) return '<div class="c-counter-hint">Sin oponentes.</div>';
    return others.map(function(o){
      var e = (live.commanderDamage||{})[o.id] || { commanderName:'Comandante de '+o.name, damage:0 };
      var lethal = (Number(e.damage)||0)>=21 ? ' lethal':'';
      return '<div class="m-cmdr" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'">'
        + '<label>De '+esc(o.name)+'<input class="m-cmdr-name" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" value="'+esc(e.commanderName||'')+'" placeholder="Nombre comandante"></label>'
        + '<div class="m-cmdr-row"><button data-cmdr-dmg="1" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" data-delta="-1">−</button><strong class="'+lethal+'">'+(Number(e.damage)||0)+'</strong><button data-cmdr-dmg="1" data-target="'+esc(p.id)+'" data-op="'+esc(o.id)+'" data-delta="1">+</button></div>'
        + '</div>';
    }).join('');
  }

  function renderGrid() {
    if (!S.table) return;
    ensureTableState();
    var ps = S.table.players || [];
    var grid = $('m-grid');
    grid.className = 'm-grid seats-' + (ps.length || 4);
    grid.innerHTML = ps.map(function(p,i){ return quadrant(p,i,ps.length); }).join('');
  }

  function renderOfficialPreview() {
    var box = $('m-official-preview'); if(!box||!S.table) return;
    if (S.table.officialReport && S.table.officialReport.status==='submitted') {
      var r = S.table.officialReport; var pl=(r.placements||[]).map(function(x){ var p=(S.table.players||[]).find(function(z){return z.id===x.playerId;}); return (x.placement)+'º '+(p?p.name:x.playerId)+(x.points!=null?' ('+x.points+' pts)':''); }).join(' · ');
      box.innerHTML = '<span class="sync-mode sync-mode-firestore">enviado</span> '+esc(pl||'Resultado enviado'); $('m-official-status').textContent = 'Resultado oficial enviado al anfitrión.'; return;
    }
    var alive = CompanionModel.alivePlayers(S.table).length; var total=(S.table.players||[]).length;
    if (alive <= 1 && total > 1) box.innerHTML = '<span class="sync-mode sync-mode-local">listo</span> Queda '+alive+' jugador con vida. Puedes enviar el resultado oficial.';
    else if (CompanionModel.roundRemainingSec(S.session)===0 && S.session && S.session.roundStartedAt) box.innerHTML = '<span class="sync-mode sync-mode-local">tiempo global agotado</span> Puedes enviar el resultado oficial con el orden actual.';
    else box.textContent = 'En juego: '+alive+'/'+total+' con vida. El estado visual se sincroniza; el anfitrión recibe solo el resultado oficial.';
  }

  function markEliminations(changedPid) {
    if(!S.table) return;
    var ps = S.table.players||[]; var now = Date.now(); var changed=false;
    ps.forEach(function(p){
      var l = CompanionModel.ensureLive(S.table,p.id);
      if (l.eliminated) return;
      var elim = CompanionModel.eliminationFor(l);
      if (elim) { CompanionModel.applyElimination(l, elim, now); changed=true; }
    });
    // if personal time budget exhausted? (turn time is accumulated separately; global round handled; per-player budget visual only unless you want auto-loss)
    // auto-finish trigger when 1 left
    var alive = CompanionModel.alivePlayers(S.table);
    if (ps.length > 1 && alive.length <= 1 && !(S.table.officialReport && S.table.officialReport.status==='submitted')) {
      $('m-official-status').textContent = 'Mesa finalizada por eliminaciones. Revisa y envía el resultado oficial al anfitrión.';
    }
    return changed;
  }

  function patchLive(pid, mutator) {
    if(!S.table) return;
    ensureTableState();
    var live = CompanionModel.ensureLive(S.table, pid, 40);
    mutator(live);
    markEliminations(pid);
    var patch = { live: {} }; patch.live[pid] = JSON.parse(JSON.stringify(live));
    renderGrid(); renderTop();
    persistTable(patch, 180);
  }

  function passTurn() {
    if(!S.table) return;
    ensureTableState();
    CompanionModel.passTurn(S.table);
    markEliminations();
    var aid = CompanionModel.activePlayerId(S.table);
    var live = S.table.live[aid] ? JSON.parse(JSON.stringify(S.table.live[aid])) : null;
    var patch = { turn: S.table.turn, live: {} };
    // accrueActive mutated previous active; easiest: send all live times minimally
    (S.table.players||[]).forEach(function(p){ if(S.table.live[p.id]) patch.live[p.id] = { timeUsedSec: S.table.live[p.id].timeUsedSec }; });
    renderGrid(); renderTop(); persistTable(patch, 80);
  }

  function submitOfficial(force) {
    if(!S.table || !S.session) return;
    if (S.table.officialReport && S.table.officialReport.status==='submitted' && !force) { alert('El resultado oficial ya fue enviado.'); return; }
    ensureTableState();
    CompanionModel.accrueActive(S.table);
    markEliminations();
    var alive = CompanionModel.alivePlayers(S.table).length;
    var rem = CompanionModel.roundRemainingSec(S.session);
    var reason = (alive<=1 && (S.table.players||[]).length>1) ? 'eliminations' : (rem===0 ? 'global-timeout' : 'manual');
    if (!force && alive>1 && rem>0) {
      if (!confirm('La mesa aún no termina por eliminaciones ni por tiempo global. ¿Enviar resultado oficial actual al anfitrión?')) return;
    }
    var report = CompanionModel.computeOfficialReport(S.table, S.session, reason);
    S.table.officialReport = Object.assign({ status: 'submitted' }, report);
    // include current times
    var livePatch = {}; (S.table.players||[]).forEach(function(p){ livePatch[p.id] = { timeUsedSec: (S.table.live[p.id]&&S.table.live[p.id].timeUsedSec)||0, eliminated: !!(S.table.live[p.id]&&S.table.live[p.id].eliminated), elimination: S.table.live[p.id]&&S.table.live[p.id].elimination||null }; });
    persistTable({ officialReport: S.table.officialReport, live: livePatch, turn: S.table.turn }, 0).then(function(){ flushTable(); renderTop(); alert('Resultado oficial enviado al anfitrión.'); }).catch(function(e){ alert('No se pudo enviar: '+(e&&e.message||e)); });
  }

  function bind() {
    document.body.addEventListener('click', function(e){
      var pass = e.target.closest('[data-pass-turn]'); if (pass) return passTurn();
      var life = e.target.closest('[data-action][data-pid]'); if (life) {
        var pid = life.getAttribute('data-pid'), action = life.getAttribute('data-action'), delta = parseInt(life.getAttribute('data-delta'),10)||0;
        return patchLive(pid, function(l){
          if (action==='life') l.life = (Number(l.life)||0) + delta;
          else l[action] = Math.max(0, (Number(l[action])||0) + delta);
        });
      }
      var cmd = e.target.closest('[data-cmdr-dmg]'); if (cmd) {
        var tpid = cmd.getAttribute('data-target'), op = cmd.getAttribute('data-op'), d = parseInt(cmd.getAttribute('data-delta'),10)||0;
        return patchLive(tpid, function(l){ l.commanderDamage=l.commanderDamage||{}; var en=l.commanderDamage[op]||(l.commanderDamage[op]={commanderName:'Comandante',damage:0}); en.damage=Math.max(0,(Number(en.damage)||0)+d); });
      }
    });
    document.body.addEventListener('change', function(e){
      var nm = e.target.closest('.m-cmdr-name'); if(!nm) return;
      patchLive(nm.getAttribute('data-target'), function(l){ l.commanderDamage=l.commanderDamage||{}; var en=l.commanderDamage[nm.getAttribute('data-op')]||(l.commanderDamage[nm.getAttribute('data-op')]={commanderName:'',damage:0}); en.commanderName=nm.value; });
    });
    $('m-pass-turn').addEventListener('click', passTurn);
    $('m-submit-official').addEventListener('click', function(){ submitOfficial(false); });
    $('m-open-join').addEventListener('click', function(){ $('m-board').style.display='none'; $('m-join').style.display='block'; });
    $('m-join-btn').addEventListener('click', function(){
      S.sessionId = ($('m-session').value||'').trim().toUpperCase(); S.tableId=($('m-table').value||'').trim();
      if(!S.sessionId||!S.tableId) return alert('Ingresa código de sesión e ID de mesa.');
      var url=new URL(location.href); url.searchParams.set('session',S.sessionId); url.searchParams.set('table',S.tableId); history.replaceState({},'',url);
      enter();
    });
  }

  function applySession(s){ S.session=s; renderTop(); }
  function applyTable(t){
    // merge carefully: don't clobber local optimistic detail except server is authoritative for shared table
    S.table = t || S.table;
    if (S.table) { S.table.live=S.table.live||{}; S.table.turn=S.table.turn||{}; }
    renderTop(); renderGrid();
  }
  function subscribe(){
    S.unsubs.forEach(function(u){try{u();}catch(e){}}); S.unsubs=[];
    S.unsubs.push(TorneoSync.subscribeSession(S.sessionId, applySession));
    S.unsubs.push(TorneoSync.subscribeTable(S.sessionId, S.tableId, applyTable));
  }
  function enter(){ $('m-join').style.display='none'; $('m-board').style.display='block'; subscribe(); if(S.tick) clearInterval(S.tick); S.tick=setInterval(renderTop,1000); }

  TorneoSync.init().then(function(){ badge(); $('m-session').value=S.sessionId; $('m-table').value=S.tableId; bind(); if(S.sessionId&&S.tableId) enter(); }).catch(function(e){ badge(); bind(); console.warn(e); });
})();
