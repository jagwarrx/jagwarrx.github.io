// A small pixel-art country in the margins either side of the text, in soft
// Ghibli colours, seen from above and in front (2.5D), laid out like a
// tower-defence map: a dirt road winds down each margin and travellers,
// monks, soldiers, sheep and balloons wander along it, past shrines,
// pagodas, a classical temple, statues, lanterns, torii, watchtowers,
// cottages and groves. The land is a hex map, as on a board-game map: each
// hex is meadow, forest, rocky hills under a peak, a lake or farmland, with
// faint dashed borders; dotted trails lead from each place to the road, and
// places carry little name tags and the odd red map pin. The walkers are
// chunky tokens with a white sticker edge: people, sheep, cows, chickens,
// covered wagons and an elephant (after the Imperium games), and a hot-air
// balloon floats over. Petals fall from the cherry trees, chimneys smoke,
// lanterns flicker and cloud shadows drift over. The cursor makes walkers
// hop and nudges balloons aside.
//
// All of it is drawn here, pixel by pixel; no tileset. The ground is baked
// once per layout into one image per margin, one canvas pixel per art
// pixel, and drawn scaled up by P with smoothing off. Anything that stands
// up is a sprite drawn in order of its foot, so a walker passes behind a
// tree and in front of the next. Beside the text the ground dissolves in an
// ordered dither. The world is rolled afresh on each load, in bands down the
// page, so a page that grows only changes at the bottom. No margins (a
// phone) means no world. Off in the reading panel; still for
// prefers-reduced-motion.
(function () {
  if (self !== top) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var P = 2;           // CSS px per art pixel
  var FADE = 20;       // art px over which the ground dithers away beside the text
  var ALPHA = 0.85;    // overall strength
  var PATH = 7;        // half-width of the road, art px
  var BAND = 300;      // art px of page per band of the world

  var C = {
    line: '#465446',
    g1: '#b4d698', g2: '#a7cd8c', g3: '#99c380', blade: '#83b06e', bladeHi: '#c6e1ac',
    dirt: '#e0cda6', dirt2: '#d4be95', dirtEdge: '#c9b089', pebble: '#b49c7a',
    water: '#95cbdd', water2: '#82bbd0', waterHi: '#d6eef4', bank: '#789a6b', sand: '#eadcb5', lily: '#86b86e',
    top: '#bfe0a4', rim: '#d0e9b6', cliff: '#b4aa9a', cliff2: '#a3998b', cliffLine: '#8c8377', cliffFoot: '#88a476',
    trunk: '#80603f', trunk2: '#624832',
    red: '#d6613f', red2: '#ad4733', ink: '#3c3638', dark: '#5b4640',
    wood: '#bb8651', wood2: '#96663c', wood3: '#724b2c',
    stone: '#d2ccbf', stone2: '#b4ad9f', stone3: '#938b7c',
    marble: '#f5f0e5', marble2: '#ded7c7', marble3: '#c0b7a5',
    terra: '#da8b60', plaster: '#f4ead5', plaster2: '#ded1b6',
    gold: '#efc55d', glow: '#ffd97a', glass: '#9dc4db', skin: '#f2cda6', moss: '#90c073',
    wool: '#f7f4ed', wool2: '#ddd7cb', face: '#2d3550', string: '#8d8a86', shade: '#2c4636'
  };
  var LEAVES = {
    green: ['#a3d086', '#80b56f', '#62975d'], autumn: ['#f7c77c', '#e99c56', '#c27644'],
    cherry: ['#fde2e8', '#f6bccb', '#e096ac'], pine: ['#7eab89', '#628e6e', '#4c7459']
  };
  var ROOFS = [['#e27c60', '#c2624b', '#9a4a3b'], ['#81a1d2', '#6586b8', '#4e6a95'], ['#6c9f9a', '#548882', '#406b66']];
  var CLOTHES = ['#d8674f', '#5f8fd0', '#e6b04f', '#7fb069', '#9a7fc8', '#e58fae', '#4f9a9a'];
  var HATS = ['#e9cf8a', '#c9a15e', '#7a8fb0'];
  var BALLOONS = ['#e8615a', '#5e93dc', '#69c16a', '#f2cf55', '#ec8fb8', '#9b7fe0'];
  var FLOWERS = ['#fbf7ec', '#f4b6c4', '#f6d86b', '#bba8e2'];
  var B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  var SEED = (Math.random() * 4294967296) >>> 0;
  function hash(x, y, k) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((SEED ^ k) | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rng(a) {       // mulberry32: a seeded random stream
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function bayer(x, y) { return (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
  function vnoise(x, y, sc, k) {
    var fx = x / sc, fy = y / sc, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    var a = hash(ix, iy, k), b = hash(ix + 1, iy, k), c = hash(ix, iy + 1, k), d = hash(ix + 1, iy + 1, k);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function pick(R, list) { return list[Math.floor(R() * list.length)]; }
  function rnd(lo, hi) { return lo + Math.random() * (hi - lo); }

  var rgbs = {};
  function rgb(h) {
    return rgbs[h] || (rgbs[h] = [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]);
  }
  function mix(h, to, k) {
    var a = rgb(h), b = rgb(to), s = '#';
    for (var i = 0; i < 3; i++) s += ('0' + Math.round(a[i] + (b[i] - a[i]) * k).toString(16)).slice(-2);
    return s;
  }

  // ---- Sprites ----------------------------------------------------------------
  // paint(d) fills a grid of colours; then a soft dark outline goes round
  // everything (unless line is false) and after(d) adds unoutlined detail.
  function sprite(w, h, paint, line, after, sticker) {
    var g = new Array(w * h);
    var d = {
      px: function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y * w + x] = c; },
      rect: function (x, y, rw, rh, c) { for (var j = 0; j < rh; j++) for (var i = 0; i < rw; i++) d.px(x + i, y + j, c); }
    };
    paint(d, w, h);
    if (line !== false) {
      var o = g.slice();
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!g[i] && ((x > 0 && g[i - 1]) || (x < w - 1 && g[i + 1]) || (y > 0 && g[i - w]) || (y < h - 1 && g[i + w]))) o[i] = line || C.line;
      }
      g = o;
    }
    if (after) after(d);
    if (sticker) {
      // A white edge round the outline, like a die-cut sticker.
      var w2 = w + 2, h2 = h + 2, s2 = new Array(w2 * h2);
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) s2[(yy + 1) * w2 + xx + 1] = g[yy * w + xx];
      var o2 = s2.slice();
      for (var j = 0; j < w2 * h2; j++) {
        var jx = j % w2;
        if (!s2[j] && ((jx > 0 && s2[j - 1]) || (jx < w2 - 1 && s2[j + 1]) || s2[j - w2] || s2[j + w2])) o2[j] = '#fbfaf4';
      }
      g = o2; w = w2; h = h2;
    }
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var c2 = c.getContext('2d'), im = c2.createImageData(w, h);
    for (var k = 0; k < w * h; k++) if (g[k]) {
      var v = rgb(g[k]);
      im.data[k * 4] = v[0]; im.data[k * 4 + 1] = v[1]; im.data[k * 4 + 2] = v[2]; im.data[k * 4 + 3] = 255;
    }
    c2.putImageData(im, 0, 0);
    return { c: c, w: w, h: h };
  }

  // A round form lit from the top left, dithered between three tones.
  function tone(pal, nx, ny, x, y) {
    var v = nx * 0.6 + ny * 0.8 + (bayer(x, y) - 0.5) * 0.4;
    return v < -0.35 ? pal[0] : v > 0.3 ? pal[2] : pal[1];
  }

  // A tree: overlapping clumps painted back to front, each lit on its own,
  // which gives the layered, cloudy canopy of a Ghibli tree.
  function broadleaf(pal) {
    var w = 22, h = 28, blobs = [[11, 10, 7]];
    for (var n = 3 + Math.floor(Math.random() * 3); n > 0; n--) {
      var r = rnd(3.5, 5.5);
      blobs.push([rnd(2 + r, w - 3 - r), rnd(2 + r, 15), r]);
    }
    blobs.sort(function (a, b) { return a[1] - b[1]; });
    return sprite(w, h, function (d) {
      d.rect(10, 16, 2, 10, C.trunk); d.rect(11, 16, 1, 10, C.trunk2);
      d.px(9, 25, C.trunk); d.px(12, 25, C.trunk2);
      blobs.forEach(function (b) {
        for (var y = Math.floor(b[1] - b[2]); y <= b[1] + b[2]; y++)
          for (var x = Math.floor(b[0] - b[2]); x <= b[0] + b[2]; x++) {
            var nx = (x - b[0]) / b[2], ny = (y - b[1]) / b[2];
            if (nx * nx + ny * ny <= 1) d.px(x, y, tone(pal, nx, ny, x, y));
          }
      });
      for (var k = 0; k < 6; k++) d.px(rnd(5, 17), rnd(4, 12), pal[0]);
    });
  }
  function pine() {
    var pal = LEAVES.pine, tiers = 3 + Math.floor(Math.random() * 2);
    return sprite(16, 30, function (d) {
      d.rect(7, 23, 2, 5, C.trunk); d.rect(8, 23, 1, 5, C.trunk2);
      for (var k = 0; k < tiers; k++) {
        var y0 = 2 + k * 5, hh = 8;
        for (var y = 0; y < hh; y++) {
          var hw = 1 + (y + k * 1.5) * 0.75;
          for (var x = Math.round(8 - hw); x < 8 + hw; x++)
            d.px(x, y0 + y, y === hh - 1 ? pal[2] : x < 7 ? pal[0] : x > 8 ? pal[2] : pal[1]);
        }
      }
    });
  }
  function bush() {
    var pal = LEAVES.green, extra = pick(Math.random, [null, C.red, '#fbf7ec', '#f4b6c4']);
    return sprite(12, 9, function (d) {
      [[4, 5, 3], [8, 5, 3], [6, 4, 3.2]].forEach(function (b) {
        for (var y = 0; y < 9; y++) for (var x = 0; x < 12; x++) {
          var nx = (x - b[0]) / b[2], ny = (y - b[1]) / b[2];
          if (nx * nx + ny * ny <= 1) d.px(x, y, tone(pal, nx, ny, x, y));
        }
      });
      if (extra) for (var k = 0; k < 4; k++) d.px(rnd(3, 9), rnd(2, 6), extra);
    });
  }
  function rock() {
    var moss = Math.random() < 0.5;
    return sprite(9, 7, function (d) {
      for (var y = 0; y < 7; y++) for (var x = 0; x < 9; x++) {
        var nx = (x - 4) / 3.5, ny = (y - 3.6) / 2.6;
        if (nx * nx + ny * ny <= 1) d.px(x, y, moss && ny < -0.4 ? C.moss : tone([C.stone, C.stone2, C.stone3], nx, ny, x, y));
      }
    });
  }
  function mushroom() {
    return sprite(7, 7, function (d) {
      d.rect(2, 1, 3, 1, '#dd5a4a'); d.rect(1, 2, 5, 2, '#dd5a4a'); d.rect(4, 2, 2, 2, '#b84638');
      d.px(2, 2, C.wool); d.px(4, 1, C.wool);
      d.rect(3, 4, 1, 2, C.plaster);
    });
  }
  function sign() {
    return sprite(9, 12, function (d) {
      d.rect(4, 4, 1, 7, C.wood2);
      d.rect(1, 2, 7, 3, C.wood); d.rect(2, 3, 4, 1, C.wood3); d.px(7, 3, C.wood2);
    });
  }
  function lantern() {
    var s = sprite(10, 15, function (d) {
      d.rect(2, 12, 6, 2, C.stone2); d.rect(2, 12, 6, 1, C.stone);
      d.rect(4, 8, 2, 4, C.stone2); d.rect(4, 8, 1, 4, C.stone);
      d.rect(2, 5, 6, 3, C.stone); d.rect(7, 5, 1, 3, C.stone2); d.rect(4, 6, 2, 1, C.glow);
      d.rect(1, 3, 8, 2, C.stone2); d.rect(1, 3, 8, 1, C.stone);
      d.rect(4, 1, 2, 2, C.stone2);
    });
    s.glow = [4, 6, 2, 1];
    return s;
  }
  function statue() {
    return sprite(13, 25, function (d) {
      d.rect(2, 17, 9, 7, C.stone2); d.rect(2, 17, 9, 1, C.stone); d.rect(9, 18, 1, 6, C.stone3); d.rect(2, 21, 9, 1, C.stone3);
      for (var k = 0; k < 4; k++) d.px(rnd(2, 10), rnd(18, 23), C.moss);
      for (var y = 5; y < 17; y++) {
        var a = Math.round(5 - (y - 5) * 0.2), b = Math.round(7 + (y - 5) * 0.2);
        for (var x = a; x <= b; x++) d.px(x, y, x === a ? C.marble : x >= b ? C.marble3 : C.marble2);
      }
      d.rect(6, 10, 1, 7, C.marble3);
      d.rect(5, 2, 3, 3, C.marble); d.px(7, 3, C.marble2); d.px(7, 4, C.marble2);
      d.px(5, 2, C.moss); d.px(7, 2, C.moss);                    // a laurel
      d.rect(8, 5, 1, 4, C.marble2); d.px(9, 4, C.marble); d.px(9, 3, C.gold); // arm up, holding a torch
    });
  }
  function obelisk() {
    return sprite(9, 28, function (d) {
      d.rect(1, 24, 7, 3, C.stone2); d.rect(1, 24, 7, 1, C.stone);
      for (var y = 4; y < 24; y++) {
        var hw = 1.5 + (y - 4) / 20;
        for (var x = Math.round(4.5 - hw); x < 4.5 + hw; x++) d.px(x, y, x < 4 ? C.stone : C.stone2);
        if (y % 3 === 0 && Math.random() < 0.7) d.px(4, y, C.stone3);
      }
      d.rect(3, 2, 3, 2, C.gold); d.px(4, 1, C.gold);
    });
  }
  function banner() {
    return sprite(8, 21, function (d) {
      d.rect(1, 1, 1, 19, C.wood3);
      d.rect(2, 2, 4, 9, C.red); d.rect(5, 2, 1, 9, C.red2);
      d.px(2, 11, C.red); d.px(5, 11, C.red2);
      d.px(3, 5, C.gold); d.px(4, 5, C.gold); d.px(3, 6, C.gold); d.px(4, 6, C.gold);
    });
  }
  function torii() {
    return sprite(26, 24, function (d) {
      d.rect(6, 7, 2, 15, C.red); d.rect(7, 7, 1, 15, C.red2);
      d.rect(18, 7, 2, 15, C.red); d.rect(19, 7, 1, 15, C.red2);
      d.rect(5, 22, 4, 1, C.ink); d.rect(17, 22, 4, 1, C.ink);
      d.rect(3, 9, 20, 2, C.red); d.rect(3, 10, 20, 1, C.red2);
      d.rect(12, 6, 2, 3, C.ink);
      d.rect(2, 4, 22, 2, C.red); d.rect(2, 5, 22, 1, C.red2);
      d.rect(1, 2, 24, 2, C.ink); d.px(1, 1, C.ink); d.px(24, 1, C.ink);
    });
  }
  function shrine(roof) {
    return sprite(38, 34, function (d) {
      var m = 19;
      d.rect(4, 28, 30, 5, C.stone2); d.rect(4, 28, 30, 1, C.stone); d.rect(4, 32, 30, 1, C.stone3);
      for (var x = 6; x < 34; x += 5) d.rect(x, 29, 1, 3, C.stone3);
      d.rect(15, 29, 8, 4, C.stone); d.rect(15, 30, 8, 1, C.stone2); d.rect(15, 32, 8, 1, C.stone2);
      d.rect(7, 19, 24, 9, C.dark);
      [10, 24].forEach(function (x) {
        d.rect(x, 20, 4, 7, C.plaster);
        for (var y = 22; y < 27; y += 2) d.rect(x, y, 4, 1, C.plaster2);
      });
      d.rect(17, 25, 4, 2, C.wood2); d.px(19, 25, C.gold);
      [7, 14, 22, 29].forEach(function (x) { d.rect(x, 19, 2, 9, C.red); d.rect(x + 1, 19, 1, 9, C.red2); });
      d.rect(7, 18, 24, 1, C.red2);
      for (var y = 6; y <= 17; y++) {
        var hw = 6 + (y - 6);
        for (var x = m - hw; x < m + hw; x++) d.px(x, y, y >= 16 ? roof[2] : y < 8 ? roof[0] : (x & 1) ? roof[0] : roof[1]);
      }
      d.px(m - 18, 15, roof[2]); d.px(m + 17, 15, roof[2]);
      d.rect(m - 7, 5, 14, 1, roof[2]); d.px(m - 8, 4, C.gold); d.px(m + 7, 4, C.gold);
    });
  }
  function pagoda(roof) {
    return sprite(24, 44, function (d) {
      var m = 12;
      d.rect(3, 38, 18, 5, C.stone2); d.rect(3, 38, 18, 1, C.stone); d.rect(9, 39, 6, 4, C.stone); d.rect(9, 41, 6, 1, C.stone2);
      [[38, 7, 6, 10], [27, 6, 5, 8], [17, 5, 4, 6]].forEach(function (tt) {
        var yb = tt[0], wh = tt[1], hw = tt[2], rw = tt[3];
        d.rect(m - hw, yb - wh, hw * 2, wh, C.red); d.rect(m + hw - 1, yb - wh, 1, wh, C.red2);
        d.rect(m - 2, yb - wh + 1, 4, wh - 2, C.dark);
        d.rect(m - 1, yb - wh + 2, 2, 1, C.glow);
        for (var k = 0; k < 4; k++) {
          var ry = yb - wh - 4 + k, hk = rw - 3 + k;
          for (var x = m - hk; x < m + hk; x++) d.px(x, ry, k === 3 ? roof[2] : (x & 1) ? roof[0] : roof[1]);
        }
        d.px(m - rw - 1, yb - wh - 2, roof[2]); d.px(m + rw, yb - wh - 2, roof[2]);
      });
      d.rect(11, 2, 2, 6, C.gold); d.rect(10, 3, 4, 1, '#c9a040'); d.rect(10, 5, 4, 1, '#c9a040');
    });
  }
  function classical() {
    return sprite(36, 32, function (d) {
      d.rect(2, 29, 32, 2, C.marble2); d.rect(3, 27, 30, 2, C.marble); d.rect(4, 25, 28, 2, C.marble2);
      d.rect(2, 30, 32, 1, C.marble3); d.rect(3, 28, 30, 1, C.marble2);
      d.rect(5, 13, 27, 12, C.marble3);
      d.rect(15, 16, 6, 9, C.dark); d.rect(17, 19, 2, 2, C.gold);
      [5, 10, 15, 20, 25, 30].forEach(function (c) {
        d.rect(c, 14, 2, 11, C.marble); d.rect(c + 1, 14, 1, 11, C.marble2);
        d.rect(c - 1, 13, 4, 1, C.marble); d.rect(c - 1, 24, 4, 1, C.marble2);
        for (var y = 17; y < 24; y++) if (Math.random() < 0.18) d.px(c + (Math.random() < 0.5 ? 0 : 1), y, C.moss);
      });
      d.rect(3, 10, 30, 3, C.marble); d.rect(3, 12, 30, 1, C.marble2);
      for (var x = 4; x < 33; x += 3) d.px(x, 11, C.marble3);
      for (var y = 3; y <= 9; y++) {
        var hw = Math.round((y - 3) * 2.4) + 1;
        for (var x2 = 18 - hw; x2 < 18 + hw; x2++) d.px(x2, y, (x2 === 18 - hw || x2 === 17 + hw || y === 9) ? C.terra : C.marble);
      }
      d.px(17, 7, C.gold); d.px(18, 7, C.gold); d.px(18, 2, C.terra);
    });
  }
  function tower() {
    return sprite(20, 32, function (d) {
      d.rect(3, 16, 2, 15, C.wood2); d.rect(15, 16, 2, 15, C.wood2);
      d.rect(4, 16, 1, 15, C.wood3); d.rect(16, 16, 1, 15, C.wood3);
      for (var i = 0; i <= 10; i++) {
        var dy = Math.round(i * 0.55);
        d.px(5 + i, 18 + dy, C.wood3); d.px(14 - i, 18 + dy, C.wood3);
        d.px(5 + i, 24 + dy, C.wood3); d.px(14 - i, 24 + dy, C.wood3);
      }
      d.rect(8, 17, 1, 14, C.wood); d.rect(11, 17, 1, 14, C.wood);
      for (var y = 18; y < 31; y += 2) d.rect(9, y, 2, 1, C.wood);
      d.rect(1, 14, 18, 2, C.wood); d.rect(1, 15, 18, 1, C.wood2);
      for (var x = 3; x < 17; x++) d.rect(x, 8, 1, 6, x % 3 === 0 ? C.wood3 : x % 3 === 1 ? C.wood : C.wood2);
      d.rect(7, 10, 6, 2, C.dark);
      for (var ry = 3; ry < 8; ry++) {
        var hw = 2 + (ry - 3) * 1.8;
        for (var rx = Math.round(10 - hw); rx < 10 + hw; rx++) d.px(rx, ry, ry % 2 ? C.wood2 : C.wood3);
      }
      d.rect(10, 0, 1, 3, C.wood3); d.rect(11, 0, 3, 2, C.red);
    });
  }
  function cottage(roof) {
    var s = sprite(26, 25, function (d) {
      d.rect(3, 13, 20, 11, C.plaster); d.rect(18, 14, 4, 10, C.plaster2);
      d.rect(3, 13, 1, 11, C.wood3); d.rect(22, 13, 1, 11, C.wood3); d.rect(3, 18, 20, 1, C.wood3);
      d.rect(11, 17, 4, 7, C.wood2); d.rect(11, 17, 4, 1, C.wood3); d.px(14, 20, C.gold);
      [5, 17].forEach(function (x) {
        d.rect(x, 14, 3, 3, C.glass); d.px(x + 1, 15, C.wood3);
        d.rect(x, 17, 3, 1, pick(Math.random, ['#e58fae', '#f2cf55', C.red]));
      });
      for (var y = 3; y <= 12; y++) {
        var hw = 8 + (y - 3) * 0.5;
        for (var x = Math.round(13 - hw); x < 13 + hw; x++) d.px(x, y, (y - 3) % 3 === 2 ? roof[2] : y < 6 ? roof[0] : roof[1]);
      }
      d.rect(17, 0, 3, 5, C.stone2); d.rect(17, 0, 3, 1, C.stone3);
    });
    s.smoke = [18, 0];
    return s;
  }
  function well() {
    return sprite(13, 15, function (d) {
      d.rect(2, 9, 9, 4, C.stone2); d.rect(2, 9, 9, 1, C.stone); d.rect(3, 10, 7, 1, '#4f7890');
      d.rect(2, 3, 1, 7, C.wood2); d.rect(10, 3, 1, 7, C.wood2); d.rect(4, 5, 5, 1, C.wood3);
      d.rect(1, 1, 11, 2, ROOFS[0][1]); d.rect(1, 2, 11, 1, ROOFS[0][2]);
    });
  }

  // Walkers. Front view walking down the page, back view walking up;
  // two frames each. o: body, hat, head ('hat' | 'bald' | 'helmet'), robe, soldier.
  function person(o, back, f) {
    return sprite(11, 15, function (d) {
      if (!o.robe) {
        d.rect(4, 12, 1, f ? 2 : 1, C.ink); d.rect(6, 12, 1, f ? 1 : 2, C.ink);
      }
      var bh = o.robe ? 7 : 5, b2 = mix(o.body, '#3c3638', 0.25);
      d.rect(3, 7, 5, bh, o.body); d.rect(7, 7, 1, bh, b2);
      if (o.robe) d.px(f ? 3 : 7, 13, b2);
      d.px(2, 8 + f, b2); d.px(8, 9 - f, b2);
      d.rect(4, 4, 3, 3, C.skin);
      if (back) d.rect(4, 4, 3, 2, o.head === 'bald' ? C.skin : '#5a4636');
      else { d.px(4, 5, C.ink); d.px(6, 5, C.ink); }
      if (o.head === 'hat') { d.rect(2, 3, 7, 1, o.hat); d.rect(4, 2, 3, 1, o.hat); d.px(5, 1, o.hat); }
      if (o.head === 'helmet') { d.rect(4, 3, 3, 2, C.stone2); d.rect(4, 2, 3, 1, C.red); }
      if (o.soldier) {
        d.rect(back ? 4 : 1, 8, back ? 3 : 2, back ? 3 : 4, '#c8923e');
        d.rect(9, 2, 1, 11, C.wood3);
      }
    }, null, o.soldier ? function (d) { d.px(9, 0, C.stone3); d.px(9, 1, C.stone2); } : null, true);
  }
  function sheepSprite(f, flip) {
    return sprite(14, 10, function (d) {
      function px(x, y, c) { d.px(flip ? 13 - x : x, y, c); }
      [3, 5, 8, 10].forEach(function (x, i) { px(x, 7, C.face); if ((i + f) % 2) px(x, 8, C.face); });
      for (var y = 1; y < 8; y++) for (var x = 1; x < 12; x++) {
        var nx = (x - 6) / 5, ny = (y - 4.3) / 3.2, a = Math.atan2(ny, nx);
        if (nx * nx + ny * ny <= 1 - 0.18 * Math.abs(Math.sin(7 * a))) px(x, y, ny > 0.45 ? C.wool2 : C.wool);
      }
      px(11, 3, C.face); px(12, 3, C.face); px(11, 4, C.face); px(12, 4, C.face); px(12, 5, C.face); px(11, 2, C.face);
    }, null, null, true);
  }
  function balloonSprite(col) {
    return sprite(9, 13, function (d) {
      var pal = [mix(col, '#ffffff', 0.35), col, mix(col, '#3c3638', 0.3)];
      for (var y = 0; y < 9; y++) for (var x = 0; x < 9; x++) {
        var nx = (x - 4) / 3.3, ny = (y - 4.2) / 3.8;
        if (nx * nx + ny * ny <= 1) d.px(x, y, tone(pal, nx, ny, x, y));
      }
      d.px(3, 2, '#ffffff'); d.px(4, 8, pal[2]);
    }, null, function (d) { d.px(4, 10, C.string); d.px(4, 11, C.string); d.px(5, 12, C.string); }, true);
  }
  // Side-view animals and carts, facing right unless flipped.
  function side(w, h, flip, paint) {
    return sprite(w, h, function (d) {
      paint({ px: function (x, y, c) { d.px(flip ? w - 1 - x : x, y, c); },
              rect: function (x, y, rw, rh, c) { for (var j = 0; j < rh; j++) for (var i = 0; i < rw; i++) d.px(flip ? w - 1 - x - i : x + i, y + j, c); } });
    }, null, null, true);
  }
  function cowSprite(f, flip) {
    return side(16, 11, flip, function (d) {
      [3, 5, 9, 11].forEach(function (x, i) { d.rect(x, 8, 1, (i + f) % 2 ? 2 : 1, C.ink); });
      d.rect(2, 3, 10, 5, C.wool); d.rect(2, 7, 10, 1, C.wool2);
      d.rect(4, 3, 3, 2, C.ink); d.rect(8, 5, 2, 2, C.ink); d.px(3, 6, C.ink);
      d.rect(11, 1, 3, 4, C.wool); d.rect(13, 4, 2, 2, '#f0b4ae'); d.px(12, 2, C.ink);
      d.px(11, 0, '#e9dfc5'); d.px(13, 0, '#e9dfc5'); d.px(1, 3, C.ink); d.px(1, 4, C.ink);
    });
  }
  function chickenSprite(f, flip) {
    return side(8, 8, flip, function (d) {
      d.rect(1, 3, 5, 3, C.wool); d.rect(2, 6, 3, 1, C.wool2); d.rect(4, 1 + f, 2, 2, C.wool);
      d.px(5, f, C.red); d.px(6, 2 + f, '#f2b84a'); d.px(1, 2, C.wool);
      d.px(3, 7, '#e0a040'); if (!f) d.px(4, 7, '#e0a040');
    });
  }
  function wagonSprite(f, flip) {
    return side(30, 15, flip, function (d) {
      d.rect(2, 1, 15, 8, '#f1e7cd'); d.rect(2, 6, 15, 3, '#dccfb0');
      for (var x = 4; x < 17; x += 4) d.rect(x, 1, 1, 8, '#d3c4a2');
      d.rect(1, 9, 17, 2, C.wood); d.rect(1, 10, 17, 1, C.wood3);
      [4, 13].forEach(function (x) { d.rect(x, 10, 4, 4, C.wood3); d.rect(x + 1, 11, 2, 2, C.wood); });
      d.rect(17, 9, 3, 1, C.wood3);
      d.rect(20, 5, 7, 4, '#9a6a45'); d.rect(20, 8, 7, 1, '#7d5537');
      d.rect(25, 2, 3, 4, '#9a6a45'); d.px(27, 5, '#7d5537'); d.px(25, 1, '#5e4030');
      d.rect(20, 5, 1, 2, '#5e4030');
      [21, 23, 25, 26].forEach(function (x, i) { d.rect(x, 9, 1, (i + f) % 2 ? 3 : 2, '#7d5537'); });
    });
  }
  function elephantSprite(f, flip) {
    return side(21, 16, flip, function (d) {
      for (var y = 2; y < 13; y++) for (var x = 1; x < 16; x++) {
        var a = (x - 8.5) / 7.2, b = (y - 7.5) / 4.8;
        if (a * a + b * b <= 1) d.px(x, y, b > 0.5 ? '#9296a0' : '#adb1ba');
      }
      for (var y2 = 2; y2 < 10; y2++) for (var x2 = 13; x2 < 20; x2++) {
        var c = (x2 - 16) / 3.4, e = (y2 - 5.5) / 3.4;
        if (c * c + e * e <= 1) d.px(x2, y2, '#adb1ba');
      }
      d.rect(14, 4, 2, 5, '#9296a0');
      d.rect(18, 8, 2, 3, '#adb1ba'); d.px(19, 11, '#adb1ba'); d.px(20, 12, '#9296a0');
      d.px(18, 9, C.wool); d.px(17, 5, C.ink);
      d.rect(5, 2, 7, 5, C.red); d.rect(5, 6, 7, 1, C.gold); d.rect(6, 0, 5, 2, C.gold); d.rect(7, 0, 3, 1, '#c9a040');
      [3, 6, 10, 13].forEach(function (x, i) { d.rect(x, 12, 2, (i + f) % 2 ? 3 : 2, '#9296a0'); });
      d.px(0, 6, '#9296a0');
    });
  }
  function hotAir() {
    return sprite(15, 22, function (d) {
      for (var y = 0; y < 13; y++) for (var x = 0; x < 15; x++) {
        var a = (x - 7) / 6.6, b = (y - 6) / 6.4;
        if (a * a + b * b > 1) continue;
        var gore = Math.floor(a * 2.6 + 3) % 2;
        d.px(x, y, gore ? (a > 0.45 ? '#b64c3a' : '#dd6450') : (a > 0.45 ? '#dccfb1' : '#f5eacd'));
      }
      d.rect(5, 12, 5, 1, '#b64c3a'); d.rect(6, 13, 3, 1, '#dd6450');
      d.px(5, 14, C.wood3); d.px(5, 15, C.wood3); d.px(9, 14, C.wood3); d.px(9, 15, C.wood3);
      d.rect(4, 16, 7, 4, C.wood); d.rect(4, 16, 7, 1, C.wood3); d.rect(9, 17, 1, 3, C.wood2);
    }, null, null, true);
  }
  function mountain() {
    return sprite(40, 30, function (d) {
      [[25, 29, 14, 20], [15, 29, 14, 27]].forEach(function (m) {   // [peak x, base y, half-base, height]
        for (var y = m[1] - m[3]; y <= m[1]; y++) {
          var k = (y - (m[1] - m[3])) / m[3], hw = Math.round(1 + k * m[2]);
          for (var x = m[0] - hw; x <= m[0] + hw; x++) {
            var snow = k < 0.33 + 0.08 * Math.sin(x * 1.7);
            d.px(x, y, snow ? (x > m[0] ? '#dfe3e6' : '#fbfbf8') : x > m[0] ? '#a7a291' : x > m[0] - 2 ? '#bcb7a5' : '#d2cdbb');
          }
        }
      });
      for (var i = 0; i < 6; i++) d.px(rnd(6, 34), rnd(22, 28), C.moss);
    });
  }
  function haystack() {
    return sprite(11, 9, function (d) {
      for (var y = 0; y < 8; y++) for (var x = 0; x < 11; x++) {
        var a = (x - 5) / 4.6, b = (y - 5.5) / 5;
        if (a * a + b * b <= 1 && y < 8) d.px(x, y, (x + y) % 3 === 0 ? '#c9ad55' : a > 0.4 ? '#d8bd62' : '#ead27c');
      }
    });
  }
  function mapPin() {
    return sprite(9, 12, function (d) {
      for (var y = 0; y < 9; y++) for (var x = 0; x < 9; x++) {
        var a = (x - 4) / 4, b = (y - 4) / 4;
        if (a * a + b * b <= 1) d.px(x, y, a > 0.4 ? '#b8453c' : '#d9564b');
      }
      d.rect(3, 9, 3, 1, '#b8453c'); d.px(4, 10, '#b8453c');
      d.rect(3, 2, 3, 5, '#fbf7ec'); d.rect(2, 3, 5, 3, '#fbf7ec'); d.px(4, 4, '#b8453c');
    }, null, null, true);
  }

  // A cloud's shadow: a dithered blob, denser toward the middle.
  var CLOUD = sprite(64, 28, function (d) {
    var e = [[22, 15, 16, 9], [38, 12, 18, 10], [50, 16, 12, 8]];
    for (var y = 0; y < 28; y++) for (var x = 0; x < 64; x++) {
      var f = 0;
      e.forEach(function (q) { var a = (x - q[0]) / q[2], b = (y - q[1]) / q[3]; f = Math.max(f, 1 - (a * a + b * b)); });
      if (f * 1.4 > bayer(x, y)) d.px(x, y, C.shade);
    }
  }, false);

  // A few of each thing, made once per load so no two loads look alike.
  var TREES = {
    green: [broadleaf(LEAVES.green), broadleaf(LEAVES.green), broadleaf(LEAVES.green)],
    autumn: [broadleaf(LEAVES.autumn), broadleaf(LEAVES.autumn)],
    cherry: [broadleaf(LEAVES.cherry), broadleaf(LEAVES.cherry)],
    pine: [pine(), pine()]
  };
  var SMALL = { bush: [bush(), bush(), bush()], rock: [rock(), rock()], mushroom: [mushroom()], sign: [sign()] };
  var LANTERN = lantern(), STATUE = statue(), BANNER = banner(), PIN = mapPin(), AIR = hotAir(), HAY = haystack();
  var NAMES = {
    shrine: ['Moss Shrine', 'Cedar Shrine', 'Fox Shrine', 'Rain Shrine', 'Lantern Shrine', 'Hill Shrine'],
    pagoda: ['Crane Pagoda', 'Five Winds', 'High Bell', 'Cloud Pagoda'],
    classical: ['Old Forum', 'Marble Hall', 'Temple of Janus', 'Temple of Ceres'],
    tower: ['Kestrel Watch', 'North Watch', 'Hawk Post', 'Last Light'],
    cottage: ['Tea House', 'Wayfarer Inn', "Miller's Rest", 'Honey Farm', 'Quiet Hearth', 'Bramble Inn'],
    statues: ['Stone Garden', 'The Listeners', 'Old Kings'],
    obelisk: ['Sun Needle', 'Old Mile'],
    torii: ['Petal Gate', 'Red Gate'],
    mountain: ['Grey Tooth', 'Hollow Peak', 'Sheep Fell', 'Cold Crown'],
    lake: ['Mirror Lake', 'Heron Pond', 'Still Water', 'Carp Pool']
  };

  // Name tags use the site's pixel font, Silkscreen, if it loads.
  var FONT = 'bold 9px Verdana, sans-serif';
  try {
    var me = document.currentScript && document.currentScript.src;
    if (me && window.FontFace) {
      var ff = new FontFace('Silkscreen', 'url(' + new URL('../fonts/silkscreen-400.ttf', me) + ')');
      ff.load().then(function (f) { document.fonts.add(f); FONT = '8px Silkscreen'; if (still) draw(); }, function () {});
    }
  } catch (e) {}

  // ---- Canvas and page ----------------------------------------------------------
  var cv = document.createElement('canvas');
  cv.className = 'bg-figure';
  cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, document.body.firstChild);
  var cx = cv.getContext('2d');
  var root = document.documentElement;
  var W = 0, H = 0, PW = 0, PH = 0, t = 0;

  var mouse = null;
  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
  });
  root.addEventListener('mouseleave', function () { mouse = null; });
  addEventListener('blur', function () { mouse = null; });

  // The text column: masthead, sidebar and main text, in page coordinates.
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
    hasMargins = W >= 640 && Math.min(colL, PW - colR) > 60;
  }

  // ---- Building a margin ----------------------------------------------------------
  var strips = [];

  // The land is a grid of pointy-top hexes, in art px on the page.
  var S = 22, SQ3 = Math.sqrt(3), INR = S * SQ3 / 2;
  function hexOf(x, y) {
    var q = (SQ3 / 3 * x - y / 3) / S, r = (2 / 3 * y) / S, z = -q - r;
    var rq = Math.round(q), rr = Math.round(r), rz = Math.round(z);
    var dq = Math.abs(rq - q), dr = Math.abs(rr - r), dz = Math.abs(rz - z);
    if (dq > dr && dq > dz) rq = -rr - rz; else if (dr > dz) rr = -rq - rz;
    return [rq, rr];
  }
  function hexCentre(q, r) { return [S * SQ3 * (q + r / 2), S * 1.5 * r]; }
  function biome(s, q, r) {
    var k = (q + 5000) * 20000 + r, b = s.biomes[k];
    if (b) return b;
    var c = hexCentre(q, r), h = hash(q, r, 22), v = vnoise(q, r, 2.4, 21);
    var road = Math.abs(c[0] - s.pathX(c[1])) < INR + PATH + 2;
    var inside = c[0] > s.lo + INR * 0.8 && c[0] < s.hi - INR * 0.8;
    if (road) b = h < 0.12 ? 'farm' : 'meadow';
    else if (v > 0.63) b = 'forest';
    else if (inside && h < 0.08 && clearOfPath(s, c[0], INR * 0.9, c[1] - INR, c[1] + INR)) b = 'lake';
    else if (inside && h < 0.17) b = 'hills';
    else if (h < 0.3) b = 'farm';
    else b = 'meadow';
    return (s.biomes[k] = b);
  }

  function makeStrip(x0, w, h, left) {
    var R = rng(SEED ^ (left ? 0x9E3779B9 : 0x85EBCA6B));
    var s = { x0: x0, w: w, h: h, left: left, ponds: [], plats: [], objects: [], units: [], clouds: [], air: [],
              trails: [], biomes: {}, used: {} };
    s.lo = x0 + (left ? 3 : FADE * 0.7); s.hi = x0 + w - (left ? FADE * 0.7 : 3);
    s.amp = Math.max(0, (s.hi - s.lo) / 2 - PATH - 5); s.pc = (s.lo + s.hi) / 2;
    s.f1 = 1 / (70 + R() * 50); s.f2 = 1 / (25 + R() * 15); s.p1 = R() * 6.3; s.p2 = R() * 6.3;
    s.pathX = function (Y) { return s.pc + s.amp * (0.75 * Math.sin(Y * s.f1 + s.p1) + 0.25 * Math.sin(Y * s.f2 + s.p2)); };
    // Every hex over the strip, top to bottom, each with its own seeded stream
    // so the world only changes where the page does.
    var hexes = [];
    for (var r = -1; r * 1.5 * S < h + S; r++) {
      var q0 = Math.floor((x0 - INR) / (S * SQ3) - r / 2), q1 = Math.ceil((x0 + w + INR) / (S * SQ3) - r / 2);
      for (var q = q0; q <= q1; q++) {
        var c = hexCentre(q, r);
        if (c[0] < x0 - INR || c[0] > x0 + w + INR) continue;
        hexes.push({ q: q, r: r, x: c[0], y: c[1], b: biome(s, q, r), R: rng(SEED ^ Math.imul(q + 7777, 0x27D4EB2D) ^ Math.imul(r + 99, 0x165667B1) ^ (left ? 1 : 2)) });
      }
    }
    hexes.forEach(function (x) {
      if (x.b === 'lake') {
        var p = { x: Math.round(x.x), y: Math.round(x.y), rx: Math.round(INR * 0.85), ry: Math.round(INR * 0.66) };
        s.ponds.push(p);
        if (x.R() < 0.45) s.objects.push({ spr: null, X: p.x, Y: p.y + p.ry, r: 0, label: nameFor(s, 'lake', x.R), ly: p.y + p.ry + 3, s: s });
      }
    });
    // Places first, so trees grow round them.
    var kinds = ['shrine', 'pagoda', 'classical', 'statues', 'torii', 'tower', 'cottage', 'obelisk', 'cottage', 'shrine', 'tower'];
    hexes.forEach(function (x) {
      if (x.b === 'hills' && x.R() < 0.75) place(s, 'mountain', x, x.R);
      else if ((x.b === 'meadow' || x.b === 'farm') && x.R() < 0.22) place(s, pick(x.R, kinds), x, x.R);
    });
    hexes.forEach(function (x) { dress(s, x, x.R); });
    for (var b = 0; b * BAND < h; b++) {
      var RB = rng(SEED ^ Math.imul(b + 1, 0x27D4EB2D) ^ (left ? 3 : 4)), y0 = b * BAND, y1 = Math.min(h, y0 + BAND);
      for (var u = 0, nu = 2 + (RB() < 0.5 ? 1 : 0); u < nu; u++) s.units.push(walker(RB, y0 + RB() * (y1 - y0)));
      s.clouds.push({ X: s.x0 + RB() * s.w, Y: y0 + RB() * BAND });
      if (b % 4 === 1) s.air.push({ Y: y0 + RB() * BAND, ph: RB() * 6.3, dir: RB() < 0.5 ? -1 : 1 });
    }
    bake(s);
    return s;
  }

  function nameFor(s, kind, R) {
    var list = NAMES[kind], i = s.used[kind] === undefined ? Math.floor(R() * list.length) : s.used[kind] + 1;
    s.used[kind] = i;
    return list[i % list.length];
  }

  function clearOfPath(s, X, hw, y0, y1) {
    for (var y = y0; y <= y1; y += 2) if (Math.abs(X - s.pathX(y)) < PATH + hw + 2) return false;
    return true;
  }
  // Is there room for something hw wide, standing r deep, h tall, with its foot at X, Y?
  function free(s, X, Y, hw, r, h) {
    if (X - hw < s.lo || X + hw > s.hi || Y - h < 1 || Y > s.h - 2) return false;
    if (!clearOfPath(s, X, r, Y - r, Y + r)) return false;
    for (var i = 0; i < s.ponds.length; i++) {
      var p = s.ponds[i], a = (X - p.x) / (p.rx + r), b = (Y - p.y) / (p.ry + r);
      if (a * a + b * b < 1) return false;
    }
    for (var j = 0; j < s.plats.length; j++) {
      var q = s.plats[j];
      if (X > q.x - q.rx - r && X < q.x + q.rx + r && Y > q.y - q.ry - r && Y < q.y + q.ry + q.cliff + 1) return false;
    }
    for (var k = 0; k < s.objects.length; k++) {
      var o = s.objects[k];
      if (o.spr && Math.abs(X - o.X) < r + o.r && Math.abs(Y - o.Y) * 1.4 < r + o.r) return false;
    }
    return true;
  }
  function add(s, spr, X, Y, r, kind, shadow) {
    var o = { spr: spr, X: Math.round(X), Y: Math.round(Y), r: r, kind: kind, shadow: shadow, seed: Math.random() * 100, s: s };
    s.objects.push(o);
    return o;
  }
  function tryAdd(s, spr, X, Y, r, kind, shadow) {
    return free(s, X, Y, spr.w / 2 - 2, r, spr.h) ? add(s, spr, X, Y, r, kind, shadow) : null;
  }
  // A dotted trail from a place to the road, and a name tag under it.
  function mark(s, o, kind, R, ty, trail) {
    if (R() < 0.75) { o.label = nameFor(s, kind, R); o.ly = ty + 2; o.pin = R() < 0.3; }
    if (trail) s.trails.push({ x: o.X, y: ty });
  }

  // A landmark in hex x, if there's room.
  function place(s, kind, x, R) {
    var X = x.x + (R() - 0.5) * 6, Y = x.y + (R() - 0.5) * 6, px = s.pathX(Y), side = X < px ? -1 : 1, spr, o;
    if ((kind === 'torii' || kind === 'tower') && Math.abs(x.x - px) > INR * 1.6 + PATH) kind = 'cottage';
    if (kind === 'shrine' || kind === 'pagoda' || kind === 'classical') {
      spr = kind === 'shrine' ? shrine(pick(R, ROOFS)) : kind === 'pagoda' ? pagoda(pick(R, ROOFS)) : classical();
      var hw = spr.w / 2 + 3;
      // A raised terrace with stone steps down its front.
      var q = { x: Math.round(X), y: Math.round(Y - 4), rx: Math.round(hw + 1), ry: 9, cliff: 5 };
      if (!clearOfPath(s, X, q.rx, q.y - spr.h, q.y + q.ry + q.cliff + 2)) return;
      if (!free(s, X, q.y + 3, q.rx, 2, spr.h + 2)) return;
      s.plats.push(q);
      o = add(s, spr, X, q.y + 3, q.rx, kind, 0);
      var fy = q.y + q.ry + q.cliff + 4;
      mark(s, o, kind, R, fy + 1, true);
      if (kind === 'classical') {
        tryAdd(s, STATUE, X - q.rx + 4, fy, 3, 'statue', 4);
        tryAdd(s, STATUE, X + q.rx - 4, fy, 3, 'statue', 4);
      } else {
        tryAdd(s, LANTERN, X - q.rx + 4, fy, 3, 'lantern', 3);
        tryAdd(s, LANTERN, X + q.rx - 4, fy, 3, 'lantern', 3);
        for (var c = 0; c < 6; c++) tryAdd(s, pick(R, TREES.cherry), X + (R() - 0.5) * (q.rx * 2 + 24), q.y + (R() - 0.3) * 30, 5, 'cherry', 7);
      }
    } else if (kind === 'torii') {
      if (px - 13 < s.lo || px + 13 > s.hi) return;
      o = add(s, torii(), px, Y, 2, 'torii', 0);
      mark(s, o, kind, R, Y + 2, false);
      tryAdd(s, LANTERN, px - PATH - 6, Y + 5, 3, 'lantern', 3);
      tryAdd(s, LANTERN, px + PATH + 6, Y + 5, 3, 'lantern', 3);
    } else if (kind === 'tower') {
      X = px + side * (PATH + 12);
      if ((o = tryAdd(s, tower(), X, Y, 8, 'tower', 9))) {
        mark(s, o, kind, R, Y + 2, false);
        tryAdd(s, BANNER, X + side * 13, Y + 2, 2, 'banner', 2);
      }
    } else if (kind === 'cottage') {
      if ((o = tryAdd(s, cottage(pick(R, ROOFS)), X, Y, 12, 'cottage', 13))) {
        mark(s, o, kind, R, Y + 2, true);
        tryAdd(s, well(), X + (R() < 0.5 ? -1 : 1) * 17, Y + 8, 5, 'well', 5);
        tryAdd(s, SMALL.bush[0], X - 8, Y + 6, 3, 'bush', 4);
      }
    } else if (kind === 'statues' || kind === 'obelisk') {
      if ((o = tryAdd(s, kind === 'obelisk' ? obelisk() : STATUE, X, Y, 4, kind, 5))) {
        mark(s, o, kind, R, Y + 6, true);
        tryAdd(s, kind === 'obelisk' ? STATUE : LANTERN, X - 9, Y + 4, 3, 'lantern', 3);
        tryAdd(s, kind === 'obelisk' ? STATUE : LANTERN, X + 9, Y + 4, 3, 'lantern', 3);
      }
    } else if (kind === 'mountain') {
      if ((o = tryAdd(s, mountain(), X, Y + 10, 14, 'mountain', 0))) {
        if (R() < 0.6) { o.label = nameFor(s, 'mountain', R); o.ly = Y + 13; }
        for (var k = 0; k < 3; k++) tryAdd(s, pick(R, SMALL.rock), X + (R() - 0.5) * 36, Y + 10 + R() * 8, 3, 'rock', 0);
      }
    }
  }

  // Fill in a hex by its biome.
  function dress(s, x, R) {
    var i, n;
    function near(sp) { return [x.x + (R() - 0.5) * INR * 1.6, x.y + (R() - 0.5) * S * 1.4]; }
    if (x.b === 'forest') {
      var kind = R() < 0.55 ? 'green' : R() < 0.6 ? 'pine' : R() < 0.5 ? 'autumn' : 'cherry';
      for (i = 0, n = 5 + Math.floor(R() * 4); i < n * 3 && n > 0; i++) {
        var p = near(), sp = pick(R, TREES[R() < 0.8 ? kind : 'green']);
        if (tryAdd(s, sp, p[0], p[1], 4, sp === TREES.cherry[0] || sp === TREES.cherry[1] ? 'cherry' : 'tree', 7)) n--;
      }
    } else if (x.b === 'hills') {
      for (i = 0; i < 3; i++) { var ph = near(); tryAdd(s, R() < 0.5 ? pick(R, TREES.pine) : pick(R, SMALL.rock), ph[0], ph[1], 3, 'rock', 3); }
    } else if (x.b === 'farm') {
      if (R() < 0.5) { var pf = near(); tryAdd(s, HAY, pf[0], pf[1], 4, 'hay', 5); }
    } else if (x.b === 'meadow') {
      for (i = 0, n = Math.floor(R() * 3); i < n; i++) {
        var pm = near(), what = R() < 0.6 ? 'bush' : R() < 0.85 ? 'rock' : R() < 0.5 ? 'mushroom' : 'sign';
        if (what === 'sign') pm[0] = s.pathX(pm[1]) + (R() < 0.5 ? -1 : 1) * (PATH + 5);
        tryAdd(s, pick(R, SMALL[what]), pm[0], pm[1], 3, what, what === 'bush' ? 4 : 0);
      }
      if (R() < 0.3) { var pt = near(), tk = R() < 0.7 ? 'green' : 'autumn'; tryAdd(s, pick(R, TREES[tk]), pt[0], pt[1], 5, tk, 7); }
    }
  }

  function walker(R, Y) {
    var r = R(), u = { unit: true, Y: Y, X: 0, dir: R() < 0.5 ? -1 : 1, lane: (R() - 0.5) * 8, walk: R() * 2,
                       pause: 0, hop: 0, off: 0, ov: 0, seed: R() * 100, face: 0 };
    if (r < 0.26) {
      var o = { body: pick(R, CLOTHES), hat: pick(R, HATS), head: R() < 0.7 ? 'hat' : 'bare' };
      u.kind = 'traveller'; u.speed = 5 + R() * 4; u.rest = 40;
      u.spr = [[person(o, false, 0), person(o, false, 1)], [person(o, true, 0), person(o, true, 1)]];
    } else if (r < 0.36) {
      var m = { body: '#e39a4a', head: 'bald', robe: true };
      u.kind = 'monk'; u.speed = 3 + R() * 2; u.rest = 30;
      u.spr = [[person(m, false, 0), person(m, false, 1)], [person(m, true, 0), person(m, true, 1)]];
    } else if (r < 0.46) {
      var so = { body: '#c9553f', head: 'helmet', soldier: true };
      u.kind = 'soldier'; u.speed = 6 + R() * 2; u.rest = 60;
      u.spr = [[person(so, false, 0), person(so, false, 1)], [person(so, true, 0), person(so, true, 1)]];
    } else if (r < 0.84) {
      var k2 = pick(R, ['sheep', 'sheep', 'cow', 'chicken', 'wagon', 'wagon', 'elephant']);
      var mk = { sheep: sheepSprite, cow: cowSprite, chicken: chickenSprite, wagon: wagonSprite, elephant: elephantSprite }[k2];
      u.kind = k2; u.side = true;
      u.speed = { sheep: 2.5, cow: 2, chicken: 4, wagon: 7, elephant: 4 }[k2] + R() * 2;
      u.rest = { sheep: 12, cow: 10, chicken: 5, wagon: 50, elephant: 30 }[k2];
      u.spr = [[mk(0, false), mk(1, false)], [mk(0, true), mk(1, true)]];
    } else {
      u.kind = 'balloon'; u.speed = 3 + R() * 2.5; u.rest = 1e9;
      u.spr = balloonSprite(pick(R, BALLOONS));
    }
    return u;
  }

  // ---- The ground ---------------------------------------------------------------
  function ground(s, gx, y, pc) {
    var i, a, b;
    for (i = 0; i < s.ponds.length; i++) {
      var p = s.ponds[i];
      a = (gx - p.x) / p.rx; b = (y - p.y) / p.ry;
      var e = a * a + b * b;
      if (e < 1) {
        if (e > 0.7) return y < p.y ? C.bank : C.sand;
        if (hash(gx >> 1, y >> 1, 5) < 0.025) return C.lily;
        if ((y - p.y) % 4 === 0 && hash(gx >> 2, y, 6) < 0.35) return C.waterHi;
        return e < 0.3 ? C.water2 : C.water;
      }
    }
    for (i = 0; i < s.plats.length; i++) {
      var q = s.plats[i];
      a = (gx - q.x) / q.rx;
      if (a > -1 && a < 1) {
        var sq = Math.sqrt(1 - a * a), top = q.y - q.ry * sq, bot = q.y + q.ry * sq;
        if (y >= top && y <= bot) return y < top + 1 ? C.rim : hash(gx, y, 8) < 0.1 ? C.g1 : C.top;
        if (y > bot && y <= bot + q.cliff) {
          var k = Math.floor(y - bot);
          if (Math.abs(gx - q.x) < 4) return k % 2 ? C.stone2 : C.stone;
          if (k >= q.cliff) return C.cliffFoot;
          if (k % 3 === 0 || (gx + Math.floor(k / 3) * 3) % 6 === 0) return C.cliffLine;
          return hash(gx, y, 9) < 0.08 ? C.moss : hash(gx >> 2, k >> 2, 10) < 0.5 ? C.cliff : C.cliff2;
        }
      }
    }
    var d = Math.abs(gx - pc) + (hash(gx >> 1, y >> 1, 3) - 0.5) * 2;
    if (d < PATH) {
      var h = hash(gx, y, 4);
      return d > PATH - 1.2 ? C.dirtEdge : h < 0.04 ? C.pebble : h < 0.2 ? C.dirt2 : C.dirt;
    }
    var hx = hexOf(gx, y), hc = hexCentre(hx[0], hx[1]), bi = biome(s, hx[0], hx[1]);
    var lx = Math.abs(gx - hc[0]), ly = Math.abs(y - hc[1]), e2 = Math.max(lx, lx * 0.5 + ly * SQ3 / 2) / INR;
    var pal = BIOME[bi], n = vnoise(gx, y, 22, 1) + (bayer(gx, y) - 0.5) * 0.25, r = hash(gx, y, 2), col;
    if (bi === 'farm' && e2 < 0.86) col = (y + (hx[0] & 1) * 2) % 4 < 2 ? pal[0] : pal[2];
    else {
      if (r < (bi === 'hills' ? 0.006 : 0.014)) return C.blade;
      if (hash(gx, y + 1, 2) < 0.014 && bi !== 'hills') return C.bladeHi;
      if (r > 0.9965 && bi === 'meadow') return FLOWERS[Math.floor(hash(gx, y, 11) * 4)];
      col = n < 0.38 ? pal[2] : n < 0.62 ? pal[1] : pal[0];
    }
    // Dashed hex borders, as on a printed map.
    if (e2 > 1 - 1.3 / INR && ((gx + y) >> 1) & 1) return dash(col);
    return col;
  }
  var BIOME = {
    meadow: [C.g1, C.g2, C.g3],
    lake: [C.g1, C.g2, C.g3],
    forest: ['#9fc787', '#92bc7b', '#86b170'],
    hills: ['#c7c3ad', '#b9b59f', '#aba791'],
    farm: ['#e6d28a', '#d9c577', '#b9cf7e']
  };
  var dashes = {};
  function dash(c) { return dashes[c] || (dashes[c] = mix(c, '#3f4f3a', 0.22)); }

  function bake(s) {
    var c = document.createElement('canvas');
    c.width = s.w; c.height = s.h;
    var g = c.getContext('2d'), im = g.createImageData(s.w, s.h), D = im.data;
    for (var y = 0; y < s.h; y++) {
      var pc = s.pathX(y);
      for (var x = 0; x < s.w; x++) {
        var gx = s.x0 + x, din = s.left ? s.w - 1 - x : x;
        if (din < FADE && din / FADE < bayer(gx, y)) continue;
        var v = rgb(ground(s, gx, y, pc)), i = (y * s.w + x) * 4;
        D[i] = v[0]; D[i + 1] = v[1]; D[i + 2] = v[2]; D[i + 3] = 255;
      }
    }
    // Dotted trails from places to the road.
    s.trails.forEach(function (tr) {
      var dir = s.pathX(tr.y) > tr.x ? 1 : -1;
      for (var k = 0; k < 400; k += 4) {
        var x = tr.x + dir * k, y = Math.round(tr.y + Math.sin(k / 9) * 1.5);
        if (Math.abs(x - s.pathX(y)) < PATH + 1) break;
        for (var j = 0; j < 4; j++) {
          var lx = Math.round(x) - s.x0 + (j & 1), yy = y + (j >> 1), i = (yy * s.w + lx) * 4;
          if (lx >= 0 && lx < s.w && yy >= 0 && yy < s.h && D[i + 3]) { D[i] = 250; D[i + 1] = 248; D[i + 2] = 240; }
        }
      }
    });
    // Shadows under things that stand, a little to the lower right.
    s.objects.forEach(function (o) {
      if (!o.shadow || !o.spr) return;
      var rx = o.shadow, ry = Math.max(1.5, rx * 0.35);
      for (var y = Math.floor(o.Y - ry); y <= o.Y + ry; y++) for (var x = Math.floor(o.X + 1 - rx); x <= o.X + 1 + rx; x++) {
        var a = (x - o.X - 1) / rx, b = (y - o.Y) / ry, lx = x - s.x0;
        if (a * a + b * b > 1 || lx < 0 || lx >= s.w || y < 0 || y >= s.h) continue;
        var i = (y * s.w + lx) * 4;
        if (D[i + 3]) { D[i] *= 0.8; D[i + 1] *= 0.85; D[i + 2] *= 0.88; }
      }
    });
    g.putImageData(im, 0, 0);
    s.canvas = c;
  }

  // ---- Layout ---------------------------------------------------------------------
  var built = '';
  function pageHeight() { return Math.max(root.scrollHeight, document.body.scrollHeight, innerHeight); }
  function rebuild() {
    PW = root.clientWidth; PH = pageHeight();
    measureColumn();
    var key = [Math.round(colL / 4), Math.round(colR / 4), hasMargins, Math.round(PH / 40)].join();
    if (key === built) return;
    built = key;
    strips = [];
    parts = [];
    if (hasMargins) {
      var AH = Math.min(Math.ceil(PH / P), 16000), AW = Math.floor(PW / P);
      var L = Math.floor(colL / P), Rx = Math.ceil(colR / P);
      if (L >= 30) strips.push(makeStrip(0, L, AH, true));
      if (AW - Rx >= 30) strips.push(makeStrip(Rx, AW - Rx, AH, false));
    }
    if (still) draw();
  }
  var dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
    if (still) draw();
  }

  // ---- Life -----------------------------------------------------------------------
  var parts = [];
  function stepUnit(s, u, dt, mx, my) {
    if (u.pause > 0) u.pause -= dt;
    else {
      u.Y += u.dir * u.speed * dt;
      u.walk += dt * u.speed * 0.3;
      if (u.Y < 8) { u.Y = 8; u.dir = 1; } else if (u.Y > s.h - 4) { u.Y = s.h - 4; u.dir = -1; }
      if (Math.random() < dt / u.rest) u.pause = rnd(1.5, 5);
      if (Math.random() < dt / 150) u.dir = -u.dir;
    }
    if (u.side) {
      var dx = s.pathX(u.Y + u.dir * 4) - s.pathX(u.Y);
      if (Math.abs(dx) > 0.6) u.face = dx > 0 ? 0 : 1;
    }
    u.X = s.pathX(u.Y) + u.lane + u.off;
    var d = Math.hypot(u.X - mx, u.Y - (u.kind === 'balloon' ? 14 : 6) - my);
    if (u.kind === 'balloon') {
      // A balloon is nudged aside and floats back to the road.
      if (d < 14) u.ov += (u.X >= mx ? 1 : -1) * 80 * dt * (1 - d / 14);
      u.ov += -u.off * 2 * dt; u.ov *= Math.exp(-1.5 * dt);
      u.off = Math.max(-14, Math.min(14, u.off + u.ov * dt));
    } else if (d < 11 && u.hop <= 0) {
      u.hop = 0.45; u.pause = Math.max(u.pause, 1.2);            // a startled hop, then a look round
    }
    if (u.hop > 0) u.hop = Math.max(0, u.hop - dt);
  }

  function step(dt) {
    t += dt;
    var mx = mouse ? (mouse.x + scrollX) / P : -1e9, my = mouse ? (mouse.y + scrollY) / P : -1e9;
    var top = scrollY / P, bot = (scrollY + H) / P;
    strips.forEach(function (s) {
      s.units.forEach(function (u) { stepUnit(s, u, dt, mx, my); });
      s.clouds.forEach(function (c) {
        c.X += 2.4 * dt; c.Y += 0.8 * dt;
        if (c.X > s.x0 + s.w + 4) c.X = s.x0 - CLOUD.w - 4;
        if (c.Y > s.h) c.Y = -CLOUD.h;
      });
      // Petals from cherry trees and smoke from chimneys, for those in view.
      s.air.forEach(function (a) {
        a.Y += a.dir * 3 * dt;
        if (a.Y < 60) a.dir = 1; else if (a.Y > s.h - 10) a.dir = -1;
        a.X = s.pc + (s.hi - s.lo) * 0.3 * Math.sin(t * 0.04 + a.ph);
      });
      s.objects.forEach(function (o) {
        if (!o.spr || o.Y < top || o.Y - o.spr.h > bot || parts.length > 160) return;
        if (o.kind === 'cherry' && Math.random() < dt * 0.6)
          parts.push({ X: o.X + rnd(-7, 7), Y: o.Y - rnd(14, 24), vx: rnd(1, 4), vy: rnd(3, 6), life: 0, max: rnd(3, 5), c: pick(Math.random, LEAVES.cherry), smoke: false });
        if (o.spr.smoke && Math.random() < dt * 1.6)
          parts.push({ X: o.X - o.spr.w / 2 + o.spr.smoke[0] + 0.5, Y: o.Y - o.spr.h + 1 + o.spr.smoke[1], vx: rnd(1, 3), vy: -rnd(3, 5), life: 0, max: rnd(2.5, 3.5), c: '#eceae4', smoke: true });
      });
    });
    parts = parts.filter(function (q) {
      q.life += dt;
      q.X += (q.vx + (q.smoke ? 0 : Math.sin(q.life * 3 + q.max) * 3)) * dt; q.Y += q.vy * dt;
      return q.life < q.max;
    });
    if (Math.floor(t * 30) % 60 === 0) rebuild();
  }

  // ---- Drawing --------------------------------------------------------------------
  function blit(spr, X, Y, lift) {
    cx.drawImage(spr.c, Math.round(X - spr.w / 2) * P - scrollX, (Math.round(Y - lift) - spr.h + 1) * P - scrollY, spr.w * P, spr.h * P);
  }
  function drawUnit(u) {
    var lift = 0, spr;
    cx.fillStyle = C.shade;
    cx.globalAlpha = ALPHA * 0.22;
    cx.fillRect((Math.round(u.X) - 2) * P - scrollX, Math.round(u.Y) * P - scrollY, (u.side ? Math.round(u.spr[0][0].w * 0.5) : 5) * P, P);
    cx.globalAlpha = ALPHA;
    if (u.kind === 'balloon') {
      lift = 10 + Math.sin(t * 1.3 + u.seed) * 1.5;
      spr = u.spr;
    } else {
      if (u.hop > 0) lift = Math.sin(Math.PI * (1 - u.hop / 0.45)) * 4;
      var f = u.pause > 0 ? 0 : Math.floor(u.walk) % 2;
      spr = u.side ? u.spr[u.face][f] : u.spr[u.dir > 0 ? 0 : 1][f];
    }
    blit(spr, u.X, u.Y, lift);
  }
  function drawGlow(o) {
    var g = o.spr.glow, f = 0.5 + 0.3 * Math.sin(t * 5 + o.seed) + 0.15 * Math.sin(t * 13 + o.seed * 2);
    cx.globalAlpha = ALPHA * f;
    cx.fillStyle = '#fff6c8';
    cx.fillRect((Math.round(o.X - o.spr.w / 2) + g[0]) * P - scrollX, (o.Y - o.spr.h + 1 + g[1]) * P - scrollY, g[2] * P, g[3] * P);
    cx.globalAlpha = ALPHA;
  }

  function draw() {
    cx.clearRect(0, 0, W, H);
    if (!strips.length) return;
    cx.imageSmoothingEnabled = false;
    var top = scrollY / P, bot = (scrollY + H) / P;
    cx.globalAlpha = ALPHA;
    strips.forEach(function (s) {
      var y0 = Math.max(0, Math.floor(top) - 1), y1 = Math.min(s.h, Math.ceil(bot) + 1);
      if (y1 > y0) cx.drawImage(s.canvas, 0, y0, s.w, y1 - y0, s.x0 * P - scrollX, y0 * P - scrollY, s.w * P, (y1 - y0) * P);
    });
    strips.forEach(function (s) {
      var a = s.left ? s.x0 : s.x0 + FADE * 0.6, b = s.left ? s.x0 + s.w - FADE * 0.6 : s.x0 + s.w;
      cx.save();
      cx.beginPath(); cx.rect(a * P - scrollX, 0, (b - a) * P, H); cx.clip();
      cx.globalAlpha = ALPHA * 0.09;
      s.clouds.forEach(function (c) {
        if (c.Y + CLOUD.h > top && c.Y < bot)
          cx.drawImage(CLOUD.c, Math.round(c.X) * P - scrollX, Math.round(c.Y) * P - scrollY, CLOUD.w * P, CLOUD.h * P);
      });
      cx.restore();
    });
    cx.globalAlpha = ALPHA;
    var list = [];
    strips.forEach(function (s) {
      s.objects.forEach(function (o) { if (o.spr && o.Y + 2 > top && o.Y - o.spr.h < bot + 2) list.push(o); });
      s.units.forEach(function (u) { if (u.Y + 2 > top && u.Y - 26 < bot) list.push(u); });
    });
    list.sort(function (a, b) { return a.Y - b.Y; });
    list.forEach(function (o) {
      if (o.unit) drawUnit(o);
      else { blit(o.spr, o.X, o.Y, 0); if (o.spr.glow) drawGlow(o); }
    });
    // Balloons in the sky: shadow on the ground, balloon well above it.
    strips.forEach(function (s) {
      s.air.forEach(function (a) {
        if (a.Y < top - 10 || a.Y - 70 > bot) return;
        cx.globalAlpha = ALPHA * 0.18; cx.fillStyle = C.shade;
        cx.fillRect((Math.round(a.X) + 8) * P - scrollX, Math.round(a.Y) * P - scrollY, 7 * P, 2 * P);
        cx.globalAlpha = ALPHA;
        blit(AIR, a.X, a.Y, 44 + Math.sin(t * 0.8 + a.ph) * 2);
      });
    });
    cx.globalAlpha = ALPHA;
    // Map pins and name tags.
    cx.font = FONT; cx.textBaseline = 'top';
    strips.forEach(function (s) {
      var lo = (s.left ? s.x0 + 1 : s.x0 + FADE * 0.6) * P - scrollX, hi = (s.left ? s.x0 + s.w - FADE * 0.6 : s.x0 + s.w - 1) * P - scrollX;
      s.objects.forEach(function (o) {
        if (!o.label || o.ly < top - 10 || o.Y - 60 > bot) return;
        if (o.pin) blit(PIN, o.X, o.Y - o.spr.h - 1, Math.round(Math.abs(Math.sin(t * 2 + o.seed)) * 2));
        var tw = Math.ceil(cx.measureText(o.label).width), bw = tw + 8;
        var x = Math.max(lo, Math.min(hi - bw, Math.round(o.X * P - scrollX - bw / 2))), y = Math.round(o.ly * P - scrollY);
        cx.fillStyle = '#262a33'; cx.fillRect(x, y, bw, 12);
        cx.fillStyle = '#f5f2e8'; cx.fillText(o.label, x + 4, y + 2);
      });
    });
    parts.forEach(function (q) {
      var k = 1 - q.life / q.max;
      cx.globalAlpha = ALPHA * (q.smoke ? 0.55 * k : Math.min(1, k * 2));
      cx.fillStyle = q.c;
      var sz = q.smoke ? 1 + Math.floor((1 - k) * 3) : 1;
      cx.fillRect(Math.round(q.X - sz / 2) * P - scrollX, Math.round(q.Y) * P - scrollY, sz * P, sz * P);
    });
    cx.globalAlpha = 1;
  }

  resize();
  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(function () { rebuild(); }).observe(document.body);
  if (still) { addEventListener('scroll', draw, { passive: true }); draw(); return; }

  var last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min((now - last) / 1000, 0.1); last = now;
    if (acc >= 1 / 30) { step(acc); acc = 0; draw(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
