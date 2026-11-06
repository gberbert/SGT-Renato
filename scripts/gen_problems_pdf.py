import re, os

src_dir = os.path.join(os.path.dirname(__file__), '..', 'src', 'components')
cicloPdfPath = os.path.join(src_dir, 'CicloPdfExport.jsx')
outPath = os.path.join(src_dir, 'ProblemsPdfExport.jsx')

src = open(cicloPdfPath, encoding='utf-8').read()
ntt  = re.search(r"const NTT_LOGO_URL\s*=\s*'(data:image/png;base64,[^']+)'", src).group(1)
cpfl = re.search(r"const CPFL_LOGO_URL\s*=\s*'(data:image/png;base64,[^']+)'", src).group(1)

lines = []
lines.append("import React from 'react';")
lines.append("import ReactDOM from 'react-dom/client';")
lines.append("import html2canvas from 'html2canvas';")
lines.append("import jsPDF from 'jspdf';")
lines.append("")
lines.append("const WF_PROB = ['Aguardando RCA','Aguardando Aprovacao Lider de Torre','Aguardando Aprovacao Ger. Problema','Solucao Rejeitada','Aguardando Planejamento','Aguardando Execucao','Em Execucao','Aguardando Demanda/Projeto','Em Monitoramento','Fechado','Cancelado','RCA em Desenvolvimento','Aguardando Aprovacao Tecnica RCA','Aguardando Aprovacao Governanca RCA','Resolvido','Em Planejamento','Aguardando Aprovacao Tecnica','Aguardando Aprovacao Governanca','Aguardando Demanda'];")
lines.append("")
lines.append("const PAGE_W = 1280;")
lines.append("const TIX_W  = 300;")
lines.append("const SQ_W   = 65;")
lines.append("const PR_W   = 55;")
lines.append("const NI_W   = 100;")
lines.append("const ST_W   = 120;")
lines.append("const FT_W   = 75;")
lines.append("const DIH_W  = 75;")
lines.append("const DH_W   = 75;")
lines.append("const DC_W   = 75;")
lines.append("const IMP_W  = 20;")
lines.append("const ROW_H  = 22;")
lines.append("const CB     = '1px solid #e2e8f0';")
lines.append("const PAGE_H = Math.round((210 / 297) * PAGE_W);")
lines.append("const cellBase = { flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: CB, overflow: 'hidden' };")
lines.append(f"const NTT_LOGO_URL  = '{ntt}';")
lines.append(f"const CPFL_LOGO_URL = '{cpfl}';")
lines.append("")
lines.append(r"""
function sc(s) {
  const l = String(s||'').toLowerCase();
  if (l.includes('fechad')||l.includes('resolv')||l.includes('cancelad')) return '#16a34a';
  if (l.includes('execu')||l.includes('monitoramento')) return '#2563eb';
  if (l.includes('rca')||l.includes('aprovac')) return '#7c3aed';
  if (l.includes('aguard')||l.includes('planejam')) return '#d97706';
  if (l.includes('rejeit')) return '#dc2626';
  return '#6b7280';
}
function pb(v) {
  const p = String(v||'').toLowerCase().trim();
  if (p.includes('crise')||p.includes('critica')) return 'Crise';
  if (p==='alto'||p==='alta') return 'Alto';
  if (p.includes('medio')||p.includes('media')) return 'M\u00e9dio';
  if (p==='baixo'||p==='baixa') return 'Baixo';
  if (p==='muito baixo') return 'M.Baixo';
  return null;
}
function fd(v) {
  if (!v) return '';
  const m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3]+'/'+m[2]+'/'+m[1] : '';
}
function sqd(t) {
  if (t.squadPrincipal) return t.squadPrincipal;
  if (t._resolvedSquad) return t._resolvedSquad;
  return (t.grupoSuporte||'').replace(/^\d+\s*-\s*/,'').trim();
}
function tr(s, n) { const x=String(s||''); return x.length>n?x.slice(0,n-1)+'\u2026':x; }

function hC(w, l, s) {
  return (
    <div style={{ ...cellBase, width:w, flexDirection:'column', justifyContent:'flex-end', padding:'3px 2px', background:'#f1f5f9', gap:0 }}>
      <span style={{ fontSize:7.5, fontWeight:800, color:'#475569', letterSpacing:'0.04em', textTransform:'uppercase', textAlign:'center', lineHeight:1.2 }}>{l}</span>
      {s && <span style={{ fontSize:6.5, color:'#94a3b8', textAlign:'center', lineHeight:1 }}>{s}</span>}
    </div>
  );
}

function PRow({ ticket, rowBg }) {
  const squad = tr(sqd(ticket), 10);
  const status = tr(ticket.status||'', 20);
  const col = sc(ticket.status);
  const prio = pb(ticket.prioridadeInterna);
  const isImp = ticket.impedimento === true;
  const motivo = tr(ticket.observacaoAdicional || ticket.motivoImpedimento || ticket.observacao || '', 110);
  const bg = rowBg || (isImp ? '#fff1f2' : '#ffffff');
  return (
    <div style={{ display:'flex', alignItems:'flex-start', minHeight:ROW_H, borderBottom:'1px solid #e2e8f0', background:bg }}>
      <div style={{ ...cellBase, width:TIX_W, gap:3, padding:'0 5px', justifyContent:'flex-start' }}>
        <div style={{ background:'#dc2626', color:'#fff', fontSize:7, fontWeight:800, padding:'1px 3px', borderRadius:3, flexShrink:0, minWidth:28, textAlign:'center' }}>PROB</div>
        {isImp && <span style={{ fontSize:8, flexShrink:0 }}>\u26a0</span>}
        <span style={{ fontSize:7.5, fontWeight:700, color:isImp?'#dc2626':'#1d4ed8', fontFamily:'monospace', flexShrink:0 }}>{ticket.issueKey||ticket.id||''}</span>
        <span style={{ fontSize:7.5, color:isImp?'#b91c1c':'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{ticket.summary||''}</span>
      </div>
      <div style={{ ...cellBase, width:SQ_W, padding:'0 2px' }}>
        {squad && <span style={{ fontSize:7, fontWeight:600, color:'#065f46', background:'#d1fae5', padding:'1px 3px', borderRadius:3, maxWidth:SQ_W-6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{squad}</span>}
      </div>
      <div style={{ ...cellBase, width:PR_W, padding:'0 2px' }}>
        {prio && <span style={{ fontSize:7, fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>{prio}</span>}
      </div>
      <div style={{ ...cellBase, width:NI_W, padding:'0 3px' }}>
        <span style={{ fontSize:6.5, color:'#374151', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:NI_W-6 }}>{tr(ticket.naturezaIniciativa||ticket.naturezaOperacao||'',22)}</span>
      </div>
      <div style={{ ...cellBase, width:ST_W, padding:'0 2px' }}>
        <span style={{ fontSize:7, fontWeight:600, color:col, maxWidth:ST_W-4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>{status}</span>
      </div>
      <div style={{ ...cellBase, width:FT_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:'#374151', textAlign:'center' }}>{fd(ticket.dataFimTesteInterno)||'\u2014'}</span>
      </div>
      <div style={{ ...cellBase, width:DIH_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:'#374151', textAlign:'center' }}>{fd(ticket.dataInicioHomologacao||ticket.dataInicioHomologacaoEfetiva||ticket.dataInicioHomologacaoPlanejada)||'\u2014'}</span>
      </div>
      <div style={{ ...cellBase, width:DH_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:'#374151', textAlign:'center' }}>{fd(ticket.dataFimHomologacao)||'\u2014'}</span>
      </div>
      <div style={{ ...cellBase, width:DC_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:ticket.dataConclusao?'#16a34a':'#374151', textAlign:'center', fontWeight:ticket.dataConclusao?700:400 }}>{fd(ticket.dataConclusao)||'\u2014'}</span>
      </div>
      <div style={{ ...cellBase, width:IMP_W }}>{isImp && <span style={{ fontSize:11 }}>\u26a0</span>}</div>
      <div style={{ flex:1, minHeight:'100%', display:'flex', alignItems:'flex-start', padding:'2px 6px', overflow:'hidden' }}>
        <span style={{ fontSize:7.5, color:isImp?'#7f1d1d':'#6b7280', lineHeight:1.25, whiteSpace:'normal', wordBreak:'break-word' }}>{motivo}</span>
      </div>
    </div>
  );
}

function ColHdr() {
  return (
    <div style={{ display:'flex', borderBottom:'2px solid #cbd5e1', minHeight:36, background:'#f1f5f9' }}>
      {hC(TIX_W,'Ticket',null)}
      {hC(SQ_W,'Squad',null)}
      {hC(PR_W,'Prio',null)}
      {hC(NI_W,'Nat.','Iniciativa')}
      {hC(ST_W,'Status',null)}
      {hC(FT_W,'Fim Teste','Interno')}
      {hC(DIH_W,'Ini','Homolog')}
      {hC(DH_W,'Fim','Homolog')}
      {hC(DC_W,'Data','Conclusão')}
      {hC(IMP_W,'\u26a0','Imp')}
      <div style={{ flex:1, display:'flex', alignItems:'flex-end', padding:'3px 6px' }}>
        <span style={{ fontSize:7.5, fontWeight:800, color:'#475569', letterSpacing:'0.04em', textTransform:'uppercase', lineHeight:1.2 }}>Motivo / Observação</span>
      </div>
    </div>
  );
}

function Stats({ tickets }) {
  const total = tickets.length;
  const imped = tickets.filter(t => t.impedimento === true).length;
  const stMap = {}; tickets.forEach(t => { if (t.status) stMap[t.status]=(stMap[t.status]||0)+1; });
  const wfIdx = {}; WF_PROB.forEach((s,i) => { wfIdx[s]=i; });
  const topSt = Object.entries(stMap).sort((a,b) => { const ia=wfIdx[a[0]]??WF_PROB.length; const ib=wfIdx[b[0]]??WF_PROB.length; return ia!==ib?ia-ib:b[1]-a[1]; }).slice(0,10);
  const sqMap = {}; tickets.forEach(t => { const s=tr(sqd(t)||'Sem squad',10); sqMap[s]=(sqMap[s]||0)+1; });
  const topSq = Object.entries(sqMap).sort((a,b) => b[1]-a[1]).slice(0,8);
  const H=54;
  const bx=(bg,fw)=>({ background:bg,borderRadius:5,padding:'4px 7px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:fw,height:H });
  const nm=(c,fs)=>({ fontSize:fs,fontWeight:900,color:c,lineHeight:1 });
  const lb=(c)=>({ fontSize:6.5,fontWeight:700,color:c,marginTop:2,textTransform:'uppercase',letterSpacing:'0.04em',textAlign:'center',maxWidth:70,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' });
  const dv={ width:1,background:'#cbd5e1',alignSelf:'stretch',margin:'0 8px' };
  return (
    <div style={{ background:'#f8fafc',borderBottom:'2px solid #cbd5e1',padding:'8px 12px',display:'flex',alignItems:'stretch' }}>
      <div style={{ display:'flex',flexDirection:'column' }}>
        <div style={{ fontSize:7,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3 }}>Totais</div>
        <div style={{ display:'flex',gap:5 }}>
          <div style={bx('#dc2626',60)}><span style={nm('#fff',26)}>{total}</span><span style={lb('#fca5a5')}>Problemas</span></div>
          <div style={bx(imped>0?'#991b1b':'#374151',60)}><span style={nm('#fff',26)}>{imped}</span><span style={lb(imped>0?'#fca5a5':'#9ca3af')}>Impedidos</span></div>
        </div>
      </div>
      <div style={dv}/>
      <div style={{ display:'flex',flexDirection:'column' }}>
        <div style={{ fontSize:7,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3 }}>Por Status</div>
        <div style={{ display:'flex',gap:5,flexWrap:'
