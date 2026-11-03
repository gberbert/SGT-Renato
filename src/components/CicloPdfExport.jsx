import React from 'react';
import ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ── Workflow order arrays ─────────────────────────────────────────────────
const WF_DEMANDA = ['Aguardando Aprovação Gestor Imediato','Escrita de Requerimento','Validação Comitê','Aguardando Solicitante','Detalhamento de Requisitos','Aguardando Profissional de TI','Aguardando Demanda/Projeto','Revisão de Requisitos de Projeto','Análise e T-Shirt','Aguardando Análise Técnica','Aguardando Aprovação T-Shirt','Planejamento','Aprovação de Planejamento','Aguardando Planejamento','Em Execução','Em Teste','Em homologação','Revisão de homologação','Etapa de KT','Aguardando Mudança','Concluída'];
const WF_FAST = ['Aguardando Atendimento','Em Atendimento','Resolvido','Reaberto','Fechada','Canceled','Aprovação Demanda Fast','Aguardando Aprovação Gestor','Aguardando Aprovação Tecnica','Aguardando Aprovação Adicional','Aprovado','Reprovado','Agendado','Aguardando Compra','Aguardando Validação','Aguardando Problema','Aguardando Mudança','Aguardando Fornecedor','Aguardando Solicitante'];
const WF_PROBLEMAS = ['Aguardando RCA','Aguardando Aprovação Líder de Torre','Aguardando Aprovação Ger. Problema','Solução Rejeitada','Aguardando Planejamento','Aguardando Execução','Em Execução','Aguardando Demanda/Projeto','Em Monitoramento','Fechado','Cancelado','RCA em Desenvolvimento','Aguardando Aprovação Técnica RCA','Aguardando Aprovação Governança RCA','Resolvido','Em Planejamento','Aguardando Aprovação Técnica','Aguardando Aprovação Governança','Aguardando Demanda'];

function buildWFOrder(escopoFilter) {
  const seen = new Set(); const order = [];
  const add = list => list.forEach(s => { if (!seen.has(s)) { seen.add(s); order.push(s); } });
  const has = escopoFilter && escopoFilter.size > 0;
  if (!has || escopoFilter.has('DEMANDA')) add(WF_DEMANDA);
  if (!has || escopoFilter.has('DEMANDA FAST')) add(WF_FAST);
  if (!has || escopoFilter.has('PROBLEMAS')) add(WF_PROBLEMAS);
  return order;
}

// ── Layout constants (same PAGE_W as RoadmapGeralPdfExport) ──────────────
const PAGE_W = 1280;
const TIX_W  = 250;  // escopo badge + key + title
const SQ_W   = 55;
const ST_W   = 85;
const IMP_W  = 18;
const PR_W   = 52;
const PC_W   = 32;
const PT_W   = 32;
const FT_W   = 70;
const DC_W   = 70;
const LEFT_W = TIX_W + SQ_W + ST_W + IMP_W + PR_W + PC_W + PT_W + FT_W + DC_W; // 664
const MOT_W  = PAGE_W - LEFT_W; // 616 (motivo + flex)
const ROW_H  = 20;
const CB     = '1px solid #e2e8f0';
const cellBase = { flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: CB, overflow: 'hidden' };

