"""map/names.json: for each territory name and region, the snapshot years whose borders include it.
Lets a click on a territory load only the border files it appears in. Run after map-fill.py."""
import json, glob, os, re
S = os.path.dirname(os.path.abspath(__file__)); out = {}
for p in glob.glob(os.path.join(S, 'map', 'w*.json')):
    m = re.match(r'w(-?\d+)\.json', os.path.basename(p))
    if not m or m.group(1) == '2026': continue
    for f in json.load(open(p))['f']: out.setdefault(f[0] + '|' + f[2], []).append(int(m.group(1)))
for k in out: out[k].sort()
json.dump(out, open(os.path.join(S, 'map', 'names.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), os.path.getsize(os.path.join(S, 'map', 'names.json')))
