(function (global) {
  'use strict';
  var bc = null;
  var listeners = { session: {}, table: {} };
  var mem = { sessions: {}, tables: {} };
  var pending = {};

  function keySession(id) { return 'torneoSync:session:' + id; }
  function keyTable(s, t) { return 'torneoSync:table:' + s + ':' + t; }
  function emit(kind, a, b, data) {
    var map = listeners[kind];
    var k = kind === 'session' ? a : (a + '::' + b);
    (map[k] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
  }
  function on(kind, a, b, fn) {
    var map = listeners[kind];
    var k = kind === 'session' ? a : (a + '::' + b);
    map[k] = map[k] || []; map[k].push(fn);
    return function () { map[k] = (map[k] || []).filter(function (x) { return x !== fn; }); };
  }
  function read(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clone(o){ return JSON.parse(JSON.stringify(o||null)); }
  function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
    var out = (base && typeof base === 'object' && !Array.isArray(base)) ? clone(base) : {};
    Object.keys(patch).forEach(function (k) {
      var pv = patch[k], bv = out[k];
      if (pv && typeof pv === 'object' && !Array.isArray(pv)) out[k] = deepMerge(bv, pv);
      else out[k] = clone(pv);
    });
    return out;
  }
  function setupBC() {
    if (bc || typeof BroadcastChannel === 'undefined') return;
    try {
      bc = new BroadcastChannel('torneo-sync');
      bc.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.type === 'session') { mem.sessions[m.id] = m.data; write(keySession(m.id), m.data); emit('session', m.id, null, m.data); }
        if (m.type === 'table') { mem.tables[m.sid + '::' + m.tid] = m.data; write(keyTable(m.sid, m.tid), m.data); emit('table', m.sid, m.tid, m.data); }
      };
    } catch (e) { bc = null; }
  }
  function flushTable(sid, tid) {
    var k = sid + '::' + tid;
    if (!pending[k]) return;
    var data = pending[k]; delete pending[k];
    data.updatedAt = Date.now();
    return (global.TorneoSync.provider || LocalProvider).publishTable(sid, tid, data).catch(function(){});
  }
  function queueTablePatch(sid, tid, patch, delayMs) {
    var k = sid + '::' + tid;
    var base = pending[k] || mem.tables[k] || read(keyTable(sid, tid)) || {};
    pending[k] = deepMerge(base, patch);
    mem.tables[k] = pending[k];
    clearTimeout(pending[k + '::__t']);
    pending[k + '::__t'] = setTimeout(function(){ delete pending[k + '::__t']; flushTable(sid, tid); }, delayMs == null ? 220 : delayMs);
    return Promise.resolve(pending[k]);
  }

  var LocalProvider = {
    name: 'local',
    init: function () { setupBC(); return Promise.resolve(); },
    publishSession: function (id, data) { mem.sessions[id] = data; write(keySession(id), data); if (bc) bc.postMessage({ type: 'session', id: id, data: data }); emit('session', id, null, data); return Promise.resolve(); },
    publishTable: function (sid, tid, data) { mem.tables[sid + '::' + tid] = data; write(keyTable(sid, tid), data); if (bc) bc.postMessage({ type: 'table', sid: sid, tid: tid, data: data }); emit('table', sid, tid, data); return Promise.resolve(); },
    subscribeSession: function (id, fn) { var off = on('session', id, null, fn); var cached = mem.sessions[id] || read(keySession(id)); if (cached) fn(cached); return off; },
    subscribeTable: function (sid, tid, fn) { var off = on('table', sid, tid, fn); var cached = mem.tables[sid + '::' + tid] || read(keyTable(sid, tid)); if (cached) fn(cached); return off; }
  };

  var FirestoreProvider = {
    name: 'firestore', db: null, fs: null,
    init: function () {
      var cfg = global.TORNEO_FIREBASE_CONFIG;
      if (!cfg) return Promise.reject(new Error('No Firebase config'));
      var self = this;
      return Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
      ]).then(function (mods) {
        var appMod = mods[0], fs = mods[1];
        var app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
        self.db = fs.getFirestore(app); self.fs = fs;
      });
    },
    _ref: function (sid, tid) { return this.fs.doc(this.db, 'torneoSessions', sid, 'tables', tid); },
    publishSession: function (id, data) { var fs = this.fs; return fs.setDoc(fs.doc(this.db, 'torneoSessions', id), Object.assign({}, data, { updatedAt: fs.serverTimestamp() }), { merge: true }); },
    publishTable: function (sid, tid, data) { var fs = this.fs; return fs.setDoc(this._ref(sid, tid), Object.assign({}, data, { updatedAt: fs.serverTimestamp() }), { merge: true }); },
    subscribeSession: function (id, fn) { var fs = this.fs; return fs.onSnapshot(fs.doc(this.db, 'torneoSessions', id), function (snap) { if (snap.exists()) fn(snap.data()); }, function(e){ console.warn('session sub', e); }); },
    subscribeTable: function (sid, tid, fn) { var fs = this.fs; return fs.onSnapshot(this._ref(sid, tid), function (snap) { if (snap.exists()) fn(snap.data()); }, function(e){ console.warn('table sub', e); }); }
  };

  global.TorneoSync = {
    provider: null, mode: 'none',
    init: function (preferred) {
      var self = this;
      var tryFs = function () { if (!global.TORNEO_FIREBASE_CONFIG) return Promise.reject(new Error('no config')); return FirestoreProvider.init().then(function () { self.provider = FirestoreProvider; self.mode = 'firestore'; }); };
      var useLocal = function () { return LocalProvider.init().then(function () { self.provider = LocalProvider; self.mode = 'local'; }); };
      if (preferred === 'local') return useLocal();
      return tryFs().catch(useLocal);
    },
    ready: function () { return !!this.provider; },
    publishSession: function () { return this.provider ? this.provider.publishSession.apply(this.provider, arguments) : Promise.resolve(); },
    publishTable: function () { return this.provider ? this.provider.publishTable.apply(this.provider, arguments) : Promise.resolve(); },
    subscribeSession: function () { return this.provider ? this.provider.subscribeSession.apply(this.provider, arguments) : function () {}; },
    subscribeTable: function () { return this.provider ? this.provider.subscribeTable.apply(this.provider, arguments) : function () {}; },
    patchTable: function (sid, tid, patch, delayMs) { return queueTablePatch(sid, tid, patch, delayMs); },
    flushTable: function (sid, tid) { return flushTable(sid, tid); }
  };
  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (e.key.indexOf('torneoSync:session:') === 0) { var id = e.key.slice('torneoSync:session:'.length); var data = read(e.key); if (data) { mem.sessions[id]=data; emit('session', id, null, data); } }
    if (e.key.indexOf('torneoSync:table:') === 0) { var rest = e.key.slice('torneoSync:table:'.length); var parts = rest.split(':'); var data2 = read(e.key); if (data2 && parts.length >= 2) { mem.tables[parts[0]+'::'+parts.slice(1).join(':')]=data2; emit('table', parts[0], parts.slice(1).join(':'), data2); } }
  });
})(window);