// ── Helpers ───────────────────────────────────────────────────────────────
const ESCOPO_COLORS = { 'PROBLEMAS':{ bg:'#dc2626',text:'#fff',short:'PROB' }, 'DEMANDA FAST':{ bg:'#ea580c',text:'#fff',short:'FAST' }, 'DEMANDA':{ bg:'#2563eb',text:'#fff',short:'DEM' }, 'INCIDENTE':{ bg:'#16a34a',text:'#fff',short:'INC' }, 'SOLICITACAO':{ bg:'#0891b2',text:'#fff',short:'SOL' }, 'CATALOGO':{ bg:'#7c3aed',text:'#fff',short:'CAT' } };
function escopoBadge(raw) {
  const v = String(raw||'').trim().toUpperCase().replace(/\s+/g,' ');
  const k = v.startsWith('SOLICIT')?'SOLICITACAO':v.startsWith('CATAL')?'CATALOGO':v;
  return ESCOPO_COLORS[k] || { bg:'#374151', text:'#d1d5db', short:k.slice(0,4) };
}
function statusColor(s) {
  const l = String(s||'').toLowerCase();
  if (l.includes('conclu')||l.includes('done')||l.includes('resolv')||l.includes('fechad')) return '#16a34a';
  if (l.includes('execu')||l.includes('andament')||l.includes('atendiment')) return '#2563eb';
  if (l.includes('homolog')) return '#7c3aed';
  if (l.includes('teste')) return '#0891b2';
  if (l.includes('aguard')||l.includes('pendent')) return '#d97706';
  if (l.includes('planej')||l.includes('anali')||l.includes('aprova')) return '#b45309';
  return '#6b7280';
}
function prioBadge(v) {
  const p = String(v||'').toLowerCase().trim();
  if (p==='crise'||p==='crítica'||p==='critica') return { bg:'#fca5a5', color:'#7f1d1d', label:'Crise' };
  if (p==='alto'||p==='alta') return { bg:'#fdba74', color:'#7c2d12', label:'Alto' };
  if (p==='medio'||p==='médio'||p==='media'||p==='média') return { bg:'#fde68a', color:'#713f12', label:'Médio' };
  if (p==='baixo'||p==='baixa') return { bg:'#bfdbfe', color:'#1e3a8a', label:'Baixo' };
  if (p==='muito baixo') return { bg:'#e0e7ff', color:'#312e81', label:'M.Baixo' };
  return null;
}
function fmtDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
function resolveSquad(t) {
  if (t.squadPrincipal) return t.squadPrincipal;
  if (t._resolvedSquad) return t._resolvedSquad;
  const g = t.grupoSuporte||'';
  return g ? g.replace(/^\d+\s*-\s*/,'').trim() : '';
}
function trunc(str, max) { const s=String(str||''); return s.length>max?s.slice(0,max-1)+'…':s; }

// ── Column header helper ──────────────────────────────────────────────────
function hCell(w, label, sub) {
  return (
    <div style={{ ...cellBase, width:w, flexDirection:'column', justifyContent:'flex-end', padding:'3px 2px', background:'#f1f5f9', gap:0 }}>
      <span style={{ fontSize:7.5, fontWeight:800, color:'#475569', letterSpacing:'0.04em', textTransform:'uppercase', textAlign:'center', lineHeight:1.2 }}>{label}</span>
      {sub && <span style={{ fontSize:6.5, color:'#94a3b8', textAlign:'center', lineHeight:1 }}>{sub}</span>}
    </div>
  );
}

