/**
 * CicloPdfExport.jsx
 * Gera PDF A4 retrato do Planejamento de Ciclos.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ── Prioridade helper ──────────────────────────────────────────────────────
const PRIO_MAP = {
  'Crise':       { color: '#ef4444', arrow: '⬆⬆', bg: 'rgba(239,68,68,0.18)',    border: 'rgba(239,68,68,0.6)'   },
  'Alto':        { color: '#f97316', arrow: '↑',   bg: 'rgba(249,115,22,0.18)',  border: 'rgba(249,115,22,0.6)'  },
  'Medio':       { color: '#eab308', arrow: '—',   bg: 'rgba(234,179,8,0.18)',   border: 'rgba(234,179,8,0.6)'   },
  'Médio':       { color: '#eab308', arrow: '—',   bg: 'rgba(234,179,8,0.18)',   border: 'rgba(234,179,8,0.6)'   },
  'Baixo':       { color: '#3b82f6', arrow: '↓',   bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.6)'  },
  'Muito baixo': { color: '#93c5fd', arrow: '⬇⬇',  bg: 'rgba(147,197,253,0.18)', border: 'rgba(147,197,253,0.5)' },
};

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
  if (s.includes('conclu') || s.includes('done') || s.includes('resolv') || s.includes('fechad'))
    return { background: '#064e3b', color: '#6ee7b7', border: '1px solid #059669' };
  if (s.includes('execu'))
    return { background: '#052e16', color: '#4ade80', border: '1px solid #166534' };
  if (s.includes('em homolog'))
    return { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb' };
  if (s.includes('revis') && s.includes('homolog'))
    return { background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #6366f1' };
  if (s.includes('teste') || s.includes('em teste'))
    return { background: '#374151', color: '#d1d5db', border: '1px solid #6b7280' };
  if (s.includes('planejamento') || s.includes('aprovação') || s.includes('aprovacao'))
    return { background: '#1e3a5f', color: '#93c5fd', border: '1px solid #3b82f6' };
  if (s.includes('aguardando'))
    return { background: '#27272a', color: '#a1a1aa', border: '1px solid #52525b' };
  if (s.includes('análise') || s.includes('analise') || s.includes('t-shirt'))
    return { background: '#0c2a47', color: '#38bdf8', border: '1px solid #0284c7' };
  if (s.includes('cancel'))
    return { background: '#3f0000', color: '#fca5a5', border: '1px solid #7f1d1d' };
  return { background: '#27272a', color: '#d1d5db', border: '1px solid #52525b' };
}

function squadBadgeStyle(squad) {
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

function resolveSquadLabel(ticket) {
  if (ticket.squadPrincipal) return ticket.squadPrincipal;
  if (ticket._resolvedSquad) return ticket._resolvedSquad;
  const g = ticket.grupoSuporte || '';
  if (g) return g.replace(/^\d+\s*-\s*/, '').trim().slice(0, 15);
  return ticket.escopo || '';
}

