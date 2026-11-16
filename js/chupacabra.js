// The chupacabra field. A creature prances along the ground, hunts the sheep
// that wander in, pounces and eats them. Click the field to release a sheep.
// Below the field, each paragraph of the story gets a small animated vignette
// (window.CHUPA_VIGNETTES, from chupacabra-vignettes.js).
//
// Motion model: every mover has a velocity that eases toward a target, so
// starts, stops and turns are gradual. A stride phase advances with distance
// travelled; the hop height, the walk frame and the landing squash all come
// from that phase, so feet and body stay in sync and nothing stops mid-air.
(function () {
  var scene = document.querySelector('.chupa-scene');
  if (!scene) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var base = scene.getAttribute('data-sprites');

  var SHEEP_SVG = '<svg viewBox="0 0 104 72" aria-hidden="true"><path d="M90 52l9 2l-5 8z" fill="#182850"/><g stroke="#182850" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M40 58l-6 12"/><path d="M48 60l-2 11"/><path d="M72 60l2 11"/><path d="M82 57l6 11"/></g><g fill="#f3f4f9" stroke="#182850" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M93.2 37.8A6.2 6.2 0 0 1 88.6 48.3A5.9 5.9 0 0 1 80.7 54.6A6.8 6.8 0 0 1 69.0 58.2A9.8 9.8 0 0 1 51.8 59.0A6.1 6.1 0 0 1 41.5 54.9A7.3 7.3 0 0 1 30.4 48.7A6.2 6.2 0 0 1 28.5 37.4A5.6 5.6 0 0 1 30.1 27.0A6.9 6.9 0 0 1 39.8 21.1A7.1 7.1 0 0 1 51.3 18.8A9.3 9.3 0 0 1 67.2 18.4A6.9 6.9 0 0 1 78.8 21.4A6.1 6.1 0 0 1 88.5 27.5A5.9 5.9 0 0 1 93.2 37.8z"/></g><path d="M11 35c-7 7-4 20 7 25c11 5 24 0 26-9c2-9-5-17-16-19c-7-1-13 0-17 3z" fill="#182850"/><path d="M13 37c-3-6-7-12-8-18c7 3 13 7 17 14z" fill="#182850"/><path d="M21 36c-1-5-4-10-5-14c5 2 9 6 12 11z" fill="#182850"/><circle cx="27" cy="43" r="1.8" fill="#f3f4f9"/><circle cx="33" cy="48" r="1.8" fill="#f3f4f9"/></svg>';

  // ---- helpers -------------------------------------------------------
  var now = function () { return performance.now(); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var approach = function (v, target, rate) { return v + clamp(target - v, -rate, rate); };
  var easeOut = function (p) { return 1 - (1 - p) * (1 - p); };
  var W = function () { return scene.clientWidth; };

  // ---- creature ------------------------------------------------------
  var wrap = document.createElement('div');
  wrap.className = 'chupa';
  var frames = {};
  ['stand', 'walk', 'eat'].forEach(function (n) {
    var img = document.createElement('img');
    img.src = base + n + '.png';
    img.alt = '';
    img.className = 'frame frame-' + n;
    wrap.appendChild(img);
    frames[n] = img;
  });
  scene.appendChild(wrap);
  var frameOn = null;
  function showFrame(n) {
    if (frameOn === n) return;
    if (frameOn) frames[frameOn].classList.remove('on');
    frames[n].classList.add('on');
    frameOn = n;
  }
  showFrame('stand');

  var WALK = 62, HUNT = 150, ACC = 420;          // px/s, px/s, px/s²
  var STRIDE_WALK = 44, STRIDE_HUNT = 66;         // px per hop
  var HOP_WALK = 9, HOP_HUNT = 15;                // px
  var c = {
    x: W() * 0.6, vx: 0, face: -1,                // face: -1 looks left (sprite as drawn)
    state: 'idle', until: 0, want: 0,             // want: target velocity
    phase: 0, lastPhase: 0, squash: 0,
    target: null, pounceFrom: 0, pounceTo: 0, pounceStart: 0,
    nextHunt: now() + rand(2500, 5000), nextLook: 0
  };

  // ---- sheep ---------------------------------------------------------
  var sheep = [];
  var nextSpawn = now() + rand(5000, 9000);
  function addSheep(x, dropped, entering) {
    if (sheep.length >= 4) return null;
    var el = document.createElement('div');
    el.className = 'sheep';
    el.innerHTML = SHEEP_SVG;
    if (dropped && !reduced) el.firstChild.classList.add('drop');
    scene.appendChild(el);
    var s = { el: el, x: x, vx: 0, face: Math.random() < 0.5 ? -1 : 1, mode: 'graze',
              until: now() + rand(600, 1800), speed: rand(9, 16), phase: 0, dipT: rand(0, 6),
              entering: !!entering };
    if (entering) { s.face = x < 0 ? 1 : -1; s.mode = 'walk'; s.until = now() + rand(2500, 4500); }
    sheep.push(s);
    return s;
  }
  function removeSheep(s) {
    var i = sheep.indexOf(s);
    if (i >= 0) sheep.splice(i, 1);
    if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
  }
  function nearestSheep() {
    var best = null, bd = 1e9;
    for (var i = 0; i < sheep.length; i++) {
      var d = Math.abs(sheep[i].x - c.x);
      if (d < bd) { bd = d; best = sheep[i]; }
    }
    return best;
  }
  function puff(x) {
    for (var i = 0; i < 8; i++) {
      var d = document.createElement('span');
      d.className = 'puff';
      d.style.left = (x + rand(-16, 16)) + 'px';
      d.style.bottom = rand(12, 40) + 'px';
      d.style.setProperty('--dx', rand(-32, 32) + 'px');
      d.style.setProperty('--dy', rand(-50, -18) + 'px');
      d.style.animationDuration = rand(500, 800) + 'ms';
      scene.appendChild(d);
      (function (el) { setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 850); })(d);
    }
  }

  // ---- brain ---------------------------------------------------------
  function think(t, width) {
    var s;
    switch (c.state) {
      case 'idle':
        c.want = 0;
        if (sheep.length && t > c.nextHunt) { c.state = 'hunt'; break; }
        if (t > c.nextLook && Math.random() < 0.5) { c.face = -c.face; c.nextLook = t + rand(900, 2200); }
        if (t > c.until) {
          c.state = 'wander';
          var dir = c.x < 80 ? 1 : c.x > width - 80 ? -1 : (Math.random() < 0.5 ? -1 : 1);
          c.want = dir * WALK;
          c.until = t + rand(1000, 2800);
        }
        break;
      case 'wander':
        if (c.x < 40 && c.want < 0) c.want = WALK;
        if (c.x > width - 40 && c.want > 0) c.want = -WALK;
        if (sheep.length && t > c.nextHunt) { c.state = 'hunt'; break; }
        if (t > c.until) { c.state = 'idle'; c.until = t + rand(800, 2400); c.nextLook = t + rand(400, 1200); }
        break;
      case 'hunt':
        s = nearestSheep();
        if (!s) { c.state = 'idle'; c.until = t + 600; break; }
        c.want = (s.x < c.x ? -1 : 1) * HUNT;
        var gap = Math.abs(s.x - c.x);
        if (gap < 70 && Math.abs(c.vx) > 40) {
          // pounce: leap from here onto the sheep
          c.state = 'pounce'; c.target = s; s.mode = 'frozen'; s.vx = 0;
          c.face = s.x < c.x ? -1 : 1;
          c.pounceFrom = c.x; c.pounceStart = t;
          c.pounceTo = s.x - c.face * 0.18 * frames.eat.offsetWidth;  // sheep sits in the eat frame's near half
          c.want = 0; c.vx = 0;
        }
        break;
      case 'pounce':
        var p = clamp((t - c.pounceStart) / 340, 0, 1);
        c.x = c.pounceFrom + (c.pounceTo - c.pounceFrom) * easeOut(p);
        if (p >= 1) {
          c.state = 'eat'; c.until = t + 1500;
          c.target.el.style.visibility = 'hidden';
          c.squash = 1;
        }
        break;
      case 'eat':
        if (t > c.until) {
          puff(c.target.x);
          removeSheep(c.target); c.target = null;
          c.state = 'idle'; c.until = t + rand(1600, 3000);
          c.nextHunt = t + rand(5000, 11000);
          c.nextLook = t + 700;
        }
        break;
    }
  }

  function moveCreature(t, dt, width) {
    if (c.state !== 'pounce') {
      c.vx = approach(c.vx, c.want, ACC * dt);
      c.x = clamp(c.x + c.vx * dt, 30, width - 30);
      if (Math.abs(c.vx) > 6) c.face = c.vx < 0 ? -1 : 1;
    }
    // stride phase: advance with distance; settle to a footfall when stopping
    var speed = Math.abs(c.vx);
    var stride = c.state === 'hunt' ? STRIDE_HUNT : STRIDE_WALK;
    if (speed > 4) c.phase += speed * dt / stride;
    else c.phase = approach(c.phase, Math.round(c.phase), 6 * dt);
    if (Math.floor(c.phase) !== Math.floor(c.lastPhase)) c.squash = 1;   // footfall
    c.lastPhase = c.phase;
    c.squash = Math.max(0, c.squash - dt * 7);
  }

  function renderCreature(t) {
    var p = c.phase - Math.floor(c.phase);
    var speed = Math.abs(c.vx);
    var hopMax = c.state === 'hunt' ? HOP_HUNT : HOP_WALK;
    var hop = 4 * p * (1 - p) * hopMax * clamp(speed / WALK, 0, 1);
    var lean = 0, sx = 1, sy = 1, rot = 0;
    var frame;

    if (c.state === 'pounce') {
      var q = clamp((t - c.pounceStart) / 340, 0, 1);
      hop = 4 * q * (1 - q) * 30;
      frame = 'walk';
      lean = -10;
    } else if (c.state === 'eat') {
      frame = 'eat';
      var chew = Math.sin((t - c.until + 1500) / 90);
      rot = chew * 1.6;
      sy = 1 + chew * 0.012;
    } else {
      frame = (speed > 12 && p > 0.22 && p < 0.8) ? 'walk' : 'stand';
      lean = -(speed / HUNT) * 7;                         // lean into the run (sprite-local, faces left)
      if (speed < 4) sy += 0.012 * Math.sin(t / 650);     // breathing at rest
    }
    sy -= 0.07 * c.squash; sx += 0.06 * c.squash;
    showFrame(frame);
    wrap.style.transform = 'translate3d(' + c.x.toFixed(2) + 'px,' + (-hop).toFixed(2) + 'px,0)' +
      ' scaleX(' + (c.face < 0 ? 1 : -1) + ') rotate(' + (lean + rot).toFixed(2) + 'deg)' +
      ' scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
  }

  var EDGE = 50;                                  // sheep half-width plus a little
  function moveSheep(t, dt, width) {
    for (var i = 0; i < sheep.length; i++) {
      var s = sheep[i], want = 0;
      var threat = (c.state === 'hunt') && Math.abs(s.x - c.x) < 170;
      if (s.mode === 'frozen') want = 0;
      else if (threat) { s.mode = 'flee'; s.until = t + 900; want = (s.x < c.x ? -1 : 1) * 58; }
      else if (s.mode === 'flee') { if (t > s.until) { s.mode = 'graze'; s.until = t + rand(1500, 3000); } want = s.face * 30; }
      else {
        if (t > s.until) {
          s.mode = s.mode === 'graze' ? 'walk' : 'graze';
          if (s.mode === 'walk' && Math.random() < 0.45) s.face = -s.face;
          s.until = t + (s.mode === 'graze' ? rand(1800, 4200) : rand(1200, 3200));
        }
        want = s.mode === 'walk' ? s.face * s.speed : 0;
      }
      if (s.entering) {                       // walking in from beyond the edge
        want = s.face * 22;
        if (s.x > EDGE && s.x < width - EDGE) s.entering = false;
      } else {
        if (s.x < EDGE && want < 0) want = Math.abs(want);
        if (s.x > width - EDGE && want > 0) want = -want;
      }
      s.vx = approach(s.vx, want, 160 * dt);
      s.x += s.vx * dt;
      if (!s.entering) s.x = clamp(s.x, EDGE, width - EDGE);
      if (Math.abs(s.vx) > 3) s.face = s.vx < 0 ? -1 : 1;
      s.phase += Math.abs(s.vx) * dt / 18;
      s.dipT += dt;
    }
  }

  function renderSheep(t) {
    for (var i = 0; i < sheep.length; i++) {
      var s = sheep[i];
      var bob = Math.abs(Math.sin(s.phase * Math.PI)) * clamp(Math.abs(s.vx) / 10, 0, 1) * 2.4;
      var dip = s.mode === 'graze' ? Math.max(0, Math.sin(s.dipT / 1.1)) * 5 : 0;   // head down while grazing
      var rot = s.mode === 'flee' ? -4 : dip;
      s.el.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,' + (-bob).toFixed(2) + 'px,0)' +
        ' scaleX(' + (s.face < 0 ? 1 : -1) + ') rotate(' + rot.toFixed(2) + 'deg)';
    }
  }

  // ---- loop ----------------------------------------------------------
  var last = now();
  function tick() {
    var t = now();
    var dt = Math.min(0.05, (t - last) / 1000); last = t;
    var width = W();
    if (t > nextSpawn) {
      if (sheep.length < 2) addSheep(Math.random() < 0.5 ? -EDGE : width + EDGE, false, true);
      nextSpawn = t + rand(6000, 12000);
    }
    think(t, width);
    moveCreature(t, dt, width);
    moveSheep(t, dt, width);
    renderCreature(t);
    renderSheep(t);
    requestAnimationFrame(tick);
  }

  scene.addEventListener('click', function (e) {
    var r = scene.getBoundingClientRect();
    addSheep(clamp(e.clientX - r.left, EDGE, W() - EDGE), true);
  });
  addEventListener('resize', function () { c.x = clamp(c.x, 30, W() - 30); });

  if (reduced) {
    c.x = W() * 0.62;
    addSheep(W() * 0.25, false);
    renderCreature(0); renderSheep(0);
    scene.addEventListener('click', function () { renderSheep(0); });
  } else {
    addSheep(W() * 0.22, false);
    requestAnimationFrame(tick);
  }
})();

// ---- story vignettes: one small animated drawing beside each paragraph ----
(function () {
  var list = window.CHUPA_VIGNETTES;
  var main = document.querySelector('main.essay');
  if (!list || !main) return;
  var beats = [], started = false;
  Array.prototype.slice.call(main.children).forEach(function (el) {
    if (el.classList.contains('chupa-note')) { started = true; return; }
    if (started && (el.tagName === 'P' || el.tagName === 'BLOCKQUOTE')) beats.push(el);
  });
  beats.forEach(function (el, i) {
    if (!list[i]) return;
    var row = document.createElement('div');
    row.className = 'beat' + (el.tagName === 'BLOCKQUOTE' ? ' quote' : '');
    var fig = document.createElement('figure');
    fig.className = 'vignette';
    fig.setAttribute('aria-hidden', 'true');
    fig.innerHTML = list[i];
    el.parentNode.insertBefore(row, el);
    row.appendChild(el);
    row.appendChild(fig);
  });
})();
