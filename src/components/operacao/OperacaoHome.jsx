import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Flex, Text, Callout, Progress, TextField, Tabs as RadixTabs } from '@radix-ui/themes';
import { Radar, RefreshCw, XCircle, Search, ChevronRight, ChevronDown, Loader2, Clock } from 'lucide-react';
import OperacaoMultiCombobox from './OperacaoMultiCombobox';
import OperacaoDateRangeFilter from './OperacaoDateRangeFilter';
import OperacaoEscopoTimelineChart from './OperacaoEscopoTimelineChart';
import OperacaoEfficiencyChart from './OperacaoEfficiencyChart';
import OperacaoObservabilidade from './OperacaoObservabilidade';
import { useOperacaoRadar } from '../../contexts/OperacaoRadarContext';
import { formatCallableError } from '../../utils/callableError';
import { getPermissionProfile } from '../../services/permissionService';
import { PermissionFunctionKeys } from '../../services/permissionKeys';
import {
  createRadarFilterState,
  fetchTicketsForDrill,
  fetchTicketsGlobalForRadar,
  filterTickets,
  flattenDrillHierarchy,
  getEscopoRadarMeta,
  prepareDrillHierarchy,
  computeRadarEscopos,
  updateTicketRadarFields,
  PRIORIDADE_INTERNA_OPTIONS,
} from '../../services/operacaoRadarService';
import './operacao-radar.css';

const formatNumber = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR');
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
};

const RADAR_TAB_DEFS = [
  { value: 'GERAL', slug: 'geral', label: 'Geral', requiredFn: PermissionFunctionKeys.RADAR_GERAL_VIEW },
  { value: 'PROBLEMAS', slug: 'problemas', label: 'Problemas', requiredFn: PermissionFunctionKeys.RADAR_PROBLEMAS_VIEW },
  { value: 'DEMANDA', slug: 'demandas', label: 'Demandas', requiredFn: PermissionFunctionKeys.RADAR_DEMANDAS_TAB_VIEW },
  { value: 'INCIDENTE', slug: 'incidentes', label: 'Incidentes', requiredFn: PermissionFunctionKeys.RADAR_INCIDENTES_VIEW },
  { value: 'SOLICITACAO', slug: 'solicitacoes', label: 'Solicitações', requiredFn: PermissionFunctionKeys.RADAR_SOLICITACOES_VIEW },
  { value: 'CATALOGO', slug: 'catalogo', label: 'Catálogo', requiredFn: PermissionFunctionKeys.RADAR_CATALOGO_VIEW },
  { value: 'EFICIENCIA', slug: 'eficiencia', label: 'Eficiência', requiredFn: PermissionFunctionKeys.RADAR_EFICIENCIA_VIEW },
  { value: 'OBSERVABILIDADE', slug: 'observabilidade', label: 'Observabilidade', requiredFn: PermissionFunctionKeys.RADAR_OBSERVABILIDADE_VIEW },
];

const slugToTabValue = (slug) => {
  const found = RADAR_TAB_DEFS.find((t) => t.slug === String(slug || '').toLowerCase());
  return found ? found.value : null;
};

const tabValueToSlug = (value) => {
  const found = RADAR_TAB_DEFS.find((t) => t.value === value);
  return found ? found.slug : 'geral';
};

