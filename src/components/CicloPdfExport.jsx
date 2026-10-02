/**
 * CicloPdfExport.jsx
 * Gera PDF A4 retrato do Planejamento de Ciclos.
 * Uso: import { exportCicloPdf } from './CicloPdfExport';
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ── Status cards do cabeçalho (ordem do wireframe / WORKFLOW_STEPS) ─────────
const PDF_STATUS_CARDS = [
  { status: 'Análise e T-Shirt',            label: 'Análise e T-Shirt',      fila: 'NTT Data'      },
  { status: 'Planejamento',                 label: 'Planejamento',            fila: 'NTT Data'      },
  { status: 'Aprovação de Planejamento',    label: 'Aprovação Planejamento',  fila: 'CPFL'          },
  { status: 'Em Execução',                  label: 'Em Execução',             fila: 'NTT Data'      },
  { status: 'Em Teste',                     label: 'Em Teste',                fila: 'CPFL'          },
  { status: 'Em homologação',               label: 'Em homologação',          fila: 'CPFL'          },
  { status: 'Revisão de homologação',       label: 'Revisão de Homologação',  fila: 'NTT Data'      },
  { status: 'Aguardando Mudança',           label: 'Aguardando Mudança',      fila: 'NTT Data'      },
];

// ── helpers de estilo ─────────────────────────────────────────────────────
function filaStyle(fila) {
  if ((fila || '').includes('NTT'))
    return { background: 'rgba(56,189,248,0.2)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.5)' };
  if ((fila || '').includes('Prevista'))
    return { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' };
  return { background: 'rgba(249,115,22,0.2)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.5)' };
}

function statusBadgeStyle(status) {
  const s = (status || '').toLowerCase();
  if (s === 'em execução' || s.startsWith('em execu'))
    return { background: '#052e16', color: '#4ade80', border: '1px solid #166534' };
  if (s.includes('execu'))
    return { background: '#064e3b', color: '#34d399', border: '1px solid #059669' };
  if (s.includes('homolog'))
    return { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb' };
  if (s.includes('revis'))
    return { background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #6366f1' };
  if (s.includes('teste'))
    return { background: '#374151', color: '#d1d5db', border: '1px solid #6b7280' };
  if (s.includes('planejamento') || s.includes('aprovação') || s.includes('aprovacao'))
    return { background: '#1e3a5f', color: '#93c5fd', border: '1px solid #3b82f6' };
  if (s.includes('conclu'))
    return { background: '#064e3b', color: '#6ee7b7', border: '1px solid #059669' };
  if (s.includes('aguardando'))
    return { background: '#27272a', color: '#a1a1aa', border: '1px solid #52525b' };
  if (s.includes('análise') || s.includes('analise') || s.includes('t-shirt'))
    return { background: '#0c2a47', color: '#38bdf8', border: '1px solid #0284c7' };
  return { background: '#27272a', color: '#d1d5db', border: '1px solid #52525b' };
}

function escopoBadgeStyle(squad) {
  const palette = ['#38bdf8','#818cf8','#34d399','#fb923c','#f472b6','#a78bfa','#fbbf24','#94a3b8'];
  if (!squad) return { background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)' };
  const idx = [...squad].reduce((acc, c) => acc + c.charCodeAt(0), 0) % palette.length;
  const c = palette[idx];
  return { background: `${c}22`, color: c, border: `1px solid ${c}66` };
}

function progressColor(pct) {
  if (pct >= 100) return '#22c55e';
  if (pct >= 70)  return '#84cc16';
  if (pct >= 30)  return '#f59e0b';
  return '#ef4444';
}

function typeBadgeStyle(code) {
  const c = (code || '').toLowerCase();
  if (c.includes('inc') || c.includes('bug'))
    return { background: '#450a0a', color: '#f87171', border: '1px solid #991b1b' };
  return { background: '#0c2a47', color: '#38bdf8', border: '1px solid #0284c7' };
}

// ══════════════════════════════════════════════════════════════════════════
// TicketPdfRow
// ══════════════════════════════════════════════════════════════════════════
function TicketPdfRow({ ticket, idx }) {
  const bg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.025)';
  const rawPct = ticket.progressoDesenvolvimento ?? ticket.progressPercent ?? ticket.progress ?? 0;
  const pct = Math.round(typeof rawPct === 'string' ? parseFloat(rawPct) : rawPct);
  const pctColor = progressColor(pct);
  const squad = ticket.squad || ticket.escopo || ticket.squadLabel || '';
  const keyStr = ticket.issueKey || ticket.key || ticket.id || '';
  const projectCode = keyStr.replace(/-\d+$/, '').slice(0, 4);
  const issueType = ticket.issuetype?.name || ticket.tipo || ticket.issueType || 'Solicitação';
  const shortType = issueType.length > 11 ? issueType.slice(0, 11) + '…' : issueType;
  const status = ticket.status || '';
  const title = ticket.summary || ticket.titulo || ticket.title || '';
  const shortTitle = title.length > 65 ? title.slice(0, 65) + '…' : title;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 4px',
      background: bg,
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      minHeight: 26,
    }}>
      {/* Project type badge */}
      <div style={{
        minWidth: 32, maxWidth: 32,
        fontSize: 8, fontWeight: 800,
        padding: '2px 3px', borderRadius: 3,
        textAlign: 'center', letterSpacing: '0.02em',
        ...typeBadgeStyle(projectCode),
      }}>
        {projectCode || 'DEM'}
      </div>

      {/* Issue type */}
      <div style={{
        minWidth: 54, maxWidth: 54,
        fontSize: 8, color: '#6b7280',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {shortType}
      </div>

      {/* Issue key */}
      <div style={{
        minWidth: 82, maxWidth: 82,
        fontSize: 9, fontWeight: 700, color: '#60a5fa',
        overflow: 'hidden', whiteSpace: 'nowrap',
      }}>
        {keyStr}
      </div>

      {/* Title */}
      <div style={{
        flex: 1, fontSize: 10, color: '#d1d5db',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {shortTitle}
      </div>

      {/* Progress */}
      <div style={{ minWidth: 40, maxWidth: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: pctColor }}>{pct}%</div>
        <div style={{ width: 36, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pctColor, borderRadius: 2 }} />
        </div>
      </div>

      {/* Status */}
      <div style={{
        minWidth: 92, maxWidth: 92,
        fontSize: 8, fontWeight: 600,
        padding: '2px 5px', borderRadius: 4,
        textAlign: 'center',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        ...statusBadgeStyle(status),
      }}>
        {status.length > 17 ? status.slice(0, 16) + '…' : status}
      </div>

      {/* Squad/Escopo */}
      <div style={{
        minWidth: 70, maxWidth: 70,
        fontSize: 8, fontWeight: 700,
        padding: '2px 5px', borderRadius: 4,
        textAlign: 'center',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        ...escopoBadgeStyle(squad),
      }}>
        {squad.length > 11 ? squad.slice(0, 11) + '…' : squad}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CicloPdfSection
// ══════════════════════════════════════════════════════════════════════════
function CicloPdfSection({ ciclo, tickets, isBacklog }) {
  const statusLabel =
    ciclo.status === 'ativo'      ? 'Ativo'     :
    ciclo.status === 'concluido'  ? 'Concluído' :
    ciclo.status || '';
  const statusColor =
    ciclo.status === 'ativo'      ? '#22c55e' :
    ciclo.status === 'concluido'  ? '#60a5fa' :
    '#9ca3af';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 20px',
        background: isBacklog ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.03)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#e5e7eb' }}>{ciclo.nome}</span>
        {ciclo.dataInicio && ciclo.dataFim && (
          <span style={{ fontSize: 9, color: '#6b7280' }}>{ciclo.dataInicio} — {ciclo.dataFim}</span>
        )}
        {statusLabel && !isBacklog && (
          <span style={{
            fontSize: 8, fontWeight: 700,
            padding: '1px 7px', borderRadius: 8,
            background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55`,
          }}>
            {statusLabel}
          </span>
        )}
        {isBacklog && (
          <span style={{
            fontSize: 8, fontWeight: 700,
            padding: '1px 7px', borderRadius: 8,
            background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)',
          }}>
            Backlog
          </span>
        )}
        <span style={{ fontSize: 9, color: '#6b7280' }}>
          ({tickets.length} ticket{tickets.length !== 1 ? 's' : ''})
        </span>
      </div>
      <div style={{ padding: '2px 8px 4px' }}>
        {tickets.map((ticket, i) => (
          <TicketPdfRow key={ticket.issueKey || ticket.id || i} ticket={ticket} idx={i} />
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PdfContent – raiz do documento que será capturado pelo html2canvas
// ══════════════════════════════════════════════════════════════════════════
function PdfContent({ ciclos, getCicloTickets, filteredTickets, backlogTickets, exportedAt }) {
  const statusCounts = {};
  filteredTickets.forEach(t => {
    const s = t.status;
    if (s) statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  return (
    <div style={{
      width: 794,
      background: '#111827',
      color: '#f9fafb',
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      fontSize: 11,
    }}>
      {/* ── CABEÇALHO ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 20px 12px',
        borderBottom: '2px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(135deg, #0f172a 0%, #1a2035 100%)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f9fafb', letterSpacing: '-0.02em' }}>
              Planejamento de Ciclos
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
              Exportado em {exportedAt} · {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} exibidos
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#4b5563', textAlign: 'right', paddingTop: 4 }}>
            {ciclos.length} ciclo{ciclos.length !== 1 ? 's' : ''} · {backlogTickets.length} no backlog
          </div>
        </div>

        {/* ── CARDS DE STATUS (números grandes) ── */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
          {PDF_STATUS_CARDS.map(card => {
            const count = statusCounts[card.status] || 0;
            const isNTT = card.fila === 'NTT Data';
            const borderColor = isNTT ? 'rgba(56,189,248,0.65)' : card.fila === 'CPFL Prevista' ? 'rgba(251,191,36,0.5)' : 'rgba(249,115,22,0.65)';
            const bg = isNTT ? 'rgba(56,189,248,0.07)' : card.fila === 'CPFL Prevista' ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.07)';
            return (
              <div key={card.status} style={{
                flex: 1,
                minWidth: 0,
                background: bg,
                border: `1px solid ${borderColor}`,
                borderRadius: 6,
                padding: '6px 4px 5px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: count > 99 ? 20 : count > 9 ? 24 : 28,
                  fontWeight: 900, lineHeight: 1, color: '#f9fafb', marginBottom: 3,
                }}>
                  {count}
                </div>
                <div style={{
                  fontSize: 7.5, fontWeight: 600, color: '#9ca3af',
                  lineHeight: 1.25, marginBottom: 4, minHeight: 19,
                }}>
                  {card.label}
                </div>
                <div style={{
                  fontSize: 6.5, fontWeight: 700,
                  padding: '1px 3px', borderRadius: 3, display: 'inline-block',
                  ...filaStyle(card.fila),
                }}>
                  {card.fila}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CICLOS + TICKETS ────────────────────────────────────────── */}
      <div>
        {ciclos.map(ciclo => {
          const tickets = getCicloTickets(ciclo);
          if (!tickets || tickets.length === 0) return null;
          return <CicloPdfSection key={ciclo.id} ciclo={ciclo} tickets={tickets} isBacklog={false} />;
        })}
        {backlogTickets.length > 0 && (
          <CicloPdfSection
            ciclo={{ nome: 'Backlog', ticketKeys: [] }}
            tickets={backlogTickets}
            isBacklog={true}
          />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// exportCicloPdf – função principal exportada
// ══════════════════════════════════════════════════════════════════════════
export async function exportCicloPdf({ ciclos, getCicloTickets, filteredTickets, backlogTickets }) {
  const exportedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // 1. Container off-screen
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'width:794px',
    'background:#111827',
    'z-index:-9999',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(container);

  // 2. Renderiza o conteúdo React
  const root = ReactDOM.createRoot(container);
  root.render(
    <PdfContent
      ciclos={ciclos}
      getCicloTickets={getCicloTickets}
      filteredTickets={filteredTickets}
      backlogTickets={backlogTickets}
      exportedAt={exportedAt}
    />
  );

  // 3. Aguarda render completo
  await new Promise(r => setTimeout(r, 600));

  try {
    // 4. Captura com html2canvas (scale 2 para boa resolução)
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#111827',
      logging: false,
      width: 794,
    });

    // 5. Cria PDF A4 retrato (mm)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const A4_W = 210;  // mm
    const A4_H = 297;  // mm

    const imgW = A4_W;
    const imgH = (canvas.height / canvas.width) * imgW;

    // 6. Divide em páginas se necessário
    let yOffset = 0;
    const pageHeightPx = (A4_H / A4_W) * canvas.width; // altura de uma página em px do canvas

    let page = 0;
    while (yOffset < canvas.height) {
      if (page > 0) pdf.addPage();

      const sliceH = Math.min(pageHeightPx, canvas.height - yOffset);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, -yOffset);

      const imgData = pageCanvas.toDataURL('image/png');
      const sliceMmH = (sliceH / canvas.width) * A4_W;
      pdf.addImage(imgData, 'PNG', 0, 0, A4_W, sliceMmH);

      yOffset += sliceH;
      page++;
    }

    // 7. Download
    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`planejamento-ciclos-${dateStr}.pdf`);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
