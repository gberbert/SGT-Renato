#!/usr/bin/env python3
import subprocess, sys

fpath = 'src/components/RoadmapGeral.jsx'
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c), '| dcFrom:', 'dcFrom' in c)

if 'dcFrom' in c:
    print('Already done'); sys.exit(0)

idx = c.find('formatShortDate(t[col.key])')
print('formatShortDate idx:', idx)
if idx < 0:
    print('NOT FOUND'); sys.exit(1)

s = c.rfind('{', 0, idx)
e = c.find('}', idx) + 1
exact = c[s:e]
print('exact:', repr(exact))

badge = ('{col.dcFrom && t[col.key] && t[col.dcFrom] && '
         '(<div style={{fontSize:9,color:"#9ca3af",marginBottom:2}}>'
         '{Math.round((new Date(t[col.key])-new Date(t[col.dcFrom]))/86400000)}dc'
         '</div>)}')
new_c = c[:s] + badge + '\n' + ' ' * 18 + exact + c[e:]

open(fpath, 'w', encoding='utf-8').write(new_c)
subprocess.run(['git', 'add', fpath])
r2 = subprocess.run(['git', 'commit', '-m', 'RoadmapGeral: dc badge INICIO Homolog'],
                    capture_output=True, text=True)
print(r2.stdout.strip()[:80])
r3 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('Staged dcFrom:', b'dcFrom' in r3.stdout)
