/* Ask the map: type a topic or a question, and Claude makes a story to play: the years, regions, layers, the item each step
   opens, arrows on the map and the text. Claude searches this app's own items and pages first (the search and browse tools),
   so steps open real items and link real pages. It runs in this browser with the reader's own Anthropic API key, kept in
   localStorage; nothing is sent anywhere else. Stories can be kept in this browser (Save) and exported as a file. */
(() => {
const SDK = new URL("vendor/anthropic-sdk-1.11.0.js", document.baseURI).href;   /* our own copy: the reader's key never shares a page with code from another site */
const MODEL = "claude-opus-5-5";
const KEY = "history.claudekey", MINE = "history.mystories";
const REGIDS = REG.map(r => r.id), LAYIDS = LAYERS.map(l => l.id);
/* the local preview (serve.py) can hand the page a key from the HISTORY_CLAUDE_KEY environment variable, so none need be typed there */
const ENVKEY = typeof window.HISTORY_ENV_KEY === "string" ? window.HISTORY_ENV_KEY : "";
const keyGet = () => { try { return localStorage.getItem(KEY) || ENVKEY; } catch (e) { return ENVKEY; } };
window.askHasKey = () => !!keyGet();
/* Forget key, in either key row: takes the key out of this browser */
document.addEventListener("click", e => { const b = e.target.closest(".keyforget"); if (!b) return;
  const row = b.closest(".askkey, .chkey"), had = !!keyGet(); try { localStorage.removeItem(KEY); } catch (x) {}
  row.querySelector("input").value = ""; row.querySelector("input").classList.remove("bad");
  const msg = row.querySelector(".keymsg"); msg.textContent = had ? "The key is removed from this browser." : "No key is stored in this browser."; msg.hidden = false; msg.classList.add("ok"); });
function errText(e) {
  const st = e && e.status, m = (e && e.message) || String(e);
  if (st === 401) return "The API key was refused. Check it under API key.";
  if (st === 429) return "Too many requests just now. Wait a minute and try again.";
  if (/credit balance/i.test(m)) return "Your Anthropic account has no credit. Add some at console.anthropic.com, under Billing, then try again.";
  if (st === 403) return "This API key is not allowed to do that. Check the key's permissions in the Anthropic console.";
  if (st === 529 || st >= 500 || /overloaded/i.test(m)) return "Claude is busy just now. Try again in a minute.";
  if (/connection error|failed to fetch|network/i.test(m)) return "Could not reach Anthropic. Check your connection and try again.";
  if (st === 400) return "Anthropic did not accept the request" + ((m.match(/"message":"([^"]+)"/) || [])[1] ? ": " + m.match(/"message":"([^"]+)"/)[1] : ".");
  return m;
}
/* Save in a key row: an empty box with no key stored, or text that is not a key, says so and keeps the row open */
function keySave(row) {
  const inp = row.querySelector("input"), msg = row.querySelector(".keymsg"), v = inp.value.trim();
  const say = t => { msg.classList.remove("ok"); msg.textContent = t; msg.hidden = !t; inp.classList.toggle("bad", !!t); if (t) inp.focus(); return !t; };
  if (!v && !keyGet()) return say("Paste your key first.");
  if (v && !/^sk-ant-/.test(v)) return say("That does not look like an Anthropic key. They start with sk-ant-.");
  try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { return say("This browser would not store the key (private mode?)."); }
  return say("");
}

/* ---------- the stories kept in this browser ---------- */
const playable = s => s && typeof s === "object" && typeof s.id === "string" && typeof s.title === "string" && Array.isArray(s.stops) && s.stops.length > 0 &&
  s.stops.every(st => st && typeof st.text === "string" && Array.isArray(st.r) && st.r.length && isFinite(st.y));
const mine = () => { try { const L = JSON.parse(localStorage.getItem(MINE) || "[]"); return Array.isArray(L) ? L.filter(playable) : []; } catch (e) { return []; } };
const putMine = list => { try { localStorage.setItem(MINE, JSON.stringify(list)); return true; } catch (e) { return false; } };
for (const s of mine()) STORYS.push(Object.assign(s, { mine: true }));
if (typeof openStoryLink === "function") openStoryLink();   /* a link to a saved story could not open before this */

/* ---------- the tools Claude uses to look inside the app ---------- */
const STOP = new Set("the a an and of in on to for with from by at as into over under their his her its how why what when who which was were is are be about between during after before".split(" "));
const words = q => norm(q).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
let ENTRIES = null;
function entries() {
  if (ENTRIES) return ENTRIES;
  const seen = new Set(); ENTRIES = [];
  for (const x of INDEX) {
    const o = x.obj, kb = o.kb || KBOF.get(o) || null, p = kb && KBX[kb];
    if (p && p.t === "stub") continue;
    const key = x.t + "|" + (kb || "") + "|" + (o.reg || ""); if (seen.has(key)) continue; seen.add(key);
    const y = o.s ?? o.y ?? o.a ?? (p && p.y) ?? null, e = o.e ?? o.b ?? (p && p.e) ?? null;
    const reg = o.reg ? [o.reg] : o.r ? o.r : [];
    ENTRIES.push({ name: x.t, kb, what: x.k, y, e, reg, lv: x.lv || 3, ll: (p && p.ll) || (o.ll) || null,
      hay: norm(x.t), aka: norm(((p && p.aka) || []).join(" ")), kind: norm((x.k || "") + " " + ((p && p.kind) || "")) });
  }
  return ENTRIES;
}
const within = (en, a, b) => (a == null || (en.e ?? en.y ?? a) >= a) && (b == null || (en.y ?? b) <= b);
async function describe(list) {
  const out = [];
  for (const en of list) {
    const r = { name: en.name, what: en.what };
    if (en.y != null) r.years = en.e != null && en.e !== en.y ? `${en.y} to ${en.e}` : String(en.y);
    if (en.reg.length) r.regions = en.reg;
    if (en.kb) r.page = en.kb;
    if (en.ll) r.ll = en.ll;
    out.push(r);
  }
  /* the first lines of the pages, for the best hits */
  await Promise.all(out.slice(0, 12).map(async r => { if (!r.page) return; const t = await kbText(r.page); if (t && t.sum) r.about = t.sum.slice(0, 220); }));
  return out;
}
async function toolSearch({ query, from_year, to_year, region }) {
  query = String(query == null ? "" : query);
  const ws = words(query), phrase = norm(query).trim();
  if (!ws.length) return { error: "Give a name or some key words." };
  const hits = [];
  for (const en of entries()) {
    if (region && !en.reg.includes(region)) continue;
    if (!within(en, from_year, to_year)) continue;
    let s = 0;
    for (const w of ws) { if (en.hay.includes(w)) s += en.hay.startsWith(w) || en.hay.includes(" " + w) ? 3 : 2; else if (en.aka.includes(w)) s += 2; else if (en.kind.includes(w)) s += 1; }
    if (phrase.length > 3 && en.hay.includes(phrase)) s += 5;
    if (s) hits.push([s, en]);
  }
  hits.sort((a, b) => b[0] - a[0] || a[1].lv - b[1].lv);
  return { results: await describe(hits.slice(0, 20).map(h => h[1])) };
}
async function toolBrowse({ region, from_year, to_year }) {
  if (!REGIDS.includes(region)) return { error: "region must be one of " + REGIDS.join(", ") };
  const list = entries().filter(en => en.reg.includes(region) && en.lv <= 2 && en.y != null && within(en, from_year, to_year));
  list.sort((a, b) => a.lv - b.lv || a.y - b.y);
  return { results: await describe(list.slice(0, 40)) };
}

const SYSTEM = `You make guided stories for a world history app: a timeline chart of eight regions with a map of borders under it. The reader types a topic or a question; you answer with a story they play step by step. Each step moves the red year line, switches on regions and layers, opens one item in the side panel, can draw arrows on the map, and shows your text in a card.

How to work:
- First look inside the app with the search and browse tools. Search by names (rulers, states, cities, battles, temples, trade goods), several times as you learn more. Browse a region over a span of years to see what the chart holds.
- Then call submit_story once with the whole story.

The story:
- A title, and a one-line subtitle naming the span of years.
- 5 to 9 steps, mostly in time order. Each step answers part of the reader's question; together they explain it, with cause and effect, not a list of facts.
- Each step: y (a year; negative for BCE), t (a short headline that starts with the year, like "1025: Rajendra's fleet raids Srivijaya"), text (60 to 110 words), r (the regions to show), l (layers to switch on, if any), item (the exact name of one result from a tool to open, or "" if none fits), wiki (the English Wikipedia title that best backs the step).
- In text, link pages of the app inline as [[page|words in the sentence]], using page ids from tool results only, 1 to 4 per step, each page once.
- The item should be what the step is about, in the place where it happens, since the map flies to it.
- Arrows (m): for movements, such as fleets, armies, migrations, trade routes or the spread of a religion, give points [lat, lon] that follow the real route (around coasts and peninsulas at sea, along valleys and passes on land), with at least 3 points for long routes, and a label of up to five words. Leave m empty when nothing moves.
- Regions: ${REG.map(r => r.id + " (" + r.name + ")").join(", ")}. Layers: ${LAYERS.map(l => l.id + " (" + l.name + ")").join(", ")}.

Facts: only well-established ones. Say "about" when a date is approximate, and say so when historians disagree or a claim rests on one source. If the premise of the question is wrong or contested (for example, influence that came through trade and religion rather than conquest), say so in the story and tell what happened instead.

Style: plain words, short sentences, active voice, for a curious reader who is not an expert. Never use em dashes, en dashes, middle dots or arrow characters. No "testament to", "rich tapestry", "pivotal", "Moreover", "Furthermore".`;

const TOOLS = [
  { name: "search", description: "Search the app's items and pages by name or key words. Returns up to 20 results: the exact name (usable as a step's item), its kind, years, regions, its page id (usable in [[page|words]] links), coordinates, and the first lines of its page.",
    input_schema: { type: "object", additionalProperties: false, required: ["query"], properties: {
      query: { type: "string", description: "Names or key words, e.g. 'Chola navy' or 'Srivijaya'" },
      from_year: { type: "integer", description: "Only items alive after this year (negative for BCE)" },
      to_year: { type: "integer", description: "Only items that started before this year" },
      region: { type: "string", enum: REGIDS } } } },
  { name: "browse", description: "List the main items the chart shows in one region over a span of years: states, cultures and notable events.",
    input_schema: { type: "object", additionalProperties: false, required: ["region"], properties: {
      region: { type: "string", enum: REGIDS }, from_year: { type: "integer" }, to_year: { type: "integer" } } } },
  { name: "submit_story", description: "Hand in the finished story. Call it once, at the end.",
    strict: true,   /* the API checks the story against the schema, so it always arrives as valid JSON */
    input_schema: { type: "object", additionalProperties: false, required: ["title", "sub", "stops"], properties: {
      title: { type: "string" }, sub: { type: "string" },
      stops: { type: "array", items: { type: "object", additionalProperties: false, required: ["y", "t", "text", "r", "l", "item", "m", "wiki"], properties: {
        y: { type: "integer" }, t: { type: "string" }, text: { type: "string" },
        r: { type: "array", items: { type: "string", enum: REGIDS } },
        l: { type: "array", items: { type: "string", enum: LAYIDS } },
        item: { type: "string" }, wiki: { type: "string" },
        m: { type: "array", items: { type: "object", additionalProperties: false, required: ["t", "p"], properties: {
          t: { type: "string" }, p: { type: "array", items: { type: "array", items: { type: "number" } } } } } } } } } } } },
];

/* check what came back and make it a story the player can use; problems go back to Claude */
const clean = s => String(s || "").replace(/(\d)\s*[–—]\s*(?=\d)/g, "$1 to ").replace(/\s*[–—]\s*/g, ", ").replace(/[·→←]/g, "").trim();
function toStory(inp, q) {
  const errs = [];
  if (!inp || typeof inp !== "object" || !Array.isArray(inp.stops)) return { errs: ["stops is missing or not a list"] };
  if (inp.stops.length < 3) errs.push("give at least 3 steps");
  const stops = inp.stops.map((st, i) => {
    const y = Math.round(+st.y);
    if (!Number.isFinite(y) || y < START || y > NOW) errs.push(`step ${i + 1}: year ${st.y} is outside ${START} to ${NOW}`);
    const r = (st.r || []).filter(x => REGIDS.includes(x)); if (!r.length) errs.push(`step ${i + 1}: give at least one region`);
    let item = st.item || ""; if (item && !findItem(item)) { errs.push(`step ${i + 1}: item "${item}" is not an exact name from the tools; use one or ""`); item = ""; }
    const m = (st.m || []).filter(a => a && Array.isArray(a.p) && a.p.length >= 2 && a.p.every(pt => Array.isArray(pt) && pt.length === 2 && Math.abs(pt[0]) <= 90 && Math.abs(pt[1]) <= 180))
      .map(a => ({ t: clean(a.t), p: a.p }));
    const out = { t: clean(st.t), text: clean(st.text), y: y === 0 ? 1 : y, r, l: (st.l || []).filter(x => LAYIDS.includes(x)), item };
    if (m.length) out.m = m;
    if (st.wiki) out.src = { t: "Wikipedia: " + st.wiki, u: "https://en.wikipedia.org/wiki/" + encodeURIComponent(st.wiki.replace(/ /g, "_")) };
    for (const mm of String(st.text || "").matchAll(/\[\[([^\]|]+)/g)) if (!KBX[mm[1].trim()]) errs.push(`step ${i + 1}: page "${mm[1]}" does not exist; link only page ids from the tools`);
    return out;
  });
  return { errs, story: { id: "my-" + Date.now().toString(36), title: clean(inp.title) || q, sub: clean(inp.sub), q, stops, draft: true, made: new Date().toISOString().slice(0, 10) } };
}

/* ---------- the conversation with Claude ---------- */
let busy = false;
/* the story being made: Stop on the top bar aborts the request in flight */
const run = { stop: false, stream: null };
async function makeStory(q, log) {
  const { default: Anthropic } = await import(SDK);
  const client = new Anthropic({ apiKey: keyGet(), dangerouslyAllowBrowser: true });
  const messages = [{ role: "user", content: q }];
  let fixes = 0;
  for (let turn = 0; turn < 14; turn++) {
    log(turn ? "Thinking" : "Reading your question");
    /* server-side fallback: if Opus declines on a safety classifier, the API reruns the request on a fallback model */
    let msg = null;
    for (let tries = 0; !msg; tries++) {
      try {
        if (run.stop) throw new Error("STOPPED");
        run.stream = client.beta.messages.stream({
          model: MODEL, max_tokens: 64000, system: SYSTEM, tools: TOOLS, messages,
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
        });
        msg = await run.stream.finalMessage();
      } catch (e) {
        /* a reply whose tool input is not valid JSON: ask again, twice at most. API errors (they have a status) go up */
        if (run.stop) throw new Error("STOPPED");
        if (e && e.status == null && /JSON/i.test(e.message || "") && tries < 2) { log("The reply was garbled, asking again"); continue; }
        throw e;
      }
    }
    messages.push({ role: "assistant", content: msg.content });
    if (msg.stop_reason === "refusal") throw new Error("Claude declined this one. Try wording it differently.");
    if (msg.stop_reason === "max_tokens") throw new Error("The story ran too long. Try a narrower question.");
    const uses = msg.content.filter(b => b.type === "tool_use");
    if (!uses.length) { messages.push({ role: "user", content: "Call submit_story with the finished story." }); continue; }
    const results = []; let done = null;
    for (const u of uses) {
      const inp = u.input && typeof u.input === "object" ? u.input : null;
      let res;
      if (!inp) res = { error: "The tool input was not valid JSON. Send it again." };
      else if (u.name === "search") { log("Searching: " + (inp.query || "")); res = await toolSearch(inp); }
      else if (u.name === "browse") { log(`Looking over ${(REG.find(r => r.id === inp.region) || { name: "the map" }).name}${inp.from_year != null ? ", " + fmt(inp.from_year) + " to " + fmt(inp.to_year ?? NOW) : ""}`); res = await toolBrowse(inp); }
      else if (u.name === "submit_story") {
        log("Checking the story");
        const { errs, story } = toStory(inp, q);
        if (!errs.length || (fixes >= 2 && playable(story))) { done = story; res = { ok: true }; }   /* after two rounds a story with small faults is taken, one that cannot play is not */
        else if (fixes >= 2) throw new Error("Claude could not make a story that fits the map. Try again, or word it differently.");
        else { fixes++; log("Fixing " + errs.length + " problem" + (errs.length > 1 ? "s" : "")); res = { error: "Fix these and call submit_story again with the whole story:\n" + errs.join("\n") }; }
      } else res = { error: "No such tool." };
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(res), ...(res.error ? { is_error: true } : {}) });
    }
    if (done) return done;
    if (run.stop) throw new Error("STOPPED");
    messages.push({ role: "user", content: results });
  }
  throw new Error("Claude did not finish the story. Try again.");
}

/* ---------- the panel: in the Library, and from the search box ---------- */
const box = el("div", "ask");
box.innerHTML = `<div class="askhd"><h3>Ask the map</h3><button class="x" id="askClose" type="button" aria-label="Close">×</button></div>
<p class="askhint">Ask a question or name a topic. Claude picks the years, the map, the arrows and what to show, and makes a story to play.</p>
<textarea id="askQ" rows="2" placeholder="Indian kings conquering Southeast Asia and setting up trade links"></textarea>
<div class="askrow"><button type="button" class="btn pri" id="askGo">Make a story</button><button type="button" class="asklink" id="askKeyBtn">API key</button></div>
<div class="askkey" id="askKeyRow" hidden><input id="askKeyIn" type="password" autocomplete="off" placeholder="Your Anthropic API key">
<button type="button" class="btn" id="askKeySave">Save</button>
<p class="askhint">This part needs your own Anthropic API key, from a paid developer account (<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">get one here</a>). It is kept only in this browser and sent only to Anthropic. A story costs about 10 to 40 cents on your account. <button type="button" class="asklink keyforget">Forget key</button></p><p class="askhint keymsg" hidden></p></div>
<ol class="asklog" id="askLog"></ol>`;
const pop = $("askPop"), btn = $("askBtn"); pop.append(box);
/* the Ask the map button on the top bar opens its own panel; a story being made carries on when it closes */
const setAsk = open => { pop.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); if (open) { setStories(false); setTimeout(() => (keyRow.hidden ? $("askQ") : $("askKeyIn")).focus(), 0); } };
/* Escape closes this panel first, before the card or the story behind it */
document.addEventListener("keydown", e => { if (e.key === "Escape" && pop.classList.contains("open")) { e.stopPropagation(); setAsk(false); btn.focus(); } }, true);
btn.addEventListener("click", e => { e.stopPropagation(); setAsk(!pop.classList.contains("open")); });
$("askClose").addEventListener("click", () => setAsk(false));
document.addEventListener("click", e => { if (pop.classList.contains("open") && !pop.contains(e.target) && !btn.contains(e.target)) setAsk(false); });
const askQ = $("askQ"), askLog = $("askLog"), keyRow = $("askKeyRow");
const showKey = on => { keyRow.hidden = !on; if (on) { $("askKeyIn").value = keyGet(); $("askKeyIn").focus(); } };
$("askKeyBtn").addEventListener("click", () => showKey(keyRow.hidden));
$("askKeySave").addEventListener("click", () => { if (!keySave(keyRow)) return; showKey(false); if (keyGet() && askQ.value.trim() && !busy) go(); });
askQ.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } });
$("askGo").addEventListener("click", () => go());
/* while a story is being made, the top bar shows a spinner and the current step; on hover, a stop button */
const runPill = el("div", "askrun"); runPill.hidden = true;
runPill.innerHTML = `<button type="button" class="askrun-open" title="Show Ask the map"><span class="askspin" aria-hidden="true"></span><span class="askrun-t"></span></button><button type="button" class="askrun-x" aria-label="Stop making the story" title="Stop">×</button>`;
$("moreBtn").before(runPill);
runPill.querySelector(".askrun-open").addEventListener("click", e => { e.stopPropagation(); setAsk(true); });
runPill.querySelector(".askrun-x").addEventListener("click", e => { e.stopPropagation(); run.stop = true; try { run.stream && run.stream.abort(); } catch (x) {} runPill.querySelector(".askrun-t").textContent = "Stopping"; });
const runShow = t => { runPill.hidden = t == null; if (t != null) { runPill.querySelector(".askrun-t").textContent = t; runPill.title = t; } };
async function go(q) {
  q = (q ?? askQ.value).trim(); if (!q || busy) return;
  askQ.value = q;
  if (!keyGet()) { showKey(true); return; }
  busy = true; $("askGo").disabled = true; $("askGo").textContent = "Making the story"; askLog.innerHTML = "";
  const log = t => { const li = el("li", null, t); askLog.append(li); askLog.scrollTop = askLog.scrollHeight; runShow(t); };
  run.stop = false; run.stream = null; runShow("Reading your question");
  try {
    const s = await makeStory(q, log);
    log("Done: " + s.stops.length + " steps");
    STORYS.push(s);
    if (story) log("It is ready. Find it in the Library, under Your stories.");   /* another story is open: do not take the screen from it */
    else { setAsk(false); startStory(s, 0); }
  } catch (e) {
    if (run.stop) { askLog.append(el("li", "askerr", "Stopped. Nothing was kept.")); return; }
    const m = errText(e);
    const li = el("li", "askerr", m); askLog.append(li);
  } finally { busy = false; run.stream = null; runShow(null); $("askGo").disabled = false; $("askGo").textContent = "Make a story"; }
}

