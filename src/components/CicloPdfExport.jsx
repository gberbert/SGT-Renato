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
const TP_W   = 28; // each Plano de Teste column
const NI_W   = 130; // Natureza da Iniciativa (full value)
const SA_W   = 68; // Situação Atual
const DH_W   = 65; // Data Fim Homologação
const PCH_W  = 30; // % Conclusão Homologação
const LEFT_W = TIX_W + SQ_W + ST_W + IMP_W + PR_W + PC_W + PT_W + FT_W + DC_W; // 664
const MOT_W  = PAGE_W - LEFT_W; // 616 (motivo + flex)
const ROW_H  = 22;
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

// ── Situação Atual (lógica condicional por status/percentuais) ────────────
function situacaoAtual(ticket) {
  const status = String(ticket.status || '').toLowerCase();
  if (!status.includes('execu')) return '';
  const pct  = ticket.percentualConclusao != null && ticket.percentualConclusao !== ''
    ? Number(ticket.percentualConclusao) : 0;
  const pctT = ticket.percentualConclusaoTesteInterno != null && ticket.percentualConclusaoTesteInterno !== ''
    ? Number(ticket.percentualConclusaoTesteInterno) : 0;
  if (pct >= 100 && pctT < 100) return 'Teste Interno';
  if (pct > 0 && pct < 100)    return 'Desenvolvimento';
  if (pct === 0)                return 'A Desenvolver';
  return '';
}

// ── Column header helper ──────────────────────────────────────────────────
function hCell(w, label, sub) {
  return (
    <div style={{ ...cellBase, width:w, flexDirection:'column', justifyContent:'flex-end', padding:'3px 2px', background:'#f1f5f9', gap:0 }}>
      <span style={{ fontSize:7.5, fontWeight:800, color:'#475569', letterSpacing:'0.04em', textTransform:'uppercase', textAlign:'center', lineHeight:1.2 }}>{label}</span>
      {sub && <span style={{ fontSize:6.5, color:'#94a3b8', textAlign:'center', lineHeight:1 }}>{sub}</span>}
    </div>
  );
}

// ── PlanoTesteColumns ─────────────────────────────────────────────────────
function PlanoTesteColumns({ ticket, cellBase }) {
  const ap = Number(ticket.ptAprovados) || 0;
  const rp = Number(ticket.ptReprovados) || 0;
  const bl = Number(ticket.ptBloqueados) || 0;
  const at = Number(ticket.ptAtencao) || 0;
  const na = Number(ticket.ptNaoAplicavel) || 0;
  const ne = Number(ticket.ptNaoExecutado) || 0;
  const total = ap + rp + bl + at + na + ne;
  const prog = total > 0 ? Math.round((ap + at + na) / total * 100) : 0;
  const progColor = prog >= 100 ? '#16a34a' : prog >= 75 ? '#0891b2' : prog >= 40 ? '#ca8a04' : '#dc2626';
  const cell = (val, color) => (
    <div style={{ ...cellBase, width: TP_W }}>
      <span style={{ fontSize: 7, fontWeight: 700, color: val > 0 ? color : '#9ca3af' }}>
        {val > 0 ? val : ''}
      </span>
    </div>
  );
  return (
    <>
      {cell(total, '#1e40af')}
      {cell(ap, '#16a34a')}
      {cell(rp, '#dc2626')}
      {cell(bl, '#ea580c')}
      {cell(at, '#ca8a04')}
      {cell(na, '#6b7280')}
      {cell(ne, '#6b7280')}
      <div style={{ ...cellBase, width: TP_W }}>
        <span style={{ fontSize: 7, fontWeight: 700, color: progColor }}>
          {total > 0 ? `${prog}%` : ''}
        </span>
      </div>
    </>
  );
}

