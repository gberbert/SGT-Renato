#!/usr/bin/env python3
import subprocess, sys

fpath = 'src/components/operacao/DemandaDetailsModal.jsx'
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
EXACT = 'fieldKey="dataInicioHomologacao"'
print('size:', len(c), '| exact:', EXACT in c)
if EXACT in c:
    print('Already patched'); sys.exit(0)

OLD = ('              />\n'
       '              <PlanRow\n'
       '                left={<ReadField label="DATA INICIO HML PLAN"')
NEW = ('              />\n'
       '              <PlanRow\n'
       '                left={<ReadField label="DATA IN\u00cdCIO HOMOLOGA\u00c7\u00c3O" value={fmtDate(ticket.dataInicioHomologacao)} />}\n'
       '                right={\n'
       '                  isEdit ? (\n'
       '                    <EditDate label="DATA IN\u00cdCIO HOMOLOGA\u00c7\u00c3O" fieldKey="dataInicioHomologacao" value={ticket.dataInicioHomologacao} onSave={save} />\n'
       '                  ) : (\n'
       '                    <ReadField label="DATA IN\u00cdCIO HOMOLOGA\u00c7\u00c3O" value={fmtDate(ticket.dataInicioHomologacao)} />\n'
       '                  )\n'
       '                }\n'
       '              />\n'
       '              <PlanRow\n'
       '                left={<ReadField label="DATA INICIO HML PLAN"')

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print('inserted, exact count:', c.count(EXACT))
else:
    print('OLD NOT FOUND'); sys.exit(1)

open(fpath, 'w', encoding='utf-8').write(c)
subprocess.run(['git', 'add', fpath])
r2 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('Staged exact:', EXACT.encode() in r2.stdout)
