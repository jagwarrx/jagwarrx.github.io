/* Connections: two things you would not expect to be linked.
   A connection is a pair of pages and the sentence of one that links the other. The Library offers surprising ones, picked
   by connections-build.py from the pages' own links (connections.js), and keeps the ones the reader saves, in this browser.
   A card reached through a link offers to save that pair too. A connection plays as a story of two steps: the first page
   with the sentence, then the second, with a line between their places on the map. */
(() => {
const SAVED = "history.myconnections";
const LIST = (typeof CONNECTIONS !== "undefined" ? CONNECTIONS : []).map(c => ({ a: c[0], b: c[1], text: c[2] }));
const idOf = o => (o && (o.kb || KBOF.get(o))) || null;
const key = c => [c.a, c.b].sort().join("--");
const plain = t => String(t || "").replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, "$1").replace(/\[\[([^\]]*)\]\]/g, "$1");
const title = c => kbName(c.a) + " and " + kbName(c.b);
const live = c => !!(kbTarget(c.a) && kbTarget(c.b));

/* ---------- the ones kept in this browser ---------- */
const saved = () => { try { const L = JSON.parse(localStorage.getItem(SAVED) || "[]");
  return Array.isArray(L) ? L.filter(c => c && typeof c.a === "string" && typeof c.b === "string" && typeof c.text === "string") : []; } catch (e) { return []; } };
const put = L => { try { localStorage.setItem(SAVED, JSON.stringify(L)); return true; } catch (e) { return false; } };
const isSaved = c => saved().some(x => key(x) === key(c));
function keep(c) {
  if (isSaved(c)) return true;
  const ok = put([{ a: c.a, b: c.b, text: c.text, at: new Date().toISOString().slice(0, 10) }, ...saved()]);
  if (!ok) alert("This browser would not store the connection (private mode, or storage is full).");
  return ok;
}
const drop = c => put(saved().filter(x => key(x) !== key(c)));

/* ---------- the sentence of one page that links another ---------- */
function linkSentence(html, target) {
  const d = document.createElement("div"); d.innerHTML = html || "";
  for (const a of d.querySelectorAll("a.kbl")) {
    if (a.dataset.k !== target) continue;
    const blk = (a.closest("p,li,blockquote") || d).cloneNode(true);
    blk.querySelectorAll("a.kbl").forEach(x => x.replaceWith("[[" + x.dataset.k + "|" + x.textContent + "]]"));
    const ss = storySentences(blk.textContent.trim()).map(s => s.trim()), k = ss.findIndex(s => s.includes("[[" + target + "|"));
    if (k < 0) continue;
    let out = ss[k];
    if (k && out.length < 80 && ss[k - 1].length + out.length < 430) out = ss[k - 1] + " " + out;   /* a short sentence leans on the one before */
    return out.length > 600 ? out.slice(0, 600) : out;
  }
  return null;
}
/* the connection between two pages, whichever of them links the other; null when neither does */
async function between(a, b) {
  const known = [...saved(), ...LIST].find(c => key(c) === key({ a, b })); if (known) return known;
  for (const [x, y] of [[a, b], [b, a]]) { const tx = await kbText(x), t = tx && (tx.links || []).includes(y) ? linkSentence(tx.html, y) : null; if (t) return { a: x, b: y, text: t }; }
  return null;
}

/* ---------- a connection as a story of two steps ---------- */
function yearOf(id) { const P = KBX[id] || {}, o = kbTarget(id) || {}, y = P.y ?? (o.pt ? o.y : o.s ?? o.y ?? o.a); return y != null && isFinite(y) ? Math.max(START, Math.min(NOW, y === 0 ? 1 : y)) : null; }
const regsOf = id => { const o = kbTarget(id) || {}; return (o.reg ? [o.reg] : o.r || []).filter(okReg); };
const placeOf = id => { const P = KBX[id] || {}, o = kbTarget(id); if (P.ll) return P.ll; const g = o && typeof geoOf === "function" ? geoOf(o) : null; return g ? [g[1], g[0]] : null; };
/* what a page says of itself, in whole sentences: its summary, cut back to the last full stop when it was shortened */
function intro(tx) {
  let s = String((tx && tx.sum) || "").trim(); if (!s) return "";
  if (/(…|\.\.\.)$/.test(s)) { const ss = storySentences(s.replace(/(…|\.\.\.)$/, "")).map(x => x.trim()); ss.pop(); s = ss.join(" "); }
  return s;
}
/* the second step needs the other page's own words, which load with its text */
async function cxStoryOf(c) { const tx = live(c) ? await kbText(c.b) : null; return cxStory(c, intro(tx)); }
function cxStory(c, second) {
  if (!live(c)) return null;
  const ya = yearOf(c.a) ?? yearOf(c.b), yb = yearOf(c.b) ?? ya; if (ya == null) return null;
  const r = [...new Set([...regsOf(c.a), ...regsOf(c.b)])], pa = placeOf(c.a), pb = placeOf(c.b);
  const m = pa && pb && Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) > 1 ? { m: [{ t: "", p: [pa, pb], line: true }] } : {};
  const about = second || kbName(c.b) + " is the other end of this connection.";
  return { id: "cx-" + c.a + "--" + c.b, title: title(c), sub: "A connection", cx: c, stops: [
    { k: c.a, item: "", t: kbName(c.a), text: c.text, y: ya, r, l: [], ...m },
    { k: c.b, item: "", t: kbName(c.b), text: about, y: yb, r, l: [], ...m }] };
}
async function play(c) { const s = await cxStoryOf(c); if (!s) return false; if (typeof setStories === "function") setStories(false); startStory(s, 0); return true; }

