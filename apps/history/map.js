"use strict";
/* Map panel for World History in Eight Regions.
   Borders at the slider's year, only for the selected regions.
   Data: historical-basemaps by André Ourednik (GPL-3.0) for 3000 BCE to 2010, Natural Earth for today.
   Packed by map-build.py into map/w<year>.json: [name, border precision 1-3, region, delta rings, subject to]. */

const SNAPS = [-3000,-2000,-1500,-1000,-700,-500,-400,-323,-300,-200,-100,-1,100,200,300,400,500,600,700,800,900,
  1000,1100,1200,1279,1300,1400,1492,1500,1530,1600,1650,1700,1715,1783,1800,1815,1880,1900,1914,1920,1930,1938,
  1945,1960,1994,2010,2026];
const RED = "#e0262b";
const REGBOX = {ca:[45,28,135,62], sa:[60,5,98,37], ea:[97,18,146,54], se:[92,-48,180,28],
  am:[-170,-56,-30,72], af:[-20,-36,52,17], eu:[-25,34,60,71], me:[-18,12,63,43]};
const WORLD = [-170,-50,180,75];

const MAP = {on:true, year:1500, lo:START, hi:NOW, stops:[], full:[], view:null, data:new Map(), land:null,
  feats:null, snap:null, paths:[], boxMode:false, fitKey:"", line:null};
try{ const v=localStorage.getItem("wh8-map"); MAP.on = v ? v==="on" : innerWidth>=700; }catch(e){ MAP.on = innerWidth>=700; }

const bottom=$("bottom"), mapCanvas=$("mapCanvas"), mctx=mapCanvas.getContext("2d"), mapWrap=$("mapWrap");
const sliderEl=$("slider"), thumbEl=$("thumb"), ticksEl=$("sliderTicks"), ovEl=$("overview"), ovWin=$("ovWin"), ovThumb=$("ovThumb");
let mapW=0, mapH=0, dpr=1;

/* ---------- time stops: small steps where events are dense, big steps where they are sparse ---------- */
const EV_YEARS = (()=>{ const ys=[]; for (const r of REG) for (const p of r.points) ys.push(p.y); for (const e of EVENTS) ys.push(e.a,e.b); return ys.sort((a,b)=>a-b); })();
const NICE = [1,2,5,10,20,25,50,100,200,250,500,1000];
function niceFloor(v){ let n=1; for (const s of NICE) if (s<=v) n=s; return n; }
function buildStops(lo,hi){
  const set=new Set([lo,hi]), nWin=40, W=(hi-lo)/nWin;
  for (let i=0;i<nWin;i++){
    const a=lo+i*W, b=a+W;
    let n=0; for (const y of EV_YEARS) if (y>=a && y<b) n++;
    const step=niceFloor(Math.max(1, W/(2*n+1)));
    for (let y=Math.ceil(a/step)*step; y<b; y+=step) set.add(y);
  }
  for (const y of EV_YEARS) set.add(y);
  for (const y of SNAPS) set.add(y);
  return [...set].map(y=>y===0?1:y).filter(y=>y>=lo && y<=hi).filter((y,i,a)=>a.indexOf(y)===i).sort((a,b)=>a-b);
}
/* position 0..1 of a year along a stop list, interpolated between stops */
function fracOf(stops,y){
  if (y<=stops[0]) return 0;
  const n=stops.length-1; if (y>=stops[n]) return 1;
  let lo=0, hi=n; while (hi-lo>1){ const m=(lo+hi)>>1; if (stops[m]<=y) lo=m; else hi=m; }
  return (lo + (y-stops[lo])/(stops[hi]-stops[lo]))/n;
}
function yearAtFrac(stops,f){ const i=Math.round(Math.max(0,Math.min(1,f))*(stops.length-1)); return stops[i]; }
function stopIndex(stops,y){ let best=0; for (let i=0;i<stops.length;i++) if (Math.abs(stops[i]-y)<Math.abs(stops[best]-y)) best=i; return best; }

