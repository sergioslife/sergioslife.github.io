(function (global) {
  'use strict';
  var bc = null;
  var listeners = { session: {}, table: {} };
  var mem = { sessions: {}, tables: {} };

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
    map[k] = map[k] || [];
    map[k].push(fn);
    return function () { map[k] = (map[k] || []).filter(function (x) { return x !== fn; }); };
  }

  function read(k) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  function setupBC() {
    if (bc || typeof BroadcastChannel === 'undefined') return;
    try {
      bc = new BroadcastChannel('torneo-sync');
      bc.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.type === 'session') { mem.sessions[m.id] = m.data; emit('session', m.id, null, m.data); }
        if (m.type === 'table') {
          mem.tables[m.sid + '::' + m.tid] = m.data;
          emit('table', m.sid, m.tid, m.data);
        }
      };
    } catch (e) { bc = null; }
  }

  var LocalProvider = {
    name: 'local',
    init: function () { setupBC(); return Promise.resolve(); },
    publishSession: function (id, data) {
      mem.sessions[id] = data; write(keySession(id), data);
      if (bc) bc.postMessage({ type: 'session', id: id, data: data });
      emit('session', id, null, data);
      return Promise.resolve();
    },
    publishTable: function (sid, tid, data) {
      mem.tables[sid + '::' + tid] = data; write(keyTable(sid, tid), data);
      if (bc) bc.postMessage({ type: 'table', sid: sid, tid: tid, data: data });
      emit('table', sid, tid, data);
      return Promise.resolve();
    },
    subscribeSession: function (id, fn) {
      var off = on('session', id, null, fn);
      var cached = mem.sessions[id] || read(keySession(id));
      if (cached) fn(cached);
      return off;
    },
    subscribeTable: function (sid, tid, fn) {
      var off = on('table', sid, tid, fn);
      var cached = mem.tables[sid + '::' + tid] || read(keyTable(sid, tid));
      if (cached) fn(cached);
      return off;
    },
    updatePlayerState: function (sid, tid, playerId, patch) {
      var k = sid + '::' + tid;
      var data = mem.tables[k] || read(keyTable(sid, tid)) || { players: [] };
      data.players = data.players || [];
      var p = data.players.find(function (x) { return x.id === playerId; });
      if (!p) { p = { id: playerId }; data.players.push(p); }
      Object.keys(patch || {}).forEach(function (pk) { p[pk] = patch[pk]; });
      data.updatedAt = Date.now();
      return this.publishTable(sid, tid, data);
    }
  };

  var FirestoreProvider = {
    name: 'firestore',
    db: null, fs: null,
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
        self.db = fs.getFirestore(app);
        self.fs = fs;
      });
    },
    publishSession: function (id, data) {
      var fs = this.fs, ref = fs.doc(this.db, 'torneoSessions', id);
      return fs.setDoc(ref, Object.assign({}, data, { updatedAt: fs.serverTimestamp() }), { merge: true });
    },
    publishTable: function (sid, tid, data) {
      var fs = this.fs, ref = fs.doc(this.db, 'torneoSessions', sid, 'tables', tid);
      return fs.setDoc(ref, Object.assign({}, data, { updatedAt: fs.serverTimestamp() }), { merge: true });
    },
    subscribeSession: function (id, fn) {
      var fs = this.fs, ref = fs.doc(this.db, 'torneoSessions', id);
      return fs.onSnapshot(ref, function (snap) { if (snap.exists()) fn(snap.data()); });
    },
    subscribeTable: function (sid, tid, fn) {
      var fs = this.fs, ref = fs.doc(this.db, 'torneoSessions', sid, 'tables', tid);
      return fs.onSnapshot(ref, function (snap) { if (snap.exists()) fn(snap.data()); });
    },
    updatePlayerState: function (sid, tid, playerId, patch) {
      var self = this, fs = this.fs, ref = fs.doc(this.db, 'torneoSessions', sid, 'tables', tid);
      return fs.runTransaction(this.db, function (tx) {
        return tx.get(ref).then(function (snap) {
          var data = snap.exists() ? snap.data() : { players: [] };
          data.players = data.players || [];
          var p = data.players.find(function (x) { return x.id === playerId; });
          if (!p) { p = { id: playerId }; data.players.push(p); }
          Object.keys(patch || {}).forEach(function (pk) { p[pk] = patch[pk]; });
          tx.set(ref, data, { merge: true });
        });
      });
    }
  };

  global.TorneoSync = {
    provider: null,
    mode: 'none',
    init: function (preferred) {
      var self = this;
      var tryFs = function () {
        if (!global.TORNEO_FIREBASE_CONFIG) return Promise.reject(new Error('no config'));
        return FirestoreProvider.init().then(function () { self.provider = FirestoreProvider; self.mode = 'firestore'; });
      };
      var useLocal = function () { return LocalProvider.init().then(function () { self.provider = LocalProvider; self.mode = 'local'; }); };
      if (preferred === 'local') return useLocal();
      return tryFs().catch(useLocal);
    },
    ready: function () { return !!this.provider; },
    publishSession: function () { return this.provider ? this.provider.publishSession.apply(this.provider, arguments) : Promise.resolve(); },
    publishTable: function () { return this.provider ? this.provider.publishTable.apply(this.provider, arguments) : Promise.resolve(); },
    subscribeSession: function () { return this.provider ? this.provider.subscribeSession.apply(this.provider, arguments) : function () {}; },
    subscribeTable: function () { return this.provider ? this.provider.subscribeTable.apply(this.provider, arguments) : function () {}; },
    updatePlayerState: function () { return this.provider ? this.provider.updatePlayerState.apply(this.provider, arguments) : Promise.resolve(); }
  };
  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (e.key.indexOf('torneoSync:session:') === 0) {
      var id = e.key.slice('torneoSync:session:'.length);
      var data = read(e.key); if (data) emit('session', id, null, data);
    }
    if (e.key.indexOf('torneoSync:table:') === 0) {
      var rest = e.key.slice('torneoSync:table:'.length);
      var parts = rest.split(':');
      var data2 = read(e.key); if (data2 && parts.length >= 2) emit('table', parts[0], parts.slice(1).join(':'), data2);
    }
  });
})(window);
