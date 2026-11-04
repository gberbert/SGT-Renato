#!/usr/bin/env python3
"""Patch DemandaDetailsModal.jsx using git HEAD blob as source"""
import os, subprocess, sys, re

fpath = 'src/components/operacao/DemandaDetailsModal.jsx'

# Read from git HEAD blob (stable, not affected by VS Code reformatting)
result = subprocess.run(['git', 'show', f'HEAD:{fpath}'], capture_output=True)
c = result.stdout.decode('utf-8')
print('git blob size:', len(c))
print('ptEsforcoPorCenario already:', 'ptEsforcoPorCenario' in c)

if 'ptEsforcoPorCenario' in c:
    print('Already patched in HEAD')
    sys.exit(0)

# 1. Add ptEsforcoPorCenario to handleSave ptData
# Pattern: find the last field in ptData object (before closing };)
# The fields use pendingChanges?.ptXxx pattern
m = re.search(r'([ \t]*ptNaoExecutado:[^\n]+\n)([ \t]*\};)', c)
if m:
    c = c.replace(m.group(0),
        m.group(1) +
        '        ptEsforcoPorCenario: pendingChanges?.ptEsforcoPorCenario ?? null,\n' +
        m.group(2), 1)
    print('handleSave ptData: ptEsforcoPorCenario added')
else:
    # Try alternative: find ptObservacao or any last pt field
    m2 = re.search(r'([ \t]*pt\w+:[^\n]+\n)([ \t]*\};)', c)
    if m2:
        c = c.replace(m2.group(0),
            m2.group(1) +
            '        ptEsforcoPorCenario: pendingChanges?.ptEsforcoPorCenario ?? null,\n' +
            m2.group(2), 1)
        print('handleSave ptData: added via fallback')
    else:
        print('handleSave pattern NOT FOUND')

# 2. Find pendingChanges setter for ptNaoExecutado to understand input pattern
idx_input = c.find('ptNaoExecutado')
print('ptNaoExecutado at:', idx_input)

# 3. Find save button: onClick={handleSave}
idx_save = c.find('onClick={handleSave}')
print('save btn at:', idx_save)

# 4. Find the flex div wrapping the save button
save_ctx = c[max(0, idx_save-300):idx_save+50]
print('save ctx:', repr(save_ctx[-150:]))

