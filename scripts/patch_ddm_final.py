#!/usr/bin/env python3
"""Patch DemandaDetailsModal: add Esforco UI before save button (no ptData patch needed)"""
import subprocess, sys

fpath = 'src/components/operacao/DemandaDetailsModal.jsx'

# Read from git HEAD (immune to VS Code reformatting)
r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c), '| already:', 'ptEsforcoPorCenario' in c)

if 'ptEsforcoPorCenario' in c:
    print('Already patched')
    sys.exit(0)

# handleSave uses setDoc with {... pendingChanges} so no explicit field needed.
# Just add the UI input that sets pendingChanges.ptEsforcoPorCenario.

# ── Insert UI before save button ──────────────────────────────────────────
SAVE_BTN = ('            <button\n'
            '              type="button"\n'
            '              onClick={handleSave}')

BLOCK = (
    '            {/* Estimativa de Esfor\u00e7o */}\n'
    '            {(() => {\n'
    '              const t =\n'
    '                (Number(pendingChanges?.ptAprovados   ?? ticket.ptAprovados   ?? 0))\n'
    '               +(Number(pendingChanges?.ptReprovados  ?? ticket.ptReprovados  ?? 0))\n'
    '               +(Number(pendingChanges?.ptBloqueados  ?? ticket.ptBloqueados  ?? 0))\n'
    '               +(Number(pendingChanges?.ptAtencao     ?? ticket.ptAtencao     ?? 0))\n'
    '               +(Number(pendingChanges?.ptNaoAplicavel  ?? ticket.ptNaoAplicavel  ?? 0))\n'
    '               +(Number(pendingChanges?.ptNaoExecutado  ?? ticket.ptNaoExecutado  ?? 0));\n'
    '              const esf = Number(pendingChanges?.ptEsforcoPorCenario ?? ticket.ptEsforcoPorCenario ?? 0);\n'
    '              const tot = t * esf;\n'
    '              const d = tot > 0 ? (tot / 8) : 0;\n'
    '              const f = v => v % 1 === 0 ? v : v.toFixed(1);\n'
    '              return (\n'
    '                <div style={{ marginBottom: 16, padding: 14, borderRadius: 10,\n'
    "                  background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)' }}>\n"
    '                  <div style={{ fontSize: 12, fontWeight: 700, color: \'var(--indigo-11)\',\n'
    '                    marginBottom: 10, textTransform: \'uppercase\' }}>Estimativa de Esfor\u00e7o</div>\n'
    '                  <div style={{ marginBottom: 12 }}>\n'
    '                    <label style={{ fontSize: 11, fontWeight: 600, color: \'var(--gray-9)\',\n'
    '                      display: \'block\', marginBottom: 4 }}>Esfor\u00e7o (h) por cen\u00e1rio</label>\n'
    '                    <input type="number" min="0" step="0.5"\n'
    "                      value={pendingChanges?.ptEsforcoPorCenario ?? ticket.ptEsforcoPorCenario ?? ''}\n"
    '                      onChange={e => setPendingChanges(p => ({ ...p,\n'
    "                        ptEsforcoPorCenario: e.target.value === '' ? null : Number(e.target.value) }))}\n"
    '                      style={{ width: 130, padding: \'6px 8px\', borderRadius: 6,\n'
    "                        border: '1px solid rgba(99,102,241,0.4)',\n"
    "                        background: 'var(--gray-1)', color: 'var(--gray-12)', fontSize: 13 }}\n"
    '                      placeholder="0" />\n'
    '                  </div>\n'
    '                  <div style={{ display: \'flex\', gap: 12, flexWrap: \'wrap\', marginBottom: 8 }}>\n'
    '                    <div style={{ padding: \'8px 14px\', borderRadius: 8,\n'
    "                      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', minWidth: 130 }}>\n"
    '                      <div style={{ fontSize: 22, fontWeight: 900, color: \'#6366f1\', lineHeight: 1 }}>{f(tot)}</div>\n'
    '                      <div style={{ fontSize: 10, fontWeight: 700, color: \'var(--gray-9)\', marginTop: 4 }}>Esfor\u00e7o Total (h)</div>\n'
    '                      <div style={{ fontSize: 9, color: \'var(--gray-8)\', marginTop: 2 }}>{t} casos \u00d7 {esf}h</div>\n'
    '                    </div>\n'
    '                    <div style={{ padding: \'8px 14px\', borderRadius: 8,\n'
    "                      background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', minWidth: 110 }}>\n"
    '                      <div style={{ fontSize: 22, fontWeight: 900, color: \'#10b981\', lineHeight: 1 }}>{f(d)}</div>\n'
    '                      <div style={{ fontSize: 10, fontWeight: 700, color: \'var(--gray-9)\', marginTop: 4 }}>Dias</div>\n'
    '                      <div style={{ fontSize: 9, color: \'var(--gray-8)\', marginTop: 2 }}>{f(tot)}h \u00f7 8h/dia</div>\n'
    '                    </div>\n'
    '                  </div>\n'
    '                  <div style={{ fontSize: 10, color: \'var(--gray-8)\', fontStyle: \'italic\' }}>\n'
    '                    F\u00f3rmulas: Esfor\u00e7o Total = Casos \u00d7 Esfor\u00e7o/cen\u00e1rio \u00b7 Dias = Esfor\u00e7o Total \u00f7 8\n'
    '                  </div>\n'
    '                </div>\n'
    '              );\n'
    '            })()}\n'
    '\n'
)

if SAVE_BTN in c:
    c = c.replace(SAVE_BTN, BLOCK + SAVE_BTN, 1)
    print('UI OK')
else:
    print('SAVE_BTN NOT FOUND')
    sys.exit(1)

# ── Write + stage ─────────────────────────────────────────────────────────
open(fpath, 'w', encoding='utf-8').write(c)
subprocess.run(['git', 'add', fpath])
staged = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('Staged OK:', b'ptEsforcoPorCenario' in staged.stdout)
print('ptEsforcoPorCenario in file:', 'ptEsforcoPorCenario' in c)
