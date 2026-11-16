// A quiet sea of mathematical creatures behind the page, drawn faintly in
// navy like figures in a textbook:
//
//   geodesic spheres  Buckminster Fuller style: an icosahedron with each face
//                     split into freq x freq triangles and pushed onto the
//                     sphere; the far half dashed. They drift and turn.
//   jellyfish         a parametric bell that pulses, swimming a little on
//                     each contraction, trailing sine-wave tentacles.
//   nautilus          a golden logarithmic spiral, r = c e^(b theta) with
//                     b = ln(phi) / (pi/2), with its chambers and tentacles.
//   octopus           a mantle and eight arms, each arm a curve drawn from
//                     its curvature: a travelling wave plus tips that curl
//                     into spirals. It swims mantle-first in jet pulses.
//   a sheep           adrift, from The Chupacabra: an ellipse of fleece
//                     scalloped by |sin 7 theta|, paddling.
//   a school of fish  boids: each keeps its distance, matches its
//                     neighbours' heading and stays near the group.
//
// They live on the page, not the screen: they scroll away with the text and
// roam its whole length, carried by a slow shifting current. They keep to
// the margins either side of the text column: anything drifting into the
// column is nudged back out toward the nearer side, and on narrow screens
// they shrink to fit the margins. The cursor moves
// through the water with them: it pushes the spheres, jellyfish and nautilus
// (less so the heavier they are), sets a sphere spinning when dragged across
// it, and scatters the fish. The canvas never takes clicks. Nothing runs
// inside the reading panel, and everything holds still for visitors who
// prefer reduced motion. Sizes, spins and routes are re-rolled on every load.
(function () {
  if (self !== top) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var INK = '24,40,80';      // navy, as r,g,b
  var ALPHA = 0.13;          // line strength; everything else is relative to this
  var FLOW = 12;             // current speed, px per second

  // The cursor's "mass" is that of a 30 px sphere, so a push shares momentum:
  // about half goes into something small, far less into something big.
  var CURSOR_MASS = 30 * 30;
  var MOUSE_RANGE = 50;      // px beyond a creature's edge where the cursor is felt
  var MOUSE_PUSH = 90;       // gentle push from a resting cursor, px/s^2 before sharing
  var MOUSE_WAKE = 8;        // how fast a moving cursor's push transfers, per second
  var MOUSE_GRIP = 6;        // how fast a drag across a sphere becomes spin, per second
  var FISH_FEAR = 110;       // px at which fish start to flee the cursor

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function sign() { return Math.random() < 0.5 ? -1 : 1; }
  function ink(a) { return 'rgba(' + INK + ',' + (ALPHA * a) + ')'; }

  var cv = document.createElement('canvas');
  cv.className = 'bg-figure';
  cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, document.body.firstChild);
  var cx = cv.getContext('2d');
  var root = document.documentElement;
  var W = 0, H = 0, PW = 0, PH = 0, scale = 1, t = 0;

  // The current: slow overlapping swells that vary across the page and in time.
  function current(x, y, seed) {
    return [FLOW * 0.4 * (Math.sin(y / 340 + t * 0.13 + seed) + 0.6 * Math.sin(y / 190 - t * 0.07)),
            FLOW * (Math.cos(x / 300 - t * 0.11 + seed) + 0.5 * Math.cos(x / 170 + t * 0.05))];
  }

  // ---- The cursor -------------------------------------------------------
  // Kept in screen coordinates; its page position is added at use, so
  // scrolling never counts as the cursor moving.
  var mouse = null;
  addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var now = performance.now();
    if (!mouse) { mouse = { x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: now }; return; }
    var dt = (now - mouse.t) / 1000;
    if (dt > 0.2) { mouse.vx = mouse.vy = 0; }
    else if (dt > 0) {
      // Smooth the velocity over about 50 ms; single events are noisy.
      var k = Math.min(1, dt / 0.05);
      mouse.vx += ((e.clientX - mouse.x) / dt - mouse.vx) * k;
      mouse.vy += ((e.clientY - mouse.y) / dt - mouse.vy) * k;
      var sp = Math.hypot(mouse.vx, mouse.vy);
      if (sp > 2000) { mouse.vx *= 2000 / sp; mouse.vy *= 2000 / sp; }
    }
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = now;
  });
  root.addEventListener('mouseleave', function () { mouse = null; });
  addEventListener('blur', function () { mouse = null; });

  // Push a floating body (x, y, vx, vy, R) away from the cursor, sharing
  // momentum by mass. Returns how close the cursor is, 0 to 1, and the
  // sideways part of its motion, for callers that want to spin.
  function pushByMouse(b, cy, dt) {
    if (!mouse) return null;
    var dx = b.x - (mouse.x + scrollX), dy = cy - (mouse.y + scrollY), d = Math.hypot(dx, dy);
    var zone = b.reach + MOUSE_RANGE;
    if (d >= zone) return null;
    var f = 1 - d / zone; f *= f;
    var share = CURSOR_MASS / (CURSOR_MASS + b.R * b.R);
    var nx, ny;
    if (d > 1) { nx = dx / d; ny = dy / d; }
    else { var s = Math.hypot(mouse.vx, mouse.vy); nx = s ? mouse.vx / s : 0; ny = s ? mouse.vy / s : -1; }
    // A resting cursor: a gentle push away, like a hand held in the water.
    b.vx += nx * MOUSE_PUSH * share * f * dt;
    b.vy += ny * MOUSE_PUSH * share * f * dt;
    // A moving cursor: the part of its motion heading into the body pushes it.
    var rx = mouse.vx - b.vx, ry = mouse.vy - b.vy, vn = rx * nx + ry * ny;
    if (vn > 0) {
      var kw = Math.min(1, MOUSE_WAKE * dt) * share * f;
      b.vx += nx * vn * kw; b.vy += ny * vn * kw;
    }
    return { d: d, f: f, share: share, tx: rx - vn * nx, ty: ry - vn * ny };
  }

  // Keep a body on the page: bump softly off the edges and turn its drift
  // around, so it roams the whole page instead of pressing on one side.
  // Sideways a body may hang partly off the page, which gives it more room
  // in a narrow margin.
  function keepOnPage(b) {
    var m = b.reach, mx = b.reach * 0.55;
    if (b.x < mx)      { b.x = mx;      if (b.vx < 0) b.vx *= -0.5; if (b.drift) b.drift[0] = Math.abs(b.drift[0]); }
    if (b.x > PW - mx) { b.x = PW - mx; if (b.vx > 0) b.vx *= -0.5; if (b.drift) b.drift[0] = -Math.abs(b.drift[0]); }
    if (b.y < m)      { b.y = m;      if (b.vy < 0) b.vy *= -0.5; if (b.drift) b.drift[1] = Math.abs(b.drift[1]); }
    if (b.y > PH - m) { b.y = PH - m; if (b.vy > 0) b.vy *= -0.5; if (b.drift) b.drift[1] = -Math.abs(b.drift[1]); }
  }

  // The text column: the span of the masthead, sidebar and main text, in page
  // coordinates, re-measured on resize and every few seconds (the reading
  // panel changes it). With no real margins, as on a phone, nothing avoids it.
  var colL = 0, colR = 0, hasMargins = false;
  function measureColumn() {
    var L = Infinity, R = -Infinity;
    ['.masthead .band', '.side', 'main'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (r.width) { L = Math.min(L, r.left + scrollX); R = Math.max(R, r.right + scrollX); }
    });
    if (L === Infinity) { hasMargins = false; return; }
    colL = L - 12; colR = R + 12;
    hasMargins = W >= 640 && Math.min(colL, PW - colR) > 30;
  }
  function margin() { return hasMargins ? Math.min(colL, PW - colR) : 0; }

  // Which side of the column a point should head for: -1 left, 1 right,
  // 0 if it's already clear. A body may overlap the column by half its size.
  function columnSide(x, r) {
    if (!hasMargins || x + r * 0.5 < colL || x - r * 0.5 > colR) return 0;
    return x - colL < colR - x ? -1 : 1;
  }
  function avoidColumn(b, dt) {
    var side = columnSide(b.x, b.reach);
    if (!side) return;
    var depth = side < 0 ? b.x + b.reach * 0.5 - colL : colR - (b.x - b.reach * 0.5);
    b.vx += side * (25 + depth * 0.9) * dt;
    if (b.drift) b.drift[0] = side * Math.abs(b.drift[0]);
  }

  // Ease a body's velocity toward the current plus its own drift.
  function carry(b, rate, dt) {
    var u = current(b.x, b.y, b.seed), k = 1 - Math.exp(-rate * dt);
    b.vx += (u[0] + (b.drift ? b.drift[0] : 0) - b.vx) * k;
    b.vy += (u[1] + (b.drift ? b.drift[1] : 0) - b.vy) * k;
    var sp = Math.hypot(b.vx, b.vy);
    if (sp > 300) { b.vx *= 300 / sp; b.vy *= 300 / sp; }
  }

  function onScreen(x, y, m) {
    return x > scrollX - m && x < scrollX + W + m && y > scrollY - m && y < scrollY + H + m;
  }

  // ---- Geodesic spheres ---------------------------------------------------
  function geodesic(freq) {
    var g = (1 + Math.sqrt(5)) / 2, V = [], E = [], index = {}, edges = {};
    var ico = [[-1,g,0],[1,g,0],[-1,-g,0],[1,-g,0],[0,-1,g],[0,1,g],[0,-1,-g],[0,1,-g],[g,0,-1],[g,0,1],[-g,0,-1],[-g,0,1]];
    var faces = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
                 [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    function vert(p) {
      var l = Math.hypot(p[0], p[1], p[2]), q = [p[0] / l, p[1] / l, p[2] / l];
      var k = q.map(function (c) { return Math.round(c * 1e5); }).join();
      if (!(k in index)) { index[k] = V.length; V.push(q); }
      return index[k];
    }
    function edge(a, b) {
      var k = a < b ? a + ',' + b : b + ',' + a;
      if (!edges[k]) { edges[k] = 1; E.push([a, b]); }
    }
    faces.forEach(function (f) {
      var A = ico[f[0]], B = ico[f[1]], C = ico[f[2]], row = [], i, j;
      // Grid points on the flat face: i steps from A toward B, j toward C.
      for (i = 0; i <= freq; i++) {
        row[i] = [];
        for (j = 0; i + j <= freq; j++) {
          var a = (freq - i - j) / freq, b = i / freq, c = j / freq;
          row[i][j] = vert([A[0]*a + B[0]*b + C[0]*c, A[1]*a + B[1]*b + C[1]*c, A[2]*a + B[2]*b + C[2]*c]);
        }
      }
      for (i = 0; i < freq; i++) for (j = 0; i + j < freq; j++) {
        edge(row[i][j], row[i + 1][j]); edge(row[i][j], row[i][j + 1]); edge(row[i + 1][j], row[i][j + 1]);
      }
    });
    return { V: V, E: E };
  }

  // Orientation is a rotation matrix (row-major 3x3), turned about the
  // screen's own axes, so a drag turns a sphere the way the hand moved no
  // matter how it's already tilted.
  function rotate(M, wx, wy, wz, dt) {
    var w = Math.hypot(wx, wy, wz), th = w * dt;
    if (th < 1e-7) return M;
    var x = wx / w, y = wy / w, z = wz / w, s = Math.sin(th), c = 1 - Math.cos(th);
    var R = [1 - c * (y*y + z*z), -s*z + c*x*y,        s*y + c*x*z,
             s*z + c*x*y,         1 - c * (x*x + z*z), -s*x + c*y*z,
             -s*y + c*x*z,        s*x + c*y*z,         1 - c * (x*x + y*y)];
    var N = [];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++)
      N[i*3 + j] = R[i*3] * M[j] + R[i*3 + 1] * M[3 + j] + R[i*3 + 2] * M[6 + j];
    return N;
  }
  function tidy(M) {   // re-orthonormalise so rounding never skews the figure
    var a = [M[0], M[1], M[2]], b = [M[3], M[4], M[5]];
    var la = Math.hypot(a[0], a[1], a[2]); a = a.map(function (v) { return v / la; });
    var d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; b = [b[0] - d*a[0], b[1] - d*a[1], b[2] - d*a[2]];
    var lb = Math.hypot(b[0], b[1], b[2]); b = b.map(function (v) { return v / lb; });
    return a.concat(b, [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]]);
  }

  // With perspective 5/(5+z) a sphere's outline is at most 5/4 of its radius.
  var REACH = 1.25;

  var spheres = [1, 2, 3, 4].sort(function () { return Math.random() - 0.5; }).slice(0, 3).map(function (f) {
    var M = [1,0,0, 0,1,0, 0,0,1];
    M = rotate(M, 1, 0, 0, rand(0, 6.3)); M = rotate(M, 0, 1, 0, rand(0, 6.3)); M = rotate(M, 0, 0, 1, rand(0, 6.3));
    return { size: Math.round(rand(26, 64)), mesh: geodesic(f), M: M, x: 0, y: 0,
             drift: [rand(-3, 3), rand(8, 18) * sign()], vx: 0, vy: 0, seed: rand(0, 100),
             rest: [rand(0.02, 0.15) * sign(), rand(0.02, 0.15) * sign(), rand(0.01, 0.06) * sign()],
             spin: [0, 0, 0], bob: rand(2, 6), bobRate: rand(0.35, 0.7), bobY: 0, glow: 0 };
  });

  function stepSphere(b, dt) {
    carry(b, 0.2 + 0.4 * (900 / (b.R * b.R)), dt);   // heavier spheres are carried more slowly
    b.glow *= Math.exp(-4 * dt);
    var m = pushByMouse(b, b.y + b.bobY, dt);
    if (m && m.d < b.reach) {
      // Over the sphere, the sideways part of the cursor's motion turns it:
      // for a point on the near face, spin (ty, -tx, 0) / R moves it by (tx, ty).
      var kg = Math.min(1, MOUSE_GRIP * dt) * m.share * m.f;
      b.spin[0] += m.ty / b.R * kg; b.spin[1] -= m.tx / b.R * kg;
      b.glow = Math.max(b.glow, 1 - m.d / b.reach);
    }
    avoidColumn(b, dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    keepOnPage(b);
    var decay = Math.exp(-0.6 * dt);   // water slowly takes away spin the cursor gave
    b.spin = b.spin.map(function (w) { return w * decay; });
    b.M = rotate(b.M, b.rest[0] + b.spin[0], b.rest[1] + b.spin[1], b.rest[2] + b.spin[2], dt);
    b.bobY = Math.sin(t * b.bobRate + b.seed) * b.bob;
  }

  function collideSpheres() {
    for (var i = 0; i < spheres.length; i++) for (var j = i + 1; j < spheres.length; j++) {
      var a = spheres[i], b = spheres[j];
      var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.reach + b.reach;
      if (d >= min) continue;
      var nx = dx / d, ny = dy / d, rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) {   // a soft collision, mass by area
        var ma = a.R * a.R, mb = b.R * b.R, imp = 1.5 * rel / (ma + mb);
        a.vx -= imp * mb * nx; a.vy -= imp * mb * ny;
        b.vx += imp * ma * nx; b.vy += imp * ma * ny;
      }
      var push = (min - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }

  function drawSphere(b) {
    var ox = b.x - scrollX, oy = b.y + b.bobY - scrollY, M = b.M;
    var P = b.mesh.V.map(function (v) {
      var px = M[0]*v[0] + M[1]*v[1] + M[2]*v[2];
      var py = M[3]*v[0] + M[4]*v[1] + M[5]*v[2];
      var pz = M[6]*v[0] + M[7]*v[1] + M[8]*v[2];
      var k = 5 / (5 + pz);                               // mild perspective; +z is away
      return [ox + px * b.R * k, oy + py * b.R * k, pz];
    });
    var a = 1 + 0.6 * b.glow;
    [true, false].forEach(function (back) {                // far half first, dashed and fainter
      cx.setLineDash(back ? [3, 4] : []);
      cx.strokeStyle = ink(back ? a * 0.6 : a);
      cx.beginPath();
      b.mesh.E.forEach(function (e) {
        if ((P[e[0]][2] + P[e[1]][2] > 0) !== back) return;
        cx.moveTo(P[e[0]][0], P[e[0]][1]); cx.lineTo(P[e[1]][0], P[e[1]][1]);
      });
      cx.stroke();
    });
    cx.setLineDash([]);
  }

  // ---- Jellyfish ------------------------------------------------------------
  var jellies = [0, 1].map(function () {
    return { size: rand(12, 20), x: 0, y: 0, vx: 0, vy: 0, seed: rand(0, 100),
             heading: rand(-0.5, 0.5), wander: rand(0, 100), pulse: rand(0, 6.3),
             rate: rand(0.45, 0.7) * Math.PI * 2, arms: 4 + Math.floor(rand(0, 3)), len: rand(2.2, 3.2) };
  });

  function stepJelly(j, dt) {
    // Each contraction of the bell (the rising half of the pulse) pushes it
    // along its heading; water drag and the current do the rest.
    j.pulse += j.rate * dt;
    var squeeze = Math.max(0, Math.sin(j.pulse));
    j.vx += Math.sin(j.heading) * 55 * squeeze * dt;
    j.vy -= Math.cos(j.heading) * 55 * squeeze * dt;
    carry(j, 0.8, dt);
    steer(j, dt);
    j.x += j.vx * dt; j.y += j.vy * dt;
    keepOnPage(j);
  }

  // Swimmers (jellyfish, octopus) choose a heading: slow loops that take
  // them up and down the page, turning away from the page edges, the text
  // column and the cursor. Returns the cursor contact, if any.
  function steer(o, dt) {
    var wx = o.wander + Math.sin(t * 0.045 + o.seed) * 2.8, dx = 0.5 * Math.sin(wx), dy = -Math.cos(wx), edge = 220;
    if (o.y < edge) dy += 3 * (1 - o.y / edge);
    if (o.y > PH - edge) dy -= 3 * (1 - (PH - o.y) / edge);
    var side = columnSide(o.x, o.reach * 2);
    if (side) dx += side * 3;
    else if (hasMargins) {
      // In a margin: keep off both of its walls.
      var lo = o.x < colL ? 0 : colR, hi = o.x < colL ? colL : PW, mid = (lo + hi) / 2, half = (hi - lo) / 2;
      dx += (mid - o.x) / Math.max(half, 1) * 1.2;
    } else {
      if (o.x < edge) dx += 3 * (1 - o.x / edge);
      if (o.x > PW - edge) dx -= 3 * (1 - (PW - o.x) / edge);
    }
    avoidColumn(o, dt);
    var m = pushByMouse(o, o.y, dt);
    if (m) { var md = Math.max(m.d, 1); dx += (o.x - mouse.x - scrollX) / md * 2 * m.f; dy += (o.y - mouse.y - scrollY) / md * 2 * m.f; }
    var want = Math.atan2(dx, -dy), turn = Math.atan2(Math.sin(want - o.heading), Math.cos(want - o.heading));
    o.heading += Math.max(-0.7 * dt, Math.min(0.7 * dt, turn));
    return m;
  }

  function drawJelly(j) {
    var squeeze = Math.max(0, Math.sin(j.pulse)), R = j.R;
    var w = R * (1 - 0.16 * squeeze), h = R * 0.85 * (1 + 0.12 * squeeze);
    cx.save();
    cx.translate(j.x - scrollX, j.y - scrollY);
    cx.rotate(j.heading);
    cx.strokeStyle = ink(1);
    cx.beginPath();
    // The bell: half an ellipse, with two nested ribs and a scalloped rim.
    [1, 0.5].forEach(function (k) {
      for (var i = 0; i <= 24; i++) {
        var a = Math.PI + Math.PI * i / 24, px = w * k * Math.cos(a), py = h * Math.sin(a);
        i ? cx.lineTo(px, py) : cx.moveTo(px, py);
      }
    });
    cx.moveTo(0, -h); cx.lineTo(0, 0);
    for (var i = 0; i <= 16; i++) {
      var px = -w + 2 * w * i / 16, py = 1.2 * Math.sin(i * Math.PI);
      i ? cx.lineTo(px, py + (i % 2 ? 1 : 0)) : cx.moveTo(px, py);
    }
    cx.stroke();
    // Tentacles: travelling sine waves that grow toward the tips.
    cx.strokeStyle = ink(0.75);
    cx.beginPath();
    for (var a = 0; a < j.arms; a++) {
      var x0 = w * (-0.75 + 1.5 * a / (j.arms - 1)), n = 14, L = R * j.len;
      for (var s = 0; s <= n; s++) {
        var u = s / n, tx = x0 * (1 - 0.35 * u) + R * 0.28 * u * Math.sin(j.pulse * 0.9 - s * 0.55 + a * 1.7);
        s ? cx.lineTo(tx, u * L) : cx.moveTo(tx, 0);
      }
    }
    cx.stroke();
    cx.restore();
  }

  // ---- Nautilus --------------------------------------------------------------
  var GOLDEN_B = Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2);   // grows by phi every quarter turn
  var TURNS = 3 * Math.PI;
  var nautili = [0].map(function () {
    return { size: rand(24, 36), x: 0, y: 0, vx: 0, vy: 0, seed: rand(0, 100), angle: rand(0, 6.3),
             turn: rand(0.03, 0.08) * sign(), drift: [rand(-2, 2), rand(6, 12) * sign()], wig: rand(0, 6.3) };
  });

  function stepNautilus(n, dt) {
    carry(n, 0.35, dt);
    pushByMouse(n, n.y, dt);
    avoidColumn(n, dt);
    n.x += n.vx * dt; n.y += n.vy * dt;
    keepOnPage(n);
    n.angle += n.turn * dt;
    n.wig += dt * 2.2;
  }

  function drawNautilus(n) {
    var R = n.R, c = R / Math.exp(GOLDEN_B * TURNS);
    function pt(th) { var r = c * Math.exp(GOLDEN_B * th); return [r * Math.cos(th), r * Math.sin(th)]; }
    cx.save();
    cx.translate(n.x - scrollX, n.y - scrollY);
    cx.rotate(n.angle + 0.18 * Math.sin(t * 0.4 + n.seed));   // a slow rocking
    cx.strokeStyle = ink(1.1);
    cx.beginPath();
    // The shell: the spiral itself.
    for (var i = 0; i <= 160; i++) { var p = pt(TURNS * i / 160); i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }
    // The aperture, and the chamber walls: each joins the outer whorl to the
    // one inside it along the same direction, bowed slightly backwards.
    for (var th = TURNS; th > TURNS - 2 * Math.PI + 0.01; th -= 2 * Math.PI / 11) {
      if (th - 2 * Math.PI < 0) break;
      var o = pt(th), q = pt(th - 2 * Math.PI), mid = pt(th - 0.35), r0 = Math.hypot(mid[0], mid[1]);
      var rq = (Math.hypot(o[0], o[1]) + Math.hypot(q[0], q[1])) / 2, bend = rq / r0;
      cx.moveTo(o[0], o[1]);
      if (th === TURNS) cx.lineTo(q[0], q[1]);
      else cx.quadraticCurveTo(mid[0] * bend, mid[1] * bend, q[0], q[1]);
    }
    cx.stroke();
    // Tentacles from the aperture, reaching forward and curling.
    var o2 = pt(TURNS), q2 = pt(TURNS - 2 * Math.PI), r = Math.hypot(o2[0], o2[1]);
    var tx = GOLDEN_B * Math.cos(TURNS) - Math.sin(TURNS), ty = GOLDEN_B * Math.sin(TURNS) + Math.cos(TURNS);
    var tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    cx.strokeStyle = ink(0.7);
    cx.beginPath();
    for (var k = 0; k < 5; k++) {
      var f = 0.25 + 0.12 * k, bx = q2[0] + (o2[0] - q2[0]) * f, by = q2[1] + (o2[1] - q2[1]) * f;
      for (var s = 0; s <= 8; s++) {
        var u = s / 8, L = r * 0.55 * u, side = r * 0.12 * u * Math.sin(n.wig + k * 1.3 - s * 0.7);
        var px = bx + tx * L - ty * side, py = by + ty * L + tx * side;
        s ? cx.lineTo(px, py) : cx.moveTo(px, py);
      }
    }
    cx.stroke();
    cx.restore();
  }

  // ---- Octopus -----------------------------------------------------------------
  var octopi = [0].map(function () {
    return { size: rand(14, 22), x: 0, y: 0, vx: 0, vy: 0, seed: rand(0, 100),
             heading: rand(-0.6, 0.6), wander: rand(0, 100), pulse: rand(0, 6.3), rate: rand(0.28, 0.4) * Math.PI * 2,
             len: rand(2.3, 2.9), fright: 0,
             arms: [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return { ph: rand(0, 6.3), curl: rand(1.2, 2.4) * (i < 4 ? -1 : 1) }; }) };
  });

  function stepOctopus(o, dt) {
    // A jet pulse: the mantle squeezes and it shoots mantle-first; a scare
    // from the cursor quickens the pulse and doubles the thrust.
    o.pulse += o.rate * (1 + 1.5 * o.fright) * dt;
    var squeeze = Math.max(0, Math.sin(o.pulse));
    var thrust = 45 * (1 + o.fright) * squeeze;
    o.vx += Math.sin(o.heading) * thrust * dt;
    o.vy -= Math.cos(o.heading) * thrust * dt;
    carry(o, 0.9, dt);
    var m = steer(o, dt);
    o.fright = Math.max(m ? m.f : 0, o.fright * Math.exp(-1.5 * dt));
    o.x += o.vx * dt; o.y += o.vy * dt;
    keepOnPage(o);
  }

  function drawOctopus(o) {
    var R = o.R, squeeze = Math.max(0, Math.sin(o.pulse)), open = Math.max(0, -Math.sin(o.pulse));
    cx.save();
    cx.translate(o.x - scrollX, o.y - scrollY);
    cx.rotate(o.heading);
    cx.strokeStyle = ink(1.1);
    cx.beginPath();
    // Mantle and eyes.
    cx.ellipse(0, -0.55 * R, 0.5 * R * (1 - 0.1 * squeeze), 0.72 * R * (1 + 0.08 * squeeze), 0, 0, Math.PI * 2);
    cx.moveTo(-0.19 * R, -0.02 * R); cx.arc(-0.28 * R, -0.02 * R, 0.09 * R, 0, Math.PI * 2);
    cx.moveTo(0.37 * R, -0.02 * R); cx.arc(0.28 * R, -0.02 * R, 0.09 * R, 0, Math.PI * 2);
    cx.stroke();
    // Arms: each is integrated from its curvature, kappa(u) = a wave running
    // down the arm plus a curl that grows as u^3 toward the tip, so the tips
    // roll up like spirals. Arms bunch while jetting and splay while refilling.
    o.arms.forEach(function (a, i) {
      var th = Math.PI / 2 + (i - 3.5) * 0.22 * (1 + 0.8 * open), px = (i - 3.5) / 3.5 * 0.36 * R, py = 0.1 * R;
      var n = 18, L = R * o.len * (1 - 0.25 * squeeze), ds = L / n;
      for (var s = 0; s < n; s++) {
        var u = s / n;
        th += (0.45 * Math.sin(o.pulse * 0.8 + a.ph - 3.2 * u) * (0.4 + u) + a.curl * u * u * u * 3) / R * ds;
        var qx = px + Math.cos(th) * ds, qy = py + Math.sin(th) * ds;
        cx.lineWidth = Math.max(0.4, 1.5 - 1.2 * u);
        cx.strokeStyle = ink(0.95);
        cx.beginPath(); cx.moveTo(px, py); cx.lineTo(qx, qy); cx.stroke();
        px = qx; py = qy;
      }
    });
    cx.restore();
  }

  // ---- A sheep, adrift ----------------------------------------------------------------
  var sheep = [0].map(function () {
    return { size: rand(16, 22), x: 0, y: 0, vx: 0, vy: 0, seed: rand(0, 100), face: 1,
             drift: [rand(-3, 3), rand(5, 10) * sign()], paddle: rand(0, 6.3) };
  });

  function stepSheep(b, dt) {
    carry(b, 0.3, dt);
    pushByMouse(b, b.y, dt);
    avoidColumn(b, dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    keepOnPage(b);
    if (b.vx > 3) b.face = 1; else if (b.vx < -3) b.face = -1;   // looks where it's going
    b.paddle += dt * 3.2;
  }

  function drawSheep(b) {
    var R = b.R, a = R, h = R * 0.62;
    cx.save();
    cx.translate(b.x - scrollX, b.y - scrollY + Math.sin(t * 0.9 + b.seed) * 3);
    cx.rotate(0.1 * Math.sin(t * 0.7 + b.seed));
    cx.scale(b.face, 1);
    cx.strokeStyle = ink(1.1);
    cx.beginPath();
    // Legs, paddling in turn.
    [-0.5, -0.2, 0.2, 0.5].forEach(function (lx, i) {
      var sw = 0.35 * Math.sin(b.paddle + i * Math.PI / 2);
      cx.moveTo(lx * a, 0.5 * h); cx.lineTo(lx * a + Math.sin(sw) * 0.75 * R, 0.5 * h + Math.cos(sw) * 0.75 * R);
    });
    cx.stroke();
    // Fleece: an ellipse whose radius swells by |sin 7 theta|, which gives
    // fourteen round scallops meeting in small inward cusps.
    cx.fillStyle = '#f3f4f9';
    cx.beginPath();
    for (var i = 0; i <= 140; i++) {
      var th = Math.PI * 2 * i / 140, k = 1 + 0.13 * Math.abs(Math.sin(7 * th));
      var px = a * Math.cos(th) * k, py = h * Math.sin(th) * k;
      i ? cx.lineTo(px, py) : cx.moveTo(px, py);
    }
    cx.closePath(); cx.fill(); cx.stroke();
    // Head: a small solid oval with an ear, like the one in the story.
    cx.fillStyle = ink(2.2);
    cx.beginPath();
    cx.ellipse(a * 0.98, -h * 0.15, R * 0.36, R * 0.28, -0.35, 0, Math.PI * 2);
    cx.moveTo(a * 0.9, -h * 0.5); cx.lineTo(a * 0.78, -h * 0.9); cx.lineTo(a * 1.05, -h * 0.55);
    cx.fill();
    cx.restore();
  }

  // ---- A school of fish ---------------------------------------------------------
  var school = [];
  for (var i = 0; i < 14; i++) {
    var a0 = rand(0, 6.3);
    school.push({ x: 0, y: 0, vx: Math.cos(a0) * 30, vy: Math.sin(a0) * 30, wag: rand(0, 6.3), size: rand(0.8, 1.2) });
  }
  var schoolSeed = rand(0, 100);

  function stepSchool(dt) {
    school.forEach(function (f) {
      var sx = 0, sy = 0, ax = 0, ay = 0, cx0 = 0, cy0 = 0, n = 0;
      school.forEach(function (o) {
        if (o === f) return;
        var dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy);
        if (d > 70) return;
        n++; ax += o.vx; ay += o.vy; cx0 += o.x; cy0 += o.y;
        if (d < 16 && d > 0) { sx -= dx / d * (16 - d); sy -= dy / d * (16 - d); }   // keep apart
      });
      var fx = sx * 3, fy = sy * 3, calm = 1 - (f.scared || 0);   // a frightened fish forgets the school
      if (n) {
        fx += ((ax / n - f.vx) * 0.8 + (cx0 / n - f.x) * 0.25) * calm;   // match heading, stay together
        fy += ((ay / n - f.vy) * 0.8 + (cy0 / n - f.y) * 0.25) * calm;
      }
      // A slow shared wander so the school goes places, plus the current.
      var wa = Math.sin(t * 0.05 + schoolSeed) * 3, u = current(f.x, f.y, schoolSeed);
      fx += Math.cos(wa) * 3 + u[0] * 0.3; fy += Math.sin(wa) * 10 + u[1] * 0.3;
      // The text column: swim back out to the nearer margin.
      var cs = columnSide(f.x, 20);
      if (cs) fx += cs * (90 + (cs < 0 ? f.x - colL : colR - f.x) * 3);
      // Page edges and spheres: steer clear.
      var e = 90;
      if (f.x < e) fx += (e - f.x) * 1.5;
      if (f.x > PW - e) fx -= (f.x - PW + e) * 1.5;
      if (f.y < e) fy += (e - f.y) * 1.5;
      if (f.y > PH - e) fy -= (f.y - PH + e) * 1.5;
      spheres.forEach(function (b) {
        var dx = f.x - b.x, dy = f.y - b.y, d = Math.hypot(dx, dy), r = b.reach + 14;
        if (d < r && d > 0) { fx += dx / d * (r - d) * 4; fy += dy / d * (r - d) * 4; }
      });
      // The cursor: scatter.
      var fear = 0;
      if (mouse) {
        var mx = f.x - mouse.x - scrollX, my = f.y - mouse.y - scrollY, md = Math.hypot(mx, my);
        if (md < FISH_FEAR && md > 0) {
          fear = 1 - md / FISH_FEAR;
          fx += mx / md * 1100 * fear; fy += my / md * 1100 * fear;
        }
      }
      // Fear lingers for a moment after the cursor has gone.
      f.scared = Math.max(fear, (f.scared || 0) * Math.exp(-2 * dt));
      f.vx += fx * dt; f.vy += fy * dt;
      var sp = Math.hypot(f.vx, f.vy), top = 55 + 140 * f.scared, low = 16;
      if (sp > top) { f.vx *= top / sp; f.vy *= top / sp; }
      if (sp < low && sp > 0) { f.vx *= low / sp; f.vy *= low / sp; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.x = Math.min(Math.max(f.x, 4), PW - 4); f.y = Math.min(Math.max(f.y, 4), PH - 4);
      f.wag += dt * (7 + sp * 0.12);
    });
  }

  function drawSchool() {
    cx.strokeStyle = ink(1.3);
    cx.beginPath();
    school.forEach(function (f) {
      if (!onScreen(f.x, f.y, 12)) return;
      var h = Math.atan2(f.vy, f.vx), c = Math.cos(h), s = Math.sin(h), k = f.size * scale;
      var ox = f.x - scrollX, oy = f.y - scrollY, wag = Math.sin(f.wag) * 0.45;
      function P(x, y) { return [ox + (x * c - y * s) * k, oy + (x * s + y * c) * k]; }
      // A lens-shaped body and a forked tail that beats.
      var nose = P(5, 0), tail = P(-4, 0), up = P(0.5, -2), dn = P(0.5, 2);
      cx.moveTo(nose[0], nose[1]); cx.quadraticCurveTo(up[0], up[1], tail[0], tail[1]);
      cx.quadraticCurveTo(dn[0], dn[1], nose[0], nose[1]);
      var t1 = P(-7.5, -2.6 + wag * 3), t2 = P(-7.5, 2.6 + wag * 3);
      cx.moveTo(t1[0], t1[1]); cx.lineTo(tail[0], tail[1]); cx.lineTo(t2[0], t2[1]);
    });
    cx.stroke();
  }

  // ---- Page size, starting places, and the loop ---------------------------------
  var floaters = spheres.concat(jellies, nautili, octopi, sheep);

  function measure() {
    PW = root.clientWidth;
    PH = Math.max(root.scrollHeight, document.body.scrollHeight, innerHeight);
    measureColumn();
    floaters.forEach(keepOnPage);
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.lineWidth = 1; cx.lineJoin = 'round'; cx.lineCap = 'round';
    PW = root.clientWidth;
    measureColumn();
    // Shrink everything to fit the margins: full size in a 150 px margin or wider.
    scale = W < 640 ? 0.6 : Math.min(1, Math.max(0.5, margin() / 150));
    spheres.forEach(function (b) { b.R = b.size * scale; b.reach = b.R * REACH; });
    octopi.forEach(function (o) { o.R = o.size * scale; o.reach = o.R * 1.3; });
    sheep.forEach(function (b) { b.R = b.size * scale; b.reach = b.R * 1.25; });
    jellies.forEach(function (j) { j.R = j.size * scale; j.reach = j.R * 1.2; });
    nautili.forEach(function (n) { n.R = n.size * scale; n.reach = n.R * 1.1; });
    measure();
    if (still) draw();
  }
  resize();

  // Start everyone somewhere in the first two screens, in a margin, not
  // overlapping, so a visitor meets a few on arrival; from there they roam.
  function spawnX(r) {
    if (!hasMargins) return r + Math.random() * Math.max(PW - 2 * r, 1);
    var m = r * 0.55;
    return Math.random() < 0.5 ? rand(m, Math.max(m, colL - r * 0.3))
                               : rand(Math.min(PW - m, colR + r * 0.3), PW - m);
  }
  floaters.forEach(function (b, n) {
    var top = Math.min(PH, H * 2);
    for (var tries = 0; tries < 50; tries++) {
      b.x = spawnX(b.reach);
      b.y = b.reach + Math.random() * Math.max(top - 2 * b.reach, 1);
      var clear = true;
      for (var k = 0; k < n; k++) if (Math.hypot(b.x - floaters[k].x, b.y - floaters[k].y) < b.reach + floaters[k].reach + 20) clear = false;
      if (clear) break;
    }
  });
  var sx0 = spawnX(20), sy0 = rand(H * 0.2, Math.min(PH, H * 1.5));
  school.forEach(function (f) { f.x = sx0 + rand(-40, 40); f.y = sy0 + rand(-30, 30); });

  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(measure).observe(document.body);
  if (still) addEventListener('scroll', draw, { passive: true });

  function step(dt) {
    t += dt;
    spheres.forEach(function (b) { stepSphere(b, dt); });
    collideSpheres();
    jellies.forEach(function (j) { stepJelly(j, dt); });
    nautili.forEach(function (n) { stepNautilus(n, dt); });
    octopi.forEach(function (o) { stepOctopus(o, dt); });
    sheep.forEach(function (b) { stepSheep(b, dt); });
    stepSchool(dt);
    if (Math.floor(t * 30) % 90 === 0) measureColumn();
    if (Math.floor(t * 30) % 120 === 0) spheres.forEach(function (b) { b.M = tidy(b.M); });
  }

  function draw() {
    cx.clearRect(0, 0, W, H);
    spheres.forEach(function (b) { if (onScreen(b.x, b.y, b.reach + 8)) drawSphere(b); });
    jellies.forEach(function (j) { if (onScreen(j.x, j.y, j.R * 4)) drawJelly(j); });
    nautili.forEach(function (n) { if (onScreen(n.x, n.y, n.R * 1.6)) drawNautilus(n); });
    octopi.forEach(function (o) { if (onScreen(o.x, o.y, o.R * 4)) drawOctopus(o); });
    sheep.forEach(function (b) { if (onScreen(b.x, b.y, b.R * 2)) drawSheep(b); });
    cx.lineWidth = 1;
    drawSchool();
  }

  if (still) { draw(); return; }

  var last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min((now - last) / 1000, 0.1); last = now;
    if (acc >= 1 / 30) {                       // 30 fps is plenty for this
      step(acc); acc = 0;
      draw();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