/* ---------- data ---------- */
function decode(j){
  return j.f.map(([name,prec,r,rings,sub])=>{
    let best=null, bestA=-1, bb=[180,90,-180,-90];
    const R = rings.map(a=>{
      const out=new Float32Array(a.length); let x=0,y=0;
      for (let i=0;i<a.length;i+=2){ x+=a[i]; y+=a[i+1]; out[i]=x/10; out[i+1]=y/10;
        if (out[i]<bb[0]) bb[0]=out[i]; if (out[i]>bb[2]) bb[2]=out[i]; if (out[i+1]<bb[1]) bb[1]=out[i+1]; if (out[i+1]>bb[3]) bb[3]=out[i+1]; }
      /* signed area and centroid of the ring */
      let A=0, cx=0, cy=0;
      for (let i=0;i<out.length-2;i+=2){ const c=out[i]*out[i+3]-out[i+2]*out[i+1]; A+=c; cx+=(out[i]+out[i+2])*c; cy+=(out[i+1]+out[i+3])*c; }
      if (Math.abs(A)>bestA){ bestA=Math.abs(A); best={cx:A?cx/(3*A):out[0], cy:A?cy/(3*A):out[1], w:0}; }
      return out;
    });
    return {name, prec, r, sub:sub||null, rings:R, bb, lab:best, area:bestA/2};
  }).sort((a,b)=>b.area-a.area);
}
function loadSnap(y){
  if (!MAP.data.has(y)) MAP.data.set(y, fetch(`map/w${y}.json`).then(r=>r.json()).then(decode).catch(()=>{ MAP.data.delete(y); return null; }));
  return MAP.data.get(y);
}
function snapFor(y){ let s=SNAPS[0]; for (const v of SNAPS) if (v<=y) s=v; return s; }
function loadLand(){
  return fetch("map/land.json").then(r=>r.json()).then(j=>{
    MAP.land = j.rings.map(a=>{ const out=new Float32Array(a.length); let x=0,y=0; for (let i=0;i<a.length;i+=2){ x+=a[i]; y+=a[i+1]; out[i]=x/10; out[i+1]=y/10; } return out; });
    drawMap();
  }).catch(()=>{});
}

