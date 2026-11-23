/* Guess the year: one map a day, the same one for everyone on that date. The reader names its year from the borders and names alone.
   The closer the guess, the more points, up to 1,000. With the points come the three biggest events of those years, pinned on the map.
   It has a screen and a map of its own, drawn here from the border snapshots in map/: nothing on it shows the year, and the app behind is left as it was.
   Kept in the browser: wh8-daily (today's guess) and wh8-daily-log (each day's points, for the run of days). */
(function(){
"use strict";
const ALL = SNAPS, PLAY = SNAPS.filter(y=>y<NOW);            /* today's own map is not a guess */
const N = 1, TOP = 1000;
const pad = n => String(n).padStart(2,"0");
const dayKey = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const dayNo = d => Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(2026,0,1))/864e5);
const dayName = d => d.getDate()+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]+" "+d.getFullYear();
function rng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function shuffled(list, seed){ const a=[...list], r=rng(seed); for (let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
/* every map comes up once before one comes round again, in a mixed order that keeps one day's map well away in time from the day before's */
const CYC=new Map();
function cycle(c){ if (CYC.has(c)) return CYC.get(c); const pool=shuffled(PLAY, hash("cycle"+c)), out=[], late=new Set(c>0 ? cycle(c-1).slice(-16) : []); let last=-99;   /* late: the maps of the last 16 days, which do not open the next round */
  while (pool.length){ const far=y=>Math.abs(PLAY.indexOf(y)-last)>=8, fresh=y=>out.length>=16 || !late.has(y);
    let j=pool.findIndex(y=>far(y) && fresh(y)); if (j<0) j=pool.findIndex(fresh); if (j<0) j=0; const y=pool.splice(j,1)[0]; out.push(y); last=PLAY.indexOf(y); }
  CYC.set(c,out); return out; }
function mapsFor(n){ const m=((n%1e6)+1e6)%1e6; return [cycle(Math.floor(m/PLAY.length))[m%PLAY.length]]; }
/* a map stands for the years from its own date to the next map's */
const spanOf = s => [s, ALL[ALL.indexOf(s)+1]-1];
/* full marks inside those years. Outside them the points fall with the distance, more slowly for an older map: 100 years off is a near miss in 1500 BCE and a long way off in 1900 */
function score(s, g){ const [a,b]=spanOf(s), err = g<a ? a-g : g>b ? g-b : 0; return [Math.round(TOP*Math.exp(-err/(50+(NOW-s)/10))), g<a ? -err : err]; }
const num = n => n.toLocaleString("en-US");
const yr = y => y>=NOW ? NOW+" CE" : fmt(y===0?1:y);
/* what was happening in a map's years: the three items that weigh most (level 1 before 2), nearest the map's own date, from different regions where the weight is the same.
   People are left out: these are things that happened, each at a place the map can mark */
function eventsFor(s){ const [a,b]=spanOf(s), C=[];
  for (const r of REG) for (const o of [...r.points, ...r.over]) if (o.layer!=="people" && o.name && o.y>=a && o.y<=b && geoOf(o)) C.push(o);
  C.sort((p,q)=>(p.level||4)-(q.level||4) || Math.abs(p.y-s)-Math.abs(q.y-s) || (p.name<q.name?-1:1));
  const got=[], regs=new Set(), pages=new Set();
  while (got.length<3 && C.length){ const lv=C[0].level||4; let j=C.findIndex(o=>(o.level||4)===lv && !regs.has(o.reg) && !pages.has(wikiTitle(o))); if (j<0) j=C.findIndex(o=>!pages.has(wikiTitle(o))); if (j<0) break;
    const o=C.splice(j,1)[0]; got.push(o); regs.add(o.reg); pages.add(wikiTitle(o)); }
  return got.sort((p,q)=>p.y-q.y); }

/* ---------- what is kept ---------- */
const today = () => new Date();
function load(){ let v=null; try{ v=JSON.parse(LS("wh8-daily")||"null"); }catch(e){} const k=dayKey(today());
  return v && v.d===k && Array.isArray(v.g) && Array.isArray(v.p) && v.g.length<=N && v.p.length===v.g.length ? v : {d:k, g:[], p:[]}; }
function logOf(){ let v=null; try{ v=JSON.parse(LS("wh8-daily-log")||"null"); }catch(e){} return v && typeof v==="object" ? v : {}; }
function runOf(log){ let n=0; const d=today(); if (log[dayKey(d)]==null) d.setDate(d.getDate()-1); while (log[dayKey(d)]!=null){ n++; d.setDate(d.getDate()-1); } return n; }
let G=load(), YEARS=mapsFor(dayNo(today()));
const done = () => G.g.length>=N, total = () => G.p.reduce((a,b)=>a+b,0);
function keep(){ saveLS("wh8-daily",JSON.stringify(G));
  if (done()){ const log=logOf(); log[G.d]=total(); const ks=Object.keys(log).sort(); for (const k of ks.slice(0,Math.max(0,ks.length-400))) delete log[k]; saveLS("wh8-daily-log",JSON.stringify(log)); } }

/* ---------- the button at the top: grey once today's map is done ---------- */
const btn=$("dailyBtn");
function drawBtn(){ if (!btn) return; const d=done(); btn.classList.toggle("done",d);
  btn.title = d ? "Guess the year: today's map is done, "+num(total())+" of "+num(TOP)+". A new map tomorrow" : "Guess the year: one map a day, the closer the guess the more points"; }

/* ---------- the screen ---------- */
let box=null, cv=null, cx=null, W=0, H=0, DPR=1, V=null, feats=null, snapOn=null, guess=1000, shown=false, raf=0, lastFocus=null, pins=null;
const scaleStops=[[START,0],[-500,.25],[1000,.5],[1700,.75],[NOW,1]];   /* the slider gives the recent centuries more room, as the chart does */
const fracOfYear = y => { for (let i=1;i<scaleStops.length;i++){ const [y0,f0]=scaleStops[i-1],[y1,f1]=scaleStops[i]; if (y<=y1) return f0+(f1-f0)*(y-y0)/(y1-y0); } return 1; };
const yearOfFrac = f => { for (let i=1;i<scaleStops.length;i++){ const [y0,f0]=scaleStops[i-1],[y1,f1]=scaleStops[i]; if (f<=f1){ const y=y0+(y1-y0)*(f-f0)/(f1-f0), st = y<0 ? 25 : y<1000 ? 10 : y<1700 ? 5 : 1; return Math.max(START,Math.min(NOW,Math.round(y/st)*st)) || 1; } } return NOW; };

function build(){
  box=el("div","dg"); box.id="dg"; box.setAttribute("role","dialog"); box.setAttribute("aria-modal","true"); box.setAttribute("aria-label","Guess the year");
  box.innerHTML=
    '<div class="dghead"><h2>Guess the year</h2><span class="dgstep" id="dgStep"></span><button class="x" id="dgClose" type="button" aria-label="Close the game">×</button></div>'+
    '<div class="dgmap" id="dgMap"><canvas id="dgCanvas" aria-label="A map of the world’s borders in the year to guess"></canvas>'+
      '<span class="dgtag" id="dgTag"></span><span class="dghint" id="dgHint">Drag to move. Pinch or scroll to zoom.</span>'+
      '<span class="dgzoom"><button type="button" class="mb" id="dgOut" aria-label="Zoom out">−</button><button type="button" class="mb" id="dgIn" aria-label="Zoom in">+</button><button type="button" class="mb" id="dgFit">Fit</button></span></div>'+
    '<div class="dgfoot" id="dgFoot"></div>';
  document.body.append(box);
  cv=$("dgCanvas"); cx=cv.getContext("2d");
  $("dgClose").addEventListener("click",close);
  $("dgIn").addEventListener("click",()=>zoomBy(1.6)); $("dgOut").addEventListener("click",()=>zoomBy(1/1.6)); $("dgFit").addEventListener("click",()=>{ V=fitView(); draw(); });
  new ResizeObserver(()=>{ if (shown) size(); }).observe($("dgMap"));
  /* drag to move, wheel or pinch to zoom */
  const P=new Map(); let pinch=0;
  const at = e => { const r=cv.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; };
  cv.addEventListener("pointerdown",e=>{ cv.setPointerCapture(e.pointerId); P.set(e.pointerId,at(e)); pinch=0; });
  cv.addEventListener("pointermove",e=>{ if (!P.has(e.pointerId) || !V) return; const p=at(e), o=P.get(e.pointerId); P.set(e.pointerId,p);
    if (P.size===1){ V.x-=(p[0]-o[0])/V.k; V.y+=(p[1]-o[1])/V.k; clamp(); draw(); }
    else if (P.size===2){ const [a,b]=[...P.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]); if (pinch) zoomAt(d/pinch,(a[0]+b[0])/2,(a[1]+b[1])/2); pinch=d; } });
  const up = e => { P.delete(e.pointerId); pinch=0; };
  cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  cv.addEventListener("wheel",e=>{ e.preventDefault(); const p=at(e); zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?.01:.0018)),p[0],p[1]); },{passive:false});
}
/* a view that takes in the events pinned on the map, with room round them for their names */
function viewOn(P){ if (!P.length || !W) return fitView(); const xs=P.map(p=>p[0]), ys=P.map(p=>p[1]);
  const x0=Math.min(...xs)-28, x1=Math.max(...xs)+28, y0=Math.max(-60,Math.min(...ys)-16), y1=Math.min(85,Math.max(...ys)+16);
  return {x:(x0+x1)/2, y:(y0+y1)/2, k:Math.max(kMin(), Math.min(W/(x1-x0), H/(y1-y0), fitView().k*3))}; }
