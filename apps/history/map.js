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
MAP.year = INIT_YEAR;
/* map mode: "full" fills the chart area, "float" is a small window over the chart, "off" hides it.
   A link with m=map opens the full map, and a link without it the chart; otherwise the last choice, and on a first visit the full map. */
MAP.mode = (()=>{ if (Q.get("m")==="map") return "full"; let v=null; try{ v=localStorage.getItem("wh8-mapmode"); }catch(e){}
  return v==="full"||v==="float"||v==="off" ? v : typeof FROM_URL!=="undefined" && FROM_URL ? (innerWidth>=760 ? "float" : "off") : "full"; })();
MAP.on = MAP.mode!=="off";

const side=$("side"), mapCanvas=$("mapCanvas"), mctx=mapCanvas.getContext("2d"), mapWrap=$("mapWrap");
const sliderEl=$("slider"), thumbEl=$("thumb"), ticksEl=$("sliderTicks"), ovEl=$("overview"), ovWin=$("ovWin"), ovThumb=$("ovThumb");
let mapW=0, mapH=0, dpr=1;

/* ---------- time stops: small steps where events are dense, big steps where they are sparse ---------- */
const EV_YEARS = (()=>{ const ys=[]; for (const r of REG){ for (const p of r.points) ys.push(p.y); for (const p of r.over) if (p.pick || p.layer==="war") ys.push(p.y); } for (const e of EVENTS) ys.push(e.a,e.b); return ys.sort((a,b)=>a-b); })();
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

/* the name printed on the map: the map data's own, unless a page corrects it (label: in the page) */
const mapLabel = f => (typeof KBLABEL!=="undefined" && KBLABEL.get(f.name+"|"+f.r)) || f.name;

/* ---------- data ---------- */
/* Corner cutting (Chaikin) for coarse rings: early borders in the dataset are a few straight lines.
   Shared borders get the same cut, since both rings hold the same corners. */
