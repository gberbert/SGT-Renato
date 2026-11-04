#!/usr/bin/env python3
"""Add calendar days (dc) badge next to business days (du) badge"""
import subprocess, sys

fpath = 'src/components/operacao/DemandaDetailsModal.jsx'
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c), '| dc already:', 'dc</span>' in c)

if 'dc</span>' in c:
    print('Already has dc badge')
    sys.exit(0)

DC_SPAN = ('<span title="Dias corridos" style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,'
           'background:"rgba(156,163,175,0.15)",color:"#9ca3af",border:"1px solid rgba(156,163,175,0.3)",whiteSpace:"nowrap"}}>'
           '\U0001f4c5 {Math.round((_db-_da)/86400000)}dc</span>')

SEARCH_OPEN1 = '{_bd!=null && <span title="Dias \u00fateis (Fim HML - Ini HML)"'
REPLACE_OPEN1 = '{_bd!=null && <><span title="Dias \u00fateis (Fim HML - Ini HML)"'

SEARCH_OPEN2 = '{_bd!=null && <span title="Dias \u00fateis (Entrega - Fim HML)"'
REPLACE_OPEN2 = '{_bd!=null && <><span title="Dias \u00fateis (Entrega - Fim HML)"'

SEARCH_CLOSE = '\u23f1 {_bd}du</span>}'
REPLACE_CLOSE = '\u23f1 {_bd}du</span>' + DC_SPAN + '</>\n                    }'

ok = 0
if SEARCH_OPEN1 in c:
    c = c.replace(SEARCH_OPEN1, REPLACE_OPEN1, 1); ok += 1; print('open1 OK')
else:
    print('open1 NOT FOUND')

if SEARCH_OPEN2 in c:
    c = c.replace(SEARCH_OPEN2, REPLACE_OPEN2, 1); ok += 1; print('open2 OK')
else:
    print('open2 NOT FOUND')

count = c.count(SEARCH_CLOSE)
print('close count:', count)
for i in range(count):
    c = c.replace(SEARCH_CLOSE, REPLACE_CLOSE, 1); ok += 1; print(f'close{i+1} OK')

open(fpath, 'w', encoding='utf-8').write(c)
subprocess.run(['git', 'add', fpath])
r2 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('Staged dc:', b'dc</span>' in r2.stdout, '| ok:', ok)