/* ---------- colours: each territory gets its region's hue, shifted a little by its name ---------- */
const COLS = new Map();
function hexToHsl(h){
  h=h.trim(); if (h[0]==="#") h=h.slice(1); if (h.length===3) h=h.split("").map(c=>c+c).join("");
  const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2; let hh=0, s=0;
  if (mx!==mn){ const d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn);
    hh = mx===r ? (g-b)/d+(g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; hh*=60; }
  return [hh, s*100, l*100];
}
function hash(s){ let h=2166136261; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function colorFor(f){
  const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme!=="light";
  const key=(f.sub||f.name)+"|"+f.r+"|"+dark;
  if (COLS.has(key)) return COLS.get(key);
  const base=getComputedStyle(document.documentElement).getPropertyValue("--c-"+f.r);
  const [h,s,l]=hexToHsl(base), k=hash(f.sub||f.name);
  const col=`hsl(${(h+((k%9)-4)*7+360)%360} ${Math.min(90,s+((k>>4)%3)*6)}% ${Math.max(28,Math.min(78,l+(((k>>8)%5)-2)*7))}%)`;
  COLS.set(key,col); return col;
}

/* ---------- view ---------- */
function fitBox(b){
  const [x0,y0,x1,y1]=b;
  const k=Math.min(mapW/(x1-x0), mapH/(y1-y0))*0.94;
  MAP.view={x:(x0+x1)/2, y:(y0+y1)/2, k:clampK(k)};
}
function clampK(k){ return Math.max(Math.max(mapW,1)/400, Math.min(80,k)); }
function fitSelected(){
  const ids=[...state.active]; let b=null;
  if (ids.length===REG.length) b=WORLD;
  else for (const id of ids){ const r=REGBOX[id]; b = b ? [Math.min(b[0],r[0]),Math.min(b[1],r[1]),Math.max(b[2],r[2]),Math.max(b[3],r[3])] : r.slice(); }
  fitBox(b);
}
const sx = lon => (lon-MAP.view.x)*MAP.view.k + mapW/2;
const sy = lat => (MAP.view.y-lat)*MAP.view.k + mapH/2;
const lonAt = x => (x-mapW/2)/MAP.view.k + MAP.view.x;
const latAt = y => MAP.view.y - (y-mapH/2)/MAP.view.k;

function ringPath(path, a){
  path.moveTo(sx(a[0]), sy(a[1]));
  for (let i=2;i<a.length;i+=2) path.lineTo(sx(a[i]), sy(a[i+1]));
  path.closePath();
}

/* ---------- draw ---------- */
let drawQueued=false;
function drawMap(){ if (drawQueued) return; drawQueued=true; requestAnimationFrame(()=>{ drawQueued=false; paint(); }); }
function paint(){
  if (!MAP.on || !mapW || !MAP.view) return;
  const cs=getComputedStyle(document.documentElement);
  const ink=cs.getPropertyValue("--ink").trim(), surf=cs.getPropertyValue("--surface").trim();
  mctx.setTransform(dpr,0,0,dpr,0,0);
  mctx.fillStyle=cs.getPropertyValue("--sea").trim(); mctx.fillRect(0,0,mapW,mapH);
  const lon0=lonAt(0), lon1=lonAt(mapW), lat0=latAt(mapH), lat1=latAt(0);
  if (MAP.land){
    const p=new Path2D();
    for (const a of MAP.land) ringPath(p,a);
    mctx.fillStyle=cs.getPropertyValue("--land").trim(); mctx.fill(p,"evenodd");
  }
  MAP.paths=[];
  if (MAP.feats){
    const shown=[];
    for (const f of MAP.feats){
      if (!state.active.has(f.r)) continue;
      if (f.bb[2]<lon0 || f.bb[0]>lon1 || f.bb[3]<lat0 || f.bb[1]>lat1) continue;
      const p=new Path2D(); for (const a of f.rings) ringPath(p,a);
      mctx.globalAlpha=.82; mctx.fillStyle=colorFor(f); mctx.fill(p,"evenodd"); mctx.globalAlpha=1;
      MAP.paths.push([p,f]); shown.push([p,f]);
    }
    /* borders: dashed where the dataset calls them approximate */
    mctx.strokeStyle=ink; mctx.lineJoin="round";
    for (const [p,f] of shown){
      mctx.globalAlpha = f.prec>=3 ? .7 : f.prec===2 ? .55 : .45;
      mctx.lineWidth = f.prec>=2 ? .8 : .7;
      mctx.setLineDash(f.prec===1 ? [3,2.5] : []);
      mctx.stroke(p);
    }
    mctx.setLineDash([]); mctx.globalAlpha=1;
    /* names where they fit, biggest first, no overlaps */
    mctx.font='600 11px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; mctx.textAlign="center"; mctx.textBaseline="middle";
    const placed=[];
    for (const [,f] of shown){
      const w=(f.bb[2]-f.bb[0])*MAP.view.k, h=(f.bb[3]-f.bb[1])*MAP.view.k;
      if (h<13 || w<30) continue;
      const x=sx(f.lab.cx), y=sy(f.lab.cy), tw=mctx.measureText(f.name).width;
      if (tw+6>w || x<0 || x>mapW || y<0 || y>mapH) continue;
      const r=[x-tw/2-2,y-7,x+tw/2+2,y+7];
      if (placed.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1])) continue;
      placed.push(r);
      mctx.lineWidth=3; mctx.strokeStyle=surf; mctx.globalAlpha=.85; mctx.strokeText(f.name,x,y);
      mctx.globalAlpha=1; mctx.fillStyle=ink; mctx.fillText(f.name,x,y);
    }
  }
  if (!state.active.size || (MAP.feats && !MAP.paths.length)){
    mctx.fillStyle=cs.getPropertyValue("--muted").trim(); mctx.font='500 12px "Barlow",Arial,sans-serif'; mctx.textAlign="center";
    mctx.fillText(MAP.feats ? "No mapped territories here in this year" : "Loading the map", mapW/2, mapH/2);
  }
}

/* ---------- year ---------- */
function fmtYear(y){ return y>=NOW ? "today" : fmt(y===0?1:y); }
function setYear(y, opt={}){
  y=Math.max(START,Math.min(NOW,Math.round(y))); if (y===0) y=1;
  if (y<MAP.lo || y>MAP.hi){ MAP.lo=START; MAP.hi=NOW; MAP.stops=MAP.full; drawTicks(); }
  MAP.year=y;
  $("mapYear").textContent = y>=NOW ? "Today" : fmt(y);
  placeThumb(); placeYearLine(); if (opt.scroll) revealYear();
  const s=snapFor(y);
  $("mapAsOf").textContent = y<SNAPS[0] ? "Earliest borders: 3000 BCE" : s>=NOW ? "Borders today" : `Borders as of ${fmt(s)}`;
  if (s!==MAP.snap){
    MAP.snap=s;
    loadSnap(s).then(feats=>{ if (MAP.snap===s && feats){ MAP.feats=feats; drawMap(); } });
    const i=SNAPS.indexOf(s); if (SNAPS[i+1]) loadSnap(SNAPS[i+1]); if (SNAPS[i-1]) loadSnap(SNAPS[i-1]);
  }
  sliderEl.setAttribute("aria-valuetext", fmtYear(y));
}

