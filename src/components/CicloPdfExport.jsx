/**
 * CicloPdfExport.jsx — PDF A4 paisagem, fundo branco, via jsPDF + autoTable.
 * Aba "ciclos"   → agrupa por ciclo
 * Aba "workflow" → agrupa por status na ordem do workflow (usando escopoFilter)
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Workflow order ────────────────────────────────────────────────────────
const WF_DEMANDA = [
  'Aguardando Aprovação Gestor Imediato','Escrita de Requerimento','Validação Comitê',
  'Aguardando Solicitante','Detalhamento de Requisitos','Aguardando Profissional de TI',
  'Aguardando Demanda/Projeto','Revisão de Requisitos de Projeto','Análise e T-Shirt',
  'Aguardando Análise Técnica','Aguardando Aprovação T-Shirt','Planejamento',
  'Aprovação de Planejamento','Aguardando Planejamento','Em Execução','Em Teste',
  'Em homologação','Revisão de homologação','Etapa de KT','Aguardando Mudança','Concluída',
];
const WF_FAST = [
  'Aguardando Atendimento','Em Atendimento','Resolvido','Reaberto','Fechada','Canceled',
  'Aprovação Demanda Fast','Aguardando Aprovação Gestor','Aguardando Aprovação Tecnica',
  'Aguardando Aprovação Adicional','Aprovado','Reprovado','Agendado','Aguardando Compra',
  'Aguardando Validação','Aguardando Problema','Aguardando Mudança','Aguardando Fornecedor',
  'Aguardando Solicitante',
];
const WF_PROBLEMAS = [
  'Aguardando RCA','Aguardando Aprovação Líder de Torre','Aguardando Aprovação Ger. Problema',
  'Solução Rejeitada','Aguardando Planejamento','Aguardando Execução','Em Execução',
  'Aguardando Demanda/Projeto','Em Monitoramento','Fechado','Cancelado','RCA em Desenvolvimento',
  'Aguardando Aprovação Técnica RCA','Aguardando Aprovação Governança RCA','Resolvido',
  'Em Planejamento','Aguardando Aprovação Técnica','Aguardando Aprovação Governança','Aguardando Demanda',
];

function buildWorkflowOrder(escopoFilter) {
  const seen = new Set(); const order = [];
  const add = list => list.forEach(s => { if (!seen.has(s)) { seen.add(s); order.push(s); } });
  const hasFilter = escopoFilter && escopoFilter.size > 0;
  if (!hasFilter || escopoFilter.has('DEMANDA')) add(WF_DEMANDA);
  if (!hasFilter || escopoFilter.has('DEMANDA FAST')) add(WF_FAST);
  if (!hasFilter || escopoFilter.has('PROBLEMAS')) add(WF_PROBLEMAS);
  return order;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function resolveSquad(ticket) {
  if (ticket.squadPrincipal) return ticket.squadPrincipal;
  if (ticket._resolvedSquad) return ticket._resolvedSquad;
  const g = ticket.grupoSuporte || '';
  return g ? g.replace(/^\d+\s*-\s*/, '').trim() : '';
}

