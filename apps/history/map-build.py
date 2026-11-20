"""Simplify the historical-basemaps snapshots and pack them small for the World History map.

Output (one file per snapshot, plus land.json):
  {"y": year, "f": [[name, precision, region, ringsDelta, subjectTo?], ...]}
  coordinates: lon/lat * 10 as ints, each ring delta-encoded [x0,y0,dx1,dy1,...]
"""
import json, os, subprocess, sys

S = os.path.dirname(os.path.abspath(__file__))
MS = os.path.join(S, '..', 'node_modules', '.bin', 'mapshaper')
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
SNAPS = ["bc3000","bc2000","bc1500","bc1000","bc700","bc500","bc400","bc323","bc300","bc200","bc100","bc1",
         "100","200","300","400","500","600","700","800","900","1000","1100","1200","1279","1300","1400","1492",
         "1500","1530","1600","1650","1700","1715","1783","1800","1815","1880","1900","1914","1920","1930","1938",
         "1945","1960","1994","2010"]
Q = 10

def region(name, x, y):
    n = (name or '').lower()
    if 'russia' in n or 'muscov' in n or 'novgorod' in n or 'soviet' in n or n == 'ussr': return 'eu'
    if any(k in n for k in ('fiji','tonga','samoa','kiribati','tuvalu','polynesia','vanuatu','solomon','maori','hawai')): return 'se'
    if x < -130 and y < 30: return 'se'          # Polynesia, Hawaii
    if x < -30: return 'am'
    if y < -50: return None                      # Antarctica
    if x >= 100 and y < 22 or x >= 110 and y < 0 or x > 150: return 'se'
    if 92 <= x < 100 and y < 22: return 'se'
    # Central and Inner Asia
    if (y >= 35 and 50 <= x < 75) or (y >= 40 and 75 <= x <= 120 and not (x >= 105 and y < 42)) \
       or (y >= 28.5 and 78 <= x < 100) or (60 <= x < 75 and y >= 32) or (y >= 50 and x >= 60 and x < 140):
        return 'ca'
    if x >= 100: return 'ea'
    if 60 <= x < 92 and y < 32: return 'sa'
    # West: Europe, North Africa and West Asia, Sub-Saharan Africa
    if y < 12 and x < 60: return 'af'
    if 12 <= y < 17 and x < 40: return 'af'
    if y >= 36 and x < 26: return 'eu'
    if y >= 42 and x < 50: return 'eu'
    if y >= 50 and x < 60: return 'eu'
    return 'me'

def pack_rings(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    out = []
    for poly in polys:
        for ring in poly:
            pts = []
            px = py = 0
            first = True
            for lon, lat in ring:
                x, y = round(lon * Q), round(lat * Q)
                if first:
                    pts += [x, y]; first = False
                else:
                    dx, dy = x - px, y - py
                    if dx == 0 and dy == 0: continue
                    pts += [dx, dy]
                px, py = x, y
            if len(pts) >= 6: out.append(pts)
    return out

def run(src, dst, pct):
    subprocess.run([MS, '-i', src, '-simplify', pct, 'keep-shapes', '-filter-slivers',
                    '-each', 'cx=this.centroidX,cy=this.centroidY', '-o', dst, 'precision=0.1', 'format=geojson'],
                   check=True, capture_output=True)

total = 0
for sn in SNAPS:
    year = -int(sn[2:]) if sn.startswith('bc') else int(sn)
    tmp = os.path.join(S, 'simp', sn + '.json')
    run(os.path.join(S, 'raw', 'world_%s.geojson' % sn), tmp, '6%')
    g = json.load(open(tmp))
    feats = []
    for f in g['features']:
        p = f['properties']; name = p.get('NAME')
        if not name or not f.get('geometry'): continue
        r = region(name, p.get('cx') or 0, p.get('cy') or 0)
        if r is None: continue
        rings = pack_rings(f['geometry'])
        if not rings: continue
        row = [name, p.get('BORDERPRECISION') or 1, r, rings]
        sub = p.get('SUBJECTO')
        if sub and sub != name: row.append(sub)
        feats.append(row)
    fn = os.path.join(OUT, 'w%s.json' % year)
    json.dump({'y': year, 'f': feats}, open(fn, 'w'), separators=(',', ':'), ensure_ascii=False)
    total += os.path.getsize(fn)
    print(sn, len(feats), os.path.getsize(fn))

# land outline (Natural Earth via world-atlas, public domain)
tmp = os.path.join(S, 'simp', 'land.json')
subprocess.run([MS, '-i', os.path.join(S, '..', 'node_modules', 'world-atlas', 'land-50m.json'), '-simplify', '12%', 'keep-shapes',
                '-o', tmp, 'precision=0.1', 'format=geojson'], check=True, capture_output=True)
g = json.load(open(tmp))
rings = []
for f in g.get('features', [{'geometry': x} for x in g.get('geometries', [])]):
    rings += pack_rings(f['geometry'])
# drop Antarctica
rings = [r for r in rings if r[1] > -600]
json.dump({'rings': rings}, open(os.path.join(OUT, 'land.json'), 'w'), separators=(',', ':'))
total += os.path.getsize(os.path.join(OUT, 'land.json'))
print('land', os.path.getsize(os.path.join(OUT, 'land.json')), 'total', total)
json.dump([(-int(s[2:]) if s.startswith('bc') else int(s)) for s in SNAPS], sys.stdout)