/* ---------- slider ---------- */
const PADX=10;
function sliderX(f){ return PADX + f*(sliderEl.clientWidth-2*PADX); }
function sliderFrac(x){ return (x-PADX)/Math.max(1,sliderEl.clientWidth-2*PADX); }
function placeThumb(){
  thumbEl.style.left = sliderX(fracOf(MAP.stops,MAP.year))+"px";
  ovThumb.style.left = (fracOf(MAP.full,MAP.year)*ovEl.clientWidth)+"px";
  const zoomed = MAP.lo>START || MAP.hi<NOW;
  ovWin.style.display = zoomed ? "block" : "none";
  if (zoomed){ const a=fracOf(MAP.full,MAP.lo)*ovEl.clientWidth, b=fracOf(MAP.full,MAP.hi)*ovEl.clientWidth; ovWin.style.left=a+"px"; ovWin.style.width=Math.max(3,b-a)+"px"; }
  $("rangeAll").hidden = !zoomed; $("ovHint").hidden = zoomed;
  $("rangeLab").textContent = zoomed ? `${fmt(MAP.lo)} to ${MAP.hi>=NOW?"today":fmt(MAP.hi)}` : "All time";
}
function drawTicks(){
  ticksEl.textContent="";
  const span=MAP.hi-MAP.lo, steps=[1000,500,100,50,10,5,1].filter(s=> s>=span/400), placed=[];
  for (const st of steps){
    for (let y=Math.ceil(MAP.lo/st)*st; y<=MAP.hi; y+=st){
      const yy = y===0 ? 1 : y, x=sliderX(fracOf(MAP.stops,yy));
      if (placed.some(q=>Math.abs(q-x)<54)) continue;
      placed.push(x);
      const t=el("span","tk", y<0 ? `${-y} BCE` : y===0 ? "1 CE" : String(y)); t.style.left=x+"px"; ticksEl.append(t);
    }
  }
  placeThumb();
}
function onSlide(e){
  const r=sliderEl.getBoundingClientRect();
  setYear(yearAtFrac(MAP.stops, sliderFrac(e.clientX-r.left)), {scroll:true});
}
sliderEl.addEventListener("pointerdown",e=>{ sliderEl.setPointerCapture(e.pointerId); sliderEl.classList.add("drag"); onSlide(e);
  const mv=ev=>onSlide(ev), up=()=>{ sliderEl.classList.remove("drag"); sliderEl.removeEventListener("pointermove",mv); sliderEl.removeEventListener("pointerup",up); sliderEl.removeEventListener("pointercancel",up); };
  sliderEl.addEventListener("pointermove",mv); sliderEl.addEventListener("pointerup",up); sliderEl.addEventListener("pointercancel",up); });
sliderEl.addEventListener("keydown",e=>{
  const i=stopIndex(MAP.stops,MAP.year), n=MAP.stops.length-1;
  const to = {ArrowRight:i+1,ArrowUp:i+1,ArrowLeft:i-1,ArrowDown:i-1,PageUp:i+10,PageDown:i-10,Home:0,End:n}[e.key];
  if (to==null) return; e.preventDefault(); setYear(MAP.stops[Math.max(0,Math.min(n,to))],{scroll:true});
});

/* range strip: drag to pick a time range, click to jump */
ovEl.addEventListener("pointerdown",e=>{
  ovEl.setPointerCapture(e.pointerId);
  const r=ovEl.getBoundingClientRect(), x0=e.clientX-r.left; let x1=x0;
  const mv=ev=>{ x1=Math.max(0,Math.min(r.width,ev.clientX-r.left)); if (Math.abs(x1-x0)>4){ ovWin.style.display="block"; ovWin.style.left=Math.min(x0,x1)+"px"; ovWin.style.width=Math.abs(x1-x0)+"px"; } };
  const up=()=>{
    ovEl.removeEventListener("pointermove",mv); ovEl.removeEventListener("pointerup",up); ovEl.removeEventListener("pointercancel",up);
    if (Math.abs(x1-x0)>6){
      const a=yearAtFrac(MAP.full,Math.min(x0,x1)/r.width), b=yearAtFrac(MAP.full,Math.max(x0,x1)/r.width);
      if (b-a>=5){ setRange(a,b); return; }
    }
    setYear(yearAtFrac(MAP.full,x0/r.width),{scroll:true});
  };
  ovEl.addEventListener("pointermove",mv); ovEl.addEventListener("pointerup",up); ovEl.addEventListener("pointercancel",up);
});
function setRange(a,b){
  MAP.lo=a; MAP.hi=b; MAP.stops = (a===START && b===NOW) ? MAP.full : buildStops(a,b);
  drawTicks();
  if (MAP.year<a || MAP.year>b) setYear(MAP.year<a?a:b,{scroll:true}); else placeThumb();
}
$("rangeAll").addEventListener("click",()=>setRange(START,NOW));