/* the whole world on a wide screen. An upright phone would show it too small to read, so it opens on Africa, Europe and Asia; the rest is a drag away */
const fitView = () => H>W ? {x:55, y:22, k:Math.min(W/175, H/120)} : {x:10, y:18, k:Math.min(W/350, H/145)};
const kMin = () => Math.min(W/350, H/145)*.9;
function clamp(){ V.k=Math.max(kMin(),Math.min(60,V.k)); V.x=Math.max(-200,Math.min(200,V.x)); V.y=Math.max(-60,Math.min(85,V.y)); }
function zoomAt(f,x,y){ if (!V) return; const lon=(x-W/2)/V.k+V.x, lat=V.y-(y-H/2)/V.k; V.k*=f; clamp(); V.x=lon-(x-W/2)/V.k; V.y=lat+(y-H/2)/V.k; clamp(); draw(); }
const zoomBy = f => zoomAt(f,W/2,H/2);
function size(){ const m=$("dgMap"); W=m.clientWidth; H=m.clientHeight; if (!W || !H) return; DPR=Math.min(2,devicePixelRatio||1);
  cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); cv.style.width=W+"px"; cv.style.height=H+"px"; if (!V) V=fitView(); clamp(); paintNow(); }
function draw(){ if (raf) return; raf=requestAnimationFrame(()=>{ raf=0; paintNow(); }); }

