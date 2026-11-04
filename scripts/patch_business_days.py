#!/usr/bin/env python3
"""Add business day counters to DATA FIM HML PLAN and DATA ENTREGA rows"""
import subprocess, sys

fpath = 'src/components/operacao/DemandaDetailsModal.jsx'
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c))

if 'calcBusinessDays' in c or '_bd =' in c:
    print('Already patched')
    sys.exit(0)

# Badge JSX helper (inline IIFE)
def make_badge(d1_expr, d2_expr, label, title):
    return (
        '(() => {\n'
        f'                  const _da = {d1_expr} ? new Date({d1_expr}) : null;\n'
        f'                  const _db = {d2_expr} ? new Date({d2_expr}) : null;\n'
        '                  let _bd = null;\n'
        '                  if (_da && _db && _db > _da) {\n'
        '                    let n = 0, cur = new Date(_da); cur.setDate(cur.getDate()+1);\n'
        '                    while (cur <= _db) { if (cur.getDay()!==0 && cur.getDay()!==6) n++; cur.setDate(cur.getDate()+1); }\n'
        '                    _bd = n;\n'
        '                  }\n'
        '                  return (<div style={{display:"flex",alignItems:"center",gap:6}}>\n'
        f'                    <ReadField label="{label}" value={{fmtDate(ticket.{d2_expr.replace("ticket.","")})}} />\n'
        '                    {_bd!=null && <span title="' + title + '" style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:8,background:"rgba(251,191,36,0.15)",color:"#fbbf24",border:"1px solid rgba(251,191,36,0.35)",whiteSpace:"nowrap"}}>\u23f1 {_bd}du</span>}\n'
        '                  </div>);\n'
        '                })()'
    )

# 1. DATA FIM HML PLAN badge
OLD1 = 'left={<ReadField label="DATA FIM HML PLAN" value={fmtDate(ticket.dataFimHomologacaoPlanejada)} />}'
NEW1 = ('left={' + make_badge(
    'ticket.dataInicioHomologacaoPlanejada',
    'ticket.dataFimHomologacaoPlanejada',
    'DATA FIM HML PLAN',
    'Dias \u00fateis (Fim HML - Ini HML)'
) + '}')

if OLD1 in c:
    c = c.replace(OLD1, NEW1, 1)
    print('FIM HML badge OK')
else:
    print('FIM HML pattern NOT FOUND')
    sys.exit(1)

# 2. DATA ENTREGA EM PRODUCAO badge
OLD2 = 'left={<ReadField label="DATA ENTREGA EM PRODU\u00c7\u00c3O PREVISTA" value={fmtDate(ticket.dataEntregaProducaoPrevista)} />}'
NEW2 = ('left={' + make_badge(
    'ticket.dataFimHomologacaoPlanejada',
    'ticket.dataEntregaProducaoPrevista',
    'DATA ENTREGA EM PRODU\u00c7\u00c3O PREVISTA',
    'Dias \u00fateis (Entrega - Fim HML)'
) + '}')

if OLD2 in c:
    c = c.replace(OLD2, NEW2, 1)
    print('ENTREGA badge OK')
else:
    print('ENTREGA pattern NOT FOUND')
    sys.exit(1)

open(fpath, 'w', encoding='utf-8').write(c)
subprocess.run(['git', 'add', fpath])
r2 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('Staged _bd:', b'_bd =' in r2.stdout)
