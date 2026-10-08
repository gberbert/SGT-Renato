import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, MoveRight, MoveLeft, CalendarDays, Pencil, Trash2, Calendar, Search, AlertCircle, Link2, Flame, ArrowUp, Minus, ArrowDown } from 'lucide-react';
import { updateCiclo, deleteCiclo } from '../services/cicloService';
import { stripNumericPrefix } from '../utils/stripNumericPrefix';

export const ESCOPOS_ALVO = ['DEMANDA', 'DEMANDA FAST', 'PROBLEMAS'];
export const ESCOPO_META = {
  DEMANDA: { color: '#3b82f6', short: 'DEM' },
  'DEMANDA FAST': { color: '#f59e0b', short: 'FAST' },
  PROBLEMAS: { color: '#ef4444', short: 'PROB' },
};
export const CICLO_STATUS_META = {
  planejamento: { label: 'Planejamento', color: '#6b7280' },
  ativo: { label: 'Ativo', color: '#22c55e' },
  concluido: { label: 'Concluido', color: '#8b5cf6' },
};

/**
 * MultiSelectFilter
 * props:
 *   options: string[]
 *   selected: Set<string>   (empty = "all")
 *   onChange: (Set<string>) => void
 *   placeholder: string
 *   maxWidth?: number
 */