function soften(a){
  const n=a.length/2; if (n<4) return a;
  let len=0; for (let i=2;i<a.length;i+=2) len+=Math.hypot(a[i]-a[i-2],a[i+1]-a[i-1]);
  const avg=len/(n-1); let r=a;
  for (let it=0; it<(avg>2.5?2:avg>.8?1:0); it++){
    const m=r.length/2, o=new Float32Array(m*4);
    for (let i=0;i<m;i++){ const j=(i+1)%m, x0=r[2*i], y0=r[2*i+1], x1=r[2*j], y1=r[2*j+1];
      o[4*i]=.75*x0+.25*x1; o[4*i+1]=.75*y0+.25*y1; o[4*i+2]=.25*x0+.75*x1; o[4*i+3]=.25*y0+.75*y1; }
    r=o;
  }
  return r;
}
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
    return {name, prec, r, sub:sub||null, rings:R.map(soften), bb, lab:best, area:bestA/2};
  }).sort((a,b)=>b.area-a.area);
}
function loadSnap(y){
  if (!MAP.data.has(y)) MAP.data.set(y, fetch(`map/w${y}.json`+VER).then(r=>r.json()).then(decode).catch(e=>{ console.warn("map for "+y+" did not load",e); MAP.data.delete(y); return null; }));
  return MAP.data.get(y);
}
function snapFor(y){ let s=SNAPS[0]; for (const v of SNAPS) if (v<=y) s=v; return s; }
function loadLand(){
  return fetch("map/land.json"+VER).then(r=>r.json()).then(j=>{
    /* rings that cross the 180th meridian are unwrapped (longitude past 180), so they do not fill a band across the map */
    MAP.land = j.rings.map(a=>{ const out=new Float32Array(a.length); let x=0,y=0,off=0,px=null;
      for (let i=0;i<a.length;i+=2){ x+=a[i]; y+=a[i+1]; const X=x/10; if (px!==null){ if (X-px>180) off-=360; else if (px-X>180) off+=360; } px=X; out[i]=X+off; out[i+1]=y/10; }
      /* keep the bulk of the ring between -180 and 180: only the part across the meridian goes past it */
      const xs=[]; for (let i=0;i<out.length;i+=2) xs.push(out[i]); xs.sort((a,b)=>a-b);
      const med=xs[xs.length>>1], sh = med>180 ? -360 : med<-180 ? 360 : 0;
      if (sh) for (let i=0;i<out.length;i+=2) out[i]+=sh;
      return out; });
    drawMap();
  }).catch(e=>console.warn("the land outline did not load",e));
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
const isDark = () => { const th=document.documentElement.dataset.theme; return th==="dark" || (th!=="light" && matchMedia("(prefers-color-scheme: dark)").matches); };
/* Each territory keeps its region's hue, nudged so neighbours differ. Tones: a pale fill, a stronger tint along the border
   (the old atlas look), a darker line and a dark label. */
/* CIE Lab of any CSS colour, through a 1px canvas */
const LABC=new Map(), LABX=document.createElement("canvas").getContext("2d",{willReadFrequently:true});
function labOf(css){
  if (LABC.has(css)) return LABC.get(css);
  LABX.clearRect(0,0,1,1); LABX.fillStyle="#000"; LABX.fillStyle=css; LABX.fillRect(0,0,1,1);
  const [r,g,b]=LABX.getImageData(0,0,1,1).data, f=v=>{ v/=255; return v>.04045 ? ((v+.055)/1.055)**2.4 : v/12.92; };
  const R=f(r), G=f(g), B=f(b), X=(R*.4124+G*.3576+B*.1805)/.95047, Y=R*.2126+G*.7152+B*.0722, Z=(R*.0193+G*.1192+B*.9505)/1.08883;
  const k=t=>t>.008856 ? Math.cbrt(t) : 7.787*t+16/116, out=[116*k(Y)-16, 500*(k(X)-k(Y)), 200*(k(Y)-k(Z))];
  LABC.set(css,out); return out;
}
const dE=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
let SEAH=null;
function seaHue(){ if (SEAH===null){ const v=getComputedStyle(document.documentElement).getPropertyValue("--sea").trim();
  SEAH = /^#/.test(v) ? hexToHsl(v)[0] : 205; } return SEAH; }
/* a territory with nothing to read (no state bar, no page) is gray, so the gaps show */
const NOINFO=new Map();
function noInfo(f){
  if (typeof kbOfTerr!=="function") return false;
  const k=f.name+"|"+f.r+"|"+MAP.snap;
  if (!NOINFO.has(k)) NOINFO.set(k, !kbOfTerr(f.name,f.r) && !itemOfFeat(f));
  return NOINFO.get(k);
}
function grayFor(dark){
  const key="gray|"+dark; if (COLS.has(key)) return COLS.get(key);
  const seaL=labOf(getComputedStyle(document.documentElement).getPropertyValue("--sea").trim()), landL=labOf(getComputedStyle(document.documentElement).getPropertyValue("--land").trim());
  let L = dark ? 30 : 80;
  for (let t=0; t<10; t++){ const F=labOf(`hsl(0 0% ${L}%)`); if (dE(F,seaL)>=15 && dE(F,landL)>=9) break; L += dark ? 3 : -3; }
  const c = dark ? {fill:`hsl(0 0% ${L}%)`, edge:"hsl(0 0% 45%)", line:"hsl(0 0% 58%)", text:"hsl(0 0% 78%)"}
                 : {fill:`hsl(0 0% ${L}%)`, edge:"hsl(0 0% 62%)", line:"hsl(0 0% 50%)", text:"hsl(0 0% 32%)"};
  COLS.set(key,c); return c;
}
function colorFor(f){
  const dark=isDark(); if (noInfo(f)) return grayFor(dark);
  const key=(f.sub||f.name)+"|"+f.r+"|"+dark;
  if (COLS.has(key)) return COLS.get(key);
  const base=getComputedStyle(document.documentElement).getPropertyValue("--c-"+f.r);
  const [h0,s0]=hexToHsl(base), k=hash(f.sub||f.name);
  let h=(h0+((k%9)-4)*6+360)%360, s=Math.min(70,s0*.8+((k>>4)%3)*5); const j=((k>>8)%5)-2;
  /* keep land out of the sea's hue, so no territory reads as water: push it away, toward its region's side */
  const sh=seaHue(), d=((h-sh+540)%360)-180;
  const d0=((h0-sh+540)%360)-180;
  if (Math.abs(d0)<12){ h=(sh+72+(h-h0)/2+360)%360; s=Math.max(s,40); }   /* a region whose own hue is sea blue (East Asia) gets its own purple, clear of Europe's indigo and South Asia's magenta */
  else if (Math.abs(d)<34){ const side = d0<0 ? -1 : 1; h=(sh+side*(34+(34-side*d)/2)+360)%360; s=Math.max(s,38); }
  /* a floor on contrast: every fill at least ΔE 15 from the sea and 9 from bare land, so states never read as water or as empty */
  let L = dark ? 26+j*2 : 83+j*2.5, S = dark ? s*.45 : s*.75;
  const seaL=labOf(getComputedStyle(document.documentElement).getPropertyValue("--sea").trim()), landL=labOf(getComputedStyle(document.documentElement).getPropertyValue("--land").trim());
  for (let t=0; t<8; t++){ const F=labOf(`hsl(${h} ${S}% ${L}%)`); if (dE(F,seaL)>=15 && dE(F,landL)>=9) break; S=Math.min(80,S+5); L += dark ? 2 : -2; }
  const c = dark
    ? {fill:`hsl(${h} ${S}% ${L}%)`, edge:`hsl(${h} ${s*.6}% 42%)`, line:`hsl(${h} ${s*.5}% 62%)`, text:`hsl(${h} ${s*.4}% 86%)`}
    : {fill:`hsl(${h} ${S}% ${L}%)`, edge:`hsl(${h} ${s}% 60%)`, line:`hsl(${h} ${s*.85}% 36%)`, text:`hsl(${h} ${s*.8}% 24%)`};
  COLS.set(key,c); return c;
}
/* the map territory that a state bar stands for, when the names match */
function featOf(obj){
  if (!obj || obj.pt || obj.n || obj.ov || !MAP.feats) return null;
  const want=normN(obj.name), shortN=normN(obj.short);
  return MAP.feats.find(f=>f.r===obj.reg && want && (normN(f.name)===want || normN(f.name)===shortN || (normN(f.name).length>3 && want.includes(normN(f.name))))) || null;
}

/* ---------- view ---------- */
function fitBox(b){
  const [x0,y0,x1,y1]=b;
  const k=Math.min(mapW/(x1-x0), mapH/(y1-y0))*0.94;
  MAP.view={x:(x0+x1)/2, y:(y0+y1)/2, k:clampK(k)};
}
/* how far in the map goes: 400 px to a degree, about a city and its surroundings across the pane. The borders are drawn coarsely, so past that there is nothing more to see */
const KMAX=400;
function clampK(k){ return Math.max(Math.max(mapW,1)/400, Math.min(KMAX,k)); }
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

/* outlines only: no line where a ring jumps across the 180th meridian */
function ringLine(path, a, off=0){
  path.moveTo(sx(a[0]+off), sy(a[1]));
  for (let i=2;i<a.length;i+=2){ if (Math.abs(a[i]-a[i-2])>180) path.moveTo(sx(a[i]+off), sy(a[i+1])); else path.lineTo(sx(a[i]+off), sy(a[i+1])); }
}
function ringPath(path, a, off=0){
  path.moveTo(sx(a[0]+off), sy(a[1]));
  for (let i=2;i<a.length;i+=2) path.lineTo(sx(a[i]+off), sy(a[i+1]));
  path.closePath();
}

/* ---------- draw ---------- */
let drawQueued=false;
function drawMap(){ if (drawQueued) return; drawQueued=true; requestAnimationFrame(()=>{ drawQueued=false; paint(); }); }
/* offscreen layers the size of the map canvas, drawn in map units like mctx */
const LAYERS_C=[];
function layer(i){
  const c = LAYERS_C[i] || (LAYERS_C[i]=document.createElement("canvas"));
  if (c.width!==mapCanvas.width || c.height!==mapCanvas.height){ c.width=mapCanvas.width; c.height=mapCanvas.height; }
  const g=c.getContext("2d"); g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation="source-over"; g.globalAlpha=1; g.clearRect(0,0,c.width,c.height);
  g.setTransform(dpr,0,0,dpr,0,0); return g;
}
function blitTo(g, src){ g.save(); g.setTransform(1,0,0,1,0,0); g.globalAlpha=1; g.drawImage(src.canvas,0,0); g.restore(); }
function blit(src, alpha){ mctx.save(); mctx.setTransform(1,0,0,1,0,0); mctx.globalAlpha=alpha; mctx.drawImage(src.canvas,0,0); mctx.restore(); }
/* land shrunk by d: the land, less a band of width d along the coast */
function inland(landP, coast, d){
  const g=layer(3); g.fillStyle="#000"; g.fill(landP,"evenodd");
  g.globalCompositeOperation="destination-out"; g.lineWidth=2*d; g.lineJoin="round"; g.stroke(coast); g.globalCompositeOperation="source-over";
  return g;
}
function paint(){
  if (!MAP.on || !mapW || !MAP.view) return;
  { const ml=mapLevel(); if (ml!==MAP.lastLv){ MAP.lastLv=ml; if (typeof lensCounts==="function") lensCounts(); } }   /* a zoom that brings in another level changes the counts on the topics */
  const cs=getComputedStyle(document.documentElement), dark=isDark();
  const ink=cs.getPropertyValue("--ink").trim(), surf=cs.getPropertyValue("--surface").trim();
  const sea=cs.getPropertyValue("--sea").trim(), land=cs.getPropertyValue("--land").trim();
  mctx.setTransform(dpr,0,0,dpr,0,0);
  /* sea, a little deeper at the edges */
  mctx.fillStyle=sea; mctx.fillRect(0,0,mapW,mapH);
  const vg=mctx.createRadialGradient(mapW/2,mapH/2,Math.min(mapW,mapH)*.35,mapW/2,mapH/2,Math.hypot(mapW,mapH)*.6);
  vg.addColorStop(0,"rgba(20,60,100,0)"); vg.addColorStop(1, dark ? "rgba(0,0,0,.28)" : "rgba(20,60,100,.10)");
  mctx.fillStyle=vg; mctx.fillRect(0,0,mapW,mapH);
  const lon0=lonAt(0), lon1=lonAt(mapW), lat0=latAt(mapH), lat1=latAt(0);
  /* a faint grid of longitude and latitude, spaced to the zoom */
  const step=[5,10,15,30].find(d=>d*MAP.view.k>=70)||30;
  mctx.beginPath();
  for (let x=Math.ceil(lon0/step)*step; x<=lon1; x+=step){ mctx.moveTo(sx(x)+.5,0); mctx.lineTo(sx(x)+.5,mapH); }
  for (let y=Math.ceil(lat0/step)*step; y<=lat1; y+=step){ mctx.moveTo(0,sy(y)+.5); mctx.lineTo(mapW,sy(y)+.5); }
  mctx.lineWidth=1; mctx.strokeStyle = dark ? "rgba(160,200,230,.07)" : "rgba(40,90,130,.10)"; mctx.stroke();
  let landP=null, coast=null;
  if (MAP.land){
    const p=new Path2D(), ln=new Path2D(); landP=p; coast=ln;
    /* a ring that runs past 180 (Chukotka) is drawn again one turn west, so both ends of the map have it */
    for (const a of MAP.land){ ringPath(p,a); ringLine(ln,a); if (a.some(v=>v>180)){ ringPath(p,a,-360); ringLine(ln,a,-360); } }
    /* water lines along the coast, then the land, then a fine coastline */
    mctx.lineJoin="round";
    mctx.strokeStyle = dark ? "rgba(120,170,210,.07)" : "rgba(50,110,160,.08)";
    mctx.lineWidth=14; mctx.stroke(ln); mctx.lineWidth=7; mctx.stroke(ln);
    mctx.fillStyle=land; mctx.fill(p,"evenodd");
    mctx.lineWidth=.8; mctx.strokeStyle = dark ? "rgba(150,190,220,.3)" : "rgba(60,100,130,.45)"; mctx.stroke(ln);
  }
  MAP.paths=[];
  if (MAP.feats){
    const shown=[], selF=featOf(state.sel);
    for (const f of MAP.feats){
      if (!state.active.has(f.r)) continue;
      if (f.bb[2]<lon0 || f.bb[0]>lon1 || f.bb[3]<lat0 || f.bb[1]>lat1) continue;
      const p=new Path2D(); for (const a of f.rings) ringPath(p,a);
      MAP.paths.push([p,f]); shown.push([p,f]);
    }
    /* The borders data is coarse and does not follow coastlines. So each territory is filled on land only,
       grown by D to close the strips of land left between a border and the coast, then filled again at its
       true shape on top, so inland borders stay where the data puts them. Bands and border lines are kept
       off the coast (land shrunk by D), and the coast itself is the edge there. */
    const D=Math.max(1.5, .55*MAP.view.k);
    const fillT = (g,p,c) => { g.fillStyle=c.fill; g.fill(p,"evenodd"); };
    const grow = (g,p,c) => { g.strokeStyle=c.fill; g.lineWidth=2*D; g.lineJoin="round"; g.stroke(p); };
    const T=layer(0), sel=selF && shown.find(([,f])=>f===selF);
    const IN = landP ? inland(landP,coast,D) : null;
    /* growth only within D of the coast, never across an inland border */
    const paintFills = (g,list) => {
      if (landP){ g.save(); g.clip(landP,"evenodd"); const gw=Math.max(5,.6*MAP.view.k);   /* closes hairline gaps between neighbours (about 0.3 degrees) */
        for (const [p,f] of list){ g.strokeStyle=colorFor(f).fill; g.lineWidth=gw; g.lineJoin="round"; g.stroke(p); } g.restore();
        const G=layer(4); G.save(); G.clip(landP,"evenodd"); for (const [p,f] of list) grow(G,p,colorFor(f)); G.restore();
        G.globalCompositeOperation="destination-out"; blitTo(G,IN); G.globalCompositeOperation="source-over"; blitTo(g,G);
        g.save(); g.clip(landP,"evenodd"); }
      for (const [p,f] of list) fillT(g,p,colorFor(f));
      if (landP) g.restore(); };
    paintFills(T,shown);
    blit(T, selF ? .72 : 1);
    if (sel){ const S=layer(1); paintFills(S,[sel]); blit(S,1); }
    /* thin borders on their own layer, faded out towards the coast */
    const B=layer(1);
    B.lineJoin="round";
    for (const [p,f] of shown){
      B.strokeStyle=colorFor(f).line;
      B.globalAlpha = (f.prec>=3 ? .75 : f.prec===2 ? .65 : .55)*(selF && f!==selF ? .7 : 1);
      B.lineWidth = f.prec>=2 ? 1.1 : .9;
      B.setLineDash(f.prec===1 ? [4,3] : []);
      B.stroke(p);
    }
    B.setLineDash([]); B.globalAlpha=1;
    if (sel){ B.lineWidth=5; B.strokeStyle=surf; B.globalAlpha=.9; B.stroke(sel[0]); B.lineWidth=2; B.strokeStyle=RED; B.globalAlpha=1; B.stroke(sel[0]); }
    if (landP){ const M=layer(5); M.filter=`blur(${(D/2.5).toFixed(1)}px)`; blitTo(M,IN); M.filter="none";
      B.globalCompositeOperation="destination-in"; blitTo(B,M); B.globalCompositeOperation="source-over"; }
    blit(B,1);
    if (landP){
      mctx.lineWidth=.9; mctx.strokeStyle = dark ? "rgba(150,190,220,.35)" : "rgba(50,85,115,.5)"; mctx.stroke(coast);
      /* the selected territory's coast in red */
      if (sel){ const R=layer(2); paintFills(R,[sel]); R.globalCompositeOperation="source-in"; R.strokeStyle=RED; R.lineWidth=2; R.lineJoin="round"; R.stroke(coast); R.globalCompositeOperation="source-over"; blit(R,1); }
    }
    /* names where they fit, biggest first, sized by the territory, in its own colour */
    mctx.textAlign="center"; mctx.textBaseline="middle";
    const placed=[], LS="letterSpacing" in mctx;
    const order=shown.map(([,f])=>f).sort((a,b)=>(b===selF)-(a===selF) || (b.bb[2]-b.bb[0])*(b.bb[3]-b.bb[1])-(a.bb[2]-a.bb[0])*(a.bb[3]-a.bb[1]));
    for (const f of order){
      const w=(f.bb[2]-f.bb[0])*MAP.view.k, h=(f.bb[3]-f.bb[1])*MAP.view.k;
      if (h<14 || w<32) continue;
      const size=Math.round(Math.max(10.5,Math.min(20,Math.sqrt(f.area)*MAP.view.k/8)));
      mctx.font=`${size>=15?600:500} ${size}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`;
      if (LS) mctx.letterSpacing = size>=15 ? "1.2px" : size>=12 ? ".4px" : "0px";
      const x=sx(f.lab.cx), y=sy(f.lab.cy), nm=mapLabel(f), tw=mctx.measureText(nm).width;
      if (tw+8>w || x-tw/2<4 || x+tw/2>mapW-4 || y<size || y>mapH-size) continue;
      const r=[x-tw/2-2,y-size*.6,x+tw/2+2,y+size*.6];
      if (placed.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1])) continue;
      placed.push(r);
      const c=colorFor(f);
      mctx.lineWidth=3; mctx.strokeStyle=c.fill; mctx.globalAlpha=.9; mctx.strokeText(nm,x,y);
      mctx.globalAlpha=1; mctx.fillStyle = f===selF ? RED : c.text; mctx.fillText(nm,x,y);
    }
    if (LS) mctx.letterSpacing="0px";
  }
  paintRoutes(ink, surf);
  paintMarks(cs, ink, surf);
  paintRouteLabels(surf);
  if (!state.active.size || (MAP.feats && !MAP.paths.length)){
    mctx.fillStyle=cs.getPropertyValue("--muted").trim(); mctx.font='500 12px "Barlow",Arial,sans-serif'; mctx.textAlign="center";
    mctx.fillText(MAP.feats ? "No mapped territories here in this year" : "Loading the map", mapW/2, mapH/2);
  }
}

/* ---------- overlays and events on the map ---------- */
/* Each item sits where Wikipedia or Wikidata places it (people at their birthplace).
   It shows while the red line is within a window of years around it; people show from age 20 to their death. */
const GEOD = typeof GEO!=="undefined" ? GEO : {};
const geoOf = o => { const g=o.ll||GEOD[wikiTitle(o)]; return g ? [g[1],g[0]] : null; };   /* [lon, lat] */
/* how many years either side of the map's year it shows items for; zoomed in to fine detail, it narrows with the chart */
/* how far the map is zoomed in: 0 with the whole world across it, 2 at about a continent, 3.3 at about a country */
function mapZoom(){ return MAP.view && mapW ? Math.log2(MAP.view.k/Math.max(1e-6, mapW/360)) : 0; }
/* the most detailed level the map shows. Items are marked by impact (1 world scale, 2 a country's turning points, 3 notable, 4 fine detail);
   while Detail follows the zoom, zooming the map into a region brings in level 3, and into a country level 4 */
function mapLevel(){ const s=shownLevel(); if (!state.detailAuto || !MAP.on || MAP.small) return s; const z=mapZoom(); return Math.max(s, z>=3.3 ? 4 : z>=2 ? 3 : 1); }
function winYears(y){ const W=niceFloor(Math.max(10,(NOW-y)/20)); return shownLevel()===4 ? Math.min(W, niceFloor(Math.max(5,300/zoomK()))) : W; }
/* people show in their adult life (from 20, or birth if they died young) to death; other items within W years of their dates */
/* the years shown round the red marker, [from, to]: worked out by winYears, or set by hand with the two handles on the time line
   (MAP.win: the years before and after the marker, which the window keeps as the marker moves) */
MAP.win=null;
/* while time plays inside a window the reader has set, items come on in the order they happened: the map shows the window only as far as the red line.
   A pause keeps that, and so does a step with the arrow keys or the next-event buttons; dragging the line or changing the window shows the whole window again */
MAP.upto=false;
function shownAB(y){ const [a,b]=winAB(y); return MAP.upto && MAP.win ? [a,Math.min(b,y)] : [a,b]; }
function winAB(y){ const W=winYears(y); let a = y-(MAP.win ? MAP.win[0] : W), b = y+(MAP.win ? MAP.win[1] : W); if (a===0) a=-1; if (b===0) b=1; return [a,b]; }
/* what happened shows when it falls in the window; who was alive, like the borders, is told for the marker's own year */
function onMapAt(p,y,a,b){
  if (p.layer==="people"){ const end=p.e||NOW; return Math.min(p.y+20,end)<=y && y<=end; }
  return p.e ? p.y<=b && p.e>=a : p.y>=a && p.y<=b;
}
/* the place a click opened: {g:[lon,lat], on}; away: the items shown there that are outside the years on the map */
MAP.open=null; MAP.away=new Set();
const atPlace=(o,g)=>{ const q=geoOf(o); return !!q && Math.abs(q[0]-g[0])<=.1 && Math.abs(q[1]-g[1])<=.1; };
/* a search's focus: the map shows the item found, its own events and a few big items near it, from any year, not the whole crowd.
   A click on the item opens it out to everything it links to. "Show everything", or a card outside the focus, ends it */
MAP.focus=null;                                   /* {obj, own:[...], all:[...], near:[...], on} */
const focusYr = o => o.y ?? o.s ?? o.a;
function focusOn(obj){
  MAP.focus=null;
  const id = obj && typeof KBOF!=="undefined" ? (KBOF.get(obj)||obj.kb) : null;
  if (obj){
    const F={obj, own:[], all:[], near:[], on:false}; MAP.focus=F;
    const fill=tx=>{
      if (MAP.focus!==F) return;
      const S=new Set(); for (const r of REG) for (const p of [...r.points, ...r.over]) S.add(p);
      const seen=new Set([obj]), a=focusYr(obj), b=obj.e ?? obj.b ?? a;
      for (const k of [...(tx&&tx.links||[]), ...(tx&&tx.back||[]), ...Object.values(tx&&tx.rel||{}).flat()]){
        const o=KBOBJ.get(k); if (!o || seen.has(o) || !S.has(o) || !geoOf(o)) continue; seen.add(o); F.all.push(o); }
      const inYears=o=>a!=null && focusYr(o)!=null && focusYr(o)<=b+10 && (o.e ?? o.b ?? focusYr(o))>=a-10;   /* overlaps its years: a life counts from birth to death */
      F.S=S; F.seen=seen; F.inYears=inYears;
      F.all.sort((p,q)=>inYears(q)-inYears(p) || (p.level||0)-(q.level||0) || Math.abs(focusYr(p)-a)-Math.abs(focusYr(q)-a));
      F.all=F.all.slice(0,30); F.own=(F.all.some(inYears) ? F.all.filter(inYears) : F.all).slice(0,8);   /* its own: from its years, when it has any */
      /* near it: up to 4 of the most important items on the map in these years, inside the box round the item, its events and its path */
      let bx=null; const add=(lon,lat)=>{ bx = bx ? [Math.min(bx[0],lon),Math.min(bx[1],lat),Math.max(bx[2],lon),Math.max(bx[3],lat)] : [lon,lat,lon,lat]; };
      for (const o of [obj, ...F.own]){ const g=geoOf(o); if (g) add(g[0],g[1]); }
      for (const r of routesOf(obj)||[]) for (const [la,lo] of r.p) add(lo,la);
      if (bx){ const y=MAP.year, [wa,wb]=shownAB(y), lv=shownLevel(), near=[];
        for (const r of REG){ if (!state.active.has(r.id)) continue;
          for (const p of r.over){ const g=geoOf(p); if (seen.has(p) || !g || !itemOn(p) || p.level>Math.min(1,lv) || !onMapAt(p,y,wa,wb)) continue;
            if (g[0]>=bx[0]-2 && g[0]<=bx[2]+2 && g[1]>=bx[1]-2 && g[1]<=bx[3]+2){ seen.add(p); near.push(p); } } }
        near.sort((p,q)=>(p.level||0)-(q.level||0) || Math.abs(focusYr(p)-y)-Math.abs(focusYr(q)-y)); F.near=near.slice(0,4); }
      focusBar(); drawMap();
    };
    if (id && typeof kbText==="function") kbText(id).then(fill); else fill(null);
  }
  focusBar(); drawMap();
}
/* opened out: everything the item links to, and the events its own events link to in its years (a conquest's campaigns, their battles) */
function focusOpen(){
  const F=MAP.focus; if (!F) return; F.on=!F.on;
  if (F.on && !F.deep && F.S && typeof kbText==="function"){ F.deep=true;
    Promise.all(F.own.map(o=>KBOF.get(o)).filter(Boolean).map(kbText)).then(txs=>{
      if (MAP.focus!==F) return;
      for (const tx of txs) for (const k of [...(tx&&tx.links||[]), ...Object.values(tx&&tx.rel||{}).flat()]){
        const o=KBOBJ.get(k); if (!o || F.seen.has(o) || !F.S.has(o) || !geoOf(o) || !F.inYears(o)) continue; F.seen.add(o); F.all.push(o); }
      F.all=F.all.slice(0,30); focusBar(); drawMap();
    });
  }
  focusBar(); drawMap();
}
function focusItems(){ const F=MAP.focus, out=[]; if (geoOf(F.obj)) out.push(F.obj); for (const p of [...(F.on ? F.all : F.own), ...F.near]) if (!out.includes(p)) out.push(p); return out; }
function focusBar(){
  const bar=$("mapFocus"); if (!bar) return;
  const F=MAP.focus; bar.hidden=!F; bar.textContent="";
  if (F){
    const nm=F.obj.n||F.obj.name, n=(F.on ? F.all : F.own).length;
    bar.append(el("span",null, n ? `${nm} and ${n} linked ${n===1?"item":"items"}` : `Only ${nm}`));
    if (F.on || F.all.length){ const m=el("button",null, F.on ? "Show fewer" : "Show more"); m.type="button"; m.addEventListener("click",focusOpen); bar.append(m); }
    const x=el("button",null,"Show everything"); x.type="button"; x.addEventListener("click",()=>{ MAP.focus=null; focusBar(); drawMap(); }); bar.append(x);
  }
  if (typeof lensCounts==="function") lensCounts();
}
function mapItems(){
  if (MAP.focus){ MAP.away=new Set(); return focusItems(); }   /* a search's focus: only the item and its own */
  const y=MAP.year, [wa,wb]=shownAB(y), lv=mapLevel(), out=[];
  for (const r of REG){
    if (!state.active.has(r.id)) continue;
    if (state.events) for (const p of r.points) if (p.level<=lv && p.y>=wa && p.y<=wb) out.push(p);
    for (const p of r.over){
      if (p!==state.solo && (!itemOn(p) || p.level>lv)) continue;
      if (onMapAt(p,y,wa,wb) || (p===state.sel && p.layer==="people" && p.y<=y && y<=(p.e||NOW))) out.push(p);
    }
  }
  /* an open place (a click on a marker opens its place, a second click folds it): what else stands there, from any time,
     under the same filters. At most 16, the most important and the nearest in time first. Folded, only the chosen one stays */
  MAP.away=new Set();
  if (MAP.open){ const g=MAP.open.g, has=new Set(out), more=[];
    for (const r of REG){
      if (!state.active.has(r.id)) continue;
      if (state.events) for (const p of r.points) if (p.level<=lv && !has.has(p) && atPlace(p,g)) more.push(p);
      for (const p of r.over) if (itemOn(p) && p.level<=lv && !has.has(p) && atPlace(p,g)) more.push(p);
    }
    more.sort((a,b)=>(b===state.sel)-(a===state.sel) || a.level-b.level || Math.abs(a.y-y)-Math.abs(b.y-y));
    for (const p of (MAP.open.on ? more.slice(0,16) : more.filter(p=>p===state.sel))){ out.push(p); MAP.away.add(p); }
  }
  return out;
}
const IMG=new Map();
function img(src){ let im=IMG.get(src); if (!im){ im=new Image(); im.onload=()=>drawMap(); im.src=src; IMG.set(src,im); } return im.complete && im.naturalWidth ? im : null; }
/* a story step's arrows: routes through waypoints, curved, labelled, drawn in once the map has arrived */
MAP.routes=null;                                  /* {list:[{p:[[lat,lon],...], t}], t0} */
/* an open card's arrows: what moved, and where. Drawn by hand for the shared events (approximate paths, simplified);
   any other item borrows the arrows of the story step that is about it. Each: {p:[[lat,lon],...], t:label} */
const ITEMROUTES = {
 "Late Bronze Age collapse":[{p:[[37.5,24.5],[35.2,29.5],[32.8,34.6]],t:"Sea raids on the Levant coast"},{p:[[36.2,27.5],[33.2,29.5],[31.2,31.4]],t:"Raids on the Nile delta"}],
 "Alexander's conquests":[{p:[[40.76,22.52],[40.2,27.2],[36.84,36.2],[33.27,35.2],[31.2,29.9],[36.36,43.25],[32.54,44.42],[29.93,52.89],[36.76,66.9],[39.65,66.96],[32.8,73.6]],t:"Alexander's march east"},
   {p:[[32.8,73.6],[24.8,67.8],[26.2,62],[32.19,48.25],[32.54,44.42]],t:"Return to Babylon"}],
 "Silk Road opens":[{p:[[34.3,108.9],[40.14,94.66],[39.47,75.99],[39.65,66.96],[37.66,62.19],[33.09,44.58],[36.2,36.16]],t:"Overland route west"},{p:[[34.3,108.9],[38.5,100.5],[40.4,71.8],[36.76,66.9]],t:"Zhang Qian's mission"}],
 "Plague of Justinian":[{p:[[31.04,32.55],[34.5,28.2],[38,26],[41.01,28.98]],t:"From Egypt to Constantinople"},{p:[[41.01,28.98],[37.5,20],[41.9,12.5],[43.3,5.37]],t:"West by sea"}],
 "Arab conquests":[{p:[[24.47,39.61],[31.78,35.22],[30,31.23],[35.68,10.1],[35.76,-5.83],[39.86,-4.02]],t:"West to Spain"},{p:[[24.47,39.61],[33.09,44.58],[34.2,48.37],[37.66,62.19],[39.65,66.96]],t:"East to the Oxus"},
   {p:[[33.09,44.58],[29.6,52.5],[26.2,62],[30.2,71.47]],t:"To the Indus"}],
 "Indian Ocean trade at full reach":[{p:[[-8.96,39.5],[2.04,45.34],[12.8,45.03],[8.89,76.6],[3,100.5],[-2.99,104.76],[23.13,113.26]],t:"Monsoon sea route"},{p:[[27.67,52.34],[21.5,61.5],[8.89,76.6]],t:"Gulf route to India"}],
 "Mongol conquests":[{p:[[47.2,102.83],[39.65,66.96],[48.5,45.5],[50.45,30.52],[47.9,20.9]],t:"West to Hungary"},{p:[[39.65,66.96],[35.7,51.4],[33.34,44.4],[32.55,35.35]],t:"To Baghdad and Syria"},
   {p:[[47.2,102.83],[39.9,116.4],[30.25,120.17]],t:"Conquest of China"},{p:[[35.1,129.04],[33.6,130.4]],t:"Japan, two failed invasions"}],
 "Black Death":[{p:[[42.4,77.2],[48.5,45.5],[45.03,35.38]],t:"From Central Asia"},{p:[[45.03,35.38],[41.01,28.98],[38.19,15.55],[43.3,5.37]],t:"By ship from Caffa"},
   {p:[[43.3,5.37],[48.86,2.35],[51.5,-0.12],[60.39,5.32]],t:"North across Europe"},{p:[[41.01,28.98],[34.5,28.5],[31.2,29.9]],t:"To Egypt"}],
 "Zheng He's voyages":[{p:[[32.06,118.8],[13.77,109.22],[2.2,102.25],[6.03,80.22],[11.25,75.78],[27.1,56.45]],t:"To Calicut and Hormuz"},{p:[[6.03,80.22],[4,62],[2.04,45.34],[-3.22,40.12]],t:"To East Africa"}],
 "Columbian Exchange":[{p:[[37.39,-5.98],[28.1,-15.4],[18.5,-69.9]],t:"Horses, wheat, sugar cane, smallpox"},{p:[[19.2,-96.13],[23.13,-82.38],[35,-60],[38.7,-27.2],[37.39,-5.98]],t:"Maize, potatoes, tomatoes, silver"}],
 "Atlantic slave trade":[{p:[[53.4,-2.99],[36,-15],[5.08,-1.35]],t:"Cloth, guns and metal goods"},{p:[[5.08,-1.35],[8,-35],[18,-76.8]],t:"Middle Passage to the Caribbean"},
   {p:[[-8.84,13.23],[-12.97,-38.5]],t:"Angola to Brazil"},{p:[[18,-76.8],[38,-50],[53.4,-2.99]],t:"Sugar, tobacco, cotton"}],
 "Industrialisation begins":[{p:[[53.48,-2.24],[50.63,5.57],[51.45,7.01]],t:"To Belgium and the Ruhr"},{p:[[53.48,-2.24],[48,-40],[42.63,-71.32]],t:"To New England"}],
};
let STEPROUTES=null;
function routesOf(obj){
  if (!obj) return null;
  const more=nm=>nm && (ITEMROUTES[nm] || (typeof MOREROUTES!=="undefined" && (MOREROUTES[nm] || ITEMROUTES[SAMEROUTE[nm]] || MOREROUTES[SAMEROUTE[nm]])));
  const own=more(obj.n||obj.name) || (obj.kb && typeof KBX!=="undefined" && KBX[obj.kb] && more(KBX[obj.kb].chart)); if (own) return own;   /* routes.js: more paths, and cards that reuse one */
  if (!STEPROUTES){ STEPROUTES=new Map();
    if (typeof STORYS!=="undefined" && typeof findItem==="function") for (const s of STORYS) for (const st of s.stops||[]) if (st.item && st.m && st.m.length){ const it=findItem(st.item); if (it && !STEPROUTES.has(it)) STEPROUTES.set(it, st.m); } }
  return STEPROUTES.get(obj)||null;
}
function routeView(list, extra, L=0){
  let b=null; const add=(lon,lat)=>{ b = b ? [Math.min(b[0],lon),Math.min(b[1],lat),Math.max(b[2],lon),Math.max(b[3],lat)] : [lon,lat,lon,lat]; };
  for (const r of list) for (const [la,lo] of r.p) add(lo,la);
  if (extra) add(extra[0],extra[1]);
  if (!b) return null;
  const px=Math.max((b[2]-b[0])*.12+2, (16-(b[2]-b[0]))/2), py=Math.max((b[3]-b[1])*.12+2, (10-(b[3]-b[1]))/2);   /* at least 16 by 10 degrees, so a short path keeps the places round it */
  const x0=b[0]-px, x1=b[2]+px, y0=b[1]-py, y1=b[3]+py;
  /* L: pixels on the left covered by the story card; fit the box in the rest */
  const k=clampK(Math.min((mapW-L)/Math.max(1e-3,x1-x0), mapH/Math.max(1e-3,y1-y0))*0.92);
  return {x:(x0+x1)/2-(L/2)/k, y:(y0+y1)/2, k};
}
/* route labels go on top of everything, markers included: each takes the first place clear of the others, above or below its line */
function paintRouteLabels(surf){
  const RL=MAP.routeLabels; MAP.routeLabels=null; if (!RL || !RL.labels.length) return;
  const {labels, C}=RL;
  mctx.save();
  mctx.font="600 12.5px 'Barlow Semi Condensed', Barlow, sans-serif"; mctx.textAlign="center"; mctx.textBaseline="middle";
  const boxes=[];
  for (const L of labels){
    const w=mctx.measureText(L.t).width+10, h=17;
    const free=(x,y)=>!boxes.some(q=>x-w/2<q[2] && x+w/2>q[0] && y-h/2<q[3] && y+h/2>q[1]) && x-w/2>4 && x+w/2<mapW-4 && y-h/2>4 && y+h/2<mapH-4;
    let M=null;
    for (const c of L.cands){ for (const dy of [-12,13]){ if (free(c[0],c[1]+dy)){ M=[c[0],c[1]+dy]; break; } } if (M) break; }
    if (!M) continue;
    boxes.push([M[0]-w/2,M[1]-h/2,M[0]+w/2,M[1]+h/2]);
    mctx.fillStyle=surf; mctx.globalAlpha=.88; mctx.beginPath();
    if (mctx.roundRect) mctx.roundRect(M[0]-w/2,M[1]-h/2,w,h,5); else mctx.rect(M[0]-w/2,M[1]-h/2,w,h);
    mctx.fill(); mctx.globalAlpha=1; mctx.fillStyle=C; mctx.fillText(L.t,M[0],M[1]+.5);
  }
  mctx.restore();
}
function paintRoutes(ink, surf){
  MAP.routeLabels=null;
  const R=MAP.routes; if (!R || !R.list.length) return;
  const now=performance.now(), prog=Math.max(0,Math.min(1,(now-R.t0)/1100));
  if (prog<=0){ requestAnimationFrame(drawMap); return; }
  const C = isDark() ? "#ff9a5c" : "#c8410b";
  mctx.save(); mctx.lineCap="round"; mctx.lineJoin="round";
  const labels=[], ends=new Set();
  for (const r of R.list){
    const P=r.p.map(([la,lo])=>[sx(lo),sy(la)]); if (P.length<2) continue;
    const path=new Path2D(); let len=0;
    for (let i=1;i<P.length;i++) len+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
    path.moveTo(P[0][0],P[0][1]);
    let endFrom;
    if (P.length===2){                              /* one leg: a gentle arc */
      const [a,b]=P, mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2, dx=b[0]-a[0], dy=b[1]-a[1], c=[mx-dy*.18, my+dx*.18];
      path.quadraticCurveTo(c[0],c[1],b[0],b[1]); endFrom=c;
    } else {                                        /* through waypoints: curves via the midpoints */
      for (let i=1;i<P.length-1;i++){ const m=[(P[i][0]+P[i+1][0])/2,(P[i][1]+P[i+1][1])/2]; path.quadraticCurveTo(P[i][0],P[i][1],m[0],m[1]); }
      const L=P[P.length-1]; path.lineTo(L[0],L[1]); endFrom=P[P.length-2];
    }
    const dash=[len*prog+1, len+10];
    mctx.setLineDash(dash);
    mctx.strokeStyle=surf; mctx.globalAlpha=.85; mctx.lineWidth=5.5; mctx.stroke(path);
    mctx.strokeStyle=C; mctx.globalAlpha=1; mctx.lineWidth=2.6; mctx.stroke(path);
    mctx.setLineDash([]);
    /* where it starts (and, for a line with no direction, where it ends): a dot, and the place's name (ROUTEFROM in routes.js) once drawn */
    for (const i of r.line ? [0, P.length-1] : [0]){
      const q=r.p[i], k=q[0].toFixed(2)+","+q[1].toFixed(2); if (Math.abs(q[1])>=179.8 || ends.has(k)) continue; ends.add(k);
      mctx.beginPath(); mctx.arc(P[i][0],P[i][1],4.6,0,7); mctx.fillStyle=C; mctx.fill(); mctx.strokeStyle=surf; mctx.lineWidth=2; mctx.stroke();
      const nm=typeof ROUTEFROM!=="undefined" && ROUTEFROM[k]; if (nm && prog>=1) labels.push({t:nm, cands:[P[i]]});
    }
    if (prog>=1){
      const E=P[P.length-1], ang=Math.atan2(E[1]-endFrom[1],E[0]-endFrom[0]), h=11;
      const head=new Path2D(); head.moveTo(E[0],E[1]);
      head.lineTo(E[0]-h*Math.cos(ang-.45),E[1]-h*Math.sin(ang-.45)); head.lineTo(E[0]-h*Math.cos(ang+.45),E[1]-h*Math.sin(ang+.45)); head.closePath();
      if (!r.line){ mctx.strokeStyle=surf; mctx.lineWidth=3; mctx.stroke(head); mctx.fillStyle=C; mctx.fill(head); }   /* a line (a railway, a road) has no direction */
      if (r.t){                                     /* places for the label along the route, middle first */
        const cands=[];
        if (P.length===2){ for (const f of [.5,.35,.65,.2,.8]){ const a=P[0], b=P[1], dx=b[0]-a[0], dy=b[1]-a[1], bul=2*f*(1-f)*.18;   /* where the arc is at f: half the control point's pull at the middle */
          cands.push([a[0]+dx*f-dy*bul, a[1]+dy*f+dx*bul]); } }
        else { const pts=[]; for (let i=1;i<P.length;i++){ pts.push([(P[i-1][0]+P[i][0])/2,(P[i-1][1]+P[i][1])/2]); if (i<P.length-1) pts.push(P[i]); }
          const m=(pts.length-1)/2; pts.map((q,i)=>[q,Math.abs(i-m)]).sort((x,y)=>x[1]-y[1]).forEach(([q])=>cands.push(q)); }
        labels.push({t:r.t, cands});
      }
    }
  }
  MAP.routeLabels={labels, C};
  mctx.restore();
  if (prog<1) requestAnimationFrame(drawMap);
}
function paintMarks(cs, ink, surf){
  MAP.marks=[];
  const y=MAP.year, W=winYears(y), [wa,wb]=shownAB(y), items=mapItems().map(o=>({o, g:geoOf(o)})).filter(m=>m.g);
  $("mapWin").textContent = (state.events||state.layers.size) && !MAP.small ? `Showing ${fmt(Math.max(START,wa))} to ${fmt(Math.min(NOW,wb))}` : "";
  placeWin();
  if (!items.length) return;
  /* most important first, so they keep their place; the rest step aside when they would cover one.
     Choosing an item changes none of this: every marker stays where it was, the chosen one only gains its red ring */
  items.sort((a,b)=>MAP.away.has(a.o)-MAP.away.has(b.o) || a.o.level-b.o.level || Math.abs(a.o.y-y)-Math.abs(b.o.y-y));
  /* markers grow as the map zooms in, so they stay readable against big territories: up to 2.2 times at 8 times the world view */
  const zf = Math.max(1, Math.min(MAP.small ? 1.6 : 2.2, 1 + 0.45*Math.log2(MAP.view.k/Math.max(1e-6, mapW/360))));
  /* What stands on the map for an item: its own model or portrait, else the shared icon for its kind (levels 1 and 2), else a dot.
     A piece stands on a small base in its topic colour, and the base sits on the place. */
  const KD = typeof KINDS!=="undefined" ? KINDS : {}, KDEF = typeof KIND_DEFAULT!=="undefined" ? KIND_DEFAULT : {}, BOX = typeof ARTBOX!=="undefined" ? ARTBOX : {};
  /* past that, deep in, the land keeps growing under them, so the pieces and their names grow on too: up to twice the size, the names up to half as big again */
  const deep = MAP.small ? 0 : Math.max(0, Math.log2(MAP.view.k/Math.max(1e-6, mapW/360))-2.67), big = Math.min(2, 1+.3*deep), fs = 1+(big-1)*.5;
  const grow = Math.min(1,(zf-1)/1.2), sz = (MAP.small ? .85 : 1)*(.62+.38*grow)*big, placed=[];
  const picOf = o => { const P=portraitOf(o), own = ovPicOf(o) || (P ? "people/"+P.f : null); if (own) return [own, o.level===1 ? 60 : 54, 1];
    if (o.level>(deep>.6 ? 3 : 2)) return null; const k = KD[o.name] || KDEF[o.ov ? o.layer : "event"]; return k ? ["kinds/"+k+".png", o.level===1 ? 50 : o.level===2 ? 44 : 38] : null; };   /* zoomed into a country, level 3 gets its icon too */
  const hit = (a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1], held=[];
  const labFont = o => `600 ${((o.level===1 ? 13 : 12)*fs).toFixed(1)}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`, lh=8*fs;
  /* where a name can go by its marker: right, left, under */
  const labAt = (m,fx,fy,tw) => { const hw=m.w/2, ty = m.dot ? fy : fy-m.h*.34, under = fy+(m.dot ? m.dot+3 : m.s*.13+4);
    return [[fx+hw+3, ty-lh, fx+hw+7+tw, ty+lh], [fx-hw-7-tw, ty-lh, fx-hw-3, ty+lh], [fx-tw/2-2, under, fx+tw/2+2, under+2*lh]]; };
  /* an item listed under two regions (the same name at the same place) stands once: the chosen one, else the more important */
  const okey = m => m.o.name+"|"+m.g[0].toFixed(2)+"|"+m.g[1].toFixed(2), once=new Map();
  for (const m of items){ const k=okey(m), c=once.get(k); if (!c || m.o===state.sel) once.set(k,m); }
  for (const m of items){
    if (once.get(okey(m))!==m) continue;
    const x0=sx(m.g[0]), y0=sy(m.g[1]); if (x0<-20||x0>mapW+20||y0<-20||y0>mapH+20) continue;
    let P=picOf(m.o); const sel=m.o===state.sel; let mk;
    /* seen from far, a level 2 item with a shared icon keeps it only where its own place is free; in a crowd it is a dot */
    if (P && !P[2] && m.o.level===2 && !MAP.away.has(m.o) && grow<.5){ const s=P[1]*sz, b=[x0-s*.5, y0-s*.86, x0+s*.5, y0+s*.1]; if (placed.some(q=>hit(b,q.b))) P=null; }
    if (P){ const s=P[1]*sz, bb=BOX[P[0]]||[0,0,96,96], k=s/Math.max(bb[2],bb[3]), w=bb[2]*k, h=bb[3]*k;
      mk={o:m.o, x0, y0, pic:P[0], bb, w, h, s, r:Math.max(w,h)*.5, box:(fx,fy)=>[fx-w*.5, fy-h*.86, fx+w*.5, fy+s*.1]}; }
    else { const r = (m.o.level<=2 ? 5 : m.o.level===3 ? 4 : 3.2) + 1.2*grow; mk={o:m.o, x0, y0, dot:r, w:2*r, h:2*r, s:2*r, r:r+3, box:(fx,fy)=>[fx-r-1, fy-r-1, fx+r+1, fy+r+1]}; }
    /* the true place first, then a step aside on a ring; two markers may not cover each other.
       An item from another time stands further out and needs room for its name and year, which it then holds */
    const aw=MAP.away.has(m.o) && !sel, holds = aw, kMax = aw ? 3 : 2; let tw=0;
    if (holds){ mctx.font=labFont(m.o); tw=mctx.measureText(MAP.away.has(m.o) ? m.o.name+", "+fmt(m.o.y) : m.o.name).width; }
    const st=Math.max(11, mk.w*.9)*(aw ? 1.5 : 1); let pos=null;
    for (let k=0; k<=kMax && !pos; k++){ const n=Math.max(1,6*k); for (let i=0;i<n;i++){ const a=i/n*Math.PI*2, fx=x0+Math.cos(a)*k*st, fy=y0+Math.sin(a)*k*st*.8, b=mk.box(fx,fy);
      if (placed.some(q=>hit(b,q.b)) || held.some(q=>hit(b,q))) continue;
      if (holds){ const L=labAt(mk,fx,fy,tw).find(t=>t[0]>2 && t[2]<mapW-2 && !placed.some(q=>hit(t,q.b)) && !held.some(q=>hit(t,q))); if (!L && aw && k<kMax) continue; mk.lab=L||null; }
      pos=[fx,fy,b]; break; } }
    if (pos && mk.lab) held.push(mk.lab);
    if (!pos){ if (!sel) continue; pos=[x0,y0,mk.box(x0,y0)]; }
    mk.fx=pos[0]; mk.fy=pos[1]; mk.b=pos[2]; mk.x=mk.fx; mk.y = mk.dot ? mk.fy : mk.fy-mk.h*.42;      /* x, y: the middle of the marker, for pointing at it */
    placed.push(mk); MAP.marks.push(mk);
  }
  /* dots first, then the pieces from the back of the map to the front, the chosen one last */
  const order=MAP.marks.slice().sort((a,b)=>(a.o===state.sel)-(b.o===state.sel) || (!!a.pic)-(!!b.pic) || a.fy-b.fy);
  const oval=(x,yy,rx,ry)=>{ mctx.beginPath(); mctx.ellipse(x,yy,rx,ry,0,0,7); };
  for (const m of order){
    const o=m.o, col = o.ov ? LAYER[o.layer].c : "#5b6b7b", sel=o===state.sel;
    if (m.fx!==m.x0 || m.fy!==m.y0){ mctx.strokeStyle=ink; mctx.globalAlpha=.45; mctx.lineWidth=1; mctx.beginPath(); mctx.moveTo(m.x0,m.y0); mctx.lineTo(m.fx,m.fy); mctx.stroke(); mctx.globalAlpha=1;
      mctx.fillStyle=ink; mctx.beginPath(); mctx.arc(m.x0,m.y0,2,0,7); mctx.fill(); }
    const far = sel ? 0 : MAP.away.has(o) ? 1.4 : o.layer==="people" ? 0 : Math.min(1,Math.abs(o.y-y)/W);      /* how far the item is from the map's year, 0 to 1 */
    mctx.globalAlpha = 1-(m.dot ? .45 : .22)*far;
    if (m.dot){ mctx.beginPath(); mctx.arc(m.fx,m.fy,m.dot,0,7); mctx.fillStyle=col; mctx.fill(); mctx.lineWidth=1.5; mctx.strokeStyle=surf; mctx.stroke();
      if (vidOf(o)){ mctx.lineWidth=1.25; mctx.strokeStyle = sel ? RED : col; mctx.beginPath(); mctx.arc(m.fx,m.fy,m.dot+3.5,0,7); mctx.stroke(); }
      if (sel){ mctx.lineWidth=2.5; mctx.strokeStyle=RED; mctx.beginPath(); mctx.arc(m.fx,m.fy,m.dot+2,0,7); mctx.stroke(); }
      mctx.globalAlpha=1; continue; }
    const rx=Math.max(m.w*.42, m.s*.27), ry=rx*.36;
    mctx.fillStyle="rgba(10,20,30,.28)"; oval(m.fx,m.fy+2.5,rx+1.5,ry+1.5); mctx.fill();
    mctx.fillStyle=col; oval(m.fx,m.fy,rx,ry); mctx.fill(); mctx.lineWidth=1.25; mctx.strokeStyle="rgba(255,255,255,.75)"; mctx.stroke();
    if (vidOf(o)){ mctx.lineWidth=1.5; mctx.strokeStyle = sel ? RED : col; oval(m.fx,m.fy,rx+7.5,ry+6); mctx.stroke(); }   /* a second ring: the item has a video */
    if (sel){ mctx.lineWidth=2.5; mctx.strokeStyle=RED; oval(m.fx,m.fy,rx+3.5,ry+3); mctx.stroke(); }
    const im=img(m.pic);
    if (im){ mctx.imageSmoothingEnabled=true; mctx.imageSmoothingQuality="high"; mctx.drawImage(im,m.bb[0],m.bb[1],m.bb[2],m.bb[3], m.fx-m.w/2, m.fy+ry*.45-m.h, m.w, m.h); }
    mctx.globalAlpha=1;
  }
  /* names beside the most important markers, where they fit: to the right, else to the left, else under */
  mctx.textAlign="left"; mctx.textBaseline="middle"; mctx.lineJoin="round";
  const boxes=MAP.marks.map(m=>m.b).concat(held), maxL = MAP.small ? 6 : 24; let nL=0;
  for (const m of MAP.marks){
    const isSel = m.o===state.sel;
    if (nL>=maxL && !isSel) continue;
    const away=MAP.away.has(m.o), txt = away ? m.o.name+", "+fmt(m.o.y) : m.o.name;
    if (!isSel && !away && m.o.level>(MAP.small ? 1 : deep>.6 ? 3 : 2)) continue;
    mctx.font=labFont(m.o);
    const tw=mctx.measureText(txt).width, tries=labAt(m,m.fx,m.fy,tw);
    let b = m.lab || tries.find(t=>t[0]>2 && t[2]<mapW-2 && !boxes.some(q=>hit(t,q)));
    if (!b){ if (!isSel) continue; b=tries[0]; }
    boxes.push(b); nL++;
    mctx.lineWidth=3.5*fs; mctx.strokeStyle=surf; mctx.strokeText(txt,b[0]+2,(b[1]+b[3])/2); mctx.fillStyle=isSel?RED:ink; mctx.fillText(txt,b[0]+2,(b[1]+b[3])/2);
  }
}
/* every territory on the map now that a bar stands for, in any region (an empire can span two) */
function featsOf(obj, feats=MAP.feats){
  if (!obj || obj.pt || obj.n || obj.ov || !feats) return [];
  const want=normN(obj.name), shortN=normN(obj.short); if (!want) return [];
  return feats.filter(f=>{ const n=normN(f.name); return n===want || n===shortN || (n.length>3 && want.includes(n)); });
}
/* the chart bar a territory stands for (the reverse of featOf): a name match alive within 50 years of the map's year */
function itemOfFeat(f){
  const n=normN(f.name), y=MAP.year; if (!n) return null;
  const ok = it => { const w=normN(it.name), sh=normN(it.short); return (n===w || n===sh || (n.length>3 && w.includes(n))) && it.s-50<=y && y<=it.e+50; };
  const home=REG.find(r=>r.id===f.r);
  const c = (home ? home.items.filter(ok) : []).concat(REG.filter(r=>r!==home).flatMap(r=>r.items.filter(ok)));
  return c.sort((a,b)=>((b.s<=y&&y<=b.e)-(a.s<=y&&y<=a.e)) || (normN(b.name)===n)-(normN(a.name)===n))[0] || null;
}
/* is a point (lon, lat) inside a territory, by the even-odd rule the map fills with */
function inFeat(f, lon, lat){
  if (lon<f.bb[0] || lon>f.bb[2] || lat<f.bb[1] || lat>f.bb[3]) return false;
  let c=false;
  for (const a of f.rings) for (let i=0, j=a.length-2; i<a.length; j=i, i+=2){
    const xi=a[i], yi=a[i+1], xj=a[j], yj=a[j+1];
    if ((yi>lat)!==(yj>lat) && lon<(xj-xi)*(lat-yi)/(yj-yi)+xi) c=!c;
  }
  return c;
}
function terrAt(x,y){ for (let i=MAP.paths.length-1;i>=0;i--) if (mctx.isPointInPath(MAP.paths[i][0],x*dpr,y*dpr,"evenodd")) return MAP.paths[i][1]; return null; }
/* a click on a territory opens its bar on the timeline, or a card for the territory when the chart has none; the year and view stay */
function clickTerr(f){
  const it=itemOfFeat(f);
  MAP.keepYear=true; select(it || {terr:f, name:f.name, sub:f.sub, reg:f.r}); MAP.keepYear=false;
}
function markAt(x,y){ for (const m of MAP.marks||[]) if (Math.hypot(m.x-x,m.y-y)<=m.r+2) return m; return null; }

/* ---------- auto zoom: the map follows what is selected ---------- */
let flyT=0;
const CALM = matchMedia("(prefers-reduced-motion: reduce)");   /* the reader asked for less motion: the map jumps, it does not fly */
function flyTo(v){
  if (!MAP.view || !mapW){ MAP.view=v; return; }
  if (CALM.matches){ cancelAnimationFrame(flyT); MAP.view=v; paint(); return; }
  const a={...MAP.view}, t0=performance.now(), T=480; cancelAnimationFrame(flyT);
  const step=t=>{ const f=Math.min(1,(t-t0)/T), e=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
    MAP.view={x:a.x+(v.x-a.x)*e, y:a.y+(v.y-a.y)*e, k:Math.exp(Math.log(a.k)+(Math.log(v.k)-Math.log(a.k))*e)}; paint();
    if (f<1) flyT=requestAnimationFrame(step); };
  flyT=requestAnimationFrame(step);
}
function boxView(b){ const [x0,y0,x1,y1]=b; return {x:(x0+x1)/2, y:(y0+y1)/2, k:clampK(Math.min(mapW/Math.max(1e-3,x1-x0), mapH/Math.max(1e-3,y1-y0))*0.9)}; }
const normN = t => (t||"").toLowerCase().replace(/[^a-z ]/g,"").replace(/\b(the|empire|kingdom|of|dynasty|sultanate|khanate|state|states)\b/g,"").trim();
function viewFor(obj){
  if (!mapW) return null;
  const R=routesOf(obj); if (R){ const v=routeView(R, obj.n ? null : geoOf(obj)); if (v) return v; }   /* a card with arrows: frame the arrows */
  if (obj.n){ let b=null; for (const id of obj.r||[]){ const r=REGBOX[id]; if (r) b = b ? [Math.min(b[0],r[0]),Math.min(b[1],r[1]),Math.max(b[2],r[2]),Math.max(b[3],r[3])] : r.slice(); } return b ? boxView(b) : null; }
  if (!obj.pt && MAP.feats){
    /* a state: its own territory on the map when the names match */
    const f=featOf(obj);
    if (f){ const [x0,y0,x1,y1]=f.bb, px=(x1-x0)*.25+2, py=(y1-y0)*.25+2; return boxView([x0-px,y0-py,x1+px,y1+py]); }
  }
  const g=geoOf(obj);
  if (g){ const span = obj.pt ? 28 : 40; return {x:g[0], y:g[1], k:clampK(Math.max(MAP.view.k, Math.min(mapW,mapH)/span))}; }
  const r=REGBOX[obj.reg]; return r ? boxView(r) : null;
}
function followSel(obj){ if (obj && obj.terr) return; if (!MAP.on || !obj || Date.now()<(MAP.noFollow||0)) return; const v=viewFor(obj); if (!v) return;
  if (MAP.view && mapW) flyArc({...MAP.view}, v, 800, 550, 1000, 480); else flyTo(v); }   /* far: out slowly, across, in; near: a quick glide */
/* a long move for stories: zoom out slowly until both places are in view, move across quickly, zoom in slowly */
function flyArc(a, v, T1=800, T2=550, T3=1000, glide=1300){
  if (!mapW){ MAP.view=v; return; }
  cancelAnimationFrame(flyT);
  if (CALM.matches){ MAP.view=v; paint(); return; }
  const ez=f=>f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2, lk=(k0,k1,e)=>Math.exp(Math.log(k0)+(Math.log(k1)-Math.log(k0))*e);
  const dx=Math.abs(v.x-a.x), dy=Math.abs(v.y-a.y);
  const kFit=clampK(Math.min(mapW/(dx*1.5+12), mapH/(dy*1.5+10)));
  const kMid=Math.min(a.k, v.k, kFit);
  const t0=performance.now();
  if (kMid > .8*Math.min(a.k,v.k)){                  /* close by: one slow glide */
    const T=glide, step=t=>{ const f=Math.min(1,(t-t0)/T), e=ez(f);
      MAP.view={x:a.x+(v.x-a.x)*e, y:a.y+(v.y-a.y)*e, k:lk(a.k,v.k,e)}; paint(); if (f<1) flyT=requestAnimationFrame(step); };
    flyT=requestAnimationFrame(step); return;
  }
  const step=t=>{ const d=t-t0;
    if (d<T1){ const e=ez(d/T1); MAP.view={x:a.x, y:a.y, k:lk(a.k,kMid,e)}; }
    else if (d<T1+T2){ const e=ez((d-T1)/T2); MAP.view={x:a.x+(v.x-a.x)*e, y:a.y+(v.y-a.y)*e, k:kMid}; }
    else { const e=ez(Math.min(1,(d-T1-T2)/T3)); MAP.view={x:v.x, y:v.y, k:lk(kMid,v.k,e)}; }
    paint(); if (d<T1+T2+T3) flyT=requestAnimationFrame(step); };
  flyT=requestAnimationFrame(step);
}

/* ---------- year ---------- */
function fmtYear(y){ return y>=NOW ? "today" : fmt(y===0?1:y); }
function setYear(y, opt={}){
  if (!isFinite(y)) return;
  y=Math.max(START,Math.min(NOW,Math.round(y))); if (y===0) y=1;
  if (y<MAP.lo || y>MAP.hi){ MAP.lo=START; MAP.hi=NOW; MAP.stops=MAP.full; drawTicks(); }
  if (MAP.upto && !opt.keep && !(typeof playT!=="undefined" && playT)) MAP.upto=false;   /* the red line dragged or a year typed: the whole window shows again. A step keeps the order */
  MAP.year=y;
  $("mapYear").textContent = y>=NOW ? "Today" : fmt(y);
  placeThumb(); placeYearLine(); if (opt.scroll) revealYear();
  const s=snapFor(y);
  $("mapAsOf").textContent = y<SNAPS[0] ? "Earliest borders: 3000 BCE" : s>=NOW ? "Borders today" : `Borders as of ${fmt(s)}`;
  if (s!==MAP.snap){
    MAP.snap=s;
    loadSnap(s).then(feats=>{ if (MAP.snap!==s) return;
      if (feats){ MAP.feats=feats; drawMap(); }
      else { MAP.snap=null; $("mapAsOf").textContent="The borders for this year did not load"; } });   /* the next change of year tries again */
    const i=SNAPS.indexOf(s); if (SNAPS[i+1]) loadSnap(SNAPS[i+1]); if (SNAPS[i-1]) loadSnap(SNAPS[i-1]);
  }
  drawMap();
  sliderEl.setAttribute("aria-valuetext", fmtYear(y)); sliderEl.setAttribute("aria-valuenow", Math.round(y));
  if (typeof onYearChange==="function") onYearChange(y);
}

/* ---------- the time line: one track for the years it covers (all of time, or the years picked) ---------- */
const PADX=10, tipEl=$("tTip");
function sliderX(f){ return PADX + f*(sliderEl.clientWidth-2*PADX); }
function sliderFrac(x){ return (x-PADX)/Math.max(1,sliderEl.clientWidth-2*PADX); }
const yearX = y => sliderX(fracOf(MAP.stops,y));
const zoomedIn = () => MAP.lo>START || MAP.hi<NOW;
/* "1400 to 1900 CE", "500 to 200 BCE", "500 BCE to 500 CE", "1800 CE to today" */
function spanText(a,b){
  if (b>=NOW) return `${fmt(a)} to today`;
  if (a>0 && b>0) return `${a} to ${b} CE`;
  if (a<0 && b<0) return `${-a} to ${-b} BCE`;
  return `${fmt(a)} to ${fmt(b)}`;
}
/* "1453", "500 BCE", "-500", "today" */
function parseYear(t){
  t=String(t).trim().toLowerCase(); if (t==="today" || t==="now") return NOW;
  const m=t.match(/^(-)?(\d{1,4})\s*(bce|bc|ce|ad)?$/); if (!m) return null;
  let y=+m[2]; if (m[1] || (m[3] && m[3][0]==="b")) y=-y; if (y===0) y=1;
  return y<START || y>NOW ? null : y;
}
/* the years on screen in the chart, as a line under the track */
function placeViewWin(){
  const w=$("vWin"); if (!w) return;
  if (!scroller.clientWidth || MAP.mode==="full" || typeof visibleYears!=="function"){ w.style.display="none"; return; }
  let [a,b]=visibleYears(); a=Math.max(a,MAP.lo); b=Math.min(b,MAP.hi);
  if (b<=a){ w.style.display="none"; return; }
  const x0=yearX(a), x1=yearX(b);
  w.style.display="block"; w.style.left=x0+"px"; w.style.width=Math.max(4,x1-x0)+"px";
}
/* the lens on the track: the window of years, never narrower than its two ends and the needle need */
const WGAP=16, WSIZES=[50,100,250,500,1000];
function winX(){ const [a,b]=winAB(MAP.year), x=yearX(MAP.year);
  return [Math.min(yearX(Math.max(MAP.lo,a)), x-WGAP), Math.max(yearX(Math.min(MAP.hi,b)), x+WGAP)]; }
const lensOn = () => MAP.on && MAP.mode!=="off" && typeof state!=="undefined" && (state.events || state.layers.size>0) && sliderEl.clientWidth>0;
let winKey="";
function placeWin(){
  const lens=$("tWin"); if (!lens) return;
  const on=lensOn(), [a,b] = on ? winAB(MAP.year) : [0,0], [xa,xb] = on ? winX() : [0,0];
  const key = on ? [xa.toFixed(1),xb.toFixed(1),a,b,!!MAP.win,MAP.upto ? MAP.year : ""].join() : "off";
  if (key===winKey) return; winKey=key;
  lens.style.display = on ? "block" : "none"; sliderEl.classList.toggle("haslens",on);
  const sel=$("winSel"), show=$("tShow"); sel.hidden=!on; show.hidden=!on;
  if (!on){ sliderEl.classList.remove("lenson"); return; }
  lens.style.left=xa+"px"; lens.style.width=(xb-xa)+"px";
  /* the two years, over the ends; one label for both when they would run into each other */
  const A=Math.max(START,a), B=Math.min(NOW,b), ta=$("tTa"), tb=$("tTb"), W=sliderEl.clientWidth;
  ta.textContent=fmt(A); tb.textContent = B>=NOW ? "today" : fmt(B);
  const wa=ta.offsetWidth, wb=tb.offsetWidth, one = xb-xa < (wa+wb)/2+6;
  if (one){ ta.textContent=spanText(A,B); const w=ta.offsetWidth; ta.style.left=Math.max(w/2,Math.min(W-w/2,(xa+xb)/2))+"px"; }
  else { ta.style.left=Math.max(wa/2,xa)+"px"; tb.style.left=Math.min(W-wb/2,xb)+"px"; }
  ta.classList.add("show"); tb.classList.toggle("show",!one);
  show.textContent=""; show.append("Showing ", el("b",null,spanText(A,Math.min(B,shownAB(MAP.year)[1]))));
  /* the menu: the app's own choice, a round number of years, or the size the window was dragged to */
  const n = MAP.win ? MAP.win[0]+MAP.win[1] : 0, even = MAP.win && MAP.win[0]===MAP.win[1], v = !MAP.win ? "auto" : even && WSIZES.includes(n) ? String(n) : "own";
  if (sel.dataset.v!==v+n){ sel.dataset.v=v+n; sel.textContent="";
    const opt=(val,t)=>{ const o=el("option",null,t); o.value=val; sel.append(o); };
    opt("auto","Window: auto"); if (v==="own") opt("own","Window: "+n.toLocaleString("en-US")+" years");
    for (const k of WSIZES) opt(String(k),"Window: "+k.toLocaleString("en-US")+" years");
    sel.value=v; }
}
/* inside a window the reader has set, the red line moves alone: the window stays where it is and the line stops at its ends */
function needleTo(y,keep){   /* keep: a step (an arrow key, the next-event buttons) leaves the map showing only as far as the red line, if play left it so */
  const a=MAP.year-MAP.win[0], b=MAP.year+MAP.win[1];
  y=Math.round(Math.max(a,MAP.lo,Math.min(b,MAP.hi,y))); if (y===0) y = a>=0 ? 1 : -1;
  MAP.win=[Math.max(0,y-a),Math.max(0,b-y)]; setYear(y,{scroll:true,keep});
}
const ownWin = () => !!MAP.win && lensOn();
/* an arrow key: one stop along the track, or as far as the end of the reader's window */
function stepYear(d){
  const st=MAP.stops, n=st.length-1, y=st[Math.max(0,Math.min(n,stopIndex(st,MAP.year)+d))];
  if (ownWin()) needleTo(y,true); else setYear(y,{scroll:true});
}
function setWin(w){ MAP.win=w; MAP.upto=false; placeWin(); drawMap(); if (typeof lensCounts==="function") lensCounts(); if (typeof saveURL==="function") saveURL(); }
$("winSel").addEventListener("change",e=>{ const v=e.target.value; if (v==="own") return; setWin(v==="auto" ? null : [v/2,v/2]); e.target.blur(); });
function placeThumb(){
  const x=yearX(MAP.year);
  thumbEl.style.left = x+"px"; $("tFill").style.width = Math.max(0,x-PADX)+"px"; placeViewWin(); placeWin();
  const z=zoomedIn();
  ovEl.hidden=!z; $("rangeWrap").classList.toggle("on",z); $("rangeAll").hidden=!z;
  $("rangeLab").textContent = z ? spanText(MAP.lo,MAP.hi) : "Years: all time";
  ovWin.style.display = z ? "block" : "none";
  if (z){ const w=ovEl.clientWidth, a=fracOf(MAP.full,MAP.lo)*w, b=fracOf(MAP.full,MAP.hi)*w;
    ovWin.style.left=a+"px"; ovWin.style.width=Math.max(3,b-a)+"px"; ovThumb.style.left=(fracOf(MAP.full,MAP.year)*w)+"px"; }
}
/* what else is on the track: the life of the selected item, and the steps of a story */
function placeMarks(){
  const sel=$("tSel"), o=typeof state!=="undefined" && state.sel;
  const a = !o ? null : o.pt ? o.y : o.s!=null ? o.s : o.a!=null ? o.a : o.y, b = !o ? null : o.pt ? o.y : o.e!=null ? o.e : o.b!=null ? o.b : a;
  if (a!=null && b>=MAP.lo && a<=MAP.hi){
    const x0=yearX(Math.max(MAP.lo,a)), x1=yearX(Math.min(MAP.hi,b)), w=Math.max(5,x1-x0);
    sel.style.display="block"; sel.style.left=(x0-(w-(x1-x0))/2)+"px"; sel.style.width=w+"px";
  } else sel.style.display="none";
  const d=$("tDots"), st = typeof story!=="undefined" && story ? story.s.stops : null; d.textContent="";
  if (st) st.forEach((s,k)=>{ if (s.y<MAP.lo || s.y>MAP.hi) return;
    const i=el("i", k<story.i ? "on" : k===story.i ? "on cur" : null); i.style.left=yearX(s.y)+"px"; d.append(i); });
}
{ let q=false; new MutationObserver(()=>{ if (q) return; q=true; requestAnimationFrame(()=>{ q=false; placeMarks(); }); }).observe($("detail"),{childList:true}); }
function drawTicks(){
  ticksEl.textContent="";
  /* round years only: the coarsest step first, then finer ones where there is room, never finer than a fortieth of the range */
  const span=MAP.hi-MAP.lo, steps=[1000,500,100,50,10,5,1].filter(s=> s>=span/40), placed=[], W=sliderEl.clientWidth;
  for (const st of steps){
    for (let y=Math.ceil(MAP.lo/st)*st; y<=MAP.hi; y+=st){
      const yy = y===0 ? 1 : y, x=yearX(yy);
      if (placed.some(q=>Math.abs(q-x)<58)) continue;
      placed.push(x);
      const t=el("span","tk"+(x<30 ? " l" : x>W-30 ? " r" : ""), y<0 ? `${-y} BCE` : y===0 ? "1 CE" : String(y)); t.style.left=x+"px"; ticksEl.append(t);
    }
  }
  placeThumb(); placeMarks();
}
/* the story step whose dot is under the pointer */
function dotNear(x){
  if (typeof story==="undefined" || !story) return null;
  let best=null, bd=8;
  story.s.stops.forEach((s,k)=>{ if (s.y<MAP.lo || s.y>MAP.hi) return; const d=Math.abs(yearX(s.y)-x); if (d<bd || (d===bd && k===story.i)){ bd=d; best=k; } });
  return best;
}
/* the label over the track: the year under the pointer, or the story step there */
function tipShow(txt,x){
  tipEl.textContent=txt; const half=tipEl.offsetWidth/2;
  tipEl.style.left=Math.max(half,Math.min(sliderEl.clientWidth-half,x))+"px"; sliderEl.classList.add("tipon");
}
function tipAt(cx){
  const x=cx-sliderEl.getBoundingClientRect().left, k=dotNear(x);
  if (k!=null){ const s=story.s.stops[k]; tipShow(s.t, yearX(s.y)); return; }
  const y=yearAtFrac(MAP.stops,sliderFrac(x)); tipShow(y>=NOW ? "Today" : fmt(y), yearX(y));
}
/* hovering with Shift held shows the pick cursor */
for (const ev of ["keydown","keyup"]) addEventListener(ev,e=>{ if (e.key==="Shift") sliderEl.classList.toggle("shift",ev==="keydown"); });
function onSlide(e){
  const r=sliderEl.getBoundingClientRect();
  setYear(yearAtFrac(MAP.stops, sliderFrac(e.clientX-r.left)), {scroll:true});
}
function pickRange(a,b){ setRange(a,b); if (MAP.mode!=="full" && typeof zoomToRange==="function") zoomToRange(a,b); }
sliderEl.addEventListener("pointerdown",e=>{
  if (e.button) return;
  e.preventDefault(); sliderEl.setPointerCapture(e.pointerId);
  const r=sliderEl.getBoundingClientRect(), x0=e.clientX-r.left;
  const hold=(mv,up)=>{ const done=ev=>{ sliderEl.removeEventListener("pointermove",mv); sliderEl.removeEventListener("pointerup",done); sliderEl.removeEventListener("pointercancel",done); up(ev); };
    sliderEl.addEventListener("pointermove",mv); sliderEl.addEventListener("pointerup",done); sliderEl.addEventListener("pointercancel",done); };
  const wh = e.target.closest ? e.target.closest(".twh") : null;
  if (wh){                                        /* an end of the lens: the years shown on the map start or stop where it is let go */
    const lo=wh.id==="tWa", W=winYears(MAP.year), w = MAP.win ? MAP.win.slice() : [W,W]; let moved=false;
    /* time stands still while an end is held, or the lens would slide out from under the pointer */
    const playing = typeof playT!=="undefined" && !!playT; if (playing) setPlay(false);
    sliderEl.classList.add("lenson"); wh.classList.add("on");
    hold(ev=>{ const x=ev.clientX-r.left; if (Math.abs(x-x0)>3) moved=true; if (!moved) return;
        const y=MAP.year, yy=yearAtFrac(MAP.stops,sliderFrac(x)); if (lo) w[0]=Math.max(0,y-yy); else w[1]=Math.max(0,yy-y);
        MAP.win=w.slice(); MAP.upto=false; placeWin(); drawMap(); if (typeof lensCounts==="function") lensCounts(); },
      ev=>{ wh.classList.remove("on"); if (!ev || ev.pointerType!=="mouse") sliderEl.classList.remove("lenson");
        if (moved && typeof saveURL==="function") saveURL(); if (playing) setPlay(true); });
    return;
  }
  if (e.shiftKey){                                /* Shift and drag: pick the years the line covers */
    const band=$("tBand"); let x1=x0; sliderEl.classList.add("pick");
    const yr=x=>yearAtFrac(MAP.stops,sliderFrac(x));
    hold(ev=>{ x1=Math.max(PADX,Math.min(r.width-PADX,ev.clientX-r.left)); const a=Math.min(x0,x1), b=Math.max(x0,x1);
        band.style.display="block"; band.style.left=a+"px"; band.style.width=(b-a)+"px"; tipShow(spanText(yr(a),yr(b)),(a+b)/2); },
      ()=>{ band.style.display="none"; sliderEl.classList.remove("pick","tipon");
        const ya=yr(Math.min(x0,x1)), yb=yr(Math.max(x0,x1)); if (Math.abs(x1-x0)>6 && yb-ya>=5) pickRange(ya,yb); });
    return;
  }
  if (e.target===thumbEl && lensOn()){               /* the red line, held: in the reader's own window it moves alone, as far as the ends; in the app's window it carries the window along */
    const off=x0-yearX(MAP.year), playing = typeof playT!=="undefined" && !!playT; if (playing) setPlay(false);
    sliderEl.classList.add("drag","needle","lenson");
    hold(ev=>{ const y=yearAtFrac(MAP.stops,sliderFrac(ev.clientX-r.left-off)); if (MAP.win) needleTo(y); else setYear(y,{scroll:true}); },
      ev=>{ sliderEl.classList.remove("drag","needle"); if (!ev || ev.pointerType!=="mouse") sliderEl.classList.remove("lenson");
        if (typeof saveURL==="function") saveURL(); if (playing) setPlay(true); });
    return;
  }
  const k=dotNear(x0);
  if (k!=null && typeof gotoStop==="function"){ gotoStop(k); return; }
  if (e.target.closest && e.target.closest(".tlens")){   /* the body of the lens: a drag carries it through time from where it is, a plain click brings the year to the pointer */
    const off=x0-yearX(MAP.year); let moved=false; sliderEl.classList.add("drag","lenson");
    hold(ev=>{ const x=ev.clientX-r.left; if (Math.abs(x-x0)>3) moved=true; if (moved) setYear(yearAtFrac(MAP.stops,sliderFrac(x-off)),{scroll:true}); },
      ev=>{ sliderEl.classList.remove("drag"); if (!ev || ev.pointerType!=="mouse") sliderEl.classList.remove("lenson"); if (!moved) onSlide(e); });
    return;
  }
  sliderEl.classList.add("drag"); onSlide(e); tipAt(e.clientX);
  hold(ev=>{ onSlide(ev); tipAt(ev.clientX); }, ev=>{ sliderEl.classList.remove("drag"); if (!ev || ev.pointerType!=="mouse") sliderEl.classList.remove("tipon"); });
});
/* over the lens the two labels are its ends; anywhere else the one label is the year under the pointer */
sliderEl.addEventListener("pointermove",e=>{ if (e.buttons || e.pointerType!=="mouse") return;
  const inLens = !!(e.target.closest && e.target.closest(".tlens")) || (e.target===thumbEl && lensOn()); sliderEl.classList.toggle("lenson",inLens);
  if (!inLens) tipAt(e.clientX); });
/* a double click on an end of the lens gives the window back to the app (the press is held by the track, so the end is told by where it was) */
sliderEl.addEventListener("dblclick",e=>{ if (!MAP.win || !lensOn()) return;
  const x=e.clientX-sliderEl.getBoundingClientRect().left, X=winX(); if (!(x>=X[0]-7 && x<=X[0]+10) && !(x>=X[1]-10 && x<=X[1]+7)) return;
  setWin(null); });
sliderEl.addEventListener("pointerleave",()=>{ if (!sliderEl.classList.contains("drag")) sliderEl.classList.remove("tipon","lenson"); });
sliderEl.addEventListener("keydown",e=>{
  const i=stopIndex(MAP.stops,MAP.year), n=MAP.stops.length-1;
  const to = {ArrowRight:i+1,ArrowUp:i+1,ArrowLeft:i-1,ArrowDown:i-1,PageUp:i+10,PageDown:i-10,Home:0,End:n}[e.key];
  if (to==null) return; e.preventDefault();
  if (e.key.startsWith("Arrow")) stepYear((to>i ? 1 : -1)*(e.shiftKey ? 10 : 1));
  else if (ownWin()) needleTo(MAP.stops[Math.max(0,Math.min(n,to))]);      /* Home and End are then the ends of the window */
  else setYear(MAP.stops[Math.max(0,Math.min(n,to))],{scroll:true});
});

/* the year, typed: click the year, type 1453 or 500 BCE, Enter */
{
  const yBtn=$("yearBtn"), yIn=$("yearIn");
  const edit=on=>{ yBtn.hidden=on; yIn.hidden=!on; if (!on) return;
    yIn.classList.remove("bad"); yIn.value = MAP.year>=NOW ? "today" : MAP.year<0 ? `${-MAP.year} BCE` : String(MAP.year); yIn.focus(); yIn.select(); };
  yBtn.addEventListener("click",()=>edit(true));
  yIn.addEventListener("blur",()=>edit(false));
  yIn.addEventListener("keydown",e=>{
    if (e.key==="Escape"){ e.stopPropagation(); edit(false); yBtn.focus(); return; }
    if (e.key!=="Enter") return;
    e.preventDefault();                            /* or the same key press reopens the field through the button */
    const y=parseYear(yIn.value);
    if (y==null){ yIn.classList.remove("bad"); void yIn.offsetWidth; yIn.classList.add("bad"); return; }
    edit(false); if (typeof setPlay==="function") setPlay(false); setYear(y,{scroll:true}); yBtn.focus();
  });
}

/* the years the line covers: a list of periods, any two years, or the small strip that shows where they sit in all of time */
const PERIODS=[["All time",START,NOW],["Ancient",-3000,-500],["Classical",-500,500],["Post-classical",500,1500],["Early modern",1500,1800],["Modern",1800,NOW],["20th century",1900,2000]];
const rPop=$("rangePop"), rBtn=$("rangeBtn");
function setRangePop(open){
  rPop.hidden=!open; rBtn.setAttribute("aria-expanded",open); if (!open) return;
  rPop.textContent=""; rPop.append(el("h3",null,"Years on the time line"));
  const row=(name,sub,cur,fn)=>{ const bt=el("button","ri"); bt.type="button"; bt.append(el("b",null,name), el("span",null,sub));
    if (cur) bt.setAttribute("aria-current","true"); bt.addEventListener("click",()=>{ fn(); setRangePop(false); }); rPop.append(bt); };
  for (const [n,a,b] of PERIODS){ const all = a===START && b===NOW;
    row(n, all ? `${fmt(START)} to today` : spanText(a,b), MAP.lo===a && MAP.hi===b, ()=> all ? setRange(START,NOW) : pickRange(a,b)); }
  if (MAP.mode!=="full" && scroller.clientWidth && typeof visibleYears==="function"){
    const v=visibleYears(), a=Math.max(START,Math.round(v[0])), b=Math.min(NOW,Math.round(v[1]));
    if (b-a>=5 && (a>START || b<NOW)) row("The years on screen", spanText(a,b), false, ()=>setRange(a,b)); }
  const c=el("div","rcust"), fa=el("input"), fb=el("input"), go=el("button","btn","Set"); go.type="button";
  fa.placeholder="From"; fb.placeholder="To"; fa.setAttribute("aria-label","From year, like 500 BCE"); fb.setAttribute("aria-label","To year, like 1453");
  if (zoomedIn()){ fa.value=fmt(MAP.lo); fb.value = MAP.hi>=NOW ? "today" : fmt(MAP.hi); }
  const set=()=>{ const a=parseYear(fa.value), b=parseYear(fb.value), ok = a!=null && b!=null && b-a>=5;
    fa.classList.toggle("bad",a==null); fb.classList.toggle("bad",b==null || (a!=null && b-a<5)); if (!ok) return; (a<=START && b>=NOW) ? setRange(START,NOW) : pickRange(a,b); setRangePop(false); };
  go.addEventListener("click",set);
  for (const f of [fa,fb]) f.addEventListener("keydown",e=>{ if (e.key==="Enter") set(); });
  c.append(fa,"to",fb,go); rPop.append(c);
  rPop.append(el("p","rhint","Play and the track stay inside these years. To pick them by hand, hold Shift and drag along the track."));
}
rBtn.addEventListener("click",()=>setRangePop(rPop.hidden));
document.addEventListener("click",e=>{ if (!rPop.hidden && !$("rangeWrap").contains(e.target)) setRangePop(false); });
document.addEventListener("keydown",e=>{ if (e.key==="Escape" && !rPop.hidden){ e.stopPropagation(); setRangePop(false); rBtn.focus(); } },true);

/* the small strip, shown once years are picked: drag the window to move it, its edges to change it, elsewhere to pick new years; a click jumps */
function ovWinPx(){ const w=ovEl.clientWidth; return zoomedIn() ? [fracOf(MAP.full,MAP.lo)*w, fracOf(MAP.full,MAP.hi)*w] : null; }
function ovGrab(x){ const p=ovWinPx(); if (!p) return null; if (Math.abs(x-p[0])<=6) return "lo"; if (Math.abs(x-p[1])<=6) return "hi"; if (x>p[0] && x<p[1]) return "move"; return null; }
ovEl.addEventListener("pointermove",e=>{ if (e.buttons) return; const g=ovGrab(e.clientX-ovEl.getBoundingClientRect().left);
  ovEl.classList.toggle("edge", g==="lo"||g==="hi"); ovEl.classList.toggle("inwin", g==="move"); });
ovEl.addEventListener("pointerdown",e=>{
  e.preventDefault(); ovEl.setPointerCapture(e.pointerId);
  const r=ovEl.getBoundingClientRect(), x0=e.clientX-r.left, grab=ovGrab(x0), p=ovWinPx(); let x1=x0, a=null, b=null;
  const show=(l,h)=>{ ovWin.style.display="block"; ovWin.style.left=l+"px"; ovWin.style.width=Math.max(3,h-l)+"px"; a=l; b=h; };
  const mv=ev=>{ x1=Math.max(0,Math.min(r.width,ev.clientX-r.left)); if (Math.abs(x1-x0)<=4) return;
    if (grab==="lo") show(Math.min(x1,p[1]-8), p[1]);
    else if (grab==="hi") show(p[0], Math.max(x1,p[0]+8));
    else if (grab==="move"){ const d=Math.max(-p[0],Math.min(r.width-p[1],x1-x0)); show(p[0]+d,p[1]+d); }
    else show(Math.min(x0,x1), Math.max(x0,x1)); };
  const up=()=>{
    ovEl.removeEventListener("pointermove",mv); ovEl.removeEventListener("pointerup",up); ovEl.removeEventListener("pointercancel",up);
    if (a!=null && Math.abs(x1-x0)>4){
      const ya=yearAtFrac(MAP.full,a/r.width), yb=yearAtFrac(MAP.full,b/r.width);
      if (yb-ya>=5){ pickRange(ya,yb); return; }
      placeThumb(); return;
    }
    if (grab==="move") return;
    /* a click outside the picked years moves the window there, the same width, and keeps the years picked */
    if (!grab && p){ const w=p[1]-p[0], l=Math.max(0,Math.min(r.width-w,x0-w/2));
      const ya=yearAtFrac(MAP.full,l/r.width), yb=yearAtFrac(MAP.full,(l+w)/r.width); if (yb-ya>=5) pickRange(ya,yb); }
    setYear(yearAtFrac(MAP.full,x0/r.width),{scroll:true});
  };
  ovEl.addEventListener("pointermove",mv); ovEl.addEventListener("pointerup",up); ovEl.addEventListener("pointercancel",up);
});
function setRange(a,b){
  if (a===0) a=1; if (b===0) b=-1;                 /* there is no year 0 */
  MAP.lo=a; MAP.hi=b; MAP.stops = (a===START && b===NOW) ? MAP.full : buildStops(a,b);
  drawTicks();
  if (MAP.year<a || MAP.year>b) setYear(MAP.year<a?a:b,{scroll:true}); else placeThumb();
  if (typeof saveURL==="function") saveURL();
}
$("rangeAll").addEventListener("click",()=>setRange(START,NOW));

/* drag along the chart's time axis to zoom into those years; a plain click still does what it did */
scroller.addEventListener("pointerdown",e=>{
  const ax=e.target.closest && e.target.closest(state.horiz ? ".haxis" : ".body > .axis");
  if (!ax || e.button!==0) return;
  const plot=sheet.querySelector(".plot"); if (!plot) return;
  const pr=plot.getBoundingClientRect(), at=ev => state.horiz ? ev.clientX-pr.left : ev.clientY-pr.top;
  e.preventDefault(); const p0=at(e); let p1=p0, band=null, moved=false;
  const mv=ev=>{ p1=at(ev); if (Math.abs(p1-p0)<6) return; moved=true;
    if (!band){ band=el("div","selband"+(state.horiz?"":" v")); plot.append(band); }
    const lo=Math.min(p0,p1), hi=Math.max(p0,p1);
    if (state.horiz){ band.style.left=lo+"px"; band.style.width=(hi-lo)+"px"; } else { band.style.top=lo+"px"; band.style.height=(hi-lo)+"px"; } };
  const up=()=>{ removeEventListener("pointermove",mv); removeEventListener("pointerup",up); removeEventListener("pointercancel",up);
    if (band) band.remove();
    if (moved){ const a=yearAt(Math.min(p0,p1)), b=yearAt(Math.max(p0,p1)); if (b-a>=3) zoomToRange(a,b); } };
  addEventListener("pointermove",mv); addEventListener("pointerup",up); addEventListener("pointercancel",up);
});

/* ---------- the red year line on the chart ---------- */
/* the red line, and a flag with its year on the time axis */
function placeYearLine(){
  const plot=sheet.querySelector(".plot"); if (!plot) return;
  if (!MAP.line) MAP.line=el("div","yearline");
  if (MAP.line.parentNode!==plot) plot.append(MAP.line);
  const p=Y(MAP.year);
  MAP.line.style.cssText = state.horiz ? `left:${p-1}px;top:0;width:2px;height:100%` : `top:${p-1}px;left:0;height:2px;width:100%`;
  const ax = sheet.querySelector(state.horiz ? ".haxis" : ".axis");
  if (!MAP.flag) MAP.flag=el("div","yflag");
  if (ax){ if (MAP.flag.parentNode!==ax) ax.append(MAP.flag);
    MAP.flag.className = "yflag "+(state.horiz?"h":"v");
    MAP.flag.textContent = MAP.year>=NOW ? "Today" : fmt(MAP.year===0?1:MAP.year);
    MAP.flag.style.cssText = state.horiz ? `left:${p}px` : `top:${p}px`;
    /* a year label under the flag would show as stray letters beside it: hide it while the flag is there */
    for (const t of ax.children){ if (t===MAP.flag) continue; const v=parseFloat(state.horiz ? t.style.left : t.style.top); if (isNaN(v)) continue;
      const h = state.horiz ? (v>p-82 && v<p+26) : Math.abs(v-p)<15; if ((t.style.color==="transparent")!==h) t.style.color = h ? "transparent" : ""; } }
}
function revealYear(){
  holdSync(900);                                   /* the chart is about to scroll to the year: that scroll must not move the year (it did near the two ends of time) */
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
  MAP.down=[x,y];
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
  /* hover: a marker first, then which territory */
  const mk=markAt(x,y);
  if (mk){ tip.textContent=`${mk.o.name}, ${mk.o.approx?"about ":""}${fmt(mk.o.y)}`; tip.style.display="block";
    tip.style.left=Math.min(x+12, mapW-tip.offsetWidth-4)+"px"; tip.style.top=Math.max(4,y-28)+"px"; mapCanvas.style.cursor="pointer"; return; }
  mapCanvas.style.cursor="";
  const hit=terrAt(x,y);
  if (hit){ mapCanvas.style.cursor="pointer";
    tip.textContent = hit.sub ? `${mapLabel(hit)}, part of ${hit.sub}` : mapLabel(hit);
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
  if (drag && !drag.box && !drag.pinch && MAP.down && Math.hypot(x-MAP.down[0],y-MAP.down[1])<5){ const mk=markAt(x,y); if (mk && MAP.focus && mk.o===MAP.focus.obj) focusOpen(); else if (mk){ const g=geoOf(mk.o), fold = mk.o===state.sel && MAP.open && MAP.open.on; MAP.keepYear=true; select(mk.o); MAP.keepYear=false; MAP.open = g ? {g, on:!fold} : null; drawMap(); } else { const t=terrAt(x,y); if (t) clickTerr(t); else if (state.sel) select(null); } }   /* sea or empty land: clear the selection */
  ptrs.delete(e.pointerId); if (ptrs.size<2 && drag && drag.pinch) drag=null;
  if (!ptrs.size){ drag=null; mapWrap.classList.remove("panning"); }
}
mapCanvas.addEventListener("pointerup",endPtr); mapCanvas.addEventListener("pointercancel",endPtr);
mapCanvas.addEventListener("pointerleave",()=>{ if (!drag) tip.style.display="none"; });
/* the wheel zooms around the pointer. A mouse wheel sends few steps, and on a Mac very small ones (about 4 a notch), so each of its
   steps counts as a full notch; a trackpad sends a stream of small steps, taken as they come; a pinch arrives as Ctrl and wheel.
   The two are told apart the way Mapbox GL does it: by the step's size, and by how soon the next one follows */
{ let type=null, last=0, lastV=0, tm=null, pos=[0,0];
  const NOTCH=4.000244140625;                     /* Chrome on a Mac: every mouse wheel step is a multiple of this */
  const go=(v,how)=>{ const z = how==="pinch" ? -v*0.01 : how==="notch" ? -Math.sign(v)*Math.max(Math.abs(v),70)*0.002 : -v*0.0018;
    zoomAt(Math.exp(Math.max(-.6,Math.min(.6,z))),pos[0],pos[1]); };
  mapCanvas.addEventListener("wheel",e=>{ e.preventDefault();
    let v = e.deltaMode===1 ? e.deltaY*40 : e.deltaMode===2 ? e.deltaY*400 : e.deltaY; if (!v) return;
    pos=local(e);
    if (e.ctrlKey){ go(v,"pinch"); return; }
    const now=performance.now(), dt=now-last, sure = e.deltaMode===1 || v%NOTCH===0; last=now;
    if (sure) type="mouse";
    else if (Math.abs(v)<4) type="pad";
    else if (dt>400){                             /* a new move, kind unknown: if nothing follows within 40 ms it was one notch of a wheel */
      type=null; lastV=v; clearTimeout(tm); tm=setTimeout(()=>{ tm=null; type="mouse"; go(lastV,"notch"); },40); return; }
    else if (!type){ type = Math.abs(dt*v)<200 ? "pad" : "mouse"; if (tm){ clearTimeout(tm); tm=null; v+=lastV; } }
    /* a guessed mouse gets the full notch only when its steps come apart, so a trackpad taken for one does not race */
    go(v, type==="mouse" ? (sure || dt>45 ? "notch" : "mouse") : "pad");
  },{passive:false}); }
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
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ COLS.clear(); SEAH=null; drawMap(); });

