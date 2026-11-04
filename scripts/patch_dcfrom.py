#!/usr/bin/env python3
import subprocess, sys

fpath = 'src/components/RoadmapGeral.jsx'
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c), '| dcFrom already:', 'dcFrom' in c)

if 'dcFrom' in c:
    print('Already done')
    sys.exit(0)

OLD = "{t[col.key] ? formatShortDate(t[col.key]) : '-'}"
NEW = ("{col.dcFrom && t[col.key] && t[col.dcFrom] && "
       "(<div style={{fontSize:9,color:'#9ca3af',marginBottom:2}}>"
       "{Math.round((new Date(t[col.key])-new Date(t[col.dcFrom]))/86400000)}dc"
       "</div>)}\n"
       "                  {t[col.key] ? formatShortDate(t[col.key]) : '-'}")

print('OLD found:', OLD in c)
if OLD in c:
    c = c.replace(OLD, NEW, 1)
    open(fpath, 'w', encoding='utf-8').write(c)
    subprocess.run(['git', 'add', fpath])
    r2 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
    print('staged dcFrom:', b'dcFrom' in r2.stdout)
else:
    idx = c.find('formatShortDate')
    print(repr(c[max(0,idx-20):idx+80]))
    sys.exit(1)