/* ---------- Ask about this: a chat on an item's card, for follow-up questions ----------
   Claude gets the card (name, years, place, the page's text and the pages it links) and the search tool, and answers in
   plain prose with [[page|words]] links to items that exist. A thread lasts until the page is reloaded. */
const CHATSYS = `You answer a reader's follow-up questions about one item in a world history app: a timeline chart of eight world regions with a map. The reader is looking at the item's card, which is given to you below. Many people, places, states, events and things in the app have a page.

How to answer:
- Answer the question directly, in organic prose, the way a well-read friend would explain it in conversation: 2 to 4 short paragraphs, about 80 to 220 words. No headings, no bullet lists unless the reader asks for a list, no preamble ("Great question"), no summary at the end.
- Go beyond the card: add the context, causes, consequences, comparisons and telling details that make the answer worth reading. Don't repeat the card back.
- Link pages of the app inline as [[page-id|words in your sentence]] whenever you mention a person, place, state, event or thing that has a page. Use ids from the card's list of linked pages, or from search results; never make up an id. Link each page once per answer, and don't link the item itself.
- The reader's map follows your links in the order you write them: the year line, the map and the open card move to each linked page in turn. So link the people, places, states and events the answer turns on, at the point where each comes up, and leave out links that would send the map off the point.
- Before you write, call the search tool for the names you plan to mention that are not in the card's list (several searches in one turn is fine). Don't write anything before the searches.
- Facts: only well-established ones. Say "about" for approximate dates, and say so when historians disagree or a claim rests on one source. If the question's premise is wrong, say so kindly and give what happened.
- Style: plain words, short sentences, active voice. Never use em dashes, en dashes, middle dots or arrow characters. No "testament to", "rich tapestry", "pivotal", "Moreover", "Furthermore".`;
const CHATTOOLS = [TOOLS[0]];
const THREADS = new Map();
/* ---------- the answer drives the map ----------
   While an answer is written, each page it links is opened in turn: the year line, the map and the card move to it, and the
   conversation goes along, at the top of each card. A click on a link in the answer does the same. Any click, key or scroll
   ends the tour. Opening a card some other way leaves the conversation on the card it was asked on. */
