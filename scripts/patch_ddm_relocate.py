#!/usr/bin/env python3
"""Relocate Estimativa: remove from before save btn, insert side-by-side with Casos de Teste"""
import subprocess, sys

fpath = 'src/components/operacao/DemandaDetailsModal.jsx'

r = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = r.stdout.decode('utf-8')
print('size:', len(c))

# Check if already relocated (Estimativa right after total card)
if '{/* Estimativa de Esfor' in c:
    idx_esf = c.find('{/* Estimativa de Esfor')
    idx_casos = c.find('Casos de Teste (total)')
    if abs(idx_esf - idx_casos) < 600:
        print('Already in correct position')
        sys.exit(0)
    print('Estimativa at wrong position - relocating...')
else:
    print('No Estimativa found')
    sys.exit(1)

# ── 1. Remove existing Estimativa block ──────────────────────────────────
# It's between Cancelar button and Save button
REMOVE_START = '\n            {/* Estimativa de Esfor'
REMOVE_END = '})()}\n\n            <button'

start_idx = c.find(REMOVE_START)
if start_idx < 0:
    print('REMOVE_START not found')
    sys.exit(1)

end_idx = c.find(REMOVE_END, start_idx)
if end_idx < 0:
    print('REMOVE_END not found')
    sys.exit(1)

# Remove the block (keep the \n\n before <button)
c = c[:start_idx] + c[end_idx + len('})()}\n\n'):]
print('Removed Estimativa from save area')

# ── 2. Insert side-by-side with Casos de Teste card ──────────────────────
# Find the total card block
TOTAL_CARD_PATTERN = (
    "                    {/* Total \u2014 read-only, auto-sum */}\n"
    "                    <div style={{ ...fieldStyle, border: '1px solid rgba(99,102,241,.35)', background: 'rgba(99,102,241,.07)', marginBottom: 8 }}>\n"
    "                      <span style={{ ...labelStyle, color: '#a5b4fc' }}>Casos de Teste (total)</span>\n"
    "                      <span style={{ fontSize: 28, fontWeight: 800, color: '#a5b4fc' }}>{totalCasos}</span>\n"
    "                    </div>\n"
    "\n"
    "                    {/* Progresso"
)

if TOTAL_CARD_PATTERN not in c:
    print('TOTAL_CARD_PATTERN not found - checking...')
    idx2 = c.find('Casos de Teste (total)')
    print(repr(c[max(0,idx2-200):idx2+300]))
    sys.exit(1)

REPLACEMENT = (
    "                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>\n"
    "                    {/* Total \u2014 read-only, auto-sum */}\n"
    "                    <div style={{ ...fieldStyle, border: '1px solid rgba(99,102,241,.35)', background: 'rgba(99,102,241,.07)', flex: '0 0 auto', marginBottom: 0 }}>\n"
    "                      <span style={{ ...labelStyle, color: '#a5b4fc' }}>Casos de Teste (total)</span>\n"
    "                      <span style={{ fontSize: 28, fontWeight: 800, color: '#a5b4fc' }}>{totalCasos}</span>\n"
    "                    </div>\n"
    "                    {/* Estimativa de Esfor\u00e7o */}\n"
    "                    {(() => {\n"
    "                      const esf = Number(pendingChanges?.ptEsforcoPorCenario ?? ticket.ptEsforcoPorCenario ?? 0);\n"
    "                      const tot = totalCasos * esf;\n"
    "                      const d = tot > 0 ? (tot / 8) : 0;\n"
    "                      const f = v => v % 1 === 0 ? v : v.toFixed(1);\n"
    "                      return (\n"
    "                        <div style={{ flex: 1, border: '1px solid rgba(99,102,241,.35)',\n"
    "                          background: 'rgba(99,102,241,.05)', borderRadius: 8, padding: '10px 14px' }}>\n"
    "                          <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc',\n"
    "                            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>\n"
    "                            Estimativa de Esfor\u00e7o\n"
    "                          </div>\n"
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
    "                            <div style={{ padding: '5px 10px', borderRadius: 8,\n"
    "                              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>\n"
    "                              <div style={{ fontSize: 18, fontWeight: 900, color: '#6366f1' }}>{f(tot)}</div>\n"
    "                              <div style={{ fontSize: 8, color: 'var(--gray-9)' }}>Total (h)</div>\n"
    "                              <div style={{ fontSize: 7, color: 'var(--gray-8)' }}>{totalCasos}\u00d7{esf}h</div>\n"
    "                            </div>\n"
    "                            <div style={{ padding: '5px 10px', borderRadius: 8,\n"
    "                              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>\n"
    "                              <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{f(d)}</div>\n"
    "                              <div style={{ fontSize: 8, color: 'var(--gray-9)' }}>Dias</div>\n"
    "                              <div style={{ fontSize: 7, color: 'var(--gray-8)' }}>{f(tot)}h\u00f78</div>\n"
    "                            </div>\n"
    "                          </div>\n"
    "                          <div style={{ fontSize: 8, color: 'var(--gray-8)', fontStyle: 'italic' }}>\n"
    "                            Total=Casos\u00d7h/cen\u00e1rio \u00b7 Dias=Total\u00f78\n"
    "                          </div>\n"
    "                        </div>\n"
    "                      );\n"
    "                    })()}\n"
    "                    </div>\n"
    "\n"
    "                    {/* Progresso"
)

c = c.replace(TOTAL_CARD_PATTERN, REPLACEMENT, 1)
print('Inserted Estimativa next to Casos de Teste:', 'ptEsforcoPorCenario' in c)

# ── Write + stage ─────────────────────────────────────────────────────────
open(fpath, 'w', encoding='utf-8').write(c)
subprocess.run(['git', 'add', fpath])
staged = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('Staged OK:', b'ptEsforcoPorCenario' in staged.stdout)