/* ---------- the red year line on the chart ---------- */
function placeYearLine(){
  const plot=sheet.querySelector(".plot"); if (!plot) return;
  if (!MAP.on){ if (MAP.line) MAP.line.remove(); return; }
  if (!MAP.line) MAP.line=el("div","yearline");
  if (MAP.line.parentNode!==plot) plot.append(MAP.line);
  const p=Y(MAP.year);
  MAP.line.style.cssText = state.horiz ? `left:${p-1}px;top:0;width:2px;height:100%` : `top:${p-1}px;left:0;height:2px;width:100%`;
}
function revealYear(){
  const p=Y(MAP.year), sb=scroller.style.scrollBehavior; scroller.style.scrollBehavior="auto";
  if (state.horiz){
    const head=parseFloat(getComputedStyle(sheet).getPropertyValue("--headw"))||150, vis=scroller.clientWidth-head;
    if (p<scroller.scrollLeft+30 || p>scroller.scrollLeft+vis-30) scroller.scrollLeft=Math.max(0,p-vis*.4);
  } else {
    const head=parseFloat(getComputedStyle(sheet).getPropertyValue("--headh"))||46, vis=scroller.clientHeight-head;
    if (p<scroller.scrollTop+30 || p>scroller.scrollTop+vis-30) scroller.scrollTop=Math.max(0,p-vis*.4);
  }
  scroller.style.scrollBehavior=sb;
}

/* ---------- map interaction: drag to pan, wheel or pinch to zoom, box to zoom into an area ---------- */
const tip=$("mapTip"), boxSel=$("boxSel"), ptrs=new Map();
let drag=null;
function zoomAt(f,x,y){
  const lon=lonAt(x), lat=latAt(y), k=clampK(MAP.view.k*f);
  MAP.view={x:lon-(x-mapW/2)/k, y:lat+(y-mapH/2)/k, k}; clampView(); drawMap();
}
function clampView(){ const v=MAP.view; v.x=Math.max(-200,Math.min(200,v.x)); v.y=Math.max(-60,Math.min(85,v.y)); }
function local(e){ const r=mapCanvas.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; }
mapCanvas.addEventListener("pointerdown",e=>{
  mapCanvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,local(e)); tip.style.display="none";
  if (ptrs.size===2){ const [a,b]=[...ptrs.values()]; drag={pinch:true, d:Math.hypot(a[0]-b[0],a[1]-b[1]), k:MAP.view.k}; return; }
  const [x,y]=local(e);
  drag = (MAP.boxMode||e.shiftKey) ? {box:true,x,y} : {x,y,vx:MAP.view.x,vy:MAP.view.y};
  if (!drag.box) mapWrap.classList.add("panning");
});
mapCanvas.addEventListener("pointermove",e=>{
  const [x,y]=local(e);
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId,[x,y]);
  if (drag && drag.pinch && ptrs.size===2){
    const [a,b]=[...ptrs.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]);
    zoomAt((drag.k*d/drag.d)/MAP.view.k,(a[0]+b[0])/2,(a[1]+b[1])/2); return;
  }
  if (drag && drag.box){
    boxSel.style.cssText=`display:block;left:${Math.min(x,drag.x)}px;top:${Math.min(y,drag.y)}px;width:${Math.abs(x-drag.x)}px;height:${Math.abs(y-drag.y)}px`; return;
  }
  if (drag){ MAP.view.x=drag.vx-(x-drag.x)/MAP.view.k; MAP.view.y=drag.vy+(y-drag.y)/MAP.view.k; clampView(); drawMap(); return; }
  /* hover: which territory */
  let hit=null;
  for (let i=MAP.paths.length-1;i>=0;i--){ if (mctx.isPointInPath(MAP.paths[i][0],x*dpr,y*dpr,"evenodd")){ hit=MAP.paths[i][1]; break; } }
  if (hit){
    tip.textContent = hit.sub ? `${hit.name}, part of ${hit.sub}` : hit.name;
    tip.style.display="block";
    tip.style.left=Math.min(x+12, mapW-tip.offsetWidth-4)+"px"; tip.style.top=Math.max(4,y-28)+"px";
  } else tip.style.display="none";
});
function endPtr(e){
  const [x,y]=local(e);
  if (drag && drag.box){
    boxSel.style.display="none";
    if (Math.abs(x-drag.x)>8 && Math.abs(y-drag.y)>8){
      fitBox([lonAt(Math.min(x,drag.x)), latAt(Math.max(y,drag.y)), lonAt(Math.max(x,drag.x)), latAt(Math.min(y,drag.y))]);
      MAP.view.k=clampK(MAP.view.k/0.94); drawMap();
    }
    setBoxMode(false);
  }
  ptrs.delete(e.pointerId); if (ptrs.size<2 && drag && drag.pinch) drag=null;
  if (!ptrs.size){ drag=null; mapWrap.classList.remove("panning"); }
}
mapCanvas.addEventListener("pointerup",endPtr); mapCanvas.addEventListener("pointercancel",endPtr);
mapCanvas.addEventListener("pointerleave",()=>{ if (!drag) tip.style.display="none"; });
mapCanvas.addEventListener("wheel",e=>{ e.preventDefault(); const [x,y]=local(e); zoomAt(Math.exp(-e.deltaY*0.0018),x,y); },{passive:false});
mapCanvas.addEventListener("dblclick",e=>{ const [x,y]=local(e); zoomAt(e.shiftKey?0.5:2,x,y); });
function setBoxMode(on){ MAP.boxMode=on; $("mapBox").setAttribute("aria-pressed",on); mapWrap.classList.toggle("boxing",on); }
$("mapBox").addEventListener("click",()=>setBoxMode(!MAP.boxMode));
$("mapIn").addEventListener("click",()=>zoomAt(1.6,mapW/2,mapH/2));
$("mapOut").addEventListener("click",()=>zoomAt(1/1.6,mapW/2,mapH/2));
$("mapFit").addEventListener("click",()=>{ fitSelected(); drawMap(); });