const FOLLOW = "history.askfollow", DWELL = 3500;
const followOn = () => { try { return localStorage.getItem(FOLLOW) !== "off"; } catch (e) { return true; } };
let CARRY = null, carryNext = null;                /* the conversation that travels with the reader; the one the next card is to take */
const tour = { th: null, turn: null, q: [], got: new Set(), t: 0, last: 0, done: false };
const cardName = (obj, kid) => (kid && KBX[kid] && KBX[kid].name) || (obj && (obj.name || obj.n)) || "this";
function markNow(th, show) {
  if (!th.box) return; const last = th.box.querySelector(".chlog .cha:last-child"); let first = null;
  for (const a of th.box.querySelectorAll(".cha a.kbl")) { const on = CARRY === th && !!th.now && a.dataset.k === th.now; a.classList.toggle("now", on);
    if (on && (!first || (last && last.contains(a) && !last.contains(first)))) first = a; }
  if (show && first) first.scrollIntoView({ block: "nearest" });
}
function visit(th, id) {
  const o = kbTarget(id); if (!o) return;
  carryNext = th; th.now = id;
  try { goTo(o); } finally { carryNext = null; }
  markNow(th, true);
}
function tourStop() { clearTimeout(tour.t); tour.t = 0; tour.th = tour.turn = null; tour.q = []; tour.done = false; }
function tourStart(th, turn) { tourStop(); if (!followOn() || story) return; tour.th = th; tour.turn = turn; tour.got = new Set(); tour.last = 0; }
function tourReset(th) { if (tour.th !== th) return; for (const id of tour.q) tour.got.delete(id); tour.q = []; }   /* text written before a search is thrown away, and its links with it */
function tourFeed(th, turn, done) {
  if (tour.th !== th || tour.turn !== turn) return;
  for (const m of turn.a.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) { const id = m[1].trim(); if (tour.got.has(id) || id === th.kid || !kbTarget(id)) continue; tour.got.add(id); tour.q.push(id); }
  if (done) tour.done = true;
  tourStep();
}
function tourStep() {
  if (!tour.th || tour.t) return;
  if (!tour.q.length) { if (tour.done) tourStop(); return; }
  tour.t = setTimeout(() => { tour.t = 0; const th = tour.th; if (!th) return;
    if (story || !document.body.contains(th.box)) { tourStop(); return; }   /* a story took the screen, or the card was closed */
    tour.last = performance.now(); visit(th, tour.q.shift()); tourStep(); }, Math.max(0, tour.last + DWELL - performance.now()));
}
for (const ev of ["pointerdown", "keydown", "wheel", "touchmove"]) document.addEventListener(ev, () => { if (tour.th) tourStop(); }, { capture: true, passive: true });
/* a link in an answer takes the conversation along to the card it opens */
const chatLink = e => { const a = e.target.closest && e.target.closest(".ichat .cha a.kbl:not(.miss)"), th = a && a.closest(".ichat").__th; return th && !e.shiftKey ? { a, th } : null; };
const takeAlong = e => { const c = chatLink(e); if (!c) return; carryNext = c.th; c.th.now = c.a.dataset.k; setTimeout(() => { carryNext = null; markNow(c.th); }, 0); };
document.addEventListener("click", takeAlong, true);
document.addEventListener("keydown", e => { if (e.key === "Enter") takeAlong(e); }, true);
function dropCarry(th, chat) {
  tourStop(); CARRY = null; th.box.classList.remove("carry");
  if (state.sel) { MAP.keepYear = true; try { select(state.sel); } finally { MAP.keepYear = false; } if (chat) openItemChat(); }
}
function fromDraw(th) {
  const p = th.box.querySelector(".chfrom"), away = CARRY === th && th.at !== th.obj; p.hidden = !away; p.textContent = ""; if (!away) return;
  const b = el("button", "asklink", cardName(th.obj, th.kid)); b.type = "button"; b.title = "Back to the card this was asked on";
  b.addEventListener("click", () => { carryNext = th; th.now = th.kid; try { (th.obj.terr ? select : goTo)(th.obj); } finally { carryNext = null; } });
  const x = el("button", "asklink", "Hide"); x.type = "button"; x.title = "Take this conversation off the card";
  x.addEventListener("click", () => dropCarry(th));
  const s = el("span"); s.append("Asked about ", b); p.append(s, x);
}
const stripHtml = h => { const d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent.replace(/\s+\n/g, "\n").trim(); };
async function cardContext(obj, kid) {
  const P = kid && KBX[kid], name = (P && P.name) || obj.name || obj.n;
  const lines = ["Item: " + name];
  const when = P ? kbWhen(P) : obj.pt ? fmt(obj.y) : obj.s != null ? `${fmt(obj.s)} to ${fmt(obj.e)}` : obj.a != null ? fmt(obj.a) : "";
  if (when) lines.push("When: " + when);
  const reg = obj.reg ? regName(obj.reg) : obj.r ? obj.r.map(regName).join(", ") : "";
  if (reg) lines.push("Region: " + reg);
  if (P && (P.kind || KBTYPE[P.t])) lines.push("Kind: " + (P.kind || KBTYPE[P.t]));
  if (kid) lines.push("Its page id: " + kid);
  const tx = kid ? await kbText(kid) : null;
  const text = tx && tx.html ? stripHtml(tx.html) : (obj.note || obj.t || "");
  if (text) lines.push("", "The card's text:", text);
  const ids = [...new Set([...(tx && tx.links || []), ...Object.values(tx && tx.rel || {}).flat(), ...(tx && tx.back || [])])].filter(i => KBX[i] && KBX[i].t !== "stub" && i !== kid);
  if (ids.length) lines.push("", "Pages linked from or to this card (id: name):", ...ids.slice(0, 60).map(i => `${i}: ${KBX[i].name}`));
  return { name, text: lines.join("\n") };
}
/* the answer as paragraphs with live links; a link to an id the app does not have stays plain words */
function renderAnswer(t, self) {
  const frag = document.createDocumentFragment();
  t = String(t).replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2").replace(/\s*[–—]\s*/g, ", ").replace(/[·→←]/g, "");
  for (const para of t.split(/\n\s*\n/)) {
    if (!para.trim()) continue;
    const p = el("p");
    const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*/g; let i = 0, m;
    while ((m = re.exec(para))) {
      p.append(para.slice(i, m.index)); i = re.lastIndex;
      if (m[1] != null) { const id = m[1].trim(), words = m[2] || kbName(id);
        if (id !== self && kbTarget(id)) { const a = el("a", "kbl", words); a.dataset.k = id; kbDress(a); p.append(a); } else p.append(words); }
      else p.append(el(m[3] != null ? "b" : "i", null, m[3] ?? m[4]));
    }
    p.append(para.slice(i)); frag.append(p);
  }
  return frag;
}
function drawThread(th) {
  const box = th.box; if (!box) return;
  const log = box.querySelector(".chlog"); log.textContent = "";
  for (const t of th.turns) {
    log.append(el("div", "chq", t.q));
    const a = el("div", "cha"); if (t.a) a.append(renderAnswer(t.a, th.kid));
    if (t.status && !t.a) a.append(el("p", "chst", t.status));
    if (t.err) a.append(el("p", "askerr", t.err));
    log.append(a);
  }
  box.querySelector(".chnew").hidden = !th.turns.length || th.busy;
  box.querySelector(".chsend").disabled = th.busy;
  box.querySelector(".chfollow").textContent = "Follow on the map: " + (followOn() ? "on" : "off");
  markNow(th);
}
async function askItem(th, q) {
  if (!keyGet()) { th.box.querySelector(".chkey").hidden = false; th.box.querySelector(".chkey input").focus(); th.pending = q; return; }
  const turn = { q, a: "", status: "Reading the card" }; th.turns.push(turn); th.busy = true; drawThread(th); tourStart(th, turn);
  const n0 = th.messages.length;                   /* a turn that fails is taken out whole, so the next question starts from a sound thread */
  try {
    if (!th.messages.length) { const c = await cardContext(th.obj, th.kid); th.messages.push({ role: "user", content: "Here is the card the reader is looking at.\n\n" + c.text + "\n\nThe reader asks: " + q }); }
    else { const moved = CARRY === th && th.at !== (th.told || th.obj); th.told = th.at;   /* the reader may have followed the answer to another card */
      th.messages.push({ role: "user", content: (moved ? `(The reader has moved on and now has the card of ${cardName(th.at, th.atKid)} open${th.atKid ? ", page id " + th.atKid : ""}.)\n\n` : "") + q }); }
    const { default: Anthropic } = await import(SDK);
    const client = new Anthropic({ apiKey: keyGet(), dangerouslyAllowBrowser: true });
    for (let n = 0; n < 6; n++) {
      tourReset(th); turn.a = ""; turn.status = n ? "Writing" : "Thinking"; drawThread(th);
      const st = client.beta.messages.stream({ model: MODEL, max_tokens: 8000, system: CHATSYS, tools: CHATTOOLS, messages: th.messages,
        output_config: { effort: "low" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
      st.on("text", d => { turn.a += d; drawThread(th); tourFeed(th, turn); });
      const msg = await st.finalMessage();
      th.messages.push({ role: "assistant", content: msg.content });
      if (msg.stop_reason === "refusal") throw new Error("Claude declined this one. Try asking it differently.");
      const uses = msg.content.filter(b => b.type === "tool_use");
      if (!uses.length) { turn.a = msg.content.filter(b => b.type === "text").map(b => b.text).join(""); turn.status = ""; if (msg.stop_reason === "max_tokens") turn.a += "\n\n(The answer was cut off here. Ask for the rest.)"; tourFeed(th, turn, true); break; }
      turn.a = ""; turn.status = "Looking up " + uses.map(u => (u.input && u.input.query) || "").filter(Boolean).join(", ");
      drawThread(th);
      const results = [];
      for (const u of uses) { const res = u.input && typeof u.input === "object" ? await toolSearch(u.input) : { error: "The input was not valid JSON." };
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(res), ...(res.error ? { is_error: true } : {}) }); }
      th.messages.push({ role: "user", content: results });
    }
    if (!turn.a) throw new Error("No answer came back. Try again.");
  } catch (e) {
    turn.status = ""; turn.err = errText(e); if (tour.th === th) tourStop();
    th.messages.length = n0;
  } finally { th.busy = false; drawThread(th); }
}
window.itemChat = (obj, kid) => {
  /* a card opened from an answer (the tour, a link in it, or Back and Forward between such cards) keeps that conversation, at its top */
  const nav = typeof hxNav !== "undefined" && hxNav;
  const c = carryNext || (CARRY && (obj === CARRY.at || (nav && CARRY.seen.has(obj))) ? CARRY : null); carryNext = null;
  if (c && c.box && c.turns.length) {
    CARRY = c; c.at = obj; c.atKid = kid; c.seen.add(obj); if (nav) c.now = kid;
    c.box.classList.add("carry"); c.box.hidden = false; fromDraw(c); drawThread(c);
    return c.box;
  }
  if (CARRY) { tourStop(); if (CARRY.box) CARRY.box.classList.remove("carry"); CARRY = null; }
  const key = kid || obj; let th = THREADS.get(key);
  if (!th) { th = { obj, kid, turns: [], messages: [], busy: false, seen: new Set([obj]), now: null }; THREADS.set(key, th); }
  th.at = obj; th.atKid = kid;
  const name = (kid && KBX[kid] && KBX[kid].name) || obj.name || obj.n || "this";
  const box = el("section", "ichat"); box.hidden = !th.turns.length;
  box.innerHTML = `<h3 class="sronly">Ask about this</h3><p class="chfrom" hidden></p><div class="chlog"></div>
<div class="chin"><textarea rows="1" placeholder="Ask a follow-up question"></textarea><button type="button" class="btn pri chsend">Ask</button></div>
<div class="chkey" hidden><input type="password" autocomplete="off" placeholder="Your Anthropic API key"><button type="button" class="btn">Save</button>
<p class="askhint">This part needs your own Anthropic API key, from a paid developer account (<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">get one here</a>). It is kept only in this browser and sent only to Anthropic. An answer costs about 2 to 5 cents on your account. <button type="button" class="asklink keyforget">Forget key</button></p><p class="askhint keymsg" hidden></p></div>
<div class="chfoot"><button type="button" class="asklink chnew">New chat</button><button type="button" class="asklink chkeyb">API key</button><button type="button" class="asklink chfollow" title="While Claude answers, the year, the map and the card move to each thing the answer links"></button></div>`;
  box.querySelector("textarea").setAttribute("aria-label", "Ask a follow-up question about " + name);
  th.box = box; box.__th = th;
  box.querySelector(".chfollow").addEventListener("click", () => { const on = !followOn(); try { localStorage.setItem(FOLLOW, on ? "on" : "off"); } catch (e) {} if (!on) tourStop(); drawThread(th); });
  const ta = box.querySelector("textarea"), send = () => { const q = ta.value.trim(); if (!q || th.busy) return; if (keyGet()) { ta.value = ""; ta.style.height = ""; } askItem(th, q); };   /* with no key yet the question stays in the box */
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  ta.addEventListener("input", () => { ta.style.height = ""; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; });
  box.querySelector(".chsend").addEventListener("click", send);
  box.querySelector(".chnew").addEventListener("click", () => { th.turns = []; th.messages = []; th.told = null; th.now = null;
    if (CARRY === th) { dropCarry(th, true); return; }   /* the next question belongs to the card that is open now */
    drawThread(th); ta.focus(); });
  const kr = box.querySelector(".chkey");
  box.querySelector(".chkeyb").addEventListener("click", () => { kr.hidden = !kr.hidden; if (!kr.hidden) { kr.querySelector("input").value = keyGet(); kr.querySelector("input").focus(); } });
  kr.querySelector("button").addEventListener("click", () => { if (!keySave(kr)) return; kr.hidden = true; if (th.pending && keyGet()) { const q = th.pending; th.pending = null; ta.value = ""; ta.style.height = ""; askItem(th, q); } });
  drawThread(th);
  return box;
};
/* the chat button on a card opens its chat and puts the cursor in it */
window.openItemChat = () => { const box = document.querySelector("#detail .ichat"); if (!box) return; box.hidden = false; box.scrollIntoView({ block: "nearest", behavior: "smooth" }); box.querySelector("textarea").focus(); };
window.askTheMap = q => { setAsk(true); go(q); };
window.__ask = { toolSearch, toolBrowse, toStory, TOOLS, SYSTEM };   /* for tests */

/* Save, export and delete, shown on the story card of a story made here */
window.storyOwnRow = s => {
  if (!s.draft && !s.mine) return null;
  const row = el("div", "sown");
  const b = (t, f) => { const x = el("button", "btn", t); x.type = "button"; x.addEventListener("click", f); row.append(x); };
  if (s.draft) b("Save as story", () => { delete s.draft; s.mine = true; const L = mine().filter(x => x.id !== s.id); const { mine: _, ...plain } = s; L.push(plain);
    if (!putMine(L)) { s.draft = true; delete s.mine; alert("This browser would not store the story (private mode, or storage is full). Use Export to keep it as a file."); }
    drawStoryCard(); });
  b("Export", () => { const { draft, mine: _, ...plain } = s; const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(plain, null, 1)], { type: "application/json" })); a.download = s.id + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  b(s.draft ? "Discard" : "Delete", () => { putMine(mine().filter(x => x.id !== s.id)); const i = STORYS.indexOf(s); if (i >= 0) STORYS.splice(i, 1); endStory(); });
  row.append(el("span", null, s.draft ? "Made by Claude, not saved yet" : "Saved in the Library, in this browser"));
  return row;
};
})();
