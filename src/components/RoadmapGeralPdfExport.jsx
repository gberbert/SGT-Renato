/**
 * RoadmapGeralPdfExport.jsx
 * Gera PDF A4 paisagem do Roadmap Geral — layout Gantt similar ao anexo de referência.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ── helpers ────────────────────────────────────────────────────────────────
const ESCOPO_COLORS = {
  'PROBLEMAS':     { bg: '#dc2626', text: '#fff', short: 'PROB' },
  'DEMANDA FAST':  { bg: '#ea580c', text: '#fff', short: 'FAST' },
  'DEMANDA':       { bg: '#2563eb', text: '#fff', short: 'DEM' },
  'INCIDENTE':     { bg: '#16a34a', text: '#fff', short: 'INC' },
  'SOLICITACAO':   { bg: '#0891b2', text: '#fff', short: 'SOL' },
  'CATALOGO':      { bg: '#7c3aed', text: '#fff', short: 'CAT' },
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
  if (ticket.impedimento === true) {
    return { bg: 'rgba(239,68,68,0.12)', border: '2px dashed #dc2626', textColor: '#dc2626' };
  }
  if (s.includes('conclu') || s.includes('resolv') || s.includes('done') || s.includes('fechad')) {
    return { bg: '#22c55e', border: 'none', textColor: '#fff' };
  }
  if (s.includes('execu') || s.includes('andament') || s.includes('progress') || s.includes('atendiment')) {
    return { bg: '#2563eb', border: 'none', textColor: '#fff' };
  }
  if (s.includes('homolog') || s.includes('revis')) {
    return { bg: '#7c3aed', border: 'none', textColor: '#fff' };
  }
  if (s.includes('teste') || s.includes('test')) {
    return { bg: '#0891b2', border: 'none', textColor: '#fff' };
  }
  if (s.includes('anali') || s.includes('t-shirt') || s.includes('planej') || s.includes('aprova')) {
    return { bg: 'rgba(234,179,8,0.15)', border: '2px dashed #ca8a04', textColor: '#92400e' };
  }
  if (s.includes('aguard') || s.includes('pendent')) {
    return { bg: 'rgba(234,179,8,0.15)', border: '2px dashed #d97706', textColor: '#92400e' };
  }
  return { bg: '#1d4ed8', border: 'none', textColor: '#fff' };
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

// ── GanttPdfContent ─────────────────────────────────────────────────────────
function GanttPdfContent({ groupedRows, columns, granularity, groupBy, exportedAt, totalTickets }) {
  // Page dimensions (landscape A4 at 96dpi ≈ 1123 × 794)
  const PAGE_W = 1052;
  const LABEL_W = 210;
  const TRACK_W = PAGE_W - LABEL_W - 1;
  const COL_W = columns.length > 0 ? Math.max(30, Math.floor(TRACK_W / columns.length)) : 80;
  const ROW_H = 24;
  const HEADER_H = 42;

  const timelineStart = columns.length > 0 ? columns[0].start.getTime() : 0;
  const timelineEnd = columns.length > 0 ? columns[columns.length - 1].end.getTime() : 1;
  const totalDur = timelineEnd - timelineStart;

  function computeBar(ticket) {
    const start = new Date(ticket._rangeStart).getTime();
    const end = new Date(ticket._rangeEnd).getTime();
    if (isNaN(start) || isNaN(end) || totalDur <= 0) return null;
    const left = Math.max(0, (start - timelineStart) / totalDur);
    const width = Math.min(1 - left, (end - start) / totalDur);
    if (width <= 0) return null;
    return { left: left * TRACK_W, width: Math.max(width * TRACK_W, 18) };
  }

  const today = new Date();
  const todayLeft = totalDur > 0 ? ((today.getTime() - timelineStart) / totalDur) * TRACK_W : -1;

  return (
    <div style={{
      width: PAGE_W,
      background: '#fff',
      color: '#111827',
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      fontSize: 10,
    }}>
      {/* ── PAGE HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 8px', borderBottom: '2px solid #1e40af', background: '#f8fafc' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f', letterSpacing: '-0.01em' }}>Roadmap Geral</div>
          <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>
            Exportado em {exportedAt} · {totalTickets} tickets{groupBy !== 'none' ? ` · Agrupado por ${groupBy}` : ''}
          </div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', textAlign: 'right' }}>
          NTT Data · SGT
        </div>
      </div>

      {/* ── TIMELINE HEADER ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1', background: '#f1f5f9', minHeight: HEADER_H }}>
        {/* Label column header */}
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'flex-end', padding: '6px 8px' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Ticket</span>
        </div>
        {/* Week columns */}
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
          {columns.map((col, idx) => (
            <div key={col.key} style={{
              width: COL_W, flexShrink: 0,
              borderRight: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end',
              padding: '4px 2px',
              background: idx % 2 === 0 ? '#f1f5f9' : '#e8edf5',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#1e3a5f' }}>{col.label}</span>
              {col.sublabel && <span style={{ fontSize: 8, color: '#94a3b8', marginTop: 1 }}>{col.sublabel}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── ROWS ── */}
      {groupedRows.map((group, gi) => (
        <div key={group.key}>
          {/* Group header */}
          {group.label !== null && (
            <div style={{
              display: 'flex', alignItems: 'center',
              background: '#dbeafe', borderBottom: '1px solid #bfdbfe',
              borderTop: gi > 0 ? '2px solid #93c5fd' : 'none',
              minHeight: 26, padding: '0 8px',
            }}>
              <div style={{ width: LABEL_W - 8, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {group.label}
                </span>
                <span style={{ fontSize: 9, color: '#3b82f6', marginLeft: 8 }}>({group.tickets.length})</span>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid #bfdbfe' }} />
            </div>
          )}

          {/* Ticket rows */}
          {group.tickets.map((ticket, ti) => {
            const bar = computeBar(ticket);
            const bs = barStyle(ticket);
            const eb = escopoBadge(ticket.escopo);
            const days = ticket._rangeStart && ticket._rangeEnd ? diffDays(ticket._rangeStart, ticket._rangeEnd) : null;
            const isImpedido = ticket.impedimento === true;
            const rowBg = isImpedido ? '#fff1f2' : (ti % 2 === 0 ? '#fff' : '#f8fafc');

            return (
              <div key={ticket.issueKey || ti} style={{
                display: 'flex', alignItems: 'center',
                height: ROW_H, borderBottom: '1px solid #f1f5f9',
                background: rowBg,
              }}>
                {/* Label */}
                <div style={{
                  width: LABEL_W, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '0 6px', borderRight: '1px solid #e2e8f0',
                  height: '100%', overflow: 'hidden',
                }}>
                  {/* Escopo badge */}
                  <div style={{
                    background: eb.bg, color: eb.text,
                    fontSize: 7, fontWeight: 800,
                    padding: '1px 4px', borderRadius: 3,
                    flexShrink: 0, minWidth: 26, textAlign: 'center',
                  }}>
                    {eb.short}
                  </div>
                  {/* Impedido icon */}
                  {isImpedido && (
                    <span style={{ fontSize: 9, flexShrink: 0 }}>⚠</span>
                  )}
                  {/* Issue key */}
                  <span style={{
                    fontSize: 8.5, fontWeight: 700,
                    color: isImpedido ? '#dc2626' : '#1d4ed8',
                    flexShrink: 0, fontFamily: 'monospace',
                  }}>
                    {String(ticket.issueKey || '').replace(/^[A-Z]+-/, '').slice(0, 6)}
                  </span>
                  {/* Title */}
                  <span style={{
                    fontSize: 8.5, color: isImpedido ? '#b91c1c' : '#374151',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {ticket.summary || ''}
                  </span>
                </div>

                {/* Track */}
                <div style={{
                  flex: 1, position: 'relative', height: '100%',
                  overflow: 'hidden',
                  background: ti % 2 === 0 ? 'transparent' : 'rgba(241,245,249,0.5)',
                }}>
                  {/* Alternating column backgrounds */}
                  {columns.map((col, ci) => (
                    <div key={ci} style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: ci * COL_W, width: COL_W,
                      borderRight: '1px solid #f1f5f9',
                      background: ci % 2 === 0 ? 'transparent' : 'rgba(226,232,240,0.3)',
                    }} />
                  ))}
                  {/* Today marker */}
                  {todayLeft >= 0 && todayLeft <= TRACK_W && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: todayLeft, width: 2, background: '#ef4444', opacity: 0.5,
                    }} />
                  )}
                  {/* Bar */}
                  {bar && (
                    <div style={{
                      position: 'absolute',
                      top: 4, bottom: 4,
                      left: bar.left,
                      width: bar.width,
                      background: bs.bg,
                      border: bs.border === 'none' ? 'none' : bs.border,
                      borderRadius: 3,
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '0 4px', overflow: 'hidden',
                    }}>
                      {/* Duration */}
                      {days && bar.width > 28 && (
                        <span style={{ fontSize: 8, fontWeight: 800, color: bs.textColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {days}d
                        </span>
                      )}
                      {/* Date range (show only if bar is wide enough) */}
                      {bar.width > 80 && (
                        <span style={{ fontSize: 7.5, color: bs.textColor, opacity: 0.9, whiteSpace: 'nowrap' }}>
                          {fmtDate(ticket._rangeStart)} → {fmtDate(ticket._rangeEnd)}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Impedida label outside bar (when bar too small or no bar) */}
                  {isImpedido && !bar && (
                    <div style={{ position: 'absolute', left: 4, top: 4, bottom: 4, display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#dc2626' }}>Impedida</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── LEGEND FOOTER ── */}
      <div style={{ padding: '8px 12px', borderTop: '2px solid #cbd5e1', background: '#f8fafc', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { color: '#2563eb', border: 'none', label: 'Em Execução' },
          { color: '#22c55e', border: 'none', label: 'Concluída' },
          { color: '#7c3aed', border: 'none', label: 'Homologação' },
          { color: '#0891b2', border: 'none', label: 'Em Teste' },
          { color: 'rgba(234,179,8,0.3)', border: '1.5px dashed #ca8a04', label: 'Análise / Aguardando' },
          { color: 'rgba(239,68,68,0.15)', border: '1.5px dashed #dc2626', label: 'Impedida' },
        ].map(({ color, border, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 20, height: 10, borderRadius: 2, background: color, border: border === 'none' ? 'none' : border }} />
            <span style={{ fontSize: 8.5, color: '#374151' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 8, color: '#9ca3af' }}>
          Linha vermelha vertical = hoje
        </div>
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
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1052px;background:#fff;z-index:-9999;pointer-events:none;';
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

  await new Promise(r => setTimeout(r, 800));

  try {
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#fff', logging: false, width: 1052,
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
