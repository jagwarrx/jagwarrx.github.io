// extras.js: turns the local chess-app (db_02, May 2026) into a browser-only tool and adds the best ideas
// from Hari's other chess analyzers:
//  - Claude calls go straight to Anthropic with the visitor's own key (../claude.js), not a local server.
//  - "Your read first" before the Socratic coach: commit a candidate and a plan, then get questioned
//    (chess-trainer's predict-then-reveal loop and its Socratic prompt, with the concede rule).
//  - Grounded facts in every prompt: piece list, loose pieces with attacker and defender counts,
//    detected tactics, the engine line. Claude has no board vision, so it is told to use only these.
//  - Coach review of the whole game: three lessons, credit, homework, phase scores, a progress check
//    against earlier reviewed games, and one takeaway (chess-trainer COACH, PROGRESS, TAKEAWAY).
//  - Rating-aware prompts (chess-coach's rating tiers), set in Settings.
//  - My games: a Lichess username lists recent games to load in one click.
//  - Lichess cloud eval for positions without engine analysis.
//  - Settings: key, model, rating, username, export and import of everything saved.
// The original app's functions are global, so the overrides here replace them by name.
(function () {
  var S = window.ChessStore;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc2 = function (s) { return Claude.esc(s == null ? '' : s); };

  // ---- Settings ---------------------------------------------------------------------------------
  function rating() { return +S.get('rating', 1100) || 1100; }
  function username() { return S.get('user', ''); }
  function pColor() { return playerSide === 'white' ? 'White' : 'Black'; }

  var TIERS = [
    { max: 1000, label: 'under 1000', focus: ['pieces left hanging in one move', 'checking his checks, captures and threats before every move', 'developing pieces and castling before attacking'], ignore: 'Skip deep positional ideas (minority attacks, prophylaxis, pawn-structure theory).' },
    { max: 1200, label: '1000 to 1200', focus: ['one-move blunders, still the main cause of losses', 'two-move tactics: a fork after an exchange, a discovered attack, removing the defender', 'the safety scan (checks, captures, threats, and his reply) before every move', 'knights to the centre, rooks to open files'], ignore: 'Skip deep positional ideas unless the game turns on one.' },
    { max: 1500, label: '1200 to 1500', focus: ['two- and three-move combinations for both sides', 'trading down when ahead', 'a plan with a target (a weak pawn, a weak square, the king)', 'pawn structure basics: isolated, doubled, passed pawns', 'using the clock on the critical moves'], ignore: 'Mention deep strategy only when it decided the game.' },
    { max: 1800, label: '1500 to 1800', focus: ['prophylaxis: what does he want, and stop it', 'improving the worst-placed piece', 'pawn breaks and when to open the position', 'endgame technique: king activity, rook behind the passed pawn'], ignore: '' },
    { max: 9999, label: '1800 and up', focus: ['calculating forcing lines to the end', 'reading imbalances and choosing the plan that fits', 'converting small edges'], ignore: '' }
  ];
  function tier() { var r = rating(); return TIERS.filter(function (t) { return r < t.max; })[0]; }
  function tierText() {
    var t = tier();
    return 'Rating ' + rating() + ' (' + t.label + '). At this level focus on: ' + t.focus.join('; ') + '.' + (t.ignore ? ' ' + t.ignore : '');
  }

  // ---- Styles for the new pieces ---------------------------------------------------------------
  var css = document.createElement('style');
  css.textContent = [
    '.hx-pop{position:absolute;right:8px;top:30px;z-index:50;width:360px;max-height:80vh;overflow:auto;background:#fff;border:1px solid var(--c-border);box-shadow:0 8px 24px rgba(0,0,0,.18);padding:10px;display:flex;flex-direction:column;gap:8px;font-size:var(--fs-base)}',
    '.hx-pop h4{margin:0;font-size:var(--fs-md);font-weight:600}',
    '.hx-pop label{display:flex;flex-direction:column;gap:2px;font-size:var(--fs-sm);color:var(--c-text-secondary)}',
    '.hx-pop .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '.hx-pop .note{font-size:var(--fs-sm);color:var(--c-text-muted);margin:0}',
    '.keybox{display:flex;flex-direction:column;gap:6px;padding:8px;background:#f7f7f7;border:1px solid var(--c-border-light)}',
    '.keybox input[type=password]{font-family:var(--font);font-size:var(--fs-base);padding:2px 4px;border:1px solid var(--c-border);flex:1;min-width:150px}',
    '.keybox select{font-family:var(--font);font-size:var(--fs-sm)}',
    '.kb-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.kb-label{font-weight:600}',
    '.kb-ok{color:var(--c-confirm);font-weight:600}.kb-dim,.kb-note{color:var(--c-text-muted);font-size:var(--fs-sm);margin:0}',
    '.hx-pop label.kb-check{flex-direction:row;color:var(--c-text)}.hx-pop label.kb-label{color:var(--c-text)}',
    '.kb-check{display:flex;gap:4px;align-items:center;font-size:var(--fs-sm)}.kb-err{color:var(--c-danger);margin:0}',
    '.kb-link{font:inherit;font-size:var(--fs-sm);border:0;background:none;padding:0;color:#00c;cursor:pointer;text-decoration:underline}',
    '.keybox .btn{height:auto;padding:1px 8px}',
    '.hx-games{display:flex;flex-direction:column}',
    '.hx-game{display:grid;grid-template-columns:14px 1fr auto;gap:6px;padding:4px 2px;border-bottom:1px solid var(--c-border-faint);cursor:pointer;align-items:baseline}',
    '.hx-game:hover{background:var(--c-selected)}',
    '.hx-res{font-weight:700}.hx-res.w{color:var(--c-confirm)}.hx-res.l{color:var(--c-danger)}.hx-res.d{color:var(--c-text-muted)}',
    '.hx-sub{font-size:var(--fs-xs);color:var(--c-text-muted)}',
    '.hx-read textarea{width:100%;font-family:var(--font);font-size:var(--fs-base);min-height:70px;padding:4px;border:1px solid var(--c-border)}',
    '.hx-read p{margin:0 0 6px}',
    '.hx-cloud{margin-top:6px;padding:4px 6px;border:1px dashed var(--c-border-light);font-size:var(--fs-sm);color:var(--c-text-secondary)}',
    '.chat-text table{border-collapse:collapse;margin:4px 0;font-size:var(--fs-sm)}.chat-text th,.chat-text td{border:1px solid var(--c-border-light);padding:2px 5px;text-align:left}',
    '.chat-text ol{margin:2px 0 4px;padding-left:16px}.chat-text h4,.chat-text h5{font-size:var(--fs-base);margin:6px 0 3px}',
    '.hx-hist .lib-card{cursor:pointer}',
    '.panel-ai .panel-hdr{height:auto;min-height:22px;flex-wrap:wrap;gap:4px;padding-top:2px;padding-bottom:2px}.panel-ai .panel-hdr-btns{flex-wrap:wrap;justify-content:flex-end}'
  ].join('\n');
  document.head.appendChild(css);

  // ---- Header: My games + Settings ---------------------------------------------------------------
  var right = $('.header-right');
  var gamesBtn = document.createElement('button');
  gamesBtn.className = 'btn btn-sm'; gamesBtn.textContent = 'My games';
  var setBtn = document.createElement('button');
  setBtn.className = 'btn btn-sm'; setBtn.id = 'hx-settings-btn';
  right.insertBefore(setBtn, right.firstChild);
  right.insertBefore(gamesBtn, right.firstChild);
  $('.header').style.position = 'relative';

  function label() { setBtn.textContent = Claude.getKey() ? 'Settings · Claude ✓' : 'Settings · add Claude key'; }
  Claude.onChange(label); label();

  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener('mousedown', function (e) {
    if (pop && !pop.contains(e.target) && e.target !== setBtn && e.target !== gamesBtn) closePop();
  });

  function openSettings(msg) {
    closePop();
    pop = document.createElement('div');
    pop.className = 'hx-pop';
    pop.innerHTML =
      '<h4>Settings</h4>' + (msg ? '<p class="note" style="color:var(--c-danger)">' + esc2(msg) + '</p>' : '') +
      '<div class="keybox" id="hx-key"></div>' +
      '<div class="row"><label>Your rating<input class="input" id="hx-rating" type="number" min="400" max="3000" step="50" style="width:80px"></label>' +
      '<label>Lichess username<input class="input" id="hx-user" type="text" style="width:150px" placeholder="for My games"></label></div>' +
      '<p class="note">The coach pitches its questions and focus to your rating.</p>' +
      '<h4>Your data</h4>' +
      '<p class="note">Saved positions, principles, reads and coach reviews stay in this browser.</p>' +
      '<div class="row"><button class="btn" id="hx-export">Export</button><button class="btn" id="hx-import">Import</button>' +
      '<input type="file" id="hx-file" accept="application/json" hidden></div>';
    $('.header').appendChild(pop);
    Claude.keyBox($('#hx-key', pop));
    var r = $('#hx-rating', pop), u = $('#hx-user', pop);
    r.value = rating(); u.value = username();
    r.addEventListener('change', function () { S.set('rating', Math.max(400, Math.min(3000, +r.value || 1100))); });
    u.addEventListener('change', function () { S.set('user', u.value.trim()); });
    $('#hx-export', pop).onclick = function () {
      var blob = new Blob([JSON.stringify(S.exportAll(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'chess-analyzer-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    $('#hx-import', pop).onclick = function () { $('#hx-file', pop).click(); };
    $('#hx-file', pop).onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) {
        try {
          S.importAll(JSON.parse(t));
          fetch('/api/positions').then(function (r) { return r.json(); }).then(function (d) { savedPositions = d; });
          fetch('/api/principles').then(function (r) { return r.json(); }).then(function (d) { savedPrinciples = d; });
          setStatus('Imported.');
        } catch (err) { setStatus(err.message); }
      });
    };
  }
  setBtn.onclick = function () { if (pop && pop.querySelector('#hx-key')) closePop(); else openSettings(); };

  // ---- My games (Lichess) ---------------------------------------------------------------------
  gamesBtn.onclick = function () {
    if (pop && pop.querySelector('.hx-games')) { closePop(); return; }
    closePop();
    pop = document.createElement('div');
    pop.className = 'hx-pop';
    pop.innerHTML = '<h4>Recent games</h4><div class="row"><input class="input" id="hx-u2" type="text" placeholder="Lichess username" style="flex:1">' +
      '<button class="btn" id="hx-list">List</button></div><div class="hx-games"></div>';
    $('.header').appendChild(pop);
    var u = $('#hx-u2', pop); u.value = username();
    $('#hx-list', pop).onclick = function () { S.set('user', u.value.trim()); listGames(); };
    u.addEventListener('keydown', function (e) { if (e.key === 'Enter') { S.set('user', u.value.trim()); listGames(); } });
    if (username()) listGames();
  };

  function listGames() {
    var box = $('.hx-games', pop), user = username();
    if (!user) return;
    box.innerHTML = '<p class="note">Loading…</p>';
    fetch('https://lichess.org/api/games/user/' + encodeURIComponent(user) + '?max=20&opening=true&evals=true', { headers: { Accept: 'application/x-ndjson' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? 'No such Lichess user.' : 'Lichess error ' + r.status); return r.text(); })
      .then(function (t) {
        var games = t.split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
        if (!games.length) { box.innerHTML = '<p class="note">No games.</p>'; return; }
        box.innerHTML = games.map(function (g) {
          var me = (g.players.white.user && g.players.white.user.id) === user.toLowerCase() ? 'white' : 'black';
          var opp = g.players[me === 'white' ? 'black' : 'white'];
          var res = !g.winner ? 'd' : g.winner === me ? 'w' : 'l';
          var analysed = !!(g.players.white.analysis || g.players.black.analysis);
          return '<div class="hx-game" data-id="' + g.id + '" data-side="' + me + '">' +
            '<span class="hx-res ' + res + '">' + { w: 'W', l: 'L', d: '½' }[res] + '</span>' +
            '<span>' + (me === 'white' ? '○ ' : '● ') + esc2(opp.user ? opp.user.name : 'Anonymous') + ' (' + (opp.rating || '?') + ')' +
            '<div class="hx-sub">' + esc2(g.opening ? g.opening.name : '') + '</div></span>' +
            '<span class="hx-sub">' + g.speed + ' · ' + new Date(g.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
            (analysed ? ' · ✓ engine' : ' · no engine') + '</span></div>';
        }).join('') + '<p class="note">✓ engine = Lichess computer analysis exists. For the others, request it on lichess.org first; the app falls back to Lichess cloud eval where it can.</p>';
      })
      .catch(function (e) { box.innerHTML = '<p class="note" style="color:var(--c-danger)">' + esc2(e.message) + '</p>'; });
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('.hx-game');
    if (!g) return;
    $('#inp').value = 'https://lichess.org/' + g.dataset.id;
    $('#side').value = g.dataset.side;
    closePop();
    loadGame();
  });

  // Same as the original loader, plus clocks and speed (for long-think markers in the coach review).
  window.loadLichess = async function (id, side) {
    try {
      $('#ghdr').innerHTML = '<span class="muted">Loading...</span>';
      setStatus('Fetching...');
      var r = await fetch('https://lichess.org/game/export/' + id + '?evals=1&clocks=1&opening=1', { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('Game not found (' + r.status + ')');
      var d = await r.json(), P = d.players || {};
      meta = {
        w: (P.white && P.white.user && P.white.user.name) || 'White', b: (P.black && P.black.user && P.black.user.name) || 'Black',
        wr: (P.white && P.white.rating) || '?', br: (P.black && P.black.rating) || '?',
        op: d.opening ? d.opening.eco + ' ' + d.opening.name : '',
        res: d.winner === 'white' ? '1-0' : d.winner === 'black' ? '0-1' : '1/2', lichessId: id,
        clocks: d.clocks || null, speed: d.speed || ''
      };
      parse(d.moves.split(' '), d.analysis || []);
      render(side);
      setStatus('');
      if (!d.analysis) $('#ghdr').insertAdjacentHTML('beforeend', '<div style="font-size:var(--fs-xs);color:var(--c-warn);margin-top:2px">No Lichess computer analysis for this game. Request it on lichess.org and load again; meanwhile Lichess cloud eval fills in known positions.</div>');
    } catch (e) { $('#ghdr').innerHTML = '<span style="color:var(--c-danger)">' + esc2(e.message) + '</span>'; setStatus(''); }
  };

  // ---- Buttons and markdown ---------------------------------------------------------------------
  var btns = $('.panel-ai .panel-hdr-btns');
  var coachBtn = document.createElement('button');
  coachBtn.className = 'btn btn-sm'; coachBtn.id = 'btn-coach'; coachBtn.textContent = 'Coach review'; coachBtn.disabled = true;
  coachBtn.title = 'A 2300 coach reviews the whole game: three lessons, credit, homework, phase scores, progress';
  btns.insertBefore(coachBtn, $('#btn-socratic'));
  var histBtn = document.createElement('button');
  histBtn.className = 'btn btn-sm'; histBtn.id = 'btn-history'; histBtn.textContent = 'Reviews';
  histBtn.title = 'Your past coach reviews and takeaways';
  btns.appendChild(histBtn);
  $('#btn-socratic').title = 'Commit your read first, then the coach questions you';

  window.highlightBtn = function (id) {
    btns.querySelectorAll('.btn').forEach(function (b) { b.classList.remove('btn-active'); });
    var b = document.getElementById(id); if (b) b.classList.add('btn-active');
  };
  window.formatMsg = function (t) { return Claude.md(t || ''); };

  var origRender = window.render;
  window.render = function (side) { chatMsgs = []; chatMode = ''; origRender(side); coachBtn.disabled = false; };

  // ---- Grounded facts --------------------------------------------------------------------------
  var NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  var VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function sideName(c) { return c === 'w' ? 'White' : 'Black'; }

  function loosePieces(fen) {
    var grid = computeAttacks(fen), rows = fen.split(' ')[0].split('/'), out = [];
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r][i];
        if ('12345678'.indexOf(ch) >= 0) { f += +ch; continue; }
        var color = ch === ch.toUpperCase() ? 'w' : 'b', t = ch.toLowerCase(), rank = 7 - r;
        var cell = grid[rank][f], att = color === 'w' ? cell.b : cell.w, def = color === 'w' ? cell.w : cell.b;
        if (t !== 'k' && att > def) {
          out.push(sideName(color) + ' ' + NAMES[t] + ' on ' + 'abcdefgh'[f] + (rank + 1) + (def ? ': attacked ' + att + ' times, defended ' + def : ': attacked, not defended'));
        }
        f++;
      }
    }
    return out;
  }
  function uciToSan(fen, uci) {
    if (!uci) return null;
    try { var c = new Chess(fen); var mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }); return mv ? mv.san : uci; } catch (e) { return uci; }
  }
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  function fenBefore(idx) { return idx > 0 ? mvs[idx - 1].fen : START; }
  function evalStr(m) {
    if (!m) return 'n/a';
    if (m.mate !== null && m.mate !== undefined) return 'mate in ' + Math.abs(m.mate) + ' for ' + (m.mate > 0 ? 'White' : 'Black');
    if (m.cp !== null && m.cp !== undefined) return (m.cp >= 0 ? '+' : '') + (m.cp / 100).toFixed(1) + ' (White\'s view)';
    return 'n/a';
  }
  function moveLabel(m) { return m.mn + (m.c === 'w' ? '. ' : '... ') + m.san; }

  function facts(idx) {
    var m = mvs[idx], mine = (m.c === 'w') === (playerSide === 'white');
    var L = [];
    L.push('Game: ' + meta.w + ' (' + meta.wr + ') vs ' + meta.b + ' (' + meta.br + ')' + (meta.op ? ', ' + meta.op : '') + '. The student is ' + pColor() + '.');
    L.push('Moves so far: ' + getMoveHistory());
    L.push('Position after ' + moveLabel(m) + ' (played by ' + (mine ? 'the student' : 'the opponent') + '). FEN: ' + m.fen);
    L.push('Side to move: ' + sideName(m.fen.split(' ')[1]) + '.');
    L.push(fenToBoard(m.fen));
    var loose = loosePieces(m.fen);
    L.push('DETERMINISTIC BOARD FACTS (computed, trust these): pieces attacked more times than they are defended: ' + (loose.length ? loose.join('; ') : 'none') + '.');
    var tac = (detectTactics(idx) || []).map(function (t) { return t.description; });
    L.push('Detected tactics on this move: ' + (tac.length ? tac.join('; ') : 'none') + '.');
    if (!hideEngine) {
      if (m.cp !== null || m.mate !== null) L.push('Engine eval after the move: ' + evalStr(m) + '; before: ' + evalStr(mvs[idx - 1]) + '.');
      if (m.j) L.push('Lichess judgment: ' + m.j + (m.jc ? ' (' + m.jc + ')' : '') + '.');
      if (m.best) L.push('Engine\'s better move instead of ' + m.san + ': ' + uciToSan(fenBefore(idx), m.best) + '. VERIFIED continuation from the position before the move: ' + (m.line || 'n/a') + '.');
      if (m.cloud) L.push('Lichess cloud eval of this position: ' + m.cloud.text + '.');
    } else {
      L.push('Engine data is HIDDEN: the student is analyzing blind. Do not reveal evals or engine moves.');
    }
    return L.join('\n');
  }

  function goal(idx) {
    var m = mvs[idx], mine = (m.c === 'w') === (playerSide === 'white');
    if (hideEngine) return 'Engine hidden. Lead him to a sound read of the position through the lens; do not judge his move with engine claims.';
    if (mine && m.best && (m.j === 'blunder' || m.j === 'mistake' || m.j === 'inaccuracy')) {
      return 'He played ' + m.san + ' (' + m.j + '). The better move was ' + uciToSan(fenBefore(idx), m.best) + '. Lead him to see why it is better and which step of the lens he skipped.';
    }
    if (!mine && m.j) return 'This was the opponent\'s ' + m.j + ' ' + m.san + '. Lead him to see what it allows and how to punish it.';
    if (!mine) return 'This was the opponent\'s move ' + m.san + '. Lead him to see what it threatens or wants, and a good reply.';
    if (m.cp === null && m.mate === null) return 'No engine data. Lead him through the lens to a sound read; make no claims about which move is best.';
    return 'The move ' + m.san + ' was sound. Confirm why, briefly, and stop.';
  }

  // ---- Prompts ----------------------------------------------------------------------------------
  var GROUNDING = 'GROUNDING (critical): you have NO board vision. You only have the FEN, the piece list, the deterministic board facts and the engine line below. Any board claim you work out yourself (who attacks what, attacker and defender counts, "wins a pawn") you will get wrong. Use only the listed facts and the verified continuation. If you need a fact that is not listed, say you cannot verify it on the board. Any move you name must be legal in the position.';

  window.buildSocraticPrompt = function () {
    return [
      'You are a strong IM-level coach running a SOCRATIC session with a club player on ONE position from his own game. ' + tierText(),
      'The user message is his READ of the position (plan, candidate, why) or his answer to your last question.',
      'YOUR AIM: teach a strong player\'s way of reading a position that he can reuse in his own games. Read every position through this lens and lead him to do the same:',
      '1) SAFETY / SCAN: his checks, captures, threats, and the opponent\'s reply to his move; anything hanging.',
      '2) ASSESS the imbalances: king safety, material, pawn structure, piece activity (best and worst piece). Name what each side wants.',
      '3) CANDIDATES + DECIDE: the 2 or 3 real moves and what each does. Safety before plan. When he is better, the "Best?" beat: is there a more forcing move than the obvious one?',
      'Use proper vocabulary (tempo, initiative, prophylaxis, outpost, weak square, open file, overload, zwischenzug), glossing a term only when it is likely new to him.',
      'CEILING: aim at the move a strong club player (~1900) would find. The engine\'s deepest line is a stretch reference only.',
      'TEACHING GOAL: ' + goal(cur),
      'RUN IT: 1 or 2 short, pointed questions per turn toward the goal. Do not reveal the target outright; lead him to say it. If he drifts, steer back in half a sentence. When he gets it, or after about 3 turns, CLOSE: state the lesson subtractively ("stop doing X" before "do Y"), name the mistake type (calculation, evaluation, plan, hung piece), name the concept, and stop. If the move was already sound, confirm why and stop; never invent a weakness.',
      'If he challenges a claim you cannot confirm from the facts, concede at once ("fair, that is board work for the engine") and return to the positional point.',
      GROUNDING,
      'Voice: second person, warm, brief. 2 to 4 sentences per turn. No preamble.',
      '',
      'FACTS',
      facts(cur)
    ].join('\n');
  };

  window.buildFactorPrompt = function () {
    return 'Chess analyst for a club player. ' + tierText() + '\n' +
      'Analyze the position from ' + pColor() + '\'s view: **1. Material** **2. King safety** **3. Piece activity** **4. Pawn structure** **5. Space** **6. Weak squares**. One or two lines each, concrete (name pieces and squares). End with **Verdict**: who is better and what ' + pColor() + ' should do, and **Mistake type** if the move was flagged (calculation, evaluation, plan, hung piece).\n' +
      GROUNDING + '\n\nFACTS\n' + facts(cur);
  };

  window.buildMultiRatingPrompt = function () {
    return 'Simulate three players reading this position as ' + pColor() + '. The student is rated ' + rating() + '.\n' +
      '**1200**: sees material and direct threats, misses positional ideas. **1700**: sees structure and activity, may misprioritize. **2200**: weighs all six factors, finds the critical one, thinks about prophylaxis.\n' +
      'For each: a short inner monologue, what they see and miss, and the move they choose. End with **Key lesson** for a ' + rating() + ' player.\n' +
      GROUNDING + '\n\nFACTS\n' + facts(cur);
  };

  // Lesson extraction keeps the original prompt (it is already strong); it runs on the chat so far.

  function gameDigest() {
    var lines = [], clocks = meta.clocks;
    for (var i = 0; i < mvs.length; i++) {
      var m = mvs[i], s = moveLabel(m);
      if (m.j) s += ' {' + m.j + (m.cp !== null ? ', eval ' + evalStr(m) : m.mate !== null ? ', ' + evalStr(m) : '') + (m.best ? ', better ' + uciToSan(fenBefore(i), m.best) + ': ' + (m.line || '') : '') + '}';
      if (clocks && clocks[i] != null && i >= 2 && clocks[i - 2] != null) {
        var spent = Math.round((clocks[i - 2] - clocks[i]) / 100);
        if (spent >= 20) s += ' [' + spent + 's]';
      }
      lines.push(s);
    }
    return lines.join('\n');
  }
  function flagged() {
    var mine = playerSide === 'white' ? 'w' : 'b';
    return mvs.map(function (m, i) { return { m: m, i: i }; }).filter(function (x) { return x.m.j && x.m.c === mine; }).map(function (x) {
      var t = (detectTactics(x.i) || []).map(function (d) { return d.description; }).join('; ');
      return moveLabel(x.m) + ' (' + x.m.j + ')' + (x.m.best ? ', better ' + uciToSan(fenBefore(x.i), x.m.best) : '') + (t ? ', detected: ' + t : '') +
        ', loose after it: ' + (loosePieces(x.m.fen).join('; ') || 'none');
    });
  }
  function reviews() { return S.get('reviews', []); }

  function buildCoachPrompt() {
    var prior = reviews().filter(function (r) { return r.gameKey !== gameKey(); }).slice(0, 8);
    var hasEngine = mvs.some(function (m) { return m.cp !== null || m.mate !== null; });
    return [
      'You are a 2300-rated chess coach reviewing ONE game for a student who plays ' + pColor() + '. ' + tierText(),
      'Coach like a real 2300 would: ignore engine noise, find the 2 or 3 things that actually move this student\'s rating, name the ONE recurring habit behind the mistakes, and credit what they did well. Honest, warm, direct, second person.',
      'Writing: short, direct sentences. Lead with what matters most. Cut filler.',
      'GROUNDING: use only the moves, judgments and engine lines given. Never invent a move, a line or a number. ' + (hasEngine ? '' : 'There is NO engine data for this game: judge only what the moves show, and say so once.'),
      '',
      'FORMAT (Markdown):',
      'One honest headline sentence in bold.',
      'Exactly three numbered lessons, most important first. Each names the concrete moves (e.g. 18.Qxb4, better 18.Qxf7) and the general rule in **bold**.',
      '**Credit where due:** one line.',
      '**Homework:** one line.',
      '## Phases',
      'A table: Phase | Score | What happened. Score his decisions 0 to 10 in the opening, middlegame and endgame (0-3 poor, 4-6 mixed, 7-8 good, 9-10 excellent), not the result. If a phase barely happened, score what there was.',
      prior.length ? '## Progress\nCompare with the earlier games listed. Labeled lines, one sentence each: **Improved:** (only a real gain; skip the line otherwise), **Still to fix:** (the recurring leak, how many games running, this game\'s instance), **Watch:** (a new slip; omit if none), **Next:** (one concrete action for the next game). Cite only moves from this game.' : '',
      '**Takeaway:** one or two sentences, the single heuristic that would win this student the most rating points, usable at the board next game.',
      '',
      'GAME: ' + meta.w + ' (' + meta.wr + ') vs ' + meta.b + ' (' + meta.br + '), ' + (meta.op || 'opening unknown') + ', result ' + (meta.res || '?') + (meta.speed ? ', ' + meta.speed : '') + '. Student: ' + pColor() + '.',
      'Moves (judgments and engine alternatives in braces, long thinks in brackets):',
      gameDigest(),
      '',
      'The student\'s flagged moves: ' + (flagged().join('\n') || 'none'),
      prior.length ? '\nEARLIER GAMES (newest first):\n' + prior.map(function (r) { return '- ' + r.date + ', ' + r.title + ': takeaway "' + r.takeaway + '"'; }).join('\n') : ''
    ].filter(function (x) { return x !== ''; }).join('\n');
  }
  function gameKey() { return meta.lichessId || ('pgn:' + mvs.slice(0, 20).map(function (m) { return m.san; }).join(' ')); }

  // ---- Streaming (replaces the server's /api/chat) ----------------------------------------------
  var ctrl = null;
  window.streamAI = function (messages, mode) {
    if (!Claude.getKey()) { openSettings('Add your Claude API key to use the coach. It stays in this browser.'); return; }
    chatStreaming = true;
    chatMsgs.push({ role: 'ai', content: '', streaming: true });
    var aiIdx = chatMsgs.length - 1;
    showChat(); setStatus('Thinking…');
    var sys = mode === 'coach' ? buildCoachPrompt() : mode === 'factor' ? buildFactorPrompt() : mode === 'multi' ? buildMultiRatingPrompt() :
      mode === 'lesson' ? buildLessonPrompt() : mode === 'narrative' ? buildNarrativePrompt() : buildSocraticPrompt();
    // The API wants the conversation to open with the user; some modes start with the coach.
    if (messages.length && messages[0].role === 'assistant') messages = [{ role: 'user', content: 'Go ahead.' }].concat(messages);
    var frame = 0;
    ctrl = new AbortController();
    Claude.stream({
      system: sys,
      messages: messages,
      maxTokens: mode === 'coach' || mode === 'narrative' ? 12000 : 6000,
      effort: mode === 'coach' || mode === 'narrative' ? 'high' : 'medium',
      signal: ctrl.signal,
      onThinking: function () { setStatus('Thinking…'); },
      onText: function (d, all) {
        chatMsgs[aiIdx].content = all; setStatus('Writing…');
        if (!frame) frame = requestAnimationFrame(function () { frame = 0; updateStream(); });
      }
    }).then(function (r) {
      chatMsgs[aiIdx].content = r.text;
      setStatus('≈' + Claude.money(r.cost) + ' on your key');
      if (mode === 'coach') saveReview(r.text);
    }).catch(function (e) {
      chatMsgs[aiIdx].content += (chatMsgs[aiIdx].content ? '\n\n' : '') + '[' + (e.name === 'AbortError' ? 'Stopped' : e.message) + ']';
      setStatus('');
    }).then(function () {
      chatMsgs[aiIdx].streaming = false; chatStreaming = false; ctrl = null;
      showChat();
    });
  };

  // ---- Socratic: your read first ------------------------------------------------------------------
  window.startSocratic = function () {
    if (chatStreaming || mvs.length === 0) return;
    if (cur < 0) go(0);
    libraryMode = false; principlesMode = false; chatMode = 'socratic'; highlightBtn('btn-socratic');
    var m = mvs[cur], mine = (m.c === 'w') === (playerSide === 'white');
    var ap = $('#ap');
    $('#ai-panel-title').textContent = 'Your read first';
    ap.innerHTML = '<div class="hx-read"><p><strong>' + moveLabel(m) + '</strong> · ' + (mine ? 'your move' : 'his move') + '</p>' +
      '<p class="muted" style="text-align:left;padding:0 0 6px">Before the coach says anything: what do you see? ' +
      (mine ? 'Was ' + esc2(m.san) + ' right, what else did you consider, and why?' : 'What does ' + esc2(m.san) + ' want, and what would you play?') +
      ' Scan his checks, captures and threats first.</p>' +
      '<textarea id="hx-read-in" placeholder="Plan · candidate · why"></textarea>' +
      '<div style="display:flex;gap:4px;margin-top:4px"><button class="btn btn-confirm" id="hx-read-go">Coach me</button>' +
      '<button class="btn" id="hx-read-skip">Skip, just ask me</button></div></div>';
    $('#hx-read-in').focus();
    function begin(read) {
      chatMsgs = [];
      if (read) {
        var reads = S.get('reads', []);
        reads.unshift({ game: gameKey(), ply: cur, move: moveLabel(m), fen: m.fen, read: read, at: new Date().toISOString() });
        S.set('reads', reads.slice(0, 500));
        chatMsgs.push({ role: 'user', content: read });
      }
      streamAI([{ role: 'user', content: read ? 'My read: ' + read : 'I\'m playing ' + pColor() + '. Help me read this position.' }], 'socratic');
    }
    $('#hx-read-go').onclick = function () { var v = $('#hx-read-in').value.trim(); if (v) begin(v); else $('#hx-read-in').focus(); };
    $('#hx-read-skip').onclick = function () { begin(''); };
    $('#hx-read-in').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('#hx-read-go').click(); });
  };

  // ---- Coach review ---------------------------------------------------------------------------
  coachBtn.onclick = function () {
    if (chatStreaming || mvs.length === 0) return;
    chatMsgs = []; chatMode = 'coach'; libraryMode = false; principlesMode = false; highlightBtn('btn-coach');
    streamAI([{ role: 'user', content: 'Review my game. I played ' + pColor() + '.' }], 'coach');
  };
  function saveReview(text) {
    var take = (text.match(/\*\*Takeaway:?\*\*:?\s*([\s\S]*?)(?:\n\n|$)/i) || [])[1] || '';
    var all = reviews().filter(function (r) { return r.gameKey !== gameKey(); });
    all.unshift({
      gameKey: gameKey(), lichessId: meta.lichessId, side: playerSide,
      title: meta.w + ' vs ' + meta.b + (meta.res ? ' (' + meta.res + ')' : '') + (meta.op ? ', ' + meta.op : ''),
      date: new Date().toISOString().slice(0, 10), takeaway: take.trim(), review: text
    });
    S.set('reviews', all.slice(0, 100));
  }

  // Show the label for the coach mode in the chat header.
  var origShowChat = window.showChat;
  window.showChat = function () {
    origShowChat();
    if (chatMode === 'coach') {
      var mv = $('.chat-context-move'); if (mv) mv.textContent = 'Whole game · ' + mvs.length + ' moves';
      var md = $('.chat-context-mode'); if (md) md.textContent = 'Coach review';
    }
  };

  histBtn.onclick = function () {
    libraryMode = false; principlesMode = false; chatMode = ''; highlightBtn('btn-history');
    var all = reviews(), ap = $('#ap');
    $('#ai-panel-title').textContent = 'Coach reviews';
    if (!all.length) { ap.innerHTML = '<div class="muted">No reviews yet. Load a game and press Coach review.</div>'; return; }
    ap.innerHTML = '<div class="hx-hist">' + all.map(function (r, i) {
      return '<div class="lib-card" data-i="' + i + '"><div class="lib-card-move">' + esc2(r.title) + '</div>' +
        '<div class="lib-card-meta">' + r.date + ' · as ' + r.side + '</div>' +
        (r.takeaway ? '<div class="lib-card-meta" style="color:var(--c-text)">' + esc2(r.takeaway) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
    ap.querySelectorAll('.lib-card').forEach(function (c) {
      c.onclick = function () {
        var r = all[+c.dataset.i];
        ap.innerHTML = '<div style="margin-bottom:6px"><button class="btn btn-sm" id="hx-back">← All reviews</button>' +
          (r.lichessId ? ' <button class="btn btn-sm" id="hx-open">Load this game</button>' : '') + '</div>' +
          '<div class="chat-text">' + Claude.md(r.review) + '</div>';
        $('#hx-back').onclick = histBtn.onclick;
        if (r.lichessId) $('#hx-open').onclick = function () { $('#inp').value = 'https://lichess.org/' + r.lichessId; $('#side').value = r.side; loadGame(); };
      };
    });
  };

  // ---- Lichess cloud eval for positions without engine data ---------------------------------------
  var cloudCache = {}, cloudTimer = 0;
  var origInfo = window.showPositionInfo;
  window.showPositionInfo = function (idx) {
    origInfo(idx);
    var m = mvs[idx];
    if (hideEngine || !m || m.cp !== null || m.mate !== null) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () { cloud(idx); }, 350);
  };
  function cloud(idx) {
    var m = mvs[idx], fen = m.fen;
    var show = function (c) {
      if (cur !== idx || hideEngine) return;
      var ap = $('#ap'); if (!ap || chatMsgs.length || libraryMode || principlesMode) return;
      var old = $('.hx-cloud', ap); if (old) old.remove();
      ap.insertAdjacentHTML('beforeend', '<div class="hx-cloud">' + (c ? 'Lichess cloud: <strong>' + esc2(c.text) + '</strong>' : 'Not in the Lichess cloud: no engine eval for this position.') + '</div>');
    };
    if (cloudCache[fen] !== undefined) { m.cloud = cloudCache[fen]; show(cloudCache[fen]); return; }
    fetch('https://lichess.org/api/cloud-eval?fen=' + encodeURIComponent(fen))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var c = null;
        if (d && d.pvs && d.pvs[0]) {
          var pv = d.pvs[0], ev = pv.mate != null ? 'mate in ' + Math.abs(pv.mate) + ' for ' + (pv.mate > 0 ? 'White' : 'Black') : ((pv.cp >= 0 ? '+' : '') + (pv.cp / 100).toFixed(1));
          var ch = new Chess(fen), san = [];
          pv.moves.split(' ').slice(0, 6).forEach(function (u) { var mv = ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }); if (mv) san.push(mv.san); });
          c = { text: ev + ', best next ' + (san[0] || '?') + ' (line: ' + san.join(' ') + ', depth ' + d.depth + ')' };
        }
        cloudCache[fen] = c; m.cloud = c; show(c);
      }).catch(function () { show(null); });
  }

  // Esc also stops a running Claude call.
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (ctrl) ctrl.abort(); closePop(); } });

  // First visit: open settings if there is no key and no username yet.
  if (!Claude.getKey() && !username() && !S.get('seen', false)) { S.set('seen', true); openSettings(); }
})();
