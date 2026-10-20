/**
 * RoadmapGeralPdfExport.jsx
 * Gera PDF A4 paisagem do Roadmap Geral — layout Gantt.
 * Colunas esquerda: escopo | key/título | squad | status | ⚠ | 🔒 | prio | %C | %T
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
const TITLE_W = 170;  // escopo badge + key + title
const SQ_W    = 52;   // squad
const ST_W    = 60;   // status
const IMP_W   = 18;   // 🚧 impedido icon
const VUL_W   = 18;   // 🔒 vulnerabilidade icon
const PR_W    = 46;   // prioridade
const PC_W    = 28;   // % conclusão
const PT_W    = 28;   // % teste interno
const LEFT_W  = TITLE_W + SQ_W + ST_W + IMP_W + VUL_W + PR_W + PC_W + PT_W; // 420
const TRACK_W = PAGE_W - LEFT_W;  // 860
const ROW_H   = 26;
const HEADER_H = 44;

// Cell border style
const CB = '1px solid #e2e8f0';
const cellBase = { flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: CB, overflow: 'hidden' };

// ── GanttPdfContent ─────────────────────────────────────────────────────────
function GanttPdfContent({ groupedRows, columns, granularity, groupBy, exportedAt, totalTickets }) {
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
        <div style={{ fontSize: 10, fontWeight: 700, color: '#1e40af' }}>NTT Data · SGT</div>
      </div>

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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// exportRoadmapGeralPdf — função principal exportada
// ══════════════════════════════════════════════════════════════════════════
export async function exportRoadmapGeralPdf({ groupedRows, columns, granularity, groupBy, ticketsWithRange }) {
  const exportedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const totalTickets = ticketsWithRange.length;

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