/* a territory's colour: its region's hue, shifted a little by its name, as on the app's own map, but never the grey of "no page" */
const COL=new Map();
function colOf(f){ const dark=isDark(), key=(f.sub||f.name)+"|"+f.r+"|"+dark; if (COL.has(key)) return COL.get(key);
  const [h0,s0]=hexToHsl(getComputedStyle(document.documentElement).getPropertyValue("--c-"+f.r)||"#888"), k=hash(f.sub||f.name);
  let h=(h0+((k%9)-4)*6+360)%360, s=Math.min(70,s0*.8+((k>>4)%3)*5); const j=((k>>8)%5)-2;
  const sh=seaHue(), d=((h-sh+540)%360)-180, d0=((h0-sh+540)%360)-180;   /* keep land out of the sea's hue */
  if (Math.abs(d0)<12){ h=(sh+72+(h-h0)/2+360)%360; s=Math.max(s,40); } else if (Math.abs(d)<34){ const sd=d0<0?-1:1; h=(sh+sd*(34+(34-sd*d)/2)+360)%360; s=Math.max(s,38); }
  const L = dark ? 27+j*2 : 81+j*2.5, S = dark ? s*.5 : s*.8;
  const c = dark ? {fill:`hsl(${h} ${S}% ${L}%)`, line:`hsl(${h} ${s*.5}% 62%)`, text:`hsl(${h} ${s*.4}% 86%)`} : {fill:`hsl(${h} ${S}% ${L}%)`, line:`hsl(${h} ${s*.85}% 36%)`, text:`hsl(${h} ${s*.8}% 24%)`};
  COL.set(key,c); return c; }

