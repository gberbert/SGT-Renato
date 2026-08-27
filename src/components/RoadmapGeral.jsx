import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Select, Button, TextField, Popover, Badge, Callout, Progress, Separator } from '@radix-ui/themes';
import { Route, Filter, Layers, Save, Loader2, Trash2, ChevronRight, ChevronDown, Settings } from 'lucide-react';
import { auth } from '../firebase';
import { useOperacaoRadar } from '../contexts/OperacaoRadarContext';
import {
  fetchTicketsForRoadmap,
  fetchSquadsForRadar,
  buildRadarFilters,
  normalizeEscopoKey,
  ESCOPO_RADAR_ORDER,
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
  { value: 'resolvedAt', label: 'Data de Resolucao (RESOLVED_AT)' },
  { value: 'dataPrevisao', label: 'Data de Previsao (campo interno)' },
  { value: 'updatedAt', label: 'Data de Atualizacao (UPDATE_AT)' },
];

const START_FIELD_OPTIONS = DATE_FIELD_OPTIONS;
const END_FIELD_OPTIONS = DATE_FIELD_OPTIONS;

function createDefaultDateConfig() {
  return { startField: 'createdAt', endField: 'resolvedAt' };
}

function createDefaultScopeConfig() {
  return { escopos: [], dateRangeStart: '', dateRangeEnd: '' };
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
    groupBy,
    granularity,
    dateConfig,
    scopeConfig,
  });
}