# 5. Insert UI block before save button wrapper
# Find the div wrapping the save button
m_btn = re.search(r'(\n[ \t]+<div[^>]*flex[^>]*>[^\n]*\n[ \t]+<button[^\n]*\n[ \t]+onClick=\{handleSave\})', c)
if m_btn:
    insert_pos = m_btn.start()
    LF = '\n'
    S12 = ' ' * 12
    S14 = ' ' * 14
    S16 = ' ' * 16
    S18 = ' ' * 18
    S20 = ' ' * 20

    BLOCK = (LF + S12 + '{/* Estimativa de Esfor\u00e7o */}' + LF
        + S12 + '{(() => {' + LF
        + S14 + 'const total=(Number(pendingChanges?.ptAprovados??ticket.ptAprovados??0))'
        + '+(Number(pendingChanges?.ptReprovados??ticket.ptReprovados??0))'
        + '+(Number(pendingChanges?.ptBloqueados??ticket.ptBloqueados??0))'
        + '+(Number(pendingChanges?.ptAtencao??ticket.ptAtencao??0))'
        + '+(Number(pendingChanges?.ptNaoAplicavel??ticket.ptNaoAplicavel??0))'
        + '+(Number(pendingChanges?.ptNaoExecutado??ticket.ptNaoExecutado??0));' + LF
        + S14 + 'const esf=Number(pendingChanges?.ptEsforcoPorCenario??ticket.ptEsforcoPorCenario??0);' + LF
        + S14 + 'const tot=total*esf; const d=tot>0?(tot/8):0; const f=v=>v%1===0?v:v.toFixed(1);' + LF
        + S14 + 'return (' + LF
        + S16 + '<div style={{marginBottom:16,padding:14,borderRadius:10,'
        + 'background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.25)"}}>'+LF
        + S18 + '<div style={{fontSize:12,fontWeight:700,color:"var(--indigo-11)",'
        + 'marginBottom:10,textTransform:"uppercase"}}>Estimativa de Esfor\u00e7o</div>'+LF
        + S18 + '<div style={{marginBottom:12}}>'+LF
        + S20 + '<label style={{fontSize:11,fontWeight:600,color:"var(--gray-9)",'
        + 'display:"block",marginBottom:4}}>Esfor\u00e7o (h) por cen\u00e1rio</label>'+LF
        + S20 + '<input type="number" min="0" step="0.5"'
        + ' value={pendingChanges?.ptEsforcoPorCenario??ticket.ptEsforcoPorCenario??""}'
        + ' onChange={e=>setPendingChanges(p=>({...p,ptEsforcoPorCenario:e.target.value===""?null:Number(e.target.value)}))}'
        + ' style={{width:130,padding:"6px 8px",borderRadius:6,'
        + 'border:"1px solid rgba(99,102,241,0.4)",'
        + 'background:"var(--gray-1)",color:"var(--gray-12)",fontSize:13}}'
        + ' placeholder="0" />'+LF
        + S18 + '</div>'+LF
        + S18 + '<div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:8}}>'+LF
        + S20 + '<div style={{padding:"8px 14px",borderRadius:8,'
        + 'background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.3)",minWidth:130}}>'+LF
        + S20 + '<div style={{fontSize:22,fontWeight:900,color:"#6366f1",lineHeight:1}}>{f(tot)}</div>'+LF
        + S20 + '<div style={{fontSize:10,fontWeight:700,color:"var(--gray-9)",marginTop:4}}>Esfor\u00e7o Total (h)</div>'+LF
        + S20 + '<div style={{fontSize:9,color:"var(--gray-8)",marginTop:2}}>{total} casos \u00d7 {esf}h</div>'+LF
        + S20 + '</div>'+LF
        + S20 + '<div style={{padding:"8px 14px",borderRadius:8,'
        + 'background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",minWidth:110}}>'+LF
        + S20 + '<div style={{fontSize:22,fontWeight:900,color:"#10b981",lineHeight:1}}>{f(d)}</div>'+LF
        + S20 + '<div style={{fontSize:10,fontWeight:700,color:"var(--gray-9)",marginTop:4}}>Dias</div>'+LF
        + S20 + '<div style={{fontSize:9,color:"var(--gray-8)",marginTop:2}}>{f(tot)}h \u00f7 8h/dia</div>'+LF
        + S20 + '</div>'+LF
        + S18 + '</div>'+LF
        + S18 + '<div style={{fontSize:10,color:"var(--gray-8)",fontStyle:"italic"}}>'
        + 'F\u00f3rmulas: Esfor\u00e7o Total = Casos \u00d7 Esfor\u00e7o/cen\u00e1rio \u00b7 Dias = Esfor\u00e7o Total \u00f7 8'
        + '</div>'+LF
        + S16 + '</div>'+LF
        + S14 + ');'+LF
        + S12 + '})()}'+LF)

    c = c[:insert_pos] + BLOCK + c[insert_pos:]
    print('UI block inserted')
else:
    # Simpler: just insert before the save button div
    SIMPLE_MARKER = '            <div style={{ display: \'flex\', justifyContent: \'flex-end\' }}>'
    if SIMPLE_MARKER in c:
        # Find the one near the save button
        btn_area = c[max(0, idx_save-500):idx_save+10]
        local_idx = btn_area.rfind('<div style={{ display: \'flex\', justifyContent: \'flex-end\' }}>')
        if local_idx >= 0:
            abs_idx = max(0, idx_save-500) + local_idx
            c = c[:abs_idx] + LF + '            {/* TODO: Estimativa de Esforco placeholder */}' + LF + c[abs_idx:]
            print('Simple placeholder inserted')
    print('SAVE_BTN regex NOT FOUND - check save_ctx above')

# Write patched content
open(fpath, 'w', encoding='utf-8').write(c)
print('ptEsforcoPorCenario in file:', 'ptEsforcoPorCenario' in c)

# Stage immediately
subprocess.run(['git', 'add', fpath])
staged = subprocess.run(['git', 'show', f':{fpath}'], capture_output=True)
print('Staged OK:', b'ptEsforcoPorCenario' in staged.stdout)