function paintNow(){
  if (!shown || !W || !V) return;
  const g=cx, cs=getComputedStyle(document.documentElement), dark=isDark(), k=V.k;
  const X = lon => (lon-V.x)*k+W/2, Y = lat => (V.y-lat)*k+H/2;
  const ring = (p,a,off=0) => { p.moveTo(X(a[0]+off),Y(a[1])); for (let i=2;i<a.length;i+=2) p.lineTo(X(a[i]+off),Y(a[i+1])); p.closePath(); };
  g.setTransform(DPR,0,0,DPR,0,0);
  g.fillStyle=cs.getPropertyValue("--sea").trim(); g.fillRect(0,0,W,H);
  const lon0=(0-W/2)/k+V.x, lon1=(W-W/2)/k+V.x, lat1=V.y+(H/2)/k, lat0=V.y-(H/2)/k;
  const step=[5,10,15,30].find(d=>d*k>=70)||30; g.beginPath();
  for (let x=Math.ceil(lon0/step)*step; x<=lon1; x+=step){ g.moveTo(X(x)+.5,0); g.lineTo(X(x)+.5,H); }
  for (let y=Math.ceil(lat0/step)*step; y<=lat1; y+=step){ g.moveTo(0,Y(y)+.5); g.lineTo(W,Y(y)+.5); }
  g.lineWidth=1; g.strokeStyle = dark ? "rgba(160,200,230,.07)" : "rgba(40,90,130,.10)"; g.stroke();
  let landP=null;
  if (MAP.land){ landP=new Path2D(); for (const a of MAP.land){ ring(landP,a); if (a.some(v=>v>180)) ring(landP,a,-360); }
    g.lineJoin="round"; g.strokeStyle = dark ? "rgba(120,170,210,.07)" : "rgba(50,110,160,.08)"; g.lineWidth=12; g.stroke(landP);
    g.fillStyle=cs.getPropertyValue("--land").trim(); g.fill(landP,"evenodd"); }
  if (!feats){ g.fillStyle=cs.getPropertyValue("--muted").trim(); g.font='500 13px "Barlow",Arial,sans-serif'; g.textAlign="center"; g.fillText("Loading the map",W/2,H/2); g.textAlign="left"; return; }
  const list=[]; for (const f of feats){ if (f.bb[2]<lon0 || f.bb[0]>lon1 || f.bb[3]<lat0 || f.bb[1]>lat1) continue; const p=new Path2D(); for (const a of f.rings) ring(p,a); list.push([p,f]); }
  /* the borders are coarse and stop short of the coast: each fill is grown a little, on land only, then laid again at its true shape so inland borders stay put */
  g.save(); if (landP) g.clip(landP,"evenodd");
  g.lineJoin="round"; g.lineWidth=Math.max(4,1.1*k); for (const [p,f] of list){ g.strokeStyle=colOf(f).fill; g.stroke(p); }
  for (const [p,f] of list){ g.fillStyle=colOf(f).fill; g.fill(p,"evenodd"); }
  for (const [p,f] of list){ g.strokeStyle=colOf(f).line; g.globalAlpha = f.prec>=3 ? .7 : f.prec===2 ? .6 : .5; g.lineWidth = f.prec>=2 ? 1.1 : .9; g.setLineDash(f.prec===1 ? [4,3] : []); g.stroke(p); }
  g.setLineDash([]); g.globalAlpha=1; g.restore();
  if (landP){ g.lineWidth=.9; g.strokeStyle = dark ? "rgba(150,190,220,.35)" : "rgba(50,85,115,.5)"; g.stroke(landP); }
  /* names where they fit, biggest first */
  g.textAlign="center"; g.textBaseline="middle"; g.lineJoin="round"; const placed=[], SP="letterSpacing" in g;
  for (const [,f] of [...list].sort((a,b)=>(b[1].bb[2]-b[1].bb[0])*(b[1].bb[3]-b[1].bb[1])-(a[1].bb[2]-a[1].bb[0])*(a[1].bb[3]-a[1].bb[1]))){
    const w=(f.bb[2]-f.bb[0])*k, h=(f.bb[3]-f.bb[1])*k; if (h<13 || w<30) continue;
    const sz=Math.round(Math.max(9.5,Math.min(17,Math.sqrt(f.area)*k/9.5))); g.font=`500 ${sz}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`; if (SP) g.letterSpacing=(sz*.09).toFixed(1)+"px";
    const x=X(f.lab.cx), y=Y(f.lab.cy), nm=mapLabel(f).toUpperCase(), tw=g.measureText(nm).width;
    if (tw+8>w || x-tw/2<4 || x+tw/2>W-4 || y<sz || y>H-sz) continue;
    const r=[x-tw/2-2,y-sz*.6,x+tw/2+2,y+sz*.6]; if (placed.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1])) continue; placed.push(r);
    const c=colOf(f); g.lineWidth=3; g.strokeStyle=c.fill; g.globalAlpha=.9; g.strokeText(nm,x,y); g.globalAlpha=1; g.fillStyle=c.text; g.fillText(nm,x,y); }
  if (SP) g.letterSpacing="0px";
  /* once the answer is out: what was happening, each a numbered pin with its name beside it */
  if (pins){ const ink=cs.getPropertyValue("--ink").trim(), paper=cs.getPropertyValue("--surface").trim(), taken=[];
    const marks=pins.map((o,i)=>{ const q=geoOf(o); return {o, i, x:X(q[0]), y:Y(q[1])}; }).filter(m=>m.x>-20 && m.x<W+20 && m.y>-20 && m.y<H+20);
    g.font='600 13.5px "Barlow",Arial,sans-serif';
    for (const m of marks){ const tw=g.measureText(m.o.name).width; let side = m.x+17+tw>W-6 ? -1 : 1, ty=m.y;
      const box=()=>side>0 ? [m.x+13,ty-10,m.x+17+tw,ty+10] : [m.x-17-tw,ty-10,m.x-13,ty+10], hit=()=>{ const r=box(); return taken.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]); };
      if (hit()){ side=-side; if (hit() || box()[0]<4 || box()[2]>W-4){ side=-side; while (hit() && ty<m.y+80) ty+=20; } }
      taken.push(box(), [m.x-11,m.y-11,m.x+11,m.y+11]); m.side=side; m.ty=ty; }
    for (const m of marks){ g.textAlign = m.side>0 ? "left" : "right"; const tx=m.x+m.side*15;
      g.lineWidth=4; g.strokeStyle=paper; g.strokeText(m.o.name,tx,m.ty+.5); g.fillStyle=ink; g.fillText(m.o.name,tx,m.ty+.5); }
    g.font='600 12.5px "Barlow",Arial,sans-serif'; g.textAlign="center";
    for (const m of marks){ g.beginPath(); g.arc(m.x,m.y,10,0,Math.PI*2); g.fillStyle=ink; g.fill(); g.lineWidth=2; g.strokeStyle=paper; g.stroke(); g.fillStyle=paper; g.fillText(String(m.i+1),m.x,m.y+.5); } }
  g.textAlign="left"; g.textBaseline="alphabetic";
}
function showMap(s){ if (snapOn===s && feats){ draw(); return; } snapOn=s; feats=null; draw();
  if (!MAP.land) loadLand().then(()=>draw());
  loadSnap(s).then(f=>{ if (snapOn!==s) return; feats=f||[]; draw(); }); }

