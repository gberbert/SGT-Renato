#!/usr/bin/env python3
"""Put Estimativa fields inline: [input] [Total(h)] [Dias] in one flex row"""
import subprocess, sys

fpath = 'src/components/operacao/DemandaDetailsModal.jsx'

r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c))

# Check if already done
if 'flex-end' in c and 'ptEsforcoPorCenario' in c:
    idx_fe = c.find('flex-end')
    idx_esf = c.find('ptEsforcoPorCenario')
    if abs(idx_fe - idx_esf) < 400:
        print('Already inline')
        sys.exit(0)

OLD = (
    "                          <div style={{ marginBottom: 8 }}>\n"
    "                            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-9)',\n"
    "                              display: 'block', marginBottom: 4 }}>Esfor\u00e7o (h) / cen\u00e1rio</label>\n"
    "                            <input type=\"number\" min=\"0\" step=\"0.5\"\n"
    "                              value={pendingChanges?.ptEsforcoPorCenario ?? ticket.ptEsforcoPorCenario ?? ''}\n"
    "                              onChange={e => setPendingChanges(p => ({ ...p,\n"
    "                                ptEsforcoPorCenario: e.target.value === '' ? null : Number(e.target.value) }))}\n"
    "                              style={{ width: 100, padding: '4px 8px', borderRadius: 6,\n"
    "                                border: '1px solid rgba(99,102,241,0.4)',\n"
    "                                background: 'var(--gray-1)', color: 'var(--gray-12)', fontSize: 13 }}\n"
    "                              placeholder=\"0\" />\n"
    "                          </div>\n"
    "                          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>\n"
)

NEW = (
    "                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 6 }}>\n"
    "                            <div>\n"
    "                              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-9)',\n"
    "                                display: 'block', marginBottom: 4 }}>Esfor\u00e7o (h) / cen\u00e1rio</label>\n"
    "                              <input type=\"number\" min=\"0\" step=\"0.5\"\n"
    "                                value={pendingChanges?.ptEsforcoPorCenario ?? ticket.ptEsforcoPorCenario ?? ''}\n"
    "                                onChange={e => setPendingChanges(p => ({ ...p,\n"
    "                                  ptEsforcoPorCenario: e.target.value === '' ? null : Number(e.target.value) }))}\n"
    "                                style={{ width: 100, padding: '4px 8px', borderRadius: 6,\n"
    "                                  border: '1px solid rgba(99,102,241,0.4)',\n"
    "                                  background: 'var(--gray-1)', color: 'var(--gray-12)', fontSize: 13 }}\n"
    "                                placeholder=\"0\" />\n"
    "                            </div>\n"
)

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print('Patched OK')
else:
    print('OLD NOT FOUND')
    idx = c.find('marginBottom: 8')
    print(repr(c[max(0,idx-50):idx+150]))
    sys.exit(1)

open(fpath, 'w', encoding='utf-8').write(c)
subprocess.run(['git', 'add', fpath])
r2 = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
ok = b'flex-end' in r2.stdout
print('Staged flex-end:', ok)