const OperacaoHome = ({ userRole }) => {
  const {
    bootLoading,
    error,
    statsRadar,
    statsFingerprint,
    lastSyncAt,
    filterOptions,
    ensureRadarBootstrap,
    refreshRadar,
    squadGrupoMap,
  } = useOperacaoRadar();

  useEffect(() => {
    ensureRadarBootstrap();
  }, [ensureRadarBootstrap]);

  const [allowedFunctions, setAllowedFunctions] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAllowed() {
      if (!userRole) {
        if (!cancelled) setAllowedFunctions([]);
        return;
      }
      try {
        const profile = await getPermissionProfile(userRole);
        const af = Array.isArray(profile?.allowedFunctions) ? profile.allowedFunctions : [];
        if (!cancelled) setAllowedFunctions(af);
      } catch {
        if (!cancelled) setAllowedFunctions([]);
      }
    }
    loadAllowed();
    return () => {
      cancelled = true;
    };
  }, [userRole]);

  // Consistente com Sidebar.jsx: ADMIN_ALL não é implícito para cada chave individual —
  // precisa estar explicitamente marcado no perfil junto com a chave da aba (ou ser adicionado
  // explicitamente aqui) para não conflitar com o toggle manual de cada aba no SECOPS.
  const hasFn = useCallback(
    (fnKey) => allowedFunctions === null || allowedFunctions.includes(fnKey),
    [allowedFunctions]
  );

  const visibleTabs = useMemo(
    () => RADAR_TAB_DEFS.filter((tab) => hasFn(tab.requiredFn)),
    [hasFn]
  );

  const navigate = useNavigate();
  const { tabParam } = useParams();

  const [filters, setFilters] = useState(createRadarFilterState);
  const [activeEscopoTab, setActiveEscopoTab] = useState(() => slugToTabValue(tabParam) || 'GERAL');

  // Sincroniza a aba ativa com o parâmetro de rota (permite acesso direto via URL)
  useEffect(() => {
    const fromUrl = slugToTabValue(tabParam);
    if (fromUrl && fromUrl !== activeEscopoTab) {
      setActiveEscopoTab(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((tab) => tab.value === activeEscopoTab)) {
      const fallback = visibleTabs[0].value;
      setActiveEscopoTab(fallback);
      navigate(fallback === 'GERAL' ? '/' : `/radar/${tabValueToSlug(fallback)}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs]);

  const [ticketsCache, setTicketsCache] = useState(null);
  const [ticketsCacheLoading, setTicketsCacheLoading] = useState(false);

  const [computedRadar, setComputedRadar] = useState(null);
  const [drillEscopo, setDrillEscopo] = useState(null);
  const [drillLabel, setDrillLabel] = useState('');
  const [drillIssueKeyQuery, setDrillIssueKeyQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState(() => new Set());
  const [drillTickets, setDrillTickets] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState('');

  const radar = useMemo(
    () => computedRadar || statsRadar || { total: 0, escopos: [] },
    [computedRadar, statsRadar]
  );

  const radarDataReady =
    !ticketsCacheLoading && Array.isArray(ticketsCache) && ticketsCache.length > 0;

  // Feedback visual de progresso (estimado) durante o bootstrap
  const [bootProgress, setBootProgress] = useState(0);

  useEffect(() => {
    if (!bootLoading) {
      setBootProgress(100);
      const t = setTimeout(() => setBootProgress(0), 400);
      return () => clearTimeout(t);
    }

    setBootProgress(5);

    const start = Date.now();
    const durationMs = 2500; // UX: estimativa até 2.5s

    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(0.98, elapsed / durationMs);
      const next = Math.round(5 + ratio * 90);

      setBootProgress((prev) => {
        const prevN = Number.isFinite(prev) ? prev : 0;
        const nextN = Number.isFinite(next) ? next : 5;
        return Math.max(prevN, nextN);
      });
    }, 100);

    return () => clearInterval(id);
  }, [bootLoading]);

  const drillHierarchy = useMemo(() => {
    if (drillEscopo === null) {
      return { roots: [], childrenByParent: new Map(), totalTickets: 0 };
    }
    return prepareDrillHierarchy(drillTickets, drillEscopo || undefined, drillIssueKeyQuery);
  }, [drillTickets, drillEscopo, drillIssueKeyQuery]);

  const drillRows = useMemo(
    () => flattenDrillHierarchy(drillHierarchy, expandedParents),
    [drillHierarchy, expandedParents]
  );

  const derivedStatusOptions = useMemo(() => {
    if (!Array.isArray(ticketsCache) || ticketsCache.length === 0) return [];
    const counts = new Map();
    for (const t of ticketsCache) {
      const s = t.status ? String(t.status).trim() : '';
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([nome, total]) => ({ id: nome, nome, total }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [ticketsCache]);

  const effectiveFilterOptions = useMemo(() => {
    const base = filterOptions || { grupos: [], squads: [], statuses: [] };
    const statuses = Array.isArray(base.statuses) && base.statuses.length > 0
      ? base.statuses
      : derivedStatusOptions;
    return { ...base, statuses };
  }, [filterOptions, derivedStatusOptions]);

  const hasData = Boolean(statsRadar?.total);
  const filterActive =
    filters.grupos.size > 0 ||
    filters.squads.size > 0 ||
    filters.statuses.size > 0 ||
    Boolean(filters.createdAt?.start) ||
    Boolean(filters.createdAt?.end) ||
    Boolean(filters.resolvedAt?.start) ||
    Boolean(filters.resolvedAt?.end);

  const filtersReady =
    Array.isArray(filterOptions?.grupos) &&
    filterOptions.grupos.length > 0 &&
    Array.isArray(filterOptions?.squads) &&
    filterOptions.squads.length > 0 &&
    Array.isArray(effectiveFilterOptions?.statuses) &&
    effectiveFilterOptions.statuses.length > 0;

  const shouldBlockFilters = bootLoading || ticketsCacheLoading || !filtersReady;

  const openDrill = useCallback(
    async (escopoKey, label) => {
      setDrillIssueKeyQuery('');
      setExpandedParents(new Set());
      setDrillEscopo(escopoKey);
      setDrillLabel(label);
      setDrillTickets([]);
      setDrillError('');
      setDrillLoading(true);

      try {
        if (!Array.isArray(ticketsCache)) {
          setDrillTickets([]);
          return;
        }

        // filtra somente no recorte do escopo e aplica filtros atuais em memória
        const baseTickets = escopoKey
          ? ticketsCache.filter(
              (t) => String(t.escopo || '').toUpperCase() === String(escopoKey).toUpperCase()
            )
          : ticketsCache;

        const filteredTickets = filterTickets(baseTickets, filters, squadGrupoMap || new Map());
        setDrillTickets(filteredTickets);
      } catch (err) {
        setDrillError(formatCallableError(err));
      } finally {
        setDrillLoading(false);
      }
    },
    [ticketsCache, filters, squadGrupoMap]
  );

  const handleSaveTicketField = useCallback(
    async (issueKey, fieldName, rawValue) => {
      try {
        const patch = { [fieldName]: rawValue };
        const saved = await updateTicketRadarFields(issueKey, patch);

        const applyPatch = (list) =>
          Array.isArray(list)
            ? list.map((t) => (t.issueKey === issueKey ? { ...t, ...saved } : t))
            : list;

        setDrillTickets((prev) => applyPatch(prev));
        setTicketsCache((prev) => applyPatch(prev));
      } catch (err) {
        console.error('Erro ao salvar campo do ticket:', err);
      }
    },
    []
  );

  const toggleParentExpand = (issueKey) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(issueKey)) next.delete(issueKey);
      else next.add(issueKey);
      return next;
    });
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(createRadarFilterState());
    setDrillEscopo(null);
    setDrillLabel('');
    setDrillIssueKeyQuery('');
    setExpandedParents(new Set());
    setDrillTickets([]);
    setDrillError('');
  };

  // 1) Ao entrar na tela Radar, carregar tickets_global uma vez (memória + cache)
  useEffect(() => {
    let cancelled = false;

    async function ensureTicketsCache() {
      if (!statsFingerprint) return;
      if (!hasData) return;
      if (ticketsCacheLoading) return;
      if (Array.isArray(ticketsCache) && ticketsCache.length >= 0) return;

      const ticketsCacheKey = `operacao_radar_tickets_${statsFingerprint}`;
      const cached = (() => {
        try {
          return sessionStorage.getItem(ticketsCacheKey);
        } catch {
          return null;
        }
      })();

      let cachedTickets = null;
      if (cached) {
        try {
          cachedTickets = JSON.parse(cached);
        } catch {
          cachedTickets = null;
        }
      }

      if (Array.isArray(cachedTickets)) {
        setTicketsCache(cachedTickets);
        return;
      }

      setTicketsCacheLoading(true);
      try {
        const loaded = await fetchTicketsGlobalForRadar();
        if (cancelled) return;

        setTicketsCache(loaded);
        try {
          sessionStorage.setItem(ticketsCacheKey, JSON.stringify(loaded));
        } catch {
          // ignore
        }
      } finally {
        if (!cancelled) setTicketsCacheLoading(false);
      }
    }

    ensureTicketsCache();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsFingerprint, hasData]);

  // 2) Ao filtrar, recomputa totais/lanes a partir do tickets em memória
  useEffect(() => {
    let cancelled = false;

    async function ensureTicketsAndCompute() {
      if (!statsFingerprint) return;
      if (!filterActive) {
        setComputedRadar(null);
        return;
      }

      if (!Array.isArray(ticketsCache)) return;

      const filtrosFingerprint = JSON.stringify({
        grupos: [...filters.grupos].sort(),
        squads: [...filters.squads].sort(),
        statuses: [...filters.statuses].sort(),
        createdAt: filters.createdAt,
        resolvedAt: filters.resolvedAt,
      });

      const radarCacheKey = `operacao_radar_filtered_${statsFingerprint}_${filtrosFingerprint}`;
      const cachedRadar = (() => {
        try {
          return sessionStorage.getItem(radarCacheKey);
        } catch {
          return null;
        }
      })();

      if (cachedRadar) {
        try {
          const parsed = JSON.parse(cachedRadar);
          if (parsed && Array.isArray(parsed?.escopos)) {
            setComputedRadar(parsed);
            return;
          }
        } catch {
          // ignore
        }
      }

      const filteredTickets = filterTickets(ticketsCache, filters, squadGrupoMap || new Map());
      const nextRadar = computeRadarEscopos(filteredTickets);

      if (!cancelled) {
        setComputedRadar(nextRadar);
        try {
          sessionStorage.setItem(radarCacheKey, JSON.stringify(nextRadar));
        } catch {
          // ignore
        }
      }
    }

    ensureTicketsAndCompute();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterActive,
    statsFingerprint,
    ticketsCache,
    filters.grupos.size,
    filters.squads.size,
    filters.statuses.size,
    filters.createdAt?.start,
    filters.createdAt?.end,
    filters.resolvedAt?.start,
    filters.resolvedAt?.end,
    squadGrupoMap,
  ]);

  const problemsTotal = useMemo(() => {
    return (radar.escopos || []).find((e) => e.key === 'PROBLEMAS')?.total || 0;
  }, [radar.escopos]);

  const demandasTotal = useMemo(() => {
    return (
      (radar.escopos || []).find((e) => e.key === 'DEMANDA FAST')?.total || 0
    ) + (
      (radar.escopos || []).find((e) => e.key === 'DEMANDA')?.total || 0
    );
  }, [radar.escopos]);

  const incidentesTotal = useMemo(() => {
    return (radar.escopos || []).find((e) => e.key === 'INCIDENTE')?.total || 0;
  }, [radar.escopos]);

  const solicitacoesTotal = useMemo(() => {
    return (radar.escopos || []).find((e) => e.key === 'SOLICITACAO')?.total || 0;
  }, [radar.escopos]);

  const geralCards = useMemo(() => {
    const escopos = radar.escopos || [];
    const findTotal = (key) => escopos.find((e) => e.key === key)?.total || 0;

    return [
      { key: 'PROBLEMAS', label: 'PROBLEMAS', total: findTotal('PROBLEMAS'), color: '#ff4d4f' },
      {
        key: 'DEMANDA_FAST',
        label: 'DEMANDA FAST',
        total: findTotal('DEMANDA FAST'),
        color: '#ff9f43',
      },
      { key: 'DEMANDA', label: 'DEMANDA', total: findTotal('DEMANDA'), color: '#1f77b4' },
      { key: 'INCIDENTE', label: 'INCIDENTE', total: findTotal('INCIDENTE'), color: '#2ecc71' },
      {
        key: 'SOLICITACAO',
        label: 'SOLICITACAO',
        total: findTotal('SOLICITACAO'),
        color: '#00c2ff',
      },
      {
        key: 'CATALOGO',
        label: 'CATÁLOGO',
        total: findTotal('CATALOGODEP') || findTotal('CATÁLOGO'),
        color: '#a855f7',
      },
    ];
  }, [radar.escopos]);

  return (
    <Box p="5" className="operacao-radar-panel">
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="2">
        <Flex align="center" gap="3">
          <Radar size={28} color="#22d3ee" />
          <Box className="operacao-radar-header">
            <Text as="h2" size="7" weight="bold" style={{ margin: 0 }}>
              Radar Operação AMS
            </Text>
            <Text as="p" size="3" color="gray">
              Totais consolidados em <code>operacao_stats/summary</code>. Detalhes por escopo são
              lidos do Firestore sob demanda.
            </Text>
          </Box>
        </Flex>
        <Flex align="center" gap="3">
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
          <button
            className="btn btn-ghost"
            onClick={refreshRadar}
            disabled={bootLoading}
            type="button"
          >
            <RefreshCw size={16} /> Atualizar
          </button>
        </Flex>
      </Flex>

      {error && (
        <Callout.Root color="red" mb="4">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {(bootLoading || ticketsCacheLoading) && (
        <Box mb="4" className="operacao-radar-boot-progress">
          <Text size="2" color="gray" mb="2">
            {bootLoading ? 'Carregando totais do radar… ' : 'Aguarde enquanto consolidamos os dados… '}
            {bootLoading && (
              <Text as="span" size="2" color="indigo">
                {bootProgress}%
              </Text>
            )}
          </Text>
          <Progress value={bootLoading ? bootProgress : 60} />
          <Text size="1" color="gray" mt="2">
            Enquanto os dados estão sendo processados, os filtros ficam bloqueados para evitar travamentos.
          </Text>
        </Box>
      )}

      {!bootLoading && !hasData && (
        <Callout.Root color="amber" mb="4">
          <Callout.Text>
            Nenhum ticket em <code>tickets_global</code>. Execute a carga Jira em Configurações →
            Jira Operação (botão <strong>Iniciar Carga</strong>).
          </Callout.Text>
        </Callout.Root>
      )}

      {!bootLoading && hasData && (
        <>
          {/* Filters ABOVE tabs */}
          <Box mb="4">
            <Box
              className="operacao-radar-filters"
              style={{ opacity: shouldBlockFilters ? 0.6 : 1 }}
            >
              <OperacaoMultiCombobox
                label="GRUPO DE ATENDIMENTO"
                placeholder="Todos os grupos"
                options={effectiveFilterOptions.grupos}
                selected={filters.grupos}
                onChange={(value) => updateFilter('grupos', value)}
                disabled={shouldBlockFilters}
                formatMeta={(item) => `${formatNumber(item.total)} tickets`}
              />
              <OperacaoMultiCombobox
                label="SQUAD"
                placeholder="Todas as squads"
                options={effectiveFilterOptions.squads}
                selected={filters.squads}
                onChange={(value) => updateFilter('squads', value)}
                disabled={shouldBlockFilters}
                formatOption={(item) => (item.sigla ? `${item.sigla} — ${item.nome}` : item.nome)}
                formatMeta={(item) => `${formatNumber(item.total)} tickets`}
              />
              <OperacaoMultiCombobox
                label="STATUS DO TICKET"
                placeholder="Todos os status"
                options={effectiveFilterOptions.statuses}
                selected={filters.statuses}
                onChange={(value) => updateFilter('statuses', value)}
                disabled={shouldBlockFilters}
                formatMeta={(item) => `${formatNumber(item.total)} tickets`}
              />

              <Box style={{ paddingRight: '0.75rem', borderRight: '1px solid var(--glass-border)' }}>
                <OperacaoDateRangeFilter
                  label="DATA DE CRIAÇÃO (CREATED_AT)"
                  value={filters.createdAt}
                  onChange={(value) => updateFilter('createdAt', value)}
                  disabled={shouldBlockFilters}
                />
              </Box>

              <OperacaoDateRangeFilter
                label="DATA DE RESOLUÇÃO (RESOLVED_AT)"
                value={filters.resolvedAt}
                onChange={(value) => updateFilter('resolvedAt', value)}
                disabled={shouldBlockFilters}
              />

              <Flex
                className="operacao-radar-filter-actions"
                align="center"
                justify="between"
                wrap="wrap"
                gap="2"
              >
                <Text className="operacao-radar-filter-summary">
                  Filtros globais desativados para reduzir leituras do Firestore. Clique em um escopo
                  para carregar a tabela de tickets daquele grupo.
                </Text>
                {filterActive && (
                  <button
                    type="button"
                    className="operacao-radar-clear-filters btn btn-ghost"
                    onClick={clearFilters}
                  >
                    <XCircle size={16} /> Limpar filtros
                  </button>
                )}
              </Flex>
            </Box>
          </Box>

          <RadixTabs.Root
            value={activeEscopoTab}
            onValueChange={(next) => {
              setActiveEscopoTab(next);
              setDrillEscopo(null);
              setDrillLabel('');
              setDrillIssueKeyQuery('');
              setExpandedParents(new Set());
              setDrillTickets([]);
              setDrillError('');
              navigate(next === 'GERAL' ? '/' : `/radar/${tabValueToSlug(next)}`);
            }}
            mb="4"
          >
            <RadixTabs.List>
              {visibleTabs.map((tab) => (
                <RadixTabs.Trigger key={tab.value} value={tab.value}>
                  {tab.label}
                </RadixTabs.Trigger>
              ))}
            </RadixTabs.List>
          </RadixTabs.Root>

          <Flex gap="4" align="start">
            <Box style={{ flex: 1, minWidth: 320 }}>
              {activeEscopoTab === 'GERAL' ? (
                <>
                  <Box mt="1" className="operacao-radar-summary">
                    <Flex className="operacao-radar-summary-row" align="center" gap="3" wrap="wrap">
                      <button
                        type="button"
                        className="operacao-radar-summary-value"
                        title="Ver tickets"
                        onClick={() => openDrill('', 'Todos os escopos')}
                        disabled={drillLoading}
                      >
                        {formatNumber(radar.total)}
                      </button>
                    </Flex>
                    <Text className="operacao-radar-summary-label">Tickets em todos os escopos</Text>
                  </Box>

                  <Box className="operacao-radar-lanes" mt="4" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    {geralCards.map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        className="operacao-radar-summary-value"
                        onClick={() => openDrill(card.key, card.label)}
                        disabled={drillLoading}
                        style={{
                          width: 210,
                          height: 86,
                          borderRadius: 16,
                          border: `1px solid rgba(255,255,255,0.08)`,
                          background: 'rgba(255,255,255,0.02)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          padding: 16,
                          gap: 6,
                          cursor: 'pointer',
                        }}
                        title={`Ver tickets de ${card.label}`}
                      >
                        <Text
                          size="7"
                          weight="bold"
                          style={{ margin: 0, color: card.color, lineHeight: 1 }}
                        >
                          {formatNumber(card.total)}
                        </Text>
                        <Text size="2" color="gray" style={{ margin: 0, textTransform: 'uppercase' }}>
                          {card.label}
                        </Text>
                      </button>
                    ))}
                  </Box>
                </>
              ) : activeEscopoTab === 'EFICIENCIA' ? (
                (() => {
                  const filteredTicketsAll = Array.isArray(ticketsCache)
                    ? filterTickets(ticketsCache, filters, squadGrupoMap || new Map())
                    : [];
                  return <OperacaoEfficiencyChart tickets={filteredTicketsAll} />;
                })()
              ) : activeEscopoTab === 'OBSERVABILIDADE' ? (
                (() => {
                  const filteredTicketsAll = Array.isArray(ticketsCache)
                    ? filterTickets(ticketsCache, filters, squadGrupoMap || new Map())
                    : [];
                  return <OperacaoObservabilidade tickets={filteredTicketsAll} />;
                })()
              ) : (
                (() => {
                  const tabCard = geralCards.find((c) => c.key === activeEscopoTab) || {
                    key: activeEscopoTab,
                    label: activeEscopoTab,
                    total: 0,
                    color: '#22d3ee',
                  };
                  const escopoTickets = Array.isArray(ticketsCache)
                    ? filterTickets(
                        ticketsCache.filter(
                          (t) => String(t.escopo || '').toUpperCase() === String(activeEscopoTab).toUpperCase()
                        ),
                        filters,
                        squadGrupoMap || new Map()
                      )
                    : [];
                  return (
                    <>
                      <Box mt="1" className="operacao-radar-summary">
                        <Flex className="operacao-radar-summary-row" align="center" gap="3" wrap="wrap">
                          <button
                            type="button"
                            className="operacao-radar-summary-value"
                            title={`Ver tickets de ${tabCard.label}`}
                            onClick={() => openDrill(tabCard.key, tabCard.label)}
                            disabled={drillLoading}
                            style={{ color: tabCard.color }}
                          >
                            {formatNumber(tabCard.total)}
                          </button>
                        </Flex>
                        <Text className="operacao-radar-summary-label">Tickets em {tabCard.label}</Text>
                      </Box>

                      <OperacaoEscopoTimelineChart tickets={escopoTickets} />
                    </>
                  );
                })()
              )}

              {drillEscopo !== null && (
                <Box className="operacao-radar-tickets-panel">
                  <Flex className="operacao-radar-tickets-header" align="center" justify="between" wrap="wrap" gap="3">
                    <Box>
                      <Text size="4" weight="bold">
                        Tickets · {drillLabel || getEscopoRadarMeta(drillEscopo).label}
                      </Text>
                      <Text size="2" color="gray">
                        {drillLoading
                          ? 'Consultando tickets no Firestore…'
                          : `${formatNumber(drillHierarchy.totalTickets)} ticket(s)${
                              drillRows.length < drillHierarchy.totalTickets
                                ? ` · ${formatNumber(drillRows.length)} exibido(s)`
                                : ''
                            }`}
                      </Text>
                    </Box>
                    <Box className="operacao-radar-drill-filter">
                      <Text size="1" weight="bold" color="gray" mb="1" style={{ letterSpacing: '0.06em' }}>
                        ISSUE_KEY
                      </Text>
                      <TextField.Root
                        size="2"
                        placeholder="Filtrar por chave (ex: PROB-483)"
                        value={drillIssueKeyQuery}
                        onChange={(event) => setDrillIssueKeyQuery(event.target.value)}
                        style={{ minWidth: 240 }}
                        disabled={drillLoading}
                      >
                        <TextField.Slot>
                          <Search size={14} />
                        </TextField.Slot>
                      </TextField.Root>
                    </Box>
                  </Flex>

                  {drillError && (
                    <Callout.Root color="red" mb="3">
                      <Callout.Text>{drillError}</Callout.Text>
                    </Callout.Root>
                  )}

                  {drillLoading ? (
                    <Box mt="3">
                      <Progress />
                    </Box>
                  ) : drillHierarchy.totalTickets === 0 ? (
                    <Text size="2" color="gray">
                      {drillIssueKeyQuery.trim()
                        ? `Nenhum ticket com issue_key contendo "${drillIssueKeyQuery.trim()}".`
                        : 'Nenhum ticket encontrado para esta seleção.'}
                    </Text>
                  ) : (
                    <Box className="operacao-radar-tickets-table-wrap">
                      <table className="operacao-radar-tickets-table">
                        <thead>
                          <tr>
                            <th>ISSUE_KEY</th>
                            <th>ISSUETYPE</th>
                            <th>SUMMARY</th>
                            <th>STATUS</th>
                            <th>PRIORITY</th>
                            <th>CREATED_AT</th>
                            <th>AGING</th>
                            <th>UPDATE_AT</th>
                            <th>TICKETS_VINCULADOS</th>
                            <th>GRUPO_SUPORTE</th>
                            <th>ESCOPO</th>
                            <th>PRIORIDADE INT.</th>
                            <th>RESPONSÁVEL ATUAL</th>
                            <th>DATA DE PREVISÃO</th>
                            <th>OBSERVAÇÃO ADICIONAL</th>
                            <th>ESTIMATIVA MACRO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillRows.map((ticket) => (
                            <tr
                              key={ticket.issueKey}
                              className={ticket.depth > 0 ? 'operacao-radar-tickets-row-child' : undefined}
                            >
                              <td
                                className="operacao-radar-tickets-key-cell"
                                style={{ paddingLeft: `${0.75 + ticket.depth * 1.35}rem` }}
                              >
                                {ticket.hasChildren ? (
                                  <button
                                    type="button"
                                    className="operacao-radar-tickets-expand"
                                    title={
                                      ticket.isExpanded
                                        ? 'Recolher tickets filhos'
                                        : `Expandir ${formatNumber(ticket.childCount)} ticket(s) filho(s)`
                                    }
                                    aria-expanded={ticket.isExpanded}
                                    onClick={() => toggleParentExpand(ticket.issueKey)}
                                  >
                                    {ticket.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                ) : (
                                  <span className="operacao-radar-tickets-expand placeholder" aria-hidden="true" />
                                )}
                                {ticket.issueUrl ? (
                                  <a
                                    className="operacao-radar-tickets-key"
                                    href={ticket.issueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {ticket.issueKey}
                                  </a>
                                ) : (
                                  ticket.issueKey
                                )}
                                {ticket.hasChildren && !ticket.isExpanded && (
                                  <span className="operacao-radar-tickets-child-count">
                                    {formatNumber(ticket.childCount)} filho(s)
                                  </span>
                                )}
                              </td>
                              <td>{ticket.issueType || '—'}</td>
                              <td className="operacao-radar-tickets-summary">{ticket.summary || '—'}</td>
                              <td>{ticket.status || '—'}</td>
                              <td>{ticket.priority || '—'}</td>
                              <td>{formatDateTime(ticket.createdAt)}</td>
                              <td>{ticket.agingDays != null ? `${formatNumber(ticket.agingDays)} d` : '—'}</td>
                              <td>{formatDateTime(ticket.updatedAt)}</td>
                              <td className="operacao-radar-tickets-linked">{ticket.linkedTicketsLabel || '—'}</td>
                              <td>{ticket.grupoSuporte || '—'}</td>
                              <td>{ticket.escopo || '—'}</td>
                              <td>
                                <select
                                  className="operacao-radar-tickets-editable-input operacao-radar-tickets-editable-input-narrow"
                                  defaultValue={ticket.prioridadeInterna ?? ''}
                                  onChange={(e) =>
                                    handleSaveTicketField(ticket.issueKey, 'prioridadeInterna', e.target.value === '' ? null : Number(e.target.value))
                                  }
                                  style={{ minWidth: 72 }}
                                >
                                  <option value="">—</option>
                                  {PRIORIDADE_INTERNA_OPTIONS.map((p) => (
                                    <option key={p.value} value={p.value}>
                                      {p.label} {p.description}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="operacao-radar-tickets-editable-input"
                                  defaultValue={ticket.responsavelAtual || ''}
                                  placeholder="—"
                                  onBlur={(e) =>
                                    handleSaveTicketField(ticket.issueKey, 'responsavelAtual', e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="operacao-radar-tickets-editable-input"
                                  defaultValue={
                                    ticket.dataPrevisao ? String(ticket.dataPrevisao).slice(0, 10) : ''
                                  }
                                  onBlur={(e) =>
                                    handleSaveTicketField(ticket.issueKey, 'dataPrevisao', e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="operacao-radar-tickets-editable-input operacao-radar-tickets-editable-input-wide"
                                  defaultValue={ticket.observacaoAdicional || ''}
                                  placeholder="—"
                                  onBlur={(e) =>
                                    handleSaveTicketField(ticket.issueKey, 'observacaoAdicional', e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="operacao-radar-tickets-editable-input operacao-radar-tickets-editable-input-narrow"
                                  defaultValue={ticket.estimativaMacro ?? ''}
                                  placeholder="—"
                                  onBlur={(e) =>
                                    handleSaveTicketField(ticket.issueKey, 'estimativaMacro', e.target.value)
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            {/* RIGHT: removido (fica apenas 1 coluna com tiles) */}
          </Flex>
        </>
      )}
    </Box>
  );
};

export default OperacaoHome;
