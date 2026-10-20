/**
 * RoadmapGeralPdfExport.jsx
 * Gera PDF A4 paisagem do Roadmap Geral — layout Gantt.
 * Colunas esquerda: escopo | key/título | squad | status | ⚠ | 🔒 | prio | %C | %T
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getStorage, ref, getDownloadURL, listAll } from 'firebase/storage';

// ── helpers ────────────────────────────────────────────────────────────────
const ESCOPO_COLORS = {
  'PROBLEMAS':    { bg: '#dc2626', text: '#fff', short: 'PROB' },
  'DEMANDA FAST': { bg: '#ea580c', text: '#fff', short: 'FAST' },
  'DEMANDA':      { bg: '#2563eb', text: '#fff', short: 'DEM' },
  'INCIDENTE':    { bg: '#16a34a', text: '#fff', short: 'INC' },
  'SOLICITACAO':  { bg: '#0891b2', text: '#fff', short: 'SOL' },
  'CATALOGO':     { bg: '#7c3aed', text: '#fff', short: 'CAT' },
};

function normalizeEscopo(raw) {
  const v = String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (v.startsWith('SOLICIT')) return 'SOLICITACAO';
  if (v.startsWith('CATAL')) return 'CATALOGO';
  return v;
}
function escopoBadge(escopo) {
  const key = normalizeEscopo(escopo);
  return ESCOPO_COLORS[key] || { bg: '#374151', text: '#d1d5db', short: key.slice(0, 4) };
}

function barStyle(ticket) {
  const s = String(ticket.status || '').toLowerCase();
  if (ticket.impedimento === true)
    return { bg: 'rgba(239,68,68,0.12)', border: '2px dashed #dc2626', textColor: '#dc2626' };
  if (s.includes('conclu') || s.includes('resolv') || s.includes('done') || s.includes('fechad'))
    return { bg: '#22c55e', border: 'none', textColor: '#fff' };
  if (s.includes('execu') || s.includes('andament') || s.includes('progress') || s.includes('atendiment'))
    return { bg: '#2563eb', border: 'none', textColor: '#fff' };
  if (s.includes('homolog') || s.includes('revis'))
    return { bg: '#7c3aed', border: 'none', textColor: '#fff' };
  if (s.includes('teste') || s.includes('test'))
    return { bg: '#0891b2', border: 'none', textColor: '#fff' };
  if (s.includes('anali') || s.includes('t-shirt') || s.includes('planej') || s.includes('aprova'))
    return { bg: 'rgba(234,179,8,0.15)', border: '2px dashed #ca8a04', textColor: '#92400e' };
  if (s.includes('aguard') || s.includes('pendent'))
    return { bg: 'rgba(234,179,8,0.15)', border: '2px dashed #d97706', textColor: '#92400e' };
  return { bg: '#1d4ed8', border: 'none', textColor: '#fff' };
}

function statusColor(s) {
  const l = String(s || '').toLowerCase();
  if (l.includes('conclu') || l.includes('done') || l.includes('resolv') || l.includes('fechad')) return '#16a34a';
  if (l.includes('execu') || l.includes('andament') || l.includes('atendiment')) return '#2563eb';
  if (l.includes('homolog')) return '#7c3aed';
  if (l.includes('teste')) return '#0891b2';
  if (l.includes('aguard') || l.includes('pendent')) return '#d97706';
  if (l.includes('planej') || l.includes('anali') || l.includes('aprova')) return '#b45309';
  return '#6b7280';
}

function prioBadge(v) {
  const p = String(v || '').toLowerCase().trim();
  if (p === 'crise' || p === 'crítica' || p === 'critica') return { bg: '#fca5a5', color: '#7f1d1d', label: 'Crise' };
  if (p === 'alto' || p === 'alta') return { bg: '#fdba74', color: '#7c2d12', label: 'Alto' };
  if (p === 'medio' || p === 'médio' || p === 'media' || p === 'média') return { bg: '#fde68a', color: '#713f12', label: 'Médio' };
  if (p === 'baixo' || p === 'baixa') return { bg: '#bfdbfe', color: '#1e3a8a', label: 'Baixo' };
  if (p === 'muito baixo') return { bg: '#e0e7ff', color: '#312e81', label: 'M.Baixo' };
  return null;
}

function fmtDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}`;
  return s.slice(0, 5);
}

function diffDays(a, b) {
  const da = new Date(a), db = new Date(b);
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.max(1, Math.round((db - da) / 86400000));
}

// ── Layout constants ─────────────────────────────────────────────────────
// A4 landscape at ~115dpi → 1366×966 — we use 1280 for safety
const PAGE_W  = 1280;
const TITLE_W = 160;  // escopo badge + key + title
const SQ_W    = 48;   // squad
const ST_W    = 56;   // status
const IMP_W   = 16;   // 🚧 impedido icon
const VUL_W   = 16;   // 🔒 vulnerabilidade icon
const PR_W    = 44;   // prioridade
const PC_W    = 26;   // % conclusão
const PT_W    = 26;   // % teste interno
const TV_W    = 60;   // tickets vinculados
const NAT_W   = 100;  // natureza iniciativa (wider for full text)
const LEFT_W  = TITLE_W + SQ_W + ST_W + IMP_W + VUL_W + PR_W + PC_W + PT_W + TV_W + NAT_W; // 552
const TRACK_W = PAGE_W - LEFT_W;  // 728
const ROW_H   = 26;
const HEADER_H = 44;

// Cell border style
const CB = '1px solid #e2e8f0';
const cellBase = { flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: CB, overflow: 'hidden' };

// ── GanttPdfContent ─────────────────────────────────────────────────────────
function GanttPdfContent({ groupedRows, columns, granularity, groupBy, exportedAt, totalTickets, logoClient, logoNtt, includeObservacao }) {
  const COL_W = columns.length > 0 ? Math.max(32, Math.floor(TRACK_W / columns.length)) : 80;

  const timelineStart = columns.length > 0 ? columns[0].start.getTime() : 0;
  const timelineEnd   = columns.length > 0 ? columns[columns.length - 1].end.getTime() : 1;
  const totalDur = timelineEnd - timelineStart;

  function computeBar(ticket) {
    const start = new Date(ticket._rangeStart).getTime();
    const end   = new Date(ticket._rangeEnd).getTime();
    if (isNaN(start) || isNaN(end) || totalDur <= 0) return null;
    const left  = Math.max(0, (start - timelineStart) / totalDur);
    const width = Math.min(1 - left, (end - start) / totalDur);
    if (width <= 0) return null;
    return { left: left * TRACK_W, width: Math.max(width * TRACK_W, 14) };
  }

  const today = new Date();
  const todayLeft = totalDur > 0 ? ((today.getTime() - timelineStart) / totalDur) * TRACK_W : -1;

  // Header label helpers
  const hCell = (w, label, sub) => (
    <div style={{ ...cellBase, width: w, flexDirection: 'column', justifyContent: 'flex-end', padding: '3px 2px', background: '#f1f5f9', gap: 0 }}>
      <span style={{ fontSize: 7.5, fontWeight: 800, color: '#475569', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
      {sub && <span style={{ fontSize: 6.5, color: '#94a3b8', textAlign: 'center', lineHeight: 1 }}>{sub}</span>}
    </div>
  );

  return (
    <div style={{ width: PAGE_W, background: '#fff', color: '#111827', fontFamily: 'Inter,Segoe UI,Arial,sans-serif', fontSize: 10 }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 6px', borderBottom: '2px solid #1e40af', background: '#f8fafc' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', letterSpacing: '-0.01em' }}>Roadmap Geral</div>
          <div style={{ fontSize: 8, color: '#6b7280', marginTop: 1 }}>
            Exportado em {exportedAt} · {totalTickets} tickets{groupBy !== 'none' ? ` · Agrupado por ${groupBy}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logoClient && <img src={logoClient} alt="Client" style={{ height: 32, objectFit: 'contain', maxWidth: 100 }} crossOrigin="anonymous" />}
          {logoNtt && <img src={logoNtt} alt="NTT Data" style={{ height: 32, objectFit: 'contain', maxWidth: 100 }} crossOrigin="anonymous" />}
        </div>
      </div>

      {/* ── STATS SECTION — all big-number KPI boxes, grouped by vertical dividers ── */}
      {(() => {
        const allTickets = groupedRows.flatMap(g => g.tickets);
        const total = allTickets.length;
        const impedidos = allTickets.filter(t => t.impedimento === true).length;

        // By squad
        const squadMap = {};
        allTickets.forEach(t => {
          const sq = t.squadPrincipal || (t.grupoSuporte ? t.grupoSuporte.replace(/^\d+\s*-\s*/,'').trim() : '') || 'Sem squad';
          const k = sq.slice(0,11);
          squadMap[k] = (squadMap[k]||0)+1;
        });
        const squads = Object.entries(squadMap).sort((a,b) => b[1]-a[1]).slice(0,10);

        // By prioridade
        const PBGS = { 'Crise':'#dc2626','Alto':'#ea580c','Médio':'#eab308','Baixo':'#3b82f6','Muito baixo':'#c7d2fe','(sem prioridade)':'#e2e8f0' };
        const PTXTS = { 'Crise':'#fff','Alto':'#fff','Médio':'#713f12','Baixo':'#fff','Muito baixo':'#1e3a8a','(sem prioridade)':'#64748b' };
        const prioMap = {};
        allTickets.forEach(t => { const k = t.prioridadeInterna||'(sem prioridade)'; prioMap[k]=(prioMap[k]||0)+1; });
        const PRIO_ORD = ['Crise','Alto','Médio','Baixo','Muito baixo','(sem prioridade)'];
        const prios = Object.entries(prioMap).sort((a,b)=>{const ia=PRIO_ORD.indexOf(a[0]);const ib=PRIO_ORD.indexOf(b[0]);return(ia===-1?99:ia)-(ib===-1?99:ib);});

        // By natureza
        const natMap = {};
        allTickets.forEach(t => { const k = t.naturezaIniciativa||t.naturezaOperacao||'(sem natureza)'; natMap[k]=(natMap[k]||0)+1; });
        const nats = Object.entries(natMap).sort((a,b) => b[1]-a[1]).slice(0,8);

        // Squad × Prioridade stacked bar
        const SQ_PC = { 'Crise':'#dc2626','Alto':'#ea580c','Médio':'#eab308','Baixo':'#3b82f6','Muito baixo':'#c7d2fe','(sem prio)':'#cbd5e1' };
        const PR_ORD2 = ['Crise','Alto','Médio','Baixo','Muito baixo','(sem prio)'];
        const sqPrioMap = {};
        allTickets.forEach(t => {
          const sq = (t.squadPrincipal||(t.grupoSuporte?t.grupoSuporte.replace(/^\d+\s*-\s*/,'').trim():'')||'Sem squad').slice(0,12);
          const pr = t.prioridadeInterna||'(sem prio)';
          if (!sqPrioMap[sq]) sqPrioMap[sq] = {};
          sqPrioMap[sq][pr] = (sqPrioMap[sq][pr]||0)+1;
        });
        const sqList = Object.entries(sqPrioMap).map(([n,pd])=>({n,tot:Object.values(pd).reduce((s,v)=>s+v,0),pd})).sort((a,b)=>b.tot-a.tot).slice(0,8);
        const sqMax = sqList[0]?.tot || 1;

        const boxStyle = (bg, fw) => ({ background: bg, borderRadius: 5, padding: '4px 7px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: fw });
        const numStyle = (c, fs) => ({ fontSize: fs, fontWeight: 900, color: c, lineHeight: 1 });
        const lblStyle = (c) => ({ fontSize: 6.5, fontWeight: 700, color: c, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
        const divStyle = { width: 1, background: '#cbd5e1', alignSelf: 'stretch', margin: '0 8px' };
        const grpLbl = (t) => <div style={{ fontSize: 7, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{t}</div>;

        return (
          <div style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', padding: '8px 12px', display: 'flex', alignItems: 'stretch' }}>
            {/* Group 1: totals */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {grpLbl('Totais')}
              <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
                <div style={boxStyle('#1e40af', 60)}>
                  <span style={numStyle('#fff', 26)}>{total}</span>
                  <span style={lblStyle('#bfdbfe')}>Tickets</span>
                </div>
                <div style={boxStyle(impedidos > 0 ? '#991b1b' : '#374151', 60)}>
                  <span style={numStyle('#fff', 26)}>{impedidos}</span>
                  <span style={lblStyle(impedidos > 0 ? '#fca5a5' : '#9ca3af')}>Impedidos</span>
                </div>
              </div>
            </div>

            <div style={divStyle} />

            {/* Group 2: por natureza (big boxes same size as totals) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {grpLbl('Por Natureza')}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {nats.map(([name, count]) => {
                  const sh = name.length > 18 ? name.slice(0,18)+'…' : name;
                  return (
                    <div key={name} style={{ ...boxStyle('#e0f2fe', 62), maxWidth: 90 }}>
                      <span style={numStyle('#0369a1', 26)}>{count}</span>
                      <span style={{ fontSize: 6.5, fontWeight: 700, color: '#0891b2', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'center', lineHeight: 1.2, maxWidth: 86, whiteSpace: 'normal', wordBreak: 'break-word' }}>{sh}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={divStyle} />

            {/* Group 3: squad stacked bar chart with prioridade distribution */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              {grpLbl('Por Squad · Prioridade')}
              {sqList.map(({n, tot, pd}) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                  <span style={{ fontSize: 7, color: '#374151', width: 68, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{n}</span>
                  <div style={{ width: 120, height: 11, background: '#e2e8f0', borderRadius: 2, display: 'flex', overflow: 'hidden', flexShrink: 0 }}>
                    {PR_ORD2.filter(p => pd[p]).map(p => (
                      <div key={p} title={`${p}: ${pd[p]}`} style={{ width: `${(pd[p]/tot)*100}%`, height: '100%', background: SQ_PC[p], flexShrink: 0 }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 6.5, fontWeight: 800, color: '#374151', minWidth: 18, flexShrink: 0 }}>{tot}</span>
                  <span style={{ display: 'flex', gap: 3, flexWrap: 'nowrap' }}>
                    {PR_ORD2.filter(p => pd[p]).map(p => (
                      <span key={p} style={{ fontSize: 6, fontWeight: 700, color: SQ_PC[p] === '#eab308' ? '#854d0e' : SQ_PC[p] === '#c7d2fe' ? '#3730a3' : SQ_PC[p] === '#cbd5e1' ? '#475569' : '#fff', background: SQ_PC[p], borderRadius: 2, padding: '0 2px', lineHeight: '11px' }}>{pd[p]}</span>
                    ))}
                  </span>
                </div>
              ))}
              {/* Legend */}
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {PR_ORD2.map(p => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 1, background: SQ_PC[p] }} />
                    <span style={{ fontSize: 6, color: '#374151' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── COLUMN HEADERS ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1', minHeight: HEADER_H, background: '#f1f5f9' }}>
        {/* Title col */}
        {hCell(TITLE_W, 'Ticket', null)}
        {hCell(SQ_W, 'Squad', null)}
        {hCell(ST_W, 'Status', null)}
        {hCell(IMP_W, '⚠', 'Imp.')}
        {hCell(VUL_W, '🔒', 'Vuln.')}
        {hCell(PR_W, 'Prio', null)}
        {hCell(PC_W, '%C', 'Concl.')}
        {hCell(PT_W, '%T', 'Teste')}
        {hCell(TV_W, 'Vinc.', 'Tickets')}
        {hCell(NAT_W, 'Natureza', 'Iniciativa')}
        {/* Timeline cols */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {columns.map((col, idx) => (
            <div key={col.key} style={{
              width: COL_W, flexShrink: 0, borderRight: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
              padding: '3px 1px', background: idx % 2 === 0 ? '#f1f5f9' : '#e8edf5',
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#1e3a5f' }}>{col.label}</span>
              {col.sublabel && <span style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>{col.sublabel}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── ROWS ── */}
      {groupedRows.map((group, gi) => (
        <div key={group.key}>
          {group.label !== null && (
            <div style={{ display: 'flex', alignItems: 'center', background: '#dbeafe', borderBottom: '1px solid #bfdbfe', borderTop: gi > 0 ? '2px solid #93c5fd' : 'none', minHeight: 24, padding: '0 6px' }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{group.label}</span>
              <span style={{ fontSize: 8.5, color: '#3b82f6', marginLeft: 8 }}>({group.tickets.length})</span>
            </div>
          )}
          {group.tickets.map((ticket, ti) => {
            const bar = computeBar(ticket);
            const bs = barStyle(ticket);
            const eb = escopoBadge(ticket.escopo);
            const days = ticket._rangeStart && ticket._rangeEnd ? diffDays(ticket._rangeStart, ticket._rangeEnd) : null;
            const isImpedido = ticket.impedimento === true;
            const isVuln = ticket.demandaVulnerabilidade === 'Sim';
            const rowBg = isImpedido ? '#fff1f2' : (ti % 2 === 0 ? '#fff' : '#f8fafc');
            const squad = ticket.squadPrincipal || (ticket.grupoSuporte ? ticket.grupoSuporte.replace(/^\d+\s*-\s*/, '').trim().slice(0, 8) : '');
            const statusTxt = (ticket.status || '').length > 10 ? ticket.status.slice(0, 10) + '…' : (ticket.status || '');
            const sc = statusColor(ticket.status);
            const pb = prioBadge(ticket.prioridadeInterna);
            const pct = ticket.percentualConclusao != null ? `${ticket.percentualConclusao}%` : '';
            const pctT = ticket.percentualConclusaoTesteInterno != null ? `${ticket.percentualConclusaoTesteInterno}%` : '';

            return (
              <div key={ticket.issueKey || ti} style={{ display: 'flex', alignItems: 'center', height: ROW_H, borderBottom: '1px solid #f1f5f9', background: rowBg }}>

                {/* Title cell */}
                <div style={{ ...cellBase, width: TITLE_W, gap: 3, padding: '0 5px', justifyContent: 'flex-start' }}>
                  <div style={{ background: eb.bg, color: eb.text, fontSize: 7, fontWeight: 800, padding: '1px 3px', borderRadius: 3, flexShrink: 0, minWidth: 24, textAlign: 'center' }}>{eb.short}</div>
                  {isImpedido && <span style={{ fontSize: 8, flexShrink: 0 }}>⚠</span>}
                  <span style={{ fontSize: 7.5, fontWeight: 700, color: isImpedido ? '#dc2626' : '#1d4ed8', fontFamily: 'monospace', flexShrink: 0 }}>{String(ticket.issueKey || '').slice(-6)}</span>
                  <span style={{ fontSize: 7.5, color: isImpedido ? '#b91c1c' : '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ticket.summary || ''}</span>
                </div>

                {/* Squad */}
                <div style={{ ...cellBase, width: SQ_W, padding: '0 2px' }}>
                  {squad && <span style={{ fontSize: 7, fontWeight: 600, color: '#065f46', background: '#d1fae5', padding: '1px 3px', borderRadius: 3, textAlign: 'center', maxWidth: SQ_W - 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{squad}</span>}
                </div>

                {/* Status */}
                <div style={{ ...cellBase, width: ST_W, padding: '0 2px' }}>
                  <span style={{ fontSize: 7, fontWeight: 600, color: sc, textAlign: 'center', lineHeight: 1.2, maxWidth: ST_W - 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statusTxt}</span>
                </div>

                {/* Impedido */}
                <div style={{ ...cellBase, width: IMP_W }}>
                  {isImpedido && <span style={{ fontSize: 11 }}>⚠</span>}
                </div>

                {/* Vulnerabilidade */}
                <div style={{ ...cellBase, width: VUL_W }}>
                  {isVuln && <span style={{ fontSize: 11 }}>🔒</span>}
                </div>

                {/* Prioridade */}
                <div style={{ ...cellBase, width: PR_W, padding: '0 2px' }}>
                  {pb && <span style={{ fontSize: 7, fontWeight: 700, background: pb.bg, color: pb.color, padding: '1px 3px', borderRadius: 3, textAlign: 'center', whiteSpace: 'nowrap' }}>{pb.label}</span>}
                </div>

                {/* % Conclusão */}
                <div style={{ ...cellBase, width: PC_W }}>
                  <span style={{ fontSize: 7.5, fontWeight: 700, color: pct === '100%' ? '#16a34a' : '#374151' }}>{pct}</span>
                </div>

                {/* % Teste */}
                <div style={{ ...cellBase, width: PT_W }}>
                  <span style={{ fontSize: 7.5, fontWeight: 700, color: pctT === '100%' ? '#16a34a' : '#374151' }}>{pctT}</span>
                </div>

                {/* Tickets Vinculados */}
                {(() => {
                  const tv = ticket.ticketsVinculados;
                  const tvStr = Array.isArray(tv) ? tv.join(', ') : (tv || '');
                  const tvShort = tvStr.length > 18 ? tvStr.slice(0, 18) + '…' : tvStr;
                  return (
                    <div style={{ ...cellBase, width: TV_W, padding: '0 2px' }}>
                      <span style={{ fontSize: 6.5, color: '#4338ca', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-all' }}>{tvShort}</span>
                    </div>
                  );
                })()}

                {/* Natureza Iniciativa */}
                {(() => {
                  const nat = ticket.naturezaIniciativa || ticket.naturezaOperacao || '';
                  const natShort = nat.length > 20 ? nat.slice(0, 20) + '…' : nat;
                  return (
                    <div style={{ ...cellBase, width: NAT_W, padding: '0 2px' }}>
                      <span style={{ fontSize: 6.5, fontWeight: 600, color: '#0891b2', textAlign: 'center', lineHeight: 1.2 }}>{natShort}</span>
                    </div>
                  );
                })()}

                {/* Track */}
                <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden', background: ti % 2 === 0 ? 'transparent' : 'rgba(241,245,249,0.5)' }}>
                  {columns.map((col, ci) => (
                    <div key={ci} style={{ position: 'absolute', top: 0, bottom: 0, left: ci * COL_W, width: COL_W, borderRight: '1px solid #f1f5f9', background: ci % 2 === 0 ? 'transparent' : 'rgba(226,232,240,0.3)' }} />
                  ))}
                  {todayLeft >= 0 && todayLeft <= TRACK_W && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: todayLeft, width: 2, background: '#ef4444', opacity: 0.5 }} />
                  )}
                  {bar && (
                    <div style={{ position: 'absolute', top: 4, bottom: 4, left: bar.left, width: bar.width, background: bs.bg, border: bs.border === 'none' ? 'none' : bs.border, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 3, padding: '0 4px', overflow: 'hidden' }}>
                      {days && bar.width > 24 && <span style={{ fontSize: 7.5, fontWeight: 800, color: bs.textColor, whiteSpace: 'nowrap', flexShrink: 0 }}>{days}d</span>}
                      {bar.width > 70 && <span style={{ fontSize: 7, color: bs.textColor, opacity: 0.9, whiteSpace: 'nowrap' }}>{fmtDate(ticket._rangeStart)} → {fmtDate(ticket._rangeEnd)}</span>}
                    </div>
                  )}
                  {isImpedido && !bar && (
                    <div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 7.5, fontWeight: 800, color: '#dc2626' }}>Impedida</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── LEGEND FOOTER ── */}
      <div style={{ padding: '6px 12px', borderTop: '2px solid #cbd5e1', background: '#f8fafc', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { color: '#2563eb', border: 'none', label: 'Em Execução' },
          { color: '#22c55e', border: 'none', label: 'Concluída' },
          { color: '#7c3aed', border: 'none', label: 'Homologação' },
          { color: '#0891b2', border: 'none', label: 'Em Teste' },
          { color: 'rgba(234,179,8,0.3)', border: '1.5px dashed #ca8a04', label: 'Análise/Aguardando' },
          { color: 'rgba(239,68,68,0.15)', border: '1.5px dashed #dc2626', label: 'Impedida' },
        ].map(({ color, border, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 16, height: 8, borderRadius: 2, background: color, border: border === 'none' ? 'none' : border }} />
            <span style={{ fontSize: 7.5, color: '#374151' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 7, color: '#9ca3af' }}>⚠ Impedido · 🔒 Vulnerabilidade · Linha vermelha = hoje</div>
      </div>

      {/* ── IMPEDIDOS SECTION ── */}
      {(() => {
        const impTickets = groupedRows.flatMap(g => g.tickets).filter(t => t.impedimento === true);
        if (impTickets.length === 0) return null;
        const MOTIVO_W = PAGE_W - LEFT_W;
        return (
          <div style={{ marginTop: 0 }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#fef2f2', borderTop: '3px solid #dc2626', borderBottom: '2px solid #fecaca' }}>
              <span style={{ fontSize: 12 }}>🚧</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Itens Impedidos</span>
              <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 600 }}>({impTickets.length})</span>
            </div>
            {/* Column headers */}
            <div style={{ display: 'flex', borderBottom: '2px solid #fecaca', background: '#fff1f2', minHeight: 28 }}>
              {hCell(TITLE_W, 'Ticket', null)}
              {hCell(SQ_W, 'Squad', null)}
              {hCell(ST_W, 'Status', null)}
              {hCell(IMP_W, '⚠', 'Imp.')}
              {hCell(VUL_W, '🔒', 'Vuln.')}
              {hCell(PR_W, 'Prio', null)}
              {hCell(PC_W, '%C', 'Concl.')}
              {hCell(PT_W, '%T', 'Teste')}
              {hCell(TV_W, 'Vinc.', 'Tickets')}
              {hCell(NAT_W, 'Natureza', 'Inic.')}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: '4px 8px', borderRight: includeObservacao ? CB : 'none' }}>
                <span style={{ fontSize: 7.5, fontWeight: 800, color: '#991b1b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Motivo do Impedimento</span>
              </div>
              {includeObservacao && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: '4px 8px' }}>
                  <span style={{ fontSize: 7.5, fontWeight: 800, color: '#1e40af', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Observação</span>
                </div>
              )}
            </div>
            {/* Impedido rows */}
            {impTickets.map((ticket, ti) => {
              const eb = escopoBadge(ticket.escopo);
              const isVuln = ticket.demandaVulnerabilidade === 'Sim';
              const squad = ticket.squadPrincipal || (ticket.grupoSuporte ? ticket.grupoSuporte.replace(/^\d+\s*-\s*/, '').trim().slice(0, 8) : '');
              const statusTxt = (ticket.status || '').length > 10 ? ticket.status.slice(0, 10) + '…' : (ticket.status || '');
              const sc = statusColor(ticket.status);
              const pb = prioBadge(ticket.prioridadeInterna);
              const pct = ticket.percentualConclusao != null ? `${ticket.percentualConclusao}%` : '';
              const pctT = ticket.percentualConclusaoTesteInterno != null ? `${ticket.percentualConclusaoTesteInterno}%` : '';
              const motivo = ticket.observacaoAdicional || ticket.motivoImpedimento || '—';
              const rowBg = ti % 2 === 0 ? '#fff8f8' : '#fff1f2';
              return (
                <div key={ticket.issueKey || ti} style={{ display: 'flex', alignItems: 'center', minHeight: ROW_H, borderBottom: '1px solid #fecaca', background: rowBg }}>
                  <div style={{ ...cellBase, width: TITLE_W, gap: 3, padding: '0 5px', justifyContent: 'flex-start' }}>
                    <div style={{ background: eb.bg, color: eb.text, fontSize: 7, fontWeight: 800, padding: '1px 3px', borderRadius: 3, flexShrink: 0, minWidth: 24, textAlign: 'center' }}>{eb.short}</div>
                    <span style={{ fontSize: 8, flexShrink: 0 }}>⚠</span>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: '#dc2626', fontFamily: 'monospace', flexShrink: 0 }}>{String(ticket.issueKey || '').slice(-6)}</span>
                    <span style={{ fontSize: 7.5, color: '#b91c1c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ticket.summary || ''}</span>
                  </div>
                  <div style={{ ...cellBase, width: SQ_W, padding: '0 2px' }}>
                    {squad && <span style={{ fontSize: 7, fontWeight: 600, color: '#065f46', background: '#d1fae5', padding: '1px 3px', borderRadius: 3, maxWidth: SQ_W - 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{squad}</span>}
                  </div>
                  <div style={{ ...cellBase, width: ST_W, padding: '0 2px' }}>
                    <span style={{ fontSize: 7, fontWeight: 600, color: sc, maxWidth: ST_W - 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statusTxt}</span>
                  </div>
                  <div style={{ ...cellBase, width: IMP_W }}><span style={{ fontSize: 11 }}>⚠</span></div>
                  <div style={{ ...cellBase, width: VUL_W }}>{isVuln && <span style={{ fontSize: 11 }}>🔒</span>}</div>
                  <div style={{ ...cellBase, width: PR_W, padding: '0 2px' }}>
                    {pb && <span style={{ fontSize: 7, fontWeight: 700, background: pb.bg, color: pb.color, padding: '1px 3px', borderRadius: 3, whiteSpace: 'nowrap' }}>{pb.label}</span>}
                  </div>
                  <div style={{ ...cellBase, width: PC_W }}>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: pct === '100%' ? '#16a34a' : '#374151' }}>{pct}</span>
                  </div>
                  <div style={{ ...cellBase, width: PT_W }}>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: pctT === '100%' ? '#16a34a' : '#374151' }}>{pctT}</span>
                  </div>
                  {(() => {
                    const tv = ticket.ticketsVinculados;
                    const tvStr = Array.isArray(tv) ? tv.join(', ') : (tv || '');
                    const tvShort = tvStr.length > 18 ? tvStr.slice(0, 18) + '…' : tvStr;
                    return <div style={{ ...cellBase, width: TV_W, padding: '0 2px' }}><span style={{ fontSize: 6.5, color: '#4338ca', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.2 }}>{tvShort}</span></div>;
                  })()}
                  {(() => {
                    const nat = ticket.naturezaIniciativa || ticket.naturezaOperacao || '';
                    const natShort = nat.length > 20 ? nat.slice(0, 20) + '…' : nat;
                    return <div style={{ ...cellBase, width: NAT_W, padding: '0 2px' }}><span style={{ fontSize: 6.5, fontWeight: 600, color: '#0891b2', textAlign: 'center', lineHeight: 1.2 }}>{natShort}</span></div>;
                  })()}
                  {/* Motivo do impedimento */}
                  <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', padding: '4px 8px', overflow: 'hidden', borderRight: includeObservacao ? CB : 'none' }}>
                    <span style={{ fontSize: 8, color: '#7f1d1d', lineHeight: 1.3, wordBreak: 'break-word' }}>{motivo}</span>
                  </div>
                  {/* Observação (optional) */}
                  {includeObservacao && (
                    <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', padding: '4px 8px', overflow: 'hidden' }}>
                      <span style={{ fontSize: 8, color: '#1e3a5f', lineHeight: 1.3, wordBreak: 'break-word' }}>{ticket.observacao || ''}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// exportRoadmapGeralPdf — função principal exportada
// ══════════════════════════════════════════════════════════════════════════
async function getLogoUrl(storage, prefix) {
  try {
    const listRef = ref(storage, '/');
    const res = await listAll(listRef);
    const match = res.items.find(item => item.name.startsWith(prefix) && (item.name.endsWith('.png') || item.name.endsWith('.jpg') || item.name.endsWith('.jpeg')));
    if (match) return await getDownloadURL(match);
  } catch { /* ignore */ }
  return null;
}

export async function exportRoadmapGeralPdf({ groupedRows, columns, granularity, groupBy, ticketsWithRange, includeObservacao = false }) {
  const exportedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const totalTickets = ticketsWithRange.length;

  // Load logos from Firebase Storage
  const storage = getStorage();
  const [logoClient, logoNtt] = await Promise.all([
    getLogoUrl(storage, 'client_'),
    getLogoUrl(storage, 'ntt_'),
  ]);

  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;background:#fff;z-index:-9999;pointer-events:none;`;
  document.body.appendChild(container);

  const root = ReactDOM.createRoot(container);
  root.render(
    <GanttPdfContent
      groupedRows={groupedRows}
      columns={columns}
      granularity={granularity}
      groupBy={groupBy || 'none'}
      exportedAt={exportedAt}
      totalTickets={totalTickets}
      logoClient={logoClient}
      logoNtt={logoNtt}
      includeObservacao={includeObservacao}
    />
  );

  await new Promise(r => setTimeout(r, 900));

  try {
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#fff', logging: false, width: PAGE_W,
    });

    // A4 landscape: 297mm × 210mm
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const A4_W = 297;
    const A4_H = 210;
    const pageHeightPx = (A4_H / A4_W) * canvas.width;

    let yOffset = 0;
    let page = 0;
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
    pdf.save(`roadmap-geral-${dateStr}.pdf`);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
