"""Fill the unclaimed scraps of land between territories, so the map reads as whole states.

The historical-basemaps borders are coarse: they leave wedges of land between neighbours, strips along coasts,
peninsulas cut off and small islands bare. This gives each such scrap to the nearest territory (split between
neighbours by distance), as an estimate. Large unclaimed lands (steppe, forest, desert) stay empty.

Reads the raw snapshots from _map-raw/ (as map-build.py wrote them) and land.json; writes map/w*.json.
Run: uv run --with shapely python3 map-fill.py
"""
import json, os, glob
from shapely.geometry import Polygon, MultiPoint, Point
from shapely import union_all as unary_union
from shapely import make_valid, voronoi_polygons, STRtree

S = os.path.dirname(os.path.abspath(__file__))
RAW, OUT, Q = os.path.join(S, '_map-raw'), os.path.join(S, 'map'), 10
SMALL = 6.0      # a scrap under this many square degrees is filled whole
THIN = 0.45      # parts of a bigger scrap narrower than about twice this (degrees) are filled
NEAR = 1.6       # an island this close to a territory (degrees) can join it
ISLE = 3.0       # islands up to this size (square degrees)

def rings_of(packed):
    out = []
    for a in packed:
        x = y = 0; pts = []
        for i in range(0, len(a), 2):
            x += a[i]; y += a[i + 1]; pts.append((x / Q, y / Q))
        out.append(pts)
    return out

def evenodd(rings):
    g = None
    for r in rings:
        if len(r) < 3: continue
        p = make_valid(Polygon(r)).buffer(0)
        g = p if g is None else g.symmetric_difference(p)
    return g.buffer(0) if g is not None else None

def pack(geom):
    out = []
    polys = getattr(geom, 'geoms', [geom])
    for poly in polys:
        if poly.geom_type != 'Polygon' or poly.is_empty: continue
        for ring in [poly.exterior, *poly.interiors]:
            pts = []; px = py = 0; first = True
            for lon, lat in ring.coords:
                x, y = round(lon * Q), round(lat * Q)
                if first: pts += [x, y]; first = False
                else:
                    dx, dy = x - px, y - py
                    if dx == 0 and dy == 0: continue
                    pts += [dx, dy]
                px, py = x, y
            if len(pts) >= 6: out.append(pts)
    return out

def clean(g):
    return unary_union(polys(make_valid(g)), grid_size=1e-5).buffer(0) if g is not None else g

def polys(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    return [p for p in getattr(g, 'geoms', []) for p in polys(p)]

def unwrap(r):
    """rings that cross the 180th meridian are unwrapped (longitude past 180), as the app does"""
    out, off, px = [], 0, None
    for x, y in r:
        if px is not None:
            if x - px > 180: off -= 360
            elif px - x > 180: off += 360
        px = x; out.append((x + off, y))
    xs = sorted(v[0] for v in out); med = xs[len(xs) // 2]
    sh = -360 if med > 180 else 360 if med < -180 else 0
    return [(x + sh, y) for x, y in out]

WORLD = Polygon([(-180, -90), (180, -90), (180, 90), (-180, 90)])
def land_poly(r):
    g = make_valid(Polygon(unwrap(r))).buffer(0)
    from shapely.affinity import translate
    return unary_union([g.intersection(WORLD), translate(g, -360).intersection(WORLD), translate(g, 360).intersection(WORLD)])
LAND = unary_union([land_poly(r) for r in rings_of(json.load(open(os.path.join(OUT, 'land.json')))['rings']) if len(r) >= 3])
print('land area', round(LAND.area))

def split(piece, owners, geoms):
    """Give each part of piece to the nearest owner."""
    if len(owners) == 1: return {owners[0]: piece}
    zone = piece.buffer(NEAR + .5)
    pts, tag, seen = [], [], set()
    for o in owners:
        b = geoms[o].boundary.intersection(zone)
        if b.is_empty: continue
        n = max(8, int(b.length / .08))
        for k in range(n):
            q = b.interpolate(k / n, normalized=True); key = (round(q.x, 3), round(q.y, 3))
            if key in seen: continue
            seen.add(key); pts.append(q); tag.append(o)
    if not pts: return {}
    cells = voronoi_polygons(MultiPoint(pts), extend_to=zone, ordered=True)
    acc = {}
    for c, o in zip(cells.geoms, tag):          # convex cells, cut one at a time (unioning them first is fragile)
        try: g = piece.intersection(make_valid(c))
        except Exception: continue
        if not g.is_empty: acc.setdefault(o, []).extend(polys(g))
    out = {}
    for o, gs in acc.items():
        try: out[o] = clean(unary_union(gs, grid_size=1e-4).buffer(1e-4))
        except Exception: out[o] = clean(unary_union([g.buffer(1e-4) for g in gs]))
    return out

def fill_once(d):
    geoms = [clean(evenodd(rings_of(f[3]))) for f in d['f']]
    idx = [i for i, g in enumerate(geoms) if g is not None and not g.is_empty]
    U = unary_union([geoms[i] for i in idx])
    gap = LAND.intersection(U.buffer(NEAR + 1)).difference(U)
    tree = STRtree([geoms[i] for i in idx])
    add = {}
    for piece in polys(gap):
        d0 = piece.distance(U)
        if d0 > .02:                                   # an island of its own
            if piece.area > ISLE or d0 > NEAR: continue
            fill = piece
        elif piece.area <= SMALL:
            fill = piece
        else:                                          # keep the wide core empty, fill the slivers round it
            core = piece.buffer(-THIN).buffer(THIN)
            fill = piece.difference(core.buffer(.05))
            if fill.is_empty: continue
        for part in polys(fill):
            near = [idx[j] for j in tree.query(part.buffer(NEAR + .3))]
            near = [i for i in near if geoms[i].distance(part) < NEAR + .3]
            if not near: continue
            dmin = min(geoms[i].distance(part) for i in near)
            owners = [i for i in near if geoms[i].distance(part) < dmin + .6]
            for o, g in split(part, owners, geoms).items():
                if not g.is_empty: add.setdefault(o, []).append(clean(g.simplify(.01)))
    for o, gs in add.items():
        g = clean(unary_union([clean(geoms[o]), *gs], grid_size=1e-5))
        d['f'][o][3] = pack(g)
    return len(add)

total = 0
for path in sorted(glob.glob(os.path.join(RAW, 'w*.json'))):
    name = os.path.basename(path)
    d = json.load(open(path))
    if name == 'w2026.json':
        json.dump(d, open(os.path.join(OUT, name), 'w'), separators=(',', ':')); continue
    n1 = fill_once(d); n2 = fill_once(d)   # twice: islands near land filled in the first pass join in the second
    total += n1
    json.dump(d, open(os.path.join(OUT, name), 'w'), separators=(',', ':'))
    print(name, 'grew', n1, n2)
print('done', total)
