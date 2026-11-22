// stack.js: Andy Matuschak-style sliding panes. On wide screens, a link inside the page opens the
// target page as a new pane to the right instead of leaving the page. Earlier panes slide under
// later ones and show their title on a thin spine. The URL keeps the stack (?stacked=a&stacked=b),
// so a stack can be shared and the back button pops panes. Phones and narrow windows navigate normally.
(function () {
  if (self !== top) return;
  var WIDE = '(min-width: 1000px)', SPINE = 40;
  var layout = document.querySelector('.layout');
  if (!layout) return;
  var first = layout.querySelector(':scope > .wrap, :scope > main');
  if (!first) return;
  var stack = null, panes = [], cache = {};

  function siteRoot() {
    var css = document.querySelector('link[href$="css/site.css"]');
    // css.href is absolute, so a page at the root (archive.html) still gives the folder, not the page
    return new URL(css.href.replace(/css\/site\.css(\?.*)?$/, ''));
  }
  var ROOT = siteRoot();
  function rel(u) { return u.pathname.slice(ROOT.pathname.length) || 'index.html'; }

  function eligible(a) {
    if (!a || a.target || a.hasAttribute('download') || a.hasAttribute('data-nostack')) return null;
    if (a.closest('.side, .toc-side, .tile')) return null;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript):/.test(href)) return null;
    var u = new URL(href, a.baseURI);
    if (u.origin !== location.origin || u.pathname.indexOf(ROOT.pathname) !== 0) return null;
    var p = rel(u);
    if (p === 'index.html' || /\.(xml|txt|json|png|jpg|jpeg|gif|svg|pdf|csv)$/i.test(p) || /app\.html$/.test(p)) return null;
    if (u.hash && u.pathname === location.pathname) return null;
    return u;
  }

  function load(u) {
    var key = u.pathname;
    if (!cache[key]) cache[key] = fetch(u.href).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'text/html');
      var scripts = [].slice.call(doc.querySelectorAll('script[src]')).map(function (s) { return s.getAttribute('src'); });
      if (scripts.some(function (s) { return !/(toc|stack)\.js$/.test(s); })) throw new Error('needs scripts');
      var body = doc.querySelector('.layout > .wrap main') || doc.querySelector('.layout > main .col') || doc.querySelector('main');
      if (!body) throw new Error('no main');
      [].slice.call(body.querySelectorAll('[href],[src]')).forEach(function (el) {
        ['href', 'src'].forEach(function (k) {
          var v = el.getAttribute(k);
          if (v && v.charAt(0) !== '#' && !/^(mailto|tel|data|javascript):/.test(v)) el.setAttribute(k, new URL(v, u.href).href);
        });
      });
      var h1 = body.querySelector('h1');
      return { title: (h1 ? h1.textContent : doc.title.split(' · ')[0]).trim(), html: body.innerHTML, cls: body.className, isDoc: doc.body.classList.contains('doc') };
    });
    return cache[key];
  }

  function ensureStack() {
    if (stack) return;
    stack = document.createElement('div');
    stack.className = 'stack';
    layout.insertBefore(stack, first);
    var p = document.createElement('div');
    p.className = 'pane pane-first';
    var h1 = first.querySelector('h1');
    p.innerHTML = '<div class="spine">' + esc(h1 ? h1.textContent : document.title.split(' · ')[0]) + '</div><div class="pane-scroll' + (document.body.classList.contains('doc') ? ' doc' : '') + '"></div>';
    p.lastChild.appendChild(first);
    stack.appendChild(p);
    panes = [p];
    document.body.classList.add('stacked');
    stack.addEventListener('scroll', spines, { passive: true });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function trim(n) { while (panes.length > n) panes.pop().remove(); }

  function addPane(u, data) {
    var p = document.createElement('div');
    p.className = 'pane';
    p.dataset.path = rel(u);
    p.innerHTML = '<div class="spine">' + esc(data.title) + '</div><div class="pane-scroll' + (data.isDoc ? ' doc' : '') + '">' +
      '<div class="pane-bar"><button class="pane-x" type="button" aria-label="Close this pane">×</button>' +
      '<a class="pane-open" href="' + u.href + '" data-nostack>Open as page</a></div>' +
      '<main class="pane-body ' + esc(data.cls || '') + '">' + data.html + '</main></div>';
    p.style.setProperty('--i', panes.length);
    stack.appendChild(p);
    panes.push(p);
    p.querySelectorAll('h2, h3').forEach(function (h) { h.removeAttribute('id'); });
    return p;
  }

  function show(p, instant) {
    requestAnimationFrame(function () {
      stack.scrollTo({ left: p.offsetLeft + p.offsetWidth - stack.clientWidth, behavior: instant ? 'auto' : 'smooth' });
      spines();
    });
  }

  function spines() {
    var lefts = panes.map(function (p) { return p.getBoundingClientRect().left; });
    panes.forEach(function (p, i) {
      var next = lefts[i + 1];
      p.classList.toggle('covered', next !== undefined && next - lefts[i] < 160);
    });
  }

  function urlState() {
    var q = new URLSearchParams();
    panes.slice(1).forEach(function (p) { q.append('stacked', p.dataset.path); });
    var s = q.toString();
    return location.pathname + (s ? '?' + s : '');
  }

  function open(u, fromIndex, push) {
    return load(u).then(function (data) {
      ensureStack();
      trim(fromIndex + 1);
      var p = addPane(u, data);
      if (push !== false) history.pushState({ stacked: true }, '', urlState());
      show(p, push === false);
      return p;
    });
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!matchMedia(WIDE).matches) return;
    var x = e.target.closest && e.target.closest('.pane-x');
    if (x) {
      var i = panes.indexOf(x.closest('.pane'));
      trim(i);
      history.pushState({ stacked: true }, '', urlState());
      spines();
      return;
    }
    var a = e.target.closest && e.target.closest('a');
    if (!a || !(stack ? stack.contains(a) : first.contains(a))) return;
    var u = eligible(a);
    if (!u) return;
    var pane = a.closest('.pane');
    var from = pane ? panes.indexOf(pane) : 0;
    var already = panes.findIndex(function (p) { return p.dataset.path === rel(u); });
    e.preventDefault();
    if (already > 0) { show(panes[already]); return; }
    open(u, from).catch(function () { location.href = u.href; });
  });

  function restore() {
    var paths = new URLSearchParams(location.search).getAll('stacked');
    if (!paths.length) { if (stack) { trim(1); spines(); } return Promise.resolve(); }
    if (!matchMedia(WIDE).matches) return Promise.resolve();
    trim(1);
    return paths.reduce(function (chain, p, i) {
      return chain.then(function () { return open(new URL(p, ROOT), i, false); });
    }, Promise.resolve()).catch(function () {});
  }
  window.addEventListener('popstate', restore);
  restore();
})();
