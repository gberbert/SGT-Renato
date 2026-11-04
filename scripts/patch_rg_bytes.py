#!/usr/bin/env python3
"""Bytes-level patch: add dcFrom badge to RoadmapGeral date cells."""
import subprocess, sys

fpath = 'src/components/RoadmapGeral.jsx'
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
raw = r.stdout
print('size:', len(raw), '| dcFrom:', b'dcFrom' in raw)

if b'dcFrom' in raw:
    print('Already done'); sys.exit(0)

pat = b'formatShortDate(t[col.key])'
idx = raw.find(pat)
print('idx:', idx)
if idx < 0:
    print('NOT FOUND'); sys.exit(1)

s = raw.rfind(b'{', 0, idx)
e = raw.find(b'}', idx) + 1
ex = raw[s:e]
print('exact:', ex)

badge = (b'{col.dcFrom && t[col.key] && t[col.dcFrom] && '
         b'(<div style={{fontSize:9,color:"#9ca3af",marginBottom:2}}>'
         b'{Math.round((new Date(t[col.key])-new Date(t[col.dcFrom]))/86400000)}dc'
         b'</div>)}')
new_raw = raw[:s] + badge + b'\n' + b' ' * 18 + ex + raw[e:]

open(fpath, 'wb').write(new_raw)
subprocess.run(['git', 'add', fpath])
r2 = subprocess.run(['git', 'commit', '-m', 'RoadmapGeral: dc badge INICIO Homolog'],
                    capture_output=True, text=True)
print(r2.stdout.strip()[:80])
r3 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('Committed dcFrom:', b'dcFrom' in r3.stdout)