/* ---------- the foot of the screen: the guess, then the answer with its points and what was happening ---------- */
const foot = () => $("dgFoot");
function setGuess(y){ guess=Math.max(START,Math.min(NOW,Math.round(y)))||1; const b=$("dgYear"); if (b) b.textContent=yr(guess); const r=$("dgRange"); if (r && document.activeElement!==r) r.value=Math.round(fracOfYear(guess)*1000); if (r) r.setAttribute("aria-valuetext",yr(guess)); }
function ask(){
  $("dgStep").textContent=dayName(today()); $("dgTag").textContent=""; $("dgHint").hidden=false; pins=null;
  const f=foot(); f.className="dgfoot"; f.textContent="";
  const top=el("div","dgrow"), yb=el("button","dgyear"), yi=el("input","dgyin"), less=el("button","ib","−"), more=el("button","ib","+"), go=el("button","btn dggo","Guess");
  yb.id="dgYear"; yb.type="button"; yb.title="Type a year"; yi.id="dgYearIn"; yi.type="text"; yi.hidden=true; yi.autocomplete="off"; yi.spellcheck=false; yi.placeholder="1453, 500 BCE"; yi.setAttribute("aria-label","Your guess, like 1453 or 500 BCE");
  less.type=more.type=go.type="button"; less.setAttribute("aria-label","Ten years earlier"); more.setAttribute("aria-label","Ten years later"); less.title="Ten years earlier"; more.title="Ten years later"; go.id="dgGo";
  const grp=el("div","tgrp"); grp.append(less,more);
  top.append(yb,yi,grp,el("span","dgsay","What year do these borders show?"),go);
  const sl=el("div","dgsl"), r=el("input"); r.type="range"; r.id="dgRange"; r.min=0; r.max=1000; r.step=1; r.setAttribute("aria-label","Your guess");
  const tk=el("div","dgticks"); for (const [y,lab] of [[START,"3300 BCE"],[-2000,""],[-1000,""],[-500,"500 BCE"],[1,""],[500,""],[1000,"1000 CE"],[1250,""],[1500,""],[1700,"1700"],[1800,""],[1900,""],[NOW,"today"]]){ const t=el("i",lab?"l":"",lab); t.style.left=(fracOfYear(y)*100)+"%"; tk.append(t); }
  sl.append(r,tk); f.append(top,sl);
  r.addEventListener("input",()=>setGuess(yearOfFrac(r.value/1000)));
  less.addEventListener("click",()=>setGuess(guess-10||-1)); more.addEventListener("click",()=>setGuess(guess+10||1));
  const typed = ok => { if (yi.hidden) return; const y=ok ? parseYear(yi.value) : null; yi.hidden=true; yb.hidden=false; if (y!=null) setGuess(y); };
  yb.addEventListener("click",()=>{ yb.hidden=true; yi.hidden=false; yi.value=""; yi.focus(); });
  yi.addEventListener("blur",()=>typed(true)); yi.typed=typed;
  go.addEventListener("click",()=>{ typed(true); const [p]=score(YEARS[0],guess); G.g=[guess]; G.p=[p]; keep(); drawBtn(); answer(); const b=$("dgShare"); if (b) b.focus(); });
  setGuess(guess); size(); V=W?fitView():null; showMap(YEARS[0]);
}
function missText(s,g){ const [,e]=score(s,g), n=Math.abs(e); return e===0 ? "Inside the years this map stands for" : num(n)+(n===1?" year ":" years ")+(e<0?"too early":"too late"); }
const meter = p => { const n=Math.round(p/TOP*10); return "█".repeat(n)+"░".repeat(10-n); };
function shareText(){ const [,e]=score(YEARS[0],G.g[0]), n=Math.abs(e);
  return "Tellurae, guess the year, "+dayName(today())+"\n"+num(total())+" of "+num(TOP)+", "+(n ? num(n)+(n===1?" year":" years")+" off" : "inside the map's years")+"\n"+meter(total())+"\nhttps://hmeyy.com/apps/history/app.html?daily"; }