/* ---------- size ---------- */
function sizeMap(){
  const r=mapWrap.getBoundingClientRect(); if (!r.width || !r.height) return;
  dpr=Math.min(2, window.devicePixelRatio||1); mapW=r.width; mapH=r.height;
  mapCanvas.width=Math.round(mapW*dpr); mapCanvas.height=Math.round(mapH*dpr);
  if (!MAP.view) fitSelected();
  drawTicks(); drawMap();
}
new ResizeObserver(()=>sizeMap()).observe(mapWrap);
new ResizeObserver(()=>{ drawTicks(); }).observe(sliderEl);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ COLS.clear(); drawMap(); });

/* ---------- hooks into the chart ---------- */
function afterRender(){
  placeYearLine();
  const key=[...state.active].sort().join();
  if (key!==MAP.fitKey){ MAP.fitKey=key; if (mapW){ fitSelected(); drawMap(); } }
}
const chartRender = render;
render = function(k){ chartRender(k); afterRender(); };
const chartSelect = select;
select = function(obj){
  chartSelect(obj);
  if (!obj || !MAP.on) return;
  const s0=Math.max(obj.s,SNAPS[0]), e0=Math.min(obj.e,NOW);
  const y = obj.n ? obj.a : obj.pt ? obj.y : Math.round(s0+Math.min(150,(e0-s0)/3));
  setYear(y);
};
function setMapOn(on){
  MAP.on=on; try{ localStorage.setItem("wh8-map",on?"on":"off"); }catch(e){}
  bottom.classList.toggle("nomap",!on); $("mapBtn").setAttribute("aria-pressed",on);
  render(topYear());
  if (on) requestAnimationFrame(sizeMap);
}
$("mapBtn").addEventListener("click",()=>setMapOn(!MAP.on));

/* ---------- start ---------- */
MAP.full = buildStops(START,NOW); MAP.stops = MAP.full;
bottom.classList.toggle("nomap",!MAP.on); $("mapBtn").setAttribute("aria-pressed",MAP.on);
MAP.fitKey=[...state.active].sort().join();
loadLand();
setYear(MAP.year);
afterRender();
