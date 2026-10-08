import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Select, Button, TextField, Popover, Badge, Callout, Progress, Separator } from '@radix-ui/themes';
import { Route, Filter, Layers, Save, Loader2, Trash2, ChevronRight, ChevronDown, Info, Clock } from 'lucide-react';
import { MultiSelectFilter } from './PlanejamentoCicloHelpers';
import { auth } from '../firebase';
import { useOperacaoRadar } from '../contexts/OperacaoRadarContext';
import {
  fetchTicketsForRoadmap,
  fetchSquadsForRadar,
  buildRadarFilters,
  normalizeEscopoKey,
  ESCOPO_RADAR_ORDER,
  getPrioridadeInternaMeta,
  PRIORIDADE_INTERNA_OPTIONS,
  updateTicketRadarFields,
} from '../services/operacaoRadarService';
import {
  fetchRoadmapGeralViews,
  saveRoadmapGeralView,
  updateRoadmapGeralView,
  deleteRoadmapGeralView,
  setPrimaryRoadmapGeralView,
} from '../services/roadmapGeralViewsService';
import {
  ROADMAP_GRANULARITY_OPTIONS,
  getColWidth,
  generateTimelineColumns,
  collapseGroupLabels,
  computeBarPosition,
  findMinMaxDates,
  todayColumnIndex,
  todayPixelOffset,
} from '../utils/roadmapGeralUtils';
import './RoadmapGeral.css';

const GROUP_BY_OPTIONS = [
  { value: 'none', label: 'Nenhum' },
  { value: 'escopo', label: 'Escopo' },
  { value: 'squad', label: 'Squad' },
  { value: 'grupo', label: 'Grupo de Atendimento' },
  { value: 'status', label: 'Status' },
];

const DATE_FIELD_OPTIONS = [
  { value: 'createdAt', label: 'Data de Criacao (CREATED_AT)' },
  { value: 'dataAprovacaoEfsr', label: 'Data de Aprovacao EF/SR' },
  { value: 'dataInicioAtendimentoPlanejada', label: 'Data Inicio do Atendimento Planejada' },
  { value: 'dataInicioAtendimento', label: 'Data Inicio do Atendimento' },
  { value: 'dataAprovacaoQaPlanejada', label: 'Data Aprovacao QA Planejada' },
  { value: 'dataInicioHomologacaoPlanejada', label: 'Data Inicio Homologacao Planejada' },
  { value: 'dataInicioHomologacaoEfetiva', label: 'Data Inicio Homologacao Efetiva' },
  { value: 'dataFimHomologacaoPlanejada', label: 'Data Fim Homologacao Planejada' },
  { value: 'dataFimHomologacaoEfetiva', label: 'Data Fim Homologacao Efetiva' },
  { value: 'dataEntregaProducaoPrevista', label: 'Data Entrega em Producao Prevista' },
  { value: 'dataFimDesenvolvimento', label: 'Fim Desenvolvimento' },
  { value: 'dataFimTesteInterno', label: 'Fim Teste Interno' },
  { value: 'dataFimTesteQa', label: 'Fim Teste (QA)' },
  { value: 'dataFimHomologacao', label: 'Fim Homologacao (Efetiva)' },
  { value: 'dataConclusao', label: 'Data Conclusao / Producao' },
  { value: 'dataFimPlanejado', label: 'Data Fim Planejado (Jira)' },
  { value: 'resolvedAt', label: 'Data de Resolucao (RESOLVED_AT)' },
  { value: 'dataPrevisao', label: 'Data de Previsao (campo interno)' },
  { value: 'updatedAt', label: 'Data de Atualizacao (UPDATE_AT)' },
];

const START_FIELD_OPTIONS = [
  { value: 'createdAt',              label: 'A — Data Criação (Jira)' },
  { value: 'dataFimDesenvolvimento', label: 'B — Fim Desenvolvimento' },
  { value: 'dataFimTesteInterno',    label: 'C — Fim Teste Interno' },
  { value: 'dataFimTesteQa',         label: 'D — Fim Teste QA' },
  { value: 'dataFimHomologacao',     label: 'E — Fim Homologação' },
  { value: 'dataConclusao',          label: 'F — Data Conclusão' },
];
const END_FIELD_OPTIONS = START_FIELD_OPTIONS;

function createDefaultDateConfig() {
  return { startField: 'createdAt', endField: 'dataConclusao' };
}

function createDefaultScopeConfig() {
  return { escopos: [], dateRangeStart: '', dateRangeEnd: '', visibleMilestones: [] };
}

function dateFieldLabel(value) {
  const opt = DATE_FIELD_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
}

function formatShortDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function serializeRoadmapState(filters, groupBy, granularity, dateConfig, scopeConfig) {
  return JSON.stringify({
    escopos: [...filters.escopos].sort(),
    squads: [...filters.squads].sort(),
    grupos: [...filters.grupos].sort(),
    statuses: [...filters.statuses].sort(),
    tickets: [...(filters.tickets || [])].sort(),
    prioridades: [...(filters.prioridades || [])].sort(),
    groupBy,
    granularity,
    dateConfig,
    scopeConfig,
  });
}

function createEmptyFilters() {
  return { escopos: new Set(), squads: new Set(), grupos: new Set(), statuses: new Set(), tickets: new Set(), prioridades: new Set() };
}

function ticketGrupoNamesLocal(ticket) {
  return [ticket.grupoSuporte, ticket.grupoSolucionador].filter(Boolean);
}

function barColorForTicket(ticket) {
  const status = String(ticket.status || '').toLowerCase();
  if (status.includes('conclu') || status.includes('done') || status.includes('resolv')) return '#4ade80';
  if (status.includes('progress') || status.includes('andamento') || status.includes('desenvolv')) return '#facc15';
  if (status.includes('cancel')) return '#94a3b8';
  return '#22d3ee';
}

const ROADMAP_CACHE_PREFIX = 'roadmap_geral_v2_';

