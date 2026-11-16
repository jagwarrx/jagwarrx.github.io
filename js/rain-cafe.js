// Rain Café: an ambience engine. It starts instantly with synthesized layers,
// then real recordings from the BBC Sound Effects archive (audio/) load and
// take over the beds and the events; synthesis stays as the fallback. Layers:
//   rain    hiss bed + low roar, gusts, thousands of droplet ticks, window
//           thumps, puddle plops, distant thunder
//   café    a speech-shaped babble bed plus a few formant voices in phrases, room
//           tone, cup and spoon clinks, the espresso machine, all through a
//           convolution reverb of a small tiled room
// The engine exposes tick(now) so a test can drive it against an
// OfflineAudioContext; live, a timer calls tick every 100 ms.
(function (global) {
  'use strict';

  function RainCafe(ctx) {
    this.ctx = ctx;
    this.params = { rain: 0.55, window: 0.6, thunder: true, crowd: 0.5, clatter: 0.5, espresso: true, inside: true, volume: 0.8 };
    this.nextEvents = { thunder: 8, espresso: 25 };
    this.build();
  }

  var P = RainCafe.prototype;
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var VOWELS = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [640, 1190, 2390], [440, 1020, 2240], [490, 1350, 1690], [390, 1990, 2550]];

  // ---- buffers -------------------------------------------------------
  P.noise = function (seconds, kind) {
    var ctx = this.ctx, n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0, i, w;
    for (i = 0; i < n; i++) {
      w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === 'pink') { last = 0.98 * last + 0.02 * w; d[i] = (last * 6 + w * 0.4) * 0.5; }
      else d[i] = w;
    }
    return b;
  };
  P.impulse = function (seconds, decay, stereo) {
    var ctx = this.ctx, n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, n, ctx.sampleRate), c, d, i, e;
    for (c = 0; c < 2; c++) {
      d = b.getChannelData(c);
      for (i = 0; i < n; i++) { e = Math.pow(1 - i / n, decay); d[i] = (Math.random() * 2 - 1) * e * (i < 400 ? i / 400 : 1); }
      // a few early reflections
      for (i = 0; i < 6; i++) { var at = Math.floor(rand(0.004, 0.05) * ctx.sampleRate); if (at < n) d[at] += rand(0.2, 0.5) * (c ? -1 : 1) * (stereo ? rand(0.6, 1) : 1); }
    }
    return b;
  };
  P.loopSource = function (buffer) { var s = this.ctx.createBufferSource(); s.buffer = buffer; s.loop = true; s.start(); return s; };
  P.filter = function (type, f, q, gain) { var b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (gain != null) b.gain.value = gain; return b; };
  P.gain = function (v) { var g = this.ctx.createGain(); g.gain.value = v; return g; };

  // ---- graph ---------------------------------------------------------
  P.build = function () {
    var ctx = this.ctx, self = this;
    this.white = this.noise(3, 'white');
    this.brown = this.noise(4, 'brown');
    this.pink = this.noise(3, 'pink');
    this.tickBuf = this.noise(0.03, 'white');

    this.master = this.gain(0);
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.knee.value = 12; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
    this.master.connect(this.comp).connect(ctx.destination);

    // room reverb: small tiled café, ~1.3 s
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(1.3, 3.2, true);
    this.verbGain = this.gain(0.35);
    this.verb.connect(this.verbGain).connect(this.master);

    // ---------- rain ----------
    this.rainOut = this.gain(0);
    this.rainTone = this.filter('lowpass', 9000, 0.5);        // becomes a window when "inside"
    this.rainOut.connect(this.rainTone).connect(this.master);
    this.rainVerbSend = this.gain(0.15); this.rainTone.connect(this.rainVerbSend).connect(this.verb);

    var hiss = this.loopSource(this.white);
    this.hissG = this.gain(0);
    hiss.connect(this.filter('highpass', 1500, 0.7)).connect(this.filter('lowpass', 8000, 0.5)).connect(this.filter('peaking', 4200, 1, 4)).connect(this.hissG).connect(this.rainOut);

    var roar = this.loopSource(this.pink);
    this.roarG = this.gain(0);
    roar.connect(this.filter('bandpass', 420, 0.5)).connect(this.roarG).connect(this.rainOut);

    this.dropBus = this.gain(1); this.dropBus.connect(this.rainOut);
    this.thumpBus = this.gain(1); this.thumpBus.connect(this.filter('lowpass', 900, 0.7)).connect(this.master);

    this.thunderBus = this.gain(1);
    this.thunderBus.connect(this.filter('lowpass', 160, 0.8)).connect(this.master);
    this.thunderBus.connect(this.gain(0.4)).connect(this.verb);

    this.gust = 1; this.gustTarget = 1;

    // ---------- café ----------
    this.cafeOut = this.gain(0); this.cafeOut.connect(this.master);
    this.cafeVerbSend = this.gain(0.5); this.cafeOut.connect(this.cafeVerbSend).connect(this.verb);

    var room = this.loopSource(this.brown);
    this.roomG = this.gain(0);
    room.connect(this.filter('lowpass', 260, 0.6)).connect(this.roomG).connect(this.cafeOut);
    var air = this.loopSource(this.pink);
    this.airG = this.gain(0);
    air.connect(this.filter('bandpass', 2400, 0.4)).connect(this.airG).connect(this.cafeOut);

    this.voiceBus = this.gain(1);
    this.voiceBus.connect(this.filter('lowpass', 2400, 0.5)).connect(this.filter('highpass', 180, 0.7)).connect(this.cafeOut);
    // babble bed: distant chatter is many overlapping voices, which sums to
    // noise shaped like speech and modulated at syllable rate
    this.babbleG = this.gain(0); this.babbleG.connect(this.voiceBus);
    this.babble = [];
    var bands = [320, 520, 800, 1150, 1700, 2500];
    for (var b = 0; b < bands.length; b++) {
      var src = ctx.createBufferSource(); src.buffer = this.pink; src.loop = true; src.start(0, b * 0.37);
      var bp = this.filter('bandpass', bands[b], 2.2), g = this.gain(0.3), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = (b % 2 ? 1 : -1) * rand(0.2, 0.7); src.connect(bp).connect(g).connect(pan).connect(this.babbleG); }
      else src.connect(bp).connect(g).connect(this.babbleG);
      this.babble.push({ g: g, next: 0, swell: 1 });
    }
    this.voices = [];
    for (var i = 0; i < 6; i++) this.voices.push(this.makeVoice(i));

    this.clinkBus = this.gain(1); this.clinkBus.connect(this.cafeOut);
    this.machineBus = this.gain(1); this.machineBus.connect(this.cafeOut);
    this.machineBus.connect(this.gain(0.3)).connect(this.verb);

    this.lastTick = ctx.currentTime;
    this.apply();
  };

  P.makeVoice = function (i) {
    var ctx = this.ctx, female = i % 3 === 1, v = {};
    v.base = female ? rand(170, 225) : rand(95, 135);
    v.osc = ctx.createOscillator(); v.osc.type = 'sawtooth'; v.osc.frequency.value = v.base;
    v.glottis = this.filter('lowpass', 700, 0.7);     // keep only the low harmonics, like a real voice through a room
    v.oscG = this.gain(0.35); v.osc.connect(v.glottis).connect(v.oscG);
    v.breath = ctx.createBufferSource(); v.breath.buffer = this.pink; v.breath.loop = true; v.breath.start(0, i * 0.61);
    v.breathG = this.gain(0.7); v.breath.connect(v.breathG);
    v.formants = []; v.mix = this.gain(1);
    for (var f = 0; f < 3; f++) {
      var bp = this.filter('bandpass', VOWELS[0][f], 5), g = this.gain(f === 0 ? 1 : f === 1 ? 0.6 : 0.3);
      v.oscG.connect(bp); v.breathG.connect(bp); bp.connect(g).connect(v.mix);
      v.formants.push(bp);
    }
    v.syll = this.gain(0);                      // syllable envelope
    v.level = this.gain(0);                     // on/off per voice (crowd size)
    v.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (v.pan) v.pan.pan.value = rand(-0.8, 0.8);
    v.mix.connect(this.filter('lowpass', 1900, 0.6)).connect(v.syll).connect(v.level);
    if (v.pan) v.level.connect(v.pan).connect(this.voiceBus); else v.level.connect(this.voiceBus);
    v.osc.start();
    v.talking = false; v.until = ctx.currentTime + rand(0, 6); v.nextSyll = 0;
    return v;
  };

  // ---- parameters ----------------------------------------------------
  P.set = function (name, value) { this.params[name] = value; this.apply(); };
  P.apply = function () {
    var p = this.params, t = this.ctx.currentTime, r = p.rain, c = p.crowd;
    var ramp = function (param, v, s) { param.cancelScheduledValues(t); param.setTargetAtTime(v, t, s || 0.4); };
    ramp(this.master.gain, this.running ? p.volume * 0.9 : 0, 0.3);
    var rec = !!this.samples, syn = rec ? 0 : 1;
    if (rec) {
      var L = this.loops, rl = r > 0 ? 0.1 + 0.6 * r : 0, cq = 1.2 * Math.min(1, c * 3) * Math.sqrt(1 - c), cb = 1.2 * Math.sqrt(c);
      ramp(L.rainIn.out.gain, p.inside ? rl : 0, 1.2); ramp(L.rainOut.out.gain, p.inside ? 0 : rl, 1.2);
      ramp(L.cafeQuiet.out.gain, cq, 1.2); ramp(L.cafeBusy.out.gain, cb, 1.2);
    }
    // rain: hiss grows with intensity, roar only with heavy rain; inside, the glass takes the top off
    ramp(this.rainOut.gain, r > 0 ? 0.25 + 0.6 * r : 0);
    ramp(this.hissG.gain, syn * (0.10 + 0.45 * r));
    ramp(this.roarG.gain, syn * 0.25 * Math.max(0, r - 0.35) / 0.65);
    ramp(this.rainTone.frequency, rec ? 2500 + 6500 * r : p.inside ? 1600 + 900 * r : 9000, 0.6);
    ramp(this.rainVerbSend.gain, rec ? 0 : p.inside ? 0.05 : 0.2);
    // café
    ramp(this.cafeOut.gain, c > 0 || p.clatter > 0 || p.espresso ? 0.9 : 0);
    ramp(this.cafeVerbSend.gain, rec ? 0.08 : 0.5);
    ramp(this.roomG.gain, syn * 0.12);
    ramp(this.airG.gain, syn * (0.01 + 0.02 * c));
    ramp(this.babbleG.gain, syn * 8 * Math.pow(c, 0.7), 1);
    var n = Math.round(c * this.voices.length);
    for (var i = 0; i < this.voices.length; i++) ramp(this.voices[i].level.gain, i < n && !rec ? 0.25 : 0, 1.5);
  };

  P.start = function () {
    if (this.running) return;
    this.running = true;
    if (this.ctx.resume) this.ctx.resume();
    this.apply();
    var self = this;
    if (!this.timer) this.timer = setInterval(function () { self.tick(self.ctx.currentTime); }, 100);
  };
  P.stop = function () {
    this.running = false; this.apply();
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  };

  // ---- scheduler: called every ~100 ms with the context time -----------
  P.tick = function (now) {
    var dt = Math.min(0.5, now - this.lastTick); this.lastTick = now;
    if (!this.running || dt <= 0) return;
    var horizon = now + 0.25, p = this.params, r = p.rain, rec = !!this.samples;
    if (rec) { for (var k in this.loops) this.loops[k].tick(now, horizon + 1); }

    // gusts: a slow random walk that scales the droplet rate and the hiss
    if (Math.random() < 0.06) this.gustTarget = rand(0.7, 1.35);
    this.gust += (this.gustTarget - this.gust) * Math.min(1, dt * 0.6);
    this.hissG.gain.setTargetAtTime((0.10 + 0.45 * r) * (0.8 + 0.2 * this.gust), now, 0.5);

    if (r > 0 && !rec) {
      var drops = (6 + 110 * r * r) * this.gust * dt;   // ticks per second at this intensity
      var k = Math.floor(drops + Math.random());
      for (var i = 0; i < k && i < 40; i++) this.droplet(rand(now, horizon));
      var thumps = (p.inside ? 1 : 0.3) * p.window * (0.5 + 5 * r) * dt;
      if (Math.random() < thumps) this.thump(rand(now, horizon), r);
      if (Math.random() < (0.3 + 2 * r) * dt) this.plop(rand(now, horizon));
    }
    if (p.thunder && r > 0.25 && now > this.nextEvents.thunder) { this.thunder(now + 0.1, r); this.nextEvents.thunder = now + rand(25, 75) / r; }

    // babble: each band flickers at syllable rate under a slow swell
    var self = this;
    this.babble.forEach(function (b) {
      if (rec) { b.next = horizon; return; }
      while (b.next < horizon) {
        if (Math.random() < 0.08) b.swell = rand(0.35, 1);
        var at = Math.max(b.next, now), len = rand(0.08, 0.22);
        b.g.gain.setTargetAtTime(rand(0.15, 1) * b.swell * 0.3, at, 0.03);
        b.g.gain.setTargetAtTime(0.05 * b.swell, at + len * 0.7, 0.05);
        b.next = at + len + (Math.random() < 0.2 ? rand(0.1, 0.4) : 0);
      }
    });
    // voices: phrases of talking with syllables
    this.voices.forEach(function (v, i) {
      if (rec || (v.level.gain.value <= 0.0001 && !v.talking)) return;
      if (now > v.until) {
        v.talking = !v.talking;
        v.until = now + (v.talking ? rand(1.2, 5) : rand(1.5, 9) / (0.4 + p.crowd));
        if (!v.talking) v.syll.gain.setTargetAtTime(0, now, 0.08);
        v.nextSyll = now;
      }
      while (v.talking && v.nextSyll < horizon) self.syllable(v, v.nextSyll);
    });

    // clinks and the machine
    var clat = rec ? 0 : p.clatter * (0.3 + p.crowd);
    if (Math.random() < clat * 0.35 * dt) this.clink(rand(now, horizon));
    if (Math.random() < clat * 0.12 * dt) this.setDown(rand(now, horizon));
    if (p.espresso && now > this.nextEvents.espresso) { this.espresso(now + 0.1); this.nextEvents.espresso = now + rand(35, 110); }
  };

  // ---- rain events ---------------------------------------------------
  P.droplet = function (t) {
    var ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.tickBuf;
    var f = this.filter('bandpass', rand(2200, 9000), rand(4, 14)), g = this.gain(0);
    var a = rand(0.05, 0.5) * (0.4 + 0.6 * this.params.rain), d = rand(0.004, 0.03);
    g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f).connect(g).connect(this.dropBus); s.start(t); s.stop(t + d + 0.01);
  };
  P.thump = function (t, r) {                  // a drop hitting the glass or the roof
    var ctx = this.ctx, o = ctx.createOscillator(), g = this.gain(0), f0 = rand(70, 160);
    o.frequency.setValueAtTime(f0 * 1.6, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.03);
    g.gain.setValueAtTime(rand(0.15, 0.5) * (0.5 + r), t); g.gain.exponentialRampToValueAtTime(0.001, t + rand(0.05, 0.11));
    o.connect(g).connect(this.thumpBus); o.start(t); o.stop(t + 0.15);
    var s = ctx.createBufferSource(); s.buffer = this.tickBuf; var lp = this.filter('lowpass', 1500, 1), g2 = this.gain(0.4);
    g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    s.connect(lp).connect(g2).connect(this.thumpBus); s.start(t); s.stop(t + 0.03);
  };
  P.plop = function (t) {                      // drop into a puddle: a rising blip
    var ctx = this.ctx, o = ctx.createOscillator(), g = this.gain(0), f0 = rand(500, 1400);
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rand(0.03, 0.12), t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g).connect(this.dropBus); o.start(t); o.stop(t + 0.08);
  };
  P.thunder = function (t, r) {
    var ctx = this.ctx, self = this, dist = Math.random() < 0.3 ? rand(0.05, 0.3) : rand(0.3, 1);   // 0 close, 1 far
    var delay = 0.15 + dist * 4.5, at = t + delay, dur = rand(3, 8) + dist * 3, peak = (1.1 - dist * 0.7) * (0.5 + r);
    if (this.onLightning) this.onLightning(t, 1 - dist);
    if (this.samples) {
      var b = this.samples, roll = [b.thunder1, b.thunder2, b.thunder3][Math.floor(Math.random() * 3)];
      if (dist < 0.4) this.oneShot(roll, at, (1.3 - dist) * (0.5 + r), this.master, rand(-0.3, 0.3));
      else this.oneShot(b.thunderFar, at, 0.9 * (0.5 + r), this.master, rand(-0.5, 0.5));
      return;
    }
    if (dist < 0.3) {                          // the crack of a near strike
      var c = ctx.createBufferSource(); c.buffer = this.white; c.loop = true;
      var cl = this.filter('lowpass', 2800, 0.7), cg = this.gain(0);
      cg.gain.setValueAtTime(0, at); cg.gain.linearRampToValueAtTime(0.9, at + 0.01); cg.gain.exponentialRampToValueAtTime(0.001, at + rand(0.25, 0.6));
      c.connect(cl).connect(cg).connect(this.master); c.start(at); c.stop(at + 0.7);
      this.master.gain.setValueAtTime(this.master.gain.value, at); this.master.gain.setTargetAtTime(this.params.volume * 0.9, at + 0.05, 0.3);
    }
    var s = ctx.createBufferSource(); s.buffer = this.brown; s.loop = true;
    var g = this.gain(0), mod = this.gain(1);
    var lfo = ctx.createOscillator(), lfoG = this.gain(0.5); lfo.frequency.value = rand(0.6, 2.4); lfo.connect(lfoG).connect(mod.gain);
    var lfo2 = ctx.createOscillator(), lfo2G = this.gain(0.25); lfo2.frequency.value = rand(3, 7); lfo2.connect(lfo2G).connect(mod.gain);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + (dist < 0.3 ? 0.08 : rand(0.3, 1.2)));
    g.gain.exponentialRampToValueAtTime(peak * 0.35, at + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    s.connect(mod).connect(g).connect(this.thunderBus); s.start(at); s.stop(at + dur + 0.1);
    lfo.start(at); lfo.stop(at + dur + 0.1); lfo2.start(at); lfo2.stop(at + dur + 0.1);
  };

  // ---- café events ---------------------------------------------------
  P.syllable = function (v, t) {
    var vow = VOWELS[Math.floor(Math.random() * VOWELS.length)], len = rand(0.12, 0.26), i;
    for (i = 0; i < 3; i++) v.formants[i].frequency.setTargetAtTime(vow[i] * (v.base > 160 ? 1.15 : 1), t, 0.03);
    v.osc.frequency.setTargetAtTime(v.base * rand(0.93, 1.1), t, 0.08);
    var peak = rand(0.5, 1) * (Math.random() < 0.15 ? 0.3 : 1);
    v.syll.gain.setTargetAtTime(peak, t, 0.035);
    v.syll.gain.setTargetAtTime(0.12, t + len * 0.65, 0.05);
    v.nextSyll = t + len + (Math.random() < 0.18 ? rand(0.15, 0.45) : 0);   // pauses between words
  };
  P.clink = function (t) {                     // spoon on cup: inharmonic partials
    var ctx = this.ctx, f = rand(1900, 3600), parts = [1, 2.71, 5.15, 7.4], out = this.gain(rand(0.06, 0.2));
    if (ctx.createStereoPanner) { var pan = ctx.createStereoPanner(); pan.pan.value = rand(-0.7, 0.7); out.connect(pan).connect(this.clinkBus); } else out.connect(this.clinkBus);
    for (var i = 0; i < parts.length; i++) {
      var o = ctx.createOscillator(), g = this.gain(0); o.frequency.value = f * parts[i] * rand(0.995, 1.005);
      g.gain.setValueAtTime(1 / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.001, t + rand(0.12, 0.5) / (1 + i * 0.6));
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.6);
    }
    if (Math.random() < 0.5) this.clink(t + rand(0.08, 0.25));   // a second tap, quieter
  };
  P.setDown = function (t) {                   // cup meeting saucer: thud plus rattle
    var ctx = this.ctx, o = ctx.createOscillator(), g = this.gain(0);
    o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.04);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g).connect(this.clinkBus); o.start(t); o.stop(t + 0.1);
    var s = ctx.createBufferSource(); s.buffer = this.tickBuf; var bp = this.filter('bandpass', 3200, 2), g2 = this.gain(0);
    g2.gain.setValueAtTime(0.12, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(bp).connect(g2).connect(this.clinkBus); s.start(t); s.stop(t + 0.06);
  };
  P.espresso = function (t) {                  // knock the portafilter, grind, then the steam wand
    var ctx = this.ctx, self = this, k;
    if (this.samples) {
      var b = this.samples, clip = [b.espresso1, b.espresso2, b.espresso3][Math.floor(Math.random() * 3)];
      this.oneShot(clip, t, 0.55, this.cafeOut, rand(0.2, 0.6));
      return;
    }
    for (k = 0; k < 2; k++) (function (tk) {
      var s = ctx.createBufferSource(); s.buffer = self.tickBuf; var lp = self.filter('lowpass', 500, 2), g = self.gain(0);
      g.gain.setValueAtTime(0.6, tk); g.gain.exponentialRampToValueAtTime(0.001, tk + 0.06);
      s.connect(lp).connect(g).connect(self.machineBus); s.start(tk); s.stop(tk + 0.07);
    })(t + k * 0.35);
    var g0 = t + 1.2, gl = rand(4, 7);
    var grind = ctx.createBufferSource(); grind.buffer = this.white; grind.loop = true;
    var gb = this.filter('bandpass', 380, 3), gg = this.gain(0), buzz = ctx.createOscillator(), bz = this.filter('lowpass', 700, 1), bg = this.gain(0);
    buzz.type = 'sawtooth'; buzz.frequency.value = 58;
    gg.gain.setValueAtTime(0, g0); gg.gain.linearRampToValueAtTime(0.35, g0 + 0.15); gg.gain.setValueAtTime(0.35, g0 + gl - 0.2); gg.gain.linearRampToValueAtTime(0, g0 + gl);
    bg.gain.setValueAtTime(0, g0); bg.gain.linearRampToValueAtTime(0.08, g0 + 0.15); bg.gain.setValueAtTime(0.08, g0 + gl - 0.2); bg.gain.linearRampToValueAtTime(0, g0 + gl);
    grind.connect(gb).connect(gg).connect(this.machineBus); buzz.connect(bz).connect(bg).connect(this.machineBus);
    grind.start(g0); grind.stop(g0 + gl + 0.1); buzz.start(g0); buzz.stop(g0 + gl + 0.1);
    var s0 = g0 + gl + rand(1.5, 3), sl = rand(3, 6);
    var steam = ctx.createBufferSource(); steam.buffer = this.white; steam.loop = true;
    var sb = this.filter('bandpass', 4200, 0.9), sg = this.gain(0), trem = ctx.createOscillator(), tg = this.gain(0.35), tm = this.gain(1);
    trem.frequency.value = rand(9, 14); trem.connect(tg).connect(tm.gain);
    sg.gain.setValueAtTime(0, s0); sg.gain.linearRampToValueAtTime(0.5, s0 + 0.3); sg.gain.setValueAtTime(0.5, s0 + sl - 0.4); sg.gain.linearRampToValueAtTime(0, s0 + sl);
    steam.connect(sb).connect(tm).connect(sg).connect(this.machineBus);
    steam.start(s0); steam.stop(s0 + sl + 0.1); trem.start(s0); trem.stop(s0 + sl + 0.1);
  };

  // ---- recorded layer -------------------------------------------------
  // Long recordings loop with a crossfade so the seam never shows; one-shots
  // (thunder, espresso) are scheduled by the same brain as the synthesis.
  function Loop(engine, buffer, dest) {
    this.e = engine; this.buf = buffer; this.xf = 2.5; this.next = -1;
    this.out = engine.gain(0); this.out.connect(dest);
  }
  Loop.prototype.tick = function (now, horizon) {
    if (this.next < now - 0.5) this.next = now;              // (re)start cleanly
    while (this.next < horizon) { this.play(this.next); this.next += this.buf.duration - this.xf; }
  };
  Loop.prototype.play = function (t) {
    var ctx = this.e.ctx, s = ctx.createBufferSource(), g = this.e.gain(0), d = this.buf.duration, xf = this.xf;
    s.buffer = this.buf; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + xf);
    g.gain.setValueAtTime(1, t + d - xf); g.gain.linearRampToValueAtTime(0, t + d);
    s.connect(g).connect(this.out); s.start(t); s.stop(t + d + 0.05);
  };

  var SAMPLE_FILES = { rainIn: 'rain-window', rainOut: 'rain-outside', cafeQuiet: 'cafe-quiet', cafeBusy: 'cafe-busy',
    thunder1: 'thunder-1', thunder2: 'thunder-2', thunder3: 'thunder-3', thunderFar: 'thunder-far',
    espresso1: 'espresso-1', espresso2: 'espresso-2', espresso3: 'espresso-3' };

  P.loadSamples = function (base, done) {
    var self = this, ctx = this.ctx, keys = Object.keys(SAMPLE_FILES), got = {}, left = keys.length, failed = false;
    if (!global.fetch || !ctx.decodeAudioData) { done(false); return; }
    keys.forEach(function (k) {
      fetch(base + SAMPLE_FILES[k] + '.mp3').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
        .then(function (buf) { got[k] = buf; }, function () { failed = true; })
        .then(function () { if (--left === 0) { if (failed) done(false); else { self.useSamples(got); done(true); } } });
    });
  };
  P.useSamples = function (b) {
    this.samples = b;
    this.loops = {
      rainIn: new Loop(this, b.rainIn, this.rainOut), rainOut: new Loop(this, b.rainOut, this.rainOut),
      cafeQuiet: new Loop(this, b.cafeQuiet, this.cafeOut), cafeBusy: new Loop(this, b.cafeBusy, this.cafeOut)
    };
    this.apply();
  };
  P.oneShot = function (buffer, t, level, dest, pan) {
    var ctx = this.ctx, s = ctx.createBufferSource(), g = this.gain(level); s.buffer = buffer;
    if (pan != null && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pan; s.connect(g).connect(p).connect(dest); }
    else s.connect(g).connect(dest);
    s.start(t); s.stop(t + buffer.duration + 0.1);
  };

  global.RainCafe = RainCafe;

  // ---- the floating audio button --------------------------------------
  // Injected on any page that loads this script: a speaker button at the
  // bottom right that toggles the ambience, with a small mix panel.
  var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.createElement('div');
  root.className = 'rain-cafe';
  root.innerHTML =
    '<div class="rc-panel" hidden>' +
      '<label><span>Rain <output data-out="rain"></output></span><input type="range" min="0" max="100" value="55" data-param="rain"></label>' +
      '<label><span>Café <output data-out="crowd"></output></span><input type="range" min="0" max="100" value="50" data-param="crowd"></label>' +
      '<label><span>Volume <output data-out="volume"></output></span><input type="range" min="0" max="100" value="80" data-param="volume"></label>' +
      '<label class="rc-check"><input type="checkbox" checked data-param="thunder"> Thunder and lightning</label>' +
      '<label class="rc-check"><input type="checkbox" checked data-param="inside"> Heard through the window</label>' +
      '<label class="rc-check"><input type="checkbox" checked data-param="espresso"> Espresso machine</label>' +
      '<small class="rc-src">synthesized</small>' +
    '</div>' +
    '<button class="rc-btn" type="button" data-play aria-pressed="false" title="Rain and coffee shop ambience">' +
      '<svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" shape-rendering="crispEdges">' +
        '<path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/>' +
        '<path class="rc-w1" d="M11 6v4" stroke="currentColor" stroke-width="1.5"/>' +
        '<path class="rc-w2" d="M13 4v8" stroke="currentColor" stroke-width="1.5"/>' +
      '</svg><span class="rc-label">Rain café</span></button>';
  document.body.appendChild(root);

  var engine = null, playBtn = root.querySelector('[data-play]'), panel = root.querySelector('.rc-panel');
  function label(name, v) {
    if (name === 'rain') return v === 0 ? 'off' : v < 0.3 ? 'drizzle' : v < 0.6 ? 'steady' : v < 0.85 ? 'heavy' : 'downpour';
    if (name === 'crowd') return v === 0 ? 'empty' : v < 0.3 ? 'a few tables' : v < 0.7 ? 'half full' : 'busy';
    return Math.round(v * 100) + '%';
  }
  function push(el) {
    var name = el.getAttribute('data-param');
    var v = el.type === 'checkbox' ? el.checked : el.value / 100;
    var out = root.querySelector('[data-out="' + name + '"]');
    if (out) out.textContent = label(name, v);
    if (engine) engine.set(name, v);
  }
  function ensure() {
    if (engine) return engine;
    var AC = global.AudioContext || global.webkitAudioContext;
    engine = new RainCafe(new AC());
    engine.onLightning = function (t, strength) {
      if (reduced) return;
      var wait = Math.max(0, (t - engine.ctx.currentTime) * 1000);
      setTimeout(function () { flash(strength); }, wait);
    };
    root.querySelectorAll('[data-param]').forEach(push);
    var src = root.querySelector('.rc-src'), me = document.currentScript || document.querySelector('script[src*="rain-cafe"]');
    var base = me && me.src ? me.src.replace(/js\/rain-cafe\.js.*$/, 'audio/') : 'audio/';
    src.textContent = 'loading recordings\u2026';
    engine.loadSamples(base, function (ok) { src.textContent = ok ? 'BBC archive recordings' : 'synthesized (recordings unavailable)'; });
    return engine;
  }
  function flash(strength) {
    var h = document.documentElement, n = strength > 0.6 ? 3 : 2, i = 0;
    h.style.setProperty('--rc-flash', String(0.55 + 0.45 * strength));
    (function step() {
      h.classList.toggle('rc-lightning', i % 2 === 0);
      if (++i < n * 2) setTimeout(step, i % 2 ? rand(40, 90) : rand(60, 140));
    })();
  }
  root.querySelectorAll('[data-param]').forEach(function (el) { el.addEventListener('input', function () { push(el); }); push(el); });
  playBtn.addEventListener('click', function () {
    var e = ensure();
    if (e.running) { e.stop(); root.classList.remove('playing'); panel.hidden = true; playBtn.setAttribute('aria-pressed', 'false'); }
    else { e.start(); root.classList.add('playing'); panel.hidden = false; playBtn.setAttribute('aria-pressed', 'true'); }
  });
  document.addEventListener('click', function (e) { if (!root.contains(e.target) && engine && engine.running) panel.hidden = true; });
  playBtn.addEventListener('contextmenu', function (e) { e.preventDefault(); if (engine && engine.running) panel.hidden = !panel.hidden; });
})(window);