export function MultiSelectFilter({ options, selected, onChange, placeholder = 'Selecionar…', maxWidth = 200 }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
    setOpen(v => !v);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const allSelected = selected.size === 0;
  const allFilteredSelected = filtered.length > 0 && filtered.every(o => selected.has(o));

  const toggle = (val) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val); else next.add(val);
    onChange(next);
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filtered.forEach(o => next.delete(o));
      onChange(next);
    } else {
      const next = new Set(selected);
      filtered.forEach(o => next.add(o));
      onChange(next);
    }
  };

  const clearAll = () => onChange(new Set());

  const label = allSelected
    ? placeholder
    : selected.size === 1
      ? [...selected][0]
      : `${selected.size} status`;

  const triggerStyle = {
    fontSize: 12,
    background: 'var(--gray-2)',
    border: `1px solid ${allSelected ? 'var(--gray-5)' : 'var(--indigo-8)'}`,
    borderRadius: 6,
    padding: '3px 8px',
    color: allSelected ? 'var(--gray-12)' : 'var(--indigo-11)',
    maxWidth,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
    whiteSpace: 'nowrap', overflow: 'hidden',
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button ref={triggerRef} type="button" style={triggerStyle} onClick={handleOpen}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          zIndex: 9999,
          background: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-5)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.35)',
          minWidth: 220, maxWidth: 320,
        }}>
          {/* search */}
          <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--gray-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={12} style={{ color: 'var(--gray-9)', flexShrink: 0 }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar status…"
              style={{ flex: 1, fontSize: 12, background: 'none', border: 'none', outline: 'none', color: 'var(--gray-12)' }}
            />
          </div>

          {/* select all / clear */}
          <div style={{ padding: '5px 10px', borderBottom: '1px solid var(--gray-4)', display: 'flex', gap: 8 }}>
            <button
              onClick={toggleAll}
              style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--indigo-10)', padding: 0, fontWeight: 600 }}
            >
              {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              {query.trim() ? ` (${filtered.length})` : ''}
            </button>
            {!allSelected && (
              <>
                <span style={{ color: 'var(--gray-6)' }}>|</span>
                <button
                  onClick={clearAll}
                  style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-9)', padding: 0 }}
                >
                  Limpar
                </button>
              </>
            )}
          </div>

          {/* options */}
          <div style={{ maxHeight: 240, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--gray-9)' }}>Nenhum resultado</div>
            ) : filtered.map(o => (
              <label
                key={o}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <input
                  type="checkbox"
                  checked={selected.has(o)}
                  onChange={() => toggle(o)}
                  style={{ accentColor: 'var(--indigo-9)', width: 13, height: 13, flexShrink: 0 }}
                />
                <span style={{ color: 'var(--gray-12)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function getStatusColor(s) {
  if (!s) return '#6b7280';
  const l = String(s).toLowerCase().trim();
  // Concluída → verde neon
  if (l === 'concluída' || l === 'concluida' || l === 'done' || l.includes('resolvid') || l === 'fechado' || l === 'fechada') return '#4ade80';
  if (l.includes('conclu')) return '#4ade80';
  // Em Execução / Execução → azul neon
  if (l === 'em execução' || l === 'em execucao' || l === 'execução' || l === 'execucao' || l === 'em atendimento' || l === 'em andamento') return '#38bdf8';
  if (l.includes('execu') || l.includes('andament') || l.includes('progress')) return '#38bdf8';
  // Homologação / Revisão de Homologação → laranja neon
  if (l.includes('homolog') || l.includes('revisão de homolog') || l.includes('revisao de homolog')) return '#fb923c';
  // Revisão de Requisitos → cinza
  if (l.includes('revisão de requisito') || l.includes('revisao de requisito')) return '#9ca3af';
  // Análise e T-Shirt → amarelo neon
  if (l.includes('t-shirt') || l.includes('t shirt') || l.includes('tshirt')) return '#facc15';
  // Planejamento → lilás neon
  if (l === 'planejamento' || l === 'em planejamento' || l === 'aprovação de planejamento' || l === 'aprovacao de planejamento' || l === 'aguardando planejamento') return '#c084fc';
  if (l.includes('planejament')) return '#c084fc';
  // Aguardando Mudança → azul água neon
  if (l.includes('aguardando mudança') || l.includes('aguardando mudanca') || l.includes('aguard') && l.includes('mudan')) return '#22d3ee';
  // Aguardando específicos → cinza
  if (l.includes('aguardando demanda') || l.includes('aguardando profissional') || l.includes('aguardando solicitante')) return '#9ca3af';
  // Outros aguardando → amber
  if (l.includes('aguard') || l.includes('pendente')) return '#f59e0b';
  // Impedido/bloqueado → vermelho
  if (l.includes('block') || l.includes('impedi')) return '#ef4444';
  // Análise/revisão → violeta
  if (l.includes('analis') || l.includes('review') || l.includes('revisão') || l.includes('revisao')) return '#a78bfa';
  return '#6b7280';
}

function getPriorityMeta(prioridadeInterna) {
  const p = String(prioridadeInterna || '').toLowerCase().trim();
  if (p === 'crise' || p === 'crítica' || p === 'critica') return { label: 'Crise', color: '#fca5a5', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', iconType: 'flame' };
  if (p === 'alto' || p === 'alta') return { label: 'Alto', color: '#fdba74', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', iconType: 'up' };
  if (p === 'medio' || p === 'médio' || p === 'media' || p === 'média') return { label: 'Médio', color: '#fde68a', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', iconType: 'minus' };
  if (p === 'baixo' || p === 'baixa') return { label: 'Baixo', color: '#93c5fd', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', iconType: 'down' };
  if (p === 'muito baixo') return { label: 'M.Baixo', color: '#c7d2fe', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', iconType: 'down' };
  return null;
}

export const DATE_FIELD_OPTIONS = [
  { value: 'none', label: 'Nenhuma data' },
  { value: 'dataFimDesenvolvimento', label: 'Fim Desenvolvimento' },
  { value: 'dataFimTesteInterno', label: 'Fim Teste Interno' },
  { value: 'dataFimTesteQa', label: 'Fim Teste (QA)' },
  { value: 'dataFimHomologacao', label: 'Fim Homologação' },
  { value: 'dataConclusao', label: 'Conclusão' },
];

// Ordem de status para exportação (workflow das demandas)
export const STATUS_EXPORT_ORDER = [
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

export function exportTicketsToXlsx(tickets, filename = 'tickets.xlsx') {
  if (!tickets || tickets.length === 0) {
    alert('Nenhum ticket para exportar');
    return;
  }

  // Importar XLSX dinamicamente
  import('xlsx').then(({ utils: XLSXUtils, writeFile }) => {
    // Criar mapa de status para ordenação
    const statusIndexMap = {};
    STATUS_EXPORT_ORDER.forEach((status, index) => {
      statusIndexMap[status] = index;
    });

    // Ordenar tickets conforme a ordem de status
    const sortedTickets = [...tickets].sort((a, b) => {
      const statusA = a.status || '';
      const statusB = b.status || '';
      const orderA = statusIndexMap[statusA] ?? STATUS_EXPORT_ORDER.length;
      const orderB = statusIndexMap[statusB] ?? STATUS_EXPORT_ORDER.length;
      return orderA - orderB;
    });

    // Preparar dados para exportação — TODOS os campos da collection tickets_global
    const fmtD = v => v ? formatDateForExport(v) : '';
    const data = sortedTickets.map(t => ({
      // ── Identificação ──────────────────────────────────────────
      'Issue_Key': t.issueKey || t.id || '',
      'JIRA_ID': t.jiraId || '',
      'URL Jira': t.issueUrl || '',
      'Resumo': t.summary || '',
      'ISSUE_TYPE': t.issueType || '',
      'ESCOPO': t.escopo || '',
      'Sync Batch': t.syncBatch || '',
      'PROJECT_KEY': t.projectKey || '',
      'PROJECT_NAME': t.projectName || '',
      'Parent Key': t.parentKey || '',
      'Epic Key': t.epicKey || '',
      'Work Items Vinculados': Array.isArray(t.linkedWorkItems) ? t.linkedWorkItems.join(', ') : (t.linkedWorkItems || ''),

      // ── Status / Fluxo ─────────────────────────────────────────
      'Status': t.status || '',
      'Status Category': t.statusCategory || '',
      'Status Category Key': t.statusCategoryKey || '',
      'Resolução': t.resolution || '',
      '% Conclusão': t.percentualConclusao != null ? t.percentualConclusao : '',
      '% Conclusão Teste Interno': t.percentualConclusaoTesteInterno != null ? t.percentualConclusaoTesteInterno : '',
      'Aging (dias)': t.agingDays != null ? t.agingDays : '',

      // ── Responsáveis ───────────────────────────────────────────
      'Squad': t._resolvedSquad || t.squadPrincipal || stripNumericPrefix(t.grupoSuporte) || t.squad || '',
      'Squad Principal': t.squadPrincipal || '',
      'Grupo Suporte': t.grupoSuporte || '',
      'Grupo Solucionador': t.grupoSolucionador || '',
      'Fila': t.fila || '',
      'Assignee': t.assignee || '',
      'Assignee Email': t.assigneeEmail || '',
      'Reporter': t.reporter || '',
      'Reporter Email': t.reporterEmail || '',
      'Criado Por': t.creator || '',
      'Resp. Desenvolvimento': t.responsavelDesenvolvimento || '',
      'Resp. Teste Interno': t.responsavelTesteInterno || '',
      'Resp. Atual': t.responsavelAtual || '',
      'Resp. Execução': t.responsavelExecucao || '',

      // ── Classificação ──────────────────────────────────────────
      'Prioridade Interna': t.prioridadeInterna || '',
      'Prioridade Jira': t.priority || '',
      'Natureza da Iniciativa': t.naturezaIniciativa || t.naturezaOperacao || '',
      'Torre de Atuação': t.torreAtuacao || '',
      'Empresa': t.empresa || '',
      'Fornecedor': t.fornecedor || '',
      'Fornecedor TI': t.fornecedorTi || '',
      'Fornecedores (dropdown)': t.fornecedoresDropdown || '',
      'Sistemas Impactados': t.sistemasImpactados || '',
      'Ambiente': t.environment || '',
      'Labels': Array.isArray(t.labels) ? t.labels.join(', ') : (t.labels || ''),
      'Componentes': Array.isArray(t.components) ? t.components.join(', ') : (t.components || ''),
      'Demanda Fast': t.demandaFast || '',
      'Demanda Vulnerabilidade': t.demandaVulnerabilidade || '',
      'Severidade': t.severidade || '',
      'Qtd. Reaberturas': t.reopenCount != null ? t.reopenCount : '',
      'Qtd. Comentários': t.commentCount != null ? t.commentCount : '',
      'Qtd. Subtarefas': t.subtaskCount != null ? t.subtaskCount : '',

      // ── Estimativas ────────────────────────────────────────────
      'Estimativa Macro': t.estimativaMacro != null ? t.estimativaMacro : '',
      'Estimativa Macro Jira': t.estimativaMacroJira != null ? t.estimativaMacroJira : '',
      'Estimativa Interna (h)': t.estimativaInterna != null ? t.estimativaInterna : '',
      'Estimativa Total': t.estimativaTotal != null ? t.estimativaTotal : '',
      'Estimativa Horas (Jira)': t.estimativaHoras != null ? t.estimativaHoras : '',
      'Plan. Horas Demanda Fast': t.planejamentoHorasDemandaFast != null ? t.planejamentoHorasDemandaFast : '',

      // ── Impedimento / Observações ──────────────────────────────
      'Impedido': t.impedimento ? 'Sim' : 'Não',
      'Observação Adicional': t.observacaoAdicional || '',
      'Observação': t.observacao || '',
      'Motivo Impedimento': t.motivoImpedimento || '',
      'Tickets Vinculados': t.ticketsVinculados || '',
      'Data Previsão': fmtD(t.dataPrevisao),

      // ── Datas Jira ─────────────────────────────────────────────
      'Data Criação': fmtD(t.createdAt),
      'Data Atualização': fmtD(t.updatedAt),
      'Data Resolução': fmtD(t.resolvedAt),
      'Due Date': fmtD(t.dueDate),
      'Data Aprovação EF/SR': fmtD(t.dataAprovacaoEfsr),
      'Data Início Atend. Plan.': fmtD(t.dataInicioAtendimentoPlanejada),
      'Data Início Atendimento': fmtD(t.dataInicioAtendimento),
      'Data Aprovação QA Plan.': fmtD(t.dataAprovacaoQaPlanejada),
      'Data Início Homolog. Plan.': fmtD(t.dataInicioHomologacaoPlanejada),
      'Data Início Homolog. Efetiva': fmtD(t.dataInicioHomologacaoEfetiva),
      'Data Fim Homolog. Plan.': fmtD(t.dataFimHomologacaoPlanejada),
      'Data Fim Homolog. Efetiva': fmtD(t.dataFimHomologacaoEfetiva),
      'Data Entrega Produção Prev.': fmtD(t.dataEntregaProducaoPrevista),
      'Data Fim Planejado': fmtD(t.dataFimPlanejado),

      // ── Datas SGT Interno ──────────────────────────────────────
      'Data Fim Desenvolvimento': fmtD(t.dataFimDesenvolvimento),
      'Data Fim Teste Interno': fmtD(t.dataFimTesteInterno),
      'Data Fim Teste QA': fmtD(t.dataFimTesteQa),
      'Data Fim Homologação': fmtD(t.dataFimHomologacao),
      'Data Conclusão (CPFL)': fmtD(t.dataConclusao),

      // ── Ciclos ─────────────────────────────────────────────────
      'Ciclos': Array.isArray(t.ciclos)
        ? t.ciclos.map(c => (typeof c === 'string' ? c : c?.nome || '')).filter(Boolean).join(', ')
        : (t.cicloId || ''),
      'Ciclo ID': t.cicloId || '',
    }));

    const HEADERS = [
      // ── Prioridades / visibilidade imediata ────────────────────
      'Issue_Key', 'Resumo', 'Status', 'Prioridade Interna',
      'Sistemas Impactados', 'Squad', 'Impedido', 'Observação',
      'Data Fim Teste Interno', '% Conclusão', 'Aging (dias)',
      // ── Identificação ──────────────────────────────────────────
      'JIRA_ID', 'ISSUE_TYPE', 'ESCOPO', 'PROJECT_KEY', 'PROJECT_NAME',
      'Parent Key', 'Epic Key', 'Work Items Vinculados', 'URL Jira', 'Sync Batch',
      // ── Status ─────────────────────────────────────────────────
      'Status Category', 'Status Category Key', 'Resolução',
      '% Conclusão Teste Interno',
      // ── Responsáveis ───────────────────────────────────────────
      'Squad Principal', 'Grupo Suporte', 'Grupo Solucionador', 'Fila',
      'Assignee', 'Assignee Email', 'Reporter', 'Reporter Email', 'Criado Por',
      'Resp. Desenvolvimento', 'Resp. Teste Interno', 'Resp. Atual', 'Resp. Execução',
      // ── Classificação ──────────────────────────────────────────
      'Prioridade Jira', 'Natureza da Iniciativa', 'Torre de Atuação',
      'Empresa', 'Fornecedor', 'Fornecedor TI', 'Fornecedores (dropdown)',
      'Ambiente', 'Labels', 'Componentes',
      'Demanda Fast', 'Demanda Vulnerabilidade', 'Severidade',
      'Qtd. Reaberturas', 'Qtd. Comentários', 'Qtd. Subtarefas',
      // ── Estimativas ────────────────────────────────────────────
      'Estimativa Macro', 'Estimativa Macro Jira',
      'Estimativa Interna (h)', 'Estimativa Total',
      'Estimativa Horas (Jira)', 'Plan. Horas Demanda Fast',
      // ── Impedimento / Observações ──────────────────────────────
      'Motivo Impedimento', 'Observação Adicional', 'Tickets Vinculados',
      'Data Previsão',
      // ── Datas Jira ─────────────────────────────────────────────
      'Data Criação', 'Data Atualização', 'Data Resolução', 'Due Date',
      'Data Aprovação EF/SR', 'Data Início Atend. Plan.', 'Data Início Atendimento',
      'Data Aprovação QA Plan.', 'Data Início Homolog. Plan.', 'Data Início Homolog. Efetiva',
      'Data Fim Homolog. Plan.', 'Data Fim Homolog. Efetiva', 'Data Entrega Produção Prev.',
      'Data Fim Planejado',
      // ── Datas SGT Interno ──────────────────────────────────────
      'Data Fim Desenvolvimento', 'Data Fim Teste QA',
      'Data Fim Homologação', 'Data Conclusão (CPFL)',
      // ── Ciclos ─────────────────────────────────────────────────
      'Ciclos', 'Ciclo ID',
    ];

    // Criar worksheet
    const ws = XLSXUtils.json_to_sheet(data, { header: HEADERS });

    // Configurar largura das colunas
    ws['!cols'] = HEADERS.map(h => {
      if (['Resumo', 'Motivo Impedimento / Observação', 'Observação', 'Tickets Vinculados'].includes(h)) return { wch: 40 };
      if (['Issue_Key', 'JIRA_ID', 'PROJECT_KEY', 'Ciclo ID', 'Sync Batch'].includes(h)) return { wch: 16 };
      if (h.startsWith('Data')) return { wch: 20 };
      if (h === 'URL Jira') return { wch: 45 };
      return { wch: 22 };
    });

    // Criar workbook
    const wb = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(wb, ws, 'Tickets');

    // Exportar arquivo
    writeFile(wb, filename);
  }).catch(err => {
    console.error('Erro ao exportar XLSX:', err);
    alert('Erro ao exportar arquivo');
  });
}

function formatDateForExport(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr);
  // Converte yyyy-mm-dd ou yyyy-mm-ddTHH... para dd/mm/yyyy
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function fmtDateShort(val) {
  if (!val) return null;
  const s = String(val);
  // ISO yyyy-mm-dd or yyyy-mm-ddTHH...
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

export function TicketRow({ ticket, cicloId, ciclos, onMoveToCiclo, onMoveToBacklog, onTicketClick, dateField, showEstimativa = true, allTickets = [], level = 0 }) {
  const [open, setOpen] = useState(false);
  const [expandChildren, setExpandChildren] = useState(false);
  const em = ESCOPO_META[ticket.escopo] || { color: '#6b7280', short: (ticket.escopo || '?').slice(0, 4) };
  const sc = getStatusColor(ticket.status);
  const tkey = ticket.issueKey || ticket.id;

  const childTickets = useMemo(() => {
    if (!allTickets || allTickets.length === 0) return [];
    return allTickets.filter(t => {
      const parentKey = t.parentKey || t.parent?.key;
      return parentKey === tkey;
    });
  }, [allTickets, tkey]);

  const hasChildren = childTickets.length > 0;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', paddingLeft: `${14 + level * 20}px`, borderRadius: 6, background: level > 0 ? 'rgba(99,102,241,0.04)' : 'var(--color-surface)', border: '1px solid var(--gray-4)', marginBottom: 3 }}>
        {hasChildren ? (
          <button
            onClick={() => setExpandChildren(!expandChildren)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--indigo-9)', flexShrink: 0 }}
            title={expandChildren ? 'Colapsar filhos' : 'Expandir filhos'}
          >
            {expandChildren ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <div style={{ width: 14, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: em.color, color: '#fff', flexShrink: 0, minWidth: 34, textAlign: 'center' }}>{em.short}</span>
        {ticket.issueType && (
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: 'rgba(107,114,128,0.2)', color: 'var(--gray-11)', flexShrink: 0, whiteSpace: 'nowrap' }} title={`Tipo: ${ticket.issueType}`}>
            {ticket.issueType}
          </span>
        )}
        {level > 0 && <span style={{ fontSize: 9, color: 'var(--gray-8)', flexShrink: 0 }}>↳</span>}
      <button
        onClick={() => onTicketClick && onTicketClick(ticket)}
        title="Ver detalhes"
        style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-9)', flexShrink: 0, minWidth: 88, fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}
      >
        {tkey}
      </button>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--gray-12)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ticket.summary}>{ticket.summary || '(sem titulo)'}</span>
      {(() => {
        const pm = getPriorityMeta(ticket.prioridadeInterna);
        if (!pm) return null;
        const Icon = pm.iconType === 'flame' ? Flame : pm.iconType === 'up' ? ArrowUp : pm.iconType === 'minus' ? Minus : ArrowDown;
        return (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: pm.bg, color: pm.color, border: `1px solid ${pm.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }} title={`Prioridade: ${ticket.prioridadeInterna}`}>
            <Icon size={11} />{pm.label}
          </span>
        );
      })()}
      {ticket.impedimento && (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }} title="Ticket impedido">
          <AlertCircle size={13} />
        </span>
      )}
      {ticket.ticketsVinculados && String(ticket.ticketsVinculados).trim() !== '' && (
        <span
          title={`Tickets vinculados: ${ticket.ticketsVinculados}`}
          style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(6,182,212,0.15)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.4)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}
        >
          <Link2 size={13} />
        </span>
      )}
      {(() => {
        const pct = ticket.percentualConclusao != null && ticket.percentualConclusao !== ''
          ? Math.min(100, Math.max(0, Number(ticket.percentualConclusao)))
          : 0;
        const pctColor = pct >= 100 ? '#4ade80' : pct >= 75 ? '#22d3ee' : pct >= 40 ? '#fbbf24' : '#f87171';
        return (
          <span
            title={`% Conclusão: ${pct}%`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 700,
              padding: '2px 8px', borderRadius: 12,
              background: pctColor + '22', color: pctColor,
              border: `1px solid ${pctColor}55`,
              flexShrink: 0, whiteSpace: 'nowrap', minWidth: 46, justifyContent: 'center',
            }}
          >
            {pct}%
          </span>
        );
      })()}
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: sc + '22', color: sc, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.status || 'Sem status'}</span>
      {(() => {
        const squadName = ticket._resolvedSquad || ticket.squadPrincipal || stripNumericPrefix(ticket.grupoSuporte) || ticket.squad || null;
        if (!squadName) return null;
        return (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={squadName}>
            {squadName}
          </span>
        );
      })()}
      {showEstimativa && ticket.estimativaInterna && (
        <span
          title={`Estimativa interna: ${ticket.estimativaInterna}`}
          style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          ⏱ {ticket.estimativaInterna}
        </span>
      )}
      {dateField && dateField !== 'none' && (() => {
        const dateVal = ticket[dateField];
        const label = DATE_FIELD_OPTIONS.find(o => o.value === dateField)?.label || dateField;
        return (
          <span
            title={`${label}: ${dateVal || '—'}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, fontWeight: 600,
              padding: '2px 8px', borderRadius: 12,
              background: dateVal ? 'rgba(251,191,36,0.12)' : 'rgba(107,114,128,0.1)',
              color: dateVal ? '#fbbf24' : 'var(--gray-8)',
              border: `1px solid ${dateVal ? 'rgba(251,191,36,0.35)' : 'var(--gray-5)'}`,
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            <Calendar size={10} />
            {fmtDateShort(dateVal) || '—'}
          </span>
        );
      })()}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, color: 'var(--gray-11)', fontSize: 12 }}
        >
          <MoveRight size={12} />
        </button>
        {open && (
          <div
            onMouseLeave={() => setOpen(false)}
            style={{ position: 'absolute', right: 0, top: '110%', zIndex: 200, background: 'var(--color-panel-solid)', border: '1px solid var(--gray-5)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.3)', minWidth: 175, overflow: 'hidden' }}
          >
            <div style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, color: 'var(--gray-9)', borderBottom: '1px solid var(--gray-4)', textTransform: 'uppercase' }}>Mover para</div>
            {cicloId && (
              <div
                onClick={() => { onMoveToBacklog(); setOpen(false); }}
                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <MoveLeft size={12} /> Backlog
              </div>
            )}
            {ciclos.filter(c => c.id !== cicloId).map(c => (
              <div
                key={c.id}
                onClick={() => { onMoveToCiclo(c.id); setOpen(false); }}
                style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <MoveRight size={12} /> {c.nome}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {hasChildren && expandChildren && (
        <div>
          {childTickets.map(childTicket => (
            <TicketRow
              key={childTicket.issueKey || childTicket.id}
              ticket={childTicket}
              cicloId={cicloId}
              ciclos={ciclos}
              onMoveToCiclo={onMoveToCiclo}
              onMoveToBacklog={onMoveToBacklog}
              onTicketClick={onTicketClick}
              dateField={dateField}
              showEstimativa={showEstimativa}
              allTickets={allTickets}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── Workflow status order per escopo ─────────────────────────────────────────
const WORKFLOW_STATUS_ORDER_DEMANDA = [
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
const WORKFLOW_STATUS_ORDER_FAST = [
  'Aguardando Atendimento',
  'Em Atendimento',
  'Resolvido',
  'Reaberto',
  'Fechada',
  'Canceled',
  'Aprovação Demanda Fast',
  'Aguardando Aprovação Gestor',
  'Aguardando Aprovação Tecnica',
  'Aguardando Aprovação Adicional',
  'Aprovado',
  'Reprovado',
  'Agendado',
  'Aguardando Compra',
  'Aguardando Validação',
  'Aguardando Problema',
  'Aguardando Mudança',
  'Aguardando Fornecedor',
  'Aguardando Solicitante',
];
const WORKFLOW_STATUS_ORDER_PROBLEMAS = [
  'Aguardando RCA',
  'Aguardando Aprovação Líder de Torre',
  'Aguardando Aprovação Ger. Problema',
  'Solução Rejeitada',
  'Aguardando Planejamento',
  'Aguardando Execução',
  'Em Execução',
  'Aguardando Demanda/Projeto',
  'Em Monitoramento',
  'Fechado',
  'Cancelado',
  'RCA em Desenvolvimento',
  'Aguardando Aprovação Técnica RCA',
  'Aguardando Aprovação Governança RCA',
  'Resolvido',
  'Em Planejamento',
  'Aguardando Aprovação Técnica',
  'Aguardando Aprovação Governança',
  'Aguardando Demanda',
];

function getWorkflowStatusOrder(escopos) {
  // Build a merged ordered list based on selected escopos
  const seen = new Set();
  const order = [];
  const addList = (list) => { list.forEach(s => { if (!seen.has(s)) { seen.add(s); order.push(s); } }); };
  if (!escopos || escopos.size === 0) return [];
  if (escopos.has('DEMANDA')) addList(WORKFLOW_STATUS_ORDER_DEMANDA);
  if (escopos.has('DEMANDA FAST')) addList(WORKFLOW_STATUS_ORDER_FAST);
  if (escopos.has('PROBLEMAS')) addList(WORKFLOW_STATUS_ORDER_PROBLEMAS);
  return order;
}

/**
 * WorkflowStatusSection — mirrors CicloSection but groups by a status value
 */
export function WorkflowStatusSection({ statusName, tickets, onTicketClick, dateField, showEstimativa = true, allTickets = [] }) {
  const [collapsed, setCollapsed] = useState(false);
  const sc = getStatusColor(statusName);

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 13px', background: 'var(--gray-3)',
          borderRadius: collapsed ? 8 : '8px 8px 0 0',
          border: '1px solid var(--gray-5)',
          borderBottom: collapsed ? '1px solid var(--gray-5)' : 'none',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setCollapsed(v => !v)}
      >
        <span style={{ color: 'var(--gray-9)', display: 'flex' }}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-12)' }}>{statusName}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: sc + '22', color: sc, border: `1px solid ${sc}55`, flexShrink: 0 }}>
          {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
        </span>
        {showEstimativa && (() => {
          const total = tickets.reduce((acc, t) => acc + (Number(t.estimativaInterna) || 0), 0);
          if (!total) return null;
          return (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', marginLeft: 2 }}>
              ⏱ {total}h
            </span>
          );
        })()}
      </div>
      {!collapsed && (
        <div style={{ border: '1px solid var(--gray-5)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 10px', background: 'var(--color-background)' }}>
          {(() => {
            const ticketKeySet = new Set(tickets.map(t => t.issueKey || t.id));
            const rootTickets = tickets.filter(t => {
              const parentKey = t.parentKey || t.parent?.key;
              return !parentKey || !ticketKeySet.has(parentKey);
            });
            return rootTickets.map(t => (
              <TicketRow
                key={t.issueKey || t.id}
                ticket={t}
                cicloId={null}
                ciclos={[]}
                onMoveToCiclo={() => {}}
                onMoveToBacklog={() => {}}
                onTicketClick={onTicketClick}
                dateField={dateField}
                showEstimativa={showEstimativa}
                allTickets={tickets}
                level={0}
              />
            ));
          })()}
        </div>
      )}
    </div>
  );
}

/**
 * WorkflowTab — renders all filteredTickets grouped by status following workflow order.
 * When no escopo is selected, shows a single BACKLOG group.
 */
export function WorkflowTab({ filteredTickets, escopoFilter, onTicketClick, dateField, showEstimativa = true }) {
  const hasEscopoFilter = escopoFilter && escopoFilter.size > 0;

  const groups = useMemo(() => {
    if (!hasEscopoFilter) {
      return [{ statusName: 'BACKLOG', tickets: filteredTickets }];
    }
    const order = getWorkflowStatusOrder(escopoFilter);
    const orderIndex = {};
    order.forEach((s, i) => { orderIndex[s] = i; });

    // Group tickets by status
    const map = new Map();
    filteredTickets.forEach(t => {
      const s = t.status || '(sem status)';
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(t);
    });

    // Sort groups: known statuses first (by workflow order), unknown after
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      const ia = orderIndex[a] ?? order.length;
      const ib = orderIndex[b] ?? order.length;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, 'pt-BR');
    });

    return entries.map(([statusName, tickets]) => ({ statusName, tickets }));
  }, [filteredTickets, escopoFilter, hasEscopoFilter]);

  if (filteredTickets.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--gray-9)', fontSize: 13, padding: '40px 0' }}>
        Nenhum ticket encontrado com os filtros aplicados
      </div>
    );
  }

  return (
    <div>
      {groups.map(g => (
        <WorkflowStatusSection
          key={g.statusName}
          statusName={g.statusName}
          tickets={g.tickets}
          onTicketClick={onTicketClick}
          dateField={dateField}
          showEstimativa={showEstimativa}
          allTickets={filteredTickets}
        />
      ))}
    </div>
  );
}

export function CicloSection({ ciclo, tickets, allCiclos, onMoveToCiclo, onMoveToBacklog, onTicketClick, dateField, showEstimativa = true }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editNome, setEditNome] = useState(ciclo.nome);
  const [editInicio, setEditInicio] = useState(ciclo.dataInicio || '');
  const [editFim, setEditFim] = useState(ciclo.dataFim || '');
  const meta = CICLO_STATUS_META[ciclo.status] || CICLO_STATUS_META.planejamento;

  const saveEdit = async () => {
    if (!editNome.trim()) return;
    await updateCiclo(ciclo.id, { nome: editNome.trim(), dataInicio: editInicio || null, dataFim: editFim || null });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir "' + ciclo.nome + '"? Tickets voltarao ao Backlog.')) return;
    if ((ciclo.ticketKeys || []).length) await updateCiclo(ciclo.id, { ticketKeys: [] });
    await deleteCiclo(ciclo.id);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--gray-3)', borderRadius: collapsed ? 8 : '8px 8px 0 0', border: '1px solid var(--gray-5)', borderBottom: collapsed ? '1px solid var(--gray-5)' : 'none', userSelect: 'none' }}>
        <span onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer', color: 'var(--gray-9)', display: 'flex' }}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </span>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, flexWrap: 'wrap' }}>
            <input
              value={editNome}
              onChange={e => setEditNome(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              style={{ fontSize: 14, fontWeight: 700, background: 'var(--gray-1)', border: '1px solid var(--accent-8)', borderRadius: 4, padding: '2px 8px', color: 'var(--gray-12)', minWidth: 130 }}
            />
            <input type="date" value={editInicio} onChange={e => setEditInicio(e.target.value)} style={{ fontSize: 12, background: 'var(--gray-1)', border: '1px solid var(--gray-5)', borderRadius: 4, padding: '2px 5px', color: 'var(--gray-12)' }} />
            <span style={{ fontSize: 12, color: 'var(--gray-9)' }}>ate</span>
            <input type="date" value={editFim} onChange={e => setEditFim(e.target.value)} style={{ fontSize: 12, background: 'var(--gray-1)', border: '1px solid var(--gray-5)', borderRadius: 4, padding: '2px 5px', color: 'var(--gray-12)' }} />
            <button onClick={saveEdit} style={{ padding: '3px 10px', background: 'var(--accent-9)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Salvar</button>
            <button onClick={() => setEditing(false)} style={{ padding: '3px 10px', background: 'var(--gray-5)', color: 'var(--gray-12)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }} onClick={() => setCollapsed(!collapsed)}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-12)' }}>{ciclo.nome}</span>
            {(ciclo.dataInicio || ciclo.dataFim) && (
              <span style={{ fontSize: 12, color: 'var(--gray-9)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <CalendarDays size={11} /> {ciclo.dataInicio || '?'} - {ciclo.dataFim || '?'}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: meta.color + '22', color: meta.color }}>{meta.label}</span>
            <span style={{ fontSize: 12, color: 'var(--gray-10)' }}>({tickets.length} tickets)</span>
            {showEstimativa && (() => {
              const total = tickets.reduce((acc, t) => acc + (Number(t.estimativaInterna) || 0), 0);
              if (!total) return null;
              return (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', marginLeft: 2 }}>
                  ⏱ {total}h
                </span>
              );
            })()}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {ciclo.status === 'planejamento' && (
            <button
              onClick={() => updateCiclo(ciclo.id, { status: 'ativo' })}
              style={{ padding: '3px 10px', fontSize: 12, fontWeight: 600, background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e55', borderRadius: 4, cursor: 'pointer' }}
            >
              Iniciar
            </button>
          )}
          {ciclo.status === 'ativo' && (
            <button
              onClick={() => updateCiclo(ciclo.id, { status: 'concluido' })}
              style={{ padding: '3px 10px', fontSize: 12, fontWeight: 600, background: '#8b5cf622', color: '#8b5cf6', border: '1px solid #8b5cf655', borderRadius: 4, cursor: 'pointer' }}
            >
              Concluir
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            style={{ padding: '3px 7px', background: 'none', border: '1px solid var(--gray-5)', borderRadius: 4, cursor: 'pointer', color: 'var(--gray-10)', display: 'flex', alignItems: 'center' }}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={handleDelete}
            style={{ padding: '3px 7px', background: 'none', border: '1px solid var(--gray-5)', borderRadius: 4, cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {/* Body */}
      {!collapsed && (
        <div style={{ border: '1px solid var(--gray-5)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 10px', background: 'var(--color-background)' }}>
          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gray-9)', fontSize: 13, padding: '16px 0' }}>Nenhum ticket neste ciclo</div>
          ) : (() => {
            const ticketKeySet = new Set(tickets.map(t => t.issueKey || t.id));
            const rootTickets = tickets.filter(t => {
              const parentKey = t.parentKey || t.parent?.key;
              return !parentKey || !ticketKeySet.has(parentKey);
            });
            return rootTickets.map(t => (
              <TicketRow
                key={t.issueKey || t.id}
                ticket={t}
                cicloId={ciclo.id}
                ciclos={allCiclos}
                onMoveToCiclo={destId => onMoveToCiclo(t, ciclo.id, destId)}
                onMoveToBacklog={() => onMoveToBacklog(t, ciclo.id)}
                onTicketClick={onTicketClick}
                dateField={dateField}
                showEstimativa={showEstimativa}
                allTickets={tickets}
                level={0}
              />
            ));
          })()}
        </div>
      )}
    </div>
  );
}