// ── TicketRow ─────────────────────────────────────────────────────────────
function TicketRow({ ticket, rowBg, includeObservacao, includePlanoTeste }) {
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
    <div style={{ display:'flex', alignItems:'flex-start', minHeight:ROW_H, borderBottom:'1px solid #e2e8f0', background:bg }}>
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
      {/* Prioridade — moved after Squad */}
      <div style={{ ...cellBase, width:PR_W, padding:'0 2px' }}>
        {pb && <span style={{ fontSize:7, fontWeight:700, background:pb.bg, color:pb.color, padding:'1px 3px', borderRadius:3, whiteSpace:'nowrap' }}>{pb.label}</span>}
      </div>
      {/* Status */}
      <div style={{ ...cellBase, width:ST_W, padding:'0 2px' }}>
        <span style={{ fontSize:7, fontWeight:600, color:sc, maxWidth:ST_W-4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>{status}</span>
      </div>
      {/* Situação Atual */}
      {(() => {
        const sa = situacaoAtual(ticket);
        const saColor = sa==='Teste Interno'?'#0891b2':sa==='Desenvolvimento'?'#d97706':sa==='A Desenvolver'?'#6b7280':'#374151';
        return (
          <div style={{ ...cellBase, width:SA_W, padding:'0 2px' }}>
            {sa && <span style={{ fontSize:6.5, fontWeight:700, color:saColor, textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:SA_W-4 }}>{sa}</span>}
          </div>
        );
      })()}
      {/* % Conc */}
      <div style={{ ...cellBase, width:PC_W }}>
        <span style={{ fontSize:7.5, fontWeight:700, color:pct==='100%'?'#16a34a':'#374151' }}>{pct}</span>
      </div>
      {/* % Conclusão Teste Interno */}
      <div style={{ ...cellBase, width:PT_W }}>
        <span style={{ fontSize:7.5, fontWeight:700, color:pctT==='100%'?'#16a34a':'#374151' }}>{ticket.percentualConclusaoTesteInterno!=null?`${ticket.percentualConclusaoTesteInterno}%`:''}</span>
      </div>
      {/* % Conclusão Homologação */}
      <div style={{ ...cellBase, width:PCH_W }}>
        <span style={{ fontSize:7.5, fontWeight:700, color:ticket.percentualConclusaoHomologacao!=null&&ticket.percentualConclusaoHomologacao!==''?'#7c3aed':'#94a3b8' }}>
          {ticket.percentualConclusaoHomologacao!=null&&ticket.percentualConclusaoHomologacao!==''?`${ticket.percentualConclusaoHomologacao}%`:''}
        </span>
      </div>
      {/* Fim Teste */}
      <div style={{ ...cellBase, width:FT_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:ticket.dataFimTesteInterno?'#374151':'#94a3b8', textAlign:'center' }}>{fmtDate(ticket.dataFimTesteInterno)||'—'}</span>
      </div>
      {/* Data Fim Homologação */}
      <div style={{ ...cellBase, width:DH_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:ticket.dataFimHomologacao?'#7c3aed':'#94a3b8', textAlign:'center' }}>{fmtDate(ticket.dataFimHomologacao)||'—'}</span>
      </div>
      {/* Data Conclusão */}
      <div style={{ ...cellBase, width:DC_W, padding:'0 2px' }}>
        <span style={{ fontSize:7.5, color:ticket.dataConclusao?'#16a34a':'#94a3b8', textAlign:'center', fontWeight:ticket.dataConclusao?700:400 }}>{fmtDate(ticket.dataConclusao)||'—'}</span>
      </div>
      {/* Natureza da Iniciativa */}
      <div style={{ ...cellBase, width:NI_W, padding:'0 3px' }}>
        <span style={{ fontSize:6.5, color:'#374151', textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:NI_W-6 }}>{trunc(ticket.naturezaIniciativa||ticket.naturezaOperacao||'',20)}</span>
      </div>
      {/* Imp icon — após Natureza da Iniciativa */}
      <div style={{ ...cellBase, width:IMP_W }}>{isImp && <span style={{ fontSize:11 }}>⚠</span>}</div>
      {/* Plano de Teste columns */}
      {includePlanoTeste && <PlanoTesteColumns ticket={ticket} cellBase={cellBase} />}
      {/* Motivo Impedimento / Observação Geral */}
      <div style={{ flex:1, minHeight:'100%', display:'flex', alignItems:'flex-start', padding:'2px 6px', overflow:'hidden', borderRight:includeObservacao?CB:'none' }}>
        <span style={{ fontSize:7.5, color:isImp?'#7f1d1d':'#6b7280', lineHeight:1.25, whiteSpace:'normal', wordBreak:'break-word' }}>{motivo}</span>
      </div>
      {includeObservacao && (
        <div style={{ flex:1, height:'100%', display:'flex', alignItems:'center', padding:'0 6px', overflow:'hidden' }}>
          <span style={{ fontSize:7.5, color:'#374151', lineHeight:1.3 }}>{trunc(ticket.observacao||'',90)}</span>
        </div>
      )}
    </div>
  );
}

// ── Stats section ─────────────────────────────────────────────────────────
function StatsSection({ filteredTickets, escopoFilter }) {
  const total = filteredTickets.length;
  const impedidos = filteredTickets.filter(t => t.impedimento === true).length;
  const stMap = {};
  filteredTickets.forEach(t => { if (t.status) stMap[t.status]=(stMap[t.status]||0)+1; });
  const wfOrder = buildWFOrder(escopoFilter);
  const wfIdx = {}; wfOrder.forEach((s,i)=>{ wfIdx[s]=i; });
  const topSt = Object.entries(stMap)
    .sort((a,b)=>{ const ia=wfIdx[a[0]]??wfOrder.length; const ib=wfIdx[b[0]]??wfOrder.length; return ia!==ib?ia-ib:b[1]-a[1]; })
    .slice(0,10);
  const sqMap = {};
  filteredTickets.forEach(t=>{ const sq=trunc(resolveSquad(t)||'Sem squad',10); sqMap[sq]=(sqMap[sq]||0)+1; });
  const topSq = Object.entries(sqMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
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
          {topSt.map(([st,cnt])=>{
            const sc = statusColor(st);
            return (
              <div key={st} style={{ ...box(`${sc}1a`,60), border:`1px solid ${sc}55` }}>
                <span style={num(sc,22)}>{cnt}</span>
                <span style={{ fontSize:6.5,fontWeight:700,color:sc,marginTop:2,textAlign:'center',lineHeight:1.2,maxWidth:70,whiteSpace:'normal',wordBreak:'break-word' }}>{trunc(st,16)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={div}/>
      <div style={{ display:'flex',flexDirection:'column' }}>
        {grp('Por Squad')}
        <div style={{ display:'flex',gap:5,flexWrap:'wrap',alignItems:'flex-start' }}>
          {topSq.map(([sq,cnt],i)=>{
            const SQ_COLORS=['#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#dc2626','#d97706','#059669'];
            const c=SQ_COLORS[i%SQ_COLORS.length];
            return (
              <div key={sq} style={{ ...box(`${c}1a`,60), border:`1px solid ${c}55` }}>
                <span style={num(c,22)}>{cnt}</span>
                <span style={{ fontSize:6.5,fontWeight:700,color:c,marginTop:2,textAlign:'center',lineHeight:1.2,maxWidth:70,whiteSpace:'normal',wordBreak:'break-word' }}>{trunc(sq,12)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Column headers row ────────────────────────────────────────────────────
function ColHeaders({ includeObservacao, includePlanoTeste }) {
  // Soma de todas as colunas fixas antes das colunas do Plano de Teste
  const fixedW = TIX_W + SQ_W + PR_W + ST_W + SA_W + PC_W + PT_W + PCH_W + FT_W + DH_W + DC_W + NI_W + IMP_W;
  return (
    <div>
      {/* Group header row — shown only when includePlanoTeste */}
      {includePlanoTeste && (
        <div style={{ display:'flex', background:'#e0f2fe', borderBottom:'1px solid #7dd3fc', minHeight:16 }}>
          <div style={{ width: fixedW, flexShrink:0 }} />
          <div style={{ width: TP_W * 8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#0891b2', borderLeft:'1px solid #0369a1', borderRight:'1px solid #0369a1' }}>
            <span style={{ fontSize:7, fontWeight:800, color:'#fff', letterSpacing:'0.1em', textTransform:'uppercase' }}>▶ PLANO DE TESTE</span>
          </div>
          <div style={{ flex:1 }} />
        </div>
      )}
      {/* Main column headers */}
      <div style={{ display:'flex', borderBottom:'2px solid #cbd5e1', minHeight:36, background:'#f1f5f9' }}>
        {hCell(TIX_W,'Ticket',null)}
        {hCell(SQ_W,'Squad',null)}
        {hCell(PR_W,'Prio',null)}
        {hCell(ST_W,'Status',null)}
        {hCell(SA_W,'Situação','Atual')}
        {hCell(PC_W,'%C','Concl')}
        {hCell(PT_W,'%T','Teste')}
        {hCell(PCH_W,'%CH','Homol')}
        {hCell(FT_W,'Fim Teste','Interno')}
        {hCell(DH_W,'Fim','Homolog')}
        {hCell(DC_W,'Data','Conclusão')}
        {hCell(NI_W,'Nat.','Iniciativa')}
        {hCell(IMP_W,'⚠','Imp')}
        {includePlanoTeste && (
          <>
            {hCell(TP_W,'Tot','Casos')}
            {hCell(TP_W,'Ap',null)}
            {hCell(TP_W,'Rp',null)}
            {hCell(TP_W,'Bl',null)}
            {hCell(TP_W,'At',null)}
            {hCell(TP_W,'NA',null)}
            {hCell(TP_W,'NE',null)}
            {hCell(TP_W,'Pr%','Teste')}
          </>
        )}
        <div style={{ flex:1, display:'flex', alignItems:'flex-end', padding:'3px 6px', borderRight: includeObservacao ? CB : 'none' }}>
          <span style={{ fontSize:7.5, fontWeight:800, color:'#475569', letterSpacing:'0.04em', textTransform:'uppercase', lineHeight:1.2 }}>Motivo Imp. / Obs. Geral</span>
        </div>
        {includeObservacao && (
          <div style={{ flex:1, display:'flex', alignItems:'flex-end', padding:'3px 6px' }}>
            <span style={{ fontSize:7.5, fontWeight:800, color:'#1e40af', letterSpacing:'0.04em', textTransform:'uppercase' }}>Observação</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PdfContent (full document) ────────────────────────────────────────────
function PdfContent({ groups, filteredTickets, exportedAt, activeTab, escopoFilter, includeObservacao, includePlanoTeste }) {
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
      <StatsSection filteredTickets={filteredTickets} escopoFilter={escopoFilter}/>
      {/* COL HEADERS */}
      <ColHeaders includeObservacao={includeObservacao} includePlanoTeste={includePlanoTeste}/>
      {/* GROUPS */}
      {groups.map((group, gi) => (
        <div key={group.key}>
          <div style={{ display:'flex',alignItems:'center',background:'#dbeafe',borderBottom:'1px solid #bfdbfe',borderTop:gi>0?'2px solid #93c5fd':'none',minHeight:24,padding:'0 6px' }}>
            <span style={{ fontSize:9.5,fontWeight:800,color:'#1e40af',textTransform:'uppercase',letterSpacing:'0.04em' }}>{group.label}</span>
            <span style={{ fontSize:8.5,color:'#3b82f6',marginLeft:8 }}>({group.tickets.length})</span>
          </div>
          {group.tickets.map((ticket, ti) => (
            <TicketRow key={ticket.issueKey||ticket.id||ti} ticket={ticket} rowBg={ti%2===0?'#ffffff':'#f8fafc'} includeObservacao={includeObservacao} includePlanoTeste={includePlanoTeste}/>
          ))}
        </div>
      ))}
      {/* FOOTER */}
      <div style={{ padding:'8px 12px 10px',borderTop:'3px solid #1e40af',background:'#f8fafc',display:'flex',flexDirection:'column',gap:4,marginTop:4 }}>
        <div style={{ display:'flex',gap:16,alignItems:'center' }}>
          <span style={{ fontSize:7.5,color:'#374151' }}>⚠ Impedido</span>
          <span style={{ fontSize:7.5,color:'#374151' }}>DEM = Demanda · FAST = Demanda Fast · PROB = Problema · Nat. = Natureza da Iniciativa</span>
          <span style={{ fontSize:7,color:'#9ca3af',marginLeft:'auto' }}>SGT — Planejamento de Ciclos</span>
        </div>
        {includePlanoTeste && (
          <div style={{ display:'flex',alignItems:'center',gap:6,padding:'3px 8px',background:'#e0f2fe',borderRadius:4,border:'1px solid #7dd3fc' }}>
            <span style={{ fontSize:7,fontWeight:700,color:'#0891b2' }}>PLANO DE TESTE:</span>
            <span style={{ fontSize:7,color:'#374151' }}>Tot=Total de Casos · Ap=Aprovados · Rp=Reprovados · Bl=Bloqueados · At=Atenção · NA=Não Aplicável · NE=Não Executado · Pr%=Progresso [(Ap+At+NA)/Tot]</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── NTT DATA logo SVG ─────────────────────────────────────────────────────
const NTT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <circle cx="24" cy="24" r="22" fill="none" stroke="white" stroke-width="3.5"/>
  <circle cx="24" cy="24" r="12" fill="none" stroke="white" stroke-width="3.5"/>
  <ellipse cx="24" cy="18" rx="3.5" ry="5" fill="white"/>
</svg>`;

// ── Cover Page ────────────────────────────────────────────────────────────
const PAGE_H = Math.round((210 / 297) * PAGE_W); // A4 landscape height ≈ 905px

function CoverPage({ exportedAt }) {
  const dateStr = new Date().toLocaleDateString('pt-BR', { day:'numeric', month:'long', year:'numeric' });
  return (
    <div style={{ width:PAGE_W, height:PAGE_H, background:'linear-gradient(140deg,#1a2850 0%,#253668 50%,#1e3060 100%)', position:'relative', fontFamily:'Inter,Segoe UI,Arial,sans-serif', overflow:'hidden' }}>
      {/* Decorative diagonal stripe */}
      <div style={{ position:'absolute', top:0, right:0, width:'45%', height:'100%', background:'rgba(255,255,255,0.04)', clipPath:'polygon(30% 0,100% 0,100% 100%,0 100%)' }} />
      {/* Top logos bar */}
      <div style={{ position:'absolute', top:44, left:48, display:'flex', alignItems:'center', gap:14 }}>
        <div dangerouslySetInnerHTML={{ __html:NTT_LOGO_SVG }} />
        <span style={{ fontSize:26, fontWeight:800, color:'#fff', letterSpacing:'0.04em', fontFamily:'Arial,sans-serif' }}>NTT DATA</span>
      </div>
      <div style={{ position:'absolute', top:40, right:52, textAlign:'right' }}>
        <div style={{ fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'0.12em' }}>CPFL</div>
        <div style={{ fontSize:13, fontWeight:600, color:'#94b3d4', letterSpacing:'0.18em' }}>ENERGIA</div>
      </div>
      {/* Thin accent bar */}
      <div style={{ position:'absolute', top:110, left:48, right:48, height:2, background:'rgba(255,255,255,0.15)' }} />
      {/* Main title */}
      <div style={{ position:'absolute', bottom:180, left:52 }}>
        <div style={{ fontSize:72, fontWeight:300, color:'#ffffff', lineHeight:1.1, letterSpacing:'-0.01em' }}>Gestão de Demandas</div>
        <div style={{ fontSize:28, fontWeight:400, color:'#94b3d4', marginTop:18, letterSpacing:'0.01em' }}>Status Report Operacional — Semanal</div>
        <div style={{ fontSize:20, fontWeight:300, color:'#7a9fc0', marginTop:14 }}>{dateStr}</div>
      </div>
      {/* Bottom footer */}
      <div style={{ position:'absolute', bottom:30, left:52, fontSize:13, color:'#556e94' }}>© 2026 NTT DATA, Inc.</div>
      <div style={{ position:'absolute', bottom:30, right:52, fontSize:12, color:'#4a6282' }}>Planejamento de Ciclos · {exportedAt}</div>
    </div>
  );
}

// ── Back Page ─────────────────────────────────────────────────────────────
function BackPage() {
  return (
    <div style={{ width:PAGE_W, height:PAGE_H, background:'#2d3561', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,Segoe UI,Arial,sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', gap:28 }}>
        <div dangerouslySetInnerHTML={{ __html:NTT_LOGO_SVG.replace('width="48" height="48"','width="96" height="96"') }} />
        <span style={{ fontSize:64, fontWeight:800, color:'#ffffff', letterSpacing:'0.04em', fontFamily:'Arial,sans-serif' }}>NTT DATA</span>
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
export async function exportCicloPdf({ ciclos = [], getCicloTickets, filteredTickets = [], backlogTickets = [], activeTab = 'ciclos', escopoFilter, includeObservacao = false, includePlanoTeste = false }) {
  const exportedAt = new Date().toLocaleString('pt-BR', { day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' });
  const groups = activeTab==='workflow'
    ? buildGroupsByWorkflow(filteredTickets, escopoFilter)
    : buildGroupsByCiclo(ciclos, getCicloTickets, backlogTickets);

  const A4_W = 297;
  const A4_H = 210;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const SCALE = 2;

  async function renderPage(component) {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;background:transparent;z-index:-9999;pointer-events:none;`;
    document.body.appendChild(el);
    const r = ReactDOM.createRoot(el);
    r.render(component);
    await new Promise(res => setTimeout(res, 600));
    try {
      return await html2canvas(el, { scale: SCALE, useCORS: true, backgroundColor: null, logging: false, width: PAGE_W });
    } finally {
      r.unmount();
      document.body.removeChild(el);
    }
  }

  function addCanvasPage(canvas, first = false) {
    if (!first) pdf.addPage();
    const imgData = canvas.toDataURL('image/png');
    const sliceMmH = (canvas.height / canvas.width) * A4_W;
    pdf.addImage(imgData, 'PNG', 0, 0, A4_W, Math.min(sliceMmH, A4_H));
  }

  try {
    // ── Cover page ──────────────────────────────────────────────────────
    const coverCanvas = await renderPage(<CoverPage exportedAt={exportedAt} />);
    addCanvasPage(coverCanvas, true);

    // ── Content pages ───────────────────────────────────────────────────
    const contentEl = document.createElement('div');
    contentEl.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;background:#fff;z-index:-9999;pointer-events:none;`;
    document.body.appendChild(contentEl);
    const contentRoot = ReactDOM.createRoot(contentEl);
    contentRoot.render(
      <PdfContent
        groups={groups}
        filteredTickets={filteredTickets}
        exportedAt={exportedAt}
        activeTab={activeTab}
        escopoFilter={escopoFilter}
        includeObservacao={includeObservacao}
        includePlanoTeste={includePlanoTeste}
      />
    );
    await new Promise(r => setTimeout(r, 700));
    try {
      const canvas = await html2canvas(contentEl, { scale: SCALE, useCORS: true, backgroundColor: '#fff', logging: false, width: PAGE_W });
      const pageHeightPx = (A4_H / A4_W) * canvas.width;
      let yOffset = 0;
      while (yOffset < canvas.height) {
        pdf.addPage();
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
      }
    } finally {
      contentRoot.unmount();
      document.body.removeChild(contentEl);
    }

    // ── Back page ────────────────────────────────────────────────────────
    const backCanvas = await renderPage(<BackPage />);
    addCanvasPage(backCanvas, false);

    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save('planejamento-ciclos-' + dateStr + '.pdf');
  } catch (e) {
    console.error('[exportCicloPdf]', e);
    throw e;
  }
}