/** Marcos internos dos tickets (A-F) — datas SGT internas */
const MILESTONE_FIELDS = [
  { key: 'createdAt',              label: 'Data Criação (Jira)',  letter: 'A', highlight: { background: '#94a3b8', borderColor: 'rgba(15,15,15,0.5)', color: '#fff' } },
  { key: 'dataFimDesenvolvimento', label: 'Fim Desenvolvimento',  letter: 'B', highlight: { background: '#818cf8', borderColor: 'rgba(15,15,15,0.5)', color: '#fff' } },
  { key: 'dataFimTesteInterno',    label: 'Fim Teste Interno',    letter: 'C', highlight: { background: '#f59e0b', borderColor: 'rgba(15,15,15,0.5)', color: '#fff' } },
  { key: 'dataFimTesteQa',         label: 'Fim Teste (QA)',       letter: 'D', highlight: { background: '#06b6d4', borderColor: 'rgba(15,15,15,0.5)', color: '#fff' } },
  { key: 'dataFimHomologacao',     label: 'Fim Homologação',      letter: 'E', highlight: { background: '#f97316', borderColor: 'rgba(15,15,15,0.5)', color: '#fff' } },
  { key: 'dataConclusao',          label: 'Data Conclusão',       letter: 'F', highlight: { background: '#22c55e', borderColor: 'rgba(15,15,15,0.5)', color: '#fff' } },
];

/** Opções de data para as barras (limitado aos 6 marcos A-F) */
const BAR_DATE_OPTIONS = [
  { value: 'createdAt',              label: 'A — Data Criação (Jira)' },
  { value: 'dataFimDesenvolvimento', label: 'B — Fim Desenvolvimento' },
  { value: 'dataFimTesteInterno',    label: 'C — Fim Teste Interno' },
  { value: 'dataFimTesteQa',         label: 'D — Fim Teste QA' },
  { value: 'dataFimHomologacao',     label: 'E — Fim Homologação' },
  { value: 'dataConclusao',          label: 'F — Data Conclusão' },
];

/**
 * Calcula o offset em pixels de uma data dentro da track da timeline.
 * Retorna null se a data estiver fora do range das colunas.
 */
function getMilestonePixelOffset(columns, dateValue, colWidth) {
  if (!dateValue || !columns.length) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  const firstStart = columns[0].start.getTime();
  const lastEnd = columns[columns.length - 1].end.getTime();
  const dTime = d.getTime();
  if (dTime < firstStart || dTime > lastEnd) return null;
  const colIdx = columns.findIndex((c) => dTime >= c.start.getTime() && dTime < c.end.getTime());
  if (colIdx === -1) return null;
  const col = columns[colIdx];
  const frac = (dTime - col.start.getTime()) / (col.end.getTime() - col.start.getTime());
  return (colIdx + frac) * colWidth;
}

