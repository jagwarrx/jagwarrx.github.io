"use strict";
/* Super-stories: a film on the map, in a theatre view. Format and rules: super/README.md.
   Everything on the map is worked out from the time T alone (ssAt), so pause, scrub and play again are always right.
   Loads after map.js: it draws over the map at the end of each paint, and borrows its projection (sx, sy, tiltPt). */

const SSL = () => typeof SUPERSTORIES!=="undefined" ? SUPERSTORIES : [];
const SS = { s:null, on:false, T:0, total:0, lines:[], acts:[], cams:[], years:[], chs:[], last:0, raf:0, hits:[], free:false, ease:null,
  li:-1, said:-1, speaking:false, ate:false, back:null, read:false, lobby:false, hideT:0,
  voice: LS("history.ss.voice")!=="0", cc: LS("history.ss.cc"), clips:new Map(), cur:null, hasVoice:false, vfail:false, wait:0, ter:null, speed: +(LS("history.ss.speed")||1) || 1 };
const SSRED = "#c8410b";
const SSICON = {battle:"battle", sack:"fire", spared:"city", siege:"siege", caravan:"caravan"};
const SSFLY = 2.4;                                   /* seconds the camera takes to fly to a line's place */

/* ---------- the timeline: chapters to lines, each with a start and a length in seconds ---------- */
function ssWords(t){ return String(t||"").trim().split(/\s+/).filter(Boolean).length; }
/* a caption shows a sentence at a time, so it can be read at a glance and the eye goes back to the action (Hari, 21 Nov 2026).
   A short opener ("It is 1218.") stays with the sentence after it */
function ssCaps(say){
  const t=String(say||"").trim(), re=/[.!?]+["”’)]*\s+(?=[\p{Lu}"“‘(\d])/gu, S=[], out=[]; let i=0, m;
  while ((m=re.exec(t))){ S.push(t.slice(i,m.index+m[0].length).trim()); i=m.index+m[0].length; } if (t.slice(i).trim()) S.push(t.slice(i).trim());
  for (const x of S){ const q=out[out.length-1]; if (q!=null && ssWords(q)<5 && ssWords(q)+ssWords(x)<=20) out[out.length-1]=q+" "+x; else out.push(x); }
  const w=out.map(x=>ssWords(x)+2), tot=w.reduce((a,b)=>a+b,0)||1; let acc=0;
  return out.map((x,j)=>{ const o={t:x, f:acc/tot}; acc+=w[j]; return o; });
}
/* the film laid out in time: its lines, acts, camera moves, years and chapters, and how long it runs. It changes nothing, so the Library can ask for a film's length */
function ssTimeline(s){
  const lines=[], acts=[], cams=[], years=[], chs=[]; let T=0;
  const V=(typeof SUPERVOICE!=="undefined" && SUPERVOICE[s.id]) || null;
  s.chapters.forEach((ch,ci)=>{
    const c0=T; let before=null;
    /* a title card opens each chapter, and the camera and the year fly there under it */
    const first=(ch.lines[0]&&ch.lines[0].do)||[], lift=first.filter(a=>a.cam||a.year!=null);
    const tl={ch:ci, title:true, say:"", acts:lift, s:T, d:3.4}; lines.push(tl); T+=tl.d;
    ch.lines.forEach((L,li)=>{
      const acts0=(L.do||[]).filter(a=>!(li===0 && lift.includes(a)));
      const hook=acts0.some(a=>a.hook), army=acts0.some(a=>a.army||a.host||a.crowd||a.scene), quote=acts0.find(a=>a.quote), scene=(acts0.find(a=>a.scene)||{}).scene;
      const caps=ssCaps(L.say), fly=!!scene && scene!==before; before=scene||null;
      /* the narrator's clip for this line, if its words are still the ones it was made from */
      const v=V && V.lines[ch.id+":"+li], au = v && v.say===caps.map(c=>c.t).join(" ") && (v.quote||null)===(quote ? quote.quote.text : null) ? v : null;
      /* the lead: the beat before the action starts (longer when the camera has to fly down to a close-up). With no clip it is also
         the beat in which the caption is read. a0: when the narrator starts */
      const read=ssWords(L.say)*.4, lead = fly ? 1.7 : au ? .4 : .5, a0 = fly ? .7 : .35;
      let d;
      /* the breath after the last word: longer after a source's own words, when a close-up ends, and at the end of a chapter */
      const nx=ch.lines[li+1], nsc=nx ? ((nx.do||[]).find(a=>a.scene)||{}).scene : null, tail = !nx ? 1 : quote ? .85 : scene && nsc!==scene ? .7 : .45;
      if (au) d=Math.max(a0+au.d+tail, lead+(army ? 4 : 2.8));
      else { d=Math.max(3.2, read + (quote ? ssWords(quote.quote.text)*.36 : 0)); if (army) d=Math.max(d,4.6); if (lead>1) d+=1.2; }
      if (hook) d+=au ? .9 : 1.4; d+=+L.hold||0;
      /* wp: where the narrator is in the words, against the clock: [share of the line's action time, share of the words]. A step the
         story file sets at .6 then happens as the narrator gets six tenths through, not six tenths of the way through the seconds */
      let wp=null;
      if (au){ const dd=Math.max(.5,d-lead), w=caps.map(c=>ssWords(c.t)+2), wq=quote ? ssWords(quote.quote.text)*.9 : 0, tot=w.reduce((a,b)=>a+b,0)+wq; let acc=0; wp=[[0,0]];
        caps.forEach((c,j)=>{ if (j) wp.push([ssClamp((a0+(au.caps[j]||0)-lead)/dd), acc/tot]); acc+=w[j]; });
        if (quote && au.q!=null) wp.push([ssClamp((a0+au.q-lead)/dd), acc/tot]);
        wp.push([ssClamp((a0+au.d-lead)/dd), 1]); wp.push([1,1]);
        for (let j=1;j<wp.length;j++) if (wp[j][0]<wp[j-1][0]) wp[j][0]=wp[j-1][0]; }
      if (au) caps.forEach((c,j)=>{ c.f=(a0+(au.caps[j]||0))/d; });   /* each sentence shows as it is spoken */
      lines.push({ch:ci, i:li, say:L.say||"", caps, acts:acts0, s:T, d, hook, scene, lead, read, au, a0, wp}); T+=d;
    });
    chs.push({t:ch.t, y:ch.y, s:c0, d:T-c0});
  });
  /* the camera: a line's own place; a close-up's place while its lines run; and back out to the last place when a close-up ends */
  let mapCam=null, wasScene=null;
  for (const L of lines){
    const own=(L.acts.find(a=>a.cam)||{}).cam; if (own) mapCam=own;
    if (L.scene){ if (L.scene!==wasScene) cams.push({s:L.s, d:L.d, cam:{scene:L.scene}}); }
    else if (own) cams.push({s:L.s, d:L.d, cam:own});
    else if (wasScene && mapCam) cams.push({s:L.s, d:L.d, cam:mapCam});
    wasScene=L.scene||null;
    for (const a of L.acts){
      const A={...a, s:L.s, d:L.d, ch:L.ch, lead:L.lead||0}; acts.push(A);
      if (a.year!=null) years.push({s:L.s, d:L.d, y:a.year});
      if (a.army){ A.pts=ssSmooth(a.army.p); }
    }
  }
  return {lines, acts, cams, years, chs, total:T, V};
}
function ssBuild(s){
  const {lines, acts, cams, years, chs, total, V}=ssTimeline(s);
  for (const a of SS.clips.values()) a.pause();
  Object.assign(SS,{lines, acts, cams, years, chs, total, clips:new Map(), cur:null, vdir:V ? V.dir : "", hasVoice:lines.some(L=>L.au), vfail:false});
  ssPeopleOf(lines, s);
}
/* the people in a line: its card, who and quote actions, and every cast member the caption names */
function ssPeopleOf(lines, s){
  const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const N=Object.entries(s.cast||{}).map(([id,c])=>({id, re:new RegExp("(^|[^\\p{L}])("+[ssName(c), ...(c.aka||[])].map(esc).join("|")+")(?![\\p{L}])","u")}));
  let yr=null;   /* the dead are not called up by name: a cast member with d (the year of death) shows after it only if a line places them. A witness (a writer the film quotes) shows only when a line calls them */
  lines.forEach((L,k)=>{
    L.people=[]; const ya=(L.acts||[]).find(a=>a.year!=null); if (ya) yr=ya.year; if (L.title) return;
    const P=new Map(), add=(id,o)=>{ if (s.cast[id]) P.set(id,{...(P.get(id)||{id}),...o}); };
    for (const a of L.acts){
      if (a.card) add(a.card,{focus:true});
      if (a.who){ const w=typeof a.who==="string" ? {id:a.who} : a.who, o={};
        for (const k of ["at","go","die","s","in","out","hide"]) if (w[k]!==undefined) o[k]=w[k]; if (w.focus) o.focus=true; add(w.id,o); }
      if (a.quote) add(a.quote.who,{focus:true, speaks:true}); }
    for (const n of N) if (n.re.test(L.say) && !P.has(n.id) && !s.cast[n.id].witness && !(s.cast[n.id].d!=null && yr!=null && yr>s.cast[n.id].d)) add(n.id,{});
    if (!P.size){ const gone=new Set();   /* a line with no one in it keeps the last lead on screen, unless a line since has sent them off */
      for (let j=k-1; j>=k-2 && j>=0 && lines[j].ch===L.ch && !lines[j].title; j--){ for (const p of lines[j].people) if (p.hide) gone.add(p.id); const f=lines[j].people.find(p=>p.focus && !p.hide && !gone.has(p.id)); if (f){ add(f.id,{focus:true}); break; } } }
    const qa=L.acts.find(a=>a.quote), sp=qa && P.get(qa.quote.who);
    if (qa){ const dd=Math.max(.5,L.d-(L.lead||0)); L.qf = L.au && L.au.q!=null ? ssClamp((L.a0+L.au.q-.25-(L.lead||0))/dd,0,.92) : Math.min(.6, Math.max(...((sp&&sp.go)||[]).map(st=>st[2]==null ? .75 : st[2]), ((L.read||0)*.7-(L.lead||0))/dd, 0)); }
    const seen=new Set();   /* one figure a man: Temüjin and Genghis Khan share a portrait */
    L.people=[...P.values()].sort((a,b)=>(b.focus?1:0)-(a.focus?1:0)).filter(p=>{ const key=s.cast[p.id].pic||p.id; if (seen.has(key)) return false; seen.add(key); return true; });
  });
}
/* corners cut twice, so an army's road curves through its waypoints */
function ssSmooth(p){
  let r=p.map(q=>[q[0],q[1]]);
  for (let it=0; it<2 && r.length>2; it++){ const o=[r[0]];
    for (let i=0;i<r.length-1;i++){ const a=r[i], b=r[i+1]; o.push([.75*a[0]+.25*b[0], .75*a[1]+.25*b[1]], [.25*a[0]+.75*b[0], .25*a[1]+.75*b[1]]); }
    o.push(r[r.length-1]); r=o; }
  return r;
}
/* a hand-drawn outline, its corners cut three times so it reads as land, not a polygon */
function ssRound(p){ let r=p.map(q=>[q[0],q[1]]);
  for (let it=0; it<3; it++){ const o=[]; for (let i=0;i<r.length;i++){ const a=r[i], b=r[(i+1)%r.length]; o.push([.75*a[0]+.25*b[0], .75*a[1]+.25*b[1]], [.25*a[0]+.75*b[0], .25*a[1]+.75*b[1]]); } r=o; }
  return r; }
const ssLine = T => { let k=0; for (let i=0;i<SS.lines.length;i++) if (SS.lines[i].s<=T+1e-6) k=i; return k; };
const ssEz = f => f<.5 ? 2*f*f : 1-Math.pow(-2*f+2,2)/2;
const ssClamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));

/* ---------- the camera ---------- */
function ssCapH(){ const c=$("ssCap"); return c && !c.hidden ? c.offsetHeight : 0; }
function ssView(cam){
  if (cam.scene){ const sc=(SS.s.scenes||{})[cam.scene]; if (sc && sc.at) return ssSceneView(sc); cam={c:[45,100], span:40}; }
  const H=mapH-ssCapH();
  if (cam.box){ const [[a,b],[c,d]]=cam.box, x0=Math.min(b,d), x1=Math.max(b,d), y0=Math.min(a,c), y1=Math.max(a,c);
    const k=clampK(Math.min(mapW/Math.max(1e-3,x1-x0), H/Math.max(1e-3,y1-y0))*.9); return {x:(x0+x1)/2, y:(y0+y1)/2-ssCapH()/(2*k), k}; }
  const k=clampK(Math.max(mapW,H*.9)/Math.max(24,cam.span||40));   /* on a tall phone, span the height instead */   /* closer than about a country shows only flat colour: the base map has no terrain */ return {x:cam.c[1], y:cam.c[0]-ssCapH()/(2*k), k};
}
/* from view a to view b: far apart, out, across and in; near, one glide */
function ssCamPath(a,b,f){
  const lk=(k0,k1,e)=>Math.exp(Math.log(k0)+(Math.log(k1)-Math.log(k0))*e), dx=Math.abs(b.x-a.x), dy=Math.abs(b.y-a.y);
  const kMid=Math.min(a.k, b.k, clampK(Math.min(mapW/(dx*1.5+12), mapH/(dy*1.5+10))));
  if (kMid > .8*Math.min(a.k,b.k)){ const e=ssEz(f); return {x:a.x+(b.x-a.x)*e, y:a.y+(b.y-a.y)*e, k:lk(a.k,b.k,e)}; }
  if (f<.36){ const e=ssEz(f/.36); return {x:a.x, y:a.y, k:lk(a.k,kMid,e)}; }
  if (f<.6){ const e=ssEz((f-.36)/.24); return {x:a.x+(b.x-a.x)*e, y:a.y+(b.y-a.y)*e, k:kMid}; }
  const e=ssEz((f-.6)/.4); return {x:b.x, y:b.y, k:lk(kMid,b.k,e)};
}
function ssCamAt(T){
  let i=-1; for (let j=0;j<SS.cams.length;j++) if (SS.cams[j].s<=T+1e-6) i=j;
  if (i<0) return SS.cams.length ? ssView(SS.cams[0].cam) : null;
  const C=SS.cams[i], b=ssView(C.cam), fly=Math.min(SSFLY, C.d*.75), t=T-C.s, drift=(v,tt,fl)=>({...v, k:Math.max(v.k, clampK(v.k*(1+.06*ssClamp((tt-fl)/24))))});   /* a slow push in, so a long scene does not sit still */
  let a=b; if (i>0){ const Q=SS.cams[i-1]; a=drift(ssView(Q.cam), C.s-Q.s, Math.min(SSFLY, Q.d*.75)); }   /* it leaves from where the last one had drifted to */
  if (t<fly) return ssCamPath(a,b,t/fly);
  return drift(b,t,fly);
}
function ssYearAt(T){
  let i=-1; for (let j=0;j<SS.years.length;j++) if (SS.years[j].s<=T+1e-6) i=j;
  if (i<0) return null;
  const Y=SS.years[i], p = i>0 ? SS.years[i-1].y : Y.y, f=ssClamp((T-Y.s)/Math.max(1.2,Math.min(Y.d*.8,3.5)));
  return Math.round(p+(Y.y-p)*ssEz(f));
}

/* ---------- lands: a border snapshot's territory, or a drawn outline ---------- */
const SSLAND = new Map();
function ssLoadLands(s){
  for (const [id,L] of Object.entries(s.lands||{})){
    if (L.poly){ const pp=ssRound(L.poly), a=new Float32Array(pp.length*2); pp.forEach((q,i)=>{ a[2*i]=q[1]; a[2*i+1]=q[0]; }); SSLAND.set(id,{rings:[a], name:L.name, kb:L.kb}); continue; }
    if (L.snap!=null) loadSnap(L.snap).then(feats=>{ if (!feats) return; const f=feats.find(x=>x.name===L.feat);
      if (f) SSLAND.set(id,{rings:f.rings, name:L.name||f.name, kb:L.kb}); else console.warn("super-story: no territory named "+L.feat+" in "+L.snap); if (SS.s) drawMap(); });
  }
}

