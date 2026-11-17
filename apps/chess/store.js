// store.js: the chess app was written against a small local server (/api/positions, /api/principles).
// On the site there is no server, so this answers those same requests from localStorage.
// Everything stays in this browser; Settings has export and import.
(function () {
  var NS = 'hmeyy:chess:';
  var realFetch = window.fetch.bind(window);

  function read(kind) { try { return JSON.parse(localStorage.getItem(NS + kind)) || []; } catch (e) { return []; } }
  function write(kind, list) { localStorage.setItem(NS + kind, JSON.stringify(list)); }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }
  function reply(body, status) {
    return Promise.resolve(new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } }));
  }
  var EDITABLE = { positions: ['notes', 'lesson', 'tags'], principles: ['text', 'tags', 'games'] };

  window.fetch = function (url, opts) {
    var m = typeof url === 'string' && url.match(/^\/api\/(positions|principles)(?:\/([\w-]+))?$/);
    if (!m) return realFetch(url, opts);
    var kind = m[1], id = m[2], method = ((opts && opts.method) || 'GET').toUpperCase();
    var list = read(kind), body = opts && opts.body ? JSON.parse(opts.body) : {};
    var now = new Date().toISOString();
    if (method === 'GET' && !id) {
      return reply(list.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }));
    }
    if (method === 'GET') {
      var one = list.filter(function (x) { return x.id === id; })[0];
      return one ? reply(one) : reply({ error: 'not found' }, 404);
    }
    if (method === 'POST') {
      body.id = uuid(); body.createdAt = now; body.updatedAt = now;
      if (kind === 'principles') { body.games = body.games || []; body.tags = body.tags || []; }
      list.push(body); write(kind, list);
      return reply(body);
    }
    if (method === 'PUT') {
      var i = list.findIndex(function (x) { return x.id === id; });
      if (i < 0) return reply({ error: 'not found' }, 404);
      EDITABLE[kind].forEach(function (k) { if (body[k] !== undefined) list[i][k] = body[k]; });
      list[i].updatedAt = now; write(kind, list);
      return reply(list[i]);
    }
    if (method === 'DELETE') {
      write(kind, list.filter(function (x) { return x.id !== id; }));
      return reply({ ok: true });
    }
    return reply({ error: 'bad method' }, 405);
  };

  window.ChessStore = {
    NS: NS, read: read, write: write,
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(NS + k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { localStorage.setItem(NS + k, JSON.stringify(v)); },
    exportAll: function () {
      var out = { app: 'hmeyy chess analyzer', exportedAt: new Date().toISOString(), data: {} };
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf(NS) === 0) out.data[k.slice(NS.length)] = JSON.parse(localStorage.getItem(k));
      }
      return out;
    },
    importAll: function (obj) {
      if (!obj || !obj.data) throw new Error('Not a chess analyzer export');
      Object.keys(obj.data).forEach(function (k) {
        var cur = read(k), inc = obj.data[k];
        if (Array.isArray(cur) && Array.isArray(inc)) {
          var ids = {}; cur.forEach(function (x) { if (x && x.id) ids[x.id] = 1; });
          write(k, cur.concat(inc.filter(function (x) { return !x || !x.id || !ids[x.id]; })));
        } else if (localStorage.getItem(NS + k) == null) {
          localStorage.setItem(NS + k, JSON.stringify(inc));
        }
      });
    }
  };
})();