function createEmptyFilters() {
  return { escopos: new Set(), squads: new Set(), grupos: new Set(), statuses: new Set() };
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

/** Todas as datas de planejamento exibidas como circulos sutis na linha de cada ticket */
const MILESTONE_FIELDS = [
  { key: 'dataAprovacaoEfsr', label: 'Aprovacao EF/SR', color: '#38bdf8' },
  { key: 'dataInicioAtendimentoPlanejada', label: 'Inicio Atendimento Planejado', color: '#60a5fa' },
  { key: 'dataInicioAtendimento', label: 'Inicio Atendimento', color: '#818cf8' },
  { key: 'dataAprovacaoQaPlanejada', label: 'Aprovacao QA Planejada', color: '#c084fc' },
  { key: 'dataInicioHomologacaoPlanejada', label: 'Inicio Homologacao Planejada', color: '#fb923c' },
  { key: 'dataFimHomologacaoPlanejada', label: 'Fim Homologacao Planejada', color: '#f87171' },
  { key: 'dataEntregaProducaoPrevista', label: 'Entrega em Producao Prevista', color: '#4ade80' },
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
  const { statsRadar, statsFingerprint, squads: radarSquads, ensureRadarBootstrap } = useOperacaoRadar();

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

  const uid = auth.currentUser?.uid || null;

  // applyViewState definida antes dos useEffects para poder ser chamada no carregamento inicial
  const applyViewState = (view) => {
    const nextFilters = {
      escopos: new Set(view.filters?.escopos || []),
      squads: new Set(view.filters?.squads || []),
      grupos: new Set(view.filters?.grupos || []),
      statuses: new Set(view.filters?.statuses || []),
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
    filters.escopos.size > 0 || filters.squads.size > 0 || filters.grupos.size > 0 || filters.statuses.size > 0;

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

  const handleSaveView = async () => {
    if (!newViewName.trim() || !uid) return;
    setSavingView(true);
    try {
      const filtersPayload = {
        escopos: [...filters.escopos],
        squads: [...filters.squads],
        grupos: [...filters.grupos],
        statuses: [...filters.statuses],
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
  };

  const handleSaveChangesToActiveView = async () => {
    if (!activeView) return;
    setSavingView(true);
    try {
      const filtersPayload = {
        escopos: [...filters.escopos],
        squads: [...filters.squads],
        grupos: [...filters.grupos],
        statuses: [...filters.statuses],
      };
      await updateRoadmapGeralView(activeView.id, {
        name: activeView.name,
        filters: filtersPayload,
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

      <Flex className="roadmap-geral-toolbar" align="center" justify="between" wrap="wrap" gap="3" mb="4">
        <Flex align="center" gap="3" wrap="wrap">
          {/* Filtros de exibicao */}
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="surface" color={filterActive || scopeActive ? 'amber' : 'gray'}>
                <Filter size={16} /> Filtros{filterActive || scopeActive ? ' •' : ''}
              </Button>
            </Popover.Trigger>
            <Popover.Content width="340px" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <Flex direction="column" gap="3">
                <Text weight="bold" size="3">Filtros</Text>
                <Box>
                  <Text as="div" size="1" weight="bold" mb="1">Escopo</Text>
                  <Flex direction="column" gap="1" style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {escopoOptions.map((esc) => (
                      <label key={esc.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={filters.escopos.has(esc.key)} onChange={() => toggleInSet('escopos', esc.key)} />
                        <Text size="2">{esc.label}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>
                <Box>
                  <Text as="div" size="1" weight="bold" mb="1">Squad</Text>
                  <Flex direction="column" gap="1" style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {(filterOptions.squads || []).map((s) => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={filters.squads.has(s.id)} onChange={() => toggleInSet('squads', s.id)} />
                        <Text size="2">{s.sigla ? `${s.sigla} - ${s.nome}` : s.nome}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>
                <Box>
                  <Text as="div" size="1" weight="bold" mb="1">Grupo de Atendimento</Text>
                  <Flex direction="column" gap="1" style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {(filterOptions.grupos || []).map((g) => (
                      <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={filters.grupos.has(g.nome)} onChange={() => toggleInSet('grupos', g.nome)} />
                        <Text size="2">{g.nome}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>
                <Box>
                  <Text as="div" size="1" weight="bold" mb="1">Status</Text>
                  <Flex direction="column" gap="1" style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {(filterOptions.statuses || []).map((s) => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={filters.statuses.has(s.nome)} onChange={() => toggleInSet('statuses', s.nome)} />
                        <Text size="2">{s.nome}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>

                <Separator size="4" />

                {/* Periodo da Timeline */}
                <Box>
                  <Flex align="center" justify="between" mb="1">
                    <Text as="div" size="2" weight="bold">Periodo da Timeline</Text>
                    {(scopeConfig.dateRangeStart || scopeConfig.dateRangeEnd) && (
                      <Button size="1" variant="ghost" color="gray" onClick={() => setScopeConfig((p) => ({ ...p, dateRangeStart: '', dateRangeEnd: '' }))}>Limpar</Button>
                    )}
                  </Flex>
                  <Text size="1" color="gray" mb="2" as="div">Filtra tickets cujas barras se sobrepoem ao intervalo (usa os campos de data configurados no icone de engrenagem).</Text>
                  <Flex direction="column" gap="2">
                    <Box>
                      <Text as="div" size="1" weight="bold" mb="1">Data de Inicio</Text>
                      <input type="date" value={scopeConfig.dateRangeStart} onChange={(e) => setScopeConfig((p) => ({ ...p, dateRangeStart: e.target.value }))} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--gray-6)', background: 'var(--gray-2)', color: 'var(--gray-12)', fontSize: 13 }} />
                    </Box>
                    <Box>
                      <Text as="div" size="1" weight="bold" mb="1">Data de Fim</Text>
                      <input type="date" value={scopeConfig.dateRangeEnd} onChange={(e) => setScopeConfig((p) => ({ ...p, dateRangeEnd: e.target.value }))} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--gray-6)', background: 'var(--gray-2)', color: 'var(--gray-12)', fontSize: 13 }} />
                    </Box>
                  </Flex>
                </Box>

                {(filterActive || scopeActive) && (
                  <Button variant="soft" color="gray" size="1" onClick={() => { clearFilters(); setScopeConfig(createDefaultScopeConfig()); }}>
                    Limpar todos os filtros
                  </Button>
                )}
              </Flex>
            </Popover.Content>
          </Popover.Root>

          {filters.escopos.size > 0 && (
            <Badge color="indigo" variant="soft">Escopo: {[...filters.escopos].join(', ')}</Badge>
          )}
          {filters.squads.size > 0 && (
            <Badge color="indigo" variant="soft">
              Squad: {[...filters.squads].map((id) => { const s = (filterOptions.squads || []).find((sq) => sq.id === id); return s ? s.sigla || s.nome : id; }).join(', ')}
            </Badge>
          )}
          {filters.grupos.size > 0 && (
            <Badge color="indigo" variant="soft">Grupo: {[...filters.grupos].join(', ')}</Badge>
          )}
          {filters.statuses.size > 0 && (
            <Badge color="indigo" variant="soft">Status: {[...filters.statuses].join(', ')}</Badge>
          )}

          <Flex align="center" gap="2">
            <Layers size={16} color="var(--text-muted)" />
            <Text size="1" color="gray" style={{ letterSpacing: '0.05em' }}>AGRUPAR POR</Text>
            <Select.Root value={groupBy} onValueChange={setGroupBy}>
              <Select.Trigger style={{ minWidth: 170 }} />
              <Select.Content>
                {GROUP_BY_OPTIONS.map((opt) => (
                  <Select.Item key={opt.value} value={opt.value}>{opt.label}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>

        <Flex align="center" gap="2">
          <Badge color="gray" variant="soft" className="roadmap-geral-date-badge">
            {dateFieldLabel(dateConfig.startField)} → {dateFieldLabel(dateConfig.endField)}
          </Badge>

          {/* Icone de configuracoes: apenas campos de data das barras */}
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="soft" color="gray" title="Configurar campos de data das barras">
                <Settings size={16} />
              </Button>
            </Popover.Trigger>
            <Popover.Content width="300px">
              <Flex direction="column" gap="3">
                <Text weight="bold" size="3">Configuracoes da Timeline</Text>

                {/* Escopo do Roadmap */}
                <Box>
                  <Flex align="center" justify="between" mb="1">
                    <Text as="div" size="2" weight="bold">Escopo dos Tickets</Text>
                    {scopeConfig.escopos.length > 0 && (
                      <Button size="1" variant="ghost" color="gray" onClick={() => setScopeConfig((p) => ({ ...p, escopos: [] }))}>Limpar</Button>
                    )}
                  </Flex>
                  <Text size="1" color="gray" mb="2" as="div">
                    Define quais escopos serao buscados ao clicar em Carregar. Vazio = todos.
                  </Text>
                  <Flex direction="column" gap="1">
                    {ESCOPO_RADAR_ORDER.map((esc) => (
                      <label key={esc.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={scopeConfig.escopos.includes(esc.key)} onChange={() => { setScopeConfig((prev) => { const next = prev.escopos.includes(esc.key) ? prev.escopos.filter((k) => k !== esc.key) : [...prev.escopos, esc.key]; return { ...prev, escopos: next }; }); }} />
                        <Box style={{ width: 10, height: 10, borderRadius: 3, background: esc.color, flexShrink: 0 }} />
                        <Text size="2">{esc.label}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>

                <Separator size="4" />

                <Text as="div" size="2" weight="bold">Campos de Data das Barras</Text>
                <Text size="1" color="gray" as="div">Escolha quais campos do ticket definem o inicio e fim de cada barra na timeline.</Text>

                {/* Campos de Data */}
                <Flex direction="column" gap="2">
                    <Box>
                      <Text as="div" size="1" weight="bold" mb="1">Campo de Inicio</Text>
                      <Select.Root value={dateConfig.startField} onValueChange={(v) => setDateConfig((p) => ({ ...p, startField: v }))}>
                        <Select.Trigger style={{ width: '100%' }} />
                        <Select.Content>
                          {START_FIELD_OPTIONS.map((opt) => (
                            <Select.Item key={opt.value} value={opt.value}>{opt.label}</Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    </Box>
                    <Box>
                      <Text as="div" size="1" weight="bold" mb="1">Campo de Fim</Text>
                      <Select.Root value={dateConfig.endField} onValueChange={(v) => setDateConfig((p) => ({ ...p, endField: v }))}>
                        <Select.Trigger style={{ width: '100%' }} />
                        <Select.Content>
                          {END_FIELD_OPTIONS.map((opt) => (
                            <Select.Item key={opt.value} value={opt.value}>{opt.label}</Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    </Box>
                </Flex>
                <Text size="1" color="gray" mt="1" as="div">
                  Quando o campo de fim estiver vazio, a barra e exibida ate hoje.
                </Text>
              </Flex>
            </Popover.Content>
          </Popover.Root>

          {/* Visoes Salvas */}
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
                {savedViewsLoading ? (
                  <Loader2 size={16} className="spinner-icon" />
                ) : savedViews.length === 0 ? (
                  <Text size="1" color="gray">Nenhuma visao salva.</Text>
                ) : (
                  [...savedViews].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)).map((view) => (
                    <Flex key={view.id} justify="between" align="center" style={{ background: view.isPrimary ? 'rgba(56,189,248,0.08)' : 'var(--gray-3)', border: view.isPrimary ? '1px solid rgba(56,189,248,0.35)' : '1px solid transparent', padding: 8, borderRadius: 6 }}>
                      <Flex align="center" gap="2" style={{ flex: 1 }}>
                        <input type="checkbox" checked={!!view.isPrimary} title="Definir como visao principal" onChange={() => handleTogglePrimaryView(view.id)} />
                        <Text size="2" style={{ cursor: 'pointer' }} onClick={() => handleLoadView(view)}>
                          {view.name}
                          {view.isPrimary && <Badge color="sky" variant="soft" ml="2" size="1">principal</Badge>}
                        </Text>
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

      {/* Timeline */}
      {columns.length === 0 ? (
        <Text color="gray">Nenhum ticket com data encontrado para os filtros selecionados.</Text>
      ) : (() => {
        const todayPx = todayPixelOffset(columns, colWidth);
        return (
          <Box className="roadmap-geral-timeline-wrap">
            <Box className="roadmap-geral-timeline" style={{ width: totalWidth + 240 }}>
              <Box className="roadmap-geral-header-row">
                <Box className="roadmap-geral-row-label-cell roadmap-geral-header-corner" />
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
                  <Box className="roadmap-geral-today-line" style={{ left: 240 + todayPx }} title={`Hoje: ${new Date().toLocaleDateString('pt-BR')}`} />
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
                              <Text size="1" className="roadmap-geral-row-label-text" title={ticket.summary}>
                                {ticket.issueKey} · {ticket.summary || 'Sem titulo'}
                              </Text>
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
                              {/* Circulos sutis de milestone: datas de planejamento de cada etapa */}
                              {MILESTONE_FIELDS.map((mf) => {
                                const px = getMilestonePixelOffset(columns, ticket[mf.key], colWidth);
                                if (px === null) return null;
                                return (
                                  <div key={mf.key} className="roadmap-geral-milestone" style={{ left: px }}>
                                    <div
                                      className="roadmap-geral-milestone-circle"
                                      style={{ borderColor: mf.color, background: `${mf.color}30` }}
                                    />
                                    <div className="roadmap-geral-milestone-tooltip">
                                      <b style={{ color: mf.color }}>{mf.label}</b>
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