/* ---------- the ground, as Historia Civilis draws it (the story's `terrain`): dry country, forest, ranges as stacked contours,
   lakes, rivers as blue bands. Drawn flat on the map before it is tipped, and kept to the land, so it lies on the ground with the coast ---------- */
function ssInPoly(P,la,lo){ let c=false; for (let i=0,j=P.length-1;i<P.length;j=i++){ const a=P[i], b=P[j]; if ((a[0]>la)!==(b[0]>la) && lo<(b[1]-a[1])*(la-a[0])/(b[0]-a[0])+a[1]) c=!c; } return c; }
function ssTerrainBuild(s){
  const t=s.terrain; SS.ter=null; if (!t) return;
  const R=ssRng(ssHash(s.id+"ground")), T={dry:(t.dry||[]).map(d=>ssRound(d.p)), woods:[], trees:[], hills:[], lakes:(t.lakes||[]).map(l=>ssRound(l.p)),
    rivers:(t.rivers||[]).map(r=>({p:ssSmooth(r.p), t:r.t, w:r.w||1}))};
  for (const w of t.woods||[]){ const P=ssRound(w.p), n=w.n||200; T.woods.push(P);
    let b=[1e9,1e9,-1e9,-1e9]; for (const q of P) b=[Math.min(b[0],q[0]),Math.min(b[1],q[1]),Math.max(b[2],q[0]),Math.max(b[3],q[1])];
    for (let i=0, m=0; m<n && i<n*8; i++){ const la=b[0]+R()*(b[2]-b[0]), lo=b[1]+R()*(b[3]-b[1]); if (ssInPoly(P,la,lo)){ T.trees.push([la,lo,.8+R()*.5]); m++; } } }
  /* a range: lumps along its spine, so its outline is uneven; drawn three times, each smaller and darker */
  for (const h of t.hills||[]){ const P=ssSmooth(h.p), w=h.w||1;
    for (let i=1;i<P.length;i++){ const a=P[i-1], b=P[i], n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/(w*.42)));
      for (let j=0;j<n;j++){ const f=j/n; T.hills.push([a[0]+(b[0]-a[0])*f+(R()-.5)*w*.5, a[1]+(b[1]-a[1])*f+(R()-.5)*w*.5, w*(.7+R()*.6)]); } } }
  SS.ter=T;
}
function ssTerrain(g){
  const T=SS.ter; if (!T || !MAP.view || !MAP.land) return;
  const k=MAP.view.k, far=1-ssNear().sa, M=260, see=(x,y,r)=>x>-M-r && x<mapW+M+r && y>-M-r && y<mapH+M+r;
  const poly=P=>{ g.beginPath(); P.forEach((q,i)=>{ const x=sx(q[1]), y=sy(q[0]); i ? g.lineTo(x,y) : g.moveTo(x,y); }); };
  g.save(); g.lineJoin="round"; g.lineCap="round";
  const lp=new Path2D(); for (const a of MAP.land){ ringPath(lp,a); if (a.some(v=>v>180)) ringPath(lp,a,-360); } g.clip(lp,"evenodd");
  g.fillStyle="#d9d0a9"; for (const P of T.dry){ poly(P); g.closePath(); g.fill(); }
  g.fillStyle="#b9c08f"; for (const P of T.woods){ poly(P); g.closePath(); g.fill(); }
  /* ranges, trees and rivers are for the map seen from afar: a close-up draws its own hill, trees and river */
  g.globalAlpha=far;
  if (far>.02) for (const lv of [1,.64,.34]){ g.fillStyle="rgba(104,92,48,.15)"; g.beginPath();
    for (const c of T.hills){ const x=sx(c[1]), y=sy(c[0]), r=c[2]*k*lv; if (!see(x,y,r)) continue; g.moveTo(x+r,y); g.arc(x,y,r,0,6.2832); } g.fill(); }
  if (far>.02){ const r0=ssClamp(k*.075,1.2,7.5); g.fillStyle="#7c9a63"; g.beginPath();
    for (const c of T.trees){ const x=sx(c[1]), y=sy(c[0]), r=r0*c[2]; if (!see(x,y,r)) continue; g.moveTo(x+r,y); g.arc(x,y,r,0,6.2832); } g.fill();
    if (r0>3.4){ g.strokeStyle="#4f7046"; g.lineWidth=1.1; g.stroke(); } }
  g.globalAlpha=1; g.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--sea").trim()||"#a9cbdd"; g.strokeStyle="#5e8fb0"; g.lineWidth=1.2;
  for (const P of T.lakes){ poly(P); g.closePath(); g.fill(); g.stroke(); }
  if (far>.02){ g.globalAlpha=far; const w0=ssClamp(k*.05,1.2,6);
    for (const R of T.rivers){ poly(R.p); g.strokeStyle="#5e8fb0"; g.lineWidth=w0*R.w+1.6; g.stroke(); g.strokeStyle="#86b3d1"; g.lineWidth=w0*R.w; g.stroke(); }
    if (k>=17){ const size=k>=40 ? 19 : 16;   /* the name follows the river, just above the water */
      for (const R of T.rivers){ if (!R.t) continue; const lw=w0*R.w+1.6;
        ssNameOn(g,R.t,R.p.map(q=>[sx(q[1]),sy(q[0])]),{size, off:lw>size*.9 ? 0 : -(lw/2+size*.42), al:.74, min:11, fit:[30,30,mapW-30,mapH-60]}); } } }
  g.restore();
  g.save(); g.lineJoin="round"; g.strokeStyle="#3d4a52"; g.lineWidth=1.6; g.stroke(lp); g.restore();   /* the coast */
}
/* the close-up in force and the one the camera is leaving, and how far the map's own symbols have given way to them (sa) */
function ssNear(){
  const T=SS.T, k=ssLine(T), L=SS.lines[k], Pv=k>0 ? SS.lines[k-1] : null, t=L ? T-L.s : 0;
  const SC=L && L.scene ? ssSceneMap(L.scene) : null, lv=Pv && L && Pv.scene && Pv.scene!==L.scene ? 1-ssClamp(t/Math.min(SSFLY,L.d*.75)) : 0, SCo=lv>0 ? ssSceneMap(Pv.scene) : null;
  return {SC, SCo, lv, sa:Math.max(SC ? SC.a : 0, SCo ? SCo.a*lv : 0)};
}

/* ---------- painting over the map ---------- */
const P2 = (lat,lon) => tiltPt(sx(lon), sy(lat));
function ssImg(src){ return typeof img==="function" ? img(src) : null; }
function ssName(c){ return c.short || String(c.name||"").split(",")[0]; }
function ssCol(c){ return c.col || ssSide(c.side); }
function ssShade(hex,f){ const n=parseInt(String(hex).slice(1),16); if (isNaN(n)) return hex; const t=f<0?0:255, a=Math.abs(f), m=v=>Math.round(v+(t-v)*a);
  return "#"+((1<<24)|(m(n>>16)<<16)|(m(n>>8&255)<<8)|m(n&255)).toString(16).slice(1); }
const SSGREY="#b5ad9e";
function ssMix(a,b,k){ const m=parseInt(String(a).slice(1),16), n=parseInt(String(b).slice(1),16); if (isNaN(m)||isNaN(n)) return a; const f=(u,v)=>Math.round(u+(v-u)*k);
  return "#"+((1<<24)|(f(m>>16,n>>16)<<16)|(f(m>>8&255,n>>8&255)<<8)|f(m&255,n&255)).toString(16).slice(1); }
