// claude.js: lets a static page on this site call Claude with the visitor's own API key.
// The key is kept in this browser (localStorage if "remember" is ticked, else sessionStorage)
// and is sent only to api.anthropic.com. This site has no server and never sees it.
// Exposes window.Claude: key box UI, a streaming call, a cost estimate and a small Markdown renderer.
(function () {
  var API = 'https://api.anthropic.com/v1/messages';
  var VERSION = '2026-10-21';
  var K = 'hmeyy:claude:key', M = 'hmeyy:claude:model';
  var MODELS = [
    { id: 'claude-opus-5-5', name: 'Opus 5.5', note: 'best', inp: 4, out: 20, fallbacks: true },
    { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', note: 'about half the cost', inp: 2, out: 10, fallbacks: true },
    { id: 'claude-haiku-5-5', name: 'Haiku 5.5', note: 'cheapest, weakest', inp: 0.1, out: 0.5, fallbacks: false }
  ];

  function store(remember) { return remember ? localStorage : sessionStorage; }
  function getKey() { return localStorage.getItem(K) || sessionStorage.getItem(K) || ''; }
  function setKey(k, remember) {
    localStorage.removeItem(K); sessionStorage.removeItem(K);
    if (k) store(remember).setItem(K, k);
    changed();
  }
  function getModel() {
    var m = localStorage.getItem(M);
    return MODELS.some(function (x) { return x.id === m; }) ? m : MODELS[0].id;
  }
  function setModel(m) { localStorage.setItem(M, m); changed(); }
  function modelInfo(id) { return MODELS.filter(function (x) { return x.id === id; })[0] || MODELS[0]; }

  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function changed() { listeners.forEach(function (fn) { fn(); }); boxes.forEach(function (b) { b(); }); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- Key box -------------------------------------------------------------------------------
  var boxes = [];
  function keyBox(el) {
    function draw() {
      var key = getKey(), model = getModel();
      var opts = MODELS.map(function (m) {
        return '<option value="' + m.id + '"' + (m.id === model ? ' selected' : '') + '>' + m.name + ' · ' + m.note + '</option>';
      }).join('');
      if (key) {
        var where = localStorage.getItem(K) ? 'remembered on this device' : 'until you close this tab';
        el.innerHTML =
          '<div class="kb-row"><span class="kb-ok">✓ Claude key set</span><span class="kb-dim">…' + esc(key.slice(-4)) + ' · ' + where + '</span>' +
          '<button type="button" class="kb-link" data-forget>Forget key</button></div>' +
          '<label class="kb-row kb-model">Model <select data-model>' + opts + '</select></label>';
      } else {
        el.innerHTML =
          '<label class="kb-label" for="kb-in">Your Claude API key</label>' +
          '<div class="kb-row"><input id="kb-in" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" data-in>' +
          '<button type="button" class="btn" data-save>Use key</button></div>' +
          '<label class="kb-check"><input type="checkbox" data-remember> Remember on this device</label>' +
          '<p class="kb-note">Get one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. ' +
          'The key stays in your browser and goes only to Anthropic. This site has no server and never sees it. ' +
          'Runs are billed to your key, so set a spend limit.</p>' +
          '<p class="kb-err" data-err hidden></p>';
      }
    }
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-forget]')) { setKey(''); return; }
      if (e.target.closest('[data-save]')) save();
    });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-in]')) { e.preventDefault(); save(); } });
    el.addEventListener('change', function (e) { if (e.target.matches('[data-model]')) setModel(e.target.value); });
    function save() {
      var v = el.querySelector('[data-in]').value.trim();
      var err = el.querySelector('[data-err]');
      if (!/^sk-ant-[\w-]{20,}$/.test(v)) {
        err.textContent = 'That doesn\'t look like a Claude API key. It starts with sk-ant-.';
        err.hidden = false; return;
      }
      setKey(v, el.querySelector('[data-remember]').checked);
    }
    boxes.push(draw);
    draw();
  }

  // ---- Streaming call ------------------------------------------------------------------------
  // opts: system, messages, maxTokens, effort, onText(delta, full), onThinking(delta, full), signal
  // Resolves to { text, thinking, stopReason, usage:{input,output}, model, cost }.
  function stream(opts) {
    var key = getKey();
    if (!key) return Promise.reject(friendly('nokey'));
    var model = modelInfo(opts.model || getModel());
    var body = {
      model: model.id,
      max_tokens: opts.maxTokens || 16000,
      stream: true,
      system: opts.system,
      messages: opts.messages,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: opts.effort || 'medium' }
    };
    var headers = {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    if (model.fallbacks) {
      // If a safety check declines the request, the API reruns it on a fallback model in the same call.
      body.fallbacks = 'default';
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    }
    var out = { text: '', thinking: '', stopReason: null, usage: { input: 0, output: 0 }, model: model.id, cost: 0 };

    return fetch(API, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: opts.signal })
      .catch(function (e) { throw e.name === 'AbortError' ? e : friendly('network'); })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            var msg = '';
            try { msg = JSON.parse(t).error.message; } catch (e) { msg = t.slice(0, 200); }
            throw friendly(res.status, msg);
          });
        }
        var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return finish();
            buf += dec.decode(r.value, { stream: true }).replace(/\r/g, '');
            var i;
            while ((i = buf.indexOf('\n\n')) >= 0) {
              var chunk = buf.slice(0, i); buf = buf.slice(i + 2);
              handle(chunk);
            }
            return pump();
          });
        }
        return pump();
      });

    function handle(chunk) {
      var data = chunk.split('\n').filter(function (l) { return l.indexOf('data:') === 0; })
        .map(function (l) { return l.slice(5).trim(); }).join('');
      if (!data) return;
      var ev;
      try { ev = JSON.parse(data); } catch (e) { return; }
      if (ev.type === 'message_start' && ev.message) {
        if (ev.message.model) out.model = ev.message.model;
        addUsage(ev.message.usage);
      } else if (ev.type === 'content_block_delta' && ev.delta) {
        if (ev.delta.type === 'text_delta') { out.text += ev.delta.text; if (opts.onText) opts.onText(ev.delta.text, out.text); }
        else if (ev.delta.type === 'thinking_delta') { out.thinking += ev.delta.thinking; if (opts.onThinking) opts.onThinking(ev.delta.thinking, out.thinking); }
      } else if (ev.type === 'message_delta') {
        if (ev.delta && ev.delta.stop_reason) out.stopReason = ev.delta.stop_reason;
        addUsage(ev.usage);
      } else if (ev.type === 'error') {
        throw friendly(ev.error && ev.error.type === 'overloaded_error' ? 529 : 500, ev.error && ev.error.message);
      }
    }
    function addUsage(u) {
      if (!u) return;
      var inp = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      if (inp > out.usage.input) out.usage.input = inp;
      if ((u.output_tokens || 0) > out.usage.output) out.usage.output = u.output_tokens;
    }
    function finish() {
      var m = modelInfo(out.model);
      out.cost = (out.usage.input * m.inp + out.usage.output * m.out) / 1e6;
      if (out.stopReason === 'refusal') throw friendly('refusal');
      return out;
    }
  }

  function friendly(code, detail) {
    var msgs = {
      nokey: 'Add your Claude API key first.',
      network: 'Couldn\'t reach api.anthropic.com. Check your connection, or an ad blocker that blocks it.',
      refusal: 'Claude declined this request. Rephrase it and try again.',
      400: 'The request was rejected',
      401: 'Anthropic rejected the key. Check it at console.anthropic.com, then add it again.',
      403: 'This key isn\'t allowed to use that model. Try another model.',
      404: 'That model isn\'t available on this key. Try another model.',
      413: 'The input is too long. Cut it down and try again.',
      429: 'Rate limit or spend limit reached on this key. Wait a minute, or check your limits.',
      500: 'Anthropic had an error. Try again in a minute.',
      529: 'Claude is overloaded right now. Try again in a minute.'
    };
    var m = msgs[code] || ('Error ' + code + '.');
    if (code === 400 && detail) m += ': ' + detail;
    var e = new Error(m);
    e.code = code;
    if (code === 401) setKey('');
    return e;
  }

  function money(c) { return c < 0.01 ? '<1¢' : c < 1 ? Math.round(c * 100) + '¢' : '$' + c.toFixed(2); }

  // ---- Markdown ------------------------------------------------------------------------------
  // Small, safe renderer: escapes HTML first. Headings, lists (nested by indent), tables, bold,
  // italic, code, links, blockquotes, rules, paragraphs.
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(src) {
    var lines = esc(src).split('\n'), html = [], i = 0, para = [];
    function flush() { if (para.length) { html.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    while (i < lines.length) {
      var l = lines[i];
      if (/^\s*$/.test(l)) { flush(); i++; continue; }
      var h = l.match(/^(#{1,4})\s+(.*)$/);
      if (h) { flush(); var n = Math.min(h[1].length + 1, 5); html.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { flush(); html.push('<hr>'); i++; continue; }
      if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return inline(c.trim()); }); };
        var head = cells(l); i += 2;
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        html.push('<table><thead><tr>' + head.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>');
        continue;
      }
      if (/^&gt;\s?/.test(l)) {
        flush(); var q = [];
        while (i < lines.length && /^&gt;\s?/.test(lines[i])) { q.push(lines[i].replace(/^&gt;\s?/, '')); i++; }
        html.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>');
        continue;
      }
      if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
        flush();
        var stack = [];
        while (i < lines.length && (/^\s*([-*]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && stack.length))) {
          var li = lines[i], m = li.match(/^(\s*)([-*]|\d+[.)])\s+(.*)$/);
          if (!m) { html.push(' ' + inline(li.trim())); i++; continue; }
          var depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2), tag = /\d/.test(m[2]) ? 'ol' : 'ul';
          while (stack.length > depth + 1) html.push('</li></' + stack.pop() + '>');
          if (stack.length === depth + 1) html.push('</li>');
          while (stack.length < depth + 1) { stack.push(tag); html.push('<' + tag + '>'); }
          html.push('<li>' + inline(m[3]));
          i++;
        }
        while (stack.length) html.push('</li></' + stack.pop() + '>');
        continue;
      }
      para.push(l.trim()); i++;
    }
    flush();
    return html.join('');
  }

  window.Claude = {
    keyBox: keyBox, getKey: getKey, setKey: setKey, getModel: getModel, setModel: setModel,
    models: MODELS, modelInfo: modelInfo, onChange: onChange,
    stream: stream, money: money, md: md, esc: esc
  };
})();
