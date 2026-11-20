/* The sidebar, as in Roam Research: shift-click a link (in a card, a story, the search results or the sidebar
   itself) and its page opens in a column on the right, newest on top, while the chart and the card stay put.
   A plain click on a link inside the sidebar goes there on the chart. The open pages are kept in this browser. */
(() => {
const LS = "history.sidebar", MAX = 20;
const app = document.querySelector(".app");
const bar = el("aside", "pins"); bar.id = "pins"; bar.setAttribute("aria-label", "Sidebar");
app.append(bar);

let open = [];                                   /* [{k: page id, c: collapsed}] newest first */
try { open = (JSON.parse(localStorage.getItem(LS)) || []).filter(p => p && kbTarget(p.k) || (p && KBX[p.k])); } catch (e) {}
const save = () => { try { localStorage.setItem(LS, JSON.stringify(open)); } catch (e) {} };

/* the page id behind a link id or a chart item */
const pageOf = id => KBX[id] ? id : (() => { const o = kbTarget(id); return o && (o.kb || KBOF.get(o)) || null; })();

function pin(id){
  const k = pageOf(id) || id; if (!KBX[k] && !kbTarget(k)) return;
  open = [{k, c:false}, ...open.filter(p => p.k !== k)].slice(0, MAX);
  document.body.classList.remove("pinhide");
  save(); draw(); bar.scrollTop = 0;
}
/* on a narrow laptop the kept pages cover the card (see the CSS): this button, at the top of the side panel, brings them back */
const tab = el("button", "pintab"); tab.type = "button"; tab.addEventListener("click", () => document.body.classList.remove("pinhide"));
document.getElementById("side").prepend(tab);
document.body.classList.add("pinhide");            /* a visit starts on the card, not under the kept pages */
window.pinsHide = () => document.body.classList.add("pinhide");
window.sidebarOpen = pin;
window.pinOfObj = o => { const k = o && (o.kb || KBOF.get(o)); if (k) pin(k); return !!k; };

function card(p){
  const id = p.k, P = KBX[id], o = kbTarget(id);
  const c = el("section", "pin" + (p.c ? " shut" : "")); c.dataset.k = id;
  const hd = el("div", "pinhd");
  const tg = el("button", "pintg"); tg.type = "button"; tg.setAttribute("aria-expanded", !p.c); tg.title = p.c ? "Expand" : "Collapse";
  tg.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  tg.addEventListener("click", () => { p.c = !p.c; save(); draw(); });
  const t = el("a", "pint", P ? P.name : kbName(id)); t.tabIndex = 0; t.setAttribute("role", "link"); t.title = "Show it on the chart";
  t.addEventListener("click", () => kbGo(id));
  t.addEventListener("keydown", e => { if (e.key === "Enter") kbGo(id); });
  const x = el("button", "x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close " + (P ? P.name : id));
  x.addEventListener("click", () => { open = open.filter(q => q.k !== id); save(); draw(); });
  hd.append(tg, t, x); c.append(hd);
  if (p.c) return c;

  const body = el("div", "pinbd"); c.append(body);
  const when = P ? kbWhen(P) : o ? (o.pt ? fmt(o.y) : o.s != null ? `${fmt(o.s)} to ${fmt(o.e)}` : o.a != null ? fmt(o.a) : "") : "";
  const meta = el("div", "meta"); meta.append(el("span", null, P ? (P.kind || KBTYPE[P.t]) : "On the chart"));
  if (when) meta.append(el("b", null, when));
  if (P && kbWhere(id)) meta.append(el("span", null, kbWhere(id)));
  body.append(meta);
  if (P && P.t === "stub") body.append(el("p", "warn", "No page yet. The pages that mention it are listed below."));
  kbText(id).then(tx => {
    if (!c.isConnected) return;
    if (!tx){ if (o && o.note) body.append(el("p", null, o.note)); return; }
    if (tx.html){ const box = el("div", "kbt"); box.innerHTML = tx.html; box.querySelectorAll("a.kbl").forEach(kbDress); if (P && P.t === "voice") box.classList.add("voice");
      body.append(box, el("p", "kbai", P && P.t === "voice" ? "The quoted words are copied from the source named below. The introduction was written with Claude and is not fact-checked." : "Written with Claude from general knowledge and not fact-checked. Check it before you rely on it.")); }
    const extra = el("div", "kbx");
    for (const [k, ids] of Object.entries(tx.rel || {})){
      const line = el("p", "kbrel"); line.append(el("b", null, (KBREL[k] || k) + " "));
      ids.forEach((t, i) => { if (i) line.append(", "); line.append(kbLink(t)); }); extra.append(line);
    }
    if (tx.srcText){ const line = el("p", "kbrel"); line.append(el("b", null, "Sources "), tx.srcText.join("; "));
      if (tx.url){ const a = el("a", null, "Read it there"); a.href = tx.url; a.target = "_blank"; a.rel = "noopener"; line.append(". ", a); }
      extra.append(line); }
    { const bb = kbBackBox(tx.back); if (bb) extra.append(bb); }
    body.append(extra);
  });
  return c;
}

function draw(){
  bar.textContent = "";
  document.body.classList.toggle("pinned", open.length > 0);
  if (!open.length) return;
  const hd = el("div", "pinsbar");
  hd.append(el("h2", null, "Sidebar"));
  const back = el("button", "btn pinall pinback", "Show the card"); back.type = "button"; back.addEventListener("click", () => document.body.classList.add("pinhide"));
  const all = el("button", "btn pinall", "Close all"); all.type = "button";
  all.addEventListener("click", () => { open = []; save(); draw(); });
  hd.append(back, all); bar.append(hd);
  tab.textContent = open.length === 1 ? "1 page kept open" : open.length + " pages kept open";
  for (const p of open) bar.append(card(p));
}

/* shift-click on any page link or backlink pill opens it here; runs before the cards' own click handlers */
document.addEventListener("click", e => {
  if (!e.shiftKey) return;
  const a = e.target.closest("a.kbl:not(.miss), .kbp[data-k], .pint");
  if (!a) return;
  e.preventDefault(); e.stopPropagation();
  pin(a.dataset.k || a.closest(".pin").dataset.k);
}, true);
/* shift-click selects text in some browsers: stop that on links */
document.addEventListener("mousedown", e => { if (e.shiftKey && e.target.closest("a.kbl, .kbp[data-k]")) e.preventDefault(); }, true);
/* a plain click on a link in the sidebar goes there on the chart */
bar.addEventListener("click", e => { const a = e.target.closest("a.kbl"); if (a && !e.shiftKey && !a.classList.contains("miss")){ e.preventDefault(); kbGo(a.dataset.k); } });
bar.addEventListener("keydown", e => { const a = e.key === "Enter" && e.target.closest("a.kbl"); if (a && !a.classList.contains("miss")){ e.preventDefault(); e.shiftKey ? pin(a.dataset.k) : kbGo(a.dataset.k); } });
bar.addEventListener("pointerover", e => { const a = e.target.closest("a.kbl"); if (a && !a.classList.contains("miss")) kbShowTip(a); });
bar.addEventListener("pointerout", e => { if (e.target.closest("a.kbl")) kbTip.classList.remove("on"); });
bar.addEventListener("scroll", () => kbTip.classList.remove("on"));

draw();
})();