function ssRR(g,x,y,w,h,r){ g.beginPath(); if (g.roundRect) g.roundRect(x,y,w,h,r||0); else g.rect(x,y,w,h); }
/* what a person wears or carries, drawn on their square (x, y: its top left; S: its size) */
const SSGOLD="#e2b23a", SSGOLDE="#9c7414";
const SSWEAR = {
  furhat(g,x,y,S,c){ const fur="#dcc89c", fe="#9c875a";
    g.beginPath(); g.moveTo(x+.1*S,y+.02*S); g.quadraticCurveTo(x+.5*S,y-.66*S,x+.9*S,y+.02*S); g.closePath(); g.fillStyle=c.hat||ssShade(ssCol(c),-.38); g.fill();
    g.fillStyle=fur; g.strokeStyle=fe; g.lineWidth=1;
    ssRR(g,x-.07*S,y-.1*S,1.14*S,.22*S,.08*S); g.fill(); g.stroke();
    ssRR(g,x-.07*S,y+.04*S,.18*S,.36*S,.06*S); g.fill(); g.stroke(); ssRR(g,x+.89*S,y+.04*S,.18*S,.36*S,.06*S); g.fill(); g.stroke(); },
  helmet(g,x,y,S){ g.fillStyle="#a3a9b1"; g.beginPath(); g.arc(x+.5*S,y+.08*S,.47*S,Math.PI,0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x+.43*S,y-.36*S); g.lineTo(x+.57*S,y-.36*S); g.lineTo(x+.5*S,y-.72*S); g.closePath(); g.fill();
    g.fillStyle="#5d636b"; ssRR(g,x-.05*S,y-.02*S,1.1*S,.12*S,.04*S); g.fill();
    g.fillStyle="#7a5530"; ssRR(g,x-.07*S,y+.08*S,.16*S,.42*S,.05*S); g.fill(); ssRR(g,x+.91*S,y+.08*S,.16*S,.42*S,.05*S); g.fill(); },
  circlet(g,x,y,S){ g.fillStyle=SSGOLD; g.strokeStyle=SSGOLDE; g.lineWidth=1;
    g.beginPath(); g.moveTo(x+.16*S,y-.06*S); for (const k of [.28,.5,.72]){ g.lineTo(x+(k-.08)*S,y-.06*S); g.lineTo(x+k*S,y-.32*S); g.lineTo(x+(k+.08)*S,y-.06*S); } g.lineTo(x+.84*S,y-.06*S); g.lineTo(x+.84*S,y+.04*S); g.lineTo(x+.16*S,y+.04*S); g.closePath(); g.fill(); g.stroke(); },
  /* a ruler: the flat yellow crown Historia Civilis sets over a king, clear of the square */
  crown(g,x,y,S,c,ink){ const w=.66*S, h=.3*S, a=x+(S-w)/2, b=y-.12*S, t=b-h;
    g.beginPath(); g.moveTo(a,b); g.lineTo(a,t); g.lineTo(a+w*.25,t+h*.52); g.lineTo(a+w*.5,t-h*.1); g.lineTo(a+w*.75,t+h*.52); g.lineTo(a+w,t); g.lineTo(a+w,b); g.closePath();
    g.fillStyle="#f4d21f"; g.fill(); g.strokeStyle=ink||SSINK; g.lineWidth=Math.max(1.4,S*.055); g.lineJoin="miter"; g.stroke(); },
  turban(g,x,y,S){ g.fillStyle="#f3efe4"; g.strokeStyle="#bdb49e"; g.lineWidth=1;
    g.beginPath(); g.ellipse(x+.5*S,y-.26*S,.36*S,.22*S,0,0,7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(x+.5*S,y-.04*S,.6*S,.22*S,0,0,7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x+.02*S,y-.08*S); g.quadraticCurveTo(x+.5*S,y-.3*S,x+.98*S,y-.02*S); g.stroke();
    g.fillStyle="#c8262a"; g.beginPath(); g.arc(x+.5*S,y-.08*S,.08*S,0,7); g.fill(); },
  plume(g,x,y,S){ g.strokeStyle="#f7f3e8"; g.lineWidth=.12*S; g.lineCap="round"; g.beginPath(); g.moveTo(x+.5*S,y-.3*S); g.quadraticCurveTo(x+.46*S,y-.7*S,x+.7*S,y-.86*S); g.stroke();
    g.strokeStyle="#bdb49e"; g.lineWidth=1; g.stroke(); },
  boqta(g,x,y,S,c){ const col=c.hat||"#7a1f2a";
    g.fillStyle=ssShade(ssCol(c),-.3); ssRR(g,x-.05*S,y-.08*S,1.1*S,.26*S,.1*S); g.fill();
    g.fillStyle=col; g.strokeStyle=ssShade(col,-.4); g.lineWidth=1;
    g.beginPath(); g.moveTo(x+.37*S,y-.04*S); g.lineTo(x+.63*S,y-.04*S); g.lineTo(x+.74*S,y-1.02*S); g.lineTo(x+.26*S,y-1.02*S); g.closePath(); g.fill(); g.stroke();
    g.fillStyle=SSGOLD; ssRR(g,x+.2*S,y-1.12*S,.6*S,.13*S,.04*S); g.fill();
    g.strokeStyle="#2b2b2b"; g.lineWidth=2; g.beginPath(); g.moveTo(x+.5*S,y-1.12*S); g.quadraticCurveTo(x+.52*S,y-1.36*S,x+.68*S,y-1.46*S); g.stroke(); },
  futou(g,x,y,S){ g.fillStyle="#1d1d22"; ssRR(g,x+.14*S,y-.36*S,.72*S,.42*S,.1*S); g.fill();
    ssRR(g,x-.44*S,y-.25*S,.62*S,.07*S,.03*S); g.fill(); ssRR(g,x+.82*S,y-.25*S,.62*S,.07*S,.03*S); g.fill(); },
  bow(g,x,y,S){ g.strokeStyle="#6b4a2b"; g.lineWidth=Math.max(2,.08*S); g.beginPath(); g.arc(x+.78*S,y+.5*S,.58*S,-1.05,1.05); g.stroke();
    const a=Math.cos(1.05)*.58*S, b=Math.sin(1.05)*.58*S; g.strokeStyle="#e6dfcc"; g.lineWidth=1; g.beginPath(); g.moveTo(x+.78*S+a,y+.5*S-b); g.lineTo(x+.78*S+a,y+.5*S+b); g.stroke(); },
  cross(g,x,y,S){ g.fillStyle=SSGOLD; ssRR(g,x+.45*S,y+.38*S,.1*S,.44*S); g.fill(); ssRR(g,x+.32*S,y+.5*S,.36*S,.1*S); g.fill(); },
  book(g,x,y,S){ g.fillStyle="#2f5fae"; g.strokeStyle="#f3efe4"; g.lineWidth=1; ssRR(g,x+.5*S,y+.46*S,.36*S,.42*S,.04*S); g.fill(); g.stroke(); }
};
/* a person as Historia Civilis draws one: a flat square in their own colour with a thin ink edge. Everyone is a plain square
   (Hari, 21 Nov 2026: one portrait among squares looked odd; then, "more like Historia Civilis"). `wear` still draws a headdress
   if a story asks for one. dk: 0 to 1, the colour drains to grey as they die */
const SSINK="#1c1b1f", SSPAPER="#fffdf8";
function ssFig(g,c,x,y,S,dark,dk){
  const x0=x-S/2, y0=y-S/2, base=ssCol(c), col=dk>0 ? ssMix(base,SSGREY,.85*dk) : base, lw=S>30 ? 3 : S>16 ? 2 : 1.4, ink=dk>0 ? ssMix(SSINK,SSGREY,.6*dk) : SSINK;
  g.save(); g.lineCap="butt"; g.lineJoin="miter";
  g.fillStyle=col; g.fillRect(x0,y0,S,S);
  if (S>9){ g.strokeStyle=ink; g.lineWidth=lw; g.strokeRect(x0+lw/2,y0+lw/2,S-lw,S-lw); }
  const wear=c.wear || (c.crown!=null && SS.yr!=null && SS.yr>=c.crown ? ["crown"] : []);   /* crown: the year from which this person rules */
  for (const w of wear) if (SSWEAR[w]) { g.save(); SSWEAR[w](g,x0,y0,S,c,ink); g.restore(); }
  g.restore();
}
function ssAtOf(c, chId){ const a=c.at; if (!a) return null; if (Array.isArray(a)) return a; return a[chId]!==undefined ? a[chId] : null; }
function ssLastPlace(id,T){ let q=null; for (const A of SS.acts) if (A.army && A.army.who===id && A.s<=T) q=A.army.p[A.army.p.length-1]; return q; }
function ssSide(k){ const S=SS.s.sides||{}; return (S[k]&&S[k].col) || SSRED; }
const SSF="600 12.5px 'Barlow Semi Condensed', Barlow, sans-serif";
/* a name is on a plate: paper, an ink edge, ink words. kind "map": plain words set on the ground, in the colour given */
function ssPill(g, t, x, y, col, surf, font, kind){
  g.font=font||SSF; const w=g.measureText(t).width+12, h=18; g.textAlign="center"; g.textBaseline="middle";
  if (kind==="map"){ g.lineJoin="round"; g.strokeStyle="rgba(255,253,248,.85)"; g.lineWidth=3.5; g.strokeText(t,x,y+.5); g.fillStyle=col; g.fillText(t,x,y+.5); return [x-w/2,y-h/2,x+w/2,y+h/2]; }
  g.fillStyle=SSPAPER; g.fillRect(x-w/2,y-h/2,w,h); g.strokeStyle=SSINK; g.lineWidth=1.5; g.lineJoin="miter"; g.strokeRect(x-w/2,y-h/2,w,h);
  g.fillStyle=col===SSRED ? "#a3260c" : SSINK; g.fillText(t,x,y+.5);
  return [x-w/2-1,y-h/2-1,x+w/2+1,y+h/2+1];
}
/* names: every name on screen is queued here and placed at the end of the paint, the important ones first. One that would sit on
   another name or on a person's square moves just above or below; if there is no room, a minor one is left out */
function ssTag(g,t,x,y,col,surf,font,pri,kind){ if (g.globalAlpha>.03) SS.tags.push({t:kind==="name" ? String(t).toUpperCase() : t,x,y,col,surf,font:font||(kind==="name" ? "600 12px 'Barlow Semi Condensed', Barlow, sans-serif" : null),pri:pri||1,kind,al:g.globalAlpha}); }
function ssTags(g,blocks){
  const put=blocks.slice(), hit=(r)=>put.some(q=>r[0]<q[2] && r[2]>q[0] && r[1]<q[3] && r[3]>q[1]);
  const said=[];
  for (const L of SS.tags.sort((a,b)=>b.pri-a.pri)){
    if (said.some(q=>q.t===L.t && Math.hypot(q.x-L.x,q.y-L.y)<90)) continue; said.push(L);   /* a place with several marks is named once */
    g.font=L.font||SSF; const w=g.measureText(L.t).width+12, x=ssClamp(L.x,w/2+6,Math.max(w/2+6,mapW-w/2-6)); let y=null;
    for (const dy of [0,-22,22,-44,44]){ const r=[x-w/2-1,L.y+dy-10,x+w/2+1,L.y+dy+10]; if (!hit(r)){ y=L.y+dy; break; } }
    if (y==null){ if (L.pri<4) continue; y=L.y; }
    g.globalAlpha=L.al; put.push(ssPill(g,L.t,x,y,L.col,L.surf,L.font,L.kind)); }
  g.globalAlpha=1;
}
/* ---------- the action on screen, as in Historia Civilis: unit blocks, crowds, people who move, and close-ups on the map itself ---------- */
function ssRng(n){ let a=(n|0)+0x9e3779b9|0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function ssHash(s){ let h=2166136261; for (const ch of String(s)) h=Math.imul(h^ch.charCodeAt(0),16777619); return h|0; }
const ssProg = (f,a,b) => ssEz(ssClamp((f-a)/Math.max(1e-3,b-a)));
const ssWarp = (wp,f) => { if (!wp) return f; for (let j=1;j<wp.length;j++) if (f<=wp[j][0]){ const a=wp[j-1], b=wp[j]; return b[0]-a[0]<1e-4 ? b[1] : a[1]+(b[1]-a[1])*(f-a[0])/(b[0]-a[0]); } return 1; };
const ssDk = dark => c => dark ? ssShade(c,-.42) : c;
const ssSk = W => ssClamp(W/1100,.5,1);                              /* drawn sizes shrink on a narrow screen */
const ssPx = (r,W,dflt) => r==null ? dflt : r<2 ? r*W : r;          /* a size under 2 is a share of the screen width */
/* where a thing is at fraction f of its line: its own place, moved by each step of go: [[target, from, to], ...].
   A target is a place, "@person" (beside them) or {dx, dy} in pixels from the start */
function ssGo(p0, go, f, PT, face, S, q){
  let cur=p0;
  for (const st of go||[]){ const [tg,f0=.15,f1=.75]=st, k=ssProg(f,f0,q ? Math.min(f1,f0+q) : f1); if (k<=0) break;
    let to;
    if (typeof tg==="string" && tg[0]==="@"){ const o=face[tg.slice(1)]; if (!o) continue; const sd=cur[0]<=o[0] ? -1 : 1; to=[o[0]+sd*((S||40)/2+o[2]/2+12), o[1]]; }
    else if (Array.isArray(tg)) to=PT(tg);
    else to=[p0[0]+(tg.dx||0), p0[1]+(tg.dy||0)];
    cur=[cur[0]+(to[0]-cur[0])*k, cur[1]+(to[1]-cur[1])*k];
  }
  return cur;
}
/* a point d pixels along a drawn road, with its heading; before the start it runs back along the first leg */
function ssAlong(P,seg,d){
  if (d<=0){ const a=Math.atan2(P[1][1]-P[0][1],P[1][0]-P[0][0]); return [P[0][0]+Math.cos(a)*d, P[0][1]+Math.sin(a)*d, a]; }
  for (let i=1;i<P.length;i++) if (seg[i]>=d){ const r=(d-seg[i-1])/Math.max(1e-6,seg[i]-seg[i-1]);
    return [P[i-1][0]+(P[i][0]-P[i-1][0])*r, P[i-1][1]+(P[i][1]-P[i-1][1])*r, Math.atan2(P[i][1]-P[i-1][1],P[i][0]-P[i-1][0])]; }
  const m=P.length-1; return [P[m][0],P[m][1],Math.atan2(P[m][1]-P[m-1][1],P[m][0]-P[m-1][0])];
}
/* one unit: a box with a cross on it, the mark Historia Civilis puts on a body of soldiers (Hari, 21 Nov 2026: "show cross above
   squares"). dead: 0 to 1, it drains to grey and thins out */
/* a weapon carried beside a square: "bow", "spear" or "sword" */
function ssArm(g,kind,x,y,u,dead){ g.save(); g.translate(x,y); g.strokeStyle=g.fillStyle=dead>0 ? ssMix(SSINK,SSGREY,.7*dead) : SSINK; g.lineCap="butt"; g.lineWidth=1.7*u;
  if (kind==="bow"){ const c=8*u*Math.cos(1.15), s=8*u*Math.sin(1.15); g.beginPath(); g.arc(-3*u,0,8*u,-1.15,1.15); g.stroke(); g.lineWidth=1*u; g.beginPath(); g.moveTo(-3*u+c,-s); g.lineTo(-3*u+c,s); g.stroke(); }
  else if (kind==="spear"){ g.beginPath(); g.moveTo(0,10*u); g.lineTo(0,-9*u); g.stroke(); g.beginPath(); g.moveTo(0,-15*u); g.lineTo(-2.8*u,-8.5*u); g.lineTo(2.8*u,-8.5*u); g.closePath(); g.fill(); }
  else { g.rotate(.55); g.lineWidth=2*u; g.beginPath(); g.moveTo(0,9*u); g.lineTo(0,-11*u); g.stroke(); g.lineWidth=1.6*u; g.beginPath(); g.moveTo(-3.6*u,4.5*u); g.lineTo(3.6*u,4.5*u); g.stroke(); }
  g.restore(); }
function ssUnit(g,x,y,ang,col,us,dead,arm){
  const w=12*us, h=20*us, c=dead>0 ? ssMix(col,SSGREY,.9*dead) : col, lw=us>=.9 ? 1.6 : 1.2; g.save(); g.translate(x,y); g.rotate(ang); if (dead>0) g.globalAlpha*=1-.62*dead;
  g.lineCap="butt"; g.lineJoin="miter"; g.fillStyle=c; g.fillRect(-w/2,-h/2,w,h);
  g.strokeStyle=dead>0 ? ssMix(SSINK,SSGREY,.7*dead) : SSINK; g.lineWidth=lw; g.strokeRect(-w/2+lw/2,-h/2+lw/2,w-lw,h-lw);
  g.lineWidth=lw*.7; g.beginPath(); g.moveTo(-w/2+lw,-h/2+lw); g.lineTo(w/2-lw,h/2-lw); g.moveTo(-w/2+lw,h/2-lw); g.lineTo(w/2-lw,-h/2+lw); g.stroke();
  g.restore();
  if (arm){ const hx=Math.abs(Math.cos(ang))*w/2+Math.abs(Math.sin(ang))*h/2; g.save(); if (dead>0) g.globalAlpha*=1-.62*dead; ssArm(g,arm,x+hx+1.5*us,y-2*us,us*.72,dead); g.restore(); }
}
/* a broken unit gives ground and greys; it keeps its facing */
function ssBroke(u,k,seed,us){ if (k<=0) return u; const r=ssRng(seed); const a=r()*6.283, d=(6+r()*16)*k*us;
  return {x:u.x+Math.cos(a)*d, y:u.y+Math.sin(a)*d, ang:u.ang}; }
function ssBreakK(t,at,seed){ const r=ssRng(seed^0x5bd1); return ssEz(ssClamp((t-at-r()*.7)/1.3)); }
/* an army standing in formation: line (rows), block, or ring (a siege round a place) */
function ssHostUnits(h,c,us,W){
  const n=h.units||6, F=h.form||"line", out=[];
  if (F==="ring"){ const R=ssPx(h.r,W,52*us); for (let i=0;i<n;i++){ const a=i/n*6.283; out.push({x:c[0]+Math.cos(a)*R, y:c[1]+Math.sin(a)*R*.8, ang:a}); } return out; }
  const rows=h.rows||(F==="block" ? Math.ceil(Math.sqrt(n/2)) : 2), cols=Math.ceil(n/rows), a=(h.ang||0)*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a);
  for (let i=0;i<n;i++){ const r=Math.floor(i/cols), q=i%cols, lx=(q-(cols-1)/2)*25*us, ly=(r-(rows-1)/2)*17*us;
    out.push({x:c[0]+lx*ca-ly*sa, y:c[1]+lx*sa+ly*ca, ang:a+Math.PI/2}); }
  return out;
}
function ssHost(g,h,X){
  const {PT,f,t,d,face,us,surf,W}=X, al=(h.in!=null ? ssClamp((t-h.in*d)/.6) : 1)*(X.al==null ? 1 : X.al); if (al<=0) return;
  const ctr=ssGo(PT(h.at), h.go, f, PT, face, 40, X.q), col=h.col||ssSide(h.side), U=ssHostUnits(h,ctr,us,W), seed=ssHash(String(h.at)+(h.units||0)), arm=h.arm!==undefined ? h.arm : X.SC ? (h.foot ? "spear" : "bow") : null;   /* in a close-up the soldiers carry arms: riders a bow, foot a spear */
  g.save(); g.globalAlpha=al;
  U.forEach((u,i)=>{ const k=h.break!=null ? ssBreakK(t,h.break*d,seed+i) : 0, v=ssBroke(u,k,seed+i*13,us); ssUnit(g,v.x,v.y,v.ang,col,us,k,arm); });
  const la=h.break!=null ? 1-ssClamp((t-h.break*d-.9)/.6) : 1;
  if (h.t && la>0){ const top=Math.min(...U.map(u=>u.y)); g.globalAlpha=al*la*X.lab; ssTag(g,h.t,ctr[0],top-16*us,col,surf,null,3); }
  g.restore();
}
/* a crowd: one small square for a number of people. spread: scattered; form: they line up in tens */
function ssCrowdPts(c,ctr,f,us,W){
  const n=c.n||8, s=(c.s||9)*us*(c.kind && SSPROP[c.kind] ? 2.9 : 1), gp=s*.5, cols=c.cols||Math.ceil(Math.sqrt(n*1.6)), rows=Math.ceil(n/cols), r=ssRng(ssHash(n+String(c.at))), pts=[];
  for (let i=0;i<n;i++){
    let gx, gy;
    if (c.form!=null){ const nb=Math.ceil(n/10), bc=Math.min(nb,Math.ceil(Math.sqrt(nb*2.2))), br=Math.ceil(nb/bc), b=Math.floor(i/10), j=i%10, bw=5*(s+gp)+s*1.4, bh=2*(s+gp)+s*1.4;
      gx=((b%bc)-(bc-1)/2)*bw+((j%5)-2)*(s+gp); gy=(Math.floor(b/bc)-(br-1)/2)*bh+(Math.floor(j/5)-.5)*(s+gp); }
    else { gx=((i%cols)-(cols-1)/2)*(s+gp); gy=(Math.floor(i/cols)-(rows-1)/2)*(s+gp); }
    if (c.spread){ const R=ssPx(c.spread,W,80), a=r()*6.283, dd=Math.sqrt(r())*R, x0=Math.cos(a)*dd, y0=Math.sin(a)*dd*.55, k=c.form!=null ? ssProg(f,c.form,c.form+.4) : 0;
      gx=x0+(gx-x0)*k; gy=y0+(gy-y0)*k; }
    pts.push([ctr[0]+gx, ctr[1]+gy]);
  }
  return {pts,s};
}
/* die: the squares drain to grey and thin out, one after another; the last `keep` live, and may run along `flee` */
function ssCrowd(g,c,X){
  const {PT,f,t,d,face,us,surf,W,D}=X, inK=c.in!=null ? ssClamp((t-c.in*d)/.6) : 1, outK=c.out!=null ? 1-ssClamp((t-c.out*d)/.7) : 1, al=inK*outK*(X.al==null ? 1 : X.al); if (al<=0) return;
  const ctr=ssGo(PT(c.at), c.go, f, PT, face, 40, X.q), {pts,s}=ssCrowdPts(c,ctr,f,us,W), n=pts.length, keep=c.keep||0, col=c.col||ssSide(c.side), seed=ssHash(n+String(c.at));
  g.save();
  pts.forEach((p,i)=>{ let [x,y]=p, dk=0;
    if (c.die!=null){ if (i>=n-keep){ if (c.flee){ const q=ssGo([x,y],c.flee,f,PT,face,s,X.q); x=q[0]; y=q[1]; } }
      else { const r=ssRng(seed+i); dk=ssEz(ssClamp((t-c.die*d-r()*1.1)/.9)); } }
    g.globalAlpha=al;
    if (c.kind && SSPROP[c.kind]){ g.globalAlpha=al*(1-.88*dk); ssPix(g,SSPROP[c.kind],x,y+s*.42,s*1.5,c.flip,i*3); return; }   /* a crowd of models (tents, ships): the lost ones fade */
    const cc=dk>0 ? ssMix(col,SSGREY,.9*dk) : col, lw=s>11 ? 1.5 : 1; g.globalAlpha=al*(1-.62*dk);
    g.fillStyle=cc; g.fillRect(x-s/2,y-s/2,s,s); if (s>5){ g.strokeStyle=dk>0 ? ssMix(SSINK,SSGREY,.7*dk) : SSINK; g.lineWidth=lw; g.strokeRect(x-s/2+lw/2,y-s/2+lw/2,s-lw,s-lw); }
    if (c.arm && s>=7) ssArm(g,c.arm,x+s/2+s*.12,y-s*.18,s/15,dk); });
  if (c.t){ const top=Math.min(...pts.map(p=>p[1])); g.globalAlpha=al*X.lab; ssTag(g,c.t,ctr[0],top-s/2-14,col,surf,null,3); }
  g.restore();
}
function ssFlood(g,F,X){
  const {PT,f,W,T,dark}=X, by=F.by||[.2,.65], k=ssProg(f,by[0],by[1]), al=X.al==null ? 1 : X.al; if (k<=0 || al<=0) return;
  const [x,y]=PT(F.at), R=ssPx(F.r,W,70)*k;
  g.save(); g.globalAlpha=.6*al; g.fillStyle=dark ? "#3d6a8f" : "#93bcdc"; g.beginPath();
  for (let i=0;i<=48;i++){ const a=i/48*6.283, rr=R*(1+.05*Math.sin(a*7+T*2.2)); const px=x+Math.cos(a)*rr, py=y+Math.sin(a)*rr*.72; i ? g.lineTo(px,py) : g.moveTo(px,py); }
  g.closePath(); g.fill(); g.globalAlpha=.95*al; g.strokeStyle=dark ? "#6d9cc4" : "#5d8fb3"; g.lineWidth=2; g.stroke(); g.restore();
}

/* a close-up is the map itself, zoomed in (Hari, 21 Nov 2026: zoom in and out of the map, no cut to a drawn scene). The camera flies
   down to the scene's place; its props (tents, a river, walls) are pinned to the ground there and show only up close. A point in a
   scene is a share of the screen, [x, y], as the screen stands once the camera has settled */
function ssSceneView(sc){ const H=mapH-ssCapH(), k=sc.span ? Math.max(mapW/400, Math.min(1600, Math.max(mapW,H*.9)/sc.span)) : clampK(Math.max(mapW,H*.9)/5);   /* a scene with its own span may go closer than the map's own limit: a battlefield by the coast, without the sea */ return {x:sc.at[1], y:sc.at[0]-ssCapH()/(2*k), k}; }
function ssSceneMap(id){
  const sc=(SS.s.scenes||{})[id]; if (!sc || !sc.at) return null;
  const v=ssSceneView(sc), W=mapW, H=mapH-ssCapH(), zz=Math.log2(v.k/Math.max(1e-6,W/360)), q=ssClamp((zz-.9)/1.7), w=q*q*(3-2*q),
    tl=typeof TILT!=="undefined" && TILT.on && !MAP.small ? .30*w+.10 : 0, z=MAP.view.k/v.k;   /* the ground's tip once settled, undone so a share lands where it says */
  const ll = a => { const X=a[0]*W, Y=a[1]*H, s=1+tl*Y/mapH, fy=Y*(1+tl)/(1+tl*Y/mapH), fx=W/2+(X-W/2)/s; return [v.y-(fy-mapH/2)/v.k, v.x+(fx-W/2)/v.k]; };
  return {sc, id, z, a:ssClamp((z-.4)/.35), ll, p: a => { const q2=ll(a); return P2(q2[0],q2[1]); }};
}
/* a name written on the thing itself, as a map does it: a river's along its line, a bay's across its water. Pixel letters (the titles' font)
   in a darker shade of the thing's own colour, a little see-through. P: the line on screen. The font has no accents: one is drawn above its letter */
const SSNAMEC={water:"#27587f", hill:"#6a6537", wood:"#3b5834"};
function ssNameOn(g,t,P,o){ o=o||{}; if (!t || P.length<2) return;
  let Q=P, size=o.size||26; const sp=o.sp!=null ? o.sp : .1, A=Q[0], B=Q[Q.length-1], dx=B[0]-A[0], dy=B[1]-A[1];
  if (Math.abs(dx)>=Math.abs(dy)*.6 ? dx<0 : dy<0) Q=Q.slice().reverse();   /* read left to right, or down */
  const seg=[0]; for (let i=1;i<Q.length;i++) seg.push(seg[i-1]+Math.hypot(Q[i][0]-Q[i-1][0],Q[i][1]-Q[i-1][1]));
  const Ln=seg[seg.length-1], chars=[];
  for (const c of String(t).normalize("NFD")){ if (/[̀-ͯ]/.test(c)){ if (chars.length) chars[chars.length-1].m=c; } else chars.push({c: c==="'" || c==="’" ? "" : c}); }
  const meas=()=>{ g.font="400 "+size+"px Pixelta, 'Barlow Semi Condensed', sans-serif"; let w=0; for (const ch of chars){ ch.w=ch.c ? g.measureText(ch.c).width : size*.12; w+=ch.w+size*sp; } return w-size*sp; };
  let Wd=meas(); if (Wd>Ln*.9){ size=size*Ln*.9/Wd; if (size<(o.min||12)) return; Wd=meas(); }
  const pt=d=>{ d=ssClamp(d,0,Ln); let i=1; while (i<seg.length-1 && seg[i]<d) i++; const r=(d-seg[i-1])/Math.max(1e-6,seg[i]-seg[i-1]); return [Q[i-1][0]+(Q[i][0]-Q[i-1][0])*r, Q[i-1][1]+(Q[i][1]-Q[i-1][1])*r]; };
  let s=ssClamp((o.at!=null ? o.at : .5)*Ln-Wd/2, 0, Math.max(0,Ln-Wd));
  if (o.fit){ /* keep the word on the screen */ const [x0,y0,x1,y1]=o.fit, ok=d=>{ const p=pt(d); return p[0]>=x0 && p[0]<=x1 && p[1]>=y0 && p[1]<=y1; };
    for (let n=0; n<80 && !(ok(s) && ok(s+Wd)); n++) s=ssClamp(s+(ok(s) ? -1 : 1)*Ln/80, 0, Math.max(0,Ln-Wd)); if (!ok(s) || !ok(s+Wd)) return; }
  g.save(); g.globalAlpha*=o.al!=null ? o.al : .7; g.fillStyle=o.col||SSNAMEC.water; g.textAlign="center"; g.textBaseline="alphabetic";
  for (const ch of chars){ const m=s+ch.w/2, p=pt(m), p0=pt(m-size*.7), p1=pt(m+size*.7), u=size*.09, up=/[A-Z]/.test(ch.c) ? .75 : .57;
    g.save(); g.translate(p[0],p[1]); g.rotate(Math.atan2(p1[1]-p0[1],p1[0]-p0[0])); g.translate(0,(o.off||0)+size*.25);
    if (ch.c) g.fillText(ch.c,0,0);
    if (ch.m==="́"){ g.fillRect(-u*.4,-size*up-u,u,u); g.fillRect(u*.5,-size*up-u*1.9,u,u); }
    else if (ch.m==="̈"){ g.fillRect(-u*1.5,-size*up-u,u,u); g.fillRect(u*.5,-size*up-u,u,u); }
    else if (ch.m) g.fillRect(-u*1.4,-size*up-u,u*2.8,u*.8);
    g.restore(); s+=ch.w+size*sp; }
  g.restore(); }
/* an arrow in flight from a to b: it rises and falls in an arc. p: 0 as it leaves the bow, 1 as it strikes; after that it stays where it struck */
function ssArrow(g,a,b,p,u,kind){ if (p<=0) return; p=Math.min(1,p);
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]), c=[(a[0]+b[0])/2, (a[1]+b[1])/2-(kind==="spear" ? Math.max(14*u,d*.2) : Math.max(26*u,d*.42))], q=1-p;
  const x=q*q*a[0]+2*q*p*c[0]+p*p*b[0], y=q*q*a[1]+2*q*p*c[1]+p*p*b[1];
  const ang=Math.atan2(2*q*(c[1]-a[1])+2*p*(b[1]-c[1]), 2*q*(c[0]-a[0])+2*p*(b[0]-c[0])), len=30*u;
  if (kind==="spear"){ const L=50*u; g.save(); g.translate(x,y); g.rotate(ang); g.strokeStyle=g.fillStyle=SSINK; g.lineCap="butt"; g.lineWidth=3*u; g.beginPath(); g.moveTo(-L,0); g.lineTo(-8*u,0); g.stroke();
    g.beginPath(); g.moveTo(2*u,0); g.lineTo(-10*u,-4.6*u); g.lineTo(-10*u,4.6*u); g.closePath(); g.fill(); g.restore(); return; }
  if (kind==="stone"){ if (p<1){ g.save(); g.fillStyle="#6f6a60"; g.strokeStyle=SSINK; g.lineWidth=2*u; g.beginPath(); g.arc(x,y,6.5*u,0,7); g.fill(); g.stroke(); g.restore(); } return; }
  g.save(); g.translate(x,y); g.rotate(ang); g.strokeStyle=SSINK; g.fillStyle=SSINK; g.lineCap="butt"; g.lineJoin="miter";
  g.lineWidth=2.4*u; g.beginPath(); g.moveTo(-len,0); g.lineTo(-5*u,0); g.stroke();
  g.beginPath(); g.moveTo(0,0); g.lineTo(-9*u,-4.2*u); g.lineTo(-9*u,4.2*u); g.closePath(); g.fill();
  g.lineWidth=1.8*u; g.beginPath(); for (const k of [0,4.5]){ g.moveTo(-len+k*u,0); g.lineTo(-len-5*u+k*u,-4.5*u); g.moveTo(-len+k*u,0); g.lineTo(-len-5*u+k*u,4.5*u); } g.stroke();
  g.restore(); }