// ── TicketRow ─────────────────────────────────────────────────────────────
function TicketRow({ ticket, rowBg }) {
  const eb = escopoBadge(ticket.escopo);
  const squad = trunc(resolveSquad(ticket), 9);
  const status = trunc(ticket.status||'', 14);
  const sc = statusColor(ticket.status);
  const pb = prioBadge(ticket.prioridadeInterna);
  const pct  = ticket.percentualConclusao != null ? `${ticket.percentualConclusao}%` : '';
  const pctT = ticket.percentualConclusaoTesteInterno != null ? `${ticket.percentualConclusaoTesteInterno}%` : '';
  const isImp = ticket.impedimento === true;
  const motivo = trunc(ticket.observacaoAdicional || ticket.motivoImpedimento || '', 90);
  const bg = rowBg || (isImp ? '#fff1f2' : '#ffffff');

  return (
    <div style={{ display:'flex', alignItems:'center', height:ROW_H, borderBottom:'1px solid #f1f5f9', background:bg }}>
      {/* Ticket cell */}
      <div style={{ ...cellBase, width:TIX_W, gap:3, padding:'0 5px', justifyContent:'flex-start' }}>
        <div style={{ background:eb.bg, color:eb.text, fontSize:7, fontWeight:800, padding:'1px 3px', borderRadius:3, flexShrink:0, minWidth:24, textAlign:'center' }}>{eb.short}</div>
        {isImp && <span style={{ fontSize:8, flexShrink:0 }}>⚠</span>}
        <span style={{ fontSize:7.5, fontWeight:700, color:isImp?'#dc2626':'#1d4ed8', fontFamily:'monospace', flexShrink:0 }}>{ticket.issueKey||ticket.id||''}</span>
        <span style={{ fontSize:7.5, color:isImp?'#b91c1c':'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{ticket.summary||''}</span>
      </div>
      {/* Squad */}
      <div style={{ ...cellBase, width:SQ_W, padding:'0 2px' }}>
        {squad && <span style={{ fontSize:7, fontWeight:600, color:'#065f46', background:'#d1fae5', padding:'1px 3px', borderRadius:3, maxWidth:SQ_W-6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{squad}</span>}
      </div>
      {/* Status */}
      <div style={{ ...cellBase, width:ST_W, padding:'0 2px' }}>
        <span style={{ fontSize:7, fontWeight:600, color:sc, maxWidth:ST_W-4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>{status}</span>
      </div>
      {/* Imp icon */}
      <div style={{ ...cellBase, width:IMP_W }}>{isImp && <span style={{ fontSize:11 }}>⚠</span>}</div>
      {/* Prioridade */}
      <div style={{ ...cellBase, width:PR_W, padding:'0 2px' }}>
        {pb && <span style={{ fontSize:7, fontWeight:700, background:pb.bg, color:pb.color, padding:'1px 3px', borderRadius:3, whiteSpace:'nowrap' }}>{pb.label}</span>}
      </div>
      {/* % Conc */}
      <div style={{ ...cellBase, width:PC_W }}>
        <span style={{ fontSize:7.5, fontWeight:700, color:pct==='100%'?'#16a34a':'#374151' }}>{pct}</span>
      </div>
      {/* % Teste */}
      <div style={{ ...cellBase, width:PT_W }}>
        <span style={{ fontSize:7.5, fontWeight:700, color:pctT==='100%'?'#16a34a':'#374151' }}>{pctT}</span>
      </div>
      {/* Fim Teste */}
      <div style={{ ...cellBase, width:FT_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:ticket.dataFimTesteInterno?'#374151':'#94a3b8', textAlign:'center' }}>{fmtDate(ticket.dataFimTesteInterno)||'—'}</span>
      </div>
      {/* Data Conclusão */}
      <div style={{ ...cellBase, width:DC_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:ticket.dataConclusao?'#16a34a':'#94a3b8', textAlign:'center', fontWeight:ticket.dataConclusao?700:400 }}>{fmtDate(ticket.dataConclusao)||'—'}</span>
      </div>
      {/* Motivo */}
      <div style={{ flex:1, height:'100%', display:'flex', alignItems:'center', padding:'0 6px', overflow:'hidden' }}>
        <span style={{ fontSize:7.5, color:isImp?'#7f1d1d':'#6b7280', lineHeight:1.3 }}>{motivo}</span>
      </div>
    </div>
  );
}

// ── Stats section (same layout as RoadmapGeralPdfExport) ─────────────────
function StatsSection({ filteredTickets }) {
  const total = filteredTickets.length;
  const impedidos = filteredTickets.filter(t => t.impedimento === true).length;
  const stMap = {};
  filteredTickets.forEach(t => { if (t.status) stMap[t.status]=(stMap[t.status]||0)+1; });
  const topSt = Object.entries(stMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const SQ_PC = { 'Crise':'#dc2626','Alto':'#ea580c','Médio':'#eab308','Baixo':'#3b82f6','Muito baixo':'#c7d2fe','(sem prio)':'#cbd5e1' };
  const PR_ORD = ['Crise','Alto','Médio','Baixo','Muito baixo','(sem prio)'];
  const sqPrioMap = {};
  filteredTickets.forEach(t => {
    const sq = trunc(resolveSquad(t)||'Sem squad',12);
    const pr = t.prioridadeInterna||'(sem prio)';
    if (!sqPrioMap[sq]) sqPrioMap[sq]={};
    sqPrioMap[sq][pr]=(sqPrioMap[sq][pr]||0)+1;
  });
  const sqList = Object.entries(sqPrioMap).map(([n,pd])=>({n,tot:Object.values(pd).reduce((s,v)=>s+v,0),pd})).sort((a,b)=>b.tot-a.tot).slice(0,8);
  const sqMax = sqList[0]?.tot||1;
  const BOX_H=54;
  const box=(bg,fw)=>({ background:bg,borderRadius:5,padding:'4px 7px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:fw,height:BOX_H });
  const num=(c,fs)=>({ fontSize:fs,fontWeight:900,color:c,lineHeight:1 });
  const lbl=(c)=>({ fontSize:6.5,fontWeight:700,color:c,marginTop:2,textTransform:'uppercase',letterSpacing:'0.04em',textAlign:'center',maxWidth:70,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' });
  const div={ width:1,background:'#cbd5e1',alignSelf:'stretch',margin:'0 8px' };
  const grp=(t)=><div style={{ fontSize:7,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3 }}>{t}</div>;
  return (
    <div style={{ background:'#f8fafc',borderBottom:'2px solid #cbd5e1',padding:'8px 12px',display:'flex',alignItems:'stretch' }}>
      <div style={{ display:'flex',flexDirection:'column' }}>
        {grp('Totais')}
        <div style={{ display:'flex',gap:5 }}>
          <div style={box('#1e40af',60)}><span style={num('#fff',26)}>{total}</span><span style={lbl('#bfdbfe')}>Tickets</span></div>
          <div style={box(impedidos>0?'#991b1b':'#374151',60)}><span style={num('#fff',26)}>{impedidos}</span><span style={lbl(impedidos>0?'#fca5a5':'#9ca3af')}>Impedidos</span></div>
        </div>
      </div>
      <div style={div}/>
      <div style={{ display:'flex',flexDirection:'column' }}>
        {grp('Por Status')}
        <div style={{ display:'flex',gap:5,flexWrap:'wrap',alignItems:'flex-start' }}>
          {topSt.map(([st,cnt])=>(
            <div key={st} style={box('#e0f2fe',60)}>
              <span style={num('#0369a1',22)}>{cnt}</span>
              <span style={{ fontSize:6.5,fontWeight:700,color:'#0891b2',marginTop:2,textAlign:'center',lineHeight:1.2,maxWidth:70,whiteSpace:'normal',wordBreak:'break-word' }}>{trunc(st,16)}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={div}/>
      <div style={{ display:'flex',flexDirection:'column',flex:1,minWidth:0 }}>
        {grp('Por Squad · Prioridade')}
        <div style={{ display:'flex',gap:8 }}>
          <div style={{ flex:1,minWidth:0 }}>
            {sqList.map(({n,tot,pd})=>(
              <div key={n} style={{ display:'flex',alignItems:'center',gap:3,marginBottom:2 }}>
                <span style={{ fontSize:7,color:'#374151',width:68,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flexShrink:0 }}>{n}</span>
                <div style={{ flex:1,height:13,background:'#e2e8f0',borderRadius:2,display:'flex',overflow:'hidden' }}>
                  {PR_ORD.filter(p=>pd[p]).map(p=>{
                    const tc=SQ_PC[p]==='#eab308'?'#854d0e':SQ_PC[p]==='#c7d2fe'?'#3730a3':SQ_PC[p]==='#cbd5e1'?'#475569':'#fff';
                    return <div key={p} style={{ width:`${(pd[p]/tot)*100}%`,height:'100%',background:SQ_PC[p],display:'flex',alignItems:'center',justifyContent:'center' }}><span style={{ fontSize:6,fontWeight:800,color:tc }}>{pd[p]}</span></div>;
                  })}
                </div>
                <span style={{ fontSize:6.5,fontWeight:800,color:'#374151',minWidth:16,textAlign:'right' }}>{tot}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:3,justifyContent:'center',flexShrink:0 }}>
            {PR_ORD.map(p=><div key={p} style={{ display:'flex',alignItems:'center',gap:3 }}><div style={{ width:9,height:9,borderRadius:2,background:SQ_PC[p] }}/><span style={{ fontSize:6.5,color:'#374151',whiteSpace:'nowrap' }}>{p}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Column headers row ────────────────────────────────────────────────────
function ColHeaders() {
  return (
    <div style={{ display:'flex',borderBottom:'2px solid #cbd5e1',minHeight:36,background:'#f1f5f9' }}>
      {hCell(TIX_W,'Ticket',null)}
      {hCell(SQ_W,'Squad',null)}
      {hCell(ST_W,'Status',null)}
      {hCell(IMP_W,'⚠','Imp')}
      {hCell(PR_W,'Prio',null)}
      {hCell(PC_W,'%C','Concl')}
      {hCell(PT_W,'%T','Teste')}
      {hCell(FT_W,'Fim Teste','Interno')}
      {hCell(DC_W,'Data','Conclusão')}
      <div style={{ flex:1,display:'flex',alignItems:'flex-end',padding:'3px 6px',borderRight:'none' }}>
        <span style={{ fontSize:7.5,fontWeight:800,color:'#475569',letterSpacing:'0.04em',textTransform:'uppercase' }}>Motivo Impedimento</span>
      </div>
    </div>
  );
}

// ── PdfContent (full document) ────────────────────────────────────────────
function PdfContent({ groups, filteredTickets, exportedAt, activeTab }) {
  return (
    <div style={{ width:PAGE_W,background:'#fff',color:'#111827',fontFamily:'Inter,Segoe UI,Arial,sans-serif',fontSize:10 }}>
      {/* PAGE HEADER */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px 6px',borderBottom:'2px solid #1e40af',background:'#f8fafc' }}>
        <div>
          <div style={{ fontSize:14,fontWeight:800,color:'#1e3a5f',letterSpacing:'-0.01em' }}>Planejamento de Ciclos</div>
          <div style={{ fontSize:8,color:'#6b7280',marginTop:1 }}>
            Exportado em {exportedAt} · {filteredTickets.length} ticket{filteredTickets.length!==1?'s':''} · {activeTab==='workflow'?'Agrupado por Workflow':'Agrupado por Ciclo'}
          </div>
        </div>
      </div>
      {/* STATS */}
      <StatsSection filteredTickets={filteredTickets}/>
      {/* COL HEADERS */}
      <ColHeaders/>
      {/* GROUPS */}
      {groups.map((group, gi) => (
        <div key={group.key}>
          <div style={{ display:'flex',alignItems:'center',background:'#dbeafe',borderBottom:'1px solid #bfdbfe',borderTop:gi>0?'2px solid #93c5fd':'none',minHeight:24,padding:'0 6px' }}>
            <span style={{ fontSize:9.5,fontWeight:800,color:'#1e40af',textTransform:'uppercase',letterSpacing:'0.04em' }}>{group.label}</span>
            <span style={{ fontSize:8.5,color:'#3b82f6',marginLeft:8 }}>({group.tickets.length})</span>
          </div>
          {group.tickets.map((ticket, ti) => (
            <TicketRow key={ticket.issueKey||ticket.id||ti} ticket={ticket} rowBg={ti%2===0?'#ffffff':'#f8fafc'}/>
          ))}
        </div>
      ))}
      {/* FOOTER */}
      <div style={{ padding:'6px 12px',borderTop:'2px solid #cbd5e1',background:'#f8fafc',display:'flex',gap:16,alignItems:'center' }}>
        <span style={{ fontSize:7.5,color:'#374151' }}>⚠ Impedido</span>
        <span style={{ fontSize:7.5,color:'#374151' }}>DEM = Demanda · FAST = Demanda Fast · PROB = Problema</span>
        <span style={{ fontSize:7,color:'#9ca3af',marginLeft:'auto' }}>SGT — Planejamento de Ciclos</span>
      </div>
    </div>
  );
}

// ── Group builders ────────────────────────────────────────────────────────
function buildGroupsByCiclo(ciclos, getCicloTickets, backlogTickets) {
  const groups = [];
  ciclos.forEach(c => {
    const tks = getCicloTickets(c);
    if (tks.length>0) groups.push({ key:c.id, label:c.nome, tickets:tks });
  });
  if (backlogTickets.length>0) groups.push({ key:'backlog', label:'Backlog', tickets:backlogTickets });
  return groups;
}
function buildGroupsByWorkflow(filteredTickets, escopoFilter) {
  const order = buildWFOrder(escopoFilter);
  const idx={}; order.forEach((s,i)=>{idx[s]=i;});
  const map=new Map();
  filteredTickets.forEach(t=>{ const s=t.status||'(sem status)'; if(!map.has(s))map.set(s,[]); map.get(s).push(t); });
  return [...map.entries()]
    .sort(([a],[b])=>{ const ia=idx[a]??order.length; const ib=idx[b]??order.length; return ia!==ib?ia-ib:a.localeCompare(b,'pt-BR'); })
    .map(([label,tickets])=>({ key:label, label, tickets }));
}

// ── Main export function ──────────────────────────────────────────────────
export async function exportCicloPdf({ ciclos = [], getCicloTickets, filteredTickets = [], backlogTickets = [], activeTab = 'ciclos', escopoFilter }) {
  const exportedAt = new Date().toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' });
  const groups = activeTab==='workflow'
    ? buildGroupsByWorkflow(filteredTickets, escopoFilter)
    : buildGroupsByCiclo(ciclos, getCicloTickets, backlogTickets);

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + PAGE_W + 'px;background:#fff;z-index:-9999;pointer-events:none;';
  document.body.appendChild(container);

  const root = ReactDOM.createRoot(container);
  root.render(
    <PdfContent
      groups={groups}
      filteredTickets={filteredTickets}
      exportedAt={exportedAt}
      activeTab={activeTab}
    />
  );

  await new Promise(r => setTimeout(r, 700));

  try {
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#fff', logging: false, width: PAGE_W,
    });

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const A4_W = 297;
    const A4_H = 210;
    const pageHeightPx = (A4_H / A4_W) * canvas.width;

    let yOffset = 0, page = 0;
    while (yOffset < canvas.height) {
      if (page > 0) pdf.addPage();
      const sliceH = Math.min(pageHeightPx, canvas.height - yOffset);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, -yOffset);
      const imgData = pageCanvas.toDataURL('image/png');
      const sliceMmH = (sliceH / canvas.width) * A4_W;
      pdf.addImage(imgData, 'PNG', 0, 0, A4_W, sliceMmH);
      yOffset += sliceH;
      page++;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save('planejamento-ciclos-' + dateStr + '.pdf');
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
