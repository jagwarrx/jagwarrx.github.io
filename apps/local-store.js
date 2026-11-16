/* Off claude.ai there is no shared database, so the apps keep their data in this browser (localStorage).
   Implements the small part of window.claude.use('db' | 'downloads') the apps call. Nothing leaves the device. */
(function () {
  if (window.claude && window.claude.use) return;
  var NS = 'hmeyy:' + location.pathname.replace(/index\.html$/, '') + ':';
  var subs = [];
  function read(p) { try { var r = localStorage.getItem(NS + p); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function write(p, v) { localStorage.setItem(NS + p, JSON.stringify(v)); setTimeout(fire, 0); }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function merge(a, b) { var o = isObj(a) ? JSON.parse(JSON.stringify(a)) : {}; Object.keys(b).forEach(function (k) { o[k] = isObj(b[k]) && isObj(o[k]) ? merge(o[k], b[k]) : b[k]; }); return o; }
  var META = { fromCache: false, hasPendingWrites: false };
  function snap(p) { var d = read(p), id = p.split('/').pop(); return { id: id, exists: d !== null, metadata: META, data: function () { return d === null ? undefined : JSON.parse(JSON.stringify(d)); } }; }
  function err(code) { var e = new Error(code); e.code = code; return e; }
  function doc(p) {
    return {
      id: p.split('/').pop(), path: p,
      get: function () { return Promise.resolve(snap(p)); },
      set: function (v, o) { write(p, o && o.merge ? merge(read(p), v) : v); return Promise.resolve(); },
      update: function (v) { var cur = read(p); if (cur === null) return Promise.reject(err('invalid_argument')); write(p, merge(cur, v)); return Promise.resolve(); },
      delete: function () { localStorage.removeItem(NS + p); setTimeout(fire, 0); return Promise.resolve(); },
      onSnapshot: function (cb) { var s = { run: function () { cb(snap(p)); } }; subs.push(s); s.run(); return function () { subs.splice(subs.indexOf(s), 1); }; }
    };
  }
  function query(c, ord, lim) {
    function run() {
      var pre = NS + c + '/', ids = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(pre) === 0 && k.slice(pre.length).indexOf('/') < 0) ids.push(k.slice(pre.length)); }
      var docs = ids.map(function (id) { return snap(c + '/' + id); });
      if (ord) docs.sort(function (a, b) { var x = a.data()[ord.f], y = b.data()[ord.f]; return (x < y ? -1 : x > y ? 1 : 0) * (ord.d === 'desc' ? -1 : 1); });
      if (lim) docs = docs.slice(0, lim);
      return { docs: docs, size: docs.length, empty: !docs.length, metadata: META, forEach: function (f) { docs.forEach(f); } };
    }
    return {
      orderBy: function (f, d) { return query(c, { f: f, d: d || 'asc' }, lim); },
      limit: function (n) { return query(c, ord, n); },
      doc: function (id) { return doc(c + '/' + id); },
      get: function () { return Promise.resolve(run()); },
      onSnapshot: function (cb) { var s = { run: function () { cb(run()); } }; subs.push(s); s.run(); return function () { subs.splice(subs.indexOf(s), 1); }; }
    };
  }
  function fire() { subs.slice().forEach(function (s) { try { s.run(); } catch (e) {} }); }
  var db = { doc: doc, collection: function (c) { return query(c); } };
  var downloads = { save: function (o) {
    var a = document.createElement('a'), u = URL.createObjectURL(new Blob([o.data], { type: 'text/plain' }));
    a.href = u; a.download = o.filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
    return Promise.resolve();
  } };
  window.claude = { use: function (k) { return Promise.resolve(k === 'db' ? db : k === 'downloads' ? downloads : null); } };
})();
