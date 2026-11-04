#!/usr/bin/env python3
"""Add Esforço fields to Plano de Teste tab in PlanejamentoCiclo.jsx"""
import os, re

fpath = os.path.join(os.getcwd(), 'src', 'components', 'PlanejamentoCiclo.jsx')
content = open(fpath, encoding='utf-8').read()
print('File:', fpath, 'size:', len(content))

# 1. Add ptEsforcoPorCenario to savePT
m1 = re.search(r'(        ptObservacao: localPT\.ptObservacao \?\? null,\n)(      \};)', content)
if m1:
    content = content.replace(
        m1.group(0),
        m1.group(1) + '        ptEsforcoPorCenario: localPT.ptEsforcoPorCenario ?? null,\n' + m1.group(2),
        1
    )
    print('savePT: ptEsforcoPorCenario added')
else:
    # Try alternate pattern
    OLD = "        ptObservacao: localPT.ptObservacao ?? null,\n      };"
    if OLD in content:
        content = content.replace(OLD, OLD.replace(
            "        ptObservacao: localPT.ptObservacao ?? null,",
            "        ptObservacao: localPT.ptObservacao ?? null,\n        ptEsforcoPorCenario: localPT.ptEsforcoPorCenario ?? null,"
        ), 1)
        print('savePT: patched via alternate')
    else:
        print('savePT pattern NOT found')

# 2. Find the Botão Salvar button and insert Estimativa block before it
MARKER = '            {/* Botão Salvar */}'
if MARKER not in content:
    # Find the save button area
    idx = content.find('onClick={savePT}')
    if idx >= 0:
        # Look backwards for the wrapping div
        start = content.rfind('\n', 0, idx-50)
        print('savePT button found at char', idx)
    else:
        print('savePT button NOT found')
    MARKER = None

BLOCK = '''            {/* Estimativa de Esforço */}
            {(() => {
              const total = (Number(localPT.ptAprovados)||0)+(Number(localPT.ptReprovados)||0)+(Number(localPT.ptBloqueados)||0)+(Number(localPT.ptAtencao)||0)+(Number(localPT.ptNaoAplicavel)||0)+(Number(localPT.ptNaoExecutado)||0);
              const esforco = Number(localPT.ptEsforcoPorCenario) || 0;
              const esforcoTotal = total * esforco;
              const dias = esforcoTotal > 0 ? (esforcoTotal / 8) : 0;
              const fmt = v => v % 1 === 0 ? v : v.toFixed(1);
              return (
                <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--indigo-11)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estimativa de Esforço</div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-9)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Esforço (h) por cenário</label>
                    <input
                      type="number" min="0" step="0.5"
                      value={localPT.ptEsforcoPorCenario ?? ''}
                      onChange={e => setLocalPT(prev => ({ ...prev, ptEsforcoPorCenario: e.target.value === '' ? null : Number(e.target.value) }))}
                      style={{ width: 130, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.4)', background: 'var(--gray-1)', color: 'var(--gray-12)', fontSize: 13, fontWeight: 600 }}
                      placeholder="0"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', minWidth: 140 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>{fmt(esforcoTotal)}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-9)', marginTop: 4 }}>Esforço Total (h)</div>
                      <div style={{ fontSize: 9, color: 'var(--gray-8)', marginTop: 2 }}>{total} casos × {esforco}h</div>
                    </div>
                    <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', minWidth: 120 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981', lineHeight: 1 }}>{fmt(dias)}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-9)', marginTop: 4 }}>Dias</div>
                      <div style={{ fontSize: 9, color: 'var(--gray-8)', marginTop: 2 }}>{fmt(esforcoTotal)}h ÷ 8h/dia</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--gray-8)', fontStyle: 'italic' }}>
                    Fórmulas: Esforço Total = Total de Casos × Esforço/cenário · Dias = Esforço Total ÷ 8
                  </div>
                </div>
              );
            })()}

'''

if MARKER and MARKER in content:
    content = content.replace(MARKER, BLOCK + MARKER, 1)
    print('UI block inserted before Botão Salvar')
else:
    # Find by button pattern
    BTN = '              <button\n                onClick={savePT}'
    if BTN in content:
        content = content.replace(BTN, BLOCK + BTN, 1)
        print('UI block inserted before savePT button')
    else:
        print('Could not find insertion point')

open(fpath, 'w', encoding='utf-8').write(content)
print('ptEsforcoPorCenario in file:', 'ptEsforcoPorCenario' in content)
print('Estimativa de Esforco in file:', 'Estimativa de Esfor' in content)