function trunc(str, max) {
  if (!str) return '';
  const s = String(str);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function pctStr(val) {
  if (val == null || val === '') return '';
  return `${Number(val)}%`;
}

// ── Column definitions ────────────────────────────────────────────────────
// A4 Landscape = 297mm wide. With margins 8mm each side = 281mm usable.
const COLUMNS = [
  { header: 'Chave',          dataKey: 'chave',      cellWidth: 24 },
  { header: 'Tipo',           dataKey: 'tipo',       cellWidth: 18 },
  { header: 'Resumo',         dataKey: 'resumo',     cellWidth: 'auto' },
  { header: 'Status',         dataKey: 'status',     cellWidth: 30 },
  { header: 'Squad',          dataKey: 'squad',      cellWidth: 24 },
  { header: '% Conc',         dataKey: 'pctConc',    cellWidth: 13 },
  { header: '% T.Int',        dataKey: 'pctTeste',   cellWidth: 13 },
  { header: 'Prioridade',     dataKey: 'prio',       cellWidth: 18 },
  { header: 'Fim Teste Int.', dataKey: 'fimTeste',   cellWidth: 20 },
  { header: 'Data Concl.',    dataKey: 'conclusao',  cellWidth: 20 },
  { header: 'Impedido',       dataKey: 'impedido',   cellWidth: 14 },
  { header: 'Motivo Imp.',    dataKey: 'motivo',     cellWidth: 35 },
];

function ticketToRow(ticket) {
  return {
    chave:     ticket.issueKey || ticket.id || '',
    tipo:      trunc(ticket.issuetype?.name || ticket.issueType || '', 12),
    resumo:    ticket.summary || '',
    status:    trunc(ticket.status || '', 22),
    squad:     trunc(resolveSquad(ticket), 18),
    pctConc:   pctStr(ticket.percentualConclusao),
    pctTeste:  pctStr(ticket.percentualConclusaoTesteInterno),
    prio:      trunc(ticket.prioridadeInterna || '', 12),
    fimTeste:  fmtDate(ticket.dataFimTesteInterno),
    conclusao: fmtDate(ticket.dataConclusao),
    impedido:  ticket.impedimento === true ? 'Sim 🚧' : '',
    motivo:    trunc(ticket.observacaoAdicional || ticket.motivoImpedimento || '', 40),
  };
}

// ── Color helpers for cells ───────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  }
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// ── Group helpers ─────────────────────────────────────────────────────────
function groupByCiclo(ciclos, getCicloTickets, backlogTickets) {
  const groups = [];
  ciclos.forEach(ciclo => {
    const tickets = getCicloTickets(ciclo);
    if (tickets.length > 0) {
      groups.push({ label: ciclo.nome, tickets, color: [99, 102, 241] });
    }
  });
  if (backlogTickets.length > 0) {
    groups.push({ label: 'Backlog', tickets: backlogTickets, color: [107, 114, 128] });
  }
  return groups;
}

function groupByWorkflow(filteredTickets, escopoFilter) {
  const order = buildWorkflowOrder(escopoFilter);
  const orderIndex = {};
  order.forEach((s, i) => { orderIndex[s] = i; });

  const map = new Map();
  filteredTickets.forEach(t => {
    const s = t.status || '(sem status)';
    if (!map.has(s)) map.set(s, []);
    map.get(s).push(t);
  });

  const entries = [...map.entries()].sort(([a], [b]) => {
    const ia = orderIndex[a] ?? order.length;
    const ib = orderIndex[b] ?? order.length;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, 'pt-BR');
  });

  return entries.map(([label, tickets]) => ({ label, tickets, color: [30, 64, 175] }));
}