function ssLabel(g,t,x,y){ g.font="600 15px 'Barlow Semi Condensed', Barlow, sans-serif"; const w=g.measureText(t).width+14, h=22; x=ssClamp(x,w/2+10,Math.max(w/2+10,mapW-w/2-10));
  g.fillStyle=SSPAPER; g.strokeStyle=SSINK; g.lineWidth=1.5; g.lineJoin="miter"; g.fillRect(x-w/2,y-h/2,w,h); g.strokeRect(x-w/2,y-h/2,w,h);
  g.fillStyle=SSINK; g.textAlign="center"; g.textBaseline="middle"; g.fillText(t,x,y+.5); }
/* props. V: p(share) gives the screen point; w and h are the scene's width and height on screen now; k scales a size given in pixels */
/* a pixel model standing on the ground at (x, y): the app's own pixel art, drawn with hard pixels */
/* pictures that move: [strip of 96 px frames, frames, frames a second]. The frame comes from the film's own clock, so a paused film holds still */
const SSANIM = {"kinds/fire.png":["super/props/fire-anim.png",8,9], "super/props/tug.png":["super/props/tug-anim.png",8,7], "kinds/flood.png":["super/props/wave-anim.png",8,7],
  "super/props/silvertree.png":["super/props/silvertree-anim.png",8,7], "super/props/trebuchet.png":["super/props/trebuchet-anim.png",8,6], "super/props/horse.png":["super/props/horse-anim.png",8,12]};
function ssFrame(g,src,dx,dy,dw,dh,flip,ph){ const A=SSANIM[src], st=A ? ssImg(A[0]) : null, im=st||ssImg(src); if (!im) return;
  const k=st ? (Math.floor((SS.T||0)*A[2]+(ph||0))%A[1]+A[1])%A[1] : 0, sw=st ? 96 : im.width, sh=st ? 96 : im.height;
  if (flip){ g.save(); g.translate(dx+dw,dy); g.scale(-1,1); g.drawImage(im,k*sw,0,sw,sh,0,0,dw,dh); g.restore(); } else g.drawImage(im,k*sw,0,sw,sh,dx,dy,dw,dh); }
/* a model's shadow: its own outline, laid flat on the ground away from a light at the upper left. Nothing afloat or burning casts one */
const SSSHADE = new Map(), SSNOSHADE = {"super/props/junk.png":1, "kinds/flood.png":1, "kinds/fire.png":1};
function ssSilh(im,fw){ let c=SSSHADE.get(im); if (c) return c; c=document.createElement("canvas"); c.width=im.width; c.height=im.height; const x=c.getContext("2d"); x.drawImage(im,0,0);
  let bot=im.height; try { const d=x.getImageData(0,0,Math.min(fw,im.width),im.height).data, w=Math.min(fw,im.width); out: for (let r=im.height-1; r>=0; r--) for (let k=0; k<w; k++) if (d[(r*w+k)*4+3]>60){ bot=r+1; break out; } } catch(e){}
  x.globalCompositeOperation="source-in"; x.fillStyle="#17120a"; x.fillRect(0,0,c.width,c.height); c.bot=bot/im.height; SSSHADE.set(im,c); return c; }
function ssCast(g,src,dx,dy,dw,dh,flip,ph){ if (SSNOSHADE[src]) return; const A=SSANIM[src], st=A ? ssImg(A[0]) : null, im=st||ssImg(src); if (!im || !im.width) return;
  const sw=st ? 96 : im.width, sh=st ? 96 : im.height, c=ssSilh(im,sw), k=st ? (Math.floor((SS.T||0)*A[2]+(ph||0))%A[1]+A[1])%A[1] : 0, y0=dy+dh*c.bot, al=g.globalAlpha;
  g.save(); g.globalAlpha=al*.26; g.translate(dx,y0); g.transform(flip ? -1 : 1, 0, -.62, .36, flip ? dw : 0, 0); g.drawImage(c, k*sw,0,sw,sh, 0,-dh*c.bot,dw,dh); g.restore(); }
function ssPix(g,src,x,y,size,flip,ph){ const sm=g.imageSmoothingEnabled; g.imageSmoothingEnabled=false;
  ssCast(g,src, Math.round(x-size/2), Math.round(y-size*.78), Math.round(size), Math.round(size), flip, ph);
  ssFrame(g,src, Math.round(x-size/2), Math.round(y-size*.78), Math.round(size), Math.round(size), flip, ph); g.imageSmoothingEnabled=sm; }
const SSPROP = {ger:"super/props/ger.png", tug:"super/props/tug.png", zhongdu:"super/props/zhongdu.png", trebuchet:"super/props/trebuchet.png", junk:"super/props/junk.png", silvertree:"super/props/silvertree.png", horse:"super/props/horse.png",
  mosque:"kinds/mosque.png", city:"kinds/city.png", fire:"kinds/fire.png", caravan:"kinds/caravan.png", book:"kinds/priest.png", crown:"kinds/crown.png",
  church:"kinds/church.png", fort:"kinds/fort.png", bridge:"kinds/bridge.png", wagon:"kinds/trek.png", market:"kinds/market.png", wave:"kinds/flood.png"};
/* one pine, as Historia Civilis draws a wood: two flat tiers and a stub of trunk */
function ssPine(g,x,y,s){ g.fillStyle="#6b4a2b"; g.fillRect(x-s*.09,y-s*.05,s*.18,s*.3);
  g.fillStyle="#4f7a45"; g.strokeStyle="#2c4427"; g.lineWidth=Math.max(.8,s*.07); g.lineJoin="round";
  for (const [b,t,w] of [[0,-.62,.5],[-.36,-1.05,.36]]){ g.beginPath(); g.moveTo(x-s*w,y+s*b); g.lineTo(x,y+s*t); g.lineTo(x+s*w,y+s*b); g.closePath(); g.fill(); g.stroke(); } }
/* props. V: p(share) gives the screen point; w and h are the scene's width and height on screen now; k scales a size given in pixels.
   The rule (Hari, 21 Nov 2026, "something ai generated about the scenes", "simplify the visual language"): the ground is flat and
   plain, a thing in the world is one of the app's pixel models, a person is a square, soldiers are crossed boxes. Few things, each
   put where the story file says; nothing is sprinkled by chance */