// ══════════════════════════════════════════════════════════════════════════
// TicketPdfRow — linha de um ticket com todas as tags
// ══════════════════════════════════════════════════════════════════════════
function TicketPdfRow({ ticket, idx }) {
  const bg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.025)';

  // % Conclusão
  const rawPct = ticket.percentualConclusao ?? ticket.progressoDesenvolvimento ?? ticket.progress ?? null;
  const pct = rawPct != null ? Math.round(typeof rawPct === 'string' ? parseFloat(rawPct) || 0 : Number(rawPct) || 0) : null;
  const pctColor = pct != null ? progressColor(pct) : '#6b7280';

  // Squad
  const squad = resolveSquadLabel(ticket);
  const shortSquad = squad.length > 11 ? squad.slice(0, 11) + '…' : squad;

  // Issue key / type
  const keyStr = ticket.issueKey || ticket.key || ticket.id || '';
  const projectCode = keyStr.replace(/-\d+$/, '').slice(0, 4);
  const issueType = ticket.issuetype?.name || ticket.tipo || ticket.issueType || 'Solicitação';
  const shortType = issueType.length > 10 ? issueType.slice(0, 10) + '…' : issueType;

  // Status
  const status = ticket.status || '';
  const shortStatus = status.length > 15 ? status.slice(0, 14) + '…' : status;

  // Title
  const title = ticket.summary || ticket.titulo || ticket.title || '';
  const shortTitle = title.length > 55 ? title.slice(0, 55) + '…' : title;

  // Prioridade
  const prio = ticket.prioridadeInterna || ticket.priority || null;
  const prioMeta = prio ? (PRIO_MAP[prio] || null) : null;

  // Flags
  const impedido = ticket.impedimento === true;
  const vuln = ticket.demandaVulnerabilidade === 'Sim';

  const tagStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
    whiteSpace: 'nowrap', flexShrink: 0,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '3px 4px', background: bg,
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      minHeight: 24,
    }}>
      {/* Project type badge */}
      <div style={{ minWidth: 30, maxWidth: 30, fontSize: 8, fontWeight: 800, padding: '2px 2px', borderRadius: 3, textAlign: 'center', ...typeBadgeStyle(projectCode) }}>
        {projectCode || 'DEM'}
      </div>

      {/* Issue type */}
      <div style={{ minWidth: 50, maxWidth: 50, fontSize: 8, color: '#6b7280', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {shortType}
      </div>

      {/* Issue key */}
      <div style={{ minWidth: 80, maxWidth: 80, fontSize: 9, fontWeight: 700, color: '#60a5fa', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {keyStr}
      </div>

      {/* Title */}
      <div style={{ flex: 1, fontSize: 9.5, color: '#d1d5db', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {shortTitle}
      </div>

      {/* Prioridade */}
      {prioMeta ? (
        <div style={{ ...tagStyle, background: prioMeta.bg, color: prioMeta.color, border: `1px solid ${prioMeta.border}`, minWidth: 46 }}>
          {prioMeta.arrow} {prio}
        </div>
      ) : (
        <div style={{ minWidth: 46 }} />
      )}

      {/* Impedimento */}
      {impedido ? (
        <div style={{ ...tagStyle, background: 'rgba(234,179,8,0.18)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.5)', minWidth: 16 }}>
          🚧
        </div>
      ) : (
        <div style={{ minWidth: 16 }} />
      )}

      {/* Vulnerabilidade */}
      {vuln ? (
        <div style={{ ...tagStyle, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', minWidth: 16 }}>
          🔒
        </div>
      ) : (
        <div style={{ minWidth: 16 }} />
      )}

      {/* % Conclusão */}
      <div style={{ ...tagStyle, background: pct != null ? `${pctColor}22` : '#27272a', color: pct != null ? pctColor : '#6b7280', border: `1px solid ${pct != null ? pctColor + '55' : '#52525b'}`, minWidth: 34 }}>
        {pct != null ? `${pct}%` : '—'}
      </div>

      {/* Status */}
      <div style={{ ...tagStyle, minWidth: 86, maxWidth: 86, ...statusBadgeStyle(status) }}>
        {shortStatus}
      </div>

      {/* Squad */}
      {squad ? (
        <div style={{ ...tagStyle, minWidth: 60, maxWidth: 60, ...squadBadgeStyle(squad) }}>
          {shortSquad}
        </div>
      ) : (
        <div style={{ minWidth: 60 }} />
      )}
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
        padding: '5px 20px',
        background: isBacklog ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.03)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#e5e7eb' }}>{ciclo.nome}</span>
        {ciclo.dataInicio && ciclo.dataFim && (
          <span style={{ fontSize: 9, color: '#6b7280' }}>{ciclo.dataInicio} — {ciclo.dataFim}</span>
        )}
        {statusLabel && !isBacklog && (
          <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}55` }}>
            {statusLabel}
          </span>
        )}
        {isBacklog && (
          <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)' }}>
            Backlog
          </span>
        )}
        <span style={{ fontSize: 9, color: '#6b7280' }}>({tickets.length} ticket{tickets.length !== 1 ? 's' : ''})</span>
      </div>
      <div style={{ padding: '2px 8px 4px' }}>
        {tickets.map((ticket, i) => (
          <TicketPdfRow key={ticket.issueKey || ticket.id || i} ticket={ticket} idx={i} />
        ))}
      </div>
    </div>
  );
}

// Ordem do workflow — determina a sequência dos status cards no cabeçalho
const WORKFLOW_ORDER = [
  'Aguardando Aprovação Gestor Imediato',
  'Escrita de Requerimento',
  'Validação Comitê',
  'Aguardando Solicitante',
  'Detalhamento de Requisitos',
  'Aguardando Profissional de TI',
  'Aguardando Demanda/Projeto',
  'Revisão de Requisitos de Projeto',
  'Análise e T-Shirt',
  'Aguardando Análise Técnica',
  'Aguardando Aprovação T-Shirt',
  'Planejamento',
  'Aprovação de Planejamento',
  'Aguardando Planejamento',
  'Em Execução',
  'Em Teste',
  'Em homologação',
  'Revisão de homologação',
  'Etapa de KT',
  'Aguardando Mudança',
  'Concluída',
];

// ══════════════════════════════════════════════════════════════════════════
// PdfContent — raiz do documento capturado pelo html2canvas
// ══════════════════════════════════════════════════════════════════════════
function PdfContent({ ciclos, getCicloTickets, filteredTickets, backlogTickets, exportedAt }) {
  // Status cards dinâmicos — ordenados conforme WORKFLOW_ORDER
  const statusCounts = {};
  filteredTickets.forEach(t => {
    if (t.status) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  });

  // Ordena pelos status do workflow; status desconhecidos ficam no final
  const statusCards = Object.entries(statusCounts)
    .sort((a, b) => {
      const ia = WORKFLOW_ORDER.indexOf(a[0]);
      const ib = WORKFLOW_ORDER.indexOf(b[0]);
      if (ia === -1 && ib === -1) return b[1] - a[1]; // ambos desconhecidos: por contagem
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .slice(0, 10);

  return (
    <div style={{ width: 794, background: '#111827', color: '#f9fafb', fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", fontSize: 11 }}>
      {/* ── CABEÇALHO ─────────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 12px', borderBottom: '2px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, #0f172a 0%, #1a2035 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f9fafb', letterSpacing: '-0.02em' }}>Planejamento de Ciclos</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
              Exportado em {exportedAt} · {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} exibidos
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#4b5563', textAlign: 'right', paddingTop: 4 }}>
            {ciclos.length} ciclo{ciclos.length !== 1 ? 's' : ''} · {backlogTickets.length} no backlog
          </div>
        </div>

        {/* ── CARDS DE STATUS DINÂMICOS ── */}
        {statusCards.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
            {statusCards.map(([status, count]) => {
              const st = statusBadgeStyle(status);
              return (
                <div key={status} style={{
                  flex: 1, minWidth: 0,
                  background: st.background,
                  border: st.border,
                  borderRadius: 6,
                  padding: '6px 4px 5px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: count > 99 ? 20 : count > 9 ? 24 : 28, fontWeight: 900, lineHeight: 1, color: st.color, marginBottom: 3 }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 7, fontWeight: 600, color: st.color, lineHeight: 1.25, minHeight: 18 }}>
                    {status.length > 18 ? status.slice(0, 17) + '…' : status}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CICLOS + TICKETS ─────────────────────────────────────── */}
      <div>
        {ciclos.map(ciclo => {
          const tickets = getCicloTickets(ciclo);
          if (!tickets || tickets.length === 0) return null;
          return <CicloPdfSection key={ciclo.id} ciclo={ciclo} tickets={tickets} isBacklog={false} />;
        })}
        {backlogTickets.length > 0 && (
          <CicloPdfSection ciclo={{ nome: 'Backlog', ticketKeys: [] }} tickets={backlogTickets} isBacklog={true} />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// exportCicloPdf — função principal exportada
// ══════════════════════════════════════════════════════════════════════════
export async function exportCicloPdf({ ciclos, getCicloTickets, filteredTickets, backlogTickets }) {
  const exportedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#111827;z-index:-9999;pointer-events:none;';
  document.body.appendChild(container);

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

  await new Promise(r => setTimeout(r, 700));

  try {
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#111827', logging: false, width: 794,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const A4_W = 210;
    const A4_H = 297;
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
      ctx.drawImage(canvas, 0, -yOffset);
      const imgData = pageCanvas.toDataURL('image/png');
      const sliceMmH = (sliceH / canvas.width) * A4_W;
      pdf.addImage(imgData, 'PNG', 0, 0, A4_W, sliceMmH);
      yOffset += sliceH;
      page++;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    pdf.save(`planejamento-ciclos-${dateStr}.pdf`);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