function leaveTo(go){ close(); if (typeof select==="function") select(null); go(); }
function answer(){
  const s=YEARS[0], g=G.g[0], [a,b]=spanOf(s); $("dgStep").textContent=dayName(today()); $("dgHint").hidden=true; $("dgTag").textContent="Borders of "+yr(s);
  const f=foot(); f.className="dgfoot ans"; f.textContent="";
  const row=el("div","dgrow"), big=el("b","dgyear",yr(s)), txt=el("div","dgans");
  txt.append(el("b",null,"You said "+yr(g)+". "+missText(s,g)+"."), el("span",null, a===b ? "" : "This map stands for "+(a<0===b<0 ? Math.abs(a)+" to "+Math.abs(b)+(a<0?" BCE":" CE") : yr(a)+" to "+yr(b))+"."));
  const pts=el("span","dgpts",num(G.p[0])); pts.append(el("small",null," of "+num(TOP)));
  pts.title="Full marks fall inside the years the map stands for. Outside them the points fall with the distance, more slowly for an older map";
  row.append(big,txt,pts); f.append(row);
  pins=eventsFor(s);
  if (pins.length){ f.append(el("p","dgevh","What was happening"));
    const L=el("div","dgevs");
    pins.forEach((o,i)=>{ const x=INDEX.find(x=>x.obj===o), bt=el("button","dgev"); bt.type="button"; bt.title="Open "+o.name+" on the map";
      bt.append(el("i",null,String(i+1)), el("b",null,o.name), el("span",null, x ? [x.k,x.when].filter(Boolean).join(", ") : yr(o.y)));
      bt.addEventListener("click",()=>leaveTo(()=>{ goTo(o); if (typeof focusOn==="function") focusOn(o); })); L.append(bt); });
    f.append(L); }
  const log=logOf(), run=runOf(log), days=Object.keys(log).length, best=Math.max(0,...Object.values(log).filter(Number.isFinite));
  const end=el("div","dgend"), meta=el("p","dgmeta",(run>1 ? run+" days in a row. " : "")+(best>total() ? "Your best is "+num(best)+". " : days>1 ? "Your best day so far. " : "")+"A new map tomorrow.");
  const see=el("button","btn","Open "+yr(s)+" on the map"), sh=el("button","btn dggo","Share the score"); see.type=sh.type="button"; sh.id="dgShare";
  see.addEventListener("click",()=>leaveTo(()=>{ if (MAP.mode!=="full") setMapMode("full"); setYear(s,{scroll:true}); }));
  sh.addEventListener("click",()=>{ const t=shareText(), said=m=>{ sh.textContent=m; setTimeout(()=>{ sh.textContent="Share the score"; },1800); };
    if (navigator.share && matchMedia("(pointer:coarse)").matches) navigator.share({text:t}).catch(()=>{});
    else (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>said("Copied"),()=>{ window.prompt("Copy your score:",t); }); });
  end.append(meta,see,sh); f.append(end);
  size(); V=W?viewOn(pins.map(geoOf)):null; showMap(s);       /* the foot is taller now and the map shorter: measured again before the view is set */
}