const RoadmapGeral = () => {
  const { statsRadar, statsFingerprint, lastSyncAt, squads: radarSquads, ensureRadarBootstrap } = useOperacaoRadar();

  const [ticketsCache, setTicketsCache] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [squads, setSquads] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    ensureRadarBootstrap();
  }, [ensureRadarBootstrap]);

  const [filters, setFilters] = useState(createEmptyFilters);
  const [groupBy, setGroupBy] = useState('none');
  const [granularity, setGranularity] = useState('mes');
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [dateConfig, setDateConfig] = useState(createDefaultDateConfig);
  const [scopeConfig, setScopeConfig] = useState(createDefaultScopeConfig);

  const [savedViews, setSavedViews] = useState([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(true);
  const [newViewName, setNewViewName] = useState('');
  const [newViewIsPrimary, setNewViewIsPrimary] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [activeViewId, setActiveViewId] = useState(null);
  const [activeViewSnapshot, setActiveViewSnapshot] = useState(null);
  const [editingPriority, setEditingPriority] = useState(null);
  const [editingPriorityValue, setEditingPriorityValue] = useState(null);
  // Controla re-carga automática após carregar uma visão
  const [pendingAutoReload, setPendingAutoReload] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(
    () => localStorage.getItem('roadmap_filtersCollapsed') === 'true'
  );

  const uid = auth.currentUser?.uid || null;

  // applyViewState definida antes dos useEffects para poder ser chamada no carregamento inicial
  const applyViewState = (view) => {
    const nextFilters = {
      escopos: new Set(view.filters?.escopos || []),
      squads: new Set(view.filters?.squads || []),
      grupos: new Set(view.filters?.grupos || []),
      statuses: new Set(view.filters?.statuses || []),
      tickets: new Set(view.filters?.tickets || []),
      prioridades: new Set((view.filters?.prioridades || []).map(Number).filter(Number.isFinite)),
    };
    const nextGroupBy = view.groupBy || 'none';
    const nextGranularity = view.granularity || 'mes';
    const nextDateConfig = view.dateConfig || createDefaultDateConfig();
    const nextScopeConfig = view.scopeConfig || createDefaultScopeConfig();
    setFilters(nextFilters);
    setGroupBy(nextGroupBy);
    setGranularity(nextGranularity);
    setDateConfig(nextDateConfig);
    setScopeConfig(nextScopeConfig);
    return serializeRoadmapState(nextFilters, nextGroupBy, nextGranularity, nextDateConfig, nextScopeConfig);
  };

  // Carrega visoes salvas e aplica a visao padrao ao abrir a tela
  useEffect(() => {
    let cancelled = false;
    async function loadAndApplyViews() {
      setSavedViewsLoading(true);
      try {
        const views = await fetchRoadmapGeralViews(uid);
        if (cancelled) return;
        setSavedViews(views);
        const primary = views.find((v) => v.isPrimary);
        if (primary) {
          const snapshot = applyViewState(primary);
          setActiveViewId(primary.id);
          setActiveViewSnapshot(snapshot);
        }
      } catch {
        if (!cancelled) setSavedViews([]);
      } finally {
        if (!cancelled) setSavedViewsLoading(false);
      }
    }
    if (uid) loadAndApplyViews();
    else setSavedViewsLoading(false);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Carrega squads em paralelo
  useEffect(() => {
    if (Array.isArray(radarSquads) && radarSquads.length > 0) {
      setSquads(radarSquads);
    } else {
      fetchSquadsForRadar().then(setSquads).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Busca tickets respeitando o escopo configurado. Chamado pelo botao Carregar. */
  const handleCarregar = async () => {
    setError('');
    const totalHint = Number(statsRadar?.total) || 0;
    const escoposKey = [...scopeConfig.escopos].sort().join('_') || 'all';
    const cacheKey = statsFingerprint ? `${ROADMAP_CACHE_PREFIX}${statsFingerprint}_${escoposKey}` : null;

    if (cacheKey) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) { setTicketsCache(parsed); return; }
        }
      } catch { /* ignore */ }
    }

    setLoading(true); setLoadProgress(0); setLoadedCount(0);
    try {
      const tickets = await fetchTicketsForRoadmap({
        escopos: scopeConfig.escopos,
        onProgress: (count) => {
          setLoadedCount(count);
          if (totalHint > 0 && scopeConfig.escopos.length === 0) {
            setLoadProgress(Math.min(99, Math.round((count / totalHint) * 100)));
          }
        },
      });
      setTicketsCache(tickets);
      setLoadProgress(100);
      if (cacheKey) { try { sessionStorage.setItem(cacheKey, JSON.stringify(tickets)); } catch { /* ignore */ } }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const filterOptions = useMemo(() => {
    if (!Array.isArray(ticketsCache)) return { grupos: [], squads: [], statuses: [] };
    return buildRadarFilters(ticketsCache, squads);
  }, [ticketsCache, squads]);

  const squadGrupoMap = filterOptions.squadGrupoMap || new Map();
  const escopoOptions = ESCOPO_RADAR_ORDER;

  const filteredTickets = useMemo(() => {
    if (!Array.isArray(ticketsCache)) return [];
    return ticketsCache.filter((t) => {
      if (scopeConfig.escopos.length > 0 && !scopeConfig.escopos.includes(normalizeEscopoKey(t.escopo))) return false;
      if (filters.tickets?.size > 0 && !filters.tickets.has(String(t.issueKey || '').trim().toUpperCase())) return false;
      if (filters.escopos.size > 0 && !filters.escopos.has(normalizeEscopoKey(t.escopo))) return false;
      if (filters.statuses.size > 0 && !filters.statuses.has(t.status)) return false;
      if (filters.grupos.size > 0) {
        const names = ticketGrupoNamesLocal(t);
        if (!names.some((n) => filters.grupos.has(n))) return false;
      }
      if (filters.squads.size > 0) {
        const allowed = new Set();
        for (const squadId of filters.squads) {
          for (const g of squadGrupoMap.get(squadId) || []) allowed.add(g);
        }
        const names = ticketGrupoNamesLocal(t);
        if (!names.some((n) => allowed.has(n))) return false;
      }
      if (filters.prioridades?.size > 0) {
        const p = t.prioridadeInterna != null ? Number(t.prioridadeInterna) : null;
        if (p === null || !filters.prioridades.has(p)) return false;
      }
      return true;
    });
  }, [ticketsCache, filters, squadGrupoMap, scopeConfig]);

  const ticketsWithRange = useMemo(() => {
    const now = new Date().toISOString();
    const sf = dateConfig.startField;
    const ef = dateConfig.endField;
    const drs = scopeConfig.dateRangeStart;
    const dre = scopeConfig.dateRangeEnd;

    // Fallback para data de fim: usa campos de milestone em ordem de prioridade
    // quando o endField configurado estiver vazio no ticket
    const END_FALLBACK_KEYS = [
      'dataEntregaProducaoPrevista',
      'dataFimHomologacaoEfetiva',
      'dataFimHomologacaoPlanejada',
      'dataInicioHomologacaoEfetiva',
      'dataInicioHomologacaoPlanejada',
      'dataAprovacaoQaPlanejada',
      'resolvedAt',
    ];
    const getEndDate = (t) => {
      if (t[ef]) return t[ef];
      for (const key of END_FALLBACK_KEYS) {
        if (key !== ef && t[key]) return t[key];
      }
      return now;
    };

    return filteredTickets
      .filter((t) => t[sf])
      .map((t) => ({ ...t, _rangeStart: t[sf], _rangeEnd: getEndDate(t) }))
      .filter((t) => {
        if (!drs && !dre) return true;
        const tS = new Date(t._rangeStart).getTime();
        const tE = new Date(t._rangeEnd).getTime();
        if (drs) {
          const sc = new Date(drs + 'T00:00:00').getTime();
          if (!Number.isNaN(sc) && tE < sc) return false;
        }
        if (dre) {
          const ec = new Date(dre + 'T23:59:59.999').getTime();
          if (!Number.isNaN(ec) && tS > ec) return false;
        }
        return true;
      });
  }, [filteredTickets, dateConfig, scopeConfig]);

  const { min: minDate, max: maxDate } = useMemo(
    () => findMinMaxDates(ticketsWithRange, '_rangeStart', '_rangeEnd'),
    [ticketsWithRange]
  );

  const columns = useMemo(() => {
    // Quando dateRange configurado, usa-o como boundary das colunas (corrige o filtro de periodo)
    let effectiveMin = minDate;
    let effectiveMax = maxDate;
    if (scopeConfig.dateRangeStart) {
      const rangeMin = new Date(scopeConfig.dateRangeStart + 'T00:00:00');
      if (!Number.isNaN(rangeMin.getTime())) effectiveMin = rangeMin;
    }
    if (scopeConfig.dateRangeEnd) {
      const rangeMax = new Date(scopeConfig.dateRangeEnd + 'T23:59:59');
      if (!Number.isNaN(rangeMax.getTime())) effectiveMax = rangeMax;
    }
    if (!effectiveMin || !effectiveMax) return [];
    return generateTimelineColumns(effectiveMin, effectiveMax, granularity);
  }, [minDate, maxDate, granularity, scopeConfig]);

  const superHeaderGroups = useMemo(() => collapseGroupLabels(columns), [columns]);
  const colWidth = getColWidth(granularity);
  const todayIdx = useMemo(() => todayColumnIndex(columns), [columns]);

  const groupKeyForTicket = useCallback(
    (ticket) => {
      switch (groupBy) {
        case 'escopo': return normalizeEscopoKey(ticket.escopo) || 'Sem escopo';
        case 'grupo': return ticket.grupoSuporte || 'Sem grupo';
        case 'status': return ticket.status || 'Sem status';
        case 'squad': {
          const names = ticketGrupoNamesLocal(ticket);
          for (const [squadId, grupos] of squadGrupoMap.entries()) {
            if (grupos.some((g) => names.includes(g))) {
              const squad = squads.find((s) => s.id === squadId);
              return squad ? squad.name || squad.nome || squad.sigla || squadId : squadId;
            }
          }
          return 'Sem squad';
        }
        default: return null;
      }
    },
    [groupBy, squadGrupoMap, squads]
  );

  const groupedRows = useMemo(() => {
    if (groupBy === 'none') return [{ key: '__all__', label: null, tickets: ticketsWithRange }];
    const map = new Map();
    for (const ticket of ticketsWithRange) {
      const key = groupKeyForTicket(ticket) || 'Outros';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ticket);
    }
    return [...map.entries()]
      .map(([key, tickets]) => ({ key, label: key, tickets }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
  }, [groupBy, ticketsWithRange, groupKeyForTicket]);

  const toggleGroupCollapse = (key) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleInSet = (field, value) => {
    setFilters((prev) => {
      const next = new Set(prev[field]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [field]: next };
    });
  };

  const clearFilters = () => setFilters(createEmptyFilters());

  const filterActive =
    filters.escopos.size > 0 || filters.squads.size > 0 || filters.grupos.size > 0 || filters.statuses.size > 0 || filters.tickets?.size > 0 || filters.prioridades?.size > 0;

  const handleSavePriority = async (issueKey) => {
    try {
      await updateTicketRadarFields(issueKey, { prioridadeInterna: editingPriorityValue });
      setTicketsCache((prev) =>
        Array.isArray(prev)
          ? prev.map((t) => t.issueKey === issueKey ? { ...t, prioridadeInterna: editingPriorityValue } : t)
          : prev
      );
    } catch (e) {
      console.error('Erro ao salvar prioridade:', e);
    } finally {
      setEditingPriority(null);
    }
  };

  const scopeActive =
    scopeConfig.escopos.length > 0 || Boolean(scopeConfig.dateRangeStart) || Boolean(scopeConfig.dateRangeEnd);

  const currentStateSnapshot = useMemo(
    () => serializeRoadmapState(filters, groupBy, granularity, dateConfig, scopeConfig),
    [filters, groupBy, granularity, dateConfig, scopeConfig]
  );

  const activeView = useMemo(
    () => savedViews.find((v) => v.id === activeViewId) || null,
    [savedViews, activeViewId]
  );

  const activeViewDirty =
    Boolean(activeView) && activeViewSnapshot !== null && activeViewSnapshot !== currentStateSnapshot;

  // Auto-reload quando uma visão é carregada
  useEffect(() => {
    if (!pendingAutoReload) return;
    setPendingAutoReload(false);
    handleCarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoReload]);

  const handleSaveView = async () => {
    if (!newViewName.trim() || !uid) return;
    setSavingView(true);
    try {
      const filtersPayload = {
        escopos: [...filters.escopos],
        squads: [...filters.squads],
        grupos: [...filters.grupos],
        statuses: [...filters.statuses],
        tickets: [...(filters.tickets || [])],
        prioridades: [...(filters.prioridades || [])],
      };
      const newId = await saveRoadmapGeralView(uid, {
        name: newViewName.trim(),
        filters: filtersPayload,
        groupBy,
        granularity,
        dateConfig,
        scopeConfig,
        isPrimary: newViewIsPrimary,
      });
      if (newViewIsPrimary) await setPrimaryRoadmapGeralView(uid, newId);
      const views = await fetchRoadmapGeralViews(uid);
      setSavedViews(views);
      setNewViewName('');
      setNewViewIsPrimary(false);
      setActiveViewId(newId);
      setActiveViewSnapshot(serializeRoadmapState(filters, groupBy, granularity, dateConfig, scopeConfig));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSavingView(false);
    }
  };

  const handleTogglePrimaryView = async (viewId) => {
    if (!uid) return;
    const view = savedViews.find((v) => v.id === viewId);
    if (!view) return;
    try {
      if (!view.isPrimary) await setPrimaryRoadmapGeralView(uid, viewId);
      else await setPrimaryRoadmapGeralView(uid, null);
      const views = await fetchRoadmapGeralViews(uid);
      setSavedViews(views);
    } catch (e) {
      setError(e?.message || String(e));
    }
  };

  const handleLoadView = (view) => {
    const snapshot = applyViewState(view);
    setActiveViewId(view.id);
    setActiveViewSnapshot(snapshot);
    // Limpa cache e dispara re-carga automática
    setTicketsCache(null);
    setPendingAutoReload(true);
  };

  const handleSaveChangesToActiveView = async () => {
    if (!activeView) return;
    setSavingView(true);
    try {
      const filtersPayloadActive = {
        escopos: [...filters.escopos],
        squads: [...filters.squads],
        grupos: [...filters.grupos],
        statuses: [...filters.statuses],
        tickets: [...(filters.tickets || [])],
        prioridades: [...(filters.prioridades || [])],
      };
      await updateRoadmapGeralView(activeView.id, {
        name: activeView.name,
        filters: filtersPayloadActive,
        groupBy,
        granularity,
        dateConfig,
        scopeConfig,
      });
      const views = await fetchRoadmapGeralViews(uid);
      setSavedViews(views);
      setActiveViewSnapshot(currentStateSnapshot);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSavingView(false);
    }
  };

  const handleDiscardActiveViewChanges = () => {
    if (!activeView) return;
    applyViewState(activeView);
    setActiveViewSnapshot(serializeRoadmapState(
      {
        escopos: new Set(activeView.filters?.escopos || []),
        squads: new Set(activeView.filters?.squads || []),
        grupos: new Set(activeView.filters?.grupos || []),
        statuses: new Set(activeView.filters?.statuses || []),
        tickets: new Set(activeView.filters?.tickets || []),
        prioridades: new Set((activeView.filters?.prioridades || []).map(Number).filter(Number.isFinite)),
      },
      activeView.groupBy || 'none',
      activeView.granularity || 'mes',
      activeView.dateConfig || createDefaultDateConfig(),
      activeView.scopeConfig || createDefaultScopeConfig()
    ));
  };

  const handleDeleteView = async (id) => {
    try {
      await deleteRoadmapGeralView(id);
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
      if (activeViewId === id) { setActiveViewId(null); setActiveViewSnapshot(null); }
    } catch (e) {
      setError(e?.message || String(e));
    }
  };

  const totalWidth = columns.length * colWidth;


  return (
    <Box p="5" className="roadmap-geral-page">
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="4">
        <Flex align="center" gap="3">
          <Route size={26} color="#22d3ee" />
          <Box>
            <Text as="h2" size="7" weight="bold" style={{ margin: 0 }}>Roadmap Geral</Text>
            <Text as="p" size="3" color="gray">
              {ticketsCache
                ? `${ticketsCache.length.toLocaleString('pt-BR')} tickets carregados`
                : 'Configure os filtros e clique em Carregar'}
            </Text>
          </Box>
        </Flex>
        <Flex align="center" gap="2">
          <Button
            size="3"
            variant="solid"
            color="indigo"
            onClick={handleCarregar}
            disabled={loading}
            style={{ minWidth: 130 }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spinner-icon" />
                {loadedCount > 0 ? `${loadedCount.toLocaleString('pt-BR')}...` : 'Carregando...'}
              </>
            ) : (
              <>
                <Route size={16} />
                {ticketsCache ? 'Recarregar' : 'Carregar'}
              </>
            )}
          </Button>

          {lastSyncAt && (
            <Flex align="center" gap="2" style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)' }}>
              <Clock size={13} color="#38bdf8" />
              <Text size="1" color="gray">
                Última carga:{' '}
                <Text as="span" size="1" weight="bold" style={{ color: 'var(--gray-12)' }}>
                  {lastSyncAt instanceof Date && !Number.isNaN(lastSyncAt.getTime())
                    ? lastSyncAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                </Text>
              </Text>
            </Flex>
          )}
          {/* Ícone de legenda dos milestones */}
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="ghost" color="gray" size="2" title="Legenda dos marcos de planejamento">
                <Info size={18} />
              </Button>
            </Popover.Trigger>
            <Popover.Content width="300px" side="bottom" align="end">
              <Flex direction="column" gap="3">
                <Text weight="bold" size="3">Legenda — Marcos de Planejamento</Text>
                <Text size="1" color="gray" as="div">
                  Círculos exibidos em cada linha do Roadmap indicando as datas-chave da demanda.
                </Text>
                <Flex direction="column" gap="2">
                  {MILESTONE_FIELDS.map((mf) => (
                    <Flex key={mf.key} align="center" gap="2">
                      <Box
                        style={{
                          width: 18, height: 18, borderRadius: '50%',
                          border: mf.highlight ? `1.5px solid ${mf.highlight.borderColor}` : '1.5px solid rgba(15,15,15,0.88)',
                          background: mf.highlight ? mf.highlight.background : 'rgba(255,255,255,0.92)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, fontWeight: 800,
                          color: mf.highlight ? mf.highlight.color : 'rgba(15,15,15,0.9)',
                          flexShrink: 0,
                        }}
                      >
                        {mf.letter}
                      </Box>
                      <Text size="2">{mf.label}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Flex>
            </Popover.Content>
          </Popover.Root>
        </Flex>
      </Flex>
      {loading && (
        <Box mb="3">
          <Progress value={loadProgress} />
          <Text size="1" color="gray" mt="1" as="div">
            {loadedCount.toLocaleString('pt-BR')} tickets carregados{loadProgress > 0 ? ` (${loadProgress}%)` : ''}...
          </Text>
        </Box>
      )}

      {error && (
        <Callout.Root color="red" mb="3"><Callout.Text>{error}</Callout.Text></Callout.Root>
      )}

      {activeView && (
        <Flex align="center" justify="between" gap="3" wrap="wrap" mb="3" className="roadmap-geral-active-view-bar">
          <Flex align="center" gap="2">
            <Save size={14} color="var(--rg-accent)" />
            <Text size="2">Visao ativa: <b>{activeView.name}</b></Text>
            {activeViewDirty && <Badge color="amber" variant="soft">alteracoes nao salvas</Badge>}
          </Flex>
          {activeViewDirty && (
            <Flex gap="2">
              <Button size="1" variant="soft" color="gray" onClick={handleDiscardActiveViewChanges}>Descartar alteracoes</Button>
              <Button size="1" onClick={handleSaveChangesToActiveView} disabled={savingView}>
                {savingView ? <Loader2 size={14} className="spinner-icon" /> : 'Salvar alteracoes nesta visao'}
              </Button>
            </Flex>
          )}
        </Flex>
      )}

      {/* ── Linha de controles ────────────────────────────────── */}
      <Flex align="center" justify="between" gap="3" wrap="wrap" mb="3">
        <Flex align="center" gap="2">
          <Layers size={16} color="var(--gray-9)" />
          <Text size="1" color="gray" style={{ letterSpacing: '0.05em' }}>AGRUPAR POR</Text>
          <Select.Root value={groupBy} onValueChange={setGroupBy}>
            <Select.Trigger style={{ minWidth: 140 }} />
            <Select.Content>
              {GROUP_BY_OPTIONS.map((opt) => (
                <Select.Item key={opt.value} value={opt.value}>{opt.label}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex align="center" gap="2">
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="outline"><Save size={16} /> Visoes Salvas ({savedViews.length})</Button>
            </Popover.Trigger>
            <Popover.Content width="300px">
              <Text weight="bold" mb="2" as="div">Salvar visao atual</Text>
              <Flex gap="2" mb="1">
                <TextField.Root placeholder="Nome da visao..." value={newViewName} onChange={(e) => setNewViewName(e.target.value)} style={{ flex: 1 }} />
                <Button size="1" onClick={handleSaveView} disabled={!newViewName.trim() || savingView || !uid}>
                  {savingView ? <Loader2 size={14} className="spinner-icon" /> : 'Salvar'}
                </Button>
              </Flex>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <input type="checkbox" checked={newViewIsPrimary} onChange={(e) => setNewViewIsPrimary(e.target.checked)} />
                <Text size="1" color="gray">Definir como visao principal (carrega ao abrir)</Text>
              </label>
              <Text weight="bold" mb="2" as="div">Carregar visao</Text>
              <Flex direction="column" gap="2">
                {savedViewsLoading ? <Loader2 size={16} className="spinner-icon" /> : savedViews.length === 0 ? (
                  <Text size="1" color="gray">Nenhuma visao salva.</Text>
                ) : (
                  [...savedViews].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)).map((view) => (
                    <Flex key={view.id} justify="between" align="center" style={{ background: view.isPrimary ? 'rgba(56,189,248,0.08)' : 'var(--gray-3)', border: view.isPrimary ? '1px solid rgba(56,189,248,0.35)' : '1px solid transparent', padding: 8, borderRadius: 6 }}>
                      <Flex align="center" gap="2" style={{ flex: 1 }}>
                        <input type="checkbox" checked={!!view.isPrimary} title="Definir como visao principal" onChange={() => handleTogglePrimaryView(view.id)} />
                        <Text size="2" style={{ cursor: 'pointer' }} onClick={() => handleLoadView(view)}>{view.name}{view.isPrimary && <Badge color="sky" variant="soft" ml="2" size="1">principal</Badge>}</Text>
                      </Flex>
                      <Trash2 size={14} style={{ cursor: 'pointer', color: 'var(--red-9)' }} onClick={() => handleDeleteView(view.id)} />
                    </Flex>
                  ))
                )}
              </Flex>
            </Popover.Content>
          </Popover.Root>
        </Flex>
      </Flex>

      {/* ── Barra de filtros colapsável (estilo PlanejamentoCiclo) ── */}
      <Box style={{ background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 10, marginBottom: 18 }}>

        {/* Header toggle */}
        <Flex
          align="center" gap="8" style={{ padding: '8px 14px', borderBottom: filtersCollapsed ? 'none' : '1px solid var(--gray-5)', cursor: 'pointer', userSelect: 'none', borderRadius: filtersCollapsed ? 10 : '10px 10px 0 0' }}
          onClick={() => { const n = !filtersCollapsed; setFiltersCollapsed(n); localStorage.setItem('roadmap_filtersCollapsed', String(n)); }}
        >
          <Filter size={13} color="var(--gray-9)" />
          <Text size="2" weight="bold" color="gray" style={{ letterSpacing: '0.05em', flex: 1 }}>FILTROS</Text>
          {(filterActive || scopeActive) && (
            <Badge size="1" color="indigo">{[filters.escopos, filters.squads, filters.grupos, filters.statuses, filters.prioridades, filters.tickets].filter(s => s.size > 0).length + (scopeActive ? 1 : 0)} ativo{[filters.escopos, filters.squads, filters.grupos, filters.statuses, filters.prioridades, filters.tickets].filter(s => s.size > 0).length + (scopeActive ? 1 : 0) !== 1 ? 's' : ''}</Badge>
          )}
          <span style={{ color: 'var(--gray-9)', display: 'flex' }}>{filtersCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
        </Flex>

        {!filtersCollapsed && (
        <>
        {/* Row 1: Squad tags + Escopo tags */}
        <Flex wrap="wrap" align="center" gap="8" style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-5)' }}>
          <Flex align="center" gap="5" style={{ flexShrink: 0, marginRight: 4 }}>
            <Filter size={13} />
            <Text size="2" weight="bold" color="gray">SQUAD</Text>
          </Flex>
          {squads.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(sq => {
            const active = filters.squads.has(sq.id);
            return (
              <button key={sq.id} type="button"
                onClick={() => { const next = new Set(filters.squads); active ? next.delete(sq.id) : next.add(sq.id); setFilters(p => ({ ...p, squads: next })); }}
                style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, cursor: 'pointer', userSelect: 'none', border: active ? '1px solid rgba(99,102,241,0.7)' : '1px solid var(--gray-5)', background: active ? 'rgba(99,102,241,0.2)' : 'var(--gray-3)', color: active ? '#a5b4fc' : 'var(--gray-10)', transition: 'all 0.12s' }}
              >{sq.sigla || sq.name || sq.nome}</button>
            );
          })}
          <span style={{ width: 1, height: 20, background: 'var(--gray-5)', flexShrink: 0, margin: '0 4px' }} />
          <Text size="2" weight="bold" color="gray" style={{ flexShrink: 0 }}>ESCOPO</Text>
          {ESCOPO_RADAR_ORDER.map(esc => {
            const active = filters.escopos.has(esc.key);
            return (
              <button key={esc.key} type="button"
                onClick={() => { const next = new Set(filters.escopos); active ? next.delete(esc.key) : next.add(esc.key); setFilters(p => ({ ...p, escopos: next })); }}
                style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, cursor: 'pointer', userSelect: 'none', border: active ? '1px solid rgba(52,211,153,0.7)' : '1px solid var(--gray-5)', background: active ? 'rgba(52,211,153,0.15)' : 'var(--gray-3)', color: active ? '#6ee7b7' : 'var(--gray-10)', transition: 'all 0.12s' }}
              >{esc.label}</button>
            );
          })}
          {(filterActive || scopeActive) && (
            <button onClick={() => { clearFilters(); setScopeConfig(createDefaultScopeConfig()); }} style={{ fontSize: 11, padding: '3px 10px', background: 'none', border: '1px solid var(--gray-5)', borderRadius: 6, cursor: 'pointer', color: 'var(--gray-10)', marginLeft: 'auto' }}>Limpar filtros</button>
          )}
        </Flex>

        {/* Row 2: MultiSelect dropdowns */}
        <Flex wrap="wrap" gap="8" align="center" style={{ padding: '10px 14px', borderBottom: '1px solid var(--gray-5)' }}>
          <MultiSelectFilter options={(filterOptions.statuses || []).map(s => s.nome)} selected={filters.statuses} onChange={s => setFilters(p => ({ ...p, statuses: s }))} placeholder="Todos os status" maxWidth={200} />
          <MultiSelectFilter options={(filterOptions.grupos || []).map(g => g.nome)} selected={filters.grupos} onChange={g => setFilters(p => ({ ...p, grupos: g }))} placeholder="Grupo atendimento" maxWidth={200} />
          <MultiSelectFilter options={PRIORIDADE_INTERNA_OPTIONS.map(p => p.value)} selected={filters.prioridades} onChange={p => setFilters(prev => ({ ...prev, prioridades: p }))} placeholder="Todas as prioridades" maxWidth={180} />
        </Flex>

        {/* Row 3: EXIBIÇÃO (barras, marcos, período, escopo carga) */}
        <Flex wrap="wrap" gap="10" align="stretch" style={{ padding: '10px 14px' }}>

          {/* Box: Barras */}
          <Flex wrap="nowrap" gap="8" align="center" style={{ border: '1px solid var(--gray-5)', borderRadius: 8, padding: '6px 12px', background: 'var(--gray-3)', flexShrink: 0 }}>
            <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.06em', flexShrink: 0, marginRight: 4 }}>BARRAS</Text>
            <Box>
              <Text size="1" color="gray" style={{ display: 'block', marginBottom: 3 }}>Início</Text>
              <select value={dateConfig.startField} onChange={e => setDateConfig(p => ({ ...p, startField: e.target.value }))} style={{ fontSize: 12, background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '3px 8px', color: 'var(--gray-12)', maxWidth: 160 }}>
                {START_FIELD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </Box>
            <Box>
              <Text size="1" color="gray" style={{ display: 'block', marginBottom: 3 }}>Fim</Text>
              <select value={dateConfig.endField} onChange={e => setDateConfig(p => ({ ...p, endField: e.target.value }))} style={{ fontSize: 12, background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '3px 8px', color: 'var(--gray-12)', maxWidth: 160 }}>
                {END_FIELD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </Box>
          </Flex>

          {/* Box: Marcos A-F */}
          <Flex wrap="nowrap" gap="8" align="flex-start" style={{ border: '1px solid var(--gray-5)', borderRadius: 8, padding: '6px 12px', background: 'var(--gray-3)', flexShrink: 0 }}>
            <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.06em', flexShrink: 0, marginRight: 4, marginTop: 2 }}>MARCOS</Text>
            <Flex direction="column" gap="1">
              {MILESTONE_FIELDS.map(mf => (
                <label key={mf.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox"
                    checked={!scopeConfig.visibleMilestones?.length || scopeConfig.visibleMilestones.includes(mf.key)}
                    onChange={() => setScopeConfig(prev => {
                      const cur = prev.visibleMilestones?.length ? prev.visibleMilestones : MILESTONE_FIELDS.map(f => f.key);
                      const nxt = cur.includes(mf.key) ? cur.filter(k => k !== mf.key) : [...cur, mf.key];
                      return { ...prev, visibleMilestones: nxt.length === MILESTONE_FIELDS.length ? [] : nxt };
                    })}
                    style={{ accentColor: 'var(--indigo-9)', width: 12, height: 12, flexShrink: 0 }}
                  />
                  <div style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: mf.highlight?.background || '#fff', border: '1.5px solid rgba(15,15,15,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: mf.highlight?.color || '#000' }}>{mf.letter}</div>
                  <span style={{ fontSize: 11, color: 'var(--gray-11)' }}>{mf.label}</span>
                </label>
              ))}
            </Flex>
          </Flex>

          {/* Box: Periodo + Escopo de carga */}
          <Flex direction="column" gap="8" style={{ border: '1px solid var(--gray-5)', borderRadius: 8, padding: '6px 12px', background: 'var(--gray-3)', flex: '1 1 auto', minWidth: 200 }}>
            <Text size="1" weight="bold" color="gray" style={{ letterSpacing: '0.06em' }}>PERIODO / ESCOPO</Text>
            <Flex gap="8" wrap="wrap" align="center">
              <Box>
                <Text size="1" color="gray" style={{ display: 'block', marginBottom: 3 }}>De</Text>
                <input type="date" value={scopeConfig.dateRangeStart} onChange={e => setScopeConfig(p => ({ ...p, dateRangeStart: e.target.value }))} style={{ fontSize: 12, background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '3px 8px', color: 'var(--gray-12)' }} />
              </Box>
              <Box>
                <Text size="1" color="gray" style={{ display: 'block', marginBottom: 3 }}>Ate</Text>
                <input type="date" value={scopeConfig.dateRangeEnd} onChange={e => setScopeConfig(p => ({ ...p, dateRangeEnd: e.target.value }))} style={{ fontSize: 12, background: 'var(--gray-2)', border: '1px solid var(--gray-5)', borderRadius: 6, padding: '3px 8px', color: 'var(--gray-12)' }} />
              </Box>
            </Flex>
            <Flex gap="6" wrap="wrap" align="center">
              <Text size="1" color="gray" style={{ flexShrink: 0 }}>Escopo carga:</Text>
              {ESCOPO_RADAR_ORDER.map(esc => (
                <label key={esc.key} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={scopeConfig.escopos.includes(esc.key)} onChange={() => setScopeConfig(prev => { const nxt = prev.escopos.includes(esc.key) ? prev.escopos.filter(k => k !== esc.key) : [...prev.escopos, esc.key]; return { ...prev, escopos: nxt }; })} style={{ accentColor: 'var(--indigo-9)', width: 12, height: 12, flexShrink: 0 }} />
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: esc.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--gray-11)' }}>{esc.label}</span>
                </label>
              ))}
            </Flex>
          </Flex>

        </Flex>
        </>
        )}
      </Box>


      {/* Timeline */}
      {columns.length === 0 ? (
        <Text color="gray">Nenhum ticket com data encontrado para os filtros selecionados.</Text>
      ) : (() => {
        const todayPx = todayPixelOffset(columns, colWidth);
        return (
          <Box className="roadmap-geral-timeline-wrap">
            <Box className="roadmap-geral-timeline" style={{ width: totalWidth + 258 }}>
              <Box className="roadmap-geral-header-row">
                <Box className="roadmap-geral-row-label-cell roadmap-geral-header-corner" />
                <Box className="roadmap-geral-priority-cell roadmap-geral-header-corner" style={{ fontSize: 9, fontWeight: 700, color: 'var(--gray-9)', letterSpacing: '0.05em', cursor: 'default' }}>PRIO</Box>
                <Flex>
                  {superHeaderGroups.map((g, idx) => (
                    <Box key={`${g.label}-${idx}`} className="roadmap-geral-super-header" style={{ width: g.span * colWidth }}>
                      <Text size="1" color="gray">{g.label}</Text>
                    </Box>
                  ))}
                </Flex>
              </Box>
              <Box className="roadmap-geral-header-row roadmap-geral-header-row-cols">
                <Box className="roadmap-geral-row-label-cell roadmap-geral-header-corner" />
                <Box className="roadmap-geral-priority-cell roadmap-geral-header-corner" />
                <Flex>
                  {columns.map((col, idx) => (
                    <Box key={col.key} className={`roadmap-geral-col-header${idx === todayIdx ? ' is-today' : ''}`} style={{ width: colWidth }}>
                      <Text size="1">{col.label}</Text>
                    </Box>
                  ))}
                </Flex>
              </Box>
              <Box className="roadmap-geral-body-wrap" style={{ position: 'relative' }}>
                {todayPx !== null && (
                  <Box className="roadmap-geral-today-line" style={{ left: 258 + todayPx }} title={`Hoje: ${new Date().toLocaleDateString('pt-BR')}`} />
                )}
                {groupedRows.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.key);
                  return (
                    <Box key={group.key}>
                      {group.label !== null && (
                        <Flex align="center" gap="2" className="roadmap-geral-group-header" onClick={() => toggleGroupCollapse(group.key)}>
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          <Text size="2" weight="bold">{group.label}</Text>
                          <Badge color="gray" variant="soft">{group.tickets.length}</Badge>
                        </Flex>
                      )}
                      {!isCollapsed && group.tickets.map((ticket) => {
                        const pos = computeBarPosition(columns, ticket._rangeStart, ticket._rangeEnd);
                        return (
                          <Flex key={ticket.issueKey} align="center" className="roadmap-geral-row">
                            <Box className="roadmap-geral-row-label-cell">
                              <Text size="1" className="roadmap-geral-row-label-text" title={ticket.summary} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {ticket.issueUrl ? (
                                  <a
                                    href={ticket.issueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--rg-accent)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {ticket.issueKey}
                                  </a>
                                ) : (
                                  <span style={{ flexShrink: 0 }}>{ticket.issueKey}</span>
                                )}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {' · '}{ticket.summary || 'Sem titulo'}
                                </span>
                              </Text>
                            </Box>
                            {/* Coluna Prioridade Interna editável */}
                            <Box
                              className="roadmap-geral-priority-cell"
                              title={editingPriority === ticket.issueKey ? undefined : 'Clique para definir prioridade interna'}
                              onClick={() => {
                                if (editingPriority !== ticket.issueKey) {
                                  setEditingPriority(ticket.issueKey);
                                  setEditingPriorityValue(ticket.prioridadeInterna ?? null);
                                }
                              }}
                            >
                              {editingPriority === ticket.issueKey ? (
                                <div className="roadmap-geral-priority-editor" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    className="roadmap-geral-priority-select"
                                    value={editingPriorityValue ?? ''}
                                    autoFocus
                                    onChange={(e) => setEditingPriorityValue(e.target.value === '' ? null : Number(e.target.value))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSavePriority(ticket.issueKey); if (e.key === 'Escape') setEditingPriority(null); }}
                                  >
                                    <option value="">—</option>
                                    {PRIORIDADE_INTERNA_OPTIONS.map((p) => (
                                      <option key={p.value} value={p.value}>{p.label} {p.description}</option>
                                    ))}
                                  </select>
                                  <div className="roadmap-geral-priority-actions">
                                    <button className="roadmap-geral-priority-confirm" title="Confirmar" onClick={() => handleSavePriority(ticket.issueKey)}>✓</button>
                                    <button className="roadmap-geral-priority-cancel" title="Cancelar" onClick={() => setEditingPriority(null)}>✗</button>
                                  </div>
                                </div>
                              ) : (() => {
                                const pm = getPrioridadeInternaMeta(ticket.prioridadeInterna);
                                return pm ? (
                                  <span className="roadmap-geral-priority-badge" style={{ background: pm.color }} title={`${pm.label} — ${pm.description}`}>{pm.label}</span>
                                ) : (
                                  <div className="roadmap-geral-priority-empty" title="Sem prioridade definida" />
                                );
                              })()}
                            </Box>
                            <Box className="roadmap-geral-row-track" style={{ width: totalWidth }}>
                              {pos && (
                                <Box className="roadmap-geral-bar-wrap" style={{ marginLeft: pos.offset * colWidth }}>
                                  <Box className="roadmap-geral-bar" style={{ width: Math.max(pos.span * colWidth - 4, 6), background: barColorForTicket(ticket) }} />
                                  <Box className="roadmap-geral-bar-tooltip">
                                    <b>{ticket.issueKey}</b>
                                    <span style={{ color: 'var(--gray-11)' }}>{ticket.status}</span>
                                    <span>Inicio: <b>{formatShortDate(ticket._rangeStart)}</b></span>
                                    <span>Fim: <b>{formatShortDate(ticket._rangeEnd)}</b></span>
                                  </Box>
                                </Box>
                              )}
                              {/* Circulos de milestone: datas-chave com letra identificadora */}
                              {MILESTONE_FIELDS.filter((mf) =>
                                !scopeConfig.visibleMilestones?.length ||
                                scopeConfig.visibleMilestones.includes(mf.key)
                              ).map((mf) => {
                                const px = getMilestonePixelOffset(columns, ticket[mf.key], colWidth);
                                if (px === null) return null;
                                return (
                                  <div key={mf.key} className="roadmap-geral-milestone" style={{ left: px }}>
                                    <div
                                      className="roadmap-geral-milestone-circle"
                                      style={mf.highlight ? {
                                        background: mf.highlight.background,
                                        borderColor: mf.highlight.borderColor,
                                        color: mf.highlight.color,
                                      } : undefined}
                                    >
                                      {mf.letter}
                                    </div>
                                    <div className="roadmap-geral-milestone-tooltip">
                                      <b>{mf.letter ? `${mf.letter} — ` : ''}{mf.label}</b>
                                      <span>{formatShortDate(ticket[mf.key])}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </Box>
                          </Flex>
                        );
                      })}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        );
      })()}

      <Flex justify="end" mt="3">
        <Flex align="center" gap="2" className="roadmap-geral-granularity-footer">
          {ROADMAP_GRANULARITY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="1"
              variant={granularity === opt.value ? 'solid' : 'soft'}
              color={granularity === opt.value ? 'indigo' : 'gray'}
              onClick={() => setGranularity(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </Flex>
      </Flex>
    </Box>
  );
};

export default RoadmapGeral;
