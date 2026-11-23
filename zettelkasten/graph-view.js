// graph-view.js: the Graph view of the Zettelkasten. One graph per group (Life, Technology),
// drawn from graph.js (built by zkgraph.py). A dot is a note and a line is a link between two
// notes in the same group. Hover shows a note's links; click opens it; drag a dot to move it,
// drag the background to pan, pinch or the buttons to zoom.
(function () {
  var box = document.getElementById('zk-graph');
  var data = window.ZK_GRAPH;
  if (!box || !data) return;
  var built = false, graphs = [];

  var C = {
    edge: 'rgba(107,107,107,.22)', edgeOn: 'rgba(31,62,166,.6)', edgeDim: 'rgba(107,107,107,.07)',
    node: '#a3a39c', nodeOn: '#1f3ea6', near: '#5b72c2', hub: '#6b6b6b',
    label: '#333', labelOn: '#1a1a1a', halo: 'rgba(255,255,255,.92)'
  };
  var FONT = '10.5px Verdana,Geneva,"DejaVu Sans",sans-serif';
  var FONT_ON = 'bold ' + FONT;

  function build() {
    if (built) return;
    built = true;
    data.forEach(function (g) { graphs.push(make(g)); });
  }

  function make(g) {
    var n = g.nodes.length;
    var sec = document.createElement('section');
    sec.className = 'zk-g';
    sec.innerHTML = '<h2>' + esc(g.name) + '</h2>' +
      '<div class="zk-g-frame"><canvas role="img" aria-label="' + esc(g.name + ': a graph of ' + n + ' notes and ' + g.links.length + ' links. The list view has the same notes.') + '"></canvas>' +
      '<div class="zk-g-zoom"><button type="button" data-z="in" title="Zoom in">+</button><button type="button" data-z="out" title="Zoom out">&minus;</button><button type="button" data-z="fit" title="Fit">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button></div></div>' +
      '<p class="zk-g-cap">' + n + ' notes, ' + g.links.length + ' links. Click a note to open it.</p>';
    box.appendChild(sec);
    var frame = sec.querySelector('.zk-g-frame'), cv = sec.querySelector('canvas'), ctx = cv.getContext('2d');
    var H = n > 20 ? (window.innerWidth < 760 ? 440 : 580) : 300;

    var deg = new Array(n).fill(0), nb = g.nodes.map(function () { return {}; });
    g.links.forEach(function (l) { deg[l[0]]++; deg[l[1]]++; nb[l[0]][l[1]] = 1; nb[l[1]][l[0]] = 1; });
    var maxDeg = Math.max.apply(null, deg.concat([1]));
    var nodes = g.nodes.map(function (d, i) {
      var r = 10 * Math.sqrt(0.5 + i), a = i * Math.PI * (3 - Math.sqrt(5));   // phyllotaxis start: the same layout on every load
      return { id: d.id, t: d.t, i: i, x: r * Math.cos(a), y: r * Math.sin(a), vx: 0, vy: 0, fx: null, fy: null,
               r: 3.2 + 6 * Math.sqrt(deg[i] / maxDeg), deg: deg[i], short: d.t.length > 30 ? d.t.slice(0, 28).replace(/[\s,]+\S*$/, '') + '…' : d.t };
    });
    var links = g.links.map(function (l) { return { s: nodes[l[0]], t: nodes[l[1]] }; });
    var order = nodes.slice().sort(function (a, b) { return b.deg - a.deg || a.i - b.i; });

    // force layout (after d3-force: links, many-body, a weak pull to the centre, collision)
    var alpha = 1, alphaTarget = 0, ALPHA_MIN = 0.002, DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 300), LINK = n > 20 ? 56 : 95;
    function tick() {
      alpha += (alphaTarget - alpha) * DECAY;
      links.forEach(function (l) {
        var s = l.s, t = l.t, dx = t.x + t.vx - s.x - s.vx, dy = t.y + t.vy - s.y - s.vy, d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        var k = (d - LINK) / d * alpha / Math.min(s.deg, t.deg), bs = s.deg / (s.deg + t.deg);
        dx *= k; dy *= k;
        t.vx -= dx * bs; t.vy -= dy * bs; s.vx += dx * (1 - bs); s.vy += dy * (1 - bs);
      });
      for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
        var a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 1e-6;
        if (d2 > 90000) continue;
        var f = -160 * alpha / d2;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
        var min = a.r + b.r + 3, d = Math.sqrt(d2);
        if (d < min) { var p = (min - d) / d * 0.5; a.x -= dx * p; a.y -= dy * p; b.x += dx * p; b.y += dy * p; }
      }
      nodes.forEach(function (o) {
        o.vx -= o.x * 0.028 * alpha; o.vy -= o.y * 0.07 * alpha;   // a weaker pull sideways, so the graph fills a wide frame
        if (o.fx !== null) { o.x = o.fx; o.y = o.fy; o.vx = o.vy = 0; return; }
        o.vx *= 0.6; o.vy *= 0.6; o.x += o.vx; o.y += o.vy;
      });
    }
    for (var k = 0; k < 320; k++) tick();

    // view
    var W = 0, dpr = 1, view = { k: 1, x: 0, y: 0 }, hover = null, pick = null, raf = 0;
    function size() {
      W = frame.clientWidth; dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    function fit() {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      nodes.forEach(function (o) { x0 = Math.min(x0, o.x - o.r); y0 = Math.min(y0, o.y - o.r); x1 = Math.max(x1, o.x + o.r); y1 = Math.max(y1, o.y + o.r); });
      var pad = 36, k = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad - 14) / (y1 - y0 || 1), 1.8);
      view.k = k; view.x = W / 2 - k * (x0 + x1) / 2; view.y = (H - 14) / 2 - k * (y0 + y1) / 2;
    }
    function zoom(f, cx, cy) {
      var k = Math.max(0.3, Math.min(5, view.k * f));
      if (cx === undefined) { cx = W / 2; cy = H / 2; }
      view.x = cx - (cx - view.x) * k / view.k; view.y = cy - (cy - view.y) * k / view.k; view.k = k;
      draw();
    }

    function draw() {
      var on = pick || hover, k = view.k;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.x, dpr * view.y);
      ctx.lineWidth = 1 / k;
      links.forEach(function (l) {
        var lit = on && (l.s === on || l.t === on);
        if (lit) return;
        ctx.strokeStyle = on ? C.edgeDim : C.edge;
        ctx.beginPath(); ctx.moveTo(l.s.x, l.s.y); ctx.lineTo(l.t.x, l.t.y); ctx.stroke();
      });
      if (on) {
        ctx.strokeStyle = C.edgeOn; ctx.lineWidth = 1.4 / k;
        links.forEach(function (l) {
          if (l.s !== on && l.t !== on) return;
          ctx.beginPath(); ctx.moveTo(l.s.x, l.s.y); ctx.lineTo(l.t.x, l.t.y); ctx.stroke();
        });
      }
      nodes.forEach(function (o) {
        var near = on && (o === on || nb[on.i][o.i]);
        ctx.globalAlpha = on && !near ? 0.25 : 1;
        ctx.fillStyle = o === on ? C.nodeOn : near ? C.near : o.deg >= maxDeg * 0.6 ? C.hub : C.node;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 2 * Math.PI); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // labels, in screen space: biggest notes first, skipped where they would overlap
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
      var boxes = [], list = order;
      if (on) list = [on].concat(order.filter(function (o) { return o !== on && nb[on.i][o.i]; }));
      list.forEach(function (o) {
        var full = o === on || k > 1.3, txt = full ? o.t : o.short;
        ctx.font = o === on ? FONT_ON : FONT;
        var w = ctx.measureText(txt).width, sx = view.x + o.x * k, sy = view.y + (o.y + o.r) * k + 3;
        if (sx < -20 || sx > W + 20 || sy < -20 || sy > H) return;
        sx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, sx));   // keep the label inside the frame
        var b = [sx - w / 2 - 2, sy - 1, sx + w / 2 + 2, sy + 14];
        if (o !== on && boxes.some(function (c) { return b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]; })) return;
        boxes.push(b);
        ctx.lineWidth = 3; ctx.strokeStyle = C.halo; ctx.strokeText(txt, sx, sy);
        ctx.fillStyle = on ? C.labelOn : C.label; ctx.fillText(txt, sx, sy);
      });
    }

    function loop() {
      raf = 0;
      if (alpha < ALPHA_MIN && alphaTarget === 0) { draw(); return; }
      tick(); draw();
      raf = requestAnimationFrame(loop);
    }
    function heat(t) { alphaTarget = t; if (alpha < 0.1) alpha = 0.1; if (!raf) raf = requestAnimationFrame(loop); }

    // pointer
    function world(e) {
      var r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
      return { sx: sx, sy: sy, x: (sx - view.x) / view.k, y: (sy - view.y) / view.k };
    }
    function hit(p) {
      var best = null, bd = Infinity;
      nodes.forEach(function (o) {
        var dx = o.x - p.x, dy = o.y - p.y, d = Math.sqrt(dx * dx + dy * dy), reach = o.r + 4 / view.k;
        if (d < reach && d < bd) { best = o; bd = d; }
      });
      return best;
    }
    var drag = null;
    cv.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var p = world(e), o = hit(p);
      drag = { o: o, sx: p.sx, sy: p.sy, vx: view.x, vy: view.y, moved: false, touch: e.pointerType === 'touch' };
      cv.setPointerCapture(e.pointerId);
      if (o) { o.fx = o.x; o.fy = o.y; }
    });
    cv.addEventListener('pointermove', function (e) {
      var p = world(e);
      if (drag) {
        if (Math.abs(p.sx - drag.sx) + Math.abs(p.sy - drag.sy) > 4) drag.moved = true;
        if (!drag.moved) return;
        if (drag.o) { drag.o.fx = p.x; drag.o.fy = p.y; hover = drag.o; heat(0.25); }
        else { view.x = drag.vx + p.sx - drag.sx; view.y = drag.vy + p.sy - drag.sy; draw(); }
        cv.style.cursor = 'grabbing';
        return;
      }
      var o = hit(p);
      if (o !== hover) { hover = o; cv.style.cursor = o ? 'pointer' : 'grab'; draw(); }
    });
    function end(e) {
      if (!drag) return;
      var d = drag; drag = null;
      if (d.o) { d.o.fx = d.o.fy = null; heat(0); }
      cv.style.cursor = hover ? 'pointer' : 'grab';
      if (d.moved || e.type === 'pointercancel') return;
      if (!d.o) { if (pick) { pick = null; draw(); } return; }
      if (d.touch && pick !== d.o) { pick = d.o; draw(); return; }   // touch: the first tap shows the links, the second opens
      go(d.o);
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', function () { if (!drag && hover) { hover = null; draw(); } });
    cv.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;   // pinch on a trackpad, or ctrl + wheel; a plain wheel scrolls the page
      e.preventDefault();
      var p = world(e); zoom(Math.exp(-e.deltaY * 0.01), p.sx, p.sy);
    }, { passive: false });
    sec.querySelector('.zk-g-zoom').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.z === 'in') zoom(1.3); else if (b.dataset.z === 'out') zoom(1 / 1.3); else { fit(); draw(); }
    });

    // open a note the way a link on this page opens it (stack.js puts it in a pane on wide screens)
    function go(o) {
      var a = document.createElement('a');
      a.href = '../essays/' + o.id + '.html';
      a.hidden = true;
      box.appendChild(a);
      a.click();
      a.remove();
    }

    size(); fit(); draw();
    cv.style.cursor = 'grab';
    var lastW = W;
    return { resize: function () { if (frame.clientWidth && frame.clientWidth !== lastW) { size(); fit(); lastW = W; draw(); } } };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  window.zkGraphShow = function () {
    if (box.hidden) return;
    build();
    graphs.forEach(function (g) { g.resize(); });
  };
  if (window.ResizeObserver) new ResizeObserver(function () { if (built && !box.hidden) graphs.forEach(function (g) { g.resize(); }); }).observe(box);
  window.zkGraphShow();
})();
