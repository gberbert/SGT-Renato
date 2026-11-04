#!/usr/bin/env python3
"""Patch DemandaDetailsModal.jsx: add Esforco fields to Plano de Teste tab"""
import os, subprocess, sys

fpath = os.path.join(os.getcwd(), 'src', 'components', 'operacao', 'DemandaDetailsModal.jsx')
content = open(fpath, encoding='utf-8').read()
print('File:', len(content), 'chars')
print('ptEsforcoPorCenario already:', 'ptEsforcoPorCenario' in content)

if 'ptEsforcoPorCenario' in content:
    print('Already patched')
    sys.exit(0)

# 1. savePT: add ptEsforcoPorCenario  (4-space indent closing brace)
import re
m = re.search(r'(        ptObservacao: localPT\.ptObservacao \?\? null,\s*\n)(\s*\};)', content)
if m:
    content = content.replace(
        m.group(0),
        m.group(1) + '        ptEsforcoPorCenario: localPT.ptEsforcoPorCenario ?? null,\n' + m.group(2),
        1
    )
    print('savePT OK')
else:
    print('savePT NOT FOUND')
    sys.exit(1)

# 2. UI block before save button
LF = '\n'
S12 = ' ' * 12
S14 = ' ' * 14
S16 = ' ' * 16
S18 = ' ' * 18
S20 = ' ' * 20

SAVE_BTN = (
    S12 + "<div style={{ display: 'flex', justifyContent: 'flex-end' }}>" + LF
    + S14 + '<button' + LF
    + S16 + 'onClick={savePT}'
)

BLOCK = (
    S12 + '{/* Estimativa de Esfor\u00e7o */}' + LF
    + S12 + '{(() => {' + LF
    + S14 + 'const total=(Number(localPT.ptAprovados)||0)+(Number(localPT.ptReprovados)||0)'
    + '+(Number(localPT.ptBloqueados)||0)+(Number(localPT.ptAtencao)||0)'
    + '+(Number(localPT.ptNaoAplicavel)||0)+(Number(localPT.ptNaoExecutado)||0);' + LF
    + S14 + 'const esf=Number(localPT.ptEsforcoPorCenario)||0;' + LF
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
    + ' value={localPT.ptEsforcoPorCenario??""}'
    + ' onChange={e=>setLocalPT(p=>({...p,ptEsforcoPorCenario:e.target.value===""?null:Number(e.target.value)}))}'
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
    + S12 + '})()}'+LF+LF
)

if SAVE_BTN in content:
    content = content.replace(SAVE_BTN, BLOCK + SAVE_BTN, 1)
    print('UI OK')
else:
    print('SAVE_BTN NOT FOUND')
    sys.exit(1)

open(fpath, 'w', encoding='utf-8').write(content)
print('ptEsforcoPorCenario in file:', 'ptEsforcoPorCenario' in content)

# Stage immediately
subprocess.run(['git', 'add', fpath])
staged = subprocess.run(['git', 'show', ':' + fpath], capture_output=True)
print('Staged OK:', b'ptEsforcoPorCenario' in staged.stdout)
