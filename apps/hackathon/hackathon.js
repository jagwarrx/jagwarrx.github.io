// Hackathon idea analyzer. Sends the hackathon brief and the idea to Claude (visitor's own key, see
// ../claude.js) and streams back a judge's read on three criteria: demo impact, problem significance,
// technical novelty or depth. The guide on the page (#guide) is the rubric: its text goes into the prompt,
// so editing the page changes what Claude checks. Runs are saved in this browser only.
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var HIST = 'hmeyy:hackathon:runs';

  var SYSTEM = [
    'You are a hackathon judge and coach. Someone is about to commit their hackathon hours to an idea, and you test it before they write code.',
    '',
    'You judge on three criteria, in this order of weight:',
    '1. Demo impact (heaviest in practice, even when the rubric doesn\'t say so): does it work live, and does a judge understand it in the first 30 seconds? A polished, narrow demo beats an ambitious broken one.',
    '2. Problem significance: a real, specific pain for a clearly named user, that fits the hackathon\'s theme or a sponsor track. "I\'d use this" or "someone would pay for this" beats cleverness aimed at nothing.',
    '3. Technical novelty or depth: something non-trivial built in the time, or the sponsor\'s tech used in a way other teams won\'t. This is what separates them from the ten other teams with the same idea.',
    '',
    'The site\'s guide below holds the tips and questions for each criterion. Apply them to THIS idea; don\'t repeat them.',
    '<guide>',
    '{{GUIDE}}',
    '</guide>',
    '',
    'Scoring, 1 to 5 for each criterion:',
    '5 = would place top 3 on this criterion as it stands. 4 = strong, one clear fix away. 3 = average; looks like the other teams. 2 = a real weakness judges will notice. 1 = this sinks the project.',
    'Score the idea as described, not as it could be. Be honest: most ideas are a 2 or 3 somewhere. Don\'t inflate.',
    '',
    'Verdict, one of: **Build it** (no score under 3 and demo impact 4 or more), **Sharpen it first** (fixable in the first hour of planning), **Swap it** (a criterion at 1, or the time can\'t produce a working demo).',
    '',
    'Rules for what you write:',
    '- No BS. Plain, short words. No praise, no filler, no hedging, no pep talk.',
    '- Every tip names a concrete action for this idea, doable within the stated time and team. "Make the demo engaging" is banned; "open on the generated care plan for a real patient, not the login screen" is the bar.',
    '- Every question is one whose answer would change what they build or cut. No rhetorical questions.',
    '- If the brief names sponsors, tracks, a rubric or a theme, use them by name. If something important is missing (time, team, theme), say what you assumed in one line at the top.',
    '- Name the obvious version of this idea that other teams will build, and say how this one differs or should differ.',
    '- If the user compares several ideas, rank them in a table first, then analyze the top one in full.',
    '',
    'Output format, in Markdown, exactly these sections:',
    '## Verdict',
    'One line: the verdict in bold, then the main reason in one sentence.',
    'Then a table with columns: Criterion | Score | The one thing to fix. One row per criterion, score as "3/5".',
    '## 1. Demo impact',
    '**First 30 seconds:** what a judge would see and understand, as it stands, in one or two sentences.',
    '**Tips**: 3 to 5 bullets.',
    '**Think about**: 2 or 3 questions.',
    '## 2. Problem significance',
    '**The user and the pain:** the named user and the pain, as specific as the brief allows; say if it is vague.',
    '**Tips**: 3 to 5 bullets.',
    '**Think about**: 2 or 3 questions.',
    '## 3. Technical novelty or depth',
    '**The hard part:** the one non-trivial thing worth building for real, and what to fake.',
    '**Tips**: 3 to 5 bullets.',
    '**Think about**: 2 or 3 questions.',
    '## The sharper version',
    'The idea rewritten in two or three sentences so it scores higher on all three, staying close to what they want to build.',
    '## 30-second demo script',
    'What to say and show, as 4 to 6 short timed beats (0:00, 0:05, ...).',
    '## Build plan',
    'Bullets in hours for the stated time: what to build first, the point where features freeze (about three quarters through), what to fake, and the backup if the live demo fails.',
    '',
    'On follow-up messages, answer what they ask in the same no-BS style. If they answer your questions or change the idea, re-score it with a new Verdict section and only the sections that changed.'
  ].join('\n');

  var form = $('#hk-form'), out = $('#hk-out'), go = $('#hk-go'), stop = $('#hk-stop');
  var convo = [], current = null, ctrl = null;

  Claude.keyBox($('#hk-key'));
  Claude.onChange(ready);
  form.addEventListener('input', ready);

  function ready() {
    var ok = !!Claude.getKey() && $('#hk-idea').value.trim().length > 10;
    go.disabled = !ok || !!ctrl;
    go.title = !Claude.getKey() ? 'Add your Claude API key first' : !ok ? 'Describe your idea first' : '';
    var f = $('#hk-follow-go');
    if (f) f.disabled = !Claude.getKey() || !!ctrl;
  }

  function guideText() {
    var g = $('#guide');
    return g ? g.innerText.replace(/\n{3,}/g, '\n\n').trim() : '';
  }

  function brief() {
    var parts = [];
    var h = $('#hk-event').value.trim(), i = $('#hk-idea').value.trim(), t = $('#hk-team').value.trim(), o = $('#hk-others').value.trim();
    parts.push('<hackathon>\n' + (h || '(not given)') + '\n</hackathon>');
    parts.push('<team_and_time>\n' + (t || '(not given)') + '\n</team_and_time>');
    parts.push('<idea>\n' + i + '\n</idea>');
    if (o) parts.push('<other_ideas_being_weighed>\n' + o + '\n</other_ideas_being_weighed>');
    parts.push('Judge this idea.');
    return parts.join('\n\n');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (go.disabled) return;
    convo = [{ role: 'user', content: brief() }];
    current = {
      id: Date.now().toString(36),
      at: new Date().toISOString(),
      title: $('#hk-idea').value.trim().split('\n')[0].slice(0, 80),
      inputs: { event: $('#hk-event').value, idea: $('#hk-idea').value, team: $('#hk-team').value, others: $('#hk-others').value },
      turns: [], cost: 0
    };
    out.innerHTML = '';
    out.hidden = false;
    run();
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function run() {
    var turn = document.createElement('section');
    turn.className = 'hk-turn';
    turn.innerHTML =
      '<details class="hk-think" hidden><summary>Claude\'s thinking</summary><div class="hk-think-body"></div></details>' +
      '<div class="hk-status"><span class="dot"></span> Reading your idea…</div>' +
      '<div class="hk-md md"></div>' +
      '<p class="hk-foot meta" hidden></p>';
    out.appendChild(turn);
    var mdEl = $('.hk-md', turn), status = $('.hk-status', turn), think = $('.hk-think', turn), foot = $('.hk-foot', turn);
    ctrl = new AbortController();
    stop.hidden = false; ready();
    var frame = 0, latest = '';
    function paint() { frame = 0; mdEl.innerHTML = Claude.md(latest); }

    Claude.stream({
      system: SYSTEM.replace('{{GUIDE}}', guideText()),
      messages: convo,
      maxTokens: 16000,
      effort: 'medium',
      signal: ctrl.signal,
      onThinking: function (d, all) {
        think.hidden = false;
        $('.hk-think-body', think).textContent = all;
        status.innerHTML = '<span class="dot"></span> Thinking…';
      },
      onText: function (d, all) {
        latest = all;
        status.hidden = true;
        if (!frame) frame = requestAnimationFrame(paint);
      }
    }).then(function (r) {
      latest = r.text; paint();
      convo.push({ role: 'assistant', content: r.text });
      current.turns.push({ q: convo[convo.length - 2].content, a: r.text });
      current.cost += r.cost;
      current.verdict = (r.text.match(/\*\*(Build it|Sharpen it first|Swap it)\*\*/i) || [])[1] || current.verdict || '';
      foot.hidden = false;
      foot.textContent = modelName(r.model) + ' · ' + r.usage.input.toLocaleString() + ' in, ' + r.usage.output.toLocaleString() + ' out · ≈' + Claude.money(r.cost) + ' on your key' +
        (r.stopReason === 'max_tokens' ? ' · cut off at the length limit' : '');
      save();
      followBox();
    }).catch(function (err) {
      status.hidden = false;
      status.className = 'hk-status err';
      status.textContent = err.name === 'AbortError' ? 'Stopped.' : err.message;
      if (latest) paint();
      if (convo.length && convo[convo.length - 1].role === 'user' && convo.length > 1) convo.pop();
      if (current.turns.length) followBox();
    }).then(function () {
      ctrl = null; stop.hidden = true; ready();
    });
  }

  function modelName(id) { var m = Claude.models.filter(function (x) { return id && id.indexOf(x.id) === 0; })[0]; return m ? m.name : id; }

  stop.addEventListener('click', function () { if (ctrl) ctrl.abort(); });

  function followBox() {
    var old = $('#hk-follow'); if (old) old.remove();
    var f = document.createElement('form');
    f.id = 'hk-follow';
    f.className = 'hk-follow';
    f.innerHTML =
      '<label for="hk-follow-in">Answer the questions, push back, or change the idea</label>' +
      '<textarea id="hk-follow-in" rows="3" placeholder="e.g. The user is ER nurses at shift change; we have 24 hours and two people. Re-score it."></textarea>' +
      '<div class="hk-actions"><button class="btn" id="hk-follow-go" type="submit">Send</button>' +
      '<button class="btn ghost" type="button" data-copy>Copy as Markdown</button></div>';
    out.appendChild(f);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#hk-follow-in').value.trim();
      if (!v || ctrl) return;
      var q = document.createElement('div');
      q.className = 'hk-you';
      q.innerHTML = '<span class="meta">You</span><div>' + Claude.esc(v).replace(/\n/g, '<br>') + '</div>';
      f.remove();
      out.appendChild(q);
      convo.push({ role: 'user', content: v });
      run();
    });
    $('[data-copy]', f).addEventListener('click', function (e) {
      navigator.clipboard.writeText(toMarkdown(current)).then(function () {
        e.target.textContent = 'Copied ✓';
        setTimeout(function () { e.target.textContent = 'Copy as Markdown'; }, 1500);
      });
    });
    ready();
  }

  function toMarkdown(run) {
    var s = '# Hackathon idea: ' + run.title + '\n\n';
    run.turns.forEach(function (t, i) {
      if (i) s += '\n\n---\n\n**Follow-up:** ' + t.q + '\n\n';
      s += t.a;
    });
    return s + '\n';
  }

  // ---- Saved runs --------------------------------------------------------------------------------
  function runs() { try { return JSON.parse(localStorage.getItem(HIST)) || []; } catch (e) { return []; } }
  function save() {
    var all = runs().filter(function (r) { return r.id !== current.id; });
    all.unshift(current);
    localStorage.setItem(HIST, JSON.stringify(all.slice(0, 30)));
    drawHistory();
  }
  function drawHistory() {
    var all = runs(), el = $('#hk-history');
    el.hidden = !all.length;
    $('ul', el).innerHTML = all.map(function (r) {
      return '<li><button type="button" class="kb-link" data-open="' + r.id + '">' + Claude.esc(r.title) + '</button>' +
        '<span class="meta"> · ' + new Date(r.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
        (r.verdict ? ' · ' + Claude.esc(r.verdict) : '') + '</span>' +
        '<button type="button" class="kb-link del" data-del="' + r.id + '" aria-label="Delete">×</button></li>';
    }).join('');
  }
  $('#hk-history').addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
    if (d) {
      localStorage.setItem(HIST, JSON.stringify(runs().filter(function (r) { return r.id !== d.dataset.del; })));
      drawHistory(); return;
    }
    if (!o || ctrl) return;
    var r = runs().filter(function (x) { return x.id === o.dataset.open; })[0];
    if (!r) return;
    current = r;
    ['event', 'idea', 'team', 'others'].forEach(function (k) { $('#hk-' + k).value = r.inputs[k] || ''; });
    convo = [];
    out.innerHTML = '';
    out.hidden = false;
    r.turns.forEach(function (t, i) {
      convo.push({ role: 'user', content: t.q }, { role: 'assistant', content: t.a });
      if (i) {
        var q = document.createElement('div');
        q.className = 'hk-you';
        q.innerHTML = '<span class="meta">You</span><div>' + Claude.esc(t.q).replace(/\n/g, '<br>') + '</div>';
        out.appendChild(q);
      }
      var s = document.createElement('section');
      s.className = 'hk-turn';
      s.innerHTML = '<div class="hk-md md">' + Claude.md(t.a) + '</div>';
      out.appendChild(s);
    });
    followBox();
    ready();
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#hk-sample').addEventListener('click', function () {
    $('#hk-event').value = 'Desert Health Hack, 24 hours. Theme: tools for overloaded healthcare workers. Tracks: Best use of Twilio, Best accessibility hack, Best use of Claude. Rubric: impact 30, technical 30, design 20, presentation 20.';
    $('#hk-idea').value = 'An app that listens to a nurse\'s spoken shift handover and turns it into a structured handover note (SBAR), flagging anything missing like allergies or pending labs.';
    $('#hk-team').value = '2 people, 24 hours. I do Python and LLM work; my teammate does React. No healthcare data access.';
    $('#hk-others').value = '';
    ready();
    $('#hk-idea').focus();
  });

  drawHistory();
  ready();
})();