/* ---------- surprising ones, one at a time ---------- */
const shown = new Set();
function pick() {
  let pool = LIST.filter(c => live(c) && !isSaved(c) && !shown.has(key(c)));
  if (!pool.length) { shown.clear(); pool = LIST.filter(c => live(c) && !isSaved(c)); }
  const c = pool[Math.floor(Math.random() * pool.length)] || null; if (c) shown.add(key(c));
  return c;
}

/* under the story card of a connection: keep it, or see another */
const ownRow = window.storyOwnRow;
window.storyOwnRow = s => {
  if (!s.cx) return ownRow ? ownRow(s) : null;
  const row = el("div", "sown"), c = s.cx, has = isSaved(c);
  const b = (t, f) => { const x = el("button", "btn", t); x.type = "button"; x.addEventListener("click", f); row.append(x); };
  b(has ? "Remove" : "Save connection", () => { if (has) drop(c); else keep(c); drawStoryCard(); });
  if (LIST.length) b("Another", () => { const n = pick(); if (n) play(n); });
  row.append(el("span", null, has ? "Saved in the Library, under Connections" : "Not saved"));
  return row;
};

/* ---------- the Library section ---------- */
window.cxLibrary = sec => {
  const S = saved().filter(live), D = sec("connections", "Connections", S.length);
  D.append(el("p", "spint", "Two things you would not expect to be linked. Each one plays in two steps on the chart and the map. Save the ones worth keeping."));
  if (LIST.length) {
    const box = el("div", "cxfind"); D.append(box);
    const draw = c => { box.textContent = ""; if (!c) { box.append(el("p", null, "No more for now.")); return; }
      const row = el("div", "cxrow"), b = (t, cls, f) => { const x = el("button", "btn" + (cls ? " " + cls : ""), t); x.type = "button"; x.addEventListener("click", e => { e.stopPropagation(); f(x); }); row.append(x); };
      b("Show it", "pri", () => play(c));
      b(isSaved(c) ? "Saved" : "Save", "", () => { if (keep(c)) setStories(true); });
      b("Another", "", () => draw(pick()));
      box.append(el("b", null, title(c)), el("p", null, plain(c.text)), row); };
    draw(pick());
  }
  D.append(el("div", "sbook", "Your connections"));
  if (!S.length) D.append(el("p", "cxnone", "None saved yet. Save one above, or use Save this connection on a card you reached through a link."));
  for (const c of S) {
    const b = el("button", "sitem"); b.type = "button"; const t = plain(c.text);
    b.append(el("b", null, title(c)), el("span", null, t.length > 130 ? t.slice(0, 128).replace(/\s+\S*$/, "") + "..." : t));
    b.addEventListener("click", () => play(c)); D.append(b);
  }
};

/* ---------- on a card reached through a link: keep that pair ---------- */
const select0 = select;
select = function (obj) {
  select0(obj);
  try {
    const back = obj && $("detail").querySelector(":scope > .cback"), prev = typeof hpos !== "undefined" && hpos > 0 ? HX[hpos - 1] : null, a = idOf(prev), b = idOf(obj);
    if (!back || !a || !b || a === b || (typeof story !== "undefined" && story)) return;
    between(a, b).then(c => {
      if (!c || state.sel !== obj || !back.isConnected || $("detail").querySelector(".cxsave")) return;
      const btn = el("button", "cxsave"); btn.type = "button";
      const draw = () => { const has = isSaved(c); btn.textContent = has ? "Connection saved" : "Save this connection"; btn.classList.toggle("on", has);
        btn.title = has ? "In the Library, under Connections. Click to remove it" : "Keep the link between " + title(c) + " in the Library"; };
      btn.addEventListener("click", () => { if (isSaved(c)) drop(c); else keep(c); draw(); });
      draw(); back.after(btn);
    });
  } catch (e) { console.warn("connections", e); }
};

/* a link to a connection: st=cx-<id>--<id>.<step> */
{ const m = (Q.get("st") || "").match(/^cx-([a-z0-9-]+?)--([a-z0-9-]+)\.(\d+)$/);
  if (m && !story && kbTarget(m[1]) && kbTarget(m[2])) between(m[1], m[2]).then(c => c && cxStoryOf(c.a === m[1] ? c : { a: m[1], b: m[2], text: c.text })).then(s => { if (!s || story) return;
    startStory(s, +m[3] - 1, false); setTimeout(() => { if (story && story.s === s) showStop(); }, 900); }); }

const css = document.createElement("style");
css.textContent = `.cxfind{border:1px solid var(--line-strong);border-radius:10px;padding:10px 12px;margin:6px 0 10px;background:var(--bg)}
.cxfind b{display:block;font-size:15px;font-weight:600;margin-bottom:4px}
.cxfind p{margin:0 0 9px;font-size:13.5px;line-height:1.45}
.cxrow{display:flex;gap:6px;flex-wrap:wrap}
.cxrow .btn{height:30px;font-size:13px;padding:0 11px}
.cxnone{margin:2px 2px 8px;font-size:13px;color:var(--muted);line-height:1.4}
.cxsave{display:inline-flex;align-items:center;margin:0 0 7px 12px;border:0;background:none;color:var(--accent);font:inherit;font-size:12.5px;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.cxsave.on{color:var(--muted)}`;
document.head.append(css);
window.__cx = { LIST, saved, between, cxStory, cxStoryOf, play, pick };   /* for tests */
})();