const SSITEM = {
  hill(g,it,V,D,r){ const [x,y]=V.p(it.at), rx=(it.r||[.2,.15])[0]*V.w, ry=(it.r||[.2,.15])[1]*V.h, n=9, J=[]; for (let i=0;i<n;i++) J.push(.88+r()*.24);
    /* stacked contours, each smaller and darker */
    [[1,"#b7bc8c"],[.58,"#a8ae7c"]].forEach(([k,col],l)=>{ const P=[]; for (let i=0;i<n;i++){ const a=i/n*6.283; P.push([x+Math.cos(a)*rx*k*J[i]+l*rx*.05, y+Math.sin(a)*ry*k*J[i]-l*ry*.08]); }
      g.beginPath(); const z=P[n-1]; g.moveTo((z[0]+P[0][0])/2,(z[1]+P[0][1])/2);
      for (let i=0;i<n;i++){ const p=P[i], q=P[(i+1)%n]; g.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2); }
      g.closePath(); g.fillStyle=col; g.fill(); }); },
  /* a wood: pines on a loose grid, so it reads as planted by hand. pts: each tree's own place */
  trees(g,it,V,D,r){ const s=(it.s||1)*18*V.k, P=[];
    if (it.pts) for (const q of it.pts) P.push(V.p(q));
    else { const [x,y]=V.p(it.at), R=(it.r||.07)*V.w, st=s*1.5; for (let j=-6;j<=6;j++) for (let i=-8;i<=8;i++){ const px=(i+(j&1)*.5)*st+(r()-.5)*st*.5, py=j*st*.72+(r()-.5)*st*.4; if ((px*px)/(R*R)+(py*py)/(R*R*.36)<1) P.push([x+px,y+py]); } }
    P.sort((a,b)=>a[1]-b[1]); for (const q of P) ssPine(g,q[0],q[1],s); },
  river(g,it,V,D){ const P=ssSmooth(it.p.map(q=>V.p(q))), w=(it.w||.03)*V.w;
    g.beginPath(); P.forEach((q,i)=>i ? g.lineTo(q[0],q[1]) : g.moveTo(q[0],q[1]));
    g.lineCap="round"; g.lineJoin="round"; g.strokeStyle="#4f7fa3"; g.lineWidth=w+V.lw(4); g.stroke(); g.strokeStyle="#9cc4de"; g.lineWidth=w; g.stroke();
    /* t: the river's name, written on the water (ta: how far along, 0 to 1) */
    if (it.t && V.z>.6) ssNameOn(g,it.t,P,{size:ssClamp(w*.66,17,34), at:it.ta, al:.7*ssClamp((V.z-.6)/.3), fit:[14,14,mapW-14,V.h/V.z-10]}); },
  water(g,it,V,D){ g.beginPath(); it.p.forEach((q,i)=>{ const [x,y]=V.p(q); i ? g.lineTo(x,y) : g.moveTo(x,y); }); g.closePath();
    g.fillStyle="#9cc4de"; g.fill(); g.strokeStyle="#4f7fa3"; g.lineWidth=V.lw(2.5); g.stroke(); },
  /* a pixel model: {k:"pix", pic:"ger", at:[x,y], s:1.5}, or several of one model with pts:[[x,y],...]. A size of 1 is 96 px on a desktop */
  pix(g,it,V){ const src=SSPROP[it.pic]||it.pic, size=96*(it.s||1)*V.k, P=(it.pts||[it.at]).map(q=>V.p(q)).sort((a,b)=>a[1]-b[1]); P.forEach((q,i)=>ssPix(g,src,q[0],q[1],size,it.flip,i*3)); },
  cliff(g,it,V,D){ const P=it.p.map(q=>V.p(q)), sd=it.side||1, u=V.k;
    g.strokeStyle="#5d4e36"; g.lineWidth=V.lw(5); g.beginPath(); P.forEach((q,i)=>i ? g.lineTo(q[0],q[1]) : g.moveTo(q[0],q[1])); g.stroke();
    g.lineWidth=V.lw(2); for (let i=1;i<P.length;i++){ const [a,b]=[P[i-1],P[i]], L=Math.hypot(b[0]-a[0],b[1]-a[1]), nx=-(b[1]-a[1])/L*sd, ny=(b[0]-a[0])/L*sd;
      for (let s=0;s<L;s+=11*u){ const px=a[0]+(b[0]-a[0])*s/L, py=a[1]+(b[1]-a[1])*s/L; g.beginPath(); g.moveTo(px,py); g.lineTo(px+nx*12*u,py+ny*12*u); g.stroke(); } } },
  /* the inside of a great tent, seen from above: the felt wall, the floor, the hearth */
  floor(g,it,V,D){ const [x,y]=V.p(it.at), rx=(it.r||.36)*V.w, ry=rx*.62;
    g.fillStyle="#efe3c2"; g.beginPath(); g.ellipse(x,y,rx,ry,0,0,7); g.fill(); g.strokeStyle=SSINK; g.lineWidth=V.lw(3); g.stroke();
    g.strokeStyle="#b99a66"; g.lineWidth=V.lw(7); g.beginPath(); g.ellipse(x,y,rx-V.lw(6),ry-V.lw(6),0,0,7); g.stroke();
    g.fillStyle="#d2552a"; g.beginPath(); g.arc(x,y,10*V.k,0,7); g.fill(); g.strokeStyle=SSINK; g.lineWidth=V.lw(2.5); g.stroke(); },
  /* a place's name on a paper plate; with on: "water" (or "hill", "wood") it is the name of the ground itself, written on it */
  label(g,it,V){ const [x,y]=V.p(it.at);
    if (it.on){ if (V.z>.6) ssNameOn(g,it.t,[[x-600,y],[x+600,y]],{size:(it.s||34)*Math.max(.62,V.k), sp:.16, col:SSNAMEC[it.on], al:.7*ssClamp((V.z-.6)/.3)}); return; }
    if (V.z<.8) return; ssLabel(g,it.t,x,y); }
};
function ssScene(g,M,a,dark){
  if (!M || a<=0) return; const D=ssDk(dark), r=ssRng(ssHash(M.id)), W=mapW, H=mapH-ssCapH(), V={p:M.p, z:M.z, w:W*M.z, h:H*M.z, k:ssSk(W)*M.z, lw:x=>Math.max(.6,x*Math.min(1,M.z)), dark};
  g.save(); g.globalAlpha=a; g.lineCap="round"; g.lineJoin="round";
  for (const it of M.sc.items||[]) if (SSITEM[it.k]){ g.save(); SSITEM[it.k](g,it,V,D,r); g.restore(); }
  g.restore();
}
/* the armies of a chapter at time Tx: each road, how far along it the army is, and the square of each leader (one a person: their latest road) */
function ssArmies(Tx, ch){
  const latest=new Map(), list=[], tokens=[];
  for (const A of SS.acts) if (A.army && A.s<=Tx && A.ch===ch) latest.set(A.army.who||A, A);
  for (const A of SS.acts){ if (!A.army || A.s>Tx || A.ch!==ch) continue;
    const a=A.army, ld=A.lead||0, t=Math.max(0,Tx-A.s-ld), d=Math.max(.5,A.d-ld), col=ssSide(a.side||((SS.s.cast[a.who]||{}).side)||"mongol"), by=a.by||[0,.85], p=ssClamp((t/d-by[0])/Math.max(.05,by[1]-by[0])), done=Tx>=A.s+A.d, last=latest.get(a.who||A)===A;
    const P=A.pts.map(q=>P2(q[0],q[1])), seg=[0]; for (let i=1;i<P.length;i++) seg.push(seg[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
    const upto=seg[seg.length-1]*ssEz(p), [hx,hy,ang]=ssAlong(P,seg,upto);
    list.push({A,a,col,p,t,d,done,last,P,seg,upto,hx,hy,ang});
    if (!a.who) continue;
    const ti=tokens.findIndex(q=>q.who===a.who); if (ti>=0) tokens.splice(ti,1);
    tokens.push({x:hx, y:hy, ang, who:a.who, col, live:!done, die:a.die!=null ? ssEz(ssClamp((t-a.die*d)/.9)) : 0});
  }
  return {list, tokens};
}
/* the people of line k at time Tx, with where and how large each one is drawn. A line's action runs after its lead, the beat in which
   the caption is read and the camera arrives */
function ssCastAt(k, Tx, env, tokens){
  const L=SS.lines[k], o={L, figs:[], face:{}, PT:a=>P2(a[0],a[1]), us:1, W:env.W, t:0, f:0, d:1, lab:1};
  if (!L) return o;
  const {W,H,capY,sk,ink}=env, ld=L.lead||0, d=o.d=Math.max(.5,L.d-ld), f=o.f=ssWarp(L.wp,ssClamp(Tx-L.s-ld,0,d)/d), t=o.t=f*d, ch=L.ch, chId=(SS.s.chapters[ch]||{}).id, cast=SS.s.cast;
  const SC=L.scene ? ssSceneMap(L.scene) : null, zs=SC ? ssClamp(SC.z,.12,1.1) : 1, PT=SC ? SC.p : o.PT, cur=L.people||[], face=o.face, stand=[];
  const mine=(p,who)=>p.id===who || ((cast[p.id]||{}).pic && (cast[p.id]||{}).pic===(cast[who]||{}).pic);
  o.PT=PT; o.SC=SC; o.us=SC ? 2*sk*zs : W<760 ? .8 : 1; o.W=SC ? W*zs : W; o.lab=SC ? ssClamp((SC.z-.45)/.3) : 1;
  if (!SC){
    for (const q of tokens||ssArmies(Tx,ch).tokens){ const c=cast[q.who]||{}, here=cur.find(p=>mine(p,q.who));
      if (!q.live && (!here || here.hide || here.at)) continue;   /* a march that is over: its leader stays only while the lines still speak of them, and a line may place or hide them itself */
      const S=(here&&here.focus ? 48 : q.live||here ? 40 : 28)*(W<760 ? .8 : 1);
      o.figs.push({c, id:q.who, x:q.x, y:q.y, S, pill:(q.live||here) ? q.col : null, al:q.live||here ? 1 : .8, die:q.die});
      face[q.who]=[q.x,q.y,S,Math.cos(q.ang||0)>=0 ? 1 : -1]; if (here) face[here.id]=face[q.who]; }   /* the 4th: the side clear of the army's block, which trails behind */
    for (const p of cur){ if (face[p.id] || p.hide) continue; const c=cast[p.id]; if (!c) continue;
      let at=p.at || ssAtOf(c,chId);
      if (typeof at==="string" && at[0]==="@"){ const fc=face[at.slice(1)]; at=null; if (fc){ stand.push({p,c,x:fc[0]+(fc[3]||1)*(fc[2]+22),y:fc[1],near:true}); continue; } }
      if (!at) at=ssLastPlace(p.id,Tx) || ((L.acts.find(a=>a.mark)||{}).mark||{}).at;
      const [x,y] = at ? P2(at[0],at[1]) : [W/2, capY/2];
      stand.push({p,c,x,y}); }
    /* people at one place stand side by side, a little above it, so its name still shows */
    const groups=new Map();
    for (const q of stand){ const key=q.near ? "n"+q.x : Math.round(q.x/24)+","+Math.round(q.y/24); if (!groups.has(key)) groups.set(key,[]); groups.get(key).push(q); }
    for (const G of groups.values()) G.forEach((q,j)=>{ if (!q.near){ q.x+=(j-(G.length-1)/2)*(W<760 ? 54 : 74); q.y-=(q.p.focus ? 52 : 42)/2+72; } });
    /* leaders whose roads end at one place ease apart, side by side */
    const F=o.figs; for (let it=0;it<4;it++) for (let i=0;i<F.length;i++) for (let j=i+1;j<F.length;j++){ const a=F[i], b=F[j], need=(a.S+b.S)/2+8, dx=b.x-a.x, dy=Math.abs(b.y-a.y);
      if (Math.abs(dx)>=need || dy>=need) continue; const push=(need-Math.abs(dx))/2*(1-dy/need), sg=dx>=0 ? 1 : -1; a.x-=push*sg; b.x+=push*sg; }
    for (const q of F){ const fc=face[q.id]; if (fc){ fc[0]=q.x; fc[1]=q.y; } }
  } else {
    let j=0; for (const p of cur){ const c=cast[p.id]; if (!c || p.hide) continue;
      const xy=PT(Array.isArray(p.at) ? p.at : [.3+.12*j++, .56]); stand.push({p,c,x:xy[0],y:xy[1]}); }
  }
  for (const q of stand){ q.S=(SC ? (q.p.focus ? 72 : 60)*sk*zs : (q.p.focus ? 52 : 42)*(W<760 ? .78 : 1))*(q.p.s||1);
    if (!SC){ q.x=ssClamp(q.x,40,W-40); q.y=ssClamp(q.y,70,capY-120); } face[q.p.id]=[q.x,q.y,q.S]; }
  /* on the map, no two people share a spot: squares and name plates that would touch ease apart into a row. A leader stays at
     the head of the army; the one standing by gives way */
  if (!SC){ const tw=c=>ssName(c).length*7.4+16, B=[...o.figs.map(q=>({q,fix:true,w:tw(q.c)})), ...stand.map(q=>({q,fix:!!q.near,w:tw(q.c)}))];
    for (let it=0; it<8; it++) for (let i=0;i<B.length;i++) for (let j=i+1;j<B.length;j++){ const a=B[i], b=B[j], dx=b.q.x-a.q.x, dy=Math.abs(b.q.y-a.q.y);
      const need=Math.max((a.q.S+b.q.S)/2+12,(a.w+b.w)/2+6), vn=(a.q.S+b.q.S)/2+26; if (Math.abs(dx)>=need || dy>=vn) continue;
      const push=need-Math.abs(dx), sg=dx>0 || (dx===0 && i<j) ? 1 : -1;
      if (a.fix && b.fix){ a.q.x-=push/2*sg; b.q.x+=push/2*sg; } else if (a.fix) b.q.x+=push*sg; else if (b.fix) a.q.x-=push*sg; else { a.q.x-=push/2*sg; b.q.x+=push/2*sg; } }
    for (const {q} of B){ q.x=ssClamp(q.x,40,W-40); const id=q.p ? q.p.id : q.id, fc=face[id]; if (fc){ fc[0]=q.x; } } }
  o.q=SC ? 1.1/d : 0;   /* a slide lasts about a second */
  for (const q of stand){ const [x,y]=ssGo([q.x,q.y], q.p.go, f, PT, face, q.S, o.q), p=q.p; face[p.id]=[x,y,q.S];
    o.figs.push({c:q.c, id:p.id, x, y, S:q.S, lab:o.lab, pill:ink, role:p.focus && q.c.role, die:p.die==null ? 0 : p.die<0 ? 1 : ssEz(ssClamp((t-p.die*d)/1.1)),
      al:(p.in!=null ? ssClamp((t-p.in*d)/.5) : 1)*(p.out!=null ? 1-ssClamp((t-p.out*d)/.6) : 1)}); }
  return o;
}
/* a group's place when its line starts and when it ends: a group that ends one line where the next one starts is the same group, and stays */
const ssGrp = a => a.host||a.crowd||a.flood;
const ssKey0 = a => { const q=ssGrp(a); return (a.flood ? "f" : a.host ? "h"+(q.units||6)+(q.form||"") : "c"+(q.n||8)+(q.kind||""))+JSON.stringify(q.at); };
const ssKey1 = a => { const q=ssGrp(a), g=(q.go||[]).filter(s=>Array.isArray(s[0])).pop(); return (a.flood ? "f" : a.host ? "h"+(q.units||6)+(q.form||"") : "c"+(q.n||8)+(q.kind||""))+JSON.stringify(g ? g[0] : q.at); };
function ssPaint(){
  const g=mctx, T=SS.T, cs=getComputedStyle(document.documentElement), surf=cs.getPropertyValue("--surface").trim(), ink=cs.getPropertyValue("--ink").trim(), dark=isDark();
  SS.yr=ssYearAt(T);
  const k=ssLine(T), L=SS.lines[k], Pv=k>0 ? SS.lines[k-1] : null, ch=L ? L.ch : 0, capY=mapH-ssCapH(), W=mapW, H=capY, t=L ? T-L.s : 0; SS.hits=[]; SS.tags=[];
  const env={W,H,capY,sk:ssSk(W),ink,surf}, FD=.5, fnt15="600 15px 'Barlow Semi Condensed', Barlow, sans-serif";
  /* as a close-up comes up, the map's own symbols give way to it */
  const {SC,SCo,lv,sa}=ssNear(), ma=1-sa;
  g.save(); g.setTransform(dpr,0,0,dpr,0,0); g.lineCap="round"; g.lineJoin="round";
  /* lands, in the order taken; a land taken back goes. They are painted as one sheet, a later land over an earlier one, so lands
     that overlap do not darken where they meet, and only the outside of the whole has an edge */
  const land=new Map(), LD=[];
  for (const A of SS.acts) if (A.land && A.s<=T){ if (A.off) land.delete(A.land); else land.set(A.land,A); }
  for (const [id,A] of land){
    const G=SSLAND.get(id); if (!G) continue;
    const col=ssSide(A.side||"mongol"), p=ssClamp((T-A.s)/Math.min(3,A.d*.8)), path=new Path2D();
    let bx=[1e9,1e9,-1e9,-1e9], clip=null;
    for (const r of G.rings){ for (let i=0;i<r.length;i+=2){ const [x,y]=tiltPt(sx(r[i]),sy(r[i+1])); if (i) path.lineTo(x,y); else path.moveTo(x,y);
      if (x<bx[0]) bx[0]=x; if (y<bx[1]) bx[1]=y; if (x>bx[2]) bx[2]=x; if (y>bx[3]) bx[3]=y; } path.closePath(); }
    if (p<1){ const o = A.from ? P2(A.from[0],A.from[1]) : [(bx[0]+bx[2])/2,(bx[1]+bx[3])/2];
      const R=Math.max(...[[bx[0],bx[1]],[bx[2],bx[1]],[bx[0],bx[3]],[bx[2],bx[3]]].map(q=>Math.hypot(q[0]-o[0],q[1]-o[1])));
      clip=new Path2D(); clip.arc(o[0],o[1],Math.max(1,R*ssEz(p)),0,7); }
    LD.push({A,G,col,path,bx,clip});
  }
  if (LD.length){
    const cv=SS.lc||(SS.lc=document.createElement("canvas")), mc=g.canvas; if (cv.width!==mc.width || cv.height!==mc.height){ cv.width=mc.width; cv.height=mc.height; }
    const o=cv.getContext("2d"), wipe=()=>{ o.setTransform(1,0,0,1,0,0); o.globalCompositeOperation="source-over"; o.clearRect(0,0,cv.width,cv.height); o.setTransform(dpr,0,0,dpr,0,0); };
    const each=fn=>{ for (const q of LD){ o.save(); if (q.clip) o.clip(q.clip); fn(q); o.restore(); } }, put=a=>{ g.save(); g.setTransform(1,0,0,1,0,0); g.globalAlpha=a; g.drawImage(cv,0,0); g.restore(); };
    wipe(); each(q=>{ o.fillStyle=q.col; o.fill(q.path,"evenodd"); }); put(.42*(1-.85*sa));   /* in a close-up the ground is the ground: the side's colour thins out */
    wipe(); o.lineJoin="round"; each(q=>{ o.strokeStyle=ssShade(q.col,-.25); o.lineWidth=5; o.stroke(q.path); });
    o.globalCompositeOperation="destination-out"; each(q=>{ o.fillStyle="#000"; o.fill(q.path,"evenodd"); }); put(1-.7*sa);
  }
  for (const {A,G,col,bx} of LD){
    const na=ma*ssClamp((T-A.s)/.5)*ssClamp((A.s+A.d-T)/.5);
    if (na>0 && G.name){ const x=(bx[0]+bx[2])/2, y=(bx[1]+bx[3])/2;
      if (x>0 && x<mapW && y>0 && y<mapH){ g.globalAlpha=na; ssTag(g, G.name.toUpperCase(), x, y, ssShade(col,-.35), surf, "600 14px 'Barlow Semi Condensed', Barlow, sans-serif", 2, "map"); g.globalAlpha=1; } }
  }
  /* armies of this chapter: a plain line where each has marched, and the army itself as a block of units behind its leader's square,
     upright, as an army stands on a Historia Civilis map (the dashed road with units strung along it "looks silly": Hari, 21 Nov 2026).
     Only a leader's latest army keeps its block; an earlier march stays as a faint line */
  const AR=ssArmies(T,ch), cast0=SS.s.cast||{};
  if (ma>.02){
  for (const R of AR.list){ const {A,a,col,p,done,last,P,seg,upto,hx,hy,ang}=R;
    const path=new Path2D(); path.moveTo(P[0][0],P[0][1]);
    for (let i=1;i<P.length && seg[i-1]<upto;i++){ if (seg[i]<=upto) path.lineTo(P[i][0],P[i][1]); else path.lineTo(hx,hy); }
    g.globalAlpha=ma*(last ? .85 : .22); g.strokeStyle=col; g.lineWidth=last ? 4 : 2; g.stroke(path);
    const ha=ssClamp((R.t-R.d*(a.by||[0,.85])[1])/.35);
    if (ha>0 && !(a.who && last)){ const h=11, E=P[P.length-1], hd=new Path2D(); hd.moveTo(E[0]+Math.cos(ang)*4,E[1]+Math.sin(ang)*4);
      hd.lineTo(E[0]-h*Math.cos(ang-.5),E[1]-h*Math.sin(ang-.5)); hd.lineTo(E[0]-h*Math.cos(ang+.5),E[1]-h*Math.sin(ang+.5)); hd.closePath();
      g.globalAlpha=ma*(last ? .8 : .4)*ha; g.fillStyle=col; g.fill(hd); }
    g.globalAlpha=ma;
    const lead=a.who && L ? (L.people||[]).find(p=>p.id===a.who || ((cast0[p.id]||{}).pic && (cast0[p.id]||{}).pic===(cast0[a.who]||{}).pic)) : null;
    if (last && (!done || !a.who || (lead && !lead.hide && !lead.at))){ /* a few wide crossed boxes, however large the army: the count is said, not drawn */
      const n=ssClamp(Math.ceil((a.units!=null ? a.units : 5)/2),1,4), seed=ssHash(String(a.p[0])+n), rows=n>2 ? 2 : 1, cols=Math.ceil(n/rows), um=W<760 ? 1.05 : 1.3, dx=24.5*um, dy=16.5*um, U=[];
      const back=(a.who ? 26 : 0)+Math.hypot(cols*dx,rows*dy)*.42+4, [cx,cy]=ssAlong(P,seg,upto-back);
      for (let i=0;i<n;i++) U.push({x:cx+((i%cols)-(cols-1)/2)*dx, y:cy+(Math.floor(i/cols)-(rows-1)/2)*dy, ang:Math.PI/2});
      U.forEach((u,i)=>{ const bk=a.break!=null ? ssBreakK(R.t,a.break*R.d,seed+i) : 0, v=ssBroke(u,bk,seed+i*13,um); ssUnit(g,v.x,v.y,v.ang,col,um,bk); });
      if (a.n && U.length) ssTag(g, a.n, cx, Math.min(...U.map(u=>u.y))-22, col, surf, null, 3); }
    const la=ssClamp((p-.1)/.12)*ssClamp((A.s+A.d-T)/.5);
    if (a.t && la>0 && !a.who){ const m=P[Math.floor(P.length*.5)];   /* a march led by a named square needs no words of its own */ g.globalAlpha=ma*la; ssTag(g, a.t, m[0], m[1]-16, col, surf, null, 3); g.globalAlpha=ma; }
  }
  /* marks: this chapter's, and the ledger of cities burned or spared from all before */
  for (const A of SS.acts){ if (!A.mark || A.s>T) continue;
    const m=A.mark, led = m.k==="sack" || m.k==="spared"; if (A.ch!==ch && !led) continue;
    const old=A.ch!==ch, [x,y]=P2(m.at[0],m.at[1]); if (x<-40||x>mapW+40||y<-40||y>mapH+40) continue;
    const pop=ssClamp((T-A.s)/.6), sc=(old ? .62 : 1)*(.7+.3*ssEz(pop)), ic=SSICON[m.k], al=ma*ssEz(pop), fresh=old ? 0 : 1-ssClamp((T-A.s-A.d-7)/.6), mine=T<A.s+A.d;   /* a place keeps its name for a few seconds after its line; a click still gives it */
    g.globalAlpha=al;
    if (ic){ const im=ssImg("kinds/"+ic+".png"), s=52*sc; if (im){ g.globalAlpha=al*(old ? .82 : 1); ssFrame(g,"kinds/"+ic+".png", x-s/2, y-s*.82, s, s, false, ssHash(m.t||"")%8); g.globalAlpha=al; }
      if (fresh>0){ g.globalAlpha=al*fresh; ssTag(g, m.t, x, y+s*.3+10, m.k==="sack" ? SSRED : ink, surf, "600 13.5px 'Barlow Semi Condensed', Barlow, sans-serif", mine ? 3 : 1); g.globalAlpha=al; }
      if (ma>.5) SS.hits.push({x, y:y-s*.35, r:s*.5, kb:m.kb, t:m.t, sub:m.sub}); }
    else { g.beginPath(); g.arc(x,y,5.5*sc,0,7); g.fillStyle=m.k==="grave" ? ink : SSRED; g.fill(); g.strokeStyle=surf; g.lineWidth=2; g.stroke();
      if (fresh>0){ g.globalAlpha=al*fresh; ssTag(g, m.t, x, y-15, ink, surf, null, mine ? 3 : 1); }
      if (ma>.5) SS.hits.push({x, y, r:12, kb:m.kb, t:m.t, sub:m.sub}); }
  }
  g.globalAlpha=1;
  }
  if (SCo) ssScene(g,SCo,SCo.a*lv,dark);
  if (SC) ssScene(g,SC,SC.a,dark);
  /* people. A person in the line before glides to where this line puts them; a new one fades in; one who has left fades out */
  const now=ssCastAt(k,T,env,AR.tokens), figs=now.figs, face=now.face, cast=SS.s.cast, GL=L ? Math.min(1.1,L.d*.3) : 1;
  const old=Pv && t<Math.max(FD,GL) ? ssCastAt(k-1,L.s-1e-4,env) : null, e1=ssEz(ssClamp(t/FD));
  if (old){ const used=new Set(), same=(a,b)=>a.id===b.id || ((cast[a.id]||{}).pic && (cast[a.id]||{}).pic===(cast[b.id]||{}).pic), eg=ssEz(ssClamp(t/GL));
    for (const q of figs){ const o=old.figs.find(o=>!used.has(o) && same(o,q));
      if (o && o.al>.05){ used.add(o); q.x=o.x+(q.x-o.x)*eg; q.y=o.y+(q.y-o.y)*eg; q.S=o.S+(q.S-o.S)*eg; q.al=o.al+(q.al-o.al)*eg; face[q.id]=[q.x,q.y,q.S]; }
      else { q.al*=e1; q.S*=.8+.2*e1; } }
    if (e1<1) for (const o of old.figs) if (!used.has(o) && o.al>0) figs.unshift({...o, al:o.al*(1-e1), role:null, gone:true}); }
  /* the line's action, under the people; a group from the line before fades out unless this line carries it on */
  if (L){ const mk=(C,al)=>({PT:C.PT, f:C.f, t:C.t, d:C.d, face:C.face, us:C.us, surf, W:C.W, D:ssDk(dark), T, dark, al, lab:C.lab, SC:!!C.SC, q:C.q ? C.q*1.4 : 0});
    const mineA=L.acts.filter(ssGrp), oldA=old && e1<1 ? Pv.acts.filter(ssGrp) : [], k0=new Set(mineA.map(ssKey0)), k1=new Set(oldA.map(ssKey1));
    const draw=(a,X)=>{ if (a.flood) ssFlood(g,a.flood,X); else if (a.host) ssHost(g,a.host,X); else ssCrowd(g,a.crowd,X); };
    const ord=a=>a.flood ? 0 : a.host ? 1 : 2, Xo=old ? mk({...old, f:1, t:old.d},1-e1) : null;
    for (const a of oldA.filter(a=>!k0.has(ssKey1(a))).sort((a,b)=>ord(a)-ord(b))) draw(a,Xo);
    const Xn=mk(now,1), Xf=mk(now,Pv ? e1 : 1);
    for (const a of mineA.slice().sort((a,b)=>ord(a)-ord(b))) draw(a, k1.has(ssKey0(a)) ? Xn : Xf); }
  const blocks=[];
  for (const q of figs){ if (q.al<=.01) continue; const dk=q.die||0, S=q.S*(1-.08*dk), {x,y}=q;
    g.save(); g.globalAlpha=q.al*(1-.5*dk); ssFig(g,q.c,x,y,S,dark,dk); g.globalAlpha*=q.lab==null ? 1 : q.lab;
    if (q.pill) ssTag(g, ssName(q.c), x, y+S/2+14, q.pill, surf, null, q.role ? 6 : q.gone ? 2 : 5, "name");   /* the name only: who they are is the narrator's to say */
    g.restore(); blocks.push([x-S/2,y-S/2-(q.c.wear ? S*.4 : 0),x+S/2,y+S/2]);
    if (!q.gone) SS.hits.push({x, y:y-S*.2, r:S*.75, kb:q.c.kb, who:q.id}); }
  /* a shot: {shot: {from: ["temujin", "qasar"], to: "bekter", t: [.82, .92]}}: an arrow from each, in an arc, into the other's square, where it stays.
     from and to may also be places ([x, y] in a close-up, [lat, lon] on the map): to as a list pairs each archer with a mark, and an arrow that lands
     on the ground fades. kind: "stone" is a catapult's shot */
  if (L) for (const a of L.acts){ if (!a.shot) continue; const s=a.shot, [t0,t1]=s.t||[.7,.8], isPt=e=>Array.isArray(e) && typeof e[0]==="number";
    const end=e=>{ if (isPt(e)){ const p=now.PT(e); return {x:p[0], y:p[1], S:0, al:1, pt:true}; } return figs.find(q=>q.id===e && !q.gone); };
    let fr=isPt(s.from) ? [s.from] : [].concat(s.from||[]), tos=isPt(s.to) || !Array.isArray(s.to) ? null : s.to;
    if (s.n>1 && isPt(s.from) && isPt(s.to)){ const sp=s.sp||[0,.1], r=ssRng(ssHash(String(s.from)+s.n)), o=[...Array(s.n)].map((_,i)=>{ const k=i/(s.n-1)-.5; return [sp[0]*k, sp[1]*k, (r()-.5)*.02, (r()-.5)*.02]; });   /* a volley: n arrows spread over sp = [dx, dy] */
      fr=o.map(v=>[s.from[0]+v[0]+v[2], s.from[1]+v[1]+v[3]]); tos=o.map(v=>[s.to[0]+v[0]-v[2], s.to[1]+v[1]-v[3]]); }
    fr.forEach((e,i)=>{ const f=end(e), to=end(tos ? tos[i%tos.length] : s.to); if (!f || !to) return;
      const dx=to.x-f.x, dy=to.y-f.y, d=Math.hypot(dx,dy)||1, lag=fr.length>1 ? .28*i/(fr.length-1) : 0, p=(now.f-t0)/Math.max(1e-3,t1-t0)*(1+lag)-lag;
      g.globalAlpha=Math.min(f.al,to.al)*(p>1 ? (to.pt && !s.keep ? Math.max(0,1-(p-1)*2.5) : .8) : 1); if (g.globalAlpha<=.01) return;
      ssArrow(g,[f.x+dx/d*f.S*.6, f.y+dy/d*f.S*.6-f.S*.15],[to.x-dx/d*to.S*.3, to.y-dy/d*to.S*.3],p,Math.max(.75,env.sk)*(now.SC ? 1 : .8),s.kind); }); g.globalAlpha=1; }
  ssTags(g,blocks);
  SS.face=face; ssBubble();
  g.restore();
}

/* ---------- what shows over the map: year, chapter, title card, caption, card, quote, note ---------- */
function ssStage(){
  if ($("ssStage")) return;
  const st=el("div","ss-stage"); st.id="ssStage";
  st.innerHTML=`<div class="ss-dim" id="ssDim"></div>
  <div class="ss-head"><div class="ss-year" id="ssYear"></div><div class="ss-chap" id="ssChap"></div></div>
  <div class="ss-title" id="ssTitle" hidden></div>
  <div class="ss-quote" id="ssQuote" hidden></div>
  <div class="ss-src" id="ssSrc" hidden></div>
  <div class="ss-chip" id="ssChip" hidden></div>
  <div class="ss-hint" id="ssHint" hidden>Paused. Click a person or a marked place to read about it, anywhere else to play.</div>
  <div class="ss-big" id="ssBig" hidden><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></div>
  <button type="button" class="ss-x" id="ssExit" aria-label="Leave the film" title="Leave the film. Esc"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
  <div class="ss-tip" id="ssTip" hidden></div>
  <div class="ss-lobby" id="ssLobby" hidden></div>
  <div class="ss-ctrl" id="ssCtrl">
    <button type="button" class="ss-b ss-play" id="ssPlay" aria-label="Play"></button>
    <button type="button" class="ss-b" id="ssPrev" aria-label="Previous line" title="Previous line. Left arrow"><svg viewBox="0 0 16 16"><path d="M4 3.5v9M12.5 3.6v8.8L5.8 8z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></button>
    <button type="button" class="ss-b" id="ssNext" aria-label="Next line" title="Next line. Right arrow"><svg viewBox="0 0 16 16"><path d="M12 3.5v9M3.5 3.6v8.8L10.2 8z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></button>
    <div class="ss-bar" id="ssBar" role="slider" tabindex="0" aria-label="Position in the film"><div class="ss-segs" id="ssSegs"></div><div class="ss-fill" id="ssFill"></div><div class="ss-knob" id="ssKnob"></div><div class="ss-bartip" id="ssBarTip" hidden></div></div>
    <span class="ss-time" id="ssTime"></span>
    <button type="button" class="ss-b ss-txt" id="ssSpeed" title="Speed"></button>
    <button type="button" class="ss-b ss-txt" id="ssVoice" title="The narrator's voice"></button>
    <button type="button" class="ss-b ss-txt" id="ssCC" title="Show the words on screen" hidden></button>
  </div>
  <div class="ss-cap" id="ssCap"><p id="ssCapT"></p></div>`;
  $("mapWrap").append(st);
  const vg=el("div","ss-vig"); vg.id="ssVig"; document.body.append(vg);
  $("ssPlay").addEventListener("click",()=>ssToggle());
  $("ssPrev").addEventListener("click",()=>ssStep(-1));
  $("ssNext").addEventListener("click",()=>ssStep(1));
  $("ssExit").addEventListener("click",()=>ssClose());
  $("ssSpeed").addEventListener("click",()=>{ const o=[1,1.5,2]; SS.speed=o[(o.indexOf(SS.speed)+1)%o.length]; saveLS("history.ss.speed",SS.speed); ssCtrlDraw(); });
  $("ssVoice").addEventListener("click",()=>{ SS.voice=!SS.voice; SS.vfail=false; saveLS("history.ss.voice",SS.voice?"1":"0"); if (!SS.voice) ssHush(); else SS.said=-1; ssCtrlDraw(); if (!SS.on) ssAt(SS.T); });
  $("ssCC").addEventListener("click",()=>{ SS.cc=ssCapOn() ? "0" : "1"; saveLS("history.ss.cc",SS.cc); ssCtrlDraw(); if (!SS.on) ssAt(SS.T); });
  /* the scrubber: click or drag to any point */
  const bar=$("ssBar"); let was=false;
  const at=e=>{ const r=bar.getBoundingClientRect(); return ssClamp((e.clientX-r.left)/r.width)*SS.total; };
  bar.addEventListener("pointerdown",e=>{ bar.setPointerCapture(e.pointerId); was=SS.on; ssPause(); ssSeek(at(e)); bar.dataset.drag="1"; });
  bar.addEventListener("pointermove",e=>{ if (bar.dataset.drag){ ssSeek(at(e)); return; }
    const T=at(e), c=SS.chs.findLast ? SS.chs.findLast(c=>c.s<=T) : SS.chs.filter(c=>c.s<=T).pop(), tp=$("ssBarTip");
    if (c){ tp.textContent=c.t; tp.hidden=false; tp.style.left=(e.clientX-bar.getBoundingClientRect().left)+"px"; } });
  bar.addEventListener("pointerleave",()=>{ $("ssBarTip").hidden=true; });
  const up=()=>{ if (!bar.dataset.drag) return; delete bar.dataset.drag; if (was) ssPlay(); };
  bar.addEventListener("pointerup",up); bar.addEventListener("pointercancel",up);
  bar.addEventListener("keydown",e=>{ if (e.key==="ArrowLeft"||e.key==="ArrowRight"){ e.preventDefault(); e.stopPropagation(); ssSeek(SS.T+(e.key==="ArrowRight"?5:-5)); } });
  /* the controls fade while it plays and the pointer is still */
  st.addEventListener("pointermove",()=>ssWake());
}
function ssWake(){ document.body.classList.remove("ss-calm"); clearTimeout(SS.hideT); if (SS.on) SS.hideT=setTimeout(()=>{ if (SS.on) document.body.classList.add("ss-calm"); },2600); }
function ssCtrlDraw(){
  const PL='<svg viewBox="0 0 16 16"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>', PA='<svg viewBox="0 0 16 16"><path d="M4.5 3h2.4v10H4.5zM9.1 3h2.4v10H9.1z" fill="currentColor"/></svg>';
  $("ssPlay").innerHTML=SS.on ? PA : PL; $("ssPlay").setAttribute("aria-label", SS.on ? "Pause. Space" : "Play. Space");
  $("ssSpeed").textContent=SS.speed+"x"; $("ssVoice").textContent = SS.voice && !SS.vfail ? "Voice on" : "Voice off"; $("ssVoice").setAttribute("aria-pressed",SS.voice);
  /* with the narrator on, the words are off unless asked for: reading the foot of the screen and watching the map at once is hard (Hari, 21 Nov 2026) */
  { const on=ssCapOn(), cc=$("ssCC"), cap=$("ssCap"); cc.hidden=!ssVoiced(); cc.textContent = on ? "Words on" : "Words off"; cc.setAttribute("aria-pressed",on);
    if (cap.hidden===on){ cap.hidden=!on; document.body.classList.toggle("ss-nocap",!on); } }
  const tm=s=>Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
  $("ssTime").textContent=tm(SS.T)+" / "+tm(SS.total);
  const f=SS.total ? SS.T/SS.total*100 : 0; $("ssFill").style.width=f+"%"; $("ssKnob").style.left=f+"%";
  document.body.classList.toggle("ss-playing",SS.on);
  $("ssHint").hidden = SS.on || SS.lobby || SS.read;
  $("ssBig").hidden = SS.on || SS.lobby || SS.read || !SS.hov;
}
function ssSegs(){ const box=$("ssSegs"); box.textContent=""; for (const c of SS.chs){ const i=el("i"); i.style.left=(c.s/SS.total*100)+"%"; i.style.width=(c.d/SS.total*100)+"%"; box.append(i); } }
function ssCastFace(c, size){
  const cv=el("canvas","ss-face"), r=window.devicePixelRatio||1; cv.width=cv.height=Math.round(size*r); cv.style.width=cv.style.height=size+"px";
  const g=cv.getContext("2d"); g.scale(r,r); g.clearRect(0,0,size,size); ssFig(g,c,size/2,size*.64,size*.5,isDark(),0);
  return cv;
}
/* the screen for line L, set once when the line changes */
function ssScreen(){
  const k=ssLine(SS.T), L=SS.lines[k]; if (!L) return;
  let ci=0; const fr=(SS.T-L.s)/L.d; (L.caps||[]).forEach((c,i)=>{ if (c.f<=fr+1e-6) ci=i; });
  if (k!==SS.li || ci!==SS.ci){ SS.ci=ci; const cap=$("ssCapT"), tx=L.caps && L.caps.length ? L.caps[ci].t : L.say; if (cap.textContent!==tx){ cap.textContent=tx; cap.classList.toggle("b"); } }
  if (k===SS.li) return; SS.li=k;
  const ch=SS.s.chapters[L.ch], C=SS.chs[L.ch];
  $("ssChap").innerHTML=""; $("ssChap").append(el("small",null,L.ch===0 && ch.id==="open" ? "Prologue" : "Chapter "+(SS.s.chapters[0].id==="open" ? L.ch : L.ch+1)), el("b",null,ch.t));
  const ti=$("ssTitle"); ti.hidden=!L.title;
  if (L.title){ ti.innerHTML=""; ti.append(el("small",null,$("ssChap").firstChild.textContent), el("h2",null,ch.t)); if (C.y) ti.append(el("span",null, C.y[0]===C.y[1] ? fmt(C.y[0]) : fmt(C.y[0])+" to "+fmt(C.y[1]))); }
  $("ssCap").classList.toggle("hook",!!L.hook); $("ssCap").classList.toggle("empty",!L.say);
  const has=key=>L.acts.find(a=>a[key]!=null);
  const qa=has("quote"), q=$("ssQuote");
  if (qa){ const Q2=qa.quote, c2=SS.s.cast[Q2.who]||{}; q.innerHTML=""; q.dataset.who=Q2.who; q.dataset.pos=Q2.pos||""; q.style.setProperty("--side",ssCol(c2));
    const b=el("div","ss-bub"); b.append(el("p",null,Q2.text)); q.append(b); q.hidden=false; q.classList.add("wait");
    $("ssSrc").textContent=Q2.src||""; $("ssSrc").hidden=!Q2.src; $("ssSrc").classList.add("wait"); }
  else { q.hidden=true; q.dataset.who=""; $("ssSrc").hidden=true; }
  const ca=has("chip"), cp=$("ssChip");
  if (ca){ cp.innerHTML=""; cp.append(el("b",null,ca.chip.t||"Note"), el("span",null,ca.chip.text)); cp.hidden=false; } else cp.hidden=true;
  $("ssDim").classList.toggle("on", !!has("dim") || !!L.title);
}
/* the speech bubble sits beside its speaker's figure, wherever the map has put them */
function ssBubble(){
  const q=$("ssQuote"); if (!q || q.hidden) return;
  /* it comes up once the caption has been read and the speaker has stopped walking */
  const L=SS.lines[ssLine(SS.T)], src=$("ssSrc"), wait=!!L && (SS.T-L.s-(L.lead||0))/Math.max(.5,L.d-(L.lead||0)) < (L.qf||0);
  q.classList.toggle("wait",wait); src.classList.toggle("wait",wait);
  const f=SS.face && SS.face[q.dataset.who];
  /* on a phone the source sits on top of the bubble */
  const tag=()=>{ if (mapW<760 && !src.hidden){ src.style.left=ssClamp(q.offsetLeft,12,Math.max(12,mapW-src.offsetWidth-12))+"px";
      src.style.top=Math.max(8,q.offsetTop-src.offsetHeight-6)+"px"; } else src.style.left=src.style.top=""; };
  if (!f){ q.classList.add("free"); q.style.left=q.style.top=""; tag(); return; }
  q.classList.remove("free");
  const w=q.offsetWidth, h=q.offsetHeight, gap=f[2]*.75+14; let x=f[0]+gap, flip=false;
  if (q.dataset.pos==="up" || (x+w>mapW-12 && f[0]-gap-w<12)){   /* above the speaker: when asked, or when there is no room beside them */ q.classList.add("ss-up"); q.classList.remove("flip");
    q.style.left=ssClamp(f[0]-w/2,12,Math.max(12,mapW-w-12))+"px"; q.style.top=Math.max(12,f[1]-f[2]/2-18-h)+"px"; tag(); return; }
  q.classList.remove("ss-up");
  if (x+w>mapW-12){ x=f[0]-gap-w; flip=true; }
  x=ssClamp(x,12,Math.max(12,mapW-w-12)); const y=ssClamp(f[1]-h/2, 12, Math.max(12,mapH-ssCapH()-110-h));
  q.style.left=x+"px"; q.style.top=y+"px"; q.classList.toggle("flip",flip); tag();
}
function ssHud(){ const y=ssYearAt(SS.T); if (y!=null) $("ssYear").textContent=fmt(y); }

/* ---------- the clock ---------- */
function ssAt(T, fly){
  SS.T=ssClamp(T,0,SS.total); ssScreen(); ssHud(); ssCtrlDraw();
  const y=ssYearAt(SS.T); if (y!=null && y!==MAP.year) setYear(y);
  if (!SS.free){ const v=ssCamAt(SS.T); if (v){
    if (SS.ease){ const f=ssClamp((performance.now()-SS.ease.t0)/900), e=ssEz(f); MAP.view={x:SS.ease.a.x+(v.x-SS.ease.a.x)*e, y:SS.ease.a.y+(v.y-SS.ease.a.y)*e, k:Math.exp(Math.log(SS.ease.a.k)+(Math.log(v.k)-Math.log(SS.ease.a.k))*e)}; if (f>=1) SS.ease=null; }
    else MAP.view=v; } }
  paint();
}
/* the narrator: one recorded clip a line (super/<id>.voice.js, made by _tools/ssvoice). The film's clock leads: a clip starts at its
   place in the line and is put back if it strays. A story with no clips falls back on the browser's own voice */
const ssVoiced = () => SS.voice && SS.hasVoice && !SS.vfail;
const ssCapOn = () => !ssVoiced() || SS.cc==="1";
function ssClip(k){
  const L=SS.lines[k]; if (!L || !L.au) return null; let a=SS.clips.get(k);
  if (!a){ a=new Audio(); a.preload="auto"; a.addEventListener("error",()=>{ a.bad=true; }); SS.clips.set(k,a);
    /* fetched whole and played from memory: a clip straight off a server that cannot send part of a file (python's, for one) will not seek, and a scrub lands mid-clip */
    fetch(SS.vdir+L.au.f+"?d="+L.au.d)   /* a re-recorded clip has a new length, so the browser cannot serve the old one */.then(r=>{ if (!r.ok) throw new Error(r.status); return r.blob(); }).then(b=>{ a.src=URL.createObjectURL(b); }).catch(()=>{ a.bad=true; }); }
  return a;
}
/* true: hold the clock a moment, the clip is still loading */
function ssVoiceTick(k,L){
  const a=ssVoiced() ? ssClip(k) : null, want=L ? SS.T-L.s-L.a0 : 0;
  if (SS.cur && SS.cur!==a){ SS.cur.pause(); SS.cur=null; }
  if (!a || a.bad || want<0 || want>=L.au.d-.08) return false;
  if (a.paused){
    if (a.ended && want>L.au.d-.7) return false;
    if (a.readyState<2){ if (!SS.wait) SS.wait=performance.now(); if (performance.now()-SS.wait<2500) return true; a.bad=true; SS.wait=0; return false; }
    SS.wait=0; try{ a.currentTime=want; }catch(e){} a.playbackRate=SS.speed; SS.cur=a;
    const p=a.play(); if (p && p.catch) p.catch(e=>{ if (e && e.name==="NotAllowedError"){ SS.vfail=true; SS.cur=null; ssCtrlDraw(); } });   /* the browser will not play sound: the words come back */
  } else { if (a.playbackRate!==SS.speed) a.playbackRate=SS.speed; if (!a.seeking && Math.abs(a.currentTime-want)>.3+.15*SS.speed){ try{ a.currentTime=want; }catch(e){} } }   /* a clip starts a moment late, more so when sped up: that is let be */
  ssClip(k+1);   /* the next one loads meanwhile */
  return false;
}
function ssTick(now){
  if (!SS.on) return;
  const dt=Math.min(.1,(now-SS.last)/1000); SS.last=now;
  const k=ssLine(SS.T), L=SS.lines[k], hold=ssVoiceTick(k,L);
  if (SS.voice && !SS.hasVoice && L && L.say && SS.said!==k && SS.T-L.s<.5){ ssSay(L.say); SS.said=k; }
  let T=hold ? SS.T : SS.T+dt*SS.speed;
  if (SS.voice && SS.speaking && L && T>=L.s+L.d-.05) T=L.s+L.d-.05;   /* the browser's voice is slower than the line: wait for it */
  if (T>=SS.total){ ssAt(SS.total); ssPause(); return; }
  ssAt(T); SS.raf=requestAnimationFrame(ssTick);
}
function ssSay(t){
  if (!("speechSynthesis" in window)) return; ssHush();
  const v=typeof filmVoice==="function" ? filmVoice() : null, u=new SpeechSynthesisUtterance(t);
  if (v){ u.voice=v; u.lang=v.lang; } u.rate={1:1,1.5:1.25,2:1.45}[SS.speed]||1;
  u.onend=u.onerror=()=>{ SS.speaking=false; }; SS.u=u; SS.speaking=true; speechSynthesis.speak(u);
}
function ssHush(){ SS.speaking=false; SS.wait=0; if (SS.cur){ SS.cur.pause(); SS.cur=null; } try{ if ("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){} }
function ssPlay(){
  if (!SS.s) return; if (SS.T>=SS.total-.01) ssSeek(0);
  SS.lobby=false; $("ssLobby").hidden=true; ssReadOff();
  if (SS.free){ SS.free=false; SS.ease={a:{...MAP.view}, t0:performance.now()}; }   /* the reader moved the map: ease back to the film's view */
  cancelAnimationFrame(flyT); SS.on=true; SS.said = SS.T-SS.lines[ssLine(SS.T)].s<.5 ? -1 : ssLine(SS.T); SS.last=performance.now();
  ssCtrlDraw(); ssWake(); cancelAnimationFrame(SS.raf); SS.raf=requestAnimationFrame(ssTick);
}
function ssPause(){ SS.on=false; cancelAnimationFrame(SS.raf); ssHush(); document.body.classList.remove("ss-calm"); if (SS.s) ssCtrlDraw(); }
function ssToggle(){ SS.on ? ssPause() : ssPlay(); }
function ssSeek(T){ SS.free=false; SS.ease=null; SS.said=-1; ssHush(); ssAt(T); }
function ssStep(d){ const k=ssLine(SS.T), L=SS.lines[k]; const j = d<0 && SS.T-L.s>1.2 ? k : k+d; if (j<0) return; if (j>=SS.lines.length){ ssSeek(SS.total); return; } ssSeek(SS.lines[j].s+.01); }

/* ---------- reading a page while paused: the detail panel slides in from the right ---------- */
function ssRead(kb){ ssPause(); if (kb && typeof kbGo==="function") kbGo(kb); ssReadOn(); }
function ssReadOn(){ SS.read=true; document.body.classList.add("ss-read"); ssCtrlDraw(); }
function ssReadOff(){ SS.read=false; document.body.classList.remove("ss-read"); }

/* ---------- open and close ---------- */
/* a page the film tells of gets a Watch story button on its card (Hari, 22 Nov 2026). A person opens the film at the chapter
   that brings them on; a place, a land or an event at its own line; a page the story is about (s.about), at the start */
function ssStoryFor(kid){
  if (!kid || SS.s) return null;
  for (const s of SSL()){ if (s.draft) continue;
    if ((s.about||[]).includes(kid)) return {s, ch:0, li:0};
    const who=new Set(Object.entries(s.cast||{}).filter(([,c])=>c.kb===kid).map(([id])=>id)), lands=new Set(Object.entries(s.lands||{}).filter(([,l])=>l.kb===kid).map(([id])=>id));
    /* a person's card opens the film where it introduces them (their name card), not at a line that only quotes them or shows them as a child */
    for (let ci=0; ci<s.chapters.length; ci++){ const ch=s.chapters[ci];
      for (let li=0; li<ch.lines.length; li++) if ((ch.lines[li].do||[]).some(a=>a.card && who.has(a.card))) return {s, ch:ci, li}; }
    for (let ci=0; ci<s.chapters.length; ci++){ const ch=s.chapters[ci];
      for (let li=0; li<ch.lines.length; li++){ const A=ch.lines[li].do||[];
        if (A.some(a=>(a.quote && who.has(a.quote.who)) || (a.army && who.has(a.army.who)) || (a.who && !a.who.hide && who.has(a.who.id||a.who)))) return {s, ch:ci, li};
        if (A.some(a=>(a.mark && a.mark.kb===kid) || (a.land && !a.off && lands.has(a.land)))) return {s, ch:ci, li};
      } }
  }
  return null;
}
function ssOpen(s, autoplay, from){
  if (!s) return;
  if (typeof story!=="undefined" && story && typeof endStory==="function") endStory();
  if (typeof setPlay==="function") setPlay(false);
  if (typeof setStories==="function") setStories(false);
  const R=document.documentElement;
  SS.back={mode:MAP.mode, active:[...state.active], view:MAP.view ? {...MAP.view} : null, year:MAP.year, theme:R.dataset.theme};
  /* the film has one look, the Historia Civilis one: daylight, khaki ground, blue water. The reader's theme comes back when it closes */
  R.dataset.theme="light"; R.classList.add("ss-hc");
  SS.s=s; SS.T=0; SS.li=-1; SS.free=false; SS.ease=null; ssBuild(s); ssLoadLands(s); ssTerrainBuild(s); ssStage();
  SS.from=null; if (from && (from.ch || from.li)){ const L = from.li ? SS.lines.find(l=>l.ch===from.ch && l.i===from.li && !l.title) : null, c=SS.chs[from.ch]; SS.from = L ? {T:L.s+.01, ch:from.ch} : c ? {T:c.s+.01, ch:from.ch} : null; }
  for (const k of Object.values(SSICON)) ssImg("kinds/"+k+".png");
  state.active=new Set(REG.map(r=>r.id)); if (typeof refresh==="function") refresh();
  if (MAP.mode!=="full") setMapMode("full");
  document.body.classList.add("ss-on"); MAP.routes=null; MAP.focus=null;
  ssSegs(); ssLobby();
  requestAnimationFrame(()=>{ sizeMap(); ssAt(SS.from ? SS.from.T : 0); if (autoplay) ssPlay(); });
  saveURL();
}
function ssClose(){
  if (!SS.s) return; ssPause(); ssReadOff();
  document.body.classList.remove("ss-on","ss-playing","ss-calm");
  const B=SS.back, R=document.documentElement; SS.s=null; SS.lobby=false;
  R.classList.remove("ss-hc"); if (B){ if (B.theme===undefined) delete R.dataset.theme; else R.dataset.theme=B.theme; }
  if (B){ state.active=new Set(B.active); if (typeof refresh==="function") refresh(); if (B.mode!=="full") setMapMode(B.mode); }
  requestAnimationFrame(()=>{ sizeMap(); drawMap(); }); saveURL();
}
function ssLobby(){
  const s=SS.s, lb=$("ssLobby"); lb.innerHTML=""; SS.lobby=true;
  const box=el("div","ss-lbox");
  box.append(el("small",null,"A super-story"), el("h2",null,s.title), el("p",null,s.sub||""));
  const cast=el("div","ss-cast"); const seen=new Set(); for (const c of Object.values(s.cast||{}).filter(c=>{ const k=c.pic||c.name; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0,12)){ const f=el("span","ss-cm"); f.append(ssCastFace(c,64), el("i",null,ssName(c))); cast.append(f); } box.append(cast);
  const go=el("button","ss-go"); go.type="button"; const F=SS.from;
  go.innerHTML='<svg viewBox="0 0 16 16"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg><span></span>'; go.lastChild.textContent = F ? "Play from "+SS.chs[F.ch].t : "Play";
  go.addEventListener("click",()=>{ if (F) ssSeek(F.T); ssPlay(); });
  const mins=Math.max(1,Math.round(SS.total/60));
  box.append(go);
  if (F){ const g0=el("button","ss-go0","Play from the start"); g0.type="button"; g0.addEventListener("click",()=>{ ssSeek(0); ssPlay(); }); box.append(g0); }
  box.append(el("p","ss-meta",`${SS.chs.length} chapters, about ${mins} min. ${SS.hasVoice ? "Narrated, so turn the sound on. " : ""}Pause any time and click what is on the map to read about it.`));
  lb.append(box); lb.hidden=false; ssCtrlDraw();
}

/* ---------- hooks into the map and the app ---------- */
{ const _paint=paint; paint=function(){ _paint(); if (SS.s && MAP.on && mapW && MAP.view) ssPaint(); }; }
{ const _tg=tiltGround; tiltGround=function(d){ if (SS.s) ssTerrain(mctx); return _tg(d); }; }   /* the drawn ground goes on before the map is tipped */
/* in the film the map's own states are outlines and names on the ground: colour is kept for the film's sides */
/* on ground the film has coloured, only the film's words: a base-map state whose name point lies in a filled land keeps its outline and loses its name */
function ssUnderLand(f){
  if (!f || !f.lab || !SS.acts) return false;
  const T=SS.T; if (!SS._ul || SS._ul.T!==T || SS._ul.acts!==SS.acts){ const m=new Map(); for (const A of SS.acts) if (A.land && A.s<=T){ if (A.off) m.delete(A.land); else m.set(A.land,A); }
    SS._ul={T, acts:SS.acts, G:[...m.keys()].map(id=>SSLAND.get(id)).filter(Boolean)}; }
  const x=f.lab.cx, y=f.lab.cy;
  for (const G of SS._ul.G){ let inn=false;
    for (const r of G.rings) for (let i=0,j=r.length-2;i<r.length;j=i,i+=2) if ((r[i+1]>y)!==(r[j+1]>y) && x<(r[j]-r[i])*(y-r[i+1])/(r[j+1]-r[i+1])+r[i]) inn=!inn;
    if (inn) return true; }
  return false;
}
{ const _cf=colorFor, HC={fill:"rgba(0,0,0,0)", edge:"rgba(74,70,44,.5)", line:"rgba(74,70,44,.8)", text:"#6a6648"}, HCU=Object.assign({},HC,{text:"rgba(0,0,0,0)"}); colorFor=function(f){ return SS.s ? (ssUnderLand(f) ? HCU : HC) : _cf(f); }; }
{ const _items=mapItems; mapItems=function(){ return SS.s ? [] : _items(); }; }   /* the film's own marks only */
{ const _ct=clickTerr; clickTerr=function(f){ if (SS.s && SS.ate){ SS.ate=false; return; } if (SS.s && !SS.read) return;   /* in the film a click on open land pauses or plays; people and marked places open their page */
  _ct(f); if (SS.s) ssReadOn(); }; }
{ const _sel=select; select=function(o){ const r=_sel.apply(this,arguments); if (SS.s && o && !SS.on && !SS.lobby && Date.now()-(SS.touch||0)<1500) ssReadOn(); return r; }; }
/* a touch on the map pauses the film; a still click on something of the film's opens its page */
mapCanvas.addEventListener("pointerdown",e=>{ if (!SS.s) return; SS.touch=Date.now(); SS.down=[e.clientX,e.clientY]; SS.wasOn=SS.on; if (SS.on){ ssPause(); } if (!SS.lobby) SS.free=true; },true);
mapCanvas.addEventListener("pointerup",e=>{
  if (!SS.s || !SS.down) return; const moved=Math.hypot(e.clientX-SS.down[0],e.clientY-SS.down[1]); SS.down=null; if (moved>5) return;
  const [x,y]=local(e), h=SS.hits.slice().reverse().find(q=>Math.hypot(q.x-x,q.y-y)<=q.r);
  if (h){ SS.ate=true; setTimeout(()=>{ SS.ate=false; },50); if (h.kb && kbTarget(h.kb)) ssRead(h.kb); else ssTipFor(h,x,y); }
  else if (!SS.wasOn && !SS.on && !SS.lobby && !SS.read){ SS.hov=false; ssPlay(); }   /* paused: a click on the open map plays on */
},true);
function ssTipFor(h,x,y){
  const tp=$("ssTip"); tp.innerHTML="";
  const c=h.who ? SS.s.cast[h.who]||{} : null;
  if (c){ tp.append(el("b",null,c.name||"")); if (c.role) tp.append(el("span",null,c.role+(c.years ? ", "+c.years : "")));
    if (!SS.on && c.facts && c.facts.length){ const ul=el("ul"); for (const f of c.facts) ul.append(el("li",null,f)); tp.append(ul); } }
  else { tp.append(el("b",null,h.t||"")); if (h.sub) tp.append(el("span",null,h.sub)); }
  if (h.kb && kbTarget(h.kb)) tp.append(el("i",null,"Click to read the page"));
  tp.hidden=false; tp.style.left=Math.max(6,Math.min(x+14, mapW-tp.offsetWidth-6))+"px"; tp.style.top=Math.max(6,Math.min(y-12, mapH-ssCapH()-tp.offsetHeight-8))+"px";
}
mapCanvas.addEventListener("pointermove",e=>{
  if (!SS.s || e.pointerType==="touch") return; const [x,y]=local(e), h=SS.hits.slice().reverse().find(q=>Math.hypot(q.x-x,q.y-y)<=q.r);
  const hov=!h && !SS.on && !SS.lobby && !SS.read && !SS.down; if (hov!==!!SS.hov){ SS.hov=hov; $("ssBig").hidden=!hov; }   /* paused: the play button shows in the middle */
  if (!h){ $("ssTip").hidden=true; mapCanvas.style.cursor=hov ? "pointer" : ""; return; }
  ssTipFor(h,x,y); mapCanvas.style.cursor = h.kb ? "pointer" : "";
});
/* while it plays the controls hide; the pointer near the bottom of the screen brings them back and holds them */
addEventListener("pointermove",e=>{ if (SS.s && SS.on && e.pointerType!=="touch" && e.clientY>innerHeight-130) ssWake(); },true);
mapCanvas.addEventListener("pointerleave",()=>{ if ($("ssTip")) $("ssTip").hidden=true; if ($("ssBig")){ SS.hov=false; $("ssBig").hidden=true; } });
addEventListener("keydown",e=>{
  if (!SS.s || e.metaKey || e.ctrlKey || e.altKey) return;
  const t=e.target; if (t && (t.matches("input,textarea,select") || t.isContentEditable)) return;
  if (e.key==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); if (SS.read) ssReadOff(), ssCtrlDraw(); else ssClose(); return; }
  if (e.key===" "){ e.preventDefault(); e.stopImmediatePropagation(); ssToggle(); return; }
  if (e.key==="ArrowLeft"||e.key==="ArrowRight"){ e.preventDefault(); e.stopImmediatePropagation(); ssStep(e.key==="ArrowRight"?1:-1); }
},true);
/* in the film the panel is a drawer: its fold button closes it */
document.addEventListener("click",e=>{
  if (!SS.s || !SS.read || !e.target.closest || !e.target.closest("#sideFold")) return;
  e.preventDefault(); e.stopImmediatePropagation(); ssReadOff(); ssCtrlDraw();
},true);
addEventListener("resize",()=>{ if (SS.s && !SS.on) requestAnimationFrame(()=>ssAt(SS.T)); });
/* the Library lists them first */
function ssLibrary(sec){
  const list=SSL().filter(s=>!s.draft); if (!list.length) return;   /* a draft (draft: true) is not listed: it opens only by its link, ss=<id> */
  const S=sec("super","Super-stories",list.length);
  S.append(el("p","spint","A film on the map: armies, lands and the people who led them, with captions. Pause any time and click what is on the map."));
  for (const s of list){ const b=el("button","sitem ssitem"), t=el("b",null,s.title); b.type="button";
    /* how long it plays, beside its name */
    let mins=0; try { mins=Math.max(1,Math.round(ssTimeline(s).total/60)); } catch(e){}
    if (mins){ const d=el("i","ssdur",mins+" min"); d.title="Plays for about "+mins+" minutes"; t.append(d); }
    b.append(t, el("span",null,s.sub||"")); b.addEventListener("click",()=>ssOpen(s)); S.append(b); }
}
/* a link with ss=<id> opens it */
if (Q.get("ss")){ const id=Q.get("ss"), s=SSL().find(x=>x.id===id);
  if (s) setTimeout(()=>ssOpen(s),400);
  else if (id==="demo"){ const sc=document.createElement("script"); sc.src="super/_demo.js"; sc.onload=()=>{ const d=SSL().find(x=>x.id==="demo"); if (d) setTimeout(()=>ssOpen(d),400); }; document.head.append(sc); }   /* a stand-in for trying the player locally; _ files are not deployed */
}