// ── Main export function ──────────────────────────────────────────────────
export async function exportCicloPdf({
  ciclos = [],
  getCicloTickets,
  filteredTickets = [],
  backlogTickets = [],
  activeTab = 'ciclos',
  escopoFilter,
}) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PAGE_W = 297;
  const PAGE_H = 210;
  const MARGIN = 8;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const exportedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ── Document header ───────────────────────────────────────────────────
  let curY = MARGIN;

  // Title bar
  pdf.setFillColor(30, 64, 175);
  pdf.rect(MARGIN, curY, CONTENT_W, 10, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont(undefined, 'bold');
  pdf.text('Planejamento de Ciclos', MARGIN + 4, curY + 7);
  const modeLabel = activeTab === 'workflow' ? 'Agrupado por Workflow' : 'Agrupado por Ciclo';
  pdf.setFontSize(8);
  pdf.setFont(undefined, 'normal');
  pdf.text(
    `${modeLabel} · ${filteredTickets.length} ticket${filteredTickets.length !== 1 ? 's' : ''} · Exportado em ${exportedAt}`,
    PAGE_W - MARGIN - 4, curY + 7, { align: 'right' }
  );
  curY += 13;

  // ── Status summary ────────────────────────────────────────────────────
  const statusCounts = {};
  filteredTickets.forEach(t => { if (t.status) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
  const topStatuses = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (topStatuses.length > 0) {
    const boxW = Math.min(CONTENT_W / topStatuses.length, 24);
    const totalBoxW = boxW * topStatuses.length;
    let bx = MARGIN;
    topStatuses.forEach(([status, count]) => {
      pdf.setFillColor(243, 244, 246);
      pdf.setDrawColor(209, 213, 219);
      pdf.roundedRect(bx, curY, boxW - 1, 9, 1, 1, 'FD');
      pdf.setTextColor(30, 64, 175);
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.text(String(count), bx + boxW / 2 - 0.5, curY + 5.5, { align: 'center' });
      pdf.setTextColor(55, 65, 81);
      pdf.setFontSize(5.5);
      pdf.setFont(undefined, 'normal');
      pdf.text(trunc(status, 14), bx + boxW / 2 - 0.5, curY + 8.5, { align: 'center' });
      bx += boxW;
    });
    curY += 12;
  }

  // ── Determine groups ──────────────────────────────────────────────────
  const groups = activeTab === 'workflow'
    ? groupByWorkflow(filteredTickets, escopoFilter)
    : groupByCiclo(ciclos, getCicloTickets, backlogTickets);

  // ── Render each group ─────────────────────────────────────────────────
  groups.forEach(group => {
    if (!group.tickets || group.tickets.length === 0) return;

    autoTable(pdf, {
      startY: curY,
      margin: { left: MARGIN, right: MARGIN },
      head: [
        // Group header spanning all columns
        [{ content: `${group.label}  (${group.tickets.length} ticket${group.tickets.length !== 1 ? 's' : ''})`, colSpan: COLUMNS.length, styles: { fillColor: group.color, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 5, right: 3 } } }],
        // Column headers
        COLUMNS.map(c => c.header),
      ],
      body: group.tickets.map(ticketToRow),
      columns: COLUMNS,
      bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 30, 30] },
      headStyles: { fillColor: [229, 231, 235], textColor: [55, 65, 81], fontStyle: 'bold', fontSize: 7, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 2 } },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      styles: { overflow: 'ellipsize', lineColor: [229, 231, 235], lineWidth: 0.2 },
      columnStyles: {
        chave:     { fontStyle: 'bold', textColor: [29, 78, 216] },
        pctConc:   { halign: 'center' },
        pctTeste:  { halign: 'center' },
        impedido:  { halign: 'center' },
        fimTeste:  { halign: 'center' },
        conclusao: { halign: 'center' },
      },
      tableWidth: CONTENT_W,
      didDrawPage: (data) => {
        // Re-draw header on each new page
        pdf.setFillColor(30, 64, 175);
        pdf.rect(MARGIN, MARGIN, CONTENT_W, 6, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(7.5);
        pdf.setFont(undefined, 'bold');
        pdf.text('Planejamento de Ciclos', MARGIN + 3, MARGIN + 4.5);
        pdf.setFont(undefined, 'normal');
        pdf.text(`Exportado em ${exportedAt}`, PAGE_W - MARGIN - 2, MARGIN + 4.5, { align: 'right' });
      },
    });

    curY = pdf.lastAutoTable.finalY + 4;
    // Start new page if not enough room for next group header
    if (curY > PAGE_H - 20) {
      pdf.addPage();
      curY = MARGIN + 8;
    }
  });

  // ── Page numbers ──────────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(156, 163, 175);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Página ${i} de ${totalPages}`, PAGE_W - MARGIN - 2, PAGE_H - 3, { align: 'right' });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  pdf.save(`planejamento-ciclos-${dateStr}.pdf`);
}