function open(){
  const k=dayKey(today()); if (G.d!==k){ G=load(); YEARS=mapsFor(dayNo(today())); drawBtn(); }   /* the page was left open past midnight */
  if (!box) build();
  if (typeof setPlay==="function") setPlay(false); if (typeof story!=="undefined" && story && typeof filmPause==="function") filmPause();
  lastFocus=document.activeElement; shown=true; box.classList.add("open"); document.body.classList.add("dgon"); size();
  if (done()) answer(); else { guess=1000; ask(); }
  const b=$("dgGo")||$("dgShare"); if (b) b.focus();
}
function close(){ if (!shown) return; shown=false; box.classList.remove("open"); document.body.classList.remove("dgon"); drawBtn(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
/* while the game is up the keys are its own: the app behind hears none of them */
document.addEventListener("keydown",e=>{ if (!shown) return; e.stopPropagation();
  const t=e.target, yi=$("dgYearIn");
  if (e.key==="Escape"){ if (yi && t===yi){ yi.typed(false); $("dgYear").focus(); } else close(); return; }
  if (yi && t===yi){ if (e.key==="Enter"){ e.preventDefault(); yi.typed(true); $("dgGo").focus(); } return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key==="Enter" && !(t && t.matches && t.matches("button,a"))){ const b=$("dgGo"); if (b){ e.preventDefault(); b.click(); } return; }
  if ($("dgRange") && t!==$("dgRange") && (e.key==="ArrowLeft" || e.key==="ArrowRight")){ e.preventDefault(); setGuess(guess+(e.key==="ArrowRight"?1:-1)*(e.shiftKey?10:1)||1); }
},true);
if (btn) btn.addEventListener("click",open);
drawBtn();
window.dailyGuess={open, close, mapsFor, score, spanOf, eventsFor, state:()=>G, years:()=>YEARS, share:shareText};   /* for the tests */
if (Q.has("daily")) open();
})();
