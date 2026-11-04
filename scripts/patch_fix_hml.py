#!/usr/bin/env python3
"""Fix: remove duplicate left label, move DATA INICIO HOMOLOGACAO to right of DATA INICIO HML PLAN row"""
import subprocess, sys

fpath = 'src/components/operacao/DemandaDetailsModal.jsx'
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c))

# Check current state
EXACT = 'fieldKey="dataInicioHomologacao"'
print('fieldKey count:', c.count(EXACT))

# Step 1: Remove the entire new PlanRow that has left=DATA INICIO HOMOLOGACAO + right=EditDate
# Pattern: the new PlanRow from the previous patch
OLD_PLANROW = ('              <PlanRow\n'
               '                left={<ReadField label="DATA IN\u00cdCIO HOMOLOGA\u00c7\u00c3O" value={fmtDate(ticket.dataInicioHomologacao)} />}\n'
               '                right={\n'
               '                  isEdit ? (\n'
               '                    <EditDate label="DATA IN\u00cdCIO HOMOLOGA\u00c7\u00c3O" fieldKey="dataInicioHomologacao" value={ticket.dataInicioHomologacao} onSave={save} />\n'
               '                  ) : (\n'
               '                    <ReadField label="DATA IN\u00cdCIO HOMOLOGA\u00c7\u00c3O" value={fmtDate(ticket.dataInicioHomologacao)} />\n'
               '                  )\n'
               '                }\n'
               '              />\n')

if OLD_PLANROW in c:
    c = c.replace(OLD_PLANROW, '', 1)
    print('removed old PlanRow')
else:
    print('OLD_PLANROW not found')
    sys.exit(1)

# Step 2: Change DATA INICIO HML PLAN row's right from null to the EditDate field
OLD_HML = ('              <PlanRow\n'
           '                left={<ReadField label="DATA INICIO HML PLAN" value={fmtDate(ticket.dataInicioHomologacaoPlanejada)} />}\n'
           '                right={null}\n'
           '              />')

NEW_HML = ('              <PlanRow\n'
           '                left={<ReadField label="DATA INICIO HML PLAN" value={fmtDate(ticket.dataInicioHomologacaoPlanejada)} />}\n'
           '                right={\n'
           '                  isEdit ? (\n'
           '                    <EditDate label="DATA IN\u00cdCIO HOMOLOGA\u00c7\u00c3O" fieldKey="dataInicioHomologacao" value={ticket.dataInicioHomologacao} onSave={save} />\n'
           '                  ) : (\n'
           '                    <ReadField label="DATA IN\u00cdCIO HOMOLOGA\u00c7\u00c3O" value={fmtDate(ticket.dataInicioHomologacao)} />\n'
           '                  )\n'
           '                }\n'
           '              />')

if OLD_HML in c:
    c = c.replace(OLD_HML, NEW_HML, 1)
    print('updated HML PLAN row with right=EditDate')
else:
    print('OLD_HML not found')
    idx = c.find('DATA INICIO HML PLAN')
    print(repr(c[max(0,idx-50):idx+200]))
    sys.exit(1)

open(fpath, 'w', encoding='utf-8').write(c)
subprocess.run(['git', 'add', fpath])
r2 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('final fieldKey count:', r2.stdout.count(b'fieldKey="dataInicioHomologacao"'))
print('Staged:', EXACT.encode() in r2.stdout)
