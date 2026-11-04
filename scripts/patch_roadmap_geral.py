#!/usr/bin/env python3
"""Patch RoadmapGeral: add dataInicioHomologacao col, 0% gray, situ —, dc badge"""
import subprocess, sys

fpath = 'src/components/RoadmapGeral.jsx'
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c))

mods = 0

# 1. Add dataInicioHomologacao before dataFimHomologacao in DATE_RANGE_COLS
OLD1 = "  { key: 'dataFimHomologacao',        label: 'FIM',       sub: 'Homolog',  width: 90, type: 'date' },"
NEW1 = ("  { key: 'dataInicioHomologacao',     label: 'INICIO',    sub: 'Homolog',  width: 90, type: 'date', dcFrom: 'dataFimTesteQa' },\n"
        "  { key: 'dataFimHomologacao',        label: 'FIM',       sub: 'Homolog',  width: 90, type: 'date' },")
if OLD1 in c and 'dataInicioHomologacao' not in c:
    c = c.replace(OLD1, NEW1, 1); mods += 1; print('col OK')
elif 'dataInicioHomologacao' in c:
    print('col already added')
else:
    print('col NOT FOUND')

# 2. Date cell - add dcFrom badge
OLD2 = "{t[col.key] ? fmtDate(t[col.key]) : '\u2014'}"
NEW2 = ("{col.dcFrom && t[col.key] && t[col.dcFrom] && "
        "(<div style={{fontSize:9,color:'#9ca3af',marginBottom:2}}>"
        "{Math.round((new Date(t[col.key])-new Date(t[col.dcFrom]))/86400000)}dc"
        "</div>)}\n"
        "                  {t[col.key] ? fmtDate(t[col.key]) : '\u2014'}")
if OLD2 in c and 'dcFrom' not in c:
    c = c.replace(OLD2, NEW2, 1); mods += 1; print('date OK')
elif 'dcFrom' in c:
    print('date already added')
else:
    print('date NOT FOUND')

# 3. PCT empty -> 0% gray
OLD3 = "{t[col.key] != null ? `${t[col.key]}%` : ''}"
NEW3 = "{t[col.key] != null ? `${t[col.key]}%` : <span style={{color:'#9ca3af'}}>0%</span>}"
if OLD3 in c and '0%' not in c:
    c = c.replace(OLD3, NEW3, 1); mods += 1; print('pct OK')
elif '0%' in c:
    print('pct already added')
else:
    print('pct NOT FOUND')

# 4. SITU empty -> —
OLD4 = "{t[SITU_COL.key] || ''}"
NEW4 = "{t[SITU_COL.key] || '\u2014'}"
if OLD4 in c:
    c = c.replace(OLD4, NEW4, 1); mods += 1; print('situ OK')
else:
    print('situ NOT FOUND, checking...')
    idx = c.find('SITU_COL.key')
    print(repr(c[max(0,idx-50):idx+100]))

open(fpath, 'w', encoding='utf-8').write(c)
subprocess.run(['git', 'add', fpath])
r2 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('mods:', mods)
print('dataInicioHom staged:', b'dataInicioHomologacao' in r2.stdout)
print('situ staged:', 'SITU_COL.key' in r2.stdout.decode())