/* ---------- hooks into the chart ---------- */
function afterRender(){
  placeYearLine(); drawSpan(); saveURL(); drawMap();
  const key=[...state.active].sort().join();
  if (key!==MAP.fitKey){ MAP.fitKey=key; if (mapW){ fitSelected(); drawMap(); } }
}
const chartRender = render;
render = function(k){ chartRender(k); afterRender(); };
/* Back: each item opened is a step in the browser's history, so Back returns to the one before instead of leaving
   the app. HX is the list of items, hpos where we are in it. A story's own steps are not recorded. */
const HX=[], HXID=Math.random().toString(36).slice(2); let hpos=-1, hxNav=false;   /* HXID: steps recorded before a reload carry another id and are followed by their link */
function hxStart(){ HX.length=0; HX.push(state.sel||null); hpos=0; try{ history.replaceState({hx:0,id:HXID},""); }catch(e){} }
function hxPush(obj){
  if (hpos<0 || hxNav || !obj || obj===state.sel || (typeof story!=="undefined" && story)) return;
  writeURL();                                    /* the step being left keeps the link of what it showed */
  HX.length=hpos+1; HX.push(obj); hpos++;
  try{ history.pushState({hx:hpos,id:HXID},""); }catch(e){}
}
addEventListener("popstate",e=>{
  if (hpos<0) return;
  const mine=e.state && e.state.id===HXID, k=mine ? e.state.hx : null, p=new URLSearchParams(location.search);
  if (typeof story!=="undefined" && story) endStory();
  let o = k!=null && k<HX.length ? HX[k] : undefined;
  if (o===undefined){ o=itemByKey(p.get("i"));      /* a step from before a reload: go by its link, and count from here */
    HX.length=0; HX.push(o); hpos=0; try{ history.replaceState({hx:0,id:HXID},""); }catch(x){} }
  else hpos=k;
  hxNav=true;
  try{ if (o) goTo(o); else { select(null); const y=+p.get("y"); if (p.get("y") && isFinite(y)) setYear(y,{scroll:true}); } } finally{ hxNav=false; }
});
function cardBack(){
  const prev = hpos>0 ? HX[hpos-1] : null; if (!prev || !state.sel || HX[hpos]!==state.sel) return;
  const b=el("button","cback"); b.type="button"; b.title="Back to the item you came from. The browser's Back button does the same.";
  b.innerHTML='<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M7.5 2.5L4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  b.append(el("span",null,"Back to "+(prev.n||prev.name||"the last item"))); b.addEventListener("click",()=>history.back());
  $("detail").prepend(b);
}
const chartSelect = select;
select = function(obj){
  MAP.open=null;
  if (MAP.focus && obj!==MAP.focus.obj && !MAP.focus.all.includes(obj) && !MAP.focus.near.includes(obj)){ MAP.focus=null; focusBar(); }   /* a card outside the focus ends it */
  hxPush(obj);
  chartSelect(obj);
  /* the open card's arrows go on the map and leave with it. A story draws its own, step by step */
  if (!(typeof story!=="undefined" && story)){ const R=routesOf(obj); MAP.routes = R ? {list:R, t0:performance.now()+900} : null; if (!obj) drawMap(); }
  if (obj){ cardBack(); const h=$("detail").querySelector("h2"); $("liveSay").textContent = h ? h.textContent+", card open" : ""; }
  if (!obj){ saveURL(); return; }
  if (MAP.keepYear || obj.terr){ saveURL(); drawMap(); return; }
  /* the year to show it in: an event's own year, or a little way into a span. A page that is not on the chart
     has its dates in y and e, or none at all: with none, the year stays where it is */
  const a = obj.s!=null ? obj.s : obj.y, b = obj.e!=null ? obj.e : a;
  const y = obj.n ? obj.a : obj.pt ? obj.y : a==null ? null : Math.round(Math.max(a,SNAPS[0]) + Math.min(150, Math.max(0, Math.min(b,NOW)-Math.max(a,SNAPS[0]))/3));
  if (y==null || !isFinite(y)){ saveURL(); drawMap(); return; }
  holdSync(); setYear(y);
  saveURL();
  /* borders for the new year may still be loading: follow once they are in */
  const s=snapFor(y); (MAP.data.get(s)||Promise.resolve()).then(()=>{ if (state.sel===obj) followSel(obj); });
};
function setMapMode(m){
  if (m==="off" && typeof story!=="undefined" && story) story.mapOff=true;   /* closed during a story: the next steps leave it closed */
  const wasFull = MAP.mode==="full";
  MAP.mode=m; MAP.on = m!=="off"; MAP.small = m==="float";
  try{ localStorage.setItem("wh8-mapmode",m); }catch(e){}
  drawMapBtn();
  if (typeof drawLenses==="function") drawLenses();
  requestAnimationFrame(()=>{ sizeMap(); if (MAP.on){ if (state.sel) followSel(state.sel); drawMap(); } if (wasFull && m!=="full"){ syncHold=Date.now()+800; render(MAP.year); revealYear(); placeYearLine(); } });
  saveURL();
}
function drawMapBtn(){
  const b=document.body; b.classList.toggle("mapfull",MAP.mode==="full"); b.classList.toggle("mapfloat",MAP.mode==="float");
  $("viewChart").setAttribute("aria-pressed", MAP.mode!=="full"); $("viewMap").setAttribute("aria-pressed", MAP.mode==="full");
  $("mapMin").textContent = MAP.mode==="full" ? "Minimize" : "Expand";
  $("mapMin").title = MAP.mode==="full" ? "Shrink the map to a small window over the chart" : "Make the map fill the chart area";
  $("mapBtn").hidden = MAP.mode==="full";
}
MAP.small = MAP.mode==="float";
$("viewChart").addEventListener("click",()=>{ if (MAP.mode==="full") setMapMode("float"); });
$("viewMap").addEventListener("click",()=>setMapMode("full"));
$("mapMin").addEventListener("click",()=>setMapMode(MAP.mode==="full" ? "float" : "full"));
$("mapBtn").addEventListener("click",()=>setMapMode("off"));
/* the floating map moves by its title bar */
$("mapHead").addEventListener("pointerdown",e=>{
  if (MAP.mode!=="float" || e.target.closest("button")) return;
  const pane=$("mapPane"), box=pane.parentElement.getBoundingClientRect(), r=pane.getBoundingClientRect(), dx=e.clientX-r.left, dy=e.clientY-r.top;
  $("mapHead").setPointerCapture(e.pointerId);
  const mv=ev=>{ const x=Math.max(0,Math.min(box.width-r.width, ev.clientX-box.left-dx)), y=Math.max(0,Math.min(box.height-r.height, ev.clientY-box.top-dy));
    pane.style.left=x+"px"; pane.style.top=y+"px"; pane.style.right="auto"; pane.style.bottom="auto"; };
  const up=()=>{ $("mapHead").removeEventListener("pointermove",mv); $("mapHead").removeEventListener("pointerup",up); };
  $("mapHead").addEventListener("pointermove",mv); $("mapHead").addEventListener("pointerup",up);
});

/* ---------- start ---------- */
MAP.full = buildStops(START,NOW); MAP.stops = MAP.full;
drawMapBtn(); if (typeof drawLenses==="function") drawLenses();   /* the lens bar was drawn before the map knew its mode */
MAP.fitKey=[...state.active].sort().join();
loadLand();
afterRender();
holdSync(); setYear(MAP.year,{scroll:true});
if (Q.get("i")){ const h=itemByKey(Q.get("i")), y0=MAP.year;
  if (h){ goTo(h); if (Q.get("y") && MAP.year!==y0){ holdSync(); setYear(y0,{scroll:true}); } } }   /* a link gives its year back, not the item's own */
drawSpan();
/* the picked years come back from the address bar */
{ const m=(Q.get("w")||"").match(/^(\d+),(\d+)$/); if (m){ MAP.win=[Math.min(6000,+m[1]),Math.min(6000,+m[2])]; placeWin(); drawMap(); } }
{ const m=(Q.get("t")||"").match(/^(-?\d+),(-?\d+)$/); if (m){ const a=Math.max(START,+m[1]), b=Math.min(NOW,+m[2]); if (b-a>=5 && MAP.year>=a && MAP.year<=b) setRange(a,b); } }
